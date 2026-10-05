/**
 * note 用サムネイルを、公開サイトから取れる場所へ写す（ビルド後に実行）。
 *
 *     note/thumb_20261005.png → dist/thumb/2026-10-05.png
 *     note/thumb_2026w40.png  → dist/thumb/2026-w40.png
 *
 * 画像はクラウドの定期実行が作ってリポジトリに push する。リポジトリは非公開なので、
 * そのままでは手元のPCで pull しないと取り出せない。スマホからでも note に貼れるよう、
 * 決まったURL（https://teiten.trade/thumb/2026-10-05.png）で配る。
 *
 * public/ に置かないのは、同じ画像をリポジトリに二重に持たないため。
 */
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'note');
const OUT = join(ROOT, 'dist', 'thumb');

if (!existsSync(join(ROOT, 'dist'))) {
  console.log('copy-thumbs: dist がありません（ビルド後に実行してください）');
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const f of readdirSync(SRC)) {
  const daily = f.match(/^thumb_(\d{4})(\d{2})(\d{2})\.png$/);
  const weekly = f.match(/^thumb_(\d{4})w(\d{2})\.png$/);
  const name = daily
    ? `${daily[1]}-${daily[2]}-${daily[3]}.png`
    : weekly
      ? `${weekly[1]}-w${weekly[2]}.png`
      : null;
  if (!name) continue;
  copyFileSync(join(SRC, f), join(OUT, name));
  n += 1;
}
console.log(`OK サムネイル${n}件を dist/thumb/ に写しました`);
