'use client';

import { useEffect, useRef, useState } from 'react';
import { subscribeHomePulse, type PulseColor } from '@/lib/homePulseBus';

// How long an event ripple takes to travel centre → edge. Much faster than the
// ~50s ambient rings so it reads as a distinct, reactive response to an event.
const PULSE_DURATION_MS = 5000;

interface ActivePulse {
  bornTs: number; // requestAnimationFrame timestamp at emit (shares perf.now origin)
  color: PulseColor;
}

// Intensity setting → pulse brightness + line thickness.
const INTENSITY = {
  subtle: { strength: 0.22, width: 1.0 },
  bold: { strength: 0.8, width: 2.4 },
} as const;
export type PulseIntensity = keyof typeof INTENSITY;

/**
 * Background style for the ring surface. Every mode keeps the coloured event
 * ripples (the reactive "something happened" waves) on top — they only change
 * the *ambient* layer that reads as the steady heartbeat/ping to the server.
 *   classic    — the original endless concentric rings
 *   heartbeat  — discrete lub-dub ping rings on a calm cadence
 *   breathing  — layered, soft parallax rings that slowly inhale/exhale
 *   aurora     — soft drifting ribbons of colour (northern-lights)
 *   bokeh      — soft light orbs drifting slowly upward
 *   dawn       — a slow flowing colour wash, no hard shapes
 *   breathOrb  — one soft glow gently expanding and contracting
 */
export type PulseMode = 'classic' | 'heartbeat' | 'breathing' | 'aurora' | 'bokeh' | 'dawn' | 'breathOrb';

export const PULSE_MODES: PulseMode[] = ['classic', 'heartbeat', 'breathing', 'aurora', 'bokeh', 'dawn', 'breathOrb'];

const MODE_INDEX: Record<PulseMode, number> = {
  classic: 0,
  heartbeat: 1,
  breathing: 2,
  aurora: 3,
  bokeh: 4,
  dawn: 5,
  breathOrb: 6,
};

// Ring origin + reach are uniforms now (see Props.center / Props.reach) so the
// same WebGL context can shift between centre (desktop) and bottom (mobile)
// without recompiling. Defaults below keep the original centred look.
const DEFAULT_CENTER: [number, number] = [0.5, 0.5];
const DEFAULT_REACH = 1.1;

const VERT = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const MAX_PULSES = 10;

