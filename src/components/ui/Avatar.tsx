import { clsx } from 'clsx';
import { GenerativeAvatar } from './GenerativeAvatar';

interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-7 h-7 text-[13px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-2xl',
};

// Rendered edge length per size — lets the generative avatar decide whether the
// home motif and initials are legible enough to draw.
const sizePx = { xs: 28, sm: 32, md: 40, lg: 48, xl: 80 };

export function Avatar({ src, alt = 'User', initials, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={clsx(
          'rounded-full object-cover',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <GenerativeAvatar
      seed={alt}
      initials={initials || alt.charAt(0).toUpperCase()}
      pxSize={sizePx[size]}
      className={clsx(sizeClasses[size], className)}
    />
  );
}
