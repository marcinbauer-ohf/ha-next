'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { SectionLabel } from './SectionLabel';
import { useAssistantContext } from '@/contexts/AssistantContext';
import { useCloseOnScreensaver } from '@/contexts';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useSheetDrag } from '@/hooks/useSheetDrag';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { processConversation, startVoiceAssist, type VoiceAssistSession } from '@/lib/homeassistant';
import {
  mdiClose,
  mdiLightbulbOnOutline,
  mdiThermometer,
  mdiLock,
  mdiWeatherPartlyCloudy,
  mdiSend,
} from '@mdi/js';

const suggestions = [
  { icon: mdiLightbulbOnOutline, label: 'Turn off all lights' },
  { icon: mdiThermometer, label: 'Set temperature to 22°' },
  { icon: mdiLock, label: 'Lock all doors' },
  { icon: mdiWeatherPartlyCloudy, label: 'What’s the weather?' },
];

export function AssistantOverlay() {
  const pathname = usePathname();
  const { assistantOpen, initialQuery, closeAssistant } = useAssistantContext();
  const { connected, demoMode } = useHomeAssistant();
  useCloseOnScreensaver(assistantOpen, closeAssistant);
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [listening, setListening] = useState(false);
  // Last Assist reply, shown in Casita's speech bubble; null = greeting.
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  // Live voice session (assist_pipeline/run) — null when not listening.
  const voiceSessionRef = useRef<VoiceAssistSession | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Mount/unmount with staggered animation
  useEffect(() => {
    if (assistantOpen) {
      setMounted(true);
      setQuery(initialQuery ?? '');
      setListening(false);
      setReply(null);
      setBusy(false);
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
      setReply('I need a live Home Assistant connection to hear you.');
      return;
    }
    setReply(null);
    setQuery('');
    voiceSessionRef.current = await startVoiceAssist({
      onListening: () => setListening(true),
      onTranscript: (text) => {
        // Echo what was heard into the input while Assist works out a reply.
        setQuery(text);
        setBusy(true);
      },
      onReply: (speech, conversationId) => {
        conversationIdRef.current = conversationId;
        setReply(speech);
        setBusy(false);
        setQuery('');
      },
      onError: (message) => {
        setReply(message);
        setBusy(false);
      },
      onEnd: () => {
        setListening(false);
        voiceSessionRef.current = null;
      },
    }, conversationIdRef.current);
  };

  const handleSend = async () => {
    const text = query.trim();
    if (!text || busy) return;
    setBusy(true);
    setQuery('');
    try {
      const result = await processConversation(text, conversationIdRef.current);
      if (!result) {
        setReply('I need a live Home Assistant connection to run commands.');
      } else {
        conversationIdRef.current = result.conversation_id;
        const speech = result.response?.speech?.plain?.speech;
        setReply(
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
          (1.5rem / ha-6), instead of sitting flush against them. */}
      <div
        className={`relative mt-auto bg-surface-default transition-[transform,opacity] duration-300 ease-out ${
          contained
            ? 'mx-ha-6 mb-ha-6 rounded-ha-3xl border border-surface-low/50 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.08)]'
            : 'w-full rounded-t-ha-3xl'
        } ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
        style={{ maxHeight: contained ? 'calc(85% - var(--ha-space-6))' : '85dvh', paddingBottom: 'env(safe-area-inset-bottom)', ...sheetDrag.dragStyle }}
      >
        {/* Drag indicator + close. This row doubles as the drag handle. */}
        <div
          {...sheetDrag.handleProps}
          className={`flex items-center justify-between px-ha-4 pt-ha-3 pb-ha-1 ${isDesktop ? '' : 'touch-none cursor-grab active:cursor-grabbing'}`}
        >
          <div className="w-8" />
          <div className="w-10 h-1 rounded-full bg-text-secondary/30" />
          <button
            onClick={closeAssistant}
            aria-label="Close assistant"
            className="w-8 h-8 rounded-full bg-surface-lower flex items-center justify-center text-text-secondary"
          >
            <Icon path={mdiClose} size={18} />
          </button>
        </div>

        {/* Casita Bot and Chat Bubble area */}
        <div className={`flex flex-col items-center py-ha-6 px-ha-4 transition-all duration-500 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}>
          {/* Bot Image */}
          <button
            onClick={handleMicClick}
            aria-label={listening ? 'Stop listening' : 'Start voice input'}
            aria-pressed={listening}
            className="relative mb-ha-4 group active:scale-95 transition-transform outline-none"
          >
             <img
               src="/casita.png"
               alt=""
               className="w-40 h-40 object-contain animate-bounce-slow filter drop-shadow-lg"
             />
             {/* Interaction ring when listening */}
             <div className={`absolute inset-0 rounded-full border-4 border-ha-blue/30 transition-all duration-500 scale-125 ${
               listening ? 'opacity-100 animate-pulse' : 'opacity-0'
             }`} />
          </button>

          {/* Chat Bubble from Casita */}
          <div className="relative bg-ha-blue text-white p-ha-4 rounded-ha-2xl shadow-lg max-w-[280px] mb-ha-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300" aria-live="polite">
             {/* Triangle tip */}
             <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-ha-blue rotate-45" />

             <p className="text-sm font-medium text-center">
                {busy ? (
                  'Thinking…'
                ) : reply ? (
                  reply
                ) : listening ? (
                  "I'm listening... Tell me what you need."
                ) : (
                  <>Hola! I&apos;m <span className="font-bold">Casita</span>. How can I help you with your <span className="capitalize font-bold">{contextName}</span> today?</>
                )}
             </p>
          </div>
        </div>

        {/* Text input */}
        <div className={`px-ha-4 mb-ha-4 transition-all duration-300 delay-75 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <form
            className="flex items-center gap-ha-2 bg-surface-lower rounded-ha-2xl px-ha-4 h-12"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask, or tell your home what to do…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // 16px on touch screens — smaller fonts make iOS zoom on focus.
              className="flex-1 bg-transparent text-base lg:text-sm text-text-primary placeholder-text-tertiary outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!query.trim() || busy}
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                query.trim() && !busy ? 'bg-ha-blue text-white scale-100' : 'text-text-tertiary scale-90 opacity-50'
              }`}
            >
              <Icon path={mdiSend} size={16} />
            </button>
          </form>
        </div>

        {/* Suggestions */}
        <div className={`px-ha-4 pb-ha-6 transition-all duration-300 delay-150 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <SectionLabel className="mb-ha-2 px-ha-1">Suggestions</SectionLabel>
          <div className="flex flex-wrap gap-ha-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(s.label);
                  inputRef.current?.focus();
                }}
                className={`flex items-center gap-ha-2 bg-surface-lower rounded-ha-xl px-ha-3 py-ha-2 transition-all duration-300 hover:bg-surface-low active:scale-95`}
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
  );

  return glowRoot && contained ? createPortal(dialog, glowRoot) : dialog;
}
