'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { VoiceWaveBackground, type VoiceVisualState } from './VoiceWaveBackground';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { useHomeName } from '@/lib/homeName';
import { processConversation, startVoiceAssist, type VoiceAssistSession } from '@/lib/homeassistant';
import { mdiClose, mdiMicrophone, mdiSend, mdiStop } from '@mdi/js';

// ── Screensaver voice mode ────────────────────────────────────────────────────
// The screensaver's "face": clock UI fades away, a sound-reactive dot-wave
// takes over the background, and the Assist conversation plays out as floating
// chat bubbles. A more visual sibling of AssistantOverlay built for
// across-the-room use — the mic orb front and center, big text, no chrome.

interface VoiceMessage {
  id: number;
  role: 'user' | 'home';
  text: string;
}

// Ephemeral voice surface, not a chat app — only the tail of the conversation
// stays on screen.
const MAX_MESSAGES = 8;

// The global squircle rule (`[data-squircle="on"] *`) is unlayered CSS, so it
// beats any utility class — the face must stay a true circle, so opt out via
// inline style, which outranks it.
const ORB_ROUND = { cornerShape: 'round' } as React.CSSProperties;

interface ScreensaverVoiceModeProps {
  onExit: () => void;
}

export function ScreensaverVoiceMode({ onExit }: ScreensaverVoiceModeProps) {
  const { connected, demoMode } = useHomeAssistant();
  const homeName = useHomeName();
  const [entered, setEntered] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [query, setQuery] = useState('');
  const levelRef = useRef(0);
  const nextIdRef = useRef(1);
  const conversationIdRef = useRef<string | null>(null);
  const voiceSessionRef = useRef<VoiceAssistSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const orbScaleRef = useRef<HTMLDivElement>(null);
  const greetedRef = useRef(false);

  const pushMessage = useCallback((role: VoiceMessage['role'], text: string) => {
    setMessages((prev) => [...prev, { id: nextIdRef.current++, role, text }].slice(-MAX_MESSAGES));
  }, []);

  // Fade in (rAF-wrapped so the transition actually runs from opacity 0).
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Keep the newest bubble in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const startListening = useCallback(async () => {
    if (voiceSessionRef.current) {
      // Second tap ends the utterance early — HA finishes STT on what it heard.
      voiceSessionRef.current.stop();
      return;
    }
    if (demoMode || !connected) {
      pushMessage('home', 'Voice needs your home connected — try typing instead.');
      return;
    }
    voiceSessionRef.current = await startVoiceAssist({
      onListening: () => setListening(true),
      onLevel: (level) => {
        levelRef.current = level;
      },
      onTranscript: (text) => {
        pushMessage('user', text);
        setBusy(true);
      },
      onReply: (speech, conversationId) => {
        conversationIdRef.current = conversationId;
        pushMessage('home', speech);
        setBusy(false);
      },
      onSpeakingChange: setSpeaking,
      onError: (message) => {
        pushMessage('home', message);
        setBusy(false);
      },
      onEnd: () => {
        setListening(false);
        levelRef.current = 0;
        voiceSessionRef.current = null;
      },
    }, conversationIdRef.current);
  }, [connected, demoMode, pushMessage]);

  // Entering voice mode *is* the "I want to talk" gesture — greet and open the
  // mic right away instead of demanding a second tap. Never auto-open in demo
  // or while disconnected: the mode should invite typing, not open on an error.
  useEffect(() => {
    // Ref guard: StrictMode double-mounts must not greet twice. The mic timer
    // is set (and cleaned up) per mount, so exactly one survives.
    if (!greetedRef.current) {
      greetedRef.current = true;
      pushMessage('home', 'Hi — ask me anything, or tell your home what to do.');
    }
    if (demoMode || !connected) return;
    const timer = setTimeout(() => {
      void startListening();
    }, 650);
    return () => clearTimeout(timer);
    // Mount-only: greeting + auto-mic must not re-fire on re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While listening, the orb swells with the mic level — direct style writes
  // per frame keep this out of React renders.
  useEffect(() => {
    if (!listening) return;
    const el = orbScaleRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const level = Math.min(levelRef.current * 4, 1);
      el.style.transform = `scale(${(1 + level * 0.16).toFixed(3)})`;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.removeProperty('transform');
    };
  }, [listening]);

  // Escape backs out to the clock; release the mic on the way out.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onExit]);

  useEffect(() => {
    return () => {
      voiceSessionRef.current?.stop();
      voiceSessionRef.current = null;
    };
  }, []);

  const handleSend = async () => {
    const text = query.trim();
    if (!text || busy) return;
    setQuery('');
    pushMessage('user', text);
    setBusy(true);
    try {
      const result = await processConversation(text, conversationIdRef.current);
      if (!result) {
        pushMessage('home', 'I couldn’t reach your home just now, so nothing was changed.');
      } else {
        conversationIdRef.current = result.conversation_id;
        const speech = result.response?.speech?.plain?.speech;
        pushMessage(
          'home',
          speech ||
            (result.response?.response_type === 'action_done'
              ? 'Done!'
              : 'Sorry, I didn’t catch that.')
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const visualState: VoiceVisualState = listening
    ? 'listening'
    : busy
      ? 'thinking'
      : speaking
        ? 'speaking'
        : 'idle';

  const statusText = listening
    ? 'Listening…'
    : busy
      ? 'Thinking…'
      : speaking
        ? 'Speaking…'
        : 'Tap the orb and speak, or type below';

  // Orb dressing per state — the ring is a conic HA-blue gradient that spins
  // while thinking, pulses while speaking, and breathes at rest.
  const ringClass =
    visualState === 'thinking'
      ? 'opacity-100 animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none'
      : visualState === 'speaking'
        ? 'opacity-100 animate-pulse motion-reduce:animate-none'
        : visualState === 'listening'
          ? 'opacity-100'
          : 'opacity-45';

  return (
    <div
      data-component="ScreensaverVoiceMode"
      role="dialog"
      aria-label={`Talk to ${homeName}`}
      className={`absolute inset-0 z-20 transition-opacity duration-500 ${entered ? 'opacity-100' : 'opacity-0'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <VoiceWaveBackground state={visualState} levelRef={levelRef} className="absolute inset-0" />
      {/* Legibility scrim — quiets the dot field behind bubbles and controls
          without dimming the horizon where the wave does its talking. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(to_top,rgba(2,6,14,0.78),transparent)]"
        aria-hidden
      />

      <div className="relative flex flex-col h-full">
        {/* Header: quiet eyebrow + exit back to the clock */}
        <div className="flex items-center justify-between px-ha-6 pt-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
          <div className="w-11" />
          <p className="text-[13px] lg:text-xs font-semibold uppercase tracking-[0.28em] text-white/50">
            Talk to {homeName}
          </p>
          <button
            type="button"
            onClick={onExit}
            aria-label="Back to the clock"
            className="w-11 h-11 rounded-full bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/15 hover:text-white transition-colors active:scale-95"
          >
            <Icon path={mdiClose} size={18} />
          </button>
        </div>

        {/* The face — a big centered orb that owns the composition */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-ha-4 px-ha-6">
          <div ref={orbScaleRef} className="transition-transform duration-150 ease-out">
            <button
              type="button"
              onClick={() => void startListening()}
              aria-label={listening ? 'Stop listening' : 'Start voice input'}
              aria-pressed={listening}
              className={`relative w-24 h-24 lg:w-28 lg:h-28 rounded-full flex items-center justify-center active:scale-95 transition-transform ${
                visualState === 'idle' ? 'animate-[ha-orb-breathe_7s_ease-in-out_infinite] motion-reduce:animate-none' : ''
              }`}
              style={ORB_ROUND}
            >
              <span
                className={`absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#18bcf2,#d1f0ff_35%,#0a3a55_70%,#18bcf2)] transition-opacity duration-300 ${ringClass}`}
                style={ORB_ROUND}
                aria-hidden
              />
              <span
                className={`absolute inset-[3px] rounded-full transition-colors duration-300 ${
                  listening ? 'bg-ha-blue shadow-[0_0_60px_rgba(24,188,242,0.55)]' : 'bg-[#081422]/85 backdrop-blur-md'
                }`}
                style={ORB_ROUND}
                aria-hidden
              />
              <Icon path={listening ? mdiStop : mdiMicrophone} size={36} className="relative text-white" />
              {listening && (
                <span
                  className="absolute -inset-2 rounded-full border-2 border-ha-blue/50 animate-ping motion-reduce:animate-none"
                  style={ORB_ROUND}
                  aria-hidden
                />
              )}
            </button>
          </div>
          <p className="text-base lg:text-lg text-white/70 [text-shadow:0_1px_8px_rgba(0,0,0,0.4)]">
            {statusText}
          </p>
        </div>

        {/* Conversation — newest at the bottom, older bubbles fade off the top */}
        <div className="px-ha-6 pb-ha-3">
          <div
            ref={scrollRef}
            aria-live="polite"
            className="w-full max-w-lg mx-auto max-h-[36dvh] overflow-y-auto flex flex-col gap-ha-3 pt-8 [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,transparent,black_18%)]"
          >
            {messages.map((message, i) => {
              const lastOfGroup = i === messages.length - 1 || messages[i + 1].role !== message.role;
              return (
                <div
                  key={message.id}
                  className={`animate-in fade-in slide-in-from-bottom-2 duration-400 max-w-[82%] px-ha-4 py-ha-3 rounded-ha-2xl border backdrop-blur-md text-base lg:text-lg leading-snug [text-shadow:0_1px_8px_rgba(0,0,0,0.35)] ${
                    message.role === 'home'
                      ? `self-start bg-[rgba(10,30,46,0.75)] border-ha-blue/30 text-white ${lastOfGroup ? 'rounded-bl-md' : ''}`
                      : `self-end bg-[rgba(38,44,54,0.7)] border-white/20 text-white ${lastOfGroup ? 'rounded-br-md' : ''}`
                  }`}
                >
                  {message.text}
                </div>
              );
            })}
            {busy && (
              <div className="self-start flex items-center gap-1.5 px-ha-4 py-ha-3 rounded-ha-2xl rounded-bl-md bg-[rgba(10,30,46,0.75)] border border-ha-blue/30 backdrop-blur-md animate-in fade-in duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce motion-reduce:animate-none [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce motion-reduce:animate-none [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce motion-reduce:animate-none [animation-delay:300ms]" />
              </div>
            )}
          </div>
        </div>

        {/* Slim typed fallback — deliberately quieter than the orb */}
        <div
          className="px-ha-6 pb-[calc(env(safe-area-inset-bottom)+3rem)] lg:pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
        >
          <form
            className="w-full max-w-lg mx-auto flex items-center gap-ha-2 h-12 px-ha-4 rounded-ha-pill bg-white/8 backdrop-blur-md focus-within:bg-white/12 transition-colors"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask anything…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // 16px on touch screens — smaller fonts make iOS zoom on focus.
              className="flex-1 bg-transparent text-base lg:text-sm text-white placeholder-white/40 outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!query.trim() || busy}
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 bg-ha-blue text-white ${
                query.trim() && !busy ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
              }`}
            >
              <Icon path={mdiSend} size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
