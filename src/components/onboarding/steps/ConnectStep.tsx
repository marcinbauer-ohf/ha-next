'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui';
import { useHomeAssistant } from '@/hooks';
import {
  mdiHomeAssistant,
  mdiArrowRight,
  mdiFlaskOutline,
  mdiCheckCircle,
} from '@mdi/js';
import { INPUT_CLASS } from '../fieldStyles';
import type { StepProps } from '../types';

export function ConnectStep({ next }: StepProps) {
  const { connected, connecting, demoMode, error, haUrl, saveCredentials, enableDemoMode } =
    useHomeAssistant();
  const [url, setUrl] = useState(haUrl);
  const [token, setToken] = useState('');

  const isReady = connected || demoMode;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (connecting || !url.trim() || !token.trim()) return;
    try {
      await saveCredentials(url.trim(), token.trim());
      next();
    } catch {
      /* error surfaces via context.error */
    }
  };

  if (isReady) {
    return (
      <div className="flex flex-col items-center text-center gap-ha-4 pt-ha-8">
        <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
          <Icon path={mdiCheckCircle} size={32} className="text-green-500" />
        </div>
        <div className="space-y-ha-1">
          <h1 className="text-xl font-semibold">
            {demoMode ? 'Exploring with demo data' : 'Connected'}
          </h1>
          <p className="text-sm text-text-secondary">
            {demoMode
              ? 'A sample home is loaded. Continue to set it up.'
              : 'Your Home Assistant instance is linked.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-ha-5">
      <div className="flex items-center gap-ha-3">
        <div className="w-11 h-11 rounded-ha-xl bg-ha-blue/10 flex items-center justify-center shrink-0">
          <Icon path={mdiHomeAssistant} size={26} className="text-ha-blue" />
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-tight">Connect to Home Assistant</h1>
          <p className="text-xs text-text-secondary">Or skip and use demo data.</p>
        </div>
      </div>

      <form onSubmit={handleConnect} className="space-y-ha-3">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="http://homeassistant.local:8123"
          disabled={connecting}
          className={INPUT_CLASS}
          aria-label="Home Assistant URL"
        />
        <div>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Long-Lived Access Token"
            disabled={connecting}
            className={INPUT_CLASS}
            aria-label="Long-Lived Access Token"
          />
          <p className="text-xs text-text-secondary mt-ha-1">
            Profile → Security → Long-Lived Access Tokens
          </p>
        </div>

        {error && (
          <div className="p-ha-3 rounded-ha-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!url.trim() || !token.trim() || connecting}
          className="w-full flex items-center justify-center gap-ha-2 py-3 px-4 rounded-ha-xl bg-ha-blue text-white font-medium hover:bg-ha-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {connecting ? 'Connecting…' : 'Connect'}
          {!connecting && <Icon path={mdiArrowRight} size={18} />}
        </button>

        <button
          type="button"
          onClick={() => {
            enableDemoMode();
            next();
          }}
          disabled={connecting}
          className="w-full flex items-center justify-center gap-ha-2 py-3 px-4 rounded-ha-xl bg-surface-default border border-fill-primary-normal text-text-primary font-medium hover:bg-surface-low disabled:opacity-40 transition-colors"
        >
          <Icon path={mdiFlaskOutline} size={18} />
          Use demo data
        </button>
      </form>
    </div>
  );
}
