// The state pension (alderspensjon from folketrygden) for people born in 1963 or later, and tax on pay
// and pension. Pure: no DOM, no storage. Rates and amounts come from law.js; sources are in README.md.
//
// How the state pension works, in short:
// - Every year of work adds 18.1% of your pay (up to 7.1 G) to a pension pot at NAV.
// - When you start the pension, the yearly amount is the pot divided by a number set for your birth year
//   and age (delingstall). It is roughly the number of years the pension is expected to be paid.
// - If that gives little, a guarantee pension tops it up. It is cut by 80% of the pot-based pension, and you
//   need 40 years in Norway between age 16 and 66 to get it in full.
import { LAW } from './law.js';

// Delingstall for whole ages 62 to 75 (first number is age 62). NAV, published 26 June 2026:
// final for those born 1963 to 1965, NAV's forecast for later years. Ages in between are interpolated,
// as the law says. Refresh from NAV's file each summer (see .claude/skills/update-rules).
export const DELINGSTALL = {
  1963: [20.24, 19.43, 18.61, 17.80, 16.99, 16.18, 15.38, 14.57, 13.78, 12.98, 12.20, 11.42, 10.65, 9.90],
  1964: [20.33, 19.51, 18.70, 17.89, 17.07, 16.26, 15.46, 14.65, 13.86, 13.06, 12.28, 11.50, 10.73, 9.97],
  1965: [20.41, 19.59, 18.78, 17.97, 17.15, 16.34, 15.53, 14.73, 13.93, 13.13, 12.35, 11.57, 10.79, 10.03],
  1966: [20.50, 19.68, 18.87, 18.05, 17.24, 16.43, 15.62, 14.81, 14.01, 13.21, 12.42, 11.64, 10.86, 10.10],
  1967: [20.58, 19.76, 18.95, 18.13, 17.32, 16.50, 15.69, 14.89, 14.08, 13.28, 12.49, 11.71, 10.93, 10.17],
  1968: [20.64, 19.83, 19.01, 18.20, 17.38, 16.57, 15.76, 14.95, 14.15, 13.35, 12.56, 11.77, 11.00, 10.23],
  1969: [20.71, 19.90, 19.08, 18.27, 17.45, 16.64, 15.83, 15.02, 14.21, 13.41, 12.62, 11.83, 11.06, 10.29],
  1970: [20.78, 19.96, 19.15, 18.33, 17.51, 16.70, 15.89, 15.08, 14.27, 13.47, 12.68, 11.89, 11.11, 10.34],
  1971: [20.86, 20.04, 19.22, 18.41, 17.59, 16.78, 15.97, 15.16, 14.35, 13.55, 12.75, 11.97, 11.19, 10.42],
  1972: [20.99, 20.18, 19.36, 18.54, 17.73, 16.91, 16.10, 15.29, 14.48, 13.68, 12.88, 12.09, 11.31, 10.54],
  1973: [21.09, 20.27, 19.46, 18.64, 17.83, 17.01, 16.20, 15.39, 14.58, 13.78, 12.98, 12.19, 11.41, 10.63],
  1974: [21.19, 20.38, 19.56, 18.74, 17.93, 17.11, 16.30, 15.49, 14.68, 13.88, 13.08, 12.29, 11.50, 10.72],
  1975: [21.31, 20.50, 19.68, 18.87, 18.05, 17.23, 16.42, 15.61, 14.80, 14.00, 13.20, 12.40, 11.62, 10.84],
  1976: [21.42, 20.61, 19.79, 18.98, 18.16, 17.34, 16.53, 15.72, 14.91, 14.10, 13.30, 12.51, 11.72, 10.94],
  1977: [21.53, 20.71, 19.90, 19.08, 18.27, 17.45, 16.64, 15.83, 15.02, 14.21, 13.41, 12.61, 11.82, 11.04],
  1978: [21.64, 20.82, 20.01, 19.19, 18.38, 17.56, 16.75, 15.93, 15.12, 14.32, 13.51, 12.72, 11.93, 11.14],
  1979: [21.75, 20.93, 20.12, 19.30, 18.49, 17.67, 16.85, 16.04, 15.23, 14.42, 13.62, 12.82, 12.03, 11.24],
  1980: [21.86, 21.04, 20.23, 19.41, 18.60, 17.78, 16.97, 16.15, 15.34, 14.53, 13.73, 12.93, 12.13, 11.35],
  1981: [21.96, 21.15, 20.34, 19.52, 18.70, 17.89, 17.07, 16.26, 15.45, 14.64, 13.83, 13.03, 12.24, 11.45],
  1982: [22.07, 21.26, 20.44, 19.63, 18.81, 18.00, 17.18, 16.37, 15.55, 14.74, 13.94, 13.13, 12.34, 11.55],
  1983: [22.18, 21.37, 20.55, 19.74, 18.92, 18.10, 17.29, 16.47, 15.66, 14.85, 14.04, 13.24, 12.44, 11.65],
  1984: [22.29, 21.47, 20.66, 19.85, 19.03, 18.21, 17.40, 16.58, 15.77, 14.96, 14.15, 13.34, 12.54, 11.75],
  1985: [22.39, 21.58, 20.77, 19.95, 19.14, 18.32, 17.50, 16.69, 15.87, 15.06, 14.25, 13.45, 12.65, 11.85],
  1986: [22.50, 21.69, 20.88, 20.06, 19.24, 18.43, 17.61, 16.79, 15.98, 15.17, 14.36, 13.55, 12.75, 11.96],
  1987: [22.61, 21.80, 20.98, 20.17, 19.35, 18.53, 17.72, 16.90, 16.08, 15.27, 14.46, 13.65, 12.85, 12.06],
  1988: [22.71, 21.90, 21.09, 20.27, 19.45, 18.64, 17.82, 17.00, 16.19, 15.37, 14.56, 13.76, 12.95, 12.15],
  1989: [22.81, 22.00, 21.19, 20.38, 19.56, 18.74, 17.93, 17.11, 16.29, 15.48, 14.67, 13.86, 13.05, 12.25],
  1990: [22.92, 22.11, 21.29, 20.48, 19.66, 18.85, 18.03, 17.21, 16.40, 15.58, 14.77, 13.96, 13.15, 12.35],
  1991: [23.02, 22.21, 21.40, 20.58, 19.77, 18.95, 18.13, 17.31, 16.50, 15.68, 14.87, 14.06, 13.25, 12.45],
  1992: [23.12, 22.31, 21.50, 20.69, 19.87, 19.05, 18.23, 17.42, 16.60, 15.78, 14.97, 14.16, 13.35, 12.55],
  1993: [23.22, 22.41, 21.60, 20.79, 19.97, 19.16, 18.34, 17.52, 16.70, 15.89, 15.07, 14.26, 13.45, 12.65],
  1994: [23.33, 22.52, 21.70, 20.89, 20.07, 19.26, 18.44, 17.62, 16.80, 15.99, 15.17, 14.36, 13.55, 12.74],
  1995: [23.43, 22.62, 21.81, 20.99, 20.18, 19.36, 18.54, 17.72, 16.90, 16.09, 15.27, 14.46, 13.65, 12.84],
  1996: [23.53, 22.72, 21.91, 21.09, 20.28, 19.46, 18.64, 17.82, 17.00, 16.19, 15.37, 14.56, 13.74, 12.94],
  1997: [23.63, 22.82, 22.01, 21.19, 20.38, 19.56, 18.74, 17.92, 17.10, 16.29, 15.47, 14.65, 13.84, 13.03],
  1998: [23.72, 22.92, 22.10, 21.29, 20.48, 19.66, 18.84, 18.02, 17.20, 16.38, 15.57, 14.75, 13.94, 13.13],
  1999: [23.82, 23.01, 22.20, 21.39, 20.57, 19.76, 18.94, 18.12, 17.30, 16.48, 15.66, 14.85, 14.03, 13.22],
  2000: [23.92, 23.11, 22.30, 21.49, 20.67, 19.85, 19.04, 18.22, 17.40, 16.58, 15.76, 14.94, 14.13, 13.32],
  2001: [24.01, 23.21, 22.40, 21.58, 20.77, 19.95, 19.13, 18.31, 17.50, 16.68, 15.86, 15.04, 14.22, 13.41],
  2002: [24.11, 23.30, 22.49, 21.68, 20.87, 20.05, 19.23, 18.41, 17.59, 16.77, 15.95, 15.13, 14.32, 13.50],
  2003: [24.20, 23.40, 22.59, 21.78, 20.96, 20.14, 19.33, 18.51, 17.69, 16.87, 16.05, 15.23, 14.41, 13.60],
  2004: [24.30, 23.49, 22.68, 21.87, 21.06, 20.24, 19.42, 18.60, 17.78, 16.96, 16.14, 15.32, 14.50, 13.69],
  2005: [24.39, 23.59, 22.78, 21.96, 21.15, 20.33, 19.52, 18.70, 17.88, 17.05, 16.23, 15.41, 14.60, 13.78],
};
const FIRST = 1963, LAST = 2005;

