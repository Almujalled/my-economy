// Small dependency-free SVG charts. Both show the exact numbers when you point at them,
// tap them, or move through them with the arrow keys, and both redraw to fit a narrow screen.
// Labels passed in are put into the SVG as markup: pass text the app made, never text a file or a person supplied.
//
// lineChart(svg, series, opts)
//   series: [{ pts:[{x,y}], color:'var(--accent)', name:'Net worth', dash:true }]
//   opts: { h, fmtY, fmtX, ticksX:[x], ref, refLabel, mark, dot:{x,y}, fmtTipX, fmtTipY }
// barChart(svg, bars, opts)
//   bars: [{ key, label, title, value }]   one column each, in order
//   opts: { h, fmtY, fmtTip, ref, refLabel, selected:key, onPick(key) }
const L = 52, R = 12, T = 14, B = 30;

// Draw at the size the chart has on screen (up to 640 wide), so text stays readable on a phone.
function frame(svg, h, redraw) {
  const W = Math.max(280, Math.min(640, Math.round(svg.clientWidth || 640)));
  svg.setAttribute('viewBox', `0 0 ${W} ${h}`);
  svg._redraw = redraw;
  svg._w = W;
  wire(svg);
  return W;
}
const sizes = typeof ResizeObserver === 'function' ? new ResizeObserver((entries) => {
  for (const e of entries) {
    const svg = e.target, W = Math.max(280, Math.min(640, Math.round(e.contentRect.width || 640)));
    if (svg._redraw && W !== svg._w && svg.isConnected) svg._redraw();
  }
}) : null;

// One shared readout box. Text goes in with textContent, never as HTML.
let tipEl = null;
function tipBox() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
    window.addEventListener('scroll', hideTip, { passive: true });
    window.addEventListener('hashchange', hideTip);
  }
  return tipEl;
}
function hideTip() { if (tipEl) tipEl.hidden = true; }
function showTip(svg, vx, vy, title, rows) {
  const t = tipBox();
  t.textContent = '';
  const head = document.createElement('div');
  head.className = 'tip-h';
  head.textContent = title;
  t.appendChild(head);
  for (const r of rows) {
    const line = document.createElement('div');
    if (r.color) { const key = document.createElement('i'); key.style.background = r.color; line.appendChild(key); }
    const val = document.createElement('b');
    val.textContent = r.value;
    line.appendChild(val);
    if (r.name) line.appendChild(document.createTextNode(' ' + r.name));
    t.appendChild(line);
  }
  t.hidden = false;
  const box = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
  const cx = box.left + (vx / vb.width) * box.width, cy = box.top + (vy / vb.height) * box.height;
  let left = cx + 12;
  if (left + t.offsetWidth > window.innerWidth - 8) left = cx - t.offsetWidth - 12;
  t.style.left = Math.max(8, left) + 'px';
  t.style.top = Math.max(8, cy - t.offsetHeight - 10) + 'px';
}

