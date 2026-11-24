import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStationName, sortGroupStations, buildLocationLists, nextStationNumber } from '../lib/nremt-hub-stations.ts';

test('default name: group count plus one, raised until unused, plain hyphen', () => {
  assert.equal(nextStationName('Patient Assessment - Medical', ['Patient Assessment - Medical']), 'Patient Assessment - Medical 2');
  assert.equal(nextStationName('Patient Assessment - Medical', ['Patient Assessment - Medical', 'Patient Assessment - Medical 2']), 'Patient Assessment - Medical 3');
  // Medical group as on Nov 25: two stations, named without the skill base for one of them
  assert.equal(nextStationName('Patient Assessment - Medical', ['Patient Assessment - Medical', 'Medical B']), 'Patient Assessment - Medical 3');
  // count + 1 already used -> raised
  assert.equal(nextStationName('Bleeding Control', ['Bleeding Control 2', 'Other']), 'Bleeding Control 3');
  assert.equal(nextStationName('Bleeding Control', []), 'Bleeding Control 1');
  assert.equal(nextStationName('CPR (AED)', ['CPR (AED)']), 'CPR (AED) 2');
});

test('default name never carries an em or en dash', () => {
  const n = nextStationName('Patient Assessment \u2014 Medical', ['Patient Assessment \u2013 Medical']);
  assert.equal(n, 'Patient Assessment - Medical 2');
  assert.ok(!/[\u2013\u2014]/.test(n));
  assert.equal(nextStationName('Patient Assessment - Medical', ['Patient Assessment \u2014 Medical 2']), 'Patient Assessment - Medical 3');
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
