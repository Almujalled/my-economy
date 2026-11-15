// All personal data lives in this browser. Nothing is sent anywhere.
// Small things (profile, plans, net worth, rules) are in localStorage; transactions are in IndexedDB,
// because years of bank lines can outgrow localStorage. Pages see one state object either way.
// The repository is public: never put real numbers in code, tests or docs.
import { investable, monthsToRepay, balanceAfter } from './model.js';
import { pensionAgeMonths, HELPER_FROM } from './pension.js';
import { CAT } from './categories.js';
import { addImport, sortAll, monthly, wholeMonths, usualMonth } from './ledger.js';
import { today } from './format.js';
import * as db from './db.js';

export const KEY = 'money-dashboard-v1'; // the name is from the first version; kept so existing data is found
const TX_KEY = 'transactions';
export const SCHEMA = 2;
const thisYear = () => new Date().getFullYear();
const newId = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function newPlan(name = 'My plan') {
  return { id: newId('p'), name, invest: 5000, retAge: 65, spend: 30000, scen: 1, crash: 0, side: 0, sideUntil: 62 };
}

// Neutral starting values. Not anyone's real numbers.
export function defaultState() {
  const plan = newPlan();
  return {
    schema: SCHEMA,
    profile: {
      birthYear: thisYear() - 40,
      takehome: 50000, livingNow: 30000,
      portfolio: 0, basis: 0, basisDate: '',
      mortgagePayment: 0, mortgageEndYear: thisYear(), mortgageBalance: 0, mortgageRate: 0, mortgageAsOf: '',
      pension: 0, pensionPot: 0, pensionPotYear: 0, grossPay: 0, norwayYears: 40, workPot: 0, workRate: 2,
      horizon: 95, otherWealth: 0, couple: 0,
    },
    plans: [plan],
    activePlan: plan.id,
    networth: [],      // [{date:'YYYY-MM-DD', ask, funds, ips, other, cash, home, car, debt, paidIn, note}]
    accounts: [],      // [{id, name, kind:'bank'|'card', tail, sig}]
    imports: [],       // [{id, file, acct, date, from, to, count}]
    rules: [],         // [{id, match, cat}]  your own "description contains X" rules
    layouts: [],       // [{headerRow, cols:{date,text,amount|in,out}, kind, header}]  column choices for files not recognised
    transactions: [],  // [{id, date, text, amount, acct, imp, type?, mcat?, memo?, principal?, interest?, peer?, cat?, once?}]
    done: {},          // checklist ticks: { key: 'YYYY-MM-DD' }
    meta: { exported: '', saved: '' },   // exported: day of the last backup. saved: moment of the last change.
  };
}

const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateOr = (v, d) => (typeof v === 'string' && DATE.test(v) ? v : d);
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v) => (Array.isArray(v) ? v : []);

