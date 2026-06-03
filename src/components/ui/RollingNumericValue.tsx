'use client';

import { clsx } from 'clsx';
import { RollingDigit } from './RollingDigit';

interface RollingNumericValueProps {
  value: string;
  className?: string;
}

/**
 * Renders a string character-by-character: digit chars get the RollingDigit
 * animation, non-digit chars (`.`, `-`, `°`, letters, spaces) render statically.
 */
export function RollingNumericValue({ value, className = '' }: RollingNumericValueProps) {
  return (
    <span className={clsx('inline-flex items-baseline tabular-nums', className)} aria-label={value}>
      {value.split('').map((char, i) =>
        /[0-9]/.test(char)
          ? <RollingDigit key={i} digit={char} className={className} />
          : <span key={i} className={className}>{char}</span>
      )}
    </span>
  );
}
