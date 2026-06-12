'use client';

import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { useHomeAssistant, useHomeAssistantSelector, useHomeCenterPrefs } from '@/hooks';
import { areActivityDataEqual, selectActivityData } from '@/lib/homeassistant/selectors';
import { formatBackupAge, type HomeCenterSectionId } from '@/lib/homeCenter';
import { resolveEntityPictureUrl } from '@/lib/utils';
import {
  mdiAlertCircle,
  mdiBackupRestore,
  mdiBatteryAlertVariantOutline,
  mdiBell,
  mdiCheckCircle,
  mdiChevronRight,
  mdiCloudCheck,
  mdiCloudOff,
  mdiDevices,
  mdiHomeVariant,
  mdiUpdate,
  mdiWeb,
  mdiWrench,
} from '@mdi/js';

// Shared Home Center status UI. Both the desktop StatusBar pop-up and the
// mobile nav expanded surface render these components so the content always
// stays aligned: same sections, same order (Home Center prefs), same markup.

function useHomeCenterStatusData() {
  const { haUrl, demoMode, connected, connecting } = useHomeAssistant();
  const activityData = useHomeAssistantSelector(selectActivityData, areActivityDataEqual);
  const { visibleSections } = useHomeCenterPrefs();

  return { haUrl, demoMode, connected, connecting, activityData, visibleSections };
}

export function HomeCenterPillIndicators({
  size = 20,
  max,
  withTooltips = true,
}: {
  size?: number;
  max?: number;
  withTooltips?: boolean;
}) {
  const { activityData, visibleSections } = useHomeCenterStatusData();

  const notificationCount = activityData.activeNotifications.length;
  const pendingUpdates = activityData.activeUpdates.length;
  const offlineCount = activityData.offlineDevices.length;
  const repairCount = activityData.repairs.length;
  const hasCriticalRepair = activityData.repairs.some((r) => r.severity === 'critical');
  const lowBatteryCount = activityData.lowBatteryDevices.length;
  const backupAge = formatBackupAge(activityData.lastBackup?.lastBackup ?? null);
  const isRemoteConnected = activityData.isRemoteConnected;

  const renderIndicator = (id: HomeCenterSectionId) => {
    let icon = mdiBell;
    let tooltip = '';
    let dot: string | null = null;
    let pulse = false;
    switch (id) {
      case 'notifications':
        icon = mdiBell;
        tooltip = notificationCount > 0 ? `Notifications: ${notificationCount} active` : 'Notifications: None';
        dot = notificationCount > 0 ? 'bg-yellow-500' : null;
        break;
      case 'updates':
        icon = mdiUpdate;
        tooltip = pendingUpdates > 0 ? `Updates: ${pendingUpdates} update${pendingUpdates > 1 ? 's' : ''} available` : 'Updates: System is up to date';
        dot = pendingUpdates > 0 ? 'bg-ha-blue' : null;
        break;
      case 'repairs':
        icon = mdiWrench;
        tooltip = repairCount > 0 ? `Repairs: ${repairCount} suggested` : 'Repairs: None';
        dot = repairCount > 0 ? (hasCriticalRepair ? 'bg-red-500' : 'bg-orange-500') : null;
        pulse = hasCriticalRepair;
        break;
      case 'issues':
        icon = mdiDevices;
        tooltip = offlineCount > 0 ? `Offline: ${offlineCount} device${offlineCount > 1 ? 's' : ''} unavailable` : 'Devices: All online';
        dot = offlineCount > 0 ? 'bg-red-500' : null;
        pulse = offlineCount > 0;
        break;
      case 'battery':
        icon = mdiBatteryAlertVariantOutline;
        tooltip = lowBatteryCount > 0 ? `Low battery: ${lowBatteryCount} device${lowBatteryCount > 1 ? 's' : ''}` : 'Batteries: Healthy';
        dot = lowBatteryCount > 0 ? 'bg-amber-500' : null;
        break;
      case 'backups':
        icon = mdiBackupRestore;
        tooltip = backupAge.label;
        dot = backupAge.stale ? 'bg-orange-500' : null;
        break;
      case 'connectivity':
        icon = mdiWeb;
        tooltip = isRemoteConnected ? 'Remote Access: Available via internet' : 'Remote Access: Not exposed to internet';
        dot = isRemoteConnected ? 'bg-green-500' : 'bg-red-500';
        break;
    }
    const indicator = (
      <div className="relative">
        <Icon path={icon} size={size} className="text-text-secondary" />
        {dot && <span className={`absolute -top-0.5 -right-0.5 ${dot} rounded-full w-2 h-2 ${pulse ? 'animate-pulse' : ''}`} />}
      </div>
    );
    if (!withTooltips) {
      return <div key={id}>{indicator}</div>;
    }
    return (
      <Tooltip key={id} content={tooltip}>
        {indicator}
      </Tooltip>
    );
  };

  const sections = typeof max === 'number' ? visibleSections.slice(0, max) : visibleSections;
  return <>{sections.map(renderIndicator)}</>;
}

