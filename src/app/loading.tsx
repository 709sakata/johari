'use client';

import React from 'react';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50/80 backdrop-blur-sm">
      <div className="relative flex flex-col items-center">
        {/* Johari Window inspired loading animation */}
        <div className="grid grid-cols-2 gap-1.5 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-sm bg-blue-500 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        
        <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h2 className="text-lg font-display font-semibold text-gray-900 tracking-tight">
            じょはり
          </h2>
          <p className="text-sm text-gray-500 mt-1 font-sans">
            思考の窓をひらいています...
          </p>
        </div>
      </div>
    </div>
  );
}
