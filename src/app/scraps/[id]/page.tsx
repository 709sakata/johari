import React, { cache } from 'react';
import type { Metadata } from 'next';
import { db, doc, getDoc as getDocClient, collection, query, orderBy, limit, getDocs } from '../../../firebase';
import { Scrap, Comment } from '../../../types';
import { ScrapThread } from '../../../components/ScrapThread';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Cache the scrap data fetching to avoid redundant calls between metadata and page
const getCachedScrapData = cache(async (id: string) => {
  try {
    const scrapDoc = await getDocClient(doc(db, 'scraps', id));
    if (!scrapDoc.exists()) return null;
    
    const data = scrapDoc.data();
    const scrap = { 
      ...data, 
      id: scrapDoc.id,
      createdAt: data.createdAt?.toDate().toISOString(),
      updatedAt: data.updatedAt?.toDate().toISOString(),
    } as any;
    
    let firstComment: any = null;
    const commentsQuery = query(
      collection(db, 'scraps', id, 'comments'),
      orderBy('createdAt', 'asc'),
      limit(1)
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    if (!commentsSnapshot.empty) {
      const cData = commentsSnapshot.docs[0].data();
      firstComment = {
        ...cData,
        id: commentsSnapshot.docs[0].id,
        createdAt: (cData as any).createdAt?.toDate().toISOString(),
      };
    }
    
    return { scrap, firstComment };
  } catch (e) {
    console.error('Error fetching scrap data:', e);
    return null;
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  
  const data = await getCachedScrapData(id);
  
  if (!data) {
    return {
      title: 'スレッドが見つかりません | じょはり',
    };
  }

  const { scrap, firstComment } = data;
  const title = scrap.title;
  
  const description = firstComment 
    ? firstComment.content.substring(0, 160).replace(/[#*`]/g, '').trim() + '...'
    : `新しいスレッド「${scrap.title}」が作成されました。思考を整理し、対話を通じて未知の自分を発見しましょう。`;
  
  const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://johari.app';
  const ogImage = `${host}/api/og-image/${id}`;

  return {
    title,
    description,
    keywords: [...(scrap.tags || []), 'じょはり', '思考整理'],
    alternates: {
      canonical: `/scraps/${id}`,
    },
    openGraph: {
      title,
      description,
      images: [ogImage],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ScrapPage({ params }: PageProps) {
  const { id } = await params;

  const data = await getCachedScrapData(id);
  const scrapData = data?.scrap || null;
  const firstComment = data?.firstComment || null;

  const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://johari.app';
  
  const jsonLd = scrapData ? {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    'headline': scrapData.title,
    'description': firstComment?.content.substring(0, 200).replace(/[#*`]/g, '').trim() || `新しいスレッド「${scrapData.title}」が作成されました。`,
    'articleBody': firstComment?.content || '',
    'author': {
      '@type': 'Person',
      'name': scrapData.authorName,
      'url': `${host}/profile/${scrapData.authorId}`
    },
    'datePublished': scrapData.createdAt,
    'dateModified': scrapData.updatedAt,
    'url': `${host}/scraps/${id}`,
    'image': `${host}/api/og-image/${id}`,
    'interactionStatistic': {
      '@type': 'InteractionCounter',
      'interactionType': 'https://schema.org/CommentAction',
      'userInteractionCount': scrapData.commentCount || 0
    }
  } : null;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'ホーム',
        'item': host
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': scrapData?.title || 'スレッド',
        'item': `${host}/scraps/${id}`
      }
    ]
  };

  return (
    <div className="min-h-screen flex flex-col">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Header />
      <main className="flex-grow max-w-6xl mx-auto px-4 py-8 w-full">
        <ScrapThreadWrapper id={id} initialData={scrapData} />
      </main>
      <Footer />
    </div>
  );
}

// Separate wrapper to keep the page component clean and handle client-side logic
import { ScrapThreadWrapper } from './ScrapThreadWrapper';
