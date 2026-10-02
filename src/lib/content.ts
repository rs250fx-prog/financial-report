import { getCollection, type CollectionEntry } from 'astro:content';

export type Report = CollectionEntry<'reports'>;
export type Weekly = CollectionEntry<'weekly'>;

const isVisible = (data: { draft: boolean; unlisted: boolean }) =>
  !data.draft && !data.unlisted;

/** 新しい順。日付が同じなら号数の大きい方を先に */
const byDateDesc = (a: Report, b: Report) =>
  b.data.date.localeCompare(a.data.date) || b.data.no - a.data.no;

/** 一覧・TOPに出すデイリーレポート（draft / unlisted を除外） */
export async function listReports(): Promise<Report[]> {
  const all = await getCollection('reports', ({ data }) => isVisible(data));
  return all.sort(byDateDesc);
}

/** 個別ページを生成する対象（unlisted も含む。draft のみ除外） */
export async function allReports(): Promise<Report[]> {
  const all = await getCollection('reports', ({ data }) => !data.draft);
  return all.sort(byDateDesc);
}

/** 週次まとめ。新しい週から */
export async function listWeekly(): Promise<Weekly[]> {
  const all = await getCollection('weekly', ({ data }) => isVisible(data));
  return all.sort(
    (a, b) => b.data.year - a.data.year || b.data.week - a.data.week,
  );
}

export async function allWeekly(): Promise<Weekly[]> {
  const all = await getCollection('weekly', ({ data }) => !data.draft);
  return all.sort(
    (a, b) => b.data.year - a.data.year || b.data.week - a.data.week,
  );
}

/** 'YYYY-MM-DD' → '2026.09.22' */
export const dotted = (iso: string) => iso.replaceAll('-', '.');

/** 'YYYY-MM-DD' → '2026年9月22日（月）' */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = '日月火水木金土'[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日（${wd}）`;
}

/** 'YYYY-MM-DD' → '月' */
export function weekdayJa(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return '日月火水木金土'[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 'YYYY-MM-DD' → '09.15'（週次の期間表示用） */
export const monthDay = (iso: string) => iso.slice(5).replace('-', '.');

/**
 * タグをURLに使える形にする。
 * 'XAU/USD' のようにスラッシュを含むタグをそのまま
 * ルートパラメータに渡すとパスが分割されてビルドが落ちるため、
 * 区切り文字をハイフンに畳む。日本語はそのまま残す。
 */
export const tagSlug = (tag: string) =>
  tag
    .trim()
    .toLowerCase()
    .replace(/[\/\\\s]+/g, '-')
    .replace(/[?#%&]/g, '');

/** 全レポート横断のタグ集計。多い順 */
export async function tagCounts(): Promise<
  { tag: string; slug: string; count: number }[]
> {
  const reports = await listReports();
  const map = new Map<string, number>();
  for (const r of reports) {
    for (const t of r.data.tags) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, slug: tagSlug(tag), count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * 関連する号。タグの重なりで選ぶ。
 *
 * 「XAU/USD」「資金フロー」のように全号に付くタグは区別に効かないため、
 * 付いている号が少ないタグほど重く数える。同点なら日付の近い号を先にする。
 */
export function relatedReports(entry: Report, all: Report[], n = 3): Report[] {
  const df = new Map<string, number>();
  for (const r of all) {
    for (const t of r.data.tags) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const mine = new Set(entry.data.tags);
  const day = (iso: string) => Date.parse(iso) / 86_400_000;
  return all
    .filter((r) => r.id !== entry.id)
    .map((r) => ({
      r,
      score: r.data.tags.reduce(
        (s, t) => (mine.has(t) ? s + 1 / (df.get(t) ?? 1) : s),
        0,
      ),
      gap: Math.abs(day(r.data.date) - day(entry.data.date)),
    }))
    .sort((a, b) => b.score - a.score || a.gap - b.gap)
    .slice(0, n)
    .map((x) => x.r);
}

/**
 * 見出しの先頭にある日付（"2026/10/01（木）｜"）を落とす。
 * 日付を別に表示している狭い一覧で、同じ情報を二度出さないため。
 */
export const shortTitle = (title: string) =>
  title.replace(/^\d{4}\/\d{1,2}\/\d{1,2}（.）\s*[｜|]\s*/, '');

/**
 * 表示用の updated（"13:13 JST" や "2026-09-22 15:12 JST（遡及作成）"）から
 * ISO8601（JST）を組み立てる。
 *
 * article:modified_time や schema.org の dateModified は機械可読の
 * 日時を要求する。表示文字列をそのまま流すとパーサーが解釈できない。
 * 時刻が読み取れない場合は undefined を返し、meta ごと出力しない。
 * 誤ったフォーマットを出すより、出さないほうがよい。
 */
export function isoJst(date: string, updated?: string): string | undefined {
  if (!updated) return undefined;
  // "2026-09-22 15:12" のように日付を含む場合はそちらを優先する
  const full = updated.match(/(\d{4}-\d{2}-\d{2})\D+(\d{1,2}):(\d{2})/);
  if (full) {
    return `${full[1]}T${full[2].padStart(2, '0')}:${full[3]}:00+09:00`;
  }
  const time = updated.match(/(\d{1,2}):(\d{2})/);
  if (time) {
    return `${date}T${time[1].padStart(2, '0')}:${time[2]}:00+09:00`;
  }
  return undefined;
}
