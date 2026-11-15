// Guide page: money in Norway in plain words. The order to do things in, how savings and pension
// are taxed, what stopping early costs, and the money year. Amounts come from law.js; sources are in README.md.
import * as store from '../store.js';
import { LAW, SLOW } from '../model.js';
import { BENCHMARKS } from '../law.js';
import { checklist, CALENDAR } from '../guide.js';
import { kr, today, esc } from '../format.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pct = (v, d = 0) => (v * 100).toFixed(d).replace('.', ',') + '%';
const mill = (v) => (v / 1e6).toLocaleString('nb-NO', { maximumFractionDigits: 2 }) + ' million kr';
const out = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
const freeGain = Math.round(LAW.personAllowance / LAW.grossUp / 100) * 100;
const cap = Math.round((LAW.accrualCap * LAW.Gavg) / 1000) * 1000;

const HTML = `
<h1>Guide</h1>
<div class="panel">
  <h2>The order to do things in</h2>
  <p>Norwegian consumer advisers agree on roughly this order for spare money. Tick what you have in place. A grey tick means your own numbers already show it.</p>
  <div id="steps"></div>
</div>

<div class="panel prose">
  <h2>How your savings are taxed</h2>
  <h3>Aksjesparekonto (ASK)</h3>
  <p>An ASK is an account for funds and shares. You can buy and sell inside it without paying tax along the way. What you paid in can be taken out at any time, tax-free. Only when you have taken out everything you paid in do you start paying tax, and then on the growth: <b>${pct(LAW.gainsTax, 2)}</b>.</p>
  <p>That order is good news if you stop working early: the tax-free money comes out first, in the years before your pension. In a year with no pay and no pension, about the first <b>${kr(freeGain)}</b> of growth you take out is tax-free too, because everyone has a personal allowance (${kr(LAW.personAllowance)}).</p>
  <p>Funds held outside an ASK work differently: each sale is taxed on its own share of growth. Moving an ASK to another bank is tax-free if the new bank does the move. Closing it yourself is not.</p>
  <h3>Wealth tax</h3>
  <p>Each year you pay <b>${pct(LAW.wealthRate, 1)}</b> of what you own above <b>${mill(LAW.wealthFree)}</b> (${mill(2 * LAW.wealthFree)} for spouses together), and ${pct(LAW.wealthHighRate, 1)} above ${mill(LAW.wealthHighFrom)}. Not everything counts in full: funds and shares count at ${pct(LAW.wealthShare)}, the home you live in at ${pct(LAW.homeShare)} of its value (up to ${mill(LAW.homeHighFrom)}), bank deposits in full. Debt is subtracted. So a home owner with a mortgage usually pays little until the investments grow large, and the tax rises as the mortgage is paid down. The Plan page counts this year by year.</p>
  <h3>Loans and pension saving</h3>
  <p>Interest you pay on loans gives ${pct(LAW.incomeTax)} back on your tax, so a loan at 5% really costs 3,9%. Money in IPS (up to ${kr(LAW.ipsLimit)} a year) gives ${pct(LAW.incomeTax)} back now, has no wealth tax, and is taxed ${pct(LAW.incomeTax)} when it is paid out from age 62 at the earliest.</p>
  <p class="status">Rules for ${LAW.year}${LAW.status === 'proposed' ? ', as proposed by the government and not yet passed' : ''}. A tax commission proposed in 2026 to change how wealth is taxed; the rules here are updated once a year.</p>
</div>

<div class="panel prose">
  <h2>Your pension, in three parts</h2>
  <h3>1. The state pension</h3>
  <p>Every year you work, ${pct(LAW.accrual, 1)} of your pay (up to ${kr(cap)}) is added to a pension pot at NAV. When you start the pension, the pot is spread over the years you are expected to live. You see the pot at ${out('https://www.nav.no/pensjon/opptjening', 'nav.no, "Din pensjonsopptjening"')}.</p>
  <p>If the pot gives little, the <b>guarantee pension</b> tops it up: nobody who has lived in Norway for 40 years between 16 and 66 gets less than about ${kr(LAW.guarantee.ordinary)} a year (${kr(LAW.guarantee.high)} living alone). This is why stopping work ten years early lowers the state pension less than you might fear. Up to about ${kr(LAW.pensionCredit.from1)} a year, a pension is not taxed.</p>
  <p>The pension age is ${LAW.pensionAge} in the law today. Parliament agreed in 2024 to raise it by about one month for each birth year after 1963, so someone born in 1985 should count on almost 69. It is not law yet. The Plan page uses the later age, to be on the safe side.</p>
  <p>NAV's own forecast assumes you keep working until the pension starts. If you plan to stop early, use the pension pot on the Plan page instead.</p>
  <h3>2. Pension from your employers</h3>
  <p>Your employer must save at least 2% of your pay for you; many save more. The money is yours when you leave, it stays invested, and it is paid out from 62 at the earliest, over at least ten years. See all of it at ${out('https://www.norskpensjon.no/', 'norskpensjon.no')}, and check what you pay in fees.</p>
  <h3>3. AFP</h3>
  <p>Many private employers with a wage agreement have AFP, a lifelong addition that was about 64 000 kr a year on average for those who started it in 2025. You only get it if you still work there when you turn 62, and have done for seven of the nine years before. <b>Leave before 62 and you get nothing.</b></p>
</div>

<div class="panel prose">
  <h2>What you give up when you stop working early</h2>
  <ul class="plain">
    <li><b>Pension earning stops.</b> No more is added to your pot at NAV, and your employer stops saving for you. What you have earned stays and follows wage growth.</li>
    <li><b>AFP is lost</b> if your employer has it and you leave before 62.</li>
    <li><b>Sick pay ends.</b> It needs a job. So does holiday pay.</li>
    <li><b>Unemployment benefit is not a bridge.</b> It is for people who are looking for work, and resigning gives nothing for the first 18 weeks.</li>
    <li><b>Disability benefit shrinks.</b> It is based on your pay in the last five years. A few years after you stop, it is paid at the minimum, about ${kr(Math.round((2.329 * LAW.G) / 1000) * 1000)} to ${kr(Math.round((2.529 * LAW.G) / 1000) * 1000)} a year before tax, whatever you earned before. Insurance through your employer ends too.</li>
  </ul>
  <p>What you keep: health care, your earned pension, the guarantee pension, and your membership in the national insurance scheme, as long as you live in Norway. If someone depends on your income, look at disability and life insurance before you stop.</p>
</div>

<div class="panel prose">
  <h2>Why the plan tests a bad first ten years</h2>
  <p>Funds do not grow evenly. If prices fall in the first years after you stop, you have to sell more shares to cover the same costs, and those shares are gone when prices recover. Studies of 150 years of markets find that what decides whether savings last is mostly the first ten years, far more than the long-run average.</p>
  <p>That is why the answer on the Plan page comes in two versions. "Steady growth" is what is likely on average. "A bad first ten years" (your savings lose ${pct(-SLOW.r)} a year to prices for ${SLOW.years} years, then grow normally) is about what happened to people who stopped in 1929, 1966, 1972 or 2000. A plan that holds through that is a plan you can trust.</p>
  <p>You may have heard that you can take out 4% of your savings a year. That figure comes from 30-year periods in the United States, before tax. Over 40 to 50 years the same studies land on 3 to 3,5%, and Norwegian tax takes more. The plan does this sum for you, with your pension, tax and mortgage in it.</p>
  <p>Three things help most, and you can try each on the Plan page: living on a little less, working a little after you stop, and stopping a year or two later.</p>
  <h3>Keep the costs of your funds low</h3>
  <p>The same global index fund costs about 0,2% a year at the cheapest seller and 0,6% at the dearest. The growth in the plan assumes the cheap end. ${out('https://www.forbrukerradet.no/finansportalen/', 'Finansportalen')} from the Consumer Council compares prices of funds, loans, savings accounts and pension accounts.</p>
</div>

<div class="panel prose">
  <h2>What is normal to spend?</h2>
  <p>The research institute SIFO publishes a reference budget each year: what a reasonable, ordinary level of spending costs. For ${BENCHMARKS.year} it is about <b>${kr(BENCHMARKS.single)}</b> a month for a single adult, <b>${kr(BENCHMARKS.coupleCar)}</b> for a couple with a car, and <b>${kr(BENCHMARKS.familyCar)}</b> for two adults and two children with a car.</p>
  <p>It leaves out housing, electricity, holidays, eating out, gifts and most insurance, so add those before you compare with your own living costs. ${out('https://www.oslomet.no/om/sifo/referansebudsjettet', 'Try the calculator for your household')}.</p>
</div>

<div class="panel">
  <h2>The money year</h2>
  <div class="scroll"><table class="wrapall" id="year"></table></div>
</div>

<div class="panel prose">
  <h2>Words</h2>
  <dl>
    <dt>ASK, aksjesparekonto</dt><dd>An account for funds and shares where tax waits until you take out more than you paid in.</dd>
    <dt>Index fund</dt><dd>A fund that owns a little of every company in a market, at low cost. A global index fund owns thousands of companies across the world.</dd>
    <dt>IPS</dt><dd>Individual pension saving. Tax deduction now, locked until 62.</dd>
    <dt>BSU</dt><dd>Home saving for people up to 33 who do not own a home. Not for home owners.</dd>
    <dt>G, grunnbeløpet</dt><dd>A yardstick amount that many benefits and limits are counted in. It is ${kr(LAW.G)} and changes each May.</dd>
    <dt>Formuesskatt</dt><dd>Wealth tax: a yearly tax on what you own above an allowance.</dd>
    <dt>Skjermingsfradrag</dt><dd>A small part of the growth in your funds that is tax-free each year, set from the interest rate.</dd>
    <dt>Skattekort</dt><dd>Tax card: tells your employer how much tax to take from your pay. You can change it yourself at any time.</dd>
    <dt>Skattemelding</dt><dd>The yearly tax return. It arrives filled in; you check it and send it by 30 April.</dd>
    <dt>Restskatt</dt><dd>Tax you owe when too little was taken during the year.</dd>
    <dt>Feriepenger</dt><dd>Holiday pay: earned last year, paid in June in place of ordinary pay for your holiday weeks.</dd>
    <dt>Pensjonsbeholdning</dt><dd>Your pension pot at NAV.</dd>
    <dt>Garantipensjon</dt><dd>The floor under the state pension for people who have earned little.</dd>
    <dt>AFP</dt><dd>An extra lifelong pension in many workplaces, only for those who work there until 62.</dd>
  </dl>
  <p class="status">This page explains rules; it is not personal financial or tax advice. Check ${out('https://www.skatteetaten.no/', 'skatteetaten.no')} and ${out('https://www.nav.no/', 'nav.no')} for your own case.</p>
</div>`;

export function mount(root) {
  root.innerHTML = HTML;
  const $ = (id) => root.querySelector('#' + id);
  const now = +today().slice(5, 7);
  $('year').innerHTML = `<tr><th>Month</th><th>What happens</th><th>What to do</th></tr>`
    + MONTHS.map((name, i) => `<tr class="${i + 1 === now ? 'sel' : ''}"><td>${name}</td><td>${CALENDAR[i + 1].happens}</td><td>${CALENDAR[i + 1].todo}</td></tr>`).join('');

  function render() {
    $('steps').innerHTML = checklist(store.get()).map((c, i) => `<label class="step${c.done || c.shown ? ' done' : ''}">
      <input type="checkbox" data-step="${esc(c.id)}"${c.done || c.shown ? ' checked' : ''}${c.shown && !c.done ? ' disabled' : ''}>
      <span><b>${i + 1}. ${c.title}</b><small>${c.why}</small></span></label>`).join('');
  }
  $('steps').addEventListener('change', (e) => {
    const id = e.target.dataset.step;
    if (!id) return;
    store.update((s) => { if (e.target.checked) s.done[id] = today(); else delete s.done[id]; });
  });
  render();
  return { update: render };
}
