import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalAgency, agencyMatches, selectableAgencies } from '../lib/agency-match.ts';

const aliases = [
  { alias: 'AMR', canonical: 'AMR' }, { alias: 'AMR Las Vegas', canonical: 'AMR' },
  { alias: 'MWA', canonical: 'MedicWest' }, { alias: 'AMR/MWA', canonical: 'AMR/MedicWest' },
  { alias: 'HCA', canonical: 'HCA' }, { alias: 'N/A', canonical: 'None' },
];

test('spellings map to one canonical name, trailing space and case ignored', () => {
  assert.equal(canonicalAgency('AMR Las Vegas', aliases), 'AMR');
  assert.equal(canonicalAgency('hca ', aliases), 'HCA');
});
test('blank and N/A are None; unknown is null, never guessed', () => {
  assert.equal(canonicalAgency('', aliases), 'None');
  assert.equal(canonicalAgency(null, aliases), 'None');
  assert.equal(canonicalAgency('N/A', aliases), 'None');
  assert.equal(canonicalAgency('Henderson', aliases), null);
});
test('dual-employed matches either agency; None matches nothing', () => {
  assert.ok(agencyMatches('AMR', 'AMR/MedicWest'));
  assert.ok(agencyMatches('MedicWest', 'AMR/MedicWest'));
  assert.ok(!agencyMatches('LVFR', 'AMR/MedicWest'));
  assert.ok(!agencyMatches('AMR', 'None'));
  assert.ok(!agencyMatches('AMR', null));
});
test('selectable list has individual agencies only', () => {
  assert.deepEqual(selectableAgencies(aliases), ['AMR', 'HCA', 'MedicWest']);
});
