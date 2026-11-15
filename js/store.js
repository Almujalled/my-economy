// All personal data lives in the browser (localStorage). Nothing is sent anywhere.
// The repository is public: never put real numbers in code, tests or docs.
import { investable } from './model.js';

const KEY = 'money-dashboard-v1';
export const SCHEMA = 1;
const thisYear = () => new Date().getFullYear();

export function newPlan(name = 'My plan') {
  return { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, invest: 5000, retAge: 65, spend: 30000, scen: 1, crash: 0 };
}

// Neutral starting values. Not anyone's real numbers.
export function defaultState() {
  const plan = newPlan();
  return {
    schema: SCHEMA,
    profile: {
      birthYear: thisYear() - 40,
      takehome: 50000, livingNow: 30000,
      portfolio: 0, basis: 0,
      mortgagePayment: 0, mortgageEndYear: thisYear(),
      pension: 0, horizon: 95, otherWealth: 0,
    },
    plans: [plan],
    activePlan: plan.id,
    networth: [],   // [{date:'YYYY-MM-DD', ask, funds, ips, other, cash, home, car, debt, note}]
  };
}

const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

// Accepts anything, returns a valid state. Unknown fields are dropped.
export function sanitize(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const out = { schema: SCHEMA, profile: {}, plans: [], activePlan: null, networth: [] };
  for (const k of Object.keys(d.profile)) out.profile[k] = num(raw.profile?.[k], d.profile[k]);
  for (const p of Array.isArray(raw.plans) ? raw.plans : []) {
    if (!p || typeof p !== 'object') continue;
    const b = newPlan();
    out.plans.push({
      id: typeof p.id === 'string' ? p.id.slice(0, 40) : b.id,
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 60) : b.name,
      invest: num(p.invest, b.invest), retAge: num(p.retAge, b.retAge), spend: num(p.spend, b.spend),
      scen: Math.min(2, Math.max(0, Math.round(num(p.scen, 1)))), crash: num(p.crash, 0),
    });
  }
  if (!out.plans.length) out.plans = d.plans;
  out.activePlan = out.plans.some((p) => p.id === raw.activePlan) ? raw.activePlan : out.plans[0].id;
  for (const s of Array.isArray(raw.networth) ? raw.networth : []) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.date || '')) continue;
    const row = { date: s.date, note: typeof s.note === 'string' ? s.note.slice(0, 200) : '' };
    for (const k of ['ask', 'funds', 'ips', 'other', 'cash', 'home', 'car', 'debt']) row[k] = num(s[k], 0);
    out.networth.push(row);
  }
  out.networth.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

let state = defaultState();
const listeners = new Set();
let saved = true;

export function load() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) state = sanitize(JSON.parse(raw));
  } catch { /* start fresh */ }
  return state;
}
function persist() {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(state)); saved = true; }
  catch { saved = false; }
}
export const get = () => state;
export const isSaved = () => saved;
export function update(fn) { fn(state); persist(); listeners.forEach((l) => l(state)); }
export function replace(next) { state = sanitize(next); persist(); listeners.forEach((l) => l(state)); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const activePlan = (s = state) => s.plans.find((p) => p.id === s.activePlan) || s.plans[0];
export const latestSnapshot = (s = state) => (s.networth.length ? s.networth[s.networth.length - 1] : null);

// The planner starts from your latest net worth entry when there is one.
export function currentPortfolio(s = state) {
  const snap = latestSnapshot(s);
  return snap ? investable(snap) : s.profile.portfolio;
}

// Turns stored profile + plan into the inputs model.simulate() expects.
export function planInputs(s, plan, year = thisYear()) {
  const pr = s.profile;
  const portfolio = currentPortfolio(s);
  return {
    age: year - pr.birthYear,
    portfolio,
    basis: Math.min(pr.basis, portfolio),
    mortgagePayment: pr.mortgagePayment,
    mortgageYearsLeft: Math.max(0, pr.mortgageEndYear - year),
    pension: pr.pension, horizon: pr.horizon, otherWealth: pr.otherWealth,
    crash: plan.crash || 0,
  };
}
