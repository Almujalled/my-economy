// My data page: where the numbers live, export, import, erase.
import * as store from '../store.js';
import { LAW } from '../model.js';
import { kr, today } from '../format.js';

const HTML = `
<h1>My data</h1>
<div class="panel">
  <h2>Where your numbers are</h2>
  <p>Everything you type is saved in this browser on this device only. Nothing is sent to GitHub or anywhere else, and the public code contains no personal numbers.</p>
  <p>To use another device, or to keep a backup, export a file here and import it there. Keep that file private.</p>
  <div class="row">
    <button type="button" class="primary" id="exp">Export my data</button>
    <button type="button" id="imp">Import a data file</button>
    <button type="button" id="wipe">Erase everything in this browser</button>
    <input type="file" id="impFile" accept="application/json,.json" hidden>
  </div>
  <p class="status" id="status" style="margin-top:10px"></p>
</div>
<div class="panel">
  <h2>Rules the calculations use</h2>
  <div class="scroll"><table>
    <tr><th>Rule (${LAW.year})</th><th>Value</th></tr>
    <tr><td>Tax on gains taken out of ASK and funds, after your own deposits</td><td>${(LAW.gainsTax * 100).toFixed(2)}%</td></tr>
    <tr><td>Wealth tax rate</td><td>${(LAW.wealthRate * 100).toFixed(1)}%</td></tr>
    <tr><td>Share of ASK and fund value that counts for wealth tax</td><td>${LAW.wealthShare * 100}%</td></tr>
    <tr><td>Wealth tax allowance per person</td><td>${kr(LAW.wealthFree)}</td></tr>
    <tr><td>Age the pension is counted from</td><td>${LAW.pensionAge}</td></tr>
  </table></div>
  <p class="hint">These change with the national budget. They are set in js/model.js; sources are in the README.</p>
</div>`;

export function mount(root) {
  root.innerHTML = HTML;
  const $ = (id) => root.querySelector('#' + id);
  const info = () => { const s = store.get(); return `${s.plans.length} plan${s.plans.length === 1 ? '' : 's'} and ${s.networth.length} net worth entr${s.networth.length === 1 ? 'y' : 'ies'} in this browser.`; };
  $('status').textContent = store.isSaved() ? info() : 'This browser is not saving data. Export a file before you close the page.';

  $('exp').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' }));
    a.download = `money-dashboard-data-${today()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    $('status').textContent = 'Exported. Keep the file private.';
  });
  $('imp').addEventListener('click', () => $('impFile').click());
  $('impFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      if (!raw || typeof raw !== 'object' || !raw.profile) throw new Error('not a data file');
      if (!confirm('Importing replaces everything saved in this browser. Continue?')) return;
      store.replace(raw);
      $('status').textContent = 'Imported. ' + info();
    } catch { $('status').textContent = 'That file could not be read. Choose a file exported from this page.'; }
    e.target.value = '';
  });
  $('wipe').addEventListener('click', () => {
    if (!confirm('Erase all plans and net worth entries in this browser? Export first if you want a backup.')) return;
    store.replace(null);
    $('status').textContent = 'Erased. ' + info();
  });
  return {};
}
