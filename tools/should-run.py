"""その日にレポートを出すべきかを判定する。

定期実行の冒頭で呼ぶ。休止と出たら、記事を書かずに終了する。

## 判断の根拠

日次は「D日の記事が D-1日の米国セッションを扱う」規約で書いている。
したがって判定すべきは、**扱う対象の米国セッションが存在するか**である。

ここから運用ルールは次のように整理できる。

- 日本だけの祝日 … 米国は動いている。**出す**
- 米国が祝日     … 扱う対象そのものが無い。**出さない**

つまり日本の祝日は判定に影響しない。実装として必要なのは
米国市場（NYSE）の休場日だけで、日本の複雑な祝日表は要らない。

年末年始は市場と無関係に休む。12/29〜1/3 は出さず、1/4 から再開する。

## 使い方

    python tools/should-run.py                  日次（今日）
    python tools/should-run.py --kind weekly    週次
    python tools/should-run.py --date 2026-07-06

終了コード 0 = 実行、10 = 休止。それ以外は判定の失敗。
"""

import argparse
import sys
from datetime import date, timedelta

sys.stdout.reconfigure(encoding="utf-8")

SKIP = 10


def nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """その月の n 番目の weekday（月曜=0）。n が負なら月末から数える"""
    if n > 0:
        d = date(year, month, 1)
        d += timedelta(days=(weekday - d.weekday()) % 7)
        return d + timedelta(weeks=n - 1)
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    d = nxt - timedelta(days=1)
    d -= timedelta(days=(d.weekday() - weekday) % 7)
    return d + timedelta(weeks=n + 1)


def easter(year: int) -> date:
    """グレゴリオ暦の復活祭。Good Friday を出すために必要"""
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f, g = (b + 8) // 25, (b - (b + 8) // 25 + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    lm = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * lm) // 451
    month = (h + lm - 7 * m + 114) // 31
    day = (h + lm - 7 * m + 114) % 31 + 1
    return date(year, month, day)


def observed(d: date) -> date:
    """土曜なら前日の金曜、日曜なら翌日の月曜に振り替える"""
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def nyse_holidays(year: int) -> dict:
    """NYSE の休場日。祝日名を引けるよう辞書で返す"""
    fixed = {
        observed(date(year, 1, 1)): "元日",
        observed(date(year, 6, 19)): "ジューンティーンス",
        observed(date(year, 7, 4)): "独立記念日",
        observed(date(year, 12, 25)): "クリスマス",
    }
    computed = {
        nth_weekday(year, 1, 0, 3): "キング牧師記念日",
        nth_weekday(year, 2, 0, 3): "ワシントン誕生日",
        easter(year) - timedelta(days=2): "グッドフライデー",
        nth_weekday(year, 5, 0, -1): "メモリアルデー",
        nth_weekday(year, 9, 0, 1): "レイバーデー",
        nth_weekday(year, 11, 3, 4): "感謝祭",
    }
    return {**fixed, **computed}


def is_us_holiday(d: date):
    return nyse_holidays(d.year).get(d)


def in_yearend(d: date) -> bool:
    """12/29〜1/3 は市場と無関係に休む"""
    return (d.month == 12 and d.day >= 29) or (d.month == 1 and d.day <= 3)


def prev_weekday(d: date) -> date:
    """d の直前の平日。休場かどうかは見ない"""
    c = d - timedelta(days=1)
    while c.weekday() >= 5:
        c -= timedelta(days=1)
    return c


def prev_us_session(d: date):
    """d の記事が扱う米国セッションの日。休場と週末を遡る。
    10営業日遡っても見つからなければ None（通常ありえない）"""
    c = d - timedelta(days=1)
    for _ in range(10):
        if c.weekday() < 5 and not is_us_holiday(c):
            return c
        c -= timedelta(days=1)
    return None


def decide(d: date, kind: str):
    """(実行するか, 理由) を返す"""
    if in_yearend(d):
        return False, f"年末年始の休止期間（12/29〜1/3）。{d.year if d.month == 1 else d.year + 1}/1/4 から再開"

    if kind == "weekly":
        if d.weekday() != 5:
            return True, f"週次（{d:%Y-%m-%d} は土曜ではないが、指定日のため実行）"
        return True, "週次（土曜）"

    if d.weekday() >= 5:
        return False, f"{'土' if d.weekday() == 5 else '日'}曜のため休止（日次は平日のみ）"

    # 直前の平日が休場なら、扱えるセッションは前号が既に扱っている。
    # 例: 金曜がグッドフライデーなら、その金曜の号が木曜分を扱っており、
    # 月曜に新しく書くことは何も無い
    prev = prev_weekday(d)
    holiday = is_us_holiday(prev)
    if holiday:
        return False, f"直前の平日（{prev:%m/%d}）が米国休場（{holiday}）。扱う新しいセッションが無い"

    target = prev_us_session(d)
    if target is None:
        return False, "扱う米国セッションを特定できない"

    note = f"{target:%m/%d} の米国セッションを扱う"
    if is_us_holiday(d):
        note += f"。本日は米国が{is_us_holiday(d)}で休場だが、前日分は扱える"
    return True, note


def main() -> int:
    p = argparse.ArgumentParser(description="レポートを出す日かどうかを判定する")
    p.add_argument("--kind", choices=["daily", "weekly"], default="daily")
    p.add_argument("--date", help="YYYY-MM-DD。既定は今日")
    a = p.parse_args()

    d = date.fromisoformat(a.date) if a.date else date.today()
    run, why = decide(d, a.kind)

    print(f"{d:%Y-%m-%d}（{'月火水木金土日'[d.weekday()]}） {a.kind}")
    print("実行" if run else "休止")
    print(f"理由: {why}")
    return 0 if run else SKIP


if __name__ == "__main__":
    raise SystemExit(main())