/** The helper covers people born from this year on; earlier years have other rules. */
export const HELPER_FROM = FIRST;

/**
 * The age, in months, at which the state pension can be taken without conditions.
 * The law says 67 today. The 2024 pension agreement raises it with life expectancy for people born after 1963,
 * by about one month per birth year. That is not law yet, so this is an estimate (cautious: it only delays the pension).
 */
export function pensionAgeMonths(birthYear, law = LAW) {
  return law.pensionAge * 12 + Math.max(0, Math.round(birthYear) - FIRST) * law.pensionAgeStep;
}

/** Delingstall for a birth year and an age in months. Birth years outside the table use the nearest one in it. */
export function delingstall(birthYear, ageMonths) {
  const row = DELINGSTALL[Math.min(LAST, Math.max(FIRST, Math.round(birthYear)))];
  const pos = Math.min(13, Math.max(0, ageMonths / 12 - 62));
  const i = Math.min(12, Math.floor(pos));
  return row[i] + (row[i + 1] - row[i]) * (pos - i);
}

function stepTax(income, law) {
  let tax = 0;
  law.steps.forEach(([from, rate], i) => {
    const to = i + 1 < law.steps.length ? law.steps[i + 1][0] : Infinity;
    tax += rate * Math.max(0, Math.min(income, to) - from);
  });
  return tax;
}
const social = (income, rate, law) => Math.max(0, Math.min(rate * income, law.socialRamp * (income - law.socialFrom)));

/** Tax for a year on pay alone, with only the standard deductions. For a rough pay-to-take-home estimate. */
export function wageTax(pay, law = LAW) {
  const minste = Math.min(law.minWage[0] * pay, law.minWage[1]);
  return law.incomeTax * Math.max(0, pay - minste - law.personAllowance) + stepTax(pay, law) + social(pay, law.socialWage, law);
}

/** Tax for a year on pension alone, for someone who receives the state pension all year. */
export function pensionTax(pension, law = LAW) {
  const minste = Math.min(law.minPension[0] * pension, law.minPension[1]);
  const c = law.pensionCredit;
  const credit = Math.max(0, c.max - c.rate1 * Math.max(0, Math.min(pension, c.from2) - c.from1) - c.rate2 * Math.max(0, pension - c.from2));
  return Math.max(0, law.incomeTax * Math.max(0, pension - minste - law.personAllowance) + stepTax(pension, law) + social(pension, law.socialPension, law) - credit);
}

/**
 * Yearly state pension, in today's kroner, for someone who stops working in `stopYear`.
 * who: { birthYear, pot, potYear, pay, norwayYears, partner }
 *   pot: your pension pot at NAV. potYear: the year you read it (it holds what you earned up to two years before).
 *   pay: yearly pay before tax, taken as the same every year until you stop.
 *   norwayYears: years lived in Norway between 16 and 66, by the time you are 66 (40 or more gives the full guarantee).
 *   partner: true when you will live with a partner who has a pension or earns more than 2 G.
 * Returns { ageMonths, potAtStart, income, topUp, gross, tax, net }.
 */
export function statePension(who, stopYear, law = LAW) {
  const yearsToAdd = Math.max(0, stopYear - (who.potYear - 1));   // the pot lags two years: add from the year before you read it
  const potAtStart = Math.max(0, who.pot) + yearsToAdd * law.accrual * Math.min(Math.max(0, who.pay), law.accrualCap * law.Gavg);
  const ageMonths = pensionAgeMonths(who.birthYear, law);
  const income = potAtStart / delingstall(who.birthYear, ageMonths);
  const years = who.norwayYears === undefined ? 40 : who.norwayYears;
  const full = (who.partner ? law.guarantee.ordinary : law.guarantee.high) * Math.min(40, Math.max(0, years)) / 40;
  const topUp = years >= 5 ? Math.max(0, full - law.guaranteeCut * income) : 0;
  const gross = income + topUp, tax = pensionTax(gross, law);
  return { ageMonths, potAtStart, income, topUp, gross, tax, net: gross - tax };
}
