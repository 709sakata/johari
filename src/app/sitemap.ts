import { MetadataRoute } from 'next';
import { db, collection, getDocs, query, orderBy } from '../firebase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://johari.app';

  // Fetch all scraps to include in sitemap
  let scrapUrls: any[] = [];
  try {
    const scrapsQuery = query(collection(db, 'scraps'), orderBy('updatedAt', 'desc'));
    const scrapsSnapshot = await getDocs(scrapsQuery);
    
    scrapUrls = scrapsSnapshot.docs.map((doc) => ({
      url: `${host}/scraps/${doc.id}`,
      lastModified: doc.data().updatedAt?.toDate() || new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    }));
  } catch (e) {
    console.error('Error fetching scraps for sitemap:', e);
  }

  return [
    {
      url: host,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...scrapUrls,
  ];
}
