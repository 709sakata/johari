'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PublicProfile } from '../../../components/PublicProfile';

interface ProfileContentProps {
  id: string;
}

export const ProfileContent: React.FC<ProfileContentProps> = ({ id }) => {
  const router = useRouter();

  return (
    <PublicProfile
      userId={id}
      onSelectScrap={(scrap) => router.push(`/scraps/${scrap.id}`)}
      onSelectUser={(userId) => router.push(`/profile/${userId}`)}
    />
  );
};
