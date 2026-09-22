# TEITEN（定点）サイト仕様書

金融系デイリーレポート配信メディアの技術仕様。拡張・修正時はこの文書を起点にする。

- **最終更新**：2026-09-22
- **正規ドメイン**：apex（`https://teiten.trade/`）。`www` は301で apex へ寄せる
- **本番URL**：https://teiten.trade （Cloudflare Pages カスタムドメイン、接続作業中）
- **既定ホスト**：https://financial-report-bad.pages.dev
- **リポジトリ**：rs250fx-prog/financial-report（`main` ブランチ、push で自動デプロイ）
- **ローカル**：`D:\OneDrive\01_仕事・事業\M16BIZ\financial-report`

---

## 1. 媒体の位置づけ

| 項目 | 内容 |
|---|---|
| 媒体名 | TEITEN（表記はローマ字が正、漢字「定点」は補助） |
| タグライン | 資金の流れで読む、今日の市場 |
| 発行元 | Financial and Marketing M16（代表：村瀬 一郎） |
| 配信頻度 | 週5回・平日朝 |
| 目的 | ブランディング／情報のログ化／ファンの囲い込み。PVや広告収益ではない |
| 段階計画 | 公開発信 → 後にクローズ（会員制）へ移行 |

名前は定点観測から採っている。**同じ指標を、同じ形式で、毎営業日記録する**という運用がそのまま編集方針であり、機能設計の前提でもある。スナップショットの項目や記事構成を頻繁に変えない理由はここにある。

### 法務上の制約

投資助言・代理業の登録がないため、**個別の売買推奨はできない**。レポートは情報提供・分析にとどめ、免責を全ページのフッターに固定表示する（`src/config.ts` の `DISCLAIMER`）。有料化フェーズでは、対価を「相場分析情報の提供」として設計する必要がある。

金融情報は YMYL 領域にあたるため、発行元・発行日・出典の明示が検索評価に直結する。

---

## 2. 技術スタック

| 層 | 採用 |
|---|---|
| フレームワーク | Astro 5（静的生成のみ。SSRは使用しない） |
| ホスティング | Cloudflare Pages |
| 依存 | `@astrojs/sitemap`, `@astrojs/rss`, `unist-util-visit` |
| Node | 22（Cloudflare の環境変数 `NODE_VERSION` で固定） |
| CSS | 素の CSS。Astro のスコープ付き `<style>` と `src/styles/global.css` |
| JS | テーマ切替のみ。フレームワーク不使用 |

### ビルド設定（Cloudflare Pages）

| 項目 | 値 |
|---|---|
| Project name | `financial-report-bad`（自動生成のまま。`financial-report` は他アカウントが取得済み） |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | （空） |
| 環境変数 | `NODE_VERSION = 22` |

### ローカル開発

```bash
npm install
npm run dev     # http://localhost:4321
npm run build   # dist/ に出力
```

**注意**：`astro.config.mjs` と `src/remark-flow.mjs` を変更した場合、dev サーバーの再起動だけでは反映されない。Astro 5 はコンテンツのレンダリング結果を `.astro/` にキャッシュするため、`rm -rf .astro` が必要。Cloudflare は毎回クリーンな環境でビルドするので、この問題は本番では起きない。

---

## 3. ディレクトリ構成

```
src/
├── config.ts             全体設定。ここだけ触れば全ページに反映される
├── content.config.ts     コンテンツのスキーマ定義
├── remark-flow.mjs       「資金　A → B」等をフロー表示に変換する remark プラグイン
├── lib/content.ts        コレクションの取得・整形ヘルパー
├── layouts/Base.astro    全ページ共通の外枠
├── components/           ページをまたいで使う部品
├── pages/                ルーティング
├── content/
│   ├── reports/          デイリーレポート（YYYY-MM-DD.md）
│   └── weekly/           週次まとめ（YYYY-wNN.md）
└── styles/global.css     デザイントークンと共通スタイル
public/
├── _headers              Cloudflare のレスポンスヘッダ
├── og-default.png        OG画像（tools/make-og.py で生成）
└── favicon.svg
tools/make-og.py          OG画像の生成スクリプト
docs/SPEC.md              本書
```

---

## 4. 設定の集約先

