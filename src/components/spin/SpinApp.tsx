'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { mdiPlus, mdiArrowLeft, mdiRotate3dVariant, mdiVectorSquare } from '@mdi/js';
import { RingShaderBackground } from '@/components/ui/RingShaderBackground';
import { Icon } from '@/components/ui/Icon';
import { useHomeAssistant } from '@/hooks/useHomeAssistant';
import { useDevices } from '@/hooks/useDevices';
import { useAreasFloors } from '@/hooks/useAreasFloors';
import { useHomeName } from '@/lib/homeName';
import { SPIN_CATEGORY_MAP, type SpinCategoryId, type CategoryDevice } from './spinCategories';
import { Home3DMap } from './Home3DMap';
import { SpinWidgets, SpinDeviceModal } from './SpinWidgets';
import { SpinDetail } from './SpinDetail';
import { SpinPromptBar } from './SpinPromptBar';
import { SpinDock } from './SpinDock';

type Phase = 'ambient' | 'app';

function AmbientClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <span className="text-[clamp(64px,12vw,148px)] font-extralight leading-none tracking-tight text-white/90 tabular-nums">
        {time}
      </span>
      <span className="text-lg font-light text-white/50">{date}</span>
    </div>
  );
}

export function SpinApp() {
  const router = useRouter();
  const ha = useHomeAssistant();
  const { devices } = useDevices();
  const { areas } = useAreasFloors();
  const homeName = useHomeName();

  const [phase, setPhase] = useState<Phase>('ambient');
  const [focusId, setFocusId] = useState<SpinCategoryId | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [view, setView] = useState<'3d' | '2d'>('3d');
  const [chatOpen, setChatOpen] = useState(false);
  const [openDevice, setOpenDevice] = useState<CategoryDevice | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);

  const focusCategory = focusId ? SPIN_CATEGORY_MAP.get(focusId) ?? null : null;
  const selectedAreaName = useMemo(
    () => (selectedArea ? areas.find((a) => a.area_id === selectedArea)?.name ?? null : null),
    [areas, selectedArea],
  );

  const inChild = focusId !== null || selectedArea !== null;
  const title = selectedAreaName ?? focusCategory?.label ?? homeName;

  const goBack = useCallback(() => {
    if (selectedArea) return setSelectedArea(null);
    if (focusId) return setFocusId(null);
  }, [selectedArea, focusId]);

  const goHome = useCallback(() => {
    setSelectedArea(null);
    setFocusId(null);
    setOpenDevice(null);
    setChatOpen(false);
  }, []);

  // Escape walks back up the hierarchy, all the way to the ambient screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (openDevice) return setOpenDevice(null);
      if (chatOpen) return setChatOpen(false);
      if (plusOpen) return setPlusOpen(false);
      if (selectedArea) return setSelectedArea(null);
      if (focusId) return setFocusId(null);
      if (phase === 'app') return setPhase('ambient');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openDevice, chatOpen, plusOpen, selectedArea, focusId, phase]);

  const enterApp = useCallback((withChat = false) => {
    setPhase('app');
    if (withChat) setChatOpen(true);
  }, []);

  const userInitial = (ha.currentUser?.name ?? 'H').trim().charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#02091f] text-white" data-spin-root>
      {/* Warp background — mounted once, survives every phase change. */}
      <div className="absolute inset-0" aria-hidden>
        <RingShaderBackground mode="warp" opaque resolvedMode="dark" center={[0.5, 0.42]} reach={1.15} />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* ---------- Ambient (screensaver) layer ---------- */}
      <AnimatePresence>
        {phase === 'ambient' && (
          <motion.button
            key="ambient"
            type="button"
            aria-label="Enter home"
            className="absolute inset-0 z-10 flex cursor-default items-center justify-center outline-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.06, filter: 'blur(8px)' }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            onClick={() => enterApp()}
          >
            <AmbientClock />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ---------- App layer ---------- */}
      <AnimatePresence>
        {phase === 'app' && (
          <motion.div
            key="app"
            className="absolute inset-0 z-10 flex flex-col"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
            transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Top app bar */}
            <header className="flex items-center justify-between px-6 pt-5 sm:px-10 sm:pt-7">
              <div className="flex min-w-0 items-center gap-3">
                <AnimatePresence initial={false}>
                  {inChild && (
                    <motion.button
                      key="back"
                      type="button"
                      onClick={goBack}
                      aria-label="Back"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20"
                      initial={{ opacity: 0, x: -12, scale: 0.8 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -12, scale: 0.8 }}
                      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                    >
                      <Icon path={mdiArrowLeft} size={22} className="fill-white" />
                    </motion.button>
                  )}
                </AnimatePresence>
                <div className="relative min-w-0 overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.h1
                      key={title}
                      className="truncate text-3xl font-semibold tracking-tight text-white sm:text-4xl"
                      initial={{ y: '110%', opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: '-110%', opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                    >
                      {title}
                    </motion.h1>
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setView((v) => (v === '3d' ? '2d' : '3d'))}
                  aria-label={view === '3d' ? 'Switch to flat view' : 'Switch to 3D view'}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  <Icon path={view === '3d' ? mdiVectorSquare : mdiRotate3dVariant} size={20} className="fill-white" />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPlusOpen((o) => !o)}
                    aria-label="Add to home"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20"
                  >
                    <motion.span animate={{ rotate: plusOpen ? 45 : 0 }} transition={{ duration: 0.25 }}>
                      <Icon path={mdiPlus} size={22} className="fill-white" />
                    </motion.span>
                  </button>
                  <AnimatePresence>
                    {plusOpen && (
                      <motion.div
                        key="plus-menu"
                        className="absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/80 p-1.5 shadow-2xl backdrop-blur-2xl"
                        initial={{ opacity: 0, y: -8, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.94 }}
                        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                      >
                        {[
                          { label: 'Add a device', path: '/config/integrations/dashboard' },
                          { label: 'Add an automation', path: '/config/automation/dashboard' },
                          { label: 'Add a scene', path: '/config/scene/dashboard' },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            className="block w-full rounded-xl px-3.5 py-2.5 text-left text-sm text-white/85 transition-colors hover:bg-white/10 disabled:opacity-40"
                            disabled={!ha.haUrl}
                            onClick={() => {
                              setPlusOpen(false);
                              if (ha.haUrl) window.open(`${ha.haUrl}${item.path}`, '_blank', 'noopener');
                            }}
                          >
                            {item.label}
                            {!ha.haUrl && <span className="block text-xs text-white/40">Not available in demo</span>}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/profile')}
                  aria-label="Profile"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#18bcf2] to-[#0b6d9e] text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
                >
                  {userInitial}
                </button>
              </div>
            </header>

            {/* Center: 3D home map — yields the lower half once a category is open */}
            <div className={inChild ? 'relative h-[38%] min-h-[200px] shrink-0' : 'relative min-h-0 flex-1'}>
              <Home3DMap
                areas={areas}
                devices={devices}
                view={view}
                focusCategory={focusCategory}
                selectedArea={selectedArea}
                onSelectArea={setSelectedArea}
              />
            </div>

            {/* Bottom half: category glance ⇄ grouped detail list */}
            <AnimatePresence mode="wait" initial={false}>
              {inChild ? (
                <SpinDetail
                  key={`detail-${focusId ?? 'area'}-${selectedArea ?? 'all'}`}
                  devices={devices}
                  areas={areas}
                  focusCategory={focusCategory}
                  selectedArea={selectedArea}
                  onOpenDevice={setOpenDevice}
                />
              ) : (
                <SpinWidgets
                  key="summary"
                  onFocus={(id) => {
                    setSelectedArea(null);
                    setFocusId(id);
                  }}
                />
              )}
            </AnimatePresence>

            {/* Dock */}
            <AnimatePresence>
              {!chatOpen && (
                <motion.div
                  key="dock"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                >
                  <SpinDock onHome={goHome} atHome={!inChild} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Prompt / chat bar — shared across phases ---------- */}
      <SpinPromptBar
        phase={phase}
        chatOpen={chatOpen}
        onChatOpenChange={setChatOpen}
        onEnter={enterApp}
      />

      {/* ---------- Device modal ---------- */}
      <AnimatePresence>
        {openDevice && <SpinDeviceModal item={openDevice} onClose={() => setOpenDevice(null)} />}
      </AnimatePresence>
    </div>
  );
}
