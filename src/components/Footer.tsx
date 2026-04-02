'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, Rss } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="py-12 border-t border-gray-100 bg-white">
      <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 text-gray-400">
          <MessageSquare className="w-5 h-5" />
          <span className="font-black text-sm tracking-widest uppercase">じょはり</span>
        </div>
        <p className="text-gray-400 text-xs">
          まだ知らない自分に出会う思考の窓
        </p>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            <a 
              href="/rss.xml" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-gray-400 hover:text-orange-500 transition-colors"
            >
              <Rss className="w-3 h-3" />
              RSS Feed
            </a>
          </div>
          <p className="text-[10px] text-gray-300 font-bold tracking-widest uppercase">
            &copy; 2026 Hopin, Inc.
          </p>
        </div>
      </div>
    </footer>
  );
};
