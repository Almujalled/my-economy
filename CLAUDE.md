# Money dashboard: notes for Claude Code

A personal finance dashboard for one user in Norway. Static site on GitHub Pages, public repo.
The user wants it to become his go-to place for economy, savings and everything money-related,
and he wants it **simple to read and simple to update**.

## Hard rules

1. **No personal data in the repo, ever.** The repo is public. No real salary, balances, addresses,
   employer names, account numbers, merchant lists taken from his statements, or exported data files.
   Defaults, tests, docs and examples use made-up round numbers. `.gitignore` blocks the usual files; do not weaken it.
2. **No secrets in the repo.** Any future token lives only in the user's browser.
3. **No build step** for now. Plain ES modules that GitHub Pages serves as they are. Propose a build
   tool only if a concrete feature needs it, and ask first.
4. **Calculations stay pure and tested.** Anything that computes money goes in `js/model.js` (or a sibling
   module with no DOM access) and gets a test. Run `npm test` before every commit.
5. **Never put real numbers in commit messages, issues or PR text either.**

## What the app is

It keeps track of spending and investing. Four pages: **Overview** (last month in a sentence, tiles, do next),
**Spending** (usual month and categories from bank files), **Net worth** (what you own and owe each month,
investments against what you put in, and a rough "when can I stop working" age), **Data** (the synced file,
copies, erase). Once a month the user adds one bank file (the account pay comes into) and types one set of values.

The user chose this shape in November 2026, after finding the earlier version (seven pages, a planner with
25 inputs, yearly tax and pension tables) too complicated. Keep it this small. A new feature should replace
something or be clearly worth a place; ask before adding pages, inputs or tables that need yearly updates.

## Layout

```
index.html          import map for the libraries, loads js/app.js into <div id="app">
css/style.css       all styles; colours are CSS variables with light and dark values
vendor/             Preact 10, htm, Chart.js 4, unchanged, at fixed versions (see vendor/README.md)
js/app.js           App: header, nav, hash routes (#/overview, #/spending, #/networth, #/data), file sync start
js/ui.js            html (htm + Preact), hooks, useStore(), useBackup(), download(), NumberField
js/chart.js         ChartBox (Chart.js in a canvas), baseOptions(), color() from CSS variables
js/pages/*.js       one component per page, plus sync-note.js (the note under the header)
js/store.js         state, sanitize() and migration, localStorage + IndexedDB, roughInputs(), ledger(), helpers
js/model.js         GROWTH, LAST_AGE, GAINS_TAX, investable(), netWorth(), change(), pensionAge(), runsOut(), stopAge()
js/todo.js          todo(): the "Do next" list
js/xlsx.js          reads .xlsx with no dependencies (zip + DecompressionStream)
js/bankfile.js      bank and card exports -> transactions: CSV, header detection, dates and amounts, manual layouts
js/categories.js    flows, categories, generic default rules, categorise(), cleanText(), merchantKey()
js/ledger.js        addImport(), sortAll() (transfers, which card a bill pays), monthly(), usualMonth(), unsortedGroups()
js/backup.js        keeps the numbers in a file the user chose, both ways (Chrome and Edge; File System Access API)
js/sync.js          syncStep(): pure decision between saving, taking the file's numbers, and asking
js/db.js, format.js IndexedDB key-value store; kr(), round500(), dates and months in words
tests/*.test.js     node --test, no dependencies; tests/helpers.js builds .xlsx files in memory
tools/*.js          check-bank-file.js (structure only, no contents), checkup.js (summary of a copy, printed locally)
.claude/skills/     add-bank-format, money-checkup
```

Everything in `js/` except `app.js`, `ui.js`, `chart.js`, `db.js`, `backup.js` and `pages/` is pure and tested.

## State (localStorage key `money-dashboard-v1`, transactions in IndexedDB `money-dashboard`)

