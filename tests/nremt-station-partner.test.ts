import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePartnerStation } from '../lib/nremt-station-partner.ts';

const bvm = (id: string, n: number, proctor: string | null, room: string | null, status = 'open') => ({ id, station_number: n, proctor, room, coordinatorStatus: status });
const asking = { id: 'o2', proctor: 'Schafer', room: 'Supply Closet' };

test('one BVM station is chosen', () => {
  assert.equal(choosePartnerStation([bvm('b1', 5, 'Schafer', 'Supply Closet')], asking)?.id, 'b1');
});
test('two BVM stations: the one sharing the proctor wins even if higher number', () => {
  const list = [bvm('b9', 9, 'Makula-Shaw', 'Elsewhere'), bvm('b5', 5, 'Schafer', 'X')];
  assert.equal(choosePartnerStation([...list].reverse(), asking)?.id, 'b5');
  assert.equal(choosePartnerStation(list, asking)?.id, 'b5');
});
test('two BVM stations: only the room matches', () => {
  const list = [bvm('b5', 5, 'Other', 'Room 2'), bvm('b9', 9, 'Another', 'supply closet')];
  assert.equal(choosePartnerStation(list, asking)?.id, 'b9');
});
test('one closed and one open: open wins when nothing else separates them', () => {
  const list = [bvm('b5', 5, null, null, 'closed'), bvm('b9', 9, null, null, 'open')];
  assert.equal(choosePartnerStation(list, { id: 'o2' })?.id, 'b9');
});
test('no from: open then lowest number, never an error', () => {
  const list = [bvm('b9', 9, 'A', null), bvm('b5', 5, 'B', null), bvm('b3', 3, 'C', null, 'closed')];
  assert.equal(choosePartnerStation(list, null)?.id, 'b5');
  assert.equal(choosePartnerStation([], null), null);
});
