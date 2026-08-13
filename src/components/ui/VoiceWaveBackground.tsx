'use client';

import { useEffect, useRef } from 'react';

// ── Voice wave background ─────────────────────────────────────────────────────
// A sound-reactive field of dots for the screensaver's voice mode: a tilted
// dot-grid plane (Joy-Division-meets-hologram) whose waves radiate from the
// center and swell with the mic level. Pure Canvas2D — no WebGL — so it can
// live alongside the shader wallpaper without fighting it for a context.

export type VoiceVisualState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceWaveBackgroundProps {
  state: VoiceVisualState;
  /** Live mic RMS (0–~0.5), written by the assist pipeline; read per frame. */
  levelRef: React.RefObject<number>;
  className?: string;
  /**
   * Draw the field on a pale ground instead of the night scene. The wave's
   * depth cue is brightness, so light mode doesn't just swap the backdrop — it
   * flips the ramp too: near rows go deep, far rows fade toward the paper.
   */
  light?: boolean;
}

// Palette anchors — the screensaver shader family (navy → HA blue → ice).
const DIM: [number, number, number] = [26, 82, 128];
const BLUE: [number, number, number] = [24, 188, 242];
const ICE: [number, number, number] = [209, 240, 255];
// Light-mode counterparts: haze → HA blue → deep navy.
const HAZE: [number, number, number] = [170, 208, 232];
const DEEP: [number, number, number] = [12, 74, 112];

function mix(a: [number, number, number], b: [number, number, number], k: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function VoiceWaveBackground({ state, levelRef, className = '', light = false }: VoiceWaveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<VoiceVisualState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Smoothed energy drives wave amplitude + glow: fast attack on speech,
    // slow release so the field "breathes down" instead of snapping.
    let energy = 0.2;
    let smoothLevel = 0;
    const start = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (w === 0 || h === 0) return;
      const t = ((now - start) / 1000) * (reducedMotion ? 0.2 : 1);
      const visual = stateRef.current;

      const rawLevel = Math.min((levelRef.current ?? 0) * 4, 1.4);
      smoothLevel += (rawLevel - smoothLevel) * (rawLevel > smoothLevel ? 0.35 : 0.06);

      // Idle keeps a slow ~8s swell so the face never looks frozen.
      let target = 0.18 + 0.05 * Math.sin(t * 0.8);
      if (visual === 'listening') target = 0.3 + smoothLevel;
      else if (visual === 'thinking') target = 0.5 + 0.22 * Math.sin(t * 5);
      else if (visual === 'speaking') target = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * 7.3)) * (0.6 + 0.4 * Math.sin(t * 2.1));
      energy += (target - energy) * (target > energy ? 0.25 : 0.05);

      // Ground: near-black navy (or pale sky in light mode) with a center glow
      // that swells with energy.
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, light ? '#eef5fb' : '#050a15');
      bg.addColorStop(1, light ? '#e2ebf4' : '#02060e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.5, h * 0.58, 0, w * 0.5, h * 0.58, Math.max(w, h) * 0.55);
      glow.addColorStop(0, `rgba(24, 188, 242, ${(light ? 0.04 : 0.05) + energy * (light ? 0.08 : 0.11)})`);
      glow.addColorStop(1, 'rgba(24, 188, 242, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Dot plane: rows recede toward a horizon; each dot is displaced by a
      // gentle base swell plus a center-out ripple scaled by energy.
      const rows = 26;
      const cols = Math.min(110, Math.max(48, Math.round(w / 16)));
      const horizon = h * 0.22;
      const depthSpan = h * 0.7;

      for (let r = 0; r < rows; r += 1) {
        const z = r / (rows - 1); // 0 = far, 1 = near
        const zz = Math.pow(z, 1.6);
        const rowY = horizon + zz * depthSpan;
        const halfWidth = w * (0.24 + 0.85 * zz);
        const amplitude = h * 0.055 * (0.4 + zz);

        for (let c = 0; c < cols; c += 1) {
          const xN = (c / (cols - 1)) * 2 - 1; // -1 … 1
          const x = w * 0.5 + xN * halfWidth;
          if (x < -8 || x > w + 8) continue;

          const swell = Math.sin(xN * 2.4 + t * 0.7) * 0.28 + Math.sin(xN * 5.1 - t * 1.1 + z * 2) * 0.12;
          const d = Math.hypot(xN * 1.4, (z - 0.55) * 2.2);
          const ripple = Math.sin(d * 9 - t * 4) * Math.exp(-d * 1.8);
          const height = swell * 0.35 + ripple * (0.3 + energy * 1.15);

          const y = rowY - height * amplitude;
          const lift = Math.max(0, height);
          const size = (0.8 + 2.4 * zz) * (1 + lift * 0.9);

          const b = Math.min(1, Math.max(0, 0.24 + 0.26 * zz + height * 0.5 + energy * 0.16));
          const rgb = light
            ? b < 0.6
              ? mix(HAZE, BLUE, b / 0.6)
              : mix(BLUE, DEEP, (b - 0.6) / 0.4)
            : b < 0.6
              ? mix(DIM, BLUE, b / 0.6)
              : mix(BLUE, ICE, (b - 0.6) / 0.4);
          // Aggressive depth falloff dissolves the far rows into the ground
          // instead of banding into a hard "static" line at the horizon.
          const alpha = (0.08 + 0.7 * b) * (0.12 + 0.88 * zz);

          ctx.fillStyle = `rgba(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [levelRef, light]);

  return <canvas ref={canvasRef} aria-hidden className={`block w-full h-full ${className}`} />;
}