// Accepts anything, returns a valid state. Unknown fields are dropped. Older formats are brought up to date here.
export function sanitize(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const out = { schema: SCHEMA, profile: {}, plans: [], activePlan: null, networth: [], accounts: [], imports: [], rules: [], layouts: [], transactions: [], done: {}, meta: { exported: '', saved: '' } };
  for (const [k, def] of Object.entries(d.profile)) out.profile[k] = typeof def === 'string' ? dateOr(raw.profile?.[k], '') : num(raw.profile?.[k], def);
  for (const p of list(raw.plans)) {
    if (!p || typeof p !== 'object') continue;
    const b = newPlan();
    out.plans.push({
      id: typeof p.id === 'string' ? p.id.slice(0, 40) : b.id,
      name: text(p.name, 60) || b.name,
      invest: num(p.invest, b.invest), retAge: num(p.retAge, b.retAge), spend: num(p.spend, b.spend),
      scen: Math.min(2, Math.max(0, Math.round(num(p.scen, 1)))), crash: num(p.crash, 0), side: num(p.side, 0), sideUntil: num(p.sideUntil, b.sideUntil),
    });
  }
  if (!out.plans.length) out.plans = d.plans;
  out.activePlan = out.plans.some((p) => p.id === raw.activePlan) ? raw.activePlan : out.plans[0].id;
  for (const s of list(raw.networth)) {
    if (!s || !DATE.test(s.date || '')) continue;
    const row = { date: s.date, note: text(s.note, 200), paidIn: typeof s.paidIn === 'number' && isFinite(s.paidIn) ? s.paidIn : null };
    for (const k of ['ask', 'funds', 'ips', 'other', 'cash', 'home', 'car', 'debt']) row[k] = num(s[k], 0);
    out.networth.push(row);
  }
  out.networth.sort((a, b) => a.date.localeCompare(b.date));

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
    if (!acctIds.has(t.acct)) { // lines without a known account are kept, under a stand-in account
      if (!acctIds.has('a0')) { out.accounts.push({ id: 'a0', name: 'Bank account', kind: 'bank', tail: '', sig: 'bank:' }); acctIds.add('a0'); }
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
  if (raw.done && typeof raw.done === 'object') {
    for (const [k, v] of Object.entries(raw.done)) if (/^[a-z0-9-]{1,40}$/.test(k) && DATE.test(v)) out.done[k] = v;
  }
  out.meta.exported = dateOr(raw.meta?.exported, '');
  out.meta.saved = typeof raw.meta?.saved === 'string' && !isNaN(Date.parse(raw.meta.saved)) ? raw.meta.saved.slice(0, 30) : '';
  return out;
}

let state = defaultState();
const listeners = new Set();
let saved = true, txSaved = true;
const notify = () => listeners.forEach((l) => l(state));
const local = () => { try { return globalThis.localStorage || null; } catch { return null; } };

/** Reads saved data. Call once before showing a page. */
export async function load() {
  let core = null, txs = null;
  try { const raw = local()?.getItem(KEY); if (raw) core = JSON.parse(raw); } catch { /* start fresh */ }
  try { txs = await db.get(TX_KEY); }
  catch { try { const raw = local()?.getItem(KEY + '-tx'); if (raw) txs = JSON.parse(raw); } catch { /* none */ } }
  if (core || txs) state = sanitize({ ...(core || {}), transactions: Array.isArray(txs) ? txs : core?.transactions });
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
export function update(fn) {
  const before = state.transactions;
  fn(state);
  state.meta.saved = new Date().toISOString();
  persist(state.transactions !== before);
  notify();
}
export function replace(next) { state = sanitize(next); persist(true); notify(); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const activePlan = (s = state) => s.plans.find((p) => p.id === s.activePlan) || s.plans[0];
export const latestSnapshot = (s = state) => (s.networth.length ? s.networth[s.networth.length - 1] : null);

/** Asks the browser not to clear this site's data when it tidies up. Safe to call often. */
export function keepSafe() {
  try { globalThis.navigator?.storage?.persist?.().catch(() => {}); } catch { /* not supported */ }
}

// ---------- plan inputs ----------
// The planner starts from your latest net worth entry when there is one.
export function currentPortfolio(s = state) {
  const snap = latestSnapshot(s);
  return snap ? investable(snap) : s.profile.portfolio;
}

/** What you have paid in: the number you typed, plus what later net worth entries say you added. */
export function currentBasis(s = state) {
  let sum = s.profile.basis;
  for (const e of s.networth) if (typeof e.paidIn === 'number' && e.date > (s.profile.basisDate || '')) sum += e.paidIn;
  return Math.max(0, sum);
}

const monthsBetween = (from, to) => (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7));

/**
 * The mortgage as the planner needs it. With a balance and a rate, the pay-off time is worked out
 * (and the balance is rolled forward from the day you typed it). Without them, the year you typed is used.
 * Returns { yearsLeft, balance, rate, never } where never = the payment does not cover the interest.
 */
export function mortgageNow(s = state, day = today()) {
  const pr = s.profile, year = +day.slice(0, 4);
  if (!(pr.mortgageBalance > 0 && pr.mortgagePayment > 0)) return { yearsLeft: Math.max(0, pr.mortgageEndYear - year), balance: 0, rate: 0, never: false };
  const passed = pr.mortgageAsOf ? Math.max(0, monthsBetween(pr.mortgageAsOf, day)) : 0;
  const balance = balanceAfter(pr.mortgageBalance, pr.mortgageRate, pr.mortgagePayment, passed);
  const months = monthsToRepay(balance, pr.mortgageRate, pr.mortgagePayment);
  return { yearsLeft: months === null ? 200 : Math.ceil(months / 12), balance, rate: pr.mortgageRate, never: months === null };
}

/** Home, bank and debt from the latest net worth entry, for the wealth tax. null without an entry. */
export function wealthParts(s = state) {
  const snap = latestSnapshot(s);
  return snap ? { home: snap.home, cash: snap.cash + snap.car, debt: snap.debt } : null;
}

// Turns stored profile + plan into the inputs model.simulate() expects.
export function planInputs(s, plan, year = thisYear()) {
  const pr = s.profile;
  const portfolio = currentPortfolio(s);
  const mortgage = mortgageNow(s, year === thisYear() ? today() : `${year}-01-01`);
  const helper = pr.pensionPot > 0 && pr.birthYear >= HELPER_FROM;
  return {
    age: year - pr.birthYear,
    portfolio,
    basis: Math.min(currentBasis(s), portfolio),
    mortgagePayment: pr.mortgagePayment,
    mortgageYearsLeft: mortgage.yearsLeft,
    mortgageBalance: mortgage.balance, mortgageRate: mortgage.rate,
    horizon: pr.horizon,
    // With a pension pot from NAV the state pension is worked out for each stop age; otherwise the typed figure is used.
    pension: pr.pension, pensionAge: pensionAgeMonths(pr.birthYear) / 12,
    state: helper ? { birthYear: pr.birthYear, pot: pr.pensionPot, potYear: pr.pensionPotYear || year, pay: pr.grossPay, norwayYears: pr.norwayYears, partner: !!pr.couple } : undefined,
    work: helper && pr.workPot > 0 ? { pot: pr.workPot, rate: Math.max(0, pr.workRate) / 100, pay: pr.grossPay } : undefined,
    // With a net worth entry, wealth tax is worked out from its parts and follows the mortgage down.
    otherWealth: pr.otherWealth, wealth: wealthParts(s), people: pr.couple ? 2 : 1,
    crash: plan.crash || 0, sideIncome: plan.side || 0, sideUntil: plan.sideUntil || 0,
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

/** The whole state as a file, and a note of when you last took a backup. */
export function exportJson() {
  if (state.meta.exported !== today()) update((s) => { s.meta.exported = today(); });
  return JSON.stringify(state, null, 2);
}
