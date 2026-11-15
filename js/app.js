// App shell: loads saved data, switches pages on the URL hash, re-renders on data changes.
import * as store from './store.js';
import * as plan from './pages/plan.js';
import * as networth from './pages/networth.js';
import * as spending from './pages/spending.js';
import * as data from './pages/data.js';

const routes = { plan, networth, spending, data };
const view = document.getElementById('view');
let page = null;

function show() {
  const name = (location.hash.replace(/^#\//, '') || 'plan').split('/')[0];
  const mod = routes[name] || routes.plan;
  view.innerHTML = '';
  page = mod.mount(view);
  document.querySelectorAll('#nav a').forEach((a) => {
    if (a.getAttribute('href') === '#/' + (routes[name] ? name : 'plan')) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

store.load();
store.subscribe(() => page && page.update && page.update());
window.addEventListener('hashchange', show);
show();
