// Spending: reads bank and card exports in the browser, sorts each line into a category,
// and answers "what does a usual month cost?". Files are never uploaded.
import { html, useStore, useState, useRef } from '../ui.js';
import * as store from '../store.js';
import { readBankFile, guessLayout, makeLayout, toTransactions } from '../bankfile.js';
import { FLOWS, CATEGORIES, CAT, UNSORTED, cleanText, merchantKey, ruleLabel } from '../categories.js';
import { monthOf, unsortedGroups, bigPurchases, coverage } from '../ledger.js';
import { ChartBox, baseOptions, color } from '../chart.js';
import { kr, round500, monthName, monthShort, dmy, plural, pct } from '../format.js';

const WHY = {
  empty: 'The file is empty.',
  'old-excel': 'This is an old Excel file (.xls). Open it, save it as .xlsx or CSV, and try again.',
  'web-page': 'This file is a web page, not a spreadsheet. In your online bank, choose export to Excel or CSV.',
  'no-rows': 'The columns were found, but there were no transactions under them.',
  'not-zip': 'The file could not be opened as an Excel file. Export it again, or export as CSV.',
  'not-xlsx': 'The file could not be opened as an Excel file. Export it again, or export as CSV.',
  damaged: 'The file is damaged. Export it again from your bank.',
  locked: 'The file is password-protected. Save a copy without the password and try again.',
  'old-browser': 'This browser cannot open .xlsx files. Update the browser, or export as CSV.',
  'too-big': 'The file is far too large to be a bank export.',
  'no-header': 'Could not find any transactions in this file. A bank file needs a date, a description and an amount on each line.',
};
const why = (e) => WHY[e && e.code] || 'The file could not be read. Export it again as Excel or CSV.';
const KIND = { bank: 'bank account', card: 'credit card' };
const other = (kind) => (kind === 'card' ? 'bank' : 'card');
let nextLog = 0;

/** The categories for a dropdown, grouped by flow. */
const CatOptions = ({ first }) => [
  first ? html`<option value="">${first}</option>` : null,
  ...FLOWS.map((f) => {
    const cats = CATEGORIES.filter((c) => c.flow === f.id && !UNSORTED.has(c.id));
    return cats.length ? html`<optgroup key=${f.id} label=${f.name}>${cats.map((c) => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</optgroup>` : null;
  }),
];

// ---------- adding files ----------
function LogLine({ e, accounts, dismiss }) {
  if (e.bad) return html`<li class="bad"><b>${e.file}</b>: ${e.text}</li>`;
  if (e.removed) return html`<li><b>${e.file}</b>: removed again.</li>`;
  if (e.nothing) return html`<li><b>${e.file}</b>: nothing new. All ${plural(e.count, 'line')} were already here.</li>`;
  const a = accounts.find((x) => x.id === e.acct);
  return html`<li><b>${e.file}</b>: read as a <b data-read=${e.acct}>${a ? KIND[a.kind] : 'file'}</b>${e.tail ? ` ending in ${e.tail}` : ''}.
    Added ${plural(e.added, 'line')} from ${dmy(e.from)} to ${dmy(e.to)}. ${e.notes.join(' ')}
    <button type="button" class="quiet" data-undo=${e.imp} onClick=${() => { store.removeImport(e.imp); dismiss(e.id); }}>Undo</button>
    ${a ? html`<button type="button" class="quiet" data-kind=${a.id} onClick=${() => store.setAccount(a.id, { kind: other(a.kind) })}>No, it is a ${KIND[other(a.kind)]}</button>` : null}
  </li>`;
}

