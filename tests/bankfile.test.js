// Tests for reading bank and card exports. Every row here is invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parseDate, parseCsv, sniffDelimiter, decodeText, detectTable, toTransactions, readBankFile, guessLayout, BankFileError } from '../js/bankfile.js';
import { makeXlsx } from './helpers.js';

const enc = (s) => new TextEncoder().encode(s);

test('amounts are read in Norwegian and English notation', () => {
  const cases = [['1 234,56', 1234.56], ['-1.234,56', -1234.56], ['1,234.56', 1234.56], ['1234.56', 1234.56], ['12,5', 12.5], ['1.234', 1234],
    ['1 000', 1000], ['−2 500,00', -2500], ['(250,00)', -250], ['1234,-', 1234], ['kr 99,90', 99.9], ['500 NOK', 500], ['45,00-', -45],
    ['+10', 10], ['0', 0], [12.5, 12.5], [-3, -3]];
  for (const [input, want] of cases) assert.equal(parseAmount(input), want, String(input));
  for (const bad of ['', '  ', 'abc', '12a', '1,2,3', null, undefined, NaN, {}]) assert.equal(parseAmount(bad), null, String(bad));
});

test('dates are read in the forms bank exports use', () => {
  const cases = [['01.02.2026', '2026-02-01'], ['1.2.2026', '2026-02-01'], ['01.02.26', '2026-02-01'], ['2026-02-01', '2026-02-01'],
    ['2026-02-01T13:45:00', '2026-02-01'], ['2026/02/01', '2026-02-01'], ['01/02/2026', '2026-02-01'], ['01-02-2026 08:00', '2026-02-01'],
    ['20260201', '2026-02-01'], [46054, '2026-02-01'], [46054.6, '2026-02-01']];
  for (const [input, want] of cases) assert.equal(parseDate(input), want, String(input));
  assert.equal(parseDate('02/13/2026', 'mdy'), '2026-02-13');
  for (const bad of ['31.02.2026', '00.01.2026', '01.13.2026', 'Reservert', '', 12, null, '2026-02-30']) assert.equal(parseDate(bad), null, String(bad));
});

test('CSV: separator is found, quotes and line breaks inside quotes survive', () => {
  assert.equal(sniffDelimiter('a;b;c\n1,5;2;3\n4;5,25;6'), ';');
  assert.equal(sniffDelimiter('a,b,c\n1,2,3\n4,5,6'), ',');
  assert.equal(sniffDelimiter('a\tb\n1\t2'), '\t');
  assert.deepEqual(parseCsv('"Dato";"Tekst";"Beløp"\r\n"01.02.2026";"Sa ""hei""; og\ngikk";"-12,50"\r\n\r\n02.02.2026;Uten hermetegn;5\r\n'),
    [['Dato', 'Tekst', 'Beløp'], ['01.02.2026', 'Sa "hei"; og\ngikk', '-12,50'], ['02.02.2026', 'Uten hermetegn', '5']]);
  assert.deepEqual(parseCsv('a,b\n1,'), [['a', 'b'], ['1', '']]);
});

test('text files are decoded from UTF-8, UTF-8 with a mark, UTF-16 and Windows-1252', () => {
  assert.equal(decodeText(enc('Beløp')), 'Beløp');
  assert.equal(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...enc('Beløp')])), 'Beløp');
  assert.equal(decodeText(new Uint8Array([0x42, 0x65, 0x6c, 0xf8, 0x70])), 'Beløp'); // ø as one Windows-1252 byte
  assert.equal(decodeText(new Uint8Array([0xff, 0xfe, 0x42, 0x00, 0xf8, 0x00])), 'Bø');
});

