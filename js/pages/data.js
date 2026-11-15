// Data page: where your numbers are kept, the file that keeps several computers in step, copies, and starting over.
import { html, useStore, useBackup, useState, download } from '../ui.js';
import * as store from '../store.js';
import * as backup from '../backup.js';
import { today, dmy, daysBetween, plural, when } from '../format.js';

const counts = (s) => `${plural(s.networth.length, 'set of values', 'sets of values')}, ${plural(s.transactions.length, 'bank transaction')} and ${plural(s.rules.length, 'rule')} of your own`;

function Keep({ s, b }) {
  const has = s.networth.length || s.transactions.length;
  const age = s.meta.exported ? daysBetween(s.meta.exported, today()) : null;
  const [cls, big, small] = !store.isSaved()
    ? ['short', 'This browser is not saving your data.', 'It may be in private mode, or out of space. Save a copy below before you close the page, or what you have typed is lost.']
    : b.state === 'ready' ? ['ok', 'Your numbers are saved to a file as you go.', `Every change is written to "${b.name}" a few seconds later, and changes made on another computer are taken in from it.`]
      : b.state !== 'off' ? ['short', `Your numbers are not being saved to "${b.name}" right now.`, b.state === 'locked' ? 'The browser wants your go-ahead again. Press Connect at the top of the page.' : b.state === 'conflict' ? 'The file and this browser have both changed. Choose which numbers to keep, at the top of the page.' : b.error]
        : !has ? ['', 'Nothing to keep safe yet.', 'Your numbers will live in this browser. Once you have added some, keep them in a file below.']
          : age === null || age > 30 ? ['short', age === null ? 'Your numbers are only in this browser.' : `Your last copy is ${age} days old.`, 'Keep them in a file below, or save a copy. Clearing the browser\'s data would remove them.']
            : ['ok', `Your last copy is from ${age === 0 ? 'today' : dmy(s.meta.exported)}.`, 'Save a new one after you add a month\'s numbers.'];
  return html`<div class="panel answer ${cls}" id="keep"><p class="big">${big}</p><p>${small}</p></div>`;
}

function FileSync({ b }) {
  const [note, setNote] = useState('');
  if (!backup.supported()) {
    return html`<div class="panel"><h2>The same numbers on several computers</h2>
      <p>This browser cannot save to a file by itself; Chrome and Edge on a computer can. Here, save a copy below on one device and open it on the other.</p></div>`;
  }
  const act = async (what) => {
    setNote('');
    try {
      if (what === 'forget') await backup.forget();
      else if (what === 'connect') await backup.reconnect();
      else {
        const res = what === 'create' ? await backup.create('money-dashboard-data.json') : await backup.open();
        if (res === 'not-ours') setNote('That file has something else in it. Choose an empty name, or a file made by this dashboard.');
        else if (res === 'denied') setNote('The browser did not allow saving to that file. Try again and choose Allow.');
      }
    } catch (e) {
      if (!e || e.name !== 'AbortError') setNote('The file could not be used. Try again, or choose another file.');   // AbortError: the dialog was closed
    }
  };
  const said = note || (b.state === 'ready' ? `In step with ${b.name}.` + (b.at ? ` Last saved ${when(b.at)}.` : '')
    : b.state === 'locked' ? 'Waiting for your go-ahead: the browser asks again after a restart, unless you chose "Allow on every visit".'
      : b.state === 'conflict' ? 'Waiting for your choice at the top of the page.' : b.state === 'error' ? b.error : '');
  return html`<div class="panel">
    <h2>The same numbers on several computers</h2>
    ${b.state === 'off'
      ? html`<p>Keep your numbers in one file, in a folder that syncs between your computers (OneDrive, Dropbox, iCloud Drive or Google Drive). The dashboard saves to it a few seconds after every change, and takes in changes made on another computer.</p>
        <p>On the first computer, start a new file. On the others, choose that same file.</p>`
      : html`<p>Your numbers are kept in the file <b>"${b.name}"</b>. On another computer, open this page and choose the same file with "Use a file I already have".</p>`}
    <div class="row">
      ${b.state === 'off'
        ? html`<button type="button" class="primary" data-file="create" onClick=${() => act('create')}>Start a new file</button><button type="button" data-file="open" onClick=${() => act('open')}>Use a file I already have</button>`
        : html`${b.state === 'locked' ? html`<button type="button" class="primary" data-file="connect" onClick=${() => act('connect')}>Connect</button>` : null}<button type="button" class="quiet" data-file="forget" onClick=${() => act('forget')}>Stop using the file</button>`}
    </div>
    <p class="status" id="autoStatus" style="margin-top:10px" aria-live="polite">${said}</p>
    <ul class="plain hint">
      <li>Give your sync program a moment before you switch computers. If both have changed, you are asked which numbers to keep, and the other set is saved to your Downloads folder.</li>
      <li>The file has no password. Anyone who can open that folder can read your numbers.</li>
      <li>Works in Chrome and Edge on a computer. On a phone, and in Firefox and Safari, use a copy instead.</li>
    </ul>
  </div>`;
}

export function Data() {
  const s = useStore(), b = useBackup();
  const [status, setStatus] = useState('');
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && navigator.standalone !== true;

  const save = () => { download(`money-dashboard-data-${today()}.json`, store.exportJson()); setStatus('Saved. Keep the file somewhere safe and private.'); };
  const open = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      if (!raw || typeof raw !== 'object' || !raw.profile) throw new Error('not a data file');
      if (!confirm('Opening this file replaces everything saved in this browser. Continue?')) return;
      store.replace(raw);
      setStatus(`Opened. In this browser now: ${counts(store.get())}.`);
    } catch { setStatus('That file could not be read. Choose a copy saved from this page.'); }
  };
  const wipe = async () => {
    const file = b.name;
    if (!confirm('Erase all values, bank transactions and rules in this browser? Save a copy first if you want to keep them.'
      + (file ? ` The dashboard also stops using the file "${file}". The file itself is left as it is.` : ''))) return;
    if (file) await backup.forget();          // otherwise the numbers would come straight back from the file
    store.replace(null);
    setStatus('Erased.');
  };

  return html`<h1>Data</h1>
    <${Keep} s=${s} b=${b} />
    <${FileSync} b=${b} />
    <div class="panel">
      <h2>A copy you save yourself</h2>
      <p>Everything you type and every bank file you add is saved in this browser on this device. Nothing is sent anywhere. A copy is one file with all of it, to keep or to open on another device. Keep it private.</p>
      <div class="row">
        <button type="button" class="primary" id="exp" onClick=${save}>Save a copy</button>
        <button type="button" id="imp" onClick=${() => document.getElementById('impFile').click()}>Open a copy</button>
        <input type="file" id="impFile" accept="application/json,.json" hidden onChange=${open} />
      </div>
      <p class="status" id="status" style="margin-top:10px" aria-live="polite">${status || `In this browser: ${counts(s)}.`}</p>
    </div>
    ${ios ? html`<div class="panel"><h2>On iPhone and iPad</h2>
      <p>Safari removes what a web page has saved when you have not used it for about a week. Open the share menu and choose <b>Add to Home Screen</b>, and use the dashboard from there. That copy starts empty: open a copy you saved.</p></div>` : null}
    <div class="panel">
      <h2>Start over</h2>
      <p>Erase everything this dashboard has saved in this browser: your values, bank transactions and rules.</p>
      <button type="button" id="wipe" onClick=${wipe}>Erase everything in this browser</button>
    </div>`;
}
