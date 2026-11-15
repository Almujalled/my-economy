// Pure money calculations. No DOM, no storage. Everything is in today's kroner.

/**
 * Growth a year above prices, after fund costs, while you work and after. Careful on purpose: across a spread of
 * made-up cases it gives about the same age as assuming 4% a year with a bad first ten years after you stop
 * (minus 2% a year), usually within a year. A flat 4% would promise ages about three years too early.
 */
export const GROWTH = 0.025;
/** The money has to last until this age. */
export const LAST_AGE = 95;
/**
 * Tax on growth taken out of ASK and funds: 22% on the gain, grossed up by 1.72, so 37.84%.
 * What you put in comes out tax-free first. The only tax figure in the app: check it when a new budget is passed.
 */
export const GAINS_TAX = 0.22 * 1.72;

// ---------- net worth ----------
/** Investments in a net worth entry: ASK, funds and shares, IPS and other investments. */
export const investable = (e) => (e.ask || 0) + (e.funds || 0) + (e.ips || 0) + (e.other || 0);
/** Everything you own less what you owe. */
export const netWorth = (e) => investable(e) + (e.cash || 0) + (e.home || 0) + (e.car || 0) - (e.debt || 0);
/** How much your investments have grown beyond what you put in. null when what you put in is not known. */
export const grown = (e) => (typeof e.putIn === 'number' ? investable(e) - e.putIn : null);

/**
 * What changed between two net worth entries. Your investments changed by `total`: you put in `putIn`
 * and the market did `market`. Both are null when an entry does not say what you had put in.
 */
export function change(prev, next) {
  const total = investable(next) - investable(prev);
  const putIn = typeof prev.putIn === 'number' && typeof next.putIn === 'number' ? next.putIn - prev.putIn : null;
  return { total, putIn, market: putIn === null ? null : total - putIn, netWorth: netWorth(next) - netWorth(prev) };
}

// ---------- when can I stop working ----------
/**
 * The age the state pension starts: 67 in today's law, plus about a month per birth year after 1963.
 * Parliament agreed to this in 2024, but it is not law yet, so it is an estimate.
 */
export const pensionAge = (birthYear) => 67 + Math.max(0, birthYear - 1963) / 12;

/**
 * Runs your money year by year until LAST_AGE, if you stop working at `stop`.
 * p: { age, worth, putIn, invest, spend, mortgage, mortgageEndAge, pension, pensionAge }. Amounts are a month.
 * While you work you invest `invest`, and once the mortgage is paid off you invest that payment too.
 * After you stop, living costs and the mortgage come out of the investments, less the pension once it starts.
 * Returns the age the money runs out, or null when it lasts.
 */
export function runsOut(p, stop, g = GROWTH) {
  let worth = p.worth, putIn = Math.max(0, Math.min(p.putIn, p.worth));
  for (let a = p.age; a < LAST_AGE; a++) {
    const paying = a < p.mortgageEndAge;
    if (a < stop) {
      const add = 12 * (p.invest + (paying ? 0 : p.mortgage));
      worth = worth * (1 + g) + add;
      putIn += add;
      continue;
    }
    const withPension = Math.min(1, Math.max(0, a + 1 - p.pensionAge));   // the part of this year the pension is paid
    const need = Math.max(0, 12 * (p.spend + (paying ? p.mortgage : 0) - withPension * p.pension));
    const free = Math.min(putIn, Math.max(0, worth));                     // what you put in comes out tax-free first
    const out = need <= free ? need : free + (need - free) / (1 - GAINS_TAX);
    putIn -= Math.min(putIn, out);
    worth = worth * (1 + g) - out;
    if (worth < 0) return a;
  }
  return null;
}

/** The first whole age you can stop working at and still have money until LAST_AGE. null = not before 75. */
export function stopAge(p, g = GROWTH) {
  for (let a = p.age; a <= 75; a++) if (runsOut(p, a, g) === null) return a;
  return null;
}
