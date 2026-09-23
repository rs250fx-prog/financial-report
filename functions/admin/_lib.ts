/**
 * 管理APIの共通処理。
 *
 * Worker 上では Python が動かないため、`tools/check-report.py` をそのまま
 * 呼べない。**公開の可否を左右する検査だけ**をここに移植してある。
 * 権威ある検査は引き続き check-report.py であり、定期実行は push 前に
 * そちらを通している。ここは「壊れた下書きを公開させない」最後の砦。
 */

export interface Env {
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string; // 例 rs250fx-prog/financial-report
}

export const REPO_DEFAULT = 'rs250fx-prog/financial-report';
export const BRANCH = 'main';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/** GitHub API。トークンは Worker 側にのみ存在し、ブラウザへは出さない */
export async function gh(env: Env, path: string, init: RequestInit = {}) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN が未設定です');
  const repo = env.GITHUB_REPO || REPO_DEFAULT;
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'teiten-admin',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json() as Promise<any>;
}

/** UTF-8 を安全に base64 へ（btoa は多バイト文字で壊れる） */
export function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromB64(s: string): string {
  const bin = atob(s.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function frontmatter(text: string): string {
  const parts = text.split('---');
  return parts.length > 2 ? parts[1] : '';
}

export function body(text: string): string {
  return text.split('---').slice(2).join('---');
}

export function field(fm: string, key: string): string {
  const m = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(fm);
  return m ? m[1].trim().replace(/^"|"$/g, '') : '';
}

const DAILY_SECTIONS = [
  '## Macro Theme', '## Market Drivers', '## 金利（起点）', '## ドル',
  '## 商品', '## 株', '## Crypto', '## Volatility', '## 今日の資金フロー',
  '## マーケットポジション', '## Next Flow', '## Market Bias',
];
const WEEKLY_SECTIONS = [
  '## 週の核心テーマ', '## 今週の主要イベント振り返り',
  '## 今週の資金フロー構造', '## 来週の備え',
];

/**
 * 公開してよいかを判定する。errors が空なら公開できる。
 * check-report.py のうち、公開の可否に直結する項目だけを見る。
 */
export function validate(text: string, kind: 'daily' | 'weekly'): string[] {
  const fm = frontmatter(text);
  const bd = body(text);
  const errors: string[] = [];

  for (const k of ['title', 'deck']) {
    if (!field(fm, k)) errors.push(`${k} が空です`);
  }
  const desc = field(fm, 'description');
  if (!desc) errors.push('description が空です');
  else if (desc.length < 80) errors.push(`description が${desc.length}字です（80字以上）`);

  for (const sec of kind === 'daily' ? DAILY_SECTIONS : WEEKLY_SECTIONS) {
    if (!bd.includes(sec)) errors.push(`節がありません: ${sec.replace(/^#+ /, '')}`);
  }

  // 雛形の埋め忘れ
  if (bd.includes('- []()')) errors.push('情報元のリンクが未記入です');
  if (/^\s*###\s*[①②③]\s*$/m.test(bd)) errors.push('見出しが未記入です');
  if (/^資金\s+→\s*$/m.test(bd)) errors.push('資金フローの行が未記入です');
  if (/^\s*https?:\/\/\S+\s*$/m.test(bd)) errors.push('素のURLがあります（リンク付きリストにする）');

  if (kind === 'daily') {
    const snaps = [...fm.matchAll(
      /\{\s*label:\s*"([^"]*)",\s*value:\s*"([^"]*)",\s*change:\s*"([^"]*)"/g)];
    if (snaps.length < 4) errors.push(`snapshot が${snaps.length}件です`);
    for (const m of snaps) {
      if (!m[2] || !m[3]) errors.push(`snapshot「${m[1]}」の value/change が空です`);
    }
    const hl = /headline:\s*\{\s*value:\s*"([^"]*)"/.exec(fm);
    if (!hl?.[1]) errors.push('headline の value が空です');
    const pts = [...fm.slice(fm.indexOf('points:'), fm.indexOf('snapshot:'))
      .matchAll(/^\s*-\s*"(.*)"\s*$/gm)];
    if (pts.length < 3) errors.push(`points が${pts.length}件です（3件以上）`);
    if (pts.some((m) => !m[1].trim())) errors.push('points に空の項目があります');
  } else {
    const perf = [...fm.matchAll(
      /\{\s*label:\s*"([^"]*)",\s*value:\s*"([^"]*)"/g)];
    if (perf.length < 5) errors.push(`performance が${perf.length}件です`);
    if (!field(fm, 'bias')) errors.push('bias が空です');
    const kinds = [...fm.matchAll(/\{\s*kind:\s*(bull|base|bear),\s*trigger:\s*"([^"]*)"/g)];
    if (kinds.length < 3) errors.push('scenarios が3案そろっていません');
    if (kinds.some((m) => !m[2])) errors.push('scenarios の trigger が空です');
  }

  const lv = [...fm.matchAll(/\{\s*kind:\s*(resistance|current|support),\s*value:\s*"([^"]*)"/g)];
  if (lv.length && lv.every((m) => !m[2])) errors.push('levels の value が全て空です');

  return errors;
}

export interface Item {
  kind: 'daily' | 'weekly';
  slug: string;
  path: string;
  no: string;
  date: string;
  title: string;
  draft: boolean;
  url: string;
  errors: string[];
}

export function toItem(path: string, text: string): Item {
  const kind: 'daily' | 'weekly' = path.includes('/weekly/') ? 'weekly' : 'daily';
  const fm = frontmatter(text);
  const slug = path.split('/').pop()!.replace(/\.md$/, '');
  return {
    kind,
    slug,
    path,
    no: field(fm, 'no') || `W${field(fm, 'week')}`,
    date: field(fm, 'date') || field(fm, 'end'),
    title: field(fm, 'title'),
    draft: field(fm, 'draft') === 'true',
    url: `https://teiten.trade/${kind === 'daily' ? 'reports' : 'weekly'}/${slug}/`,
    errors: validate(text, kind),
  };
}
