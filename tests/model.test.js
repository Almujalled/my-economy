// Run with: npm test   (Node 20.12+, no dependencies)
// Uses made-up numbers only. Never put real personal numbers in tests.
// Rules are passed in explicitly (the 2026 table) so the expected numbers do not move when the calendar does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAW, LAWS, lawFor, SLOW, taxableWealth, wealthTaxOn, wealthTax, simulate, lasts, maxSpend, needInvest, earliestAge, pensionFor, verdict,
  monthsToRepay, balanceAfter, investable, netWorth, change, planPath } from '../js/model.js';
import { LAW_YEARS, lawIsOld } from '../js/law.js';
import { statePension, pensionTax } from '../js/pension.js';

const L = LAWS[2026];
const base = { age: 40, portfolio: 500_000, basis: 400_000, mortgagePayment: 10_000, mortgageYearsLeft: 10, pension: 0, horizon: 95, otherWealth: 0, crash: 0 };
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);
const sim = (p, r, retAge, spend, invest, detail) => simulate(p, r, retAge, spend, invest, L, detail);

// ---------- the rules ----------
test('every year in the rules table is complete and gains tax is 22% x 1.72', () => {
  const keys = Object.keys(L).sort();
  for (const y of LAW_YEARS) {
    assert.deepEqual(Object.keys(LAWS[y]).sort(), keys, `year ${y} has the same fields as 2026`);
    assert.equal(LAWS[y].year, y);
    near(LAWS[y].gainsTax, 0.3784, 1e-9);
    assert.ok(['adopted', 'proposed'].includes(LAWS[y].status));
    assert.equal(LAWS[y].steps.length, 5);
  }
  assert.equal(L.wealthFree, 1_900_000);
  assert.equal(L.personAllowance, 114_540);
});

test('the right year is picked, and a year past the table says the rules are old', () => {
  assert.equal(lawFor(2026).year, 2026);
  assert.equal(lawFor(1999).year, LAW_YEARS[0]);
  assert.equal(lawFor(2999).year, LAW_YEARS.at(-1));
  assert.equal(lawIsOld(LAW_YEARS.at(-1)), false);
  assert.equal(lawIsOld(LAW_YEARS.at(-1) + 1), true);
  assert.ok(LAW_YEARS.includes(LAW.year));
});

// ---------- wealth tax ----------
test('wealth tax is zero under the allowance, 1% above it and 1.1% above the high step', () => {
  assert.equal(wealthTax(1_000_000, 0, L), 0);
  near(wealthTax(10_000_000, 0, L), 0.01 * (8_000_000 - 1_900_000), 1e-6);
  near(wealthTax(1_000_000, 2_000_000, L), 0.01 * (800_000 + 2_000_000 - 1_900_000), 1e-6);
  near(wealthTaxOn(30_000_000, L), 0.01 * (30_000_000 - 1_900_000) + 0.001 * (30_000_000 - 21_500_000), 1e-6);
});

test('spouses share a doubled allowance and a doubled high step', () => {
  assert.equal(wealthTaxOn(3_800_000, L, 2), 0);
  near(wealthTaxOn(5_000_000, L, 2), 0.01 * (5_000_000 - 3_800_000), 1e-6);
  near(wealthTaxOn(50_000_000, L, 2), 0.01 * (50_000_000 - 3_800_000) + 0.001 * (50_000_000 - 43_000_000), 1e-6);
});

test('taxable wealth follows the tax office example: debt that belongs to funds is cut by 20%', () => {
  // Skatteetaten, "Verdsettingsrabatt ved fastsetting av formue": home 4.8 M, fund 1 M, bank 0.2 M, debt 1.8 M -> 460 000.
  near(taxableWealth({ home: 4_800_000, funds: 1_000_000, cash: 200_000, debt: 1_800_000 }, L), 460_000, 1e-6);
  near(taxableWealth({ funds: 1_000_000 }, L), 800_000, 1e-6);
  assert.equal(taxableWealth({}, L), 0);
});

test('a home counts at 25% up to the limit and 70% above it, and the limit differs by year', () => {
  near(taxableWealth({ home: 16_000_000 }, L), 0.25 * 14_000_000 + 0.70 * 2_000_000, 1e-6);
  near(taxableWealth({ home: 16_000_000 }, LAWS[2025]), 0.25 * 10_000_000 + 0.70 * 6_000_000, 1e-6);
});

