'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { NavChevron } from './NavChevron';
import { ActivityFeed } from './ActivityFeed';
import { ScrollFadeEdge } from './ScrollFadeEdge';
import { useHomeCenterContext } from '@/contexts/HomeCenterContext';
import { useCloseOnScreensaver, useNotificationCenter } from '@/contexts';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useScrollFades } from '@/hooks/useScrollFades';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { useHomeAssistant, useHomeAssistantSelector, useHomeCenterPrefs } from '@/hooks';
import { useActivities } from '@/hooks/useActivities';
import { buildActivityFeed } from '@/lib/activities/feed';
import { isHomeCenterSectionVisible } from '@/components/profile/settingsNavigation';
import { SheetHeader, SHEET_PAD, sheetHeaderButton } from '@/components/cards/dialogKit';
import { useLiveSummaryItems } from '@/components/sections/SummariesPanel';
import { EnergyGlance, AutomationsGlance, SummaryGlance } from '@/components/glances';
import { areActivityDataEqual, selectActivityData } from '@/lib/homeassistant/selectors';
import { formatBackupAge, HOME_CENTER_SECTION_MAP, type HomeCenterSectionId } from '@/lib/homeCenter';
import { mdiCheckCircleOutline, mdiCog } from '@mdi/js';

/** One thing asking for attention, folded up from a Home Center section. */
interface AttentionGroup {
  id: HomeCenterSectionId;
  count: number;
  /** The things themselves, so the row says what, not just how many. */
  names: string[];
  path: string;
}

// Bento card skin. Two steps up from the sheet it sits on plus a hairline, so a
// card still reads as a card in the light themes, where the surface ramp between
// default and low is only a few percent. Both hosts (this sheet and the mobile
// nav's expanded panel) ground the bento on surface-default, so one skin serves.
const CARD = 'rounded-ha-2xl bg-surface-mid border border-surface-lower';

/**
 * The live bento content. Split out from the shell so its entity selectors and
 * ledger subscriptions only run while the surface is open (the shell stays
 * mounted at all times to drive the open/close animation).
 *
 * One question first — is anything asking for me? — then what's running, then
 * the quiet facts. The eight status cards live on in the clock pop-up and the
 * mobile nav; here they're folded into a single list, because a wall of badged
 * cards answers that question slower than a sentence does.
 */
