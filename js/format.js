export const kr = (n) => Math.round(n).toLocaleString('nb-NO') + ' kr';
export const round500 = (n) => Math.round(n / 500) * 500;
export const up500 = (n) => Math.ceil(n / 500) * 500;
export const round10k = (n) => Math.round(n / 10000) * 10000;
export const signedKr = (n) => (n > 0 ? '+' : '') + kr(n);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

// Dates and months are stored as 'YYYY-MM-DD' and 'YYYY-MM'. These turn them into words.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;            // 'October 2026'
export const monthShort = (m) => MONTHS[+m.slice(5, 7) - 1].slice(0, 3);                      // 'Oct'
export const dmy = (d) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1].slice(0, 3)} ${d.slice(0, 4)}`; // '3 Oct 2026'
export const daysBetween = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
export const plural = (n, one, many = one + 's') => `${n.toLocaleString('nb-NO')} ${n === 1 ? one : many}`;
export const pct = (n) => Math.round(n) + '%';
// Axis labels: 25k, 1.2M
export const short = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v / 1000) + 'k');
// A moment in words, in the time of this computer: '3 Oct 2026 at 14:05'. Anything that is not a moment: 'at an unknown time'.
export const when = (iso) => {
  const d = new Date(iso);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(String(iso)) || isNaN(d)) return 'at an unknown time';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()} at ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
