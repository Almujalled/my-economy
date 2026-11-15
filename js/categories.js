// What each transaction is: a kind of money movement (flow) and a category. No DOM, no storage.
// The rules below are generic: nationwide chains and everyday words. Your own rules are data,
// kept in the browser and editable on the Spending page. Never add rules from a real statement here.

// Flows answer "what kind of movement is this?". Only `spending` (plus other loans) is living costs.
export const FLOWS = [
  { id: 'income', name: 'Money in' },
  { id: 'spending', name: 'Living costs' },
  { id: 'debt', name: 'Loan payments' },
  { id: 'investing', name: 'Investing' },
  { id: 'transfer', name: 'Moved between your own accounts' },
  { id: 'oneoff', name: 'One-offs' },
];

// The spending list follows how Norwegian banks and SIFO group household costs, kept short on purpose.
export const CATEGORIES = [
  { id: 'housing', name: 'Housing', flow: 'spending', hint: 'Rent, shared costs, municipal fees, property tax, alarm. Not the mortgage.' },
  { id: 'power', name: 'Electricity and heating', flow: 'spending' },
  { id: 'groceries', name: 'Groceries', flow: 'spending' },
  { id: 'eatingout', name: 'Eating out and takeaway', flow: 'spending' },
  { id: 'transport', name: 'Car and transport', flow: 'spending', hint: 'Fuel, charging, tolls, parking, tickets, repairs.' },
  { id: 'insurance', name: 'Insurance', flow: 'spending' },
  { id: 'telecom', name: 'Phone, internet and TV', flow: 'spending' },
  { id: 'children', name: 'Children', flow: 'spending', hint: 'Kindergarten, after-school, activities, toys.' },
  { id: 'health', name: 'Health and personal care', flow: 'spending', hint: 'Doctor, dentist, pharmacy, glasses, hairdresser.' },
  { id: 'clothes', name: 'Clothes and shoes', flow: 'spending' },
  { id: 'homeware', name: 'Home and garden', flow: 'spending', hint: 'Furniture, appliances, electronics, tools, repairs, plants.' },
  { id: 'leisure', name: 'Leisure and subscriptions', flow: 'spending', hint: 'Training, hobbies, streaming, newspapers, games, books.' },
  { id: 'travel', name: 'Holidays and travel', flow: 'spending' },
  { id: 'cash', name: 'Cash and payments to people', flow: 'spending', hint: 'Cash machines and Vipps to people. What you get back is subtracted.' },
  { id: 'other', name: 'Other', flow: 'spending', hint: 'Gifts, charity, bank fees, shops that sell a bit of everything.' },
  { id: 'cardbill', name: 'Credit card bill', flow: 'spending', hint: 'Counts as living costs until you add the card statement. After that the purchases on the card count instead.' },
  { id: 'uncat', name: 'Not sorted yet', flow: 'spending' },
  { id: 'pay', name: 'Pay', flow: 'income' },
  { id: 'benefits', name: 'NAV and other support', flow: 'income' },
  { id: 'tax', name: 'Tax refund or extra tax', flow: 'income', hint: 'A refund adds to money in. Tax you pay on top of the payroll tax is subtracted.' },
  { id: 'interest', name: 'Interest earned', flow: 'income' },
  { id: 'otherin', name: 'Other money in', flow: 'income' },
  { id: 'uncatin', name: 'Money in, not sorted yet', flow: 'income' },
  { id: 'mortgage', name: 'Mortgage', flow: 'debt' },
  { id: 'loan', name: 'Other loans', flow: 'debt', hint: 'Car loan, student loan, consumer loan. Counted with living costs in the plan.' },
  { id: 'invest', name: 'Funds and shares', flow: 'investing' },
  { id: 'pension', name: 'Pension saving', flow: 'investing' },
  { id: 'own', name: 'Between your own accounts', flow: 'transfer', hint: 'Savings accounts, BSU and moving money around. Not income and not spending.' },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const UNSORTED = new Set(['uncat', 'uncatin']);

// Generic default rules: "description contains X". Text is compared in lower case with single spaces
// and a space added at both ends, so ' if ' only matches the whole word. Longest match wins.
// An object adds a condition: dir 'in' | 'out' (money direction), kind 'card' | 'bank' (type of account).
const DEFAULTS = {
  groceries: ['rema 1000', 'rema1000', 'kiwi', 'coop', ' extra ', ' obs ', 'meny', ' spar ', 'eurospar', 'joker', 'bunnpris', 'matkroken', 'nærbutikk', 'oda.com', ' oda ', 'kolonial', 'holdbart', 'vinmonopolet', 'dagligvare', 'bakeri', 'matvare', 'supermarked', 'adams matkasse', 'godtlevert', 'hellofresh', 'grocery', 'supermarket'],
  eatingout: ['restaurant', 'kafe', 'cafe', 'café', 'kaffe', 'espresso', 'starbucks', 'mcdonald', 'burger', 'peppes', 'dolly dimple', 'pizza', 'sushi', 'kebab', 'foodora', 'wolt', 'just eat', 'justeat', ' bar ', ' pub ', 'kantine', 'narvesen', '7-eleven', '7 eleven', 'deli de luca', 'big bite', 'subway', 'gatekjøkken', 'eating places', 'fast food', 'cocktail lounges', 'caterers'],
  housing: ['husleie', 'felleskost', 'fellesutg', 'borettslag', 'sameie', 'kommunale avg', 'kommunale gebyr', 'eiendomsskatt', 'renovasjon', 'vann og avløp', 'feiegebyr', 'festeavgift', 'vaktmester', 'verisure', 'sector alarm', 'boligalarm'],
  power: ['strøm', 'nettleie', 'kraft', 'energi', 'tibber', 'fjordkraft', 'fortum', 'hafslund', 'elvia', 'glitre', 'tensio', 'fjernvarme', 'electric', 'utilities'],
  homeware: ['ikea', 'jysk', 'bohus', 'skeidar', 'møbel', ' kid ', 'princess', 'kitch', 'tilbords', 'jernia', 'maxbo', 'byggmakker', 'montér', 'obs bygg', 'byggmix', 'bauhaus', 'byggevare', 'malerbutikk', 'fargerike', 'plantasjen', 'hageland', 'hagesenter', 'rørlegger', 'elektriker', 'snekker', 'elkjøp', 'elkjop', ' power ', 'komplett', 'netonnet', 'kjell', 'clas ohlson', 'biltema', 'eplehuset', 'apple store', 'furniture', 'hardware', 'home supply', 'home furnishing', 'lumber', 'nurser', 'electronics', 'computer', 'appliance'],
  transport: ['ruter', ' vy ', 'vy.no', 'flytoget', 'kolumbus', 'skyss', ' atb ', 'entur', 'brakar', 'kollektiv', 'circle k', 'uno-x', 'unox', ' esso', 'shell ', ' st1', ' yx ', 'bensin', 'drivstoff', 'autopass', 'bompenger', 'bomring', 'fjellinjen', 'ferde', 'vegamot', 'vegfinans', 'skyttelpass', 'fremtind service', 'flyt as', 'easypark', 'apcoa', 'aimo park', 'onepark', 'europark', 'parkering', 'p-hus', 'taxi', ' bolt', ' uber', ' voi ', 'ryde', 'verksted', 'mekonomen', 'dekk', 'biltilsyn', ' naf ', 'viking redning', 'statens vegvesen', 'trafikkforsikringsavgift', 'elbillading', 'lading', 'mer charging', 'recharge', 'ionity', 'tesla', 'kople', 'bilvask', 'ferje', 'ferge', 'fjord1', 'norled', 'torghatten', 'boreal', 'service stations', 'automated fuel', 'tolls and', 'parking lots', 'railroads', 'taxicabs', 'bus lines', 'commuter', 'automotive', 'car wash'],
  health: ['apotek', 'vitus', 'boots', ' lege', 'fastlege', 'legesenter', 'legevakt', ' tann', 'tannlege', 'helse', 'sykehus', 'fysio', 'kiropraktor', 'optiker', 'specsavers', 'brilleland', 'synsam', 'psykolog', 'dropin', 'volvat', 'aleris', 'frisør', 'frisor', 'cutters', 'barber', 'hudpleie', 'hudklinikk', ' spa ', ' vita ', 'kicks', 'lyko', 'blivakker', ' normal ', 'rituals', 'body shop', 'parfyme', 'kosmetikk', 'neglesalong', 'pharmac', 'drug stores', 'doctors', 'dentists', 'optician', 'optometrist', 'hospitals', 'medical', 'beauty', 'cosmetic'],
  children: ['barnehage', ' sfo ', 'skolefritid', 'aktivitetsskole', 'kulturskole', 'leker', 'lekia', 'ringo', 'babyshop', 'jollyroom', 'barnevogn', 'barnas', 'skolefoto', 'child care', 'toy '],
  clothes: ['h&m', 'h & m', 'hennes & mauritz', ' zara', 'cubus', 'dressmann', 'kappahl', 'lindex', 'bik bok', 'carlings', 'vero moda', 'jack & jones', 'zalando', 'boozt', 'eurosko', 'skoringen', 'din sko', 'uniqlo', 'stormberg', 'bergans', 'helly hansen', 'norrøna', 'ellos', 'bonprix', 'name it', 'klær', 'clothing', 'shoe stores', 'apparel'],
  leisure: [' sats', ' evo ', 'fresh fitness', 'treningssenter', 'trening', 'xxl', 'sport 1', 'intersport', 'gsport', 'g-sport', 'sport outlet', 'kino', 'nordisk film', 'odeon', 'teater', 'konsert', 'ticketmaster', 'billettservice', 'museum', 'svømme', 'badeland', 'alpin', 'skisenter', 'skistar', 'golf', 'turistforening', 'norli', ' ark ', 'adlibris', 'bokhandel', 'panduro', 'hobby', 'gamestop', 'norsk tipping', 'rikstoto', 'bowling', 'klatre', 'steam', 'playstation', 'nintendo', 'xbox', 'tusenfryd', 'dyrepark', 'idrettslag', 'netflix', 'spotify', 'hbo', 'disney', 'viaplay', 'tv 2 play', 'discovery', 'youtube', 'apple.com/bill', 'itunes', 'icloud', 'google', 'microsoft', 'dropbox', 'adobe', 'amazon prime', 'storytel', 'bookbeat', 'audible', 'aftenposten', 'dagbladet', 'schibsted', 'amedia', 'openai', 'chatgpt', 'patreon', 'abonnement', 'dyrlege', 'dyrebutikk', 'sporting goods', 'book stores', 'motion picture', 'recreation', 'amusement', 'health clubs', 'theatrical', 'digital goods', 'subscription'],
  travel: [' sas ', 'scandinavian airlines', 'norwegian air', 'norwegian.no', 'norwegian.com', 'widerøe', 'wideroe', ' klm', 'lufthansa', 'ryanair', 'wizz', 'finnair', 'british airways', 'avinor', 'hotel', 'scandic', 'radisson', 'airbnb', 'booking.com', 'expedia', ' ving ', ' tui ', 'apollo reiser', 'color line', 'fjord line', 'dfds', 'hurtigruten', 'havila', 'hertz', 'europcar', 'sixt', 'tax free', 'taxfree', 'travel retail', 'flybuss', 'camping', 'airlines', 'lodging', 'car rental', 'travel agenc', 'cruise'],
  telecom: ['telenor', 'telia', ' ice ', 'ice.no', 'onecall', 'talkmore', 'chili mobil', 'mycall', 'altibox', 'nextgentel', 'bredbånd', 'fiber', 'allente', 'rikstv', 'telecommunication', 'cable'],
  insurance: ['forsikring', 'gjensidige', ' tryg ', ' if ', 'fremtind', 'frende', 'codan', 'insurance'],
  other: ['europris', 'nille', 'søstrene grene', 'flying tiger', 'rusta', ' jula ', 'amazon', 'ebay', 'aliexpress', 'temu', 'shein', 'finn.no', ' tise', 'klarna', 'blomster', 'interflora', 'mester grønn', 'posten', 'postnord', 'helthjem', ' gave', 'gavekort', 'røde kors', 'redd barna', 'unicef', 'leger uten grenser', 'kirkens nødhjelp', 'amnesty', 'sos barnebyer', 'kreftforeningen', 'spleis', 'innsamling', 'gebyr', 'årspris', 'årsavgift', 'kortavgift', 'omkostninger', 'purring', 'inkasso', 'overtrekk', 'valutapåslag', 'debetrente', { m: 'renter', dir: 'out' }, 'department store', 'florist', 'discount store', 'variety store', 'miscellaneous', 'charit'],
  cash: ['minibank', 'kontantuttak', ' atm ', 'cash withdrawal', 'cash advance', 'vipps'],
  cardbill: ['kredittkort', 'bank norwegian', 'sparebank 1 kreditt', 'resurs bank', 'ikano bank', 're:member', 'american express', ' amex', 'eurocard', 'seb kort', 'entercard', 'trumf visa', 'flexi visa', '365direkte', '365 direkte', 'komplett bank', 'instabank', 'tf bank', 'morrow bank', 'kortfaktura',
    { m: 'innbetaling', kind: 'card', dir: 'in' }, { m: ' betaling ', kind: 'card', dir: 'in' }, { m: ' payment', kind: 'card', dir: 'in' }, { m: 'bankgiro', kind: 'card', dir: 'in' }],
  pay: [{ m: 'lønn', dir: 'in' }, { m: 'salary', dir: 'in' }, { m: 'feriepenger', dir: 'in' }],
  benefits: [{ m: ' nav ', dir: 'in' }, { m: 'barnetrygd', dir: 'in' }, { m: 'foreldrepenger', dir: 'in' }, { m: 'sykepenger', dir: 'in' }, { m: 'dagpenger', dir: 'in' }, { m: 'kontantstøtte', dir: 'in' }, { m: 'pensjon', dir: 'in' }, { m: 'lånekassen', dir: 'in' }, { m: 'husbanken', dir: 'in' }, { m: 'helfo', dir: 'in' }],
  tax: ['skatteetaten', 'skatteoppgjør', 'restskatt', 'forskuddsskatt', 'tilleggsforskudd', 'skatteinnkrev'],
  interest: [{ m: 'renter', dir: 'in' }, { m: 'kreditrente', dir: 'in' }, { m: 'rentegodtgj', dir: 'in' }, { m: 'interest', dir: 'in' }],
  mortgage: ['boliglån', 'huslån', 'terminbeløp', 'nedbetalingslån'],
  loan: ['billån', 'forbrukslån', 'studielån', { m: 'lånekassen', dir: 'out' }, 'santander consumer', 'nordea finans', 'dnb finans', 'brage finans', 'leasing'],
  invest: ['nordnet', ' kron ', 'kron.no', 'aksjesparekonto', ' ask ', 'fondshandel', 'fondskjøp', 'fondsandel', 'spareavtale', 'verdipapir', 'kapitalforvaltning', 'odin forvaltning', 'skagen fond', 'holberg fond', 'alfred berg', 'nordea funds', 'saxo', 'degiro', 'interactive brokers', 'etoro', ' firi', 'coinbase', 'aksjehandel', 'security brokers'],
  pension: [' ips ', 'pensjonssparing', 'individuell pensjon'],
  own: ['egen konto', 'egne kontoer', 'mellom egne', 'overføring egen', 'sparekonto', 'fast sparing', ' bsu', 'kontoregulering', 'høyrentekonto'],
};

export const DEFAULT_RULES = Object.entries(DEFAULTS)
  .flatMap(([cat, list]) => list.map((r) => (typeof r === 'string' ? { m: r, cat } : { ...r, cat })))
  .sort((a, b) => b.m.length - a.m.length);

const squash = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
/**
 * The text rules are matched against: description, bank's own type, card category and message.
 * When the bank file names the account at the other end, its last four digits are added as
 * "konto:1234", so a rule can say "everything to or from that account".
 */
export const haystack = (tx) => ' ' + squash([tx.text, tx.type, tx.mcat, tx.memo].filter(Boolean).join(' | ')) + (tx.peer ? ` konto:${tx.peer} ` : ' ');
export const peerRule = (peer) => `konto:${peer}`;
/** How a rule's text reads to a person. */
export const ruleLabel = (match) => { const m = /^konto:(\d{4})$/.exec(match); return m ? `to or from account …${m[1]}` : `“${match}”`; };

/** Sorts and tidies your own rules so the longest text is tried first. rules: [{ id, match, cat }]. */
export function prepareRules(rules) {
  return (rules || [])
    .map((r) => ({ id: r.id, m: squash(r.match || ''), cat: r.cat }))
    .filter((r) => r.m && CAT[r.cat])
    .sort((a, b) => b.m.length - a.m.length);
}

/**
 * Decides the category for one transaction.
 * ctx: { rules: prepareRules(...), kind: 'bank' | 'card', ownTails: Set of last-4-digits of your other accounts }.
 * Returns { cat, by, rule? } where by is 'you' | 'rule' | 'loan' | 'account' | 'default' | 'none'.
 */
export function categorise(tx, ctx = {}) {
  if (tx.cat && CAT[tx.cat]) return { cat: tx.cat, by: 'you' };
  const hay = haystack(tx);
  for (const r of ctx.rules || []) if (hay.includes(r.m)) return { cat: r.cat, by: 'rule', rule: r.id };
  if (tx.principal !== undefined || tx.interest !== undefined) return { cat: 'mortgage', by: 'loan' };
  if (tx.peer && ctx.ownTails && ctx.ownTails.has(tx.peer)) return { cat: 'own', by: 'account' };
  const dir = tx.amount < 0 ? 'out' : 'in';
  for (const r of DEFAULT_RULES) {
    if (r.dir && r.dir !== dir) continue;
    if (r.kind && r.kind !== (ctx.kind || 'bank')) continue;
    if (hay.includes(r.m)) return { cat: r.cat, by: 'default' };
  }
  return { cat: tx.amount < 0 ? 'uncat' : 'uncatin', by: 'none' };
}

// Noise that banks wrap around the shop name: card digits, dates, amounts, exchange rates.
const NOISE = [
  /\*\d{4}\b/g, /\b\d{4,6}\*+\d{4}\b/g, /\bkl\.?\s*\d{2}[.:]\d{2}\b/gi, /\b\d{2}\.\d{2}(\.\d{2,4})?\b/g,
  /\b(nok|eur|usd|sek|dkk|gbp)\s*-?\d[\d\s.,]*/gi, /\bkurs:?\s*\d[\d.,]*/gi, /\bdato\b/gi,
  /^(visa|varekjøp|varekjop|kortkjøp|nettgiro|avtalegiro|efaktura|e-faktura|giro|betaling|kjøp|til:|fra:)\s+/gi,
];
const FACILITATORS = /^(vipps|paypal|klarna|google|zettle|izettle|sumup|sq|apple pay)\s*[*:]\s*(?=\S)/i;

/** A short, readable shop name for display. */
export function cleanText(text) {
  let s = String(text || '').trim();
  for (let i = 0; i < 2; i++) for (const re of NOISE) s = s.replace(re, ' ').replace(/^\s+/, '');
  s = s.replace(/\s+/g, ' ').trim().replace(FACILITATORS, '');
  return s || String(text || '').trim();
}

/**
 * The text a rule for this transaction should look for. Look-alike transactions get the same key,
 * so they can be sorted together. Always something haystack(tx) really contains, so the rule matches.
 * - A payment to or from a named account: that account ("konto:1234"). Words like "Overføring" say
 *   nothing, but an account is always the same person or company.
 * - Otherwise the first two words of the shop name, without shop numbers.
 */
export function merchantKey(tx) {
  if (tx.peer) return peerRule(tx.peer);
  const words = squash(cleanText(tx.text)).split(' ');
  const rest = words.slice(1).filter((w) => !/^[\d.,/#-]+$/.test(w));
  const hay = haystack({ text: tx.text });
  for (const key of [[words[0], rest[0]].filter(Boolean).join(' '), words[0]]) if (key.length >= 3 && hay.includes(key)) return key;
  return squash(tx.text);
}