// Output is premultiplied alpha (blendFunc ONE, ONE_MINUS_SRC_ALPHA) so the
// neutral ambient layer and the coloured event ripples composite cleanly.
// u_mode selects the ambient style (see PulseMode); the coloured event ripples
// at the bottom render in every mode.
const FRAG = `
  precision highp float;

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_color;
  uniform float u_alpha;
  uniform float u_wave;
  uniform vec2 u_center;  // ring origin in UV (x:0..1, y:0=bottom..1=top)
  uniform float u_reach;  // ring radius at full phase (UV-height units)
  uniform int u_mode;     // ambient style (PulseMode → MODE_INDEX)
  uniform float u_tinted; // 1.0 when an explicit health tint is set (skip iridescence)

  // Reactive event pulses: each is a coloured ring expanding from centre.
  uniform int u_pulseCount;
  uniform float u_pulsePhase[${MAX_PULSES}]; // 0 at spawn → 1 fully expanded
  uniform vec3 u_pulseColor[${MAX_PULSES}];
  uniform float u_pulseStrength; // brightness of pulse rings (intensity setting)
  uniform float u_pulseWidth;    // line thickness multiplier for pulse rings

  float hash11(float x) { return fract(sin(x * 127.1) * 43758.5453); }

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * vnoise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  // The original endless concentric rings — coverage 0..1.
  float ambientRings(float dist, float angle, float px) {
    float rings = 0.0;
    for (int i = 0; i < 22; i++) {
      float offset = float(i) / 22.0;
      float phase = fract(u_time * 0.02 + offset);
      float radius = phase * u_reach;
      float wave = (sin(angle * 5.0 + u_time * 0.6 + offset * 6.28)
                  + sin(angle * 9.0 - u_time * 0.4)) * 0.5 * 0.05 * phase * u_wave;
      float fade = (1.0 - phase) * smoothstep(0.0, 0.08, phase);
      rings += smoothstep(px, 0.0, abs(dist - radius + wave)) * fade;
    }
    return clamp(rings, 0.0, 1.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = (uv - u_center) * vec2(aspect, 1.0);
    float dist = length(p);
    float angle = atan(p.y, p.x);
    float px = 1.5 / u_resolution.y;

    // Slight iridescence for the ambient layer: a calm hue that drifts slowly
    // over time and shifts across the radius. Kept subtle (offsets the neutral
    // colour, not replaces it). Skipped when a health tint is driving u_color
    // so the green/red connection signal stays pure.
    vec3 ambientCol = u_color;
    if (u_tinted < 0.5) {
      float ht = u_time * 0.03 + dist * 0.5;
      vec3 hue = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + ht));
      ambientCol = u_color + (hue - 0.5) * 0.3;
    }

    vec3 premul = vec3(0.0);
    float a = 0.0;

    if (u_mode == 1) {
      // HEARTBEAT — a calm lub-dub: a strong ring then a softer one, then rest.
      float period = 2.4;            // seconds between heartbeats
      float beat = u_time / period;
      float cov = 0.0;
      for (int k = 0; k < 4; k++) {  // a few recent beats still expanding
        float bn = floor(beat) - float(k);
        for (int j = 0; j < 2; j++) {
          float birth = (bn + (j == 0 ? 0.0 : 0.16)) * period;
          float age = u_time - birth;
          if (age < 0.0) continue;
          float ph = age / (period * 0.9);
          if (ph >= 1.0) continue;
          float radius = ph * u_reach;
          float fade = (1.0 - ph) * smoothstep(0.0, 0.05, ph);
          float amp = (j == 0 ? 1.0 : 0.55);
          cov += smoothstep(px * 1.6, 0.0, abs(dist - radius)) * fade * amp;
        }
      }
      float aa = clamp(cov, 0.0, 1.0) * u_alpha * 1.4;
      premul = ambientCol * aa;
      a = aa;
    } else if (u_mode == 2) {
      // BREATHING — layered soft rings at different depths, slowly in/exhaling.
      float breath = 1.0 + 0.06 * sin(u_time * 0.5);
      float soft = 0.0;
      for (int L = 0; L < 3; L++) {
        float lf = float(L);
        float reach = u_reach * breath * (0.7 + 0.18 * lf);
        float spd = 0.018 + 0.006 * lf;
        for (int i = 0; i < 10; i++) {
          float offset = float(i) / 10.0;
          float phase = fract(u_time * spd + offset + lf * 0.13);
          float radius = phase * reach;
          float fade = (1.0 - phase) * smoothstep(0.0, 0.1, phase);
          float d = abs(dist - radius);
          soft += exp(-d * d * 900.0) * fade * (0.6 - 0.15 * lf);
        }
      }
      float aa = clamp(soft, 0.0, 1.0) * u_alpha * 1.3;
      premul = ambientCol * aa;
      a = aa;
    } else if (u_mode == 3) {
      // AURORA — soft drifting ribbons of colour (northern-lights).
      float cover = 0.0;
      vec3 col = vec3(0.0);
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float yc = 0.5 + 0.16 * sin(uv.x * 3.0 + u_time * 0.3 + fi * 2.1)
                       + 0.12 * (fbm(vec2(uv.x * 2.0 - u_time * 0.05, fi)) - 0.5);
        float band = exp(-pow((uv.y - yc) / 0.13, 2.0));
        vec3 bcol = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.35, 0.6) + fi * 0.18 + u_time * 0.03));
        col += bcol * band;
        cover += band;
      }
      a = clamp(cover, 0.0, 1.0) * u_alpha * 2.4;
      premul = clamp(col * u_alpha * 2.4, 0.0, 1.0);
    } else if (u_mode == 4) {
      // BOKEH — soft light orbs drifting slowly upward.
      vec2 gp = vec2(uv.x * aspect, uv.y);
      float cover = 0.0;
      vec3 col = vec3(0.0);
      for (int i = 0; i < 14; i++) {
        float fi = float(i);
        float seed = hash11(fi * 1.7);
        float x = hash11(fi * 2.3) * aspect;
        float speed = 0.015 + 0.03 * seed;
        float y = fract(hash11(fi * 3.1) + u_time * speed);
        float size = 0.05 + 0.13 * hash11(fi * 4.7);
        float d = length(gp - vec2(x, y));
        float orb = smoothstep(size, size * 0.15, d);
        float vfade = smoothstep(0.0, 0.15, y) * smoothstep(1.0, 0.82, y);
        vec3 ocol = 0.6 + 0.4 * cos(6.2831 * (vec3(0.05, 0.25, 0.45) + seed));
        float w = orb * vfade * (0.4 + 0.6 * seed);
        col += ocol * w;
        cover += w;
      }
      a = clamp(cover, 0.0, 1.0) * u_alpha * 2.6;
      premul = clamp(col * u_alpha * 2.6, 0.0, 1.0);
    } else if (u_mode == 5) {
      // DAWN — a slow flowing colour wash, no hard shapes.
      float n = fbm(uv * 2.0 + vec2(u_time * 0.03, u_time * 0.02));
      float n2 = fbm(uv * 1.3 - vec2(u_time * 0.025, 0.0));
      vec3 warm = vec3(0.98, 0.55, 0.38);
      vec3 cool = vec3(0.32, 0.42, 0.85);
      vec3 col = mix(cool, warm, smoothstep(0.15, 0.85, uv.y * 0.55 + n * 0.55));
      col = mix(col, vec3(0.95, 0.72, 0.5), n2 * 0.3);
      a = u_alpha * 2.6;
      premul = clamp(col * a, 0.0, 1.0);
    } else if (u_mode == 6) {
      // BREATH ORB — one soft glow gently expanding and contracting.
      float breath = 0.5 + 0.5 * sin(u_time * 0.4);
      float radius = mix(0.28, 0.52, breath);
      float glow = exp(-(dist * dist) / (radius * radius) * 3.0);
      vec3 col = mix(ambientCol, vec3(1.0, 0.78, 0.55), 0.6);
      a = glow * u_alpha * 2.6;
      premul = clamp(col * a, 0.0, 1.0);
    } else {
      // CLASSIC
      float aa = ambientRings(dist, angle, px) * u_alpha;
      premul = ambientCol * aa;
      a = aa;
    }

    // Coloured event ripples layered on top — in every mode.
    for (int i = 0; i < ${MAX_PULSES}; i++) {
      if (i >= u_pulseCount) break;
      float phase = u_pulsePhase[i];
      float radius = phase * u_reach;
      float wave = (sin(angle * 5.0 + u_time * 0.6) + sin(angle * 9.0 - u_time * 0.4))
                   * 0.5 * 0.05 * phase * u_wave;
      float fade = (1.0 - phase) * smoothstep(0.0, 0.06, phase);
      float cov = smoothstep(px * u_pulseWidth, 0.0, abs(dist - radius + wave))
                  * fade * u_pulseStrength;
      premul += u_pulseColor[i] * cov;
      a += cov;
    }

    gl_FragColor = vec4(clamp(premul, 0.0, 1.0), clamp(a, 0.0, 1.0));
  }
`;

