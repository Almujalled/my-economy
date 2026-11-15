// Test helpers: build small .xlsx files in memory, so no spreadsheet ever has to be committed.
// Everything here is made up. Never paste rows from a real bank export into a test.
import { deflateRawSync } from 'node:zlib';

const enc = new TextEncoder();
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/**
 * Minimal zip writer. files: { 'path/in/zip': 'text' | Uint8Array }.
 * opts.store: no compression. opts.descriptor: sizes after the data, as streaming writers do.
 */
export function zip(files, opts = {}) {
  const chunks = [], central = [];
  let offset = 0;
  const push = (arr) => { chunks.push(arr); offset += arr.length; };
  for (const [name, content] of Object.entries(files)) {
    const raw = typeof content === 'string' ? enc.encode(content) : content;
    const data = opts.store ? raw : new Uint8Array(deflateRawSync(raw));
    const nameB = enc.encode(name), crc = crc32(raw), at = offset;
    const flags = opts.descriptor ? 8 : 0;
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, flags, true);
    head.setUint16(8, opts.store ? 0 : 8, true);
    if (!opts.descriptor) { head.setUint32(14, crc, true); head.setUint32(18, data.length, true); head.setUint32(22, raw.length, true); }
    head.setUint16(26, nameB.length, true);
    push(new Uint8Array(head.buffer)); push(nameB); push(data);
    if (opts.descriptor) {
      const dd = new DataView(new ArrayBuffer(16));
      dd.setUint32(0, 0x08074b50, true); dd.setUint32(4, crc, true); dd.setUint32(8, data.length, true); dd.setUint32(12, raw.length, true);
      push(new Uint8Array(dd.buffer));
    }
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, flags, true);
    cd.setUint16(10, opts.store ? 0 : 8, true); cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true);
    cd.setUint32(24, raw.length, true); cd.setUint16(28, nameB.length, true); cd.setUint32(42, at, true);
    central.push(new Uint8Array(cd.buffer), nameB);
  }
  const cdStart = offset;
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  central.forEach(push);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, cdStart, true);
  push(new Uint8Array(end.buffer));
  const out = new Uint8Array(offset);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const colName = (i) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/**
 * Builds a one-sheet workbook from rows of values.
 * A cell is a string, a number, null, or { date: serialNumber } for a date-formatted cell.
 * opts.inline: write strings inside the cells instead of in the shared table.
 * opts.prefix: namespace prefix on every tag (for example 'x'), as some .NET writers do.
 * opts.refs === false: leave out the A1-style cell references.
 * opts.dateFormat: custom number format for date cells (default is built-in format 14).
 */
export function makeXlsx(rows, opts = {}) {
  const p = opts.prefix ? opts.prefix + ':' : '';
  const xmlns = opts.prefix ? `xmlns:${opts.prefix}` : 'xmlns';
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const shared = [], index = new Map();
  const sheetRows = rows.map((row, r) => {
    const cells = row.map((v, c) => {
      const ref = opts.refs === false ? '' : ` r="${colName(c)}${r + 1}"`;
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return `<${p}c${ref}><${p}v>${v}</${p}v></${p}c>`;
      if (typeof v === 'object') return `<${p}c${ref} s="1"><${p}v>${v.date}</${p}v></${p}c>`;
      if (opts.inline) return `<${p}c${ref} t="inlineStr"><${p}is><${p}t xml:space="preserve">${xmlEsc(v)}</${p}t></${p}is></${p}c>`;
      if (!index.has(v)) { index.set(v, shared.length); shared.push(v); }
      return `<${p}c${ref} t="s"><${p}v>${index.get(v)}</${p}v></${p}c>`;
    }).join('');
    return `<${p}row r="${r + 1}">${cells}</${p}row>`;
  }).join('');
  const numFmts = opts.dateFormat ? `<${p}numFmts count="1"><${p}numFmt numFmtId="164" formatCode="${xmlEsc(opts.dateFormat)}"/></${p}numFmts>` : '';
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><${p}workbook ${xmlns}="${main}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${opts.date1904 ? `<${p}workbookPr date1904="1"/>` : ''}<${p}sheets><${p}sheet name="${xmlEsc(opts.sheetName || 'Sheet1')}" sheetId="1" r:id="rId1"/></${p}sheets></${p}workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8"?><${p}styleSheet ${xmlns}="${main}">${numFmts}<${p}cellXfs count="2"><${p}xf numFmtId="0"/><${p}xf numFmtId="${opts.dateFormat ? 164 : 14}" applyNumberFormat="1"><${p}alignment horizontal="left"/></${p}xf></${p}cellXfs></${p}styleSheet>`,
    'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8"?><${p}sst ${xmlns}="${main}">${shared.map((s) => `<${p}si><${p}t xml:space="preserve">${xmlEsc(s)}</${p}t></${p}si>`).join('')}</${p}sst>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><${p}worksheet ${xmlns}="${main}"><${p}sheetData>${sheetRows}</${p}sheetData></${p}worksheet>`,
  };
  return zip(files, opts);
}
