// My data page: where the numbers live, backups, moving to another device, and the rules in use.
import * as store from '../store.js';
import * as backup from '../backup.js';
import { LAW, LAWS } from '../model.js';
import { LAW_YEARS, lawIsOld } from '../law.js';
import { kr, today, dmy, daysBetween, plural, esc } from '../format.js';

const pct = (v, d = 1) => (v * 100).toFixed(d).replace('.', ',') + '%';
const rule = (name, value) => `<tr><td class="wrap">${name}</td><td>${value}</td></tr>`;

const HTML = `
<h1>My data</h1>
<div class="panel answer" id="keep" aria-live="polite"></div>
<div class="panel">
  <h2>Where your numbers are</h2>
  <p>Everything you type, and every bank file you add, is saved in this browser on this device only. Nothing is sent to GitHub or anywhere else, and the public code contains no personal numbers.</p>
  <p>That also means the browser is the only copy. Clearing browsing data removes it, and some browsers tidy away data from sites you have not opened for a while. Keep a backup file.</p>
  <div class="row">
    <button type="button" class="primary" id="exp">Save a backup file</button>
    <button type="button" id="imp">Open a backup file</button>
    <input type="file" id="impFile" accept="application/json,.json" hidden>
  </div>
  <p class="status" id="status" style="margin-top:10px" aria-live="polite"></p>
  <p class="hint">To use another device, save a backup file here and open it there. Keep the file private: it holds your numbers.</p>
</div>
<div class="panel" id="autoPanel" hidden>
  <h2>Keep a backup file up to date by itself</h2>
  <p>Choose a file once, and the dashboard writes your numbers to it after every change. Put it in a folder that syncs between your computers (OneDrive, Dropbox, iCloud Drive or similar) and the same file is both your backup and your way to another computer.</p>
  <div class="row">
    <button type="button" id="autoChoose">Choose the file</button>
    <button type="button" id="autoReconnect" hidden>Allow saving again</button>
    <button type="button" class="quiet" id="autoForget" hidden>Stop using the file</button>
  </div>
  <p class="status" id="autoStatus" style="margin-top:10px" aria-live="polite"></p>
</div>
<div class="panel" id="phonePanel" hidden>
  <h2>On iPhone and iPad</h2>
  <p>Safari removes what a web page has saved when you have not used the page for about a week. To avoid that, open the share menu and choose <b>Add to Home Screen</b>, and use the dashboard from there. The Home Screen copy starts empty: save a backup file first and open it there.</p>
</div>
<div class="panel">
  <h2>Rules the calculations use</h2>
  <div id="lawNote"></div>
  <div class="scroll"><table id="law"></table></div>
  <p class="hint">These change with the national budget each year, and the pension figures each May. Ask Claude Code to "update the rules": it checks the official sources and changes js/law.js. Sources are in the README.</p>
</div>
<div class="panel">
  <h2>Start over</h2>
  <p>Erase everything this dashboard has saved in this browser: plans, net worth entries, bank transactions and rules.</p>
  <button type="button" id="wipe">Erase everything in this browser</button>
</div>`;

