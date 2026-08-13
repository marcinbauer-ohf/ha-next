'use client';

import { memo, useState, useEffect } from 'react';
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
  icon: string; // "mdi:view-dashboard", "view-dashboard", or an image URL
  size?: number;
  className?: string;
}

// Some things have a real logo rather than a glyph — add-ons and integrations
// carry one (brands.home-assistant.io, /api/hassio/addons/<slug>/icon). Handled
// here so every caller that already renders an icon gets logos for free.
const isImageIcon = (icon: string) => /^(https?:\/\/|\/|data:image\/)/.test(icon);

export const MdiIcon = memo(function MdiIcon({ icon, size = 24, className }: MdiIconProps) {
  const iconName = icon.replace(/^mdi:/, '').trim();
  const [path, setPath] = useState<string | null>(
    () => bundledIcons[iconName] ?? iconCache[iconName] ?? null
  );

  useEffect(() => {
    if (isImageIcon(iconName)) return;

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

  if (isImageIcon(iconName)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote logo, no loader
      <img
        src={iconName}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`object-contain ${className ?? ''}`}
      />
    );
  }

  if (!path) {
    // Placeholder while loading
    return <div style={{ width: size, height: size }} className={className} />;
  }

  return <Icon path={path} size={size} className={className} />;
});
