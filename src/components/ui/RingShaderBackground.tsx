'use client';

import { useEffect, useRef, useState } from 'react';
import { subscribeHomePulse, type PulseColor } from '@/lib/homePulseBus';

// How long an event ripple takes to travel centre → edge. Much faster than the
// ~50s ambient rings so it reads as a distinct, reactive response to an event.
const PULSE_DURATION_MS = 5000;
// Dissolve time when the ambient style (mode) is switched. The canvas fades out,
// the shader swaps at the trough, then it fades back in — hiding the hard cut.
const MODE_FADE_MS = 260;

interface ActivePulse {
  bornTs: number; // requestAnimationFrame timestamp at emit (shares perf.now origin)
  color: PulseColor;
  width: number; // thickness multiplier on top of the intensity width (1 = normal; ping pulses scale by latency)
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
 *   weather    — abstract, reactive ambience driven by a weather entity
 *   warp       — liquid domain-warped fBM in violet→magenta→white
 *                (port of "Base warp fBM" by trinketMage, shadertoy.com/view/tdG3Rd)
 *   northernLights — raymarched volumetric aurora curtains over a starfield
 *                (port of "Auroras" by nimitz, shadertoy.com/view/XtGGRt)
 *   meshGradient / grainGradient / paperWarp / simplexNoise / metaballs —
 *                ports of the eponymous Paper Shaders effects
 *                (github.com/paper-design/shaders, Apache-2.0) with palettes
 *                and parameters baked in for the screensaver.
 */
export type PulseMode =
  | 'classic' | 'heartbeat' | 'breathing' | 'aurora' | 'bokeh' | 'dawn' | 'breathOrb' | 'weather'
  | 'warp' | 'northernLights'
  | 'meshGradient' | 'grainGradient' | 'paperWarp' | 'simplexNoise' | 'metaballs';

export const PULSE_MODES: PulseMode[] = [
  'classic', 'heartbeat', 'breathing', 'aurora', 'bokeh', 'dawn', 'breathOrb', 'weather',
  'warp', 'northernLights',
  'meshGradient', 'grainGradient', 'paperWarp', 'simplexNoise', 'metaballs',
];

const MODE_INDEX: Record<PulseMode, number> = {
  classic: 0,
  heartbeat: 1,
  breathing: 2,
  aurora: 3,
  bokeh: 4,
  dawn: 5,
  breathOrb: 6,
  weather: 7,
  warp: 8,
  northernLights: 9,
  meshGradient: 10,
  grainGradient: 11,
  paperWarp: 12,
  simplexNoise: 13,
  metaballs: 14,
};

/** Shader-ready weather parameters (see @/lib/weatherVisual WeatherParams). */
export interface WeatherUniforms {
  clouds: number;
  rain: number;
  snow: number;
  wind: number;
  temp: number;
  day: number;
}

const NEUTRAL_WEATHER_UNIFORMS: WeatherUniforms = { clouds: 0.3, rain: 0, snow: 0, wind: 0.2, temp: 0, day: 1 };

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
  uniform float u_opaque; // 1.0 → immersive modes fill fully (screensaver/onboarding)

  // Weather params for the 'weather' mode (all 0..1, temp -1..1).
  uniform float u_wxClouds;
  uniform float u_wxRain;
  uniform float u_wxSnow;
  uniform float u_wxWind;
  uniform float u_wxTemp;
  uniform float u_wxDay;

  // Reactive event pulses: each is a coloured ring expanding from centre.
  uniform int u_pulseCount;
  uniform float u_pulsePhase[${MAX_PULSES}]; // 0 at spawn → 1 fully expanded
  uniform vec3 u_pulseColor[${MAX_PULSES}];
  uniform float u_pulseStrength; // brightness of pulse rings (intensity setting)
  uniform float u_pulseWidth[${MAX_PULSES}]; // per-pulse line thickness (intensity × latency factor)

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

  // ── "Base warp fBM" helpers — port of trinketMage's shader
  //    (shadertoy.com/view/tdG3Rd). The character comes from *squared* value
  //    noise, a rotation folded into each fBM octave (with the original's
  //    quirky out-of-order amplitudes), and the pattern being fBM fed into
  //    fBM twice: fbm(p + fbm(p + fbm(p))).
  float warpNoise(vec2 p) {
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u * u * (3.0 - 2.0 * u);
    float res = mix(
      mix(hash21(ip), hash21(ip + vec2(1.0, 0.0)), u.x),
      mix(hash21(ip + vec2(0.0, 1.0)), hash21(ip + vec2(1.0, 1.0)), u.x), u.y);
    return res * res;
  }

  // Trimmed to 3 octaves — the original's fine high-frequency layers read as
  // grainy fractal noise; keeping only the low-frequency body gives broad,
  // smooth flow for the calm blue warp screensaver.
  float warpFbm(vec2 p, float t) {
    mat2 mtx = mat2(0.8, 0.6, -0.6, 0.8);
    float f = 0.0;
    f += 0.500000 * warpNoise(p + t);        p = mtx * p * 2.02;
    f += 0.250000 * warpNoise(p);            p = mtx * p * 2.03;
    f += 0.125000 * warpNoise(p + sin(t));
    return f / 0.875;
  }