// When a file's columns are not recognised: show its first lines and ask which column is which.
const letter = (i) => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));
function Mapper({ job, add, skip }) {
  const guess = guessLayout(job.rows);
  const [c, setC] = useState({ skip: guess.headerRow + 1, kind: 'bank', date: guess.cols.date, text: guess.cols.text, amount: guess.cols.amount, out: '' });
  const [status, setStatus] = useState('');
  const width = Math.min(30, Math.max(...job.rows.slice(0, 30).map((r) => r.length)));
  const cell = (v) => String(v === null || v === undefined ? '' : v).slice(0, 28);
  const sample = job.rows[Math.min(job.rows.length - 1, guess.headerRow + 1)] || [];
  const cols = Array.from({ length: width }, (_, i) => i);
  const pick = (k) => (e) => setC({ ...c, [k]: e.target.value === '' ? '' : +e.target.value });
  const columns = (none) => [none ? html`<option value="">${none}</option>` : null,
    ...cols.map((i) => html`<option key=${i} value=${i}>${letter(i)}${cell(sample[i]) ? ': ' + cell(sample[i]) : ''}</option>`)];
  const go = () => {
    const chosen = { date: c.date, text: c.text };
    if (c.out === '') chosen.amount = c.amount; else { chosen.in = c.amount; chosen.out = c.out; }
    const layout = makeLayout(job.rows, +c.skip || 0, chosen, c.kind);
    const parsed = toTransactions(job.rows, layout);
    if (!parsed.txs.length) { setStatus('No lines could be read with these choices. Check which column holds the date and which the amount.'); return; }
    store.saveLayout(layout);
    add(job.name, parsed);
  };
  return html`<div class="note info" id="mapper">
    <p><b>${job.name}</b>: the dashboard does not know the columns in this file. Show it which is which, and it will remember for next time.</p>
    <div class="scroll"><table class="preview">
      <tr><th></th>${cols.map((i) => html`<th key=${i}>${letter(i)}</th>`)}</tr>
      ${job.rows.slice(0, 7).map((r, n) => html`<tr key=${n}><td class="status">${n + 1}</td>${cols.map((i) => html`<td key=${i}>${cell(r[i])}</td>`)}</tr>`)}
    </table></div>
    <div class="fields two wide" style="margin-top:12px">
      <div class="field"><label for="mSkip">Lines before the first transaction</label><input type="number" id="mSkip" min="0" max="40" step="1" value=${c.skip} onInput=${(e) => setC({ ...c, skip: e.target.value })} /></div>
      <div class="field"><label for="mKind">The file is from a</label><select id="mKind" value=${c.kind} onChange=${(e) => setC({ ...c, kind: e.target.value })}><option value="bank">Bank account</option><option value="card">Credit card</option></select></div>
      <div class="field"><label for="mDate">Date is in column</label><select id="mDate" value=${c.date} onChange=${pick('date')}>${columns()}</select></div>
      <div class="field"><label for="mText">Description is in column</label><select id="mText" value=${c.text} onChange=${pick('text')}>${columns()}</select></div>
      <div class="field"><label for="mAmount">Amount is in column</label><select id="mAmount" value=${c.amount} onChange=${pick('amount')}>${columns()}</select><small>If money in and money out have a column each, choose money in here.</small></div>
      <div class="field"><label for="mOut">Money out is in column</label><select id="mOut" value=${c.out} onChange=${pick('out')}>${columns('The same column: minus means money out')}</select></div>
    </div>
    <div class="row" style="margin-top:12px"><button type="button" class="primary" id="mGo" onClick=${go}>Add these lines</button><button type="button" id="mCancel" onClick=${skip}>Skip this file</button><span class="status" aria-live="polite">${status}</span></div>
  </div>`;
}

