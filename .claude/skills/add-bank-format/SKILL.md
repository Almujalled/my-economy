---
name: add-bank-format
description: Teach the dashboard's bank-file reader a new export layout, or fix one that reads wrongly. Use this whenever the user says a bank or credit card file will not import, the Spending page "could not find the columns", amounts come in with the wrong sign, dates are wrong, transfers or loan payments are not recognised, or they have switched bank or card. Also use it when the user asks which banks or file types are supported.
---

# Add or fix a bank file layout

The Spending page reads bank and card exports in the browser. It finds the columns by their header
names, so most Norwegian banks work without anyone naming the bank. When a file is not understood, the
page lets the user point out the columns by hand, so they are never blocked; this skill is for making
the reader understand the file by itself next time.

## The one rule: the file is private

A bank export is the most personal file this project touches, and the repository is public. So:

- Work on the file where it is, or have the user put it in `data/` (ignored by git). Never copy it into
  a tracked folder, and never commit an `.xlsx` or `.csv`.
- Do not open it with a file viewer or print its rows. Use `tools/check-bank-file.js`, which prints the
  column names and counts and nothing from inside the file.
- Tests get rows you invent: "Eksempel Butikk", round amounts, account numbers like `1111.22.33333`.
  Never paste a real description, amount, name or account number into a test, a comment or a commit
  message. `tests/privacy.test.js` checks for the obvious slips, but it cannot catch a shop name.
- Do not search the web for anything taken from the file.

## Steps

1. Run the checker and read what it says:

   ```
   node tools/check-bank-file.js data/the-file.xlsx
   ```

   It shows the header line, which column was used for what, how many transactions were read, how many
   were money out, and whether signs were turned around. Compare with what the user expects ("about 80
   lines, mostly purchases, January to March").
2. Decide what is wrong. The usual cases, and where each is fixed in `js/bankfile.js`:
   - **A header the reader does not know.** Add the name, lower-cased with everything but letters and
     digits removed, to the right list in `ROLES`. Earlier names in a list win over later ones.
   - **A card file read as a bank file** (purchases show up as money in, or card bills are counted
     twice). Add a header that only card files have to `CARD_HINTS`.
   - **The wrong column picked** when two fit. Reorder the list in `ROLES`, or add the exact header
     ahead of the general one.
   - **No header line at all.** Leave it to the "which column is which" panel on the Spending page; the
     user's answer is remembered. Guessing columns silently is how wrong numbers get in.
   - **Dates or amounts in a form not seen before.** Extend `parseDate` or `parseAmount`.
   - **A real `.xlsx` that will not open** (the checker says damaged or not-xlsx). The reader in
     `js/xlsx.js` is small on purpose. Find out what the workbook does differently from the checker's
     error and the cases in `tests/xlsx.test.js`, and extend the reader with a test. If a layout truly
     needs more than a small fix, propose vendoring SheetJS into `vendor/` and ask first: it must come
     from cdn.sheetjs.com (the copy on npm is old and has known security holes), and it must not be
     loaded from a CDN at runtime.
3. Add a test to `tests/bankfile.test.js` that builds the same layout with invented rows (see
   `makeXlsx` in `tests/helpers.js`, and the "other Norwegian layouts" test for the pattern). The test
   is what keeps the layout working after the next change.
4. Run `npm test`, then run the checker on the real file again and confirm the counts make sense.
5. If the problem was how transactions are sorted rather than how the file is read (a shop in the wrong
   category, a transfer counted as spending), that is `js/categories.js`: generic default rules for
   nationwide chains and everyday words only. A shop only this user visits belongs in their own rules,
   which they make on the Spending page and which live in their browser.

## How the reading works, for orientation

`js/xlsx.js` unzips the workbook and returns rows. `js/bankfile.js` finds the header (`detectTable`),
turns rows into transactions (`toTransactions`: money out negative, dates as YYYY-MM-DD, pending lines
left out, only the last four digits of account numbers kept), and falls back to layouts the user made
by hand. `js/ledger.js` adds them to what is stored and skips lines already there, so importing
overlapping periods is safe.
