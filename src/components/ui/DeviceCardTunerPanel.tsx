'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { motion, useDragControls } from 'framer-motion';
import { mdiClose, mdiContentCopy, mdiRestore, mdiTune, mdiCheck } from '@mdi/js';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { ToggleSwitch } from './ToggleSwitch';
import {
  CARD_TUNER_GROUPS,
  CARD_TUNER_PARAMS,
  CARD_TUNER_TOGGLES,
  cardTunerHasOverrides,
  resetCardTuner,
  serializeCardTuner,
  setCardTunerToggle,
  setCardTunerValue,
  toggleCardTunerPanel,
  useCardTunerOpen,
  useCardTunerState,
} from '@/lib/cardTuner';

/**
 * Floating developer panel for live-tuning DeviceCardV2 readability: every
 * slider writes a `--dct-*` CSS var onto <html>, which the cards consume via
 * var() fallbacks — changes paint immediately with zero card re-renders.
 * Drag the header to move it out of the way; values persist in localStorage
 * until "Reset". "Copy" exports the changed vars for baking into the card.
 */
export function DeviceCardTunerPanel() {
  const open = useCardTunerOpen();
  const { overrides, toggles } = useCardTunerState();
  const dragControls = useDragControls();
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const dirty = cardTunerHasOverrides();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(serializeCardTuner());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      className="fixed bottom-4 right-4 z-[240] w-[300px] rounded-ha-2xl bg-surface-default border border-surface-lower shadow-2xl select-none"
    >
      {/* Header — drag handle */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex items-center gap-2 px-4 py-3 cursor-grab active:cursor-grabbing border-b border-surface-lower touch-none"
      >
        <Icon path={mdiTune} size={16} className="text-text-tertiary" />
        <span className="text-sm font-semibold text-text-primary flex-1">Card tuner</span>
        {dirty && <span className="w-1.5 h-1.5 rounded-full bg-ha-blue" aria-label="Has unsaved tweaks" />}
        <button
          onClick={handleCopy}
          title="Copy changed values"
          className="p-1.5 rounded-full hover:bg-surface-low text-text-secondary transition-colors"
        >
          <Icon path={copied ? mdiCheck : mdiContentCopy} size={15} className={copied ? 'text-green-500' : undefined} />
        </button>
        <IconButton icon={mdiRestore} label="Reset all to defaults" size="sm" onClick={resetCardTuner} />
        <IconButton icon={mdiClose} label="Close" size="sm" onClick={() => toggleCardTunerPanel(false)} />
      </div>

      {/* Body */}
      <div
        className="max-h-[62vh] overflow-y-auto px-4 pb-4 overscroll-contain"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 24px), transparent)',
          maskImage: 'linear-gradient(to bottom, #000 calc(100% - 24px), transparent)',
        }}
      >
        {CARD_TUNER_GROUPS.map((group) => {
          const params = CARD_TUNER_PARAMS.filter((p) => p.group === group);
          const groupToggles = CARD_TUNER_TOGGLES.filter((t) => t.group === group);
          if (params.length === 0 && groupToggles.length === 0) return null;
          return (
            <div key={group}>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-tertiary mt-4 mb-2">{group}</p>
              <div className="space-y-2.5">
                {params.map((p) => {
                  const value = overrides[p.id] ?? p.defaultValue;
                  const changed = overrides[p.id] !== undefined;
                  return (
                    <label key={p.id} className="block">
                      <span className="flex items-baseline justify-between mb-0.5">
                        <span className={clsx('text-xs', changed ? 'text-text-primary font-medium' : 'text-text-secondary')}>
                          {p.label}
                        </span>
                        <span className={clsx('text-xs font-mono tabular-nums', changed ? 'text-ha-blue font-semibold' : 'text-text-tertiary')}>
                          {value}{p.unit}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={value}
                        onChange={(e) => setCardTunerValue(p.id, Number(e.target.value))}
                        onDoubleClick={() => setCardTunerValue(p.id, p.defaultValue)}
                        className="w-full h-1.5 accent-ha-blue cursor-pointer"
                      />
                    </label>
                  );
                })}
                {groupToggles.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 pt-0.5">
                    <span className={clsx('text-xs', toggles[t.id] ? 'text-text-primary font-medium' : 'text-text-secondary')}>
                      {t.label}
                    </span>
                    <ToggleSwitch on={!!toggles[t.id]} onToggle={() => setCardTunerToggle(t.id, !toggles[t.id])} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <p className="text-[11px] leading-snug text-text-tertiary mt-4">
          Double-click a slider to reset it. Copy exports only the changed values.
        </p>
      </div>
    </motion.div>
  );
}
