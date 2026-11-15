// Plan page: three levers, a plain-language answer, and what it would take to close the gap.
// The answer is tested two ways: steady growth, and a bad first ten years after you stop.
import * as store from '../store.js';
import { SCENARIOS, SLOW, LAW, simulate, maxSpend, needInvest, earliestAge, pensionFor, taxableWealth } from '../model.js';
import { HELPER_FROM } from '../pension.js';
import { kr, round500, up500, round10k, esc, today, dmy, short } from '../format.js';
import { lineChart } from '../charts.js';

const PLAN_FIELDS = ['invest', 'retAge', 'spend', 'crash', 'side', 'sideUntil'];
const PROFILE_FIELDS = ['birthYear', 'portfolio', 'basis', 'mortgagePayment', 'mortgageBalance', 'mortgageRate', 'mortgageEndYear',
  'pensionPot', 'grossPay', 'workPot', 'workRate', 'pension', 'horizon', 'otherWealth', 'norwayYears'];
// Typing in one of these also notes when, so the number can be rolled forward later.
const STAMP = { basis: (s) => { s.profile.basisDate = today(); }, mortgageBalance: (s) => { s.profile.mortgageAsOf = today(); },
  mortgageRate: (s) => { s.profile.mortgageAsOf = s.profile.mortgageAsOf || today(); }, pensionPot: (s) => { s.profile.pensionPotYear = new Date().getFullYear(); } };
