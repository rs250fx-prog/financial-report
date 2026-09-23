import { Env, gh, fromB64, toItem, json, BRANCH } from '../_lib';

/**
 * 記事の一覧を返す。GitHub 上の実体を読むので、ローカルのクローンは不要。
 *
 * ディレクトリ一覧では本文が取れないため1件ずつ取りに行く。件数が増えた
 * ときのために新しい順で上限を設けてある。
 */
const LIMIT = 40;

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const dirs = [
      { dir: 'src/content/reports', kind: 'daily' as const },
      { dir: 'src/content/weekly', kind: 'weekly' as const },
    ];

    const paths: string[] = [];
    for (const { dir } of dirs) {
      let entries: any[] = [];
      try {
        entries = await gh(ctx.env, `/contents/${dir}?ref=${BRANCH}`);
      } catch {
        continue; // ディレクトリが無い場合は飛ばす
      }
      paths.push(
        ...entries
          .filter((e: any) => e.type === 'file' && e.name.endsWith('.md')
            && !e.name.startsWith('_'))
          .map((e: any) => e.path),
      );
    }

    paths.sort().reverse();
    const targets = paths.slice(0, LIMIT);

    const items = await Promise.all(
      targets.map(async (p) => {
        const f = await gh(ctx.env, `/contents/${p}?ref=${BRANCH}`);
        return toItem(p, fromB64(f.content));
      }),
    );

    items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return json({ ok: true, items, truncated: paths.length > LIMIT });
  } catch (e: any) {
    return json({ ok: false, message: e.message }, 500);
  }
};
