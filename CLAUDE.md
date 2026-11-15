# Money dashboard: notes for Claude Code

A personal finance dashboard for one user in Norway. Static site on GitHub Pages, public repo.
The user wants it to become his go-to place for economy, savings and everything money-related,
and he wants it **simple to read and simple to update**. He rejected two earlier Excel versions
as too complex. Plain language and few inputs matter more than features.

## Hard rules

1. **No personal data in the repo, ever.** The repo is public. No real salary, balances, addresses,
   employer names, account numbers, merchant lists taken from his statements, or exported data files.
   Defaults, tests, docs and examples use made-up round numbers. `.gitignore` blocks the usual files; do not weaken it.
2. **No secrets in the repo.** Any future token (see Sync) lives only in the user's browser.
3. **No backend, no analytics, no third-party requests at runtime** unless the user asks. If a library is
   needed, vendor it into the repo rather than loading it from a CDN.
4. **No build step** for now. Plain ES modules that GitHub Pages serves as they are. Propose a build
   tool only if a concrete feature needs it, and ask first.
5. **Calculations stay pure and tested.** Anything that computes money goes in `js/model.js` (or a sibling
   module with no DOM access) and gets a test. Run `npm test` before every commit.
6. **Never put real numbers in commit messages, issues or PR text either.**

## Layout

```
index.html            shell: header, nav, <main id="view">
css/style.css         all styles; colours are CSS variables with light and dark values
js/app.js             hash router (#/home, #/plan, #/networth, #/spending, #/budget, #/guide, #/data), re-renders on store changes
js/store.js           state, localStorage + IndexedDB, sanitize(), planInputs(), ledger(), transaction and rule helpers
js/db.js              tiny key-value wrapper on IndexedDB (transactions, backup file handle)
js/backup.js          keeps the numbers in a file the user chose, in step both ways (Chrome and Edge only; File System Access API)
js/sync.js            syncStep(): pure decision between saving, taking the file's numbers, and asking
js/law.js             LAWS: one entry of tax and pension rules per year, LAW (this year's), BENCHMARKS
js/model.js           SCENARIOS, SLOW, simulate(), maxSpend(), needInvest(), earliestAge(), verdict(), wealth tax, loans, netWorth(), planPath()
js/pension.js         DELINGSTALL, statePension(), pensionTax(), wageTax(), pensionAgeMonths()
js/xlsx.js            reads .xlsx with no dependencies (zip + DecompressionStream)
js/bankfile.js        bank and card exports -> transactions: CSV, header detection, dates and amounts, manual layouts
js/categories.js      flows, categories, generic default rules, categorise(), cleanText(), merchantKey()
js/ledger.js          addImport() with duplicate skipping, sortAll(), monthly(), wholeMonths(), usualMonth(), unsortedGroups()
js/guide.js           CHECKLIST, CALENDAR, nextSteps(): the "what to do next" logic
js/format.js          kr(), rounding, esc(), today(), month and date words
js/charts.js          lineChart() and barChart(): small SVG charts with a hover and keyboard readout, no dependencies
js/pages/*.js         one module per page, each exports mount(root) -> { update(), destroy()? }
tests/*.test.js       node --test, no dependencies; tests/helpers.js builds .xlsx files in memory
tools/*.js            command-line helpers: check-bank-file.js (structure only, no contents), checkup.js (summary of a backup file)
.claude/skills/       update-rules, add-bank-format, money-checkup
```

Everything except `app.js`, `db.js`, `backup.js`, `charts.js` and `pages/` is pure (no DOM, no storage) and tested.

### State (localStorage key `money-dashboard-v1`, transactions in IndexedDB `money-dashboard`)

```
{ schema: 2,
  profile: { birthYear, takehome, livingNow, portfolio, basis, basisDate,
             mortgagePayment, mortgageEndYear, mortgageBalance, mortgageRate, mortgageAsOf,
             pension, pensionPot, pensionPotYear, grossPay, norwayYears, workPot, workRate,
             horizon, otherWealth, couple },
  plans: [{ id, name, invest, retAge, spend, scen (0..2), crash, side, sideUntil }],
  activePlan: id,
  networth: [{ date:'YYYY-MM-DD', ask, funds, ips, other, cash, home, car, debt, paidIn (number|null), note }],
  accounts: [{ id, name, kind:'bank'|'card', tail (last 4 digits or ''), sig }],
  imports:  [{ id, file, acct, date, from, to, count }],
  rules:    [{ id, match, cat }],                    // the user's own "description contains X" rules
  layouts:  [{ headerRow, cols, kind, header }],     // column choices for files the reader did not recognise
  transactions: [{ id, date, text, amount, acct, imp, type?, mcat?, memo?, principal?, interest?, peer?, cat?, once? }],
  done: { checklistId: 'YYYY-MM-DD' },
  meta: { exported, saved } }
```

- All writes go through `store.update(fn)` or `store.replace(obj)`; both save and notify the page.
- `store.update` stamps `meta.saved` with the moment of the change. File sync compares that stamp with the
  file's and with the stamp both last shared (localStorage key `money-dashboard-v1-synced`). Loading a file
  goes through `store.replace`, which keeps the file's stamp. Never save to the file without looking at it
  first, and never let an empty browser overwrite a file: both rules live in `syncStep()` and its tests.
