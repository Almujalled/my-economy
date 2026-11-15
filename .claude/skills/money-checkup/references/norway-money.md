# Personal money in Norway: what the advice rests on

Researched 15 November 2026 from official and consumer sources, named in each section. Amounts and
rates that change yearly live in `js/law.js`; read them there (or run the update-rules skill) rather
than quoting the examples here. Sections: 1 order of operations, 2 tax on savings, 3 pension, 4 what
stopping early costs, 5 how much savings can carry, 6 mortgage or investing, 7 investing basics,
8 pay through the year, 9 what the plan does not count, 10 where to check.

## 1. The order consumer sources agree on

Forbrukerrådet/Finansportalen, DNB, KLP, Nordnet and Nordea give nearly the same list:

1. Know what comes in and goes out.
2. Pay the credit card in full; clear card debt and consumer loans, highest rate first. Card interest
   averaged 22.7% in 2026 (SSB), so nothing else competes.
3. A buffer of one to two months of pay in a separate savings account; two to three months with house,
   car and children (DNB, KLP, Nordnet; Nordea says one to three). Not in the everyday account and not
   in funds.
4. Tax card right (check each December and when pay, loan or rate changes). Skatteetaten: 1.2 million
   people owed back tax in 2026, 43 200 kr on average.
5. Mortgage rate: ask or move yearly. Long-standing customers pay about 0.2 points more than new ones
   (Forbrukerrådet, September 2026). Half a point is 5 000 kr a year per million owed.
