// Keeps a backup file on your own disk up to date, in browsers that allow a page to save to a chosen file
// (Chrome and Edge on a computer). Put the file in a folder that syncs between your devices and you have
// both a backup and a way to move your numbers. Nothing is sent anywhere by this page.
import * as db from './db.js';

const KEY = 'backup-file';
let handle = null, timer = null, last = { at: '', error: '' };
const listeners = new Set();
const tell = () => listeners.forEach((l) => l());

export const supported = () => typeof globalThis.showSaveFilePicker === 'function';
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** { name, ready, at, error }: the file, whether the page may write to it now, when it last did, and what went wrong. */
export const status = () => ({ name: handle ? handle.name : '', ready: !!handle && handle._ok === true, at: last.at, error: last.error });

async function allowed(ask) {
  if (!handle) return false;
  const opts = { mode: 'readwrite' };
  let state = await handle.queryPermission(opts);
  if (state !== 'granted' && ask) state = await handle.requestPermission(opts);   // needs a click
  handle._ok = state === 'granted';
  return handle._ok;
}

/** Call once at start: finds the file chosen earlier. Writing may still need one click (see reconnect). */
export async function start() {
  if (!supported()) return;
  try { handle = (await db.get(KEY)) || null; if (handle) await allowed(false); } catch { handle = null; }
  tell();
}

/** Reads the file's contents as text, or '' when it is empty or unreadable. */
export async function read() {
  try { return handle && handle._ok ? await (await handle.getFile()).text() : ''; } catch { return ''; }
}

/** Lets you pick the file (from a click). Returns true when the page may write to it. */
export async function choose(suggestedName) {
  handle = await globalThis.showSaveFilePicker({ suggestedName, types: [{ description: 'Money dashboard data', accept: { 'application/json': ['.json'] } }] });
  await db.set(KEY, handle);
  const ok = await allowed(true);
  tell();
  return ok;
}

/** Asks the browser again for permission to write (from a click), after a restart. */
export async function reconnect() { const ok = await allowed(true); tell(); return ok; }

export async function forget() { handle = null; last = { at: '', error: '' }; try { await db.set(KEY, null); } catch { /* fine */ } tell(); }

/** Writes the text to the file now. Returns true when it worked. */
export async function write(text) {
  if (!handle || !handle._ok) return false;
  try {
    const w = await handle.createWritable();
    await w.write(text);
    await w.close();
    last = { at: new Date().toISOString(), error: '' };
  } catch (e) {
    last = { at: last.at, error: e && e.name === 'NotAllowedError' ? 'The browser needs your permission again.' : 'The file could not be written.' };
    if (e && e.name === 'NotAllowedError') handle._ok = false;
  }
  tell();
  return !last.error;
}

/** Saves a little after the last change, so typing does not write the file on every key. */
export function schedule(getText, delay = 1500) {
  if (!handle || !handle._ok) return;
  clearTimeout(timer);
  timer = setTimeout(() => write(getText()), delay);
}
