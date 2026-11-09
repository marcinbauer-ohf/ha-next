'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { mdiClose } from '@mdi/js';
import { Button } from './Button';
import { IconBadge } from './IconBadge';
import { IconButton } from './IconButton';

export interface TipStackAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface TipStackTip {
  id: string;
  icon: string;
  /** Artwork shown instead of the icon badge — a logo, at 40px. */
  media?: React.ReactNode;
  title: string;
  /** One short line. The title carries the message; this only says what the button gets you. */
  body?: string;
  actions?: TipStackAction[];
  /** Called when the tip's ✕ is pressed. The parent removes the tip from `tips`. */
  onDismiss: () => void;
}

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.8 };
const EXIT = { duration: 0.16, ease: [0.25, 0.1, 0.25, 1] as const };

/** Vertical offset of each peeking card edge behind the front card. */
const PEEK_STEP = 8;
/** How many hidden cards may peek out below the front one. */
const MAX_PEEK = 2;

// A tip is a card like any other on the dashboard: the white surface, no tint.
// Colour stays in the badge. The hairline is what separates the peeking cards
// from the one in front of them.
function TipSurface({ children }: { children?: React.ReactNode }) {
  return (
    <div className="h-full rounded-ha-2xl border border-text-primary/[0.06] bg-surface-default">
      {children}
    </div>
  );
}

/**
 * Dismissible dashboard tips rendered as a card stack: the front tip shows in
 * full while up to two more peek out underneath. Dismissing (or acting on) the
 * front tip pops the next one into place; dismissing the last collapses the
 * whole stack.
 */
export function TipStack({ tips }: { tips: TipStackTip[] }) {
  const front = tips[0];
  const peekCount = Math.min(Math.max(tips.length - 1, 0), MAX_PEEK);

  return (
    <AnimatePresence initial={false}>
      {front && (
        <motion.div
          key="tip-stack"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={EXIT}
          className="overflow-hidden"
        >
          {/* Inside the height-animated clip so the gap collapses with the stack */}
          <div className="pt-ha-3">
          <motion.div
            className="relative"
            animate={{ paddingBottom: peekCount > 0 ? peekCount * PEEK_STEP + 2 : 0 }}
            transition={SPRING}
          >
            {/* Peeking edges of the tips waiting behind the front card */}
            <AnimatePresence initial={false}>
              {Array.from({ length: peekCount }, (_, i) => (
                <motion.div
                  key={`peek-${i}`}
                  className="absolute inset-0"
                  style={{ zIndex: peekCount - i }}
                  initial={{ y: i * PEEK_STEP, scaleX: 1 - i * 0.04, opacity: 0 }}
                  animate={{ y: (i + 1) * PEEK_STEP, scaleX: 1 - (i + 1) * 0.04, opacity: 1 }}
                  exit={{ y: i * PEEK_STEP, scaleX: 1 - i * 0.04, opacity: 0 }}
                  transition={SPRING}
                  aria-hidden
                >
                  <TipSurface />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Front tip — keyed so a dismissal exits before the next pops in */}
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={front.id}
                className="relative z-10"
                initial={{ y: PEEK_STEP, scaleX: 0.96, opacity: 0.6 }}
                animate={{ y: 0, scaleX: 1, opacity: 1 }}
                exit={{ y: -10, scale: 0.98, opacity: 0 }}
                transition={SPRING}
              >
                <TipSurface>
                  {/* One line: who is speaking, what it is, the one thing to do
                      about it, and the way out. The ✕ is the "no thanks" — a
                      second text button saying the same thing was just noise.
                      Fixed 12px insets around the 40px mark, like a device card. */}
                  <div className="flex items-center gap-3 p-3 pr-2">
                    {front.media ?? <IconBadge icon={front.icon} tone="primary" size={40} />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-5 text-text-primary">{front.title}</p>
                      {front.body && <p className="text-xs leading-4 text-text-secondary">{front.body}</p>}
                    </div>
                    {front.actions?.map(action => (
                      <Button
                        key={action.label}
                        size="sm"
                        variant={action.primary ? 'primary' : 'neutral'}
                        onClick={action.onClick}
                        className="shrink-0"
                      >
                        {action.label}
                      </Button>
                    ))}
                    <IconButton icon={mdiClose} label="Dismiss" size="sm" tone="quiet" onClick={front.onDismiss} />
                  </div>
                </TipSurface>
              </motion.div>
            </AnimatePresence>
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