6. Insure the disasters (home, contents, travel; income and dependants), drop double cover
   (Forbrukerrådet's checklist).
7. Pension accounts gathered with a low-fee provider (norskpensjon.no; Finansportalen's fee check).
8. Monthly saving in a cheap global index fund in an aksjesparekonto, for money not needed for five
   years or more.
9. Mortgage as planned until the loan is a comfortable share of the home's value (DNB says 60%, KLP
   75%), then weigh extra payments against investing.
10. IPS only for money certainly not needed before 62.

Where they differ: KLP puts the buffer before debt; the others put expensive debt first. BSU is only
for people up to 33 who do not own a home.

## 2. Tax on savings

- **Share income** is taxed at 22% of the amount multiplied by 1.72, so 37.84% of the gain
  (Skatteetaten). Unchanged in the 2027 proposal; the 2026 tax commission proposed no change to it.
- **Aksjesparekonto (ASK)**: no tax on sales or dividends inside it. Withdrawals count as your own
  deposits first, tax-free (skatteloven § 10-21). Beyond the deposits, everything taken out is gain. A
  loss can only be deducted by closing the account. Moving it between providers is tax-free when the
  receiving provider does it. Cash in it earns no interest and gets no wealth tax discount.
- **Skjermingsfradrag**: each year a small return is tax-free, set from the interest rate (3.6% for
  2025, 3.9% for 2024, 3.2% for 2023). It is worked out on the lowest deposit balance during the year,
  and unused shielding carries forward. The model treats this as keeping deposits level with prices.
- **Personal allowance against gains.** The personfradrag applies to all ordinary income, capital
  income included. With no pay and no pension, gains up to personfradrag / 1.72 a year are untaxed
  (about 66 600 kr with 2026 rules), and mortgage interest shelters more. This follows from the quoted
  rules; no official worked example was found. A pension of about 190 000 kr or more uses the whole
  allowance.
- **Funds outside ASK**: each sale is taxed on the gain of the units sold, oldest first. Equity funds
  37.84%, interest funds 22%, mixed funds split.
- **Wealth tax** (2026): 1.0% of net taxable wealth above 1.9 million per person, 1.1% above 21.5
  million; doubled limits for spouses. Shares, funds and ASK count at 80%; the home you live in at 25%
  up to 14 million and 70% above; bank deposits in full; debt is deducted, except that the part of the
  debt that belongs to shares (by their share of gross assets) is deducted at 80% (skatteloven § 4-19).
  IPS and occupational pension are exempt.
- **Interest on debt** is deducted in ordinary income: 22% back, no cap.
- **IPS**: 25 000 kr a year from 2026, 22% deduction, no tax on returns, no wealth tax, locked to 62,
  paid over at least ten years and to at least 80, the whole payout taxed 22%.
- **No inheritance tax.** The heir takes over the cost basis (continuity).
- **Moving abroad**: exit tax on unrealised gains above 3 million kr, ASK included, payable over 12
  years; it lapses if you move back within 12 years.
- **Policy risk**: the tax commission (NOU 2026: 9) proposed removing the valuation discounts (funds
  and the home at 100%), a wealth tax rate between 0.25 and 0.75%, a separate allowance per home, and a
  pension tax credit only from 67. The government promised a reform paper early in 2027. Nothing is
  adopted.

## 3. Pension

- **State pension** (born 1963 or later): 18.1% of pay up to 7.1 G is added to a pot each year from 13
  to 75. The pot follows wage growth. Yearly pension = pot / delingstall for your birth year and age
  (NAV publishes the table each June; forecasts for younger cohorts).
- **Guarantee pension**: a floor (253 787 kr living alone, 234 765 kr with a partner who has income, from
  May 2026), cut by 80% of the pot-based pension, full with 40 years of residence between 16 and 66.
  Inside that zone a year of work adds only a fifth of what it adds above it, so stopping early costs
  less state pension than people expect: in a made-up example (born 1985, pot 2.5 million, pay 800 000)
  the net pension is about 287 000 kr stopping at 41 and 342 000 kr working to 67.
- **Pension age**: 67 in the law (folketrygdloven § 20-2). The 2024 agreement raises it with life
  expectancy from the 1964 cohort, about one month per birth year; not law as of November 2026, and the
  ministry says the rise starts in 2027 at the earliest. NAV withdrew its forecast table. Earliest
  withdrawal (62 today, with a large enough pot) is meant to rise with it. Someone who stops at 50
  usually cannot draw before the ordinary age.
- **Pension in payment** rises with the average of wages and prices, so it keeps its buying power.
- **Tax on pension** (2026): nothing up to about 294 200 kr; then high marginal tax (about 50%) up to
  437 100 kr while the pension tax credit is withdrawn. `pensionTax` in `js/pension.js` reproduces the
  Ministry's examples.
- **Occupational pension**: employer saves at least 2% of pay, at most 7% (plus 18.1% between 7.1 and
  12 G). A third of members are on 2%. The pot is yours on leaving, stays invested at your cost, and is
  paid from 62 at the earliest over at least ten years and to at least 77, taxed as pension.
- **Private AFP**: lifelong, about 64 000 kr a year on average for new recipients in 2025. Needs seven
  of the last nine years before 62 in an AFP company and employment there at 62 and at the time of the
  claim. All or nothing: leave before 62 and there is none. A reform is discussed, not agreed.
- **NAV's calculator** shows amounts in today's kroner before tax and assumes the last reported income
  continues until the pension starts. It has no "stop working at" field; setting expected income to 0
  under "Endre inntekt" gives the stop-now figure. The pot is under "Din pensjonsopptjening".

## 4. What stopping work early costs besides pay

- Pension earning stops (state and employer). AFP is lost if there is one.
- No sick pay (it needs four weeks of work first) and no holiday pay.
- Unemployment benefit needs recent income and real job seeking; resigning without good reason gives
  nothing for 18 weeks. It is not a bridge.
- Disability benefit is 66% of the best three of the last five years' income, up to 6 G. After about
  five years without pay it is the minimum (2.329 G with a partner, 2.529 G alone). Employer-paid
  insurance ends.
- Kept: health care (user fees are capped), the earned pension and the guarantee pension, and
  membership of the national insurance scheme while living in Norway.

## 5. How much savings can carry

- The "4% rule" is from 30-year periods in US data, before tax and fees (Bengen; the Trinity study).
- Over 40 to 60 years the supported range is about 3 to 3.5% of the starting savings a year: Early
  Retirement Now finds about 3.25% fail-safe for 60 years on US history; Morningstar (December 2025)
  gives 3.0 to 3.3% for 40 years at 90% confidence; Pfau found 3.13% for a Norway-only investor over 30
  years. Broad international samples are lower still.
- The first ten years decide most of it: the real return in the first decade correlates about 0.8 with
  what a retirement could sustain, the 30-year average about 0.4 (Kitces).
- This is why the dashboard tests "a bad first ten years": minus 2% a year above inflation for ten
  years, then the chosen growth. That is about the 5th percentile of US decades since 1871 and close to
  stopping in 1929, 1966, 1972 or 2000. A plan passing that test lands on the research range. A flat 4%
  a year implies spending about 5% of savings yearly, which history does not support.
- The three growth scenarios (1.5, 4 and 6% above inflation, after fund costs) are roughly a
  one-in-seven bad, a middle, and a one-in-four good average. Finans Norge's standard for pension
  forecasts is 4.5% for equities before costs (2026); the state assumes 3% for its 70/30 fund.
- What helps, by evidence: lower spending from the start; a lifelong income floor (the state pension);
  some income in the first years (100 000 kr a year replaces about 3 million kr of savings); a more
  stable part of the portfolio in the years around stopping (small effect). What does not: a cash
  bucket as a cure, living on dividends, vague flexibility. Rescuing a too-high start has historically
  meant cutting about 30% for a decade or more.
- Do not present a probability of success. It hides how bad a failure is and invites false precision.
- 95 is a reasonable planning age but not a cautious one: on SSB's projections roughly one man in four
  and one woman in three aged 45 today may live past it (own estimate from SSB's tables). After the
  savings, the pension remains.

## 6. Mortgage or investing

- An extra payment is a certain return equal to the loan rate less the 22% deduction. At rates around
  5.3 to 5.6% in late 2026 that is about 4.1 to 4.4% nominal.
- A fund must beat that after its own tax to win; over long periods equities are expected to, but not
  with certainty. DNB: repay to about 60% of the home's value before prioritising funds; KLP: under 75%;
  Nordnet: doing both is sensible. Nobody recommends borrowing more to invest, or interest-only above
  60% in order to invest.
- Wealth tax barely moves the comparison (at most about 0.2% a year).
- For someone close to stopping work, a smaller loan lowers the fixed monthly need, which is the best
  protection in a bad decade. Paying down the loan is also a better "safe part" than a bond fund.
- Annuity loans keep the payment level; when the floating rate changes, the bank normally recalculates
  the payment to keep the end date. Fixed-rate loans can cost money to repay early.

## 7. Investing basics

- Forbrukerrådet: a global index fund, the cheapest one, as the default; horizon at least five years.
  Its 2018 analysis found most active global funds behind the index after costs and no persistence
  among winners.
- Cost: the same global index fund costs about 0.2% a year at the cheapest seller and 0.6% at the
  dearest (Forbrukerrådet, October 2026; Finansportalen now compares total price). Every 1% in yearly
  cost removes roughly a tenth or more of what the savings can pay out.
- No currency hedging for the equity part (Nordnet; the krone tends to weaken in crises). Keep the
  stable part in kroner. Do not extrapolate the last decade's gain from a weaker krone.
- Rebalancing frequency hardly matters. Once a year is enough.
- Deposit guarantee: 2 million kr per person per bank; foreign branch banks 100 000 euro.

## 8. Pay through the year

- Tax is collected over 10.5 months: no withholding on holiday pay (usually June) and half withholding
  on one pay before Christmas (December for most). Ten months are "normal", June and December pay more.
- Budget on the normal month and treat the two extras as planned money, in the same order as section 1.
- Calendar: tax card mid-December; tax return in March or April, deadline 30 April; pay tax owed by 31
  May to avoid interest; settlement mostly by June; back tax due 20 August and 24 September; G from
  1 May; budget proposal early October.

## 9. What the dashboard's plan does not count

Say so when it matters for the user in front of you:

- IPS is treated like ASK (in reality locked to 62, taxed differently, no wealth tax).
- Funds outside ASK are treated like ASK (in reality each sale realises some gain).
- A typed pension figure is used as it is, whatever the stop age.
- The employer pension pot is paid out evenly over ten years from the pension age.
- One person's plan: spouses share only the doubled wealth tax allowance.
- No AFP, no disability or sickness, no inheritance, no sale of the home, no moving abroad.
- Rules as they are today for every future year.
- Growth is smooth apart from the bad-decade and crash tests.

## 10. Where to check

- Tax rates and rules: skatteetaten.no (rate pages take `?year=`), regjeringen.no "Skattesatser
  <year>", lovdata.no for the law text.
- Pension: nav.no/alderspensjon, nav.no/grunnbelopet, nav.no/levealdersjustering, norskpensjon.no,
  afp.no.
- Consumer advice and prices: forbrukerradet.no/finansportalen (loans, savings accounts, funds,
  pension fees), oslomet.no/om/sifo/referansebudsjettet.
- Benefits: nav.no/sykepenger, /dagpenger, /uforetrygd, /aap.
- Evidence on withdrawals: earlyretirementnow.com (safe withdrawal series), kitces.com, Morningstar's
  "State of Retirement Income".
