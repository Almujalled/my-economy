// Keeps your numbers in a file on your own disk, in step with this browser, in browsers that let a page
// save to a file you choose (Chrome and Edge on a computer). Put the file in a folder that syncs between
// your computers and it is both a backup and the way your numbers move between them.
// Nothing is sent anywhere by this page: the browser writes to your disk, and your sync program does the rest.
//
// How it stays safe: before saving, the file is looked at first. syncStep() in sync.js then says whether to
// save, to take the file's numbers, or to ask you because both have changed.
import * as db from './db.js';
import { syncStep, NO_STAMP } from './sync.js';

const HANDLE = 'backup-file';                    // where the browser remembers the file (IndexedDB)
const MARK = 'money-dashboard-v1-synced';        // the stamp the file and this browser last shared (localStorage)
const WAIT = 4000;                               // save this long after the last change, not on every key
const LOOK = 30000;                              // while the page is open, look for changes from elsewhere this often
const TYPES = [{ description: 'Money dashboard data', accept: { 'application/json': ['.json'] } }];
// Usually the sync program is half-way through writing it. If it stays like this, the file is damaged.
const UNREADABLE = 'The file cannot be read right now, so nothing is saved to it. It is tried again every half minute. If this does not pass, stop using the file on the Data page and start a new one.';

let handle = null, ok = false;                   // the file, and whether the browser lets this page use it right now
let hooks = null;                                // { get(): state, replace(data), touch() } from the app
let seen = -1;                                   // the file's "last modified" time when this page last read or wrote it
let timer = null, busy = false, again = false;
let info = { at: '', error: '', loaded: '', conflict: null };
const listeners = new Set();
let told = '';
// Pages are only told when something they show has changed, not on every quiet look at the file.
const tell = () => { const now = JSON.stringify(status()); if (now !== told) { told = now; listeners.forEach((l) => l()); } };

const mark = () => { try { return globalThis.localStorage.getItem(MARK) || ''; } catch { return ''; } };
const setMark = (v) => { try { globalThis.localStorage.setItem(MARK, v); } catch { /* it only costs an extra question later */ } };

export const supported = () => typeof globalThis.showSaveFilePicker === 'function' && typeof globalThis.showOpenFilePicker === 'function';
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/**
 * { name, state, at, error, loaded, conflict }
 * state: 'off' (no file chosen), 'locked' (the browser wants your go-ahead again), 'ready' (in step),
 *        'conflict' (both changed: waiting for your choice) or 'error'.
 * at: when the file was last saved. loaded: stamp of numbers just taken from the file, until dismissed.
 * conflict: { local, file } stamps of the two sets.
 */
export const status = () => ({
  name: handle ? handle.name : '',
  state: !handle ? 'off' : info.conflict ? 'conflict' : !ok ? 'locked' : info.error ? 'error' : 'ready',
  at: info.at, error: info.error, loaded: info.loaded,
  conflict: info.conflict ? { local: info.conflict.local, file: info.conflict.stamp } : null,
});

async function permitted(h, ask) {
  const opts = { mode: 'readwrite' };
  let state = await h.queryPermission(opts);
  if (state !== 'granted' && ask) state = await h.requestPermission(opts);     // only works from a click
  return state === 'granted';
}

// What is in the file: nothing, numbers from this dashboard, or something that cannot be read (right now).
async function readFile(h) {
  const f = await h.getFile();
  if (f.size === 0) return { empty: true, modified: f.lastModified };
  let data = null;
  try { data = JSON.parse(await f.text()); } catch { /* half-written by the sync program, or not ours */ }
  if (!data || typeof data !== 'object' || !data.profile) return { bad: true, modified: f.lastModified };
  const stamp = data.meta && typeof data.meta.saved === 'string' && data.meta.saved ? data.meta.saved : NO_STAMP;
  return { data, stamp, modified: f.lastModified };
}

async function writeFile() {
  const state = hooks.get(), stamp = state.meta.saved || '';
  const w = await handle.createWritable();        // writes beside the file and swaps it in when closed
  await w.write(JSON.stringify(state));
  await w.close();
  seen = (await handle.getFile()).lastModified;
  setMark(stamp);
  info.at = new Date().toISOString();
  info.error = '';
}

function takeFile(r) {
  hooks.replace(r.data);
  setMark(r.stamp);
  seen = r.modified;
  info.error = '';
  // A file from before stamps existed: stamp the numbers now, so the next look sees the two as the same.
  if ((hooks.get().meta.saved || '') !== r.stamp) hooks.touch();
}

