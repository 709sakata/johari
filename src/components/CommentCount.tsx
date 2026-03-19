import { useState, useEffect } from 'react';
import { db, collection, query, getCountFromServer, doc, updateDoc } from '../firebase';
import { MessageSquare } from 'lucide-react';

interface CommentCountProps {
  scrapId: string;
  initialCount?: number;
}

export function CommentCount({ scrapId, initialCount }: CommentCountProps) {
  const [count, setCount] = useState<number | null>(initialCount ?? null);

  useEffect(() => {
    // If count is undefined or null, fetch it from the server
    if (count === null || count === undefined) {
      const fetchCount = async () => {
        try {
          const q = query(collection(db, `scraps/${scrapId}/comments`));
          const snapshot = await getCountFromServer(q);
          const actualCount = snapshot.data().count;
          setCount(actualCount);
          
          // Update the scrap document to cache the count for future list loads
          await updateDoc(doc(db, 'scraps', scrapId), {
            commentCount: actualCount
          });
        } catch (error) {
          console.error('Error fetching comment count:', error);
          setCount(0);
        }
      };
      fetchCount();
    }
  }, [scrapId, count]);

  return (
    <span className="text-xs text-gray-400 flex items-center gap-1">
      <MessageSquare className="w-3 h-3" />
      {count !== null ? count : '...'}
    </span>
  );
}
