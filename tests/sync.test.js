// Tests for the decision behind keeping a file and a browser in step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncStep, NO_STAMP } from '../js/sync.js';

const T1 = '2026-11-01T10:00:00.000Z', T2 = '2026-11-02T10:00:00.000Z', T3 = '2026-11-03T10:00:00.000Z';

test('nothing to do when the browser and the file hold the same numbers', () => {
  assert.equal(syncStep(T1, T1, T1), 'same');
  assert.equal(syncStep(T1, T1, ''), 'same');            // the same numbers, met for the first time
  assert.equal(syncStep('', null, ''), 'same');          // an empty browser and an empty file
});

test('only the browser changed: save to the file', () => {
  assert.equal(syncStep(T2, T1, T1), 'write');
  assert.equal(syncStep(T1, null, ''), 'write');         // a new, empty file
  assert.equal(syncStep(T1, null, T1), 'write');         // the file was emptied: put the numbers back
});

test('only the file changed: take its numbers', () => {
  assert.equal(syncStep(T1, T2, T1), 'load');
  assert.equal(syncStep('', T1, ''), 'load');            // a second computer, nothing typed there yet
  assert.equal(syncStep('', NO_STAMP, ''), 'load');      // an old backup file without a stamp still has numbers in it
});

test('an empty browser never overwrites a file', () => {
  for (const synced of ['', T1, T2]) for (const file of [T1, T2, NO_STAMP]) assert.equal(syncStep('', file, synced), 'load');
});

test('both changed since they were last the same: ask', () => {
  assert.equal(syncStep(T2, T3, T1), 'conflict');
  assert.equal(syncStep(T3, T2, T1), 'conflict');
  assert.equal(syncStep(T1, T2, ''), 'conflict');        // two sets of numbers that have never met
  assert.equal(syncStep(T1, NO_STAMP, ''), 'conflict');
});

test('a file that went back in time is not taken without asking', () => {
  assert.equal(syncStep(T2, T1, T2), 'conflict');        // the browser has not changed, but the file is now older
});

test('every combination gives one of the four answers, and "write" never happens from an empty browser', () => {
  const stamps = ['', NO_STAMP, T1, T2, T3];
  for (const local of stamps) for (const file of [null, ...stamps]) for (const synced of stamps) {
    const step = syncStep(local, file, synced);
    assert.ok(['same', 'write', 'load', 'conflict'].includes(step));
    if (local === '') assert.notEqual(step, 'write');
    if (step === 'load') assert.notEqual(file, null);
  }
});
