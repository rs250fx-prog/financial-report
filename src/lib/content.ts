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
