// What to do next, the order to do things in, and the money year. No DOM, no storage.
// The advice follows Norwegian consumer sources (Forbrukerrådet, Finansportalen, Skatteetaten, NAV);
// they are listed in README.md. Amounts come from law.js so the text does not go stale.
import { LAW, lawIsOld } from './law.js';
import { UNSORTED } from './categories.js';

const days = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
const k = (n) => Math.round(n).toLocaleString('nb-NO') + ' kr';

/**
 * The order consumer advisers agree on for spare money. Each step: what to do, and why in one or two sentences.
 * `auto(s)` returns true when your own numbers show the step is in place.
 */
export const CHECKLIST = [
  { id: 'overview', title: 'Know what comes in and what goes out',
    why: 'Everything else builds on this. Add a few months of bank files on the Spending page and you have it.',
    auto: (s) => s.transactions.length > 0 },
  { id: 'card', title: 'Pay the whole credit card bill every month',
    why: 'Interest on card debt is above 20% a year. No saving or investment makes up for that.' },
  { id: 'debt', title: 'Clear consumer loans and card debt, most expensive first',
    why: 'Paying off a loan is a certain return equal to its interest rate. Start with the highest rate.' },
  { id: 'buffer', title: 'Keep a buffer of one to two months of pay in a savings account',
    why: 'So a broken car or a tax bill does not end up on a credit card. Two to three months if you have a house, a car and children. Keep it apart from your everyday account, where it gets spent, and not in funds.',
    auto: (s) => { const last = s.networth[s.networth.length - 1]; return !!last && s.profile.takehome > 0 && last.cash >= s.profile.takehome; } },
  { id: 'taxcard', title: 'Check your tax card each December, and when pay, loan or interest changes',
    why: 'The card does not update itself. A card that is wrong means a tax bill next year, or lending the state money for free.' },
  { id: 'mortgage', title: 'Ask your bank for a better mortgage rate once a year',
    why: 'Long-standing customers pay more than new ones. Half a percentage point is 5 000 kr a year for every million you owe. Compare on Finansportalen and let your bank match the best offer.' },
  { id: 'insurance', title: 'Insure the disasters, not the small things',
    why: 'Home, contents and travel, and your income and the people who depend on it. Skip insurance sold with products, and check that you are not covered twice through work or a union.' },
  { id: 'pensionfees', title: 'Gather your pension accounts with a low-cost provider',
    why: 'See them all at norskpensjon.no. Over 25 years the same money in a fund costing 0.25% a year instead of 0.6% ends up tens of thousands of kroner larger.' },
  { id: 'invest', title: 'Invest a fixed amount on payday in a cheap global index fund, in an aksjesparekonto',
    why: 'For money you will not need for at least five years. What you paid in can be taken out tax-free at any time; only the growth is taxed. The cheapest way to hold a global index fund costs about 0.2% a year, the dearest three times that for the same fund.',
    auto: (s) => { const last = s.networth[s.networth.length - 1]; return !!last && last.ask + last.funds > 0; } },
  { id: 'paydown', title: 'Pay the mortgage as planned, then weigh extra payments against investing',
    why: `Extra payments are a certain return: the interest rate less the ${Math.round(LAW.incomeTax * 100)}% tax deduction. Funds are expected to do better over many years, but not for certain. Advisers suggest getting the loan well under the value of the home first (60 to 75%), and that doing some of both is fine. Never borrow more in order to invest.` },
  { id: 'ips', title: 'Use IPS only for money you will not need before 62',
    why: `Up to ${k(LAW.ipsLimit)} a year gives ${Math.round(LAW.incomeTax * 100)}% back on the tax now, and there is no wealth tax on it. It is locked until 62 and taxed ${Math.round(LAW.incomeTax * 100)}% when paid out, so it cannot pay for the years before that.` },
  { id: 'extras', title: 'Decide in advance where June and December extras go',
    why: 'Holiday pay in June and half tax in December put more in your account than a normal month. Use it in the same order as this list: expensive debt, buffer, investing, then something you enjoy.' },
];

