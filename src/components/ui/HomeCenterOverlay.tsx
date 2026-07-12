'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { SectionLabel } from './SectionLabel';
import { Avatar } from './Avatar';
import { ScrollFadeEdge } from './ScrollFadeEdge';
import { useHomeCenterContext } from '@/contexts/HomeCenterContext';
import { useCloseOnScreensaver } from '@/contexts';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useScrollFades } from '@/hooks/useScrollFades';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { useHomeAssistant, useHomeAssistantSelector } from '@/hooks';
import { HomeCenterStatusSections } from '@/components/sections/HomeCenterStatus';
import { useLiveSummaryItems } from '@/components/sections/SummariesPanel';
import { SummaryCard } from '@/components/cards/SummaryCard';
import { EnergyGlance, AutomationsGlance } from '@/components/glances';
import {
  arePeoplePresenceEqual,
  selectPeoplePresence,
  areActivityDataEqual,
  selectActivityData,
} from '@/lib/homeassistant/selectors';
import { resolveEntityPictureUrl } from '@/lib/utils';
import {
  mdiClose,
  mdiCog,
  mdiHomeVariant,
  mdiAccountGroup,
  mdiPlayCircle,
  mdiTimerSand,
  mdiDownloadCircleOutline,
  mdiBackupRestore,
  mdiRobotVacuum,
  mdiPrinter3d,
  mdiShieldAlert,
  mdiCctv,
  mdiPulse,
} from '@mdi/js';

interface HappeningItem {
  key: string;
  icon: string;
  color: string;
  label: string;
  detail: string;
  urgent?: boolean;
}

/**
 * The live bento content. Split out from the shell so its entity selectors and
 * ledger subscriptions only run while the surface is open (the shell stays
 * mounted at all times to drive the open/close animation).
 */
