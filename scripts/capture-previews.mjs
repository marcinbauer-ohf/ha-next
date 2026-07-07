// Capture-previews — records the prototype/debug "experimental" features as
// short looping GIFs used for the in-app previews on Settings → Prototype &
// Debug Tools.
//
// It drives the REAL app (demo data) with Playwright, records a webm per scene,
// then converts each to an optimised looping GIF in public/previews/ via ffmpeg.
//
// Two event-driven scenes (reactive screensaver, off-screen change hints) inject
// their trigger through the dev-only `window.__haCapture` bridge (see
// src/hooks/useHomeAssistant.tsx), enabled by the `ha-capture-bridge` flag this
// harness sets before load.
//
// Usage:  node scripts/capture-previews.mjs            (all scenes)
//         node scripts/capture-previews.mjs pulse-aurora reactive   (subset)
//
// Requires the dev server running on BASE (default http://localhost:3000) and
// ffmpeg on PATH.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = process.env.BASE || 'http://localhost:3000';
const OUT_DIR = join(ROOT, 'public', 'previews');
const TMP_DIR = mkdtempSync(join(tmpdir(), 'ha-previews-'));

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 430, height: 920 };

// localStorage written before any app code runs. Demo mode + the capture
// bridge are constant; per-scene flags are merged on top.
const BASE_FLAGS = { ha_demo_mode: '1', 'ha-capture-bridge': '1' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Shared scene actions ────────────────────────────────────────────────────

// The app shows a Preloader for ~1.5s on load; when it finishes it calls
// screensaver.dismiss() (so a screensaver triggered during boot can't linger).
// Every scene must wait for it to come and go before acting, or an activated
// screensaver gets torn down a beat later.
async function waitForReady(page) {
  await page.waitForSelector('[data-scrollable="dashboard"]', { timeout: 15000 });
  await page.waitForSelector('[data-component="Preloader"]', { state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForSelector('[data-component="Preloader"]', { state: 'detached', timeout: 8000 }).catch(() => {});
  await sleep(400);
}

// Activate the full-screen screensaver (Ctrl+Shift+S) and wait for it to settle.
async function openScreensaver(page) {
  await page.evaluate(() => window.focus());
  await page.keyboard.press('Control+Shift+S');
  await page.waitForSelector('[data-component="Screensaver"]', { timeout: 8000 });
  await sleep(1000); // fade-in + first ambient frames
}

// Smoothly animate the dashboard scroller's scrollTop (px/ms ~= speed).
async function glideScroll(page, { to, durationMs }) {
  await page.evaluate(
    ({ to, durationMs }) => new Promise((resolve) => {
      const el = document.querySelector('[data-scrollable="dashboard"]');
      if (!el) return resolve();
      const from = el.scrollTop;
      const start = performance.now();
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const step = (now) => {
        const t = Math.min(1, (now - start) / durationMs);
        el.scrollTop = from + (to - from) * ease(t);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    }),
    { to, durationMs },
  );
}

// ── Scene catalogue ─────────────────────────────────────────────────────────
// Each scene records to webm; `gif` controls the ffmpeg conversion (width).
// `lead`/`dur` are filled at runtime (trim window measured from video start).

const SCENES = [
  // ── Dashboard motion features ──────────────────────────────────────────
  {
    key: 'scroll-index-rail',
    viewport: DESKTOP,
    flags: {},
    gifWidth: 560,
    async run(page) {
      const scroller = await page.waitForSelector('[data-scrollable="dashboard"]');
      await page.waitForSelector('[data-section-key]');
      await sleep(400);
      this.mark();
      // Reveal the rail by hovering it, walk the dots (preview bubble), then
      // press-drag to scrub through the sections.
      const rail = await page.waitForSelector('[role="slider"][aria-label="Jump to section"]');
      const box = await rail.boundingBox();
      const cx = box.x + box.width / 2;
      const top = box.y + 6;
      const bottom = box.y + box.height - 6;
      await page.mouse.move(cx, top);
      await sleep(500);
      // Hover each dot top→bottom so the bubble names each section.
      for (let i = 0; i <= 6; i++) {
        await page.mouse.move(cx, top + ((bottom - top) * i) / 6);
        await sleep(260);
      }
      await sleep(300);
      // Scrub: press at top, drag to bottom (dashboard jumps under the finger).
      await page.mouse.move(cx, top);
      await page.mouse.down();
      const steps = 24;
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(cx, top + ((bottom - top) * i) / steps);
        await sleep(70);
      }
      await sleep(400);
      await page.mouse.up();
      await sleep(600);
      void scroller;
    },
  },
  {
    key: 'fast-scroll-labels',
    viewport: DESKTOP,
    flags: { 'ha-flag-fast-scroll-labels': '1' },
    gifWidth: 560,
    async run(page) {
      await page.waitForSelector('[data-scrollable="dashboard"]');
      await page.waitForSelector('[data-entity-id]');
      await sleep(400);
      this.mark();
      // Hard fling down then back up — velocity saturates the name overlays.
      await glideScroll(page, { to: 2600, durationMs: 1400 });
      await sleep(500);
      await glideScroll(page, { to: 200, durationMs: 1300 });
      await sleep(700);
    },
  },
  {
    key: 'edge-change-hints',
    viewport: DESKTOP,
    flags: { 'ha-flag-offscreen-change-hints': '1', 'ha-flag-scroll-index': '0' },
    gifWidth: 560,
    async run(page) {
      await page.waitForSelector('[data-scrollable="dashboard"]');
      await page.waitForSelector('[data-entity-id]');
      // Push the first rows above the fold so their cards count as off-screen.
      await glideScroll(page, { to: 900, durationMs: 700 });
      await sleep(600);
      this.mark();
      // Pick toggleable cards now above the viewport top and flip them, staggered.
      const targets = await page.evaluate(() => {
        const scroller = document.querySelector('[data-scrollable="dashboard"]');
        const top = scroller.getBoundingClientRect().top;
        const TOGGLEABLE = ['light', 'switch', 'fan', 'input_boolean', 'media_player', 'climate'];
        const seen = [];
        for (const card of document.querySelectorAll('[data-entity-id]')) {
          const id = card.getAttribute('data-entity-id');
          if (!id || !TOGGLEABLE.includes(id.split('.')[0])) continue;
          if (card.getBoundingClientRect().bottom > top) continue; // still on-screen
          seen.push(id);
          if (seen.length >= 4) break;
        }
        return seen;
      });
      const flip = async (id) => {
        await page.evaluate((id) => {
          const cap = window.__haCapture;
          const e = cap.peek()[id];
          if (!e) return;
          const next = e.state === 'on' ? 'off' : 'on';
          const now = new Date().toISOString();
          cap.setMock(id, { ...e, state: next, last_changed: now, last_updated: now });
        }, id);
      };
      for (const id of targets) {
        await flip(id);
        await sleep(950);
      }
      await sleep(2600); // let the last bar finish its 3s fade
    },
  },

  // ── Screensaver background features ─────────────────────────────────────
  {
    key: 'screensaver-wavy',
    viewport: DESKTOP,
    flags: { 'ha-mode-pref': 'dark', 'ha-flag-wavy-background': '1', 'ha-flag-pulse-mode': 'classic' },
    gifWidth: 560,
    gifFps: 10,
    gifColors: 64,
    maxDur: 5,
    async run(page) {
      await page.waitForSelector('[data-scrollable="dashboard"]');
      await openScreensaver(page);
      this.mark();
      await sleep(6000);
    },
  },
  {
    key: 'screensaver-reactive',
    viewport: DESKTOP,
    flags: {
      'ha-mode-pref': 'dark',
      'ha-flag-reactive-background': '1',
      'ha-flag-reactive-intensity': 'bold',
      'ha-flag-reactive-trigger': 'all',
      'ha-flag-pulse-mode': 'classic',
    },
    gifWidth: 560,
    gifColors: 96,
    maxDur: 6,
    async run(page) {
      await page.waitForSelector('[data-scrollable="dashboard"]');
      await openScreensaver(page);
      this.mark();
      // Fire a sequence of semantic ripples through the capture bridge.
      const kinds = ['on', 'off', 'alert', 'error', 'on'];
      for (const kind of kinds) {
        await page.evaluate((kind) => window.__haCapture.emitPulse(kind), kind);
        await sleep(1150);
      }
      await sleep(900);
    },
  },

  // ── Ambient "Background style" gallery (pulse modes) ─────────────────────
  ...['classic', 'heartbeat', 'breathing', 'aurora', 'bokeh', 'dawn', 'breathOrb', 'weather', 'warp', 'northernLights', 'meshGradient', 'grainGradient', 'paperWarp', 'simplexNoise', 'metaballs'].map((mode) => ({
    key: `pulse-${mode}`,
    viewport: DESKTOP,
    flags: { 'ha-mode-pref': 'dark', 'ha-flag-pulse-mode': mode },
    gifWidth: 360,
    gifFps: 10,
    gifColors: 64,
    maxDur: 5,
    async run(page) {
      await page.waitForSelector('[data-scrollable="dashboard"]');
      await openScreensaver(page);
      this.mark();
      await sleep(6000);
    },
  })),
];

// ── Runner ──────────────────────────────────────────────────────────────────

async function recordScene(browser, scene) {
  const videoDir = join(TMP_DIR, scene.key);
  mkdirSync(videoDir, { recursive: true });
  const context = await browser.newContext({
    viewport: scene.viewport,
    deviceScaleFactor: 2,
    recordVideo: { dir: videoDir, size: scene.viewport },
    colorScheme: scene.flags['ha-mode-pref'] === 'dark' ? 'dark' : 'light',
  });
  const page = await context.newPage();
  await page.addInitScript((flags) => {
    try {
      for (const [k, v] of Object.entries(flags)) localStorage.setItem(k, v);
    } catch {}
  }, { ...BASE_FLAGS, ...scene.flags });

  let leadMs = 0;
  const t0 = Date.now();
  scene.mark = () => { leadMs = Date.now() - t0; };

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await waitForReady(page);
  await scene.run(page);
  const durMs = Date.now() - t0 - leadMs;

  const video = page.video();
  await context.close(); // finalises the webm
  const webm = await video.path();
  const maxDur = scene.maxDur ?? 6;
  return {
    webm,
    ss: Math.max(0, leadMs / 1000 + 0.15),
    dur: Math.min(maxDur, Math.max(1, durMs / 1000 - 0.2)),
  };
}

function toGif(webm, key, { ss, dur, width, fps, colors }) {
  const palette = join(TMP_DIR, `${key}-palette.png`);
  const out = join(OUT_DIR, `${key}.gif`);
  const vf = `fps=${fps},scale=${width}:-1:flags=lanczos`;
  execFileSync('ffmpeg', [
    '-y', '-ss', String(ss), '-t', String(dur), '-i', webm,
    '-vf', `${vf},palettegen=max_colors=${colors}:stats_mode=diff`, palette,
  ], { stdio: 'ignore' });
  execFileSync('ffmpeg', [
    '-y', '-ss', String(ss), '-t', String(dur), '-i', webm, '-i', palette,
    '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
    '-loop', '0', out,
  ], { stdio: 'ignore' });
  return out;
}

async function main() {
  const only = process.argv.slice(2);
  const scenes = only.length ? SCENES.filter((s) => only.includes(s.key)) : SCENES;
  if (!scenes.length) {
    console.error('No matching scenes. Available:', SCENES.map((s) => s.key).join(', '));
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: false, // real GPU → WebGL pulse modes render (not the 2D fallback)
    args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle'],
  });
  try {
    for (const scene of scenes) {
      process.stdout.write(`▶ ${scene.key} … `);
      const { webm, ss, dur } = await recordScene(browser, scene);
      const out = toGif(webm, scene.key, {
        ss, dur,
        width: scene.gifWidth,
        fps: scene.gifFps ?? 12,
        colors: scene.gifColors ?? 80,
      });
      const kb = Math.round(statSync(out).size / 1024);
      console.log(`ok (ss=${ss.toFixed(1)}s dur=${dur.toFixed(1)}s ${kb}KB) → ${out.replace(ROOT + '/', '')}`);
    }
  } finally {
    await browser.close();
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
  console.log('\nDone. GIFs in public/previews/');
}

main().catch((err) => { console.error(err); process.exit(1); });
