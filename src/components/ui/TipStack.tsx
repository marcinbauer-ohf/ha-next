'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { mdiClose } from '@mdi/js';
import { Icon } from './Icon';

export interface TipStackAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface TipStackTip {
  id: string;
  icon: string;
  title: string;
  body: string;
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

// The dashboard surface is bg-surface-lower and the tip tint is translucent, so
// every layer gets an opaque surface-lower backing — without it the peeking
// cards would shine through the front card.
function TipSurface({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-ha-2xl bg-surface-lower h-full">
      <div className="rounded-ha-2xl bg-ha-blue/8 border border-ha-blue/15 h-full">
        {children}
      </div>
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
                  <div className="p-ha-4 flex items-start gap-ha-3">
                    <div className="w-9 h-9 rounded-ha-xl bg-ha-blue/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon path={front.icon} size={20} className="text-ha-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{front.title}</p>
                      <p className="text-sm text-text-secondary mt-0.5 leading-snug">{front.body}</p>
                      {front.actions && front.actions.length > 0 && (
                        <div className="flex gap-ha-2 mt-ha-3">
                          {front.actions.map(action => (
                            <button
                              key={action.label}
                              onClick={action.onClick}
                              className={
                                action.primary
                                  ? 'text-sm font-semibold text-white bg-ha-blue rounded-ha-xl px-ha-3 py-1.5 hover:bg-ha-blue/90 active:scale-95 transition-all'
                                  : 'text-sm text-text-secondary hover:text-text-primary transition-colors px-ha-2 py-1.5'
                              }
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={front.onDismiss}
                      aria-label="Dismiss tip"
                      className="text-text-tertiary hover:text-text-secondary transition-colors shrink-0 p-0.5"
                    >
                      <Icon path={mdiClose} size={18} />
                    </button>
                  </div>
                </TipSurface>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
