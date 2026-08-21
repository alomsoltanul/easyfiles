import type { MetadataRoute } from 'next';
import { DEPARTMENT_LIST, TOOLS } from '@/lib/tools';
import { getSiteUrl } from '@/lib/site';

/**
 * Home, the four department pages, every tool and the pricing page.
 *
 * Paid tools belong here: their pages still render the full description and
 * info cards for a visitor who has not subscribed, so there is real content to
 * index behind every one of these URLs.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...DEPARTMENT_LIST.map((dept) => ({
      url: `${base}${dept.href}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    ...TOOLS.map((tool) => ({
      url: `${base}${tool.href}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: tool.badge === 'Popular' ? 0.9 : 0.7,
    })),
  ];
}
