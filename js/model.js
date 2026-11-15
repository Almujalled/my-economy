// Pure money calculations. No DOM, no storage. Everything is in today's kroner.
// The rules (tax rates, allowances) are in law.js, with sources in README.md.
import { LAW } from './law.js';
import { statePension, pensionTax } from './pension.js';

export { LAW, LAWS, lawFor } from './law.js';

// Growth per year above inflation, after fund costs.
export const SCENARIOS = [
  { id: 'cautious', name: 'Cautious', r: 0.015 },
  { id: 'middle', name: 'Middle', r: 0.04 },
  { id: 'good', name: 'Good', r: 0.06 },
];

// The "bad first ten years" test: savings lose 2% a year to prices for the first ten years after you stop,
// then grow as in the chosen scenario. Those years decide whether the money lasts, because you are selling
// while prices are low. This is about as bad as stopping in 1929, 1966, 1972 or 2000 (see README).
export const SLOW = { years: 10, r: -0.02 };

// ---------- wealth tax ----------
/**
 * Taxable net wealth from its parts, all at today's market value.
 * funds: shares, equity funds and ASK. home: the home you live in. cash: bank deposits and other things that count in full.
 * The part of the debt that belongs to the funds is only partly deductible (skatteloven § 4-19).
 */
export function taxableWealth({ funds = 0, home = 0, cash = 0, debt = 0 }, law = LAW) {
  const gross = funds + home + cash;
  const debtOnFunds = gross > 0 ? (debt * funds) / gross : 0;
  const homeValue = law.homeShare * Math.min(home, law.homeHighFrom) + law.homeHighShare * Math.max(0, home - law.homeHighFrom);
  return law.wealthShare * funds + homeValue + cash - (debt - law.debtCut * debtOnFunds);
}

/** Wealth tax for a year on a taxable net wealth. people: 2 for spouses, who share a doubled allowance. */
export function wealthTaxOn(net, law = LAW, people = 1) {
  return law.wealthRate * Math.max(0, net - people * law.wealthFree)
    + (law.wealthHighRate - law.wealthRate) * Math.max(0, net - people * law.wealthHighFrom);
}

/** Wealth tax when all you know is the portfolio and one number for everything else. */
export function wealthTax(balance, otherWealth = 0, law = LAW, people = 1) {
  return wealthTaxOn(law.wealthShare * balance + otherWealth, law, people);
}

// ---------- loans ----------
/** Months until a loan is repaid with a fixed monthly payment. null = the payment does not cover the interest. */
export function monthsToRepay(balance, ratePct, payment) {
  if (!(balance > 0)) return 0;
  const i = Math.max(0, ratePct) / 100 / 12;
  if (!(payment > balance * i)) return null;
  if (i === 0) return Math.ceil(balance / payment);
  return Math.ceil(-Math.log(1 - (balance * i) / payment) / Math.log(1 + i) - 1e-9);
}

/** What is left of a loan after `months` monthly payments. */
export function balanceAfter(balance, ratePct, payment, months) {
  const i = Math.max(0, ratePct) / 100 / 12;
  let b = Math.max(0, balance);
  for (let m = 0; m < months && b > 0; m++) b = Math.max(0, b * (1 + i) - payment);
  return b;
}

// ---------- the plan ----------
/**
 * The lifelong pension for someone who stops working at `stopAge`.
 * With p.state (pension pot at NAV, pay and so on) the state pension is worked out for that stop age.
 * Without it, p.pension is used: a yearly figure after tax that you typed, the same whenever you stop.
 * Returns { start, gross, net, income, topUp, typed }. start is the age the pension begins, with a fraction.
 */
export function pensionFor(p, stopAge, law = LAW) {
  if (p.state) {
    const s = statePension(p.state, p.state.birthYear + stopAge, law);
    return { start: s.ageMonths / 12, gross: s.gross, net: s.net, income: s.income, topUp: s.topUp, typed: false };
  }
  return { start: p.pensionAge || law.pensionAge, gross: p.pension, net: p.pension, income: 0, topUp: 0, typed: true };
}
// How much of the year that starts at age `a` lies between two ages.
const overlap = (a, from, to) => Math.max(0, Math.min(a + 1, to) - Math.max(a, from));

