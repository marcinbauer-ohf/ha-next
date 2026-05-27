'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useSidebarItems } from '@/hooks';

interface ApplicationViewNoticeProps {
  className?: string;
}

export function ApplicationViewNotice({ className = '' }: ApplicationViewNoticeProps) {
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

  if (!activeItem?.isApp) {
    return null;
  }

  return (
    <div className={`mb-ha-4 rounded-ha-2xl border border-ha-blue/15 bg-fill-primary-normal/70 px-ha-4 py-ha-3 ${className}`}>
      <p className="text-sm font-semibold text-text-primary">This is your application view.</p>
      <p className="mt-1 text-sm text-text-secondary">
        We cannot render the full application experience inside this prototype, so this view is represented here with explanatory copy.
      </p>
    </div>
  );
}