function AddFiles({ s }) {
  const [log, setLog] = useState([]);           // what happened to each file you added, newest first
  const [waiting, setWaiting] = useState([]);   // files whose columns you have to point out, one at a time
  const [over, setOver] = useState(false);
  const input = useRef(null);
  const note = (entry) => setLog((l) => [{ id: ++nextLog, ...entry }, ...l]);
  const add = (file, parsed) => {
    const res = store.importParsed(parsed, file);
    if (!res.added) { note({ file, nothing: true, count: parsed.txs.length }); return; }
    const notes = [];
    if (res.dupes) notes.push(`Skipped ${plural(res.dupes, 'line')} you already had.`);
    if (parsed.pending) notes.push(`Left out ${plural(parsed.pending, 'line')} the bank has not booked yet; they come with your next export.`);
    if (parsed.skipped) notes.push(`${plural(parsed.skipped, 'row')} had no date or amount and ${parsed.skipped === 1 ? 'was' : 'were'} ignored.`);
    if (parsed.flipped) notes.push('This statement listed purchases as plus amounts, so they were turned into money out.');
    note({ file, acct: res.account.id, tail: res.account.tail, added: res.added, from: parsed.from, to: parsed.to, notes, imp: res.imp.id });
  };
  const addFiles = async (files) => {
    for (const file of files) {
      try {
        add(file.name, await readBankFile(await file.arrayBuffer(), store.get().layouts));
      } catch (e) {
        // Ask which column is which only when the file has dates in it; otherwise it is not a list of transactions.
        if (e && e.code === 'no-header' && e.rows && guessLayout(e.rows).cols.date !== undefined) setWaiting((w) => [...w, { id: ++nextLog, name: file.name, rows: e.rows }]);
        else note({ file: file.name, bad: true, text: why(e) });
      }
    }
  };
  const job = waiting[0];
  const done = () => setWaiting((w) => w.slice(1));
  const drag = (on) => (e) => { e.preventDefault(); setOver(on); };
  return html`<div class="panel" id="addPanel">
    <h2>Add bank files</h2>
    <p>Start with one file: the account your pay comes into and your bills are paid from. In your online bank, export its transactions as Excel or CSV and add the file here. It is read in this browser and never uploaded.</p>
    <p class="hint" style="margin:0 0 10px">That one account is enough. What you pay to a credit card counts as living costs, as one sum. Add a card's own file only if you want what you bought with it sorted too.</p>
    <div class=${'drop' + (over ? ' over' : '')} onDragEnter=${drag(true)} onDragOver=${drag(true)} onDragLeave=${drag(false)}
      onDrop=${(e) => { drag(false)(e); addFiles([...e.dataTransfer.files]); }}>
      <button type="button" class="primary" id="pick" onClick=${() => input.current.click()}>Choose files</button>
      <span>or drop them here. Adding the same period twice is safe: lines you already have are skipped.</span>
      <input type="file" id="files" ref=${input} accept=".xlsx,.csv,.txt" multiple hidden onChange=${async (e) => { await addFiles([...e.target.files]); e.target.value = ''; }} />
    </div>
    ${job ? html`<${Mapper} key=${job.id} job=${job} add=${(name, parsed) => { add(name, parsed); done(); }} skip=${() => { note({ file: job.name, bad: true, text: 'skipped.' }); done(); }} />` : null}
    <ul class="log" id="log" aria-live="polite">${log.map((e) => html`<${LogLine} key=${e.id} e=${e} accounts=${s.accounts} dismiss=${(id) => setLog((l) => l.map((x) => (x.id === id ? { ...x, removed: true } : x)))} />`)}</ul>
  </div>`;
}

// ---------- the answer ----------
function Answer({ s, L, groups }) {
  const u = L.usual, txs = s.transactions;
  if (!txs.length) {
    return html`<div class="panel answer" id="answer"><p class="big">No bank files yet.</p>
      <p>Add an export from your bank below, and this page shows what a usual month costs you, sorted into groceries, transport and so on.</p></div>`;
  }
  const count = groups.reduce((n, g) => n + g.count, 0), sum = groups.reduce((n, g) => n + g.sum, 0);
  return html`<div class=${'panel answer' + (u ? ' ok' : '')} id="answer">
    ${u
      ? html`<p class="big">You spend about <span class="num">${kr(round500(u.living))}</span> a month on living costs.</p>
        <p>That is the average of ${u.months === 1 ? 'the one whole month' : `the last ${u.months} whole months`} in your files (${monthName(u.from)}${u.from === u.to ? '' : ' to ' + monthName(u.to)}). The mortgage, investing, moves between your own accounts and one-offs are left out.</p>
        ${u.oneoff > 0 ? html`<p>One-offs in the same period come to about ${kr(round500(u.oneoff))} a month on top.</p>` : null}
        ${u.months < 12 ? html`<div class="note info">This covers ${plural(u.months, 'month')}. Bills that come once a year and holidays may be missing, so the real figure is likely higher. Add older files until you have 12 months.</div>` : null}`
      : html`<p class="big">Not a whole month yet.</p><p>You have ${plural(txs.length, 'line')} from ${dmy(txs[0].date)} to ${dmy(txs[txs.length - 1].date)}. Add files that cover at least one full calendar month.</p>`}
    ${count ? html`<div class="note warn">${plural(count, 'line')} worth ${kr(sum)} ${count === 1 ? 'is' : 'are'} not sorted yet. Until then, money out counts as living costs and money in as income. Start with the lines that are something else: saving, a loan, or money moved between your own accounts.</div>` : null}
  </div>`;
}

