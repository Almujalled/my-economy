// Spending page: reads bank and card exports in the browser, sorts each line into a category,
// and answers "what does a usual month cost?". Files are never uploaded.
import * as store from '../store.js';
import { readBankFile, guessLayout, makeLayout, toTransactions } from '../bankfile.js';
import { FLOWS, CATEGORIES, CAT, UNSORTED, cleanText, merchantKey, ruleLabel } from '../categories.js';
import { monthOf, unsortedGroups, bigPurchases, coverage } from '../ledger.js';
import { kr, round500, esc, monthName, monthShort, dmy, plural, pct, short } from '../format.js';
import { barChart } from '../charts.js';

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
};
const why = (e) => (e && e.code === 'no-header'
  ? 'Could not find any transactions in this file. A bank file needs a date, a description and an amount on each line.'
  : WHY[e && e.code] || 'The file could not be read. Export it again as Excel or CSV.');

const catOptions = (selected, first) => (first ? `<option value="">${first}</option>` : '') + FLOWS.map((f) => {
  const cats = CATEGORIES.filter((c) => c.flow === f.id && !UNSORTED.has(c.id));
  return cats.length ? `<optgroup label="${f.name}">${cats.map((c) => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${c.name}</option>`).join('')}</optgroup>` : '';
}).join('');

const HTML = `
<h1>Spending</h1>
<div class="panel answer" id="answer" aria-live="polite"></div>

<div class="panel" id="addPanel">
  <h2>Add bank files</h2>
  <p>Start with one file: the account your pay comes into and your bills are paid from. In your online bank, export its transactions as Excel or CSV and add the file here. It is read in this browser and never uploaded.</p>
  <p class="hint" style="margin:0 0 10px">That one account is enough for your plan. What you pay to a credit card counts as living costs, as one sum. Add a card's own file only if you want what you bought with it sorted too.</p>
  <div class="drop" id="drop">
    <button type="button" class="primary" id="pick">Choose files</button>
    <span>or drop them here. Adding the same period twice is safe: lines you already have are skipped.</span>
    <input type="file" id="files" accept=".xlsx,.csv,.txt" multiple hidden>
  </div>
  <div class="note info" id="mapper" hidden>
    <p id="mapIntro"></p>
    <div class="scroll"><table id="mapPreview" class="preview"></table></div>
    <div class="fields two wide" style="margin-top:12px">
      <div class="field"><label for="mSkip">Lines before the first transaction</label><input type="number" id="mSkip" min="0" max="40" step="1"></div>
      <div class="field"><label for="mKind">The file is from a</label><select id="mKind"><option value="bank">Bank account</option><option value="card">Credit card</option></select></div>
      <div class="field"><label for="mDate">Date is in column</label><select id="mDate"></select></div>
      <div class="field"><label for="mText">Description is in column</label><select id="mText"></select></div>
      <div class="field"><label for="mAmount">Amount is in column</label><select id="mAmount"></select><small>If money in and money out have a column each, choose money in here.</small></div>
      <div class="field"><label for="mOut">Money out is in column</label><select id="mOut"></select></div>
    </div>
    <div class="row" style="margin-top:12px"><button type="button" class="primary" id="mGo">Add these lines</button><button type="button" id="mCancel">Skip this file</button><span class="status" id="mStatus" aria-live="polite"></span></div>
  </div>
  <ul class="log" id="log" aria-live="polite"></ul>
</div>

