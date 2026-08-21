import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

/**
 * The admin path is deliberately absent. Listing it — even as a Disallow —
 * would publish the secret, and the routes already return 404 to anyone
 * without an admin session.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account/', '/api/', '/auth/'],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
