// Small dependency-free SVG line chart.
// series: [{ pts:[{x,y}], color:'var(--accent)' }]
// opts: { h, fmtY, ticksX:[x], fmtX, ref, refLabel, mark, dot:{x,y} }
export function lineChart(svg, series, opts = {}) {
  const W = 640, H = opts.h || 240, L = 58, R = 14, T = 14, B = 30;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const all = series.flatMap((s) => s.pts);
  if (!all.length) { svg.innerHTML = ''; return; }
  const x0 = Math.min(...all.map((d) => d.x)), x1 = Math.max(...all.map((d) => d.x));
  const yMax = Math.max(1, ...all.map((d) => d.y), opts.ref || 0) * 1.08;
  const X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (y) => T + (1 - y / yMax) * (H - T - B);
  const fmtY = opts.fmtY || ((v) => Math.round(v));
  const fmtX = opts.fmtX || ((v) => v);
  let h = '';
  for (let i = 0; i <= 4; i++) {
    const y = (yMax * i) / 4;
    h += `<line x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}" stroke="var(--line)"/><text x="${L - 8}" y="${Y(y) + 4}" text-anchor="end">${fmtY(y)}</text>`;
  }
  for (const x of opts.ticksX || []) if (x >= x0 && x <= x1) h += `<text x="${X(x)}" y="${H - 8}" text-anchor="${x === x1 ? 'end' : x === x0 ? 'start' : 'middle'}">${fmtX(x)}</text>`;
  if (opts.ref) h += `<line x1="${L}" x2="${W - R}" y1="${Y(opts.ref)}" y2="${Y(opts.ref)}" stroke="var(--warn)" stroke-width="2" stroke-dasharray="6 5"/><text x="${W - R}" y="${Y(opts.ref) - 6}" text-anchor="end" style="fill:var(--warn)">${opts.refLabel || ''}</text>`;
  if (opts.mark != null && opts.mark >= x0 && opts.mark <= x1) h += `<line x1="${X(opts.mark)}" x2="${X(opts.mark)}" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="3 4"/>`;
  for (const s of series) {
    if (s.pts.length === 1) { h += `<circle cx="${X(s.pts[0].x)}" cy="${Y(s.pts[0].y)}" r="5" fill="${s.color || 'var(--accent)'}"/>`; continue; }
    const d = s.pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
    h += `<path d="${d}" fill="none" stroke="${s.color || 'var(--accent)'}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  if (opts.dot) h += `<circle cx="${X(opts.dot.x)}" cy="${Y(opts.dot.y)}" r="6" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
  svg.innerHTML = h;
}
