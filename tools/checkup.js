#!/usr/bin/env node
// Summarises a copy of your numbers from the dashboard (Data > Save a copy, or the file you keep them in),
// on your own machine. It prints your real numbers to the terminal and writes nothing. Keep the file out of git:
// names like money-dashboard-data-2026-11-15.json and anything.private.json are ignored already.
//
//   node tools/checkup.js path/to/money-dashboard-data.json
import { readFile } from 'node:fs/promises';
import { sanitize, roughInputs } from '../js/store.js';
import { GROWTH, LAST_AGE, investable, netWorth, grown, change, stopAge, runsOut } from '../js/model.js';
import { sortAll, monthly, wholeMonths, usualMonth, shareOfIncome, unsortedGroups } from '../js/ledger.js';
import { CAT } from '../js/categories.js';
import { todo } from '../js/todo.js';
import { kr, round500, today, monthName } from '../js/format.js';

const path = process.argv[2];
if (!path) { console.error('Give the path to a copy saved from the Data page.'); process.exit(2); }
let raw;
try { raw = JSON.parse(await readFile(path, 'utf8')); } catch (e) { console.error(`Could not read ${path}: ${e.message}`); process.exit(1); }
if (!raw || typeof raw !== 'object' || !raw.profile) { console.error('That is not a copy from the dashboard.'); process.exit(1); }

const s = sanitize(raw), day = today(), pr = s.profile;
const sorted = sortAll(s.transactions, s.accounts, s.rules), months = monthly(s.transactions, sorted);
const whole = wholeMonths(months, s.transactions, day), usual = usualMonth(whole);
const L = { sorted, months, whole, usual };
const say = (t = '') => console.log(t);
const m = (v) => kr(round500(v));

say(`CHECK-UP ${day}   (copy last changed ${s.meta.saved ? s.meta.saved.slice(0, 10) : 'at an unknown time'})`);

say('\nSPENDING');
if (!s.transactions.length) say('  No bank files added.');
else {
  say(`  ${s.transactions.length} transactions, ${s.transactions[0].date} to ${s.transactions[s.transactions.length - 1].date}, ${s.accounts.length} account(s), ${s.rules.length} rules of their own.`);
  if (!usual) say('  No whole month yet.');
  else {
    say(`  A usual month (${usual.months} whole months, ${monthName(usual.from)} to ${monthName(usual.to)}): in ${m(usual.income)}, living costs ${m(usual.living)}, mortgage ${m(usual.mortgage)}, investing ${m(usual.investing)}, one-offs ${m(usual.oneoff)}, left ${m(usual.left)}.`);
    const share = shareOfIncome(usual);
    if (share) say(`  Of every 100 kr in: living ${Math.round(share.living)}, mortgage ${Math.round(share.mortgage)}, investing ${Math.round(share.investing)}, one-offs ${Math.round(share.oneoff)}, left ${Math.round(share.left)}. Kept: ${Math.round(share.kept)}.`);
    const top = Object.entries(usual.cats).filter(([c]) => CAT[c].flow === 'spending' || c === 'loan').sort((a, b) => b[1] - a[1]).slice(0, 8);
    say('  Biggest categories a month: ' + top.map(([c, x]) => `${CAT[c].name} ${m(x)}`).join('; ') + '.');
  }
  const groups = unsortedGroups(s.transactions, sorted);
  if (groups.length) say(`  Not sorted: ${groups.reduce((n, g) => n + g.count, 0)} transactions worth ${kr(groups.reduce((n, g) => n + g.sum, 0))}.`);
}

say('\nNET WORTH');
const last = s.networth[s.networth.length - 1], prev = s.networth[s.networth.length - 2];
if (!last) say('  No values yet.');
else {
  const g = grown(last);
  say(`  ${kr(netWorth(last))} on ${last.date} (${s.networth.length} sets of values). Investments ${kr(investable(last))}${g === null ? '' : ` (put in ${kr(last.putIn)}, grown ${kr(g)})`}, bank ${kr(last.cash)}, home ${kr(last.home)}, debt ${kr(last.debt)}.`);
  if (prev) { const c = change(prev, last); say(`  Since ${prev.date}: net worth ${c.netWorth >= 0 ? '+' : ''}${kr(c.netWorth)}; investments ${c.total >= 0 ? '+' : ''}${kr(c.total)}${c.putIn === null ? '' : ` (put in ${kr(c.putIn)}, market ${c.market >= 0 ? '+' : ''}${kr(c.market)})`}.`); }
}

say('\nWHEN CAN THEY STOP WORKING (rough, as the Net worth page shows it)');
const p = roughInputs(s, L, day);
if (!p) say('  No birth year given.');
else {
  const age = stopAge(p);
  say(`  Age ${p.age}. Investments ${kr(p.worth)}, of which put in ${kr(p.putIn)}. Spends ${m(p.spend)} and invests ${m(p.invest)} a month (${p.months ? `from ${p.months} whole months of bank files` : 'typed'}); mortgage ${m(p.mortgage)} a month ${p.mortgageEndAge === Infinity ? 'with no end year given (counted for life)' : p.mortgageEndAge > p.age ? `until age ${p.mortgageEndAge}` : p.mortgageEndAge ? '(paid off by the year given)' : '(none)'}.`);
  say(`  Pension ${p.pension ? `${m(p.pension)} a month after tax` : 'not given (too gloomy without it)'} from ${p.pensionAge.toFixed(2)}.`);
  say(`  Answer: ${age === null ? 'not before 75' : age <= p.age ? 'could stop now' : `can stop at ${age}`} (growth ${GROWTH * 100}% a year above prices, money to ${LAST_AGE}).`);
  for (const r of [0.02, 0.04]) {
    const a = stopAge(p, r);
    say(`  With ${r * 100}% growth instead: ${a === null ? 'not before 75' : a}.`);
  }
  if (age !== null && age > p.age) say(`  Stopping one year earlier, at ${age - 1}, the money runs out at ${runsOut(p, age - 1)}.`);
}

say('\nDO NEXT (what the Overview page shows)');
const steps = todo(s, L, day, false);
say(steps.length ? steps.map((x) => `  - ${x.text}`).join('\n') : '  Nothing.');
say('\nAmounts a month are rounded to 500 kr.');
