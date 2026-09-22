# -*- coding: utf-8 -*-
"""
デイリーレポートの雛形を作る。

    python tools/new-report.py            # 本日（JST）の分
    python tools/new-report.py 2026-09-24 # 日付を指定

号数は既存ファイルの最大値 +1 を自動で振る。手で付けると
番号の重複や付け間違いが起きるため（実際に一度起きた）。

既存ファイルがある場合は上書きせずに終了する。
"""
import sys
import re
import datetime
import zoneinfo
from pathlib import Path

# Windows の既定コンソールは cp932 で、一部の記号を出力できず落ちる。
# スクリプトの出力は UTF-8 に固定しておく。
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

REPORTS = Path("src/content/reports")
JST = zoneinfo.ZoneInfo("Asia/Tokyo")
WD = "月火水木金土日"


def existing():
    """(no, date, path) の一覧。_ 始まりは雛形なので除く"""
    out = []
    for p in sorted(REPORTS.glob("*.md")):
        if p.name.startswith("_"):
            continue
        fm = p.read_text(encoding="utf-8").split("---")[1]
        no = re.search(r"^no:\s*(\d+)", fm, re.M)
        date = re.search(r'^date:\s*"([\d-]+)"', fm, re.M)
        out.append((int(no.group(1)) if no else 0,
                    date.group(1) if date else "", p))
    return out


TEMPLATE = '''---
no: {no}
title: "{datedisp}｜"
deck: ""
date: "{date}"
updated: "{updated}"

# 本日の要点。3〜5件。1件60字程度
points:
  - ""
  - ""
  - ""
  - ""

# 8件を目安に。ティッカーにも同じ値が流れる。dir は up / down / flat
snapshot:
  - {{ label: "XAU / USD",     value: "", change: "", dir: flat }}
  - {{ label: "ドル指数 DXY",  value: "", change: "", dir: flat }}
  - {{ label: "米10年金利",    value: "", change: "", dir: flat }}
  - {{ label: "実質金利 10Y",  value: "", change: "", dir: flat }}
  - {{ label: "WTI原油",       value: "", change: "", dir: flat }}
  - {{ label: "S&P 500",       value: "", change: "", dir: flat }}
  - {{ label: "日経225",       value: "", change: "", dir: flat }}
  - {{ label: "BTC / USD",     value: "", change: "", dir: flat }}

# 一覧の右端に出す代表値。通常は XAU/USD の変化率
headline: {{ value: "", dir: flat }}

# テクニカル・レベル。上から下へ価格順に並べる。
# kind は resistance / current / support
levels:
  - {{ kind: resistance, value: "", note: "" }}
  - {{ kind: resistance, value: "", note: "" }}
  - {{ kind: current,    value: "", note: "" }}
  - {{ kind: support,    value: "", note: "" }}
  - {{ kind: support,    value: "", note: "" }}

tags: []
# 80〜100字。未記入だと deck が使われるが、必ず書くこと
description: ""
draft: true
---

{stamp}

---

## Macro Theme

資金　 →

---

## Market Drivers

### ①

→

### ②

→

### ③

→

---

## 金利（起点）

米10年債利回り：

米2年債利回り：

日本10年債利回り：

実質金利（TIPS10年）：

→

資金　 →

情報元：

- []()

---

## ドル

DXY：

USD/JPY：

→

資金　 →

情報元：

- []()

---

## 商品

WTI：

Brent：

金：

### Macro Drivers（三軸）

**実質金利**：

**ドル**：

**地政学**：

### 資金フロー結論

資金　 →

情報元：

- []()

---

## 株

S&P 500：

Nasdaq総合：

ダウ：

**日経225：**

→

資金　 →

情報元：

- []()

---

## Crypto

BTC：

→ 実質金利・Nasdaqとの連動に触れる

資金　 →

---

## Volatility

VIX：

日経VI：

→

---

## 今日の資金フロー

**  →   →  **

→ 総括：

---

## マーケットポジション（中期の歪み）

---

## Next Flow（短期）

### シナリオA：

→

### シナリオB：

→

### シナリオC：

→

---

## Market Bias（短期）

**中立 / ややリスクオン / リスクオフ のいずれかと、その理由を1行**

最優先の監視項目は3つ。

-
-
-

---

{stamp} 時点。主要トリガーは。
'''


def main():
    if not REPORTS.is_dir():
        sys.exit("src/content/reports が見つかりません。リポジトリ直下で実行してください。")

    now = datetime.datetime.now(JST)
    if len(sys.argv) > 1:
        try:
            d = datetime.date.fromisoformat(sys.argv[1])
        except ValueError:
            sys.exit("日付は YYYY-MM-DD で指定してください。")
    else:
        d = now.date()

    date = d.isoformat()
    path = REPORTS / f"{date}.md"
    if path.exists():
        sys.exit(f"{path} はすでにあります。上書きしません。")

    items = existing()
    no = max((n for n, _, _ in items), default=0) + 1

    # 発行時刻。当日ならいまの時刻、過去日なら遡及作成として日時を明示する
    if d == now.date():
        updated = now.strftime("%H:%M JST")
        stamp = now.strftime(f"%Y/%m/%d %H:%M JST")
        note = ""
    else:
        updated = now.strftime("%Y-%m-%d %H:%M JST（遡及作成）")
        stamp = f"{d.strftime('%Y/%m/%d')} 発行分"
        # %-m（ゼロ埋めなし）は Windows で使えないため手で組み立てる
        stamp_now = f"{now.month}月{now.day}日 {now:%H:%M} JST"
        note = (
            f"\n> 本稿は{stamp_now}に、上記日付時点で入手可能だった情報にもとづいて"
            "遡って作成したものです。当日朝に配信したものではありません。\n"
        )

    datedisp = f"{d.year}/{d.month:02d}/{d.day:02d}（{WD[d.weekday()]}）"
    body = TEMPLATE.format(
        no=no, date=date, updated=updated, stamp=stamp, datedisp=datedisp
    )
    if note:
        body = body.replace(f"{stamp}\n\n---", f"{stamp}\n{note}\n---", 1)

    path.write_text(body, encoding="utf-8", newline="\n")

    wd = WD[d.weekday()]
    print(f"作成: {path}")
    print(f"  号数: No.{no}")
    print(f"  日付: {date}（{wd}）")
    if d.weekday() >= 5:
        print("  注意: 土日です。平日更新の媒体なので日付を確認してください。")
    if items:
        last_no, last_date, _ = max(items)
        print(f"  前号: No.{last_no} / {last_date}")
    print("\n書き上げたら draft: false にして、以下で検査してください。")
    print("  python tools/check-report.py")


if __name__ == "__main__":
    main()