- Transactions are only written to IndexedDB when the array itself is replaced. Never change a transaction
  in place: use `store.importParsed`, `patchTransactions`, `removeImport`, `flipImport`, or assign a new array.
- `sanitize()` must accept any input and return a valid state. When the schema changes, bump `SCHEMA`,
  migrate inside `sanitize()`, and add a test with an old-format object.
- Store years and dates (birthYear, mortgageEndYear, basisDate, mortgageAsOf, pensionPotYear), not ages or
  "years left", so data stays right over time. Numbers typed on one day are rolled forward from that day.
- The Plan page uses the latest net worth entry for the portfolio and for wealth tax when one exists.
- Rules, categories and amounts are worked out when shown, from `store.ledger()`. A transaction stores a
  category only when the user chose it by hand (`cat`), and `once` when it is a one-off.
- A card bill is living costs until the card it pays has purchases in the files. `sortAll()` learns which
  card a bill pays from payments that matched money arriving on a card. A card with no export never gets
  a file, so its bill must keep counting when other cards are added: there are tests for this.

### Page pattern

`mount(root)` builds the DOM once and wires listeners. `update()` only refreshes computed output,
so typing in an input never loses focus. Escape any user text with `esc()` before putting it in HTML:
that includes transaction text, file names, account names and rule text. Chart labels are inserted as
markup, so pass only text the app made.

## Voice and design

- Sentence case, plain verbs, no finance jargon in the UI ("what you paid in", not "cost basis").
- Lead with the answer as a sentence; numbers rounded to 500 kr for monthly amounts.
- Amounts formatted with `kr()` (nb-NO). Everything in today's kroner.
- Keep the existing palette and components; support light and dark; must work at 390 px wide.
- Empty states say what to do next. Errors say what happened and how to fix it.
- Say "a bad first ten years" and "steady growth", never "sequence risk" or a withdrawal rate. Answer panels are green
  (holds through a bad start), amber (holds only with steady growth, or does not hold) and say which in words.
- Charts: one colour per thing, the same everywhere (investing = accent, living costs = `--live`, mortgage = `--mort`).
  Prefer one series and ranked bars to many colours. Every chart has its numbers in a table or sentence nearby.

## Roadmap

Done: spending from bank exports, monthly budget, deeper net worth, planner refinements (pension helper,
mortgage balance and rate, yearly rule tables, the bad-decade test, tax per year), a Home page and a Guide.

Open, in the order they matter:

1. **Sync on phones and in other browsers.** The user chose (November 2026) to try the file in a synced folder first.
   It is built: `js/backup.js` saves to a file the user picks and reads it back, and `syncStep()` in
   `js/sync.js` decides between saving, taking the file's numbers, and asking when both changed. It only
   works in Chrome and Edge on a computer, the file is not encrypted, and it has been tested against the
   browser's private file store, not a real synced folder. If phones or Firefox are needed later, the
   earlier idea still stands and needs the user's go-ahead: a separate *private* GitHub repo holding one
   data file, read and written through the GitHub API with a fine-grained token limited to that repo,
   encrypted in the browser (WebCrypto AES-GCM, key derived from a passphrase). Token and passphrase
   would live only in the browser.
2. **A partner in the plan.** The planner is for one person. Spouses share only the doubled wealth tax
   allowance today; a second pension and a second set of accounts are not modelled.
3. **IPS and funds outside ASK as their own pots** (locked to 62, taxed differently). Small for most people.
4. **Card bills and transfers as suggestions** the user confirms, if automatic pairing ever guesses wrong.
5. **Fund costs**: let the user say what their funds cost, and lower the growth by what is above 0.25%.

## Model notes

- Read `README.md`, "How the plan is calculated", for the rules and the known simplifications.
- `LAWS` in `js/law.js` holds one entry per year with sources in the README. Never edit numbers from memory:
  use the update-rules skill, which reads them from official pages. An entry is `'proposed'` until
  Parliament has passed the budget.
- The answer is "money lasts to the horizon", not a safe-withdrawal-rate rule. Do not reintroduce a FIRE
  number as the headline; the user found it confusing. No probability of success either.
- The headline is tested two ways and both are always shown: steady growth, and a bad first ten years
  (`SLOW`). A plan is 'safe' only when it holds through the bad start. This is deliberate: a flat average
  return promises about 5% of savings a year, and the research supports 3 to 3.5%. Do not go back to
  answering from the middle scenario alone.
- The pension age for people born after 1963 is an estimate (agreed in 2024, not law). The pages say so.
- Research behind the model and the advice is summarised with sources in
  `.claude/skills/money-checkup/references/norway-money.md`.

## Commands

```
npm test                                   # run tests (Node 20.12+); includes the privacy guard
npm run serve                              # http://localhost:8080
npm run bankfile -- path/to/export.xlsx    # how the reader understands a bank file (prints no contents)
npm run checkup -- path/to/backup.json     # summary of a private backup file, printed locally
```
