// Turns imported transactions into monthly sums. No DOM, no storage.
// Amounts on transactions are signed (out is negative). Sums here are positive in their natural
// direction: income is money in, everything else is money out, so a refund lowers spending.
import { CAT, UNSORTED, categorise, prepareRules, merchantKey, cleanText } from './categories.js';

export const monthOf = (date) => date.slice(0, 7);
const dayNumber = (date) => Math.round(Date.parse(date + 'T00:00:00Z') / 86400000);
const lastDayOf = (month) => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
export function addMonths(month, n) {
  const t = +month.slice(0, 4) * 12 + (+month.slice(5, 7) - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

// ---------- importing ----------
const sameTx = (t) => `${t.acct}|${t.date}|${t.amount}|${t.text}`;

/**
 * Adds the transactions from one file (the result of readBankFile) to what is already stored.
 * Lines you already have are skipped, so overlapping exports are safe: if a day has two identical
 * purchases and the new file has three, one is added.
 * A file is matched to an account by the last four digits of its account number when the file has
 * them, otherwise by its type (bank or card). A file that lists several accounts is split.
 * data: { accounts, imports, transactions }. Returns new arrays plus { added, dupes, account, imp }.
 */
export function addImport(data, parsed, fileName, today) {
  const accounts = data.accounts.map((a) => ({ ...a }));
  const accountFor = (tail) => {
    const sig = `${parsed.kind}:${tail}`;
    let a = accounts.find((x) => (tail ? x.tail === tail : x.sig === sig));
    if (!a) {
      const taken = accounts.filter((x) => x.kind === parsed.kind).length;
      a = { id: nextId('a', accounts), kind: parsed.kind, tail, sig,
        name: (parsed.kind === 'card' ? 'Credit card' : 'Bank account') + (tail ? ' …' + tail : taken ? ' ' + (taken + 1) : '') };
      accounts.push(a);
    }
    return a;
  };
  const imp = { id: nextId('i', data.imports), file: String(fileName || 'file').slice(0, 80), acct: '', date: today, from: parsed.from, to: parsed.to, count: 0 };
  const have = new Map();
  for (const t of data.transactions) { const k = sameTx(t); have.set(k, (have.get(k) || 0) + 1); }
  const seen = new Map(), added = [];
  let account = null;
  for (const raw of parsed.txs) {
    const a = accountFor(raw.acct || parsed.accountTail || '');
    account = account || a;
    const t = { ...raw, acct: a.id };
    const k = sameTx(t), n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    if (n <= (have.get(k) || 0)) continue;
    added.push({ ...t, id: `${imp.id}.${added.length.toString(36)}`, imp: imp.id });
  }
  account = account || accountFor(parsed.accountTail || '');
  imp.acct = account.id;
  imp.count = added.length;
  return {
    accounts, account, imp, added: added.length, dupes: parsed.txs.length - added.length,
    imports: added.length ? [...data.imports, imp] : data.imports,
    transactions: added.length ? [...data.transactions, ...added].sort((a, b) => a.date.localeCompare(b.date)) : data.transactions,
  };
}
function nextId(prefix, list) {
  let n = list.length + 1;
  while (list.some((x) => x.id === prefix + n)) n++;
  return prefix + n;
}

// ---------- sorting ----------
/**
 * Decides category and flow for every transaction.
 * Returns Map(id -> { cat, flow, by }). `by` says who decided: 'you', 'rule', 'loan', 'account', 'pair', 'default', 'none'.
 */
export function sortAll(transactions, accounts, rules) {
  const prepared = prepareRules(rules);
  const acct = new Map(accounts.map((a) => [a.id, a]));
  const tails = accounts.map((a) => a.tail).filter(Boolean);
  const ctxFor = new Map(accounts.map((a) => [a.id, { rules: prepared, kind: a.kind, ownTails: new Set(tails.filter((t) => t !== a.tail)) }]));
  const out = new Map();
  for (const t of transactions) out.set(t.id, categorise(t, ctxFor.get(t.acct) || { rules: prepared }));

  // The same amount leaving a bank account and arriving in another of your accounts within a few days
  // is a transfer. Into a card account it is the card bill being paid. What you or your rules decided stays.
  const paidInto = new Map(); // a payment out of a bank account -> { card: the card account it arrived on, sure }
  if (accounts.length > 1) {
    const kindOf = (t) => (acct.get(t.acct) || {}).kind;
    const decided = (s) => s.by === 'you' || s.by === 'rule';
    const pairable = (s) => s.by === 'none' || s.cat === 'cardbill' || s.cat === 'own';
    const open = new Map(); // amount in øre -> money-in lines nobody has claimed
    for (const t of transactions) {
      if (t.amount <= 0 || !pairable(out.get(t.id))) continue;
      const k = Math.round(t.amount * 100);
      if (!open.has(k)) open.set(k, []);
      open.get(k).push(t);
    }
    for (const t of transactions) {
      if (t.amount >= 0 || kindOf(t) !== 'bank' || !pairable(out.get(t.id))) continue;
      const list = open.get(Math.round(-t.amount * 100));
      if (!list) continue;
      const day = dayNumber(t.date);
      const i = list.findIndex((o) => o.acct !== t.acct && Math.abs(dayNumber(o.date) - day) <= 4);
      if (i < 0) continue;
      const other = list.splice(i, 1)[0];
      const cat = kindOf(other) === 'card' ? 'cardbill' : 'own';
      // `sure`: one of the two lines was a card bill before the amounts matched, so this is no coincidence.
      if (cat === 'cardbill') paidInto.set(t.id, { card: other.acct, sure: out.get(t.id).cat === cat || out.get(other.id).cat === cat });
      for (const x of [t, other]) if (!decided(out.get(x.id))) out.set(x.id, { cat, by: 'pair' });
    }
  }

  // A card bill counts as living costs only while the purchases behind it are not imported: the card it
  // pays must have purchases here from that month or the month before.
  // Which card a bill pays is learned from payments that matched money arriving on a card. The place such
  // a payment went to (see merchantKey) then stands for that card, also for bills its file does not reach.
  // A bill to a place that pays none of the cards here is for a card with no file, so it keeps counting.
  // A card that no payment was matched to (its file may leave payments out) may be behind any other bill.
  const bought = new Map(); // card account -> the months it has purchases in
  for (const a of accounts) if (a.kind === 'card') bought.set(a.id, new Set());
  for (const t of transactions) if (t.amount < 0 && bought.has(t.acct)) bought.get(t.acct).add(monthOf(t.date));
  const pays = new Map(); // place -> the cards it is known to pay
  for (const t of transactions) {
    const hit = paidInto.get(t.id);
    if (!hit || !hit.sure || out.get(t.id).cat !== 'cardbill') continue;
    const place = merchantKey(t);
    if (!pays.has(place)) pays.set(place, new Set());
    pays.get(place).add(hit.card);
  }
  const matched = new Set([...pays.values()].flatMap((cards) => [...cards]));
  const unmatched = [...bought.keys()].filter((id) => !matched.has(id));
  const covers = (card, m) => bought.get(card).has(m) || bought.get(card).has(addMonths(m, -1));
  for (const t of transactions) {
    const s = out.get(t.id);
    let flow = CAT[s.cat].flow;
    if (s.cat === 'cardbill') {
      const m = monthOf(t.date), hit = paidInto.get(t.id);
      // On the card itself the line is the payment arriving, never a purchase.
      const cards = bought.has(t.acct) ? null : hit ? [hit.card] : pays.get(merchantKey(t)) || unmatched;
      flow = !cards || [...cards].some((card) => covers(card, m)) ? 'transfer' : 'spending';
    } else if (t.once && (flow === 'spending' || flow === 'income' || flow === 'debt')) flow = 'oneoff';
    s.flow = flow;
  }
  return out;
}

// ---------- adding up ----------
const emptyMonth = (month) => ({ month, income: 0, spending: 0, debt: 0, mortgage: 0, otherLoans: 0, principal: 0, interest: 0,
  investing: 0, transfer: 0, oneoff: 0, living: 0, left: 0, cats: {}, count: 0, unsorted: 0, unsortedSum: 0 });

/**
 * One row per calendar month, oldest first, with no gaps.
 * living = spending + other loans (what the plan calls living costs: everything except mortgage and investing).
 * left = income - living - mortgage - investing - one-offs.
 */
export function monthly(transactions, sorted) {
  const by = new Map();
  for (const t of transactions) {
    const s = sorted.get(t.id);
    if (!s) continue;
    const m = monthOf(t.date);
    if (!by.has(m)) by.set(m, emptyMonth(m));
    const row = by.get(m);
    row.count++;
    if (UNSORTED.has(s.cat) && !t.once) { row.unsorted++; row.unsortedSum += Math.abs(t.amount); }   // a one-off is already dealt with
    const out = -t.amount;
    if (s.flow === 'income') { row.income += t.amount; row.cats[s.cat] = (row.cats[s.cat] || 0) + t.amount; continue; }
    if (s.flow === 'transfer') { row.transfer += t.amount; continue; }
    if (s.flow === 'oneoff') { row.oneoff += out; continue; }
    row.cats[s.cat] = (row.cats[s.cat] || 0) + out;
    if (s.flow === 'spending') row.spending += out;
    else if (s.flow === 'investing') row.investing += out;
    else if (s.flow === 'debt') {
      row.debt += out;
      if (s.cat === 'mortgage') { row.mortgage += out; row.principal += t.principal || 0; row.interest += t.interest || 0; }
      else row.otherLoans += out;
    }
  }
  const months = [...by.keys()].sort();
  const rows = [];
  for (let m = months[0]; m && m <= months[months.length - 1]; m = addMonths(m, 1)) {
    const row = by.get(m) || emptyMonth(m);
    row.living = row.spending + row.otherLoans;
    row.left = row.income - row.living - row.mortgage - row.investing - row.oneoff;
    rows.push(row);
  }
  return rows;
}

/**
 * The months that can be trusted as whole: not the month we are in, and not a first or last month
 * that the files only cover part of. `today` is 'YYYY-MM-DD'.
 */
export function wholeMonths(rows, transactions, today) {
  if (!transactions.length) return [];
  let first = transactions[0].date, last = first;
  for (const t of transactions) { if (t.date < first) first = t.date; if (t.date > last) last = t.date; }
  const firstMonth = monthOf(first), lastMonth = monthOf(last), now = monthOf(today);
  return rows.filter((r) => r.month < now
    && (r.month > firstMonth || +first.slice(8) <= 5)
    && (r.month < lastMonth || +last.slice(8) >= lastDayOf(lastMonth) - 1));
}

const SUMS = ['income', 'spending', 'debt', 'mortgage', 'otherLoans', 'principal', 'interest', 'investing', 'oneoff', 'living', 'left'];
/** The average month over the latest `n` whole months. Returns null when there is no whole month yet. */
export function usualMonth(whole, n = 12) {
  const rows = whole.slice(-n);
  if (!rows.length) return null;
  const avg = { months: rows.length, from: rows[0].month, to: rows[rows.length - 1].month, cats: {} };
  for (const k of SUMS) avg[k] = rows.reduce((t, r) => t + r[k], 0) / rows.length;
  for (const r of rows) for (const [c, v] of Object.entries(r.cats)) avg.cats[c] = (avg.cats[c] || 0) + v / rows.length;
  return avg;
}

/** Of every 100 kr that came in, how much went where. Null without income. */
export function shareOfIncome(avg) {
  if (!avg || avg.income <= 0) return null;
  const pct = (v) => (v / avg.income) * 100;
  return { living: pct(avg.living), mortgage: pct(avg.mortgage), investing: pct(avg.investing), oneoff: pct(avg.oneoff), left: pct(avg.left),
    // What you keep: investing, paying down the mortgage, and what is left in the bank.
    kept: pct(avg.investing + avg.principal + Math.max(0, avg.left)) };
}

// ---------- helping you sort ----------
/**
 * Unsorted transactions grouped by shop, biggest total first, so one choice sorts many lines.
 * Returns [{ key, label, dir, count, sum, ids, latest }].
 */
export function unsortedGroups(transactions, sorted) {
  const groups = new Map();
  for (const t of transactions) {
    const s = sorted.get(t.id);
    if (!s || !UNSORTED.has(s.cat) || t.once) continue;
    const key = merchantKey(t), dir = t.amount < 0 ? 'out' : 'in', id = dir + '|' + key;
    const label = cleanText(t.text) + (t.peer ? ` · account …${t.peer}` : '');
    if (!groups.has(id)) groups.set(id, { key, label, dir, count: 0, sum: 0, ids: [], latest: t.date });
    const g = groups.get(id);
    g.count++; g.sum += Math.abs(t.amount); g.ids.push(t.id);
    if (t.date >= g.latest) { g.latest = t.date; g.label = label; }
  }
  return [...groups.values()].sort((a, b) => b.sum - a.sum);
}

/**
 * Large single purchases in the months given that are not marked as one-offs yet: candidates to ask about.
 * "Large" is at least `floor` kr and at least a quarter of a usual month's living costs.
 */
export function bigPurchases(transactions, sorted, sinceMonth, usualLiving, floor = 10000) {
  const limit = Math.max(floor, (usualLiving || 0) * 0.25);
  return transactions
    .filter((t) => !t.once && t.amount <= -limit && monthOf(t.date) >= sinceMonth && (sorted.get(t.id) || {}).flow === 'spending' && (sorted.get(t.id) || {}).cat !== 'cardbill')
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 8);
}

/** Money paid into investments between two dates (after `from`, up to and including `to`). */
export function investedBetween(transactions, sorted, from, to) {
  let sum = 0;
  for (const t of transactions) if (t.date > from && t.date <= to && (sorted.get(t.id) || {}).flow === 'investing') sum -= t.amount;
  return sum;
}

/** First and last transaction date per account, to show what the files cover. */
export function coverage(transactions) {
  const by = new Map();
  for (const t of transactions) {
    const c = by.get(t.acct) || { from: t.date, to: t.date, count: 0 };
    if (t.date < c.from) c.from = t.date;
    if (t.date > c.to) c.to = t.date;
    c.count++;
    by.set(t.acct, c);
  }
  return by;
}
