'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppSurfacePage } from '@/components/layout/AppSurfacePage';
import { SettingsNavPanel } from '@/components/profile';
import { SettingsDetailPage } from '@/components/profile/SettingsDetailPage';
import { useHeader } from '@/contexts';
import { type SettingsSlug, isSettingsSlug } from '@/components/profile/settingsNavigation';

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

function SettingsWorkspace() {
  const { setHeader } = useHeader();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Honour a `?section=<slug>` deep-link (e.g. the clock pop-up's "Open Home
  // Center") so callers can open the two-column layout focused on a section.
  const requestedSection = searchParams.get('section');
  const [activeSlug, setActiveSlug] = useState<SettingsSlug>(
    requestedSection && isSettingsSlug(requestedSection) ? requestedSection : 'home-center',
  );

  useEffect(() => {
    setHeader({ title: 'Settings', subtitle: undefined });
  }, [setHeader]);

  return (
    <AppSurfacePage scrollClassName="xl:h-full">
      {/* Narrow (< xl): single-column nav list; tapping opens the detail route.
          The two-column split needs room for the content's own sidebar, so it
          only kicks in at xl — below that, content gets the full width. */}
      <div className="xl:hidden max-w-2xl mx-auto">
        <SettingsNavPanel
          activeSlug={null}
          onSelect={(slug) => router.push(`/settings/${slug}`)}
        />
      </div>

      {/* Wide (≥ xl): two independent scrolling columns with gradient masks.
          Widened to 1536px so content + an in-content sidebar both fit. */}
      <div className="hidden xl:flex xl:h-full xl:gap-ha-6 max-w-[1536px] mx-auto w-full">
        <ScrollColumn className="w-[340px] shrink-0">
          <SettingsNavPanel activeSlug={activeSlug} onSelect={setActiveSlug} />
        </ScrollColumn>
        <ScrollColumn className="flex-1 min-w-0">
          {/* Re-keyed per section so the pane fades/slides in instead of snapping. */}
          <div key={activeSlug} className="ha-pane-in">
            <SettingsDetailPage slug={activeSlug} panelMode />
          </div>
        </ScrollColumn>
      </div>
    </AppSurfacePage>
  );
}

export default function SettingsPage() {
  // useSearchParams requires a Suspense boundary during static rendering.
  return (
    <Suspense fallback={null}>
      <SettingsWorkspace />
    </Suspense>
  );
}