const COLOR_DARK: [number, number, number] = [1.0, 1.0, 1.0];
const COLOR_LIGHT: [number, number, number] = [0.0, 0.0, 0.0];

const getMode = (): 'light' | 'dark' =>
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-mode') === 'dark'
    ? 'dark' : 'light';

interface Props {
  resolvedMode?: 'light' | 'dark';
  /** Wavy/squiggly rings instead of perfect circles. Off by default (original radial look). */
  wavy?: boolean;
  /** Spawn coloured ripples in response to home-pulse-bus events. */
  reactive?: boolean;
  /** Visual prominence of reactive ripples. */
  intensity?: PulseIntensity;
  /**
   * Tint the steady ambient rings (normalised RGB 0..1). When null/undefined the
   * rings use the neutral theme colour (white on dark, black on light).
   */
  tint?: [number, number, number] | null;
  /** Ring origin in UV (x:0..1, y:0=bottom…1=top). Default centred [0.5, 0.5]. */
  center?: [number, number];
  /** Ring radius at full phase, UV-height units. Default 1.1 (covers from centre). */
  reach?: number;
  /** Ambient background style. Default 'classic'. */
  mode?: PulseMode;
}

/**
 * Shared ring origin: below lg (1024px) the rings rise from the bottom edge of
 * the screen (meeting the mobile nav / pull-to-reveal handle); desktop keeps
 * the classic centred origin. Used by the wallpaper, preloader and screensaver
 * so all ring surfaces agree.
 */
