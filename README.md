# Money dashboard

A personal dashboard for planning and tracking your money in Norway: when you can stop working,
what you can live on, where your money goes, and how your net worth moves. It answers in plain
sentences, and it does the Norwegian tax and pension sums for you. It is a static site with no
server and no build step.

## Your numbers stay with you

- Everything you type, and every bank file you add, is stored in your browser on your device
  (localStorage, and IndexedDB for bank transactions).
- Nothing is sent anywhere. There is no backend, no analytics and no external requests.
- This repository is public and contains **no personal numbers**. Keep it that way: never commit a
  backup file, a bank export or a screenshot with real figures. `npm test` fails if a data file, an
  account number or an e-mail address is about to be committed.
- The browser is the only copy, so keep a backup: **My data > Save a backup file**. In Chrome and Edge
  on a computer you can also choose a file once and have it kept up to date by itself; put it in a
  folder that syncs between your computers and it doubles as the way to move your numbers.
- On iPhone and iPad, add the page to the Home Screen. Safari otherwise removes a site's saved data
  after about a week without use.
- Every site published under the same `<user>.github.io` address shares browser storage. Do not publish
  pages you do not trust from the same GitHub account, or give this site its own domain.

## What is in it

| Page | What it does |
|---|---|
| Home | Where you stand in a few sentences, the few things worth doing now, and this month in the money year. |
| Plan | Three levers (monthly investing, age you stop, living costs) and a plain answer, tested two ways: steady growth and a bad first ten years. Works out your pension, tax and wealth tax year by year. Several named plans, side by side. |
| Net worth | One entry per month. Shows what you paid in and what the market did, and compares with the plan. The Plan page starts from the latest entry. |
| Spending | Reads the transaction files you export from your bank and card, in the browser. Sorts each line into a category with rules you can change, and shows what a usual month costs. One click sends that number to the plan. |
| Budget | Your plan for a normal month, and how each real month went against it. |
| Guide | Money in Norway in plain words: the order to do things in, how savings and pension are taxed, what stopping early costs, the money year, and a word list. |
| My data | Backup, moving to another device, erase, and the rules the calculations use. |

## The monthly routine

About ten minutes, once a month:

1. Export last month's transactions from your bank and credit card (Excel or CSV) and add the files on
   **Spending**. Adding an overlapping period is safe; lines you already have are skipped. Sort
   anything the dashboard did not recognise: one choice covers every line from the same place.
2. Add this month's balances on **Net worth**.
3. Read **Home**, and save a backup file.

## Run it locally

ES modules do not load from `file://`, so serve the folder:

```
npm run serve        # python3 -m http.server 8080
```

Open http://localhost:8080. No install step is needed.

## Tests and tools

```
npm test                                   # Node 20.12 or newer, built-in test runner, no dependencies
npm run bankfile -- path/to/export.xlsx    # how the reader understands a bank file; prints column names and counts only
npm run checkup -- path/to/backup.json     # a summary of a backup file, printed on your own machine
```

Tests cover every calculation and the file reading, with made-up numbers. They run on every push
through GitHub Actions.

## Publish on GitHub Pages

1. Push this folder to a public repository.
2. Settings > Pages > Build and deployment > Deploy from a branch > `main`, `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/`.

The published site is public. That is fine because the code holds no personal data.

## How the plan is calculated

All amounts are in today's kroner. Growth is "above inflation, after fund costs": cautious 1.5%,
middle 4%, good 6% a year. These are averages for savings that are almost all in a low-cost global
index fund. Real years are bumpier, which is what the second test is for.

**Two tests.** The answer is given for steady growth and for a bad first ten years: savings lose 2% a
year to prices for the ten years after you stop, then grow as chosen. Research on long retirements
finds that the first decade decides most of the outcome, and that a flat average return promises too
much: steady growth of 4% lets a plan spend about 5% of the savings a year for 40 to 50 years, while
the historical record supports about 3 to 3.5% before tax. The bad-decade test is about as hard as
having stopped in 1929, 1966, 1972 or 2000, and brings the plan into that range. A market fall in the
year you stop can be added as an extra test.

