// Home page: where you stand in a few sentences, and the few things worth doing now.
import * as store from '../store.js';
import * as backup from '../backup.js';
import { SCENARIOS, verdict, investable, netWorth, change } from '../model.js';
import { shareOfIncome } from '../ledger.js';
import { nextSteps, CALENDAR } from '../guide.js';
import { kr, round500, today, dmy, monthName, esc } from '../format.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const HTML = `
<h1>Home</h1>
<div class="panel answer" id="standing" aria-live="polite"></div>
<div class="panel">
  <h2>Do next</h2>
  <div id="steps"></div>
</div>
<div class="panel">
  <h2>The money year</h2>
  <div id="calendar"></div>
  <p class="hint" style="margin-top:10px">The whole year, and the order to do things in, is in the <a href="#/guide">Guide</a>.</p>
</div>`;

export function mount(root) {
  root.innerHTML = HTML;
  const $ = (id) => root.querySelector('#' + id);

  function render() {
    const s = store.get(), L = store.ledger(s), day = today(), pl = store.activePlan(s);
    const last = s.networth[s.networth.length - 1], prev = s.networth[s.networth.length - 2];
    const S = $('standing');
    const fresh = !last && !s.transactions.length && s.profile.portfolio === 0 && s.profile.pension === 0 && s.profile.pensionPot === 0;
    if (fresh) {
      S.className = 'panel answer';
      S.innerHTML = `<p class="big">Welcome. Three steps and this page tells you where you stand.</p>
        <ul class="ways">
          <li><a href="#/plan"><b>1. Plan</b></a>: when you were born, what you invest each month, and when you would like to stop working.</li>
          <li><a href="#/networth"><b>2. Net worth</b></a>: this month's balances from your bank and broker. Ten minutes, once a month.</li>
          <li><a href="#/spending"><b>3. Spending</b></a>: export your transactions from the bank and add the files. They never leave this browser.</li>
        </ul>
        <p class="status" style="margin-top:12px">Everything you type stays on this device. <a href="#/data">How your data is kept</a>.</p>`;
    } else {
      const p = store.planInputs(s, pl), r = SCENARIOS[pl.scen].r, retAge = Math.max(p.age, pl.retAge);
      const v = verdict(p, r, retAge, pl.spend, pl.invest);
      S.className = 'panel answer ' + (v.result === 'safe' ? 'ok' : v.result === 'steady' ? 'warn' : 'short');
      const lines = [];
      lines.push(v.result === 'safe' ? `<p class="big">You are on track to stop working at ${retAge}.</p><p>Living on ${kr(pl.spend)} a month, your money lasts to ${p.horizon} even if the first ten years are bad. <a href="#/plan">See the plan</a>.</p>`
        : v.result === 'steady' ? `<p class="big">You can stop working at ${retAge} if markets are kind.</p><p>Living on ${kr(pl.spend)} a month works with steady growth, but not through a bad first ten years. With ${kr(round500(v.hard))} a month it holds either way. <a href="#/plan">See what closes the gap</a>.</p>`
          : `<p class="big">Your plan to stop at ${retAge} does not hold yet.</p><p>You want ${kr(pl.spend)} a month; the plan can carry ${kr(round500(v.steady))} with steady growth and ${kr(round500(v.hard))} through a bad start. <a href="#/plan">See what closes the gap</a>.</p>`);
      const stats = [];
      if (last) {
        const c = prev ? change(prev, last) : null;
        stats.push([kr(netWorth(last)), `Net worth on ${dmy(last.date)}` + (c ? `, ${c.netWorth >= 0 ? 'up' : 'down'} ${kr(Math.abs(c.netWorth))} since ${dmy(prev.date)}` : ''), '#/networth']);
      }
      const u = L.usual, whole = L.whole[L.whole.length - 1];
      if (u) stats.push([kr(round500(u.living)), `Living costs in a usual month` + (whole ? `. ${monthName(whole.month)} came to ${kr(round500(whole.living))}` : ''), '#/spending']);
      const share = shareOfIncome(u);
      if (share && share.left >= 0) stats.push([`${Math.round(share.kept)} of 100 kr`, 'What you keep of the money that comes in: investing, paying down the loan and what is left', '#/budget']);
      const living = u ? u.living : s.profile.livingNow, invested = last ? investable(last) : s.profile.portfolio;
      if (living > 0 && invested > 0) stats.push([(invested / (12 * living)).toFixed(1).replace('.', ',') + ' years', 'How long your investments would cover your living costs, before tax and growth', '#/plan']);
      S.innerHTML = lines.join('') + (stats.length ? `<div class="stats" style="margin-top:14px">${stats.map(([b, l, href]) => `<a class="stat" href="${href}"><b>${b}</b><span>${esc(l)}</span></a>`).join('')}</div>` : '');
    }

    const steps = nextSteps(s, L, day, 5, { fileBackup: backup.status().state === 'ready' });
    $('steps').innerHTML = steps.length
      ? `<ul class="ways">${steps.map((x) => `<li><a href="${x.link}">${esc(x.text)}</a></li>`).join('')}</ul>`
      : `<p>Nothing needs doing. Come back next month and add the new numbers.</p>`;

    const m = +day.slice(5, 7), next = (m % 12) + 1;
    $('calendar').innerHTML = [m, next].map((i) => `<div class="month"><b>${MONTHS[i - 1]}${i === m ? ' (now)' : ''}</b><p>${CALENDAR[i].happens}</p><p class="todo">${CALENDAR[i].todo}</p></div>`).join('');
  }

  render();
  return { update: render, destroy: backup.onChange(render) };
}