  float warpPattern(vec2 p, float t) {
    return warpFbm(p + warpFbm(p + warpFbm(p, t), t), t);
  }

  // tdG3Rd's piecewise colormap (fractions pre-divided): dark violet at 0,
  // saturated magenta around 0.25, washing out to white at 1.
  vec3 warpColormap(float x) {
    float r = x < 0.0 ? 0.2118 : x < 0.24161 ? 3.25408 * x + 0.21376 : 1.0;
    float g = x < 0.24161 ? 0.0
            : x < 0.40323 ? 3.08171 * x - 0.74459
            : 0.84113 * x + 0.15887;
    float b = x < 0.0 ? 0.2118
            : x < 0.08736 ? 3.25408 * x + 0.21376
            : x < 0.24161 ? 0.49804
            : x < 0.40323 ? 3.10597 * x - 0.25241
            : 1.0;
    return clamp(vec3(r, g, b), 0.0, 1.0);
  }

  // ── "Auroras" helpers — port of nimitz's shader (shadertoy.com/view/XtGGRt,
  //    © nimitz 2017, twitter @stormoid). Curtains are 50 raymarch steps
  //    through 5-octave triangle-wave noise; per-pixel hash dither hides the
  //    slice banding. Original's global time scale (iTime * 0.06) is folded
  //    into triNoise2d and the camera sway.
  mat2 mm2(float ang) { float c = cos(ang), s = sin(ang); return mat2(c, s, -s, c); }

  float nTri(float x) { return clamp(abs(fract(x) - 0.5), 0.01, 0.49); }
  vec2 nTri2(vec2 p) { return vec2(nTri(p.x) + nTri(p.y), nTri(p.y + nTri(p.x))); }

  float triNoise2d(vec2 p, float spd) {
    float z = 1.8;
    float z2 = 2.5;
    float rz = 0.0;
    mat2 rot = mat2(0.95534, 0.29552, -0.29552, 0.95534);
    p *= mm2(p.x * 0.06);
    vec2 bp = p;
    for (float i = 0.0; i < 5.0; i++) {
      vec2 dg = nTri2(bp * 1.85) * 0.75;
      dg *= mm2(u_time * 0.06 * spd);
      p -= dg / z2;
      bp *= 1.3;
      z2 *= 0.45;
      z *= 0.42;
      p *= 1.21 + (rz - 1.0) * 0.02;
      rz += nTri(p.x + nTri(p.y)) * z;
      p *= -rot;
    }
    return clamp(1.0 / pow(rz * 29.0, 1.3), 0.0, 0.55);
  }

  vec4 aurora(vec3 ro, vec3 rd) {
    vec4 col = vec4(0.0);
    vec4 avgCol = vec4(0.0);
    for (float i = 0.0; i < 50.0; i++) {
      float of = 0.006 * hash21(gl_FragCoord.xy) * smoothstep(0.0, 15.0, i);
      float pt = ((0.8 + pow(i, 1.4) * 0.002) - ro.y) / (rd.y * 2.0 + 0.4);
      pt -= of;
      vec3 bpos = ro + pt * rd;
      float rzt = triNoise2d(bpos.zx, 0.06);
      vec4 col2 = vec4((sin(1.0 - vec3(2.15, -0.5, 1.2) + i * 0.043) * 0.5 + 0.5) * rzt, rzt);
      avgCol = mix(avgCol, col2, 0.5);
      col += avgCol * exp2(-i * 0.065 - 2.5) * smoothstep(0.0, 5.0, i);
    }
    col *= clamp(rd.y * 15.0 + 0.4, 0.0, 1.0);
    return col * 1.8;
  }

