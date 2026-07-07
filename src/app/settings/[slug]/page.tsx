'use client';

import { Suspense, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsDetailPage } from '@/components/profile/SettingsDetailPage';
import { isSettingsSlug, isAdminOnlySlug } from '@/components/profile/settingsNavigation';
import { useHomeAssistant } from '@/hooks';

interface SettingsDetailRouteProps {
  params: Promise<{ slug: string }>;
}

export default function SettingsDetailRoute({ params }: SettingsDetailRouteProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { isAdmin } = useHomeAssistant();
  const valid = isSettingsSlug(slug) && (isAdmin || !isAdminOnlySlug(slug));

  // Unknown or (for a non-admin) admin-only slug → land on the settings home
  // instead of stacking an error card, or rendering a page they can't use.
  useEffect(() => {
    if (!valid) router.replace('/settings');
  }, [valid, router]);

  if (!valid) return null;

  // SettingsDetailPage reads useSearchParams (deep-link ?device=), which needs a
  // Suspense boundary during static rendering.
  return (
    <Suspense fallback={null}>
      <SettingsDetailPage slug={slug} />
    </Suspense>
  );
}