const pctText = (r) => (r * 100).toFixed(1).replace('.', ',').replace(',0', '') + '%';
const ageText = (a) => { const y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? `${y} years and ${m} month${m === 1 ? '' : 's'}` : `${y}`; };

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
      <p class="hint">Living costs without the mortgage. <span id="nowHint"></span></p>
    </div>
    <div class="lever">
      <label>How the markets go</label>
      <div class="seg" id="seg">${SCENARIOS.map((s, i) => `<button type="button" data-s="${i}">${s.name}</button>`).join('')}</div>
      <p class="hint" id="segHint"></p>
    </div>
    <details>
      <summary>Work a little after you stop?</summary>
      <div class="fields">
        <div class="field"><label for="side">Income per month after tax</label><input type="number" id="side" step="500" min="0"></div>
        <div class="field"><label for="sideUntil">Until you are</label><input type="number" id="sideUntil" step="1" min="0"><small>A small income in the first years takes a lot of weight off your savings. Saved per plan.</small></div>
      </div>
    </details>
  </div>

  <div class="panel">
    <h2>Your numbers</h2>
    <details open>
      <summary>Today</summary>
      <div class="fields">
        <div class="field"><label for="birthYear">Year you were born</label><input type="number" id="birthYear" step="1"></div>
        <div class="field"><label for="portfolio">Invested today (ASK, funds, other)</label><input type="number" id="portfolio" step="1000"><small id="pfHint"></small></div>
        <div class="field"><label for="basis">Of that, what you paid in</label><input type="number" id="basis" step="1000"><small id="basisHint"></small></div>
      </div>
      <p class="hint">Pay and living costs today are on the <a href="#/budget">Budget page</a>.</p>
    </details>
    <details>
      <summary>Mortgage</summary>
      <div class="fields">
        <div class="field"><label for="mortgagePayment">Payment per month</label><input type="number" id="mortgagePayment" step="100" min="0"></div>
        <div class="field"><label for="mortgageBalance">What you still owe</label><input type="number" id="mortgageBalance" step="10000" min="0"></div>
        <div class="field"><label for="mortgageRate">Interest rate, %</label><input type="number" id="mortgageRate" step="0.05" min="0" max="30"><small>With what you owe and the rate, the dashboard works out when the loan is gone and what it means for tax.</small></div>
        <div class="field"><label for="mortgageEndYear">Year it is paid off</label><input type="number" id="mortgageEndYear" step="1"><small id="mortHint"></small></div>
      </div>
    </details>
    <details>
      <summary>Pension</summary>
      <div class="fields">
        <div class="field"><label for="pensionPot">Your pension pot at NAV</label><input type="number" id="pensionPot" step="10000" min="0"><small>Log in at nav.no and open "Din pensjonsopptjening". Copy the amount under "Din pensjonsbeholdning i folketrygden".</small></div>
        <div class="field"><label for="grossPay">Your pay before tax, per year</label><input type="number" id="grossPay" step="10000" min="0"><small>Each year you work adds 18.1% of this to the pot. Pay above ${kr(Math.round(LAW.accrualCap * LAW.Gavg / 1000) * 1000)} does not count.</small></div>
        <div class="field"><label for="workPot">Pension saved through employers</label><input type="number" id="workPot" step="10000" min="0"><small>Log in at norskpensjon.no and add up the balances. Optional.</small></div>
        <div class="field"><label for="workRate">Your employer pays in, % of pay</label><input type="number" id="workRate" step="0.5" min="0" max="25.1"><small>At least 2% by law. Stops when you stop working.</small></div>
      </div>
      <div class="note info" id="pensionNote"></div>
      <div class="fields">
        <div class="field"><label for="pension">Or type a figure: pension per year after tax</label><input type="number" id="pension" step="5000" min="0"><small id="typedHint"></small></div>
      </div>
    </details>
    <details>
      <summary>Fine print</summary>
      <div class="fields">
        <div class="field"><label for="horizon">Money must last until age</label><input type="number" id="horizon" step="1"><small>Many people now in their forties will live past 95. After this age you would live on your pension alone.</small></div>
        <div class="field"><label for="crash">Extra test: market fall the year you stop, %</label><input type="number" id="crash" step="5" min="0" max="80"><small>Leave at 0. The answer already tests a bad first ten years, which is about as hard as a fall of 40. Saved per plan.</small></div>
        <div class="field"><label for="otherWealth">Other taxable wealth</label><input type="number" id="otherWealth" step="50000"><small id="wealthHint"></small></div>
        <div class="field"><label for="norwayYears">Years lived in Norway between age 16 and 66</label><input type="number" id="norwayYears" step="1" min="0" max="51"><small>Count up to the year you turn 66. 40 or more gives the full guarantee pension.</small></div>
        <label class="check"><input type="checkbox" id="couple"> I am married or have a registered partner, and these numbers are for both of us<small>Spouses share a doubled wealth tax allowance, and the guarantee pension is a little lower.</small></label>
      </div>
      <p class="hint">Rules for ${LAW.year}${LAW.status === 'proposed' ? ' (as proposed, not yet passed)' : ''}: ${(LAW.gainsTax * 100).toFixed(2)}% tax on gains you take out, after your own deposits. Wealth tax ${LAW.wealthRate * 100}% above ${kr(LAW.wealthFree)}, with funds counted at ${LAW.wealthShare * 100}% and your home at ${LAW.homeShare * 100}%.</p>
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
    <div class="key"><span><i style="background:var(--accent)"></i>If the first ten years are bad</span><span><i class="dash"></i>With steady growth</span></div>
    <div class="scroll"><table id="ageTable" style="margin-top:10px"></table></div>
  </div>
  <div class="panel">
    <h2>Your investments over time with this plan</h2>
    <svg id="c2" role="img" aria-label="Portfolio value by age"></svg>
    <div class="key"><span><i style="background:var(--accent)"></i>If the first ten years are bad</span><span><i class="dash"></i>With steady growth</span></div>
    <p class="hint" id="c2Hint"></p>
    <details id="yearsBox">
      <summary>Year by year</summary>
      <div class="row" style="margin:10px 0"><select id="yearsCase" aria-label="Which case to show"><option value="1">If the first ten years are bad</option><option value="0">With steady growth</option></select></div>
      <div class="scroll"><table id="years"></table></div>
      <p class="hint">Everything in today's kroner. "Taken out" is what leaves your investments that year: living costs and mortgage, less pension and other income, plus the two taxes.</p>
    </details>
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
    PROFILE_FIELDS.forEach((k) => { $(k).value = s.profile[k]; });
    $('couple').checked = !!s.profile.couple;
    $('planSel').innerHTML = s.plans.map((p) => `<option value="${esc(p.id)}"${p.id === pl.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    $('planDel').disabled = s.plans.length < 2;
  }

  // Numbers that the dashboard works out when it can: shown in the box, greyed, with a line saying where they come from.
  function derived() {
    const s = store.get(), pr = s.profile, snap = store.latestSnapshot(s), typing = document.activeElement;
    const show = (id, on, value) => { const el = $(id); el.disabled = on; if (on && el !== typing) el.value = Math.round(value); else if (!on && el !== typing && el.value !== String(pr[id])) el.value = pr[id]; };
    show('portfolio', !!snap, store.currentPortfolio(s));
    $('pfHint').textContent = snap ? `Taken from your net worth entry of ${dmy(snap.date)}.` : 'Add a net worth entry and this follows it automatically.';
    const basis = store.currentBasis(s), added = basis - pr.basis;
    $('basisHint').textContent = added > 0 ? `You get this back tax-free. With the ${kr(added)} you have paid in since, according to your net worth entries, it is ${kr(basis)}.`
      : 'You get this back tax-free. Only the growth is taxed.';
    const m = store.mortgageNow(s);
    const worked = pr.mortgageBalance > 0 && pr.mortgagePayment > 0;
    show('mortgageEndYear', worked, new Date().getFullYear() + m.yearsLeft);
    $('mortHint').textContent = !worked ? 'After that, the payment is invested instead while you still work.'
      : m.never ? 'At this rate your payment does not cover the interest, so the loan never ends. Check the three numbers above.'
      : m.yearsLeft > 40 ? `At this pace the loan takes ${m.yearsLeft} years. Almost all of the payment is interest. Check that the payment includes the repayment, not only the interest.`
      : `Worked out from what you owe, the rate and the payment. After that, the payment is invested instead while you still work.`;
    const parts = store.wealthParts(s);
    show('otherWealth', !!parts, parts ? taxableWealth({ ...parts, funds: 0 }) : 0);
    $('wealthHint').textContent = parts ? `Worked out from your net worth entry: home at ${LAW.homeShare * 100}%, bank and car in full, less debt. It follows your mortgage as it is paid down.`
      : `Home at ${LAW.homeShare * 100}% of its value, plus bank deposits, minus debt. From your tax return. Add a net worth entry and this is worked out for you.`;
  }

  function results() {
    const s = store.get(), pl = plan(), pr = s.profile;
    const p = store.planInputs(s, pl), bad = { ...p, slow: 1 }, r = SCENARIOS[pl.scen].r;
    const retAge = Math.max(p.age, pl.retAge);
    const cache = new Map();
    const can = (q, a) => { const k = (q.slow ? 'b' : 's') + a; if (!cache.has(k)) cache.set(k, maxSpend(q, r, a, pl.invest)); return cache.get(k); };
    const steady = can(p, retAge), hard = can(bad, retAge);
    const verdict = pl.spend <= hard ? 'safe' : pl.spend <= steady ? 'steady' : 'short';
    const A = $('answer'); A.className = 'panel answer ' + (verdict === 'safe' ? 'ok' : verdict === 'steady' ? 'warn' : 'short');
    let h = '';
    if (verdict === 'safe') {
      h += `<p class="big">Stop working at ${retAge} and your money lasts to ${p.horizon}, even if the first ten years are bad.</p>`;
      h += `<p>You plan to live on ${kr(pl.spend)} a month. Even with a bad start you could live on up to <b class="num">${kr(round500(hard))}</b>, <span class="gap num">${kr(round500(hard - pl.spend))} more</span>. With steady growth, up to ${kr(round500(steady))}.</p>`;
      const need = needInvest(bad, r, retAge, pl.spend);
      if (need !== null && up500(need) < pl.invest) h += `<ul class="ways"><li>You would still get there investing <b class="num">${kr(up500(need))}</b> a month instead of ${kr(pl.invest)}.</li></ul>`;
    } else {
      const out = simulate(verdict === 'steady' ? bad : p, r, retAge, pl.spend, pl.invest).runsOut;
      h += verdict === 'steady'
        ? `<p class="big">Stop working at ${retAge} and your money lasts to ${p.horizon} if markets grow steadily, but not if the first ten years are bad.</p>
           <p>With a bad start, living on ${kr(pl.spend)} a month would empty your savings when you are ${out}. You could live on <b class="num">${kr(round500(hard))}</b> a month and be safe either way, which is <span class="gap num">${kr(round500(pl.spend - hard))} less</span> than you plan.</p>`
        : `<p class="big">Stop working at ${retAge} and the money runs out when you are ${out}, even with steady growth.</p>
           <p>You want ${kr(pl.spend)} a month. With steady growth you could live on ${kr(round500(steady))}, and <b class="num">${kr(round500(hard))}</b> if the first ten years are bad: <span class="gap num">${kr(round500(pl.spend - hard))} short</span>.</p>`;
      const need = needInvest(bad, r, retAge, pl.spend), ea = earliestAge(bad, r, pl.spend, pl.invest);
      h += `<p>Three ways to make it hold through a bad start:</p><ul class="ways">`;
      h += need === null ? `<li>Investing more alone cannot do it by ${retAge}.</li>` : `<li>Invest <b class="num">${kr(up500(need))}</b> a month instead of ${kr(pl.invest)}.</li>`;
      h += ea === null ? `<li>Working longer alone does not get you there before 85.</li>` : `<li>Work until you are <b>${ea}</b> instead of ${retAge}.</li>`;
      h += `<li>Live on <b class="num">${kr(round500(hard))}</b> a month after you stop.</li></ul>`;
    }
    h += `<div class="range"><span>A bad first ten years: savings lose ${pctText(-SLOW.r)} a year to prices for ${SLOW.years} years, then grow as you chose.</span></div>`;
    const pen = pensionFor(p, retAge);
    if (pen.net > 0) h += `<p class="status" style="margin-top:8px">Your pension from age ${ageText(Math.max(pen.start, retAge))}: about ${kr(round500(pen.net / 12))} a month after tax. It goes on for life, also after ${p.horizon}.</p>`;
    else h += `<div class="note warn">Pension is set to 0, so this is too gloomy. Add your pension pot under "Pension".</div>`;
    if (retAge < 62 && retAge > p.age) h += `<div class="note info">Stopping before 62 has costs that are not in these numbers: no AFP if your employer has it, no sick pay or unemployment benefit, and a lower disability benefit after a few years. <a href="#/guide">Read what you give up</a>.</div>`;
    if (!store.isSaved()) h += `<div class="note warn">This browser is not saving your data. Export a file on the My data page before you close this page.</div>`;
    A.innerHTML = h;

    // month today
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
    const hardPts = [], steadyPts = [];
    for (let a = p.age + 1; a <= 75; a++) { hardPts.push({ x: a, y: can(bad, a) }); steadyPts.push({ x: a, y: can(p, a) }); }
    const ticks = []; for (let x = Math.ceil((p.age + 1) / 5) * 5; x <= 75; x += 5) ticks.push(x);
    lineChart($('c1'), [{ pts: steadyPts, color: 'var(--muted)', dash: true, name: 'with steady growth' }, { pts: hardPts, name: 'if the first ten years are bad' }],
      { h: 260, fmtY: short, fmtTipY: (v) => kr(round500(v)) + ' a month', fmtTipX: (x) => `Stop at ${x}`, ticksX: ticks, ref: pl.spend, refLabel: 'what you want', mark: retAge, dot: hardPts.find((d) => d.x === retAge) || null });
    const ages = [...new Set([50, 55, 60, 62, 65, 67, 70, retAge])].filter((a) => a > p.age && a <= 75).sort((a, b) => a - b);
    $('ageTable').innerHTML = `<tr><th>Stop at</th><th>Invested by then</th><th>Live on, bad start</th><th>Live on, steady</th></tr>` + ages.map((a) => {
      const at = simulate(p, r, a, 0, pl.invest).path.find((d) => d.age === a);
      return `<tr class="${a === retAge ? 'sel' : ''}"><td>${a}</td><td>${kr(round10k(at.balance))}</td><td>${kr(round500(can(bad, a)))}</td><td>${kr(round500(can(p, a)))}</td></tr>`;
    }).join('');

    // portfolio path, and the year-by-year rows behind it
    const resS = simulate(p, r, retAge, pl.spend, pl.invest, LAW, true), resB = simulate(bad, r, retAge, pl.spend, pl.invest, LAW, true);
    const t2 = []; for (let x = Math.ceil(p.age / 10) * 10; x <= p.horizon; x += 10) t2.push(x);
    const pts = (res) => res.path.map((d) => ({ x: d.age, y: d.balance }));
    lineChart($('c2'), [{ pts: pts(resS), color: 'var(--muted)', dash: true, name: 'with steady growth' }, { pts: pts(resB), name: 'if the first ten years are bad' }],
      { h: 240, fmtY: (v) => (v / 1e6).toFixed(1) + 'M', fmtTipY: (v) => kr(round10k(v)), fmtTipX: (x) => `Age ${x}`, ticksX: t2, mark: retAge });
    const taxed = resB.years.find((y) => y.gainsTax > 1);
    $('c2Hint').textContent = `Living on ${kr(pl.spend)} a month from ${retAge}. The thin upright line is the year you stop. `
      + (resB.runsOut !== null ? `With a bad start the savings are empty at ${resB.runsOut}. ` : '')
      + (taxed && taxed.age >= retAge ? `Until about age ${taxed.age} what you take out is money you paid in, so it is tax-free. After that about ${Math.round(LAW.gainsTax * 100)} kr of every 100 kr of growth you take out goes to tax.` : '');
    if ($('yearsBox').open) {
      const rows = ($('yearsCase').value === '1' ? resB : resS).years, k = (v) => (Math.abs(v) < 0.5 ? '' : kr(round500(v)));
      $('years').innerHTML = `<tr><th>Age</th><th>At the start</th><th>Growth</th><th>Paid in</th><th>Taken out</th><th>Pension and income</th><th>Tax on gains</th><th>Wealth tax</th><th>At the end</th></tr>`
        + rows.map((y) => `<tr class="${y.age === retAge ? 'sel' : ''}"><td>${y.age}</td><td>${kr(round10k(y.start))}</td><td>${k(y.growth)}</td><td>${k(y.paidIn)}</td><td>${k(y.out)}</td><td>${k(y.pension + y.side)}</td><td>${k(y.gainsTax)}</td><td>${k(y.wealthTax)}</td><td>${kr(round10k(y.end))}</td></tr>`).join('');
    }

    // small texts
    const usual = store.ledger(s).usual;
    $('nowHint').innerHTML = `You spend about ${kr(pr.livingNow)} today.` + (usual && round500(usual.living) !== pr.livingNow ? ` Your bank files say ${kr(round500(usual.living))}: see <a href="#/spending">Spending</a>.` : '');
    $('segHint').textContent = `Average growth of ${pctText(r)} a year above inflation, after fund costs. Real years are bumpier, which is why the answer also tests a bad first ten years.`;
    root.querySelectorAll('#seg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.s === pl.scen)));
    $('retAge_r').min = p.age + 1;

    // pension
    const helper = !!p.state, N = $('pensionNote');
    if (pr.birthYear < HELPER_FROM) N.innerHTML = `The pension pot fields are for people born in ${HELPER_FROM} or later. Type your yearly pension after tax in the box below.`;
    else if (!helper) N.innerHTML = `Type your pension pot and pay, and the dashboard works out your state pension for the age you stop, with the guarantee pension and tax. NAV's own forecast assumes you work until the pension starts, so it is too high if you stop early.`;
    else {
      const work = resS.years.find((y) => y.age === Math.ceil(pen.start));
      N.innerHTML = `If you stop at ${retAge}: state pension from age <b>${ageText(pen.start)}</b>, about <b>${kr(round500(pen.net / 12))} a month</b> after tax (${kr(round10k(pen.gross))} a year before tax).`
        + (pen.topUp > 0 ? ` ${kr(round10k(pen.topUp))} of that is the guarantee pension, which needs 40 years in Norway and can change.` : '')
        + (p.work && work ? ` Your employer pension adds about ${kr(round500(Math.max(0, work.pension - pen.net) / 12))} a month after tax for the first ten years.` : '')
        + ` The pension age for people born in ${pr.birthYear} is not decided; the law today says ${LAW.pensionAge}, and this is an estimate. Expect the amount to be up to 10% off.`;
    }
    $('typedHint').textContent = helper ? 'Not used while the pension pot above is filled in.' : `Counted from age ${ageText(p.pensionAge)}. Use a figure for the age you plan to stop: NAV's forecast assumes you work until then.`;
    $('pension').disabled = helper;

    // compare
    $('comparePanel').hidden = s.plans.length < 2;
    if (s.plans.length > 1) {
      $('compare').innerHTML = `<tr><th>Plan</th><th>Invest / month</th><th>Stop at</th><th>Want / month</th><th>Bad start</th><th>Steady</th><th>Result</th></tr>` + s.plans.map((q) => {
        const qp = store.planInputs(s, q), qr = SCENARIOS[q.scen].r, qa = Math.max(qp.age, q.retAge);
        const cs = maxSpend(qp, qr, qa, q.invest), cb = maxSpend({ ...qp, slow: 1 }, qr, qa, q.invest);
        const result = q.spend <= cb ? 'Holds through a bad start' : q.spend <= cs ? 'Holds if growth is steady' : kr(round500(q.spend - cs)) + ' short';
        return `<tr class="${q.id === pl.id ? 'sel' : ''}"><td>${esc(q.name)} (${SCENARIOS[q.scen].name.toLowerCase()})</td><td>${kr(q.invest)}</td><td>${qa}</td><td>${kr(q.spend)}</td><td>${kr(round500(cb))}</td><td>${kr(round500(cs))}</td><td>${result}</td></tr>`;
      }).join('');
    }
    derived();
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
    if (isFinite(v)) store.update((s) => { s.profile[k] = v; if (STAMP[k]) STAMP[k](s); });
  }));
  $('couple').addEventListener('change', (e) => store.update((s) => { s.profile.couple = e.target.checked ? 1 : 0; }));
  root.querySelectorAll('#seg button').forEach((b) => b.addEventListener('click', () => store.update((s) => { store.activePlan(s).scen = +b.dataset.s; })));
  $('yearsBox').addEventListener('toggle', results);
  $('yearsCase').addEventListener('change', results);
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
