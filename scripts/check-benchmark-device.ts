/** Self-check for the entity-matrix rig: `node scripts/check-benchmark-device.ts` */
import assert from 'node:assert/strict';
import { createBenchmarkEntries } from '../src/lib/homeassistant/benchmarkDevice.ts';

const entries = createBenchmarkEntries();
const ids = entries.map(e => e.entity.entity_id);
const domains = new Set(ids.map(id => id.split('.')[0]));
const states = new Set(entries.map(e => e.entity.state));

assert.equal(new Set(ids).size, ids.length, 'entity ids must be unique');

// Every id is namespaced, so a staged rig can never collide with (or be mistaken
// for) an entity on the user's real instance.
for (const id of ids) {
  assert.match(id.split('.')[1], /^benchmark_/, `${id} must be namespaced benchmark_*`);
}

// Every domain that has a control surface in DeviceControls must be represented,
// or the rig stops being a benchmark for those.
for (const d of [
  'light', 'climate', 'cover', 'media_player', 'fan', 'number', 'select', 'text',
  'date', 'time', 'input_datetime', 'vacuum', 'lawn_mower', 'humidifier',
  'water_heater', 'valve', 'lock', 'alarm_control_panel', 'siren', 'remote',
  'timer', 'counter', 'todo', 'update', 'weather', 'person', 'calendar', 'group',
]) {
  assert.ok(domains.has(d), `missing a ${d} entity`);
}

// The formatting and composition axes — each one exists because a real surface
// used to get it wrong.
const attrs = entries.map(e => e.entity.attributes);
assert.ok(attrs.some(a => a.suggested_display_precision != null), 'no precision case');
assert.ok(attrs.some(a => a.device_class === 'duration'), 'no duration case');
assert.ok(attrs.some(a => a.device_class === 'monetary'), 'no monetary case');
assert.ok(attrs.some(a => a.device_class === 'timestamp'), 'no timestamp case');
assert.ok(attrs.some(a => a.attribution != null), 'no attribution case');
assert.ok(attrs.some(a => a.icon != null), 'no custom-icon case');
assert.ok(attrs.some(a => a.assumed_state === true), 'no assumed_state case');
assert.ok(attrs.some(a => a.entity_category === 'diagnostic'), 'no diagnostic case');
assert.ok(attrs.some(a => a.target_temp_low != null), 'no heat_cool range case');
assert.ok(entries.some(e => !e.entity.attributes.friendly_name), 'no unnamed-entity case');
assert.ok(
  new Set(entries.filter(e => e.entity.entity_id.startsWith('binary_sensor.')).map(e => e.entity.attributes.device_class)).size >= 5,
  'binary_sensor wording needs several device classes',
);
// …and the read-only edge cases the panel has to special-case.
for (const s of ['unavailable', 'unknown']) {
  assert.ok(states.has(s), `missing a ${s} entity`);
}

for (const kind of ['read', 'control', 'set']) {
  assert.ok(entries.some(e => e.kind === kind), `no ${kind} entities`);
}
assert.ok(entries.every(e => e.note.length > 0), 'every entry states its expectation');

console.log(`ok — ${entries.length} benchmark entities across ${domains.size} domains`);
