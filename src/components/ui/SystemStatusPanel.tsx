'use client';

import { useHomeAssistant, useHomeAssistantSelector } from '@/hooks';
import { areActivityDataEqual, selectActivityData } from '@/lib/homeassistant/selectors';
import { Icon } from './Icon';
import { SectionLabel } from './SectionLabel';
import {
  mdiCheckCircleOutline,
  mdiChevronRight,
  mdiWeb,
  mdiCloudOutline,
  mdiCloudOffOutline,
} from '@mdi/js';

function Section({
  label,
  tone,
  count,
  emptyLabel,
  onNavigate,
  children,
}: {
  label: string;
  tone: 'default' | 'primary' | 'warning' | 'danger';
  count: number;
  emptyLabel: string;
  onNavigate?: () => void;
  children?: React.ReactNode;
}) {
  const toneBadge: Record<string, string> = {
    default: 'text-text-tertiary bg-surface-mid',
    primary: 'text-ha-blue bg-fill-primary-normal',
    warning: 'text-yellow-600 bg-yellow-500/15',
    danger: 'text-red-500 bg-red-500/10',
  };

  return (
    <div>
      <div className="flex items-center gap-ha-2 mb-ha-2">
        <SectionLabel className="flex-1">{label}</SectionLabel>
        {count > 0 && (
          <span className={`text-[10px] font-semibold px-ha-2 py-0.5 rounded-full ${toneBadge[tone]}`}>{count}</span>
        )}
        {onNavigate && (
          <button type="button" onClick={onNavigate} className="text-text-disabled hover:text-text-secondary transition-colors -mr-1">
            <Icon path={mdiChevronRight} size={14} />
          </button>
        )}
      </div>
      <div className="rounded-ha-2xl border border-surface-lower bg-surface-default overflow-hidden">
        {count === 0 ? (
          <div className="flex items-center gap-ha-2 px-ha-4 py-ha-3">
            <Icon path={mdiCheckCircleOutline} size={15} className="text-green-500 flex-shrink-0" />
            <span className="text-sm text-text-secondary">{emptyLabel}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Row({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <div className="flex items-start gap-ha-3 px-ha-4 py-ha-3 border-b border-surface-low/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{primary}</p>
        {secondary && <p className="text-xs text-text-secondary mt-0.5">{secondary}</p>}
      </div>
    </div>
  );
}

export type HomeCenterSection = 'notifications' | 'updates' | 'issues' | 'connectivity';

export function SystemStatusPanel({
  onNavigate,
  focus,
}: {
  /** Called with the section the user wants to open in full. */
  onNavigate?: (target: HomeCenterSection) => void;
  /** When set, renders only that section (full-page view). */
  focus?: HomeCenterSection;
} = {}) {
  const { connected, connecting, demoMode, haUrl } = useHomeAssistant();
  const activityData = useHomeAssistantSelector(selectActivityData, areActivityDataEqual);
  const { activeNotifications, activeUpdates, offlineDevices, isRemoteConnected } = activityData;

  const connStatus = demoMode ? 'Demo' : connecting ? 'Connecting' : connected ? 'Connected' : 'Offline';
  const connTone = demoMode ? 'warning' : connected ? 'default' : 'danger';
  const connToneIcon: Record<string, string> = {
    warning: 'text-yellow-500',
    default: 'text-green-500',
    danger: 'text-red-500',
  };

  const shows = (section: HomeCenterSection) => !focus || focus === section;
  const navTo = (section: HomeCenterSection) =>
    onNavigate ? () => onNavigate(section) : undefined;

  return (
    <div className="space-y-ha-4">
      {/* Notifications */}
      {shows('notifications') && (
      <Section label="Notifications" tone={activeNotifications.length > 0 ? 'warning' : 'default'} count={activeNotifications.length} emptyLabel="No notifications" onNavigate={navTo('notifications')}>
        {activeNotifications.map((n) => (
          <Row key={n.id} primary={n.title} secondary={n.message} />
        ))}
      </Section>
      )}

      {/* Updates */}
      {shows('updates') && (
      <Section label="Updates" tone={activeUpdates.length > 0 ? 'primary' : 'default'} count={activeUpdates.length} emptyLabel="System up to date" onNavigate={navTo('updates')}>
        {activeUpdates.map((u) => (
          <Row key={u.id} primary={u.name} />
        ))}
      </Section>
      )}

      {/* Issues */}
      {shows('issues') && (
      <Section label="Issues" tone={offlineDevices.length > 0 ? 'danger' : 'default'} count={offlineDevices.length} emptyLabel="All devices reachable" onNavigate={navTo('issues')}>
        {offlineDevices.map((d) => (
          <Row key={d.id} primary={d.name} secondary="Unavailable" />
        ))}
      </Section>
      )}

      {/* Connectivity */}
      {shows('connectivity') && (
      <div>
        <div className="flex items-center gap-ha-2 mb-ha-2">
          <SectionLabel className="flex-1">Connectivity</SectionLabel>
          {navTo('connectivity') && (
            <button type="button" onClick={navTo('connectivity')} className="text-text-disabled hover:text-text-secondary transition-colors -mr-1">
              <Icon path={mdiChevronRight} size={14} />
            </button>
          )}
        </div>
        <div className="rounded-ha-2xl border border-surface-lower bg-surface-default overflow-hidden">
          <div className="flex items-center gap-ha-3 px-ha-4 py-ha-3 border-b border-surface-low/40">
            <Icon path={connected || demoMode ? mdiCloudOutline : mdiCloudOffOutline} size={15} className={connToneIcon[connTone]} />
            <span className="flex-1 text-sm text-text-secondary">Home Assistant</span>
            <span className={`text-sm font-medium ${connToneIcon[connTone]}`}>{connStatus}</span>
          </div>
          <div className="flex items-center gap-ha-3 px-ha-4 py-ha-3">
            <Icon path={mdiWeb} size={15} className={isRemoteConnected ? 'text-green-500' : 'text-text-disabled'} />
            <span className="flex-1 text-sm text-text-secondary">Remote access</span>
            <span className={`text-sm font-medium ${isRemoteConnected ? 'text-green-500' : 'text-text-tertiary'}`}>
              {isRemoteConnected ? 'Active' : 'Off'}
            </span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