export function useRingOrigin(): { center: [number, number]; reach: number } {
  const [fromBottom, setFromBottom] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setFromBottom(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return fromBottom
    ? { center: [0.5, 0.0], reach: 1.7 }
    : { center: [0.5, 0.5], reach: 1.1 };
}

export function RingShaderBackground({ resolvedMode, wavy = false, reactive = false, intensity = 'subtle', tint = null, center = DEFAULT_CENTER, reach = DEFAULT_REACH, mode = 'classic' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<'light' | 'dark'>(resolvedMode ?? getMode());
  useEffect(() => { modeRef.current = resolvedMode ?? getMode(); }, [resolvedMode]);
  // Read live in the draw loop so toggling doesn't tear down the WebGL context.
  const wavyRef = useRef(wavy);
  useEffect(() => { wavyRef.current = wavy; }, [wavy]);
  const intensityRef = useRef<PulseIntensity>(intensity);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  // Ambient-ring tint, read live so connection-state changes recolour smoothly
  // without rebuilding the WebGL context.
  const tintRef = useRef<[number, number, number] | null>(tint);
  useEffect(() => { tintRef.current = tint; }, [tint]);
  // Origin + reach, read live so the centre can shift (desktop↔mobile) without
  // tearing down the context.
  const centerRef = useRef<[number, number]>(center);
  useEffect(() => { centerRef.current = center; }, [center]);
  const reachRef = useRef<number>(reach);
  useEffect(() => { reachRef.current = reach; }, [reach]);
  // Ambient style, read live so flipping modes doesn't rebuild the context.
  const pulseModeRef = useRef<PulseMode>(mode);
  useEffect(() => { pulseModeRef.current = mode; }, [mode]);

  // Active event ripples, fed by the home-pulse bus while reactive.
  const pulsesRef = useRef<ActivePulse[]>([]);
  useEffect(() => {
    if (!reactive) {
      pulsesRef.current = [];
      return;
    }
    return subscribeHomePulse((color) => {
      pulsesRef.current.push({ bornTs: performance.now(), color });
      if (pulsesRef.current.length > MAX_PULSES) {
        pulsesRef.current = pulsesRef.current.slice(-MAX_PULSES);
      }
    });
  }, [reactive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
      ?? canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;

    if (!gl) return startCanvas2DFallback(canvas, modeRef, wavyRef, pulsesRef, intensityRef, tintRef, centerRef);

    // Compile shaders
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    // FRAG declares highp. If a GPU can't compile it, drop to the Canvas2D
    // fallback rather than render a blank canvas.
    if (!vert || !frag) return startCanvas2DFallback(canvas, modeRef, wavyRef, pulsesRef, intensityRef, tintRef, centerRef);

    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Shader link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uColor = gl.getUniformLocation(program, 'u_color');
    const uAlpha = gl.getUniformLocation(program, 'u_alpha');
    const uWave = gl.getUniformLocation(program, 'u_wave');
    const uCenter = gl.getUniformLocation(program, 'u_center');
    const uReach = gl.getUniformLocation(program, 'u_reach');
    const uMode = gl.getUniformLocation(program, 'u_mode');
    const uTinted = gl.getUniformLocation(program, 'u_tinted');
    const uPulseCount = gl.getUniformLocation(program, 'u_pulseCount');
    const uPulsePhase = gl.getUniformLocation(program, 'u_pulsePhase');
    const uPulseColor = gl.getUniformLocation(program, 'u_pulseColor');
    const uPulseStrength = gl.getUniformLocation(program, 'u_pulseStrength');
    const uPulseWidth = gl.getUniformLocation(program, 'u_pulseWidth');

    // Premultiplied-alpha blending so ambient + coloured pulses composite cleanly.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Scratch buffers reused each frame for the pulse uniform arrays.
    const phaseBuf = new Float32Array(MAX_PULSES);
    const colorBuf = new Float32Array(MAX_PULSES * 3);

    let rafId: number;
    let startTime: number | null = null;

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (ts: number) => {
      if (startTime === null) startTime = ts;
      const t = (ts - startTime) / 1000;

      const isDark = (modeRef.current ?? getMode()) === 'dark';
      gl.uniform1f(uTime, t);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform3fv(uColor, tintRef.current ?? (isDark ? COLOR_DARK : COLOR_LIGHT));
      // A coloured tint reads faintly at the neutral alpha, so lift it a touch.
      gl.uniform1f(uAlpha, tintRef.current ? (isDark ? 0.16 : 0.18) : (isDark ? 0.07 : 0.12));
      gl.uniform1f(uWave, wavyRef.current ? 1.0 : 0.0);
      gl.uniform2f(uCenter, centerRef.current[0], centerRef.current[1]);
      gl.uniform1f(uReach, reachRef.current);
      gl.uniform1i(uMode, MODE_INDEX[pulseModeRef.current]);
      gl.uniform1f(uTinted, tintRef.current ? 1 : 0);

      // Age out expired pulses (compact in place) and upload the live ones.
      const pulses = pulsesRef.current;
      let live = 0;
      for (let i = 0; i < pulses.length; i++) {
        const phase = (ts - pulses[i].bornTs) / PULSE_DURATION_MS;
        if (phase >= 1) continue;
        phaseBuf[live] = phase;
        colorBuf[live * 3] = pulses[i].color[0];
        colorBuf[live * 3 + 1] = pulses[i].color[1];
        colorBuf[live * 3 + 2] = pulses[i].color[2];
        pulses[live] = pulses[i];
        live++;
        if (live >= MAX_PULSES) break;
      }
      pulses.length = live;
      const ints = INTENSITY[intensityRef.current];
      gl.uniform1i(uPulseCount, live);
      gl.uniform1fv(uPulsePhase, phaseBuf);
      gl.uniform3fv(uPulseColor, colorBuf);
      gl.uniform1f(uPulseStrength, ints.strength);
      gl.uniform1f(uPulseWidth, ints.width);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  );
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Canvas2D fallback for environments without WebGL. Renders the classic ring
// look only — the mode-specific styles are WebGL-only — plus event ripples.
function startCanvas2DFallback(
  canvas: HTMLCanvasElement,
  modeRef: React.MutableRefObject<'light' | 'dark'>,
  wavyRef: React.MutableRefObject<boolean>,
  pulsesRef: React.MutableRefObject<ActivePulse[]>,
  intensityRef: React.MutableRefObject<PulseIntensity>,
  tintRef: React.MutableRefObject<[number, number, number] | null>,
  centerRef: React.MutableRefObject<[number, number]>
): (() => void) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let rafId: number;
  let startTime: number | null = null;

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const draw = (ts: number) => {
    if (startTime === null) startTime = ts;
    const t = (ts - startTime) / 1000;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width * centerRef.current[0];
    const cy = canvas.height * (1 - centerRef.current[1]); // UV y is bottom-up; canvas y is top-down
    // Farthest corner from the (possibly off-centre) origin, so rings always
    // sweep the whole surface regardless of where the centre sits.
    const maxR = Math.hypot(Math.max(cx, canvas.width - cx), Math.max(cy, canvas.height - cy)) * 1.1;
    const isDark = (modeRef.current ?? getMode()) === 'dark';
    const tintRgb = tintRef.current;
    const baseAlpha = tintRgb ? (isDark ? 0.16 : 0.18) : (isDark ? 0.07 : 0.12);
    const ringRgb = tintRgb
      ? `${Math.round(tintRgb[0] * 255)},${Math.round(tintRgb[1] * 255)},${Math.round(tintRgb[2] * 255)}`
      : isDark ? '255,255,255' : '0,0,0';
    const dpr = window.devicePixelRatio || 1;

    const SEGMENTS = 96;
    for (let i = 0; i < 22; i++) {
      const offset = i / 22;
      const phase = ((t * 0.02 + offset) % 1 + 1) % 1;
      const radius = phase * maxR;
      const fade = (1 - phase) * Math.min(1, phase / 0.08);
      const alpha = fade * baseAlpha;
      // Wobble amplitude in px, scaled like the shader: 0 at spawn, full at edge.
      // Zero when wavy mode is off → plain concentric circles.
      const amp = wavyRef.current ? 0.05 * phase * maxR : 0;

      ctx.beginPath();
      for (let s = 0; s <= SEGMENTS; s++) {
        const angle = (s / SEGMENTS) * Math.PI * 2;
        const wave =
          (Math.sin(angle * 5 + t * 0.6 + offset * 6.28) +
            Math.sin(angle * 9 - t * 0.4)) *
          0.5 *
          amp;
        const r = radius + wave;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(${ringRgb}, ${alpha})`;
      ctx.lineWidth = dpr;
      ctx.stroke();
    }

    // Coloured event ripples — age out expired (compact in place) and draw.
    const pulses = pulsesRef.current;
    const ints = intensityRef.current === 'bold'
      ? { strength: 0.8, width: 2.4 }
      : { strength: 0.22, width: 1.0 };
    let live = 0;
    for (let i = 0; i < pulses.length; i++) {
      const phase = (ts - pulses[i].bornTs) / PULSE_DURATION_MS;
      if (phase >= 1) continue;
      pulses[live] = pulses[i];
      live++;

      const radius = phase * maxR;
      const fade = (1 - phase) * Math.min(1, phase / 0.06);
      const [r, g, b] = pulses[i].color;
      const pAlpha = fade * ints.strength;
      const amp = wavyRef.current ? 0.05 * phase * maxR : 0;

      ctx.beginPath();
      for (let s = 0; s <= SEGMENTS; s++) {
        const angle = (s / SEGMENTS) * Math.PI * 2;
        const wave = (Math.sin(angle * 5 + t * 0.6) + Math.sin(angle * 9 - t * 0.4)) * 0.5 * amp;
        const rr = radius + wave;
        const x = cx + Math.cos(angle) * rr;
        const y = cy + Math.sin(angle) * rr;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${pAlpha})`;
      ctx.lineWidth = dpr * 1.7 * ints.width;
      ctx.stroke();
    }
    pulses.length = live;

    rafId = requestAnimationFrame(draw);
  };

  rafId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
  };
}