// ---------- loans ----------
test('loan maths: months to repay and what is left', () => {
  assert.equal(monthsToRepay(1_000_000, 0, 10_000), 100);
  assert.equal(monthsToRepay(0, 5, 10_000), 0);
  assert.equal(monthsToRepay(1_000_000, 6, 5_000), null);          // the payment only covers the interest
  assert.equal(monthsToRepay(1_000_000, 6, 11_103), 120);          // a ten-year annuity
  near(balanceAfter(1_000_000, 6, 11_102.05, 120), 0, 1);
  near(balanceAfter(1_000_000, 6, 11_102.05, 60), 574_261, 5);
  near(balanceAfter(1_000_000, 0, 10_000, 30), 700_000, 1e-6);
  assert.equal(balanceAfter(50_000, 5, 100_000, 3), 0);
});

// ---------- the plan ----------
test('one working year: growth plus contributions', () => {
  const p = { ...base, mortgageYearsLeft: 0, mortgagePayment: 0 };
  near(sim(p, 0.04, 65, 0, 5_000).path[1].balance, 500_000 * 1.04 + 60_000, 1e-6);
});

test('freed mortgage payment is invested after payoff while working', () => {
  const p = { ...base, portfolio: 0, basis: 0, mortgageYearsLeft: 1 };
  const { path } = sim(p, 0, 65, 0, 1_000);
  near(path[1].balance, 12_000, 1e-6);                 // year 0: mortgage still running
  near(path[2].balance, 12_000 + 12 * 11_000, 1e-6);   // year 1: payment invested too
});

const retired = { ...base, age: 60, portfolio: 1_000_000, mortgagePayment: 0, mortgageYearsLeft: 0, horizon: 62 };

test('deposits come out tax-free', () => {
  near(sim({ ...retired, basis: 1_000_000 }, 0, 60, 10_000, 0).path[1].balance, 880_000, 1e-6);
});

test('before the pension starts, the personal allowance covers part of the gains each year', () => {
  const free = L.personAllowance / L.grossUp;              // about 66 600 kr of gain
  near(free, 66_593, 1);
  // 120 000 needed, nothing paid in: the first `free` kroner are untaxed, the rest is taxed at 37.84%.
  near(sim({ ...retired, basis: 0 }, 0, 60, 10_000, 0).path[1].balance, 1_000_000 - (120_000 - L.gainsTax * free) / (1 - L.gainsTax), 1e-6);
  // A small need inside the allowance costs no tax at all.
  near(sim({ ...retired, basis: 0 }, 0, 60, 5_000, 0).path[1].balance, 940_000, 1e-6);
  // Deposits and allowance add up.
  near(sim({ ...retired, basis: 50_000 }, 0, 60, 10_000, 0).path[1].balance, 1_000_000 - (120_000 - L.gainsTax * (50_000 + free)) / (1 - L.gainsTax), 1e-6);
});

test('once the pension is paid, it has used the allowance and every krone of gain is taxed', () => {
  const p = { ...retired, age: 67, basis: 0, pension: 60_000, horizon: 69 };
  near(sim(p, 0, 67, 10_000, 0).path[1].balance, 1_000_000 - 60_000 / (1 - L.gainsTax), 1e-6);
});

test('mortgage interest shelters gains too, when the loan balance and rate are known', () => {
  const p = { ...retired, basis: 0, mortgagePayment: 10_000, mortgageYearsLeft: 20, mortgageBalance: 1_000_000, mortgageRate: 5 };
  const free = (L.personAllowance + 50_000) / L.grossUp;
  near(sim(p, 0, 60, 10_000, 0).path[1].balance, 1_000_000 - (240_000 - L.gainsTax * free) / (1 - L.gainsTax), 1e-6);
});

test('pension reduces what is taken from the portfolio from 67', () => {
  const p = { ...retired, age: 67, basis: 1_000_000, pension: 120_000, horizon: 69 };
  near(sim(p, 0, 67, 10_000, 0).path[1].balance, 1_000_000, 1e-6);
});

