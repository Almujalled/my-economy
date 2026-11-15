// Plan page: three levers, a plain-language answer, and what it would take to close the gap.
import * as store from '../store.js';
import { SCENARIOS, LAW, simulate, maxSpend, needInvest, earliestAge } from '../model.js';
import { kr, round500, up500, round10k, esc } from '../format.js';
import { lineChart } from '../charts.js';

const PLAN_FIELDS = ['invest', 'retAge', 'spend', 'crash'];
const PROFILE_FIELDS = ['birthYear', 'takehome', 'livingNow', 'portfolio', 'basis', 'mortgagePayment', 'mortgageEndYear', 'pension', 'horizon', 'otherWealth'];

const HTML = `
<div class="grid">
<div class="side">
  <div class="panel">
    <h2>Your plan</h2>
    <div class="row" style="margin-bottom:16px">
      <select id="planSel" aria-label="Choose plan"></select>
      <button type="button" id="planNew">Copy as new</button>
      <button type="button" id="planRename">Rename</button>
      <button type="button" id="planDel">Delete</button>
    </div>
    <div class="lever">
      <label for="invest">I invest each month <span class="val"><input type="number" id="invest" step="500" min="0"> kr</span></label>
      <input type="range" id="invest_r" min="0" max="60000" step="500" aria-label="Monthly investing">
    </div>
    <div class="lever">
      <label for="retAge">I stop working at <span class="val"><input type="number" id="retAge" step="1"> yrs</span></label>
      <input type="range" id="retAge_r" min="40" max="75" step="1" aria-label="Age you stop working">
    </div>
    <div class="lever">
      <label for="spend">Then I live on, per month <span class="val"><input type="number" id="spend" step="500" min="0"> kr</span></label>
      <input type="range" id="spend_r" min="10000" max="80000" step="500" aria-label="Monthly living costs after you stop">
      <p class="hint">Living costs without the mortgage. You spend about <span id="nowHint"></span> today.</p>
    </div>
    <div class="lever">
      <label>How the markets go</label>
      <div class="seg" id="seg">${SCENARIOS.map((s, i) => `<button type="button" data-s="${i}">${s.name}</button>`).join('')}</div>
      <p class="hint" id="segHint"></p>
    </div>
  </div>

  <div class="panel">
    <h2>Your numbers</h2>
    <details open>
      <summary>Today</summary>
      <div class="fields">
        <div class="field"><label for="birthYear">Year you were born</label><input type="number" id="birthYear" step="1"></div>
        <div class="field"><label for="takehome">Take-home pay per month</label><input type="number" id="takehome" step="500"></div>
        <div class="field"><label for="livingNow">Living costs per month</label><input type="number" id="livingNow" step="500"><small>Everything except mortgage and investing.</small></div>
        <div class="field"><label for="portfolio">Invested today (ASK, funds, other)</label><input type="number" id="portfolio" step="1000"><small id="pfHint"></small></div>
        <div class="field"><label for="basis">Of that, what you paid in</label><input type="number" id="basis" step="1000"><small>You get this back tax-free. Only the growth is taxed.</small></div>
      </div>
    </details>
    <details>
      <summary>Mortgage and pension</summary>
      <div class="fields">
        <div class="field"><label for="mortgagePayment">Mortgage payment per month</label><input type="number" id="mortgagePayment" step="100"></div>
        <div class="field"><label for="mortgageEndYear">Year it is paid off</label><input type="number" id="mortgageEndYear" step="1"><small>After that, the payment is invested instead while you still work.</small></div>
        <div class="field"><label for="pension">Pension per year after tax</label><input type="number" id="pension" step="5000" min="0"><small>From nav.no, Din pensjon. Counted from age ${LAW.pensionAge}.</small></div>
      </div>
    </details>
    <details>
      <summary>Fine print</summary>
      <div class="fields">
        <div class="field"><label for="horizon">Money must last until age</label><input type="number" id="horizon" step="1"></div>
        <div class="field"><label for="crash">Market fall the year you stop, %</label><input type="number" id="crash" step="5" min="0" max="80"><small>Try 30 to test a crash at the worst moment. Saved per plan.</small></div>
        <div class="field"><label for="otherWealth">Other taxable wealth</label><input type="number" id="otherWealth" step="50000"><small>Home at 25% of its value, plus bank deposits, minus debt. From your tax return.</small></div>
      </div>
      <p class="hint">Rules for ${LAW.year}: ${(LAW.gainsTax * 100).toFixed(2)}% tax on gains you take out, after your own deposits. Wealth tax ${LAW.wealthRate * 100}% on ${LAW.wealthShare * 100}% of the portfolio above ${kr(LAW.wealthFree)}.</p>
    </details>
  </div>
</div>

<div>
  <div class="panel answer" id="answer" aria-live="polite"></div>
  <div class="panel">
    <h2>Your month today</h2>
    <div class="bar" id="bar" role="img" aria-label="How your take-home pay is split"></div>
    <div class="legend" id="legend"></div>
    <div id="budgetNote"></div>
  </div>
  <div class="panel">
    <h2>What you could live on, by the age you stop</h2>
    <svg id="c1" role="img" aria-label="Monthly amount you could live on for each age you stop working"></svg>
    <div class="scroll"><table id="ageTable" style="margin-top:10px"></table></div>
  </div>
  <div class="panel">
    <h2>Your investments over time with this plan</h2>
    <svg id="c2" role="img" aria-label="Portfolio value by age"></svg>
    <p class="hint" id="c2Hint"></p>
  </div>
  <div class="panel" id="comparePanel" hidden>
    <h2>Your plans side by side</h2>
    <div class="scroll"><table id="compare"></table></div>
  </div>
</div>
</div>`;

