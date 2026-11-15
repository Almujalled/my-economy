// Turns a bank or card export (.xlsx or CSV) into plain transactions. No DOM, no storage.
// Works from the column headers, so it does not need to know which bank the file came from.
// Money out is negative, money in is positive, dates are 'YYYY-MM-DD'.
import { readXlsx, serialToIso, XlsxError } from './xlsx.js';

// `code` lets the page pick a plain message: empty, old-excel, web-page, no-header, no-rows,
// plus the XlsxError codes. `detail` carries what was found, for the message.
export class BankFileError extends Error {
  constructor(code, detail) { super(code); this.name = 'BankFileError'; this.code = code; this.detail = detail; }
}

// ---------- text files ----------
export function decodeText(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder('utf-8').decode(b.subarray(3));
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
  catch { return new TextDecoder('windows-1252').decode(b); } // older Norwegian exports
}

// Counts a separator outside quotes, per line, and picks the one that splits the lines most evenly.
export function sniffDelimiter(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim()).slice(0, 25);
  let best = ';', bestScore = 0;
  for (const d of [';', '\t', ',', '|']) {
    const counts = lines.map((line) => {
      let n = 0, quoted = false;
      for (const ch of line) { if (ch === '"') quoted = !quoted; else if (ch === d && !quoted) n++; }
      return n;
    });
    const tally = new Map();
    for (const n of counts) if (n > 0) tally.set(n, (tally.get(n) || 0) + 1);
    let score = 0;
    for (const [n, lineCount] of tally) score = Math.max(score, lineCount * Math.min(n, 12));
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

export function parseCsv(text, delimiter = sniffDelimiter(text)) {
  const rows = [];
  let row = [], cell = '', quoted = false, started = false;
  const endCell = () => { row.push(cell); cell = ''; started = false; };
  const endRow = () => { endCell(); if (row.length > 1 || row[0] !== '') rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
    } else if (ch === '"' && !started) { quoted = true; started = true; }
    else if (ch === delimiter) endCell();
    else if (ch === '\n') endRow();
    else if (ch === '\r') { if (text[i + 1] === '\n') i++; endRow(); }
    else { cell += ch; started = true; }
  }
  if (cell !== '' || row.length) endRow();
  return rows;
}

// ---------- values ----------
/** "1 234,56", "-1.234,56", "1,234.56", "(250,00)", "1234,-", 12.5 -> number. Anything else -> null. */
export function parseAmount(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/[\s  '’]/g, '').replace(/[−–]/g, '-').replace(/kr\.?|nok/gi, '').replace(/,-$/, '');
  if (!s) return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (s.endsWith('-')) { sign = -sign; s = s.slice(0, -1); }
  if (s[0] === '-') { sign = -sign; s = s.slice(1); } else if (s[0] === '+') s = s.slice(1);
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const comma = s.lastIndexOf(','), dot = s.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (comma >= 0) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) ? sign * n : null;
}

const pad = (n) => String(n).padStart(2, '0');
function ymd(y, m, d) {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}
/** Reads a date in the forms Norwegian exports use. `order` is 'dmy' (default) or 'mdy' for the first two numbers. */
export function parseDate(v, order = 'dmy') {
  if (typeof v === 'number') return v > 32874 && v < 73416 ? serialToIso(v).slice(0, 10) : null; // 1990..2100 as Excel day numbers
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m;
  if ((m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/.exec(s))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})(?!\d)/.exec(s))) return order === 'mdy' ? ymd(+m[3], +m[1], +m[2]) : ymd(+m[3], +m[2], +m[1]);
  if ((m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{2})(?!\d)/.exec(s))) return order === 'mdy' ? ymd(2000 + +m[3], +m[1], +m[2]) : ymd(2000 + +m[3], +m[2], +m[1]);
  if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return ymd(+m[1], +m[2], +m[3]);
  return null;
}
// If any date only makes sense with the month first (13 or more in second place), the file is month-first.
function dateOrder(samples) {
  let dayFirst = 0, monthFirst = 0;
  for (const v of samples) {
    const m = typeof v === 'string' && /^\s*(\d{1,2})[-./](\d{1,2})[-./]\d{2,4}/.exec(v);
    if (!m) continue;
    if (+m[1] > 12) dayFirst++; else if (+m[2] > 12) monthFirst++;
  }
  return monthFirst > dayFirst ? 'mdy' : 'dmy';
}