test('a typed pension starts at the pension age, part-way through a year when the age has months', () => {
  const p = { ...retired, age: 67, basis: 1_000_000, pension: 120_000, horizon: 70, pensionAge: 68 };
  const { path } = sim(p, 0, 67, 10_000, 0);
  near(path[1].balance, 880_000, 1e-6);    // 67: no pension yet
  near(path[2].balance, 880_000, 1e-6);    // 68: pension covers it
  // Pension age 67 years and 6 months: half a year of pension in the first year.
  const half = sim({ ...p, pensionAge: 67.5 }, 0, 67, 10_000, 0, true).years;
  assert.deepEqual(half.map((y) => y.pension), [60_000, 120_000, 120_000]);
  assert.deepEqual(pensionFor({ pension: 300_000 }, 40, L), { start: 67, gross: 300_000, net: 300_000, income: 0, topUp: 0, typed: true });
});

test('with a pension pot the state pension is worked out for the age you stop, and taxed', () => {
  const state = { birthYear: 1985, pot: 6_000_000, potYear: 2026, pay: 800_000, norwayYears: 40, partner: false };
  const p = { ...retired, age: 60, basis: 50_000_000, portfolio: 50_000_000, horizon: 72, pension: 999, state };
  const want = statePension(state, 1985 + 60, L);
  assert.deepEqual(pensionFor(p, 60, L), { start: want.ageMonths / 12, gross: want.gross, net: want.net, income: want.income, topUp: want.topUp, typed: false });
  const { years } = sim(p, 0, 60, 0, 0, true);
  assert.equal(years[7].pension, 0);                                  // age 67: nothing yet
  near(years[8].pension, (want.gross / 6) - pensionTax(want.gross / 6, L), 1e-6);   // starts at 68 years 10 months: two months that year
  near(years[9].pension, want.net, 1e-6);
  assert.ok(pensionFor(p, 65, L).gross > pensionFor(p, 60, L).gross); // working longer earns more
});

test('an employer pension pot grows until the pension age, then pays out over ten years', () => {
  const state = { birthYear: 1963, pot: 0, potYear: 2026, pay: 0, norwayYears: 0, partner: false };   // no state pension at all, to isolate the pot
  const p = { ...retired, age: 60, basis: 50_000_000, portfolio: 50_000_000, horizon: 80, state, work: { pot: 1_000_000, rate: 0.05, pay: 600_000 } };
  const { years } = sim(p, 0, 63, 0, 0, true);
  const pot = 1_000_000 + 3 * 0.05 * 600_000;                         // three more working years of saving
  const yearly = pot / 10, net = yearly - pensionTax(yearly, L);
  assert.deepEqual(years.map((y) => Math.round(y.pension)), [0, 0, 0, 0, 0, 0, 0, ...Array(10).fill(Math.round(net)), 0, 0, 0]);
  // It grows with the market before it is paid out, and a crash in the stop year hits it too.
  const grown = sim(p, 0.05, 63, 0, 0, true).years[7].pension;
  assert.ok(grown > net);
  assert.ok(sim({ ...p, crash: 50 }, 0.05, 63, 0, 0, true).years[7].pension < grown);
  // Stop after the pension age: the ten years of payout start when you stop, not before.
  const late = sim({ ...p, age: 66, horizon: 84 }, 0, 70, 0, 0, true).years;
  assert.deepEqual(late.map((y) => (y.pension > 0 ? 1 : 0)).join(''), '000011111111110000');
  // Without the state inputs the pot is not used: a typed pension is taken to include everything.
  assert.equal(sim({ ...p, state: undefined, pension: 0 }, 0, 63, 0, 0, true).years[7].pension, 0);
});

test('income after you stop lowers what the savings must carry, until the age it ends', () => {
  const p = { ...retired, basis: 1_000_000, horizon: 64, sideIncome: 4_000, sideUntil: 62 };
  const { years } = sim(p, 0, 60, 10_000, 0, true);
  assert.deepEqual(years.map((y) => [y.age, y.side, y.out]), [[60, 48_000, 72_000], [61, 48_000, 72_000], [62, 0, 120_000], [63, 0, 120_000]]);
  assert.ok(maxSpend({ ...base, sideIncome: 8_000, sideUntil: 67 }, 0.04, 55, 8_000, L) > maxSpend(base, 0.04, 55, 8_000, L));
  // In a year with other income, that income has used the personal allowance: gains are taxed in full.
  const q = { ...retired, basis: 0, sideIncome: 1_000, sideUntil: 61 };
  near(sim(q, 0, 60, 10_000, 0).path[1].balance, 1_000_000 - 108_000 / (1 - L.gainsTax), 1e-6);
});

