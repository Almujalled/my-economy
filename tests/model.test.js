// Tests for the money maths. All numbers are invented round figures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROWTH, LAST_AGE, GAINS_TAX, investable, netWorth, grown, change, pensionAge, runsOut, stopAge } from '../js/model.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

// ---------- net worth ----------
const entry = (o = {}) => ({ date: '2026-01-01', ask: 0, funds: 0, ips: 0, other: 0, cash: 0, home: 0, car: 0, debt: 0, putIn: null, ...o });

test('net worth adds what you own and subtracts what you owe; investments are the four investing parts', () => {
  const e = entry({ ask: 300_000, funds: 50_000, ips: 20_000, other: 30_000, cash: 100_000, home: 4_000_000, car: 150_000, debt: 2_500_000 });
  assert.equal(investable(e), 400_000);
  assert.equal(netWorth(e), 400_000 + 100_000 + 4_000_000 + 150_000 - 2_500_000);
  assert.equal(grown(e), null);
  assert.equal(grown({ ...e, putIn: 350_000 }), 50_000);
});

test('the change between two entries splits into what you put in and what the market did', () => {
  const a = entry({ ask: 400_000, putIn: 350_000, home: 1_000_000 }), b = entry({ date: '2026-02-01', ask: 420_000, putIn: 360_000, home: 1_000_000 });
  assert.deepEqual(change(a, b), { total: 20_000, putIn: 10_000, market: 10_000, netWorth: 20_000 });
  assert.deepEqual(change({ ...a, putIn: null }, b), { total: 20_000, putIn: null, market: null, netWorth: 20_000 });
});

// ---------- when can I stop working ----------
const person = (o = {}) => ({ age: 40, worth: 1_000_000, putIn: 1_000_000, invest: 10_000, spend: 25_000, mortgage: 0, mortgageEndAge: 0,
  pension: 20_000, pensionAge: 67, ...o });

test('the constants are the careful ones the page describes', () => {
  assert.equal(GROWTH, 0.025);
  assert.equal(LAST_AGE, 95);
  near(GAINS_TAX, 0.3784, 1e-12);
});

test('the pension age is 67, plus a month per birth year after 1963', () => {
  assert.equal(pensionAge(1960), 67);
  assert.equal(pensionAge(1963), 67);
  near(pensionAge(1975), 68);
  near(pensionAge(1985), 67 + 22 / 12);
});

test('a working year grows the money and adds a year of investing', () => {
  const p = person({ age: 94 });
  // One year left before LAST_AGE, still working: the money cannot run out.
  assert.equal(runsOut(p, 95), null);
  // Stopping at once with no money and no pension runs out in the first year.
  assert.equal(runsOut(person({ worth: 0, putIn: 0, pension: 0 }), 40), 40);
});

test('what you put in comes out tax-free first; growth is taxed after that', () => {
  // 30 years of 100 000 a year from exactly 3 000 000, no growth: all your own money, it lasts exactly.
  const own = person({ age: 65, worth: 3_000_000, putIn: 3_000_000, spend: 100_000 / 12, pension: 0, invest: 0 });
  assert.equal(runsOut(own, 65, 0), null);
  // The same sum, but nothing of it put in by you (all growth): every krone out is taxed, so it runs out early.
  const gains = { ...own, putIn: 0 };
  const age = runsOut(gains, 65, 0);
  assert.ok(age !== null && age < 95);
  assert.equal(age, 65 + Math.floor(3_000_000 / (100_000 / (1 - GAINS_TAX))));
});

test('the pension starts part-way through the year when the pension age has months', () => {
  // Spending equals the pension, so from the pension age nothing more is taken out.
  const p = person({ age: 60, worth: 0, putIn: 0, spend: 20_000, pension: 20_000, pensionAge: 60.5, invest: 0 });
  assert.equal(runsOut(p, 60), 60);                       // half a year without pension and no money: runs out
  assert.equal(runsOut({ ...p, worth: 120_000, putIn: 120_000 }, 60, 0), null);  // exactly half a year of spending
});

test('the mortgage is paid until its end, and once paid off while working it is invested instead', () => {
  const base = person({ age: 50, worth: 2_000_000, putIn: 2_000_000, mortgage: 10_000, mortgageEndAge: 55, invest: 0 });
  const forever = { ...base, mortgageEndAge: Infinity };
  assert.ok(stopAge(base) <= stopAge(forever), 'a mortgage that ends makes it easier');
  // Working to 60 with the mortgage gone at 55: five years of the freed payment are invested.
  const end = (p) => { let w = p.worth; for (let a = p.age; a < 60; a++) w = w * 1.03 + 12 * (p.invest + (a < p.mortgageEndAge ? 0 : p.mortgage)); return w; };
  assert.ok(end(base) > end(forever));
});

test('the age you can stop moves the right way with each number', () => {
  const p = person(), age = stopAge(p);
  assert.ok(age !== null && age > p.age && age < 75, `stop age ${age}`);
  assert.ok(stopAge({ ...p, invest: p.invest + 5_000 }) <= age, 'investing more helps');
  assert.ok(stopAge({ ...p, spend: p.spend + 5_000 }) >= age, 'spending more hurts');
  assert.ok(stopAge({ ...p, pension: 0 }) >= age, 'no pension hurts');
  assert.ok(stopAge({ ...p, worth: 3_000_000, putIn: 3_000_000 }) <= age, 'more money now helps');
  assert.ok(stopAge(p, 0.01) >= age && stopAge(p, 0.05) <= age, 'growth matters');
  // The answer is the first age that lasts: one year earlier does not.
  assert.equal(runsOut(p, age), null);
  if (age > p.age) assert.notEqual(runsOut(p, age - 1), null);
});

test('no answer before 75 when the numbers cannot work, and "now" when they already do', () => {
  assert.equal(stopAge(person({ worth: 0, putIn: 0, invest: 0, pension: 0 })), null);
  assert.equal(stopAge(person({ worth: 20_000_000, putIn: 20_000_000 })), 40);
});
