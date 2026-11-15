// All personal data lives in this browser, and in a file if you choose one. Nothing is sent anywhere.
// Small things are in localStorage; transactions are in IndexedDB, because years of bank lines can outgrow
// localStorage. Pages see one state object either way. The repository is public: never put real numbers here.
import { investable, pensionAge } from './model.js';
import { CAT } from './categories.js';
import { addImport, sortAll, monthly, wholeMonths, usualMonth } from './ledger.js';
import { today } from './format.js';
import * as db from './db.js';

export const KEY = 'money-dashboard-v1'; // the name is from the first version; kept so existing data is found
const TX_KEY = 'transactions';
export const SCHEMA = 3;
const newId = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** The parts of a net worth entry. debt is what you owe, as a positive number. */
export const PARTS = ['ask', 'funds', 'ips', 'other', 'cash', 'home', 'car', 'debt'];

// Neutral starting values. Not anyone's real numbers.
export function defaultState() {
  return {
    schema: SCHEMA,
    // For the rough "when can I stop working" age. Amounts are a month, in today's kroner.
    // spend, invest and mortgage are used only until the bank files give a usual month. 0 = not given.
    profile: { birthYear: 0, pension: 0, mortgageEndYear: 0, spend: 30000, invest: 5000, mortgage: 0 },
    networth: [],      // [{ date, ask, funds, ips, other, cash, home, car, debt, putIn: total put in so far | null, note }]
    accounts: [],      // [{ id, name, kind: 'bank' | 'card', tail, sig }]
    imports: [],       // [{ id, file, acct, date, from, to, count }]
    rules: [],         // [{ id, match, cat }]  your own "description contains X" rules
    layouts: [],       // [{ headerRow, cols: { date, text, amount | in, out }, kind, header }]  for files not recognised
    transactions: [],  // [{ id, date, text, amount, acct, imp, type?, mcat?, memo?, principal?, interest?, peer?, cat?, once? }]
    meta: { exported: '', saved: '' },   // exported: day of the last copy saved. saved: moment of the last change.
  };
}

const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateOr = (v, d) => (typeof v === 'string' && DATE.test(v) ? v : d);
const yearOr = (v, d) => (Number.isInteger(v) && v > 1900 && v < 2200 ? v : d);
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v) => (Array.isArray(v) ? v : []);

/**
 * Accepts anything, returns a valid state. Unknown fields are dropped. Older formats are brought up to date here:
 * before version 3 there was a planner with its own numbers, the pension was a year's amount, and a net worth
 * entry said what you had put in since the entry before (paidIn) instead of in total (putIn).
 */
