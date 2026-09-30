"""FRED から指標を取り、そのまま記事に書ける形で出す。

    python tools/fetch-indicators.py

## なぜ作ったか

実質金利（TIPS10年）が9本中7本で「未確認」のまま残っていた。VIXも同様。
原因は**探し方**にある。これらは報道記事が「今日の値」として書かない指標なので、
ニュースを検索しても出てこない。FRED には毎営業日の確定値があり、鍵も要らない。

## 系列ごとに反映の遅れが違う

ここが要点で、遅れを知らずに使うと「値が無い」と誤認する。

    VIXCLS   前営業日まで入る    → その日のレポートに使える
    SP500    前営業日まで入る    → 使える
    DFII10   2営業日前まで       → **日付を明記して載せる**
    DGS10    2営業日前まで       → 当日値は報道から。FREDは裏取り用

「9/28時点」と添えて載せるほうが、未確認で空けるより読者の役に立つ。
翌号で確定値に差し替えればよい。

原油（DCOILWTICO）は約1週間遅れるため日次には使えない。DXYはFREDに無い
（ICEの指数のため）。この2つは docs/SOURCES.md に別の取得元を書いてある。
"""

import csv
import io
import sys
import urllib.request
from datetime import date, datetime, timedelta

sys.stdout.reconfigure(encoding="utf-8")

# (FREDの系列ID, 記事での呼び名, 単位, 想定する遅れ<営業日>)
SERIES = [
    ("DFII10", "実質金利（TIPS10年）", "%", 2),
    ("VIXCLS", "VIX", "", 1),
    ("DGS10", "米10年債利回り", "%", 2),
    ("DGS30", "米30年債利回り", "%", 2),
    ("DGS2", "米2年債利回り", "%", 2),
    ("SP500", "S&P 500", "", 1),
    ("T10YIE", "期待インフレ率（10年BEI）", "%", 2),
]

URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={}"


def latest(series_id: str):
    """(日付, 値) の最新。値が '.'（休場）の行は飛ばす

    このCSVはキャッシュされる。素で叩くと最新1日分が落ちた結果が返ることがあり、
    「まだ出ていない」と誤認する。実際にVIXで1日ずれた。毎回違うクエリを付ける。
    """
    url = URL.format(series_id) + f"&_={int(datetime.now().timestamp())}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "teiten-indicators/1.0",
        "Cache-Control": "no-cache",
    })
    with urllib.request.urlopen(req, timeout=25) as r:
        rows = list(csv.reader(io.StringIO(r.read().decode("utf-8"))))
    for row in reversed(rows[1:]):
        if len(row) >= 2 and row[1] not in (".", ""):
            return datetime.strptime(row[0], "%Y-%m-%d").date(), row[1]
    return None, None


def business_days_between(a: date, b: date) -> int:
    n, c = 0, a
    while c < b:
        c += timedelta(days=1)
        if c.weekday() < 5:
            n += 1
    return n


def main() -> int:
    today = date.today()
    print(f"取得日 {today:%Y-%m-%d}（FRED。祝日で遅れることがある）\n")

    stale = []
    for sid, name, unit, expect in SERIES:
        try:
            d, v = latest(sid)
        except Exception as e:
            print(f"NG  {name}（{sid}）取得できません: {e}")
            stale.append(name)
            continue
        if d is None:
            print(f"NG  {name}（{sid}）値がありません")
            stale.append(name)
            continue

        lag = business_days_between(d, today)
        mark = "  " if lag <= expect else "△ "
        # %-m は Windows で使えないので手で組む
        print(f"{mark}{name}：{v}{unit}（{d.month}/{d.day}時点、FRED {sid}）")
        if lag > expect:
            stale.append(f"{name}（想定{expect}営業日に対し{lag}営業日遅れ）")

    print("\n本文にはこの形式で、必ず「◯/◯時点」を添えて書く。")
    print("日付を落とすと、いつの値か分からない数字になる。")

    if stale:
        print("\n遅れが想定より大きい系列：")
        for s in stale:
            print(f"  - {s}")
        print("休場明けなら正常。続くようなら docs/SOURCES.md の取得元を見直す。")

    print("\n原油・DXY・金・日経・BTC はFREDでは間に合わない。")
    print("取得元は docs/SOURCES.md を参照。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
