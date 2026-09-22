import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { IS_PUBLIC, SITE_NAME, SITE_DESCRIPTION, SITE_URL } from '../config';
import { listReports, listWeekly } from '../lib/content';

export const GET: APIRoute = async () => {
  // 本公開前は配信しない
  if (!IS_PUBLIC) return new Response('Not Found', { status: 404 });

  const reports = await listReports();
  const weekly = await listWeekly();

  const items = [
    ...reports.map((e) => ({
      title: `No.${e.data.no} ${e.data.title}`,
      description: e.data.description || e.data.deck,
      pubDate: new Date(e.data.date),
      link: `/reports/${e.id}/`,
      categories: e.data.tags,
    })),
    ...weekly.map((e) => ({
      title: `[週次] ${e.data.title}`,
      description: e.data.description || e.data.deck,
      pubDate: new Date(e.data.date ?? e.data.end),
      link: `/weekly/${e.id}/`,
      categories: e.data.tags,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site: SITE_URL,
    items,
    customData: '<language>ja</language>',
  });
};
