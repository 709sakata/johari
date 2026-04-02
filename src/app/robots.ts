import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://johari.app';
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/analytics', '/mypage', '/new-scrap'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
