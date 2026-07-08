'use client';

import { mdiOpenInNew, mdiViewDashboardOutline } from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { MdiIcon } from '@/components/ui/MdiIcon';
import { useHomeAssistant } from '@/hooks';

/**
 * Minimal empty state for sidebar items that are Home Assistant-native views
 * (add-on panels, Lovelace dashboards) this prototype doesn't render.
 */
export function NativeViewPlaceholder({
  icon,
  urlPath,
}: {
  title: string;
  icon?: string;
  /** The view's path inside HA (e.g. /lovelace-cameras), used for the open link. */
  urlPath?: string;
}) {
  const { haUrl, connected } = useHomeAssistant();
  const externalHref = connected && haUrl && urlPath ? `${haUrl}${urlPath}` : null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-ha-4 text-center">
      <span className="text-text-tertiary">
        {icon ? (
          <MdiIcon icon={icon} size={40} />
        ) : (
          <Icon path={mdiViewDashboardOutline} size={40} />
        )}
      </span>
      <p className="max-w-sm text-sm text-text-tertiary">
        This screen isn&apos;t built in here yet.
      </p>
      {externalHref && (
        <a
          href={externalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-ha-2 text-sm font-medium text-ha-blue transition-opacity hover:opacity-80"
        >
          Open in Home Assistant
          <Icon path={mdiOpenInNew} size={14} />
        </a>
      )}
    </div>
  );
}