const BANK_HEAD = ['Utført dato', 'Bokført dato', 'Rentedato', 'Beskrivelse', 'Type', 'Undertype', 'Fra konto', 'Avsender', 'Til konto', 'Mottakernavn', 'Beløp inn', 'Beløp ut', 'Valuta', 'Status', 'Melding/KID/Fakt.nr'];
const OWN = '1111.22.33333', LOAN = '4444.55.66666', SAVE = '7777.88.99999';
const BANK_ROWS = [
  ['Kontoutskrift for eksempelkonto'],
  [],
  BANK_HEAD,
  ['02.01.2026', '02.01.2026', '02.01.2026', 'Eksempel Dagligvare', 'Varekjøp', 'Kortkjøp', OWN, null, null, null, null, -412.5, 'NOK', 'Bokført', null],
  ['15.01.2026', '15.01.2026', '15.01.2026', 'Lønn', 'Lønn', null, null, 'Eksempel Arbeidsgiver AS', OWN, null, 40000, null, 'NOK', 'Bokført', null],
  ['20.01.2026', '20.01.2026', '20.01.2026', 'Lån', 'Lån', 'Avtalegiro', OWN, null, LOAN, null, null, -12000, 'NOK', 'Bokført', 'Avdrag: 5 000,00 Renter: 6 950,00 Gebyr: 50,00'],
  ['21.01.2026', '21.01.2026', '21.01.2026', 'Overføring', 'Overføring', null, OWN, null, SAVE, null, null, 3000, 'NOK', 'Bokført', '12345678901234'],
  ['22.01.2026', null, null, 'Venter på butikk', 'Varekjøp', null, OWN, null, null, null, null, -99, 'NOK', 'Reservert', null],
  ['ikke en dato', null, null, 'Sum', null, null, null, null, null, null, null, -1, null, null, null],
  [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
];

test('a bank export with separate in and out columns becomes signed transactions', () => {
  const table = detectTable(BANK_ROWS);
  assert.equal(table.headerRow, 2);
  assert.equal(table.kind, 'bank');
  assert.equal(BANK_HEAD[table.cols.date], 'Utført dato');
  const res = toTransactions(BANK_ROWS, table);
  assert.equal(res.txs.length, 4);
  assert.equal(res.pending, 1);
  assert.equal(res.skipped, 1);
  assert.equal(res.accountTail, '3333');
  assert.deepEqual([res.from, res.to], ['2026-01-02', '2026-01-21']);
  assert.deepEqual(res.txs[0], { date: '2026-01-02', text: 'Eksempel Dagligvare', amount: -412.5, type: 'Varekjøp / Kortkjøp' });
  assert.deepEqual(res.txs[1], { date: '2026-01-15', text: 'Lønn', amount: 40000, memo: 'Eksempel Arbeidsgiver AS' });
  assert.equal(res.txs[2].principal, 5000);
  assert.equal(res.txs[2].interest, 6950);
  assert.equal(res.txs[2].peer, '6666');
  // "Beløp ut" written as a plus number is still money out, and a reference number alone is not kept as a message.
  assert.deepEqual(res.txs[3], { date: '2026-01-21', text: 'Overføring', amount: -3000, peer: '9999' });
  assert.ok(!JSON.stringify(res).includes('1111.22'), 'full account numbers are never kept');
});

test('the file belongs to the account money leaves from and arrives in, even when every line names two accounts', () => {
  // A savings account that only ever receives transfers from the everyday account: both numbers are on every line.
  const rows = [BANK_HEAD,
    ['16.01.2026', null, null, 'Overføring', 'Overføring', null, OWN, null, SAVE, null, 3000, null, 'NOK', 'Bokført', null],
    ['16.02.2026', null, null, 'Overføring', 'Overføring', null, OWN, null, SAVE, null, 3000, null, 'NOK', 'Bokført', null],
    ['01.03.2026', null, null, 'Uttak', 'Overføring', null, SAVE, null, OWN, null, null, -500, 'NOK', 'Bokført', null]];
  const res = toTransactions(rows, detectTable(rows));
  assert.equal(res.accountTail, '9999');
  assert.deepEqual(res.txs.map((t) => t.peer), ['3333', '3333', '3333']);
});

test('the same export reads the same from .xlsx and from CSV', async () => {
  const fromXlsx = await readBankFile(makeXlsx(BANK_ROWS.map((r) => r.map((c, i) => (i < 3 && /^\d\d\.\d\d\.\d{4}$/.test(c || '') ? { date: 46023 + Number(c.slice(0, 2)) - 1 } : c)))));
  const csv = BANK_ROWS.map((r) => r.map((c) => (c === null ? '' : typeof c === 'number' ? String(c).replace('.', ',') : `"${c}"`)).join(';')).join('\r\n');
  const fromCsv = await readBankFile(enc(csv));
  assert.deepEqual(fromXlsx.txs, fromCsv.txs);
  assert.equal(fromXlsx.txs.length, 4);
  assert.equal(fromXlsx.sheet, 'Sheet1');
});

test('a card export with English headers is recognised as a card', async () => {
  const rows = [
    ['TransactionDate', 'Text', 'Type', 'Currency Amount', 'Currency Rate', 'Currency', 'Amount', 'Merchant Area', 'Merchant Category'],
    [{ date: 46025.6 }, 'KAFE EKSEMPEL', 'Kjøp', -89, 1, 'NOK', -89, 'OSLO', 'Eating places and Restaurants'],
    [{ date: 46031 }, 'EXAMPLE STORE', 'Kjøp', -20, 10.5, 'EUR', -210, 'BERLIN', 'Grocery Stores, Supermarkets'],
    [{ date: 46042 }, 'Innbetaling bankgiro', 'Innbetaling', 5000, 1, 'NOK', 5000, null, null],
  ];
  const res = await readBankFile(makeXlsx(rows, { dateFormat: 'yyyy\\-mm\\-dd\\ hh:mm' }));
  assert.equal(res.kind, 'card');
  assert.equal(res.flipped, false);
  assert.deepEqual(res.txs.map((t) => [t.date, t.amount]), [['2026-01-03', -89], ['2026-01-09', -210], ['2026-01-20', 5000]]);
  assert.equal(res.txs[1].mcat, 'Grocery Stores, Supermarkets');
  assert.equal(res.txs[0].type, 'Kjøp');
});

test('a card statement that lists purchases as plus numbers is turned the right way', () => {
  const rows = [['Kjøpsdato', 'Beskrivelse', 'Beløp'], ['01.03.2026', 'Butikk A', '120,00'], ['02.03.2026', 'Butikk B', '80,00'],
    ['03.03.2026', 'Butikk C', '45,50'], ['10.03.2026', 'Innbetaling', '-245,50']];
  const res = toTransactions(rows, detectTable(rows));
  assert.equal(res.kind, 'card');
  assert.equal(res.flipped, true);
  assert.deepEqual(res.txs.map((t) => t.amount), [-120, -80, -45.5, 245.5]);
});

test('other Norwegian layouts are found by their headers', () => {
  const layouts = {
    'in and out as words': [['Dato', 'Forklaring', 'Rentedato', 'Ut fra konto', 'Inn på konto'], ['05.02.2026', 'Eksempel', '05.02.2026', '150,00', '']],
    'one signed amount, year first': [['Bokføringsdato', 'Beløp', 'Avsender', 'Mottaker', 'Navn', 'Tittel', 'Valuta', 'Betalingstype'], ['2026/02/05', '-150,00', '', '', 'Eksempel AS', 'Eksempel', 'NOK', 'Kortkjøp']],
    'capital letters and extra columns': [['BOKFØRINGSDATO', 'RENTEDATO', 'ARKIVREFERANSE', 'TYPE', 'TEKST', 'UT FRA KONTO', 'INN PÅ KONTO'], ['05.02.2026', '05.02.2026', '123', 'VISA VARE', 'Eksempel', '-150,00', '']],
    'units in the header': [['Dato', 'Tekst', 'Beløp (NOK)', 'Saldo'], ['05.02.2026', 'Eksempel', '-150,00', '1 000,00']],
    'in and out with an older wording': [['Dato', 'Forklaring', 'Rentedato', 'Ut av konto', 'Inn på konto'], ['05.02.2026', 'Eksempel', '05.02.2026', '150,00', '']],
    'English online bank': [['Date', 'Description', 'Interest date', 'Withdrawals', 'Deposits'], ['05.02.2026', 'Eksempel', '05.02.2026', '150.00', '']],
    'in and out with a trailing separator': [['Dato', 'Beskrivelse', 'Rentedato', 'Inn', 'Ut', 'Til konto', 'Fra konto', ''], ['05.02.2026', 'Eksempel', '05.02.2026', '', '-150,00', '', '12345678901', '']],
    'account names and numbers in separate columns': [['Dato', 'Inn på konto', 'Ut fra konto', 'Balanse', 'Til konto', 'Til kontonummer', 'Fra konto', 'Fra kontonummer', 'Type', 'Tekst/KID', 'Hovedkategori', 'Underkategori'],
      ['2026-02-05', '', '-150,00', '9 000,00', 'Butikk', '99998888777', 'Brukskonto', '11112222333', 'Betaling', 'Eksempel', 'Mat', 'Dagligvarer']],
    'card statement with a transaction time': [['Transaksjonsdato', 'Bokføringsdato', 'Beskrivelse', 'Mottakers kontonummer', 'KID eller melding', 'Beløp', 'Beløp i valuta'], ['05.02.2026 17:04:32', '06.02.2026', 'Eksempel', '', '', '\u2212150,00', '']],
  };
  for (const [name, rows] of Object.entries(layouts)) {
    const table = detectTable(rows);
    assert.ok(table, name);
    const res = toTransactions(rows, table);
    assert.deepEqual(res.txs.map((t) => [t.date, t.amount, t.text]), [['2026-02-05', -150, 'Eksempel']], name);
  }
});

test('a card statement with in and out columns, a time on the date and a carried-over line', () => {
  // The layout of one large bank's card export: dates are day numbers with a fraction, the first line has no date.
  const rows = [['Dato', 'Beløpet gjelder', 'Valuta', 'Kurs', 'Inn', 'Ut'],
    [null, 'Skyldig beløp fra forrige faktura', null, null, null, 2500],
    [46054.083333333336, 'Eksempel Butikk', 'NOK', 1, null, 349.9], [46060, 'Innbetaling', 'NOK', 1, 2500, null]];
  const res = toTransactions(rows, detectTable(rows));
  assert.equal(res.kind, 'card');
  assert.deepEqual(res.txs.map((t) => [t.date, t.text, t.amount]), [['2026-02-01', 'Eksempel Butikk', -349.9], ['2026-02-07', 'Innbetaling', 2500]]);
  assert.deepEqual([res.skipped, res.flipped], [1, false]);
});

test('the account at the other end is taken from the account number column, not the name column', () => {
  const rows = [['Dato', 'Inn på konto', 'Ut fra konto', 'Til konto', 'Til kontonummer', 'Fra konto', 'Fra kontonummer', 'Tekst'],
    ['2026-02-05', '', '-150,00', 'Butikk', '99998888777', 'Brukskonto', '11112222333', 'Eksempel'], ['2026-02-06', '40 000,00', '', 'Brukskonto', '11112222333', 'Arbeidsgiver', '55556666444', 'Lønn']];
  const res = toTransactions(rows, detectTable(rows));
  assert.equal(res.accountTail, '2333');
  assert.deepEqual(res.txs.map((t) => t.peer), ['8777', '6444']);
});

test('a file with no header line asks which column is which, and remembers the answer', async () => {
  // A common layout among smaller Norwegian banks: date, booked date, text, signed amount, balance. No header.
  const csv = '"01.06.2026";"01.06.2026";"Eksempel Butikk";"-1.000,00";"5.000,00";"";""\r\n"03.06.2026";"04.06.2026";"Lønn";"30.000,00";"35.000,00";"";""\r\n';
  let error;
  await readBankFile(enc(csv)).catch((e) => { error = e; });
  assert.ok(error instanceof BankFileError && error.code === 'no-header');
  assert.equal(error.rows.length, 2);
  const layout = guessLayout(error.rows);
  assert.deepEqual(layout, { headerRow: -1, cols: { date: 0, amount: 3, text: 2 }, kind: 'bank', header: '' });
  const res = await readBankFile(enc(csv), [layout]);
  assert.deepEqual(res.txs.map((t) => [t.date, t.text, t.amount]), [['2026-06-01', 'Eksempel Butikk', -1000], ['2026-06-03', 'Lønn', 30000]]);
  // A layout made for another file is not forced onto this one.
  await assert.rejects(readBankFile(enc(csv), [{ headerRow: 0, cols: { date: 0, text: 1, amount: 2 }, kind: 'bank', header: 'a|b|c' }]), (e) => e.code === 'no-header');
  await assert.rejects(readBankFile(enc(csv), [{ headerRow: -1, cols: { date: 2, text: 0, amount: 1 }, kind: 'bank', header: '' }]), (e) => e.code === 'no-header');
});

test('an unknown header line is offered as the header, with columns guessed from what is in them', () => {
  const rows = [['Rapport'], ['Kjøpt', 'Hvor', 'Kroner', 'Notat'], ['01.02.2026', 'Eksempel Kiosk', '-45,00', ''], ['02.02.2026', 'Eksempel Kafe', '-120,00', 'lunsj']];
  assert.equal(detectTable(rows), null);
  assert.deepEqual(guessLayout(rows), { headerRow: 1, cols: { date: 0, amount: 2, text: 1 }, kind: 'bank', header: 'kjøpt|hvor|kroner|notat' });
  assert.deepEqual(guessLayout([['a', 'b'], ['c', 'd']]), { headerRow: -1, cols: { text: 0 }, kind: 'bank', header: '' });
});

test('month-first dates are noticed when a day above 12 gives them away', () => {
  const rows = [['Date', 'Description', 'Amount'], ['02/13/2026', 'A', '-1'], ['03/01/2026', 'B', '-2']];
  assert.deepEqual(toTransactions(rows, detectTable(rows)).txs.map((t) => t.date), ['2026-02-13', '2026-03-01']);
});

test('files that cannot be used say why', async () => {
  const code = (c) => (e) => e instanceof BankFileError && e.code === c;
  await assert.rejects(readBankFile(new Uint8Array(0)), code('empty'));
  await assert.rejects(readBankFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0])), code('old-excel'));
  await assert.rejects(readBankFile(enc('<html><table><tr><td>Dato</td></tr></table></html>')), code('web-page'));
  await assert.rejects(readBankFile(enc('Navn;Alder\nKari;40\n')), (e) => code('no-header')(e) && e.detail.join() === 'Navn,Alder');
  await assert.rejects(readBankFile(enc('Dato;Tekst;Beløp\n')), code('no-rows'));
});
