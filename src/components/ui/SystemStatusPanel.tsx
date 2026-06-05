'use client';

import { useHomeAssistant, useHomeAssistantSelector } from '@/hooks';
import { areActivityDataEqual, selectActivityData } from '@/lib/homeassistant/selectors';
import { Icon } from './Icon';
import {
  mdiBell,
  mdiCheckCircleOutline,
  mdiAlertCircleOutline,
  mdiUpdate,
  mdiWeb,
  mdiCloudOutline,
  mdiCloudOffOutline,
} from '@mdi/js';

function Section({
  icon,
  label,
  tone,
  count,
  emptyLabel,
  children,
}: {
  icon: string;
  label: string;
  tone: 'default' | 'primary' | 'warning' | 'danger';
  count: number;
  emptyLabel: string;
  children?: React.ReactNode;
}) {
  const toneIcon: Record<string, string> = {
    default: 'text-text-secondary',
    primary: 'text-ha-blue',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
  };
  const toneBadge: Record<string, string> = {
    default: 'text-text-tertiary bg-surface-mid',
    primary: 'text-ha-blue bg-fill-primary-normal',
    warning: 'text-yellow-600 bg-yellow-500/15',
    danger: 'text-red-500 bg-red-500/10',
  };

  return (
    <div>
      <div className="flex items-center gap-ha-2 mb-ha-2">
        <Icon path={icon} size={14} className={toneIcon[tone]} />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-tertiary flex-1">{label}</span>
        {count > 0 && (
          <span className={`text-[10px] font-semibold px-ha-2 py-0.5 rounded-full ${toneBadge[tone]}`}>{count}</span>
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

export function SystemStatusPanel() {
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

  return (
    <div className="space-y-ha-4">
      {/* Notifications */}
      <Section icon={mdiBell} label="Notifications" tone={activeNotifications.length > 0 ? 'warning' : 'default'} count={activeNotifications.length} emptyLabel="No notifications">
        {activeNotifications.map((n) => (
          <Row key={n.id} primary={n.title} secondary={n.message} />
        ))}
      </Section>

      {/* Updates */}
      <Section icon={mdiUpdate} label="Updates" tone={activeUpdates.length > 0 ? 'primary' : 'default'} count={activeUpdates.length} emptyLabel="System up to date">
        {activeUpdates.map((u) => (
          <Row key={u.id} primary={u.name} />
        ))}
      </Section>

      {/* Issues */}
      <Section icon={mdiAlertCircleOutline} label="Issues" tone={offlineDevices.length > 0 ? 'danger' : 'default'} count={offlineDevices.length} emptyLabel="All devices reachable">
        {offlineDevices.map((d) => (
          <Row key={d.id} primary={d.name} secondary="Unavailable" />
        ))}
      </Section>

      {/* Connectivity */}
      <div>
        <div className="flex items-center gap-ha-2 mb-ha-2">
          <Icon path={mdiWeb} size={14} className="text-text-secondary" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-tertiary">Connectivity</span>
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
    </div>
  );
}
