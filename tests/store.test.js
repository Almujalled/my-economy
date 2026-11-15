// Tests for the data checks and helpers in store.js. Made-up numbers only.
// Node has no localStorage or IndexedDB, so nothing is written anywhere: the store just keeps state in memory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import { when } from '../js/format.js';
import { sanitize, defaultState, roughInputs, SCHEMA } from '../js/store.js';

const entry = (date, o = {}) => ({ date, ask: 0, funds: 0, ips: 0, other: 0, cash: 0, home: 0, car: 0, debt: 0, putIn: null, note: '', ...o });

test('sanitize repairs bad data and keeps good data', () => {
  assert.deepEqual(Object.keys(sanitize(null)), Object.keys(defaultState()));
  assert.deepEqual(Object.keys(sanitize('nonsense')), Object.keys(defaultState()));
  const s = sanitize({ schema: 3, profile: { birthYear: 1985.5, pension: 21_000, mortgageEndYear: 'soon', spend: -5, invest: 'x', mortgage: 9_000 },
    networth: [{ date: '2030-02-01', ask: 5, putIn: 3 }, { date: 'bad' }, { date: '2030-01-01', debt: 3, putIn: 'x' }, { date: '2030-02-01', ask: 7, putIn: 4 }], extra: 1 });
  assert.equal(s.schema, SCHEMA);
  assert.deepEqual(s.profile, { birthYear: 0, pension: 21_000, mortgageEndYear: 0, spend: 0, invest: 5_000, mortgage: 9_000 });
  assert.deepEqual(s.networth, [entry('2030-01-01', { debt: 3 }), entry('2030-02-01', { ask: 7, putIn: 4 })]);  // the same date twice: the last one counts
  assert.equal(s.extra, undefined);
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(s))), s, 'a second pass changes nothing');
});

test('data saved by the first version comes across with every number kept', () => {
  // The shape the dashboard stored before transactions existed (schema 1).
  const old = { schema: 1,
    profile: { birthYear: 1985, takehome: 40000, livingNow: 25000, portfolio: 100000, basis: 80000, mortgagePayment: 9000, mortgageEndYear: 2045, pension: 240000, horizon: 95, otherWealth: 500000 },
    plans: [{ id: 'p0', invest: 1000 }, { id: 'p1', name: 'Early', invest: 6000, retAge: 60, spend: 28000, scen: 1, crash: 30 }], activePlan: 'p1',
    networth: [{ date: '2026-01-01', ask: 90000, funds: 10000, ips: 0, other: 0, cash: 50000, home: 3000000, car: 100000, debt: 2000000, note: 'start' }] };
  const s = sanitize(old);
  assert.equal(s.schema, 3);
  // The pension was typed as a year's amount; now it is a month's. Living costs, investing and the mortgage keep their names' meaning.
  assert.deepEqual(s.profile, { birthYear: 1985, pension: 20000, mortgageEndYear: 2045, spend: 25000, invest: 6000, mortgage: 9000 });
  // What you had paid in, typed once on the plan page, becomes what the entry says you have put in.
  assert.deepEqual(s.networth, [entry('2026-01-01', { ask: 90000, funds: 10000, cash: 50000, home: 3000000, car: 100000, debt: 2000000, putIn: 80000, note: 'start' })]);
  assert.deepEqual([s.accounts, s.imports, s.rules, s.layouts, s.transactions], [[], [], [], [], []]);
  assert.deepEqual(s.meta, { exported: '', saved: '' });
  assert.deepEqual(['plans', 'activePlan', 'done'].filter((k) => k in s), []);
  assert.deepEqual(sanitize(s), s, 'a second pass changes nothing');
  // With no mortgage payment, the year the old planner stored by default means nothing and is dropped.
  assert.equal(sanitize({ ...old, profile: { ...old.profile, mortgagePayment: 0 } }).profile.mortgageEndYear, 0);
});

