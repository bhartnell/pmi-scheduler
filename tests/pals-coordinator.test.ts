import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  finalRoundSlots, groupFinalStatus, roundsRunSoFar,
  type PalsCoordAttempt, type PalsCoordLabDay,
} from '../lib/pals-coordinator.ts';

const sectionE: PalsCoordLabDay = {
  id: 'day-e', date: '2026-11-03', is_adv_cert_testing: true,
  stations: [
    { id: 'st1', station_number: 1, scenario_id: 'T7' },
    { id: 'st2', station_number: 2, scenario_id: 'T9' },
    { id: 'st3', station_number: 3, scenario_id: 'T13' },
  ],
};

const attempt = (over: Partial<PalsCoordAttempt>): PalsCoordAttempt => ({
  id: over.id ?? 'a', lab_day_id: 'day-e', lab_group_id: 'g1', result: 'PASS',
  attempted_at: '2026-11-03T13:00:00Z', scenario: { id: 'T7', title: 'Round 1', case_code: 'T7' }, ...over,
});

test('finalRoundSlots orders rounds by station_number, not scenario id', () => {
  const slots = finalRoundSlots([sectionE]);
  assert.deepEqual(slots.map((s) => s.scenarioId), ['T7', 'T9', 'T13']);
  assert.deepEqual(slots.map((s) => s.round), [1, 2, 3]);
});

test('finalRoundSlots dedupes a scenario that appears on more than one station', () => {
  const dupDay: PalsCoordLabDay = {
    ...sectionE,
    stations: [...sectionE.stations, { id: 'st4', station_number: 4, scenario_id: 'T7' }],
  };
  const slots = finalRoundSlots([dupDay]);
  assert.equal(slots.length, 3);
});

test('groupFinalStatus: group with 2 of 3 rounds passed is READY', () => {
  const slots = finalRoundSlots([sectionE]);
  const attempts = [
    attempt({ id: 'a1', scenario: { id: 'T7', title: '', case_code: null }, result: 'PASS' }),
    attempt({ id: 'a2', scenario: { id: 'T9', title: '', case_code: null }, result: 'PASS' }),
  ];
  const { groupResult, outcomes } = groupFinalStatus('g1', attempts, slots);
  assert.equal(groupResult.status, 'pass');
  assert.equal(outcomes[2].result, null); // round 3 not yet graded
});

test('groupFinalStatus: a retest replaces the earlier attempt for the same round', () => {
  const slots = finalRoundSlots([sectionE]);
  const attempts = [
    attempt({ id: 'a1', scenario: { id: 'T7', title: '', case_code: null }, result: 'NR', attempted_at: '2026-11-03T13:00:00Z' }),
    attempt({ id: 'a2', scenario: { id: 'T7', title: '', case_code: null }, result: 'PASS', attempted_at: '2026-11-03T15:00:00Z' }),
  ];
  const { outcomes } = groupFinalStatus('g1', attempts, slots);
  assert.equal(outcomes[0].result, 'PASS');
  assert.equal(outcomes[0].attempt?.id, 'a2');
});

test('groupFinalStatus never mixes another group\'s attempts in', () => {
  const slots = finalRoundSlots([sectionE]);
  const attempts = [attempt({ id: 'a1', lab_group_id: 'g2', scenario: { id: 'T7', title: '', case_code: null } })];
  const { outcomes } = groupFinalStatus('g1', attempts, slots);
  assert.ok(outcomes.every((o) => o.attempt === null));
});

test('roundsRunSoFar counts distinct rounds with at least one attempt, cohort-wide', () => {
  const slots = finalRoundSlots([sectionE]);
  const attempts = [
    attempt({ id: 'a1', lab_group_id: 'g1', scenario: { id: 'T7', title: '', case_code: null } }),
    attempt({ id: 'a2', lab_group_id: 'g2', scenario: { id: 'T7', title: '', case_code: null } }),
    attempt({ id: 'a3', lab_group_id: 'g1', scenario: { id: 'T9', title: '', case_code: null } }),
  ];
  assert.equal(roundsRunSoFar(attempts, slots), 2);
});
