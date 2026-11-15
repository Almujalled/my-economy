// Overview: last month in a sentence, where you stand, and the few things worth doing now.
import { html, useStore } from '../ui.js';
import * as store from '../store.js';
import * as backup from '../backup.js';
import { investable, netWorth, grown, stopAge } from '../model.js';
import { shareOfIncome } from '../ledger.js';
import { todo } from '../todo.js';
import { kr, round500, today, dmy, monthName, plural } from '../format.js';

const Steps = ({ steps }) => (steps.length
  ? html`<ul class="ways">${steps.map((x) => html`<li key=${x.text}><a href=${x.link}>${x.text}</a></li>`)}</ul>`
  : html`<p>Nothing needs doing. Come back next month with the new file and values.</p>`);

export function Overview() {
  const s = useStore(), L = store.ledger(s), day = today();
  const steps = todo(s, L, day, backup.status().state === 'ready');
  const last = store.latest(s), prev = s.networth[s.networth.length - 2];
  if (!s.transactions.length && !last) {
    return html`<h1>Overview</h1>
      <div class="panel answer">
        <p class="big">Two steps, and this page shows where you stand.</p>
        <ol class="ways">
          <li><a href="#/spending"><b>Spending:</b> add a file from the account your pay comes into.</a> Export it from your online bank as Excel or CSV. It is read in this browser and never uploaded.</li>
          <li><a href="#/networth"><b>Net worth:</b> type what you own and owe.</a> Once a month, from your bank and broker.</li>
        </ol>
      </div>`;
  }

  const month = L.whole[L.whole.length - 1], u = L.usual, share = shareOfIncome(u);
  const p = store.roughInputs(s, L, day), age = p ? stopAge(p) : null;
  const tiles = [];
  if (u) tiles.push([kr(round500(u.living)), `Living costs in a usual month, over ${plural(u.months, 'whole month')}`, '#/spending']);
  if (last) {
    const up = prev ? netWorth(last) - netWorth(prev) : null;
    tiles.push([kr(netWorth(last)), `Net worth on ${dmy(last.date)}` + (up === null ? '' : `, ${up >= 0 ? 'up' : 'down'} ${kr(Math.abs(up))} since ${dmy(prev.date)}`), '#/networth']);
    const g = grown(last);
    tiles.push([kr(investable(last)), 'Investments' + (g === null ? '' : `, of which ${kr(g)} is growth on what you put in`), '#/networth']);
  }
  if (p) tiles.push([age === null ? 'Not before 75' : age <= p.age ? 'Now' : `At ${age}`, 'When you can stop working, at this pace. Rough on purpose.', '#/networth']);

  return html`<h1>Overview</h1>
    <div class="panel answer">
      ${month
        ? html`<p class="big">In ${monthName(month.month)} you spent <span class="num">${kr(round500(month.living))}</span> on living costs and put <span class="num">${kr(round500(Math.max(0, month.investing)))}</span> into investments.</p>`
        : html`<p class="big">Not a whole month in your files yet.</p>`}
      ${share && share.left >= 0 ? html`<p>Over the last ${plural(u.months, 'whole month')} you kept ${Math.round(share.kept)} of every 100 kr that came in: what you invested, paid off the mortgage, and had left.</p>` : null}
      ${share && share.left < 0 ? html`<p>Over the last ${plural(u.months, 'whole month')} you spent more than came in, by ${kr(round500(-u.left))} a month.</p>` : null}
      ${tiles.length ? html`<div class="stats">${tiles.map(([b, label, href]) => html`<a class="stat" key=${label} href=${href}><b>${b}</b><span>${label}</span></a>`)}</div>` : null}
    </div>
    <div class="panel">
      <h2>Do next</h2>
      <${Steps} steps=${steps} />
    </div>`;
}