export function mount(root) {
  root.innerHTML = HTML;
  const $ = (id) => root.querySelector('#' + id);
  const plan = () => store.activePlan();

  function fill() {
    const s = store.get(), pl = plan();
    PLAN_FIELDS.forEach((k) => { $(k).value = pl[k]; if ($(k + '_r')) $(k + '_r').value = pl[k]; });
    PROFILE_FIELDS.forEach((k) => { $(k).value = k === 'portfolio' ? store.currentPortfolio(s) : s.profile[k]; });
    const snap = store.latestSnapshot(s);
    $('portfolio').disabled = !!snap;
    $('pfHint').textContent = snap ? `Taken from your net worth entry of ${snap.date}.` : 'Add a net worth entry and this follows it automatically.';
    $('planSel').innerHTML = s.plans.map((p) => `<option value="${esc(p.id)}"${p.id === pl.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    $('planDel').disabled = s.plans.length < 2;
  }

  function results() {
    const s = store.get(), pl = plan();
    const p = store.planInputs(s, pl), r = SCENARIOS[pl.scen].r;
    const retAge = Math.max(p.age, pl.retAge);
    const can = maxSpend(p, r, retAge, pl.invest);
    const ok = can >= pl.spend;
    const A = $('answer'); A.className = 'panel answer ' + (ok ? 'ok' : 'short');
    let h = '';
    if (ok) {
      h += `<p class="big">Stop working at ${retAge} and your money lasts to ${p.horizon}.</p>`;
      h += `<p>You could live on up to <b class="num">${kr(round500(can))}</b> a month, <span class="gap num">${kr(round500(can - pl.spend))} more</span> than the ${kr(pl.spend)} you plan for.</p>`;
      const need = needInvest(p, r, retAge, pl.spend);
      if (need !== null && up500(need) < pl.invest) h += `<ul class="ways"><li>You would still get there investing <b class="num">${kr(up500(need))}</b> a month instead of ${kr(pl.invest)}.</li></ul>`;
    } else {
      const out = simulate(p, r, retAge, pl.spend, pl.invest).runsOut;
      h += `<p class="big">Stop working at ${retAge} and you can live on <span class="num">${kr(round500(can))}</span> a month until ${p.horizon}.</p>`;
      h += `<p>That is <span class="gap num">${kr(round500(pl.spend - can))} short</span> of the ${kr(pl.spend)} you want. Spend the full amount anyway and the money runs out when you are ${out}.</p>`;
      const need = needInvest(p, r, retAge, pl.spend), ea = earliestAge(p, r, pl.spend, pl.invest);
      h += `<p>Three ways to close the gap:</p><ul class="ways">`;
      h += need === null ? `<li>Investing more alone cannot do it by ${retAge}.</li>` : `<li>Invest <b class="num">${kr(up500(need))}</b> a month instead of ${kr(pl.invest)}.</li>`;
      h += ea === null ? `<li>Working longer alone does not get you there before 85.</li>` : `<li>Work until you are <b>${ea}</b> instead of ${retAge}.</li>`;
      h += `<li>Live on <b class="num">${kr(round500(can))}</b> a month after you stop.</li></ul>`;
    }
    const lo = maxSpend(p, SCENARIOS[0].r, retAge, pl.invest), hi = maxSpend(p, SCENARIOS[2].r, retAge, pl.invest);
    h += `<div class="range"><span>If markets are cautious: ${kr(round500(lo))} a month</span><span>If markets are good: ${kr(round500(hi))} a month</span></div>`;
    if (p.pension === 0) h += `<div class="note warn">Pension is set to 0, so this is too gloomy. Add your nav.no figure under "Mortgage and pension".</div>`;
    A.innerHTML = h;

    // month today
    const pr = s.profile;
    const left = pr.takehome - pr.mortgagePayment - pl.invest - pr.livingNow;
    const parts = [['Mortgage', pr.mortgagePayment, 'var(--mort)'], ['Investing', pl.invest, 'var(--accent)'], ['Living costs', pr.livingNow, 'var(--live)']].filter((x) => x[1] > 0);
    if (left > 0) parts.push(['Left over', left, 'var(--good)']);
    const tot = parts.reduce((t, x) => t + x[1], 0) || 1;
    $('bar').innerHTML = parts.map((x) => `<div style="width:${(x[1] / tot) * 100}%;background:${x[2]}" title="${x[0]}"></div>`).join('');
    $('legend').innerHTML = parts.map((x) => `<div><span style="background:${x[2]}"></span>${x[0]} <b>${kr(x[1])}</b></div>`).join('');
    const room = pr.takehome - pr.mortgagePayment - pl.invest;
    $('budgetNote').innerHTML = left < 0
      ? `<div class="note warn">This adds up to ${kr(-left)} more than your ${kr(pr.takehome)} take-home. To invest ${kr(pl.invest)} a month you can spend <b>${kr(room)}</b> on living costs.</div>`
      : `<div class="note good">After mortgage and investing you have <b>${kr(room)}</b> a month for living costs. You use ${kr(pr.livingNow)}.</div>`;

    // by age
    const pts = [];
    for (let a = p.age + 1; a <= 75; a++) pts.push({ x: a, y: maxSpend(p, r, a, pl.invest) });
    const sel = pts.find((d) => d.x === retAge);
    const ticks = []; for (let x = Math.ceil((p.age + 1) / 5) * 5; x <= 75; x += 5) ticks.push(x);
    lineChart($('c1'), [{ pts }], { h: 260, fmtY: (v) => Math.round(v / 1000) + 'k', ticksX: ticks, ref: pl.spend, refLabel: 'what you want', mark: retAge, dot: sel || null });
    const ages = [...new Set([50, 55, 60, 62, 65, 67, 70, retAge])].filter((a) => a > p.age && a <= 75).sort((a, b) => a - b);
    $('ageTable').innerHTML = `<tr><th>Stop at</th><th>Invested by then</th><th>Live on, per month</th></tr>` + ages.map((a) => {
      const at = simulate(p, r, a, 0, pl.invest).path.find((d) => d.age === a);
      return `<tr class="${a === retAge ? 'sel' : ''}"><td>${a}</td><td>${kr(round10k(at.balance))}</td><td>${kr(round500(maxSpend(p, r, a, pl.invest)))}</td></tr>`;
    }).join('');

    // portfolio path
    const res = simulate(p, r, retAge, pl.spend, pl.invest);
    const t2 = []; for (let x = Math.ceil(p.age / 10) * 10; x <= p.horizon; x += 10) t2.push(x);
    lineChart($('c2'), [{ pts: res.path.map((d) => ({ x: d.age, y: d.balance })) }], { h: 240, fmtY: (v) => (v / 1e6).toFixed(1) + 'M', ticksX: t2, mark: retAge });
    $('c2Hint').textContent = res.runsOut === null
      ? `Living on ${kr(pl.spend)} a month from ${retAge}. The dotted line is the year you stop.`
      : `Living on ${kr(pl.spend)} a month from ${retAge}: empty at ${res.runsOut}. The dotted line is the year you stop.`;

    $('nowHint').textContent = kr(pr.livingNow);
    $('segHint').textContent = `Growth of ${(SCENARIOS[pl.scen].r * 100).toFixed(1).replace('.', ',')}% a year above inflation.`;
    root.querySelectorAll('#seg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.s === pl.scen)));
    $('retAge_r').min = p.age + 1;

    // compare
    $('comparePanel').hidden = s.plans.length < 2;
    if (s.plans.length > 1) {
      $('compare').innerHTML = `<tr><th>Plan</th><th>Invest / month</th><th>Stop at</th><th>Want / month</th><th>Can live on</th><th>Result</th></tr>` + s.plans.map((q) => {
        const qp = store.planInputs(s, q), qr = SCENARIOS[q.scen].r, qa = Math.max(qp.age, q.retAge);
        const c = maxSpend(qp, qr, qa, q.invest);
        return `<tr class="${q.id === pl.id ? 'sel' : ''}"><td>${esc(q.name)} (${SCENARIOS[q.scen].name.toLowerCase()})</td><td>${kr(q.invest)}</td><td>${qa}</td><td>${kr(q.spend)}</td><td>${kr(round500(c))}</td><td>${c >= q.spend ? 'Enough' : kr(round500(q.spend - c)) + ' short'}</td></tr>`;
      }).join('');
    }
  }

  // inputs
  const setPlan = (k, v, from) => {
    if (!isFinite(v)) return;
    store.update((s) => { store.activePlan(s)[k] = v; });
    if (from !== 'num') $(k).value = v;
    if (from !== 'range' && $(k + '_r')) $(k + '_r').value = v;
  };
  PLAN_FIELDS.forEach((k) => {
    $(k).addEventListener('input', (e) => setPlan(k, parseFloat(e.target.value), 'num'));
    if ($(k + '_r')) $(k + '_r').addEventListener('input', (e) => setPlan(k, parseFloat(e.target.value), 'range'));
  });
  PROFILE_FIELDS.forEach((k) => $(k).addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (isFinite(v)) store.update((s) => { s.profile[k] = v; });
  }));
  root.querySelectorAll('#seg button').forEach((b) => b.addEventListener('click', () => store.update((s) => { store.activePlan(s).scen = +b.dataset.s; })));
  $('planSel').addEventListener('change', (e) => { store.update((s) => { s.activePlan = e.target.value; }); fill(); });
  $('planNew').addEventListener('click', () => {
    const name = prompt('Name for the new plan', plan().name + ' 2');
    if (!name || !name.trim()) return;
    store.update((s) => { const c = { ...store.activePlan(s), ...{ id: store.newPlan().id, name: name.trim().slice(0, 60) } }; s.plans.push(c); s.activePlan = c.id; });
    fill();
  });
  $('planRename').addEventListener('click', () => {
    const name = prompt('New name', plan().name);
    if (!name || !name.trim()) return;
    store.update((s) => { store.activePlan(s).name = name.trim().slice(0, 60); });
    fill();
  });
  $('planDel').addEventListener('click', () => {
    if (store.get().plans.length < 2 || !confirm(`Delete the plan "${plan().name}"?`)) return;
    store.update((s) => { s.plans = s.plans.filter((p) => p.id !== s.activePlan); s.activePlan = s.plans[0].id; });
    fill();
  });

  fill(); results();
  return { update: results };
}