**While you work:** the portfolio grows, you add your monthly investing, and after the mortgage is
paid off that payment is invested too. Wealth tax is taken from the portfolio.

**After you stop:** each year you take out living costs, plus the mortgage while it runs, plus wealth
tax, minus pension and any income you still have.

- Tax on what you take out: what you paid in comes out tax-free first. Growth after that is taxed
  at 22% x 1.72 = 37.84%. In a year with no pension and no other income, the personal allowance and
  the interest on your mortgage cover part of the growth first (about 66 600 kr with 2026 rules).
- Wealth tax: 1.0% of taxable wealth above 1.9 million kr (1.1% above 21.5 million; doubled limits for
  spouses). With a net worth entry it is worked out from the parts: funds at 80%, the home at 25% (70%
  above 14 million kr), bank and car in full, less debt, where the part of the debt that belongs to
  the funds is deducted at 80%. As the mortgage is paid down, more wealth is taxed. Without an entry,
  the one number you typed for "other taxable wealth" is used.
- Mortgage: with what you owe, the rate and the payment, the loan is followed year by year. Otherwise
  the year you typed is used.

**Pension.** With your pension pot from NAV and your pay, the state pension is worked out for the age
you stop: the pot plus 18.1% of pay (up to 7.1 G) for each year you still work, divided by NAV's
delingstall for your birth year and pension age, topped up by the guarantee pension (cut by 80% of the
pot-based pension, full with 40 years in Norway), less tax on pension income. The pension age is 67 in
the law; the plan uses 67 plus one month per birth year after 1963, which is what Parliament agreed in
2024 but has not yet made law. An employer pension pot, if you give one, grows until the pension age
and is paid out evenly over ten years. Without a pension pot, the yearly figure you typed is used.

**"You can live on X"** is the highest monthly amount for which the money lasts to your chosen age
(default 95). After that age the pension goes on.

### Known simplifications

- Constant yearly growth apart from the two tests.
- One combined portfolio: funds outside ASK, IPS and other investments are treated like ASK. In
  reality funds outside ASK are taxed on each sale, and IPS is locked until 62, has no wealth tax and is
  taxed 22% on the whole payout.
- The tax-free interest on your deposits (skjermingsfradrag) is assumed to keep what you paid in level
  with prices.
- A typed pension figure is used as it is, whatever age you stop. NAV's own forecast assumes you work
  until the pension starts.
- The plan is for one person. Spouses share only the doubled wealth tax allowance.
- AFP, disability, sickness, inheritance, selling the home and moving abroad are not modelled.
- Today's rules are used for every future year. Allowances normally rise with wages, which makes this
  slightly cautious; a tax reform would change it.
- The pension estimate can be up to 10% off. The forecasts for delingstall and the pension age for
  people born in the 1980s and 1990s will move.

This is a planning tool, not tax or financial advice.

## How spending is read

- Files are read in the browser: `.xlsx` with a small built-in reader, and CSV. Columns are found by
  their header names, which covers the common Norwegian bank and card layouts. If a file is not
  recognised you point out the date, description and amount columns once, and it is remembered.
- Money out is negative. Lines the bank has not booked yet are left out. Only the last four digits of
  account numbers are kept, to tell your own accounts apart.
- Each line gets a category. Your own choice wins, then your own rules ("description contains X"),
  then loan payments and transfers recognised from the file, then built-in rules for nationwide chains
  and everyday words. The longest matching text wins.
- Transfers between your own accounts are not spending. A credit card bill counts as living costs only
  until you add the card statement; after that the purchases on the card count instead.
- One-offs (a new roof, a car) are left out of the usual month. The usual month is the average of the
  last 12 whole months in your files.

## Sources for the rules

