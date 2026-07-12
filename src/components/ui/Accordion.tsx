'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Icon } from './Icon';
import { mdiChevronDown } from '@mdi/js';

/** mdi path string, e.g. `mdiPaletteOutline`. */
type IconPath = string;

/**
 * Collapsible section list — the expandable sibling of {@link ListSection}. It
 * shares the same grouped-card chrome (rounded surface, hairline dividers) so a
 * stack of AccordionSections reads as one family with the rest of the settings
 * lists. Each section opens independently (not single-select), animating with
 * the same height-auto motion used by AddMenu / TipStack / SetupScreen.
 *
 * Wrap {@link AccordionSection}s as direct children:
 *   <Accordion>
 *     <AccordionSection title="Color mode" defaultOpen>…</AccordionSection>
 *     <AccordionSection title="Theme">…</AccordionSection>
 *   </Accordion>
 */
export function Accordion({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded-ha-2xl border border-surface-lower bg-surface-default',
        '[&>*]:border-b [&>*]:border-surface-lower [&>*:last-child]:border-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AccordionSection({
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  /** Optional leading glyph (mdi path), rendered in a rounded square like the settings list rows. */
  icon?: IconPath;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-ha-3 px-ha-4 py-ha-3 text-left transition-colors hover:bg-surface-low"
      >
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ha-xl bg-surface-mid text-text-secondary">
            <Icon path={icon} size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text-primary">{title}</div>
          {description && <div className="mt-0.5 text-xs text-text-secondary">{description}</div>}
        </div>
        <Icon
          path={mdiChevronDown}
          size={20}
          className={clsx(
            'shrink-0 text-text-disabled transition-transform duration-200 ease-out motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-ha-4 pb-ha-4 pt-ha-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