export function sanitize(raw) {
  const out = defaultState();
  if (!raw || typeof raw !== 'object') return out;
  const old = !(raw.schema >= 3), p = raw.profile && typeof raw.profile === 'object' ? raw.profile : {};
  const plans = list(raw.plans).filter((x) => x && typeof x === 'object');
  const plan = plans.find((x) => x.id === raw.activePlan) || plans[0] || {};
  out.profile = {
    birthYear: yearOr(p.birthYear, 0),
    pension: Math.max(0, num(p.pension, 0)) / (old ? 12 : 1),
    // The old planner stored a year even with no mortgage (this year, by default): only a real one is kept.
    mortgageEndYear: old && !(num(p.mortgagePayment, 0) > 0) ? 0 : yearOr(p.mortgageEndYear, 0),
    spend: Math.max(0, num(old ? p.livingNow : p.spend, out.profile.spend)),
    invest: Math.max(0, num(old ? plan.invest : p.invest, out.profile.invest)),
    mortgage: Math.max(0, num(old ? p.mortgagePayment : p.mortgage, 0)),
  };

  const basisDate = old ? dateOr(p.basisDate, '') : '';
  let running = old && num(p.basis, 0) > 0 ? p.basis : null;
  const entries = list(raw.networth).filter((e) => e && DATE.test(e.date || '')).sort((a, b) => a.date.localeCompare(b.date));
  for (const e of entries) {
    const row = { date: e.date };
    for (const k of PARTS) row[k] = num(e[k], 0);
    if (old) {
      if (typeof e.paidIn === 'number' && isFinite(e.paidIn) && e.date > basisDate) running = (running || 0) + e.paidIn;
      row.putIn = running;
    } else row.putIn = typeof e.putIn === 'number' && isFinite(e.putIn) ? e.putIn : null;
    row.note = text(e.note, 200);
    out.networth = out.networth.filter((x) => x.date !== row.date).concat(row);
  }
  // Before version 3 the planner could hold your investments without any net worth entry.
  if (old && !out.networth.length && num(p.portfolio, 0) > 0) {
    out.networth.push({ date: dateOr(p.basisDate, today()), ask: p.portfolio, funds: 0, ips: 0, other: 0, cash: 0, home: 0, car: 0, debt: 0,
      putIn: num(p.basis, 0) > 0 ? p.basis : null, note: '' });
  }

  const ids = new Set();
  const fresh = (id) => typeof id === 'string' && id && id.length <= 40 && !ids.has(id) && (ids.add(id), true);
  const spare = (prefix) => { let n = 1; while (ids.has(prefix + n)) n++; ids.add(prefix + n); return prefix + n; };
  for (const a of list(raw.accounts)) {
    if (!a || !fresh(a.id)) continue;
    out.accounts.push({ id: a.id, name: text(a.name, 60) || 'Account', kind: a.kind === 'card' ? 'card' : 'bank', tail: /^\d{4}$/.test(a.tail) ? a.tail : '', sig: text(a.sig, 40) });
  }
  const acctIds = new Set(out.accounts.map((a) => a.id));
  for (const i of list(raw.imports)) {
    if (!i || !fresh(i.id)) continue;
    out.imports.push({ id: i.id, file: text(i.file, 80) || 'file', acct: acctIds.has(i.acct) ? i.acct : '', date: dateOr(i.date, ''), from: dateOr(i.from, ''), to: dateOr(i.to, ''), count: num(i.count, 0) });
  }
  for (const r of list(raw.rules)) {
    if (!r || !CAT[r.cat] || !text(r.match, 80)) continue;
    out.rules.push({ id: fresh(r.id) ? r.id : spare('r'), match: text(r.match, 80).toLowerCase(), cat: r.cat });
  }
  for (const l of list(raw.layouts).slice(0, 20)) {
    if (!l || typeof l !== 'object' || !l.cols || typeof l.cols !== 'object') continue;
    const cols = {};
    for (const k of ['date', 'text', 'amount', 'in', 'out']) if (Number.isInteger(l.cols[k]) && l.cols[k] >= 0 && l.cols[k] < 200) cols[k] = l.cols[k];
    if (cols.date === undefined || cols.text === undefined || (cols.amount === undefined && cols.in === undefined && cols.out === undefined)) continue;
    out.layouts.push({ headerRow: Number.isInteger(l.headerRow) && l.headerRow >= -1 && l.headerRow < 100 ? l.headerRow : -1, cols, kind: l.kind === 'card' ? 'card' : 'bank', header: text(l.header, 600) });
  }
  for (const t of list(raw.transactions)) {
    if (!t || !fresh(t.id) || !DATE.test(t.date || '') || typeof t.amount !== 'number' || !isFinite(t.amount) || t.amount === 0) continue;
    if (!acctIds.has(t.acct) && !acctIds.has('a0')) { // lines without a known account are kept, under a stand-in account
      out.accounts.push({ id: 'a0', name: 'Bank account', kind: 'bank', tail: '', sig: 'bank:' });
      acctIds.add('a0');
    }
    const row = { id: t.id, date: t.date, text: text(t.text, 160) || '(no description)', amount: t.amount, acct: acctIds.has(t.acct) ? t.acct : 'a0', imp: text(t.imp, 40) };
    for (const [k, max] of [['type', 60], ['mcat', 80], ['memo', 160]]) if (text(t[k], max)) row[k] = text(t[k], max);
    for (const k of ['principal', 'interest']) if (typeof t[k] === 'number' && isFinite(t[k])) row[k] = t[k];
    if (/^\d{4}$/.test(t.peer)) row.peer = t.peer;
    if (CAT[t.cat]) row.cat = t.cat;
    if (t.once) row.once = true;
    out.transactions.push(row);
  }
  out.transactions.sort((a, b) => a.date.localeCompare(b.date));
  out.meta.exported = dateOr(raw.meta?.exported, '');
  out.meta.saved = typeof raw.meta?.saved === 'string' && !isNaN(Date.parse(raw.meta.saved)) ? raw.meta.saved.slice(0, 30) : '';
  return out;
}

