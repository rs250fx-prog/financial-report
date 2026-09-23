import { Env, gh, fromB64, toB64, validate, frontmatter, field, json, BRANCH } from '../_lib';

/**
 * draft を切り替えてコミットする。Cloudflare Pages が自動で再デプロイする。
 *
 * **公開side（draft: false）は検査を通らないと実行しない。**
 * 下書きへ戻す側は常に許可する（取り下げを妨げない）。
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { path, publish } = await ctx.request.json<any>();

    if (typeof path !== 'string'
      || !path.startsWith('src/content/')
      || !path.endsWith('.md')
      || path.includes('..')) {
      return json({ ok: false, message: '不正なパスです' }, 400);
    }

    const file = await gh(ctx.env, `/contents/${path}?ref=${BRANCH}`);
    const text = fromB64(file.content);
    const kind = path.includes('/weekly/') ? 'weekly' : 'daily';

    if (publish) {
      const errors = validate(text, kind);
      if (errors.length) {
        return json({ ok: false, message: '検査に通らないため公開しません', errors }, 422);
      }
    }

    const next = text.replace(/^draft:\s*\w+.*$/m, `draft: ${publish ? 'false' : 'true'}`);
    if (next === text) {
      return json({ ok: false, message: 'draft の行が見つかりません' }, 422);
    }

    const slug = path.split('/').pop()!.replace(/\.md$/, '');
    const no = field(frontmatter(text), 'no');
    const label = no ? `No.${no}（${slug}）` : slug;

    await gh(ctx.env, `/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `${label} を${publish ? '公開' : '下書きに戻す'}\n\n管理画面から操作。`,
        content: toB64(next),
        sha: file.sha,
        branch: BRANCH,
      }),
    });

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, message: e.message }, 500);
  }
};