```
{ schema: 3,
  profile: { birthYear, pension (a month, after tax), mortgageEndYear, spend, invest, mortgage },  // 0 = not given
  networth: [{ date, ask, funds, ips, other, cash, home, car, debt, putIn (total put in so far | null), note }],
  accounts: [{ id, name, kind: 'bank'|'card', tail, sig }],
  imports:  [{ id, file, acct, date, from, to, count }],
  rules:    [{ id, match, cat }],
  layouts:  [{ headerRow, cols, kind, header }],
  transactions: [{ id, date, text, amount, acct, imp, type?, mcat?, memo?, principal?, interest?, peer?, cat?, once? }],
  meta: { exported, saved } }
```

- All writes go through `store.update(fn)` or `store.replace(obj)`; both save and notify. `update` stamps
  `meta.saved`; the file sync compares that stamp with the file's and with the last shared one
  (localStorage `money-dashboard-v1-synced`). Never save to the file without looking at it first, and never
  let an empty browser overwrite a file: both rules live in `syncStep()` and its tests.
- `sanitize()` accepts anything and returns a valid state. Schemas 1 and 2 (the old planner) are migrated
  there: pension a year becomes a month, `livingNow`/plan invest/`mortgagePayment` become `spend`/`invest`/
  `mortgage`, per-entry `paidIn` becomes the running total `putIn`. When the schema changes, bump `SCHEMA`,
  migrate inside `sanitize()`, and add a test with an old-format object.
- Transactions are only written to IndexedDB when the array is replaced. Never change one in place: use
  `importParsed`, `patchTransactions`, `removeImport`, `flipImport`, or assign a new array.
- Store years and dates, not ages. Categories and sums are worked out when shown, from `store.ledger()`;
  a transaction stores a category only when the user chose it (`cat`), and `once` for a one-off.
- A card bill is living costs until the card it pays has purchases in the files; `sortAll()` learns which
  card a bill pays from payments that matched money arriving on a card. A card with no export never gets a
  file, so its bill must keep counting when other cards are added. The user adds only the main account.

## Writing pages

- Components return `html\`...\``. Text in templates is escaped by Preact; never use `dangerouslySetInnerHTML`.
- Read state with `useStore()` and write through `store.*`. Typed numbers that save as you type use
  `NumberField`, so half-typed numbers are not overwritten.
- Charts go through `ChartBox` with `baseOptions()`. One colour per thing, the same everywhere:
  investing = `--accent`, living costs = `--live`, mortgage = `--mort`, what you put in = `--muted` dashed.
  Every chart has its numbers in a table or sentence nearby.
- A new library goes in `vendor/` the same way (registry download, checksum, unchanged file, README row).

## Voice and design

- Sentence case, plain verbs, no finance jargon ("what you put in", not "cost basis").
- Lead with the answer as a sentence; monthly amounts rounded to 500 kr with `kr()` (nb-NO), today's kroner.
- Light and dark; must work at 390 px wide. Empty states say what to do next; errors say what happened and how to fix it.

## The rough age

- `stopAge()` is the first age from which the investments pay for living costs and mortgage until
  `LAST_AGE` (95), with the pension from `pensionAge()`. Monthly amounts come from the usual month when the
  files give one, otherwise from what was typed.
- `GROWTH` is 2.5% a year above prices, on purpose: across made-up cases it matches 4% with a bad first ten
  years (minus 2% a year) to within a year nine times in ten. A flat 4% promises ages about three years
  early. Do not raise it, and do not bring back a FIRE number, a withdrawal rate or a probability of success:
  the user found those confusing. Research behind this is in
  `.claude/skills/money-checkup/references/norway-money.md`.
- `GAINS_TAX` (22% times 1.72) is the only tax figure. Check it when a national budget changes share taxation.
- The pension age for people born after 1963 is an estimate (agreed in 2024, not law). The page says so.

## Commands

```
npm test                                   # run tests (Node 20.12+); includes the privacy guard
npm run serve                              # http://localhost:8080
npm run bankfile -- path/to/export.xlsx    # how the reader understands a bank file (prints no contents)
npm run checkup -- path/to/copy.json       # summary of a private copy, printed locally
```
