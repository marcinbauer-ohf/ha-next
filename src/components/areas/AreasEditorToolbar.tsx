'use client';

import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { EditorToolbarShell } from '../layout/EditorToolbarShell';
import { Icon } from '../ui/Icon';
import {
  mdiAutoFix,
  mdiChevronLeft,
  mdiChevronRight,
  mdiFormatListBulleted,
  mdiMap,
  mdiShapeOutline,
  mdiSofaOutline,
  mdiVectorPolygon,
} from '@mdi/js';

// Bottom editor toolbar for Areas V2 — List/Map switch, a floor stepper and a
// draw toggle (map only), plus Done. Mirrors the automation editor toolbar:
// portaled to the body, floats above the surface, responsive pill on mobile.

export type AreaView = 'list' | 'map';
export type MapSubMode = 'areas' | 'devices';

const SEGMENT_SPRING = { type: 'spring' as const, stiffness: 500, damping: 36, mass: 0.7 };

function ViewToggle({ id, view, onChange }: { id: string; view: AreaView; onChange: (v: AreaView) => void }) {
  const segments: Array<{ key: AreaView; icon: string; label: string }> = [
    { key: 'list', icon: mdiFormatListBulleted, label: 'List view' },
    { key: 'map', icon: mdiMap, label: 'Map view' },
  ];
  return (
    <div className="flex items-center rounded-ha-xl bg-surface-low p-0.5">
      {segments.map((seg) => {
        const active = view === seg.key;
        return (
          <button
            key={seg.key}
            type="button"
            onClick={() => onChange(seg.key)}
            aria-pressed={active}
            aria-label={seg.label}
            title={seg.label}
            className="relative flex h-9 flex-1 items-center justify-center gap-ha-2 rounded-ha-lg px-ha-3 lg:flex-none"
          >
            {active && (
              <motion.span
                layoutId={`${id}-area-view-indicator`}
                className="absolute inset-0 rounded-ha-lg bg-surface-default shadow-sm"
                transition={SEGMENT_SPRING}
              />
            )}
            <Icon path={seg.icon} size={18} className={`relative z-10 ${active ? 'text-ha-blue' : 'text-text-secondary'}`} />
            <span className={`relative z-10 text-sm font-semibold ${active ? 'text-ha-blue' : 'text-text-secondary'}`}>
              {seg.label === 'List view' ? 'List' : 'Map'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MapSubToggle({ subMode, onChange }: { subMode: MapSubMode; onChange: (m: MapSubMode) => void }) {
  const segments: Array<{ key: MapSubMode; icon: string; label: string }> = [
    { key: 'areas', icon: mdiShapeOutline, label: 'Areas' },
    { key: 'devices', icon: mdiSofaOutline, label: 'Devices' },
  ];
  return (
    <div className="flex items-center rounded-ha-xl bg-surface-low p-0.5">
      {segments.map((seg) => {
        const active = subMode === seg.key;
        return (
          <button
            key={seg.key}
            type="button"
            onClick={() => onChange(seg.key)}
            aria-pressed={active}
            aria-label={seg.label}
            title={seg.label}
            className="relative flex h-9 items-center gap-ha-2 rounded-ha-lg px-ha-3"
          >
            {active && (
              <motion.span
                layoutId="area-submode-indicator"
                className="absolute inset-0 rounded-ha-lg bg-surface-default shadow-sm"
                transition={SEGMENT_SPRING}
              />
            )}
            <Icon path={seg.icon} size={18} className={`relative z-10 ${active ? 'text-ha-blue' : 'text-text-secondary'}`} />
            <span className={`relative z-10 text-sm font-semibold ${active ? 'text-ha-blue' : 'text-text-secondary'}`}>{seg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StepButton({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-ha-lg transition-colors ${
        disabled ? 'text-text-disabled opacity-40' : 'text-text-secondary hover:bg-surface-mid'
      }`}
    >
      <Icon path={icon} size={20} />
    </button>
  );
}

function FloorStepper({
  floorLabel,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  floorLabel: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div className="flex items-center rounded-ha-xl bg-surface-low p-0.5">
      <StepButton icon={mdiChevronLeft} label="Lower floor" onClick={onPrev} disabled={!canPrev} />
      <span className="min-w-[88px] px-ha-1 text-center text-sm font-semibold text-text-primary">{floorLabel}</span>
      <StepButton icon={mdiChevronRight} label="Upper floor" onClick={onNext} disabled={!canNext} />
    </div>
  );
}

function DrawButton({ active, disabled, onClick }: { active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label="Draw area"
      title="Draw area"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 items-center gap-ha-2 rounded-ha-xl px-ha-3 text-sm font-semibold transition-colors ${
        disabled
          ? 'text-text-disabled opacity-40'
          : active
            ? 'bg-ha-blue text-white'
            : 'bg-surface-low text-text-secondary hover:bg-surface-mid'
      }`}
    >
      <Icon path={mdiVectorPolygon} size={18} />
      Draw
    </button>
  );
}

export function AreasEditorToolbar({
  view,
  onChangeView,
  subMode,
  onChangeSubMode,
  floorLabel,
  onPrevFloor,
  onNextFloor,
  canPrevFloor,
  canNextFloor,
  drawing,
  onToggleDraw,
  drawDisabled,
  onGenerate,
  onDone,
}: {
  view: AreaView;
  onChangeView: (v: AreaView) => void;
  subMode: MapSubMode;
  onChangeSubMode: (m: MapSubMode) => void;
  floorLabel: string;
  onPrevFloor: () => void;
  onNextFloor: () => void;
  canPrevFloor: boolean;
  canNextFloor: boolean;
  drawing: boolean;
  onToggleDraw: () => void;
  drawDisabled: boolean;
  /** Testing helper: auto-generate room shapes + scatter devices. Hidden if absent. */
  onGenerate?: () => void;
  onDone: () => void;
}) {
  if (typeof document === 'undefined') return null;
  const mapMode = view === 'map';
  const areasSub = subMode === 'areas';

  return createPortal(
    <EditorToolbarShell
      mobile={
        <>
          <div className="flex items-center gap-ha-2">
            <ViewToggle id="m" view={view} onChange={onChangeView} />
            <div className="flex-1" />
            <button
              type="button"
              onClick={onDone}
              className="h-11 rounded-ha-pill bg-ha-blue px-6 text-sm font-semibold text-white transition-transform active:scale-95"
            >
              Done
            </button>
          </div>
          {mapMode && (
            <div className="mt-ha-2 flex items-center gap-ha-2">
              <FloorStepper floorLabel={floorLabel} onPrev={onPrevFloor} onNext={onNextFloor} canPrev={canPrevFloor} canNext={canNextFloor} />
              <div className="flex-1" />
              <MapSubToggle subMode={subMode} onChange={onChangeSubMode} />
              {areasSub && <DrawButton active={drawing} disabled={drawDisabled} onClick={onToggleDraw} />}
              {onGenerate && (
                <button
                  type="button"
                  onClick={onGenerate}
                  aria-label={areasSub ? 'Generate test layout' : 'Randomly place devices'}
                  title={areasSub ? 'Generate test layout' : 'Randomly place devices'}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-ha-xl bg-surface-low text-text-secondary transition-colors hover:bg-surface-mid"
                >
                  <Icon path={mdiAutoFix} size={18} />
                </button>
              )}
            </div>
          )}
        </>
      }
      desktop={
        <>
          <ViewToggle id="d" view={view} onChange={onChangeView} />
          {mapMode && (
            <>
              <div className="mx-ha-1 h-6 w-px bg-border-default" />
              <FloorStepper floorLabel={floorLabel} onPrev={onPrevFloor} onNext={onNextFloor} canPrev={canPrevFloor} canNext={canNextFloor} />
              <div className="mx-ha-1 h-6 w-px bg-border-default" />
              <MapSubToggle subMode={subMode} onChange={onChangeSubMode} />
              {areasSub && <DrawButton active={drawing} disabled={drawDisabled} onClick={onToggleDraw} />}
              {onGenerate && (
                <button
                  type="button"
                  onClick={onGenerate}
                  aria-label={areasSub ? 'Generate test layout' : 'Randomly place devices'}
                  title={areasSub ? 'Generate test layout' : 'Randomly place devices'}
                  className="flex h-9 w-9 items-center justify-center rounded-ha-xl bg-surface-low text-text-secondary transition-colors hover:bg-surface-mid"
                >
                  <Icon path={mdiAutoFix} size={18} />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onDone}
            className="ml-ha-1 h-11 rounded-ha-pill bg-ha-blue px-6 text-sm font-semibold text-white transition-all hover:bg-ha-blue/90 active:scale-95"
          >
            Done
          </button>
        </>
      }
    />,
    document.body,
  );
}
