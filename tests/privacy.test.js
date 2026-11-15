// A guard for a public repository about private money: fails when something that looks like
// personal data is about to be committed. It checks every file git would track.
// It catches the obvious slips (an exported file, an account number, an e-mail address).
// It cannot know whether an amount or a shop name is real, so the rule in CLAUDE.md still stands:
// examples, tests and docs use made-up round numbers only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let files = null;
try { files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean); }
catch { /* not a git checkout: nothing to check */ }
const skip = files === null ? 'not a git checkout' : false;

const mod11 = (digits, weights) => { const r = 11 - (weights.reduce((s, w, i) => s + w * digits[i], 0) % 11); return r === 11 ? 0 : r; };
// A Norwegian bank account number has 11 digits, the last one a check digit.
const isAccount = (s) => { const d = [...s].map(Number); return mod11(d, [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]) === d[10]; };
// A national identity number is a birth date plus five digits, the last two check digits.
const isIdNumber = (s) => {
  const d = [...s].map(Number), day = (d[0] * 10 + d[1]) % 40, month = d[2] * 10 + d[3];
  if (day < 1 || day > 31 || month < 1 || month > 12) return false;
  const k1 = mod11(d, [3, 7, 6, 1, 8, 9, 4, 5, 2]);
  return k1 === d[9] && mod11(d, [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]) === d[10];
};

test('no exported data or bank files are in the repository', { skip }, () => {
  const bad = files.filter((f) => /\.(xlsx|xls|csv|ods|numbers|pdf)$/i.test(f) || /money-dashboard-data|\.private\.|(^|\/)data\//i.test(f));
  assert.deepEqual(bad, [], 'these files must not be committed');
});

test('.gitignore still keeps personal files out', { skip }, () => {
  const lines = readFileSync('.gitignore', 'utf8').split(/\r?\n/).map((l) => l.trim());
  for (const pattern of ['*.private.json', 'money-dashboard-data*.json', 'data/', '*.xlsx', '*.csv']) assert.ok(lines.includes(pattern), `.gitignore lost the line ${pattern}`);
});

test('no account numbers, identity numbers or e-mail addresses in any file', { skip }, () => {
  const found = [];
  for (const f of files) {
    if (!/\.(js|mjs|json|md|html|css|yml|yaml|txt|svg)$/i.test(f) && !/(^|\/)\.gitignore$/.test(f)) continue;
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/(?<![\d.])(\d{4})[ .]?(\d{2})[ .]?(\d{5})(?![\d.])/g)) {
      const digits = m[1] + m[2] + m[3];
      if (isAccount(digits)) found.push(`${f}: "${m[0]}" is a valid bank account number`);
      else if (isIdNumber(digits)) found.push(`${f}: "${m[0]}" is a valid national identity number`);
    }
    for (const m of text.matchAll(/\bNO\d{2} ?\d{4} ?\d{4} ?\d{3}\b/g)) found.push(`${f}: "${m[0]}" looks like an IBAN`);
    for (const m of text.matchAll(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g)) if (!/@example\.|@users\.noreply\.|noreply@/.test(m[0])) found.push(`${f}: "${m[0]}" is an e-mail address`);
  }
  assert.deepEqual(found, []);
});

test('the check itself tells real-looking numbers from made-up ones', () => {
  assert.equal(isAccount('11112233333'), false);      // the made-up account used in the tests
  assert.equal(isAccount('1234567890' + '3'), true);  // a valid check digit (written in two parts so this file passes its own check)
  assert.equal(isIdNumber('11112233333'), false);
  assert.equal(isIdNumber('99998888777'), false);
});
