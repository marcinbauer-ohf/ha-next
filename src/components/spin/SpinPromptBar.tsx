'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { mdiArrowUp, mdiCreationOutline } from '@mdi/js';
import { Icon } from '@/components/ui/Icon';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { useLiveSummaryItems } from '@/components/sections/SummariesPanel';
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

export function SpinPromptBar({ phase, chatOpen, onChatOpenChange, onEnter }: SpinPromptBarProps) {
  const ha = useHomeAssistant();
  const summaryItems = useLiveSummaryItems();
  const [tick, setTick] = useState(0);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const msgIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<string | null>(null);

  const phrases = useMemo(() => {
    const fromSummary = summaryItems
      .filter((s) => s.state && s.state !== '—')
      .map((s) => `${s.title} · ${s.state}`);
    return fromSummary.length > 0 ? fromSummary : ['All quiet at home'];
  }, [summaryItems]);

  useEffect(() => {
    if (chatOpen) return;
    const t = setInterval(() => setTick((n) => n + 1), 4500);
    return () => clearInterval(t);
  }, [chatOpen]);

  const phrase = phrases[tick % phrases.length];

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

  // A message typed on the ambient screen fires once the chat has opened.
  useEffect(() => {
    if (chatOpen && pendingRef.current) {
      const q = pendingRef.current;
      pendingRef.current = null;
      send(q);
    }
  }, [chatOpen, send]);

  const submit = () => {
    if (phase === 'ambient') {
      if (input.trim()) pendingRef.current = input.trim();
      setInput('');
      onEnter(!!pendingRef.current);
      return;
    }
    if (!chatOpen) {
      onChatOpenChange(true);
      if (input.trim()) {
        pendingRef.current = input.trim();
        setInput('');
      }
      return;
    }
    send(input);
  };

  const isAmbient = phase === 'ambient';

  return (
    <motion.div
      className="fixed inset-x-0 z-20 flex justify-center px-4"
      initial={false}
      animate={{ bottom: isAmbient ? 56 : 14 }}
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
    >
      <motion.div
        drag={!isAmbient ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: chatOpen ? 0 : 0.4, bottom: chatOpen ? 0.4 : 0 }}
        onDragEnd={(_, info) => {
          if (!chatOpen && (info.offset.y < -60 || info.velocity.y < -400)) onChatOpenChange(true);
          if (chatOpen && (info.offset.y > 90 || info.velocity.y > 500)) onChatOpenChange(false);
        }}
        className="flex w-full flex-col overflow-hidden border border-white/14 bg-[#081020]/60 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        initial={false}
        animate={{
          maxWidth: chatOpen ? 680 : isAmbient ? 620 : 560,
          height: chatOpen ? 'min(68vh, 620px)' : isAmbient ? 76 : 78,
          borderRadius: chatOpen ? 28 : 38,
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 26 }}
      >
        {/* Drag handle — appears once inside the app. */}
        {!isAmbient && (
          <button
            type="button"
            aria-label={chatOpen ? 'Collapse chat' : 'Expand chat'}
            onClick={() => onChatOpenChange(!chatOpen)}
            className="flex h-5 w-full shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
          >
            <span className="h-1 w-10 rounded-full bg-white/25 transition-colors hover:bg-white/45" />
          </button>
        )}

        {/* Chat history */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              key="history"
              ref={scrollRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 12px), transparent 100%)',
                maskImage: 'linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 12px), transparent 100%)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
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
          )}
        </AnimatePresence>

        {/* Input row */}
        <div className="flex shrink-0 items-center gap-3 px-3 pb-3 pt-1" style={{ minHeight: 56 }}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#18bcf2]/20">
            <Icon path={mdiCreationOutline} size={19} className="fill-[#18bcf2]" />
          </span>
          <div className="relative min-w-0 flex-1">
            {/* Rotating summary sits where the placeholder would be. */}
            {!chatOpen && input === '' && (
              <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={phrase}
                    className="truncate text-[15px] text-white/55"
                    initial={{ y: 18, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -18, opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                  >
                    {phrase}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              onFocus={() => {
                if (phase === 'app' && !chatOpen) onChatOpenChange(true);
              }}
              placeholder={chatOpen ? 'Ask your home…' : ''}
              aria-label="Talk to your home"
              className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
            />
          </div>
          <motion.button
            type="button"
            aria-label={isAmbient ? 'Enter your home' : 'Send'}
            onClick={submit}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#18bcf2] shadow-[0_0_24px_rgba(24,188,242,0.45)]"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <Icon path={mdiArrowUp} size={20} className="fill-white" />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
