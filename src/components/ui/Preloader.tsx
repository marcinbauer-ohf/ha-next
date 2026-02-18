'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useScreensaver } from '@/contexts';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface PreloaderProps {
  onFinish: () => void;
}

type ResolvedMode = 'light' | 'dark';

const getResolvedMode = (): ResolvedMode => {
  if (typeof window === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-mode') === 'dark' ? 'dark' : 'light';
};

export function Preloader({ onFinish }: PreloaderProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [showLogo, setShowLogo] = useState(false);
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>(() => getResolvedMode());
  const { dismiss } = useScreensaver();
  const lockupSrc = resolvedMode === 'dark'
    ? '/OHF-lockup-inline-monochrome-on-dark.png'
    : '/OHF-lockup-inline-monochrome-on-light.svg';

  // Stable refs so timers don't restart on re-renders
  const onFinishRef = useRef(onFinish);
  const dismissRef = useRef(dismiss);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);
  useEffect(() => { dismissRef.current = dismiss; }, [dismiss]);

  // Keep in sync with actual color mode (light/dark), including "system" mode changes.
  useEffect(() => {
    const root = document.documentElement;
    const syncMode = () => setResolvedMode(getResolvedMode());

    syncMode();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-mode') {
          syncMode();
          break;
        }
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-mode'] });

    return () => observer.disconnect();
  }, []);

  // Load animation data for current color mode.
  useEffect(() => {
    let cancelled = false;
    const animationPath = resolvedMode === 'dark' ? '/loader-dark.json' : '/loader-light.json';
    const fallbackAnimationPath = resolvedMode === 'dark' ? '/loader-light.json' : '/loader-dark.json';

    setAnimationData(null);
    setShowLogo(false);

    const loadAnimation = async () => {
      try {
        const response = await fetch(animationPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: object = await response.json();
        if (!cancelled) setAnimationData(data);
      } catch (err) {
        console.error(`Failed to load ${animationPath}`, err);
        try {
          const fallbackResponse = await fetch(fallbackAnimationPath);
          if (!fallbackResponse.ok) throw new Error(`HTTP ${fallbackResponse.status}`);
          const fallbackData: object = await fallbackResponse.json();
          if (!cancelled) setAnimationData(fallbackData);
        } catch (fallbackErr) {
          console.error(`Failed to load fallback ${fallbackAnimationPath}`, fallbackErr);
        }
      }
    };

    loadAnimation();

    return () => {
      cancelled = true;
    };
  }, [resolvedMode]);

  // Start timers once animation data is ready
  useEffect(() => {
    if (!animationData) return;

    // Fade in the OHF logo after 250ms
    const logoTimer = setTimeout(() => {
      setShowLogo(true);
    }, 250);

    // Finish and reveal dashboard after 3.5 seconds
    const finishTimer = setTimeout(() => {
      dismissRef.current();
      onFinishRef.current();
    }, 1500);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(finishTimer);
    };
  }, [animationData]); // intentionally only depends on animationData

  if (!animationData) return null;

  return (
    <motion.div
      key="preloader"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      data-component="Preloader"
      style={{ backgroundColor: 'var(--ha-color-surface-default)' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      {/* Radial glow beneath the animation — theme-aware */}
      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, var(--ha-color-surface-default) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />

      {/* Centered Lottie animation — plays once, no loop */}
      <div className="flex items-center justify-center w-[400px] h-[120px] lg:w-[800px] lg:h-[240px]">
        <Lottie
          key={`preloader-${resolvedMode}`}
          animationData={animationData}
          loop={false}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* OHF logo — fades in after 1 second */}
      <motion.div
        className="absolute bottom-10 flex items-center justify-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: showLogo ? 1 : 0, y: showLogo ? 0 : 8 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Image
          key={`preloader-lockup-${resolvedMode}`}
          src={lockupSrc}
          alt="Open Home Foundation"
          width={260}
          height={40}
          priority
          className="w-[260px] h-auto preloader-brand-lockup"
        />
      </motion.div>
    </motion.div>
  );
}
