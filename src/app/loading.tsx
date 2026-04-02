'use client';

import React from 'react';
import { motion } from 'motion/react';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50/80 backdrop-blur-sm">
      <div className="relative flex flex-col items-center">
        {/* Johari Window inspired loading animation */}
        <div className="grid grid-cols-2 gap-1.5 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="w-4 h-4 rounded-sm bg-blue-500"
              initial={{ opacity: 0.2, scale: 0.8 }}
              animate={{ 
                opacity: [0.2, 1, 0.2],
                scale: [0.8, 1.1, 0.8],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-lg font-display font-semibold text-gray-900 tracking-tight">
            じょはり
          </h2>
          <p className="text-sm text-gray-500 mt-1 font-sans">
            思考の窓をひらいています...
          </p>
        </motion.div>
      </div>
    </div>
  );
}