test('the money runs out when spending is too high, and the age is reported', () => {
  const p = { ...retired, portfolio: 1_200_000, basis: 1_200_000, horizon: 95 };
  const res = sim(p, 0, 60, 10_000, 0);
  assert.equal(res.runsOut, 70);
  assert.equal(res.path.at(-1).balance, 0);
});

test('maxSpend is the edge between lasting and not lasting', () => {
  const s = maxSpend(base, 0.04, 62, 8_000, L);
  assert.ok(s > 0);
  assert.ok(lasts(base, 0.04, 62, s - 50, 8_000, L));
  assert.ok(!lasts(base, 0.04, 62, s + 50, 8_000, L));
});

test('more investing, later stop and better markets all help', () => {
  assert.ok(maxSpend(base, 0.04, 62, 12_000, L) > maxSpend(base, 0.04, 62, 8_000, L));
  assert.ok(maxSpend(base, 0.04, 65, 8_000, L) > maxSpend(base, 0.04, 62, 8_000, L));
  assert.ok(maxSpend(base, 0.06, 62, 8_000, L) > maxSpend(base, 0.015, 62, 8_000, L));
});

test('a crash in the stop year lowers what you can spend', () => {
  assert.ok(maxSpend({ ...base, crash: 30 }, 0.04, 62, 8_000, L) < maxSpend(base, 0.04, 62, 8_000, L));
});

test('a bad first ten years lowers what you can spend, and only bites in those years', () => {
  assert.ok(maxSpend({ ...base, slow: 1 }, 0.04, 62, 8_000, L) < maxSpend(base, 0.04, 62, 8_000, L));
  const p = { ...retired, basis: 1_000_000, horizon: 60 + SLOW.years + 3, slow: 1 };
  const { years } = sim(p, 0.04, 60, 0, 0, true);
  for (const y of years) near(y.growth, y.start * (y.age < 60 + SLOW.years ? Math.min(0.04, SLOW.r) : 0.04), 1e-6);
  // Growth that is already lower than the test is left alone.
  assert.equal(maxSpend({ ...base, slow: 1 }, SLOW.r - 0.01, 62, 8_000, L), maxSpend(base, SLOW.r - 0.01, 62, 8_000, L));
});

test('a plan is safe, fine only with steady growth, or short', () => {
  const v = verdict(base, 0.04, 62, 0, 8_000, L);
  assert.ok(v.hard < v.steady);
  assert.equal(v.hard, maxSpend({ ...base, slow: 1 }, 0.04, 62, 8_000, L));
  assert.equal(verdict(base, 0.04, 62, v.hard - 100, 8_000, L).result, 'safe');
  assert.equal(verdict(base, 0.04, 62, (v.hard + v.steady) / 2, 8_000, L).result, 'steady');
  assert.equal(verdict(base, 0.04, 62, v.steady + 100, 8_000, L).result, 'short');
});

test('needInvest and earliestAge agree with maxSpend', () => {
  const need = needInvest(base, 0.04, 62, 25_000, L);
  assert.ok(need > 0);
  assert.ok(maxSpend(base, 0.04, 62, need + 50, L) >= 25_000);
  const age = earliestAge(base, 0.04, 25_000, 8_000, L);
  assert.ok(lasts(base, 0.04, age, 25_000, 8_000, L));
  assert.ok(!lasts(base, 0.04, age - 1, 25_000, 8_000, L));
  assert.equal(needInvest({ ...base, age: 60 }, 0.015, 61, 300_000, L), null);
});

