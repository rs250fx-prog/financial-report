/**
 * note 用の図解（縦長インフォグラフィック、幅1080）を書き出す。日次のみ。
 *
 *     node tools/make-infographic.mjs 2026-10-15                 → note/info_20261015.png
 *     node tools/make-infographic.mjs 2026-10-15 --src x.md      原稿の場所を指定
 *     node tools/make-infographic.mjs 2026-10-15 --out /tmp/i.png
 *
 * 入力は日次レポートの frontmatter。数値は snapshot と infographic.quotes から取り、
 * 各ブロックの項目は `ref`（ラベルの部分一致）でそこを引く。**同じ数字を2か所に書かない。**
 * 文章（見出し・リード・ノード名・注目点）だけを infographic に書く。
 *
 * 書き方は .claude/skills/teiten-report/SKILL.md の「8-C」。
 * 公開URLは https://teiten.trade/info/<YYYY-MM-DD>.png（tools/copy-thumbs.mjs が写す）。
 *
 * 文字は make-thumb.mjs と同じく、フォントファイルから輪郭を取り出してパスで描く
 * （クラウドの定期実行には日本語フォントが無い）。背景画像は使わず、全部ここで組む。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create } from 'fontkitten';
import yaml from 'js-yaml';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = join(ROOT, 'tools/thumb/fonts');
const W = 1080;
const M = 36; // 左右の余白
const IN = W - M * 2;

const vf = readFileSync(join(FONTS, 'NotoSansJP-VF.ttf'));
const SANS = Object.fromEntries(
  [400, 500, 700, 900].map((w) => [w, create(vf).getVariation({ wght: w })]),
);

const C = {
  bg: '#eef3f9',
  card: '#ffffff',
  line: '#d5dfeb',
  navy: '#0f2d57',
  ink: '#1b2433',
  sub: '#5b6779',
  up: '#16a34a',
  down: '#e0322f',
  flat: '#d98a0b',
  blue: '#2f6fd6',
  gold: '#c98f12',
  tint: { up: '#e7f6ec', down: '#fdecec', flat: '#fdf3e1', blue: '#e8f0fc', gold: '#fdf4dc', navy: '#e6ecf5' },
};
const dirColor = (d) => C[d] ?? C.flat;

const problems = [];
const notices = [];

// ── 文字 ─────────────────────────────────────────────
const adv = (ch, size, w) => {
  const g = SANS[w].glyphForCodePoint(ch.codePointAt(0));
  return (g.advanceWidth / SANS[w].unitsPerEm) * size;
};
const measure = (s, size, w) => [...String(s ?? '')].reduce((a, ch) => a + adv(ch, size, w), 0);

/**
 * 1行を描く。maxWidth を超えたら全体を縮め、minScale を下回るならエラーとして報告する。
 * anchor: start | middle | end
 */
function text(s, { x, y, size, w = 700, fill = C.ink, anchor = 'start', maxWidth, minScale = 0.6, name }) {
  s = String(s ?? '');
  if (!s) return '';
  const natural = measure(s, size, w);
  let k = 1;
  if (maxWidth && natural > maxWidth) {
    k = maxWidth / natural;
    if (k < minScale) {
      problems.push(`${name ?? s}：長すぎて収まりません「${s}」`);
      k = minScale;
    } else if (k < 0.95 && name) {
      notices.push(`${name}：幅に収めるため ${Math.round(k * 100)}% に縮小しました「${s}」`);
    }
  }
  const width = natural * k;
  let cx = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const f = SANS[w];
  const sc = (size * k) / f.unitsPerEm;
  const paths = [];
  for (const ch of s) {
    const g = f.glyphForCodePoint(ch.codePointAt(0));
    const d = g.path.toSVG();
    if (d) paths.push(`<path transform="translate(${cx.toFixed(2)} ${y.toFixed(2)}) scale(${sc} ${-sc})" d="${d}"/>`);
    cx += g.advanceWidth * sc;
  }
  return `<g fill="${fill}">${paths.join('')}</g>`;
}

/** 行頭に来てはいけない字（前の行にぶら下げる） */
const NO_START = '、。，．）」』】％%・ー〜!?！？';

/** 幅で折り返す。改行（\n）はそのまま改行にする */
function wrap(s, size, w, width) {
  const out = [];
  for (const para of String(s ?? '').split('\n')) {
    let cur = '';
    let cw = 0;
    for (const ch of para) {
      const a = adv(ch, size, w);
      if (cw + a > width && cur && !NO_START.includes(ch)) {
        out.push(cur);
        cur = '';
        cw = 0;
      }
      cur += ch;
      cw += a;
    }
    out.push(cur);
  }
  return out;
}

/** 段落。{ svg, h } を返す。maxLines を超えたらエラー */
function para(s, { x, y, size, w = 500, fill = C.ink, width, lh = 1.55, anchor = 'start', maxLines, name }) {
  const lines = wrap(s, size, w, width);
  if (maxLines && lines.length > maxLines) {
    problems.push(`${name ?? s}：${maxLines}行に収まりません（${lines.length}行）「${s}」`);
  }
  const step = size * lh;
  const ax = anchor === 'middle' ? x + width / 2 : x;
  const svg = lines
    .map((l, i) => text(l, { x: ax, y: y + size + i * step, size, w, fill, anchor }))
    .join('');
  return { svg, h: lines.length * step - (step - size) + size * 0.25 };
}

