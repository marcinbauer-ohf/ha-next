'use client';

import { useState } from 'react';
import { Icon } from './Icon';
import { mdiHomeAssistant, mdiLinkVariant, mdiKey, mdiArrowRight } from '@mdi/js';

interface SetupScreenProps {
  onSave: (url: string, token: string) => Promise<void>;
  error?: string | null;
  connecting?: boolean;
}

export function SetupScreen({ onSave, error, connecting }: SetupScreenProps) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (securityAnswer.toLowerCase().trim() !== 'home assistant sync') {
      return; 
    }
    
    if (url.trim() && token.trim() && !connecting) {
      onSave(url.trim(), token.trim());
    }
  };

  const isSecurityCorrect = securityAnswer.toLowerCase().trim() === 'home assistant sync';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-surface-lower p-ha-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-ha-8">
          <div className="w-16 h-16 rounded-2xl bg-ha-blue/10 flex items-center justify-center mb-ha-4">
            <Icon path={mdiHomeAssistant} size={36} className="text-ha-blue" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Connect to Home Assistant</h1>
          <p className="text-sm text-text-secondary mt-ha-2 text-center">
            Enter your Home Assistant URL and a Long-Lived Access Token to get started.
          </p>
          
          <div className="mt-ha-4 p-ha-3 rounded-ha-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-600 dark:text-orange-400 max-w-sm text-center">
             This page does not store your url and token. They are stored in your local browser storage, which can be cleared once logged in.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-ha-4">
          <div>
            <label htmlFor="ha-url" className="block text-sm font-medium text-text-primary mb-ha-1">
              Home Assistant URL
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon path={mdiLinkVariant} size={18} className="text-text-secondary" />
              </div>
              <input
                id="ha-url"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://homeassistant.local:8123"
                disabled={connecting}
                className="w-full pl-10 pr-4 py-3 rounded-ha-xl bg-surface-default border border-fill-primary-normal text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-ha-blue/50 focus:border-ha-blue transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ha-token" className="block text-sm font-medium text-text-primary mb-ha-1">
              Long-Lived Access Token
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon path={mdiKey} size={18} className="text-text-secondary" />
              </div>
              <input
                id="ha-token"
                type="password"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your token here"
                disabled={connecting}
                className="w-full pl-10 pr-4 py-3 rounded-ha-xl bg-surface-default border border-fill-primary-normal text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-ha-blue/50 focus:border-ha-blue transition-colors disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-text-secondary mt-ha-1">
              Create one in Home Assistant at <span className="font-mono">Profile → Security → Long-Lived Access Tokens</span>
            </p>
          </div>

          <div>
             <label htmlFor="security-q" className="block text-sm font-medium text-text-primary mb-ha-1">
               Restricted access: What is the name of the meeting we all attend on mondays?
             </label>
             <input
               id="security-q"
               type="text"
               required
               value={securityAnswer}
               onChange={(e) => setSecurityAnswer(e.target.value)}
               placeholder="Answer..."
               disabled={connecting}
               className="w-full px-4 py-3 rounded-ha-xl bg-surface-default border border-fill-primary-normal text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-ha-blue/50 focus:border-ha-blue transition-colors disabled:opacity-50"
             />
          </div>

          {error && (
            <div className="p-ha-3 rounded-ha-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!url.trim() || !token.trim() || connecting || !isSecurityCorrect}
            className="w-full flex items-center justify-center gap-ha-2 py-3 px-4 rounded-ha-xl bg-ha-blue text-white font-medium hover:bg-ha-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect'}
            {!connecting && <Icon path={mdiArrowRight} size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
