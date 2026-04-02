'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { NewScrapPage } from '../../components/NewScrapPage';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

function NewScrapContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTitle = searchParams.get('title') || '';

  return (
    <NewScrapPage
      initialTitle={initialTitle}
      onClose={() => router.back()}
      onSuccess={(id) => router.push(`/scraps/${id}`)}
    />
  );
}

export default function NewScrapRoute() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <Suspense fallback={<div className="p-20 text-center">読み込み中...</div>}>
          <NewScrapContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
