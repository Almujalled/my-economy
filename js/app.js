// App shell: loads saved data, switches pages on the URL hash, re-renders on data changes.
import * as store from './store.js';
import * as backup from './backup.js';
import { today } from './format.js';
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

await store.load();
store.subscribe(() => {
  if (page && page.update) page.update();
  backup.schedule(() => JSON.stringify(store.get(), null, 2));   // only does something when you have chosen a backup file
});
// A backup file that was written today counts as today's backup.
backup.onChange(() => {
  const b = backup.status();
  if (b.ready && b.at && !b.error && store.get().meta.exported !== today()) store.update((s) => { s.meta.exported = today(); });
});
backup.start();
// The dashboard open in another tab saved something: take its numbers, so the two do not overwrite each other.
window.addEventListener('storage', async (e) => { if (e.key === store.KEY) { await store.load(); show(); } });
window.addEventListener('hashchange', show);
show();
