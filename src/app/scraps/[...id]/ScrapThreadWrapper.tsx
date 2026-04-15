'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, doc, onSnapshot } from '../../../firebase';
import { Scrap, Comment } from '../../../types';
import { ScrapThread } from '../../../components/ScrapThread';
import { Loader2 } from 'lucide-react';

interface ScrapThreadWrapperProps {
  id: string;
  initialData?: Scrap | null;
  initialComments?: Comment[];
}

export const ScrapThreadWrapper: React.FC<ScrapThreadWrapperProps> = ({ id, initialData, initialComments }) => {
  const router = useRouter();
  const [scrap, setScrap] = useState<Scrap | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(
      doc(db, 'scraps', id),
      (docSnap) => {
        if (docSnap.exists()) {
          setScrap({ id: docSnap.id, ...docSnap.data() } as Scrap);
        } else {
          setError('スレッドが見つかりませんでした。');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching scrap:', err);
        setError('データの取得中にエラーが発生しました。');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">スレッドを読み込んでいます...</p>
      </div>
    );
  }

  if (error || !scrap) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 font-bold mb-4">{error || 'スレッドが見つかりません'}</p>
        <button
          onClick={() => router.push('/')}
          className="text-blue-600 hover:underline font-bold"
        >
          トップページに戻る
        </button>
      </div>
    );
  }

  return (
    <ScrapThread
      scrap={scrap}
      initialComments={initialComments}
      onBack={() => router.push('/', { scroll: false })}
      onSelectUser={(userId) => router.push(`/profile/${userId}`, { scroll: false })}
      onSelectScrap={(selectedScrap) => router.push(`/scraps/${selectedScrap.id}`, { scroll: false })}
      onCreateScrap={(title) => {
        // This would normally open the creation UI
        router.push(`/new-scrap?title=${encodeURIComponent(title)}`, { scroll: false });
      }}
    />
  );
};