// ---------- columns ----------
// Header names seen in Norwegian bank and card exports, most trusted first. Compared in lower case
// with everything but letters and digits removed, so "Melding/KID/Fakt.nr" is "meldingkidfaktnr".
const ROLES = {
  date: ['utførtdato', 'transaksjonsdato', 'transactiondate', 'kjøpsdato', 'purchasedate', 'dato', 'date', 'bokføringsdato', 'bokførtdato', 'bokført', 'bookingdate', 'posteringsdato', 'bokfdato', 'rentedato', 'valuteringsdato', 'valuedate'],
  text: ['beskrivelse', 'forklaring', 'transaksjonstekst', 'tekst', 'text', 'description', 'beløpetgjelder', 'spesifikasjon', 'detaljer', 'details', 'tittel', 'brukersted', 'merchant', 'navn', 'name'],
  amount: ['beløp', 'belop', 'amount', 'beløpnok', 'beløpinok', 'beløpkr', 'transaksjonsbeløp', 'sum', 'nok'],
  in: ['beløpinn', 'innpåkonto', 'innpaakonto', 'inn', 'innskudd', 'deposits', 'deposit', 'kredit', 'credit', 'innbetaling', 'moneyin'],
  out: ['beløput', 'utfrakonto', 'utavkonto', 'ut', 'uttak', 'withdrawals', 'withdrawal', 'debet', 'debit', 'utbetaling', 'moneyout'],
  type: ['type', 'transaksjonstype', 'betalingstype', 'transactiontype'],
  subtype: ['undertype'],
  category: ['merchantcategory', 'hovedkategori', 'kategori', 'category'],
  subcategory: ['underkategori', 'subcategory'],
  memo: ['meldingkidfaktnr', 'melding', 'message', 'meldingkid', 'kidmelding'],
  status: ['status'],
  from: ['frakontonummer', 'frakonto'],
  to: ['tilkontonummer', 'tilkonto'],
  sender: ['avsender'],
  receiver: ['mottakernavn', 'mottaker'],
  account: ['kontonummer', 'kontonr', 'konto', 'accountnumber', 'account'],
  currency: ['valuta', 'currency'],
};
const CARD_HINTS = ['merchantcategory', 'merchantarea', 'currencyamount', 'currencyrate', 'kjøpsdato', 'purchasedate', 'utlbeløp', 'valutabeløp', 'beløpivaluta', 'beløpetgjelder', 'kurs', 'kortnummer', 'kortnr', 'cardnumber', 'brukersted'];
const norm = (v) => (typeof v === 'string' ? v.normalize('NFC').toLowerCase().replace(/[^a-z0-9æøåäöé]/g, '') : '');

function matchHeader(row) {
  const found = {}; // role -> { col, rank }
  row.forEach((cell, col) => {
    const h = norm(cell);
    if (!h) return;
    let best = null;
    for (const [role, names] of Object.entries(ROLES)) {
      names.forEach((name, i) => {
        // An exact name beats a longer header that merely starts with one, such as "Beløp inn (kr)".
        const rank = h === name ? i : (name.length >= 4 && h.startsWith(name) ? 100 + i - name.length : null);
        if (rank !== null && (!best || rank < best.rank)) best = { role, rank };
      });
    }
    if (best && (!found[best.role] || best.rank < found[best.role].rank)) found[best.role] = { col, rank: best.rank };
  });
  const cols = {};
  for (const [role, f] of Object.entries(found)) cols[role] = f.col;
  return cols;
}

/** Finds the header row. Returns { headerRow, cols, kind: 'bank' | 'card' } or null. */
export function detectTable(rows) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const cols = matchHeader(rows[i] || []);
    const hasMoney = cols.amount !== undefined || cols.in !== undefined || cols.out !== undefined;
    if (cols.date === undefined || !hasMoney) continue;
    if (cols.text === undefined) {
      const stand = ['receiver', 'sender', 'memo', 'type'].find((r) => cols[r] !== undefined);
      if (!stand) continue;
      cols.text = cols[stand];
    }
    const names = rows[i].map(norm);
    return { headerRow: i, cols, kind: names.some((n) => CARD_HINTS.includes(n)) ? 'card' : 'bank' };
  }
  return null;
}