// Pointer and keyboard handling is the same for both charts: the chart supplies the positions
// (in viewBox units) and what to show at each.
function wire(svg) {
  if (svg._wired) return;
  svg._wired = true;
  svg.setAttribute('tabindex', '0');
  if (sizes) sizes.observe(svg);
  const at = (i) => { const c = svg._chart; if (!c || !c.stops.length) return; c.i = Math.max(0, Math.min(c.stops.length - 1, i)); c.show(c.i); };
  const nearest = (e) => {
    const c = svg._chart;
    if (!c || !c.stops.length) return -1;
    const box = svg.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * svg._w;
    let best = 0;
    c.stops.forEach((s, i) => { if (Math.abs(s - vx) < Math.abs(c.stops[best] - vx)) best = i; });
    return best;
  };
  const leave = () => { hideTip(); if (svg._chart) svg._chart.clear(); };
  svg.addEventListener('pointermove', (e) => { const i = nearest(e); if (i >= 0) at(i); });
  svg.addEventListener('pointerdown', (e) => { const i = nearest(e); if (i >= 0) at(i); });
  svg.addEventListener('pointerleave', leave);
  svg.addEventListener('blur', leave);
  svg.addEventListener('focus', () => { const c = svg._chart; if (c && svg.matches(':focus-visible')) at(c.i ?? c.start); });
  svg.addEventListener('click', (e) => { const c = svg._chart, i = nearest(e); if (c && c.pick && i >= 0) { hideTip(); c.pick(i); } });
  svg.addEventListener('keydown', (e) => {
    const c = svg._chart;
    if (!c) return;
    const i = c.i ?? c.start;
    if (e.key === 'ArrowLeft') { at(i - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { at(i + 1); e.preventDefault(); }
    else if (e.key === 'Home') { at(0); e.preventDefault(); }
    else if (e.key === 'End') { at(c.stops.length - 1); e.preventDefault(); }
    else if ((e.key === 'Enter' || e.key === ' ') && c.pick) { c.pick(i); e.preventDefault(); }
    else if (e.key === 'Escape') leave();
  });
}

// Axis steps are round numbers: 1, 2, 2.5 or 5 times a power of ten. Returns the top of the axis and the step.
function axis(top) {
  const raw = top / 5, pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((v) => v >= raw);
  return { step, yMax: step * Math.max(1, Math.ceil(top / step - 1e-9)) };
}
function grid(W, ax, Y, fmtY) {
  let h = '';
  for (let y = 0; y <= ax.yMax + ax.step / 2; y += ax.step) {
    h += `<line x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}" stroke="var(--line)"/><text x="${L - 8}" y="${Y(y) + 4}" text-anchor="end">${fmtY(y)}</text>`;
  }
  return h;
}
const refLine = (W, y, label) => `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--warn)" stroke-width="2" stroke-dasharray="6 5"/><text x="${W - R}" y="${y - 6}" text-anchor="end" style="fill:var(--warn)">${label || ''}</text>`;

export function lineChart(svg, series, opts = {}) {
  const H = opts.h || 240, W = frame(svg, H, () => lineChart(svg, series, opts));
  const all = series.flatMap((s) => s.pts);
  if (!all.length) { svg.innerHTML = ''; svg._chart = null; return; }
  const x0 = Math.min(...all.map((d) => d.x)), x1 = Math.max(...all.map((d) => d.x));
  const ax = axis(Math.max(1, ...all.map((d) => d.y), opts.ref || 0) * 1.03), yMax = ax.yMax;
  const X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (y) => T + (1 - y / yMax) * (H - T - B);
  const fmtY = opts.fmtY || ((v) => Math.round(v));
  const fmtX = opts.fmtX || ((v) => v);
  let h = grid(W, ax, Y, fmtY);
  // On a narrow chart, drop every other label rather than let them collide.
  let ticks = (opts.ticksX || []).filter((x) => x >= x0 && x <= x1);
  while (ticks.length > 2 && (W - L - R) / ticks.length < 48) ticks = ticks.filter((_, i) => i % 2 === 0);
  for (const x of ticks) h += `<text x="${X(x)}" y="${H - 8}" text-anchor="${x === x1 ? 'end' : x === x0 ? 'start' : 'middle'}">${fmtX(x)}</text>`;
  if (opts.ref) h += refLine(W, Y(opts.ref), opts.refLabel);
  if (opts.mark != null && opts.mark >= x0 && opts.mark <= x1) h += `<line x1="${X(opts.mark)}" x2="${X(opts.mark)}" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="3 4"/>`;
  for (const s of series) {
    const color = s.color || 'var(--accent)';
    if (s.pts.length === 1) { h += `<circle cx="${X(s.pts[0].x)}" cy="${Y(s.pts[0].y)}" r="5" fill="${color}"/>`; continue; }
    const d = s.pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
    h += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${s.dash ? 2 : 3}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="2 6"' : ''}/>`;
  }
  if (opts.dot) h += `<circle cx="${X(opts.dot.x)}" cy="${Y(opts.dot.y)}" r="6" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
  h += `<g class="hover" visibility="hidden"><line y1="${T}" y2="${H - B}" stroke="var(--muted)"/>${series.map((s) => `<circle r="5" fill="${s.color || 'var(--accent)'}" stroke="var(--surface)" stroke-width="2"/>`).join('')}</g>`;
  svg.innerHTML = h;

  const xs = [...new Set(all.map((d) => d.x))].sort((a, b) => a - b);
  const fmtTipX = opts.fmtTipX || fmtX, fmtTipY = opts.fmtTipY || fmtY;
  const hover = svg.querySelector('.hover');
  const startAt = opts.mark != null ? xs.findIndex((x) => x >= opts.mark) : xs.length - 1;
  svg._chart = {
    stops: xs.map(X), start: Math.max(0, startAt), i: null,
    clear() { hover.setAttribute('visibility', 'hidden'); this.i = null; },
    show(i) {
      const x = xs[i], rows = [];
      let top = H;
      hover.setAttribute('visibility', 'visible');
      hover.firstChild.setAttribute('x1', X(x)); hover.firstChild.setAttribute('x2', X(x));
      series.forEach((s, k) => {
        const p = s.pts.find((d) => d.x === x), c = hover.children[k + 1];
        c.setAttribute('visibility', p ? 'inherit' : 'hidden');
        if (!p) return;
        c.setAttribute('cx', X(x)); c.setAttribute('cy', Y(p.y));
        top = Math.min(top, Y(p.y));
        rows.push({ color: s.color || 'var(--accent)', value: fmtTipY(p.y), name: s.name || '' });
      });
      showTip(svg, X(x), top, fmtTipX(x), rows);
    },
  };
}

export function barChart(svg, bars, opts = {}) {
  const H = opts.h || 220, W = frame(svg, H, () => barChart(svg, bars, opts));
  if (!bars.length) { svg.innerHTML = ''; svg._chart = null; return; }
  const ax = axis(Math.max(1, ...bars.map((b) => b.value), opts.ref || 0) * 1.03), yMax = ax.yMax;
  const Y = (y) => T + (1 - y / yMax) * (H - T - B);
  const fmtY = opts.fmtY || ((v) => Math.round(v));
  const band = (W - L - R) / bars.length, thick = Math.max(2, Math.min(24, band - 2));
  const mid = (i) => L + band * (i + 0.5);
  const every = Math.max(1, Math.ceil(46 / band));
  const picked = opts.selected != null && bars.some((b) => b.key === opts.selected);
  let h = grid(W, ax, Y, fmtY);
  bars.forEach((b, i) => {
    const x = mid(i) - thick / 2, top = Y(Math.max(0, b.value)), base = Y(0), r = Math.min(4, thick / 2, Math.max(0, base - top));
    const faded = picked && b.key !== opts.selected;
    // Rounded at the top, square where the column meets the baseline.
    if (base - top > 0.5) h += `<path d="M${x} ${base}V${top + r}q0 ${-r} ${r} ${-r}h${thick - 2 * r}q${r} 0 ${r} ${r}V${base}z" fill="var(--accent)"${faded ? ' opacity=".4"' : ''}/>`;
    const labelled = picked ? b.key === opts.selected || (i % every === 0 && Math.abs(i - bars.findIndex((q) => q.key === opts.selected)) >= every) : i % every === 0;
    if (labelled) h += `<text x="${mid(i)}" y="${H - 8}" text-anchor="middle"${b.key === opts.selected ? ' style="fill:var(--ink);font-weight:650"' : ''}>${b.label}</text>`;
  });
  if (opts.ref) h += refLine(W, Y(opts.ref), opts.refLabel);
  h += `<rect class="hover" visibility="hidden" y="${T}" width="${band}" height="${H - T - B}" fill="var(--ink)" opacity=".07"/>`;
  svg.innerHTML = h;
  svg.style.cursor = opts.onPick ? 'pointer' : '';

  const hover = svg.querySelector('.hover');
  const fmtTip = opts.fmtTip || ((b) => fmtY(b.value));
  const sel = bars.findIndex((b) => b.key === opts.selected);
  svg._chart = {
    stops: bars.map((_, i) => mid(i)), start: sel >= 0 ? sel : bars.length - 1, i: null,
    clear() { hover.setAttribute('visibility', 'hidden'); this.i = null; },
    show(i) {
      hover.setAttribute('visibility', 'visible');
      hover.setAttribute('x', L + band * i);
      showTip(svg, mid(i), Y(Math.max(0, bars[i].value)), bars[i].title || bars[i].label, [{ value: fmtTip(bars[i]) }]);
    },
    pick: opts.onPick ? (i) => opts.onPick(bars[i].key) : null,
  };
}
