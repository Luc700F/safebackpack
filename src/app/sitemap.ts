import type { MetadataRoute } from 'next';

/**
 * The pages worth indexing.
 *
 * Individual reports are deliberately absent: they last weeks, and a search
 * result pointing at a warning that has already been retired is worse than no
 * result at all.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://safebackpack.app';

  const pages: { path: string; priority: number; changeFrequency: 'daily' | 'monthly' | 'yearly' }[] = [
    { path: '', priority: 1, changeFrequency: 'daily' },
    { path: '/report', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/statistics', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/imprint', priority: 0.2, changeFrequency: 'yearly' },
    { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
  ];

  return pages.map((page) => ({
    url: `${site}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
