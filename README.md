# TEITEN（定点）

金融系デイリーレポートの配信メディア。Astro + Cloudflare Pages。<br>媒体名の表記はローマ字 `TEITEN` を正とし、漢字 `定点` を補助に使う。
運営元: [Financial and Marketing M16](https://fam16.com/)

## 仕様書

構造・設計判断・運用ルールは [`docs/SPEC.md`](docs/SPEC.md) にまとめてある。
拡張や修正の前にそちらを読むこと。新規ページのSEO要件も同書の第9章にある。

定期実行に登録しているプロンプトの原本は [`docs/ROUTINES.md`](docs/ROUTINES.md)。
**ルーティン側を直したら、こちらも同じコミットで直す。**

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
| Project name | `financial-report` |
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

## ドメイン

本番ドメインは `teiten.trade`（接続済み）。apex を正とし、www は 301 で apex へ送る。

既定ホスト `financial-report-bad.pages.dev` も並行して生き続ける。canonical は
`SITE_URL` が指すドメインに固定されるので通常はそれで足りるが、**canonical の
指す先が実際に応答することを確認してから公開すること。**apex が未接続のまま
canonical だけ apex を指していた時期がある。

## 公開制御

`src/config.ts` の `IS_PUBLIC` が唯一のスイッチ。**現在は `true`（本公開済み）。**
`false` に戻すと全ページ noindex になり、サイトマップと RSS も出力しなくなる。

記事単位では frontmatter の `draft` と `unlisted` で制御する。

| | 効果 |
|---|---|
| `draft: true` | ビルドに含まれない。**定期実行はこの状態で push する** |
| `unlisted: true` | 一覧・サイトマップに出さず noindex。URL では見られる |

再び全体を閉じる場合は、`IS_PUBLIC` に加えて `public/_headers` の
`X-Robots-Tag` を戻す。robots.txt だけではクロールを止めるにとどまり、
外部リンク経由のインデックス登録を防げない。

## 運用フロー

執筆は自動、公開は人手。**検査スクリプトは形式しか見ない**ため、もっともらしい
誤った数字は検査も人間のざっと見も通り抜ける。だから公開を人手に残している。

```
定期実行（クラウド） → draft: true で push → /admin で内容を確認 → 公開
```

| | 時刻 | 対象 |
|---|---|---|
| 日次 | 平日 8:30 JST | 前営業日の米国セッション |
| 週次 | 土曜 9:00 JST | 月〜金。金曜分のみ自前で調査 |

**金曜の米国セッションを扱う日次は翌週の月曜まで存在しない**（D日の記事が
D-1日を扱う規約のため）。土曜の週次はその一日分を自分で調べる。

出す日かどうかは `tools/should-run.py` が判定する。プロンプト側で祝日を
判断させない。言葉で書いた規則は実行のたびに解釈が揺れる。

| 状況 | 扱い |
|---|---|
| 日本だけの祝日 | **出す**。米国市場は動いている |
| 直前の平日が米国休場 | **出さない**。扱う新しいセッションが無い |
| 12/29〜1/3 | 出さない。1/4 から再開 |

## 管理画面

`/admin`。スマホから公開・下書き戻しができる。ローカルのクローンもPCの起動も要らない。

Cloudflare Access で保護し、Pages Functions（`functions/admin/`）から GitHub API で
`draft` を切り替える。**`*.pages.dev` への直接アクセスに備え、Function 側でも
JWT を署名まで検証している。**環境変数が未設定なら誰も通さない（fail closed）。

必要な環境変数は Cloudflare Pages に登録する。**追加しただけでは既存のデプロイに
反映されないので、再デプロイすること。**

| 変数 | 内容 |
|---|---|
| `CF_ACCESS_TEAM_DOMAIN` | `〇〇.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Access アプリケーションの Audience タグ |
| `GITHUB_TOKEN` | fine-grained PAT。**このリポジトリの `contents: write` だけ** |
| `GITHUB_REPO` | `rs250fx-prog/financial-report` |

ローカルで作業するときは `python tools/admin.py` のほうが速い。
あちらは `check-report.py` をそのまま回せる。

## ツール

```bash
python tools/should-run.py            # 出す日か（終了コード 10 = 休止）
python tools/new-report.py            # 日次の雛形。号数は自動採番
python tools/new-weekly.py            # 週次の雛形。週番号と期間を自動計算
python tools/check-report.py          # 日次・週次の検査。エラーがあれば終了コード 1
python tools/admin.py                 # ローカルの公開管理（127.0.0.1:4399）
node  tools/check-html.mjs            # 出力HTMLに可視アスタリスクが無いか
```

`check-html.mjs` は `postbuild` に繋いである。**警告のみでビルドは止めない**
（公開が最優先）。`--strict` で終了コード1。

記事の書き方は `.claude/skills/teiten-report/SKILL.md` に全て書いてある。

## メール購読

`src/config.ts` の `SUBSCRIBE_ACTION` に配信サービスの form action URL を入れると、
購読フォームが有効になる。空のあいだは「準備中」表示で送信不可。

## 設定の集約先

サイト名・タグライン・免責事項・ナビ項目は、すべて `src/config.ts` にある。
配色は `src/styles/global.css` の `:root`（`--bg` / `--surface` / `--ink` の
3つを触れば全体が追従する）。

## 注意

- **数値を創作しない。**確認できない指標は「未確認」と書く。検査スクリプトは
  形式しか見ないので、もっともらしい誤った数字は素通りする
- **個別の売買推奨を書かない。**投資助言・代理業の登録がないため、情報提供と
  分析にとどめる。免責は全ページに固定で出る
- **`git add -A` を使わない。**同じリポジトリを並行して触ることがあるため、
  作成したファイルを明示して add する
- `src/pages/privacy.astro` は実態（Cloudflare Web Analytics + GA4）に合わせて
  改訂済み。**計測の構成を変えたら、この文面も同じコミットで直すこと**
