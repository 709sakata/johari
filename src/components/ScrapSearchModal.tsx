import { useState, useEffect } from 'react';
import { db, collection, query, orderBy, limit, getDocs, where } from '../firebase';
import { Scrap } from '../types';
import { Search, X, Loader2, MessageSquare, Clock, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface ScrapSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (scrap: Scrap) => void;
}

export function ScrapSearchModal({ isOpen, onClose, onSelect }: ScrapSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setScraps([]);
      return;
    }

    const fetchScraps = async () => {
      setIsLoading(true);
      try {
        let results: Scrap[] = [];
        const term = searchTerm.trim();

        if (term) {
          const lowerTerm = term.toLowerCase();
          
          // 1. Fetch recent 500 for substring matching
          const recentQ = query(
            collection(db, 'scraps'), 
            orderBy('updatedAt', 'desc'), 
            limit(500)
          );
          
          // 2. Fetch prefix matches for older threads
          const prefixQ = query(
            collection(db, 'scraps'),
            where('title', '>=', term),
            where('title', '<=', term + '\uf8ff'),
            limit(50)
          );

          const [recentSnap, prefixSnap] = await Promise.all([
            getDocs(recentQ),
            getDocs(prefixQ)
          ]);

          const recentResults = recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scrap));
          const prefixResults = prefixSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scrap));

          // Combine and filter
          const combined = [...recentResults, ...prefixResults];
          const uniqueMap = new Map();
          combined.forEach(s => uniqueMap.set(s.id, s));
          
          results = Array.from(uniqueMap.values());
          
          // Apply substring filter
          results = results.filter(s => 
            s.title.toLowerCase().includes(lowerTerm) || 
            s.tags?.some(t => t.toLowerCase().includes(lowerTerm))
          );
          
          // Sort by updatedAt
          results.sort((a, b) => {
            const tA = a.updatedAt?.toMillis() || 0;
            const tB = b.updatedAt?.toMillis() || 0;
            return tB - tA;
          });
        } else {
          const q = query(
            collection(db, 'scraps'), 
            orderBy('updatedAt', 'desc'), 
            limit(10)
          );
          const snapshot = await getDocs(q);
          results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scrap));
        }
        
        setScraps(results);
      } catch (error) {
        console.error('Error searching scraps:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchScraps, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-gray-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shadow-sm">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-gray-900">スレッドをメンション</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">思考を繋げる</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-gray-50/50 border-b border-gray-50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="タイトルやタグで検索..."
              className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm font-medium"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">検索中...</p>
            </div>
          ) : scraps.length > 0 ? (
            scraps.map((scrap) => (
              <button
                key={scrap.id}
                onClick={() => onSelect(scrap)}
                className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-blue-50/50 border border-transparent hover:border-blue-100 transition-all text-left group"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-105 transition-transform flex-shrink-0">
                  <span className="text-xl select-none">{scrap.icon_emoji || '📄'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                    {scrap.title}
                  </h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {scrap.updatedAt ? formatDistanceToNow(scrap.updatedAt.toDate(), { addSuffix: true, locale: ja }) : 'たった今'}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {scrap.authorName}
                    </span>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">スレッドが見つかりません</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
