import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withAssistant, sameStationPerson, whoIsWhere, placementLine } from '../lib/nremt-hub-stations.ts';
import { cellMenuFor, type RtdInput } from '../lib/nremt-run-the-day.ts';

test('name line: proctor + assistant, proctor alone unchanged, assistant alone', () => {
  assert.equal(withAssistant('Casey Townsley', 'Gavin Grogg'), 'Casey Townsley + Gavin Grogg (assisting)');
  assert.equal(withAssistant('Casey Townsley', null), 'Casey Townsley');
  assert.equal(withAssistant('Casey Townsley', '  '), 'Casey Townsley');
  assert.equal(withAssistant(null, 'Gavin Grogg'), 'Gavin Grogg (assisting)');
  assert.equal(withAssistant(null, null), null);
});

test('same person cannot be both: case-insensitive email match', () => {
  assert.equal(sameStationPerson('A@pmi.edu', 'a@PMI.edu'), true);
  assert.equal(sameStationPerson('a@pmi.edu', 'b@pmi.edu'), false);
  assert.equal(sameStationPerson('', ''), false);
  assert.equal(sameStationPerson(null, 'a@pmi.edu'), false);
});

const tiles = [
  { station_number: 2, title: 'Spinal 2', instructor_email: 'sofia@pmi.edu', instructor_name: 'Sofia', assistant_email: null, assistant_name: null },
  { station_number: 1, title: 'Supine Spinal Immobilization', instructor_email: 'casey@pmi.edu', instructor_name: 'Casey', assistant_email: 'gavin@pmi.edu', assistant_name: 'Gavin' },
  { station_number: 3, title: 'Bleeding', instructor_email: null, instructor_name: null, assistant_email: 'GAVIN@pmi.edu', assistant_name: 'Gavin' },
];
const today = [
  { name: 'Casey Townsley', email: 'Casey@pmi.edu' },
  { name: 'Gavin Grogg', email: 'gavin@pmi.edu' },
  { name: 'Sofia Gonzalez', email: 'sofia@pmi.edu' },
  { name: 'Nobody Here', email: 'nobody@pmi.edu' },
];

test('who is where: proctor, assisting, two stations, not placed', () => {
  const w = whoIsWhere(today, tiles);
  assert.deepEqual(w[0].places, ['Supine Spinal Immobilization']);
  assert.deepEqual(w[1].places, ['Supine Spinal Immobilization (assisting)', 'Bleeding (assisting)']);
  assert.deepEqual(w[2].places, ['Spinal 2']);
  assert.deepEqual(w[3].places, []);
  assert.equal(placementLine(w[3].name, w[3].places), 'Nobody Here - not placed yet');
  assert.equal(placementLine('Gavin Grogg', w[1].places), 'Gavin Grogg - Supine Spinal Immobilization (assisting); Bleeding (assisting)');
});

test('Run the day cell menu shows both names; the retake check still uses the proctor alone', () => {
  const input = {
    students: [{ id: 's1', first_name: 'A', last_name: 'B' }],
    stations: [{ id: 'st1', station_number: 1, skill_name: 'Spinal', skillSheetId: 'sheet1', proctorName: 'Casey Townsley', assistantName: 'Gavin Grogg', room: 'Lab A' }],
    cells: {},
    skillColumns: [{ skillName: 'Spinal', skillSheetId: 'sheet1', stationIds: ['st1'], nremtCode: null }],
    skillCells: {},
  } as unknown as RtdInput;
  const menu = cellMenuFor(input.students[0], 'Spinal', input, Date.now());
  const json = JSON.stringify(menu);
  assert.ok(json.includes('Casey Townsley + Gavin Grogg (assisting)'), json);
});