Checked 15 November 2026. The rules are in `js/law.js`, one entry per year. The 2027 entry is the
government's proposal of 7 October 2026 and is marked as such until Parliament has passed the budget.

- Tax on share income 22% and gross-up factor 1.72: Finansdepartementet, "Skattesatser 2026" and
  "Skattesatser 2027"; Skatteetaten, "Faktor for oppjustering av gevinst/tap eller utbytte på aksjer".
- ASK: deposits can be withdrawn tax-free first, growth is taxed after skjermingsfradrag: skatteloven
  § 10-21; Skatteetaten, "Aksjesparekonto (ASK)". Skjermingsrente 3.6% for 2025.
- Personal allowance 114 540 kr (2026), a general allowance in all ordinary income: Skatteetaten,
  "Personfradrag".
- Wealth tax 2026: allowance 1.9 million kr, 1.0% (municipality 0.35% + state 0.65%), 1.1% above
  21.5 million kr; shares, funds and ASK valued at 80%: Skatteetaten, "Formuesskatt"; skatteloven
  § 4-12. Home at 25% up to 14 million kr, 70% above (changed in June 2026 with effect for 2026):
  Skatteetaten, "Formuesverdi bolig". Debt reduction: skatteloven § 4-19, and the worked example in
  Skatteetaten, "Verdsettingsrabatt ved fastsetting av formue", which is one of the tests.
- Tax on pay and pension 2026 (bracket tax, national insurance contribution, minimum deductions, the
  pension tax credit as changed in June 2026): Finansdepartementet, "Skattesatser 2027" (2026 column);
  Skatteetaten, "Skattefradrag for pensjonsinntekt". Tests reproduce the three pay examples in Prop. 1 LS
  (2026-2027), table 2.1.
- Pension: 18.1% of pay up to 7.1 G (folketrygdloven § 20-5); G 136 549 kr from 1 May 2026 (NAV,
  "Grunnbeløpet"); guarantee pension 253 787 / 234 765 kr and the 80% reduction (folketrygdloven § 20-9
  to § 20-11; Meld. St. 10 (2025-2026)); delingstall (NAV, "Delingstall.xlsx", published 26 June 2026).
  Tests reproduce the thresholds in Meld. St. 6 (2023-2024), figure 10.7.
- Pension age: 67 in folketrygdloven § 20-2. The rise with life expectancy was agreed on 29 February
  2024 (Innst. 233 S (2023-2024)) and is not yet law.
- Inflation: SSB, konsumprisindeksen; Norges Bank, Monetary Policy Report 3/26.
- Spending benchmark on the Guide page: SIFO, Referansebudsjettet 2026.

### What the design rests on

- How much savings can carry over 40 to 60 years, and why the first ten years matter: Early Retirement
  Now, "Safe Withdrawal Rate Series"; Kitces, "Understanding sequence of return risk" (2014);
  Morningstar, "The State of Retirement Income" (December 2025); Pfau, "An International Perspective on
  Safe Withdrawal Rates" (2010), which has 3.13% for a Norway-only investor.
- Growth assumptions: Finans Norge, "Avtale om avkastningsprognoser" (2026: equities 4.5% above
  inflation before costs); Finansdepartementet's 3% expected real return for the Government Pension
  Fund Global.
- The order to do things in, and the money year: Forbrukerrådet and Finansportalen, Skatteetaten, NAV.

Add a year to `LAWS` in `js/law.js` when the national budget changes the rules. With Claude Code, ask it
to "update the rules".

## Working on it with Claude Code

`CLAUDE.md` describes the code and its rules. Three skills in `.claude/skills/` cover the recurring jobs:

- **update-rules**: the yearly update of tax and pension figures from official sources.
- **add-bank-format**: teach the reader a new bank or card file layout, without the file's contents
  ever being printed or committed.
- **money-checkup**: go through your own numbers from a backup file, on your machine, and explain where
  you stand in plain language.
