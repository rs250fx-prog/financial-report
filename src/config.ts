/**
 * サイト全体の設定。ここだけを書き換えれば全ページに反映される。
 */

/**
 * 本公開フラグ。
 * false のあいだは全ページ noindex、サイトマップ・RSS も出力しない。
 * 独自ドメイン接続と初期コンテンツが揃ってから true にする。
 */
export const IS_PUBLIC = false;

/**
 * 正規URL（末尾スラッシュなし）。canonical・OG画像・サイトマップ・
 * RSS がすべてここを基準にするため、実在するホストを入れること。
 *
 * 現在は Cloudflare Pages の既定ホスト。プロジェクト名 financial-report は
 * 他アカウントに取られていたため、Cloudflare が -bad を自動付与している。
 * 独自ドメインを取得したらここを差し替える。
 * 例: 'https://teiten.jp'
 */
export const SITE_URL = 'https://financial-report-bad.pages.dev';

/**
 * 媒体名。表記はローマ字を正とし、漢字は補助に使う。
 * SITE_NAME_JA は日本語検索で拾われるよう <title> と説明文に添える。
 */
export const SITE_NAME = 'TEITEN';
export const SITE_NAME_JA = '定点';
export const SITE_TAGLINE = '資金の流れで読む、今日の市場';
export const SITE_DESCRIPTION =
  '実質金利・ドル指数・コモディティ・資金フローから、その日の市場を読み解くデイリーレポート。同じ指標を、同じ形式で、毎営業日。';

/** 発行元 */
export const PUBLISHER = 'Financial and Marketing M16';
export const PUBLISHER_URL = 'https://fam16.com/';

/** 配信の建てつけ（マストヘッド右上などに表示） */
export const CADENCE = '週5回 / 平日朝配信';

/**
 * 免責事項。金融商品取引法上、投資助言・代理業の登録なしに
 * 個別の売買推奨はできないため、全ページのフッターに固定で表示する。
 * 文言を変える場合はここだけを編集すること。
 */
export const DISCLAIMER =
  '本サイトは相場に関する情報提供および分析を目的としたものであり、特定の金融商品の売買を推奨するものではありません。当方は金融商品取引業者ではなく、投資助言・代理業の登録を受けていません。掲載情報の正確性について万全を期していますが、その完全性を保証するものではありません。投資に関する最終的な判断は、ご自身の責任において行ってください。';

/**
 * メール購読フォームの送信先。
 * 配信サービス（Buttondown / Resend / ConvertKit など）を決めたら
 * その form action URL を入れる。空のあいだはフォームを送信不可にし、
 * 「準備中」と表示する。
 *
 * 読者リストは、クローズ化フェーズに持ち越せる唯一の資産なので、
 * 公開初日からここを埋めておくのが望ましい。
 */
export const SUBSCRIBE_ACTION = '';

/** グローバルナビ */
export const NAV = [
  { href: '/reports/', label: 'デイリーレポート' },
  { href: '/weekly/', label: '週次まとめ' },
  { href: '/topics/', label: 'トピック' },
  { href: '/about/', label: 'このメディアについて' },
] as const;
