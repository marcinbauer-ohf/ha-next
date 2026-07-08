'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { ModalSheet } from '@/components/layout/ModalSheet';
import { friendlyConnectionError } from '@/lib/friendlyConnectionError';
import { normalizeHaUrl } from '@/lib/normalizeHaUrl';
import { mdiHomeAssistant, mdiArrowRight, mdiChevronDown, mdiCreation, mdiClose } from '@mdi/js';

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (connecting) return;
    if (url.trim() && token.trim()) {
      setAttempted(true);
      onSave(normalizeHaUrl(url), token.trim());
    }
  };

  const showError = attempted && !connecting && Boolean(error);

  return (
    <ModalSheet open={open} onClose={onClose ?? (() => {})} maxWidth={440}>
      <div className="p-ha-6">
        <div className="flex items-start justify-between mb-ha-2">
          <div className="flex items-center gap-ha-3">
            <div className="w-11 h-11 rounded-ha-xl bg-ha-blue/10 flex items-center justify-center shrink-0">
              <Icon path={mdiHomeAssistant} size={26} className="text-ha-blue" />
            </div>
            <h1 className="text-lg font-semibold text-text-primary leading-tight">
              Connect your home
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

        <p className="text-sm text-text-secondary leading-relaxed mb-ha-5">
          Two things link this screen to your Home Assistant. Both stay on this device.
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-ha-4">
          <div className="space-y-ha-1">
            <label htmlFor="setup-url" className="block text-sm font-medium text-text-secondary">
              Web address
            </label>
            <input
              id="setup-url"
              type="text"
              inputMode="url"
              required
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="homeassistant.local:8123"
              disabled={connecting}
              className={INPUT_CLASS}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-xs text-text-tertiary">
              The address you type in your browser to open Home Assistant.
            </p>
          </div>

          <div className="space-y-ha-1">
            <label htmlFor="setup-token" className="block text-sm font-medium text-text-secondary">
              Access key
            </label>
            <input
              id="setup-token"
              type="password"
              required
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Paste your key here"
              disabled={connecting}
              className={INPUT_CLASS}
            />
            <button
              type="button"
              onClick={() => setHelpOpen(v => !v)}
              className="flex items-center gap-ha-1 text-xs font-medium text-ha-blue hover:underline"
              aria-expanded={helpOpen}
            >
              Where do I find my access key?
              <Icon path={mdiChevronDown} size={14} className={`transition-transform ${helpOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {helpOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <ol className="mt-ha-1 rounded-ha-xl bg-surface-low/70 border border-surface-lower p-ha-3 space-y-ha-1 text-xs leading-relaxed text-text-secondary list-decimal list-inside">
                    <li>Open Home Assistant in your browser.</li>
                    <li>Click your name in the bottom-left corner.</li>
                    <li>Open the <span className="font-medium text-text-primary">Security</span> tab.</li>
                    <li>Choose <span className="font-medium text-text-primary">Create token</span> — that&apos;s Home Assistant&apos;s name for this key — copy it, and paste it here.</li>
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {showError && (
            <div
              role="alert"
              className="p-ha-3 rounded-ha-xl bg-amber-500/10 border border-amber-500/25 text-sm text-text-primary leading-relaxed"
            >
              {friendlyConnectionError(error)}
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
            <Icon path={mdiCreation} size={18} />
            Explore the demo home instead
          </button>
        </form>
      </div>
    </ModalSheet>
  );
}
