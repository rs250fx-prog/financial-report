# -*- coding: utf-8 -*-
"""
週次まとめの雛形を作る。

    python tools/new-weekly.py            # 直近に終わった週
    python tools/new-weekly.py 2026-09-14 # その日を含む週

週番号・対象期間（月〜金）・来週のスケジュール枠は日付から自動で出す。
手で書くと週番号と期間がずれる。

既存ファイルがある場合は上書きせずに終了する。
"""
import sys
import datetime
import zoneinfo
from pathlib import Path

WEEKLY = Path("src/content/weekly")
REPORTS = Path("src/content/reports")
JST = zoneinfo.ZoneInfo("Asia/Tokyo")
WD = "月火水木金土日"

# Windows の既定コンソールは cp932 で、一部の記号を出力できず落ちる。
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


TEMPLATE = '''---
year: {year}
week: {week}
title: ""
deck: ""
start: "{start}"
end: "{end}"
date: "{pub}"
updated: "{updated}"

# 今週の要点。3〜5件
points:
  - ""
  - ""
  - ""

# 各資産の週次パフォーマンス。値だけでなく寸評（note）を付ける
# dir は up / down / flat
performance:
  - {{ label: "金（XAU/USD）",  value: "", change: "", dir: flat, note: "" }}
  - {{ label: "WTI原油",        value: "", change: "", dir: flat, note: "" }}
  - {{ label: "S&P 500",        value: "", change: "", dir: flat, note: "" }}
  - {{ label: "Nasdaq総合",     value: "", change: "", dir: flat, note: "" }}
  - {{ label: "日経225",        value: "", change: "", dir: flat, note: "" }}
  - {{ label: "ドル指数 DXY",   value: "", change: "", dir: flat, note: "" }}
  - {{ label: "USD/JPY",        value: "", change: "", dir: flat, note: "" }}
  - {{ label: "米10年債利回り", value: "", change: "", dir: flat, note: "" }}
  - {{ label: "VIX",            value: "", change: "", dir: flat, note: "" }}

# 来週の主要スケジュール。key: true は★付きで強調される
schedule:
{schedule}
# テクニカル・レベル（週末時点）。上から下へ価格順
# kind は resistance / current / support
levels:
  - {{ kind: resistance, value: "", note: "" }}
  - {{ kind: resistance, value: "", note: "" }}
  - {{ kind: current,    value: "", note: "" }}
  - {{ kind: support,    value: "", note: "" }}
  - {{ kind: support,    value: "", note: "" }}

# 来週のシナリオ。発動条件・因果連鎖・価格目処を同じ粒度で書く
scenarios:
  - {{ kind: bull, trigger: "", chain: "", target: "" }}
  - {{ kind: base, trigger: "", chain: "", target: "" }}
  - {{ kind: bear, trigger: "", chain: "", target: "" }}

# 来週のスタンス。記事の結論として独立したブロックに出る
bias: ""

tags: []
# 80〜100字。未記入だと deck が流用され、一覧で重複する
description: ""
draft: true
---

## 週の核心テーマ

---

## 今週の主要イベント振り返り

### ①

### ②

### ③

---

## 今週の資金フロー構造

**  →   →  **

第一の流れは。

第二の流れは。

第三に。

情報元：

- []()

---

## 来週の備え（{nw_start_disp}〜{nw_end_disp}）

### 最重要イベント

### 国内政治・政策の波乱要因

### 地政学シナリオ

### 日経・円の焦点

予想レンジ：上限　　円 〜 下限　　円
'''


def main():
    if not WEEKLY.is_dir():
        sys.exit("src/content/weekly が見つかりません。リポジトリ直下で実行してください。")

    now = datetime.datetime.now(JST)
    if len(sys.argv) > 1:
        try:
            base = datetime.date.fromisoformat(sys.argv[1])
        except ValueError:
            sys.exit("日付は YYYY-MM-DD で指定してください。")
    else:
        # 引数なしなら「直近に終わった週」。土日に書く想定
        base = now.date() - datetime.timedelta(days=(now.date().weekday() + 1) % 7 or 7)

    monday = base - datetime.timedelta(days=base.weekday())
    friday = monday + datetime.timedelta(days=4)
    year, week, _ = monday.isocalendar()

    path = WEEKLY / f"{year}-w{week:02d}.md"
    if path.exists():
        sys.exit(f"{path} はすでにあります。上書きしません。")

    # 来週（月〜金）のスケジュール枠を空で並べておく
    nw_mon = monday + datetime.timedelta(days=7)
    lines = []
    for i in range(5):
        d = nw_mon + datetime.timedelta(days=i)
        lines.append(f'  - date: "{d.isoformat()}"   # {WD[d.weekday()]}')
        lines.append('    items:')
        lines.append('      - { label: "", key: false }')
    schedule = "\n".join(lines) + "\n\n"

    body = TEMPLATE.format(
        year=year,
        week=week,
        start=monday.isoformat(),
        end=friday.isoformat(),
        pub=now.date().isoformat(),
        updated=now.strftime("%Y-%m-%d %H:%M JST"),
        schedule=schedule,
        nw_start_disp=f"{nw_mon.month}/{nw_mon.day}",
        nw_end_disp=f"{(nw_mon + datetime.timedelta(days=4)).month}/"
                    f"{(nw_mon + datetime.timedelta(days=4)).day}",
    )
    path.write_text(body, encoding="utf-8", newline="\n")

    print(f"作成: {path}")
    print(f"  {year}年 第{week}週")
    print(f"  対象期間: {monday}（{WD[monday.weekday()]}）〜 {friday}（{WD[friday.weekday()]}）")
    print(f"  来週の枠: {nw_mon} 〜 {nw_mon + datetime.timedelta(days=4)}")

    # その週の日次レポートが何本あるか。少なければ週次を書く材料が足りない
    if REPORTS.is_dir():
        have = [
            p.stem for p in sorted(REPORTS.glob("*.md"))
            if not p.name.startswith("_")
            and monday.isoformat() <= p.stem <= friday.isoformat()
        ]
        print(f"  この週の日次: {len(have)}本 {have if have else ''}")
        if len(have) < 2:
            print("  注意: 日次が少ないため、週次を書く材料が不足している可能性があります。")

    print("\n書き上げたら draft: false にして、以下で検査してください。")
    print("  python tools/check-report.py")


if __name__ == "__main__":
    main()
