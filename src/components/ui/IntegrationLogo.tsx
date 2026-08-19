'use client';

import { useState } from 'react';
import { Icon } from './Icon';

/**
 * A brand's real logo from the Home Assistant brands CDN
 * (https://brands.home-assistant.io/<domain>/icon.png — the key is the brand
 * domain). Falls back to the thematic mdi icon if the brand has no logo or the
 * image fails to load.
 *
 * Shared by the integrations list, the device shelf, and the brand store, so a
 * brand looks the same wherever you meet it.
 */
export function IntegrationLogo({
  domain,
  fallbackIcon,
  tileClass,
  iconSize,
}: {
  domain: string;
  fallbackIcon: string;
  tileClass: string;
  iconSize: number;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`${tileClass} bg-fill-primary-normal text-ha-blue`}>
        <Icon path={fallbackIcon} size={iconSize} />
      </div>
    );
  }

  return (
    <div className={`${tileClass} bg-white/90 dark:bg-white p-1`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://brands.home-assistant.io/${domain}/icon.png`}
        alt=""
        // A brand store scrolls past hundreds of these; only fetch the ones on
        // screen (the browser does the work, no observer of ours).
        loading="lazy"
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
