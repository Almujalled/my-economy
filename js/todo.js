// The few things worth doing now, for the Overview page. No DOM, no storage.
import { monthOf, addMonths, unsortedGroups } from './ledger.js';
import { monthName, plural, daysBetween } from './format.js';

/**
 * s: the state. L: store.ledger(s). day: 'YYYY-MM-DD'. fileOn: the numbers are kept in a file already.
 * Returns [{ text, link }], most useful first.
 */
export function todo(s, L, day, fileOn) {
  const out = [], txs = s.transactions, lastMonth = addMonths(monthOf(day), -1);
  if (!txs.length) out.push({ text: 'Add a file from the account your pay comes into', link: '#/spending' });
  else if (monthOf(txs[txs.length - 1].date) < lastMonth) out.push({ text: `Add ${monthName(lastMonth).split(' ')[0]}'s file from your bank`, link: '#/spending' });
  const groups = unsortedGroups(txs, L.sorted).length;
  if (groups) out.push({ text: `Sort ${plural(groups, 'place')} the dashboard did not recognise`, link: '#/spending' });
  const last = s.networth[s.networth.length - 1];
  if (!last) out.push({ text: 'Type what you own and owe', link: '#/networth' });
  else if (daysBetween(last.date, day) > 31) out.push({ text: 'Type this month\'s values', link: '#/networth' });
  if (!s.profile.birthYear) out.push({ text: 'Give the year you were born, to see when you can stop working', link: '#/networth' });
  else if (!s.profile.pension) out.push({ text: 'Add your pension from NAV, or the age you can stop is too gloomy', link: '#/networth' });
  const has = txs.length || s.networth.length;
  const copyAge = s.meta.exported ? daysBetween(s.meta.exported, day) : null;
  if (has && !fileOn && (copyAge === null || copyAge > 30)) out.push({ text: 'Keep your numbers in a file, so they are not only in this browser', link: '#/data' });
  return out;
}