/**
 * Runs one plan year by year.
 * p: { age, portfolio, basis, mortgagePayment, mortgageYearsLeft, pension, horizon, otherWealth, crash,
 *      slow?,                                    // true = run the bad first ten years
 *      sideIncome?, sideUntil?,                  // monthly income after tax from the day you stop until that age
 *      pensionAge?,                              // age the typed pension starts (default: the law's)
 *      state?: { birthYear, pot, potYear, pay, norwayYears, partner },   // work the state pension out instead
 *      work?: { pot, rate, pay },                // employer pension: pot today and yearly saving as a share of pay;
 *                                                // paid out over ten years from the pension age, with state?
 *      mortgageBalance?, mortgageRate?,          // lets the debt, and the interest you can deduct, follow the loan
 *      wealth?: { home, cash, debt },            // from your net worth: wealth tax then follows the mortgage as it is paid
 *      people? }                                 // 2 when the numbers cover spouses, who share a doubled wealth tax allowance
 * r: real growth per year. retAge: age you stop working. spend: monthly living costs after that.
 * invest: monthly investing while working.
 * Returns { path: [{age, balance}], runsOut: age | null, years? }.
 * With detail = true, years has one row per year: { age, start, growth, paidIn, out, living, mortgage, pension, side, gainsTax, wealthTax, end }.
 */
export function simulate(p, r, retAge, spend, invest, law = LAW, detail = false) {
  let bal = p.portfolio;
  let deposits = Math.min(p.basis, p.portfolio);
  const payoffAge = p.age + p.mortgageYearsLeft;
  const stopAge = Math.max(retAge, p.age);
  const pen = pensionFor(p, stopAge, law);
  const penStart = Math.max(pen.start, stopAge);     // no pension is counted while you still work
  const work = p.work && p.state ? p.work : null;   // a typed pension is taken to include any employer pension
  let workPot = work ? work.pot : 0, workYearly = null;
  const w = p.wealth || null, people = p.people || 1;
  const loan0 = p.mortgageBalance > 0 ? p.mortgageBalance : 0;
  let loan = loan0;
  const path = [], years = [];
  let runsOut = null;
  for (let a = p.age; a < p.horizon; a++) {
    path.push({ age: a, balance: bal });
    if (runsOut !== null) continue;
    const start = bal;
    const paying = a < payoffAge && p.mortgagePayment > 0;
    const mortgage = paying ? 12 * p.mortgagePayment : 0;
    let wt;
    if (w) {
      // Debt today, less what has been paid off the mortgage since. Without a balance, assume it falls evenly.
      const debt = loan0 > 0 ? Math.max(0, w.debt - (loan0 - loan))
        : p.mortgagePayment > 0 && p.mortgageYearsLeft > 0 ? w.debt * Math.max(0, 1 - (a - p.age) / p.mortgageYearsLeft) : w.debt;
      wt = wealthTaxOn(taxableWealth({ funds: bal, home: w.home, cash: w.cash, debt }, law), law, people);
    } else wt = wealthTax(bal, p.otherWealth, law, people);
    const interest = paying && loan > 0 ? (loan * (p.mortgageRate || 0)) / 100 : 0;
    const row = detail ? { age: a, start, growth: 0, paidIn: 0, out: 0, living: 0, mortgage, pension: 0, side: 0, gainsTax: 0, wealthTax: wt, end: 0 } : null;
    const rate = a >= stopAge && p.slow && a < stopAge + SLOW.years ? Math.min(r, SLOW.r) : r;
    if (a < stopAge) {
      // Working: invest, and once the mortgage is gone invest that payment too.
      const add = 12 * (invest + (a >= payoffAge ? p.mortgagePayment : 0));
      bal = bal * (1 + r) + add - wt;
      deposits += add;
      if (row) { row.growth = start * r; row.paidIn = add; row.mortgage = 0; }
    } else {
      if (a === stopAge) { bal *= 1 - (p.crash || 0) / 100; workPot *= 1 - (p.crash || 0) / 100; }
      // The pension for this year: the state pension from its start age (part of the first year),
      // plus the employer pot spread evenly over ten years. Both are taxed together.
      if (workYearly === null && a + 1 > penStart) workYearly = workPot / 10;
      const pensionGross = pen.gross * overlap(a, penStart, Infinity) + (workYearly || 0) * overlap(a, penStart, penStart + 10);
      const pension = pen.typed ? pensionGross : pensionGross - pensionTax(pensionGross, law);
      const side = a < (p.sideUntil || 0) ? 12 * (p.sideIncome || 0) : 0;
      const need = Math.max(0, 12 * spend + mortgage - pension - side) + wt;
      // Your own deposits come out tax-free first. In years with no pension or other income, the personal
      // allowance (and mortgage interest) also covers part of the gains. Gains beyond that are taxed.
      const shelter = pension > 0 || side > 0 ? 0 : (law.personAllowance + interest) / law.grossUp;
      const taxFree = Math.min(deposits, bal) + shelter;
      const gross = need <= taxFree ? need : (need - law.gainsTax * taxFree) / (1 - law.gainsTax);
      const next = bal * (1 + rate) - gross;
      deposits -= Math.min(deposits, gross);
      if (row) { row.start = bal; row.growth = bal * rate; row.out = gross; row.living = 12 * spend; row.pension = pension; row.side = side; row.gainsTax = gross - need; }
      if (next < 0) { runsOut = a; bal = 0; } else bal = next;
    }
    if (work && workYearly === null) workPot = workPot * (1 + rate) + (a < stopAge ? work.rate * work.pay : 0);
    if (paying && loan > 0) loan = balanceAfter(loan, p.mortgageRate || 0, p.mortgagePayment, 12);
    if (row) { row.end = bal; years.push(row); }
  }
  path.push({ age: p.horizon, balance: bal });
  return detail ? { path, runsOut, years } : { path, runsOut };
}

