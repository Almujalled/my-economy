// Tests for the "what to do next" logic. Made-up numbers only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKLIST, CALENDAR, nextSteps, checklist } from '../js/guide.js';
import { defaultState } from '../js/store.js';
import { sortAll, monthly, wholeMonths, usualMonth } from '../js/ledger.js';
import { LAW_YEARS } from '../js/law.js';

const ledgerOf = (s, day) => { const sorted = sortAll(s.transactions, s.accounts, s.rules); const months = monthly(s.transactions, sorted); const whole = wholeMonths(months, s.transactions, day); return { sorted, months, whole, usual: usualMonth(whole) }; };
const ids = (s, day) => nextSteps(s, ledgerOf(s, day), day, 99).map((x) => x.id);
const entry = (date, extra = {}) => ({ date, ask: 0, funds: 0, ips: 0, other: 0, cash: 0, home: 0, car: 0, debt: 0, paidIn: null, note: '', ...extra });
const DAY = `${LAW_YEARS.at(-2)}-06-15`;          // a day in a year whose rules are adopted, so the rules step stays quiet
const tx = (id, date, text, amount) => ({ id, date, text, amount, acct: 'a1', imp: 'i1' });

test('the checklist and the calendar are complete', () => {
  assert.equal(new Set(CHECKLIST.map((c) => c.id)).size, CHECKLIST.length);
  for (const c of CHECKLIST) { assert.match(c.id, /^[a-z0-9-]{1,40}$/); assert.ok(c.title.length > 10 && c.why.length > 20, c.id); }
  for (let m = 1; m <= 12; m++) assert.ok(CALENDAR[m].happens && CALENDAR[m].todo, `month ${m}`);
});

test('a new user is pointed to the three things that make the dashboard useful', () => {
  assert.deepEqual(ids(defaultState(), DAY), ['networth', 'files', 'pension']);
});

test('stale numbers, unsorted lines, a plan that is off and an old backup are each called out', () => {
  const s = defaultState();
  s.accounts = [{ id: 'a1', name: 'Bank account', kind: 'bank', tail: '', sig: 'bank:' }];
  s.networth = [entry(`${DAY.slice(0, 4)}-04-01`, { cash: 80_000, ask: 500_000 })];
  s.profile.pension = 200_000;
  s.profile.livingNow = 30_000;
  s.transactions = [];
  for (const m of ['01', '02', '03']) { s.transactions.push(tx('k' + m, `${DAY.slice(0, 4)}-${m}-02`, 'Kiwi', -20_000), tx('u' + m, `${DAY.slice(0, 4)}-${m}-28`, 'Ukjent Sted', -500)); }
  s.transactions.push(tx('x', `${DAY.slice(0, 4)}-04-01`, 'Kiwi', -100));
  const steps = nextSteps(s, ledgerOf(s, DAY), DAY, 99);
  assert.deepEqual(steps.map((x) => x.id), ['networth', 'files', 'sort', 'living', 'backup']);
  assert.match(steps[0].text, /75 days old/);
  assert.match(steps[2].text, /Sort 3 transactions worth 1\s500 kr/);
  assert.match(steps[3].text, /20\s500 kr a month; your plan uses 30\s000 kr/);
  assert.equal(steps[2].link, '#/spending');
  assert.equal(nextSteps(s, ledgerOf(s, DAY), DAY).length, 5);
  assert.equal(nextSteps(s, ledgerOf(s, DAY), DAY, 2).length, 2);

  // Everything in order: nothing to do.
  s.networth = [entry(DAY, { cash: 80_000 })];
  s.transactions = s.transactions.filter((t) => t.text === 'Kiwi').concat(tx('new', DAY, 'Kiwi', -100));
  s.profile.livingNow = 12_000;      // five whole months now: three at 20 000, April at 100 and an empty May
  s.meta.exported = DAY;
  assert.deepEqual(ids(s, DAY), []);
});

test('a year past the newest rules asks for the yearly update', () => {
  const s = defaultState();
  const late = `${LAW_YEARS.at(-1) + 1}-02-01`;
  assert.ok(ids(s, late).includes('rules'));
});

test('checklist steps are done when you tick them, and shown when your numbers say so', () => {
  const s = defaultState();
  s.done = { card: '2026-01-01' };
  let list = checklist(s);
  assert.deepEqual(list.filter((c) => c.done).map((c) => c.id), ['card']);
  assert.deepEqual(list.filter((c) => c.shown).map((c) => c.id), []);
  s.profile.takehome = 40_000;
  s.networth = [entry('2026-01-01', { cash: 45_000, ask: 10_000 })];
  s.transactions = [tx('t', '2026-01-02', 'Kiwi', -1)];
  list = checklist(s);
  assert.deepEqual(list.filter((c) => c.shown).map((c) => c.id), ['overview', 'buffer', 'invest']);
});
