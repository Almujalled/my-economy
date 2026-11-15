// Tests for the data checks and helpers in store.js. Made-up numbers only.
// Node has no localStorage or IndexedDB, so nothing is written anywhere: the store just keeps state in memory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import { when } from '../js/format.js';
import { sanitize, defaultState, planInputs, currentBasis, mortgageNow, wealthParts, SCHEMA } from '../js/store.js';

test('sanitize repairs bad data and keeps good data', () => {
  assert.deepEqual(Object.keys(sanitize(null)), Object.keys(defaultState()));
  assert.deepEqual(Object.keys(sanitize('nonsense')), Object.keys(defaultState()));
  const s = sanitize({ profile: { takehome: 'x', pension: 1234, basisDate: 'yesterday', couple: 1 }, plans: [{ name: '  A  ', scen: 9, invest: 7000, side: 4000, sideUntil: 'x' }], activePlan: 'nope',
    networth: [{ date: '2030-02-01', ask: 5, paidIn: 3 }, { date: 'bad' }, { date: '2030-01-01', debt: 3, paidIn: 'x' }], extra: 1 });
  assert.equal(s.schema, SCHEMA);
  assert.equal(s.profile.takehome, defaultState().profile.takehome);
  assert.equal(s.profile.pension, 1234);
  assert.equal(s.profile.basisDate, '');
  assert.equal(s.profile.couple, 1);
  assert.equal(s.plans[0].name, 'A');
  assert.equal(s.plans[0].scen, 2);
  assert.deepEqual([s.plans[0].side, s.plans[0].sideUntil], [4000, 62]);
  assert.equal(s.activePlan, s.plans[0].id);
  assert.deepEqual(s.networth.map((r) => [r.date, r.paidIn]), [['2030-01-01', null], ['2030-02-01', 3]]);
  assert.equal(s.extra, undefined);
});

test('data saved by the first version is brought up to date without losing anything', () => {
  // The shape the dashboard stored before transactions existed (schema 1).
  const old = { schema: 1,
    profile: { birthYear: 1985, takehome: 40000, livingNow: 25000, portfolio: 100000, basis: 80000, mortgagePayment: 9000, mortgageEndYear: 2045, pension: 200000, horizon: 95, otherWealth: 500000 },
    plans: [{ id: 'p1', name: 'Early', invest: 6000, retAge: 60, spend: 28000, scen: 1, crash: 30 }], activePlan: 'p1',
    networth: [{ date: '2026-01-01', ask: 90000, funds: 10000, ips: 0, other: 0, cash: 50000, home: 3000000, car: 100000, debt: 2000000, note: 'start' }] };
  const s = sanitize(old);
  assert.equal(s.schema, 2);
  for (const [k, v] of Object.entries(old.profile)) assert.equal(s.profile[k], v, k);
  assert.deepEqual(s.plans, [{ ...old.plans[0], side: 0, sideUntil: 62 }]);
  assert.deepEqual(s.networth, [{ ...old.networth[0], paidIn: null }]);
  assert.deepEqual([s.profile.mortgageBalance, s.profile.mortgageRate, s.profile.mortgageAsOf, s.profile.basisDate, s.profile.couple], [0, 0, '', '', 0]);
  assert.deepEqual([s.profile.pensionPot, s.profile.pensionPotYear, s.profile.grossPay, s.profile.norwayYears, s.profile.workPot, s.profile.workRate], [0, 0, 0, 40, 0, 2]);
  assert.deepEqual([s.accounts, s.imports, s.rules, s.layouts, s.transactions, s.done], [[], [], [], [], [], {}]);
  assert.deepEqual(s.meta, { exported: '', saved: '' });
  assert.deepEqual(sanitize(s), s, 'a second pass changes nothing');
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
    done: { buffer: '2026-01-01', 'Bad Key': '2026-01-01', debt: 'soon' }, meta: { exported: '2026-03-03', saved: '2026-03-03T10:00:00.000Z', other: 1 },
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
  assert.deepEqual(s.done, { buffer: '2026-01-01' });
  assert.deepEqual(s.meta, { exported: '2026-03-03', saved: '2026-03-03T10:00:00.000Z' });
  assert.equal(sanitize({ meta: { saved: 'not a time' } }).meta.saved, '');
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(s))), s);
});

