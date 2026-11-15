// App shell: loads saved data, switches pages on the URL hash, re-renders on data changes.
import * as store from './store.js';
import * as backup from './backup.js';
import { today, esc, when } from './format.js';
import * as home from './pages/home.js';
import * as plan from './pages/plan.js';
import * as networth from './pages/networth.js';
import * as spending from './pages/spending.js';
import * as budget from './pages/budget.js';
import * as guide from './pages/guide.js';
import * as data from './pages/data.js';

const routes = { home, plan, networth, spending, budget, guide, data };
const FIRST = 'home';
const view = document.getElementById('view');
let page = null;

function show() {
  const asked = (location.hash.replace(/^#\//, '') || FIRST).split('/')[0];
  const name = routes[asked] ? asked : FIRST;
  if (page && page.destroy) page.destroy();
  view.innerHTML = '';
  page = routes[name].mount(view);
  document.querySelectorAll('#nav a').forEach((a) => {
    if (a.getAttribute('href') === '#/' + name) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

// The note under the header that appears when the file your numbers are kept in needs you:
// the browser wants your go-ahead again, the file and this browser have both changed, or newer numbers came in.
const bar = document.getElementById('sync');
function renderSync() {
  const b = backup.status(), name = esc(b.name);
  bar.innerHTML = b.state === 'locked'
    ? `<div class="note warn syncbar"><span>Your numbers are also kept in the file "${name}". Press Connect so this browser can read it and save to it. Choose "Allow on every visit" if the browser offers it, and this step goes away.</span><button type="button" class="primary" data-sync="connect">Connect</button></div>`
    : b.state === 'conflict'
      ? `<div class="note warn syncbar"><span><b>This browser and the file "${name}" have both changed</b> since they last held the same numbers. This browser was last changed ${when(b.conflict.local)}, the file ${when(b.conflict.file)}. Which numbers do you want to keep? The other set is saved to your Downloads folder, so nothing is lost.</span><span class="row"><button type="button" data-sync="browser">Keep this browser's</button><button type="button" data-sync="file">Take the file's</button></span></div>`
      : b.state === 'error' ? `<div class="note warn syncbar"><span>${name}: ${esc(b.error)}</span></div>`
        : b.loaded ? `<div class="note info syncbar"><span>Newer numbers were loaded from the file "${name}", last changed ${when(b.loaded)}.</span><button type="button" data-sync="ok">OK</button></div>` : '';
}
bar.addEventListener('click', async (e) => {
  const what = e.target.dataset.sync;
  if (what === 'connect') await backup.reconnect();
  else if (what === 'ok') backup.seenLoaded();
  else if (what === 'browser' || what === 'file') {
    const other = await backup.resolve(what);
    if (!other) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([other], { type: 'application/json' }));
    a.download = `money-dashboard-data-set-aside-${today()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  }
});

await store.load();
store.subscribe(() => {
  if (page && page.update) page.update();
  backup.changed();                       // only does something when you keep your numbers in a file
});
backup.onChange(renderSync);
// Numbers taken from the file replace what is here, so the page is drawn again from scratch.
backup.start({ get: store.get, replace: (data) => { store.replace(data); show(); }, touch: () => store.update(() => {}) });
// The dashboard open in another tab saved something: take its numbers, so the two do not overwrite each other.
window.addEventListener('storage', async (e) => { if (e.key === store.KEY) { await store.load(); show(); } });
window.addEventListener('hashchange', show);
show();
