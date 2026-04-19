import { MetadataRoute } from 'next';
import { db, collection, getDocs, query, orderBy } from '../firebase';
import { generateSlug } from '@/lib/utils';

import { getServerBaseUrl } from '@/lib/server-utils';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = await getServerBaseUrl();

  // Fetch all scraps to include in sitemap
  let scrapUrls: any[] = [];
  try {
    const scrapsQuery = query(collection(db, 'scraps'), orderBy('updatedAt', 'desc'));
    const scrapsSnapshot = await getDocs(scrapsQuery);
    
    scrapUrls = scrapsSnapshot.docs.map((doc) => {
      const data = doc.data();
      const slug = generateSlug(data.title || '');
      return {
        url: `${host}/scraps/${doc.id}${slug ? `/${slug}` : ''}`,
        lastModified: data.updatedAt?.toDate() || new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      };
    });
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