export function HomeCenterBento({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { haUrl } = useHomeAssistant();
  const presence = useHomeAssistantSelector(selectPeoplePresence, arePeoplePresenceEqual);
  const activity = useHomeAssistantSelector(selectActivityData, areActivityDataEqual);
  const glanceItems = useLiveSummaryItems();

  const pic = (picture?: string) => resolveEntityPictureUrl(haUrl, picture);

  const peopleHome = presence.peopleHome;
  const peopleAway = presence.peopleAway;
  const hasPeople = peopleHome.length + peopleAway.length > 0;

  // Everything live in the home, flattened into one "happening now" list.
  const happening = useMemo<HappeningItem[]>(() => {
    const items: HappeningItem[] = [];
    for (const a of activity.activeAlarms) {
      items.push({ key: `alarm-${a.entityId}`, icon: mdiShieldAlert, color: 'text-red-500', label: a.name, detail: a.state, urgent: true });
    }
    for (const u of activity.activeUpdateInstalls) {
      items.push({ key: `install-${u.entityId}`, icon: mdiDownloadCircleOutline, color: 'text-ha-blue', label: u.name, detail: u.percentage != null ? `Installing ${u.percentage}%` : 'Installing…' });
    }
    for (const b of activity.activeBackups) {
      items.push({ key: `backup-${b.entityId}`, icon: mdiBackupRestore, color: 'text-green-500', label: b.name, detail: b.stage ?? (b.progress != null ? `${b.progress}%` : 'Backing up…') });
    }
    for (const m of activity.activePlayers) {
      items.push({ key: `media-${m.entityId}`, icon: mdiPlayCircle, color: 'text-violet-500', label: m.mediaTitle ?? m.name, detail: m.mediaArtist ?? m.name });
    }
    for (const t of activity.activeTimers) {
      items.push({ key: `timer-${t.entityId}`, icon: mdiTimerSand, color: 'text-amber-500', label: t.name, detail: t.remaining });
    }
    for (const v of activity.activeVacuums) {
      items.push({ key: `vac-${v.entityId}`, icon: mdiRobotVacuum, color: 'text-ha-blue', label: v.name, detail: v.area ?? v.state });
    }
    for (const p of activity.activePrinters) {
      items.push({ key: `print-${p.entityId}`, icon: mdiPrinter3d, color: 'text-ha-blue', label: p.name, detail: p.remainingTime ?? `${p.progress}%` });
    }
    for (const c of activity.activeCameras) {
      items.push({ key: `cam-${c.entityId}`, icon: mdiCctv, color: 'text-text-secondary', label: c.name, detail: c.event ?? 'Motion' });
    }
    return items;
  }, [activity]);

  return (
    <>
      {/* ── At a glance ─────────────────────────────────────────── */}
      <section>
        <SectionLabel className="mb-ha-2 px-ha-1">At a glance</SectionLabel>

        {/* Compact glance chips — the same small widgets as the home dashboard
            summary row, so the preview reads at dashboard scale. */}
        <div className="flex flex-wrap items-center gap-ha-2 mb-ha-3 px-ha-1">
          <EnergyGlance compact />
          <AutomationsGlance compact />
          {glanceItems.map((item) => (
            <SummaryCard
              key={item.title}
              id={item.id}
              icon={item.icon}
              title={item.title}
              state={item.state}
              color={item.color}
              compact
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-ha-3">
          {/* People */}
          <div className="rounded-ha-2xl bg-surface-low p-ha-4 flex flex-col">
            <div className="flex items-center gap-ha-2 mb-ha-3">
              <Icon path={mdiAccountGroup} size={18} className="text-ha-blue" />
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Who&apos;s home</span>
              <span className="ml-auto text-sm font-semibold text-text-primary tabular-nums">
                {hasPeople ? `${peopleHome.length} home` : '—'}
              </span>
            </div>
            {hasPeople ? (
              <div className="flex flex-wrap gap-ha-3">
                {peopleHome.map((p) => (
                  <div key={p.id} className="flex items-center gap-ha-2">
                    <div className="relative">
                      <Avatar src={pic(p.picture)} initials={p.initials} alt={p.name} size="sm" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-surface-low" />
                    </div>
                    <span className="text-sm font-medium text-text-primary">{p.name}</span>
                  </div>
                ))}
                {peopleAway.map((p) => (
                  <div key={p.id} className="flex items-center gap-ha-2 opacity-60">
                    <Avatar src={pic(p.picture)} initials={p.initials} alt={p.name} size="sm" className="grayscale" />
                    <span className="text-sm font-medium text-text-secondary">{p.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">No people are being tracked.</p>
            )}
          </div>

          {/* Happening now */}
          <div className="rounded-ha-2xl bg-surface-low p-ha-4 flex flex-col">
            <div className="flex items-center gap-ha-2 mb-ha-3">
              <Icon path={mdiPulse} size={18} className="text-ha-blue" />
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Happening now</span>
              {happening.length > 0 && (
                <span className="ml-auto text-xs font-bold text-white bg-ha-blue px-1.5 py-0.5 rounded-md tabular-nums">{happening.length}</span>
              )}
            </div>
            {happening.length > 0 ? (
              <div className="space-y-ha-2">
                {happening.slice(0, 5).map((h) => (
                  <div key={h.key} className={`flex items-center gap-ha-3 rounded-xl p-ha-2 ${h.urgent ? 'bg-red-500/10' : 'bg-surface-mid/30'}`}>
                    <Icon path={h.icon} size={18} className={`${h.color} shrink-0`} />
                    <span className="text-sm font-medium text-text-primary truncate flex-1 min-w-0">{h.label}</span>
                    <span className="text-xs text-text-secondary shrink-0 truncate max-w-[45%]">{h.detail}</span>
                  </div>
                ))}
                {happening.length > 5 && (
                  <p className="text-xs text-text-tertiary px-ha-1">+{happening.length - 5} more</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">All quiet — nothing running right now.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Home Center status sections (masonry) ───────────────── */}
      <section>
        <SectionLabel className="mb-ha-2 px-ha-1">Home Center</SectionLabel>
        <div className="gap-ha-3 columns-1 sm:columns-2 lg:columns-3 [&>*]:mb-ha-3 [&>*]:break-inside-avoid">
          <HomeCenterStatusSections onNavigate={onNavigate} />
        </div>
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
            : 'w-full rounded-t-ha-3xl'
        } ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
        style={{ maxHeight: contained ? 'calc(92% - var(--ha-space-6))' : '90dvh', paddingBottom: 'env(safe-area-inset-bottom)', ...sheetDrag.dragStyle }}
        onTransitionEnd={() => {
          // Unmount once the slide-out has finished, so the body's data hooks
          // stop subscribing while the surface is closed.
          if (!homeCenterOpen && !visible) setMounted(false);
        }}
      >
        {/* Header: drag indicator + title + close. Doubles as the drag handle. */}
        <div
          {...sheetDrag.handleProps}
          className={`relative flex items-center justify-between gap-ha-3 px-ha-5 pt-ha-3 pb-ha-3 shrink-0 ${isDesktop ? '' : 'touch-none cursor-grab active:cursor-grabbing'}`}
        >
          <div className="flex items-center gap-ha-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ha-blue/10 text-ha-blue">
              <Icon path={mdiHomeVariant} size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text-primary leading-tight truncate">Home Center</h2>
              <p className="text-xs text-text-tertiary leading-tight truncate">Everything happening in your home</p>
            </div>
          </div>
          <div className="absolute left-1/2 top-ha-3 -translate-x-1/2 w-10 h-1 rounded-full bg-text-secondary/30" />
          <div className="flex items-center gap-ha-2 shrink-0">
            {/* Jump to the full Home Center settings page */}
            <button
              onClick={() => handleNavigate('/settings?section=home-center')}
              aria-label="Open Home Center settings"
              className="w-9 h-9 rounded-full bg-surface-lower flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            >
              <Icon path={mdiCog} size={18} />
            </button>
            <button
              onClick={closeHomeCenter}
              aria-label="Close Home Center"
              className="w-9 h-9 rounded-full bg-surface-lower flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            >
              <Icon path={mdiClose} size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable bento body with top/bottom scroll fades */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={setScrollNode}
            className={`h-full overflow-y-auto px-ha-5 pb-ha-6 pt-ha-1 space-y-ha-5 custom-scrollbar transition-opacity duration-300 ${
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
