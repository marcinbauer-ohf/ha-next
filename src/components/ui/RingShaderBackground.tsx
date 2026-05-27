'use client';

import { useEffect, useRef } from 'react';

const VERT = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG = `
  precision mediump float;

  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_color;
  uniform float u_alpha;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float dist = length(p);

    float px = 1.5 / u_resolution.y;

    float rings = 0.0;
    for (int i = 0; i < 22; i++) {
      float offset = float(i) / 22.0;
      float phase = fract(u_time * 0.02 + offset);
      float radius = phase * 1.1;
      float fade = (1.0 - phase) * smoothstep(0.0, 0.08, phase);
      rings += smoothstep(px, 0.0, abs(dist - radius)) * fade;
    }

    float a = clamp(rings, 0.0, 1.0) * u_alpha;
    gl_FragColor = vec4(u_color, a);
  }
`;

const COLOR_DARK: [number, number, number] = [1.0, 1.0, 1.0];
const COLOR_LIGHT: [number, number, number] = [0.0, 0.0, 0.0];

const getMode = (): 'light' | 'dark' =>
  typeof document !== 'undefined' && document.documentElement.getAttribute('data-mode') === 'dark'
    ? 'dark' : 'light';

interface Props {
  resolvedMode?: 'light' | 'dark';
}

export function RingShaderBackground({ resolvedMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<'light' | 'dark'>(resolvedMode ?? getMode());
  useEffect(() => { modeRef.current = resolvedMode ?? getMode(); }, [resolvedMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
      ?? canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;

    if (!gl) return startCanvas2DFallback(canvas, modeRef);

    // Compile shaders
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;

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

    // Enable alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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
      gl.uniform3fv(uColor, isDark ? COLOR_DARK : COLOR_LIGHT);
      gl.uniform1f(uAlpha, isDark ? 0.07 : 0.12);

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

// Canvas2D fallback for environments without WebGL
function startCanvas2DFallback(
  canvas: HTMLCanvasElement,
  modeRef: React.MutableRefObject<'light' | 'dark'>
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

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy) * 1.1;
    const isDark = (modeRef.current ?? getMode()) === 'dark';
    const baseAlpha = isDark ? 0.07 : 0.12;
    const ringRgb = isDark ? '255,255,255' : '0,0,0';
    const dpr = window.devicePixelRatio || 1;

    for (let i = 0; i < 22; i++) {
      const offset = i / 22;
      const phase = ((t * 0.02 + offset) % 1 + 1) % 1;
      const radius = phase * maxR;
      const fade = (1 - phase) * Math.min(1, phase / 0.08);
      const alpha = fade * baseAlpha;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${ringRgb}, ${alpha})`;
      ctx.lineWidth = dpr;
      ctx.stroke();
    }

    rafId = requestAnimationFrame(draw);
  };

  rafId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
  };
}
