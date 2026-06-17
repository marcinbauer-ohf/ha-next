'use client';

import { clsx } from 'clsx';
import { useAltIcon, useIconSet } from './iconSet';

interface IconProps {
  path: string;
  size?: number;
  className?: string;
  /** Opt out of the 24px legibility floor — for highly-recognizable glyphs
   *  (info, eye, exclamation) that read fine, and look better, inline + small. */
  exact?: boolean;
}

export function Icon({ path, size = 24, className, exact = false }: IconProps) {
  // EXPERIMENT: 24px legibility floor — pictograms read poorly below 24, so
  // bump anything smaller up to 24. Remove this line to restore per-call sizes.
  // `exact` bypasses the floor for the few glyphs that are clear at small sizes.
  const renderSize = exact ? size : Math.max(size, 24);

  // DEBUG icon-set swap. Default 'mdi' = render the MDI path below (zero extra
  // work). When an alt set is active, Alt is the resolved component (or null
  // while loading / when no equivalent exists → fall back to the MDI path).
  const set = useIconSet();
  const Alt = useAltIcon(set, path);

  if (Alt) {
    // Alt sets ship their own viewBox/fill/stroke; pass only sizing + the
    // caller's className (NOT fill-current — it would flood stroke icons solid).
    return <Alt size={renderSize} className={clsx('ha-icon flex-shrink-0', className)} />;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={renderSize}
      height={renderSize}
      className={clsx('ha-icon fill-current flex-shrink-0', className)}
    >
      <path d={path} className="ha-icon-path" />
    </svg>
  );
}
