'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ScrapList } from '../components/ScrapList';
import { Scrap } from '../types';

interface HomeClientProps {
  initialScraps?: Scrap[];
}

export function HomeClient({ initialScraps }: HomeClientProps) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <ScrapList 
        onSelectScrap={(scrap) => router.push(`/scraps/${scrap.id}`, { scroll: false })}
        onSelectUser={(userId) => router.push(`/profile/${userId}`, { scroll: false })}
        initialScraps={initialScraps}
      />
    </div>
  );
}
