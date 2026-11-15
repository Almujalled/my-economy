// The note under the header, on every page, when your numbers need you: the browser is not saving them,
// the file they are kept in wants your go-ahead again, the file and this browser have both changed,
// or newer numbers came in from the file.
import { html, useStore, useBackup, download } from '../ui.js';
import * as store from '../store.js';
import * as backup from '../backup.js';
import { today, when } from '../format.js';

export function SyncNote() {
  useStore();
  const b = useBackup();
  const keepOne = async (which) => {
    const other = await backup.resolve(which);
    if (other) download(`money-dashboard-data-set-aside-${today()}.json`, other);
  };
  let note = null;
  if (!store.isSaved()) note = html`<div class="note warn syncbar"><span>This browser is not saving your numbers. Save a copy on the <a href="#/data">Data</a> page before you close it.</span></div>`;
  else if (b.state === 'locked') {
    note = html`<div class="note warn syncbar"><span>Your numbers are also kept in the file "${b.name}". Press Connect so this browser can read it and save to it. Choose "Allow on every visit" if the browser offers it, and this step goes away.</span>
      <button type="button" class="primary" data-sync="connect" onClick=${() => backup.reconnect()}>Connect</button></div>`;
  } else if (b.state === 'conflict') {
    note = html`<div class="note warn syncbar"><span><b>This browser and the file "${b.name}" have both changed</b> since they last held the same numbers. This browser was last changed ${when(b.conflict.local)}, the file ${when(b.conflict.file)}. Which numbers do you want to keep? The other set is saved to your Downloads folder, so nothing is lost.</span>
      <span class="row"><button type="button" data-sync="browser" onClick=${() => keepOne('browser')}>Keep this browser's</button><button type="button" data-sync="file" onClick=${() => keepOne('file')}>Take the file's</button></span></div>`;
  } else if (b.state === 'error') note = html`<div class="note warn syncbar"><span>${b.name}: ${b.error}</span></div>`;
  else if (b.loaded) {
    note = html`<div class="note info syncbar"><span>Newer numbers were loaded from the file "${b.name}", last changed ${when(b.loaded)}.</span>
      <button type="button" data-sync="ok" onClick=${() => backup.seenLoaded()}>OK</button></div>`;
  }
  return html`<div class="wrap" id="sync" aria-live="polite">${note}</div>`;
}
