# -*- coding: utf-8 -*-
"""
レポートの公開状態を管理する画面。

    python tools/admin.py
    → http://127.0.0.1:4399

クラウドの定期実行が `draft: true` で push してくるので、内容を確認して
この画面から公開する。Markdown を直接編集しなくてよい。

- 127.0.0.1 にのみバインドする。外部には公開されない
- 依存は標準ライブラリのみ
- **検査（check-report.py）が通らない記事は公開できない**
"""
import sys
import re
import json
import subprocess
import webbrowser
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "src/content/reports"
WEEKLY = ROOT / "src/content/weekly"
SITE = "https://teiten.trade"
PORT = 4399


# ── データ ─────────────────────────────────────────────
def field(fm, key):
    m = re.search(rf'^{key}:\s*(.*)$', fm, re.M)
    return m.group(1).strip().strip('"') if m else ""


def collect():
    """日次・週次をまとめて新しい順に返す"""
    out = []
    for kind, base, url in (("daily", REPORTS, "reports"), ("weekly", WEEKLY, "weekly")):
        if not base.is_dir():
            continue
        for p in base.glob("*.md"):
            if p.name.startswith("_"):
                continue
            fm = p.read_text(encoding="utf-8").split("---")[1]
            out.append({
                "kind": kind,
                "slug": p.stem,
                "path": str(p.relative_to(ROOT)).replace("\\", "/"),
                "no": field(fm, "no") or f"W{field(fm, 'week')}",
                "date": field(fm, "date") or field(fm, "end"),
                "title": field(fm, "title"),
                "draft": field(fm, "draft") == "true",
                "url": f"{SITE}/{url}/{p.stem}/",
                "local": f"http://localhost:4322/{url}/{p.stem}/",
            })
    return sorted(out, key=lambda x: (x["date"], x["slug"]), reverse=True)


