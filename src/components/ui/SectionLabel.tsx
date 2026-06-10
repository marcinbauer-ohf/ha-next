'use client';

/**
 * Canonical small uppercase section header used before/inside cards and nav groups.
 * Matches the style in settings panels, search overlays, and nav sections.
 */
export function SectionLabel({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <p className={`text-xs font-medium uppercase tracking-wider text-text-tertiary ${className}`} style={style}>
      {children}
    </p>
  );
}
