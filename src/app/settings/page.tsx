'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppSurfacePage } from '@/components/layout/AppSurfacePage';
import { SettingsNavPanel } from '@/components/profile';
import { SettingsDetailPage } from '@/components/profile/SettingsDetailPage';
import { SettingsOverview } from '@/components/profile/SettingsOverview';
import { useHeader } from '@/contexts';
import { type SettingsSlug } from '@/components/profile/settingsNavigation';

function ScrollColumn({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const threshold = 10;
    setShowTop(el.scrollTop > threshold);
    setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - threshold);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update]);

  return (
    <div className={`relative h-full ${className}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-surface-lower to-transparent z-10 transition-opacity duration-200 ${showTop ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-lower to-transparent z-10 transition-opacity duration-200 ${showBottom ? 'opacity-100' : 'opacity-0'}`} />
      <div ref={ref} className="h-full overflow-y-auto scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { setHeader } = useHeader();
  const router = useRouter();
  const [activeSlug, setActiveSlug] = useState<SettingsSlug | null>(null);

  useEffect(() => {
    setHeader({ title: 'Settings', subtitle: undefined });
  }, [setHeader]);

  return (
    <AppSurfacePage scrollClassName="lg:h-full">
      {/* Mobile: normal single-column scroll */}
      <div className="lg:hidden max-w-2xl mx-auto">
        <SettingsNavPanel
          activeSlug={null}
          onSelect={(slug) => router.push(`/settings/${slug}`)}
        />
      </div>

      {/* Desktop: two independent scrolling columns with gradient masks */}
      <div className="hidden lg:flex lg:h-full lg:gap-ha-6 max-w-[1240px] mx-auto w-full">
        <ScrollColumn className="w-[300px] xl:w-[340px] shrink-0">
          <SettingsNavPanel activeSlug={activeSlug} onSelect={setActiveSlug} />
        </ScrollColumn>
        <ScrollColumn className="flex-1 min-w-0">
          {activeSlug
            ? <SettingsDetailPage slug={activeSlug} panelMode />
            : <SettingsOverview />
          }
        </ScrollColumn>
      </div>
    </AppSurfacePage>
  );
}