function SortThese({ groups }) {
  const [shown, setShown] = useState(8);
  if (!groups.length) return null;
  const choose = (g) => (e) => { const v = e.target.value; if (v && !store.addRule(g.key, v)) store.patchTransactions(g.ids, { cat: v }); };
  return html`<div class="panel" id="sortPanel">
    <h2>Sort these</h2>
    <p class="hint" style="margin:0 0 10px">Lines the dashboard did not recognise, biggest first. Pick a category once and every line from that place follows, now and in future files. A payment to your credit card is a Credit card bill, not a move between your own accounts.</p>
    <div id="groups">${groups.slice(0, shown).map((g) => html`<div class="group" key=${g.dir + g.key}>
      <div><b>${g.label}</b><span class="status">${g.dir === 'in' ? 'Money in' : 'Money out'} · ${plural(g.count, 'line')} · ${kr(g.sum)} · last ${dmy(g.latest)}</span></div>
      <select value="" onChange=${choose(g)} aria-label=${'Category for ' + g.label}>${CatOptions({ first: 'Choose category…' })}</select></div>`)}</div>
    ${groups.length > shown ? html`<button type="button" class="quiet" onClick=${() => setShown(shown + 20)}>Show ${Math.min(20, groups.length - shown)} more of ${groups.length - shown}</button>` : null}
  </div>`;
}

// ---------- where the money goes ----------
function Months({ L, shown, pick }) {
  const months = L.months.slice(-24), u = L.usual, whole = new Set(L.whole.map((r) => r.month));
  const live = color('--live'), sel = color('--accent');
  const data = {
    labels: months.map((r, i) => monthShort(r.month) + (r.month.endsWith('-01') || i === 0 ? ' ' + r.month.slice(2, 4) : '')),
    datasets: [
      { type: 'bar', label: 'Living costs', data: months.map((r) => r.living), backgroundColor: months.map((r) => (r.month === shown ? sel : live)), borderRadius: 4, order: 2 },
      ...(u ? [{ type: 'line', label: 'Usual month', data: months.map(() => u.living), borderColor: color('--muted'), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, order: 1 }] : []),
    ],
  };
  const options = baseOptions({ onClick: (e, els) => { if (els.length) pick(months[els[0].index].month); } });
  options.plugins.tooltip.callbacks.title = (items) => { const r = months[items[0].dataIndex]; return monthName(r.month) + (whole.has(r.month) ? '' : ' (not a whole month)'); };
  return html`<div class="panel">
    <h2>Living costs month by month</h2>
    <${ChartBox} type="bar" data=${data} options=${options} label="Living costs for each month" height=${240} />
    <p class="hint">Choose a month in the chart, or in the list below, to see where the money went.</p>
  </div>`;
}