export function HomeCenterStatusSections({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { haUrl, demoMode, connected, connecting, activityData, visibleSections } = useHomeCenterStatusData();

  const activeNotifications = activityData.activeNotifications;
  const activeUpdates = activityData.activeUpdates;
  const offlineDevices = activityData.offlineDevices;
  const repairs = activityData.repairs;
  const lowBatteryDevices = activityData.lowBatteryDevices;
  const lastBackup = activityData.lastBackup;
  const isRemoteConnected = activityData.isRemoteConnected;

  const repairCount = repairs.length;
  const hasCriticalRepair = repairs.some((r) => r.severity === 'critical');
  const lowBatteryCount = lowBatteryDevices.length;
  const backupAge = formatBackupAge(lastBackup?.lastBackup ?? null);

  // Connection status — mirror SystemStatusPanel (Home Center settings) so the
  // pop-up never falls through to "Unknown Status" in demo mode.
  const connStatus = demoMode ? 'Demo' : connecting ? 'Connecting' : connected ? 'Connected' : 'Offline';
  const connTone: 'default' | 'warning' | 'danger' = demoMode ? 'warning' : connected ? 'default' : 'danger';
  const connToneClasses: Record<typeof connTone, { text: string; badge: string }> = {
    default: { text: 'text-green-500', badge: 'bg-green-500/10 text-green-500' },
    warning: { text: 'text-yellow-500', badge: 'bg-yellow-500/10 text-yellow-500' },
    danger: { text: 'text-red-500', badge: 'bg-red-500/10 text-red-500' },
  };

  const getEntityPictureUrl = (picture?: string, fallback?: string) =>
    resolveEntityPictureUrl(haUrl, picture) ?? fallback;

  const renderSection = (id: HomeCenterSectionId) => {
    switch (id) {
      case 'notifications':
        return (
          <div key={id} className="bg-surface-low rounded-2xl p-ha-3">
            <button type="button" onClick={() => onNavigate('/settings?section=notifications')} className="group w-full flex items-center justify-between mb-ha-2 px-1">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider group-hover:text-text-primary transition-colors">Notifications</h4>
              <div className="flex items-center gap-ha-2">
                {activeNotifications.length > 0 && (
                  <span className="text-xs font-bold text-white bg-yellow-500 px-1.5 py-0.5 rounded-md">{activeNotifications.length}</span>
                )}
                <Icon path={mdiChevronRight} size={16} className="text-text-disabled group-hover:text-text-secondary transition-colors" />
              </div>
            </button>
            {activeNotifications.length > 0 ? (
              <div className="space-y-2">
                {activeNotifications.map(notif => (
                  <div key={notif.id} className="flex items-start gap-ha-3 p-ha-2.5 bg-surface-mid/30 hover:bg-surface-mid rounded-xl transition-colors">
                    <Icon path={mdiBell} size={18} className="text-yellow-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary leading-tight">{notif.title}</p>
                      {notif.message && <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-snug">{notif.message}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-disabled px-1 py-1">No notifications</p>
            )}
          </div>
        );
      case 'updates':
        return (
          <div key={id} className="bg-surface-low rounded-2xl p-ha-3">
            <button type="button" onClick={() => onNavigate('/settings?section=updates')} className="group w-full flex items-center justify-between mb-ha-2 px-1">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider group-hover:text-text-primary transition-colors">Updates Available</h4>
              <div className="flex items-center gap-ha-2">
                {activeUpdates.length > 0 && (
                  <span className="text-xs font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded-md">{activeUpdates.length}</span>
                )}
                <Icon path={mdiChevronRight} size={16} className="text-text-disabled group-hover:text-text-secondary transition-colors" />
              </div>
            </button>
            {activeUpdates.length > 0 ? (
              <div className="space-y-2">
                {activeUpdates.map(update => (
                  <div key={update.id} className="flex items-center gap-ha-3 p-ha-2 hover:bg-surface-mid rounded-xl transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0 group-hover:scale-110 transition-transform">
                      {update.picture ? <img src={getEntityPictureUrl(update.picture)} alt={update.name} className="w-full h-full rounded-full object-cover"/> : <Icon path={mdiUpdate} size={18} />}
                    </div>
                    <span className="text-sm font-medium text-text-primary truncate">{update.name}</span>
                    <Icon path={mdiChevronRight} size={16} className="text-text-disabled ml-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-disabled px-1 py-1">System is up to date</p>
            )}
          </div>
        );
      case 'repairs':
        return (
          <div key={id} className="bg-surface-low rounded-2xl p-ha-3">
            <div className="w-full flex items-center justify-between mb-ha-2 px-1">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Repairs</h4>
              {repairCount > 0 && (
                <span className={`text-xs font-bold text-white px-1.5 py-0.5 rounded-md ${hasCriticalRepair ? 'bg-red-500' : 'bg-orange-500'}`}>{repairCount}</span>
              )}
            </div>
            {repairCount > 0 ? (
              <div className="space-y-2">
                {repairs.map(r => (
                  <div key={r.id} className="flex items-start gap-ha-3 p-ha-2.5 bg-surface-mid/30 hover:bg-surface-mid rounded-xl transition-colors">
                    <Icon path={mdiWrench} size={18} className={`${r.severity === 'critical' ? 'text-red-500' : 'text-orange-500'} shrink-0 mt-0.5`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary leading-tight">{r.title}</p>
                      {r.description && <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-snug">{r.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-disabled px-1 py-1">Nothing needs fixing</p>
            )}
          </div>
        );
      case 'issues':
        return (
          <div key={id} className="bg-surface-low rounded-2xl p-ha-3">
            <button type="button" onClick={() => onNavigate('/settings?section=repairs')} className="group w-full flex items-center justify-between mb-ha-2 px-1">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider group-hover:text-text-primary transition-colors">Offline Devices</h4>
              <div className="flex items-center gap-ha-2">
                {offlineDevices.length > 0 && (
                  <span className="text-xs font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-md">{offlineDevices.length}</span>
                )}
                <Icon path={mdiChevronRight} size={16} className="text-text-disabled group-hover:text-text-secondary transition-colors" />
              </div>
            </button>
            {offlineDevices.length > 0 ? (
              <div className="space-y-1">
                {offlineDevices.map(device => (
                  <div key={device.id} className="flex items-center gap-ha-2 p-ha-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-mid/50 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
                    <span className="text-sm truncate font-medium">{device.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-disabled px-1 py-1">All devices online</p>
            )}
          </div>
        );
      case 'battery':
        return (
          <div key={id} className="bg-surface-low rounded-2xl p-ha-3">
            <div className="w-full flex items-center justify-between mb-ha-2 px-1">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Low Battery</h4>
              {lowBatteryCount > 0 && (
                <span className="text-xs font-bold text-white bg-amber-500 px-1.5 py-0.5 rounded-md">{lowBatteryCount}</span>
              )}
            </div>
            {lowBatteryCount > 0 ? (
              <div className="space-y-1">
                {lowBatteryDevices.map(b => (
                  <div key={b.id} className="flex items-center gap-ha-2 p-ha-2 rounded-lg hover:bg-surface-mid/50 transition-colors">
                    <Icon path={mdiBatteryAlertVariantOutline} size={16} className={`shrink-0 ${b.level <= 10 ? 'text-red-500' : 'text-amber-500'}`} />
                    <span className="text-sm truncate font-medium text-text-primary flex-1">{b.name}</span>
                    <span className={`text-sm font-semibold tabular-nums ${b.level <= 10 ? 'text-red-500' : 'text-text-secondary'}`}>{b.level}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-disabled px-1 py-1">All batteries healthy</p>
            )}
          </div>
        );
      case 'backups':
        return (
          <div key={id} className="bg-surface-low rounded-2xl p-ha-3">
            <div className="w-full flex items-center justify-between mb-ha-2 px-1">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Backups</h4>
            </div>
            <div className="flex items-center gap-ha-2 p-ha-2 rounded-lg hover:bg-surface-mid/50 transition-colors">
              <Icon path={mdiBackupRestore} size={16} className={`shrink-0 ${backupAge.stale ? 'text-orange-500' : 'text-green-500'}`} />
              <span className="text-sm truncate font-medium text-text-primary flex-1">{lastBackup?.name ?? 'Backups'}</span>
              <span className={`text-sm font-medium ${backupAge.stale ? 'text-orange-500' : 'text-text-secondary'}`}>{backupAge.label}</span>
            </div>
          </div>
        );
      case 'connectivity':
        return (
          <div key={id} className="bg-surface-low rounded-2xl p-ha-3">
            <div className="flex items-center gap-ha-3 mb-ha-3">
              <div className={`p-2 rounded-full ${connToneClasses[connTone].badge}`}>
                <Icon path={connected || demoMode ? mdiCheckCircle : mdiAlertCircle} size={24} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">Home Assistant</h4>
                <p className={`text-xs font-medium ${connToneClasses[connTone].text}`}>{connStatus}</p>
              </div>
            </div>
            <div className="space-y-2 mt-2 pt-2 border-t border-surface-mid/50">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Icon path={isRemoteConnected ? mdiCloudCheck : mdiCloudOff} size={16} className={isRemoteConnected ? "text-green-500" : "text-text-disabled"} />
                  <span className="text-sm text-text-secondary">Remote Access</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isRemoteConnected ? 'bg-green-500/10 text-green-500' : 'bg-surface-mid text-text-disabled'}`}>
                  {isRemoteConnected ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return <>{visibleSections.map(renderSection)}</>;
}

export function OpenHomeCenterButton({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate('/settings?section=home-center')}
      className="w-full h-11 rounded-ha-xl bg-ha-blue text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-ha-blue-dark shadow-md active:scale-95 transition-all"
    >
      <Icon path={mdiHomeVariant} size={18} />
      Open Home Center
    </button>
  );
}
