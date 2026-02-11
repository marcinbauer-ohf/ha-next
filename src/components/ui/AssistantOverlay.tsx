'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { useAssistantContext } from '@/contexts/AssistantContext';
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
  { icon: mdiThermometer, label: 'Set temperature to 22\u00b0' },
  { icon: mdiLock, label: 'Lock all doors' },
  { icon: mdiWeatherPartlyCloudy, label: 'What\u2019s the weather?' },
];

export function AssistantOverlay() {
  const pathname = usePathname();
  const { assistantOpen, closeAssistant } = useAssistantContext();
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const contextName = pathname === '/' ? 'Home' :
    pathname.startsWith('/room/') ? pathname.split('/')[2]?.replace(/_/g, ' ') :
    pathname.startsWith('/dashboard/') ? pathname.split('/')[2] :
    'Home';

  // Mount/unmount with staggered animation
  useEffect(() => {
    if (assistantOpen) {
      setMounted(true);
      setQuery('');
      setListening(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
          inputRef.current?.focus();
        });
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [assistantOpen]);

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

  const handleMicClick = () => {
    setListening(prev => !prev);
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeAssistant}
      />

      {/* Panel - slides up from bottom */}
      <div
        className={`relative mt-auto w-full bg-surface-default rounded-t-ha-3xl transition-[transform,opacity] duration-300 ease-out ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        style={{ maxHeight: '85dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag indicator + close */}
        <div className="flex items-center justify-between px-ha-4 pt-ha-3 pb-ha-1">
          <div className="w-8" />
          <div className="w-10 h-1 rounded-full bg-text-secondary/30" />
          <button
            onClick={closeAssistant}
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
            className="relative mb-ha-4 group active:scale-95 transition-transform outline-none"
          >
             <img 
               src="/casita.png" 
               alt="Casita Bot" 
               className="w-40 h-40 object-contain animate-bounce-slow filter drop-shadow-lg"
             />
             {/* Interaction ring when listening */}
             <div className={`absolute inset-0 rounded-full border-4 border-ha-blue/30 transition-all duration-500 scale-125 ${
               listening ? 'opacity-100 animate-pulse' : 'opacity-0'
             }`} />
          </button>

          {/* Chat Bubble from Casita */}
          <div className="relative bg-ha-blue text-white p-ha-4 rounded-ha-2xl shadow-lg max-w-[280px] mb-ha-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
             {/* Triangle tip */}
             <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-ha-blue rotate-45" />
             
             <p className="text-sm font-medium text-center">
                {listening ? (
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
          <div className="flex items-center gap-ha-2 bg-surface-lower rounded-ha-2xl px-ha-4 h-12">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-tertiary outline-none"
            />
            <button
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                query ? 'bg-ha-blue text-white scale-100' : 'text-text-tertiary scale-90 opacity-50'
              }`}
            >
              <Icon path={mdiSend} size={16} />
            </button>
          </div>
        </div>

        {/* Suggestions */}
        <div className={`px-ha-4 pb-ha-6 transition-all duration-300 delay-150 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium mb-ha-2 px-ha-1">Suggestions</p>
          <div className="flex flex-wrap gap-ha-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setQuery(s.label)}
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
}
