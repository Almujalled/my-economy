// What every page is built from: Preact with htm, which gives HTML-like templates without a build step.
// Text put into a template is escaped by Preact, so names from bank files are safe as they are.
// Do not use dangerouslySetInnerHTML.
import { h, render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import * as store from './store.js';
import * as backup from './backup.js';

export const html = htm.bind(h);
export { render, useState, useEffect, useRef };

// Both hooks draw once more right after they start listening, in case something changed in between.
/** Draws the component again whenever the saved numbers change, and returns them. */
export function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const off = store.subscribe(() => tick((n) => n + 1)); tick((n) => n + 1); return off; }, []);
  return store.get();
}

/** Draws the component again whenever the file the numbers are kept in changes state, and returns that state. */
export function useBackup() {
  const [, tick] = useState(0);
  useEffect(() => { const off = backup.onChange(() => tick((n) => n + 1)); tick((n) => n + 1); return off; }, []);
  return backup.status();
}

/** Lets the browser save `text` as a file in Downloads. */
export function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * A number you type that is saved as you type. It keeps what you are typing, even half a number,
 * and shows the saved value again when you leave it. `onSave` gets valid numbers only.
 */
export function NumberField({ id, label, value, onSave, step = 1, hint, placeholder }) {
  const [text, setText] = useState(value ? String(value) : '');
  const [typing, setTyping] = useState(false);
  useEffect(() => { if (!typing) setText(value ? String(value) : ''); }, [value, typing]);
  return html`<div class="field">
    <label for=${id}>${label}</label>
    <input id=${id} type="number" inputmode="decimal" min="0" step=${step} placeholder=${placeholder} value=${text}
      onFocus=${() => setTyping(true)} onBlur=${() => setTyping(false)}
      onInput=${(e) => { setText(e.target.value); const v = parseFloat(e.target.value); if (e.target.value === '') onSave(0); else if (isFinite(v) && v >= 0) onSave(v); }} />
    ${hint ? html`<small>${hint}</small>` : null}
  </div>`;
}
