// Tests for the state pension helper and the tax on pay and pension. Made-up people and round numbers.
// Expected values come from official examples, named in each test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAWS } from '../js/law.js';
import { DELINGSTALL, HELPER_FROM, pensionAgeMonths, delingstall, wageTax, pensionTax, statePension } from '../js/pension.js';

const L = LAWS[2026];
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test('the delingstall table is complete and falls with age and rises with birth year', () => {
  const years = Object.keys(DELINGSTALL).map(Number);
  assert.deepEqual([years[0], years.at(-1), years.length], [HELPER_FROM, 2005, 43]);
  for (const y of years) {
    assert.equal(DELINGSTALL[y].length, 14, String(y));
    for (let i = 1; i < 14; i++) assert.ok(DELINGSTALL[y][i] < DELINGSTALL[y][i - 1], `${y} age ${62 + i}`);
    if (DELINGSTALL[y - 1]) assert.ok(DELINGSTALL[y][5] > DELINGSTALL[y - 1][5], `${y} at 67`);
  }
  assert.equal(delingstall(1963, 67 * 12), 16.18);            // final value from NAV
  assert.equal(delingstall(1985, 67 * 12), 18.32);
  near(delingstall(1985, 68 * 12 + 10), 16.82, 0.011);        // between 68 (17.50) and 69 (16.69)
  assert.equal(delingstall(1950, 67 * 12), 16.18);            // outside the table: nearest birth year
  assert.equal(delingstall(2020, 62 * 12), DELINGSTALL[2005][0]);
  assert.equal(delingstall(1985, 90 * 12), DELINGSTALL[1985][13]);
  assert.equal(delingstall(1985, 50 * 12), DELINGSTALL[1985][0]);
});

test('pension age is 67 for those born up to 1963, then one month later per birth year (an estimate)', () => {
  assert.equal(pensionAgeMonths(1955, L), 67 * 12);
  assert.equal(pensionAgeMonths(1963, L), 67 * 12);
  assert.equal(pensionAgeMonths(1975, L), 68 * 12);
  assert.equal(pensionAgeMonths(1985, L), 68 * 12 + 10);
  assert.equal(pensionAgeMonths(1999, L), 70 * 12);
});

test('tax on pay matches the three examples in the 2027 budget proposition (2026 rules)', () => {
  // Prop. 1 LS (2026-2027), table 2.1: pay 200 000 / 650 000 / 1 000 000 -> tax 15 200 / 160 983 / 305 870.
  near(wageTax(200_000, L), 15_200, 1);
  near(wageTax(650_000, L), 160_983, 1);
  near(wageTax(1_000_000, L), 305_870, 1);
  assert.equal(wageTax(50_000, L), 0);
});

test('tax on pension: nothing up to about 294 000 kr, and the official 350 000 kr example', () => {
  assert.equal(pensionTax(250_000, L), 0);
  assert.equal(pensionTax(294_000, L), 0);
  near(pensionTax(300_000, L), 2_777, 1);
  near(pensionTax(350_000, L), 27_456, 1);       // "7,8 pst." of 350 000 in Prop. 1 LS (2026-2027)
  near(pensionTax(400_000, L), 52_556, 1);
  near(pensionTax(500_000, L), 94_516, 1);
  assert.ok(pensionTax(350_000, LAWS[2025]) > pensionTax(350_000, L));   // the credit was raised in 2026
});

test('the guarantee pension tops up a small pot, and stops exactly where the white paper says', () => {
  // Meld. St. 6 (2023-2024), figure 10.7: born 1963, pension at 67, guarantee 1.91 G. With steady pay of 7.1 G,
  // 30 years of earning are enough for the pension to be all pot-based; with 6 G it takes 36, with 5 G 43.
  const law = { ...L, Gavg: 100_000, guarantee: { high: 191_000, ordinary: 170_000 } };
  const after = (payG, years) => statePension({ birthYear: 1963, pot: years * 0.181 * payG * 100_000, potYear: 2026, pay: 0, norwayYears: 40 }, 2020, law);
  for (const [payG, years] of [[7.1, 30], [6, 36], [5, 43]]) {
    assert.ok(after(payG, years - 1).topUp > 0, `${payG} G, ${years - 1} years: still topped up`);
    assert.ok(after(payG, years + 1).topUp === 0, `${payG} G, ${years + 1} years: all pot-based`);
  }
  assert.ok(after(4, 50).topUp > 0);                         // "also people with 50 years get a reduced guarantee"
  // Nothing saved at all: the full guarantee, and no tax on it.
  const none = after(5, 0);
  assert.deepEqual([none.income, none.topUp, none.gross, none.tax], [0, 191_000, 191_000, 0]);
});

test('state pension from pot, pay and the year you stop', () => {
  const who = { birthYear: 1985, pot: 2_500_000, potYear: 2026, pay: 800_000, norwayYears: 40, partner: false };
  const now = statePension(who, 2026, L);
  assert.equal(now.ageMonths, 68 * 12 + 10);
  near(now.potAtStart, 2_500_000 + 1 * 0.181 * 800_000, 1e-6);       // 2025 was earned but is not in the pot yet
  near(now.income, now.potAtStart / delingstall(1985, 826), 1e-6);
  near(now.topUp, 253_787 - 0.8 * now.income, 1e-6);
  near(now.gross, now.income + now.topUp, 1e-6);
  assert.equal(now.tax, 0);
  // Working ten more years adds 18.1% of pay a year to the pot, but inside the guarantee only a fifth of it shows.
  const later = statePension(who, 2036, L);
  near(later.potAtStart - now.potAtStart, 10 * 0.181 * 800_000, 1e-6);
  near(later.gross - now.gross, 0.2 * (later.income - now.income), 1e-6);
  // Pay above 7.1 G earns nothing more.
  near(statePension({ ...who, pay: 5_000_000 }, 2036, L).potAtStart, 2_500_000 + 11 * 0.181 * 7.1 * 134_419, 1e-6);
  // A big pot: no top-up, and tax is paid.
  const big = statePension({ ...who, pot: 8_000_000 }, 2026, L);
  assert.equal(big.topUp, 0);
  near(big.net, big.gross - pensionTax(big.gross, L), 1e-6);
  assert.ok(big.tax > 0);
});

test('fewer years in Norway and a partner with income both lower the guarantee', () => {
  const who = { birthYear: 1985, pot: 1_000_000, potYear: 2026, pay: 0 };
  const full = statePension(who, 2026, L);
  const partner = statePension({ ...who, partner: true }, 2026, L);
  near(full.gross - partner.gross, 253_787 - 234_765, 1e-6);
  const short = statePension({ ...who, norwayYears: 30 }, 2026, L);
  near(short.topUp, 253_787 * 30 / 40 - 0.8 * short.income, 1e-6);
  assert.equal(statePension({ ...who, norwayYears: 4 }, 2026, L).topUp, 0);       // under five years: no guarantee
  assert.equal(statePension({ ...who, norwayYears: 60 }, 2026, L).gross, full.gross);
  assert.equal(statePension({ ...who, pot: -5 }, 2020, L).income, 0);
});
