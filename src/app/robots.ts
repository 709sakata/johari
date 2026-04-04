import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://johari.app';
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `${host}/sitemap.xml`,
  };
}
