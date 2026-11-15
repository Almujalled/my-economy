// Net worth page: one entry per month, a chart, and the change since last time.
import * as store from '../store.js';
import { investable, netWorth } from '../model.js';
import { kr, signedKr, esc, today } from '../format.js';
import { lineChart } from '../charts.js';

const FIELDS = [
  ['ask', 'ASK'], ['funds', 'Funds and stocks outside ASK'], ['ips', 'IPS'], ['other', 'Other investments'],
  ['cash', 'Bank accounts'], ['home', 'Home value'], ['car', 'Car and other things'], ['debt', 'Mortgage and other debt'],
];

const HTML = `
<h1>Net worth</h1>
<div class="panel" id="summary"></div>
<div class="panel">
  <h2>Add this month's numbers</h2>
  <form id="form" novalidate>
    <div class="form-grid">
      <label>Date <input type="date" id="f_date" required></label>
      ${FIELDS.map(([k, l]) => `<label>${l} <input type="number" id="f_${k}" step="any" min="0" placeholder="0" inputmode="decimal"></label>`).join('')}
      <label>Note <input type="text" id="f_note" maxlength="200"></label>
    </div>
    <div class="row" style="margin-top:12px">
      <button type="submit" class="primary">Save entry</button>
      <button type="button" id="copyLast">Fill in from last entry</button>
      <span class="status" id="formStatus"></span>
    </div>
    <p class="hint">Saving a date that already exists replaces that entry. The Plan page starts from your latest entry.</p>
  </form>
</div>
<div class="panel" id="chartPanel">
  <h2>Over time</h2>
  <svg id="chart" role="img" aria-label="Net worth and investments over time"></svg>
  <div class="key"><span><i style="background:var(--accent)"></i>Net worth</span><span><i style="background:var(--live)"></i>Investments</span></div>
</div>
<div class="panel">
  <h2>Entries</h2>
  <div class="scroll"><table id="table"></table></div>
</div>`;

export function mount(root) {
  root.innerHTML = HTML;
  const $ = (id) => root.querySelector('#' + id);
  $('f_date').value = today();

  function render() {
    const rows = store.get().networth;
    const last = rows[rows.length - 1], prev = rows[rows.length - 2], first = rows[0];
    if (!last) {
      $('summary').innerHTML = `<p><b>No entries yet.</b> Add your balances below once a month and this page shows how your net worth moves.</p>`;
    } else {
      const stats = [[kr(netWorth(last)), `Net worth on ${last.date}`], [kr(investable(last)), 'Investments']];
      if (prev) stats.push([signedKr(netWorth(last) - netWorth(prev)), `Since ${prev.date}`]);
      if (prev && first !== prev) stats.push([signedKr(netWorth(last) - netWorth(first)), `Since ${first.date}`]);
      $('summary').innerHTML = `<div class="stats">${stats.map(([b, l]) => `<div class="stat"><b>${b}</b><span>${esc(l)}</span></div>`).join('')}</div>`;
    }
    $('chartPanel').hidden = rows.length < 2;
    if (rows.length >= 2) {
      const t = (d) => new Date(d + 'T00:00:00').getTime();
      const ticks = rows.length <= 6 ? rows.map((r) => t(r.date)) : [t(first.date), t(rows[Math.floor(rows.length / 2)].date), t(last.date)];
      lineChart($('chart'), [
        { pts: rows.map((r) => ({ x: t(r.date), y: Math.max(0, netWorth(r)) })), color: 'var(--accent)' },
        { pts: rows.map((r) => ({ x: t(r.date), y: investable(r) })), color: 'var(--live)' },
      ], { h: 260, fmtY: (v) => (v / 1e6).toFixed(1) + 'M', ticksX: ticks, fmtX: (x) => new Date(x).toISOString().slice(0, 7) });
    }
    $('table').innerHTML = rows.length
      ? `<tr><th>Date</th><th>Investments</th><th>Bank</th><th>Home</th><th>Car, other</th><th>Debt</th><th>Net worth</th><th></th></tr>` +
        [...rows].reverse().map((r) => `<tr><td>${r.date}${r.note ? `<br><span class="status">${esc(r.note)}</span>` : ''}</td><td>${kr(investable(r))}</td><td>${kr(r.cash)}</td><td>${kr(r.home)}</td><td>${kr(r.car)}</td><td>${kr(r.debt)}</td><td><b>${kr(netWorth(r))}</b></td><td><button type="button" class="quiet" data-edit="${r.date}">Edit</button><button type="button" class="quiet" data-del="${r.date}">Delete</button></td></tr>`).join('')
      : `<tr><td>Nothing saved yet.</td></tr>`;
    $('copyLast').disabled = !last;
  }

  const fillForm = (r, keepDate) => {
    if (!keepDate) $('f_date').value = r.date;
    FIELDS.forEach(([k]) => { $('f_' + k).value = r[k] || ''; });
    $('f_note').value = keepDate ? '' : r.note || '';
  };

  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const date = $('f_date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('formStatus').textContent = 'Pick a date first.'; return; }
    const row = { date, note: $('f_note').value.trim() };
    FIELDS.forEach(([k]) => { const v = parseFloat($('f_' + k).value); row[k] = isFinite(v) ? v : 0; });
    store.update((s) => { s.networth = s.networth.filter((r) => r.date !== date).concat(row).sort((a, b) => a.date.localeCompare(b.date)); });
    $('formStatus').textContent = `Saved entry for ${date}.`;
  });
  $('copyLast').addEventListener('click', () => { const l = store.latestSnapshot(); if (l) fillForm(l, true); });
  $('table').addEventListener('click', (e) => {
    const del = e.target.dataset.del, edit = e.target.dataset.edit;
    if (del && confirm(`Delete the entry for ${del}?`)) store.update((s) => { s.networth = s.networth.filter((r) => r.date !== del); });
    if (edit) { const r = store.get().networth.find((x) => x.date === edit); if (r) { fillForm(r, false); $('f_date').focus(); } }
  });

  render();
  return { update: render };
}
