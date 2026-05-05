'use client';

import { AppSurfacePage } from '@/components/layout/AppSurfacePage';
import { useEffect } from 'react';
import { ProfileContent } from '@/components/profile';
import { useHeader } from '@/contexts';

export default function SettingsPage() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader({
      title: 'Settings',
      subtitle: undefined,
    });
  }, [setHeader]);

  return (
    <AppSurfacePage>
      <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full">
        <ProfileContent />
      </div>
    </AppSurfacePage>
  );
}
