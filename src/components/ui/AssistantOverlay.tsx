'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './Icon';
import { useAssistantContext } from '@/contexts/AssistantContext';
import {
  mdiMicrophone,
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

        {/* Microphone area */}
        <div className={`flex flex-col items-center py-ha-6 transition-all duration-500 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}>
          {/* Pulsing mic button */}
          <button
            onClick={handleMicClick}
            className="relative mb-ha-4"
          >
            {/* Pulse rings */}
            <div className={`absolute inset-0 rounded-full bg-ha-blue/20 transition-all duration-500 ${
              listening ? 'scale-[2.2] opacity-100 animate-pulse' : 'scale-100 opacity-0'
            }`} />
            <div className={`absolute inset-0 rounded-full bg-ha-blue/10 transition-all duration-700 ${
              listening ? 'scale-[3] opacity-100 animate-pulse' : 'scale-100 opacity-0'
            }`} style={{ animationDelay: '150ms' }} />
            {/* Button */}
            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
              listening
                ? 'bg-ha-blue scale-110 shadow-lg shadow-ha-blue/30'
                : 'bg-fill-primary-normal hover:bg-fill-primary-quiet'
            }`}>
              <Icon
                path={mdiMicrophone}
                size={28}
                className={`transition-colors duration-300 ${listening ? 'text-white' : 'text-ha-blue'}`}
              />
            </div>
          </button>

          <p className={`text-sm transition-all duration-300 ${
            listening ? 'text-ha-blue font-medium' : 'text-text-secondary'
          }`}>
            {listening ? 'Listening...' : <>Ask <span className="capitalize">{contextName}</span> anything</>}
          </p>
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
