'use client';

import { useState } from 'react';
import { Icon } from './Icon';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { mdiHomeAssistant, mdiArrowRight, mdiFlaskOutline, mdiClose } from '@mdi/js';

interface SetupScreenProps {
  onSave: (url: string, token: string) => Promise<void>;
  onUseDemo: () => void;
  error?: string | null;
  connecting?: boolean;
  onClose?: () => void;
  /** Controls visibility. Defaults to open (first-run blocking screen). */
  open?: boolean;
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-ha-xl bg-surface-default border border-fill-primary-normal text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-ha-blue/50 focus:border-ha-blue transition-colors disabled:opacity-50';

export function SetupScreen({ onSave, onUseDemo, error, connecting, onClose, open = true }: SetupScreenProps) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (connecting) return;
    if (url.trim() && token.trim()) onSave(url.trim(), token.trim());
  };

  return (
    <ModalSheet open={open} onClose={onClose ?? (() => {})} maxWidth={440}>
      <div className="p-ha-6">
        <div className="flex items-start justify-between mb-ha-5">
          <div className="flex items-center gap-ha-3">
            <div className="w-11 h-11 rounded-ha-xl bg-ha-blue/10 flex items-center justify-center shrink-0">
              <Icon path={mdiHomeAssistant} size={26} className="text-ha-blue" />
            </div>
            <h1 className="text-lg font-semibold text-text-primary leading-tight">
              Connect to Home Assistant
            </h1>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-ha-1 -mr-ha-1 rounded-full text-text-secondary hover:bg-surface-low transition-colors"
              aria-label="Close"
            >
              <Icon path={mdiClose} size={20} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-ha-3">
          <input
            type="url"
            required
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
              required
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
            onClick={onUseDemo}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-ha-2 py-3 px-4 rounded-ha-xl bg-surface-default border border-fill-primary-normal text-text-primary font-medium hover:bg-surface-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Icon path={mdiFlaskOutline} size={18} />
            Use demo data
          </button>
        </form>
      </div>
    </ModalSheet>
  );
}
