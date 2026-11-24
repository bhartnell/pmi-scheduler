import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStationName, sortGroupStations, buildLocationLists, nextStationNumber } from '../lib/nremt-hub-stations.ts';

test('first extra station for a skill is number 2, then 3', () => {
  assert.equal(nextStationName('Patient Assessment - Medical', ['Patient Assessment - Medical']), 'Patient Assessment - Medical 2');
  assert.equal(nextStationName('Patient Assessment - Medical', ['Patient Assessment - Medical', 'Patient Assessment - Medical 2']), 'Patient Assessment - Medical 3');
  assert.equal(nextStationName('Bleeding Control', [null, undefined, 'Something else']), 'Bleeding Control 2');
  assert.equal(nextStationName('CPR (AED)', ['CPR (AED)']), 'CPR (AED) 2');
});

test('closed stations sort to the end of the group, order otherwise kept', () => {
  const out = sortGroupStations([
    { station_number: 2, coordinator_status: 'closed' },
    { station_number: 5, coordinator_status: 'open' },
    { station_number: 3, coordinator_status: null },
    { station_number: 1, coordinator_status: 'closed' },
  ]);
  assert.deepEqual(out.map((s) => s.station_number), [3, 5, 1, 2]);
});

test('NREMT-only locations exclude standard names (case-insensitive) and dedupe', () => {
  const { standard, nremtOnly } = buildLocationLists(
    ['Lab Room 1 (Big)', 'Common Area'],
    ['Suite 1', 'suite 1', 'common area', 'Supply Closet', '', null, 'Lab Room 1 (Big)']
  );
  assert.deepEqual(standard, ['Lab Room 1 (Big)', 'Common Area']);
  assert.deepEqual(nremtOnly, ['Suite 1', 'Supply Closet']);
});

test('next station number', () => {
  assert.equal(nextStationNumber([]), 1);
  assert.equal(nextStationNumber([1, 14, 3]), 15);
});