export function mount(root) {
  root.innerHTML = HTML;
  const $ = (id) => root.querySelector('#' + id);
  const say = (t) => { $('status').textContent = t; };
  const counts = () => { const s = store.get(); return `${plural(s.plans.length, 'plan')}, ${plural(s.networth.length, 'net worth entry', 'net worth entries')}, ${plural(s.transactions.length, 'bank transaction')} and ${plural(s.rules.length, 'rule')} of your own`; };

  $('autoPanel').hidden = !backup.supported();
  $('phonePanel').hidden = !/iPhone|iPad|iPod/.test(navigator.userAgent) || navigator.standalone === true;
  $('lawNote').innerHTML = lawIsOld(new Date().getFullYear())
    ? `<div class="note warn">These are the rules for ${LAW.year}, the newest this dashboard has. Ask Claude Code to "update the rules" for this year.</div>`
    : LAW.status === 'proposed' ? `<div class="note warn">The ${LAW.year} rules below are the government's budget proposal. Parliament can still change them; ask Claude Code to "update the rules" once the budget is passed.</div>` : '';
  const next = LAWS[LAW_YEARS.find((y) => y > LAW.year)];
  const also = (get, fmt) => (next && get(next) !== get(LAW) ? ` <span class="status">(${next.year}${next.status === 'proposed' ? ', proposed' : ''}: ${fmt(get(next))})</span>` : '');
  $('law').innerHTML = `<tr><th>Rule (${LAW.year})</th><th>Value</th></tr>`
    + rule('Tax on growth taken out of ASK and funds, after what you paid in', pct(LAW.gainsTax, 2))
    + rule('Growth you can take out tax-free in a year with no other income', kr(Math.round(LAW.personAllowance / LAW.grossUp)) + also((l) => Math.round(l.personAllowance / l.grossUp), kr))
    + rule('Wealth tax rate, and the rate above ' + kr(LAW.wealthHighFrom), `${pct(LAW.wealthRate)} and ${pct(LAW.wealthHighRate)}`)
    + rule('Wealth tax allowance per person', kr(LAW.wealthFree) + also((l) => l.wealthFree, kr))
    + rule('How much of funds, shares and ASK counts for wealth tax', pct(LAW.wealthShare, 0))
    + rule('How much of your home counts, up to ' + kr(LAW.homeHighFrom), pct(LAW.homeShare, 0))
    + rule('Tax back on loan interest', pct(LAW.incomeTax, 0))
    + rule('Pension age in the law, plus months per birth year after 1963 (estimate)', `${LAW.pensionAge} years + ${LAW.pensionAgeStep} month`)
    + rule('Share of pay added to your pension pot each year, on pay up to', `${pct(LAW.accrual)} up to ${kr(Math.round(LAW.accrualCap * LAW.Gavg))}`)
    + rule('Guarantee pension per year, living alone / with a partner who has income', `${kr(LAW.guarantee.high)} / ${kr(LAW.guarantee.ordinary)}`)
    + rule('Pension up to this amount is not taxed', kr(LAW.pensionCredit.from1) + also((l) => l.pensionCredit.from1, kr))
    + rule('Most you can pay into IPS in a year', kr(LAW.ipsLimit))
    + rule('G (grunnbeløpet)', kr(LAW.G));

  function render() {
    const s = store.get(), K = $('keep'), has = s.networth.length || s.transactions.length;
    const b = backup.status();
    const age = s.meta.exported ? daysBetween(s.meta.exported, today()) : null;
    if (!store.isSaved()) {
      K.className = 'panel answer short';
      K.innerHTML = `<p class="big">This browser is not saving your data.</p><p>It may be in private mode, or out of space. Save a backup file before you close the page, or what you have typed is lost.</p>`;
    } else if (b.ready) {
      K.className = 'panel answer ok';
      K.innerHTML = `<p class="big">Your numbers are backed up as you go.</p><p>Every change is written to the file "${esc(b.name)}".</p>`;
    } else if (!has) {
      K.className = 'panel answer';
      K.innerHTML = `<p class="big">Nothing to back up yet.</p><p>Your numbers will live in this browser. Once you have added some, save a backup file from this page now and then.</p>`;
    } else if (age === null || age > 30) {
      K.className = 'panel answer short';
      K.innerHTML = `<p class="big">${age === null ? 'You have no backup yet.' : `Your last backup is ${age} days old.`}</p><p>Your numbers exist only in this browser. Save a backup file now; it takes one click.</p>`;
    } else {
      K.className = 'panel answer ok';
      K.innerHTML = `<p class="big">Your last backup is from ${age === 0 ? 'today' : dmy(s.meta.exported)}.</p><p>Save a new one after you add a month's numbers.</p>`;
    }
    if (!$('status').textContent) say(`In this browser: ${counts()}.`);
    $('autoChoose').textContent = b.name ? 'Choose another file' : 'Choose the file';
    $('autoReconnect').hidden = !b.name || b.ready;
    $('autoForget').hidden = !b.name;
    $('autoStatus').textContent = !b.name ? ''
      : b.error ? `${b.name}: ${b.error}`
      : b.ready ? `Saving to ${b.name}.` + (b.at ? ` Last written ${new Date(b.at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}.` : '')
      : `${b.name} is chosen, but the browser needs your go-ahead again after a restart. Press "Allow saving again".`;
  }

  // If the file holds newer numbers than this browser (you used another computer), offer to load them.
  async function afterConnect() {
    const text = await backup.read();
    let file = null;
    try { file = text ? JSON.parse(text) : null; } catch { file = null; }
    const mine = store.get().meta.saved || '', theirs = (file && file.meta && file.meta.saved) || '';
    if (file && file.profile && theirs > mine && confirm(`The file holds newer numbers than this browser (changed ${dmy(theirs.slice(0, 10))}). Load them here? Press Cancel to keep what is in this browser and overwrite the file.`)) store.replace(file);
    else await backup.write(JSON.stringify(store.get(), null, 2));
    render();
  }

  $('exp').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' }));
    a.download = `money-dashboard-data-${today()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    say('Saved. Keep the file somewhere safe and private.');
  });
  $('imp').addEventListener('click', () => $('impFile').click());
  $('impFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      if (!raw || typeof raw !== 'object' || !raw.profile) throw new Error('not a data file');
      if (!confirm('Opening this file replaces everything saved in this browser. Continue?')) return;
      store.replace(raw);
      say(`Opened. In this browser now: ${counts()}.`);
    } catch { say('That file could not be read. Choose a backup file saved from this page.'); }
    e.target.value = '';
  });
  $('wipe').addEventListener('click', () => {
    if (!confirm('Erase all plans, net worth entries, bank transactions and rules in this browser? Save a backup file first if you want to keep them.')) return;
    store.replace(null);
    say('Erased.');
  });
  $('autoChoose').addEventListener('click', async () => {
    try { if (await backup.choose('money-dashboard-data.json')) await afterConnect(); } catch { /* the file dialog was closed */ }
    render();
  });
  $('autoReconnect').addEventListener('click', async () => { if (await backup.reconnect()) await afterConnect(); render(); });
  $('autoForget').addEventListener('click', async () => { await backup.forget(); render(); });
  const off = backup.onChange(render);
  render();
  return { update: render, destroy: off };
}
