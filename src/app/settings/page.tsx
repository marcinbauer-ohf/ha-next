'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppSurfacePage } from '@/components/layout/AppSurfacePage';
import { CONTENT_SHELL } from '@/lib/layout';
import { SettingsNavPanel } from '@/components/profile';
import { SettingsDetailPage } from '@/components/profile/SettingsDetailPage';
import { useHeader, useDebugFlags, useRailSlot } from '@/contexts';
import { type SettingsSlug, isSettingsSlug, isAdminOnlySlug, getDefaultSettingsSlug, getVisibleSettingsNavSections } from '@/components/profile/settingsNavigation';
import { useHomeAssistant } from '@/hooks';
import { useScrollFades } from '@/hooks/useScrollFades';
import { ScrollFadeEdge } from '@/components/ui/ScrollFadeEdge';
import { canFireBareShortcut, matchShortcut } from '@/lib/keyboardShortcuts';

// Two independent scrolling columns, each with the app's standard top+bottom
// gradient fades. State comes from the shared hook (it also catches content
// swaps, which a plain scroll listener misses) and the fades are the shared
// click-to-edge overlay, so this column behaves like every other one.
function ScrollColumn({ children, className = '', fade = 'from-surface-lower' }: { children: React.ReactNode; className?: string; fade?: string }) {
  const { attach, showTop, showBottom } = useScrollFades<HTMLDivElement>();
  const elRef = useRef<HTMLDivElement | null>(null);
  const scrollTo = (top: number) => elRef.current?.scrollTo({ top, behavior: 'smooth' });

  return (
    <div className={`relative h-full ${className}`}>
      <ScrollFadeEdge
        edge="top"
        visible={showTop}
        onClick={() => scrollTo(0)}
        className={`hidden lg:block absolute inset-x-0 top-0 h-10 bg-gradient-to-b ${fade} to-transparent z-10 transition-opacity duration-200`}
      />
      <ScrollFadeEdge
        edge="bottom"
        visible={showBottom}
        onClick={() => scrollTo(elRef.current?.scrollHeight ?? 0)}
        className={`absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t ${fade} to-transparent z-10 transition-opacity duration-200`}
      />
      <div
        ref={(el) => { elRef.current = el; attach(el); }}
        className="h-full overflow-y-auto scrollbar-hide"
      >
        {children}
      </div>
    </div>
  );
}

function SettingsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin } = useHomeAssistant();
  // Prototyping switch: the section list either lives in the shell's rail
  // column (default) or back inside the page as the first of two columns.
  const { hideHomeCenterEnabled, settingsRailEnabled } = useDebugFlags();
  // The shell's left rail column — between the app sidebar and the content
  // surface, and spanning the top-bar row, so the section list's search starts
  // level with the global one. The shell owns the column's width (it has to
  // indent the top-bar title by the same amount); we just fill it.
  const railSlot = useRailSlot();
  // Honour a `?section=<slug>` deep-link (e.g. the clock pop-up's "Open Home
  // Center") so callers can open the two-column layout focused on a section.
  // Ignore it if it points at an admin-only section the current user can't see.
  const requestedSection = searchParams.get('section');
  const requestedSlugValid = requestedSection && isSettingsSlug(requestedSection) && (isAdmin || !isAdminOnlySlug(requestedSection));
  const [activeSlug, setActiveSlug] = useState<SettingsSlug>(
    requestedSlugValid ? (requestedSection as SettingsSlug) : getDefaultSettingsSlug(isAdmin, hideHomeCenterEnabled),
  );

  // If the preview-as-non-admin toggle flips while an admin-only section is
  // open, render the default instead of the gated page — computed rather than
  // synced back into state via an effect, to avoid an extra render.
  // Same fallback covers the hide-Home-Center prototyping flag flipping on
  // while Home Center is the open section.
  const slugHidden = (!isAdmin && isAdminOnlySlug(activeSlug)) || (hideHomeCenterEnabled && activeSlug === 'home-center');
  const effectiveActiveSlug = slugHidden ? getDefaultSettingsSlug(isAdmin, hideHomeCenterEnabled) : activeSlug;
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

  // Keyboard shortcuts — [ / ] step through the sidebar sections, D jumps to
  // Prototype & Debug Tools. Single keys skip text fields (the nav search) and
  // open dialogs; paused while a focused editor owns the workspace.
  useEffect(() => {
    if (editorFocus) return;
    const slugs = getVisibleSettingsNavSections(isAdmin, hideHomeCenterEnabled).flatMap((section) => section.items.map((item) => item.slug));
    const handler = (e: KeyboardEvent) => {
      if (!canFireBareShortcut(e)) return;
      if (matchShortcut(e, 'settings.debug')) {
        if (!isAdmin) return;
        e.preventDefault();
        if (isDesktop) setActiveSlug('developer');
        else router.push('/settings/developer');
        return;
      }
      if (!isDesktop) return; // section stepping needs the two-column workspace
      const step = matchShortcut(e, 'settings.next') ? 1 : matchShortcut(e, 'settings.prev') ? -1 : 0;
      if (step === 0) return;
      e.preventDefault();
      setActiveSlug((current) => {
        const index = slugs.indexOf(current);
        return slugs[(index + step + slugs.length) % slugs.length] ?? current;
      });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorFocus, isDesktop, router, isAdmin, hideHomeCenterEnabled]);

  return (
    // Desktop (≥ xl): the section list is pulled OUT of the content surface into
    // the shell's own rail column, so the main surface shows only the open
    // section. Below xl there's no room for the rail, so the surface carries the
    // nav list on its own.
    <>
      {/* No panel of its own — the rail sits directly on the shell background so
          the section list isn't a surface inside a surface. A single hairline on
          the left is all that divides it from the app sidebar. */}
      {settingsRailEnabled && railSlot && createPortal(
        <div className="h-full overflow-hidden pt-ha-1 pl-ha-4 pr-ha-3 border-l border-surface-mid">
          <ScrollColumn fade="from-surface-default">
            <SettingsNavPanel activeSlug={effectiveActiveSlug} onSelect={setActiveSlug} flat bg="surface-default" />
          </ScrollColumn>
        </div>,
        railSlot,
      )}

      <AppSurfacePage scrollClassName="xl:h-full">
        {/* Narrow (< xl): single-column nav list; tapping opens the detail route.
            `--list-top-pad` mirrors <main>'s top padding (pt-ha-4 / lg:pt-ha-5) so the
            nav's sticky search absorbs it and pins under the top bar without drift —
            same mechanism the devices list (DataListView) uses. */}
        <div className="xl:hidden max-w-2xl mx-auto [--list-top-pad:var(--ha-space-4)] lg:[--list-top-pad:var(--ha-space-5)]">
          <SettingsNavPanel
            activeSlug={null}
            onSelect={(slug) => router.push(`/settings/${slug}`)}
          />
        </div>

        {/* Wide (≥ xl): the open section, and — when the rail is switched off —
            the list beside it as a second column. Shares the dashboards' content
            shell (1536px + matching gutters) so the settings content edges line
            up with every other route. */}
        <div className={`hidden xl:flex xl:h-full ${CONTENT_SHELL}`}>
          {!settingsRailEnabled && (
            // In-page column: its own surface panel beside the section's, so the
            // two columns read as a pair. (The rail can't do this — it sits on
            // the shell background, where a panel would be a surface floating on
            // nothing.) Flat list inside: one surface, not cards within a card.
            <div className="h-full w-[312px] shrink-0 mr-ha-6">
              <div className="h-full rounded-ha-3xl bg-surface-default overflow-hidden pt-ha-4 px-ha-3">
                <ScrollColumn fade="from-surface-default">
                  <SettingsNavPanel activeSlug={effectiveActiveSlug} onSelect={setActiveSlug} flat bg="surface-default" />
                </ScrollColumn>
              </div>
            </div>
          )}
          <ScrollColumn className="flex-1 min-w-0">
            {/* Re-keyed per section so the pane fades/slides in instead of snapping.
                `h-full` lets a fill section (devices/integrations/automations) own
                its own scroll; flowing sections just overflow it and the column
                scrolls as before. */}
            {/* `isDesktop` is in the key so crossing the xl breakpoint remounts the
                pane: below xl this page claims the top bar for a plain "Settings"
                header, and only a remount makes the pane re-announce its own
                header (and with it the rail) on the way back up. */}
            <div key={`${effectiveActiveSlug}-${isDesktop}`} className="ha-pane-in h-full">
              <SettingsDetailPage slug={effectiveActiveSlug} panelMode onEditorFocusChange={setEditorFocus} onSelectSection={setActiveSlug} />
            </div>
          </ScrollColumn>
        </div>
      </AppSurfacePage>
    </>
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
