/** Self-check for onboarding floors: `node scripts/check-floor-names.ts` */
import assert from 'node:assert/strict';
import { clampRoomsToFloors, floorNames, MAX_FLOORS, type OnbRoom } from '../src/components/onboarding/types.ts';

assert.deepEqual(floorNames(1), ['Ground floor']);
assert.deepEqual(floorNames(3), ['Ground floor', 'First floor', 'Second floor']);
// Named names must cover the whole allowed range, and nothing past it.
assert.equal(floorNames(MAX_FLOORS).length, MAX_FLOORS);
assert.equal(floorNames(MAX_FLOORS + 5).length, MAX_FLOORS);

const rooms: OnbRoom[] = [0, 1, 2].map((floor) => ({ id: `r${floor}`, name: `Room ${floor}`, icon: '', floor }));
// Dropping to 2 storeys moves the third-floor room down instead of orphaning it.
assert.deepEqual(clampRoomsToFloors(rooms, 2).map((r) => r.floor), [0, 1, 1]);
assert.deepEqual(clampRoomsToFloors(rooms, 1).map((r) => r.floor), [0, 0, 0]);
// Growing changes nothing, and no room can end up above the ceiling.
assert.deepEqual(clampRoomsToFloors(rooms, 5).map((r) => r.floor), [0, 1, 2]);
assert.deepEqual(clampRoomsToFloors([{ ...rooms[0], floor: 99 }], MAX_FLOORS + 3)[0].floor, MAX_FLOORS - 1);
console.log(`ok — floor names + room clamping up to ${MAX_FLOORS} storeys`);
