# -*- coding: utf-8 -*-
"""金（XAU/USD 現物）の日次の値を USAGOLD の価格履歴から取る。

    python tools/fetch-gold.py            直近2日分
    python tools/fetch-gold.py 2026-10    月を指定

`fetch-indicators.py` からも呼ばれる。

## なぜこの取得元か

金の「終値」は出所ごとに値が割れる（同じ日に 4,290 / 4,304 / 4,314 / 4,318 と
4つに割れた実例がある）。報道の値を寄せ集めると毎朝ぐらつくので、**同じ系列を
同じ時刻で記録している表**を1つ決めて、そこから取る。

USAGOLD の価格履歴（https://www.usagold.com/daily-gold-price-history/）は
「(XAUUSD) Prices logged 3:00 Mountain time daily」と定義を明記した日次の表で、
1993年からの日別の値がある。山岳部時間 15:00 は日本時間の翌朝 6時（夏時間）〜7時で、
8時の定期実行までに前営業日の値が載る。

## 取り方

表はページを開いたあと JavaScript が admin-ajax.php から取っている。素の POST は
Cloudflare の確認画面に当たるが、**先にページを GET して cookie を受け取り、
Referer と X-Requested-With を付けて POST すれば通る**（2026-10-06 に確認）。
nonce はページの `var ajax = {...}` にある。

## 注意

- ページ上部の「Yesterday」の値は、表の同じ日の値と一致しないことがある
  （10/5 は上部 4,140.65、表 4,139.99）。**表の値を採る。**上部は読まない
- **山岳部時間でまだ当日の日付のセルは、その時点の値で動いている**（10/5 のセルは
  20時に 4,139.99、23時に 4,134.16 だった）。日本時間 8時は山岳部時間の前日 17時なので、
  定期実行が読む最新日のセルはこの「動いている」セルにあたる。翌日になると固まる。
  値には読んだ時点を添え、翌号で固まった値と照合する（FRED の遅れ系列と同じ扱い）
- 日次レポートのページ（/daily-precious-metals-market-report/）は 403 で開けない。
  価格履歴のページとは別物で、こちらは使わない
- 取れなかったら「未確認」と書く。報道の値で埋めない
"""
import http.cookiejar
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime
from zoneinfo import ZoneInfo

sys.stdout.reconfigure(encoding="utf-8")

PAGE = "https://www.usagold.com/daily-gold-price-history/"
AJAX = "https://www.usagold.com/wp-admin/admin-ajax.php"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36"
)
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


def calendar(year: int, month: int):
    """{日付: (値, 前日比)} を返す。値は float、前日比は float か None"""
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(PAGE, headers={"User-Agent": UA})
    with opener.open(req, timeout=30) as r:
        html = r.read().decode("utf-8", "ignore")
    m = re.search(r"var ajax\s*=\s*(\{.*?\})\s*;", html)
    if not m:
        raise RuntimeError("ページから nonce を読めません（構造が変わった可能性）")
    nonce = json.loads(m.group(1)).get("update_pricing_calendar")
    if not nonce:
        raise RuntimeError("update_pricing_calendar の nonce がありません")

    body = urllib.parse.urlencode({
        "action": "update_pricing_calendar",
        "_ajax_nonce": nonce,
        "year": year,
        "month": month,
        "metal": "gold",
    }).encode()
    req = urllib.request.Request(AJAX, data=body, headers={
        "User-Agent": UA,
        "Referer": PAGE,
        "Origin": "https://www.usagold.com",
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01",
    })
    with opener.open(req, timeout=30) as r:
        raw = r.read().decode("utf-8", "ignore")
    try:
        payload = json.loads(raw)
    except ValueError:
        raise RuntimeError("表の応答が JSON ではありません（Cloudflare の確認画面の可能性）")
    if not payload.get("success"):
        raise RuntimeError("表の取得に失敗しました")
    h = payload["data"]["html"]

    out = {}
    # セルは <td class='day cell cell--pos'>5 <div class="u-price"> … 値 … 前日比 … </td>
    # 前月・翌月の日は class が 'empty' で、同じ表に値つきで混ざる。当月（'day'）だけ採る
    for cls, cell in re.findall(r"<td class='([^']*)'>(.*?)</td>", h, re.S):
        if "empty" in cls.split():
            continue
        day = re.match(r"\s*(\d{1,2})", cell)
        val = re.search(r'u-price__value">.*?</span>([\d,]+\.\d+)</bdi>', cell, re.S)
        if not (day and val):
            continue
        d = date(year, month, int(day.group(1)))
        chg = re.search(r'u-price__change">(.*?)</p>', cell, re.S)
        change = None
        if chg:
            txt = re.sub(r"<[^>]+>", "", chg.group(1)).replace("&#36;", "")
            mm = re.search(r"([+-]?)\s*([\d,]+\.\d+)", txt)
            if mm:
                change = float(mm.group(2).replace(",", ""))
                if mm.group(1) == "-" or txt.strip().startswith("-"):
                    change = -change
        out[d] = (float(val.group(1).replace(",", "")), change)
    return out


def report(months: int = 1) -> int:
    today = date.today()
    y, m = today.year, today.month
    rows = {}
    try:
        rows.update(calendar(y, m))
        # 月初は前月の分も要る（前日との比較と、当月がまだ空の場合）
        if len(rows) < 2:
            py, pm = (y - 1, 12) if m == 1 else (y, m - 1)
            rows.update(calendar(py, pm))
    except Exception as e:
        print(f"NG  金（XAU/USD）USAGOLD から取得できません: {e}")
        print("    ブラウザで次を開き、カレンダーの該当日のセルに書かれた値をそのまま読む。")
        print(f"    {PAGE}")
        print("    上部の「Yesterday」は表と一致しないことがあるので読まない。")
        print("    取れなければ「未確認」と書く。報道の値で埋めない。")
        return 1

    days = sorted(rows)[-2:]
    if not days:
        print("NG  金（XAU/USD）表に値がありません")
        return 1
    now_mt = datetime.now(ZoneInfo("America/Denver"))
    for d in days:
        v, c = rows[d]
        chg = "" if c is None else f"、前日比 {c:+,.2f}ドル"
        if d == now_mt.date():
            when = f"{d.month}/{d.day} {now_mt:%H:%M} 山岳部時間に読み取り。表は同日中は動く"
        else:
            when = f"{d.month}/{d.day} USAGOLD 価格履歴の確定値"
        print(f"  金（XAU/USD 現物）：{v:,.2f}ドル（{when}{chg}）")
    print("  snapshot の XAU / USD と本文の金の値にはこれを使い、括弧内の時点をそのまま添える。")
    print("  「読み取り」の値は翌号で確定値と照合し、違っていれば差し替える。")
    return 0


if __name__ == "__main__":
    raise SystemExit(report())