function WhereItGoes({ L, shown, setPeriod, showTx }) {
  const u = L.usual, whole = new Set(L.whole.map((r) => r.month));
  const row = shown === 'avg' ? u : L.months.find((r) => r.month === shown);
  if (!row) return null;
  const avg = shown === 'avg', amt = (v) => kr(avg ? round500(v) : v);
  const cats = Object.entries(row.cats).filter(([c]) => CAT[c].flow === 'spending' || c === 'loan').sort((a, b) => b[1] - a[1]);
  const top = Math.max(1, ...cats.map(([, v]) => v));
  return html`<div class="panel">
    <div class="row between">
      <h2 style="margin:0">${avg ? 'Where it goes in a usual month' : `Where it went in ${monthName(shown)}`}</h2>
      <select id="period" value=${shown} onChange=${(e) => setPeriod(e.target.value)} aria-label="Period to show">
        ${u ? html`<option value="avg">A usual month</option>` : null}
        ${[...L.months].reverse().map((r) => html`<option key=${r.month} value=${r.month}>${monthName(r.month)}${whole.has(r.month) ? '' : ' (part)'}</option>`)}
      </select>
    </div>
    <div class="ranked" id="ranked">${cats.length
      ? cats.map(([c, v]) => html`<button type="button" class="rank" key=${c} data-cat=${c} title="Show these lines" onClick=${() => showTx(c)}>
          <span class="rank-n">${CAT[c].name}</span><span class="rank-b"><i style=${`width:${Math.max(0, (v / top) * 100).toFixed(1)}%`}></i></span>
          <span class="rank-v">${amt(v)}</span><span class="rank-p">${row.living > 0 ? pct((v / row.living) * 100) : ''}</span></button>`)
      : html`<p class="status">No living costs in this period.</p>`}</div>
    ${row.cats.cardbill > 0 ? html`<p class="hint" id="cardNote" style="margin-top:10px"><b>Credit card bill.</b> ${CAT.cardbill.hint}</p>` : null}
    <div class="scroll"><table id="rest" class="fit" style="margin-top:14px">
      <tr><th>${avg ? 'The whole month, on average' : 'The whole month'}</th><th></th></tr>
      <tr><td>Money in</td><td>${amt(row.income)}</td></tr>
      <tr><td>Living costs</td><td>${amt(row.living)}</td></tr>
      <tr><td>Mortgage${row.principal || row.interest ? html` <span class="status">(${amt(row.interest)} interest, ${amt(row.principal)} paid down)</span>` : null}</td><td>${amt(row.mortgage)}</td></tr>
      <tr><td>Investing</td><td>${amt(row.investing)}</td></tr>
      <tr><td>One-offs</td><td>${amt(row.oneoff)}</td></tr>
      <tr class="sel"><td>Left over</td><td>${amt(row.left)}</td></tr>
    </table></div>
  </div>`;
}

function OneOffs({ s, L }) {
  const u = L.usual, txs = s.transactions;
  const big = bigPurchases(txs, L.sorted, u ? u.from : L.months[0].month, u ? u.living : 0);
  const marked = txs.filter((t) => t.once).slice(-12).reverse();
  if (!big.length && !marked.length) return null;
  return html`<div class="panel" id="bigPanel">
    <h2>One-offs</h2>
    <p>A one-off is something big that will not come back every year, like a new roof or a car. One-offs are left out of your usual month so they do not distort it. Holidays and insurance do come back, so they are normal spending.</p>
    ${big.length ? html`<p><b>Were any of these one-offs?</b></p>${big.map((t) => html`<div class="group" key=${t.id}><div><b>${cleanText(t.text)}</b><span class="status">${dmy(t.date)} · ${kr(-t.amount)} · ${CAT[L.sorted.get(t.id).cat].name}</span></div>
      <button type="button" data-once=${t.id} onClick=${() => store.patchTransactions([t.id], { once: true })}>Yes, a one-off</button></div>`)}` : null}
    ${marked.length ? html`<p style="margin-top:12px"><b>Marked as one-offs</b></p>${marked.map((t) => html`<div class="group" key=${t.id}><div><b>${cleanText(t.text)}</b><span class="status">${dmy(t.date)} · ${kr(Math.abs(t.amount))}</span></div>
      <button type="button" class="quiet" onClick=${() => store.patchTransactions([t.id], { once: false })}>Not a one-off</button></div>`)}` : null}
  </div>`;
}

