# Money dashboard

A personal dashboard for planning and tracking your money in Norway: how much you can spend,
how hard you need to save, and how your net worth moves. It is a static site with no server
and no build step.

## Your numbers stay with you

- Everything you type is stored in your browser (localStorage) on your device.
- Nothing is sent anywhere. There is no backend, no analytics and no external requests.
- This repository is public and contains **no personal numbers**. Keep it that way:
  never commit an exported data file, a bank export or a screenshot with real figures.
- To move your data to another device, use **My data > Export**, then **Import** there.

## What is in it

| Page | Status | What it does |
|---|---|---|
| Plan | Working | Three levers (monthly investing, age you stop, living costs) and a plain answer: what you can live on, and what it takes to close the gap. Several named plans, compared side by side. |
| Net worth | Working | One entry per month, change since last time, chart. The Plan page starts from the latest entry. |
| Spending | Not built | Will read a bank export in the browser and sort it into categories. |
| My data | Working | Export, import, erase. Shows the tax rules in use. |

## Run it locally

ES modules do not load from `file://`, so serve the folder:

```
npm run serve        # python3 -m http.server 8080
```

Open http://localhost:8080. No install step is needed.

## Tests

```
npm test             # Node 20+, built-in test runner, no dependencies
```

Tests cover the calculations in `js/model.js` and the data checks in `js/store.js`.
They run on every push through GitHub Actions.

## Publish on GitHub Pages

1. Push this folder to a public repository.
2. Settings > Pages > Build and deployment > Deploy from a branch > `main`, `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/`.

The published site is public. That is fine because the code holds no personal data.

## How the plan is calculated

All amounts are in today's kroner. Growth is "above inflation": cautious 1.5%, middle 4%, good 6% a year.

- While you work: the portfolio grows, you add your monthly investing, and after the mortgage
  is paid off that payment is invested too.
- After you stop: each year you take out living costs, plus the mortgage while it runs,
  plus wealth tax, minus pension from 67.
- Tax on withdrawals: what you paid in comes out tax-free first. Gains after that are taxed
  at 22% x 1.72 = 37.84%.
- Wealth tax: 1% of (80% of the portfolio + other taxable wealth - 1.9 million kr).
- "You can live on X" is the highest monthly amount for which the money lasts to your chosen age (default 95).

Known simplifications: constant yearly growth (use the crash test for a bad start), one combined
portfolio (funds outside ASK, IPS and other investments are treated like ASK), skjermingsfradrag is
assumed to roughly offset inflation on your deposits, and the 1.1% wealth tax step above 21.5 million kr
is ignored. This is a planning tool, not tax or financial advice.

## Sources for the rules (2026)

- Tax on share income 22% and gross-up factor 1.72: Finansdepartementet, "Skattesatser 2026".
- ASK: deposits can be withdrawn tax-free first, gains taxed after skjermingsfradrag: Skatteetaten, "Aksjesparekonto (ASK)".
- Skjermingsrente 3.6% for 2025: Skatteetaten, "Skjermingsrente for aksjer og enkeltpersonforetak".
- Wealth tax allowance 1.9 million kr, rate 1.0%, shares/funds/ASK valued at 80%: Skatteetaten, "Formuesskatt" (satser 2026).

Update `LAW` in `js/model.js` when the national budget changes these.