**変更するときは、まずここを見る。**

| 変えたいもの | 場所 |
|---|---|
| サイト名・タグライン・説明文 | `src/config.ts` の `SITE_NAME` / `SITE_NAME_JA` / `SITE_TAGLINE` / `SITE_DESCRIPTION` |
| 本番URL | `src/config.ts` の `SITE_URL` |
| 公開／非公開の切替 | `src/config.ts` の `IS_PUBLIC` |
| 免責事項の文言 | `src/config.ts` の `DISCLAIMER` |
| グローバルナビの項目 | `src/config.ts` の `NAV` |
| 事業者情報（名称・代表者・住所・連絡先） | `src/config.ts` の `OPERATOR` |
| メール購読フォームの送信先 | `src/config.ts` の `SUBSCRIBE_ACTION` |
| 配色・書体・余白 | `src/styles/global.css` の `:root` |
| 本文の行間 | `src/styles/global.css` の `--prose-leading` |

---

## 5. コンテンツモデル

### reports（デイリーレポート）

ファイル名がそのままURLになる。`src/content/reports/2026-09-22.md` → `/reports/2026-09-22/`
アンダースコア始まりのファイル（`_TEMPLATE.md`）はビルドに含まれない。

| フィールド | 型 | 役割 |
|---|---|---|
| `no` | number | 号数。マストヘッドと記事冒頭の通し番号 |
| `title` | string | 見出し |
| `deck` | string | リード文。TOPのヒーローと一覧の抜粋に出る |
| `date` | string | 発行日 `YYYY-MM-DD` |
| `updated` | string? | 更新時刻の表示用 |
| `points` | string[] | 本日の要点。3〜5件。TOPのサイドバーと記事冒頭に `01..` と並ぶ |
| `snapshot` | Quote[] | マーケット数値。**最上部のティッカーにも同じ値が流れる** |
| `headline` | {value, dir}? | 一覧の右端に出す代表値（通常は XAU/USD の変化率） |
| `tags` | string[] | トピック索引に使う |
| `description` | string | SEO用。未記入なら `deck` が使われる |
| `keywords` | string[] | 予備 |
| `ogImage` | string? | 未指定なら `/og-default.png` |
| `draft` | boolean | `true` はビルドに含めない |
| `unlisted` | boolean | 一覧・サイトマップに出さず noindex。URLでは見られる |
| `access` | `public` \| `members` | クローズ化フェーズ用。現状は `public` のみ運用 |

`Quote` は `{ label, value, change, dir }`。`dir` は `up` / `down` / `flat` で数値の着色に使う。`value` と `change` は文字列（"4.118%" "−3.2bp" のように単位がまちまちで、計算せず表示するだけのため）。

### weekly（週次まとめ）

`src/content/weekly/2026-w38.md` → `/weekly/2026-w38/`

`week` / `year` / `start` / `end` を持つ。詳細ページは `start`〜`end` の期間に該当する日次レポートを自動で逆引きして並べる。

### 自動連携

- **TOPのティッカーとスナップショットは、常に最新号の `snapshot` を参照する。** 個別設定は不要
- **マストヘッドの日付と号数も最新号から取る**
- タグ一覧は全レポートから自動集計される

---

## 6. ページ構成

| URL | 内容 |
|---|---|
| `/` | 最新号のヒーロー、スナップショット、本日の要点、日次ログ6件、週次3件、購読、運営元 |
| `/reports/` | 全アーカイブ。月別に束ね、タグ索引を上部に置く |
| `/reports/<date>/` | レポート詳細。パンくず、要点、本文、前後の号、関連 |
| `/weekly/` | 週次まとめ一覧 |
| `/weekly/<slug>/` | 週次詳細。その週の日次レポートを逆引き表示 |
| `/topics/` | タグ索引 |
| `/topics/<slug>/` | タグ別一覧 |
| `/about/` | 編集方針・名前の由来・運営者情報（`#publisher`） |
| `/privacy/` | プライバシーポリシー |
| `/404` | 最新レポート3件への導線つき |
| `/robots.txt` | `IS_PUBLIC` により内容が変わる |
| `/rss.xml` | `IS_PUBLIC` が `false` なら404 |

### タグのURL