def check(slug):
    """check-report.py を回して (ok, 出力) を返す"""
    r = subprocess.run(
        [sys.executable, "tools/check-report.py", slug],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return r.returncode == 0, (r.stdout or "") + (r.stderr or "")


def set_draft(path, value):
    p = ROOT / path
    s = p.read_text(encoding="utf-8")
    new = re.sub(r'^draft:\s*\w+.*$', f'draft: {"true" if value else "false"}',
                 s, count=1, flags=re.M)
    p.write_text(new, encoding="utf-8", newline="\n")


def git(*args):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    return r.returncode == 0, (r.stdout or "") + (r.stderr or "")


# ── 画面 ───────────────────────────────────────────────
CSS = """
:root{--bg:#f7f5f0;--surface:#fdfcf9;--surface-2:#f1eee6;--ink:#1c1b18;
--line:#e3dfd5;--line-2:#cfcabd;--accent:#2b4c8c;--up:#12734f;--down:#b23a30}
*{box-sizing:border-box;margin:0;padding:0;min-width:0}
body{background:var(--bg);color:var(--ink);line-height:1.8;padding:32px 24px 80px;
font-family:'Inter','Hiragino Kaku Gothic ProN','Yu Gothic UI',Meiryo,sans-serif}
.wrap{max-width:1020px;margin:0 auto}
h1{font-size:22px;font-weight:700;letter-spacing:.04em}
.sub{font-size:13px;color:var(--ink);margin-top:6px}
.bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:22px 0 18px}
.pill{background:var(--surface-2);border:1px solid var(--line-2);border-radius:999px;
padding:5px 13px;font-size:12.5px}
.pill.warn{border-color:var(--accent);color:var(--accent);font-weight:700}
table{width:100%;border-collapse:collapse;background:var(--surface);
border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{text-align:left;padding:13px 14px;border-bottom:1px solid var(--line);font-size:14px;
vertical-align:top}
th{background:var(--surface-2);font-size:11.5px;letter-spacing:.1em;font-weight:500}
tr:last-child td{border-bottom:0}
.no{font-variant-numeric:tabular-nums;white-space:nowrap;font-size:12.5px}
.ttl{font-weight:500;line-height:1.6}
.st{white-space:nowrap;font-size:12px;font-weight:700}
.st.d{color:var(--down)}.st.p{color:var(--up)}
.ck{font-size:12px;white-space:nowrap}
.ck.ng{color:var(--down);font-weight:700}
.acts{display:flex;gap:7px;flex-wrap:wrap}
button,a.btn{font:inherit;font-size:12.5px;padding:6px 13px;border-radius:999px;
border:1px solid var(--line-2);background:var(--bg);color:var(--ink);cursor:pointer;
text-decoration:none;display:inline-block}
button.go{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700}
button:disabled{opacity:.45;cursor:not-allowed}
pre{background:var(--surface-2);border-radius:8px;padding:12px 14px;font-size:12px;
white-space:pre-wrap;margin-top:8px;line-height:1.7}
.note{font-size:12.5px;margin-top:26px;background:var(--surface-2);
border-radius:10px;padding:16px 18px}
"""

JS = """
async function act(kind, path, slug){
  const r = await fetch('/api/'+kind, {method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({path, slug})});
  const d = await r.json();
  if(!d.ok){ alert(d.message); }
  location.reload();
}
"""


def page():
    items = collect()
    drafts = [x for x in items if x["draft"]]
    rows = []
    for x in items:
        ok, out = check(x["slug"])
        st = '<span class="st d">下書き</span>' if x["draft"] else '<span class="st p">公開中</span>'
        ck = ('<span class="ck">OK</span>' if ok
              else '<span class="ck ng">エラー</span>')
        detail = "" if ok else f"<pre>{escape(out.strip()[:900])}</pre>"
        if x["draft"]:
            btn = (f'<button class="go" onclick="act(\'publish\',\'{x["path"]}\',\'{x["slug"]}\')"'
                   f'{" disabled" if not ok else ""}>公開する</button>')
        else:
            btn = (f'<button onclick="act(\'unpublish\',\'{x["path"]}\',\'{x["slug"]}\')">'
                   f'下書きに戻す</button>')
        link = x["local"] if x["draft"] else x["url"]
        label = "ローカルで見る" if x["draft"] else "本番を見る"
        rows.append(f"""<tr>
<td class="no">{escape(str(x['no']))}<br>{escape(x['date'])}</td>
<td class="ttl">{escape(x['title'])}{detail}</td>
<td>{st}</td><td>{ck}</td>
<td><div class="acts">{btn}
<a class="btn" href="{link}" target="_blank" rel="noopener">{label}</a></div></td>
</tr>""")

    warn = (f'<span class="pill warn">未公開 {len(drafts)}件</span>'
            if drafts else '<span class="pill">未公開なし</span>')
    return f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>TEITEN 管理</title><style>{CSS}</style></head><body><div class="wrap">
<h1>TEITEN 公開管理</h1>
<p class="sub">クラウドの定期実行が下書きで push します。内容を確認してここから公開してください。</p>
<div class="bar">{warn}
<span class="pill">全{len(items)}件</span>
<a class="btn" href="http://localhost:4322/" target="_blank" rel="noopener">ローカルプレビュー</a>
<a class="btn" href="{SITE}/reports/" target="_blank" rel="noopener">本番サイト</a></div>
<table><tr><th>号数 / 日付</th><th>タイトル</th><th>状態</th><th>検査</th><th></th></tr>
{''.join(rows)}</table>
<div class="note">
<strong>公開の流れ</strong>：「公開する」を押すと <code>draft: false</code> にして検査を回し、
通れば commit と push まで行います。Cloudflare が自動でデプロイするので、
数分後に本番へ反映されます。<br>
<strong>検査がエラーの記事は公開できません。</strong>内容を直してから再読み込みしてください。<br>
ローカルプレビューを見るには、別途 <code>npm run dev -- --port 4322</code> を起動しておいてください。
</div></div><script>{JS}</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="text/html; charset=utf-8"):
        b = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if urlparse(self.path).path != "/":
            return self._send(404, "not found", "text/plain; charset=utf-8")
        self._send(200, page())

    def do_POST(self):
        path = urlparse(self.path).path
        n = int(self.headers.get("Content-Length") or 0)
        req = json.loads(self.rfile.read(n) or b"{}")
        target, slug = req.get("path", ""), req.get("slug", "")

        # パスはリポジトリ内のコンテンツに限定する
        if not (target.startswith("src/content/") and target.endswith(".md")):
            return self._send(400, json.dumps({"ok": False, "message": "不正なパスです"}),
                              "application/json; charset=utf-8")

        if path == "/api/publish":
            set_draft(target, False)
            ok, out = check(slug)
            if not ok:
                set_draft(target, True)   # 通らなければ戻す
                return self._send(200, json.dumps(
                    {"ok": False, "message": "検査に通らないため公開しませんでした。\n\n" + out}),
                    "application/json; charset=utf-8")
            msg = f"{slug} を公開"
        elif path == "/api/unpublish":
            set_draft(target, True)
            msg = f"{slug} を下書きに戻す"
        else:
            return self._send(404, json.dumps({"ok": False, "message": "不明な操作"}),
                              "application/json; charset=utf-8")

        ok, out = git("add", target)
        if ok:
            ok, out = git("commit", "-m", msg)
        if ok:
            ok, out = git("push", "origin", "main")
        return self._send(200, json.dumps(
            {"ok": ok, "message": out if not ok else ""}),
            "application/json; charset=utf-8")


def main():
    if not REPORTS.is_dir():
        sys.exit("src/content/reports が見つかりません。")
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}"
    print(f"公開管理: {url}")
    print("終了は Ctrl+C")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n終了しました。")


if __name__ == "__main__":
    main()