// ── 図形 ─────────────────────────────────────────────
const rect = (x, y, w, h, { r = 14, fill = C.card, stroke = C.line, sw = 1.5 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;

/** 太い矢印。dir: up | down | right */
function arrow(cx, cy, s, dir, fill) {
  const sw = s * 0.16;
  const hw = s * 0.36;
  const hh = s * 0.42;
  const h = s / 2;
  let pts = [
    [-sw, h], [-sw, -h + hh], [-hw, -h + hh], [0, -h], [hw, -h + hh], [sw, -h + hh], [sw, h],
  ];
  if (dir === 'down') pts = pts.map(([px, py]) => [px, -py]);
  if (dir === 'right') pts = pts.map(([px, py]) => [-py, px]);
  return `<polygon fill="${fill}" points="${pts.map(([px, py]) => `${(cx + px).toFixed(1)},${(cy + py).toFixed(1)}`).join(' ')}"/>`;
}

/** 細い連結線＋矢じり（下向き） */
const connector = (x1, y1, x2, y2, color = '#2b8fd6') => {
  const midY = (y1 + y2) / 2;
  return `<path d="M${x1} ${y1} V${midY} H${x2} V${y2 - 9}" fill="none" stroke="${color}" stroke-width="3"/>` +
    `<polygon fill="${color}" points="${x2 - 8},${y2 - 11} ${x2 + 8},${y2 - 11} ${x2},${y2}"/>`;
};

/** アイコン。(x, y) を左上に s 四方で描く */
const ICONS = {
  gold(x, y, s) {
    const bar = (bx, by) => {
      const w = s * 0.52;
      const h = s * 0.26;
      const t = s * 0.07;
      return `<polygon fill="#f4c542" stroke="#a87408" stroke-width="2" stroke-linejoin="round" points="${bx + t},${by} ${bx + w - t},${by} ${bx + w},${by + h} ${bx},${by + h}"/>` +
        `<polygon fill="#ffe08a" points="${bx + t + 3},${by + 3} ${bx + w - t - 3},${by + 3} ${bx + w - t},${by + h * 0.35} ${bx + t},${by + h * 0.35}"/>`;
    };
    return bar(x + s * 0.24, y + s * 0.2) + bar(x - s * 0.02 + s * 0.02, y + s * 0.5) + bar(x + s * 0.48, y + s * 0.5);
  },
  bank(x, y, s) {
    const c = C.navy;
    let cols = '';
    for (let i = 0; i < 4; i++) cols += `<rect x="${x + s * (0.17 + i * 0.19)}" y="${y + s * 0.42}" width="${s * 0.09}" height="${s * 0.36}" fill="${c}"/>`;
    return `<polygon fill="${c}" points="${x + s * 0.5},${y + s * 0.08} ${x + s * 0.95},${y + s * 0.34} ${x + s * 0.05},${y + s * 0.34}"/>` +
      `<rect x="${x + s * 0.1}" y="${y + s * 0.34}" width="${s * 0.8}" height="${s * 0.06}" fill="${c}"/>` + cols +
      `<rect x="${x + s * 0.06}" y="${y + s * 0.8}" width="${s * 0.88}" height="${s * 0.1}" fill="${c}"/>`;
  },
  dollar(x, y, s) {
    return `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.44}" fill="${C.tint.blue}" stroke="${C.navy}" stroke-width="3"/>` +
      text('$', { x: x + s / 2, y: y + s * 0.73, size: s * 0.66, w: 900, fill: C.navy, anchor: 'middle' });
  },
  chip(x, y, s) {
    let pins = '';
    for (let i = 0; i < 4; i++) {
      const p = s * (0.26 + i * 0.16);
      pins += `<rect x="${x + p - 2}" y="${y + s * 0.06}" width="4" height="${s * 0.14}" fill="${C.navy}"/>` +
        `<rect x="${x + p - 2}" y="${y + s * 0.8}" width="4" height="${s * 0.14}" fill="${C.navy}"/>` +
        `<rect y="${y + p - 2}" x="${x + s * 0.06}" height="4" width="${s * 0.14}" fill="${C.navy}"/>` +
        `<rect y="${y + p - 2}" x="${x + s * 0.8}" height="4" width="${s * 0.14}" fill="${C.navy}"/>`;
    }
    return pins + rect(x + s * 0.18, y + s * 0.18, s * 0.64, s * 0.64, { r: 6, fill: '#fff', stroke: C.navy, sw: 3 }) +
      text('AI', { x: x + s / 2, y: y + s * 0.62, size: s * 0.3, w: 900, fill: C.navy, anchor: 'middle' });
  },
  bond(x, y, s) {
    const sheet = (dx, dy) =>
      rect(x + dx, y + dy, s * 0.72, s * 0.5, { r: 5, fill: '#e9f7ee', stroke: '#2f8a52', sw: 2.5 }) +
      `<circle cx="${x + dx + s * 0.36}" cy="${y + dy + s * 0.25}" r="${s * 0.1}" fill="none" stroke="#2f8a52" stroke-width="2.5"/>`;
    return sheet(s * 0.2, s * 0.14) + sheet(s * 0.12, s * 0.26) + sheet(s * 0.04, s * 0.38);
  },
  oil(x, y, s) {
    return rect(x + s * 0.22, y + s * 0.1, s * 0.56, s * 0.8, { r: 6, fill: '#2a2f3a', stroke: null }) +
      `<rect x="${x + s * 0.22}" y="${y + s * 0.34}" width="${s * 0.56}" height="4" fill="#8a93a3"/>` +
      `<rect x="${x + s * 0.22}" y="${y + s * 0.64}" width="${s * 0.56}" height="4" fill="#8a93a3"/>`;
  },
  calendar(x, y, s) {
    return rect(x + s * 0.1, y + s * 0.16, s * 0.8, s * 0.74, { r: 6, fill: '#fff', stroke: C.navy, sw: 3 }) +
      `<rect x="${x + s * 0.1}" y="${y + s * 0.16}" width="${s * 0.8}" height="${s * 0.18}" fill="${C.navy}"/>` +
      `<rect x="${x + s * 0.28}" y="${y + s * 0.06}" width="5" height="${s * 0.18}" fill="${C.navy}"/>` +
      `<rect x="${x + s * 0.68}" y="${y + s * 0.06}" width="5" height="${s * 0.18}" fill="${C.navy}"/>` +
      text('PM', { x: x + s / 2, y: y + s * 0.74, size: s * 0.26, w: 900, fill: C.navy, anchor: 'middle' });
  },
  chart(x, y, s) {
    let bars = '';
    [0.3, 0.5, 0.42, 0.7].forEach((h, i) => {
      bars += `<rect x="${x + s * (0.12 + i * 0.2)}" y="${y + s * (0.9 - h)}" width="${s * 0.14}" height="${s * h}" fill="${C.navy}"/>`;
    });
    return bars;
  },
};
const icon = (name, x, y, s) => (ICONS[name] ? ICONS[name](x, y, s) : '');

// ── 入力 ─────────────────────────────────────────────
function fail(msg) {
  console.error(`make-infographic: ${msg}`);
  process.exit(1);
}
const args = process.argv.slice(2);
const id = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
if (!id) fail('日付を指定してください（例: node tools/make-infographic.mjs 2026-10-15）');
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const out = opt('--out') ?? join(ROOT, 'note', `info_${id.replaceAll('-', '')}.png`);
const src = opt('--src') ?? join(ROOT, 'src/content/reports', `${id}.md`);

let raw;
try {
  raw = readFileSync(src, 'utf8');
} catch {
  fail(`${src} がありません`);
}
const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!fm) fail('frontmatter が読めません');
const data = yaml.load(fm[1]);
const ig = data.infographic;
if (!ig) fail('frontmatter に infographic がありません');

/** 数値の出どころ。snapshot が先、infographic.quotes が後 */
const QUOTES = [...(data.snapshot ?? []), ...(ig.quotes ?? [])];
/** ref（ラベルの部分一致）で数値を引き、項目に足す。ref が無ければそのまま */
function resolve(item) {
  if (!item?.ref) return item;
  const q = QUOTES.find((s) => s.label.includes(item.ref));
  if (!q) {
    problems.push(`ref「${item.ref}」に当たる行が snapshot / infographic.quotes にありません`);
    return item;
  }
  return { label: q.label, ...q, ...item };
}

// ── 組む ─────────────────────────────────────────────
const parts = [];
let y = 0;

// ヘッダー
{
  const d = new Date(`${id}T00:00:00Z`);
  const wd = '日月火水木金土'[d.getUTCDay()];
  const H = 236;
  parts.push(
    `<defs><linearGradient id="hd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dce9f8"/><stop offset="1" stop-color="${C.bg}"/></linearGradient></defs>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#hd)"/>`,
  );
  // 下端のビル街（抽象）
  let sky = '';
  const bx = [0, 60, 100, 170, 230, 300, 820, 870, 930, 990, 1030];
  const bh = [70, 110, 80, 130, 90, 60, 90, 140, 100, 120, 80];
  bx.forEach((x0, i) => (sky += `<rect x="${x0}" y="${H - bh[i]}" width="${i % 2 ? 48 : 58}" height="${bh[i]}" fill="#c9daee" opacity=".55"/>`));
  parts.push(sky);

  const dateLabel = `${id.replaceAll('-', '.')}（${wd}）`;
  const dw = measure(dateLabel, 30, 900) + 40;
  parts.push(
    rect(M, 30, dw, 52, { r: 10, fill: C.down, stroke: null }),
    text(dateLabel, { x: M + 20, y: 67, size: 30, w: 900, fill: '#fff' }),
    text('TEITEN｜マネーフロー・デイリー', { x: W - M, y: 64, size: 20, w: 700, fill: C.navy, anchor: 'end' }),
    text(data.thumb?.title ?? '', {
      x: W / 2, y: 160, size: 70, w: 900, fill: C.navy, anchor: 'middle', maxWidth: IN, name: '大タイトル（thumb.title）',
    }),
    text(data.thumb?.sub ?? '', {
      x: W / 2, y: 210, size: 34, w: 700, fill: C.ink, anchor: 'middle', maxWidth: IN, name: '中タイトル（thumb.sub）',
    }),
  );
  y = H + 8;
}

// 今日の資金フロー（帯）
{
  const flow = ig.flow ?? [];
  const H = 96;
  parts.push(rect(M, y, IN, H, { fill: C.card }));
  const lw = 210;
  parts.push(
    rect(M + 14, y + 14, lw, H - 28, { r: 10, fill: C.navy, stroke: null }),
    text('今日の資金フロー', { x: M + 14 + lw / 2, y: y + H / 2 + 9, size: 25, w: 900, fill: '#fff', anchor: 'middle', maxWidth: lw - 24 }),
  );
  const n = flow.length;
  const gap = 40;
  const x0 = M + 14 + lw + 18;
  const cw = (M + IN - 14 - x0 - gap * (n - 1)) / n;
  flow.forEach((f, i) => {
    const tone = f.tone ?? 'navy';
    const cx = x0 + i * (cw + gap);
    parts.push(rect(cx, y + 14, cw, H - 28, { r: 10, fill: C.tint[tone], stroke: dirColor(tone === 'navy' ? 'blue' : tone), sw: 1.5 }));
    const lines = String(f.text).split('\n');
    const size = lines.length > 1 ? 23 : 26;
    lines.forEach((l, j) => {
      const ly = y + H / 2 + 9 + (j - (lines.length - 1) / 2) * (size + 4);
      parts.push(text(l, { x: cx + cw / 2, y: ly, size, w: 900, fill: C.ink, anchor: 'middle', maxWidth: cw - 16, name: `flow ${i + 1}` }));
    });
    if (i < n - 1) parts.push(arrow(cx + cw + gap / 2, y + H / 2, 28, 'right', '#2b8fd6'));
  });
  y += H + 22;
}

/** 番号つきの見出し帯。本体は body(top) が高さを返す */
let seq = 0;
function section(_, title, lead, body) {
  const n = ++seq;
  const barH = 68;
  const top = y;
  const inner = [];
  inner.push(
    `<path d="M${M} ${top + 14} q0 -14 14 -14 h${IN - 28} q14 0 14 14 v${barH - 14} h-${IN} z" fill="${C.navy}"/>`,
    text(String(n), { x: M + 34, y: top + 46, size: 34, w: 900, fill: '#fff', anchor: 'middle' }),
    text(title, { x: M + 66, y: top + 45, size: 30, w: 900, fill: '#fff', maxWidth: 520, name: `${n} の見出し` }),
  );
  if (lead) {
    const lx = M + 66 + Math.min(measure(title, 30, 900), 520) + 28;
    const lw = M + IN - 20 - lx;
    const lines = wrap(lead, 19, 500, lw);
    if (lines.length > 2) problems.push(`${n} のリード：2行に収まりません「${lead}」`);
    lines.slice(0, 2).forEach((l, i) => {
      const ly = top + barH / 2 + 7 + (i - (Math.min(lines.length, 2) - 1) / 2) * 26;
      inner.push(text(l, { x: lx, y: ly, size: 19, w: 500, fill: '#dfe8f5' }));
    });
  }
  const parts2 = [];
  const h = body(top + barH + 20, parts2);
  const total = barH + 20 + h + 22;
  parts.push(
    `<path d="M${M} ${top + barH} v${total - barH - 14} q0 14 14 14 h${IN - 28} q14 0 14 -14 v-${total - barH - 14} z" fill="${C.card}" stroke="${C.line}" stroke-width="1.5"/>`,
    ...inner,
    ...parts2,
  );
  y = top + total + 16;
  // 次のブロックへの三角
  parts.push(`<polygon fill="#9fb2c9" points="${W / 2 - 18},${y - 14} ${W / 2 + 18},${y - 14} ${W / 2},${y + 2}"/>`);
  y += 10;
}

const fmt = (v, suffix = '') => `${v}${suffix}`;

// 1 指標（予想と結果）
if (ig.focus) {
  const f = ig.focus;
  section(1, f.title, f.lead, (top, P) => {
    const H = 270;
    const cards = f.compare ?? [];
    const hlW = f.highlight ? 290 : 0;
    const gap = 18;
    const x0 = M + 20;
    const avail = IN - 40 - (hlW ? hlW + gap : 0);
    const cw = (avail - gap * (cards.length - 1)) / Math.max(cards.length, 1);
    cards.forEach((c, i) => {
      const cx = x0 + i * (cw + gap);
      P.push(rect(cx, top, cw, H, { fill: '#f7fafd' }));
      P.push(
        text(c.label, { x: cx + 22, y: top + 40, size: 26, w: 900, fill: C.navy }),
        text(c.unit ? `（${c.unit}）` : '', { x: cx + 22 + measure(c.label, 26, 900) + 4, y: top + 40, size: 17, w: 500, fill: C.sub }),
      );
      const fv = Number(c.forecast);
      const av = Number(c.actual);
      const surprise = av > fv ? 'up' : av < fv ? 'down' : 'flat';
      const tag = { up: '上振れ', down: '下振れ', flat: '予想通り' }[surprise];
      const tagC = surprise === 'up' ? C.down : surprise === 'down' ? C.blue : C.flat;
      const tw = measure(tag, 18, 900) + 22;
      P.push(rect(cx + cw - 22 - tw, top + 16, tw, 34, { r: 17, fill: tagC, stroke: null }),
        text(tag, { x: cx + cw - 22 - tw / 2, y: top + 40, size: 18, w: 900, fill: '#fff', anchor: 'middle' }));
      // 棒（0起点。差が小さければ小さく見える）
      const max = Math.max(fv, av);
      const base = top + H - 26;
      const fullH = 120;
      const bw = Math.min(110, (cw - 100) / 2);
      [[fv, '予想', '#9cc3f2', C.blue], [av, '結果', C.down, C.down]].forEach(([v, lab, col, tc], j) => {
        const bh = (v / max) * fullH;
        const bx = cx + cw / 2 + (j === 0 ? -bw - 18 : 18);
        P.push(
          `<rect x="${bx}" y="${base - bh}" width="${bw}" height="${bh}" rx="4" fill="${col}"/>`,
          text(lab, { x: bx + bw / 2, y: base - bh - 46, size: 17, w: 700, fill: C.sub, anchor: 'middle' }),
          text(fmt(v, c.suffix), { x: bx + bw / 2, y: base - bh - 12, size: j ? 40 : 30, w: 900, fill: tc, anchor: 'middle' }),
        );
      });
      P.push(`<line x1="${cx + 20}" x2="${cx + cw - 20}" y1="${base}" y2="${base}" stroke="${C.line}" stroke-width="2"/>`);
    });
    if (f.highlight) {
      const h = f.highlight;
      const hx = M + IN - 20 - hlW;
      const col = dirColor(h.dir ?? 'up');
      P.push(rect(hx, top, hlW, H, { fill: C.tint[h.dir ?? 'up'] }));
      P.push(
        icon(h.icon ?? 'oil', hx + 18, top + 18, 44),
        text(h.label, { x: hx + 70, y: top + 48, size: 24, w: 900, fill: C.ink, maxWidth: hlW - 84 }),
        text(h.unit ? `（${h.unit}）` : '', { x: hx + 70, y: top + 74, size: 16, w: 500, fill: C.sub }),
        text(h.value, { x: hx + hlW / 2, y: top + 160, size: 66, w: 900, fill: col, anchor: 'middle', maxWidth: hlW - 30 }),
      );
      P.push(para(h.note, { x: hx + 18, y: top + 180, size: 21, w: 700, fill: col, width: hlW - 36, anchor: 'middle', maxLines: 2, name: 'focus.highlight.note' }).svg);
    }
    return H;
  });
}

// 2 市場の反応（フロー図）
if (ig.reaction) {
  const r = ig.reaction;
  section(2, r.title ?? '市場の反応と資金フロー', r.lead, (top, P) => {
    const rootW = 380;
    const rootH = 84;
    const rx = W / 2 - rootW / 2;
    P.push(rect(rx, top, rootW, rootH, { fill: C.tint.down, stroke: '#f2a3a1', sw: 2 }),
      text(r.root.text, { x: W / 2, y: top + 42, size: 32, w: 900, fill: C.down, anchor: 'middle' }),
      text(r.root.sub ?? '', { x: W / 2, y: top + 72, size: 19, w: 500, fill: C.ink, anchor: 'middle' }));

    const midY = top + rootH + 44;
    const midH = 86;
    const mids = r.mid ?? [];
    const midW = 380;
    const midGap = 40;
    const mx0 = W / 2 - (mids.length * midW + (mids.length - 1) * midGap) / 2;
    mids.forEach((m, i) => {
      const mx = mx0 + i * (midW + midGap);
      P.push(connector(W / 2, top + rootH, mx + midW / 2, midY));
      P.push(rect(mx, midY, midW, midH, { fill: C.tint.blue, stroke: '#b9cfee' }),
        icon(m.icon, mx + 20, midY + 14, 58),
        text(m.text, { x: mx + 96, y: midY + 42, size: 30, w: 900, fill: C.ink, maxWidth: midW - 150 }),
        text(m.sub ? `（${m.sub}）` : '', { x: mx + 96, y: midY + 72, size: 18, w: 500, fill: C.sub, maxWidth: midW - 110 }));
      if (m.dir) P.push(arrow(mx + midW - 34, midY + midH / 2, 36, m.dir, dirColor(m.dir)));
    });

    // 中段から下段へ。中段の中央を1本の線でまとめる
    const busY = midY + midH + 22;
    const leafY = busY + 26;
    const leaves = r.leaves ?? [];
    const lgap = 18;
    const lw = (IN - 40 - lgap * (leaves.length - 1)) / leaves.length;
    const lh = 150;
    P.push(`<line x1="${W / 2}" x2="${W / 2}" y1="${midY + midH}" y2="${busY}" stroke="#2f9a5b" stroke-width="3"/>`);
    const lxs = leaves.map((_, i) => M + 20 + i * (lw + lgap) + lw / 2);
    P.push(`<line x1="${lxs[0]}" x2="${lxs[lxs.length - 1]}" y1="${busY}" y2="${busY}" stroke="#2f9a5b" stroke-width="3"/>`);
    leaves.forEach((l, i) => {
      const lx = M + 20 + i * (lw + lgap);
      const tone = l.dir ?? 'flat';
      const col = dirColor(tone);
      P.push(`<line x1="${lxs[i]}" x2="${lxs[i]}" y1="${busY}" y2="${leafY - 9}" stroke="#2f9a5b" stroke-width="3"/>`,
        `<polygon fill="#2f9a5b" points="${lxs[i] - 8},${leafY - 11} ${lxs[i] + 8},${leafY - 11} ${lxs[i]},${leafY}"/>`);
      P.push(rect(lx, leafY, lw, lh, { fill: l.icon === 'gold' ? C.tint.gold : C.tint[tone], stroke: l.icon === 'gold' ? '#ecd08a' : null }));
      P.push(icon(l.icon, lx + lw / 2 - 34, leafY + 10, 68));
      P.push(text(l.text, { x: lx + lw / 2 - 14, y: leafY + 116, size: 34, w: 900, fill: tone === 'up' ? C.ink : col, anchor: 'middle', maxWidth: lw - 80 }));
      if (l.sub) P.push(text(`（${l.sub}）`, { x: lx + lw / 2 - 14, y: leafY + 142, size: 17, w: 500, fill: C.sub, anchor: 'middle', maxWidth: lw - 60 }));
      P.push(arrow(lx + lw - 30, leafY + 98, 50, tone === 'up' ? 'up' : 'down', col));
    });
    return leafY + lh - top;
  });
}

// 3 金利
if (ig.rates) {
  const r = ig.rates;
  section(3, r.title, r.lead, (top, P) => {
    const H = 200;
    const cards = (r.cards ?? []).map(resolve);
    const noteW = r.note ? 330 : 0;
    const gap = 18;
    const cw = (IN - 40 - (noteW ? noteW + gap : 0) - gap * (cards.length - 1)) / cards.length;
    cards.forEach((c, i) => {
      const cx = M + 20 + i * (cw + gap);
      const col = dirColor(c.dir);
      P.push(rect(cx, top, cw, H, { fill: C.tint.blue, stroke: '#c9daf1' }),
        text(c.name ?? c.label, { x: cx + 22, y: top + 42, size: 25, w: 900, fill: C.navy }),
        text(c.value, { x: cx + 22, y: top + 118, size: 64, w: 900, fill: C.navy, maxWidth: cw - 100 }),
        text(`（${c.change}）`, { x: cx + 22, y: top + 162, size: 24, w: 700, fill: col }),
        arrow(cx + cw - 46, top + 92, 64, c.dir === 'up' ? 'up' : 'down', col));
      if (c.caption) P.push(text(c.caption, { x: cx + 22, y: top + 188, size: 16, w: 500, fill: C.sub, maxWidth: cw - 40 }));
    });
    if (r.note) {
      const nx = M + IN - 20 - noteW;
      P.push(rect(nx, top, noteW, H, { fill: '#fff', stroke: '#9fb2c9', sw: 2 }),
        text(r.note.title, { x: nx + 22, y: top + 40, size: 22, w: 900, fill: C.navy, maxWidth: noteW - 44 }),
        `<line x1="${nx + 22}" x2="${nx + noteW - 22}" y1="${top + 56}" y2="${top + 56}" stroke="${C.line}" stroke-width="2"/>`,
        para(r.note.text, { x: nx + 22, y: top + 64, size: 19, w: 500, width: noteW - 44, maxLines: 5, name: 'rates.note.text' }).svg);
    }
    return H;
  });
}

// 4 金（天秤）
if (ig.gold) {
  const g = ig.gold;
  section(4, g.title, g.lead, (top, P) => {
    const H = 300;
    // 天秤：左の皿が上がり（軽い）、右の皿が下がる（重い）
    const cx = M + 300;
    const beamY = top + 70;
    const tilt = 28;
    const lxp = cx - 165;
    const rxp = cx + 165;
    P.push(
      `<rect x="${cx - 7}" y="${beamY}" width="14" height="${H - 90}" fill="#b98b2a"/>`,
      `<path d="M${cx - 80} ${top + H - 10} h160 l-20 -26 h-120 z" fill="#c99a37"/>`,
      `<line x1="${lxp}" y1="${beamY - tilt}" x2="${rxp}" y2="${beamY + tilt}" stroke="#b98b2a" stroke-width="10" stroke-linecap="round"/>`,
      `<circle cx="${cx}" cy="${beamY}" r="14" fill="#d9a83c" stroke="#9a7015" stroke-width="3"/>`,
    );
    const pan = (px, py, items, side) => {
      const panY = py + 120;
      const s = [];
      s.push(`<line x1="${px}" y1="${py}" x2="${px - 90}" y2="${panY}" stroke="#9a7015" stroke-width="2"/>`,
        `<line x1="${px}" y1="${py}" x2="${px + 90}" y2="${panY}" stroke="#9a7015" stroke-width="2"/>`,
        `<path d="M${px - 110} ${panY} q110 46 220 0 z" fill="#e2b552" stroke="#9a7015" stroke-width="2"/>`);
      // 皿の上に札を積む（下から）
      let by = panY - 6;
      [...items].reverse().forEach((it) => {
        const q = resolve(it);
        const col = dirColor(q.dir);
        const bh = q.value ? 84 : 48;
        by -= bh;
        s.push(rect(px - 105, by, 210, bh, { r: 10, fill: side === 'L' ? C.tint.blue : C.tint.up, stroke: side === 'L' ? '#9cc3f2' : '#9fd8b4', sw: 2 }));
        const name = `${q.name ?? q.label}`;
        s.push(text(name, { x: px - 4, y: by + 32, size: 23, w: 900, fill: C.ink, anchor: 'middle', maxWidth: 160 }));
        if (q.dir) s.push(arrow(px - 4 + Math.min(measure(name, 23, 900), 160) / 2 + 16, by + 24, 22, q.dir, col));
        if (q.value) {
          s.push(text(`${q.value}${q.change ? `（${q.change}）` : ''}`, { x: px, y: by + 66, size: 25, w: 900, fill: C.navy, anchor: 'middle', maxWidth: 190 }));
        }
        by -= 6;
      });
      return s.join('');
    };
    P.push(pan(lxp, beamY - tilt, g.light ?? [], 'L'), pan(rxp, beamY + tilt, g.heavy ?? [], 'R'));

    // 右：金の価格
    const px = M + 600;
    const q = resolve({ ref: g.price_ref ?? 'XAU' });
    const col = dirColor(q.dir);
    P.push(icon('gold', px, top + 4, 70),
      text('金', { x: px + 84, y: top + 50, size: 32, w: 900, fill: C.ink }),
      text(g.price_label ?? '（XAU/USD・現物）', { x: px + 120, y: top + 50, size: 18, w: 500, fill: C.sub }),
      text(`${q.value}ドル`, { x: px + 10, y: top + 140, size: 72, w: 900, fill: col, maxWidth: IN + M - px - 30 }),
      text(q.change, { x: px + 10, y: top + 206, size: 50, w: 900, fill: col }));
    if (g.sub_price) P.push(text(g.sub_price, { x: px + 10, y: top + 246, size: 18, w: 500, fill: C.sub, maxWidth: IN + M - px - 30 }));

    // 結論の帯
    let h = H;
    if (g.conclusion) {
      const pr = para(g.conclusion, { x: M + 40, y: top + H + 14, size: 20, w: 700, width: IN - 80, anchor: 'middle', maxLines: 2, name: 'gold.conclusion' });
      P.push(rect(M + 20, top + H, IN - 40, pr.h + 28, { r: 10, fill: C.tint.gold, stroke: null }), pr.svg);
      h += pr.h + 28;
    }
    return h;
  });
}

// 5 主要マーケットの数字
{
  const rows = (ig.table ?? QUOTES.map((q) => ({ ref: q.label }))).map(resolve);
  section(5, '主要マーケットの数字', ig.table_note ?? '終値・清算値ベース。括弧内は前日比', (top, P) => {
    const half = Math.ceil(rows.length / 2);
    const colW = (IN - 40 - 20) / 2;
    const rh = 58;
    rows.forEach((q, i) => {
      const col = i < half ? 0 : 1;
      const row = col ? i - half : i;
      const x = M + 20 + col * (colW + 20);
      const ry = top + row * rh;
      if (row % 2 === 0) P.push(rect(x, ry, colW, rh, { r: 8, fill: '#f5f8fc', stroke: null }));
      P.push(
        text(q.name ?? q.label, { x: x + 16, y: ry + 38, size: 23, w: 700, fill: C.ink, maxWidth: 170 }),
        text(q.value, { x: x + colW - 150, y: ry + 38, size: 25, w: 900, fill: C.ink, anchor: 'end', maxWidth: 170 }),
        text(q.change ?? '', { x: x + colW - 16, y: ry + 38, size: 25, w: 900, fill: dirColor(q.dir), anchor: 'end', maxWidth: 120 }),
      );
    });
    let h = half * rh;
    if (ig.movers) {
      const mv = ig.movers;
      const my = top + h + 18;
      const mh = 76;
      const tagW = 196;
      P.push(rect(M + 20, my, IN - 40, mh, { r: 12, fill: C.tint.down, stroke: '#f2b8b6' }),
        rect(M + 32, my + 16, tagW, mh - 32, { r: 8, fill: C.down, stroke: null }),
        text(mv.title ?? '注目銘柄', { x: M + 32 + tagW / 2, y: my + mh / 2 + 8, size: 21, w: 900, fill: '#fff', anchor: 'middle', maxWidth: tagW - 16 }));
      const items = (mv.items ?? []).map(resolve);
      const iw = (IN - 40 - tagW - 36) / items.length;
      items.forEach((it, i) => {
        const ix = M + 32 + tagW + 16 + i * iw;
        const nm = it.name ?? it.label;
        P.push(text(nm, { x: ix, y: my + (it.note ? 36 : 48), size: 25, w: 900, fill: C.ink }),
          text(it.change, { x: ix + measure(nm, 25, 900) + 14, y: my + (it.note ? 36 : 48), size: 25, w: 900, fill: dirColor(it.dir) }));
        if (it.note) P.push(text(it.note, { x: ix, y: my + 62, size: 16, w: 500, fill: C.sub, maxWidth: iw - 16 }));
      });
      h += 18 + mh;
    }
    return h;
  });
}

// 6・7 バイアスと注目点（横並び）
{
  const top = y;
  const gap = 18;
  const lw = 400;
  const rw = IN - lw - gap;
  const head = (x, w, n, title) =>
    `<path d="M${x} ${top + 14} q0 -14 14 -14 h${w - 28} q14 0 14 14 v44 h-${w} z" fill="${C.navy}"/>` +
    text(String(n), { x: x + 30, y: top + 42, size: 30, w: 900, fill: '#fff', anchor: 'middle' }) +
    text(title, { x: x + 58, y: top + 41, size: 26, w: 900, fill: '#fff' });

  const b = ig.bias ?? {};
  const watch = ig.watch ?? [];
  const wh = 98;
  const bodyH = Math.max(watch.length * wh + 8, 300);
  const H = 58 + bodyH + 20;
  parts.push(rect(M, top, lw, H), rect(M + lw + gap, top, rw, H), head(M, lw, seq + 1, 'Market Bias（短期）'), head(M + lw + gap, rw, seq + 2, '今後の注目ポイント'));

  const bc = dirColor(b.dir ?? 'down');
  parts.push(rect(M + 20, top + 78, lw - 40, 92, { r: 12, fill: C.tint[b.dir ?? 'down'], stroke: null }),
    text(b.label ?? '', { x: M + lw / 2, y: top + 140, size: 44, w: 900, fill: bc, anchor: 'middle', maxWidth: lw - 70, name: 'bias.label' }),
    para(b.text, { x: M + 24, y: top + 186, size: 21, w: 500, width: lw - 48, maxLines: 5, name: 'bias.text', lh: 1.6 }).svg);

  watch.forEach((wt, i) => {
    const wx = M + lw + gap + 20;
    const wy = top + 72 + i * wh;
    if (i % 2 === 1) parts.push(rect(wx - 6, wy - 6, rw - 28, wh - 4, { r: 10, fill: '#f5f8fc', stroke: null }));
    parts.push(`<circle cx="${wx + 22}" cy="${wy + 36}" r="22" fill="${C.navy}"/>`,
      text(String(i + 1), { x: wx + 22, y: wy + 46, size: 26, w: 900, fill: '#fff', anchor: 'middle' }),
      icon(wt.icon ?? 'chart', wx + 60, wy + 6, 58),
      text(wt.title, { x: wx + 136, y: wy + 30, size: 23, w: 900, fill: C.ink, maxWidth: rw - 180, name: `watch ${i + 1} の見出し` }),
      para(wt.text, { x: wx + 136, y: wy + 38, size: 18, w: 500, width: rw - 180, maxLines: 2, name: `watch ${i + 1}`, lh: 1.45 }).svg);
  });
  y = top + H + 20;
}

// フッター
{
  const pr = para('本図は相場に関する情報提供を目的としたもので、特定の金融商品の売買を推奨するものではありません。投資の最終判断はご自身の責任で行ってください。', {
    x: M, y, size: 16, w: 500, fill: C.sub, width: IN - 260,
  });
  parts.push(pr.svg,
    text('teiten.trade', { x: W - M, y: y + 22, size: 22, w: 900, fill: C.navy, anchor: 'end' }),
    text(`${data.updated ?? ''} 時点`, { x: W - M, y: y + 46, size: 16, w: 500, fill: C.sub, anchor: 'end' }));
  y += Math.max(pr.h, 50) + 24;
}

for (const n of notices) console.log(`注意 ${n}`);
if (problems.length > 0) {
  for (const m of problems) console.error(`エラー ${m}`);
  fail('文字が枠に収まらない、または数値の参照が切れているため書き出しませんでした。原稿の infographic を直してください');
}

const H = Math.ceil(y);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.bg}"/>${parts.join('')}</svg>`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await sharp(Buffer.from(svg)).png().toBuffer());
console.log(`OK ${out}（${W}×${H}）`);