`XAU/USD` のようにスラッシュを含むタグをそのままルートパラメータに渡すとパスが分割されてビルドが落ちる。`lib/content.ts` の `tagSlug()` で区切り文字をハイフンに畳んでいる。日本語はそのまま残す（`/topics/地政学/`）。

---

## 7. デザイン仕様

案D（エディトリアルの構成 × 数値ボード × ミニマルな配色）を実装したもの。

### 配色トークン

全体の明るさを変えるときは `--bg` / `--surface` / `--ink` の3つを触れば他は追従する。

| トークン | ライト | ダーク | 用途 |
|---|---|---|---|
| `--bg` | `#f7f5f0` | `#100f0e` | 地。純白を避けた暖色オフホワイト |
| `--surface` | `#fdfcf9` | `#171614` | カード・ホバー面。地より明るく浮かせる |
| `--surface-2` | `#f1eee6` | `#1d1b18` | 沈めた面。購読パネル・免責 |
| `--ink` | `#1c1b18` | `#efece5` | 文字色 |
| `--ink-2` | `#1c1b18` | `#efece5` | 副文（現在は `--ink` と同値） |
| `--muted` | `#1c1b18` | `#efece5` | メタ情報（現在は `--ink` と同値） |
| `--placeholder` | `#8a877d` | `#7a776e` | 入力欄のプレースホルダのみ |
| `--line` / `--line-2` | `#e3dfd5` / `#cfcabd` | `#282520` / `#39352e` | 罫線 |
| `--accent` | `#2b4c8c` | `#93b0f0` | リンク・ラベル・矢印 |
| `--accent-ink` | `#ffffff` | `#10141f` | アクセント地に乗せる文字 |
| `--up` / `--down` | `#12734f` / `#b23a30` | `#44cb8d` / `#f07a70` | 変化率の符号 |

**設計上の決まりごと**

- 副文とメタ情報も本文と同じ濃さにしてある。薄いグレーは上質に見えるが読めない。**階層は色ではなくサイズ・字間・余白で付ける**
- 少しだけ差を戻したい場合は `--ink-2` と `--muted` を `#3a3833` 程度に上げる
- **緑と赤は変化率の符号に予約**している。他の用途に使うと読者が符号として誤読する。強調が必要な箇所はアクセント（紺）を使う

### 書体

| 用途 | スタック |
|---|---|
| 見出し（`--se`）／UI・数値（`--sa`） | `'Inter', 'Zen Kaku Gothic New', system-ui, sans-serif` |

明朝は格が出るが、日次で毎日読ませる媒体では可読性が落ちるためゴシックに統一した。和文ファミリーは共通で、差は字面ではなくウェイトと字間で付ける。

**Zen Kaku Gothic New は 600 を持たない。** 使えるのは 300 / 400 / 500 / 700 のみ。600 を指定すると和文だけブラウザが丸め、欧文（Inter）は 600 で描画されるため、同じ見出しで和欧の太さがずれる。**見出しは 700、一覧のタイトルは 500** を使う。

### 本文（`.prose`）

MSN のニュース面の実測値を基準にしている。

| 項目 | 値 | 備考 |
|---|---|---|
| フォントサイズ | 17px | MSN と同じ |
| 行間 | 1.8（`--prose-leading`） | MSN は 1.53。1段落が長い分析文では行を見失うため広げている |
| 本文色 | `--ink` | 副文色を使わない |
| 段落間 | 1.2em | |
| 折返し幅 | 68ch | |

### 資金フロー表示

`src/remark-flow.mjs` が、本文中の3種類の行をフロー表示に変換する。**執筆側の書式は変えない。** レポートは note にも流用するため、素の Markdown として読んでも意味が通る形を保つ必要がある。

| 書き方 | クラス | 見た目 |
|---|---|---|
| `資金　株・短期資金 → 米国債` | `.flow` | 実線ボーダー＋「資金」ラベル |
| `→ A → B → C。補足` | `.flow-causal` | 破線ボーダー。最初の句点以降は注記欄に落ちる |
| `**原油 → 米国債 → ハイテク株**`（段落全体が太字） | `.flow-primary` | ベタ塗りチップ。1本だけ強く |
| `→ 総括：…`（矢印1つ） | `.flow-lead` | チップ化せず細い縦罫のみ |

