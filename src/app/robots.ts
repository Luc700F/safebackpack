import type { MetadataRoute } from 'next';

/**
 * What crawlers may look at.
 *
 * The map and the text pages are meant to be found. The API is not — it is for
 * this site and, later, the app; a crawler walking it produces load and no
 * benefit. Confirmation links carry a one-time token and must never be
 * followed by a machine, and the moderation queue is for one person.
 */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://safebackpack.app';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/verify', '/admin'],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
