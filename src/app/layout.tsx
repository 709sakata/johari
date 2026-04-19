import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { FirebaseProvider } from '../components/FirebaseProvider';
import { Toaster } from 'sonner';
import { getBaseUrl } from '@/lib/utils';
import { getServerBaseUrl } from '@/lib/server-utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export async function generateMetadata(): Promise<Metadata> {
  const host = await getServerBaseUrl();
  const baseUrl = new URL(host);

  return {
    metadataBase: baseUrl,
    title: {
      default: 'じょはり | まだ知らない自分に出会う思考の窓',
      template: '%s | じょはり',
    },
    description: 'じょはり は、あなたの思考を整理し、他者との対話を通じて「未知の自分」を発見するための場所です。',
    keywords: ['じょはり', 'Johari Window', '思考整理', '自己分析', '対話', 'スレッド', 'メンション'],
    authors: [{ name: 'じょはり チーム' }],
    creator: 'じょはり チーム',
    publisher: 'じょはり',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    alternates: {
      canonical: '/',
      types: {
        'application/rss+xml': '/rss.xml',
      },
    },
    manifest: '/manifest.json',
    icons: {
      icon: '/icon.svg',
      apple: '/icon.svg',
    },
    openGraph: {
      title: 'じょはり | まだ知らない自分に出会う思考の窓',
      description: 'じょはり は、あなたの思考を整理し、他者との対話を通じて「未知の自分」を発見するための場所です。',
      url: './',
      siteName: 'じょはり',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'じょはり - まだ知らない自分に出会う思考の窓',
        },
      ],
      locale: 'ja_JP',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'じょはり | まだ知らない自分に出会う思考の窓',
      description: 'じょはり は、あなたの思考を整理し、他者との対話を通じて「未知の自分」を発見するための場所です。',
      images: ['/og-image.png'],
      creator: '@johari_cloud',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: 'cxLuzTYpUbqGA7qHZ7xl7i-imOf1aEERfzmIxPhttgw',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#3b82f6',
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