export function HomeCenterBento({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { demoMode, connected, connecting, isAdmin } = useHomeAssistant();
  const activity = useHomeAssistantSelector(selectActivityData, areActivityDataEqual);
  const { notifications: appNotifications } = useNotificationCenter();
  const { activities } = useActivities();
  const { visibleSections } = useHomeCenterPrefs();
  const glanceItems = useLiveSummaryItems();

  const feed = buildActivityFeed(activities);

  // Same set, same order and same admin gating as every other Home Center
  // surface — only folded into one list instead of one card each.
  const shown = visibleSections.filter((id) => isHomeCenterSectionVisible(id, isAdmin));
  const groups = ([
    { id: 'notifications', count: appNotifications.length + activity.activeNotifications.length, names: [...appNotifications.map((n) => n.title), ...activity.activeNotifications.map((n) => n.title)], path: '/settings?section=notifications' },
    { id: 'updates', count: activity.activeUpdates.length, names: activity.activeUpdates.map((u) => u.name), path: '/settings?section=updates' },
    { id: 'repairs', count: activity.repairs.length, names: activity.repairs.map((r) => r.title), path: '/settings?section=repairs' },
    { id: 'issues', count: activity.offlineDevices.length, names: activity.offlineDevices.map((d) => d.name), path: '/settings?section=repairs' },
    { id: 'battery', count: activity.lowBatteryDevices.length, names: activity.lowBatteryDevices.map((b) => `${b.name} ${b.level}%`), path: '/settings?section=home-center' },
  ] as AttentionGroup[]).filter((g) => g.count > 0 && shown.includes(g.id));

  const backup = formatBackupAge(activity.lastBackup?.lastBackup ?? null);

  const facts: { label: string; value: string }[] = [
    { label: 'Home Assistant', value: demoMode ? 'Demo' : connecting ? 'Connecting' : connected ? 'Connected' : 'Offline' },
    { label: 'Remote access', value: activity.isRemoteConnected ? 'On' : 'Off' },
    ...(shown.includes('backups') ? [{ label: 'Backup', value: backup.label.replace('Backed up ', '') }] : []),
  ];

  return (
    <>
      {/* ── The chips ───────────────────────────────────────────────
          No headline and no faces: the Needs-you card below already says what
          wants attention, and the chips carry their own pill surfaces, so a
          card (or a heading) around them read as a box of boxes. No padding
          either — this block's edges are the cards' edges below it. */}
      <section>
        <div className="flex flex-wrap items-center gap-ha-2">
          <EnergyGlance compact />
          <AutomationsGlance compact />
          {glanceItems.map((item) => (
            <SummaryGlance key={item.title} item={item} compact />
          ))}
        </div>
      </section>

      {/* ── Needs you / Happening now ───────────────────────────── */}
      <section className="grid grid-cols-1 gap-ha-3 lg:grid-cols-2">
        <div className={`${CARD} p-ha-2`}>
          <h4 className="px-ha-2 pb-ha-2 pt-ha-1 text-xs font-bold uppercase tracking-wider text-text-secondary">Needs you</h4>
          {groups.length === 0 ? (
            <p className="flex items-center gap-ha-2 px-ha-2 pb-ha-2 text-sm text-text-tertiary">
              <Icon path={mdiCheckCircleOutline} size={18} className="shrink-0" />
              Nothing to fix, install or replace.
            </p>
          ) : (
            <div className="flex flex-col">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onNavigate(g.path)}
                  className="group flex items-center gap-ha-3 rounded-ha-xl px-ha-2 py-ha-2 text-left transition-colors hover:bg-surface-lower/60"
                >
                  <Icon path={HOME_CENTER_SECTION_MAP[g.id].icon} size={20} className="shrink-0 text-text-tertiary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text-primary">
                      {HOME_CENTER_SECTION_MAP[g.id].label}
                    </span>
                    <span className="block truncate text-xs text-text-tertiary">{g.names.join(', ')}</span>
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-text-secondary">{g.count}</span>
                  <NavChevron size={16} className="shrink-0 text-text-disabled group-hover:text-text-secondary" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`${CARD} p-ha-2`}>
          <button
            type="button"
            onClick={() => onNavigate('/settings?section=activity')}
            className="group flex w-full items-center gap-ha-2 px-ha-2 pb-ha-2 pt-ha-1"
          >
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary group-hover:text-text-primary">Happening now</h4>
            <NavChevron size={16} className="ml-auto text-text-disabled group-hover:text-text-secondary" />
          </button>
          {feed.length > 0 ? (
            <div className="overflow-hidden rounded-ha-xl bg-surface-lower/50">
              <ActivityFeed items={feed} />
            </div>
          ) : (
            <p className="px-ha-2 pb-ha-2 text-sm text-text-tertiary">Nothing is running right now.</p>
          )}
        </div>
      </section>

      {/* ── The quiet facts ─────────────────────────────────────── */}
      <section className={`${CARD} flex flex-wrap gap-ha-3 px-ha-4 py-ha-3`}>
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0 flex-1">
            <p className="truncate text-xs uppercase tracking-wider text-text-tertiary">{fact.label}</p>
            <p className="truncate text-sm font-semibold text-text-primary">{fact.value}</p>
          </div>
        ))}
      </section>
    </>
  );
}

/**
 * Home Center — a bento surface that opens like the Assist widget (slide-up
 * sheet, contained to the dashboard panel on desktop / full sheet on mobile).
 * Reached from the "Open Home Center" CTA in the status pop-up.
 */
