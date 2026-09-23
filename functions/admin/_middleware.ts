/**
 * /admin 配下を Cloudflare Access で保護する。
 *
 * Access をダッシュボードで設定すれば前段で止まるが、`*.pages.dev` へ
 * 直接叩かれる経路が残る。この API はリポジトリへ push できる＝媒体の
 * 編集権限そのものなので、**Function 側でも JWT を検証する。**
 *
 * ヘッダの有無だけを見る実装にしない。ヘッダは呼び出し側が自由に付けられる。
 * Cloudflare の公開鍵で署名を検証し、aud と exp まで確認する。
 *
 * 設定が無ければ誰も通さない（fail closed）。Access を設定するまで
 * 管理画面は開かないが、それが正しい初期状態である。
 *
 * 必要な環境変数（Cloudflare Pages の設定画面で登録する）
 *   CF_ACCESS_TEAM_DOMAIN … 例 example.cloudflareaccess.com
 *   CF_ACCESS_AUD         … Access アプリケーションの Audience タグ
 */

interface Env {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

/** base64url → Uint8Array */
function b64uToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    s.length + ((4 - (s.length % 4)) % 4), '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64uToJson(s: string): any {
  return JSON.parse(new TextDecoder().decode(b64uToBytes(s)));
}

/** 公開鍵は毎回取りに行かず、同一インスタンス内で使い回す */
let cachedKeys: { at: number; keys: any[] } | null = null;

async function fetchKeys(teamDomain: string): Promise<any[]> {
  const now = Date.now();
  if (cachedKeys && now - cachedKeys.at < 60 * 60 * 1000) return cachedKeys.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const body: any = await res.json();
  const keys = body.keys ?? [];
  cachedKeys = { at: now, keys };
  return keys;
}

async function verify(token: string, teamDomain: string, aud: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('形式が不正');

  const header = b64uToJson(parts[0]);
  if (header.alg !== 'RS256') throw new Error('alg が RS256 でない');

  const jwk = (await fetchKeys(teamDomain)).find((k: any) => k.kid === header.kid);
  if (!jwk) throw new Error('鍵が見つからない');

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64uToBytes(parts[2]), signed);
  if (!ok) throw new Error('署名が不正');

  const payload = b64uToJson(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('期限切れ');
  if (payload.nbf && payload.nbf > now + 60) throw new Error('有効化前');

  const auds: string[] = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error('aud が一致しない');

  return payload;
}

const deny = (why: string) =>
  new Response(
    `管理画面は Cloudflare Access で保護されています。\n\n理由: ${why}\n`,
    { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD } = ctx.env;

  // 設定が無ければ通さない。Access を入れ忘れたまま公開されるより良い
  if (!CF_ACCESS_TEAM_DOMAIN || !CF_ACCESS_AUD) {
    return deny('CF_ACCESS_TEAM_DOMAIN と CF_ACCESS_AUD が未設定です');
  }

  const token =
    ctx.request.headers.get('Cf-Access-Jwt-Assertion') ??
    /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(
      ctx.request.headers.get('Cookie') ?? '')?.[1];

  if (!token) return deny('Access のトークンがありません');

  try {
    await verify(token, CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD);
  } catch (e: any) {
    return deny(`トークンを検証できません（${e.message}）`);
  }

  return ctx.next();
};
