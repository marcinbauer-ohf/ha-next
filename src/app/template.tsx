'use client';

import { usePathname } from 'next/navigation';
import { useImmersiveMode } from '@/hooks';

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { immersiveMode } = useImmersiveMode();
  const routeStyle = immersiveMode ? { transform: 'none', filter: 'none' } : undefined;

  return (
    <div
      className="h-full w-full flex flex-col"
      data-route-pathname={pathname}
      style={routeStyle}
    >
      {children}
    </div>
  );
}