test('entries that said what was paid in since the last one become totals, from the day the total was typed', () => {
  const v2 = { schema: 2, profile: { basis: 100_000, basisDate: '2026-03-01' },
    networth: [entry('2026-02-01', { ask: 1, paidIn: 9_000 }), entry('2026-03-01', { ask: 1, paidIn: 8_000 }), entry('2026-04-01', { ask: 1, paidIn: 5_000 }),
      entry('2026-05-01', { ask: 1, paidIn: null }), entry('2026-06-01', { ask: 1, paidIn: -2_000 })].map(({ putIn, ...e }) => e) };
  assert.deepEqual(sanitize(v2).networth.map((e) => e.putIn), [100_000, 100_000, 105_000, 105_000, 103_000]);
  // Never typed a total: entries before the first one that says anything stay unknown.
  const none = { ...v2, profile: {}, networth: [{ ...v2.networth[0], paidIn: null }, { ...v2.networth[1] }, { ...v2.networth[2] }] };
  assert.deepEqual(sanitize(none).networth.map((e) => e.putIn), [null, 8_000, 13_000]);
});

test('investments the old planner held without any net worth entry become an entry', () => {
  const s = sanitize({ schema: 2, profile: { portfolio: 250_000, basis: 200_000, basisDate: '2026-05-01' } });
  assert.deepEqual(s.networth, [entry('2026-05-01', { ask: 250_000, putIn: 200_000 })]);
  assert.deepEqual(sanitize({ schema: 3, profile: { portfolio: 250_000 } }).networth, []);   // only old data is moved
});

test('the rough age is worked out from your files when they have a whole month, otherwise from what you typed', () => {
  const s = defaultState();
  const none = { usual: null };
  assert.equal(roughInputs(s, none, '2026-06-01'), null, 'nothing until the birth year is given');
  Object.assign(s.profile, { birthYear: 1986, pension: 22_000, spend: 28_000, invest: 6_000, mortgage: 10_000 });
  s.networth = [entry('2026-01-01', { ask: 500_000, ips: 50_000, putIn: 600_000 })];
  const typed = roughInputs(s, none, '2026-06-01');
  assert.deepEqual(typed, { age: 40, worth: 550_000, putIn: 550_000, spend: 28_000, invest: 6_000, mortgage: 10_000, mortgageEndAge: Infinity,
    pension: 22_000, pensionAge: 67 + 23 / 12, months: 0 });   // more put in than it is worth: counted as worth
  s.profile.mortgageEndYear = 2041;
  const files = roughInputs(s, { usual: { living: 31_000, investing: -500, mortgage: 12_000, months: 7 } }, '2026-06-01');
  assert.deepEqual([files.spend, files.invest, files.mortgage, files.mortgageEndAge, files.months], [31_000, 0, 12_000, 55, 7]);
  s.profile.mortgage = 0;
  assert.equal(roughInputs(s, none, '2026-06-01').mortgageEndAge, 55);
  s.profile.mortgageEndYear = 0;
  assert.equal(roughInputs(s, none, '2026-06-01').mortgageEndAge, 0, 'no mortgage');
});

test('values are saved by date, and an account can be told what it is', () => {
  store.replace(null);
  store.saveEntry(entry('2026-02-01', { ask: 2 }));
  store.saveEntry(entry('2026-01-01', { ask: 1 }));
  store.saveEntry(entry('2026-02-01', { ask: 3 }));
  assert.deepEqual(store.get().networth.map((e) => [e.date, e.ask]), [['2026-01-01', 1], ['2026-02-01', 3]]);
  assert.equal(store.latest().ask, 3);
  store.removeEntry('2026-02-01');
  assert.equal(store.latest().date, '2026-01-01');

  store.replace({ schema: 3, accounts: [{ id: 'a1', name: 'Bank account …1234', kind: 'bank', tail: '1234' }, { id: 'a2', name: 'My card', kind: 'card' }] });
  store.setAccount('a1', { kind: 'card' });
  store.setAccount('a2', { kind: 'bank' });
  assert.deepEqual(store.get().accounts.map((a) => [a.name, a.kind]), [['Credit card …1234', 'card'], ['My card', 'bank']]);
  store.setAccount('a2', { name: '  Everyday  ' });
  store.setAccount('a2', { name: '   ', kind: 'nonsense' });
  assert.deepEqual(store.get().accounts.map((a) => [a.name, a.kind]), [['Credit card …1234', 'card'], ['Everyday', 'bank']]);
  store.replace(null);
});

