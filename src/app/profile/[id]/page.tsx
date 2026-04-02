import React from 'react';
import type { Metadata } from 'next';
import { db, doc, getDoc as getDocClient } from '../../../firebase';
import { User as UserProfile } from '../../../types';
import { PublicProfile } from '../../../components/PublicProfile';
import { Header } from '../../../components/Header';
import { Footer } from '../../../components/Footer';
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  
  try {
    let data: UserProfile | undefined;
    
    // Use Client SDK directly (works if rules allow public read)
    // This is more reliable in AI Studio where Admin SDK permissions may be restricted
    const userDoc = await getDocClient(doc(db, 'users', id));
    if (userDoc.exists()) {
      data = userDoc.data() as UserProfile;
    }
    
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
  } catch (error) {
    console.error('Metadata generation error:', error);
    return {
      title: 'ユーザープロフィール | じょはり',
    };
  }
}

export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params;

  // Fetch data for JSON-LD
  let userData: UserProfile | null = null;
  try {
    const userDoc = await getDocClient(doc(db, 'users', id));
    if (userDoc.exists()) {
      userData = userDoc.data() as UserProfile;
    }
  } catch (e) {
    console.error('Error fetching user for JSON-LD:', e);
  }

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
    <div className="min-h-screen flex flex-col">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Header />
      <main className="flex-grow max-w-6xl mx-auto px-4 py-8 w-full">
        <ProfileContent id={id} />
      </main>
      <Footer />
    </div>
  );
}

// Client component wrapper to handle interactive parts
import { ProfileContent } from './ProfileContent';