test('wealth tax follows the mortgage: as the debt is paid, more wealth is taxed', () => {
  const p = { ...base, age: 50, portfolio: 5_000_000, basis: 5_000_000, mortgagePayment: 25_000, mortgageYearsLeft: 10,
    mortgageBalance: 3_000_000, mortgageRate: 0, wealth: { home: 8_000_000, cash: 100_000, debt: 3_200_000 }, horizon: 65 };
  const { years } = sim(p, 0, 65, 0, 0, true);
  const tax = (debt, funds) => wealthTaxOn(taxableWealth({ funds, home: 8_000_000, cash: 100_000, debt }, L), L);
  near(years[0].wealthTax, tax(3_200_000, 5_000_000), 1e-6);
  near(years[1].wealthTax, tax(2_900_000, years[1].start), 1e-6);       // 300 000 paid off in a year
  near(years[10].wealthTax, tax(200_000, years[10].start), 1e-6);       // only the other debt is left
  assert.ok(years[10].wealthTax > years[0].wealthTax);
  // Spouses pay less on the same numbers.
  assert.ok(sim({ ...p, people: 2 }, 0, 65, 0, 0, true).years[10].wealthTax < years[10].wealthTax);
  // Without a loan balance the debt is taken to fall evenly until the mortgage is gone.
  const even = sim({ ...p, mortgageBalance: 0 }, 0, 65, 0, 0, true).years;
  near(even[5].wealthTax, tax(1_600_000, even[5].start), 1e-6);
  near(even[12].wealthTax, tax(0, even[12].start), 1e-6);
});

test('the year-by-year rows add up', () => {
  const p = { ...base, age: 55, portfolio: 4_000_000, basis: 1_000_000, mortgageYearsLeft: 8, pension: 200_000, horizon: 75, crash: 20 };
  const { years, path } = sim(p, 0.03, 60, 15_000, 10_000, true);
  assert.equal(years.length, 20);
  for (const y of years) {
    if (y.age < 60) near(y.end, y.start + y.growth + y.paidIn - y.wealthTax, 1e-6);
    else {
      near(y.end, y.start + y.growth - y.out, 1e-6);
      near(y.out, Math.max(0, y.living + y.mortgage - y.pension) + y.wealthTax + y.gainsTax, 1e-6);
      assert.ok(y.gainsTax >= -1e-9);
    }
  }
  near(years[5].start, years[4].end * 0.8, 1e-6);          // the crash hits in the year you stop
  assert.equal(years[5].mortgage, 120_000);
  assert.equal(years[8].mortgage, 0);
  assert.equal(years[11].pension, 0);
  assert.equal(years[12].pension, 200_000);
  near(path.at(-1).balance, years.at(-1).end, 1e-6);
  assert.equal(sim(p, 0.03, 60, 15_000, 10_000).years, undefined);
  // When the money runs out the rows stop there, with nothing left.
  const short = sim(p, 0.03, 60, 60_000, 10_000, true);
  assert.equal(short.years.at(-1).age, short.runsOut);
  assert.equal(short.years.at(-1).end, 0);
});

// ---------- net worth ----------
test('net worth adds assets and subtracts debt', () => {
  const s = { ask: 100, funds: 50, ips: 10, other: 40, cash: 30, home: 1000, car: 20, debt: 600 };
  assert.equal(investable(s), 200);
  assert.equal(netWorth(s), 650);
});

test('the change between two entries splits into what you paid in and what the market did', () => {
  const a = { ask: 1000, cash: 100, debt: 500 }, b = { ask: 1300, cash: 150, debt: 480, paidIn: 200 };
  assert.deepEqual(change(a, b), { total: 300, paidIn: 200, market: 100, netWorth: 370 });
  assert.deepEqual(change(a, { ask: 900, paidIn: null }), { total: -100, paidIn: null, market: null, netWorth: 300 });
});

test('the plan line grows by monthly investing, plan growth and inflation', () => {
  const none = () => 0;
  assert.deepEqual(planPath(1000, ['2026-01-01', '2026-07-01', '2027-01-01'], 100, 0, none), [1000, 1600, 2200]);
  const [, y1] = planPath(1000, ['2026-01-01', '2027-01-01'], 0, 0.04, () => 0.02);
  near(y1, 1000 * 1.04 * 1.02, 1e-6);
  const [, y2] = planPath(0, ['2026-01-01', '2027-01-01'], 100, 0.05, none);
  const m = 1.05 ** (1 / 12) - 1;
  near(y2, 100 * ((1 + m) ** 12 - 1) / m, 1e-6);
  assert.deepEqual(planPath(500, ['2026-01-01'], 100, 0.04, none), [500]);
});
