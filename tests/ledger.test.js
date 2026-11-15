// Tests for sorting transactions and adding them up. All shops, people and amounts are invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, CAT, FLOWS, DEFAULT_RULES, categorise, prepareRules, cleanText, merchantKey, haystack, ruleLabel } from '../js/categories.js';
import { addImport, sortAll, monthly, wholeMonths, usualMonth, shareOfIncome, unsortedGroups, bigPurchases, investedBetween, addMonths, coverage } from '../js/ledger.js';

const tx = (date, text, amount, extra = {}) => ({ date, text, amount, ...extra });
const cat = (t, ctx) => categorise(t, ctx).cat;

test('every category belongs to a known flow and every default rule to a known category', () => {
  const flows = new Set(FLOWS.map((f) => f.id));
  for (const c of CATEGORIES) assert.ok(flows.has(c.flow), c.id);
  assert.equal(new Set(CATEGORIES.map((c) => c.id)).size, CATEGORIES.length);
  for (const r of DEFAULT_RULES) { assert.ok(CAT[r.cat], r.m); assert.equal(r.m, r.m.toLowerCase(), r.m); }
  for (let i = 1; i < DEFAULT_RULES.length; i++) assert.ok(DEFAULT_RULES[i - 1].m.length >= DEFAULT_RULES[i].m.length);
});

test('generic default rules sort everyday Norwegian transactions', () => {
  const cases = [
    ['REMA 1000 SENTRUM', -300, 'groceries'], ['Kiwi 123 Eksempelgata', -120, 'groceries'], ['VINMONOPOLET', -400, 'groceries'],
    ['Espresso House', -55, 'eatingout'], ['FOODORA', -250, 'eatingout'], ['Circle K Eksempel', -700, 'transport'],
    ['AutoPASS bompenger', -350, 'transport'], ['Vitusapotek', -200, 'health'], ['Tannlege Eksempel', -1200, 'health'],
    ['Eksempel barnehage', -3000, 'children'], ['Netflix.com', -129, 'leisure'], ['Telenor Norge', -399, 'telecom'],
    ['Gjensidige Forsikring', -900, 'insurance'], ['Strøm og nettleie', -1500, 'power'], ['Kommunale avgifter', -4000, 'housing'],
    ['IKEA', -2500, 'homeware'], ['Elkjøp', -5000, 'homeware'], ['Frisør Eksempel', -700, 'health'], ['Europris', -200, 'other'], ['Scandic Hotel', -1800, 'travel'], ['Zalando', -700, 'clothes'],
    ['Minibank uttak', -500, 'cash'], ['Årsavgift kort', -300, 'other'], ['Nordnet Bank', -5000, 'invest'], ['Overføring til sparekonto', -2000, 'own'],
    ['Boliglån terminbeløp', -12000, 'mortgage'], ['Lånekassen', -2500, 'loan'], ['Skatteetaten', 8000, 'tax'], ['Skatteetaten restskatt', -3000, 'tax'],
    ['Helt ukjent butikk', -99, 'uncat'], ['Ukjent innbetaling', 99, 'uncatin'],
  ];
  for (const [text, amount, want] of cases) assert.equal(cat(tx('2026-01-05', text, amount)), want, text);
});

test('some words only count in one direction, and whole-word rules do not match inside other words', () => {
  assert.equal(cat(tx('2026-01-15', 'Lønn', 40000)), 'pay');
  assert.equal(cat(tx('2026-01-15', 'Lønn tilbakeført', -100)), 'uncat');
  assert.equal(cat(tx('2026-01-15', 'Utbetaling', 40000, { type: 'Lønn' })), 'pay'); // the bank's own type counts too
  assert.equal(cat(tx('2026-01-31', 'Renter', 12)), 'interest');
  assert.equal(cat(tx('2026-01-31', 'Renter', -12)), 'other');
  assert.equal(cat(tx('2026-01-31', 'Lånekassen', 9000)), 'benefits');
  assert.equal(cat(tx('2026-01-05', 'IF Skadeforsikring', -500)), 'insurance');
  assert.equal(cat(tx('2026-01-05', 'Gifts and more', -500)), 'uncat');         // "if" inside a word is not the insurer
  assert.equal(cat(tx('2026-01-05', 'Espresso bar', -50)), 'eatingout');       // not the petrol brand inside "espresso"
  assert.equal(cat(tx('2026-01-05', 'Fremtind Service', -300)), 'transport');  // longest match wins over "fremtind"
  assert.equal(cat(tx('2026-01-05', 'UKJENT', -89, { mcat: 'Eating places and Restaurants' })), 'eatingout');
});

