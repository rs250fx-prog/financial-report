// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';
import { IS_PUBLIC, SITE_URL } from './src/config.ts';
import { remarkFlow } from './src/remark-flow.mjs';
import { rehypeExternalLinks } from './src/rehype-external-links.mjs';

/**
 * frontmatter で unlisted: true が指定された記事は、サイトマップからも除外する。
 * ページ側の noindex と同じ指定が効くよう、frontmatter を唯一の情報源にする。
 * （載せたまま noindex にすると Search Console でエラーになる）
 */
function unlistedPaths(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .filter((f) => {
      const fm = fs.readFileSync(path.join(dir, f), 'utf-8').split('---')[1] ?? '';
      return /^unlisted:\s*true\s*$/m.test(fm);
    })
    .map((f) => `${prefix}/${f.replace(/\.md$/, '')}`);
}

const excluded = [
  ...unlistedPaths('./src/content/reports', '/reports'),
  ...unlistedPaths('./src/content/weekly', '/weekly'),
];

export default defineConfig({
  site: SITE_URL,
  // 本公開前はサイトマップを出さない（全ページ noindex のため）
  integrations: IS_PUBLIC
    ? [
        sitemap({
          filter: (page) =>
            !excluded.includes(new URL(page).pathname.replace(/\/$/, '')),
          // lastmod を出さないと Search Console が更新日を推定できない
          lastmod: new Date(),
          changefreq: 'daily',
          priority: 0.7,
        }),
      ]
    : [],
  markdown: {
    // 「資金　A → B」の行を資金フロー表示に変換する
    remarkPlugins: [remarkFlow],
    // 本文の外部リンクに target と rel を一括付与する
    rehypePlugins: [rehypeExternalLinks],
  },
});
