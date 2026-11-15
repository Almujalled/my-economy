# Money dashboard

Keeps track of your spending and your investing, for one person in Norway. Once a month you add the
transactions from your main bank account and type what you own and owe. In return you see where the
money went, how your investments grow against what you put in, and roughly when you could stop
working. It is a static site with no server and no build step.

## Your numbers stay with you

- Everything you type, and every bank file you add, is stored in your browser on your device. You can
  also keep it in a file you choose (see below). Nothing is sent anywhere.
- This repository is public and contains **no personal numbers**. Keep it that way: never commit a
  copy of your numbers, a bank export or a screenshot with real figures. `npm test` fails if a data
  file, an account number or an e-mail address is about to be committed.
- On iPhone and iPad, add the page to the Home Screen. Safari otherwise removes a site's saved data
  after about a week without use.
- Every site published under the same `<user>.github.io` address shares browser storage. Do not publish
  pages you do not trust from the same GitHub account, or give this site its own domain.

## The pages

| Page | What it shows |
|---|---|
| Overview | Last month in a sentence, how much of your pay you kept, your net worth, and what to do next. |
| Spending | What a usual month costs and where it goes, by category, from your bank files. Sort the places it does not recognise once, and they stay sorted. |
| Net worth | What you own and owe, month by month; your investments against what you put in; and the age you could stop working at this pace. |
| Data | Where your numbers are kept, the file that keeps several computers in step, copies, and starting over. |

## Once a month

1. Export last month's transactions from the account your pay comes into and your bills are paid from
   (Excel or CSV), and add the file on **Spending**. That one account is enough: what you pay to a
   credit card counts as living costs, as one sum. Add a card's own file only if you want what you
   bought with it sorted. Overlapping periods are safe; lines you already have are skipped.
2. Sort anything new the dashboard did not recognise.
3. Type this month's values on **Net worth**.

## The same numbers on several computers

In Chrome and Edge on a computer, the dashboard can keep your numbers in a file in a folder that syncs
between your computers (OneDrive, Dropbox, iCloud Drive, Google Drive). On the first computer choose
**Data > Start a new file**; on the others **Data > Use a file I already have**. From then on it saves
to the file a few seconds after every change and takes in changes made elsewhere. It looks at the file
before every save: if only the file has changed it takes the file's numbers, and if both have changed
it asks which to keep and saves the other set to your Downloads folder. An empty browser never
overwrites the file. The file has no password, so anyone who can open the folder can read it.

Elsewhere, use **Data > Save a copy** and **Open a copy**.

## How the numbers are worked out

**Spending.** Files are read in the browser: `.xlsx` with a small built-in reader, and CSV. Columns are
found by their header names, which covers the common Norwegian layouts; for a file it does not know,
you point out the columns once. Only the last four digits of account numbers are kept. Each line gets
a category: your own choice first, then your own rules ("description contains X"), then loan payments
and transfers recognised from the file, then built-in rules for nationwide chains and everyday words.
Moves between your own accounts are not spending. A payment to a credit card counts as living costs
until that card's own file is added; after that the purchases on the card count instead. One-offs (a
new roof, a car) are left out of the usual month, which is the average of the last 12 whole months.

**Net worth.** Investments are ASK, funds and shares outside ASK, IPS and other investments. "Put in so
far" is everything you have paid into them over the years, without growth; the page fills it in from
the last value plus what your bank files show moved into investments since.

**When you can stop working.** The first age from which your investments pay for your living costs and
mortgage until you are 95, with your pension taking over part of it. It uses:

- spending, mortgage and investing from your bank files (the usual month), or what you typed before
  you have files;
- your investments and what you put in, from your latest values;
- the pension a month after tax that you type, from NAV and your employers' schemes. It starts at 67
  plus about a month per birth year after 1963: Parliament agreed to that in 2024, but it is not law;
- growth of **2.5% a year above prices**, while you work and after. That is careful on purpose. The
  research on how much savings can carry over 40 to 60 years lands at about 3 to 3.5% of the savings a
  year, and the first ten years after you stop decide most of it. Across a spread of made-up cases,
  2.5% gives the same age as assuming 4% a year with a bad first ten years (minus 2% a year) to within
  a year in nine cases out of ten. A flat 4% would promise ages about three years too early;
- tax on growth taken out: 37.84% (22% times 1.72), after what you put in has come out tax-free.

It leaves out wealth tax (the careful growth makes some room for it), AFP, a lower pension if you stop
early (use NAV's figure for that age if you can), and changes in your spending later in life. It is a
rough answer: it moves when your numbers do.

## Run it, test it, publish it

ES modules do not load from `file://`, so serve the folder:

```
npm run serve                              # python3 -m http.server 8080, then open http://localhost:8080
npm test                                   # Node 20.12 or newer, built-in test runner, no dependencies
npm run bankfile -- path/to/export.xlsx    # how the reader understands a bank file; column names and counts only
npm run checkup -- path/to/copy.json       # a summary of a copy of your numbers, printed on your own machine
```

Tests cover the calculations, the file reading and the sync decisions, with made-up numbers, and run on
every push through GitHub Actions. To publish: Settings > Pages > Deploy from a branch > `main`,
`/ (root)`. The site is public, which is fine because the code holds no personal data.

The pages are built with [Preact](https://preactjs.com) and [htm](https://github.com/developit/htm),
and the charts with [Chart.js](https://www.chartjs.org). Copies are in `vendor/`, at fixed versions;
see `vendor/README.md`. Nothing is loaded from other servers.

This is a tracking tool, not tax or financial advice.

## Sources

- Tax on growth from ASK and funds, 22% times 1.72: Finansdepartementet, "Skattesatser 2026";
  Skatteetaten, "Aksjesparekonto (ASK)" and "Faktor for oppjustering av gevinst/tap eller utbytte på aksjer".
- Pension age: 67 in folketrygdloven § 20-2; the rise with life expectancy was agreed on 29 February
  2024 (Innst. 233 S (2023-2024)) and is not yet law.
- How much savings can carry, and why the first ten years matter: Early Retirement Now, "Safe Withdrawal
  Rate Series"; Kitces, "Understanding sequence of return risk" (2014); Morningstar, "The State of
  Retirement Income" (December 2025); Pfau, "An International Perspective on Safe Withdrawal Rates"
  (2010). Growth: Finans Norge, "Avtale om avkastningsprognoser" (2026).

## Working on it with Claude Code

`CLAUDE.md` describes the code and its rules. Two skills in `.claude/skills/`:

- **add-bank-format**: teach the reader a new bank or card file layout, without the file's contents
  ever being printed or committed.
- **money-checkup**: go through your own numbers from a copy, on your machine, and explain where you
  stand in plain language.
