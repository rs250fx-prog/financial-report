import { visit } from 'unist-util-visit';
import { SITE_URL } from './config.ts';

/**
 * 本文中の外部リンクに target と rel を付与する rehype プラグイン。
 *
 * レポートは出典リンクを多く含み、しかも Markdown から生成されるため、
 * 手書きで属性を付けると必ず抜ける。ここで一括して処理する。
 *
 * - target="_blank"：出典を開いても読者が本文を失わないようにする
 * - rel="noopener"：開いた先から window.opener 経由で操作されるのを防ぐ
 * - rel="noreferrer"：リファラを送らない。リンク評価（PageRank）には
 *   影響しないため、SEO上の不利はない
 *
 * 自サイト内リンクと、ページ内アンカーは対象外。
 */

let host = '';
try {
  host = new URL(SITE_URL).host;
} catch {
  host = '';
}

const isExternal = (href) => {
  if (!href || typeof href !== 'string') return false;
  if (!/^https?:\/\//i.test(href)) return false; // 相対・#・mailto は対象外
  try {
    return new URL(href).host !== host;
  } catch {
    return false;
  }
};

export function rehypeExternalLinks() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a') return;
      const href = node.properties?.href;
      if (!isExternal(href)) return;

      node.properties.target = '_blank';

      // 既存の rel を尊重しつつ、重複なく足す
      const current = node.properties.rel;
      const rel = new Set(
        Array.isArray(current)
          ? current
          : typeof current === 'string'
            ? current.split(/\s+/).filter(Boolean)
            : [],
      );
      rel.add('noopener');
      rel.add('noreferrer');
      node.properties.rel = [...rel];
    });
  };
}
