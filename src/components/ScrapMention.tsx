import { doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useDocument } from 'react-firebase-hooks/firestore';
import { Scrap } from '../types';
import { Loader2, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

interface ScrapMentionProps {
  scrapId: string;
  className?: string;
  onClick?: () => void;
}

export function ScrapMention({ scrapId, className, onClick }: ScrapMentionProps) {
  const [value, loading, error] = useDocument(doc(db, `scraps/${scrapId}`));
  
  if (loading) {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-400 rounded-md border border-gray-100 text-[11px] font-bold animate-pulse", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        読み込み中...
      </span>
    );
  }

  if (error || !value?.exists()) {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-400 rounded-md border border-red-100 text-[11px] font-bold", className)}>
        <MessageSquare className="w-3 h-3" />
        不明なスレッド
      </span>
    );
  }

  const scrap = { id: value.id, ...value.data() } as Scrap;

  return (
    <span 
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 text-[11px] font-black hover:bg-blue-100 hover:border-blue-200 transition-all cursor-pointer shadow-sm active:scale-95 group",
        className
      )}
    >
      <span className="text-sm group-hover:scale-110 transition-transform select-none">
        {scrap.icon_emoji || '📄'}
      </span>
      <span className="truncate max-w-[150px] sm:max-w-[250px]">
        {scrap.title}
      </span>
    </span>
  );
}
