# Where each figure comes from

Checked 15 November 2026. Pages move; if one is gone, search the same site for the Norwegian term.

## Per-year fields in `LAWS` (js/law.js)

| Field | Norwegian term | Source |
|---|---|---|
| `incomeTax`, `grossUp` | skatt på alminnelig inntekt, oppjusteringsfaktor | regjeringen.no "Skattesatser <year>"; skatteetaten.no/satser/faktor-for-oppjustering-av-gevinsttap-eller-utbytte-pa-aksjer/?year=<year> |
| `personAllowance` | personfradrag | regjeringen.no "Skattesatser <year>"; skatteetaten.no/satser/personfradrag/?year=<year> |
| `wealthFree`, `wealthRate`, `wealthHighFrom`, `wealthHighRate` | formuesskatt: bunnfradrag, satser, trinn 2 | skatteetaten.no/satser/formuesskatt/?year=<year>. Rate = municipality + state. |
| `wealthShare`, `debtCut` | verdsettingsrabatt aksjer, gjeldsreduksjon | skatteloven § 4-12 and § 4-19 on lovdata.no; skatteetaten.no "Verdsettingsrabatt ved fastsetting av formue" (has the worked example used as a test) |
| `homeShare`, `homeHighFrom`, `homeHighShare` | formuesverdi primærbolig | skatteetaten.no/satser/formuesverdi-bolig/?year=<year> |
| `steps` | trinnskatt | regjeringen.no "Skattesatser <year>" |
| `socialWage`, `socialPension`, `socialFrom`, `socialRamp` | trygdeavgift, nedre grense, opptrappingssats | regjeringen.no "Skattesatser <year>"; skatteetaten.no/satser/trygdeavgift/?year=<year> |
| `minWage`, `minPension` | minstefradrag i lønn / i pensjon | regjeringen.no "Skattesatser <year>" |
| `pensionCredit` | skattefradrag for pensjonsinntekt | skatteetaten.no/satser/skattefradrag-for-pensjonsinntekt/?year=<year> |
| `G`, `Gavg` | grunnbeløpet, gjennomsnittlig G | nav.no/grunnbelopet |
| `accrual`, `accrualCap` | pensjonsopptjening 18,1 %, 7,1 G | folketrygdloven § 20-5; nav.no/alderspensjon |
| `guarantee`, `guaranteeCut` | garantipensjon ordinær og høy sats, avkorting 80 % | nav.no/alderspensjon; the yearly "Regulering av pensjoner" white paper (Meld. St.) on regjeringen.no; folketrygdloven § 20-9 to § 20-11 |
| `pensionAge` | aldersgrense for ubetinget uttak | folketrygdloven § 20-2 on lovdata.no |
| `ipsLimit` | maksimalt fradrag IPS | skatteetaten.no/satser/maksimalt-arlig-fradrag-for-innbetaling-til-individuell-pensjonsordning/ |
| `inflation` | KPI, tolvmånedersvekst og anslag | ssb.no konsumprisindeksen (past years: the yearly average change); Norges Bank's latest Monetary Policy Report, table of projections (current and next year) |

## Worked examples to test against

- Tax at three pay levels, and the tax-free pension level: Prop. 1 LS for the budget year, chapter 2
  (table "Skatt på lønnsinntekt" or similar). The 2026 values are in `tests/pension.test.js`.
- Wealth tax with debt reduction: Skatteetaten's page on verdsettingsrabatt (in `tests/model.test.js`).
- Guarantee pension thresholds: Meld. St. 6 (2023-2024), figure 10.7 (in `tests/pension.test.js`).

## Not per year

| What | Source |
|---|---|
| `DELINGSTALL` (js/pension.js) | NAV, nav.no/levealdersjustering, file "Delingstall.xlsx". One sheet has final values for cohorts that have turned 61, one has forecasts. Take the value at whole ages 62 to 75 for birth years 1963 to 2005. |
| Pension age by birth year | Not law as of November 2026. Watch regjeringen.no (Arbeids- og inkluderingsdepartementet) for the consultation paper and bill following the 2024 pension agreement (Innst. 233 S (2023-2024)), and nav.no/alderspensjon. |
| `BENCHMARKS` | SIFO referansebudsjett, oslomet.no/om/sifo/referansebudsjettet (published each spring). |
| Bad-decade test and growth scenarios | Not yearly. Background: Finans Norge "Avtale om avkastningsprognoser" (equities 4.5% real before costs in 2026), the Ministry of Finance's 3% expected real return for the Government Pension Fund Global, and the research summarised in README. Change only when the user asks. |

## Traps met before

- The Ministry's "Skattesatser 2026" page and Skatteetaten's December "Forskuddsutskrivingen" still
  showed the December figures after Parliament changed the pension tax credit and the home valuation
  limit in June 2026.
- 2027 figures presented in October are a proposal. In 2026 the negotiating deadline was 20 November and
  the final vote was reported for 15 December.
- The skjermingsrente for a year is set in January of the following year. The model does not use it as a
  constant (it assumes it roughly keeps deposits level with prices); do not add it as one.
- NAV withdrew its forecast table of pension ages in 2025. Secondary sites still quote older, higher
  forecasts.
- Smarte Penger and bank pages are good for cross-checking and for plain wording, not as the source.
