// Real mobile previews for the dashboard selector.
//
// Strategy (chosen to avoid hammering Home Assistant):
//  - "Static snapshot" — each dashboard route is rendered ONCE into an offscreen
//    iframe at a phone-sized viewport, rasterised to a PNG data URL, and cached
//    in localStorage. Cards show the cached image; no live connection per tile.
//  - "On open + stale TTL" — snapshots are only (re)generated when the panel is
//    opened and the cached image is older than PREVIEW_TTL_MS. Fresh images are
//    reused untouched.
//  - A single shared iframe + a serial queue mean at most ONE extra app instance
//    (and therefore one extra HA websocket) is alive at any moment, and only
//    while a stale tile is actually being captured.
import { toPng } from 'html-to-image';

// Phone-sized viewport for the offscreen render. Narrow enough to trip the app's
// `lg:` (1024px) breakpoint and `useMasonryCols` into genuine mobile layout.
const PREVIEW_WIDTH = 390;
const PREVIEW_HEIGHT = 520; // 3:4 of the width — matches the card aspect.

// How long a cached snapshot is considered fresh.
const PREVIEW_TTL_MS = 5 * 60 * 1000;

// Time to let the embedded app settle (connect, paint cards) before capturing.
const SETTLE_MS = 1400;
// Hard ceiling so a route that never settles can't wedge the queue.
const LOAD_TIMEOUT_MS = 12000;

const LS_PREFIX = 'ha-dash-preview:';

interface PreviewEntry {
  dataUrl: string;
  ts: number;
}

function lsKey(urlPath: string) {
  return `${LS_PREFIX}${urlPath}`;
}

export function getCachedPreview(urlPath: string): PreviewEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(lsKey(urlPath));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreviewEntry;
    if (!parsed?.dataUrl || typeof parsed.ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function isFresh(entry: PreviewEntry | null, now: number): entry is PreviewEntry {
  return !!entry && now - entry.ts < PREVIEW_TTL_MS;
}

function setCachedPreview(urlPath: string, dataUrl: string, now: number) {
  try {
    localStorage.setItem(lsKey(urlPath), JSON.stringify({ dataUrl, ts: now } satisfies PreviewEntry));
  } catch {
    // Quota or private mode — previews simply won't persist.
  }
}

// ── Subscribers ───────────────────────────────────────────────────────────────
// Cards subscribe per urlPath; they re-read the cache when notified.
const subscribers = new Map<string, Set<() => void>>();

export function subscribePreview(urlPath: string, cb: () => void): () => void {
  let set = subscribers.get(urlPath);
  if (!set) {
    set = new Set();
    subscribers.set(urlPath, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
    if (set && set.size === 0) subscribers.delete(urlPath);
  };
}

function notify(urlPath: string) {
  subscribers.get(urlPath)?.forEach((cb) => cb());
}

// ── Serial capture queue ────────────────────────────────────────────────────
// One shared iframe, one capture at a time.
let sharedIframe: HTMLIFrameElement | null = null;
const queue: string[] = [];
const queued = new Set<string>();
let running = false;

function ensureIframe(): HTMLIFrameElement {
  if (sharedIframe) return sharedIframe;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  iframe.width = String(PREVIEW_WIDTH);
  iframe.height = String(PREVIEW_HEIGHT);
  // Park it far offscreen rather than display:none — hidden iframes don't lay
  // out, which would defeat the snapshot.
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${PREVIEW_WIDTH}px`,
    height: `${PREVIEW_HEIGHT}px`,
    border: '0',
    pointerEvents: 'none',
    opacity: '0',
    zIndex: '-1',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(iframe);
  sharedIframe = iframe;
  return iframe;
}

function loadRoute(iframe: HTMLIFrameElement, urlPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('preview load timeout'));
    }, LOAD_TIMEOUT_MS);
    const onLoad = () => {
      cleanup();
      resolve();
    };
    function cleanup() {
      clearTimeout(timer);
      iframe.removeEventListener('load', onLoad);
    }
    iframe.addEventListener('load', onLoad);
    const sep = urlPath.includes('?') ? '&' : '?';
    iframe.src = `${urlPath}${sep}embed=1`;
  });
}

async function captureOne(urlPath: string) {
  const iframe = ensureIframe();
  await loadRoute(iframe, urlPath);
  // Let the app connect + paint.
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  const doc = iframe.contentDocument;
  const target = doc?.body;
  if (!target) throw new Error('no preview document');
  const dataUrl = await toPng(target, {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    pixelRatio: 1,
    cacheBust: false,
    backgroundColor: undefined,
  });
  setCachedPreview(urlPath, dataUrl, Date.now());
  notify(urlPath);
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const urlPath = queue.shift()!;
      queued.delete(urlPath);
      try {
        await captureOne(urlPath);
      } catch {
        // Swallow — a failed tile keeps its skeleton; we'll retry next open.
      }
    }
  } finally {
    running = false;
    // Tear down the shared iframe (and its HA websocket) once idle.
    if (sharedIframe) {
      sharedIframe.remove();
      sharedIframe = null;
    }
  }
}

// Public entry point. No-ops when a fresh snapshot already exists (unless forced),
// so it's safe to call on every panel open.
export function requestPreview(urlPath: string, opts?: { force?: boolean }) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (!opts?.force && isFresh(getCachedPreview(urlPath), now)) return;
  if (queued.has(urlPath)) return;
  queued.add(urlPath);
  queue.push(urlPath);
  void drain();
}

export const PREVIEW_DIMENSIONS = { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT };
