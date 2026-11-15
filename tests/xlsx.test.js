// Tests for the .xlsx reader. All workbooks are built in memory from made-up values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readXlsx, serialToIso, isDateFormat, XlsxError } from '../js/xlsx.js';
import { zip, makeXlsx } from './helpers.js';

const ROWS = [
  ['Dato', 'Beskrivelse', 'Beløp inn', 'Beløp ut'],
  [{ date: 46054 }, 'Butikk & kafé <test> "æøå"', null, -250.5],
  [{ date: 46055 }, 'Lønn', 30000, null],
  ['03.02.2026', 'Tekst som dato', 0, 12],
];
const EXPECT = [
  ['Dato', 'Beskrivelse', 'Beløp inn', 'Beløp ut'],
  ['2026-02-01', 'Butikk & kafé <test> "æøå"', null, -250.5],
  ['2026-02-02', 'Lønn', 30000],
  ['03.02.2026', 'Tekst som dato', 0, 12],
];

test('reads strings, numbers, empty cells and dates from a workbook', async () => {
  const [sheet] = await readXlsx(makeXlsx(ROWS, { sheetName: 'Transaksjoner' }));
  assert.equal(sheet.name, 'Transaksjoner');
  assert.deepEqual(sheet.rows, EXPECT);
});

test('the same workbook reads the same in every layout a writer may choose', async () => {
  const variants = { inline: { inline: true }, stored: { store: true }, descriptor: { descriptor: true }, prefixed: { prefix: 'x' },
    noRefs: { refs: false }, customDate: { dateFormat: 'dd\\.mm\\.yyyy' }, buffer: {} };
  for (const [name, opts] of Object.entries(variants)) {
    const bytes = makeXlsx(ROWS, opts);
    const [sheet] = await readXlsx(name === 'buffer' ? bytes.buffer : bytes);
    // Without cell references the reader cannot know a cell was skipped, so compare without the gaps.
    const want = name === 'noRefs' ? EXPECT.map((r) => r.filter((v) => v !== null)) : EXPECT;
    assert.deepEqual(sheet.rows, want, name);
  }
});

test('rich text runs are joined and phonetic hints are ignored', async () => {
  const bytes = makeXlsx([['x']]);
  const files = {
    'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="t/worksheet" Target="/xl/worksheets/s.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><r><t>Hei </t></r><r><rPr><b/></rPr><t>du</t></r><rPh><t>skip</t></rPh></si><si><t/></si><si><t>a_x000A_b &#229; &#xE5;</t></si></sst>',
    'xl/worksheets/s.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="E1" t="b"><v>1</v></c><c r="F1" t="str"><f>A1</f><v>via formel</v></c><c r="G1" t="e"><v>#N/A</v></c><c r="H1" t="d"><v>2026-03-04T00:00:00</v></c></row><row r="3"/></sheetData></worksheet>',
  };
  assert.ok(bytes.length > 0);
  const [sheet] = await readXlsx(zip(files));
  assert.deepEqual(sheet.rows, [['Hei du', '', 'a\nb å å', null, true, 'via formel', null, '2026-03-04'], []]);
});

test('hidden sheets are skipped and sheets come in workbook order', async () => {
  const sheet = (v) => `<worksheet><sheetData><row><c t="inlineStr"><is><t>${v}</t></is></c></row></sheetData></worksheet>`;
  const files = {
    'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Skjult" sheetId="1" state="hidden" r:id="rId1"/><sheet name="To" sheetId="2" r:id="rId3"/><sheet name="Tre" sheetId="3" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet('en'), 'xl/worksheets/sheet2.xml': sheet('tre'), 'xl/worksheets/sheet3.xml': sheet('to'),
  };
  const sheets = await readXlsx(zip(files));
  assert.deepEqual(sheets.map((s) => [s.name, s.rows[0][0]]), [['To', 'to'], ['Tre', 'tre']]);
});

test('date serial numbers convert correctly, including times and the 1904 system', () => {
  assert.equal(serialToIso(1), '1900-01-01');
  assert.equal(serialToIso(59), '1900-02-28');
  assert.equal(serialToIso(61), '1900-03-01');
  assert.equal(serialToIso(45658), '2025-01-01');
  assert.equal(serialToIso(46054), '2026-02-01');
  assert.equal(serialToIso(46054.5), '2026-02-01T12:00:00');
  assert.equal(serialToIso(46054.999999999), '2026-02-02');
  assert.equal(serialToIso(0, true), '1904-01-01');
  assert.equal(serialToIso(44592, true), '2026-02-01');
});

test('date formats are told apart from number formats', () => {
  for (const f of ['dd.mm.yyyy', 'yyyy-mm-dd', 'd/m/yy', 'dd\\.mm\\.yyyy', '[$-414]d. mmmm yyyy', 'hh:mm:ss', 'm/d/yyyy h:mm']) assert.ok(isDateFormat(f), f);
  for (const f of ['General', '0.00', '#,##0.00', '#,##0.00 "kr"', '[Red]-#,##0', '0%', '@', '#,##0\\ "dager"', '_-* #,##0.00_-']) assert.ok(!isDateFormat(f), f);
});

test('a 1904 workbook shifts its dates', async () => {
  const [sheet] = await readXlsx(makeXlsx([[{ date: 44592 }]], { date1904: true }));
  assert.equal(sheet.rows[0][0], '2026-02-01');
});

test('files that are not workbooks fail with a code the page can explain', async () => {
  await assert.rejects(readXlsx(new TextEncoder().encode('Dato;Beløp\n01.02.2026;10')), (e) => e instanceof XlsxError && e.code === 'not-zip');
  await assert.rejects(readXlsx(zip({ 'hello.txt': 'hi' })), (e) => e instanceof XlsxError && e.code === 'not-xlsx');
  const locked = makeXlsx([['x']]);
  locked[6] |= 1; // first local header: encrypted flag
  for (let i = 0; i < locked.length - 4; i++) if (locked[i] === 0x50 && locked[i + 1] === 0x4b && locked[i + 2] === 1 && locked[i + 3] === 2) locked[i + 8] |= 1;
  await assert.rejects(readXlsx(locked), (e) => e instanceof XlsxError && e.code === 'locked');
  const whole = makeXlsx(ROWS);
  await assert.rejects(readXlsx(whole.slice(0, whole.length - 40)), (e) => e instanceof XlsxError && e.code === 'not-zip');
  // Break the compressed sheet itself: 0x07 opens a block type that does not exist.
  const damaged = whole.slice(), name = new TextEncoder().encode('xl/worksheets/sheet1.xml');
  const at = damaged.findIndex((_, i) => name.every((c, j) => damaged[i + j] === c));
  damaged[at + name.length] = 0x07;
  await assert.rejects(readXlsx(damaged), (e) => e instanceof XlsxError && e.code === 'damaged');
});
