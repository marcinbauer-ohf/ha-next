'use client';

/**
 * Accessibility control for the first-run flow — the button sits in the flow's
 * top-right chrome, opposite the back arrow, so someone who needs less motion or
 * bigger type can set it before answering anything.
 *
 * Rendered INSIDE the flow's root (not as a portal/ModalSheet) on purpose: the
 * flow is a focus-trapped dialog, so a panel outside that root would have its
 * focus pulled back on Tab. Prefs themselves live in ThemeProvider (A11yPrefs)
 * and outlive the flow — whatever is set here stays set in the app.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, ToggleSwitch } from '@/components/ui';
import { useTheme, type A11yPrefs } from '@/hooks/useTheme';
import { haptic } from '@/lib/haptics';
import { mdiHumanWheelchair, mdiFormatSize, mdiMotionPlayOutline, mdiBlurOff } from '@mdi/js';
import { EASE_OUT } from './ui';

const ROWS: Array<{ key: keyof A11yPrefs; icon: string; label: string; description: string }> = [
  {
    key: 'reduceMotion',
    icon: mdiMotionPlayOutline,
    label: 'Reduce motion',
    description: 'Things change instantly instead of sliding or fading.',
  },
  {
    key: 'reduceTransparency',
    icon: mdiBlurOff,
    label: 'Reduce transparency',
    description: 'Solid panels instead of frosted, see-through ones.',
  },
  {
    key: 'biggerText',
    icon: mdiFormatSize,
    label: 'Bigger text',
    description: 'Larger type everywhere in the app.',
  },
];

export function AccessibilityMenu() {
  const { a11y, toggleA11y } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      // Escape closes the menu instead of stepping the flow backwards — the
      // flow's own Escape handler sits on its root, above this.
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => {
          haptic('tap');
          setOpen((v) => !v);
        }}
        aria-label="Accessibility"
        aria-expanded={open}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          open ? 'bg-surface-low text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-surface-low/70'
        }`}
      >
        <Icon path={mdiHumanWheelchair} size={22} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-anywhere-else to dismiss. Sits under the panel, over the step. */}
            <button
              type="button"
              aria-label="Close accessibility options"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <motion.div
              role="group"
              aria-label="Accessibility"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="absolute right-0 top-full z-20 mt-ha-2 w-[min(20rem,calc(100vw-2rem))] rounded-ha-2xl bg-surface-low/95 backdrop-blur-md border border-surface-lower shadow-xl p-ha-2 space-y-ha-1 text-left"
            >
              {ROWS.map((row) => (
                <div key={row.key} className="flex items-center gap-ha-3 p-ha-2 rounded-ha-xl">
                  <span className="w-9 h-9 flex-shrink-0 rounded-ha-lg bg-surface-default/70 flex items-center justify-center">
                    <Icon path={row.icon} size={19} className="text-text-secondary" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-text-primary">{row.label}</span>
                    <span className="block text-xs text-text-secondary leading-snug">
                      {row.description}
                    </span>
                  </span>
                  <ToggleSwitch
                    size="sm"
                    label={row.label}
                    on={a11y[row.key]}
                    onToggle={() => toggleA11y(row.key)}
                  />
                </div>
              ))}
              <p className="px-ha-2 pb-ha-1 text-[11px] text-text-tertiary">
                If your device is already set to reduce motion, that&apos;s followed automatically.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
