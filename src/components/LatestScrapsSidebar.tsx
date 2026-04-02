'use client';

import React from 'react';
import { db, collection, query, orderBy, limit } from '../firebase';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Scrap } from '../types';
import { Clock, Loader2, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface LatestScrapsSidebarProps {
  currentScrapId: string;
  onSelectScrap: (scrap: Scrap) => void;
}

export function LatestScrapsSidebar({ currentScrapId, onSelectScrap }: LatestScrapsSidebarProps) {
  const [value, loading, error] = useCollection(
    query(collection(db, 'scraps'), orderBy('updatedAt', 'desc'), limit(6))
  );

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !value) return null;

  const scraps = value.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Scrap))
    .filter(s => s.id !== currentScrapId)
    .slice(0, 5);

  if (scraps.length === 0) return null;

  return (
    <div className="glass rounded-[2.5rem] p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">最新のスレッド</p>
      </div>
      <div className="space-y-3">
        {scraps.map((scrap) => (
          <button
            key={scrap.id}
            onClick={() => onSelectScrap(scrap)}
            className="w-full text-left group space-y-1"
          >
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                {scrap.icon_emoji || '📄'}
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                  {scrap.title}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 font-medium">
                  <Clock className="w-3 h-3" />
                  <span>
                    {scrap.updatedAt 
                      ? formatDistanceToNow(scrap.updatedAt.toDate(), { addSuffix: true, locale: ja }) 
                      : 'たった今'}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
