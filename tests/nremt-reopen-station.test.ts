import test from 'node:test';
import assert from 'node:assert/strict';
import { pickReopenStation, pickReopenPair, buildStationPairs, type PairItem } from '../lib/nremt-pairs.ts';

const s = (id: string, n: number, closed: boolean) => ({ id, station_number: n, closed });

test('no closed station: null, so a new one is created', () => {
  assert.equal(pickReopenStation([s('a', 1, false), s('b', 2, false)]), null);
  assert.equal(pickReopenStation([]), null);
});
test('lowest-numbered closed station is reopened, not the first listed', () => {
  assert.equal(pickReopenStation([s('t3', 9, true), s('t1', 4, false), s('t2', 7, true)])?.id, 't2');
});
test('Trauma 2 and 3 closed: Trauma 2 first', () => {
  assert.equal(pickReopenStation([s('trauma3', 12, true), s('trauma2', 11, true), s('trauma1', 3, false)])?.id, 'trauma2');
});

type P = PairItem & { closed: boolean };
const p = (id: string, n: number, code: 'E203' | 'E204', proctor: string, closed: boolean): P => ({ id, station_number: n, code, proctor, room: null, closed });

test('pair reopen: only a pair with both parts closed; lowest first', () => {
  const items = [
    p('o1', 1, 'E204', 'A', false), p('b1', 2, 'E203', 'A', false),
    p('o2', 5, 'E204', 'B', true), p('b2', 6, 'E203', 'B', true),
    p('o3', 7, 'E204', 'C', true), p('b3', 8, 'E203', 'C', true),
  ];
  const got = pickReopenPair(buildStationPairs(items));
  assert.equal(got?.o2.id, 'o2');
  assert.equal(got?.bvm.id, 'b2');
});
test('pair reopen: half-closed pair is not a closed pair', () => {
  const items = [p('o1', 1, 'E204', 'A', true), p('b1', 2, 'E203', 'A', false)];
  assert.equal(pickReopenPair(buildStationPairs(items)), null);
});