// ---------- the engine room: every line, your rules, your files ----------
function AllTx({ s, L, f, setF, txRef }) {
  const [offer, setOffer] = useState(null);     // { key, cat }: "always sort this place like that?"
  const acct = new Map(s.accounts.map((a) => [a.id, a.name]));
  const hits = [];
  if (f.open) {
    const q = f.q.trim().toLowerCase();
    for (let i = s.transactions.length - 1; i >= 0; i--) {
      const t = s.transactions[i], c = L.sorted.get(t.id);
      if (f.month && monthOf(t.date) !== f.month) continue;
      if (f.cat === '?' ? !UNSORTED.has(c.cat) : f.cat === '!' ? !t.once : f.cat && c.cat !== f.cat) continue;
      if (q && !`${t.text} ${t.memo || ''}`.toLowerCase().includes(q)) continue;
      hits.push([t, c]);
    }
  }
  const choose = (t) => (e) => {
    const v = e.target.value, key = merchantKey(t);
    setOffer(v && !s.rules.some((r) => r.match === key && r.cat === v) ? { key, cat: v } : null);
    store.patchTransactions([t.id], { cat: v || null });
  };
  return html`<details id="allTx" ref=${txRef} open=${f.open} onToggle=${(e) => { if (e.target.open !== f.open) setF({ ...f, open: e.target.open }); }}>
    <summary>All transactions</summary>
    <div class="row" style="margin:12px 0">
      <input type="text" id="q" placeholder="Search description" aria-label="Search description" style="flex:1;min-width:140px" value=${f.q} onInput=${(e) => setF({ ...f, q: e.target.value, shown: 60 })} />
      <select id="fMonth" aria-label="Month" value=${f.month} onChange=${(e) => setF({ ...f, month: e.target.value, shown: 60 })}>
        <option value="">All months</option>${[...L.months].reverse().map((r) => html`<option key=${r.month} value=${r.month}>${monthName(r.month)}</option>`)}
      </select>
      <select id="fCat" aria-label="Category" value=${f.cat} onChange=${(e) => setF({ ...f, cat: e.target.value, shown: 60 })}>
        <option value="">All categories</option><option value="?">Not sorted yet</option><option value="!">One-offs</option>${CatOptions({})}
      </select>
    </div>
    <p class="status" id="txStatus" aria-live="polite">${plural(hits.length, 'line')}, ${kr(hits.reduce((n, [t]) => n + t.amount, 0))} in total.
      ${offer ? html` <button type="button" id="offer" onClick=${() => { store.addRule(offer.key, offer.cat); setOffer(null); }}>Always sort ${ruleLabel(offer.key)} as ${CAT[offer.cat].name}</button>` : null}</p>
    <div class="scroll"><table id="txTable" class="tx">
      ${hits.length
        ? html`<tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>One-off</th></tr>
          ${hits.slice(0, f.shown).map(([t, c]) => html`<tr key=${t.id}>
            <td>${dmy(t.date)}</td>
            <td class="wrap"><span title=${acct.get(t.acct) || ''}>${t.text}</span>${t.memo ? html`<br /><span class="status">${t.memo}</span>` : null}</td>
            <td><select data-tx=${t.id} aria-label="Category" value=${UNSORTED.has(c.cat) ? '' : c.cat} onChange=${choose(t)}>
              ${UNSORTED.has(c.cat) ? html`<option value="">${CAT[c.cat].name}</option>` : c.by === 'you' ? html`<option value="">Let the rules decide</option>` : null}${CatOptions({})}</select></td>
            <td class=${t.amount > 0 ? 'plus' : ''}>${kr(t.amount)}</td>
            <td><input type="checkbox" checked=${!!t.once} aria-label="One-off" onChange=${(e) => store.patchTransactions([t.id], { once: e.target.checked })} /></td>
          </tr>`)}`
        : html`<tr><td>No lines match.</td></tr>`}
    </table></div>
    ${hits.length > f.shown ? html`<button type="button" class="quiet" onClick=${() => setF({ ...f, shown: f.shown + 100 })}>Show more</button>` : null}
  </details>`;
}

