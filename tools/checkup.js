#!/usr/bin/env node
// Summarises a backup file from the dashboard (My data > Save a backup file), on your own machine.
// It prints your real numbers to the terminal and writes nothing. Keep the backup file out of git:
// names like money-dashboard-data-2026-11-15.json and anything.private.json are ignored already.
//
//   node tools/checkup.js path/to/money-dashboard-data.json
import { readFile } from 'node:fs/promises';
import { sanitize, planInputs, activePlan } from '../js/store.js';
import { SCENARIOS, LAW, verdict, simulate, needInvest, earliestAge, pensionFor, investable, netWorth, change } from '../js/model.js';
import { sortAll, monthly, wholeMonths, usualMonth, shareOfIncome, unsortedGroups } from '../js/ledger.js';
import { CAT } from '../js/categories.js';
import { nextSteps, checklist } from '../js/guide.js';
import { kr, round500, today, monthName } from '../js/format.js';

const path = process.argv[2];
if (!path) { console.error('Give the path to a backup file saved from the My data page.'); process.exit(2); }
let raw;
try { raw = JSON.parse(await readFile(path, 'utf8')); } catch (e) { console.error(`Could not read ${path}: ${e.message}`); process.exit(1); }
if (!raw || typeof raw !== 'object' || !raw.profile) { console.error('That is not a backup file from the dashboard.'); process.exit(1); }

const s = sanitize(raw), day = today(), pl = activePlan(s), pr = s.profile;
const sorted = sortAll(s.transactions, s.accounts, s.rules), months = monthly(s.transactions, sorted);
const whole = wholeMonths(months, s.transactions, day), usual = usualMonth(whole);
const L = { sorted, months, whole, usual };
const say = (t = '') => console.log(t);
const m = (v) => kr(round500(v));

say(`CHECK-UP ${day}   (rules: ${LAW.year}, ${LAW.status}; backup last changed ${s.meta.saved ? s.meta.saved.slice(0, 10) : 'unknown'})`);

say('\nPLAN: ' + pl.name);
const p = planInputs(s, pl), r = SCENARIOS[pl.scen].r, retAge = Math.max(p.age, pl.retAge);
const v = verdict(p, r, retAge, pl.spend, pl.invest), bad = { ...p, slow: 1 };
say(`  Age ${p.age}. Invests ${kr(pl.invest)} a month, wants to stop at ${retAge} and live on ${kr(pl.spend)} a month. Markets: ${SCENARIOS[pl.scen].name.toLowerCase()}.`);
say(`  Invested today ${kr(p.portfolio)}, of which paid in ${kr(p.basis)}.`);
say(`  Can carry: ${m(v.hard)} a month through a bad first ten years, ${m(v.steady)} with steady growth.`);
say(`  Verdict: ${v.result === 'safe' ? 'holds even through a bad start' : v.result === 'steady' ? 'holds only if growth is steady' : 'does not hold'}.`);
if (v.result !== 'safe') {
  const need = needInvest(bad, r, retAge, pl.spend), ea = earliestAge(bad, r, pl.spend, pl.invest);
  say(`  To hold through a bad start: invest ${need === null ? 'more than is possible' : kr(Math.ceil(need / 500) * 500)} a month, or work until ${ea === null ? 'past 85' : ea}, or live on ${m(v.hard)}.`);
  const out = simulate(v.result === 'steady' ? bad : p, r, retAge, pl.spend, pl.invest).runsOut;
  if (out !== null) say(`  As planned, the money runs out at ${out}${v.result === 'steady' ? ' if the first ten years are bad' : ''}.`);
}
const pen = pensionFor(p, retAge);
say(`  Pension: ${pen.net > 0 ? `${m(pen.net / 12)} a month after tax from age ${pen.start.toFixed(1)}` : 'none entered (the plan is too gloomy without it)'}${pen.typed ? ' (typed figure)' : ` (worked out; ${kr(Math.round(pen.topUp))} of the yearly amount is guarantee pension)`}.`);
say(`  Mortgage: ${kr(pr.mortgagePayment)} a month, ${p.mortgageYearsLeft} years left${p.mortgageBalance ? `, owes ${kr(Math.round(p.mortgageBalance))} at ${p.mortgageRate}%` : ''}.`);
if (pl.side > 0) say(`  Income after stopping: ${kr(pl.side)} a month until ${pl.sideUntil}.`);

say('\nNET WORTH');
const last = s.networth[s.networth.length - 1], prev = s.networth[s.networth.length - 2];
if (!last) say('  No entries.');
else {
  say(`  ${kr(netWorth(last))} on ${last.date} (${s.networth.length} entries). Investments ${kr(investable(last))}, bank ${kr(last.cash)}, home ${kr(last.home)}, debt ${kr(last.debt)}.`);
  if (prev) { const c = change(prev, last); say(`  Since ${prev.date}: net worth ${c.netWorth >= 0 ? '+' : ''}${kr(c.netWorth)}; investments ${c.total >= 0 ? '+' : ''}${kr(c.total)}${c.paidIn === null ? '' : ` (paid in ${kr(c.paidIn)}, market ${c.market >= 0 ? '+' : ''}${kr(c.market)})`}.`); }
}

say('\nSPENDING');
if (!s.transactions.length) say('  No bank files added.');
else {
  say(`  ${s.transactions.length} transactions, ${s.transactions[0].date} to ${s.transactions[s.transactions.length - 1].date}, ${s.accounts.length} account(s), ${s.rules.length} rules of their own.`);
  if (!usual) say('  No whole month yet.');
  else {
    say(`  A usual month (${usual.months} whole months, ${monthName(usual.from)} to ${monthName(usual.to)}): in ${m(usual.income)}, living costs ${m(usual.living)}, mortgage ${m(usual.mortgage)}, investing ${m(usual.investing)}, one-offs ${m(usual.oneoff)}, left ${m(usual.left)}.`);
    say(`  The plan assumes: pay ${kr(pr.takehome)}, living costs ${kr(pr.livingNow)}, investing ${kr(pl.invest)}.`);
    const share = shareOfIncome(usual);
    if (share) say(`  Of every 100 kr in: living ${Math.round(share.living)}, mortgage ${Math.round(share.mortgage)}, investing ${Math.round(share.investing)}, one-offs ${Math.round(share.oneoff)}, left ${Math.round(share.left)}. Kept: ${Math.round(share.kept)}.`);
    const top = Object.entries(usual.cats).filter(([c]) => CAT[c].flow === 'spending' || c === 'loan').sort((a, b) => b[1] - a[1]).slice(0, 8);
    say('  Biggest categories a month: ' + top.map(([c, x]) => `${CAT[c].name} ${m(x)}`).join('; ') + '.');
  }
  const groups = unsortedGroups(s.transactions, sorted);
  if (groups.length) say(`  Not sorted: ${groups.reduce((n, g) => n + g.count, 0)} transactions worth ${kr(groups.reduce((n, g) => n + g.sum, 0))}.`);
}

say('\nDO NEXT (what the Home page shows)');
const steps = nextSteps(s, L, day, 99);
say(steps.length ? steps.map((x) => `  - ${x.text}`).join('\n') : '  Nothing.');

say('\nCHECKLIST (Guide page)');
for (const c of checklist(s)) say(`  [${c.done ? 'x' : c.shown ? '~' : ' '}] ${c.title}`);
say('\n[x] ticked by the user, [~] shown by the numbers. Amounts are rounded to 500 kr.');
