import React, { cache } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { HomeClient } from './HomeClient';
import type { Metadata } from 'next';
import { db, collection, query, orderBy, limit, getDocs } from '../firebase';
import { Scrap } from '../types';
import { getBaseUrl } from '@/lib/utils';
import { getServerBaseUrl } from '@/lib/server-utils';

export const metadata: Metadata = {
  title: 'じょはり | まだ知らない自分に出会う思考の窓',
  description: 'じょはり は、あなたの思考を整理し、他者との対話を通じて「未知の自分」を発見するための場所です。',
  alternates: {
    canonical: '/',
  },
};

const getInitialScraps = cache(async () => {
  try {
    const q = query(collection(db, 'scraps'), orderBy('updatedAt', 'desc'), limit(10));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      };
    }) as any[];
  } catch (e) {
    console.error('Error fetching initial scraps:', e);
    return [];
  }
});

export default async function HomePage() {
  const host = await getServerBaseUrl();
  const initialScraps = await getInitialScraps();
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'じょはり',
    'url': host,
    'description': 'まだ知らない自分に出会う思考の窓。思考整理と対話のプラットフォーム。',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${host}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      
      <main className="flex-grow max-w-6xl mx-auto px-4 py-8 w-full">
        <HomeClient initialScraps={initialScraps} />
      </main>

      <Footer />
    </div>
  );
}
