// Budget page: the plan for a normal month, and how each real month compared.
// The real months come from the bank files added on the Spending page.
import * as store from '../store.js';
import { shareOfIncome } from '../ledger.js';
import { kr, round500, monthName, plural, pct } from '../format.js';

const PARTS = [['living', 'Living costs', 'var(--live)'], ['mortgage', 'Mortgage', 'var(--mort)'], ['investing', 'Investing', 'var(--accent)'], ['oneoff', 'One-offs', 'var(--muted)'], ['left', 'Left over', 'var(--good)']];

const HTML = `
<h1>Budget</h1>
<div class="panel answer" id="answer" aria-live="polite"></div>

<div class="panel">
  <h2>Your plan for a normal month</h2>
  <div class="fields two">
    <div class="field"><label for="takehome">Pay that lands in your account</label><input type="number" id="takehome" step="500" min="0"><small>A normal month. June (holiday pay) and December (half tax) pay more; treat that as extra.</small></div>
    <div class="field"><label for="mortgagePayment">Mortgage payment</label><input type="number" id="mortgagePayment" step="100" min="0"></div>
    <div class="field"><label for="invest">Investing</label><input type="number" id="invest" step="500" min="0"><small id="investHint"></small></div>
    <div class="field"><label for="livingNow">Living costs</label><input type="number" id="livingNow" step="500" min="0"><small>Everything except mortgage and investing.</small></div>
  </div>
  <div class="bar" id="bar" role="img" aria-label="How a normal month's pay is split"></div>
  <div class="legend" id="legend"></div>
  <div id="planNote"></div>
</div>

<div class="panel" id="monthsPanel" hidden>
  <h2>Month by month</h2>
  <div class="scroll"><table id="months"></table></div>
  <p class="hint">Small numbers show the difference from your plan. Transfers between your own accounts are left out. A month marked "so far" is not complete in your files.</p>
</div>

<div class="panel" id="sharePanel" hidden>
  <h2>Where every 100 kr went</h2>
  <div class="bar" id="shareBar" role="img" aria-label="How your income was split, on average"></div>
  <div class="legend" id="shareLegend"></div>
  <p id="shareText" style="margin-top:12px"></p>
</div>`;