/** The money year for an employee and home owner in Norway. Month number -> what happens and what to do. */
export const CALENDAR = {
  1: { happens: 'The new tax card applies from your first pay.', todo: 'Check the first payslip against the tax card. Set this year\'s monthly investing.' },
  2: { happens: 'Yearly statements arrive from your employer, banks and funds.', todo: 'Check that loans, interest and balances are right. Ask for a correction now, before the tax return is made.' },
  3: { happens: 'The tax return (skattemelding) arrives, some time in March or early April.', todo: 'Open it and check interest paid, debt and the tax value of your home.' },
  4: { happens: 'The tax return must be sent by 30 April. The first tax settlements arrive.', todo: 'Send it, or ask for more time before the deadline. If it shows tax to pay, plan to pay by 31 May.' },
  5: { happens: 'Pay tax owed by 31 May and there is no interest on it. Pay rises often count from May.', todo: 'Pay what the tax return said you owe. Update the tax card if your pay went up.' },
  6: { happens: 'Holiday pay: more than usual lands in your account, with no tax taken. Most tax settlements arrive.', todo: 'Do not budget on June. Use the extra in order: expensive debt, buffer, investing, holiday.' },
  7: { happens: 'A quiet month for bills.', todo: 'Half-year check: is spending near the plan, is the buffer full, did you invest what you meant to?' },
  8: { happens: 'Tax owed from the settlement is due 20 August (the first half, if it is 1 000 kr or more).', todo: 'Pay on time. If the first half is late, the whole amount falls due at once.' },
  9: { happens: 'The second half of tax owed is due 24 September.', todo: 'Ask your bank about the mortgage rate if you have not this year.' },
  10: { happens: 'The government presents next year\'s budget, with new tax rules.', todo: 'Yearly price check: insurance, phone, electricity and subscriptions. Ask Claude Code to update the rules in this dashboard.' },
  11: { happens: 'Some employers take the half-tax month now instead of December.', todo: 'Plan December: an IPS deposit, gifts to charity, an extra mortgage payment.' },
  12: { happens: 'Half tax for most: more pay than usual. The new tax card comes around 15 December. Wealth is counted at midnight on 31 December.', todo: 'Check the new tax card for interest, debt and pay. Make year-end deposits a week early; banks close the books before the 31st.' },
};

/**
 * The few things most worth doing now, from your own data. Most urgent first, at most `max`.
 * s: state. ledger: store.ledger(s). day: 'YYYY-MM-DD'. Returns [{ id, text, link }].
 */
export function nextSteps(s, ledger, day, max = 5) {
  const out = [], add = (id, text, link) => out.push({ id, text, link });
  const last = s.networth[s.networth.length - 1];
  const txs = s.transactions, hasData = txs.length > 0 || s.networth.length > 0;
  const year = +day.slice(0, 4);

  if (!last) add('networth', 'Add your first net worth entry, so the plan starts from real numbers.', '#/networth');
  else if (days(last.date, day) > 35) add('networth', `Add this month's net worth numbers. Your latest entry is ${days(last.date, day)} days old.`, '#/networth');

  if (!txs.length) add('files', 'Add bank files, to see what a month really costs you.', '#/spending');
  else {
    const newest = txs[txs.length - 1].date;
    if (days(newest, day) > 45) add('files', `Add your latest bank files. The ones you have stop at ${newest.slice(8)}.${newest.slice(5, 7)}.${newest.slice(0, 4)}.`, '#/spending');
    let n = 0, sum = 0;
    for (const t of txs) { const c = ledger.sorted.get(t.id); if (c && UNSORTED.has(c.cat) && !t.once) { n++; sum += Math.abs(t.amount); } }
    if (n) add('sort', `Sort ${n} transaction${n === 1 ? '' : 's'} worth ${k(sum)}, so your spending numbers are right.`, '#/spending');
    const u = ledger.usual;
    if (u && u.months >= 3 && Math.abs(Math.round(u.living / 500) * 500 - s.profile.livingNow) >= 1500) {
      add('living', `Your bank files say you live on about ${k(Math.round(u.living / 500) * 500)} a month; your plan uses ${k(s.profile.livingNow)}. Update it on the Spending page.`, '#/spending');
    }
  }
  if (s.profile.pension === 0 && s.profile.pensionPot === 0) add('pension', 'Add your pension pot from NAV. Without it the plan is far too gloomy.', '#/plan');
  if (hasData && (!s.meta.exported || days(s.meta.exported, day) > 30)) {
    add('backup', s.meta.exported ? `Take a backup. Your last one is ${days(s.meta.exported, day)} days old, and your numbers exist only in this browser.` : 'Take a backup. Your numbers exist only in this browser.', '#/data');
  }
  if (lawIsOld(year)) add('rules', `The tax rules in this dashboard are for ${LAW.year}. Ask Claude Code to "update the rules" for ${year}.`, '#/data');
  else if (LAW.status === 'proposed') add('rules', `The ${LAW.year} tax rules here are the government's proposal. Ask Claude Code to "update the rules" now that the budget is passed.`, '#/data');
  return out.slice(0, max);
}

/** Checklist steps with whether each is done: ticked by you, or shown by your numbers. */
export function checklist(s) {
  return CHECKLIST.map((c) => ({ ...c, done: !!s.done[c.id], shown: !!(c.auto && c.auto(s)) }));
}
