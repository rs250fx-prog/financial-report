/**
 * ビルド結果に「見えるアスタリスク」が無いことを確認する。
 *
 * 日本語は句点のあとに空白を置かないため、CommonMark の flanking 規則で
 * 強調が閉じられず、`**` が本文にそのまま出ることがある。
 * src/remark-strong-fix.mjs で救済しているが、最終的な保証はここで行う。
 *
 * Markdown ではなく、出力された HTML の可視テキストを見る。
 * 記法の抜け道（フロー表示・frontmatter・コンポーネント）を
 * まとめて塞げるのは、この位置しかない。
 *
 * postbuild に繋いであるが、既定では警告にとどめてビルドは通す。
 * アスタリスクの露出は体裁の問題であり、記事が出ないことのほうが損失が
 * 大きい。**公開を止めない。** 実際の救済は remark-strong-fix.mjs が行い、
 * ここは漏れに気づくための最後の網である。
 *
 *   node tools/check-html.mjs            警告のみ（終了コード0）
 *   node tools/check-html.mjs --strict   異常があれば終了コード1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

// script / style の中身はコード。CSS の * などが正当に入るため対象外
const DROP = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const TAG = /<[^>]+>/g;
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

const visible = (html) =>
  html
    .replace(DROP, ' ')
    .replace(TAG, ' ')
    .replace(/&(#\d+|[a-z]+);/gi, (m, e) => ENT[e.toLowerCase()] ?? m);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.html') ? [p] : [];
  });
}

if (!fs.existsSync(DIST)) {
  console.error('dist がありません。先に npm run build を実行してください。');
  // 出力先が変わっただけで公開が止まらないよう、ここも既定では落とさない
  process.exit(process.argv.includes('--strict') ? 1 : 0);
}

const pages = walk(DIST);
let bad = 0;

for (const page of pages) {
  const rel = path.relative(DIST, page).split(path.sep).join('/');
  // HTML は1行に潰れていることがあるので、行頭ではなく該当箇所の前後を出す
  const text = visible(fs.readFileSync(page, 'utf-8')).replace(/\s+/g, ' ');
  for (let i = text.indexOf('*'); i !== -1; i = text.indexOf('*', i + 1)) {
    bad++;
    console.error(`NG ${rel}: …${text.slice(Math.max(0, i - 40), i + 40).trim()}…`);
  }
}

if (bad) {
  console.error(`\n可視のアスタリスクが ${bad} 件あります。`);
  console.error('閉じ側の ** の直後に句読点か空白を置くか、強調をやめてください。');
  // 既定ではビルドを止めない。記事が出ないことのほうが損失が大きい
  if (process.argv.includes('--strict')) process.exit(1);
  process.exit(0);
}

console.log(`OK 可視のアスタリスクなし（${pages.length}ページ）`);
