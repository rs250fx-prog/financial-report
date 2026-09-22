/**
 * サイト全体の設定。ここだけを書き換えれば全ページに反映される。
 */

/**
 * 本公開フラグ。
 * false のあいだは全ページ noindex、サイトマップ・RSS も出力しない。
 *
 * 2026-09-22 に true へ切り替え（本公開）。
 * これに合わせて public/_headers の X-Robots-Tag も削除済み。
 * 片方だけ戻すとサイトマップと noindex が矛盾するので、
 * 非公開へ戻す場合は必ず両方を戻すこと。
 */
export const IS_PUBLIC = true;

/**
 * 正規URL（末尾スラッシュなし）。canonical・OG画像・サイトマップ・
 * RSS がすべてここを基準にするため、実在するホストを入れること。
 *
 * Cloudflare Pages の既定ホストは financial-report-bad.pages.dev。
 * （pages.dev のサブドメインは全アカウント共通の名前空間で、
 *   financial-report は取得済みだったため -bad が自動付与された。
 *   プロジェクト名自体は financial-report）
 * 独自ドメイン接続済みのため、apex を正規とする。
 */
export const SITE_URL = 'https://teiten.trade';

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

/**
 * 事業者情報。個人情報保護法32条1項により、個人情報取扱事業者の
 * 名称・住所・代表者名は本人が知り得る状態に置く必要がある。
 * プライバシーポリシーと運営者情報の両方がここを参照する。
 */
export const OPERATOR = {
  name: 'Financial and Marketing M16',
  representative: '村瀬 一郎',
  address: '〒107-0062 東京都港区南青山3丁目1-36 青山丸竹ビル',
  /** 問い合わせ導線。本サイトにフォームは持たず、fam16.com に集約する */
  contactUrl: 'https://fam16.com/contact/',
} as const;

/**
 * Google Analytics 4 の測定ID（例: 'G-XXXXXXXXXX'）。
 *
 * 空のあいだは計測タグを一切出力しない。プライバシーポリシーの
 * GA4 に関する記述もこの値に連動するため、ID を入れれば
 * 計測と告知が同時に有効になり、外せば同時に消える。
 * 実態と記述が食い違わないようにするための作りである。
 *
 * GA4 は Cookie を使い、データは Google LLC（米国）へ送信される。
 * 有効にする前に、プライバシーポリシーの記述が意図どおりか確認すること。
 */
export const GA4_MEASUREMENT_ID = '';

/** プライバシーポリシーの最終改定日。改定したら必ず更新する */
export const PRIVACY_UPDATED = '2026年9月22日';

/**
 * 更新頻度（マストヘッド右上などに表示）。
 * メール配信を開始するまでは「配信」とせず、サイトの更新頻度として書く。
 */
export const CADENCE = '平日更新';

/**
 * 免責事項。金融商品取引法上、投資助言・代理業の登録なしに
 * 個別の売買推奨はできないため、全ページのフッターに固定で表示する。
 * 文言を変える場合はここだけを編集すること。
 */
export const DISCLAIMER =
  '本サイトは相場に関する情報提供および分析を目的としたものであり、特定の金融商品の売買を推奨するものではありません。当方は金融商品取引業者ではなく、投資助言・代理業の登録を受けていません。掲載情報の正確性について万全を期していますが、その完全性を保証するものではありません。投資に関する最終的な判断は、ご自身の責任において行ってください。';

/**
 * メール購読の導線を表示するか。
 *
 * 配信できる事業フェーズに入るまでは false にして、購読に関する
 * 導線を一切出さない。配信できないのに「購読する」を見せるのは、
 * 読者に対して不誠実であるだけでなく、押しても何も起きない
 * 導線を置くことでサイト全体の信頼を落とす。
 *
 * true にするときは SUBSCRIBE_ACTION を先に埋めること。両方が
 * 揃わないとフォームは「準備中」表示になる。
 */
export const SUBSCRIBE_ENABLED = false;

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
