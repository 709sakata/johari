import React from 'react';
import type { Metadata } from 'next';
import { db, doc, getDoc as getDocClient } from '../../../firebase';
import { Scrap } from '../../../types';
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
    const description = `新しいスレッド「${data.title}」が作成されました。思考を整理し、対話を通じて未知の自分を発見しましょう。`;
    
    const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://johari.app';
    const ogImage = `${host}/api/og-image/${id}`;

    return {
      title,
      description,
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

  // We pass the ID to the client component which will handle real-time updates via onSnapshot
  // This keeps the interactive parts working as they were in the SPA
  return (
    <div className="min-h-screen flex flex-col">
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