export function HomeCenterOverlay() {
  const router = useRouter();
  const { homeCenterOpen, closeHomeCenter } = useHomeCenterContext();
  useCloseOnScreensaver(homeCenterOpen, closeHomeCenter);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { attach: attachFades, showTop, showBottom } = useScrollFades<HTMLDivElement>();

  // Desktop: contain the sheet to the dashboard panel (portaled into the shared
  // #toast-glow-root clip layer) instead of a viewport-wide sheet — same as Assist.
  const [isDesktop, setIsDesktop] = useState(false);
  const [glowRoot, setGlowRoot] = useState<HTMLElement | null>(null);

  useFocusTrap(homeCenterOpen, containerRef);

  const sheetDrag = useSheetDrag({ onClose: closeHomeCenter, disabled: isDesktop });

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setGlowRoot(document.getElementById('toast-glow-root')));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Mount/unmount with the shared slide-up stagger. setState is deferred into
  // rAF callbacks (never called synchronously in the effect body) so the mount
  // frame paints the pre-transition state — same recipe as SystemUpdateOverlay.
  useEffect(() => {
    let raf1: number | null = null;
    let raf2: number | null = null;
    if (homeCenterOpen) {
      raf1 = requestAnimationFrame(() => {
        setMounted(true);
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
    } else {
      raf1 = requestAnimationFrame(() => setVisible(false));
    }
    return () => {
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [homeCenterOpen]);

  // Escape to close
  useEffect(() => {
    if (!homeCenterOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeHomeCenter();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [homeCenterOpen, closeHomeCenter]);

  const handleNavigate = (path: string) => {
    closeHomeCenter();
    router.push(path);
  };

  const setScrollNode = (el: HTMLDivElement | null) => {
    scrollRef.current = el;
    attachFades(el);
  };

  const scrollToEdge = (edge: 'top' | 'bottom') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: edge === 'top' ? 0 : el.scrollHeight, behavior: 'smooth' });
  };

  if (!mounted) return null;

  const contained = isDesktop && glowRoot != null;

  const dialog = (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Home Center"
      className={contained
        ? 'absolute dashboard-panel-clip z-[70] flex flex-col pointer-events-auto'
        : 'fixed inset-0 z-[100] flex flex-col'}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeHomeCenter}
      />

      {/* Panel — slides up. Contained variant floats inset from the panel edges
          (same margin as the corner toast / Assist), full sheet on mobile. */}
      <div
        className={`relative mt-auto bg-surface-default transition-[transform,opacity] duration-300 ease-out flex flex-col ${
          contained
            ? 'mx-ha-6 mb-ha-6 rounded-ha-3xl border border-surface-low/50 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)]'
            // border-white/10 was invisible on the light themes — a token edge
            // plus an upward shadow so the sheet lifts off the page in both.
            : 'w-full rounded-t-ha-sheet border-t border-surface-mid shadow-[0_-16px_40px_-12px_rgba(0,0,0,0.45)]'
        } ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
        style={{ maxHeight: contained ? 'calc(92% - var(--ha-space-6))' : '90dvh', paddingBottom: 'env(safe-area-inset-bottom)', ...sheetDrag.dragStyle }}
        onTransitionEnd={() => {
          // Unmount once the slide-out has finished, so the body's data hooks
          // stop subscribing while the surface is closed.
          if (!homeCenterOpen && !visible) setMounted(false);
        }}
      >
        {/* Header: the shared one, wrapped so the row still drags the sheet and
            still carries the grabber pill. */}
        <div
          {...sheetDrag.handleProps}
          className={`relative shrink-0 ${isDesktop ? '' : 'touch-none cursor-grab active:cursor-grabbing'}`}
        >
          <div className="absolute left-1/2 top-ha-3 -translate-x-1/2 w-10 h-1 rounded-full bg-text-secondary/30" />
          <SheetHeader
            eyebrow="Your home"
            title="Home Center"
            onClose={closeHomeCenter}
            actions={
              /* Jump to the full Home Center settings page */
              <button
                onClick={() => handleNavigate('/settings?section=home-center')}
                aria-label="Open Home Center settings"
                className={sheetHeaderButton}
              >
                <Icon path={mdiCog} size={24} />
              </button>
            }
          />
        </div>

        {/* Scrollable bento body with top/bottom scroll fades */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={setScrollNode}
            className={`h-full overflow-y-auto ${SHEET_PAD} pb-ha-6 pt-ha-1 space-y-ha-5 custom-scrollbar transition-opacity duration-300 ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <HomeCenterBento onNavigate={handleNavigate} />
          </div>

          {/* Scroll fades */}
          <ScrollFadeEdge
            edge="top"
            visible={showTop}
            onClick={() => scrollToEdge('top')}
            className="absolute top-0 inset-x-0 h-10 bg-gradient-to-b from-surface-default to-transparent transition-opacity duration-300"
          />
          <ScrollFadeEdge
            edge="bottom"
            visible={showBottom}
            onClick={() => scrollToEdge('bottom')}
            className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-surface-default to-transparent transition-opacity duration-300"
          />
        </div>
      </div>
    </div>
  );

  return glowRoot && contained ? createPortal(dialog, glowRoot) : dialog;
}
