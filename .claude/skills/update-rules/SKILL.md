---
name: update-rules
description: Update the Norwegian tax, wealth tax and pension figures this dashboard calculates with (js/law.js and js/pension.js) from official sources. Use this whenever the user asks to "update the rules", mentions a new tax year, the national budget (statsbudsjettet), a changed tax rate or allowance, the yearly G adjustment, new delingstall or a new pension age, or when the dashboard's Home or My data page says the rules are old or only proposed. Also use it before telling the user that any figure in js/law.js is still right.
---

# Update the rules

The dashboard answers "can I stop working at 55?" with Norwegian tax and pension rules that change on a
known calendar. The user is not a finance expert and trusts these figures, so a wrong or stale constant
quietly produces a wrong answer. That is why every figure is read from an official page during this
session and never taken from memory: rules have been changed in the middle of a year before (in June 2026
both the pension tax credit and the home valuation limit changed with effect from 1 January).

## When each thing changes

| When | What | Do |
|---|---|---|
| Early October | The government proposes next year's budget | Add next year to `LAWS` with `status: 'proposed'` |
| Mid to late December | Parliament passes the budget | Check every figure again, set `status: 'adopted'` |
| Around 20 May | G is set from 1 May; guarantee pension follows | Update `G`, `Gavg`, `guarantee` for the current year |
| May to June | Revised budget can change the current year | Re-check the current year; note a mid-year change in a comment |
| Late June | NAV publishes delingstall | Replace `DELINGSTALL` in `js/pension.js` if the numbers moved |
| May | SIFO publishes the reference budget | Update `BENCHMARKS` in `js/law.js` |

If the user just says "update the rules", work out which of these apply from today's date and from
`status` and `year` in `js/law.js`.

## Steps

1. Read `js/law.js`, `js/pension.js` and the "Sources for the rules" section of `README.md`, so you know
   every field and where it came from last time.
2. For each field, open the source listed in `references/sources.md` and find the figure for the year in
   question. Keep the short quote you found it in; you will need it for the README and for the user.
   Prefer Skatteetaten's per-rate pages with `?year=` and the Ministry's "Skattesatser" page for the
   year. Treat a page dated before a budget settlement or a revised budget as possibly stale.
3. Add the year as a new entry in `LAWS`. Do not edit an earlier adopted year, except to correct an error
   or to apply a change that was adopted with effect for that year; say which in a comment. Every year
   has the same fields (a test enforces it), so copy the previous year and change what changed.
4. Set `status`. A proposal is `'proposed'` until Parliament has voted; the pages show it to the user as
   such.
5. Check the things that are not per-year:
   - `pensionAgeStep` and the comment above `pensionAgeMonths` in `js/pension.js`. In November 2026 the
     higher pension age was agreed but not law. If the law or an official table of pension age by birth
     year now exists, replace the one-month-per-year estimate with the table and update the wording on
     the Plan and Guide pages, which call it an estimate.
   - The facts written out in words in `js/guide.js` and `js/pages/guide.js` (credit card interest level,
     fund costs, the average AFP amount, the 18-week rule, the years named for the bad-decade test).
     Search those files for digits and re-check each against `references/sources.md`.
6. Run `npm test`. Then add the new year's official worked examples as a test in
   `tests/pension.test.js`: the budget proposition has a table of tax at a few pay levels, and those
   three numbers prove the tax table was typed correctly. If they do not reproduce, a figure is wrong.
7. Update "Sources for the rules" in `README.md` with the year and the pages used.
8. Tell the user in plain words what changed and what it does to a plan, for example "the wealth tax
   allowance went up by 90 000 kr, which is 900 kr less tax a year for someone above it". Say clearly
   which figures you could not confirm and what you left unchanged.

## What is not a constants update

If the rules change shape (for example the 2026 tax commission's proposal to drop the valuation
discounts and lower the wealth tax rate, or a new way to earn AFP), the model in `js/model.js` has to
change, with tests. Explain the change to the user first and agree on it; do not squeeze a new rule into
an old field.

## Privacy

Searches and page fetches for this task are generic. Never put the user's name, numbers or the
repository name in a search or a URL. Commit messages describe rules, not anyone's money.
