'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { mdiCreation, mdiMagnify, mdiSend } from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { useHomeSummary, summaryToSentence } from '@/hooks';
import { DockSlotIcon } from './DockBar';
import type { DockItem } from './dockItems';

/** Shared id for the morph: the screensaver pill and the dock chip are one element. */
const ASK_LAYOUT_ID = 'dock-ask-pill';
/** How long the "summarizing" beat runs before the sentence lands. Dummy pacing
 *  for now — a real summarizer can slot in behind the same state. */
const THINKING_MS = 2200;

/**
 * The one-line note about the home, plus the thinking beat that precedes it.
 * Phrases are the real ledger (same hook the main prototype's talk widget uses);
 * the window opens when the pill appears, so it reads "since you walked away".
 */
function useAskSummary(): { thinking: boolean; text: string } {
  // Seeded in an effect rather than at render — Date.now() during render trips
  // the compiler rules, and the sentinel keeps the window empty until then.
  const [since, setSince] = useState(Number.MAX_SAFE_INTEGER);
  const [thinking, setThinking] = useState(true);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setSince(Date.now()));
    const timer = setTimeout(() => setThinking(false), THINKING_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  const phrases = useHomeSummary(since);
  const text = useMemo(() => summaryToSentence(phrases), [phrases]);
  return { thinking, text };
}

/** Sparkle that breathes while it's thinking and settles once the text lands. */
function AskIcon({ busy, size = 20 }: { busy: boolean; size?: number }) {
  return (
    <Icon
      path={mdiCreation}
      size={size}
      exact
      className={clsx(
        'shrink-0 transition-colors duration-500',
        busy ? 'animate-pulse text-neutral-500 motion-reduce:animate-none' : 'text-neutral-400',
      )}
    />
  );
}

/**
 * The ask box, in its two homes. Both are the same framer element (one
 * `layoutId`), so dismissing the screensaver morphs the big pill down into the
 * chip above the dock instead of swapping one for the other.
 *
 * - `saver`: wide, two lines tall from the first frame — the thinking beat and
 *   the summary that replaces it are stacked and cross-faded, so neither the
 *   pill nor the page ever reflows.
 * - `chip`: the compact resting state above the dock.
 */
export function AskPill({ variant, onOpen }: { variant: 'saver' | 'chip'; onOpen: () => void }) {
  const { thinking, text } = useAskSummary();
  const saver = variant === 'saver';

  return (
    <motion.button
      layoutId={ASK_LAYOUT_ID}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className={clsx(
        'pointer-events-auto flex shrink-0 items-center bg-white/80 text-left backdrop-blur-xl ring-1 ring-black/[0.06] transition-shadow hover:bg-white',
        saver
          ? 'h-[76px] w-[min(92vw,520px)] gap-3.5 rounded-[26px] px-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-8px_rgba(0,0,0,0.16)]'
          : 'h-10 gap-2 rounded-full pl-3.5 pr-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.16)]',
      )}
    >
      {saver ? <AskIcon busy={thinking} size={22} /> : <Icon path={mdiMagnify} size={18} exact className="shrink-0 text-neutral-400" />}

      {saver ? (
        // Fixed two-line box: both states are absolutely stacked inside it, so
        // the swap is a cross-fade with no height change.
        <span className="relative min-w-0 flex-1 self-stretch">
          <span
            className={clsx(
              'absolute inset-y-0 left-0 right-0 flex items-center text-[15px] text-neutral-400 transition-opacity duration-500',
              thinking ? 'opacity-100' : 'opacity-0',
            )}
          >
            Summarizing your home
            <span className="ml-1 inline-flex gap-1" aria-hidden>
              <span className="h-1 w-1 animate-bounce rounded-full bg-neutral-400 motion-reduce:animate-none" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-neutral-400 motion-reduce:animate-none [animation-delay:150ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-neutral-400 motion-reduce:animate-none [animation-delay:300ms]" />
            </span>
          </span>
          <span
            className={clsx(
              'absolute inset-y-0 left-0 right-0 flex items-center text-[15px] leading-[22px] text-neutral-400 transition-opacity duration-700',
              thinking ? 'opacity-0' : 'opacity-100',
            )}
          >
            <span className="line-clamp-2">{text}</span>
          </span>
        </span>
      ) : (
        <span className="whitespace-nowrap text-[13px] text-neutral-400">Ask or search</span>
      )}
    </motion.button>
  );
}

interface Message {
  role: 'home' | 'you';
  text: string;
}

/**
 * The full surface behind the pill, opened the way every other dock page opens.
 * It's the search box too — typing filters everything in the home, so the chip
 * can honestly say "ask or search" with one input behind it.
 */
export function AskChatPane({ items, onOpen }: { items: DockItem[]; onOpen: (item: DockItem) => void }) {
  const { thinking, text } = useAskSummary();
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 6);
  }, [items, query]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const asked = query.trim();
    if (!asked) return;
    setQuery('');
    setMessages((prev) => [
      ...prev,
      { role: 'you', text: asked },
      // Honest placeholder: this prototype can navigate, not answer.
      {
        role: 'home',
        text: "I can't answer that yet — but start typing the name of anything in your home and I'll take you straight there.",
      },
    ]);
  };

  return (
    <div className="flex h-full flex-col rounded-xl bg-neutral-50 p-3">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-2">
        {/* The same note the pill showed, as the opening line of the conversation. */}
        <div className="flex items-start gap-2.5">
          <span className="mt-1.5">
            <AskIcon busy={thinking} size={18} />
          </span>
          <p className="max-w-[80%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[14px] leading-snug text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            {thinking ? 'Summarizing your home…' : text}
          </p>
        </div>

        {messages.map((message, i) => (
          <div
            key={i}
            className={clsx('flex items-start gap-2.5', message.role === 'you' && 'justify-end')}
          >
            {message.role === 'home' && (
              <span className="mt-1.5">
                <AskIcon busy={false} size={18} />
              </span>
            )}
            <p
              className={clsx(
                'max-w-[80%] px-3.5 py-2.5 text-[14px] leading-snug',
                message.role === 'you'
                  ? 'rounded-2xl rounded-tr-md bg-neutral-800 text-white'
                  : 'rounded-2xl rounded-tl-md bg-white text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
              )}
            >
              {message.text}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Matches while typing — the search half of the box, above the input. */}
      {results.length > 0 && (
        <div className="mb-2 flex flex-col rounded-2xl bg-white p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setQuery('');
                onOpen(item);
              }}
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
          ))}
        </div>
      )}

      {/* Same pill shape as the chip that opened it. */}
      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 ring-1 ring-black/[0.06]">
        <Icon path={mdiMagnify} size={18} exact className="shrink-0 text-neutral-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (results[0]) {
              setQuery('');
              onOpen(results[0]);
            } else {
              send();
            }
          }}
          placeholder="Ask about your home, or find anything in it"
          className="min-w-0 flex-1 bg-transparent py-1 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={send}
          aria-label="Send"
          disabled={!query.trim()}
          className="shrink-0 rounded-full p-1 text-neutral-400 transition-colors hover:text-neutral-700 disabled:opacity-40"
        >
          <Icon path={mdiSend} size={18} exact />
        </button>
      </div>
    </div>
  );
}