let state = defaultState();
const listeners = new Set();
let saved = true, txSaved = true;
const notify = () => listeners.forEach((l) => l(state));
const local = () => { try { return globalThis.localStorage || null; } catch { return null; } };

/** Reads saved data. Call once before showing a page, and again when another tab has saved. */
export async function load() {
  let core = null, txs = null;
  try { const raw = local()?.getItem(KEY); if (raw) core = JSON.parse(raw); } catch { /* start fresh */ }
  try { txs = await db.get(TX_KEY); }
  catch { try { const raw = local()?.getItem(KEY + '-tx'); if (raw) txs = JSON.parse(raw); } catch { /* none */ } }
  if (core || txs) state = sanitize({ ...(core || {}), transactions: Array.isArray(txs) ? txs : core?.transactions });
  notify();
  return state;
}

function persist(txChanged) {
  const { transactions, ...core } = state;
  try { const ls = local(); if (!ls) throw new Error('no storage'); ls.setItem(KEY, JSON.stringify(core)); saved = true; }
  catch { saved = false; }
  if (!txChanged) return;
  const was = txSaved;
  db.set(TX_KEY, transactions)
    .then(() => { txSaved = true; try { local()?.removeItem(KEY + '-tx'); } catch { /* fine */ } })
    .catch(() => { // IndexedDB missing or blocked: fall back to localStorage while it fits
      try { const ls = local(); if (!ls) throw new Error('no storage'); ls.setItem(KEY + '-tx', JSON.stringify(transactions)); txSaved = true; }
      catch { txSaved = false; }
    })
    .then(() => { if (txSaved !== was) notify(); });
}