test('on a card, a payment of the bill is a transfer but a refund from a shop lowers that shop\'s category', () => {
  const card = { kind: 'card' };
  assert.equal(cat(tx('2026-01-20', 'Innbetaling bankgiro', 5000), card), 'cardbill');
  assert.equal(cat(tx('2026-01-20', 'Betaling mottatt, takk', 5000), card), 'cardbill');
  assert.equal(cat(tx('2026-01-21', 'Tilbakebetaling Zalando', 700), card), 'clothes');
  assert.equal(cat(tx('2026-01-21', 'Zalando', -700), card), 'clothes');
  assert.equal(cat(tx('2026-01-20', 'Innbetaling', 5000), { kind: 'bank' }), 'uncatin');    // only card accounts read it as a bill payment
});

test('your own choice beats your rules, and your rules beat the defaults', () => {
  const rules = prepareRules([{ id: 'r1', match: '  Kiwi ', cat: 'eatingout' }, { id: 'r2', match: 'kiwi 123', cat: 'travel' }, { id: 'r3', match: '', cat: 'travel' }, { id: 'r4', match: 'x', cat: 'nope' }]);
  assert.equal(rules.length, 2);
  assert.deepEqual(categorise(tx('2026-01-05', 'KIWI 999', -10), { rules }), { cat: 'eatingout', by: 'rule', rule: 'r1' });
  assert.equal(cat(tx('2026-01-05', 'KIWI 123', -10), { rules }), 'travel');     // the longer rule is tried first
  assert.deepEqual(categorise(tx('2026-01-05', 'KIWI 123', -10, { cat: 'health' }), { rules }), { cat: 'health', by: 'you' });
  assert.equal(cat(tx('2026-01-05', 'KIWI 123', -10, { cat: 'gone' }), { rules }), 'travel'); // unknown category falls through
});

test('loan payments and transfers to your other accounts are recognised without rules', () => {
  assert.deepEqual(categorise(tx('2026-01-20', 'Lån', -12000, { principal: 5000, interest: 6950 })), { cat: 'mortgage', by: 'loan' });
  const ctx = { ownTails: new Set(['9999']) };
  assert.deepEqual(categorise(tx('2026-01-21', 'Overføring', -3000, { peer: '9999' }), ctx), { cat: 'own', by: 'account' });
  assert.equal(cat(tx('2026-01-21', 'Overføring', -3000, { peer: '1234' }), ctx), 'uncat');
});

test('shop names are cleaned for display and grouping, and the key is always part of the text', () => {
  assert.equal(cleanText('*1234 12.01 NOK 249.00 EKSEMPEL BUTIKK Kurs: 1.0000'), 'EKSEMPEL BUTIKK');
  assert.equal(cleanText('Varekjøp EKSEMPEL BUTIKK Dato 12.01 kl. 14.33'), 'EKSEMPEL BUTIKK');
  assert.equal(cleanText('Vipps*Eksempel Kiosk'), 'Eksempel Kiosk');
  assert.equal(cleanText('12.01'), '12.01');
  assert.equal(merchantKey({ text: 'EKSEMPEL BUTIKK 4521 SENTRUM' }), 'eksempel butikk');
  assert.equal(merchantKey({ text: 'Eksempel 4521' }), 'eksempel');
  for (const text of ['*1234 12.01 NOK 249.00 EKSEMPEL BUTIKK', 'Eksempel *1234 Butikk', 'A', 'Vipps*Eksempel Kiosk', '']) {
    const key = merchantKey({ text });
    assert.ok(haystack({ text }).includes(key), `${JSON.stringify(text)} -> ${JSON.stringify(key)}`);
    if (text) assert.equal(cat(tx('2026-01-01', text, -1), { rules: prepareRules([{ id: 'r', match: key, cat: 'travel' }]) }), 'travel');
  }
});

