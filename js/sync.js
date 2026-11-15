// Deciding what to do when the same numbers live in this browser and in a file that other computers
// also save to. No DOM, no storage: the file handling itself is in backup.js.
//
// Every change stamps the numbers with the moment it happened (meta.saved). Next to that, the browser
// remembers the stamp the two had the last time they were the same. That is enough to tell who has
// moved on since: only the browser, only the file, or both.

/** A data file with no stamp (made before stamps existed) counts as very old, but not as empty. */
export const NO_STAMP = '0';

/**
 * local:  stamp of the numbers in this browser ('' = nothing has ever been changed here).
 * file:   stamp of the numbers in the file, or null when the file is empty.
 * synced: the stamp both had when they were last the same ('' = never).
 * Returns 'same', 'write' (put the browser's numbers in the file), 'load' (take the file's numbers)
 * or 'conflict' (both have changed, or something looks wrong: ask the person).
 */
export function syncStep(local, file, synced) {
  if (file === null) return local === '' ? 'same' : 'write';
  if (file === local) return 'same';
  if (local === '') return 'load';                       // an empty browser never overwrites a file
  const localChanged = local !== synced, fileChanged = file !== synced;
  if (!fileChanged) return 'write';                      // only this browser has moved on
  if (!localChanged) return file > local ? 'load' : 'conflict';   // only the file moved; an older file is not taken silently
  return 'conflict';
}
