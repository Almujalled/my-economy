#!/usr/bin/env node
// Shows how the reader understands a bank or card export, WITHOUT printing what is in it.
// Only the column names and counts are shown: no descriptions, no amounts, no account numbers.
// So the output is safe to read, paste and discuss. The file itself must never be committed.
//
//   node tools/check-bank-file.js path/to/export.xlsx [more files]
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { openBankFile, detectTable, toTransactions, guessLayout, parseDate, parseAmount } from '../js/bankfile.js';

const kind = (v) => (v === null || v === undefined || v === '' ? '-' : parseDate(v) !== null ? 'date' : parseAmount(v) !== null ? 'number' : 'text');
const letter = (i) => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));
// A header cell is a short label. Anything with digits in it, or long, could be an account number or a name from a
// line above the table, so it is not shown.
const label = (c) => { const t = String(c ?? ''); return /\d/.test(t) || t.length > 32 ? '(hidden)' : t; };

const files = process.argv.slice(2);
if (!files.length) { console.error('Give the path to one or more bank files.'); process.exit(2); }
let failed = false;
for (const path of files) {
  console.log(`\n== ${basename(path)}`);
  let tables;
  try { tables = await openBankFile(await readFile(path)); }
  catch (e) { console.log(`   Could not open it: ${e.code || e.message}`); failed = true; continue; }
  for (const t of tables) {
    console.log(`   ${t.name ? `Sheet "${t.name}"` : 'Text file'}: ${t.rows.length} rows`);
    const table = detectTable(t.rows);
    if (!table) {
      failed = true;
      const guess = guessLayout(t.rows);
      const first = Math.max(0, guess.headerRow + 1);
      console.log('   NOT RECOGNISED. No header line with a date, a description and an amount column was found.');
      console.log(`   First line with a date: line ${first + 1}. Header line: ${guess.headerRow >= 0 ? `line ${guess.headerRow + 1}` : 'none'}.`);
      if (guess.headerRow >= 0) console.log(`   Header cells: ${t.rows[guess.headerRow].map((c, i) => `${letter(i)}="${label(c)}"`).join('  ')}`);
      console.log(`   What the columns hold in the first lines: ${(t.rows[first] || []).map((c, i) => `${letter(i)}=${kind(c)}`).join('  ')}`);
      console.log(`   Best guess: date in ${guess.cols.date === undefined ? '?' : letter(guess.cols.date)}, description in ${guess.cols.text === undefined ? '?' : letter(guess.cols.text)}, amount in ${guess.cols.amount === undefined ? '?' : letter(guess.cols.amount)}.`);
      continue;
    }
    const header = t.rows[table.headerRow];
    const res = toTransactions(t.rows, table);
    console.log(`   Header on line ${table.headerRow + 1}: ${header.map((c) => `"${label(c)}"`).join(', ')}`);
    console.log(`   Read as a ${table.kind === 'card' ? 'credit card' : 'bank account'} file. Columns used:`);
    for (const [role, col] of Object.entries(table.cols)) console.log(`     ${role.padEnd(11)} <- "${label(header[col])}"`);
    const unused = header.map((c, i) => [c, i]).filter(([c, i]) => c && !Object.values(table.cols).includes(i)).map(([c]) => `"${label(c)}"`);
    if (unused.length) console.log(`   Columns not used: ${unused.join(', ')}`);
    const out = res.txs.filter((x) => x.amount < 0).length;
    console.log(`   ${res.txs.length} transactions from ${res.from} to ${res.to}: ${out} money out, ${res.txs.length - out} money in.`);
    console.log(`   Left out: ${res.pending} not booked yet, ${res.skipped} without a date or amount.`
      + ` Signs turned around: ${res.flipped ? 'yes' : 'no'}. Account number found: ${res.accountTail ? 'yes' : 'no'}.`
      + ` Loan payments with interest and repayment split: ${res.txs.filter((x) => x.interest !== undefined).length}.`);
    if (!res.txs.length) failed = true;
  }
}
console.log('\nNothing from inside the files was printed: only column names and counts.');
process.exit(failed ? 1 : 0);
