import { clsx } from 'clsx';

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