test('planInputs uses the latest net worth entry and derives age and mortgage years', () => {
  const s = defaultState();
  s.profile.birthYear = 1990; s.profile.mortgageEndYear = 2040; s.profile.basis = 900;
  s.networth = [{ date: '2030-01-01', ask: 300, funds: 200, ips: 0, other: 0, cash: 99, home: 1000, car: 1, debt: 400, paidIn: null }];
  const p = planInputs(s, s.plans[0], 2030);
  assert.equal(p.age, 40);
  assert.equal(p.mortgageYearsLeft, 10);
  assert.equal(p.portfolio, 500);
  assert.equal(p.basis, 500);   // deposits can never exceed the portfolio
  assert.deepEqual(p.wealth, { home: 1000, cash: 100, debt: 400 });
  assert.equal(p.people, 1);
  s.profile.couple = 1; s.plans[0].side = 5000; s.plans[0].sideUntil = 60;
  const q = planInputs(s, s.plans[0], 2030);
  assert.deepEqual([q.people, q.sideIncome, q.sideUntil, q.slow], [2, 5000, 60, undefined]);
  // Pension: a typed figure until a pension pot from NAV is given; then the state pension is worked out.
  assert.deepEqual([q.pension, q.state, q.work, q.pensionAge], [0, undefined, undefined, (67 * 12 + 27) / 12]);
  Object.assign(s.profile, { pensionPot: 2_000_000, pensionPotYear: 2029, grossPay: 700_000, workPot: 300_000, workRate: 5 });
  const h = planInputs(s, s.plans[0], 2030);
  assert.deepEqual(h.state, { birthYear: 1990, pot: 2_000_000, potYear: 2029, pay: 700_000, norwayYears: 40, partner: true });
  assert.deepEqual(h.work, { pot: 300_000, rate: 0.05, pay: 700_000 });
  s.profile.birthYear = 1950;                       // the helper is for those born 1963 or later
  assert.equal(planInputs(s, s.plans[0], 2030).state, undefined);
  s.networth = [];
  assert.equal(planInputs(s, s.plans[0], 2030).wealth, null);
  assert.equal(wealthParts(s), null);
});

test('what you paid in grows with later net worth entries, from the day you typed it', () => {
  const s = defaultState();
  s.profile.basis = 100_000; s.profile.basisDate = '2026-03-01';
  const row = (date, paidIn) => ({ date, ask: 500_000, funds: 0, ips: 0, other: 0, cash: 0, home: 0, car: 0, debt: 0, paidIn });
  s.networth = [row('2026-02-01', 9_000), row('2026-03-01', 8_000), row('2026-04-01', 5_000), row('2026-05-01', null), row('2026-06-01', -2_000)];
  assert.equal(currentBasis(s), 103_000);     // only entries after 1 March count: +5 000 and -2 000
  s.profile.basisDate = '';
  assert.equal(currentBasis(s), 120_000);     // never typed a date: every entry that says what was paid in counts
  s.profile.basis = 0; s.networth = [row('2026-04-01', -50)];
  assert.equal(currentBasis(s), 0);
});

test('the mortgage is worked out from balance and rate when given, else from the year you typed', () => {
  const s = defaultState();
  Object.assign(s.profile, { mortgagePayment: 10_000, mortgageEndYear: 2040 });
  assert.deepEqual(mortgageNow(s, '2030-06-15'), { yearsLeft: 10, balance: 0, rate: 0, never: false });
  assert.equal(mortgageNow(s, '2050-01-01').yearsLeft, 0);
  Object.assign(s.profile, { mortgageBalance: 1_200_000, mortgageRate: 0, mortgageAsOf: '2030-01-10' });
  assert.deepEqual(mortgageNow(s, '2030-01-20'), { yearsLeft: 10, balance: 1_200_000, rate: 0, never: false });
  // A year later the balance has been rolled forward by twelve payments.
  assert.deepEqual(mortgageNow(s, '2031-01-20'), { yearsLeft: 9, balance: 1_080_000, rate: 0, never: false });
  s.profile.mortgageRate = 12;                  // 12 000 kr of interest a month: the payment never gets there
  const m = mortgageNow(s, '2030-01-20');
  assert.equal(m.never, true);
  assert.ok(m.yearsLeft > 100);
  s.profile.mortgagePayment = 0;                // no payment: fall back to the typed year
  assert.equal(mortgageNow(s, '2030-01-20').balance, 0);
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
