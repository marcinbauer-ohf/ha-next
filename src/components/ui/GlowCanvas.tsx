'use client';

import { useEffect, useRef } from 'react';

/**
 * Animated WebGL glow. Renders a single fullscreen quad whose fragment shader
 * draws a radial falloff anchored at `origin`, modulated by flowing fbm noise
 * and a slow breathing pulse. Color stays fixed at `uColor` (no hue drift) so
 * the glow reads as the brand primary. Premultiplied-alpha output.
 *
 * This is the shader experiment alternative to the static CSS radial-gradient
 * glow; positioning/clipping is left to the parent (e.g. `.corner-toast-glow`).
 */
export interface GlowCanvasProps {
  /** Base glow color, 0–1 RGB. Defaults to ha-blue (24,188,242). */
  color?: [number, number, number];
  /** Glow origin in UV space (0–1, y-down). Default bottom-right corner. */
  origin?: [number, number];
  /** Ellipse radii in UV space — larger = wider/taller glow. */
  radius?: [number, number];
  /** Overall intensity multiplier. */
  intensity?: number;
  className?: string;
  style?: React.CSSProperties;
}

const FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2  uResolution;
uniform float uTime;
uniform vec3  uColor;
uniform vec2  uOrigin;
uniform vec2  uRadius;
uniform float uIntensity;

// hash + value-noise + fbm
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, amp = 0.5;
  for(int i=0;i<5;i++){ v += amp*noise(p); p *= 2.02; amp *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uResolution;      // y-up from gl_FragCoord
  uv.y = 1.0 - uv.y;                            // flip to y-down (origin top-left)

  // elliptical distance from the glow origin
  vec2 d = (uv - uOrigin) / uRadius;
  float dist = length(d);

  // flowing distortion of the field so the edge breathes organically
  float flow = fbm(uv * 3.0 + vec2(uTime * 0.06, uTime * -0.04));
  dist += (flow - 0.5) * 0.28;

  // soft radial falloff
  float core = smoothstep(1.0, 0.0, dist);
  core = pow(core, 1.6);

  // slow breathing pulse
  float pulse = 0.85 + 0.15 * sin(uTime * 0.9);

  // hold the primary blue — motion comes from flow + pulse, not hue shift
  float a = core * pulse * uIntensity;
  outColor = vec4(uColor * a, a);               // premultiplied, pure uColor
}
`;

const VERT = /* glsl */ `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }
`;

export function GlowCanvas({
  color = [24 / 255, 188 / 255, 242 / 255],
  origin = [1, 1],
  radius = [0.85, 0.55],
  intensity = 1,
  className,
  style,
}: GlowCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // keep latest props without re-initializing GL
  const props = useRef({ color, origin, radius, intensity });
  props.current = { color, origin, radius, intensity };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) return; // no WebGL2 — parent CSS fallback still shows nothing here

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(prog, 'uResolution'),
      time: gl.getUniformLocation(prog, 'uTime'),
      color: gl.getUniformLocation(prog, 'uColor'),
      origin: gl.getUniformLocation(prog, 'uOrigin'),
      radius: gl.getUniformLocation(prog, 'uRadius'),
      intensity: gl.getUniformLocation(prog, 'uIntensity'),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied compositing

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let raf = 0;
    const start = performance.now();
    const render = (now: number) => {
      const { color, origin, radius, intensity } = props.current;
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, (now - start) / 1000);
      gl.uniform3f(u.color, color[0], color[1], color[2]);
      gl.uniform2f(u.origin, origin[0], origin[1]);
      gl.uniform2f(u.radius, radius[0], radius[1]);
      gl.uniform1f(u.intensity, intensity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden />;
}
