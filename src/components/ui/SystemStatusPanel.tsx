'use client';

import { useHomeAssistant, useHomeAssistantSelector, useHomeCenterPrefs } from '@/hooks';
import { useNotificationCenter } from '@/contexts';
import { areActivityDataEqual, selectActivityData } from '@/lib/homeassistant/selectors';
import { formatBackupAge, type HomeCenterSectionId } from '@/lib/homeCenter';
import { Icon } from './Icon';
import { NavChevron } from './NavChevron';
import { CountBadge } from './CountBadge';
import { SectionLabel } from './SectionLabel';
import {
  mdiCheckCircleOutline,
  mdiWeb,
  mdiCloudOutline,
  mdiCloudOffOutline,
  mdiBackupRestore,
  mdiClose,
} from '@mdi/js';

const TONE_BADGE: Record<string, string> = {
  default: 'text-text-tertiary bg-surface-mid',
  primary: 'text-ha-blue bg-fill-primary-normal',
  warning: 'text-orange-600 bg-orange-500/15',
  danger: 'text-red-500 bg-red-500/10',
};

// Section header: label, optional count badge (between label and arrow), and an
// optional navigation arrow that hugs the text. On hover the whole header
// highlights and the arrow nudges right to hint at "open for more".
function SectionHeader({
  label,
  tone = 'default',
  count = 0,
  onNavigate,
}: {
  label: string;
  tone?: 'default' | 'primary' | 'warning' | 'danger';
  count?: number;
  onNavigate?: () => void;
}) {
  const inner = (
    <>
      <SectionLabel className="group-hover:text-text-secondary transition-colors">{label}</SectionLabel>
      <CountBadge count={count} className={TONE_BADGE[tone]} />
      {onNavigate && (
        <NavChevron size={14} className="text-text-disabled group-hover:text-text-secondary" />
      )}
    </>
  );

  return (
    // Sticky caption — pins below the settings title (its measured height is
    // published as --settings-header-h; 0 on the full-page route) so you can see
    // which Home Center section you're scrolling. Sticks within its own section.
    <div
      className="sticky z-10 bg-surface-lower pb-ha-2"
      style={{ top: 'var(--settings-header-h, 0px)' }}
    >
      {onNavigate ? (
        <button type="button" onClick={onNavigate} className="group flex items-center gap-ha-2 w-fit">
          {inner}
        </button>
      ) : (
        <div className="flex items-center gap-ha-2">{inner}</div>
      )}
    </div>
  );
}

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
  return (
    <div>
      <SectionHeader label={label} tone={tone} count={count} onNavigate={onNavigate} />
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

function Row({
  primary,
  secondary,
  trailing,
  dotClass,
  onAct,
  onDismiss,
}: {
  primary: string;
  secondary?: string;
  trailing?: string;
  /** Coloured leading dot, e.g. for repair severity. */
  dotClass?: string;
  /** Tap the row to act on it (e.g. enter device setup), then clear it. */
  onAct?: () => void;
  /** Show a ✕ to clear the row without acting. */
  onDismiss?: () => void;
}) {
  const body = (
    <>
      {dotClass && <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${dotClass}`} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{primary}</p>
        {secondary && <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{secondary}</p>}
      </div>
      {trailing && <span className="text-sm font-semibold text-text-secondary tabular-nums flex-shrink-0">{trailing}</span>}
    </>
  );

  if (onAct || onDismiss) {
    return (
      <div className="flex items-start gap-ha-3 px-ha-4 py-ha-3 border-b border-surface-low/40 last:border-0 hover:bg-surface-low/40 transition-colors">
        <button
          type="button"
          onClick={onAct}
          disabled={!onAct}
          className="flex items-start gap-ha-3 flex-1 min-w-0 text-left disabled:cursor-default"
        >
          {body}
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="flex-shrink-0 -mr-1 px-1 py-0.5 text-text-disabled hover:text-text-secondary transition-colors"
          >
            <Icon path={mdiClose} size={15} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-ha-3 px-ha-4 py-ha-3 border-b border-surface-low/40 last:border-0">
      {body}
    </div>
  );
}

/** Every Home Center section deep-links to a settings destination. */
export type HomeCenterSection = HomeCenterSectionId;

export function SystemStatusPanel({
  onNavigate,
  focus,
}: {
  /** Called with the section the user wants to open in full. */
  onNavigate?: (target: HomeCenterSection) => void;
  /** When set, renders only that section (full-page view). */
  focus?: HomeCenterSection;
} = {}) {
  const { connected, connecting, demoMode } = useHomeAssistant();
  const activityData = useHomeAssistantSelector(selectActivityData, areActivityDataEqual);
  const { visibleSections } = useHomeCenterPrefs();
  const { notifications: centerNotifications, removeNotification } = useNotificationCenter();
  const {
    activeNotifications,
    activeUpdates,
    offlineDevices,
    repairs,
    lowBatteryDevices,
    lastBackup,
    isRemoteConnected,
  } = activityData;

  const connStatus = demoMode ? 'Demo' : connecting ? 'Connecting' : connected ? 'Connected' : 'Offline';
  const connTone = demoMode ? 'warning' : connected ? 'default' : 'danger';
  const connToneIcon: Record<string, string> = {
    warning: 'text-yellow-500',
    default: 'text-green-500',
    danger: 'text-red-500',
  };

  const navTo = (section: HomeCenterSectionId) =>
    onNavigate ? () => onNavigate(section) : undefined;

  // When focused (single full-page view), show only that section in default order.
  // Otherwise honour the user's configured order + enabled set.
  const sections: HomeCenterSectionId[] = focus ? [focus] : visibleSections;

  const renderSection = (id: HomeCenterSectionId) => {
    switch (id) {
      case 'notifications': {
        // App-generated notifications (dismissed toasts, e.g. device discovery)
        // first, then Home Assistant's persistent_notification.* entities.
        const total = centerNotifications.length + activeNotifications.length;
        return (
          <Section key={id} label="Notifications" tone={total > 0 ? 'warning' : 'default'} count={total} emptyLabel="No notifications" onNavigate={navTo('notifications')}>
            {centerNotifications.map((n) => (
              <Row
                key={n.id}
                primary={n.title}
                secondary={n.message}
                onAct={n.onAct ? () => { n.onAct!(); removeNotification(n.id); } : undefined}
                onDismiss={() => removeNotification(n.id)}
              />
            ))}
            {activeNotifications.map((n) => (
              <Row key={n.id} primary={n.title} secondary={n.message} />
            ))}
          </Section>
        );
      }
      case 'updates':
        return (
          <Section key={id} label="Updates" tone={activeUpdates.length > 0 ? 'primary' : 'default'} count={activeUpdates.length} emptyLabel="System up to date" onNavigate={navTo('updates')}>
            {activeUpdates.map((u) => (
              <Row key={u.id} primary={u.name} />
            ))}
          </Section>
        );
      case 'repairs': {
        const hasCritical = repairs.some((r) => r.severity === 'critical');
        return (
          <Section key={id} label="Repairs" tone={hasCritical ? 'danger' : repairs.length > 0 ? 'warning' : 'default'} count={repairs.length} emptyLabel="Nothing needs fixing" onNavigate={navTo('repairs')}>
            {repairs.map((r) => (
              <Row
                key={r.id}
                primary={r.title}
                secondary={r.description}
                dotClass={r.severity === 'critical' ? 'bg-red-500' : 'bg-orange-500'}
              />
            ))}
          </Section>
        );
      }
      case 'issues':
        return (
          <Section key={id} label="Offline devices" tone={offlineDevices.length > 0 ? 'danger' : 'default'} count={offlineDevices.length} emptyLabel="All devices reachable" onNavigate={navTo('issues')}>
            {offlineDevices.map((d) => (
              <Row key={d.id} primary={d.name} secondary="Unavailable" />
            ))}
          </Section>
        );
      case 'battery':
        return (
          <Section key={id} label="Low battery" tone={lowBatteryDevices.length > 0 ? 'warning' : 'default'} count={lowBatteryDevices.length} emptyLabel="All batteries healthy" onNavigate={navTo('battery')}>
            {lowBatteryDevices.map((b) => (
              <Row
                key={b.id}
                primary={b.name}
                trailing={`${b.level}%`}
                dotClass={b.level <= 10 ? 'bg-red-500' : 'bg-amber-500'}
              />
            ))}
          </Section>
        );
      case 'backups': {
        const { label, stale } = formatBackupAge(lastBackup?.lastBackup ?? null);
        const navBackups = navTo('backups');
        return (
          <div key={id}>
            <SectionHeader label="Backups" onNavigate={navBackups} />
            <div className="rounded-ha-2xl border border-surface-lower bg-surface-default overflow-hidden">
              <div className="flex items-center gap-ha-3 px-ha-4 py-ha-3">
                <Icon path={mdiBackupRestore} size={15} className={stale ? 'text-orange-500' : 'text-green-500'} />
                <span className="flex-1 text-sm text-text-secondary">{lastBackup?.name ?? 'Backups'}</span>
                <span className={`text-sm font-medium ${stale ? 'text-orange-600' : 'text-text-secondary'}`}>{label}</span>
              </div>
            </div>
          </div>
        );
      }
      case 'connectivity': {
        const navConn = navTo('connectivity');
        return (
          <div key={id}>
            <SectionHeader label="Connectivity" onNavigate={navConn} />
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
        );
      }
      default:
        return null;
    }
  };

  return <div className="space-y-ha-4">{sections.map(renderSection)}</div>;
}
