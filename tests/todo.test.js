// Tests for the "Do next" list on the Overview page. Made-up data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todo } from '../js/todo.js';
import { defaultState } from '../js/store.js';
import { sortAll } from '../js/ledger.js';

const L = (s) => ({ sorted: sortAll(s.transactions, s.accounts, s.rules) });
const links = (s, day, fileOn = false) => todo(s, L(s), day, fileOn).map((x) => x.link + ' ' + x.text);
const tx = (id, date, text, amount) => ({ id, date, text, amount, acct: 'a1', imp: 'i1' });

test('a new user is asked for a bank file, values and a birth year, in that order', () => {
  assert.deepEqual(links(defaultState(), '2026-06-15'), [
    '#/spending Add a file from the account your pay comes into',
    '#/networth Type what you own and owe',
    '#/networth Give the year you were born, to see when you can stop working',
  ]);
});

test('once everything is in, only what is out of date is asked for', () => {
  const s = defaultState();
  s.accounts = [{ id: 'a1', name: 'Bank account', kind: 'bank', tail: '', sig: 'bank:' }];
  s.transactions = [tx('t1', '2026-05-02', 'Kiwi', -300), tx('t2', '2026-05-30', 'Lønn', 40_000)];
  s.networth = [{ date: '2026-06-01', ask: 1, funds: 0, ips: 0, other: 0, cash: 0, home: 0, car: 0, debt: 0, putIn: null, note: '' }];
  Object.assign(s.profile, { birthYear: 1985, pension: 20_000 });
  s.meta.exported = '2026-06-01';
  assert.deepEqual(links(s, '2026-06-15'), []);
  // A month later: last month's file and this month's values are missing, and the copy is old.
  assert.deepEqual(links(s, '2026-07-20'), [
    "#/spending Add June's file from your bank",
    '#/networth Type this month\'s values',
    '#/data Keep your numbers in a file, so they are not only in this browser',
  ]);
  // Kept in a file: no need to ask for a copy.
  assert.ok(!links(s, '2026-07-20', true).some((x) => x.startsWith('#/data')));
});

test('unsorted places and a missing pension are pointed out', () => {
  const s = defaultState();
  s.accounts = [{ id: 'a1', name: 'Bank account', kind: 'bank', tail: '', sig: 'bank:' }];
  s.transactions = [tx('t1', '2026-06-02', 'Helt ukjent sted', -300), tx('t2', '2026-06-03', 'Annet ukjent sted', -100), tx('t3', '2026-06-04', 'Helt ukjent sted', -50)];
  s.profile.birthYear = 1985;
  const got = links(s, '2026-06-15');
  assert.ok(got.includes('#/spending Sort 2 places the dashboard did not recognise'), got.join('\n'));
  assert.ok(got.includes('#/networth Add your pension from NAV, or the age you can stop is too gloomy'), got.join('\n'));
});
