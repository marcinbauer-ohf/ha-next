'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { mdiArrowUp, mdiCreationOutline, mdiMagnify } from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { useHomeSummary } from '@/hooks';
import { processConversation } from '@/lib/homeassistant';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

interface SpinPromptBarProps {
  phase: 'ambient' | 'app';
  chatOpen: boolean;
  onChatOpenChange: (open: boolean) => void;
  onEnter: (withChat?: boolean) => void;
}

/** Three shapes, one element: ambient summary box → in-app chip → chat panel. */
type BarMode = 'ambient' | 'chip' | 'chat';

export function SpinPromptBar({ phase, chatOpen, onChatOpenChange, onEnter }: SpinPromptBarProps) {
  const ha = useHomeAssistant();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const msgIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Home summary for the ambient box — seeded on entry (rAF, not render);
  // a short "summarizing" beat plays first, then the sentence fades in.
  const [summarySince, setSummarySince] = useState(Number.MAX_SAFE_INTEGER);
  const [summarizing, setSummarizing] = useState(true);
  useEffect(() => {
    if (phase !== 'ambient') return;
    const raf = requestAnimationFrame(() => {
      setSummarySince(Date.now());
      setSummarizing(true);
    });
    const timer = setTimeout(() => setSummarizing(false), 2000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [phase]);
  const summaryPhrases = useHomeSummary(summarySince);
  const summaryText = useMemo(() => {
    if (summaryPhrases.length === 0) {
      return 'All quiet at home — nothing needs your attention, and everything is just as you left it.';
    }
    const parts = summaryPhrases.slice(0, 3);
    const joined =
      parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
    return `At home right now: ${joined}.`;
  }, [summaryPhrases]);

  useEffect(() => {
    if (chatOpen) {
      // Let the expand animation start before grabbing focus.
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [chatOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || thinking) return;
      setInput('');
      setMessages((m) => [...m, { id: ++msgIdRef.current, role: 'user', text }]);
      setThinking(true);
      try {
        if (ha.demoMode || !ha.connected) {
          await new Promise((r) => setTimeout(r, 700));
          setMessages((m) => [
            ...m,
            {
              id: ++msgIdRef.current,
              role: 'assistant',
              text: 'This is the demo home, so I can only pretend to help. Connect your own home and I can really do things.',
            },
          ]);
          return;
        }
        const result = await processConversation(text, conversationIdRef.current ?? undefined);
        if (result?.conversation_id) conversationIdRef.current = result.conversation_id;
        const reply = result?.response?.speech?.plain?.speech?.trim();
        setMessages((m) => [
          ...m,
          { id: ++msgIdRef.current, role: 'assistant', text: reply || "Hmm, I didn't catch that." },
        ]);
      } catch {
        setMessages((m) => [
          ...m,
          { id: ++msgIdRef.current, role: 'assistant', text: "Something went wrong reaching your home. Try again in a moment." },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [ha.connected, ha.demoMode, thinking],
  );

  const mode: BarMode = phase === 'ambient' ? 'ambient' : chatOpen ? 'chat' : 'chip';

  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4"
      initial={false}
      animate={{ bottom: mode === 'ambient' ? 56 : mode === 'chip' ? 112 : 14 }}
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
    >
      <motion.div
        drag={mode !== 'ambient' ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: chatOpen ? 0 : 0.4, bottom: chatOpen ? 0.4 : 0 }}
        onDragEnd={(_, info) => {
          if (!chatOpen && (info.offset.y < -60 || info.velocity.y < -400)) onChatOpenChange(true);
          if (chatOpen && (info.offset.y > 90 || info.velocity.y > 500)) onChatOpenChange(false);
        }}
        className="pointer-events-auto flex flex-col overflow-hidden border border-white/14 bg-[#081020]/60 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        initial={false}
        animate={{
          width: mode === 'chip' ? 190 : '100%',
          maxWidth: mode === 'chat' ? 680 : mode === 'ambient' ? 620 : 190,
          height: mode === 'chat' ? 'min(68vh, 620px)' : mode === 'ambient' ? 82 : 44,
          borderRadius: mode === 'chat' ? 28 : mode === 'ambient' ? 30 : 22,
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 26 }}
      >
        {/* ---------- Ambient: fixed-size summary box (never reflows) ---------- */}
        {mode === 'ambient' && (
          <button
            type="button"
            aria-label="Open home chat"
            onClick={(e) => {
              e.stopPropagation();
              onEnter(true);
            }}
            className="flex h-full w-full items-center gap-3.5 px-4 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#18bcf2]/15">
              <Icon
                path={mdiCreationOutline}
                size={20}
                className={
                  summarizing
                    ? 'text-[#18bcf2] ha-think-pulse motion-reduce:animate-none'
                    : 'text-[#18bcf2]/80 animate-[ha-orb-breathe_3.2s_ease-in-out_infinite] motion-reduce:animate-none'
                }
              />
            </span>
            <span className="relative min-w-0 flex-1">
              <AnimatePresence mode="popLayout" initial={false}>
                {summarizing ? (
                  <motion.span
                    key="thinking"
                    className="ha-think-shimmer block text-[15px] leading-snug"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    Summarizing your home…
                  </motion.span>
                ) : (
                  <motion.span
                    key="summary"
                    className="line-clamp-2 block text-[15px] leading-snug text-white/45"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                  >
                    {summaryText}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </button>
        )}

        {/* ---------- Chip: "Ask or search" above the dock ---------- */}
        {mode === 'chip' && (
          <motion.button
            type="button"
            aria-label="Ask or search"
            onClick={() => onChatOpenChange(true)}
            className="flex h-full w-full items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Icon path={mdiMagnify} size={18} className="text-white/45" exact />
            <span className="text-[14px] text-white/45">Ask or search</span>
          </motion.button>
        )}

        {/* ---------- Chat: full experience ---------- */}
        {mode === 'chat' && (
          <>
            <button
              type="button"
              aria-label="Collapse chat"
              onClick={() => onChatOpenChange(false)}
              className="flex h-5 w-full shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
            >
              <span className="h-1 w-10 rounded-full bg-white/25 transition-colors hover:bg-white/45" />
            </button>

            <motion.div
              ref={scrollRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 12px), transparent 100%)',
                maskImage: 'linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 12px), transparent 100%)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.15 }}
            >
              {messages.length === 0 && !thinking && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <Icon path={mdiCreationOutline} size={30} className="fill-white/30" />
                  <p className="max-w-[260px] text-sm text-white/45">
                    Ask about your home — lights, climate, who&apos;s around — or tell it what to do.
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                >
                  <span
                    className={
                      m.role === 'user'
                        ? 'max-w-[78%] rounded-3xl rounded-br-lg bg-[#18bcf2] px-4 py-2.5 text-[15px] text-white'
                        : 'max-w-[78%] rounded-3xl rounded-bl-lg bg-white/10 px-4 py-2.5 text-[15px] text-white/90'
                    }
                  >
                    {m.text}
                  </span>
                </motion.div>
              ))}
              {thinking && (
                <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span className="flex items-center gap-1.5 rounded-3xl rounded-bl-lg bg-white/10 px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-white/60"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                      />
                    ))}
                  </span>
                </motion.div>
              )}
            </motion.div>

            <div className="flex shrink-0 items-center gap-3 px-3 pb-3 pt-1" style={{ minHeight: 56 }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#18bcf2]/20">
                <Icon path={mdiCreationOutline} size={19} className="fill-[#18bcf2]" />
              </span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder="Ask your home…"
                aria-label="Talk to your home"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
              />
              <motion.button
                type="button"
                aria-label="Send"
                onClick={() => send(input)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#18bcf2] shadow-[0_0_24px_rgba(24,188,242,0.45)]"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
              >
                <Icon path={mdiArrowUp} size={20} className="fill-white" />
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
