import { clsx } from 'clsx';

interface AvatarProps {
  src?: string;
  alt?: string;
  /** Kept for call-site compatibility; the no-photo fallback is the Casita mark. */
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

/** No photo → the Casita house mark, same one the demo home ships with. */
const FALLBACK_SRC = '/casita.png';

export function Avatar({ src, alt = 'User', size = 'md', className }: AvatarProps) {
  return (
    <img
      src={src || FALLBACK_SRC}
      alt={alt}
      // Opaque ground, always: casita.png (and plenty of HA entity pictures)
      // carry alpha, and avatars are routinely stacked with a negative margin —
      // transparent ones let the avatar underneath show through the face.
      className={clsx('rounded-full object-cover bg-surface-default', sizeClasses[size], className)}
    />
  );
}
