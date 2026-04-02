import React from 'react';
import type { Metadata } from 'next';
import { db, doc, getDoc as getDocClient, collection, query, orderBy, limit, getDocs } from '../../../firebase';
import { Scrap, Comment } from '../../../types';
import { ScrapThread } from '../../../components/ScrapThread';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  
  try {
    let data: Scrap | undefined;
    
    // Use Client SDK directly (works if rules allow public read)
    // This is more reliable in AI Studio where Admin SDK permissions may be restricted
    const scrapDoc = await getDocClient(doc(db, 'scraps', id));
    if (scrapDoc.exists()) {
      data = scrapDoc.data() as Scrap;
    }
    
    if (!data) {
      return {
        title: 'スレッドが見つかりません | じょはり',
      };
    }

    const title = `${data.title} | じょはり`;
    
    // Fetch the first comment to use as description
    let firstCommentContent = '';
    try {
      const commentsQuery = query(
        collection(db, 'scraps', id, 'comments'),
        orderBy('createdAt', 'asc'),
        limit(1)
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      if (!commentsSnapshot.empty) {
        firstCommentContent = (commentsSnapshot.docs[0].data() as Comment).content;
      }
    } catch (e) {
      console.error('Error fetching first comment for metadata:', e);
    }

    const description = firstCommentContent 
      ? firstCommentContent.substring(0, 160).replace(/[#*`]/g, '').trim() + '...'
      : `新しいスレッド「${data.title}」が作成されました。思考を整理し、対話を通じて未知の自分を発見しましょう。`;
    
    const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://johari.app';
    const ogImage = `${host}/api/og-image/${id}`;

    return {
      title,
      description,
      keywords: [...(data.tags || []), 'じょはり', '思考整理'],
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
  } catch (error) {
    console.error('Metadata generation error:', error);
    return {
      title: 'じょはり | まだ知らない自分に出会う思考の窓',
    };
  }
}

export default async function ScrapPage({ params }: PageProps) {
  const { id } = await params;

  // Fetch data for JSON-LD
  let scrapData: Scrap | null = null;
  let firstComment: Comment | null = null;
  try {
    const scrapDoc = await getDocClient(doc(db, 'scraps', id));
    if (scrapDoc.exists()) {
      scrapData = scrapDoc.data() as Scrap;
      
      // Fetch first comment for JSON-LD body
      const commentsQuery = query(
        collection(db, 'scraps', id, 'comments'),
        orderBy('createdAt', 'asc'),
        limit(1)
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      if (!commentsSnapshot.empty) {
        firstComment = commentsSnapshot.docs[0].data() as Comment;
      }
    }
  } catch (e) {
    console.error('Error fetching scrap for JSON-LD:', e);
  }

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
    'datePublished': scrapData.createdAt?.toDate().toISOString(),
    'dateModified': scrapData.updatedAt?.toDate().toISOString(),
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
        <ScrapThreadWrapper id={id} />
      </main>
      <Footer />
    </div>
  );
}

// Separate wrapper to keep the page component clean and handle client-side logic
import { ScrapThreadWrapper } from './ScrapThreadWrapper';
