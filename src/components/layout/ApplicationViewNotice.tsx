'use client';

import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSidebarItems } from '@/hooks';

interface ApplicationViewNoticeProps {
  className?: string;
}

function ApplicationViewNoticeInner({ className = '' }: ApplicationViewNoticeProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { items } = useSidebarItems();

  if (searchParams.get('embed') === '1') {
    return null;
  }

  const activeItem = items.find((item) => {
    if (item.urlPath === '/') return pathname === '/';
    return pathname === item.urlPath || pathname.startsWith(`${item.urlPath}/`);
  });

  if (!activeItem?.isApp && !activeItem?.isPlaceholder) {
    return null;
  }

  const heading = activeItem.isApp ? 'This is your application view.' : 'This view is a prototype.';
  const body = activeItem.isApp
    ? 'We cannot render the full application experience inside this prototype, so this view is represented here with explanatory copy.'
    : 'We cannot render this view in full — this is a prototype. Some content may be static or missing.';

  return (
    <div className={`mb-ha-4 rounded-ha-2xl border border-ha-blue/15 bg-fill-primary-normal/70 px-ha-4 py-ha-3 ${className}`}>
      <p className="text-sm font-semibold text-text-primary">{heading}</p>
      <p className="mt-1 text-sm text-text-secondary">{body}</p>
    </div>
  );
}

export function ApplicationViewNotice({ className }: ApplicationViewNoticeProps) {
  return (
    <Suspense fallback={null}>
      <ApplicationViewNoticeInner className={className} />
    </Suspense>
  );
}
