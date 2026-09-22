# TEITEN（定点）

金融系デイリーレポートの配信メディア。Astro + Cloudflare Pages。<br>媒体名の表記はローマ字 `TEITEN` を正とし、漢字 `定点` を補助に使う。
運営元: [Financial and Marketing M16](https://fam16.com/)

## 開発

```bash
npm install
npm run dev     # http://localhost:4321
npm run build   # dist/ に出力
```

## デプロイ

`main` への push で Cloudflare Pages が自動ビルドする。

| 項目 | 値 |
|---|---|
| Project name | `financial-report-m16` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | （空） |
| 環境変数 | `NODE_VERSION = 22` |

## 記事を追加する

デイリーレポートは `src/content/reports/YYYY-MM-DD.md`。
ファイル名がそのまま URL（`/reports/2026-09-22/`）になる。

`src/content/reports/_TEMPLATE.md` をコピーして使う。
アンダースコア始まりのファイルはビルドに含まれない。

週次まとめは `src/content/weekly/YYYY-wNN.md`。

### frontmatter の要点

| 項目 | 役割 |
|---|---|
| `no` | 号数。マストヘッドと記事冒頭に出る通し番号 |
| `deck` | リード文。TOPのヒーローと一覧の抜粋に使われる |
| `points` | 本日の要点。TOPのサイドバーと記事冒頭に `01..` と並ぶ |
| `snapshot` | マーケット・スナップショット。最上部のティッカーにも同じ値が流れる |
| `headline` | 一覧の右端に出す代表値（通常は XAU/USD の変化率） |
| `draft` | `true` のあいだはビルドに含まれない |
| `unlisted` | 一覧・サイトマップに出さず noindex。URL では見られる |
| `access` | クローズ化フェーズ用。現状は `public` のみ運用 |

TOP のティッカーとスナップショットは、**常に最新号の `snapshot` を参照する**。
個別の設定は不要。

## 公開制御

`src/config.ts` の `IS_PUBLIC` が唯一のスイッチ。
`false` のあいだは全ページ noindex、サイトマップと RSS も出力しない。

本公開の手順:

1. `src/config.ts` の `SITE_URL` を独自ドメインに変更
2. `IS_PUBLIC` を `true` に変更
3. `public/_headers` の `X-Robots-Tag` の行を削除

`robots.txt` と `_headers` の両方で止めているのは、robots.txt が
クロールを止めるだけで、外部リンク経由のインデックス登録を防げないため。

## メール購読

`src/config.ts` の `SUBSCRIBE_ACTION` に配信サービスの form action URL を入れると、
購読フォームが有効になる。空のあいだは「準備中」表示で送信不可。

## 設定の集約先

サイト名・タグライン・免責事項・ナビ項目は、すべて `src/config.ts` にある。
配色は `src/styles/global.css` の `:root`（`--bg` / `--surface` / `--ink` の
3つを触れば全体が追従する）。

## 注意

- `src/pages/privacy.astro` は雛形。公開前に実態に合わせて必ず確認すること
- `src/content/` にあるサンプル記事は**架空のデータ**。公開前に削除すること
