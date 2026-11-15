// Net worth page: one entry per month, what changed since last time, and how it compares with the plan.
import * as store from '../store.js';
import { SCENARIOS, lawFor, investable, netWorth, change, planPath } from '../model.js';
import { investedBetween } from '../ledger.js';
import { kr, signedKr, esc, today, dmy, daysBetween, round500, monthShort } from '../format.js';
import { lineChart } from '../charts.js';

const FIELDS = [
  ['ask', 'ASK'], ['funds', 'Funds and stocks outside ASK'], ['ips', 'IPS'], ['other', 'Other investments'],
  ['cash', 'Bank accounts'], ['home', 'Home value'], ['car', 'Car and other things'], ['debt', 'Mortgage and other debt'],
];

const HTML = `
<h1>Net worth</h1>
<div class="panel answer" id="summary" aria-live="polite"></div>
<div class="panel">
  <h2>Add this month's numbers</h2>
  <form id="form" novalidate>
    <div class="form-grid">
      <label>Date <input type="date" id="f_date" required></label>
      ${FIELDS.map(([k, l]) => `<label>${l} <input type="number" id="f_${k}" step="any" min="0" placeholder="0" inputmode="decimal"></label>`).join('')}
      <label id="paidInBox">Paid into investments since last entry <input type="number" id="f_paidIn" step="any" inputmode="decimal"></label>
      <label>Note <input type="text" id="f_note" maxlength="200"></label>
    </div>
    <p class="hint" id="paidInHint"></p>
    <div class="row" style="margin-top:12px">
      <button type="submit" class="primary">Save entry</button>
      <button type="button" id="copyLast">Fill in from last entry</button>
      <span class="status" id="formStatus" aria-live="polite"></span>
    </div>
    <p class="hint">Log in to your bank and broker once a month and copy the balances. Saving a date that already exists replaces that entry. The Plan page starts from your latest entry.</p>
  </form>
</div>
<div class="panel" id="chartPanel">
  <h2>Over time</h2>
  <svg id="chart" role="img" aria-label="Net worth and investments over time"></svg>
  <div class="key"><span><i style="background:var(--accent)"></i>Net worth</span><span><i style="background:var(--live)"></i>Investments</span><span><i class="dash"></i>Investments if the plan had held exactly</span></div>
  <p class="hint" id="chartHint"></p>
</div>
<div class="panel" id="linesPanel">
  <h2>Line by line</h2>
  <div class="scroll"><table id="lines"></table></div>
</div>
<div class="panel">
  <h2>Entries</h2>
  <div class="scroll"><table id="table"></table></div>
</div>`;

