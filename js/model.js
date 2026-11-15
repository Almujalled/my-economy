// Pure money calculations. No DOM, no storage. Everything is in today's kroner.
// Sources for LAW are listed in README.md. Update them when the rules change.

export const LAW = {
  year: 2026,
  gainsTax: 0.22 * 1.72,   // 37.84% on gains taken out of ASK/funds, after your own deposits
  wealthRate: 0.01,        // wealth tax, municipal + state
  wealthShare: 0.80,       // share of ASK/fund value that counts
  wealthFree: 1_900_000,   // tax-free allowance per person
  pensionAge: 67,
};

// Growth per year above inflation.
export const SCENARIOS = [
  { id: 'cautious', name: 'Cautious', r: 0.015 },
  { id: 'middle', name: 'Middle', r: 0.04 },
  { id: 'good', name: 'Good', r: 0.06 },
];

export function wealthTax(balance, otherWealth = 0, law = LAW) {
  return law.wealthRate * Math.max(0, law.wealthShare * balance + otherWealth - law.wealthFree);
}

/**
 * Runs one plan year by year.
 * p: { age, portfolio, basis, mortgagePayment, mortgageYearsLeft, pension, horizon, otherWealth, crash }
 * r: real growth per year. retAge: age you stop working. spend: monthly living costs after that.
 * invest: monthly investing while working.
 * Returns { path: [{age, balance}], runsOut: age | null }.
 */
export function simulate(p, r, retAge, spend, invest, law = LAW) {
  let bal = p.portfolio;
  let deposits = Math.min(p.basis, p.portfolio);
  const payoffAge = p.age + p.mortgageYearsLeft;
  const stopAge = Math.max(retAge, p.age);
  const path = [];
  let runsOut = null;
  for (let a = p.age; a < p.horizon; a++) {
    path.push({ age: a, balance: bal });
    if (runsOut !== null) continue;
    const mortgage = a < payoffAge ? 12 * p.mortgagePayment : 0;
    if (a < stopAge) {
      // Working: invest, and once the mortgage is gone invest that payment too.
      const add = 12 * (invest + (a >= payoffAge ? p.mortgagePayment : 0));
      bal = bal * (1 + r) + add - wealthTax(bal, p.otherWealth, law);
      deposits += add;
    } else {
      if (a === stopAge) bal *= 1 - (p.crash || 0) / 100;
      const pension = a >= law.pensionAge ? p.pension : 0;
      const need = Math.max(0, 12 * spend + mortgage - pension) + wealthTax(bal, p.otherWealth, law);
      // Your own deposits come out tax-free first; gains are taxed after that.
      const taxFree = Math.min(deposits, bal);
      const gross = need <= taxFree ? need : (need - law.gainsTax * taxFree) / (1 - law.gainsTax);
      const next = bal * (1 + r) - gross;
      deposits -= Math.min(deposits, gross);
      if (next < 0) { runsOut = a; bal = 0; } else bal = next;
    }
  }
  path.push({ age: p.horizon, balance: bal });
  return { path, runsOut };
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

// ---------- net worth ----------
export const investable = (s) => (s.ask || 0) + (s.funds || 0) + (s.ips || 0) + (s.other || 0);
export const netWorth = (s) => investable(s) + (s.cash || 0) + (s.home || 0) + (s.car || 0) - (s.debt || 0);
