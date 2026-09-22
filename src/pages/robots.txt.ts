import type { APIRoute } from 'astro';
import { IS_PUBLIC, SITE_URL } from '../config';

export const GET: APIRoute = () => {
  const body = IS_PUBLIC
    ? `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap-index.xml
`
    : `User-agent: *
Disallow: /
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
