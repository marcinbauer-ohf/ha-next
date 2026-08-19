// Fetch-integration-catalog — snapshots the brand list from home-assistant.io
// into public/integration-catalog.json, which is what the in-app "add a device
// or integration" store browses.
//
// Why the docs site and not the running instance: HA's own API only knows what
// is already set up, plus a config-flow list with no descriptions, categories,
// or "worth a look" curation. The docs site has all three — and it is the same
// list people browse at /integrations/?brands=featured.
//
// Two sources, merged on the brand domain:
//   /integrations/       — a `const integrations = [...]` array in the page:
//                          title, categories, featured, partner, version,
//                          iot class, quality scale. Also the slug→label map
//                          for categories (single-quoted option values, unlike
//                          every other <select> on that page).
//   /integrations.json   — description + integration_type per domain.
//
// Descriptions there are documentation prose ("Instructions on how to integrate
// X within Home Assistant.") — 1000+ of them. We strip that shell here, once, so
// the app never renders doc-speak. Same for categories: HA's 78 doc slugs
// ("binary-sensor", "alarm-control-panel") collapse into house language.
//
// Usage:  node scripts/fetch-integration-catalog.mjs
//         Re-run to refresh; the output is committed.

import assert from 'node:assert';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'integration-catalog.json');
const SITE = 'https://www.home-assistant.io';

// ── Categories ───────────────────────────────────────────────────────────────
// HA's 78 doc categories, bucketed into groups a person would browse by. First
// group whose slugs the brand carries wins, so the order is a priority list:
// identity-bearing categories (a light, a thermostat, a doorbell) rank above the
// incidental ones a brand happens to also expose, and the generic entity-type
// slugs sit at the bottom to catch whatever nothing else claimed. That's why
// Philips Hue reads as "Lights & shades" even though it is also a hub.
const GROUPS = [
  ['Car', ['car']],
  ['Voice & AI', ['voice', 'ai', 'text-to-speech', 'speech-to-text', 'intent']],
  ['Security', ['alarm', 'alarm-control-panel', 'doorbell', 'camera', 'lock', 'siren', 'image-processing']],
  ['Lights & shades', ['light', 'cover', 'plug']],
  ['Climate', ['climate', 'water-heater', 'humidifier', 'fan']],
  ['Hubs & radios', ['hub', 'infrared', 'radio-frequency', 'diy', '3d-printing']],
  ['Media', ['media-player', 'media-source', 'multimedia', 'remote', 'gaming', 'downloading', 'image']],
  ['Home care', ['vacuum', 'lawn-mower', 'irrigation', 'water-management', 'valve', 'pump']],
  ['Energy', ['energy', 'utility']],
  ['Weather', ['weather', 'environment']],
  ['Everyday', ['notifications', 'calendar', 'to-do-list', 'transport', 'postal-service', 'mailbox',
    'social', 'organization', 'finance', 'health', 'presence-detection', 'device-tracker',
    'geolocation', 'tag-scanner']],
  ['Sensors & switches', ['sensor', 'binary-sensor', 'switch', 'number', 'select', 'button',
    'event', 'text', 'time', 'date', 'date-time']],
  ['Network & system', ['network', 'system-monitor', 'backup', 'update', 'front-end', 'helper',
    'automation', 'scene', 'history', 'device-automation', 'other']],
];

// A brand spanning half the house isn't a thing, it's a platform — Matter,
// Zigbee, SmartThings, Tuya — and belongs with the radios whatever it happens to
// list first (Matter's 18 categories include "car", which Matter is not). Either
// sheer breadth or a declared hub plus real breadth qualifies; a Tesla with its
// 13 car categories and no hub does not, and neither does Shelly.
const isPlatform = (cats) => cats.length >= 15 || (cats.includes('hub') && cats.length >= 10);

function groupOf(cats) {
  if (isPlatform(cats)) return 'Hubs & radios';
  for (const [group, slugs] of GROUPS) {
    if (cats.some((c) => slugs.includes(c))) return group;
  }
  return 'Network & system';
}

// ── Copy ─────────────────────────────────────────────────────────────────────
// The doc-prose shell, stripped front and back. What is left is the sentence
// people actually want: "integrate your Acaia smart coffee scale" → "Connect
// your Acaia smart coffee scale."
const PREFIXES = [
  /^instructions? (on|for|about)? ?(how )?(to )?(integrat\w+|set(ting)? up|add\w*|us\w+|configur\w+|connect\w*|enabl\w+)\s*/i,
  /^instructions? (on|for)? ?(the )?/i,
  /^how to (integrate|set up|add|use|configure|connect)\s*/i,
  /^this (integration|platform|page) (provides?|allows?|describes?|explains?|documents?)( you to| how to)?\s*/i,
  /^(integration|platform|component) (to|for) /i,
  /^(learn how to|documentation (on|for|about)|detailed instructions? (on|for)?)\s*/i,
  /^set ?up (for|of|instructions for)\s*/i,
  /^support for\s*/i,
];
// "… with Home Assistant", wherever it sits — usually the tail, sometimes the
// middle ("Z-Wave with Home Assistant via Z-Wave JS").
const HA_MENTION = /[\s,]*\b(in|with|within|into|to|inside|for|from|on)?\s*(your |the )?(home[- ]assistant|hass\.?io)\b/gi;