test('a payment to a named account is grouped and ruled by that account, not by a word like "Overføring"', () => {
  const landlord = tx('2026-03-01', 'Overføring', -9000, { peer: '5555' }), friend = tx('2026-03-02', 'Overføring', -200, { peer: '7777' });
  assert.equal(merchantKey(landlord), 'konto:5555');
  assert.ok(haystack(landlord).includes(merchantKey(landlord)));
  const rules = prepareRules([{ id: 'r', match: merchantKey(landlord), cat: 'housing' }]);
  assert.equal(cat(landlord, { rules }), 'housing');
  assert.equal(cat(friend, { rules }), 'uncat');
  assert.equal(ruleLabel('konto:5555'), 'to or from account …5555');
  assert.equal(ruleLabel('kiwi'), '“kiwi”');
  const d = addImport(empty(), parsed([landlord, friend, tx('2026-04-01', 'Overføring', -9000, { peer: '5555' })]), 'x.xlsx', '2026-05-01');
  const groups = unsortedGroups(d.transactions, sortAll(d.transactions, d.accounts, []));
  assert.deepEqual(groups.map((g) => [g.key, g.label, g.count]), [['konto:5555', 'Overføring · account …5555', 2], ['konto:7777', 'Overføring · account …7777', 1]]);
});

// ---------- importing ----------
const empty = () => ({ accounts: [], imports: [], transactions: [] });
const parsed = (txs, extra = {}) => ({ kind: 'bank', accountTail: '3333', txs, from: txs[0]?.date, to: txs.at(-1)?.date, ...extra });

test('importing adds an account and transactions, and a second overlapping file adds only what is new', () => {
  const jan = [tx('2026-01-02', 'Kaffe', -40), tx('2026-01-02', 'Kaffe', -40), tx('2026-01-15', 'Lønn', 40000)];
  const a = addImport(empty(), parsed(jan), 'januar.xlsx', '2026-02-01');
  assert.equal(a.added, 3);
  assert.equal(a.accounts.length, 1);
  assert.deepEqual([a.account.name, a.account.kind, a.account.tail], ['Bank account …3333', 'bank', '3333']);
  assert.equal(new Set(a.transactions.map((t) => t.id)).size, 3);
  assert.ok(a.transactions.every((t) => t.acct === a.account.id && t.imp === a.imp.id));

  const overlap = [tx('2026-01-02', 'Kaffe', -40), tx('2026-01-02', 'Kaffe', -40), tx('2026-01-02', 'Kaffe', -40), tx('2026-01-15', 'Lønn', 40000), tx('2026-02-01', 'Kiwi', -100)];
  const b = addImport(a, parsed(overlap), 'jan-feb.xlsx', '2026-03-01');
  assert.equal(b.added, 2);       // the third coffee and the February line
  assert.equal(b.dupes, 3);
  assert.equal(b.accounts.length, 1);
  assert.equal(b.transactions.length, 5);
  assert.deepEqual(b.transactions.map((t) => t.date), [...b.transactions.map((t) => t.date)].sort());

  const again = addImport(b, parsed(overlap), 'jan-feb.xlsx', '2026-03-02');
  assert.equal(again.added, 0);
  assert.equal(again.imports.length, 2);                 // nothing new: no empty import is recorded
  assert.equal(again.transactions, b.transactions);
});

test('a different account gets its own entry, so the same line there is not a duplicate', () => {
  const a = addImport(empty(), parsed([tx('2026-01-02', 'Overføring', -500)]), 'a.xlsx', '2026-02-01');
  const b = addImport(a, parsed([tx('2026-01-02', 'Overføring', -500)], { accountTail: '9999' }), 'b.xlsx', '2026-02-01');
  const c = addImport(b, parsed([tx('2026-01-03', 'Butikk', -90)], { kind: 'card', accountTail: '' }), 'kort.xlsx', '2026-02-01');
  const d = addImport(c, parsed([tx('2026-02-03', 'Butikk', -90)], { kind: 'card', accountTail: '' }), 'kort2.xlsx', '2026-03-01');
  assert.equal(b.added, 1);
  assert.deepEqual(d.accounts.map((x) => x.name), ['Bank account …3333', 'Bank account …9999', 'Credit card']);
  assert.equal(d.transactions.filter((t) => t.acct === d.accounts[2].id).length, 2);
});

