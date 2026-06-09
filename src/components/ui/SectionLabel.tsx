'use client';

/**
 * Canonical small uppercase section header used before/inside cards and nav groups.
 * Matches the style in settings panels, search overlays, and nav sections.
 */
export function SectionLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-xs font-medium uppercase tracking-wider text-text-tertiary ${className}`}>
      {children}
    </p>
  );
}
