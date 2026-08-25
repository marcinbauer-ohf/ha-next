'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { SectionLabel } from './SectionLabel';
import { type VoiceVisualState } from './VoiceWaveBackground';
import { useAssistantContext } from '@/contexts/AssistantContext';
import { useCloseOnScreensaver } from '@/contexts';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { processConversation, startVoiceAssist, type VoiceAssistSession } from '@/lib/homeassistant';
import { SheetGrabber } from './SheetGrabber';
import {
  mdiClose,
  mdiLightbulbOnOutline,
  mdiThermometer,
  mdiLock,
  mdiWeatherPartlyCloudy,
  mdiMicrophone,
  mdiSend,
  mdiStop,
} from '@mdi/js';

/**
 * The app's resolved light/dark, read off the root element — `mode` from
 * useTheme can be 'system', and the canvas scene needs the settled answer.
 */
function useIsDarkMode(): boolean {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.getAttribute('data-mode') === 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-mode'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

// ── Assistant overlay ─────────────────────────────────────────────────────────
// The dashboard's ask sheet: a regular app sheet — same surface, radii and
// border as every other one — carrying the screensaver voice mode's mic-orb
// face, chat bubbles and input pill. No dot-wave scene behind it. Sheet
// mechanics (drag-dismiss, panel containment on desktop, focus trap) unchanged.

const suggestions = [
  { icon: mdiLightbulbOnOutline, label: 'Turn off all lights' },
  { icon: mdiThermometer, label: 'Set temperature to 22°' },
  { icon: mdiLock, label: 'Lock all doors' },
  { icon: mdiWeatherPartlyCloudy, label: 'What’s the weather?' },
];

interface AssistMessage {
  id: number;
  role: 'user' | 'home';
  text: string;
}

// Ephemeral surface — only the tail of the conversation stays on screen.
const MAX_MESSAGES = 8;

// The global squircle rule (`[data-squircle="on"] *`) is unlayered CSS, so it
// beats any utility class — the face must stay a true circle, so opt out via
// inline style, which outranks it.
const ORB_ROUND = { cornerShape: 'round' } as React.CSSProperties;

export function AssistantOverlay() {
  const pathname = usePathname();
  const { assistantOpen, initialQuery, closeAssistant } = useAssistantContext();
  const { connected, demoMode } = useHomeAssistant();
  const dark = useIsDarkMode();
  useCloseOnScreensaver(assistantOpen, closeAssistant);
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [messages, setMessages] = useState<AssistMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const levelRef = useRef(0);
  const nextIdRef = useRef(1);
  const conversationIdRef = useRef<string | null>(null);
  // Live voice session (assist_pipeline/run) — null when not listening.
  const voiceSessionRef = useRef<VoiceAssistSession | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const orbScaleRef = useRef<HTMLDivElement>(null);
  // Desktop: contained within the dashboard panel (portaled into #toast-glow-root,
  // the same clip layer the corner toast uses) instead of a viewport-wide sheet.
  const [isDesktop, setIsDesktop] = useState(false);
  const [glowRoot, setGlowRoot] = useState<HTMLElement | null>(null);

  useFocusTrap(assistantOpen, containerRef);

  const sheetDrag = useSheetDrag({ onClose: closeAssistant, disabled: isDesktop });

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setGlowRoot(document.getElementById('toast-glow-root'));
  }, []);

  const contextName = pathname === '/' ? 'Home' :
    pathname.startsWith('/room/') ? pathname.split('/')[2]?.replace(/_/g, ' ') :
    pathname.startsWith('/dashboard/') ? pathname.split('/')[2] :
    'Home';

  const pushMessage = useCallback((role: AssistMessage['role'], text: string) => {
    setMessages((prev) => [...prev, { id: nextIdRef.current++, role, text }].slice(-MAX_MESSAGES));
  }, []);

  // Mount/unmount with staggered animation
  useEffect(() => {
    if (assistantOpen) {
      setMounted(true);
      setQuery(initialQuery ?? '');
      setListening(false);
      setSpeaking(false);
      setMessages([]);
      setBusy(false);
      levelRef.current = 0;
      conversationIdRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
          inputRef.current?.focus();
        });
      });
    } else {
      // Closing mid-utterance: end the audio stream so the mic is released.
      voiceSessionRef.current?.stop();
      voiceSessionRef.current = null;
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [assistantOpen, initialQuery]);

  // Keep the newest bubble in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

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

  // Escape to close
  useEffect(() => {
    if (!assistantOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAssistant();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assistantOpen, closeAssistant]);

  const handleMicClick = async () => {
    // Second tap ends the utterance early — HA finishes STT on what it heard.
    if (listening) {
      voiceSessionRef.current?.stop();
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
  };

  const handleSend = async () => {
    const text = query.trim();
    if (!text || busy) return;
    setBusy(true);
    setQuery('');
    pushMessage('user', text);
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
      inputRef.current?.focus();
    }
  };

  if (!mounted) return null;

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
        : `Tap the orb and speak, or type below`;

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

  // On desktop, contain the sheet to the dashboard panel's bounds (clipped +
  // rounded to match, via the shared #toast-glow-root layer) instead of a
  // viewport-wide sheet that bleeds over the sidebar and top/status bars.
  const contained = isDesktop && glowRoot != null;

  const dialog = (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Assistant"
      className={contained
        ? 'absolute dashboard-panel-clip z-[70] flex flex-col pointer-events-auto'
        : 'fixed inset-0 z-[100] flex flex-col'}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeAssistant}
      />

      {/* Panel - slides up from the bottom of the dialog's bounds (viewport on
          mobile, the dashboard panel on desktop). Contained variant floats
          inset from the panel edges by the same margin as the corner toast
          (1.5rem / ha-6), instead of sitting flush against them. Plain sheet
          surface — same as every other sheet in the app. */}
      <div
        // Slide only, and past the bottom margin — same as Home Center: fading
        // while it travels showed the dashboard through the sheet mid-flight,
        // and translate-y-full alone left the last 24px inside the clip.
        className={`relative mt-auto overflow-hidden bg-surface-lower text-text-primary transition-transform duration-300 ease-out ${
          contained
            ? 'mx-ha-6 mb-ha-6 rounded-ha-3xl border border-surface-low/50 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.15)]'
            : 'w-full rounded-t-ha-sheet border-t border-white/10'
        }`}
        style={{
          maxHeight: contained ? 'calc(85% - var(--ha-space-6))' : '85dvh',
          transform: visible ? undefined : `translateY(calc(100% + ${contained ? 'var(--ha-space-6)' : '0px'}))`,
          ...sheetDrag.dragStyle,
        }}
      >
        <div className="relative flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {/* Drag indicator + close. This row doubles as the drag handle. */}
          <div
            {...sheetDrag.handleProps}
            className={`flex items-center justify-between px-ha-4 pt-ha-3 pb-ha-1 ${isDesktop ? '' : 'touch-none cursor-grab active:cursor-grabbing'}`}
          >
            <div className="w-8" />
            <SheetGrabber />
            <IconButton icon={mdiClose} label="Close assistant" size="sm" filled onClick={closeAssistant} />
          </div>

          {/* The face — same orb as the lock screen, sheet-sized */}
          <div className={`flex flex-col items-center gap-ha-3 pt-ha-2 pb-ha-4 px-ha-4 transition-all duration-500 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}>
            <div ref={orbScaleRef} className="transition-transform duration-150 ease-out">
              <button
                type="button"
                onClick={() => void handleMicClick()}
                aria-label={listening ? 'Stop listening' : 'Start voice input'}
                aria-pressed={listening}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center active:scale-95 transition-transform ${
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
                    listening
                      ? 'bg-ha-blue shadow-[0_0_50px_rgba(24,188,242,0.55)]'
                      : dark
                        ? 'bg-[#081422]/85 backdrop-blur-md'
                        : 'bg-surface-default/85 backdrop-blur-md'
                  }`}
                  style={ORB_ROUND}
                  aria-hidden
                />
                <Icon
                  path={listening ? mdiStop : mdiMicrophone}
                  size={30}
                  className={`relative ${listening || dark ? 'text-white' : 'text-text-primary'}`}
                />
                {listening && (
                  <span
                    className="absolute -inset-2 rounded-full border-2 border-ha-blue/50 animate-ping motion-reduce:animate-none"
                    style={ORB_ROUND}
                    aria-hidden
                  />
                )}
              </button>
            </div>
            <p className="text-sm text-text-secondary">{statusText}</p>
          </div>

          {/* Conversation — same glass bubbles as the lock screen */}
          <div className="px-ha-4 pb-ha-3">
            <div
              ref={scrollRef}
              aria-live="polite"
              className="w-full max-w-lg mx-auto max-h-[30dvh] overflow-y-auto flex flex-col gap-ha-2 pt-6 [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,transparent,black_16%)]"
            >
              {messages.length === 0 && (
                <div className="self-start max-w-[82%] px-ha-4 py-ha-3 rounded-ha-2xl rounded-bl-ha-md border bg-surface-low/85 border-ha-blue/30 backdrop-blur-md text-[15px] leading-snug animate-in fade-in slide-in-from-bottom-2 duration-400">
                  Hi — ask me anything, or tell your <span className="capitalize font-medium">{contextName}</span> what to do.
                </div>
              )}
              {messages.map((message, i) => {
                const lastOfGroup = i === messages.length - 1 || messages[i + 1].role !== message.role;
                return (
                  <div
                    key={message.id}
                    className={`animate-in fade-in slide-in-from-bottom-2 duration-400 max-w-[82%] px-ha-4 py-ha-3 rounded-ha-2xl border backdrop-blur-md text-[15px] leading-snug text-text-primary ${
                      message.role === 'home'
                        ? `self-start bg-surface-low/85 border-ha-blue/30 ${lastOfGroup ? 'rounded-bl-ha-md' : ''}`
                        : `self-end bg-surface-mid/85 border-border-default ${lastOfGroup ? 'rounded-br-ha-md' : ''}`
                    }`}
                  >
                    {message.text}
                  </div>
                );
              })}
              {busy && (
                <div className="self-start flex items-center gap-1.5 px-ha-4 py-ha-3 rounded-ha-2xl rounded-bl-ha-md bg-surface-low/85 border border-ha-blue/30 backdrop-blur-md animate-in fade-in duration-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-bounce motion-reduce:animate-none [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-bounce motion-reduce:animate-none [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-bounce motion-reduce:animate-none [animation-delay:300ms]" />
                </div>
              )}
            </div>
          </div>

          {/* Text input — the same glass pill as the lock screen widget */}
          <div className={`px-ha-4 mb-ha-4 transition-all duration-300 delay-75 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <form
              className="w-full max-w-lg mx-auto flex items-center gap-ha-2 h-12 px-ha-4 rounded-full bg-surface-low/85 backdrop-blur-md focus-within:bg-surface-mid/85 transition-colors"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask anything…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // 16px on touch screens — smaller fonts make iOS zoom on focus.
                className="flex-1 bg-transparent text-base lg:text-sm text-text-primary placeholder-text-tertiary outline-none"
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

          {/* Suggestions — glass chips on the dark scene */}
          <div className={`px-ha-4 pb-ha-6 transition-all duration-300 delay-150 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <div className="w-full max-w-lg mx-auto">
              <SectionLabel className="mb-ha-2 px-ha-1">Suggestions</SectionLabel>
              <div className="flex flex-wrap gap-ha-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(s.label);
                      inputRef.current?.focus();
                    }}
                    className="flex items-center gap-ha-2 bg-surface-low/85 border border-border-default backdrop-blur-md rounded-ha-xl px-ha-3 py-ha-2 transition-all duration-300 hover:bg-surface-mid/85 active:scale-95"
                    style={{ transitionDelay: visible ? `${175 + i * 50}ms` : '0ms' }}
                  >
                    <Icon path={s.icon} size={16} className="text-text-secondary" />
                    <span className="text-sm text-text-primary">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return glowRoot && contained ? createPortal(dialog, glowRoot) : dialog;
}
