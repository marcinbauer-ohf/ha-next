'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { Icon } from '../ui/Icon';

interface RoomCardProps {
  icon: string;
  name: string;
  temperature?: number;
  humidity?: number;
  activeEntities?: number;
  href?: string;
  onClick?: () => void;
}

export function RoomCard({
  icon,
  name,
  temperature,
  humidity,
  activeEntities = 0,
  href,
  onClick,
}: RoomCardProps) {
  const hasActivity = activeEntities > 0;

  const className = clsx(
    'relative hover:z-50 flex flex-col items-start p-ha-4 rounded-ha-2xl transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[140px] w-full',
    hasActivity ? 'bg-fill-primary-quiet' : 'bg-surface-default'
  );

  const content = (
    <>
      <div className={clsx('mb-ha-3', hasActivity ? 'text-ha-blue' : 'text-text-secondary')}>
        <Icon path={icon} size={32} />
      </div>
      <div className="flex flex-col items-start mt-auto w-full">
        <span className="text-base font-medium text-text-primary text-left">{name}</span>
        {(temperature !== undefined || humidity !== undefined) && (
          <span className="text-sm text-text-secondary text-left">
            {temperature !== undefined && `${temperature}°C`}
            {temperature !== undefined && humidity !== undefined && ' · '}
            {humidity !== undefined && `${humidity}%`}
          </span>
        )}
      </div>
      {hasActivity && (
        <div className="absolute top-3 right-3">
          <span className="text-xs bg-fill-primary-normal text-ha-blue px-2 py-0.5 rounded-full">
            {activeEntities} on
          </span>
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}
