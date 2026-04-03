import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useState, useEffect } from 'react';
import { Scrap } from '../types';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

interface ScrapLinkProps {
  title: string;
  className?: string;
  onClick?: (scrap: Scrap) => void;
  onCreate?: (title: string) => void;
}

export function ScrapLink({ title, className, onClick, onCreate }: ScrapLinkProps) {
  const [scrap, setScrap] = useState<Scrap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function lookupScrap() {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'scraps'),
          where('title', '==', title),
          limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setScrap({ id: doc.id, ...doc.data() } as Scrap);
        } else {
          setScrap(null);
        }
      } catch (error) {
        console.error('Error looking up scrap by title:', error);
      } finally {
        setLoading(false);
      }
    }

    if (title) {
      lookupScrap();
    }
  }, [title]);

  if (loading) {
    return (
      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded border border-gray-100 text-[11px] font-bold animate-pulse", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        {title}
      </span>
    );
  }

  if (!scrap) {
    return (
      <span 
        onClick={() => onCreate?.(title)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1 bg-red-50/80 backdrop-blur-sm text-red-500 rounded-xl border border-red-100/50 text-[11px] font-black cursor-pointer hover:bg-red-100 hover:border-red-200 transition-all shadow-sm hover:shadow-md active:scale-95 group",
          className
        )}
      >
        <Plus className="w-3.5 h-3.5 group-hover:scale-125 transition-transform" />
        <span className="tracking-tight">{title}</span>
      </span>
    );
  }

  return (
    <span 
      onClick={() => onClick?.(scrap)}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50/80 backdrop-blur-sm text-blue-700 rounded-xl border border-blue-100/50 text-[11px] font-black hover:bg-blue-100 hover:border-blue-200 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95 group",
        className
      )}
    >
      <span className="text-sm group-hover:scale-125 transition-transform select-none">
        {scrap.icon_emoji || '📄'}
      </span>
      <span className="tracking-tight">{scrap.title}</span>
    </span>
  );
}
