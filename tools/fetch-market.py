# -*- coding: utf-8 -*-
"""ドル指数・日経225・日経VI・原油・米株価指数の日足終値を取り、記事に書ける形で出す。

    python tools/fetch-market.py

`fetch-indicators.py` からも呼ばれる。

## なぜ作ったか

FRED に無い指標（DXY・日経225・原油・日経VI・ドル円）は、当日の報道を検索して
拾っていた。報道は出所ごとに値が割れ、検索結果は要約を通るため、**同じ日の終値が
決められない日が続いた**（10/13・10/14 号のドル指数がどちらも「未確認」）。
FRED の実質金利と同じく、問題は値が無いことではなく、取り方だった。

Yahoo Finance のチャートAPI（/v8/finance/chart/）は、取引所の日足を JSON で返す。
鍵は要らず、クラウドの実行環境からも通る（2026-10-14 に確認）。10/13 の値は
DXY 102.18・日経 67,777.52・WTI 94.14・Brent 105.69 で、いずれも清算値・終値を
書いた報道と一致した。割れていた「DXY 101.989」のほうが誤りだった。

## 一次データではない

Yahoo は取引所のデータを中継する集約サイトで、一次の出所ではない。それでも採るのは、
**系列が固定され、日付つきの生の値が機械で取れる**からである。報道を毎朝寄せ集める
よりずっとぶれない。ICE の公式清算値とは小数第2位で違うことがある（10/12 は
102.58 と、報道の 102.59）。

## 取引中の足を混ぜない

最後の足は取引中のことがある。次のどちらかに当たる最後の足は捨て、確定した足だけを出す。

- 足の時刻が最終取引時刻（regularMarketTime）と同じ（DXY・先物。ほぼ24時間動く）
- 足の時刻が現在の取引時間帯の中にあり、その時間帯がまだ終わっていない（日経225・日経VI）

日付は取引所の時間帯で数える。

## 為替（ドル円・ユーロドル）は取らない

Yahoo の為替の日足は、始値と終値がほぼ同じで、**その日の始まり（ロンドン0時）の
時点の値**になっている。10/13 の足の 1.1160 は 10/12 のNYの引け（報道 1.1158）で、
10/13 の引け（報道 1.1202）は翌日の足の始値に入っていた。日付が1日ずれた値を
「その日の終値」として出すことになるので、系列に入れない。為替は報道から取る。

## 取れなかったら

非公式のAPIなので、仕様が変わって止まることがありうる。そのときは従来どおり報道を
複数社で突き合わせ、決まらなければ「未確認」と書く（docs/SOURCES.md）。
"""
import json
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

sys.stdout.reconfigure(encoding="utf-8")

# (記号, 記事での呼び名, 定義, 小数の桁)
SERIES = [
    ("DX-Y.NYB", "ドル指数（DXY）", "ICE 米ドル指数の日足終値", 2),
    ("^N225", "日経225", "日足終値", 2),
    ("^NKVI.OS", "日経VI", "日足終値", 2),
    ("CL=F", "WTI原油（期近先物）", "NYMEX 期近の清算値。限月交代の日は前日比が限月をまたぐ", 2),
    ("BZ=F", "Brent原油（期近先物）", "ICE 期近の清算値。限月交代の日は前日比が限月をまたぐ", 2),
    ("GC=F", "金先物（COMEX 期近）", "参考。現物の値は USAGOLD（fetch-gold.py）を使う", 2),
    ("^GSPC", "S&P 500", "日足終値。FRED SP500 の裏取り", 2),
    ("^IXIC", "Nasdaq総合", "日足終値", 2),
    ("^DJI", "ダウ平均", "日足終値", 2),
    ("^VIX", "VIX", "日足終値。FRED VIXCLS の裏取り", 2),
]

HOSTS = ("query1.finance.yahoo.com", "query2.finance.yahoo.com")
PATH = "/v8/finance/chart/{}?range=10d&interval=1d"
# Python 既定の UA だと 429 が返る（2026-10-14 に確認）
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
JST = ZoneInfo("Asia/Tokyo")


def chart(symbol: str) -> dict:
    sym = urllib.parse.quote(symbol, safe="")
    last = None
    for host in HOSTS:
        req = urllib.request.Request(f"https://{host}{PATH.format(sym)}", headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                payload = json.loads(r.read().decode("utf-8"))
            res = (payload.get("chart") or {}).get("result")
            if res:
                return res[0]
            last = RuntimeError(((payload.get("chart") or {}).get("error") or {}).get("description", "結果が空です"))
        except (OSError, ValueError) as e:
            last = e
    raise last


def closes(res: dict, now: float):
    """確定した足だけを [(日付, 値)] で返す。古い順"""
    meta = res["meta"]
    tz = ZoneInfo(meta["exchangeTimezoneName"])
    stamps = res.get("timestamp") or []
    values = res["indicators"]["quote"][0].get("close") or []
    period = (meta.get("currentTradingPeriod") or {}).get("regular") or {}
    rmt = meta.get("regularMarketTime")

    bars = [(t, v) for t, v in zip(stamps, values) if v is not None]
    if bars:
        t, _ = bars[-1]
        live_tick = rmt is not None and abs(t - rmt) < 120
        in_session = period and period["start"] <= t < period["end"] and now < period["end"]
        if live_tick or in_session:
            bars = bars[:-1]

    out = []
    for t, v in bars:
        d = datetime.fromtimestamp(t, tz).date()
        if d.weekday() >= 5:
            continue
        if out and out[-1][0] == d:
            out[-1] = (d, v)
        else:
            out.append((d, v))
    return out


def business_days_between(a: date, b: date) -> int:
    n, c = 0, a
    while c < b:
        c += timedelta(days=1)
        if c.weekday() < 5:
            n += 1
    return n


def fmt(v: float, digits: int) -> str:
    return f"{v:,.{digits}f}"


def pct(new: float, old: float) -> str:
    p = (new / old - 1) * 100
    s = f"{abs(p):.2f}%"
    return ("+" if p > 0 else "−" if p < 0 else "±") + s


def report() -> int:
    now = datetime.now(timezone.utc).timestamp()
    today = datetime.now(JST).date()
    failed = []
    for symbol, name, definition, digits in SERIES:
        try:
            rows = closes(chart(symbol), now)
        except Exception as e:
            print(f"NG  {name}（{symbol}）取得できません: {e}")
            failed.append(name)
            continue
        if not rows:
            print(f"NG  {name}（{symbol}）確定した足がありません")
            failed.append(name)
            continue
        d, v = rows[-1]
        lag = business_days_between(d, today)
        mark = "  " if lag <= 2 else "△ "
        chg = ""
        if len(rows) >= 2:
            pd_, pv = rows[-2]
            chg = f"、{pd_.month}/{pd_.day}比 {pct(v, pv)}"
        print(f"{mark}{name}：{fmt(v, digits)}（{d.month}/{d.day}終値{chg}、Yahoo {symbol}）")
        print(f"      {definition}")

    print("\n本文にはこの形式で、「◯/◯終値」と比較した日付を添えて書く。")
    print("報道と同じ定義の値が食い違ったら、この値を採る（docs/SOURCES.md §1）。")
    print("△ は確定した足が3営業日以上前のもの。休場明けなら正常。")
    if failed:
        print("\n取れなかった指標は、報道を複数社で突き合わせて取る。決まらなければ「未確認」と書く。")
        print("**要約された文章から数字を読まない。**")
        for n in failed:
            print(f"  - {n}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(report())
