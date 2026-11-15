export const kr = (n) => Math.round(n).toLocaleString('nb-NO') + ' kr';
export const round500 = (n) => Math.round(n / 500) * 500;
export const up500 = (n) => Math.ceil(n / 500) * 500;
export const round10k = (n) => Math.round(n / 10000) * 10000;
export const signedKr = (n) => (n > 0 ? '+' : '') + kr(n);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
