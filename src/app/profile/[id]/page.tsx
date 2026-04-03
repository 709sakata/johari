import React, { cache } from 'react';
import type { Metadata } from 'next';
import { db, doc, getDoc as getDocClient } from '../../../firebase';
import { User as UserProfile } from '../../../types';
import { PublicProfile } from '../../../components/PublicProfile';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Cache the user data fetching to avoid redundant calls between metadata and page
const getCachedUserData = cache(async (id: string) => {
  try {
    const userDoc = await getDocClient(doc(db, 'users', id));
    if (!userDoc.exists()) return null;
    const data = userDoc.data();
    return { 
      ...data, 
      id: userDoc.id,
      createdAt: (data as any).createdAt?.toDate?.()?.toISOString?.() || (data as any).createdAt,
      updatedAt: (data as any).updatedAt?.toDate?.()?.toISOString?.() || (data as any).updatedAt,
    } as any;
  } catch (e) {
    console.error('Error fetching user data:', e);
    return null;
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  
  const data = await getCachedUserData(id);
  
  if (!data) {
    return {
      title: 'ユーザーが見つかりません | じょはり',
    };
  }

  const title = `${data.displayName || 'ユーザー'} のプロフィール | じょはり`;
  const description = data.bio || `${data.displayName || 'ユーザー'} さんの思考の窓。じょはり で思考を整理し、対話を楽しんでいます。`;
  
  return {
    title,
    description,
    alternates: {
      canonical: `/profile/${id}`,
    },
    openGraph: {
      title,
      description,
      images: [data.photoURL || ''],
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [data.photoURL || ''],
    },
  };
}

export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { embed } = await searchParams;
  const isEmbed = embed === 'true';

  const userData = await getCachedUserData(id);

  const host = process.env.NEXT_PUBLIC_BASE_URL || 'https://johari.app';
  const jsonLd = userData ? {
    '@context': 'https://schema.org',
    '@type': 'Person',
    'name': userData.displayName,
    'description': userData.bio,
    'image': userData.photoURL,
    'url': `${host}/profile/${id}`,
    'sameAs': userData.links || []
  } : null;

  return (
    <div className={`min-h-screen flex flex-col ${isEmbed ? 'bg-transparent' : ''}`}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {!isEmbed && <Header />}
      <main className={`flex-grow w-full ${isEmbed ? 'p-0' : 'max-w-6xl mx-auto px-4 py-8'}`}>
        <ProfileContent id={id} isEmbed={isEmbed} initialData={userData} />
      </main>
      {!isEmbed && <Footer />}
    </div>
  );
}

// Client component wrapper to handle interactive parts
import { ProfileContent } from './ProfileContent';
