'use client';

import { use } from 'react';
import { AppSurfacePage } from '@/components/layout/AppSurfacePage';
import { SettingsDetailPage } from '@/components/profile/SettingsDetailPage';
import { ProfileContent } from '@/components/profile';
import { isSettingsSlug } from '@/components/profile/settingsNavigation';
import { useHeader } from '@/contexts';
import { useEffect } from 'react';

interface SettingsDetailRouteProps {
  params: Promise<{ slug: string }>;
}

export default function SettingsDetailRoute({ params }: SettingsDetailRouteProps) {
  const { slug } = use(params);
  const { setHeader } = useHeader();

  useEffect(() => {
    if (!isSettingsSlug(slug)) {
      setHeader({
        title: 'Settings',
        subtitle: undefined,
      });
    }
  }, [setHeader, slug]);

  if (!isSettingsSlug(slug)) {
    return (
      <AppSurfacePage>
        <div className="max-w-[1240px] mx-auto lg:px-ha-8 w-full space-y-ha-6">
            <div className="rounded-ha-3xl border border-surface-lower bg-surface-default p-ha-6 lg:p-ha-8">
              <h2 className="text-2xl font-semibold text-text-primary">Settings page not found</h2>
              <p className="mt-ha-2 text-sm text-text-secondary">
                This settings route is not configured yet, so the settings home is shown below instead.
              </p>
            </div>
            <ProfileContent />
        </div>
      </AppSurfacePage>
    );
  }

  return <SettingsDetailPage slug={slug} />;
}