<div id="hasData" class="stack" hidden>
  <div class="panel" id="sortPanel" hidden>
    <h2>Sort these</h2>
    <p class="hint" style="margin:0 0 10px">Lines the dashboard did not recognise, biggest first. Pick a category once and every line from that place follows, now and in future files. A payment to your credit card is a Credit card bill, not a move between your own accounts.</p>
    <div id="groups"></div>
    <button type="button" class="quiet" id="moreGroups" hidden></button>
  </div>

  <div class="panel">
    <h2>Living costs month by month</h2>
    <svg id="months" role="img" aria-label="Living costs for each month"></svg>
    <p class="hint">Choose a month in the chart to see where the money went. The same numbers are in the table on the Budget page.</p>
  </div>

  <div class="panel">
    <div class="row between">
      <h2 id="whereTitle" style="margin:0"></h2>
      <select id="period" aria-label="Period to show"></select>
    </div>
    <div class="ranked" id="ranked"></div>
    <p class="hint" id="cardNote" style="margin-top:10px" hidden><b>Credit card bill.</b> ${CAT.cardbill.hint}</p>
    <div class="scroll"><table id="rest" class="fit" style="margin-top:14px"></table></div>
  </div>

  <div class="panel" id="bigPanel" hidden>
    <h2>One-offs</h2>
    <p>A one-off is something big that will not come back every year, like a new roof or a car. One-offs are left out of your usual month so they do not distort it. Things that do come back, like holidays and insurance, are normal spending.</p>
    <div id="big"></div>
  </div>

  <div class="panel">
    <details id="allTx">
      <summary>All transactions</summary>
      <div class="row" style="margin:12px 0">
        <input type="text" id="q" placeholder="Search description" aria-label="Search description" style="flex:1;min-width:140px">
        <select id="fMonth" aria-label="Month"></select>
        <select id="fCat" aria-label="Category"></select>
      </div>
      <p class="status" id="txStatus" aria-live="polite"></p>
      <div class="scroll"><table id="txTable" class="tx"></table></div>
      <button type="button" class="quiet" id="moreTx" hidden>Show more</button>
    </details>
    <details>
      <summary>Your rules</summary>
      <p class="hint" style="margin:10px 0">A rule says: when the description contains this text, use this category. Your rules win over the built-in ones, and the longest text wins when two fit.</p>
      <div class="row">
        <input type="text" id="ruleText" placeholder="Text in the description" aria-label="Text in the description" maxlength="80" style="flex:1;min-width:140px">
        <select id="ruleCat" aria-label="Category for the rule">${catOptions('', 'Category…')}</select>
        <button type="button" id="ruleAdd">Add rule</button>
      </div>
      <p class="status" id="ruleStatus" aria-live="polite"></p>
      <div class="scroll"><table id="rules" style="margin-top:8px"></table></div>
    </details>
    <details>
      <summary>Files and accounts</summary>
      <div class="scroll"><table id="accounts" style="margin-top:10px"></table></div>
      <div class="scroll"><table id="imports" style="margin-top:14px"></table></div>
    </details>
  </div>