export const lasts = (p, r, retAge, spend, invest, law = LAW) =>
  simulate(p, r, retAge, spend, invest, law).runsOut === null;

// Highest monthly living costs the plan can carry until the horizon.
export function maxSpend(p, r, retAge, invest, law = LAW) {
  if (!lasts(p, r, retAge, 0, invest, law)) return 0;
  let lo = 0, hi = 400_000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (lasts(p, r, retAge, mid, invest, law)) lo = mid; else hi = mid;
  }
  return lo;
}

// Monthly investing needed to afford `spend` from `retAge`. null = not reachable.
export function needInvest(p, r, retAge, spend, law = LAW) {
  if (lasts(p, r, retAge, spend, 0, law)) return 0;
  let lo = 0, hi = 300_000;
  if (!lasts(p, r, retAge, spend, hi, law)) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (lasts(p, r, retAge, spend, mid, law)) hi = mid; else lo = mid;
  }
  return hi;
}

// First age at which you can stop and still afford `spend`. null = not before 85.
export function earliestAge(p, r, spend, invest, law = LAW) {
  for (let a = p.age; a <= 85; a++) if (lasts(p, r, a, spend, invest, law)) return a;
  return null;
}

/**
 * How a plan stands. result is 'safe' (the money lasts even through a bad first ten years),
 * 'steady' (it lasts only if growth is steady) or 'short' (it runs out either way).
 * steady and hard are the monthly amounts the plan can carry in the two cases.
 */
export function verdict(p, r, retAge, spend, invest, law = LAW) {
  const steady = maxSpend(p, r, retAge, invest, law), hard = maxSpend({ ...p, slow: 1 }, r, retAge, invest, law);
  return { steady, hard, result: spend <= hard ? 'safe' : spend <= steady ? 'steady' : 'short' };
}

// ---------- net worth ----------
export const investable = (s) => (s.ask || 0) + (s.funds || 0) + (s.ips || 0) + (s.other || 0);
export const netWorth = (s) => investable(s) + (s.cash || 0) + (s.home || 0) + (s.car || 0) - (s.debt || 0);

/**
 * How investments changed between two net worth entries: what you paid in and what the market did.
 * paidIn is null when the later entry does not say; then the market part is unknown too.
 */
export function change(prev, next) {
  const total = investable(next) - investable(prev);
  const paidIn = typeof next.paidIn === 'number' ? next.paidIn : null;
  return { total, paidIn, market: paidIn === null ? null : total - paidIn, netWorth: netWorth(next) - netWorth(prev) };
}

/**
 * Where the plan says your investments should be, at each of the given dates, starting from the first.
 * Entries are in kroner of their own day, so the plan's growth above inflation gets that year's inflation added.
 * dates: ['YYYY-MM-DD', ...] ascending. Returns one value per date.
 */
export function planPath(startValue, dates, monthlyInvest, r, inflationFor) {
  const out = [startValue];
  let v = startValue, at = dates[0];
  for (let i = 1; i < dates.length; i++) {
    let months = (+dates[i].slice(0, 4) - +at.slice(0, 4)) * 12 + (+dates[i].slice(5, 7) - +at.slice(5, 7)) + (+dates[i].slice(8, 10) - +at.slice(8, 10)) / 30;
    const yearly = (1 + r) * (1 + inflationFor(+at.slice(0, 4))) - 1, monthly = (1 + yearly) ** (1 / 12) - 1;
    months = Math.max(0, months);
    v = v * (1 + monthly) ** months + monthlyInvest * (monthly > 0 ? ((1 + monthly) ** months - 1) / monthly : months);
    out.push(v);
    at = dates[i];
  }
  return out;
}
