import { Scrap } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface ScrapStatsProps {
  scraps: Scrap[];
  className?: string;
}

export function ScrapStats({ scraps, className }: ScrapStatsProps) {
  const total = scraps.length;
  const openCount = scraps.filter(s => s.status === 'open').length;
  const closedCount = scraps.filter(s => s.status === 'closed').length;
  
  const openPercentage = total > 0 ? (openCount / total) * 100 : 0;
  const closedPercentage = total > 0 ? (closedCount / total) * 100 : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">ステータス</span>
          <span className="text-xs font-bold text-gray-900">{total} <span className="text-[10px] text-gray-400 font-medium">スレッド</span></span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-gray-600">{openCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            <span className="text-[10px] font-bold text-gray-600">{closedCount}</span>
          </div>
        </div>
      </div>
      
      <div className="relative h-1 w-full bg-gray-200/50 rounded-full overflow-hidden flex">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${openPercentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full bg-emerald-500"
        />
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${closedPercentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="h-full bg-gray-300"
        />
      </div>
      
      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter">
        <span className="text-emerald-600">{Math.round(openPercentage)}% OPEN</span>
        <span className="text-gray-400">{Math.round(closedPercentage)}% CLOSED</span>
      </div>
    </div>
  );
}
