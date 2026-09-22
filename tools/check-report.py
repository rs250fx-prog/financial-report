# -*- coding: utf-8 -*-
"""
レポートを公開前に検査する。

    python tools/check-report.py                    # 全件
    python tools/check-report.py 2026-09-24         # 1件

このセッションで実際にやらかした失敗を機械で潰すためのもの。
号数の重複、日付とファイル名の不一致、description の不足、
出典の書式崩れ、埋め忘れなど。

終了コード 1 でエラーあり。警告のみなら 0。
"""
import sys
import re
import datetime
from pathlib import Path

# Windows の既定コンソールは cp932 で、一部の記号を出力できず落ちる。
# スクリプトの出力は UTF-8 に固定しておく。
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

REPORTS = Path("src/content/reports")
WD = "月火水木金土日"

errors = []
warns = []


def err(p, m):
    errors.append(f"{p.name}: {m}")


def warn(p, m):
    warns.append(f"{p.name}: {m}")


def frontmatter(text):
    parts = text.split("---")
    return parts[1] if len(parts) > 2 else ""


def check(p, seen_no):
    text = p.read_text(encoding="utf-8")
    fm = frontmatter(text)
    body = "---".join(text.split("---")[2:])

    def get(key):
        m = re.search(rf'^{key}:\s*(.*)$', fm, re.M)
        return m.group(1).strip() if m else None

    draft = get("draft") == "true"

    # ── 日付 ──────────────────────────────
    date = (get("date") or "").strip('"')
    if not date:
        err(p, "date がありません")
    elif date != p.stem:
        err(p, f"date（{date}）とファイル名（{p.stem}）が一致しません")
    else:
        d = datetime.date.fromisoformat(date)
        if d.weekday() >= 5:
            warn(p, f"{date} は{WD[d.weekday()]}曜日です。平日更新の媒体として妥当か確認を")

    # ── 号数 ──────────────────────────────
    no = get("no")
    if not no or not no.isdigit():
        err(p, "no が数値ではありません")
    else:
        n = int(no)
        if n in seen_no:
            err(p, f"号数 No.{n} が {seen_no[n]} と重複しています")
        seen_no[n] = p.name

    # ── 必須テキスト ────────────────────────
    for key, minlen in (("title", 10), ("deck", 40)):
        v = (get(key) or "").strip('"')
        if not v:
            err(p, f"{key} が空です")
        elif len(v) < minlen:
            warn(p, f"{key} が{len(v)}字と短すぎます（目安{minlen}字以上）")

    desc = (get("description") or "").strip('"')
    if not desc:
        err(p, "description が空です（未記入だと deck が流用され、一覧で重複します）")
    elif len(desc) < 80:
        warn(p, f"description が{len(desc)}字です。80〜100字を目安に")

    # ── 要点・スナップショット ──────────────────
    points = re.findall(r'^\s*-\s*"(.*)"\s*$', fm[fm.find("points:"):fm.find("snapshot:")], re.M) if "points:" in fm and "snapshot:" in fm else []
    if len(points) < 3:
        err(p, f"points が{len(points)}件です。3〜5件にしてください")
    if any(not x.strip() for x in points):
        err(p, "points に空の項目があります")

    snaps = re.findall(r'\{\s*label:\s*"([^"]*)",\s*value:\s*"([^"]*)",\s*change:\s*"([^"]*)",\s*dir:\s*(\w+)', fm)
    if len(snaps) < 4:
        err(p, f"snapshot が{len(snaps)}件です。6件を目安に")
    for label, value, change, dirv in snaps:
        if not value or not change:
            err(p, f"snapshot「{label}」の value/change が空です")
        if dirv not in ("up", "down", "flat"):
            err(p, f"snapshot「{label}」の dir が不正です: {dirv}")

    hl = re.search(r'headline:\s*\{\s*value:\s*"([^"]*)",\s*dir:\s*(\w+)', fm)
    if not hl:
        warn(p, "headline がありません。一覧の右端が空になります")
    elif not hl.group(1):
        err(p, "headline の value が空です")

    tags = get("tags")
    if tags in (None, "[]"):
        warn(p, "tags が空です。トピック索引に載りません")

    # ── 本文 ──────────────────────────────
    if "## Macro Theme" not in body:
        warn(p, "Macro Theme の節がありません")

    # 出典は「素のURL列挙」ではなくリンク付きリストにする。
    # 素のまま書くと1段落に潰れて読めなくなる（実際に起きた）
    bare = re.findall(r'^\s*https?://\S+\s*$', body, re.M)
    if bare:
        err(p, f"素のURLが{len(bare)}件あります。[媒体名（内容・日付）](URL) の形式にしてください")

    if "情報元" in body and not re.search(r'-\s*\[[^\]]+\]\(https?://', body):
        err(p, "情報元にリンク付きリストがありません")

    # 埋め忘れの検出
    if re.search(r'^\s*###\s*[①②③]\s*$', body, re.M):
        err(p, "Market Drivers の見出しが未記入です")
    if re.search(r'^資金\s+→\s*$', body, re.M) or "資金　 → " in body:
        err(p, "資金フローの行が未記入です")
    if "- []()" in body:
        err(p, "情報元のリンクが未記入です")

    # 実在しない配信頻度の主張
    for claim in ("週5回", "平日朝7時30分"):
        if claim in body or claim in fm:
            warn(p, f"「{claim}」という記述があります。実態と合っているか確認を")

    if draft:
        warn(p, "draft: true です。公開されません")


def main():
    if not REPORTS.is_dir():
        sys.exit("src/content/reports が見つかりません。リポジトリ直下で実行してください。")

    targets = []
    if len(sys.argv) > 1:
        p = REPORTS / f"{sys.argv[1]}.md"
        if not p.exists():
            sys.exit(f"{p} がありません")
        targets = [p]
    else:
        targets = [p for p in sorted(REPORTS.glob("*.md")) if not p.name.startswith("_")]

    seen_no = {}
    for p in targets:
        check(p, seen_no)

    for w in warns:
        print(f"  警告  {w}")
    for e in errors:
        print(f"  エラー {e}")

    print(f"\n{len(targets)}件を検査：エラー {len(errors)} / 警告 {len(warns)}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
