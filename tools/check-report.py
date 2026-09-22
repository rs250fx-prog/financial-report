# -*- coding: utf-8 -*-
"""
レポートを公開前に検査する。日次と週次の両方を見る。

    python tools/check-report.py                    # 全件
    python tools/check-report.py 2026-09-24         # 日次を1件
    python tools/check-report.py 2026-w38           # 週次を1件

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
WEEKLY = Path("src/content/weekly")
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


def check_weekly(p, seen_week):
    """週次まとめの検査。日次とは必須項目が違う"""
    text = p.read_text(encoding="utf-8")
    fm = frontmatter(text)
    body = "---".join(text.split("---")[2:])

    def get(key):
        m = re.search(rf'^{key}:\s*(.*)$', fm, re.M)
        return m.group(1).strip() if m else None

    # ── 週番号と期間 ──────────────────────
    year, week = get("year"), get("week")
    if not (year and year.isdigit() and week and week.isdigit()):
        err(p, "year / week が数値ではありません")
    else:
        expect = f"{int(year)}-w{int(week):02d}"
        if p.stem != expect:
            err(p, f"ファイル名は {expect}.md であるべきです（現在 {p.stem}.md）")
        k = (int(year), int(week))
        if k in seen_week:
            err(p, f"{year}年第{week}週が {seen_week[k]} と重複しています")
        seen_week[k] = p.name

    start = (get("start") or "").strip('"')
    end = (get("end") or "").strip('"')
    if not start or not end:
        err(p, "start / end がありません")
    else:
        try:
            sd = datetime.date.fromisoformat(start)
            ed = datetime.date.fromisoformat(end)
        except ValueError:
            err(p, "start / end の日付形式が不正です")
        else:
            if ed < sd:
                err(p, f"end（{end}）が start（{start}）より前です")
            if sd.weekday() != 0:
                warn(p, f"start（{start}）が{WD[sd.weekday()]}曜日です。月曜が通例")
            if ed.weekday() != 4:
                warn(p, f"end（{end}）が{WD[ed.weekday()]}曜日です。金曜が通例")
            if year and year.isdigit() and week and week.isdigit():
                y2, w2, _ = sd.isocalendar()
                if (y2, w2) != (int(year), int(week)):
                    err(p, f"start の週（{y2}年第{w2}週）が year/week と一致しません")

    # ── 必須テキスト ────────────────────────
    for k2, minlen in (("title", 10), ("deck", 40)):
        v = (get(k2) or "").strip('"')
        if not v:
            err(p, f"{k2} が空です")
        elif len(v) < minlen:
            warn(p, f"{k2} が{len(v)}字と短すぎます（目安{minlen}字以上）")

    desc = (get("description") or "").strip('"')
    if not desc:
        err(p, "description が空です（未記入だと deck が流用され、一覧で重複します）")
    elif len(desc) < 80:
        warn(p, f"description が{len(desc)}字です。80〜100字を目安に")

    # ── 週次固有 ───────────────────────────
    perf = re.findall(
        r'\{\s*label:\s*"([^"]*)",\s*value:\s*"([^"]*)",\s*change:\s*"([^"]*)",'
        r'\s*dir:\s*(\w+),\s*note:\s*"([^"]*)"',
        fm,
    )
    if len(perf) < 5:
        err(p, f"performance が{len(perf)}件です。主要資産をひととおり（8件前後）")
    for label, value, _c, dirv, _n in perf:
        if not value:
            err(p, f"performance「{label}」の value が空です")
        if dirv not in ("up", "down", "flat"):
            err(p, f"performance「{label}」の dir が不正です: {dirv}")

    sched_dates = re.findall(r'^\s*-\s*date:\s*"([\d-]+)"', fm, re.M)
    if not sched_dates:
        warn(p, "schedule が空です。週次の実用価値の中心なので埋めることを推奨")
    elif end:
        try:
            ed2 = datetime.date.fromisoformat(end)
            for sdate in sched_dates:
                if datetime.date.fromisoformat(sdate) <= ed2:
                    err(p, f"schedule の {sdate} が対象期間内です。来週の予定を入れてください")
                    break
        except ValueError:
            pass
    if re.search(r'label:\s*""', fm):
        err(p, "schedule に label が空の項目があります")

    if not (get("bias") or "").strip('"'):
        err(p, "bias（来週のスタンス）が空です")

    if "points:" in fm and "performance:" in fm:
        pts = re.findall(
            r'^\s*-\s*"(.*)"\s*$',
            fm[fm.find("points:"):fm.find("performance:")],
            re.M,
        )
        if any(not x.strip() for x in pts):
            err(p, "points に空の項目があります")

    if (get("tags") or "[]") == "[]":
        warn(p, "tags が空です。トピック索引に載りません")

    # ── 本文 ──────────────────────────────
    for sec in ("## 週の核心テーマ", "## 今週の資金フロー構造", "## 来週の備え"):
        if sec not in body:
            warn(p, f"「{sec.strip('# ')}」の節がありません")

    bare = re.findall(r'^\s*https?://\S+\s*$', body, re.M)
    if bare:
        err(p, f"素のURLが{len(bare)}件あります。[媒体名（内容・日付）](URL) の形式にしてください")
    if "- []()" in body:
        err(p, "情報元のリンクが未記入です")
    if re.search(r'^\s*###\s*[①②③]\s*$', body, re.M):
        err(p, "主要イベントの見出しが未記入です")

    if get("draft") == "true":
        warn(p, "draft: true です。公開されません")


def main():
    if not REPORTS.is_dir():
        sys.exit("src/content/reports が見つかりません。リポジトリ直下で実行してください。")

    daily, weekly = [], []
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        dp, wp = REPORTS / f"{arg}.md", WEEKLY / f"{arg}.md"
        if dp.exists():
            daily = [dp]
        elif wp.exists():
            weekly = [wp]
        else:
            sys.exit(f"{arg} は日次にも週次にも見つかりません")
    else:
        daily = [p for p in sorted(REPORTS.glob("*.md")) if not p.name.startswith("_")]
        if WEEKLY.is_dir():
            weekly = [p for p in sorted(WEEKLY.glob("*.md")) if not p.name.startswith("_")]

    seen_no, seen_week = {}, {}
    for p in daily:
        check(p, seen_no)
    for p in weekly:
        check_weekly(p, seen_week)

    for w in warns:
        print(f"  警告  {w}")
    for e in errors:
        print(f"  エラー {e}")

    print(f"\n日次{len(daily)}件・週次{len(weekly)}件を検査："
          f"エラー {len(errors)} / 警告 {len(warns)}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
