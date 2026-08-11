/** Self-check for the address field's scheme/port guessing: `node scripts/check-normalize-ha-url.ts` */
import assert from 'node:assert/strict';
import { normalizeHaUrl } from '../src/lib/normalizeHaUrl.ts';

const cases: Array<[string, string]> = [
  // Portless local addresses — the HA 2026.8 default (port 80).
  ['homeassistant.local', 'http://homeassistant.local'],
  ['homeassistant', 'http://homeassistant'],
  ['192.168.1.50', 'http://192.168.1.50'],
  ['ha.lan', 'http://ha.lan'],
  ['localhost', 'http://localhost'],
  // Portless public addresses — TLS, not plain http.
  ['abc123.ui.nabu.casa', 'https://abc123.ui.nabu.casa'],
  ['ha.example.com', 'https://ha.example.com'],
  ['ha.example.com:443', 'https://ha.example.com:443'],
  // Explicit port still means the old plain-http setup.
  ['homeassistant.local:8123', 'http://homeassistant.local:8123'],
  ['192.168.1.50:8123', 'http://192.168.1.50:8123'],
  // An explicit scheme always wins; trailing slashes go.
  ['http://ha.example.com', 'http://ha.example.com'],
  ['https://homeassistant.local/', 'https://homeassistant.local'],
  ['  homeassistant.local//  ', 'http://homeassistant.local'],
  ['', ''],
];

for (const [input, expected] of cases) {
  assert.equal(normalizeHaUrl(input), expected, `normalizeHaUrl(${JSON.stringify(input)})`);
}
console.log(`ok — ${cases.length} addresses normalized as expected`);
