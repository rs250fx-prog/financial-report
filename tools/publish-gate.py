# -*- coding: utf-8 -*-
"""日次レポートを、人の確認を待たずに公開してよいかを判定する。

    python tools/publish-gate.py 2026-10-05            判定だけ
    python tools/publish-gate.py 2026-10-05 --apply    公開可なら draft: false にする
    python tools/publish-gate.py 2026-10-05 --hold     draft: true に戻す

## なぜ作ったか

定期実行は当初、必ず下書き（draft: true）で push し、人が管理画面から公開していた。
2026-10-05 から、朝の定時に公開状態で出し、問題があれば人があとから非公開に戻す
運用に変えた。**「大きな問題がありそうな号」だけは従来どおり下書きで止める。**

その線引きをプロンプトの文章に置くと、実行のたびに解釈が揺れる。機械で決められる
条件はここに集める（数値が正しいかどうかは機械では分からない。それは書き手の
判断としてプロンプト側に残してある）。

## 保留にする条件

- 検査（check-report.py）にエラーがある
- 発行日が今日（JST）ではない
- snapshot が8件に満たない
- 主要5指標（金・ドル指数・米10年・WTI・S&P 500）のどれかが未確認、または数字を含まない
- snapshot の未確認が3件以上
- 前号の答え合わせ（review）が無い

終了コードは、公開可が 0、保留が 1。
"""
import datetime
import re
import subprocess
import sys
import zoneinfo
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

REPORTS = Path("src/content/reports")
JST = zoneinfo.ZoneInfo("Asia/Tokyo")

# snapshot の label に当てる式。ここが取れていない号は、記事の土台が欠けている
CORE = {
    "金（XAU / USD）": r"XAU",
    "ドル指数": r"DXY",
    "米10年金利": r"米10年",
    "WTI原油": r"WTI",
    "S&P 500": r"S&P",
}
MAX_UNCONFIRMED = 2


def frontmatter(text):
    parts = text.split("---")
    return parts[1] if len(parts) > 2 else ""


def snapshot_rows(fm):
    """snapshot: の下に並ぶ { label, value, ... } の行を取り出す"""
    m = re.search(r'^snapshot:\s*\n((?:[ \t]+-.*\n?)+)', fm, re.M)
    if not m:
        return []
    rows = []
    for line in m.group(1).splitlines():
        label = re.search(r'label:\s*"([^"]*)"', line)
        value = re.search(r'value:\s*"([^"]*)"', line)
        if label and value:
            rows.append((label.group(1), value.group(1)))
    return rows


def judge(p):
    reasons = []
    fm = frontmatter(p.read_text(encoding="utf-8"))

    r = subprocess.run(
        [sys.executable, "tools/check-report.py", p.stem],
        capture_output=True, text=True, encoding="utf-8",
    )
    if r.returncode != 0:
        errs = [l.strip() for l in r.stdout.splitlines() if "エラー" in l and p.name in l]
        reasons.append("検査にエラーがあります" + ("：" + " / ".join(errs) if errs else ""))

    today = datetime.datetime.now(JST).date().isoformat()
    if p.stem != today:
        reasons.append(f"発行日（{p.stem}）が今日（{today}、JST）ではありません")

    rows = snapshot_rows(fm)
    if len(rows) < 8:
        reasons.append(f"snapshot が{len(rows)}件です（8件必要）")

    for name, pat in CORE.items():
        hit = next((v for l, v in rows if re.search(pat, l)), None)
        if hit is None:
            reasons.append(f"snapshot に {name} がありません")
        elif "未確認" in hit or not re.search(r"\d", hit):
            reasons.append(f"{name} の値が取れていません（「{hit}」）")

    unconfirmed = [l for l, v in rows if "未確認" in v]
    if len(unconfirmed) > MAX_UNCONFIRMED:
        reasons.append(
            f"snapshot の未確認が{len(unconfirmed)}件あります（{' / '.join(unconfirmed)}）"
        )

    if not re.search(r'^review:\s*$', fm, re.M):
        reasons.append("前号の答え合わせ（review）がありません")

    return reasons


def set_draft(p, value):
    text = p.read_text(encoding="utf-8")
    new, n = re.subn(r'^draft:\s*\w+.*$', f"draft: {value}", text, count=1, flags=re.M)
    if n != 1:
        sys.exit("draft の行が見つかりません")
    p.write_text(new, encoding="utf-8", newline="")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if len(args) != 1 or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args[0]):
        sys.exit("使い方: python tools/publish-gate.py YYYY-MM-DD [--apply | --hold]")
    p = REPORTS / f"{args[0]}.md"
    if not p.exists():
        sys.exit(f"{p} がありません")

    if "--hold" in flags:
        set_draft(p, "true")
        print(f"保留  {p.name} を draft: true に戻しました")
        return

    reasons = judge(p)
    if reasons:
        print(f"保留  {p.name} は下書きのままにします")
        for r in reasons:
            print(f"  - {r}")
        sys.exit(1)

    if "--apply" in flags:
        set_draft(p, "false")
        print(f"公開可  {p.name} を draft: false にしました")
    else:
        print(f"公開可  {p.name}（--apply を付けると draft: false にします）")


if __name__ == "__main__":
    main()
