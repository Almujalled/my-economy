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
js/app.js             hash router (#/plan, #/networth, #/spending, #/data), re-renders on store changes
js/store.js           state, localStorage, sanitize(), planInputs(), export/import helpers
js/model.js           LAW, SCENARIOS, simulate(), maxSpend(), needInvest(), earliestAge(), netWorth()
js/format.js          kr(), rounding, esc(), today()
js/charts.js          lineChart(svg, series, opts): small SVG chart, no dependencies
js/pages/*.js         one module per page, each exports mount(root) -> { update() }
tests/*.test.js       node --test, no dependencies
```

### State (localStorage key `money-dashboard-v1`)

```
{ schema: 1,
  profile: { birthYear, takehome, livingNow, portfolio, basis, mortgagePayment, mortgageEndYear, pension, horizon, otherWealth },
  plans: [{ id, name, invest, retAge, spend, scen (0..2), crash }],
  activePlan: id,
  networth: [{ date:'YYYY-MM-DD', ask, funds, ips, other, cash, home, car, debt, note }] }
```

- All writes go through `store.update(fn)` or `store.replace(obj)`; both save and notify the page.
- `sanitize()` must accept any input and return a valid state. When the schema changes, bump `SCHEMA`,
  migrate inside `sanitize()`, and add a test with an old-format object.
- Store years (birthYear, mortgageEndYear), not ages or "years left", so data stays right over time.
- The Plan page uses the latest net worth entry as the portfolio when one exists.

### Page pattern

`mount(root)` builds the DOM once and wires listeners. `update()` only refreshes computed output,
so typing in an input never loses focus. Escape any user text with `esc()` before putting it in HTML.

## Voice and design

- Sentence case, plain verbs, no finance jargon in the UI ("what you paid in", not "cost basis").
- Lead with the answer as a sentence; numbers rounded to 500 kr for monthly amounts.
- Amounts formatted with `kr()` (nb-NO). Everything in today's kroner.
- Keep the existing palette and components; support light and dark; must work at 390 px wide.
- Empty states say what to do next. Errors say what happened and how to fix it.

## Roadmap (in the order the user asked for)

1. **Spending from bank exports.** Read the file in the browser (never upload).
   - His bank exports .xlsx. Checking account columns: `Utført dato` (dd.mm.yyyy), `Beskrivelse`, `Type`,
     `Undertype`, `Beløp inn`, `Beløp ut`, `Melding/KID/Fakt.nr` (loan payments carry `Avdrag:` and `Renter:` amounts here).
     Credit card columns: `TransactionDate`, `Text`, `Amount`, `Merchant Category`. Support CSV too.
   - Vendor a parser (for example SheetJS) into `vendor/`; do not load it from a CDN.
   - Each transaction gets a flow (Income, Spending, Investing, Debt service, Transfer, One-off) and a category.
     Rules are "description contains X -> category". Ship only generic default rules (grocery chains, the word
     "Lønn", and so on). His own rules are data: stored in state, editable in the UI, never in the repo.
   - Transfers between his own accounts, card-bill payments (when card statements are also imported, to avoid
     double counting) and one-offs must not count as spending.
   - Output: spending per month and category, 12-month average, and a button "Use this as my living costs".
   - Storage: transactions can outgrow localStorage; move to IndexedDB behind the same store API when adding this.
2. **Monthly budget.** Take-home, mortgage, investing target, what is left; actual versus plan per month.
3. **Net worth, deeper.** Contributions versus market gains per month, per-account history, plan-versus-actual line.
4. **Sync between devices.** Suggested design, confirm with the user before building: a separate *private*
   GitHub repo holding one data file, read and written through the GitHub API with a fine-grained token limited
   to that one repo. Encrypt the file in the browser (WebCrypto AES-GCM, key derived from a passphrase) so the
   token alone cannot read it. Token and passphrase live only in the browser. Manual export/import stays as the fallback.
5. **Planner refinements.** Pension estimate helper, mortgage balance and rate instead of an end year,
   yearly `LAW` tables, a bad-decade stress test, and showing wealth tax and withdrawal tax per year.

## Model notes

- Read `README.md`, "How the plan is calculated", for the rules and the known simplifications.
- `LAW` holds 2026 values with sources in the README. Check current rules before changing them; the 2027
  budget proposed a wealth tax allowance of 1.99 million kr.
- The answer is "money lasts to the horizon", not a safe-withdrawal-rate rule. Do not reintroduce a FIRE number
  as the headline; the user found it confusing.

## Commands

```
npm test          # run tests
npm run serve     # http://localhost:8080
```