矢印を含まない行は変換しない（誤爆を避けるため）。

---

## 8. 公開制御

`IS_PUBLIC` が唯一のスイッチ。`false` のあいだは全ページ noindex、サイトマップと RSS も出力しない。

**本公開の手順（2つをセットで行う）**

1. `src/config.ts` の `IS_PUBLIC` を `true` にする
2. `public/_headers` の `X-Robots-Tag: noindex, nofollow` の行を削除する

片方だけだと、サイトマップを出しているのに noindex ヘッダが付いた状態になり、Search Console でエラーになる。

`robots.txt` と `_headers` の両方で止めているのは、robots.txt がクロールを止めるだけで、外部リンク経由のインデックス登録を防げないため。

---

## 9. SEO要件

**新規ページを作るときは、以下を満たすこと。** `Base.astro` に props を渡せば大半は自動で処理される。

### 必須

| 項目 | 実装 |
|---|---|
| `title` | `Base` の `title`。`「ページ名 \| TEITEN（定点）」` に自動整形される |
| `description` | `Base` の `description`。**80〜100字**を目安にする |
| canonical | 自動。`SITE_URL` + パス |
| H1 | **1ページ1個**。TOPのみサイト名がH1（`isHome`）、他はページ見出しがH1 |
| 見出し階層 | H1 → H2 → H3。スキップしない |
| パンくず | `Base` の `breadcrumbs` に `[{name, path}]` を渡す。ホームは自動で先頭に付く。画面側のパンくずも別途置く |
| 構造化データ | `WebSite` と `Organization` は全ページ自動。記事は `Base` の `schema` に `NewsArticle` を渡す |
| 日時 | `article:modified_time` と `dateModified` は **ISO8601（`+09:00` 付き）**。表示用の `updated` をそのまま渡さない。`lib/content.ts` の `isoJst()` で変換する |
| 恒久 noindex | 検索結果に出したくないページは `Base` に `noindex` を渡す（404 など）。`IS_PUBLIC` とは別系統 |
| 外部リンク | 本文（Markdown）は `rehype-external-links.mjs` が `target="_blank"` と `rel="noopener noreferrer"` を自動付与する。`.astro` に直接書いた外部リンクは対象外なので手で付ける |
| OG画像 | 未指定なら `/og-default.png`。記事固有なら `ogImage` |
| `lang` / charset | `Base` が `ja` / UTF-8 を出力 |

### description の文字数について

診断基準は120〜160字を推奨しているが、**日本語では80〜100字を採用している。** Google の検索結果は日本語で80〜90字程度で切られるため、120字以上書いても後半は表示されない。英語基準をそのまま適用していない点は意図的な逸脱。

### 構造化データの方針

`@graph` に束ねて1本の JSON-LD として出す。`@id` で相互参照させることで、ページをまたいで同じ `WebSite` / `Organization` を指していることを検索エンジンに伝える。

- 全ページ：`WebSite` + `Organization`
- 下層ページ：`BreadcrumbList`
- 記事：`NewsArticle`（`headline` / `datePublished` / `author` / `publisher` / `image` / `keywords` / `isAccessibleForFree`）

### 禁止事項

- **装飾目的で `<s>` を使わない。** 取り消し線の意味を持つ。区切り線は `<span class="rule">`
- **見出しレベルを飛ばさない。** 一覧を並べるページでは、`ReportRow`（h3）の前に必ず `.sec-head` の h2 を置く
- **`description` を使い回さない。** 未指定だと `SITE_DESCRIPTION` が入り、ページ間で重複する
- 画像を追加したら必ず `alt` を書く。装飾画像は `alt=""` と `aria-hidden="true"`
- 外部リンクに `target="_blank"` を付ける場合は `rel="noopener"` を併記する

### アクセシビリティ

- `prefers-reduced-motion` に対応済み（ティッカーの流れとカードの浮きが止まる）
- スキップリンクを `Base` に設置済み
- グリッド／フレックスの子要素には `min-width: 0` が必要（`global.css` のリセットで全要素に適用済み）

---

## 10. 運用

### レポートを追加する

