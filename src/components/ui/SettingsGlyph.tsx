'use client';

import { useMemo } from 'react';
import { clsx } from 'clsx';
import { mdiMenu } from '@mdi/js';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { useActivities } from '@/hooks/useActivities';
import { useHomeAssistant } from '@/hooks';
import { resolveEntityPictureUrl } from '@/lib/utils';

/**
 * The settings entry point's mark: the user's avatar with a hamburger tucked
 * behind its right edge. Used by the sidebar, the desktop status bar and the
 * mobile nav — one component because all three had drifted copies of it, and
 * the glyph has to read identically wherever settings is reached from.
 *
 * `active` is the on-settings state (the mobile nav paints its own underline
 * instead and leaves this off). Hover animation is opt-out for the same reason.
 */
export function SettingsGlyph({ active = false, hover = true }: { active?: boolean; hover?: boolean }) {
  const { haUrl } = useHomeAssistant();
  const { data: activityData } = useActivities();
  const user = useMemo(() => ({
    picture: resolveEntityPictureUrl(haUrl, activityData.user?.picture),
    initials: activityData.user?.initials ?? 'U',
  }), [activityData.user, haUrl]);

  return (
    <span className="relative flex items-center justify-center">
      <span
        className={clsx(
          'relative z-10 rounded-full ring-[3px] transition-colors',
          active ? 'ring-surface-mid bg-surface-mid' : 'ring-surface-low bg-surface-low',
        )}
      >
        <Avatar src={user.picture} initials={user.initials} size="sm" />
      </span>
      <Icon
        path={mdiMenu}
        size={28}
        className={clsx(
          'absolute -right-3 z-0 transition-[transform,color] duration-500 ease-out',
          hover && 'group-hover:translate-x-1',
          active ? 'text-text-primary' : clsx('text-text-secondary', hover && 'group-hover:text-text-primary'),
        )}
      />
    </span>
  );
}