export const get = () => state;
export const isSaved = () => saved && txSaved;
/** Every change goes through here: it saves, stamps the moment of the change, and tells the page. */
export function update(fn) {
  const before = state.transactions;
  fn(state);
  state.meta.saved = new Date().toISOString();
  persist(state.transactions !== before);
  notify();
}
export function replace(next) { state = sanitize(next); persist(true); notify(); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const latest = (s = state) => (s.networth.length ? s.networth[s.networth.length - 1] : null);

/** Asks the browser not to clear this site's data when it tidies up. Safe to call often. */
export function keepSafe() {
  try { globalThis.navigator?.storage?.persist?.().catch(() => {}); } catch { /* not supported */ }
}

// ---------- net worth ----------
/** Saves a net worth entry. An entry with the same date is replaced. */
export function saveEntry(entry) {
  update((s) => { s.networth = s.networth.filter((e) => e.date !== entry.date).concat(entry).sort((a, b) => a.date.localeCompare(b.date)); });
  keepSafe();
}
export function removeEntry(date) { update((s) => { s.networth = s.networth.filter((e) => e.date !== date); }); }
export function setProfile(key, value) { update((s) => { s.profile[key] = value; }); }

/**
 * What the rough "when can I stop working" age is worked out from. The monthly amounts come from your bank
 * files when they give a usual month, otherwise from what you typed. null until the year you were born is given.
 */
export function roughInputs(s, L, day = today()) {
  const pr = s.profile;
  if (!pr.birthYear) return null;
  const last = latest(s), u = L.usual, worth = last ? investable(last) : 0;
  const mortgage = u ? u.mortgage : pr.mortgage;
  return {
    age: +day.slice(0, 4) - pr.birthYear,
    worth,
    putIn: last && last.putIn !== null ? Math.min(last.putIn, worth) : worth,
    spend: u ? u.living : pr.spend,
    invest: u ? Math.max(0, u.investing) : pr.invest,
    mortgage,
    // Without a year, a mortgage you pay is taken to last: careful, and a reason to give the year.
    mortgageEndAge: pr.mortgageEndYear ? pr.mortgageEndYear - pr.birthYear : mortgage > 0 ? Infinity : 0,
    pension: pr.pension,
    pensionAge: pensionAge(pr.birthYear),
    months: u ? u.months : 0,
  };
}

// ---------- transactions ----------
let memo = null;
/** Sorted transactions and monthly sums, worked out once per change. Returns { sorted, months, whole, usual }. */
export function ledger(s = state) {
  const key = JSON.stringify([s.rules, s.accounts]), day = today();
  if (memo && memo.txs === s.transactions && memo.key === key && memo.day === day) return memo.value;
  const sorted = sortAll(s.transactions, s.accounts, s.rules);
  const months = monthly(s.transactions, sorted);
  const whole = wholeMonths(months, s.transactions, day);
  memo = { txs: s.transactions, key, day, value: { sorted, months, whole, usual: usualMonth(whole) } };
  return memo.value;
}

/** Adds the result of readBankFile to the stored data. Returns what addImport returns. */
export function importParsed(parsed, fileName) {
  const res = addImport(state, parsed, fileName, today());
  update((s) => { s.accounts = res.accounts; s.imports = res.imports; s.transactions = res.transactions; });
  keepSafe();
  return res;
}

export function removeImport(id) {
  update((s) => {
    s.transactions = s.transactions.filter((t) => t.imp !== id);
    s.imports = s.imports.filter((i) => i.id !== id);
    const used = new Set(s.transactions.map((t) => t.acct));
    s.accounts = s.accounts.filter((a) => used.has(a.id));
  });
}

/** Turns money in and money out around for one imported file, for a statement that listed them the other way. */
export function flipImport(id) {
  update((s) => { s.transactions = s.transactions.map((t) => (t.imp === id ? { ...t, amount: -t.amount } : t)); });
}

const AUTO = { bank: 'Bank account', card: 'Credit card' };
/**
 * Says what an account is: on a bank account a payment to a card is a bill, on a card it is a purchase,
 * so this decides how lines are counted. A name the dashboard made follows the type.
 */
export function setAccount(id, { kind, name } = {}) {
  update((s) => {
    const a = s.accounts.find((x) => x.id === id);
    if (!a) return;
    if (AUTO[kind] && kind !== a.kind) {
      if (a.name.startsWith(AUTO[a.kind])) a.name = AUTO[kind] + a.name.slice(AUTO[a.kind].length);
      a.kind = kind;
    }
    if (typeof name === 'string' && name.trim()) a.name = name.trim().slice(0, 60);
  });
}

/** Changes transactions by id. patch: { cat: 'groceries' | null, once: true | false }. null or false removes the mark. */
export function patchTransactions(ids, patch) {
  const want = new Set(ids);
  update((s) => {
    s.transactions = s.transactions.map((t) => {
      if (!want.has(t.id)) return t;
      const next = { ...t };
      if ('cat' in patch) { if (CAT[patch.cat]) next.cat = patch.cat; else delete next.cat; }
      if ('once' in patch) { if (patch.once) next.once = true; else delete next.once; }
      return next;
    });
  });
}

/** Adds or replaces a "description contains X" rule. Returns false when the text or category is unusable. */
export function addRule(match, cat) {
  const m = text(String(match || '').replace(/\s+/g, ' '), 80).toLowerCase();
  if (m.length < 2 || !CAT[cat]) return false;
  update((s) => { s.rules = s.rules.filter((r) => r.match !== m).concat({ id: newId('r'), match: m, cat }); });
  return true;
}
export function removeRule(id) { update((s) => { s.rules = s.rules.filter((r) => r.id !== id); }); }

/** Remembers which column is which for a kind of file the reader did not recognise. */
export function saveLayout(layout) {
  update((s) => { s.layouts = s.layouts.filter((l) => !(l.header === layout.header && l.headerRow === layout.headerRow)).concat(layout).slice(-20); });
}

/** The whole state as a file, and a note of when you last saved a copy. */
export function exportJson() {
  if (state.meta.exported !== today()) update((s) => { s.meta.exported = today(); });
  return JSON.stringify(state, null, 2);
}
