import React from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { HomeClient } from './HomeClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'じょはり | まだ知らない自分に出会う思考の窓',
  description: 'じょはり は、あなたの思考を整理し、他者との対話を通じて「未知の自分」を発見するための場所です。',
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
  const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://johari.app';
  
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
        <HomeClient />
      </main>

      <Footer />
    </div>
  );
}