test('transactions, accounts and rules are checked line by line', () => {
  const s = sanitize({
    accounts: [{ id: 'a1', name: ' Main ', kind: 'bank', tail: '1234', sig: 'bank:1234' }, { id: 'a1', name: 'dup' }, { id: 'a2', kind: 'weird', tail: '12' }, null],
    imports: [{ id: 'i1', file: 'x.xlsx', acct: 'a1', date: '2026-02-01', from: '2026-01-01', to: '2026-01-31', count: 2 }, { id: 'i2', acct: 'gone' }],
    rules: [{ id: 'r1', match: ' KIWI ', cat: 'groceries' }, { id: 'r2', match: 'x', cat: 'not-a-category' }, { match: 'coop', cat: 'groceries' }, { id: 'r1', match: 'meny', cat: 'groceries' }],
    transactions: [
      { id: 't2', date: '2026-01-20', text: 'B', amount: -50, acct: 'a1', imp: 'i1', cat: 'groceries', once: 1, principal: 10, interest: 5, peer: '9999', type: 'T', mcat: 'M', memo: 'note', junk: 1 },
      { id: 't1', date: '2026-01-10', text: '', amount: 100, acct: 'unknown', cat: 'nope', peer: '12' },
      { id: 't1', date: '2026-01-11', text: 'same id', amount: 1, acct: 'a1' },
      { id: 't3', date: '2026-13-45x', text: 'bad date', amount: 1, acct: 'a1' },
      { id: 't4', date: '2026-01-12', text: 'no amount', amount: '5', acct: 'a1' },
      { id: 't5', date: '2026-01-12', text: 'zero', amount: 0, acct: 'a1' },
      'junk',
    ],
    layouts: [{ headerRow: -1, cols: { date: 0, text: 2, amount: 3, junk: 9 }, kind: 'bank', header: '' }, { headerRow: 1, cols: { date: 0, text: 1 }, kind: 'card' }, { cols: 'x' }, null,
      { headerRow: 500, cols: { date: 1, text: 0, in: 2, out: -3 }, kind: 'card', header: 'a|b' }],
    done: { buffer: '2026-01-01' }, meta: { exported: '2026-03-03', saved: '2026-03-03T10:00:00.000Z', other: 1 },
  });
  assert.deepEqual(s.layouts, [{ headerRow: -1, cols: { date: 0, text: 2, amount: 3 }, kind: 'bank', header: '' }, { headerRow: -1, cols: { date: 1, text: 0, in: 2 }, kind: 'card', header: 'a|b' }]);
  assert.deepEqual(s.accounts, [{ id: 'a1', name: 'Main', kind: 'bank', tail: '1234', sig: 'bank:1234' }, { id: 'a2', name: 'Account', kind: 'bank', tail: '', sig: '' }, { id: 'a0', name: 'Bank account', kind: 'bank', tail: '', sig: 'bank:' }]);
  assert.deepEqual(s.imports.map((i) => [i.id, i.acct]), [['i1', 'a1'], ['i2', '']]);
  assert.deepEqual(s.rules.map((r) => [r.match, r.cat]), [['kiwi', 'groceries'], ['coop', 'groceries'], ['meny', 'groceries']]);
  assert.equal(new Set(s.rules.map((r) => r.id)).size, 3);
  assert.deepEqual(s.transactions, [
    { id: 't1', date: '2026-01-10', text: '(no description)', amount: 100, acct: 'a0', imp: '' },
    { id: 't2', date: '2026-01-20', text: 'B', amount: -50, acct: 'a1', imp: 'i1', type: 'T', mcat: 'M', memo: 'note', principal: 10, interest: 5, peer: '9999', cat: 'groceries', once: true },
  ]);
  assert.equal(s.done, undefined);                 // checklist ticks belonged to the guide, which is gone
  assert.deepEqual(s.meta, { exported: '2026-03-03', saved: '2026-03-03T10:00:00.000Z' });
  assert.equal(sanitize({ meta: { saved: 'not a time' } }).meta.saved, '');
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(s))), s);
});

