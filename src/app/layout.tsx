import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { FirebaseProvider } from '../components/FirebaseProvider';
import { Toaster } from 'sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'じょはり | まだ知らない自分に出会う思考の窓',
  description: 'じょはり は、あなたの思考を整理し、他者との対話を通じて「未知の自分」を発見するための場所です。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
        <FirebaseProvider>
          {children}
          <Toaster position="top-center" richColors />
        </FirebaseProvider>
      </body>
    </html>
  );
}