1. `src/content/reports/_TEMPLATE.md` をコピーし、`YYYY-MM-DD.md` にリネーム
2. frontmatter を埋める。`snapshot` は6項目を目安に
3. 本文を `##` 見出しから書く（`#` はタイトルが使う）
4. `draft: false` にして push

### 遡って過去分を書く場合

**遡及作成であることを本文冒頭に明記する。** 「判断の過程を検証可能な形で記録する」を掲げる媒体で、後から書いたものを当日配信したように見せるのは編集方針に反する。

### OG画像を更新する

```bash
python tools/make-og.py
```

媒体名やタグラインを変えたら再実行する。

### 数値の扱い

- 出典が確認できない数値は載せない
- 取得できなかった指標は「未確認」と明記する。推測で埋めない
- 出典は素のURL列挙ではなくリンク付きリストで書く（note向けの書式をそのまま持ち込むと1段落に潰れる）

---

## 11. 未決事項

| 項目 | 状態 |
|---|---|
| カスタムドメインの接続 | **apex `teiten.trade` を正とする方針で確定。** 現状は `www.teiten.trade` のみが配信されており（200）、apex はDNS未解決。Pages に apex を追加し、www → apex の301を設定する必要がある |
| 本公開（`IS_PUBLIC`） | `false` のまま。ドメインが配信を始めてから切り替える |
| メール配信サービス | 未選定。`SUBSCRIBE_ACTION` が空でフォームは「準備中」表示 |
| アクセス解析 | 未導入。導入前にプライバシーポリシーの改定が必要 |
| 記事ごとのOG画像 | 全記事が共通画像。号数・日付入りの自動生成は将来課題 |
| 著者表記 | 現在は組織名のみ。YMYL領域のため個人名での著者表記を検討中 |
| note.com との使い分け | 未決 |
| クローズ化（会員制） | `access: members` をスキーマに確保済み。認証・決済は未着手 |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| 2026-09-22 | SEO再監査で残っていた不備を修正。`article:modified_time` に表示用文字列（"13:13 JST"）を流していたのを ISO8601 に変換（`isoJst()`）。タグ別ページの h1→h3 スキップを解消。404 を恒久 noindex に。TOP と 404 の description 重複を解消し、全ページを80字以上に。本文の外部リンクに `target="_blank" rel="noopener noreferrer"` を自動付与（`rehype-external-links.mjs`） |
| 2026-09-22 | SEO診断基準にもとづき全ページを修正。JSON-LD（WebSite / Organization / BreadcrumbList / NewsArticle）を追加、OG画像を生成、装飾用 `<s>` を `<span>` に変更、description を拡充、sitemap に lastmod を追加 |
| 2026-09-22 | プライバシーポリシーを実態に合わせて全面改訂。事業者情報・開示等の請求手続き・外国にある第三者への提供を追加。事業者情報を `config.ts` の `OPERATOR` に集約 |
| 2026-09-22 | 架空データのサンプル記事4本を削除 |
| 2026-09-22 | 独自ドメイン `teiten.trade` を取得し `SITE_URL` に設定 |
| 2026-09-22 | 9/21分を No.1 として追加。9/22分を No.2 に繰り下げ |
| 2026-09-22 | 薄いグレーと細字を廃止。副文・メタ情報も本文と同じ濃さにし、`font-weight: 300` を 400 に統一 |
| 2026-09-22 | 因果チェーンと総括の行もフロー表示に統一（`.flow-causal` / `.flow-primary` / `.flow-lead`） |
| 2026-09-22 | 「資金　A → B」の行をフロー表示に装飾（`remark-flow.mjs` を追加） |
| 2026-09-22 | 本文の可読性を MSN のニュース面の実測値に合わせて調整 |
| 2026-09-22 | 第1号（9/22分）を公開。書体を明朝からゴシック（Zen Kaku Gothic New）へ変更 |
| 2026-09-22 | 媒体名を TEITEN（定点）に変更 |
| 2026-09-22 | 初期構築。Astro 5 + Cloudflare Pages、reports / weekly の2コレクション |

---

## 本書の更新について

サイトの構造・設計判断・運用ルールを変えたら、本書も同じコミットで更新する。「更新履歴」には**何をしたか**だけでなく、**なぜそうしたか**が分かる粒度で書く。半年後に読み返して判断を再現できることが目的である。