const str = (v) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());
const NUM = '(\\d{1,3}(?:[ \\u00a0.]\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
const PRINCIPAL = new RegExp('avdrag:?\\s*' + NUM, 'i'), INTEREST = new RegExp('renter?:?\\s*' + NUM, 'i');
// Account numbers are never kept. Only the last four digits, to tell your own accounts apart.
const tail = (v) => { const d = str(v).replace(/\D/g, ''); return d.length >= 8 ? d.slice(-4) : ''; };
const mode = (list) => { const n = new Map(); let best = '', top = 0; for (const v of list) { if (!v) continue; const c = (n.get(v) || 0) + 1; n.set(v, c); if (c > top) { top = c; best = v; } } return { value: best, count: top }; };

/**
 * rows: cell values (from readXlsx or parseCsv). table: result of detectTable.
 * Returns { kind, txs, skipped, pending, flipped, accountTail, from, to }.
 * A transaction is { date, text, amount, type?, mcat?, memo?, principal?, interest?, peer?, acct? }.
 */
export function toTransactions(rows, table) {
  const { cols, headerRow } = table;
  const body = rows.slice(headerRow + 1);
  const at = (row, role) => (cols[role] === undefined ? null : row[cols[role]]);
  const order = dateOrder(body.slice(0, 500).map((r) => at(r, 'date')));
  const split = cols.in !== undefined || cols.out !== undefined;
  const txs = [];
  let skipped = 0, pending = 0;
  for (const row of body) {
    if (!row || row.every((c) => c === null || c === undefined || str(c) === '')) continue;
    if (/reserv|pending|venter|ikke bokført/i.test(str(at(row, 'status'))) || /^reserv/i.test(str(at(row, 'date')))) { pending++; continue; }
    const date = parseDate(at(row, 'date'), order);
    let amount;
    if (split) {
      const inn = parseAmount(at(row, 'in')), out = parseAmount(at(row, 'out'));
      amount = inn === null && out === null ? null : (inn || 0) - Math.abs(out || 0);
    } else amount = parseAmount(at(row, 'amount'));
    if (!date || amount === null) { skipped++; continue; }
    if (amount === 0) continue;
    const memo = str(at(row, 'memo'));
    const others = ['receiver', 'sender'].map((r) => str(at(row, r))).filter(Boolean);
    let text = str(at(row, 'text'));
    if (!text) text = others[0] || memo || str(at(row, 'type')) || '(no description)';
    const tx = { date, text: text.slice(0, 160), amount: Math.round(amount * 100) / 100 };
    const type = [str(at(row, 'type')), str(at(row, 'subtype'))].filter(Boolean).join(' / ');
    if (type && type !== text) tx.type = type.slice(0, 60);
    const mcat = [str(at(row, 'category')), str(at(row, 'subcategory'))].filter(Boolean).join(' / ');
    if (mcat) tx.mcat = mcat.slice(0, 80);
    // Keep a message only when it says something; payment reference numbers are dropped.
    const note = [memo, ...others.filter((o) => o !== text)].filter((m) => m && /[a-zæøå]{3}/i.test(m)).join(' · ');
    if (note && note !== text) tx.memo = note.slice(0, 160);
    const pm = PRINCIPAL.exec(memo), im = INTEREST.exec(memo);
    if (pm) tx.principal = parseAmount(pm[1]) || 0;
    if (im) tx.interest = parseAmount(im[1]) || 0;
    const from = tail(at(row, 'from')), to = tail(at(row, 'to'));
    if (from || to) tx._ends = [from, to];
    const acct = tail(at(row, 'account'));
    if (acct) tx.acct = acct;
    txs.push(tx);
  }

  // The account the file belongs to is where money out comes from and where money in arrives.
  // The other end is who you paid or were paid by.
  let accountTail = '';
  const withEnds = txs.filter((t) => t._ends);
  if (withEnds.length) {
    const own = mode(withEnds.map((t) => (t.amount < 0 ? t._ends[0] : t._ends[1])));
    if (own.count >= withEnds.length * 0.6) accountTail = own.value;
  }
  for (const t of txs) {
    if (!t._ends) continue;
    const peer = t.amount < 0 ? t._ends[1] : t._ends[0];
    if (peer && peer !== accountTail) t.peer = peer;
    delete t._ends;
  }

  // Card statements often list purchases as plus. Purchases far outnumber payments, so the common sign is "out".
  let flipped = false;
  if (table.kind === 'card' && !split && txs.length >= 3) {
    const plus = txs.filter((t) => t.amount > 0).length;
    if (plus > txs.length * 0.6) { flipped = true; for (const t of txs) t.amount = -t.amount; }
  }
  const dates = txs.map((t) => t.date).sort();
  return { kind: table.kind, txs, skipped, pending, flipped, accountTail, from: dates[0] || null, to: dates[dates.length - 1] || null };
}

