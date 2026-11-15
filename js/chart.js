// Charts, drawn by Chart.js (vendor/chart.umd.min.js, loaded by index.html as the global `Chart`).
// Colours come from the page's CSS variables, so the charts follow light and dark mode.
// One colour per thing, the same everywhere: investing = --accent, living costs = --live, mortgage = --mort.
import { html, useRef, useEffect } from './ui.js';
import { kr, short } from './format.js';

/** The value of a CSS variable, such as color('--accent'). */
export const color = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function theme(C) {
  C.defaults.font.family = getComputedStyle(document.body).fontFamily;
  C.defaults.color = color('--muted');
  C.defaults.borderColor = color('--line');
}

/** Options every chart shares: amounts in kroner, quiet grid, a readout for all lines at the same point. */
export function baseOptions(extra = {}) {
  return {
    maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'start', labels: { boxWidth: 14, boxHeight: 3, sort: (a, b) => a.datasetIndex - b.datasetIndex } },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${kr(c.parsed.y)}` } },
    },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v) => short(v) } } },
    ...extra,
  };
}

/** A chart. `label` says what it shows, for screen readers; put its numbers in a table or sentence nearby too. */
export function ChartBox({ type, data, options, label, height = 260 }) {
  const canvas = useRef(null), chart = useRef(null);
  useEffect(() => {
    const C = globalThis.Chart;
    if (!C) return undefined;
    theme(C);
    chart.current = new C(canvas.current, { type, data, options });
    return () => { chart.current.destroy(); chart.current = null; };
  }, []);
  useEffect(() => {
    if (!chart.current) return;
    chart.current.data = data;
    chart.current.options = options;
    chart.current.update();
  });
  return html`<div class="chart" style=${`height:${height}px`}><canvas ref=${canvas} role="img" aria-label=${label}></canvas></div>`;
}
