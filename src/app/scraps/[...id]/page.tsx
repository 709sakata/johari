import React, { cache } from 'react';
import type { Metadata } from 'next';
import { db, doc, getDoc as getDocClient, collection, query, orderBy, limit, getDocs, where } from '../../../firebase';
import { Scrap, Comment } from '../../../types';
import { ScrapThread } from '../../../components/ScrapThread';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';
import { generateSlug, getDisplayDate, getBaseUrl } from '@/lib/utils';
import Link from 'next/link';
import { MessageSquare, Clock, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface PageProps {
  params: Promise<{ id: string[] }>;
}

// Cache the scrap data fetching to avoid redundant calls between metadata and page
const getCachedScrapData = cache(async (idArray: string[]) => {
  try {
    const id = idArray[0];
    if (!id) return null;
    
    const scrapDoc = await getDocClient(doc(db, 'scraps', id));
    if (!scrapDoc.exists()) return null;
    
    const data = scrapDoc.data();
    const scrap = { 
      ...data, 
      id: scrapDoc.id,
      createdAt: data.createdAt?.toDate().toISOString(),
      updatedAt: data.updatedAt?.toDate().toISOString(),
    } as any;
    
    let comments: any[] = [];
    const commentsQuery = query(
      collection(db, 'scraps', id, 'comments'),
      orderBy('createdAt', 'asc'),
      limit(10) // Fetch top 10 comments for AI context
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    if (!commentsSnapshot.empty) {
      comments = commentsSnapshot.docs.map(doc => {
        const cData = doc.data();
        return {
          ...cData,
          id: doc.id,
          createdAt: (cData as any).createdAt?.toDate().toISOString(),
        };
      });
    }
    
    const firstComment = comments.length > 0 ? comments[0] : null;
    
    // Fetch related scraps based on tags
    let relatedScraps: any[] = [];
    if (scrap.tags && scrap.tags.length > 0) {
      try {
        const relatedQuery = query(
          collection(db, 'scraps'),
          where('tags', 'array-contains-any', scrap.tags.slice(0, 10)),
          limit(6) // Fetch a bit more to filter out current scrap
        );
        const relatedSnapshot = await getDocs(relatedQuery);
        relatedScraps = relatedSnapshot.docs
          .map(doc => {
            const rData = doc.data();
            return {
              ...rData,
              id: doc.id,
              createdAt: (rData as any).createdAt?.toDate().toISOString(),
              updatedAt: (rData as any).updatedAt?.toDate().toISOString(),
            };
          })
          .filter(s => s.id !== id)
          .slice(0, 3);
      } catch (e) {
        console.error('Error fetching related scraps:', e);
      }
    }
    
    return { scrap, firstComment, comments, relatedScraps };
  } catch (e) {
    console.error('Error fetching scrap data:', e);
    return null;
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: idArray } = await params;
  const id = idArray[0];
  
  const data = await getCachedScrapData(idArray);
  
  if (!data) {
    return {
      title: 'スレッドが見つかりません | じょはり',
    };
  }

  const { scrap, firstComment } = data;
  const title = `${scrap.title} | じょはり`;
  const slug = generateSlug(scrap.title);
  
  const plainContent = firstComment?.content.replace(/[#*`\[\]\(\)]/g, '').replace(/\s+/g, ' ').trim() || '';
  const description = plainContent 
    ? plainContent.substring(0, 160) + (plainContent.length > 160 ? '...' : '')
    : `新しいスレッド「${scrap.title}」が作成されました。思考を整理し、対話を通じて未知の自分を発見しましょう。`;
  
  const host = getBaseUrl();
  const ogImage = `${host}/api/og-image/${id}`;

  return {
    title,
    description,
    keywords: [...(scrap.tags || []), 'じょはり', '思考整理', '対話', '自己理解', 'スクラップ'],
    alternates: {
      canonical: `/scraps/${id}${slug ? `/${slug}` : ''}`,
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
    other: {
      'ai-content-type': 'discussion-thread',
      'ai-author-name': scrap.authorName,
      'ai-thread-status': scrap.status || 'open',
      'ai-comment-count': scrap.commentCount?.toString() || '0',
      'ai-last-updated': scrap.updatedAt,
      'ai-context': 'johari-window-thinking-process',
    },
  };
}

export default async function ScrapPage({ params }: PageProps) {
  const { id: idArray } = await params;
  const id = idArray[0];

  const data = await getCachedScrapData(idArray);
  const scrapData = data?.scrap || null;
  const firstComment = data?.firstComment || null;
  const comments = data?.comments || [];

  const host = getBaseUrl();
  
  const jsonLd = scrapData ? {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    'headline': scrapData.title,
    'description': firstComment?.content.substring(0, 200).replace(/[#*`]/g, '').trim() || `新しいスレッド「${scrapData.title}」が作成されました。`,
    'articleBody': firstComment?.content || '',
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': `${host}/scraps/${id}`
    },
    'author': {
      '@type': 'Person',
      'name': scrapData.authorName,
      'url': `${host}/profile/${scrapData.authorId}`,
      'image': scrapData.authorPhoto || undefined
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'じょはり',
      'url': host,
      'logo': {
        '@type': 'ImageObject',
        'url': `${host}/icon.svg`
      }
    },
    'datePublished': scrapData.createdAt,
    'dateModified': scrapData.updatedAt,
    'url': `${host}/scraps/${id}`,
    'image': `${host}/api/og-image/${id}`,
    'keywords': scrapData.tags?.join(', '),
    'interactionStatistic': [
      {
        '@type': 'InteractionCounter',
        'interactionType': 'https://schema.org/CommentAction',
        'userInteractionCount': scrapData.commentCount || 0
      }
    ],
    'comment': comments.slice(1).map((c: any) => ({
      '@type': 'Comment',
      'author': {
        '@type': 'Person',
        'name': c.authorName
      },
      'text': c.content,
      'datePublished': c.createdAt
    }))
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
        <ScrapThreadWrapper id={id} initialData={scrapData} initialComments={comments} />
        
        {data?.relatedScraps && data.relatedScraps.length > 0 && (
          <section className="mt-16 border-t border-gray-100 pt-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                <span className="w-1.5 h-8 bg-blue-600 rounded-full" />
                関連するスレッド
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.relatedScraps.map((related: any) => (
                <Link 
                  key={related.id}
                  href={`/scraps/${related.id}/${generateSlug(related.title)}`}
                  className="group bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all flex flex-col h-full"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">{related.emoji || '📝'}</span>
                    <div className="flex flex-wrap gap-1">
                      {related.tags?.slice(0, 2).map((tag: string) => (
                        <span key={tag} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-4 flex-grow">
                    {related.title}
                  </h3>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {related.commentCount || 0}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {related.updatedAt ? formatDistanceToNow(getDisplayDate(related.updatedAt)!, { addSuffix: true, locale: ja }) : '不明'}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

// Separate wrapper to keep the page component clean and handle client-side logic
import { ScrapThreadWrapper } from './ScrapThreadWrapper';
