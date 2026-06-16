'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppSurfacePage } from '@/components/layout/AppSurfacePage';
import { SettingsNavPanel } from '@/components/profile';
import { SettingsDetailPage } from '@/components/profile/SettingsDetailPage';
import { useHeader } from '@/contexts';
import { type SettingsSlug, isSettingsSlug } from '@/components/profile/settingsNavigation';
import { subscribeSettingsReset } from '@/lib/settingsResetBus';

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
      <div className={`hidden lg:block pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-surface-lower to-transparent z-10 transition-opacity duration-200 ${showTop ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-lower to-transparent z-10 transition-opacity duration-200 ${showBottom ? 'opacity-100' : 'opacity-0'}`} />
      <div ref={ref} className="h-full overflow-y-auto scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

function SettingsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Honour a `?section=<slug>` deep-link (e.g. the clock pop-up's "Open Home
  // Center") so callers can open the two-column layout focused on a section.
  const requestedSection = searchParams.get('section');
  const [activeSlug, setActiveSlug] = useState<SettingsSlug>(
    requestedSection && isSettingsSlug(requestedSection) ? requestedSection : 'home-center',
  );
  // True while a focused editor (automation editor) is open in column 2 — the
  // nav column slides away so the editor gets the full workspace width.
  const [editorFocus, setEditorFocus] = useState(false);

  // Track the xl breakpoint (where the two-column workspace kicks in). Below it
  // the page is just a nav list, so the top bar should read plain "Settings".
  // Seed from matchMedia on the first client render so the desktop branch never
  // momentarily overrides the section header the detail panel sets.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Desktop: the active SettingsDetailPage owns the top bar (subtitle "Settings"
  // + the section title). Mobile: the two-column panel is hidden but still
  // mounted, so it would set the section header — override it back to plain
  // "Settings" here. This effect runs after the child's (parent effects fire
  // after children), so it wins the mount race.
  const { setHeader } = useHeader();
  useEffect(() => {
    if (!isDesktop) setHeader({ title: 'Settings', onBack: () => router.push('/') });
  }, [isDesktop, setHeader, router]);

  // Re-tapping the settings entry point while already here resets to the
  // default view (Home Center). Setting the section also clears any drill-down,
  // since SettingsDetailPage resets its detail when the active slug changes.
  useEffect(() => subscribeSettingsReset(() => setActiveSlug('home-center')), []);

  return (
    <AppSurfacePage scrollClassName="xl:h-full">
      {/* Narrow (< xl): single-column nav list; tapping opens the detail route.
          The two-column split needs room for the content's own sidebar, so it
          only kicks in at xl — below that, content gets the full width. */}
      {/* `--list-top-pad` mirrors <main>'s top padding (pt-ha-4 / lg:pt-ha-5) so the
          nav's sticky search absorbs it and pins under the top bar without drift —
          same mechanism the devices list (DataListView) uses. */}
      <div className="xl:hidden max-w-2xl mx-auto [--list-top-pad:var(--ha-space-4)] lg:[--list-top-pad:var(--ha-space-5)]">
        <SettingsNavPanel
          activeSlug={null}
          onSelect={(slug) => router.push(`/settings/${slug}`)}
        />
      </div>

      {/* Wide (≥ xl): two independent scrolling columns with gradient masks.
          Widened to 1536px so content + an in-content sidebar both fit. */}
      <div className="hidden xl:flex xl:h-full max-w-[1536px] mx-auto w-full lg:px-ha-8">
        {/* Slides away while a focused editor is open. The inner column keeps
            its fixed width so its content doesn't reflow mid-animation. */}
        <div
          className={`h-full shrink-0 overflow-hidden transition-[width,opacity,transform] duration-300 ease-out ${
            editorFocus ? 'w-0 opacity-0 -translate-x-6 pointer-events-none' : 'w-[372px] opacity-100 translate-x-0'
          }`}
          aria-hidden={editorFocus}
        >
          <ScrollColumn className="w-[340px] mr-ha-8">
            <SettingsNavPanel activeSlug={activeSlug} onSelect={setActiveSlug} />
          </ScrollColumn>
        </div>
        <ScrollColumn className="flex-1 min-w-0">
          {/* Re-keyed per section so the pane fades/slides in instead of snapping. */}
          <div key={activeSlug} className="ha-pane-in">
            <SettingsDetailPage slug={activeSlug} panelMode onEditorFocusChange={setEditorFocus} onSelectSection={setActiveSlug} />
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