</div>`;

export function mount(root) {
  root.innerHTML = HTML;
  const $ = (id) => root.querySelector('#' + id);
  let period = 'avg';            // 'avg' or a month 'YYYY-MM'
  let shownGroups = 8, shownTx = 60;
  let offer = null;              // { key, cat }: "always sort this place like that?"

  // ---------- adding files ----------
  const log = (html, bad) => { const li = document.createElement('li'); if (bad) li.className = 'bad'; li.innerHTML = html; $('log').prepend(li); };
  // What a file is decides how it is counted: on a bank account a payment to a card is a bill, on a card it is a purchase.
  const KIND = { bank: 'bank account', card: 'credit card' }, AUTO = { bank: 'Bank account', card: 'Credit card' };
  function setKind(id, kind) {
    store.update((s) => {
      const a = s.accounts.find((x) => x.id === id);
      if (!a || !KIND[kind] || a.kind === kind) return;
      if (a.name.startsWith(AUTO[a.kind])) a.name = AUTO[kind] + a.name.slice(AUTO[a.kind].length);   // a name the dashboard made follows the type
      a.kind = kind;
    });
    const a = store.get().accounts.find((x) => x.id === id);
    if (!a) return;
    for (const el of $('log').querySelectorAll('[data-read]')) if (el.dataset.read === id) el.textContent = KIND[a.kind];
    for (const el of $('log').querySelectorAll('[data-kind]')) if (el.dataset.kind === id) el.textContent = `No, it is a ${KIND[a.kind === 'card' ? 'bank' : 'card']}`;
  }
  function addParsed(fileName, parsed) {
    const res = store.importParsed(parsed, fileName);
    const notes = [];
    if (res.dupes) notes.push(`Skipped ${plural(res.dupes, 'line')} you already had.`);
    if (parsed.pending) notes.push(`Left out ${plural(parsed.pending, 'line')} the bank has not booked yet; they come with your next export.`);
    if (parsed.skipped) notes.push(`${plural(parsed.skipped, 'row')} had no date or amount and ${parsed.skipped === 1 ? 'was' : 'were'} ignored.`);
    if (parsed.flipped) notes.push('This statement listed purchases as plus amounts, so they were turned into money out.');
    log(res.added
      ? `<b>${esc(fileName)}</b>: read as a <b data-read="${esc(res.account.id)}">${KIND[res.account.kind]}</b>${res.account.tail ? ' ending in ' + esc(res.account.tail) : ''}. Added ${plural(res.added, 'line')} from ${dmy(parsed.from)} to ${dmy(parsed.to)}. ${notes.join(' ')} <button type="button" class="quiet" data-undo="${esc(res.imp.id)}">Undo</button><button type="button" class="quiet" data-kind="${esc(res.account.id)}">No, it is a ${KIND[res.account.kind === 'card' ? 'bank' : 'card']}</button>`
      : `<b>${esc(fileName)}</b>: nothing new. All ${plural(parsed.txs.length, 'line')} were already here.`);
  }
  const waiting = [];           // files whose columns you have to point out, one at a time
  async function addFiles(files) {
    for (const file of files) {
      try {
        addParsed(file.name, await readBankFile(await file.arrayBuffer(), store.get().layouts));
      } catch (e) {
        // Ask which column is which only when the file has dates in it; otherwise it is not a list of transactions.
        if (e && e.code === 'no-header' && e.rows && guessLayout(e.rows).cols.date !== undefined) waiting.push({ name: file.name, rows: e.rows });
        else log(`<b>${esc(file.name)}</b>: ${esc(why(e))}`, true);
      }
    }
    showMapper();
  }

  // When a file's columns are not recognised: show the first lines and ask which column is which.
  const letter = (i) => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));
  function showMapper() {
    const job = waiting[0];
    $('mapper').hidden = !job;
    if (!job) return;
    const guess = guessLayout(job.rows);
    $('mapIntro').innerHTML = `<b>${esc(job.name)}</b>: the dashboard does not know the columns in this file. Show it which is which, and it will remember for next time.`;
    $('mSkip').value = guess.headerRow + 1;
    $('mKind').value = 'bank';
    const width = Math.min(30, Math.max(...job.rows.slice(0, 30).map((r) => r.length)));
    const cell = (v) => esc(String(v === null || v === undefined ? '' : v).slice(0, 28));
    $('mapPreview').innerHTML = `<tr><th></th>${Array.from({ length: width }, (_, i) => `<th>${letter(i)}</th>`).join('')}</tr>`
      + job.rows.slice(0, 7).map((r, n) => `<tr><td class="status">${n + 1}</td>${Array.from({ length: width }, (_, i) => `<td>${cell(r[i])}</td>`).join('')}</tr>`).join('');
    const sample = job.rows[Math.min(job.rows.length - 1, guess.headerRow + 1)] || [];
    const options = (picked, none) => (none ? `<option value="">${none}</option>` : '')
      + Array.from({ length: width }, (_, i) => `<option value="${i}"${i === picked ? ' selected' : ''}>${letter(i)}${cell(sample[i]) ? ': ' + cell(sample[i]) : ''}</option>`).join('');
    $('mDate').innerHTML = options(guess.cols.date);
    $('mText').innerHTML = options(guess.cols.text);
    $('mAmount').innerHTML = options(guess.cols.amount);
    $('mOut').innerHTML = options(undefined, 'The same column: minus means money out');
    $('mStatus').textContent = '';
  }
  $('mGo').addEventListener('click', () => {
    const job = waiting[0];
    if (!job) return;
    const pick = (id) => ($(id).value === '' ? undefined : +$(id).value);
    const cols = { date: pick('mDate'), text: pick('mText') };
    if (pick('mOut') === undefined) cols.amount = pick('mAmount'); else { cols.in = pick('mAmount'); cols.out = pick('mOut'); }
    const layout = makeLayout(job.rows, +$('mSkip').value || 0, cols, $('mKind').value);
    const parsed = toTransactions(job.rows, layout);
    if (!parsed.txs.length) { $('mStatus').textContent = 'No lines could be read with these choices. Check which column holds the date and which the amount.'; return; }
    store.saveLayout(layout);
    waiting.shift();
    addParsed(job.name, parsed);
    showMapper();
  });
  $('mCancel').addEventListener('click', () => { const job = waiting.shift(); if (job) log(`<b>${esc(job.name)}</b>: skipped.`, true); showMapper(); });
  $('pick').addEventListener('click', () => $('files').click());
  $('files').addEventListener('change', async (e) => { await addFiles([...e.target.files]); e.target.value = ''; });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
  $('log').addEventListener('click', (e) => {
    const id = e.target.dataset.undo;
    if (!id) return;
    store.removeImport(id);
    e.target.closest('li').innerHTML = 'Removed again.';
  });

  // ---------- output ----------
  function render() {
    const s = store.get(), L = store.ledger(s), u = L.usual, txs = s.transactions;
    const A = $('answer');
    $('hasData').hidden = !txs.length;
    if (!txs.length) {
      A.className = 'panel answer';
      A.innerHTML = `<p class="big">No bank files yet.</p><p>Add an export from your bank below and this page shows what a usual month costs you, sorted into groceries, transport and so on. That number then feeds your plan.</p>`;
      return;
    }
    const groups = unsortedGroups(txs, L.sorted);
    const unsortedCount = groups.reduce((n, g) => n + g.count, 0), unsortedSum = groups.reduce((n, g) => n + g.sum, 0);
    let h = '';
    if (!u) {
      A.className = 'panel answer';
      h += `<p class="big">Not a whole month yet.</p><p>You have ${plural(txs.length, 'line')} from ${dmy(txs[0].date)} to ${dmy(txs[txs.length - 1].date)}. Add files that cover at least one full calendar month, and the usual month appears here.</p>`;
    } else {
      const living = round500(u.living), now = s.profile.livingNow;
      A.className = 'panel answer ok';
      h += `<p class="big">You spend about <span class="num">${kr(living)}</span> a month on living costs.</p>`;
      h += `<p>That is the average of ${u.months === 1 ? 'the one whole month' : `the last ${u.months} whole months`} in your files (${monthName(u.from)}${u.from === u.to ? '' : ' to ' + monthName(u.to)}). Mortgage, investing, moves between your own accounts and one-offs are left out.</p>`;
      if (u.oneoff > 0) h += `<p>One-offs in the same period come to about ${kr(round500(u.oneoff))} a month on top of that.</p>`;
      h += living === now
        ? `<p class="status">Your plan already uses ${kr(now)} as living costs today.</p>`
        : `<div class="row"><button type="button" class="primary" id="useLiving">Use this as my living costs</button><span class="status">Your plan uses ${kr(now)} today.</span></div>`;
      if (u.months < 12) h += `<div class="note info">This covers ${plural(u.months, 'month')}. Bills that come once a year and holidays may be missing, so the real figure is likely higher. Add older files until you have 12 months.</div>`;
    }
    if (unsortedCount) h += `<div class="note warn">${plural(unsortedCount, 'line')} worth ${kr(unsortedSum)} ${unsortedCount === 1 ? 'is' : 'are'} not sorted yet. Until then, money out counts as living costs and money in as income. Start with the lines that are something else: saving, a loan, or money moved between your own accounts.</div>`;
    if (!store.isSaved()) h += `<div class="note warn">This browser is not saving your data. Export a file on the My data page before you close this page.</div>`;
    A.innerHTML = h;

    // sort these
    $('sortPanel').hidden = !groups.length;
    $('groups').innerHTML = groups.slice(0, shownGroups).map((g, i) => `<div class="group">
      <div><b>${esc(g.label)}</b><span class="status">${g.dir === 'in' ? 'Money in' : 'Money out'} · ${plural(g.count, 'line')} · ${kr(g.sum)} · last ${dmy(g.latest)}</span></div>
      <select data-group="${i}" aria-label="Category for ${esc(g.label)}">${catOptions('', 'Choose category…')}</select></div>`).join('');
    $('moreGroups').hidden = groups.length <= shownGroups;
    $('moreGroups').textContent = `Show ${Math.min(20, groups.length - shownGroups)} more of ${groups.length - shownGroups}`;
    root._groups = groups;

    // month by month
    const months = L.months.slice(-24), whole = new Set(L.whole.map((r) => r.month));
    if (period !== 'avg' && !L.months.some((r) => r.month === period)) period = 'avg';
    barChart($('months'), months.map((r) => ({ key: r.month, label: monthShort(r.month) + (r.month.endsWith('-01') ? ' ' + r.month.slice(2, 4) : ''),
      title: monthName(r.month) + (whole.has(r.month) ? '' : ' (not a whole month)'), value: r.living })), {
      h: 230, fmtY: short, fmtTip: (b) => kr(b.value), selected: period === 'avg' ? null : period,
      ref: u ? u.living : 0, refLabel: 'usual month',
      onPick: (m) => { period = period === m ? 'avg' : m; render(); },
    });

    // where it goes
    const row = period === 'avg' ? u : L.months.find((r) => r.month === period);
    $('period').innerHTML = (u ? `<option value="avg"${period === 'avg' ? ' selected' : ''}>A usual month</option>` : '')
      + [...L.months].reverse().map((r) => `<option value="${r.month}"${r.month === period ? ' selected' : ''}>${monthName(r.month)}${whole.has(r.month) ? '' : ' (part)'}</option>`).join('');
    if (!row) { period = L.months[L.months.length - 1].month; return render(); }
    $('whereTitle').textContent = period === 'avg' ? 'Where it goes in a usual month' : `Where it went in ${monthName(period)}`;
    const cats = Object.entries(row.cats).filter(([c]) => CAT[c].flow === 'spending' || c === 'loan').sort((a, b) => b[1] - a[1]);
    const top = Math.max(1, ...cats.map(([, v]) => v));
    $('ranked').innerHTML = cats.length ? cats.map(([c, v]) => `<button type="button" class="rank" data-cat="${c}" title="Show these lines">
        <span class="rank-n">${CAT[c].name}</span><span class="rank-b"><i style="width:${Math.max(0, (v / top) * 100).toFixed(1)}%"></i></span>
        <span class="rank-v">${kr(period === 'avg' ? round500(v) : v)}</span><span class="rank-p">${row.living > 0 ? pct((v / row.living) * 100) : ''}</span></button>`).join('')
      : `<p class="status">No living costs in this period.</p>`;
    $('cardNote').hidden = !(row.cats.cardbill > 0);
    const amt = (v) => kr(period === 'avg' ? round500(v) : v);
    $('rest').innerHTML = `<tr><th>${period === 'avg' ? 'The whole month, on average' : 'The whole month'}</th><th></th></tr>
      <tr><td>Money in</td><td>${amt(row.income)}</td></tr>
      <tr><td>Living costs</td><td>${amt(row.living)}</td></tr>
      <tr><td>Mortgage${row.principal || row.interest ? ` <span class="status">(${amt(row.interest)} interest, ${amt(row.principal)} paid down)</span>` : ''}</td><td>${amt(row.mortgage)}</td></tr>
      <tr><td>Investing</td><td>${amt(row.investing)}</td></tr>
      <tr><td>One-offs</td><td>${amt(row.oneoff)}</td></tr>
      <tr class="sel"><td>Left over</td><td>${amt(row.left)}</td></tr>`;

    // one-offs
    const since = u ? u.from : L.months[0].month;
    const big = bigPurchases(txs, L.sorted, since, u ? u.living : 0);
    const marked = txs.filter((t) => t.once).slice(-12).reverse();
    $('bigPanel').hidden = !big.length && !marked.length;
    $('big').innerHTML = (big.length ? `<p><b>Were any of these one-offs?</b></p>` + big.map((t) => `<div class="group"><div><b>${esc(cleanText(t.text))}</b><span class="status">${dmy(t.date)} · ${kr(-t.amount)} · ${CAT[L.sorted.get(t.id).cat].name}</span></div><button type="button" data-once="${esc(t.id)}">Yes, a one-off</button></div>`).join('') : '')
      + (marked.length ? `<p style="margin-top:12px"><b>Marked as one-offs</b></p>` + marked.map((t) => `<div class="group"><div><b>${esc(cleanText(t.text))}</b><span class="status">${dmy(t.date)} · ${kr(Math.abs(t.amount))}</span></div><button type="button" class="quiet" data-undo-once="${esc(t.id)}">Not a one-off</button></div>`).join('') : '');

    renderTx(); renderRules(); renderFiles();
  }

  function renderTx() {
    const s = store.get(), L = store.ledger(s);
    const fm = $('fMonth').value, fc = $('fCat').value, q = $('q').value.trim().toLowerCase();
    $('fMonth').innerHTML = `<option value="">All months</option>` + [...L.months].reverse().map((r) => `<option value="${r.month}"${r.month === fm ? ' selected' : ''}>${monthName(r.month)}</option>`).join('');
    $('fCat').innerHTML = `<option value="">All categories</option><option value="?"${fc === '?' ? ' selected' : ''}>Not sorted yet</option><option value="!"${fc === '!' ? ' selected' : ''}>One-offs</option>` + catOptions(fc);
    if (!$('allTx').open) return;
    const hits = [];
    for (let i = s.transactions.length - 1; i >= 0; i--) {
      const t = s.transactions[i], c = L.sorted.get(t.id);
      if (fm && monthOf(t.date) !== fm) continue;
      if (fc === '?' ? !UNSORTED.has(c.cat) : fc === '!' ? !t.once : fc && c.cat !== fc) continue;
      if (q && !`${t.text} ${t.memo || ''}`.toLowerCase().includes(q)) continue;
      hits.push([t, c]);
    }
    const sum = hits.reduce((n, [t]) => n + t.amount, 0);
    let status = `${plural(hits.length, 'line')}, ${kr(sum)} in total.`;
    if (offer) status += ` <button type="button" id="offer">Always sort ${esc(ruleLabel(offer.key))} as ${CAT[offer.cat].name}</button>`;
    $('txStatus').innerHTML = status;
    const acct = new Map(s.accounts.map((a) => [a.id, a.name]));
    $('txTable').innerHTML = hits.length
      ? `<tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>One-off</th></tr>` + hits.slice(0, shownTx).map(([t, c]) => `<tr>
          <td>${dmy(t.date)}</td>
          <td class="wrap"><span title="${esc(acct.get(t.acct) || '')}">${esc(t.text)}</span>${t.memo ? `<br><span class="status">${esc(t.memo)}</span>` : ''}</td>
          <td><select data-tx="${esc(t.id)}" aria-label="Category">${UNSORTED.has(c.cat) ? `<option value="" selected>${CAT[c.cat].name}</option>` : c.by === 'you' ? `<option value="">Let the rules decide</option>` : ''}${catOptions(c.cat)}</select></td>
          <td class="${t.amount > 0 ? 'plus' : ''}">${kr(t.amount)}</td>
          <td><input type="checkbox" data-once-box="${esc(t.id)}"${t.once ? ' checked' : ''} aria-label="One-off"></td></tr>`).join('')
      : `<tr><td>No lines match.</td></tr>`;
    $('moreTx').hidden = hits.length <= shownTx;
  }

  function renderRules() {
    const s = store.get();
    $('rules').innerHTML = s.rules.length
      ? `<tr><th>When the description contains</th><th>Category</th><th></th></tr>` + [...s.rules].reverse().map((r) => `<tr><td>${esc(ruleLabel(r.match))}</td><td>${CAT[r.cat].name}</td><td><button type="button" class="quiet" data-rule="${esc(r.id)}">Remove</button></td></tr>`).join('')
      : `<tr><td>No rules of your own yet. They appear when you sort lines above.</td></tr>`;
  }

  function renderFiles() {
    const s = store.get(), cover = coverage(s.transactions);
    $('accounts').innerHTML = `<tr><th>Account</th><th>Type</th><th>Covers</th><th>Lines</th></tr>` + s.accounts.map((a) => {
      const c = cover.get(a.id);
      return `<tr><td><input type="text" data-acct-name="${esc(a.id)}" value="${esc(a.name)}" maxlength="60" aria-label="Account name"></td>
        <td><select data-acct-kind="${esc(a.id)}" aria-label="Account type"><option value="bank"${a.kind === 'bank' ? ' selected' : ''}>Bank account</option><option value="card"${a.kind === 'card' ? ' selected' : ''}>Credit card</option></select></td>
        <td>${c ? `${dmy(c.from)} to ${dmy(c.to)}` : ''}</td><td>${c ? c.count : 0}</td></tr>`;
    }).join('');
    $('imports').innerHTML = `<tr><th>File</th><th>Added</th><th>Lines</th><th></th></tr>` + [...s.imports].reverse().map((i) => `<tr><td class="wrap">${esc(i.file)}</td><td>${i.date ? dmy(i.date) : ''}</td><td>${i.count}</td>
      <td><button type="button" class="quiet" data-flip="${esc(i.id)}" title="For a statement that listed money in and out the wrong way round">Swap in and out</button><button type="button" class="quiet" data-drop="${esc(i.id)}">Remove</button></td></tr>`).join('');
  }

  // ---------- actions ----------
  root.addEventListener('click', (e) => {
    const d = e.target.dataset || {};
    if (e.target.id === 'useLiving') {
      const u = store.ledger().usual;
      if (u) store.update((s) => { s.profile.livingNow = round500(u.living); });
    } else if (e.target.id === 'moreGroups') { shownGroups += 20; render(); }
    else if (e.target.id === 'moreTx') { shownTx += 100; renderTx(); }
    else if (e.target.id === 'offer' && offer) { const o = offer; offer = null; store.addRule(o.key, o.cat); }
    else if (e.target.id === 'ruleAdd') {
      const ok = store.addRule($('ruleText').value, $('ruleCat').value);
      $('ruleStatus').textContent = ok ? 'Rule added.' : 'Type at least two letters and choose a category.';
      if (ok) $('ruleText').value = '';
    } else if (d.once) store.patchTransactions([d.once], { once: true });
    else if (d.undoOnce) store.patchTransactions([d.undoOnce], { once: false });
    else if (d.rule) store.removeRule(d.rule);
    else if (d.kind) { const a = store.get().accounts.find((x) => x.id === d.kind); if (a) setKind(a.id, a.kind === 'card' ? 'bank' : 'card'); }
    else if (d.flip) store.flipImport(d.flip);
    else if (d.drop && confirm('Remove the lines that came from this file?')) store.removeImport(d.drop);
    else {
      const rank = e.target.closest('.rank');
      if (!rank) return;
      $('allTx').open = true;
      $('fCat').innerHTML = catOptions(rank.dataset.cat);
      $('fCat').value = rank.dataset.cat;
      if (period !== 'avg') { $('fMonth').innerHTML = `<option value="${period}" selected></option>`; }
      shownTx = 60; renderTx();
      $('allTx').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  root.addEventListener('change', (e) => {
    const d = e.target.dataset || {}, v = e.target.value;
    if (e.target.id === 'period') { period = v; render(); }
    else if (e.target.id === 'fMonth' || e.target.id === 'fCat') { shownTx = 60; renderTx(); }
    else if (d.group !== undefined && v) {
      const g = root._groups[+d.group];
      if (g && !store.addRule(g.key, v)) store.patchTransactions(g.ids, { cat: v });
    } else if (d.tx) {
      const t = store.get().transactions.find((x) => x.id === d.tx);
      offer = v && t ? { key: merchantKey(t), cat: v } : null;
      if (offer && store.get().rules.some((r) => r.match === offer.key && r.cat === offer.cat)) offer = null;
      store.patchTransactions([d.tx], { cat: v || null });
    } else if (d.onceBox) store.patchTransactions([d.onceBox], { once: e.target.checked });
    else if (d.acctKind) setKind(d.acctKind, v === 'card' ? 'card' : 'bank');
    else if (d.acctName) store.update((s) => { const a = s.accounts.find((x) => x.id === d.acctName); if (a && v.trim()) a.name = v.trim().slice(0, 60); });
  });
  $('q').addEventListener('input', () => { shownTx = 60; renderTx(); });
  $('allTx').addEventListener('toggle', renderTx);

  render();
  return { update: render };
}
