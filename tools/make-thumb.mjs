/**
 * note 用のサムネイル（1280×670）を書き出す。
 *
 *     node tools/make-thumb.mjs 2026-10-02     日次 → note/thumb_20261002.png
 *     node tools/make-thumb.mjs 2026-w40       週次 → note/thumb_2026w40.png
 *     node tools/make-thumb.mjs 2026-10-02 --out /tmp/t.png
 *
 * 入力は日次レポート／週次まとめの frontmatter。日付・更新時刻・数値5枠は既存の項目
 * （日次は snapshot、週次は performance）から取り、
 * 大タイトル・中タイトル・小見出し・各枠の寸評だけを `thumb` から読む。
 * **数値を thumb に書かせない。**同じ数字を2か所に書くと、片方だけ直した号が出る。
 *
 * 文字はフォントファイルから輪郭を取り出し、パスとして描く。実行環境に
 * フォントが入っているかどうかで見た目が変わらないようにするため
 * （クラウドの定期実行には日本語フォントが無い）。固定の背景は
 * tools/thumb/base.png で、Figma の書き出しから日付・見出し・数値を抜いたもの。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create } from 'fontkitten';
import yaml from 'js-yaml';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = join(ROOT, 'tools/thumb/fonts');
const W = 1280;
const H = 670;

const font = (file, variation) => {
  const f = create(readFileSync(join(FONTS, file)));
  return variation ? f.getVariation(variation) : f;
};
const BEBAS = font('BebasNeue-Regular.ttf');
const MONO = font('ShareTechMono-Regular.ttf');
const SERIF = font('NotoSerifJP-Regular.ttf');
const SANS_BLACK = font('NotoSansJP-VF.ttf', { wght: 900 });
const SANS_BOLD = font('NotoSansJP-VF.ttf', { wght: 700 });
const SANS_MED = font('NotoSansJP-VF.ttf', { wght: 500 });

/** 上昇・下落・中立。数値SVGの雛形と同じ3色 */
const DIR_COLOR = { up: '#00e676', down: '#ff1744', flat: '#ffa726' };

/**
 * 数値5枠。match は元の項目の label に当てる式、key は thumb.notes のキー。
 * 日次（snapshot）と週次（performance）でラベルの書き方が違うため、部分一致で探す
 * （日次「XAU / USD」「米10年金利」、週次「金（XAU/USD）」「米10年債利回り」）。
 */
const BOARD = [
  { key: 'xau', match: /XAU/, label: 'XAU / USD' },
  { key: 'nikkei', match: /日経\s*225/, label: '日経 225' },
  { key: 'wti', match: /WTI/, label: 'WTI' },
  { key: 'dxy', match: /DXY/, label: 'DXY' },
  { key: 'us10y', match: /米10年/, label: 'US 10Y' },
];

/** 収まらなかった行（エラー）と、縮めて収めた行（お知らせ） */
const problems = [];
const notices = [];

/**
 * 1行を組む。faces は優先順のフォント一覧で、その字を持つ最初のフォントを使う
 * （英数字は Bebas Neue、日本語は Noto、のように混ぜるため）。
 * maxWidth を超える行は、全体を同じ比率で縮める。minScale まで縮めても
 * 収まらない行は、はみ出したまま出さずにエラーにする（name を付けた行だけ報告する）。
 *
 * face: { font, size, dy?: ベースラインの上下, skew?: 斜体の角度, ls?: 字間,
 *         bold?: 輪郭を太らせる幅(px)。Bebas Neue は1ウェイトしか無いため }
 */
function line(text, faces, { x, y, fill, maxWidth, minScale = 0.6, name }) {
  const pick = (cp) =>
    faces.find((f) => f.font.hasGlyphForCodePoint(cp)) ?? faces[faces.length - 1];
  const glyphs = [...text].map((ch) => {
    const cp = ch.codePointAt(0);
    const face = pick(cp);
    return { face, glyph: face.font.glyphForCodePoint(cp) };
  });
  const measure = (k) =>
    glyphs.reduce(
      (w, { face, glyph }) =>
        w + (glyph.advanceWidth / face.font.unitsPerEm) * face.size * k + (face.ls ?? 0) * k,
      0,
    );
  let k = 1;
  const natural = measure(1);
  if (maxWidth && natural > maxWidth) {
    k = maxWidth / natural;
    const over = Math.ceil([...text].length * (1 - k / Math.max(k, minScale)));
    if (k < minScale) {
      problems.push(`${name ?? text}：長すぎて収まりません（あと約${over}字削る）「${text}」`);
      k = minScale;
    } else if (k < 0.97 && name) {
      notices.push(`${name}：幅に収めるため ${Math.round(k * 100)}% に縮小しました「${text}」`);
    }
  }

  let cx = x;
  const paths = [];
  for (const { face, glyph } of glyphs) {
    const s = (face.size * k) / face.font.unitsPerEm;
    const d = glyph.path.toSVG();
    if (d) {
      const skew = face.skew ? ` skewX(${-face.skew})` : '';
      const ty = y + (face.dy ?? 0) * k;
      // 線幅はフォント単位で指定する（scale の内側にあるため）
      const bold = face.bold
        ? ` stroke="${fill}" stroke-width="${((face.bold * k) / s).toFixed(1)}" stroke-linejoin="round"`
        : '';
      paths.push(
        `<path transform="translate(${cx.toFixed(2)} ${ty.toFixed(2)})${skew} scale(${s} ${-s})"${bold} d="${d}"/>`,
      );
    }
    cx += glyph.advanceWidth * s + (face.ls ?? 0) * k;
  }
  return { svg: `<g fill="${fill}">${paths.join('')}</g>`, width: cx - x };
}