export function mount(root) {
  root.innerHTML = HTML;
  const $ = (id) => root.querySelector('#' + id);
  const PROFILE = ['takehome', 'mortgagePayment', 'livingNow'];

  function fill() {
    const s = store.get();
    PROFILE.forEach((k) => { $(k).value = s.profile[k]; });
    $('invest').value = store.activePlan(s).invest;
  }

  function render() {
    const s = store.get(), pr = s.profile, pl = store.activePlan(s), L = store.ledger(s);
    const plan = { income: pr.takehome, living: pr.livingNow, mortgage: pr.mortgagePayment, investing: pl.invest, oneoff: 0 };
    plan.left = plan.income - plan.living - plan.mortgage - plan.investing;
    $('investHint').textContent = s.plans.length > 1 ? `From your plan "${pl.name}".` : 'The same number as "I invest each month" on the Plan page.';

    // the plan as a bar
    const parts = PARTS.filter(([k]) => plan[k] > 0);
    const total = parts.reduce((t, [k]) => t + plan[k], 0) || 1;
    $('bar').innerHTML = parts.map(([k, name, color]) => `<div style="width:${(plan[k] / total) * 100}%;background:${color}" title="${name}"></div>`).join('');
    $('legend').innerHTML = parts.map(([k, name, color]) => `<div><span style="background:${color}"></span>${name} <b>${kr(plan[k])}</b></div>`).join('');
    $('planNote').innerHTML = plan.left < 0
      ? `<div class="note warn">This plan spends ${kr(-plan.left)} more than the ${kr(plan.income)} that comes in. Lower one of the numbers until it fits.</div>`
      : `<div class="note good">The plan leaves <b>${kr(plan.left)}</b> a month for the buffer, extra mortgage payments or the things you did not plan for.</div>`;

    // the answer
    const A = $('answer'), last = L.whole[L.whole.length - 1], u = L.usual;
    if (!s.transactions.length) {
      A.className = 'panel answer';
      A.innerHTML = `<p class="big">No real months to compare yet.</p><p>Your plan for a month is below. Add bank files on the <a href="#/spending">Spending page</a>, and this page shows how each month went against the plan.</p>`;
    } else if (!last) {
      A.className = 'panel answer';
      A.innerHTML = `<p class="big">Not a whole month yet.</p><p>Your files do not cover a full calendar month. Add more on the <a href="#/spending">Spending page</a>.</p>`;
    } else {
      const over = last.living - plan.living, under = plan.investing - last.investing;
      const spent = Math.abs(over) < 500 ? 'spent what you planned' : `spent <span class="num">${kr(round500(Math.abs(over)))}</span> ${over > 0 ? 'more' : 'less'} than planned`;
      const invested = plan.investing <= 0 && last.investing <= 0 ? '' : Math.abs(under) < 500 ? ` and invested the ${kr(plan.investing)} you aim for`
        : ` and invested <span class="num">${kr(round500(Math.abs(under)))}</span> ${under > 0 ? 'less' : 'more'} than you aim for`;
      const good = over < 500 && under < 500;
      A.className = 'panel answer ' + (good ? 'ok' : 'short');
      let h = `<p class="big">In ${monthName(last.month)} you ${spent}${invested}.</p>`;
      if (u && u.months > 1) h += `<p>Over the last ${u.months} whole months, living costs averaged ${kr(round500(u.living))} a month against a plan of ${kr(plan.living)}, and you invested ${kr(round500(u.investing))} a month against ${kr(plan.investing)}.</p>`;
      if (u && u.living > plan.living * 1.1 && u.months >= 3) h += `<div class="note warn">Your real living costs run above the plan. A plan that is too tight hides the true cost of stopping work: consider raising "Living costs" to match.</div>`;
      if (last.oneoff > 0) h += `<p class="status">One-offs that month: ${kr(last.oneoff)}.</p>`;
      A.innerHTML = h;
    }

    // month by month
    const rows = L.months.slice(-13).reverse(), whole = new Set(L.whole.map((r) => r.month));
    $('monthsPanel').hidden = !rows.length;
    const diff = (actual, target, moreIsGood) => {
      const d = actual - target;
      if (Math.abs(d) < 500 || !target) return '';
      return `<small class="${d > 0 === moreIsGood ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${kr(round500(Math.abs(d)))}</small>`;
    };
    const line = (label, r, cls = '', compare = false) => `<tr class="${cls}"><td>${label}</td>
      <td>${kr(r.income)}</td>
      <td>${kr(r.living)}${compare ? diff(r.living, plan.living, false) : ''}</td>
      <td>${kr(r.mortgage)}</td>
      <td>${kr(r.investing)}${compare ? diff(r.investing, plan.investing, true) : ''}</td>
      <td>${kr(r.oneoff)}</td>
      <td>${kr(r.left)}</td></tr>`;
    $('months').innerHTML = `<tr><th>Month</th><th>Money in</th><th>Living costs</th><th>Mortgage</th><th>Investing</th><th>One-offs</th><th>Left over</th></tr>`
      + line('Your plan', plan, 'sel')
      + (u ? line(`Average, ${plural(u.months, 'whole month')}`, Object.fromEntries(Object.entries(u).map(([k, v]) => [k, typeof v === 'number' ? round500(v) : v])), 'avg', true) : '')
      + rows.map((r) => line(monthName(r.month) + (whole.has(r.month) ? '' : ' <span class="status">so far</span>'), r, '', whole.has(r.month))).join('');

    // where every 100 kr went
    const share = shareOfIncome(u);
    $('sharePanel').hidden = !share;
    if (share) {
      const shown = PARTS.filter(([k]) => share[k] > 0.5);
      const sum = shown.reduce((t, [k]) => t + share[k], 0) || 1;
      $('shareBar').innerHTML = shown.map(([k, name, color]) => `<div style="width:${(share[k] / sum) * 100}%;background:${color}" title="${name}"></div>`).join('');
      $('shareLegend').innerHTML = shown.map(([k, name, color]) => `<div><span style="background:${color}"></span>${name} <b>${pct(share[k])}</b></div>`).join('');
      const split = u.principal > 0;
      let t = `Average of ${plural(u.months, 'whole month')}. `;
      t += share.left < 0
        ? `You spent ${Math.round(-share.left)} kr more than each 100 kr that came in, so savings or credit covered the rest.`
        : `You kept about <b>${Math.round(share.kept)} of every 100 kr</b>: what you invested${split ? ', what you paid off the mortgage' : ''} and what was left over.`;
      if (!split && u.mortgage > 0) t += ' The whole mortgage payment counts as a cost here, because your bank file does not say how much of it was interest.';
      $('shareText').innerHTML = t;
    }
  }

  PROFILE.forEach((k) => $(k).addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (isFinite(v) && v >= 0) store.update((s) => { s.profile[k] = v; });
  }));
  $('invest').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (isFinite(v) && v >= 0) store.update((s) => { store.activePlan(s).invest = v; });
  });

  fill(); render();
  return { update: render };
}
