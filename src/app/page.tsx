'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ScrapList } from '../components/ScrapList';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow max-w-6xl mx-auto px-4 py-8 w-full">
        {/* Thread List */}
        <div className="space-y-8">
          <ScrapList 
            onSelectScrap={(scrap) => router.push(`/scraps/${scrap.id}`, { scroll: false })}
            onSelectUser={(userId) => router.push(`/profile/${userId}`, { scroll: false })}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