// One look at the file, and whatever follows from it.
async function step() {
  if (!handle || !ok || !hooks || info.conflict) return;
  if (busy) { again = true; return; }
  busy = true;
  try {
    const local = hooks.get().meta.saved || '';
    const f = await handle.getFile();
    let r;
    if (f.lastModified === seen) r = { stamp: mark(), modified: seen, known: true };   // untouched since this page last read or wrote it
    else {
      r = await readFile(handle);
      if (r.bad) { info.error = UNREADABLE; schedule(LOOK); return; }
    }
    const what = syncStep(local, r.empty ? null : r.stamp, mark());
    if (what === 'write') await writeFile();
    else if (what === 'same') { seen = r.modified; if (!r.empty && !r.known) setMark(r.stamp); info.error = ''; }
    else {
      if (r.known) r = await readFile(handle);     // need the numbers themselves now
      if (r.bad || r.empty) { info.error = UNREADABLE; schedule(LOOK); return; }
      if (what === 'load') { takeFile(r); info.loaded = r.stamp; }
      else info.conflict = { local, stamp: r.stamp, data: r.data, modified: r.modified };
    }
  } catch (e) {
    if (e && e.name === 'NotAllowedError') ok = false;
    else if (e && e.name === 'NotFoundError') info.error = 'The file is gone. It may have been moved or renamed. Choose it again on the Data page.';
    else { info.error = 'The file could not be saved just now. It will be tried again.'; schedule(LOOK); }
  } finally {
    busy = false;
    tell();
    if (again) { again = false; schedule(WAIT); }
  }
}

function schedule(delay) {
  if (!handle || !ok) return;
  clearTimeout(timer);
  timer = setTimeout(step, delay);
}

/** Call once at start. hooks: { get() -> state, replace(data), touch() }. Finds the file chosen earlier and looks at it. */
export async function start(h) {
  hooks = h;
  if (!supported()) return;
  try { handle = (await db.get(HANDLE)) || null; ok = handle ? await permitted(handle, false) : false; }
  catch { handle = null; ok = false; }
  tell();
  if (ok) await step();
  // Changes made on another computer arrive while this page is open: look when you come back to it, and now and then.
  const look = () => { if (globalThis.document.visibilityState === 'visible') step(); };
  globalThis.document.addEventListener('visibilitychange', look);
  globalThis.addEventListener('focus', look);
  setInterval(look, LOOK);
}

/** Tell the file that something changed here. Saves a little later, so typing does not write on every key. */
export function changed() { schedule(WAIT); }

async function adopt(h) {
  if (!(await permitted(h, true))) return 'denied';
  const r = await readFile(h);
  if (r.bad) return 'not-ours';                    // something else is in that file: leave it alone
  handle = h; ok = true; seen = -1;
  setMark('');                                     // this browser and this file have not been compared yet
  info = { at: '', error: '', loaded: '', conflict: null };
  await db.set(HANDLE, h);
  await step();
  return 'ok';
}
/** Start a new file (from a click). Returns 'ok', 'denied' or 'not-ours'. Throws when the dialog is closed. */
export async function create(suggestedName) { return adopt(await globalThis.showSaveFilePicker({ suggestedName, types: TYPES })); }
/** Use a file that already exists, for example on your second computer (from a click). */
export async function open() { const [h] = await globalThis.showOpenFilePicker({ types: TYPES, multiple: false }); return adopt(h); }

/** Ask the browser again for permission (from a click), after a restart. */
export async function reconnect() {
  if (!handle) return false;
  ok = await permitted(handle, true);
  tell();
  if (ok) await step();
  return ok;
}

/**
 * Settle a conflict. keep: 'browser' or 'file'. Returns the numbers that were NOT kept, as text,
 * so the page can save them as a separate file and nothing is lost.
 */
export async function resolve(keep) {
  const c = info.conflict;
  if (!c) return '';
  info.conflict = null;
  let other;
  try {
    if (keep === 'file') { other = JSON.stringify(hooks.get(), null, 2); takeFile(c); }
    else { other = JSON.stringify(c.data, null, 2); await writeFile(); }
  } catch { info.error = 'The file could not be saved just now. It will be tried again.'; schedule(LOOK); }
  tell();
  return other || '';
}

/** Dismiss the "newer numbers were loaded" note. */
export function seenLoaded() { info.loaded = ''; tell(); }

/** Stop using the file. The file itself is left as it is. */
export async function forget() {
  clearTimeout(timer);
  handle = null; ok = false; seen = -1;
  info = { at: '', error: '', loaded: '', conflict: null };
  setMark('');
  try { await db.set(HANDLE, null); } catch { /* fine */ }
  tell();
}