  // Star-cell hash from Dave_Hoskins (via the original shader).
  vec3 hash33(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p.zxy, p.yxz + 19.27);
    return fract(vec3(p.x * p.y, p.z * p.x, p.y * p.z));
  }

  vec3 stars(vec3 p) {
    vec3 c = vec3(0.0);
    float res = u_resolution.x;
    for (float i = 0.0; i < 4.0; i++) {
      vec3 q = fract(p * (0.15 * res)) - 0.5;
      vec3 id = floor(p * (0.15 * res));
      vec2 rn = hash33(id).xy;
      float c2 = 1.0 - smoothstep(0.0, 0.6, length(q));
      c2 *= step(rn.x, 0.0005 + i * i * 0.001);
      c += c2 * (mix(vec3(1.0, 0.49, 0.1), vec3(0.75, 0.9, 1.0), rn.y) * 0.1 + 0.9);
      p *= 1.3;
    }
    return c * c * 0.8;
  }

  vec3 nightBg(vec3 rd) {
    float sd = dot(normalize(vec3(-0.5, -0.6, 0.9)), rd) * 0.5 + 0.5;
    sd = pow(sd, 5.0);
    return mix(vec3(0.05, 0.1, 0.2), vec3(0.1, 0.05, 0.2), sd) * 0.63;
  }

  // ── Paper Shaders helpers — ports from github.com/paper-design/shaders
  //    (Apache-2.0). WebGL1 adaptations: the noise texture is replaced with
  //    procedural hashes, fwidth-based AA with small constants, and each
  //    mode's palette/params are baked in (ES 1.00 fragment shaders can't
  //    index uniform arrays dynamically anyway).
  vec2 rot2(vec2 v, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * v;
  }

  // Ashima/Gustavson 2D simplex noise, as shipped in Paper's shader-utils.
  vec3 permute3(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0))
      + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
        dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Mesh gradient: colour spots orbiting on distinct trajectories.
  vec2 mgPos(int i, float t) {
    float pa = float(i) * 0.37;
    float pb = 0.6 + fract(float(i) / 3.0) * 0.9;
    float pc = 0.8 + fract(float(i + 1) / 4.0);
    return 0.5 + 0.5 * vec2(sin(t * pb + pa), cos(t * pc + pa * 1.5));
  }

  // Grain gradient: per-cell random + smooth value noise + a small vec4 fBM
  // (the original's quirk of never writing .w is kept — .w stays 0).
  float ggRand(vec2 p) { return hash21(floor(p)); }
  float ggValueNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x1 = mix(ggRand(i), ggRand(i + vec2(1.0, 0.0)), u.x);
    float x2 = mix(ggRand(i + vec2(0.0, 1.0)), ggRand(i + vec2(1.0, 1.0)), u.x);
    return mix(x1, x2, u.y);
  }
  vec4 ggFbm(vec2 n0, vec2 n1, vec2 n2, vec2 n3) {
    float amplitude = 0.2;
    vec4 total = vec4(0.0);
    for (int i = 0; i < 3; i++) {
      n0 = rot2(n0, 0.3);
      n1 = rot2(n1, 0.3);
      n2 = rot2(n2, 0.3);
      n3 = rot2(n3, 0.3);
      total.x += ggValueNoise(n0) * amplitude;
      total.y += ggValueNoise(n1) * amplitude;
      total.z += ggValueNoise(n2) * amplitude;
      total.z += ggValueNoise(n3) * amplitude;
      n0 *= 1.99;
      n1 *= 1.99;
      n2 *= 1.99;
      n3 *= 1.99;
      amplitude *= 0.6;
    }
    return total;
  }

  // Paper warp: value noise with a hash offset so it decorrelates from ggRand.
  float pwRand(vec2 p) { return hash21(floor(p) + 7.31); }
  float pwNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x1 = mix(pwRand(i), pwRand(i + vec2(1.0, 0.0)), u.x);
    float x2 = mix(pwRand(i + vec2(0.0, 1.0)), pwRand(i + vec2(1.0, 1.0)), u.x);
    return mix(x1, x2, u.y);
  }

  // Simplex-noise mode: stepped-smooth colour band mixer (2 steps per colour,
  // softness baked at 0.4 → half-softness 0.2).
  float sxStep(float m) {
    float stepT = floor(m * 2.0) / 2.0;
    float f = fract(m * 2.0);
    float smoothed = smoothstep(0.3, min(1.0, 0.72), f);
    return stepT + smoothed / 2.0;
  }

  // Metaballs: 1D smooth noise driving ball trajectories.
  float mbNoise(float x) {
    float i = floor(x);
    float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash11(i), hash11(i + 1.0), u);
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

    // Opaque (immersive) mode: an immersive branch sets opaqueFill=1 so the
    // final composite lays the scene over opaqueBg and forces alpha=1 — no
    // theme surface bleeds through. Ambient ring modes leave it 0 (they are
    // meant to read as rings over the surface).
    float opaqueFill = 0.0;
    vec3 opaqueBg = vec3(0.0);

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
      float A = u_alpha * 2.4;
      if (u_opaque > 0.5) { A = 1.0; opaqueFill = 1.0; opaqueBg = vec3(0.02, 0.03, 0.08); }
      a = clamp(cover, 0.0, 1.0) * A;
      premul = clamp(col * A, 0.0, 1.0);
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
      float A = u_alpha * 2.6;
      if (u_opaque > 0.5) { A = 1.0; opaqueFill = 1.0; opaqueBg = vec3(0.03, 0.04, 0.09); }
      a = clamp(cover, 0.0, 1.0) * A;
      premul = clamp(col * A, 0.0, 1.0);
    } else if (u_mode == 5) {
      // DAWN — a slow flowing colour wash, no hard shapes.
      float n = fbm(uv * 2.0 + vec2(u_time * 0.03, u_time * 0.02));
      float n2 = fbm(uv * 1.3 - vec2(u_time * 0.025, 0.0));
      vec3 warm = vec3(0.98, 0.55, 0.38);
      vec3 cool = vec3(0.32, 0.42, 0.85);
      vec3 col = mix(cool, warm, smoothstep(0.15, 0.85, uv.y * 0.55 + n * 0.55));
      col = mix(col, vec3(0.95, 0.72, 0.5), n2 * 0.3);
      a = u_opaque > 0.5 ? 1.0 : u_alpha * 2.6;
      if (u_opaque > 0.5) opaqueFill = 1.0;
      premul = clamp(col * a, 0.0, 1.0);
    } else if (u_mode == 6) {
      // BREATH ORB — one soft glow gently expanding and contracting.
      float breath = 0.5 + 0.5 * sin(u_time * 0.4);
      float radius = mix(0.28, 0.52, breath);
      float glow = exp(-(dist * dist) / (radius * radius) * 3.0);
      vec3 col = mix(ambientCol, vec3(1.0, 0.78, 0.55), 0.6);
      a = glow * u_alpha * 2.6;
      premul = clamp(col * a, 0.0, 1.0);
    } else if (u_mode == 7) {
      // WEATHER — abstract, reactive ambience from the chosen weather entity.
      vec2 wuv = vec2(uv.x * aspect, uv.y);
      float wind = 0.3 + u_wxWind;

      // Base wash: temperature → warm/cool, day/night → brightness, with a
      // gentle vertical gradient (brighter toward the top "sky").
      vec3 warm = vec3(0.95, 0.6, 0.4);
      vec3 cool = vec3(0.4, 0.55, 0.85);
      vec3 sky = mix(cool, warm, 0.5 + 0.5 * u_wxTemp);
      sky = mix(sky * 0.28, sky, u_wxDay);
      sky *= mix(0.7, 1.1, uv.y);
      vec3 col = sky;
      float A = u_alpha * 2.2;

      // Clouds — drifting soft fog.
      float clouds = fbm(uv * 2.2 + vec2(u_time * 0.02 * wind, u_time * 0.008));
      clouds = smoothstep(0.4, 0.95, clouds) * u_wxClouds;
      col = mix(col, mix(vec3(0.62), sky, 0.3), clouds * 0.6);
      A += clouds * u_alpha * 1.4;

      // Rain — diagonal streaks falling, slanted by wind.
      if (u_wxRain > 0.01) {
        float slant = (u_wxWind - 0.2) * 0.6;
        vec2 rp = wuv * vec2(60.0, 18.0);
        rp.x += rp.y * slant;
        rp.y += u_time * (6.0 + 8.0 * wind);
        float cx2 = floor(rp.x);
        float streak = fract(rp.y + hash11(cx2) * 7.0);
        float drop = smoothstep(0.0, 0.06, streak) * smoothstep(0.55, 0.0, streak);
        float rain = drop * step(0.55, hash11(cx2 + 3.0)) * u_wxRain;
        col += vec3(0.6, 0.7, 0.9) * rain * 0.5;
        A += rain * u_alpha * 2.0;
      }

      // Snow — drifting flakes.
      if (u_wxSnow > 0.01) {
        vec2 sp = wuv * 14.0;
        sp.x += sin(u_time * 0.5 + sp.y) * 0.3 * wind;
        sp.y += u_time * (0.6 + wind);
        vec2 cell = floor(sp);
        vec2 f = fract(sp);
        vec2 c = vec2(hash11(cell.x * 1.3 + cell.y * 2.1), hash11(cell.x * 2.7 + cell.y * 1.1));
        float flake = smoothstep(0.18, 0.0, length(f - c))
                      * step(0.5, hash11(cell.x * 3.1 + cell.y * 4.7));
        float snow = flake * u_wxSnow;
        col += vec3(1.0) * snow;
        A += snow * u_alpha * 2.2;
      }

      // Sun glow — only when clear and daytime.
      float clarity = (1.0 - u_wxClouds) * u_wxDay;
      if (clarity > 0.01) {
        float d = length(wuv - vec2(0.7 * aspect, 0.78));
        float glow = exp(-d * d * 5.0);
        col += vec3(1.0, 0.85, 0.6) * glow * clarity * 0.8;
        A += glow * clarity * u_alpha * 2.0;
      }

      a = u_opaque > 0.5 ? 1.0 : clamp(A, 0.0, 1.0);
      if (u_opaque > 0.5) opaqueFill = 1.0;
      premul = clamp(col * a, 0.0, 1.0);
    } else if (u_mode == 8) {
      // WARP — liquid domain-warped fBM ("Base warp fBM", tdG3Rd), retuned for
      // a slow, low-detail, Home-Assistant-blue read: a slower clock, a single
      // domain-warp (one less nesting level than warpPattern → broader, softer
      // shapes) over lower-frequency coordinates, and a navy→HA-blue→ice ramp.
      float wt = u_time * 0.1;
      vec2 wp = vec2(uv.x * aspect, uv.y) * 0.65;
      float shade = clamp(warpFbm(wp + warpFbm(wp, wt), wt), 0.0, 1.0);
      vec3 deep = vec3(0.02, 0.09, 0.20);   // deep navy
      vec3 blue = vec3(0.094, 0.737, 0.949); // HA primary #18bcf2
      vec3 ice = vec3(0.82, 0.94, 1.0);      // near-white blue highlight
      vec3 col = mix(deep, blue, smoothstep(0.0, 0.62, shade));
      col = mix(col, ice, smoothstep(0.62, 1.0, shade));
      a = u_opaque > 0.5 ? 1.0 : shade * u_alpha * 3.0;
      if (u_opaque > 0.5) opaqueFill = 1.0;
      premul = clamp(col * a, 0.0, 1.0);
    } else if (u_mode == 9) {
      // NORTHERN LIGHTS — nimitz's "Auroras" (XtGGRt): night-sky gradient,
      // starfield, raymarched curtains above the horizon and their soft
      // reflection below. Fixed camera (the original's mouse look is pinned
      // at its default tilt), whole scene scaled by the theme alpha.
      vec2 np = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 ro = vec3(0.0, 0.0, -6.7);
      vec3 rd = normalize(vec3(np, 1.3));
      rd.yz *= mm2(0.1);
      rd.xz *= mm2(-0.1 * aspect + sin(u_time * 0.06 * 0.05) * 0.2);
      float fade = smoothstep(0.0, 0.01, abs(rd.y)) * 0.1 + 0.9;
      vec3 col = nightBg(rd) * fade;
      if (rd.y > 0.0) {
        vec4 aur = smoothstep(0.0, 1.5, aurora(ro, rd)) * fade;
        col += stars(rd);
        col = col * (1.0 - aur.a) + aur.rgb;
      } else {
        rd.y = abs(rd.y);
        col = nightBg(rd) * fade * 0.6;
        vec4 aur = smoothstep(0.0, 2.5, aurora(ro, rd));
        col += stars(rd) * 0.1;
        col = col * (1.0 - aur.a) + aur.rgb;
        vec3 pos = ro + ((0.5 - ro.y) / rd.y) * rd;
        float nz2 = triNoise2d(pos.xz * vec2(0.5, 0.7), 0.0);
        col += mix(vec3(0.2, 0.25, 0.5) * 0.08, vec3(0.3, 0.3, 0.5) * 0.7, nz2 * 0.4);
      }
      a = u_opaque > 0.5 ? 1.0 : u_alpha * 3.0;
      if (u_opaque > 0.5) opaqueFill = 1.0;
      premul = clamp(col * a, 0.0, 1.0);
    } else if (u_mode == 10) {
      // MESH GRADIENT — Paper's flowing colour spots with organic distortion
      // and a mild swirl (distortion 0.8, swirl 0.2, grain off, speed 0.5).
      vec2 muv = uv;
      float t = 0.5 * (u_time * 0.5 + 41.5);
      float radius = smoothstep(0.0, 1.0, length(muv - 0.5));
      float center = 1.0 - radius;
      for (float i = 1.0; i <= 2.0; i++) {
        muv.x += 0.8 * center / i * sin(t + i * 0.4 * smoothstep(0.0, 1.0, muv.y))
                 * cos(0.2 * t + i * 2.4 * smoothstep(0.0, 1.0, muv.y));
        muv.y += 0.8 * center / i * cos(t + i * 2.0 * smoothstep(0.0, 1.0, muv.x));
      }
      vec2 muvR = rot2(muv - 0.5, -3.0 * 0.2 * radius) + 0.5;
      vec3 col = vec3(0.0);
      float tw = 0.0;
      for (int i = 0; i < 4; i++) {
        vec3 ci = i == 0 ? vec3(0.55, 0.65, 0.98)
                : i == 1 ? vec3(0.30, 0.20, 0.70)
                : i == 2 ? vec3(0.95, 0.45, 0.70)
                : vec3(0.98, 0.93, 0.88);
        float d = pow(length(muvR - mgPos(i, t)), 3.5);
        float w = 1.0 / (d + 1e-3);
        col += ci * w;
        tw += w;
      }
      col /= max(1e-4, tw);
      // Spot colours average toward grey at ring-mode alpha levels, so this
      // mode runs brighter than its siblings to keep the palette legible.
      a = u_opaque > 0.5 ? 1.0 : u_alpha * 4.2;
      if (u_opaque > 0.5) opaqueFill = 1.0;
      premul = clamp(col * a, 0.0, 1.0);
    } else if (u_mode == 11) {
      // GRAIN GRADIENT — Paper's "blob" shape: four soft lobes drifting around
      // the centre, banded through a 4-colour gradient and roughed up with
      // simplex + fBM grain (softness 0.7, intensity 0.35, noise 0.25).
      float t = 0.2 * (u_time + 7.0);
      vec2 g = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
      float shape = 0.5 * pow(1.0 - clamp(length(g + 0.25 * vec2(1.3 * sin(t), 0.2 + 1.3 * cos(0.6 * t + 4.0))), 0.0, 1.0), 5.0);
      shape += 0.5 * pow(1.0 - clamp(length(g + 0.2 * vec2(1.2 * sin(-t), 1.3 * sin(1.6 * t))), 0.0, 1.0), 5.0);
      shape += 0.5 * pow(1.0 - clamp(length(g + 0.25 * vec2(1.7 * cos(-0.6 * t), cos(-1.6 * t))), 0.0, 1.0), 5.0);
      shape += 0.5 * pow(1.0 - clamp(length(g + 0.3 * vec2(1.4 * cos(0.8 * t), 1.2 * sin(-0.6 * t - 3.0))), 0.0, 1.0), 5.0);
      shape = smoothstep(0.0, 0.9, shape);
      shape = mix(0.0, shape, smoothstep(0.25, 0.3, shape));

      vec2 guv = g * u_resolution.y * 0.7;
      float baseNoise = snoise(guv * 0.5);
      vec4 fbmVals = ggFbm(0.002 * guv + 10.0, 0.003 * guv, 0.001 * guv, rot2(0.4 * guv, 2.0));
      float grainDist = baseNoise * snoise(guv * 0.2) - fbmVals.x - fbmVals.y;
      float rawNoise = 0.75 * baseNoise - fbmVals.w - fbmVals.z;
      float gnoise = clamp(rawNoise, 0.0, 1.0);

      shape += 0.35 * 2.0 / 4.0 * (grainDist + 0.5);
      shape += 0.25 * 10.0 / 4.0 * gnoise;
      shape = clamp(shape - 0.5 / 4.0, 0.0, 1.0);
      float totalShape = smoothstep(0.0, 0.72, clamp(shape * 4.0, 0.0, 1.0));
      float mixer = shape * 3.0;
      vec3 grad = vec3(0.10, 0.25, 0.55);
      grad = mix(grad, vec3(0.20, 0.60, 0.75), smoothstep(0.14, 0.86, clamp(mixer, 0.0, 1.0)));
      grad = mix(grad, vec3(0.95, 0.70, 0.40), smoothstep(0.14, 0.86, clamp(mixer - 1.0, 0.0, 1.0)));
      grad = mix(grad, vec3(0.90, 0.35, 0.45), smoothstep(0.14, 0.86, clamp(mixer - 2.0, 0.0, 1.0)));
      float A = u_alpha * 3.0;
      if (u_opaque > 0.5) { A = 1.0; opaqueFill = 1.0; opaqueBg = vec3(0.05, 0.09, 0.18); }
      a = totalShape * A;
      premul = clamp(grad * a, 0.0, 1.0);
    } else if (u_mode == 12) {
      // PAPER WARP — Paper's warp: checks base pattern pushed through noise
      // distortion and 10 layered swirl passes for a marbled flow
      // (distortion 0.25, swirl 0.9, softness 1 → pure smooth 3-colour blend).
      vec2 wuv = vec2(uv.x * aspect, uv.y) * 8.0 * 0.5;
      float t = 0.0625 * (u_time + 118.0);
      float n1 = pwNoise(wuv * 1.0 + t);
      float n2 = pwNoise(wuv * 2.0 - t);
      float wAngle = n1 * 6.28318530718;
      wuv.x += 4.0 * 0.25 * n2 * cos(wAngle);
      wuv.y += 4.0 * 0.25 * n2 * sin(wAngle);
      for (int i = 1; i <= 10; i++) {
        float fi = float(i);
        wuv.x += 0.9 / fi * cos(t + fi * 1.5 * wuv.y);
        wuv.y += 0.9 / fi * cos(t + fi * 1.0 * wuv.x);
      }
      vec2 cuv = wuv * (0.5 + 3.5 * 0.15);
      float shape = 0.5 + 0.5 * sin(cuv.x) * cos(cuv.y);
      float mixer = shape * 2.0;
      vec3 col = vec3(0.35, 0.50, 0.92);
      col = mix(col, vec3(0.96, 0.96, 1.00), clamp(mixer, 0.0, 1.0));
      col = mix(col, vec3(0.93, 0.48, 0.72), clamp(mixer - 1.0, 0.0, 1.0));
      col += 1.0 / 256.0 * (fract(sin(dot(0.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5);
      a = u_opaque > 0.5 ? 1.0 : u_alpha * 2.6;
      if (u_opaque > 0.5) opaqueFill = 1.0;
      premul = clamp(col * a, 0.0, 1.0);
    } else if (u_mode == 13) {
      // SIMPLEX NOISE — Paper's two-octave simplex field mapped through a
      // 5-colour stepped gradient (2 steps per colour) — soft contour bands.
      vec2 suv = vec2(uv.x * aspect, uv.y) * 2.0;
      float t = 0.2 * u_time;
      float sn = 0.5 + 0.5 * (0.5 * snoise(suv - vec2(0.0, 0.3 * t))
                            + 0.5 * snoise(2.0 * suv + vec2(0.0, 0.32 * t)));
      float mixer = (sn - 0.5 / 5.0) * 5.0;
      vec3 col = vec3(0.16, 0.22, 0.55);
      col = mix(col, vec3(0.25, 0.60, 0.80), sxStep(clamp(mixer, 0.0, 1.0)));
      col = mix(col, vec3(0.92, 0.85, 0.65), sxStep(clamp(mixer - 1.0, 0.0, 1.0)));
      col = mix(col, vec3(0.90, 0.50, 0.45), sxStep(clamp(mixer - 2.0, 0.0, 1.0)));
      col = mix(col, vec3(0.45, 0.25, 0.55), sxStep(clamp(mixer - 3.0, 0.0, 1.0)));
      // Wrap the out-of-range tails back between last and first colour.
      if (mixer < 0.0) {
        col = mix(vec3(0.45, 0.25, 0.55), vec3(0.16, 0.22, 0.55), sxStep(clamp(mixer + 1.0, 0.0, 1.0)));
      } else if (mixer > 4.0) {
        col = mix(vec3(0.45, 0.25, 0.55), vec3(0.16, 0.22, 0.55), sxStep(clamp(mixer - 4.0, 0.0, 1.0)));
      }
      col += 1.0 / 256.0 * (fract(sin(dot(0.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5);
      a = u_opaque > 0.5 ? 1.0 : u_alpha * 2.6;
      if (u_opaque > 0.5) opaqueFill = 1.0;
      premul = clamp(col * a, 0.0, 1.0);
    } else if (u_mode == 14) {
      // METABALLS — Paper's gooey balls: 7 warm-coloured blobs wandering on
      // noise trajectories and merging (size 0.9), transparent background.
      vec2 buv = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) + 0.5;
      float t = 0.2 * (u_time + 2503.4);
      vec3 totalColor = vec3(0.0);
      float totalShape = 0.0;
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float idxFract = fi / 20.0;
        float bAngle = 6.28318530718 * idxFract;
        float speed = 1.0 - 0.2 * idxFract;
        float nx = mbNoise(bAngle * 10.0 + fi + t * speed);
        float ny = mbNoise(bAngle * 20.0 + fi - t * speed);
        vec2 pos = vec2(0.5) + 1e-4 + 0.9 * (vec2(nx, ny) - 0.5);
        vec3 bc = i == 0 ? vec3(1.00, 0.60, 0.25)
                : i == 1 ? vec3(0.95, 0.35, 0.50)
                : i == 2 ? vec3(0.72, 0.38, 0.85)
                : i == 3 ? vec3(1.00, 0.78, 0.40)
                : i == 4 ? vec3(1.00, 0.60, 0.25)
                : i == 5 ? vec3(0.95, 0.35, 0.50)
                : vec3(0.72, 0.38, 0.85);
        float s = 1.0 - clamp(0.5 * length(buv - pos), 0.0, 1.0);
        s = pow(s, 45.0 - 30.0 * 0.75);
        s *= pow(0.75, 0.2);
        s = smoothstep(0.0, 1.0, s);
        totalColor += bc * s;
        totalShape += s;
      }
      totalColor /= max(totalShape, 1e-4);
      float finalShape = smoothstep(0.4, 0.42, totalShape);
      float A = u_alpha * 3.0;
      if (u_opaque > 0.5) { A = 1.0; opaqueFill = 1.0; opaqueBg = vec3(0.06, 0.03, 0.10); }
      a = finalShape * A;
      premul = clamp(totalColor * a, 0.0, 1.0);
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
      float cov = smoothstep(px * u_pulseWidth[i], 0.0, abs(dist - radius + wave))
                  * fade * u_pulseStrength;
      premul += u_pulseColor[i] * cov;
      a += cov;
    }

    if (opaqueFill > 0.5) {
      // Immersive opaque fill: lay the (premultiplied) scene over an opaque
      // backdrop and force alpha 1 so the theme surface never shows through.
      gl_FragColor = vec4(clamp(premul + opaqueBg * (1.0 - clamp(a, 0.0, 1.0)), 0.0, 1.0), 1.0);
    } else {
      gl_FragColor = vec4(clamp(premul, 0.0, 1.0), clamp(a, 0.0, 1.0));
    }
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
  /** Live weather params for the 'weather' mode. */
  weather?: WeatherUniforms;
  /**
   * Immersive full-bleed backdrop (screensaver/onboarding). When true the
   * picture-style modes (aurora, dawn, weather, warp, northern lights,
   * mesh/grain/paper/simplex/metaballs, bokeh) fill fully opaque instead of
   * blending translucently over the theme surface. Ambient ring modes
   * (classic/heartbeat/breathing/breathOrb) are unaffected — they stay rings
   * over the surface. Off by default for the subtle dashboard wallpaper.
   */
  opaque?: boolean;
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

export function RingShaderBackground({ resolvedMode, wavy = false, reactive = false, intensity = 'subtle', tint = null, center = DEFAULT_CENTER, reach = DEFAULT_REACH, mode = 'classic', weather = NEUTRAL_WEATHER_UNIFORMS, opaque = false }: Props) {
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
  // Crossfade when the style changes: dissolve the canvas out, swap the shader's
  // mode at the trough, dissolve back in — so a new pick doesn't hard-cut. The
  // WebGL context is untouched (only the u_mode uniform flips), so this is cheap.
  const appliedModeRef = useRef<PulseMode>(mode);
  const [fadeOpacity, setFadeOpacity] = useState(1);
  useEffect(() => {
    if (mode === appliedModeRef.current) return;
    const reduce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      // No animation under reduced motion — swap straight away.
      pulseModeRef.current = mode;
      appliedModeRef.current = mode;
      return;
    }
    setFadeOpacity(0);
    const t = window.setTimeout(() => {
      pulseModeRef.current = mode;
      appliedModeRef.current = mode;
      setFadeOpacity(1);
    }, MODE_FADE_MS);
    return () => window.clearTimeout(t);
  }, [mode]);
  // Weather params, read live so condition changes recolour without rebuilding.
  const weatherRef = useRef<WeatherUniforms>(weather);
  useEffect(() => { weatherRef.current = weather; }, [weather]);
  // Opaque immersive fill, read live so it can flip without rebuilding.
  const opaqueRef = useRef(opaque);
  useEffect(() => { opaqueRef.current = opaque; }, [opaque]);

  // Active event ripples, fed by the home-pulse bus while reactive.
  const pulsesRef = useRef<ActivePulse[]>([]);
  useEffect(() => {
    if (!reactive) {
      pulsesRef.current = [];
      return;
    }
    return subscribeHomePulse((color, _meta, width) => {
      pulsesRef.current.push({ bornTs: performance.now(), color, width: width ?? 1 });
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
    const uOpaque = gl.getUniformLocation(program, 'u_opaque');
    const uWxClouds = gl.getUniformLocation(program, 'u_wxClouds');
    const uWxRain = gl.getUniformLocation(program, 'u_wxRain');
    const uWxSnow = gl.getUniformLocation(program, 'u_wxSnow');
    const uWxWind = gl.getUniformLocation(program, 'u_wxWind');
    const uWxTemp = gl.getUniformLocation(program, 'u_wxTemp');
    const uWxDay = gl.getUniformLocation(program, 'u_wxDay');
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
    const widthBuf = new Float32Array(MAX_PULSES);

    let rafId: number;
    let startTime: number | null = null;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      // Under reduced motion the loop isn't running — repaint the static frame.
      if (reducedMotionQuery.matches) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(draw);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Function declaration (hoisted) — resize() above may repaint before this
    // line is reached during setup.
    function draw(ts: number) {
      if (!gl || !canvas) return; // narrowing for TS — unreachable at runtime
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
      gl.uniform1f(uOpaque, opaqueRef.current ? 1 : 0);
      const wx = weatherRef.current;
      gl.uniform1f(uWxClouds, wx.clouds);
      gl.uniform1f(uWxRain, wx.rain);
      gl.uniform1f(uWxSnow, wx.snow);
      gl.uniform1f(uWxWind, wx.wind);
      gl.uniform1f(uWxTemp, wx.temp);
      gl.uniform1f(uWxDay, wx.day);

      // Age out expired pulses (compact in place) and upload the live ones.
      const pulses = pulsesRef.current;
      const ints = INTENSITY[intensityRef.current];
      let live = 0;
      for (let i = 0; i < pulses.length; i++) {
        const phase = (ts - pulses[i].bornTs) / PULSE_DURATION_MS;
        if (phase >= 1) continue;
        phaseBuf[live] = phase;
        colorBuf[live * 3] = pulses[i].color[0];
        colorBuf[live * 3 + 1] = pulses[i].color[1];
        colorBuf[live * 3 + 2] = pulses[i].color[2];
        widthBuf[live] = ints.width * pulses[i].width;
        pulses[live] = pulses[i];
        live++;
        if (live >= MAX_PULSES) break;
      }
      pulses.length = live;
      gl.uniform1i(uPulseCount, live);
      gl.uniform1fv(uPulsePhase, phaseBuf);
      gl.uniform3fv(uPulseColor, colorBuf);
      gl.uniform1f(uPulseStrength, ints.strength);
      gl.uniform1fv(uPulseWidth, widthBuf);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // prefers-reduced-motion: paint the ambient gradient once and stop —
      // a static backdrop instead of a continuously animating field.
      if (!reducedMotionQuery.matches) {
        rafId = requestAnimationFrame(draw);
      }
    }

    const onMotionPrefChange = () => {
      cancelAnimationFrame(rafId);
      startTime = null;
      rafId = requestAnimationFrame(draw);
    };
    reducedMotionQuery.addEventListener('change', onMotionPrefChange);

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      reducedMotionQuery.removeEventListener('change', onMotionPrefChange);
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
      style={{ pointerEvents: 'none', opacity: fadeOpacity, transition: `opacity ${MODE_FADE_MS}ms ease` }}
      aria-hidden
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
      ctx.lineWidth = dpr * 1.7 * ints.width * pulses[i].width;
      ctx.stroke();
    }
    pulses.length = live;

    // Same reduced-motion contract as the WebGL path: one static frame.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rafId = requestAnimationFrame(draw);
    }
  };

  rafId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
  };
}
