'use client';

import { ProfileContent } from '@/components/profile';
import { useHeader } from '@/contexts';
import { useEffect } from 'react';

export default function ProfilePage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader({
      title: 'Profile',
      subtitle: undefined,
    });
  }, [setHeader]);

  return (
    <main className="h-full overflow-y-auto scrollbar-hide" data-scrollable="dashboard">
      <div className="p-ha-4 lg:p-ha-8 lg:pl-10">
        <ProfileContent />
      </div>
    </main>
  );
}
