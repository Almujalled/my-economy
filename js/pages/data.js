// My data page: where the numbers live, backups, moving to another device, and the rules in use.
import * as store from '../store.js';
import * as backup from '../backup.js';
import { LAW, LAWS } from '../model.js';
import { LAW_YEARS, lawIsOld } from '../law.js';
import { kr, today, dmy, daysBetween, plural, esc, when } from '../format.js';

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
<div class="panel">
  <h2>The same numbers on several computers</h2>
  <div id="autoBody"></div>
  <div class="row" id="autoButtons"></div>
  <p class="status" id="autoStatus" style="margin-top:10px" aria-live="polite"></p>
  <ul class="plain hint" id="autoNotes"></ul>
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
    const b = backup.status(), name = esc(b.name);
    const age = s.meta.exported ? daysBetween(s.meta.exported, today()) : null;
    if (!store.isSaved()) {
      K.className = 'panel answer short';
      K.innerHTML = `<p class="big">This browser is not saving your data.</p><p>It may be in private mode, or out of space. Save a backup file before you close the page, or what you have typed is lost.</p>`;
    } else if (b.state === 'ready') {
      K.className = 'panel answer ok';
      K.innerHTML = `<p class="big">Your numbers are saved to a file as you go.</p><p>Every change is written to "${name}" a few seconds later, and changes made on another computer are taken in from it.</p>`;
    } else if (b.state !== 'off') {
      K.className = 'panel answer short';
      K.innerHTML = `<p class="big">Your numbers are not being saved to "${name}" right now.</p><p>${b.state === 'locked' ? 'The browser wants your go-ahead again. Press Connect at the top of the page.' : b.state === 'conflict' ? 'The file and this browser have both changed. Choose which numbers to keep, at the top of the page.' : esc(b.error)}</p>`;
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

    // the file that keeps several computers in step
    if (!backup.supported()) {
      $('autoBody').innerHTML = `<p>This browser cannot save to a file by itself; Chrome and Edge on a computer can. Here, move your numbers by hand: save a backup file on one device and open it on the other.</p>`;
      $('autoButtons').innerHTML = ''; $('autoNotes').innerHTML = '';
      return;
    }
    $('autoBody').innerHTML = b.state === 'off'
      ? `<p>Keep your numbers in one file, in a folder that syncs between your computers (OneDrive, Dropbox, iCloud Drive or Google Drive). The dashboard saves to the file a few seconds after every change, and takes in changes made on another computer when you open it or come back to it.</p>
         <p>On the first computer, start a new file. On the others, choose that same file.</p>`
      : `<p>Your numbers are kept in the file <b>"${name}"</b>. On another computer, open this page and choose the same file with "Use a file I already have".</p>`;
    $('autoButtons').innerHTML = b.state === 'off'
      ? `<button type="button" class="primary" data-file="create">Start a new file</button><button type="button" data-file="open">Use a file I already have</button>`
      : (b.state === 'locked' ? `<button type="button" class="primary" data-file="connect">Connect</button>` : '') + `<button type="button" class="quiet" data-file="forget">Stop using the file</button>`;
    if (!$('autoStatus').dataset.said) $('autoStatus').textContent = b.state === 'ready' ? `In step with ${b.name}.` + (b.at ? ` Last saved ${when(b.at)}.` : '')
      : b.state === 'locked' ? 'Waiting for your go-ahead: the browser asks again after a restart, unless you chose "Allow on every visit".'
        : b.state === 'conflict' ? 'Waiting for your choice at the top of the page.' : b.state === 'error' ? b.error : '';
    $('autoNotes').innerHTML = `<li>Give your sync program a moment before you switch computers. If both have changed, you are asked which numbers to keep, and the other set is saved to your Downloads folder.</li>
      <li>The file is not locked with a password. Anyone who can open that folder can read your numbers.</li>
      <li>Works in Chrome and Edge on a computer. On a phone, and in Firefox and Safari, use the two backup buttons above.</li>`;
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
  $('wipe').addEventListener('click', async () => {
    const file = backup.status().name;
    if (!confirm('Erase all plans, net worth entries, bank transactions and rules in this browser? Save a backup file first if you want to keep them.'
      + (file ? ` The dashboard also stops using the file "${file}". The file itself is left as it is.` : ''))) return;
    if (file) await backup.forget();          // otherwise the numbers would come straight back from the file
    store.replace(null);
    say('Erased.');
  });
  $('autoButtons').addEventListener('click', async (e) => {
    const what = e.target.dataset.file, note = (t) => { $('autoStatus').dataset.said = t ? '1' : ''; if (t) $('autoStatus').textContent = t; };
    if (!what) return;
    note('');
    try {
      if (what === 'forget') await backup.forget();
      else if (what === 'connect') await backup.reconnect();
      else {
        const res = what === 'create' ? await backup.create('money-dashboard-data.json') : await backup.open();
        if (res === 'not-ours') note('That file has something else in it. Choose an empty name, or a file made by this dashboard.');
        else if (res === 'denied') note('The browser did not allow saving to that file. Try again and choose Allow.');
      }
    } catch (e) {
      if (!e || e.name !== 'AbortError') note('The file could not be used. Try again, or choose another file.');   // AbortError: the dialog was closed
    }
    render();
  });
  const off = backup.onChange(render);
  render();
  return { update: render, destroy: off };
}
