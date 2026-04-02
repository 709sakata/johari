import { MetadataRoute } from 'next';
import { db, collection, getDocs, query, orderBy, limit } from '../firebase';
import { Scrap } from '../types';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://johari.app';
  
  // 1. Static routes
  const staticRoutes = [
    '',
    '/analytics',
    '/mypage',
    '/new-scrap',
  ].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  // 2. Dynamic scrap routes
  let scrapRoutes: MetadataRoute.Sitemap = [];
  try {
    const q = query(
      collection(db, 'scraps'),
      orderBy('updatedAt', 'desc'),
      limit(100) // Limit to top 100 for sitemap performance
    );
    const snapshot = await getDocs(q);
    scrapRoutes = snapshot.docs.map(doc => {
      const data = doc.data() as Scrap;
      return {
        url: `${baseUrl}/scraps/${doc.id}`,
        lastModified: data.updatedAt?.toDate() || new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      };
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);
  }

  return [...staticRoutes, ...scrapRoutes];
}
