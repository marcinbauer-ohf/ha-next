'use client';

import { useMemo } from 'react';
import { Icon } from '../ui/Icon';
import { useHomeAssistant, useHomeAssistantSelector } from '@/hooks';
import { areActivityDataEqual, selectActivityData } from '@/lib/homeassistant/selectors';
import { useLiveSummaryItems, PeopleBadge } from '@/components/sections/SummariesPanel';
import { SummaryCard } from '@/components/cards/SummaryCard';
import { SystemStatusPanel } from '@/components/ui/SystemStatusPanel';
import {
  mdiCctv,
  mdiCloudOffOutline,
  mdiHomeAssistant,
  mdiNewspaperVariantOutline,
  mdiPlayCircleOutline,
  mdiPrinter3d,
  mdiTimerOutline,
} from '@mdi/js';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-ha-3xl border border-surface-lower bg-surface-default p-ha-5 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.28)] ${className}`}>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-tertiary mb-ha-3">{children}</p>
  );
}

export function SettingsOverview() {
  const { connected, connecting, demoMode, haUrl } = useHomeAssistant();
  const liveSummaryItems = useLiveSummaryItems();
  const activityData = useHomeAssistantSelector(selectActivityData, areActivityDataEqual);

  const connectionLabel = demoMode ? 'Demo home' : connecting ? 'Connecting…' : connected ? 'Connected' : 'Offline';
  const connectionTone = demoMode ? 'warning' : connected ? 'success' : 'error';
  const toneClasses = {
    success: { dot: 'bg-green-500', badge: 'text-green-600 bg-green-500/10' },
    warning: { dot: 'bg-yellow-500', badge: 'text-yellow-600 bg-yellow-500/10' },
    error: { dot: 'bg-red-500', badge: 'text-red-500 bg-red-500/10' },
  };

  const activityCards = useMemo(() => {
    const cards: Array<{
      id: string; icon: string; label: string; headline: string; detail: string;
      panelClassName: string; iconClassName: string; badgeClassName: string; count?: number;
    }> = [];

    if (activityData.activeReleaseNotes.length > 0) {
      const note = activityData.activeReleaseNotes[0];
      cards.push({
        id: 'release', icon: mdiNewspaperVariantOutline, label: "What's New",
        headline: note.name, detail: `Version ${note.version}`,
        panelClassName: 'bg-fill-primary-normal/45 border-fill-primary-quiet/80',
        iconClassName: 'text-ha-blue', badgeClassName: 'bg-fill-primary-normal text-ha-blue',
        count: activityData.activeReleaseNotes.length > 1 ? activityData.activeReleaseNotes.length : undefined,
      });
    }

    if (activityData.activePlayers.length > 0) {
      const player = activityData.activePlayers[0];
      cards.push({
        id: 'media', icon: mdiPlayCircleOutline, label: 'Media',
        headline: player.mediaTitle || player.name,
        detail: [player.mediaArtist, player.name].filter(Boolean).join(' · ') || (player.state === 'paused' ? 'Paused' : 'Playing'),
        panelClassName: 'bg-green-500/10 border-green-500/20',
        iconClassName: 'text-green-600', badgeClassName: 'bg-green-500/15 text-green-600',
        count: activityData.activePlayers.length > 1 ? activityData.activePlayers.length : undefined,
      });
    }

    if (activityData.activeTimers.length > 0) {
      const timer = activityData.activeTimers[0];
      cards.push({
        id: 'timer', icon: mdiTimerOutline, label: 'Timer',
        headline: timer.name,
        detail: timer.state === 'paused' ? `Paused · ${timer.remaining}` : `${timer.remaining} remaining`,
        panelClassName: 'bg-fill-primary-normal/45 border-fill-primary-quiet/80',
        iconClassName: 'text-ha-blue', badgeClassName: 'bg-fill-primary-normal text-ha-blue',
        count: activityData.activeTimers.length > 1 ? activityData.activeTimers.length : undefined,
      });
    }

    if (activityData.activeCameras.length > 0) {
      const camera = activityData.activeCameras[0];
      cards.push({
        id: 'camera', icon: mdiCctv, label: 'Camera',
        headline: camera.name,
        detail: camera.event || (camera.state === 'person' ? 'Person detected' : 'Motion detected'),
        panelClassName: 'bg-red-500/10 border-red-500/20',
        iconClassName: 'text-red-500', badgeClassName: 'bg-red-500/15 text-red-500',
        count: activityData.activeCameras.length > 1 ? activityData.activeCameras.length : undefined,
      });
    }

    if (activityData.activePrinters.length > 0) {
      const printer = activityData.activePrinters[0];
      const progress = `${Math.round(printer.progress)}% complete`;
      cards.push({
        id: 'printer', icon: mdiPrinter3d, label: 'Printer',
        headline: printer.fileName || printer.name,
        detail: printer.remainingTime ? `${progress} · ${printer.remainingTime} left` : progress,
        panelClassName: 'bg-surface-low border-surface-low/80',
        iconClassName: 'text-text-primary', badgeClassName: 'bg-surface-default text-text-primary',
        count: activityData.activePrinters.length > 1 ? activityData.activePrinters.length : undefined,
      });
    }

    return cards;
  }, [activityData]);

  return (
    <div className="space-y-ha-5 pb-ha-5">
      {/* Connection */}
      <Card>
        <div className="flex items-center gap-ha-4">
          <div className="w-10 h-10 flex items-center justify-center rounded-ha-xl bg-surface-mid flex-shrink-0">
            <Icon path={connected && !demoMode ? mdiHomeAssistant : demoMode ? mdiHomeAssistant : mdiCloudOffOutline} size={20} className="text-text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">Home Assistant</p>
            <p className="text-xs text-text-secondary truncate">
              {demoMode ? 'Running with bundled demo data' : haUrl || 'No server configured'}
            </p>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-ha-3 py-1 rounded-full flex-shrink-0 ${toneClasses[connectionTone].badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${toneClasses[connectionTone].dot}`} />
            {connectionLabel}
          </span>
        </div>
      </Card>

      {/* Home at a glance */}
      <Card>
        <SectionLabel>Home</SectionLabel>
        <div className="flex flex-wrap gap-ha-2">
          <PeopleBadge compact variant="compact" />
          {liveSummaryItems.map((item) => (
            <SummaryCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              state={item.state}
              color={item.color}
              compact
              variant="outlined"
            />
          ))}
        </div>
      </Card>

      {/* Active now */}
      {activityCards.length > 0 && (
        <Card>
          <SectionLabel>Active Now</SectionLabel>
          <div className="space-y-ha-2">
            {activityCards.map((activity) => (
              <div
                key={activity.id}
                className={`flex items-center gap-ha-3 rounded-ha-2xl border px-ha-3 py-ha-3 ${activity.panelClassName}`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl bg-surface-default/80 ${activity.iconClassName}`}>
                  <Icon path={activity.icon} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-ha-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                      {activity.label}
                    </p>
                    {activity.count && (
                      <span className={`rounded-ha-pill px-ha-2 py-0.5 text-[10px] font-semibold ${activity.badgeClassName}`}>
                        {activity.count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-text-primary truncate">{activity.headline}</p>
                  <p className="text-xs text-text-secondary truncate">{activity.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* System status — same sections as clock widget popup */}
      <SystemStatusPanel />
    </div>
  );
}
