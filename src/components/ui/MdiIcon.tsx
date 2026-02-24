'use client';

import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { mdiViewDashboard, mdiCog, mdiHelp } from '@mdi/js';

// Cache for loaded icons
const iconCache: Record<string, string> = {};

// Common icons that we bundle
const bundledIcons: Record<string, string> = {
  'view-dashboard': mdiViewDashboard,
  'cog': mdiCog,
  'help': mdiHelp,
};

interface MdiIconProps {
  icon: string; // e.g., "mdi:view-dashboard" or just "view-dashboard"
  size?: number;
  className?: string;
}

export function MdiIcon({ icon, size = 24, className }: MdiIconProps) {
  const [path, setPath] = useState<string | null>(null);
  const iconName = icon.replace(/^mdi:/, '').trim();

  useEffect(() => {
    // Check bundled icons first
    if (bundledIcons[iconName]) {
      setPath(bundledIcons[iconName]);
      return;
    }

    // Check cache
    if (iconCache[iconName]) {
      setPath(iconCache[iconName]);
      return;
    }

    // Try to dynamically import from @mdi/js
    const loadIcon = async () => {
      try {
        const pascalName = 'mdi' + iconName
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
        const mdiModule = await import('@mdi/js');
        const iconPath = (mdiModule as unknown as Record<string, string>)[pascalName];

        if (iconPath && typeof iconPath === 'string') {
          iconCache[iconName] = iconPath;
          setPath(iconPath);
        } else {
          setPath(mdiHelp);
        }
      } catch {
        setPath(mdiHelp);
      }
    };

    loadIcon();
  }, [iconName]);

  if (!path) {
    // Placeholder while loading
    return <div style={{ width: size, height: size }} className={className} />;
  }

  return <Icon path={path} size={size} className={className} />;
}