// ---------- transactions through the store ----------
const parsed = (txs, extra = {}) => ({ kind: 'bank', accountTail: '3333', txs, from: txs[0].date, to: txs.at(-1).date, ...extra });

test('importing, sorting, marking and removing transactions through the store', () => {
  store.replace(null);
  let calls = 0;
  const off = store.subscribe(() => calls++);
  const res = store.importParsed(parsed([
    { date: '2026-01-05', text: 'Ukjent Sted', amount: -200 }, { date: '2026-01-06', text: 'Ukjent Sted', amount: -300 },
    { date: '2026-01-15', text: 'Lønn', amount: 40_000 }, { date: '2026-02-03', text: 'Kiwi', amount: -500 },
  ]), 'jan.xlsx');
  assert.equal(res.added, 4);
  assert.ok(calls >= 1);
  const s = store.get();
  assert.equal(s.transactions.length, 4);
  assert.equal(s.imports.length, 1);

  // Sums are worked out once and reused until something changes.
  const first = store.ledger();
  assert.equal(store.ledger(), first);
  assert.deepEqual(first.months.map((m) => [m.month, m.income, m.spending, m.unsorted]), [['2026-01', 40_000, 500, 2], ['2026-02', 0, 500, 0]]);

  assert.equal(store.addRule('  Ukjent   sted ', 'eatingout'), true);
  assert.equal(store.addRule('x', 'eatingout'), false);
  assert.equal(store.addRule('ukjent', 'not-a-category'), false);
  const second = store.ledger();
  assert.notEqual(second, first);
  assert.equal(second.months[0].cats.eatingout, 500);
  assert.equal(second.months[0].unsorted, 0);
  assert.equal(store.addRule('ukjent sted', 'travel'), true);        // same text again replaces the rule
  assert.deepEqual(store.get().rules.map((r) => [r.match, r.cat]), [['ukjent sted', 'travel']]);

  const id = store.get().transactions[0].id;
  store.patchTransactions([id], { cat: 'health', once: true });
  assert.deepEqual([store.get().transactions[0].cat, store.get().transactions[0].once], ['health', true]);
  assert.equal(store.ledger().months[0].oneoff, 200);
  store.patchTransactions([id], { cat: null, once: false });
  assert.deepEqual(Object.keys(store.get().transactions[0]).sort(), ['acct', 'amount', 'date', 'id', 'imp', 'text']);
  store.patchTransactions([id], { cat: 'not-a-category' });
  assert.equal(store.get().transactions[0].cat, undefined);

  store.flipImport(res.imp.id);
  assert.equal(store.get().transactions[0].amount, 200);
  store.flipImport(res.imp.id);
  store.removeRule(store.get().rules[0].id);
  assert.equal(store.get().rules.length, 0);

  const json = JSON.parse(store.exportJson());
  assert.equal(json.transactions.length, 4);
  assert.match(json.meta.exported, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(sanitize(json), store.get(), 'an exported file imports back to the same state');

  store.removeImport(res.imp.id);
  assert.deepEqual([store.get().transactions.length, store.get().imports.length, store.get().accounts.length], [0, 0, 0]);
  off();
  store.replace(null);
});

test('a moment is put in words, and anything else is called unknown', () => {
  const d = new Date(2026, 9, 3, 14, 5);            // local time, as the page shows it
  assert.equal(when(d.toISOString()), '3 Oct 2026 at 14:05');
  for (const bad of ['', '0', 'yesterday', undefined, null]) assert.equal(when(bad), 'at an unknown time');
});
