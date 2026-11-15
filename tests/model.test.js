// Run with: npm test   (Node 20+, no dependencies)
// Uses made-up numbers only. Never put real personal numbers in tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAW, wealthTax, simulate, lasts, maxSpend, needInvest, earliestAge, investable, netWorth } from '../js/model.js';
import { sanitize, defaultState, planInputs } from '../js/store.js';

const base = { age: 40, portfolio: 500_000, basis: 400_000, mortgagePayment: 10_000, mortgageYearsLeft: 10, pension: 0, horizon: 95, otherWealth: 0, crash: 0 };
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test('gains tax is 22% x 1.72', () => near(LAW.gainsTax, 0.3784, 1e-9));

test('wealth tax is zero under the allowance and 1% of 80% above it', () => {
  assert.equal(wealthTax(1_000_000), 0);
  near(wealthTax(10_000_000), 0.01 * (8_000_000 - 1_900_000), 1e-6);
  near(wealthTax(1_000_000, 2_000_000), 0.01 * (800_000 + 2_000_000 - 1_900_000), 1e-6);
});

test('one working year: growth plus contributions', () => {
  const p = { ...base, mortgageYearsLeft: 0, mortgagePayment: 0 };
  const { path } = simulate(p, 0.04, 65, 0, 5_000);
  near(path[1].balance, 500_000 * 1.04 + 60_000, 1e-6);
});

test('freed mortgage payment is invested after payoff while working', () => {
  const p = { ...base, portfolio: 0, basis: 0, mortgageYearsLeft: 1 };
  const { path } = simulate(p, 0, 65, 0, 1_000);
  near(path[1].balance, 12_000, 1e-6);           // year 0: mortgage still running
  near(path[2].balance, 12_000 + 12 * 11_000, 1e-6); // year 1: payment invested too
});

test('deposits come out tax-free, gains are taxed at 37.84%', () => {
  const p = { ...base, age: 60, portfolio: 1_000_000, basis: 1_000_000, mortgagePayment: 0, mortgageYearsLeft: 0, horizon: 62 };
  near(simulate(p, 0, 60, 10_000, 0).path[1].balance, 880_000, 1e-6);       // all deposits: no tax
  const q = { ...p, basis: 0 };
  near(simulate(q, 0, 60, 10_000, 0).path[1].balance, 1_000_000 - 120_000 / (1 - LAW.gainsTax), 1e-6);
});

test('pension reduces what is taken from the portfolio from 67', () => {
  const p = { ...base, age: 67, portfolio: 1_000_000, basis: 1_000_000, mortgagePayment: 0, mortgageYearsLeft: 0, pension: 120_000, horizon: 69 };
  near(simulate(p, 0, 67, 10_000, 0).path[1].balance, 1_000_000, 1e-6);
});

test('the money runs out when spending is too high, and the age is reported', () => {
  const p = { ...base, age: 60, portfolio: 1_200_000, basis: 1_200_000, mortgagePayment: 0, mortgageYearsLeft: 0 };
  const res = simulate(p, 0, 60, 10_000, 0);
  assert.equal(res.runsOut, 70);
  assert.equal(res.path.at(-1).balance, 0);
});

test('maxSpend is the edge between lasting and not lasting', () => {
  const s = maxSpend(base, 0.04, 62, 8_000);
  assert.ok(s > 0);
  assert.ok(lasts(base, 0.04, 62, s - 50, 8_000));
  assert.ok(!lasts(base, 0.04, 62, s + 50, 8_000));
});

test('more investing, later stop and better markets all help', () => {
  assert.ok(maxSpend(base, 0.04, 62, 12_000) > maxSpend(base, 0.04, 62, 8_000));
  assert.ok(maxSpend(base, 0.04, 65, 8_000) > maxSpend(base, 0.04, 62, 8_000));
  assert.ok(maxSpend(base, 0.06, 62, 8_000) > maxSpend(base, 0.015, 62, 8_000));
});

test('a crash in the stop year lowers what you can spend', () => {
  assert.ok(maxSpend({ ...base, crash: 30 }, 0.04, 62, 8_000) < maxSpend(base, 0.04, 62, 8_000));
});

test('needInvest and earliestAge agree with maxSpend', () => {
  const need = needInvest(base, 0.04, 62, 25_000);
  assert.ok(need > 0);
  assert.ok(maxSpend(base, 0.04, 62, need + 50) >= 25_000);
  const age = earliestAge(base, 0.04, 25_000, 8_000);
  assert.ok(lasts(base, 0.04, age, 25_000, 8_000));
  assert.ok(!lasts(base, 0.04, age - 1, 25_000, 8_000));
  assert.equal(needInvest({ ...base, age: 60 }, 0.015, 61, 300_000), null);
});

test('net worth adds assets and subtracts debt', () => {
  const s = { ask: 100, funds: 50, ips: 10, other: 40, cash: 30, home: 1000, car: 20, debt: 600 };
  assert.equal(investable(s), 200);
  assert.equal(netWorth(s), 650);
});

test('sanitize repairs bad data and keeps good data', () => {
  assert.deepEqual(Object.keys(sanitize(null)), Object.keys(defaultState()));
  const s = sanitize({ profile: { takehome: 'x', pension: 1234 }, plans: [{ name: '  A  ', scen: 9, invest: 7000 }], activePlan: 'nope',
    networth: [{ date: '2030-02-01', ask: 5 }, { date: 'bad' }, { date: '2030-01-01', debt: 3 }], extra: 1 });
  assert.equal(s.profile.takehome, defaultState().profile.takehome);
  assert.equal(s.profile.pension, 1234);
  assert.equal(s.plans[0].name, 'A');
  assert.equal(s.plans[0].scen, 2);
  assert.equal(s.activePlan, s.plans[0].id);
  assert.deepEqual(s.networth.map((r) => r.date), ['2030-01-01', '2030-02-01']);
  assert.equal(s.extra, undefined);
});

test('planInputs uses the latest net worth entry and derives age and mortgage years', () => {
  const s = defaultState();
  s.profile.birthYear = 1990; s.profile.mortgageEndYear = 2040; s.profile.basis = 900;
  s.networth = [{ date: '2030-01-01', ask: 300, funds: 200, ips: 0, other: 0, cash: 99, home: 0, car: 0, debt: 0 }];
  const p = planInputs(s, s.plans[0], 2030);
  assert.equal(p.age, 40);
  assert.equal(p.mortgageYearsLeft, 10);
  assert.equal(p.portfolio, 500);
  assert.equal(p.basis, 500);   // deposits can never exceed the portfolio
});
