'use client';

import { useEffect, useRef } from 'react';

// ── Talk widget glow ──────────────────────────────────────────────────────────
// The ambient bed under the screensaver's talk widget: a few rows of the same
// wave-displaced dots the voice mode's background uses (same swell + ripple
// math, same navy→blue→ice palette), so the widget visually foreshadows the
// screen you're about to enter. No gradient wash — just the dots breathing.

interface TalkWidgetGlowProps {
  /** Brighter + livelier while the summary is "thinking". */
  active?: boolean;
  className?: string;
}

// Palette anchors shared with VoiceWaveBackground (navy → HA blue → ice).
const DIM: [number, number, number] = [26, 82, 128];
const BLUE: [number, number, number] = [24, 188, 242];
const ICE: [number, number, number] = [209, 240, 255];

function mix(a: [number, number, number], b: [number, number, number], k: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function TalkWidgetGlow({ active = false, className = '' }: TalkWidgetGlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

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
    let energy = 0;
    const start = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (w === 0 || h === 0) return;
      const t = ((now - start) / 1000) * (reducedMotion ? 0.15 : 1);

      const target = activeRef.current ? 1 : 0;
      energy += (target - energy) * 0.06;

      ctx.clearRect(0, 0, w, h);

      // Same slow breathing pulse as the toast GlowCanvas — carried by the
      // dots' brightness now that there's no gradient wash.
      const pulse = 0.85 + 0.15 * Math.sin(t * 0.9);
      const cx = w * 0.5;

      // Dot field — the voice screen's wave dots. Same swell + center-out
      // ripple math and navy→blue→ice palette as VoiceWaveBackground.
      const rows = 7;
      const cols = Math.min(90, Math.max(40, Math.round(w / 22)));
      for (let r = 0; r < rows; r += 1) {
        const z = r / (rows - 1); // 0 = top of the band, 1 = bottom edge
        const y0 = h - 6 - (1 - z) * h * 0.6;
        for (let c = 0; c < cols; c += 1) {
          const xN = (c / (cols - 1)) * 2 - 1;
          const x = cx + xN * w * 0.5;
          const swell = Math.sin(xN * 2.4 + t * 0.7) * 0.28 + Math.sin(xN * 5.1 - t * 1.1 + z * 2) * 0.12;
          const d = Math.hypot(xN * 1.4, (z - 0.7) * 1.6);
          const ripple = Math.sin(d * 9 - t * 2.6) * Math.exp(-d * 1.8);
          const height = swell * 0.35 + ripple * (0.35 + energy * 0.5);
          const y = y0 - height * (8 + z * 12);

          // Fade dots toward the top of the band and the side edges so the
          // field dissolves into the dark instead of ending on a hard line.
          const edgeFade = 1 - Math.min(1, Math.abs(xN) * 1.15);
          const b = Math.min(1, Math.max(0, 0.25 + z * 0.5 + height * 0.45 + energy * 0.15));
          const a = Math.min(0.85, b * edgeFade * (0.35 + z * 0.65) * (0.8 + energy * 0.2)) * pulse;
          if (a <= 0.02) continue;

          // navy→blue→ice by brightness, matching the voice screen's dots.
          const rgb =
            b < 0.6
              ? mix(DIM, BLUE, b / 0.6)
              : mix(BLUE, ICE, (b - 0.6) / 0.4);
          ctx.fillStyle = `rgba(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}, ${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, 0.9 + z * 1.5 + Math.max(0, height) * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={`block w-full h-full ${className}`} />;
}
