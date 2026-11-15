// Reads .xlsx workbooks with no dependencies. An .xlsx file is a zip of XML files, and the
// built-in DecompressionStream does the unzipping (current browsers, Node 20.12+).
// Knows nothing about banks or money: it returns each sheet as rows of plain values.
// Strings stay strings, numbers stay numbers, and date cells become 'YYYY-MM-DD' (plus 'THH:MM:SS' when set).

const MAX_PART = 150 * 1024 * 1024; // refuse absurdly large parts instead of freezing the tab
const utf8 = new TextDecoder('utf-8');
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u64 = (b, o) => u32(b, o) + u32(b, o + 4) * 4294967296;

// `code` lets the page pick a plain message: not-zip, not-xlsx, locked, damaged, old-browser, too-big.
export class XlsxError extends Error {
  constructor(code, message) { super(message || code); this.name = 'XlsxError'; this.code = code; }
}

// ---------- zip ----------
function zipDirectory(b) {
  let end = -1;
  for (let i = b.length - 22, stop = Math.max(0, b.length - 22 - 65535); i >= stop; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { end = i; break; }
  }
  if (end < 0) throw new XlsxError('not-zip');
  let count = u16(b, end + 10), p = u32(b, end + 16);
  if (count === 0xffff || p === 0xffffffff) { // zip64: the real numbers are in a separate record
    const loc = end - 20;
    if (loc >= 0 && u32(b, loc) === 0x07064b50) {
      const z = u64(b, loc + 8);
      if (z + 56 <= b.length && u32(b, z) === 0x06064b50) { count = u64(b, z + 32); p = u64(b, z + 48); }
    }
  }
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (p + 46 > b.length || u32(b, p) !== 0x02014b50) break;
    const flags = u16(b, p + 8), method = u16(b, p + 10);
    let csize = u32(b, p + 20), usize = u32(b, p + 24), off = u32(b, p + 42);
    const n = u16(b, p + 28), x = u16(b, p + 30), c = u16(b, p + 32);
    const name = utf8.decode(b.subarray(p + 46, p + 46 + n)).replace(/\\/g, '/').replace(/^\/+/, '');
    for (let q = p + 46 + n, qEnd = q + x; q + 4 <= qEnd;) {
      const id = u16(b, q), len = u16(b, q + 2);
      if (id === 1) {
        let r = q + 4;
        if (usize === 0xffffffff) { usize = u64(b, r); r += 8; }
        if (csize === 0xffffffff) { csize = u64(b, r); r += 8; }
        if (off === 0xffffffff) off = u64(b, r);
      }
      q += 4 + len;
    }
    files.set(name.toLowerCase(), { flags, method, csize, usize, off });
    p += 46 + n + x + c;
  }
  return files;
}

async function inflateRaw(data) {
  if (typeof DecompressionStream !== 'function') throw new XlsxError('old-browser');
  let stream;
  try { stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); }
  catch { throw new XlsxError('old-browser'); }
  const reader = stream.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_PART) throw new XlsxError('too-big');
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof XlsxError) throw e;
    throw new XlsxError('damaged');
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

async function readPart(b, files, name) {
  const f = files.get(name.toLowerCase());
  if (!f) return null;
  if (f.flags & 1) throw new XlsxError('locked');
  if (f.usize > MAX_PART) throw new XlsxError('too-big');
  if (f.off + 30 > b.length || u32(b, f.off) !== 0x04034b50) throw new XlsxError('damaged');
  const start = f.off + 30 + u16(b, f.off + 26) + u16(b, f.off + 28);
  const data = b.subarray(start, start + f.csize);
  let raw;
  if (f.method === 0) raw = data;
  else if (f.method === 8) raw = await inflateRaw(data);
  else throw new XlsxError('damaged');
  return utf8.decode(raw).replace(/^﻿/, '');
}

// ---------- xml ----------
// The parts we read are simple enough for regular expressions. Tags may carry a namespace prefix (<x:row>).
const NS = '(?:[A-Za-z_][\\w.-]*:)?';
const el = (name, flags = 'g') => new RegExp(`<${NS}${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${NS}${name}>)`, flags);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unesc = (s) => (s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) =>
  (e[0] !== '#' ? ENT[e] : String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)))));
// Excel writes control characters as _x000D_ and the like.
const unescText = (s) => unesc(s).replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
const attrRe = (name) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
const attr = (s, re) => { const m = re.exec(s); return m ? unesc(m[1] ?? m[2]) : null; };
const A = Object.fromEntries(['r', 's', 't', 'name', 'state', 'Id', 'Target', 'Type', 'numFmtId', 'formatCode', 'date1904'].map((n) => [n, attrRe(n)]));
A.rid = /(?:^|\s)(?:[A-Za-z_][\w.-]*:)?id\s*=\s*(?:"([^"]*)"|'([^']*)')/;

const RPH = new RegExp(`<${NS}rPh\\b[\\s\\S]*?</${NS}rPh>`, 'g');
function richText(body) {
  if (!body) return '';
  let out = '';
  for (const m of body.replace(RPH, '').matchAll(el('t'))) out += m[2] || '';
  return unescText(out);
}

const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
// A number format shows a date or time when it has d, m, y, h or s left after literals are removed.
export function isDateFormat(code) {
  const bare = String(code).replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '').replace(/_./g, '').replace(/\*./g, '');
  return /[dmyhs]/i.test(bare) && !/general/i.test(bare);
}