const startsWith = (b, sig) => sig.every((v, i) => b[i] === v);
const headerText = (row) => (row || []).map(norm).join('|');

/**
 * A first guess at the columns of a file with no header we know, for you to confirm on the page.
 * Returns { headerRow (-1 = the file has no header line), cols: { date, text, amount }, kind, header }.
 */
export function guessLayout(rows) {
  const firstData = rows.findIndex((r) => r && r.some((c) => parseDate(c) !== null));
  const start = Math.max(0, firstData);
  const sample = rows.slice(start, start + 25).filter((r) => r && r.length);
  const width = Math.max(0, ...sample.map((r) => r.length));
  const share = (col, test) => sample.filter((r) => test(r[col])).length / (sample.length || 1);
  const cols = {};
  const dates = [], numbers = [], texts = [];
  for (let c = 0; c < width; c++) {
    if (share(c, (v) => parseDate(v) !== null) >= 0.8) dates.push(c);
    else if (share(c, (v) => parseAmount(v) !== null) >= 0.8) numbers.push(c);
    else texts.push([c, sample.reduce((n, r) => n + str(r[c]).length, 0)]);
  }
  if (dates.length) cols.date = dates[0];
  if (numbers.length) cols.amount = numbers[0];
  texts.sort((x, y) => y[1] - x[1]);
  if (texts.length && texts[0][1] > 0) cols.text = texts[0][0];
  const headerRow = firstData > 0 ? firstData - 1 : -1;
  return { headerRow, cols, kind: 'bank', header: headerRow >= 0 ? headerText(rows[headerRow]) : '' };
}

/** Builds a layout from choices made on the page. skip: lines before the first transaction. cols: { date, text, amount } or { date, text, in, out }. */
export function makeLayout(rows, skip, cols, kind) {
  const headerRow = Math.max(0, Math.round(skip)) - 1;
  return { headerRow, cols, kind: kind === 'card' ? 'card' : 'bank', header: headerRow >= 0 ? headerText(rows[headerRow]) : '' };
}

/** Does a layout you made earlier fit this file? Same header line (if it had one), and most lines read cleanly. */
function fits(rows, layout) {
  if (layout.headerRow >= 0 && headerText(rows[layout.headerRow]) !== layout.header) return null;
  const res = toTransactions(rows, layout);
  const lines = rows.slice(layout.headerRow + 1).filter((r) => r && r.some((c) => str(c))).length;
  return res.txs.length && res.txs.length >= lines * 0.6 ? res : null;
}

/** Opens a file and returns its tables as rows of cells: one per sheet, or one for a CSV file. */
export async function openBankFile(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!b.length) throw new BankFileError('empty');
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) return readXlsx(b);
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0])) throw new BankFileError('old-excel');
  const text = decodeText(b);
  if (/^\s*<(!doctype|html|\?xml|table)/i.test(text)) throw new BankFileError('web-page');
  return [{ name: '', rows: parseCsv(text) }];
}

/**
 * Reads one export file. `bytes` is an ArrayBuffer or Uint8Array. `layouts` are column choices you made
 * before for files this reader did not recognise (see guessLayout); they are tried when the header is unknown.
 * Returns what toTransactions returns, plus { sheet }. Throws BankFileError or XlsxError.
 * On 'no-header' the error carries `rows`, so the page can ask which column is which.
 */
export async function readBankFile(bytes, layouts = []) {
  const tables = await openBankFile(bytes);
  let unknown = null, empty = false;
  for (const t of tables) {
    const table = detectTable(t.rows);
    if (table) {
      const res = toTransactions(t.rows, table);
      if (res.txs.length) return { ...res, sheet: t.name };
      empty = true;
      continue;
    }
    for (const layout of layouts) {
      const res = fits(t.rows, layout);
      if (res) return { ...res, sheet: t.name };
    }
    if (!unknown && t.rows.some((r) => r && r.filter((c) => str(c)).length >= 2)) unknown = t;
  }
  if (unknown) {
    const first = unknown.rows.find((r) => r && r.filter((c) => str(c)).length >= 2);
    const e = new BankFileError('no-header', first.map(str).filter(Boolean).slice(0, 12));
    e.rows = unknown.rows;
    throw e;
  }
  throw new BankFileError(empty ? 'no-rows' : 'no-header', []);
}

export { XlsxError };
