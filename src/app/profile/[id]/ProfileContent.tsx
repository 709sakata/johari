'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PublicProfile } from '../../../components/PublicProfile';
import { User as UserProfile } from '../../../types';

interface ProfileContentProps {
  id: string;
  isEmbed?: boolean;
  initialData?: UserProfile | null;
}

export const ProfileContent: React.FC<ProfileContentProps> = ({ id, isEmbed, initialData }) => {
  const router = useRouter();

  return (
    <PublicProfile
      userId={id}
      onSelectScrap={(scrap) => router.push(`/scraps/${scrap.id}`)}
      onSelectUser={(userId) => router.push(`/profile/${userId}`)}
      isEmbed={isEmbed}
      initialUserProfile={initialData}
    />
  );
};
