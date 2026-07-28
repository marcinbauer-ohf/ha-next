'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { mdiCreation, mdiMagnify } from '@mdi/js';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { Icon } from '@/components/ui/Icon';
import { DockSlotIcon } from './DockBar';
import type { DockItem } from './dockItems';

type Mode = 'search' | 'ask';

interface SearchContentProps {
  items: DockItem[];
  onOpen: (item: DockItem) => void;
  onClose: () => void;
  /** The sheet gives results more room than the floating panel. */
  tall?: boolean;
}

/** Search over the real catalog, or type a question for Assist. */
function SearchContent({ items, onOpen, onClose, tall }: SearchContentProps) {
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, tall ? 20 : 8);
    return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 40);
  }, [items, query, tall]);

  return (
    <>
      <div className="flex items-center gap-1 px-3 pt-3">
        {(['search', 'ask'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
              mode === m ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100',
            )}
          >
            <Icon path={m === 'search' ? mdiMagnify : mdiCreation} size={13} exact />
            {m === 'search' ? 'Search' : 'Ask Assist'}
          </button>
        ))}
      </div>

      <div className="p-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && mode === 'search' && results[0]) onOpen(results[0]);
          }}
          placeholder={mode === 'search' ? 'Search Home Assistant…' : 'Ask about your home…'}
          className="w-full rounded-xl bg-neutral-100 px-3.5 py-2.5 text-[14px] text-neutral-800 outline-none ring-1 ring-inset ring-black/[0.04] placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300"
        />
      </div>

      {mode === 'search' ? (
        <div className={clsx('overflow-y-auto px-3 pb-3', tall ? 'max-h-[58dvh]' : 'max-h-[46vh]')}>
          {results.length === 0 ? (
            <p className="px-1 py-6 text-center text-[13px] text-neutral-400">Nothing matches “{query}”.</p>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-neutral-100"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                  <DockSlotIcon item={item} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-neutral-800">{item.label}</span>
                  <span className="block truncate text-[11px] text-neutral-500">{item.category}</span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : (
        <p className="px-4 pb-4 text-[12px] leading-relaxed text-neutral-400">
          Assist isn&apos;t wired up in this prototype — this is the entry point only. Search finds your real
          dashboards, apps and pages.
        </p>
      )}
    </>
  );
}

/** Desktop: floats just above the pill. */
export function SearchPanel(props: SearchContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="pointer-events-auto w-[min(92vw,520px)] overflow-hidden rounded-[22px] bg-white/90 ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-8px_rgba(0,0,0,0.22)] backdrop-blur-xl"
    >
      <SearchContent {...props} />
    </motion.div>
  );
}

/**
 * Mobile: a full bottom sheet instead of a floating panel — ModalSheet already
 * springs up from the bottom edge and drags to dismiss.
 */
export function SearchSheet({
  open,
  ...props
}: SearchContentProps & { open: boolean }) {
  return (
    <ModalSheet open={open} onClose={props.onClose} maxWidth={520}>
      <div className="pb-3">
        <SearchContent {...props} tall />
      </div>
    </ModalSheet>
  );
}
