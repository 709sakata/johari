import { useState } from 'react';
import { cn } from '../lib/utils';

interface ExpandableBioProps {
  bio: string;
  className?: string;
  limit?: number;
}

export function ExpandableBio({ bio, className, limit = 50 }: ExpandableBioProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = bio.length >= limit;

  if (!isLong) {
    return (
      <p className={cn("text-sm text-gray-500 italic leading-relaxed", className)}>
        {bio}
      </p>
    );
  }

  return (
    <div className={cn("text-sm text-gray-500 italic leading-relaxed", className)}>
      <p className="inline">
        {isExpanded ? bio : (
          <>
            {bio.slice(0, limit)}
            <span className="text-[0.7em] align-baseline opacity-60 ml-0.5">...</span>
          </>
        )}
      </p>
      {!isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="ml-1 text-blue-600 hover:text-blue-700 font-bold not-italic hover:underline transition-all"
        >
          続きを読む
        </button>
      )}
      {isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          className="ml-2 text-gray-400 hover:text-gray-600 text-xs not-italic hover:underline transition-all"
        >
          閉じる
        </button>
      )}
    </div>
  );
}