// ---------- sorting across accounts ----------
function twoAccounts() {
  let d = addImport(empty(), parsed([
    tx('2026-03-01', 'Overføring', -2000),                       // to savings: the other half is in the other file
    tx('2026-03-10', 'Betaling', -4000),                         // pays the card: matched by amount
    tx('2026-03-12', 'Kiwi', -300),
    tx('2026-01-10', 'Bank Norwegian', -1000),                   // card bill from before any card file
  ]), 'bank.xlsx', '2026-04-01');
  d = addImport(d, parsed([tx('2026-03-02', 'Overføring', 2000)], { accountTail: '9999' }), 'spar.xlsx', '2026-04-01');
  d = addImport(d, parsed([tx('2026-02-20', 'Restaurant', -900), tx('2026-03-11', 'Innbetaling', 4000)], { kind: 'card', accountTail: '' }), 'kort.xlsx', '2026-04-01');
  return d;
}

test('matching amounts between your accounts are transfers, and card bills are not counted twice', () => {
  const d = twoAccounts();
  const sorted = sortAll(d.transactions, d.accounts, []);
  const of = (text, amount) => sorted.get(d.transactions.find((t) => t.text === text && t.amount === amount).id);
  assert.deepEqual(of('Overføring', -2000), { cat: 'own', by: 'pair', flow: 'transfer' });
  assert.deepEqual(of('Overføring', 2000), { cat: 'own', by: 'pair', flow: 'transfer' });
  assert.deepEqual(of('Betaling', -4000), { cat: 'cardbill', by: 'pair', flow: 'transfer' });
  assert.equal(of('Innbetaling', 4000).flow, 'transfer');
  assert.equal(of('Restaurant', -900).flow, 'spending');
  // January has no card lines behind it, so that bill is the only record of the spending.
  assert.deepEqual(of('Bank Norwegian', -1000), { cat: 'cardbill', by: 'default', flow: 'spending' });
  const rows = monthly(d.transactions, sorted);
  assert.deepEqual(rows.map((r) => [r.month, r.spending, r.transfer]), [['2026-01', 1000, 0], ['2026-02', 900, 0], ['2026-03', 300, 0]]);
});

test('one-offs leave living costs, and refunds lower the category they belong to', () => {
  const d = addImport(empty(), parsed([
    tx('2026-03-01', 'Lønn', 50000), tx('2026-03-02', 'Kiwi', -1000), tx('2026-03-03', 'Kiwi retur', 200),
    tx('2026-03-04', 'Nytt tak', -80000, { cat: 'homeware', once: true }), tx('2026-03-05', 'Nordnet', -10000),
    tx('2026-03-20', 'Lån', -12000, { principal: 5000, interest: 7000 }), tx('2026-03-21', 'Billån', -3000), tx('2026-03-22', 'Sparekonto', -4000),
  ]), 'mars.xlsx', '2026-04-01');
  const [m] = monthly(d.transactions, sortAll(d.transactions, d.accounts, []));
  assert.equal(m.income, 50000);
  assert.equal(m.spending, 800);
  assert.equal(m.cats.groceries, 800);
  assert.equal(m.oneoff, 80000);
  assert.equal(m.cats.homeware, undefined);
  assert.equal(m.investing, 10000);
  assert.deepEqual([m.mortgage, m.principal, m.interest, m.otherLoans, m.debt], [12000, 5000, 7000, 3000, 15000]);
  assert.equal(m.living, 3800);                       // spending plus the car loan, not the mortgage
  assert.equal(m.transfer, -4000);
  assert.equal(m.left, 50000 - 3800 - 12000 - 10000 - 80000);
  assert.deepEqual([m.count, m.unsorted], [8, 0]);
});

