import { clsx } from 'clsx';

interface IconProps {
  path: string;
  size?: number;
  className?: string;
}

export function Icon({ path, size = 24, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={clsx('ha-icon fill-current flex-shrink-0', className)}
    >
      <path d={path} className="ha-icon-path" />
    </svg>
  );
}
