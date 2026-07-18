import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/settings', '/api/'],
    },
    sitemap: 'https://www.sasknewsfeed.com/sitemap.xml',
  };
}