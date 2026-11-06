import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findParkedFlag, isHrefParked, type ModuleFlag } from '../lib/module-flags.ts';

const lvfrParked: ModuleFlag[] = [
  { key: '/lvfr-aemt', enabled: false, parked_at: '2026-11-06', note: 'archived' },
];

test('parking /lvfr-aemt parks its pages', () => {
  assert.ok(findParkedFlag('/lvfr-aemt', lvfrParked));
  assert.ok(findParkedFlag('/lvfr-aemt/day/2026-07-16', lvfrParked));
  assert.ok(isHrefParked('/lvfr-aemt/skills', lvfrParked));
});

test('pharmacology practice stays live when /lvfr-aemt is parked', () => {
  assert.equal(findParkedFlag('/lvfr-aemt/pharm/practice', lvfrParked), null);
  assert.equal(isHrefParked('/lvfr-aemt/pharm/practice?x=1', lvfrParked), false);
});

test('other pharm pages are still parked; unrelated routes unaffected', () => {
  assert.ok(findParkedFlag('/lvfr-aemt/pharm', lvfrParked));
  assert.equal(findParkedFlag('/labs', lvfrParked), null);
  assert.equal(findParkedFlag('/lvfr-aemt', []), null);
});
