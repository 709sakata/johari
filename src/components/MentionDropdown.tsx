import { useState, useEffect, useRef } from 'react';
import { db, collection, query, orderBy, limit, getDocs, where } from '../firebase';
import { Scrap } from '../types';
import { Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface MentionDropdownProps {
  searchTerm: string;
  onSelect: (scrap: Scrap) => void;
  onClose: () => void;
  position: { top: number; left: number };
  onScrapsCountChange?: (count: number) => void;
}

export function MentionDropdown({ searchTerm, onSelect, onClose, position, onScrapsCountChange }: MentionDropdownProps) {
  const [scraps, setScraps] = useState<Scrap[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchScraps = async () => {
      if (!searchTerm.trim()) {
        setIsLoading(true);
        try {
          const q = query(
            collection(db, 'scraps'), 
            orderBy('updatedAt', 'desc'), 
            limit(20)
          );
          const snapshot = await getDocs(q);
          const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scrap));
          setScraps(results);
          onScrapsCountChange?.(results.length);
          setSelectedIndex(0);
        } catch (error) {
          console.error('Error fetching recent scraps:', error);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const term = searchTerm.trim();
        const lowerTerm = term.toLowerCase();

        // 1. Fetch recent 500 for substring matching
        const recentQ = query(
          collection(db, 'scraps'), 
          orderBy('updatedAt', 'desc'), 
          limit(500)
        );
        
        // 2. Fetch prefix matches for older threads (Firestore native prefix search)
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
        
        let results = Array.from(uniqueMap.values());
        
        // Apply substring filter
        results = results.filter(s => 
          s.title.toLowerCase().includes(lowerTerm) || 
          s.tags?.some(t => t.toLowerCase().includes(lowerTerm))
        );
        
        // Sort by updatedAt for the final list
        results.sort((a, b) => {
          const tA = a.updatedAt?.toMillis() || 0;
          const tB = b.updatedAt?.toMillis() || 0;
          return tB - tA;
        });

        const finalResults = results.slice(0, 8);
        setScraps(finalResults);
        onScrapsCountChange?.(finalResults.length);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Error searching scraps for mention:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchScraps, 150);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % scraps.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + scraps.length) % scraps.length);
      } else if (e.key === 'Enter' && scraps.length > 0) {
        e.preventDefault();
        onSelect(scraps[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [scraps, selectedIndex, onSelect, onClose]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={dropdownRef}
      className="fixed z-[110] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col w-64 max-h-64"
      style={{ 
        top: position.top + 25, 
        left: position.left,
      }}
    >
      <div className="p-2 border-b border-gray-50 bg-gray-50/50">
        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest px-2">スレッドをメンション</p>
      </div>
      
      <div className="overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          </div>
        ) : scraps.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-[10px] text-gray-400 font-bold italic">一致するスレッドが見つかりません</p>
          </div>
        ) : (
          scraps.map((scrap, index) => (
            <button
              key={scrap.id}
              onClick={() => onSelect(scrap)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 transition-all text-left group",
                index === selectedIndex ? "bg-blue-50" : "hover:bg-gray-50"
              )}
            >
              <span className="text-lg flex-shrink-0">{scrap.icon_emoji || '📄'}</span>
              <span className={cn(
                "text-xs font-bold truncate flex-1",
                index === selectedIndex ? "text-blue-700" : "text-gray-700"
              )}>
                {scrap.title}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