test('months come without gaps, and only whole months count towards the usual month', () => {
  const d = addImport(empty(), parsed([
    tx('2025-11-20', 'Kiwi', -500),                                  // file starts mid-month: not whole
    tx('2025-12-03', 'Kiwi', -1000), tx('2026-02-10', 'Kiwi', -3000), // January has nothing at all: still a month
    tx('2026-03-31', 'Kiwi', -2000),
    tx('2026-04-02', 'Kiwi', -100),                                  // the month we are in
  ]), 'x.xlsx', '2026-04-10');
  const rows = monthly(d.transactions, sortAll(d.transactions, d.accounts, []));
  assert.deepEqual(rows.map((r) => r.month), ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04']);
  const whole = wholeMonths(rows, d.transactions, '2026-04-10');
  assert.deepEqual(whole.map((r) => r.month), ['2025-12', '2026-01', '2026-02', '2026-03']);
  const avg = usualMonth(whole);
  assert.deepEqual([avg.months, avg.from, avg.to, avg.living, avg.cats.groceries], [4, '2025-12', '2026-03', 1500, 1500]);
  assert.equal(usualMonth(whole, 2).living, 2500);
  assert.equal(usualMonth([]), null);
  // A last month that the file stops in the middle of is left out too.
  assert.deepEqual(wholeMonths(rows, d.transactions.filter((t) => t.date < '2026-03-01'), '2026-06-01').map((r) => r.month), ['2025-12', '2026-01']);
  assert.deepEqual(wholeMonths([], [], '2026-06-01'), []);
});

test('share of income splits every 100 kr', () => {
  const s = shareOfIncome({ income: 50000, living: 25000, mortgage: 10000, principal: 4000, investing: 10000, oneoff: 0, left: 5000 });
  assert.deepEqual([s.living, s.mortgage, s.investing, s.left, s.kept], [50, 20, 20, 10, 38]);
  assert.equal(shareOfIncome({ income: 0 }), null);
  assert.equal(shareOfIncome(null), null);
});

test('unsorted lines are grouped by shop with the biggest first, and big purchases are offered as one-offs', () => {
  const d = addImport(empty(), parsed([
    tx('2026-03-01', 'Ukjent Butikk 12', -100), tx('2026-03-05', 'UKJENT BUTIKK 14', -250), tx('2026-03-06', 'Annet Sted', -900),
    tx('2026-03-07', 'Ukjent Butikk', 75), tx('2026-03-08', 'Kiwi', -400), tx('2026-03-09', 'Stor Ting AS', -30000), tx('2026-03-10', 'Kiwi', -12000),
  ]), 'x.xlsx', '2026-04-01');
  const sorted = sortAll(d.transactions, d.accounts, []);
  const groups = unsortedGroups(d.transactions, sorted);
  assert.deepEqual(groups.map((g) => [g.key, g.dir, g.count, g.sum]), [['stor ting', 'out', 1, 30000], ['annet sted', 'out', 1, 900], ['ukjent butikk', 'out', 2, 350], ['ukjent butikk', 'in', 1, 75]]);
  assert.equal(groups[2].label, 'UKJENT BUTIKK 14');
  const big = bigPurchases(d.transactions, sorted, '2026-01', 20000);
  assert.deepEqual(big.map((t) => t.text), ['Stor Ting AS', 'Kiwi']);
  assert.deepEqual(bigPurchases(d.transactions, sorted, '2026-01', 100000).map((t) => t.text), ['Stor Ting AS']);
  assert.deepEqual(bigPurchases(d.transactions, sorted, '2026-04', 20000), []);
  // Marking a line as a one-off deals with it: it no longer asks to be sorted.
  const marked = d.transactions.map((t) => (t.text === 'Stor Ting AS' ? { ...t, once: true } : t));
  const sorted2 = sortAll(marked, d.accounts, []);
  assert.deepEqual(unsortedGroups(marked, sorted2).map((g) => g.key), ['annet sted', 'ukjent butikk', 'ukjent butikk']);
  assert.equal(monthly(marked, sorted2)[0].unsorted, 4);
});

test('money paid into investments between two dates, and what each account covers', () => {
  const d = addImport(empty(), parsed([tx('2026-01-31', 'Nordnet', -5000), tx('2026-02-15', 'Nordnet', -5000), tx('2026-02-20', 'Nordnet', 1000), tx('2026-03-01', 'Nordnet', -5000), tx('2026-03-02', 'Nordnet', -7)]), 'x.xlsx', '2026-04-01');
  const sorted = sortAll(d.transactions, d.accounts, []);
  assert.equal(investedBetween(d.transactions, sorted, '2026-01-31', '2026-03-01'), 9000);
  assert.deepEqual(coverage(d.transactions).get(d.accounts[0].id), { from: '2026-01-31', to: '2026-03-02', count: 5 });
  assert.equal(addMonths('2026-11', 2), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
});
