'use client';

import { useState, type ReactNode } from 'react';
import { mdiImageBrokenVariant } from '@mdi/js';
import { Icon } from './Icon';

type LoadState = 'loading' | 'loaded' | 'error';

/**
 * Full-width hero banner for a section header. Built to look intentional with
 * *any* source image — high-res product renders, phone photos, or low-quality
 * uploads all crop to the same frame:
 *
 *  - `object-cover` fills the band regardless of the source aspect ratio, so
 *    portrait / square / wide images all read as one consistent shape.
 *  - A skeleton pulse holds the layout while the image decodes; the image then
 *    fades in (no flash / reflow), which hides the pop-in of a slow/large file.
 *  - Theme-aware scrims darken the top and bottom edges so a bright image (like
 *    a render on a near-white background) blends into the page in dark mode and
 *    any overlaid title stays legible over busy pixels.
 *  - A graceful fallback tile replaces the image if the src 404s or fails.
 */
export function HeroImage({
  src,
  alt,
  title,
  subtitle,
  eyebrow,
  action,
  className = '',
  // 4:3 renders read best in a short-to-medium band; scales down on mobile so
  // the section content below stays reachable without a long scroll.
  heightClassName = 'h-40 sm:h-52 lg:h-60',
  objectPosition = 'center',
  priority = true,
}: {
  src: string;
  alt: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  /** Top-right control slot (e.g. an edit button), rendered over the image. */
  action?: ReactNode;
  className?: string;
  heightClassName?: string;
  /** CSS object-position for the crop focal point (e.g. 'center 40%'). */
  objectPosition?: string;
  /** Load eagerly (above the fold). Defaults to true. */
  priority?: boolean;
}) {
  const [state, setState] = useState<LoadState>('loading');
  const hasCaption = Boolean(eyebrow || title || subtitle);

  return (
    <div
      className={`relative isolate overflow-hidden rounded-ha-3xl bg-surface-low ring-1 ring-inset ring-surface-lower ${heightClassName} ${className}`}
    >
      {/* Skeleton — visible until the image decodes or errors out. */}
      {state === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-low via-surface-mid to-surface-low" />
      )}

      {state === 'error' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-ha-2 bg-gradient-to-br from-surface-low to-surface-mid text-text-tertiary">
          <Icon path={mdiImageBrokenVariant} size={28} />
          <span className="text-xs font-medium">Image unavailable</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          draggable={false}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
          style={{ objectPosition }}
          className={`absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-500 ease-out ${
            state === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Edge scrims: blend a bright image into the page and keep the caption
          readable over any pixels. Skipped on error (fallback is already flat). */}
      {state !== 'error' && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/15 to-transparent" />
          {hasCaption && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />
          )}
        </>
      )}

      {action && (
        <div className="absolute right-ha-4 top-ha-4 z-10">{action}</div>
      )}

      {hasCaption && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-ha-4 sm:p-ha-5">
          {eyebrow && (
            <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
              {eyebrow}
            </span>
          )}
          {title && (
            <span className="text-lg font-semibold leading-tight text-white drop-shadow-sm sm:text-xl">
              {title}
            </span>
          )}
          {subtitle && (
            <span className="text-sm text-white/80">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