export function mount(root) {
  root.innerHTML = HTML;
  const $ = (id) => root.querySelector('#' + id);
  $('f_date').value = today();
  let typedPaidIn = false;      // once you type in the box, the suggestion stops overwriting it

  // What was paid in since the entry before `date`: from the bank files when they reach that far, else from the plan.
  function suggestPaidIn() {
    const s = store.get(), date = $('f_date').value;
    const prev = [...s.networth].reverse().find((r) => r.date < date);
    $('paidInBox').hidden = !prev;
    if (!prev) { $('paidInHint').textContent = ''; return; }
    const L = store.ledger(s), txs = s.transactions;
    const covered = txs.length && txs[0].date <= prev.date && txs[txs.length - 1].date >= date;
    const months = Math.max(0, Math.round(daysBetween(prev.date, date) / 30.4));
    const value = covered ? investedBetween(txs, L.sorted, prev.date, date) : months * store.activePlan(s).invest;
    if (!typedPaidIn) $('f_paidIn').value = Math.round(value);
    $('paidInHint').textContent = covered
      ? `Since ${dmy(prev.date)} your bank files show ${kr(value)} moved into investments. Change the number if that is not right.`
      : `Suggested from your plan: ${months} month${months === 1 ? '' : 's'} at ${kr(store.activePlan(s).invest)}. Change it to what you really paid in. This is how the page tells your saving apart from what the market did.`;
  }

  function render() {
    const s = store.get(), rows = s.networth;
    const last = rows[rows.length - 1], prev = rows[rows.length - 2], first = rows[0];
    const S = $('summary');
    if (!last) {
      S.className = 'panel answer';
      S.innerHTML = `<p class="big">No entries yet.</p><p>Add your balances below once a month. This page then shows how your net worth moves, and how much of the change was your own saving and how much was the market.</p>`;
    } else {
      S.className = 'panel answer ok';
      let h = `<p class="big">Your net worth is <span class="num">${kr(netWorth(last))}</span>.</p>`;
      if (prev) {
        const c = change(prev, last);
        h += `<p>Since ${dmy(prev.date)} it has ${c.netWorth >= 0 ? 'grown' : 'fallen'} by ${kr(Math.abs(c.netWorth))}. `
          + (c.paidIn === null ? `Your investments changed by ${signedKr(c.total)}.`
            : `Your investments changed by ${signedKr(c.total)}: you paid in <b>${kr(c.paidIn)}</b> and the market ${c.market >= 0 ? 'added' : 'took'} <b>${kr(Math.abs(c.market))}</b>.`) + `</p>`;
      }
      const usable = investable(last) - last.ips + last.cash, locked = last.ips, rest = last.home + last.car - last.debt;
      const stats = [[kr(usable), 'Money you can use: investments and bank'], [kr(rest), 'Home and things, less debt']];
      if (locked > 0) stats.splice(1, 0, [kr(locked), 'Locked until 62: IPS']);
      const yearAgo = [...rows].reverse().find((r) => daysBetween(r.date, last.date) >= 335);
      if (yearAgo) stats.push([signedKr(netWorth(last) - netWorth(yearAgo)), `Since ${dmy(yearAgo.date)}`]);
      else if (prev && first !== prev) stats.push([signedKr(netWorth(last) - netWorth(first)), `Since ${dmy(first.date)}`]);
      const known = rows.slice(1).filter((r) => r.paidIn !== null);
      if (known.length > 1 && known.length === rows.length - 1) {
        const paid = known.reduce((t, r) => t + r.paidIn, 0), market = investable(last) - investable(first) - paid;
        stats.push([signedKr(market), `What the market has done since ${dmy(first.date)}, on top of the ${kr(paid)} you paid in`]);
      }
      h += `<div class="stats">${stats.map(([b, l]) => `<div class="stat"><b>${b}</b><span>${esc(l)}</span></div>`).join('')}</div>`;
      const age = daysBetween(last.date, today());
      if (age > 40) h += `<div class="note warn">Your latest entry is from ${dmy(last.date)}. Add this month's numbers below to keep the plan up to date.</div>`;
      S.innerHTML = h;
    }

    $('chartPanel').hidden = rows.length < 2;
    if (rows.length >= 2) {
      const t = (d) => Date.parse(d + 'T00:00:00Z'), iso = (x) => new Date(x).toISOString().slice(0, 10);
      const pl = store.activePlan(s), r = SCENARIOS[pl.scen].r;
      const planned = planPath(investable(first), rows.map((x) => x.date), pl.invest, r, (y) => lawFor(y).inflation);
      const ticks = rows.length <= 6 ? rows.map((x) => t(x.date)) : [t(first.date), t(rows[Math.floor(rows.length / 2)].date), t(last.date)];
      lineChart($('chart'), [
        { pts: rows.map((x, i) => ({ x: t(x.date), y: planned[i] })), color: 'var(--muted)', dash: true, name: 'investments on plan' },
        { pts: rows.map((x) => ({ x: t(x.date), y: Math.max(0, netWorth(x)) })), color: 'var(--accent)', name: 'net worth' },
        { pts: rows.map((x) => ({ x: t(x.date), y: investable(x) })), color: 'var(--live)', name: 'investments' },
      ], { h: 260, fmtY: (v) => (v / 1e6).toFixed(1) + 'M', fmtTipY: (v) => kr(v), ticksX: ticks, fmtX: (x) => `${monthShort(iso(x))} ${iso(x).slice(0, 4)}`, fmtTipX: (x) => dmy(iso(x)) });
      const gap = investable(last) - planned[planned.length - 1];
      $('chartHint').textContent = `The dotted line starts at your first entry and adds ${kr(pl.invest)} a month and the "${SCENARIOS[pl.scen].name.toLowerCase()}" growth of your plan, plus inflation. `
        + `Today your investments are ${kr(round500(Math.abs(gap)))} ${gap >= 0 ? 'ahead of' : 'behind'} it. Markets move in jumps, so being off the line for a year or two says little.`;
    }

    $('linesPanel').hidden = !prev;
    if (prev) {
      const far = [...rows].reverse().find((r) => daysBetween(r.date, last.date) >= 335) || first;
      const line = (label, a, b, c, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${kr(a)}</td><td>${signedKr(a - b)}</td>${far !== prev ? `<td>${signedKr(a - c)}</td>` : ''}</tr>`;
      $('lines').innerHTML = `<tr><th></th><th>${dmy(last.date)}</th><th>Since ${dmy(prev.date)}</th>${far !== prev ? `<th>Since ${dmy(far.date)}</th>` : ''}</tr>`
        + FIELDS.filter(([k]) => last[k] || prev[k] || far[k]).map(([k, l]) => line(l, last[k], prev[k], far[k])).join('')
        + line('Net worth', netWorth(last), netWorth(prev), netWorth(far), 'sel');
    }

    $('table').innerHTML = rows.length
      ? `<tr><th>Date</th><th>Investments</th><th>Paid in</th><th>Market</th><th>Bank</th><th>Home</th><th>Car, other</th><th>Debt</th><th>Net worth</th><th></th></tr>` +
        [...rows].reverse().map((r) => {
          const before = rows[rows.indexOf(r) - 1], c = before ? change(before, r) : null;
          return `<tr><td>${dmy(r.date)}${r.note ? `<br><span class="status">${esc(r.note)}</span>` : ''}</td><td>${kr(investable(r))}</td><td>${c && c.paidIn !== null ? kr(c.paidIn) : ''}</td><td>${c && c.market !== null ? signedKr(c.market) : ''}</td><td>${kr(r.cash)}</td><td>${kr(r.home)}</td><td>${kr(r.car)}</td><td>${kr(r.debt)}</td><td><b>${kr(netWorth(r))}</b></td><td><button type="button" class="quiet" data-edit="${r.date}">Edit</button><button type="button" class="quiet" data-del="${r.date}">Delete</button></td></tr>`;
        }).join('')
      : `<tr><td>Nothing saved yet.</td></tr>`;
    $('copyLast').disabled = !last;
    suggestPaidIn();
  }

  const fillForm = (r, keepDate) => {
    if (!keepDate) $('f_date').value = r.date;
    FIELDS.forEach(([k]) => { $('f_' + k).value = r[k] || ''; });
    $('f_note').value = keepDate ? '' : r.note || '';
    typedPaidIn = !keepDate && r.paidIn !== null;
    if (typedPaidIn) $('f_paidIn').value = r.paidIn;
    suggestPaidIn();
  };

  $('f_paidIn').addEventListener('input', () => { typedPaidIn = true; });
  $('f_date').addEventListener('change', () => { typedPaidIn = false; suggestPaidIn(); });
  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const date = $('f_date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('formStatus').textContent = 'Pick a date first.'; return; }
    const row = { date, note: $('f_note').value.trim() };
    FIELDS.forEach(([k]) => { const v = parseFloat($('f_' + k).value); row[k] = isFinite(v) ? v : 0; });
    const paid = parseFloat($('f_paidIn').value);
    row.paidIn = !$('paidInBox').hidden && isFinite(paid) ? paid : null;
    typedPaidIn = false;
    store.update((s) => { s.networth = s.networth.filter((r) => r.date !== date).concat(row).sort((a, b) => a.date.localeCompare(b.date)); });
    store.keepSafe();
    $('formStatus').textContent = `Saved entry for ${dmy(date)}.`;
  });
  $('copyLast').addEventListener('click', () => { const l = store.latestSnapshot(); if (l) fillForm(l, true); });
  $('table').addEventListener('click', (e) => {
    const del = e.target.dataset.del, edit = e.target.dataset.edit;
    if (del && confirm(`Delete the entry for ${dmy(del)}?`)) store.update((s) => { s.networth = s.networth.filter((r) => r.date !== del); });
    if (edit) { const r = store.get().networth.find((x) => x.date === edit); if (r) { fillForm(r, false); $('f_date').focus(); } }
  });

  render();
  return { update: render };
}
