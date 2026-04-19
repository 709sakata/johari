import { MetadataRoute } from 'next';
import { getServerBaseUrl } from '@/lib/server-utils';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = await getServerBaseUrl();
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `${host}/sitemap.xml`,
  };
}
