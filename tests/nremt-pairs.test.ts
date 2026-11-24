import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStationPairs, pairCodeFor, pairNeed, needsLabel, firstPart, inPairGap, nextExtraStationName } from '../lib/nremt-pairs.ts';

const it = (id: string, n: number, code: 'E203' | 'E204', proctor: string | null, room: string | null) => ({ id, station_number: n, code, proctor, room });

test('Nov 25 shape: 5 BVM + 6 O2 (Schafer) and 9 BVM + 10 O2 (Makula-Shaw) make two pairs', () => {
  const items = [
    it('b5', 5, 'E203', 'Michael Schafer', 'Supply Closet'),
    it('o6', 6, 'E204', 'Michael Schafer', 'Supply Closet'),
    it('b9', 9, 'E203', 'Samuel Makula-Shaw', 'Other'),
    it('o10', 10, 'E204', 'Samuel Makula-Shaw', 'Other'),
  ];
  const pairs = buildStationPairs(items);
  assert.deepEqual(pairs.map((p) => [p.o2.id, p.bvm.id]), [['o6', 'b5'], ['o10', 'b9']]);
});
test('different proctors do not pair; both proctors empty pair by room', () => {
  assert.equal(buildStationPairs([it('b', 1, 'E203', 'A', 'R'), it('o', 2, 'E204', 'B', 'R')]).length, 0);
  assert.equal(buildStationPairs([it('b', 1, 'E203', null, 'Room 1'), it('o', 2, 'E204', null, 'room 1')]).length, 1);
  assert.equal(buildStationPairs([it('b', 1, 'E203', null, null), it('o', 2, 'E204', null, null)]).length, 0);
});
test('a station is used once', () => {
  const pairs = buildStationPairs([it('b1', 1, 'E203', 'A', null), it('o2', 2, 'E204', 'A', null), it('o3', 3, 'E204', 'A', null)]);
  assert.equal(pairs.length, 1);
});
test('code first, name pattern only as fallback', () => {
  assert.equal(pairCodeFor('E203', 'x'), 'E203');
  assert.equal(pairCodeFor('E212', 'BVM thing'), null);
  assert.equal(pairCodeFor(null, 'BVM Ventilation of an Apneic Adult Patient'), 'E203');
  assert.equal(pairCodeFor(null, 'Oxygen Administration by Non-Rebreather Mask'), 'E204');
  assert.equal(pairCodeFor(null, 'Patient Assessment - Medical'), null);
});
test('what-they-need labels and first part', () => {
  assert.equal(needsLabel(pairNeed(false, false)), 'needs both');
  assert.equal(needsLabel(pairNeed(false, true)), 'O2 by NRB only');
  assert.equal(needsLabel(pairNeed(true, false)), 'BVM only');
  assert.equal(pairNeed(true, true), null);
  assert.equal(firstPart('both'), 'o2');
  assert.equal(firstPart('o2'), 'o2');
  assert.equal(firstPart('bvm'), 'bvm');
  assert.equal(firstPart(null), null);
});
test('five minute gap', () => {
  const now = Date.parse('2026-11-25T10:10:00Z');
  assert.equal(inPairGap('2026-11-25T10:06:00Z', now), true);
  assert.equal(inPairGap('2026-11-25T10:04:59Z', now), false);
  assert.equal(inPairGap(null, now), false);
});
test('extra station names follow the base station name plus the next number', () => {
  assert.equal(nextExtraStationName([{ station_number: 2, name: 'Patient Assessment - Medical' }], 'x'), 'Patient Assessment - Medical 2');
  assert.equal(nextExtraStationName([{ station_number: 2, name: 'Patient Assessment - Medical' }, { station_number: 8, name: 'Patient Assessment - Medical 2' }], 'x'), 'Patient Assessment - Medical 3');
  assert.equal(nextExtraStationName([{ station_number: 5, name: null }], 'BVM of Adult Apneic Patient'), 'BVM of Adult Apneic Patient 2');
  assert.equal(nextExtraStationName([{ station_number: 9, name: 'Station 5B' }, { station_number: 3, name: 'BVM 2' }], 'x'), 'BVM 3');
});