function tagline(raw, name) {
  let text = (raw || '').replace(/\s+/g, ' ').replace(HA_MENTION, '').trim();
  for (const re of PREFIXES) {
    const next = text.replace(re, '');
    if (next !== text) { text = next.trim(); break; }
  }
  // A leftover "… integration/component/platform" tail is the doc's word, not ours.
  text = text.replace(/\s+(integration|component|platform)s?[\s.!]*$/i, '');
  text = text.trim().replace(/[.,;:]+$/, '');
  if (text.length < 8) return `Add ${name} to your home.`;
  // The stripped remainder starts mid-sentence ("your Acaia smart coffee
  // scale"), so it needs a verb in front — unless it already reads as one.
  const startsWithVerb = /^(connect|control|get|monitor|track|see|show|read|send|adds?|brings?|integrat|manag|watch|play|sync|import|export|turn|set|creat|mak|us|access|display|receiv|report|keep|find|check|link|pair|stream|record|expos|provid|allow)/i.test(text);
  const sentence = startsWithVerb ? text : `Connect ${text}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

// ── Scrape ───────────────────────────────────────────────────────────────────
async function get(path) {
  const res = await fetch(`${SITE}${path}`);
  assert.equal(res.status, 200, `${path} returned ${res.status}`);
  return res;
}

/** The page's `const integrations = [...]` array, as real objects. */
function parseIntegrations(html) {
  const open = html.indexOf('const integrations = [');
  assert.notEqual(open, -1, 'integrations array not found — the page changed shape');
  const start = open + 'const integrations = '.length;
  const end = html.indexOf('\n  ];', start) + '\n  ]'.length;
  const json = html.slice(start, end).replace(/(\n\s*)([a-z_]+):/g, '$1"$2":');
  // That slice can trail one stray literal past the last object; objects only.
  return JSON.parse(json).filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

/** slug → label for the Category <select>, whose values are single-quoted. */
function parseCategoryLabels(html) {
  const select = /data-id="cat">([\s\S]*?)<\/select>/.exec(html);
  assert.ok(select, 'category select not found — the page changed shape');
  const labels = {};
  for (const [, slug, label] of select[1].matchAll(/<option value='([^']+)'>([^<]+)<\/option>/g)) {
    labels[slug] = label;
  }
  return labels;
}

const html = await (await get('/integrations/')).text();
const brands = parseIntegrations(html);
const labels = parseCategoryLabels(html);
const docs = await (await get('/integrations.json')).json();

// The list carries a row per doc page, and MQTT alone has 33 of them ("MQTT
// Light", "MQTT water heater", …) all sharing domain `mqtt`. Those are how you
// wire a thing up, not a thing you add, and their page slug is what gives them
// away: `light.mqtt` rather than `mqtt`. Drop the dotted ones and one row per
// brand page is left — which is also the key `integrations.json` is written
// against, so descriptions land on the right row.
const pageSlug = (brand) => brand.url.replace(/^\/integrations\//, '').replace(/\/$/, '');
const pages = brands.filter((brand) => !pageSlug(brand).includes('.'));

const items = pages.map((brand) => {
  const doc = docs[pageSlug(brand)] ?? {};
  const name = brand.title === brand.domain ? (doc.title ?? brand.title) : brand.title;
  return {
    // The page slug is the stable id — two brand pages can share a domain
    // (Shelly and Shelly Z-Wave both report `shelly`).
    slug: pageSlug(brand),
    // The brand domain, not the page slug: it's what brands.home-assistant.io
    // serves logos under, and what a set-up integration reports itself as.
    domain: brand.domain,
    name,
    tagline: tagline(doc.description, name),
    group: groupOf(brand.cat ?? []),
    // The doc categories, in house wording, for search and the detail pane.
    categories: (brand.cat ?? []).map((c) => labels[c] ?? c),
    featured: Boolean(brand.featured),
    partner: Boolean(brand.wwha),
    since: brand.version || null,
    iotClass: brand.iot_class || null,
    quality: brand.quality_scale || doc.quality_scale || null,
    type: doc.integration_type ?? 'integration',
    url: `${SITE}${brand.url}`,
  };
}).sort((a, b) => a.name.localeCompare(b.name));

// ── Checks ───────────────────────────────────────────────────────────────────
// This runs against a live page we do not own; the whole file is worthless if
// the shape drifted, so fail loudly rather than write a broken catalog.
assert.ok(items.length > 1400, `only ${items.length} brands — the array parse is off`);
assert.ok(items.filter((i) => i.featured).length >= 15, 'featured brands missing');
assert.ok(items.filter((i) => i.partner).length >= 20, 'partner brands missing');
assert.ok(items.every((i) => i.slug && i.domain && i.name && i.group && i.tagline), 'incomplete rows');
assert.equal(new Set(items.map((i) => i.slug)).size, items.length, 'duplicate page slugs');
assert.ok(!items.some((i) => /^instructions/i.test(i.tagline)), 'doc prose survived the cleanup');
assert.ok(Object.keys(labels).length > 60, `only ${Object.keys(labels).length} category labels`);

const groups = [...new Set(items.map((i) => i.group))].sort((a, b) => a.localeCompare(b));
writeFileSync(OUT, `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), groups, items })}\n`);

const per = groups.map((g) => `${g} ${items.filter((i) => i.group === g).length}`).join(', ');
console.log(`${items.length} brands → public/integration-catalog.json`);
console.log(`  featured ${items.filter((i) => i.featured).length}, partners ${items.filter((i) => i.partner).length}`);
console.log(`  ${per}`);
