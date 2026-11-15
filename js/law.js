// The Norwegian rules the calculations use: one entry per income year. No DOM, no storage.
// Every number has a source in README.md ("Sources for the rules"). When the national budget changes
// them, add a year here; do not edit an old year. Claude Code: follow .claude/skills/update-rules.
//
// status: 'adopted' = in force for that year. 'proposed' = the government's budget proposal,
// not yet passed by the Storting, so it can still change.

export const LAWS = {
  2025: {
    year: 2025, status: 'adopted',
    incomeTax: 0.22,            // tax on ordinary income (alminnelig inntekt)
    grossUp: 1.72,              // share income is multiplied by this before the 22%
    personAllowance: 108_550,   // personfradrag: ordinary income up to this is not taxed
    wealthFree: 1_760_000,      // wealth tax allowance per person (doubled for spouses)
    wealthRate: 0.010,          // municipality 0.525% + state 0.475%
    wealthHighFrom: 20_700_000, // net wealth above this pays the higher rate
    wealthHighRate: 0.011,
    wealthShare: 0.80,          // shares, equity funds and ASK count at 80%
    homeShare: 0.25,            // the home you live in counts at 25% ...
    homeHighFrom: 10_000_000,   // ... up to this value,
    homeHighShare: 0.70,        // and at 70% above it
    debtCut: 0.20,              // the part of your debt that belongs to shares loses 20% of its deduction
    pensionAge: 67,             // pension age in the law today ...
    pensionAgeStep: 1,          // ... plus this many months per birth year after 1963 (agreed in 2024, not law yet)
    G: 130_160,                 // grunnbeløpet from 1 May
    Gavg: 128_116,              // its average over the calendar year, which is what pension earning uses
    accrual: 0.181,             // share of pay added to the pension pot each year ...
    accrualCap: 7.1,            // ... on pay up to this many G
    guarantee: { high: 242_418, ordinary: 224_248 }, // guarantee pension per year: living alone / with a partner who has income
    guaranteeCut: 0.80,         // the guarantee is reduced by this share of the pot-based pension
    ipsLimit: 15_000,
    inflation: 0.030,           // consumer prices, change over the year
    // Tax on pay and pension, for the pension helper.
    steps: [[217_400, 0.017], [306_050, 0.040], [697_150, 0.137], [942_400, 0.167], [1_410_750, 0.177]],
    socialWage: 0.077, socialPension: 0.051, socialFrom: 99_650, socialRamp: 0.25,
    minWage: [0.46, 92_000], minPension: [0.40, 73_150],
    pensionCredit: { max: 36_000, from1: 276_400, rate1: 0.167, from2: 422_950, rate2: 0.06 },
  },
  2026: {
    year: 2026, status: 'adopted',
    incomeTax: 0.22, grossUp: 1.72, personAllowance: 114_540,
    wealthFree: 1_900_000, wealthRate: 0.010, wealthHighFrom: 21_500_000, wealthHighRate: 0.011, // municipality 0.35% + state 0.65%
    wealthShare: 0.80, homeShare: 0.25, homeHighFrom: 14_000_000, homeHighShare: 0.70, debtCut: 0.20,
    pensionAge: 67, pensionAgeStep: 1, G: 136_549, Gavg: 134_419, accrual: 0.181, accrualCap: 7.1,
    guarantee: { high: 253_787, ordinary: 234_765 }, guaranteeCut: 0.80, ipsLimit: 25_000,
    inflation: 0.033,           // Norges Bank's estimate for the year (September 2026)
    steps: [[226_100, 0.017], [318_300, 0.040], [725_050, 0.137], [980_100, 0.168], [1_467_200, 0.178]],
    socialWage: 0.076, socialPension: 0.051, socialFrom: 99_650, socialRamp: 0.25,
    minWage: [0.46, 95_700], minPension: [0.40, 75_400],
    pensionCredit: { max: 39_100, from1: 294_200, rate1: 0.191, from2: 437_100, rate2: 0.06 }, // as changed in June 2026
  },
  2027: {
    year: 2027, status: 'proposed', // Prop. 1 LS (2026-2027), 7 October 2026
    incomeTax: 0.22, grossUp: 1.72, personAllowance: 120_180,
    wealthFree: 1_990_000, wealthRate: 0.010, wealthHighFrom: 21_500_000, wealthHighRate: 0.011,
    wealthShare: 0.80, homeShare: 0.25, homeHighFrom: 14_000_000, homeHighShare: 0.70, debtCut: 0.20,
    pensionAge: 67, pensionAgeStep: 1, G: 136_549, Gavg: 134_419, accrual: 0.181, accrualCap: 7.1, // G and the guarantee are set each May; last known values kept
    guarantee: { high: 253_787, ordinary: 234_765 }, guaranteeCut: 0.80, ipsLimit: 25_000,
    inflation: 0.026,           // Norges Bank's forecast (September 2026)
    steps: [[235_150, 0.017], [331_050, 0.040], [754_050, 0.137], [1_019_300, 0.168], [1_525_900, 0.178]],
    socialWage: 0.074, socialPension: 0.051, socialFrom: 99_650, socialRamp: 0.25,
    minWage: [0.46, 99_550], minPension: [0.40, 77_950],
    pensionCredit: { max: 40_750, from1: 306_250, rate1: 0.191, from2: 457_550, rate2: 0.06 },
  },
};
for (const law of Object.values(LAWS)) law.gainsTax = law.incomeTax * law.grossUp; // 37.84% on gains taken out of ASK and funds

// SIFO's reference budget: a reasonable level of ordinary spending per month, for the Guide page.
// It leaves out housing, electricity, holidays and eating out. Update with the yearly rules.
export const BENCHMARKS = { year: 2026, single: 12_600, coupleCar: 25_050, familyCar: 38_540 };

export const LAW_YEARS = Object.keys(LAWS).map(Number).sort((a, b) => a - b);
/** The rules for a year. A year later than the newest table gets the newest one, an earlier year the oldest. */
export function lawFor(year) {
  const known = LAW_YEARS.filter((y) => y <= year);
  return LAWS[known.length ? known[known.length - 1] : LAW_YEARS[0]];
}
/** True when the calendar has moved past the newest table: time to run the yearly update. */
export const lawIsOld = (year) => year > LAW_YEARS[LAW_YEARS.length - 1];

// The rules in use today. Everything in the plan is in today's kroner, so today's rules are used for every future year.
export const LAW = lawFor(new Date().getFullYear());