function Rules({ s }) {
  const [match, setMatch] = useState(''), [cat, setCat] = useState(''), [status, setStatus] = useState('');
  const add = () => { const ok = store.addRule(match, cat); setStatus(ok ? 'Rule added.' : 'Type at least two letters and choose a category.'); if (ok) setMatch(''); };
  return html`<details>
    <summary>Your rules</summary>
    <p class="hint" style="margin:10px 0">A rule says: when the description contains this text, use this category. Your rules win over the built-in ones, and the longest text wins when two fit.</p>
    <div class="row">
      <input type="text" id="ruleText" placeholder="Text in the description" aria-label="Text in the description" maxlength="80" style="flex:1;min-width:140px" value=${match} onInput=${(e) => setMatch(e.target.value)} />
      <select id="ruleCat" aria-label="Category for the rule" value=${cat} onChange=${(e) => setCat(e.target.value)}>${CatOptions({ first: 'Category…' })}</select>
      <button type="button" id="ruleAdd" onClick=${add}>Add rule</button>
    </div>
    <p class="status" aria-live="polite">${status}</p>
    <div class="scroll"><table id="rules" style="margin-top:8px">
      ${s.rules.length
        ? html`<tr><th>When the description contains</th><th>Category</th><th></th></tr>
          ${[...s.rules].reverse().map((r) => html`<tr key=${r.id}><td>${ruleLabel(r.match)}</td><td>${CAT[r.cat].name}</td><td><button type="button" class="quiet" onClick=${() => store.removeRule(r.id)}>Remove</button></td></tr>`)}`
        : html`<tr><td>No rules of your own yet. They appear when you sort lines above.</td></tr>`}
    </table></div>
  </details>`;
}

function Files({ s }) {
  const cover = coverage(s.transactions);
  return html`<details>
    <summary>Files and accounts</summary>
    <div class="scroll"><table id="accounts" style="margin-top:10px">
      <tr><th>Account</th><th>Type</th><th>Covers</th><th>Lines</th></tr>
      ${s.accounts.map((a) => { const c = cover.get(a.id); return html`<tr key=${a.id}>
        <td><input type="text" value=${a.name} maxlength="60" aria-label="Account name" onChange=${(e) => store.setAccount(a.id, { name: e.target.value })} /></td>
        <td><select value=${a.kind} aria-label="Account type" onChange=${(e) => store.setAccount(a.id, { kind: e.target.value })}><option value="bank">Bank account</option><option value="card">Credit card</option></select></td>
        <td>${c ? `${dmy(c.from)} to ${dmy(c.to)}` : ''}</td><td>${c ? c.count : 0}</td></tr>`; })}
    </table></div>
    <div class="scroll"><table id="imports" style="margin-top:14px">
      <tr><th>File</th><th>Added</th><th>Lines</th><th></th></tr>
      ${[...s.imports].reverse().map((i) => html`<tr key=${i.id}><td class="wrap">${i.file}</td><td>${i.date ? dmy(i.date) : ''}</td><td>${i.count}</td>
        <td><button type="button" class="quiet" title="For a statement that listed money in and out the wrong way round" onClick=${() => store.flipImport(i.id)}>Swap in and out</button>
          <button type="button" class="quiet" onClick=${() => { if (confirm('Remove the lines that came from this file?')) store.removeImport(i.id); }}>Remove</button></td></tr>`)}
    </table></div>
  </details>`;
}

export function Spending() {
  const s = useStore(), L = store.ledger(s), u = L.usual;
  const [period, setPeriod] = useState('avg');          // 'avg' or a month 'YYYY-MM'
  const [f, setF] = useState({ open: false, q: '', month: '', cat: '', shown: 60 });
  const txRef = useRef(null);
  const groups = unsortedGroups(s.transactions, L.sorted);
  // The month to show: the one you picked, else a usual month, else the latest.
  let shown = period;
  if (shown !== 'avg' && !L.months.some((r) => r.month === shown)) shown = 'avg';
  if (shown === 'avg' && !u && L.months.length) shown = L.months[L.months.length - 1].month;
  const showTx = (cat) => {
    setF({ open: true, q: '', month: shown === 'avg' ? '' : shown, cat, shown: 60 });
    requestAnimationFrame(() => txRef.current && txRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return html`<h1>Spending</h1>
    <${Answer} s=${s} L=${L} groups=${groups} />
    <${AddFiles} s=${s} />
    ${s.transactions.length ? html`
      <${SortThese} groups=${groups} />
      <${Months} L=${L} shown=${shown} pick=${(m) => setPeriod(period === m ? 'avg' : m)} />
      <${WhereItGoes} L=${L} shown=${shown} setPeriod=${setPeriod} showTx=${showTx} />
      <${OneOffs} s=${s} L=${L} />
      <div class="panel">
        <${AllTx} s=${s} L=${L} f=${f} setF=${setF} txRef=${txRef} />
        <${Rules} s=${s} />
        <${Files} s=${s} />
      </div>` : null}`;
}
