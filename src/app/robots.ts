import { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
  const host = getBaseUrl();
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `${host}/sitemap.xml`,
  };
}
