// Net worth: what you own and owe, once a month; how your investments grow against what you put in;
// and a rough answer to "when can I stop working?".
import { html, useStore, useState, NumberField } from '../ui.js';
import * as store from '../store.js';
import { investable, netWorth, change, grown, stopAge, GROWTH, LAST_AGE } from '../model.js';
import { investedBetween } from '../ledger.js';
import { ChartBox, baseOptions, color } from '../chart.js';
import { kr, signedKr, round500, today, dmy, daysBetween, plural } from '../format.js';

const FIELDS = [
  ['ask', 'ASK'], ['funds', 'Funds and shares outside ASK'], ['ips', 'IPS'], ['other', 'Other investments'],
  ['cash', 'Bank accounts'], ['home', 'Home'], ['car', 'Car and other things'], ['debt', 'Mortgage and other debt'],
];
const years = (a) => { const y = Math.floor(a), m = Math.round((a - y) * 12); return m ? `${y} years and ${plural(m, 'month')}` : `${y}`; };

function Summary({ s }) {
  const rows = s.networth, last = rows[rows.length - 1], prev = rows[rows.length - 2];
  if (!last) {
    return html`<div class="panel answer"><p class="big">No values yet.</p>
      <p>Once a month, type what you own and owe below. This page then shows how your net worth moves, and how much of the change in your investments was your own money and how much the market.</p></div>`;
  }
  const c = prev ? change(prev, last) : null, g = grown(last);
  return html`<div class="panel answer ok">
    <p class="big">Your net worth is <span class="num">${kr(netWorth(last))}</span>.</p>
    <p>
      ${c ? `Since ${dmy(prev.date)} it has ${c.netWorth >= 0 ? 'grown' : 'fallen'} by ${kr(Math.abs(c.netWorth))}. ` : ''}
      Your investments are worth ${kr(investable(last))}${g === null ? '.' : `: you put in ${kr(last.putIn)} and they have ${g >= 0 ? 'grown' : 'lost'} ${kr(Math.abs(g))}.`}
      ${c && c.putIn !== null ? ` This time you put in ${kr(c.putIn)} and the market ${c.market >= 0 ? 'added' : 'took'} ${kr(Math.abs(c.market))}.` : ''}
    </p>
    ${daysBetween(last.date, today()) > 40 ? html`<div class="note warn">Your latest values are from ${dmy(last.date)}. Add this month's below.</div>` : null}
  </div>`;
}

function Stop({ s }) {
  const L = store.ledger(s), pr = s.profile, p = store.roughInputs(s, L);
  const set = (k) => (v) => store.setProfile(k, Math.round(v));
  let answer, detail = null, more = null;
  if (!p) answer = html`<p class="big">Give the year you were born below, and this shows when you can stop.</p>`;
  else {
    const age = stopAge(p);
    answer = html`<p class="big">${age === null ? 'At this pace the money does not last if you stop before 75.' : age <= p.age ? 'You could stop working now.' : html`At this pace you can stop working at <span class="num">${age}</span>.`}</p>`;
    const pension = `your pension takes over part of it from ${years(p.pensionAge)}${pr.birthYear > 1963 ? ' (an estimate: the pension age is set to rise)' : ''}`;
    detail = html`<p>${age === null
      ? `Even stopping at 75, your investments would run out before you are ${LAST_AGE}, although ${pension}. `
      : `From that age your investments pay for what you spend until you are ${LAST_AGE}, and ${pension}. `}Tax on growth is counted; what you put in comes out tax-free first.</p>
      <p class="hint">Your investments are taken to grow ${String(GROWTH * 100).replace('.', ',')}% a year above prices. That is careful on purpose: it gives about the same age as a bad first ten years after you stop would.</p>`;
    const sooner = age === null || age > p.age ? stopAge({ ...p, invest: p.invest + 2000 }) : null;
    if (sooner !== null && sooner !== age) more = html`<p class="hint">Investing 2 000 kr more a month: you could stop at ${sooner}.</p>`;
  }
  const u = L.usual;
  return html`<div class="panel answer">
    <h2>When can you stop working?</h2>
    ${answer}${detail}${more}
    ${p && !pr.pension ? html`<div class="note warn">There is no pension in this yet, so the answer is too gloomy. Add yours below.</div>` : null}
    ${p && p.mortgage > 0 && !pr.mortgageEndYear ? html`<div class="note info">Say when the mortgage is paid off. Until you do, the mortgage is counted for life.</div>` : null}
    <div class="fields two wide">
      <${NumberField} id="birthYear" label="The year you were born" value=${pr.birthYear} placeholder="1985" onSave=${set('birthYear')} />
      <${NumberField} id="pension" label="Pension a month, after tax" value=${pr.pension} step="500" onSave=${set('pension')}
        hint="From NAV (nav.no, Din pensjon) plus what your employers have saved (norskpensjon.no). NAV assumes you work until the pension starts; if you stop earlier it is lower." />
      <${NumberField} id="mortgageEndYear" label="The mortgage is paid off in" value=${pr.mortgageEndYear} placeholder="2045" onSave=${set('mortgageEndYear')} hint="Leave empty if you have no mortgage." />
      ${u ? null : html`
        <${NumberField} id="spend" label="Living costs a month" value=${pr.spend} step="500" onSave=${set('spend')} hint="Everything except the mortgage and investing." />
        <${NumberField} id="mortgage" label="Mortgage payment a month" value=${pr.mortgage} step="500" onSave=${set('mortgage')} />
        <${NumberField} id="invest" label="You invest a month" value=${pr.invest} step="500" onSave=${set('invest')} />`}
    </div>
    <p class="hint">${u
      ? `From your bank files, the last ${plural(u.months, 'whole month')}: living costs ${kr(round500(u.living))}, mortgage ${kr(round500(u.mortgage))} and investing ${kr(round500(Math.max(0, u.investing)))} a month. They are used as they are. `
      : 'Once your bank files cover a whole month, these come from them instead. '}Investments come from your latest values below. Rough on purpose: it moves when your numbers do.</p>
  </div>`;
}

const empty = () => ({ date: today(), note: '', putIn: '', ...Object.fromEntries(FIELDS.map(([k]) => [k, ''])) });

function Form({ s, form, setForm }) {
  const [status, setStatus] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value, ...(k === 'putIn' ? { typed: true } : {}) });
  // What you had put in by this date: the entry before, plus what the bank files show moved into investments since.
  const before = [...s.networth].reverse().find((e) => e.date < form.date);
  const txs = s.transactions, covered = before && txs.length && txs[0].date <= before.date && txs[txs.length - 1].date >= form.date;
  const added = covered ? investedBetween(txs, store.ledger(s).sorted, before.date, form.date) : null;
  const suggestion = before && before.putIn !== null && added !== null ? Math.round(before.putIn + added) : null;
  const putIn = form.typed || suggestion === null ? form.putIn : String(suggestion);
  const save = (e) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) { setStatus('Pick a date first.'); return; }
    const entry = { date: form.date, note: form.note.trim() };
    for (const [k] of FIELDS) { const v = parseFloat(form[k]); entry[k] = isFinite(v) ? v : 0; }
    const pi = parseFloat(putIn);
    entry.putIn = isFinite(pi) ? pi : null;
    store.saveEntry(entry);
    setForm({ ...form, typed: false });          // the next date gets a fresh suggestion again
    setStatus(`Saved the values for ${dmy(form.date)}.`);
  };
  const copyLast = () => {
    const l = store.latest(s);
    if (l) setForm({ ...form, ...Object.fromEntries(FIELDS.map(([k]) => [k, l[k] ? String(l[k]) : ''])) });
  };
  return html`<div class="panel">
    <h2>Add this month's values</h2>
    <form onSubmit=${save} novalidate>
      <div class="form-grid">
        <label>Date <input type="date" id="f_date" value=${form.date} onInput=${set('date')} required /></label>
        ${FIELDS.map(([k, label]) => html`<label key=${k}>${label} <input type="number" id=${'f_' + k} step="any" min="0" inputmode="decimal" placeholder="0" value=${form[k]} onInput=${set(k)} /></label>`)}
        <label>Put into investments so far <input type="number" id="f_putIn" step="any" min="0" inputmode="decimal" value=${putIn} onInput=${set('putIn')} /></label>
        <label>Note <input type="text" id="f_note" maxlength="200" value=${form.note} onInput=${set('note')} /></label>
      </div>
      <p class="hint">${suggestion !== null && !form.typed
        ? `Filled in for you: ${kr(before.putIn)} by ${dmy(before.date)}, plus ${kr(added)} your bank files show moved into investments since. Change it if that is not right.`
        : 'Everything you have paid into your investments over the years, without growth. It shows how much of their value is your own money.'}</p>
      <div class="row" style="margin-top:12px">
        <button type="submit" class="primary">Save</button>
        <button type="button" onClick=${copyLast} disabled=${!s.networth.length}>Fill in from the last values</button>
        <span class="status" aria-live="polite">${status}</span>
      </div>
      <p class="hint">Copy the balances from your bank and broker once a month. Saving a date that is already there replaces it.</p>
    </form>
  </div>`;
}

function Over({ rows }) {
  if (rows.length < 2) return null;
  const known = rows.some((r) => r.putIn !== null);
  const line = (label, values, col, extra = {}) => ({ label, data: values, borderColor: col, backgroundColor: col, borderWidth: 2, pointRadius: rows.length > 24 ? 0 : 3, tension: 0, spanGaps: true, ...extra });
  const data = {
    labels: rows.map((r) => dmy(r.date)),
    datasets: [
      line('Net worth', rows.map(netWorth), color('--ink')),
      line('Investments', rows.map(investable), color('--accent')),
      ...(known ? [line('Put into investments', rows.map((r) => r.putIn), color('--muted'), { borderDash: [6, 4], pointRadius: 0 })] : []),
    ],
  };
  return html`<div class="panel">
    <h2>Over time</h2>
    <${ChartBox} type="line" data=${data} options=${baseOptions()} label="Net worth, investments and what you put into them, by date" />
    <p class="hint">The numbers are in the table below.</p>
  </div>`;
}

function Entries({ s, edit }) {
  const rows = s.networth;
  return html`<div class="panel">
    <h2>Your values</h2>
    <div class="scroll"><table id="table">
      ${rows.length
        ? html`<tr><th>Date</th><th>Investments</th><th>Put in so far</th><th>Bank</th><th>Home</th><th>Car, other</th><th>Debt</th><th>Net worth</th><th></th></tr>
          ${[...rows].reverse().map((r) => html`<tr key=${r.date}>
            <td>${dmy(r.date)}${r.note ? html`<br /><span class="status">${r.note}</span>` : null}</td>
            <td>${kr(investable(r))}</td><td>${r.putIn === null ? '' : kr(r.putIn)}</td><td>${kr(r.cash)}</td><td>${kr(r.home)}</td><td>${kr(r.car)}</td><td>${kr(r.debt)}</td>
            <td><b>${kr(netWorth(r))}</b></td>
            <td><button type="button" class="quiet" onClick=${() => edit(r)}>Edit</button><button type="button" class="quiet" onClick=${() => { if (confirm(`Delete the values for ${dmy(r.date)}?`)) store.removeEntry(r.date); }}>Delete</button></td>
          </tr>`)}`
        : html`<tr><td>Nothing saved yet.</td></tr>`}
    </table></div>
    ${rows.length > 1 ? html`<p class="hint">Since ${dmy(rows[0].date)} your net worth has changed by ${signedKr(netWorth(rows[rows.length - 1]) - netWorth(rows[0]))}.</p>` : null}
  </div>`;
}

export function NetWorth() {
  const s = useStore();
  const [form, setForm] = useState(empty);
  const edit = (r) => {
    setForm({ date: r.date, note: r.note || '', putIn: r.putIn === null ? '' : String(r.putIn), typed: true, ...Object.fromEntries(FIELDS.map(([k]) => [k, r[k] ? String(r[k]) : ''])) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return html`<h1>Net worth</h1>
    <${Summary} s=${s} />
    <${Form} s=${s} form=${form} setForm=${setForm} />
    <${Stop} s=${s} />
    <${Over} rows=${s.networth} />
    <${Entries} s=${s} edit=${edit} />`;
}
