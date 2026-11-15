// App shell: loads the saved numbers, shows the page named in the address (#/spending), keeps the file in step.
import { html, render, useState, useEffect, useStore } from './ui.js';
import * as store from './store.js';
import * as backup from './backup.js';
import { Overview } from './pages/overview.js';
import { Spending } from './pages/spending.js';
import { NetWorth } from './pages/networth.js';
import { Data } from './pages/data.js';
import { SyncNote } from './pages/sync-note.js';

const PAGES = { overview: ['Overview', Overview], spending: ['Spending', Spending], networth: ['Net worth', NetWorth], data: ['Data', Data] };
const route = () => { const r = location.hash.replace(/^#\//, '').split('/')[0]; return PAGES[r] ? r : 'overview'; };

// Draws the page again from scratch: after numbers came in from the file or another tab, and when the
// computer switches between light and dark (the charts take their colours from the page).
let redraw = () => {};

function App() {
  const [at, setAt] = useState(route());
  const [round, setRound] = useState(0);
  useStore();
  useEffect(() => {
    const go = () => { setAt(route()); window.scrollTo(0, 0); };
    const dark = matchMedia('(prefers-color-scheme: dark)');
    redraw = () => setRound((n) => n + 1);
    addEventListener('hashchange', go);
    dark.addEventListener('change', redraw);
    return () => { removeEventListener('hashchange', go); dark.removeEventListener('change', redraw); };
  }, []);
  const Page = PAGES[at][1];
  return html`
    <header class="top"><div class="wrap top-in">
      <span class="brand">Money dashboard</span>
      <nav id="nav" aria-label="Sections">${Object.entries(PAGES).map(([id, [name]]) => html`<a key=${id} href=${'#/' + id} aria-current=${id === at ? 'page' : null}>${name}</a>`)}</nav>
    </div></header>
    <${SyncNote} />
    <main class="wrap" id="view" key=${at + ':' + round}><${Page} /></main>`;
}

await store.load();
store.subscribe(() => backup.changed());   // only does something when the numbers are kept in a file
backup.start({ get: store.get, replace: (data) => { store.replace(data); redraw(); }, touch: () => store.update(() => {}) });
// The dashboard open in another tab saved something: take its numbers, so the two do not overwrite each other.
addEventListener('storage', async (e) => { if (e.key === store.KEY) { await store.load(); redraw(); } });
render(html`<${App} />`, document.getElementById('app'));