function dateStyles(xml) {
  if (!xml) return [];
  const custom = new Map();
  for (const m of xml.matchAll(el('numFmt'))) custom.set(Number(attr(m[1], A.numFmtId)), attr(m[1], A.formatCode) || '');
  const xfs = el('cellXfs', '').exec(xml);
  const out = [];
  if (!xfs || !xfs[2]) return out;
  for (const m of xfs[2].matchAll(el('xf'))) {
    const id = Number(attr(m[1], A.numFmtId) || 0);
    out.push(BUILTIN_DATE.has(id) || (custom.has(id) && isDateFormat(custom.get(id))));
  }
  return out;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
// Excel counts days from 1900 and wrongly believes 1900 was a leap year; some files count from 1904 instead.
export function serialToIso(n, date1904 = false) {
  let days = Math.floor(n);
  let secs = Math.round((n - days) * 86400);
  if (secs >= 86400) { days += 1; secs = 0; }
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  if (!date1904 && days < 60) days += 1;
  const d = new Date(epoch + days * 86400000);
  const date = `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return secs ? `${date}T${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}` : date;
}

function colIndex(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i) & ~32; // upper case
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

function sheetRows(xml, strings, isDate, date1904) {
  const rows = [];
  const cellRe = el('c'), vRe = el('v', ''), isRe = el('is', '');
  for (const rm of xml.matchAll(el('row'))) {
    const row = [];
    let next = 0;
    for (const cm of (rm[2] || '').matchAll(cellRe)) {
      const at = cm[1], body = cm[2] || '';
      const ref = attr(at, A.r);
      const col = ref ? colIndex(ref) : next;
      next = col + 1;
      if (col < 0 || col > 16383) continue;
      const t = attr(at, A.t);
      let val = null;
      if (t === 'inlineStr') { const im = isRe.exec(body); val = im ? richText(im[2]) : ''; }
      else {
        const vm = vRe.exec(body);
        const v = vm ? vm[2] || '' : null;
        if (v === null) val = null;
        else if (t === 's') val = strings[Number(v)] ?? '';
        else if (t === 'str') val = unescText(v);
        else if (t === 'b') val = v === '1';
        else if (t === 'e') val = null;
        else if (t === 'd') val = v.replace(/(\.\d+)?Z?$/, '').replace(/T00:00:00$/, '');
        else {
          const n = Number(v);
          if (v.trim() === '' || !isFinite(n)) val = v.trim() === '' ? null : unescText(v);
          else if (isDate[Number(attr(at, A.s) || 0)] && n >= 0 && n < 2958466) val = serialToIso(n, date1904);
          else val = n;
        }
      }
      while (row.length < col) row.push(null);
      row[col] = val;
    }
    rows.push(row);
  }
  return rows;
}

const resolve = (target) => {
  const parts = [];
  for (const seg of (target.startsWith('/') ? target.slice(1) : 'xl/' + target).split('/')) {
    if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
};

/**
 * Reads a workbook. `input` is an ArrayBuffer or Uint8Array holding the file.
 * Returns [{ name, rows }] for every visible sheet, in workbook order. Throws XlsxError.
 */
export async function readXlsx(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const files = zipDirectory(b);
  const wbName = files.has('xl/workbook.xml') ? 'xl/workbook.xml' : [...files.keys()].find((k) => /(^|\/)workbook\.xml$/.test(k));
  const wb = wbName && await readPart(b, files, wbName);
  if (!wb) throw new XlsxError('not-xlsx');
  const rels = new Map();
  let stringsPath = 'xl/sharedstrings.xml', stylesPath = 'xl/styles.xml';
  const relXml = await readPart(b, files, 'xl/_rels/workbook.xml.rels');
  for (const m of (relXml || '').matchAll(el('Relationship'))) {
    const id = attr(m[1], A.Id), target = attr(m[1], A.Target), type = attr(m[1], A.Type) || '';
    if (!id || !target) continue;
    rels.set(id, resolve(target));
    if (/\/sharedStrings$/.test(type)) stringsPath = resolve(target);
    if (/\/styles$/.test(type)) stylesPath = resolve(target);
  }
  const strings = [];
  const sst = await readPart(b, files, stringsPath);
  if (sst) for (const m of sst.matchAll(el('si'))) strings.push(richText(m[2]));
  const isDate = dateStyles(await readPart(b, files, stylesPath));
  const pr = el('workbookPr', '').exec(wb);
  const date1904 = !!pr && /^(1|true)$/i.test(attr(pr[1], A.date1904) || '');

  let listed = [];
  for (const m of wb.matchAll(el('sheet'))) {
    const path = rels.get(attr(m[1], A.rid) || '');
    if (path) listed.push({ name: attr(m[1], A.name) || '', path, hidden: /hidden/i.test(attr(m[1], A.state) || '') });
  }
  if (listed.some((s) => !s.hidden)) listed = listed.filter((s) => !s.hidden);
  if (!listed.length) { // no usable index: fall back to the sheet files themselves
    listed = [...files.keys()].filter((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort().map((path, i) => ({ name: 'Sheet' + (i + 1), path }));
  }
  const sheets = [];
  for (const s of listed) {
    const xml = await readPart(b, files, s.path);
    if (xml) sheets.push({ name: s.name, rows: sheetRows(xml, strings, isDate, date1904) });
  }
  if (!sheets.length) throw new XlsxError('not-xlsx');
  return sheets;
}