/** "4,171.19" → "4,171"。1000以上の数は整数に丸める。数でなければそのまま */
function boardValue(v) {
  const m = /^-?[\d,]+(\.\d+)?$/.test(v) ? Number(v.replaceAll(',', '')) : NaN;
  if (Number.isNaN(m) || Math.abs(m) < 1000) return v;
  return Math.round(m).toLocaleString('en-US');
}

/** 発行日の前の平日。D日の号が扱う米国セッション */
function sessionOf(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1);
  while ([0, 6].includes(d.getUTCDay()));
  const wd = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getUTCDay()];
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}/${dd} ${wd}`;
}

function fail(msg) {
  console.error(`make-thumb: ${msg}`);
  process.exit(1);
}

// ── 入力 ─────────────────────────────────────────────
const args = process.argv.slice(2);
const id = args.find((a) => /^\d{4}-\d{2}-\d{2}$|^\d{4}-w\d{2}$/.test(a));
if (!id) {
  fail('日付か週を指定してください（例: node tools/make-thumb.mjs 2026-10-02 ／ 2026-w40）');
}
const weekly = id.includes('w');
const outIdx = args.indexOf('--out');
const out =
  outIdx >= 0 ? args[outIdx + 1] : join(ROOT, 'note', `thumb_${id.replaceAll('-', '')}.png`);

const src = join(ROOT, 'src/content', weekly ? 'weekly' : 'reports', `${id}.md`);
let raw;
try {
  raw = readFileSync(src, 'utf8');
} catch {
  fail(`${src} がありません`);
}
const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!fm) fail('frontmatter が読めません');
const data = yaml.load(fm[1]);
const thumb = data.thumb;
if (!thumb?.title || !thumb?.sub || !thumb?.bias) {
  fail('frontmatter に thumb（title / sub / bias）がありません');
}

// 日次と週次で変わるのは、媒体ラベル・日付の書き方・上部バー右のタグ・数値の出どころ
const md = (iso) => iso.slice(5).replace('-', '/');
const BRAND = weekly ? 'マネーフロー・ウィークリー' : 'マネーフロー・デイリー';
const tag = weekly
  ? `WEEK ${data.week} ${md(data.start)}-${md(data.end)}`
  : `US SESSION ${sessionOf(id)}`;
const dateText = weekly
  ? `${data.start.replaceAll('-', ' / ')} - ${data.end.slice(5).replace('-', ' / ')}`
  : id.replaceAll('-', ' / ');
const quotes = (weekly ? data.performance : data.snapshot) ?? [];

// ── 組む ─────────────────────────────────────────────
const parts = [];
const GOLD = '#d9a520';
const GOLD_DIM = '#9a7410';

// 上部バー。時刻と対象セッションは原稿から取る（固定の文言を焼き込まない）
const mono = (size, ls) => [
  { font: MONO, size, ls },
  { font: SANS_MED, size: size * 0.86, ls: ls + 2.4 },
];
const time = (data.updated ?? '').match(/(\d{1,2}):(\d{2})/);
parts.push(
  `<defs><radialGradient id="glow"><stop offset="0" stop-color="#4cff91" stop-opacity=".55"/><stop offset="1" stop-color="#4cff91" stop-opacity="0"/></radialGradient></defs>`,
  `<circle cx="63" cy="21.5" r="10" fill="url(#glow)"/><circle cx="63" cy="21.5" r="4.2" fill="#4cff91"/>`,
  line('LIVE DATA', mono(15, 0.9), { x: 76, y: 27, fill: GOLD }).svg,
  line(BRAND, mono(15, 0.9), { x: 332, y: 26.5, fill: GOLD_DIM }).svg,
  line(tag, mono(15, 0.9), { x: weekly ? 572 : 552, y: 27, fill: GOLD_DIM }).svg,
);
if (time) {
  parts.push(
    line(`JST ${time[1].padStart(2, '0')}:${time[2]}`, mono(15, 0.9), { x: 204, y: 27, fill: GOLD_DIM }).svg,
  );
}

// 媒体ラベルと署名。背景画像には「デイリー」が焼き込まれているので、
// 週次は同じ位置を地の色で塗ってから描き直す（ラベルは1字ぶん広げる）
let dateX = 289;
if (weekly) {
  const brandFace = [{ font: SANS_MED, size: 14, ls: 3.5 }];
  const w = line(BRAND, brandFace, { x: 0, y: 0, fill: '#000' }).width - 3.5;
  const boxW = Math.round(w + 34);
  parts.push(
    `<rect x="50" y="103" width="218" height="31" fill="#050a0e"/>`,
    `<rect x="52.5" y="105.5" width="${boxW}" height="26" fill="#1c1b0d" stroke="#58460b"/>`,
    line(BRAND, brandFace, { x: 52.5 + 17, y: 123.3, fill: '#e0a81c' }).svg,
  );
  dateX = 52.5 + boxW + 24;

  const sigFace = [{ font: SANS_MED, size: 11.6, ls: 1.25 }];
  const sig = `${BRAND}｜資金の流れで読む市場`;
  const sw = line(sig, sigFace, { x: 0, y: 0, fill: '#000' }).width - 1.25;
  parts.push(
    `<rect x="938" y="622" width="290" height="21" fill="#050a0e"/>`,
    line(sig, sigFace, { x: 1224.5 - sw, y: 636.6, fill: '#7d5d0e' }).svg,
  );
}

// 日付（週次は対象期間）
parts.push(
  line(dateText, [{ font: BEBAS, size: 27.5, skew: 11, bold: 0.5 }], {
    x: dateX, y: 128.5, fill: '#ffffff',
  }).svg,
);

// 大タイトル・中タイトル。右端は余白を残して 1,228px まで
const TITLE_MAX = 1228 - 52;
parts.push(
  line(
    thumb.title,
    [
      { font: BEBAS, size: 94, dy: 3.5, ls: 1, bold: 2.2 },
      { font: SANS_BLACK, size: 80 },
    ],
    { x: 52, y: 242.5, fill: '#ffffff', maxWidth: TITLE_MAX, minScale: 0.75, name: '大タイトル（thumb.title）' },
  ).svg,
  line(
    thumb.sub,
    [
      { font: BEBAS, size: 58, dy: 2, skew: 11, bold: 1.2 },
      { font: SANS_BOLD, size: 50 },
    ],
    { x: 52, y: 341, fill: '#999999', maxWidth: TITLE_MAX, minScale: 0.75, name: '中タイトル（thumb.sub）' },
  ).svg,
);

// 数値5枠（y=430 から高さ120。区切り線は背景側にある）
BOARD.forEach((slot, i) => {
  const q = quotes.find((s) => slot.match.test(s.label));
  if (!q) fail(`${weekly ? 'performance' : 'snapshot'} に ${slot.label} の行がありません`);
  const x = 11 + 24 + 256 * i;
  const color = DIR_COLOR[q.dir] ?? DIR_COLOR.flat;
  const comment = thumb.notes?.[slot.key] ?? '';
  const note = [q.change, comment].filter(Boolean).join(' ');
  parts.push(
    line(slot.label, [{ font: BEBAS, size: 16, ls: 0.3 }, { font: SANS_MED, size: 15, ls: 1 }], {
      x, y: 430 + 32, fill: '#888888',
    }).svg,
    line(boardValue(String(q.value)), [{ font: BEBAS, size: 46, bold: 0.8 }, { font: SANS_BOLD, size: 34 }], {
      x, y: 430 + 71, fill: color, maxWidth: 220, minScale: 0.55, name: `${slot.label} の値`,
    }).svg,
    line(note, [{ font: SERIF, size: 18 }], { x, y: 430 + 107, fill: color, maxWidth: 222, minScale: 0.7, name: `${slot.label} の寸評（thumb.notes.${slot.key}）` }).svg,
  );
});

// 小見出し（Market Bias）。右下の署名に重ならない幅で止める（週次は署名が1字ぶん長い）
parts.push(
  line(thumb.bias, [{ font: SANS_BOLD, size: 31 }], {
    x: 60, y: 645.5, fill: '#daa842', maxWidth: (weekly ? 912 : 925) - 60, minScale: 0.66, name: '小見出し（thumb.bias）',
  }).svg,
);

for (const n of notices) console.log(`注意 ${n}`);
if (problems.length > 0) {
  for (const m of problems) console.error(`エラー ${m}`);
  fail('文字が枠に収まらないため書き出しませんでした。原稿の thumb を短くしてください');
}

const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;

mkdirSync(dirname(out), { recursive: true });
const png = await sharp(join(ROOT, 'tools/thumb/base.png'))
  .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
  .png()
  .toBuffer();
writeFileSync(out, png);
console.log(`OK ${out}`);
