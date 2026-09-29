// DOM plumbing for the screens over the window: building, wiring, swapping, toasts and the whispered
// hints; the bus's pictograms. Strings come from i18n (trusted, may hold <b>/<kbd>); anything else goes
// through esc().
import { Audio } from '../audio.js';

const root = document.getElementById('ui');
const hintEl = document.getElementById('hint');
const toastEl = document.getElementById('toast');
let current = null;

export function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// data-act buttons call acts[name](event, button); every press gets a paper tick
export function wire(node, acts) {
  node.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', (e) => {
      const fn = acts[b.dataset.act];
      if (!fn || b.getAttribute('aria-disabled') === 'true') return;
      if (!b.dataset.quiet) Audio.ui.tap();
      fn(e, b);
    });
  });
  return node;
}

export function show(node) {
  const old = current;
  current = node;
  if (old) { old.classList.add('out'); old.inert = true; old._stop?.(); setTimeout(() => old.remove(), 280); }
  if (node) {
    root.appendChild(node);
    requestAnimationFrame(() => {
      const f = [...node.querySelectorAll('[data-autofocus]')].find((e) => e.offsetParent !== null);
      if (f && current === node) f.focus({ preventScroll: true });
    });
  }
}
export const currentNode = () => current;

// timers that die with their screen
export function later(node, ms, fn) { const id = setTimeout(() => node.isConnected && fn(), ms); const prev = node._stop; node._stop = () => { clearTimeout(id); prev?.(); }; }

let toastT = 0;
export function toast(html, ms = 2400) {
  toastEl.innerHTML = html;
  toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// the friend in the next seat, whispering how it works
let hintHtml = null;
export function hint(html) {
  if (html === hintHtml) return;
  hintHtml = html;
  if (!html) { hintEl.classList.remove('in'); hintEl.hidden = true; return; }
  hintEl.innerHTML = html; hintEl.hidden = false;
  hintEl.classList.remove('in'); void hintEl.offsetWidth; hintEl.classList.add('in');
}

// ---- icons: round strokes, like the pictograms on a bus ----
const svg = (body, cls = '', vb = '0 0 24 24') => `<svg class="ic ${cls}" viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ICON = {
  soundOn: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2"/>'),
  soundOff: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  play: svg('<path d="M8 5.2v13.6L19 12z" fill="currentColor"/>'),
  next: svg('<path d="M9.5 5.5L16 12l-6.5 6.5" stroke-width="3"/>'),
  share: svg('<path d="M12 15V3.8M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v5.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-5.2"/>'),
  retry: svg('<path d="M19.5 13a7.5 7.5 0 1 1-2.2-6.3"/><path d="M19.6 4v4.2h-4.2"/>'),
  // the bus pass: the trips
  ticket: svg('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5v2a2.5 2.5 0 0 0 0 5v2A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5v-2a2.5 2.5 0 0 0 0-5z"/><path d="M9 9.5v5" stroke-dasharray="1.2 2.2"/>'),
  drop: svg('<path d="M12 3.5c-3.6 5-5.5 8-5.5 10.7a5.5 5.5 0 0 0 11 0c0-2.7-1.9-5.7-5.5-10.7z" fill="currentColor" stroke="none"/>'),
};

export function soundBtn(muted, label, cls = 'rb') {
  return `<button class="${cls}" data-act="mute" aria-pressed="${!muted}" aria-label="${esc(label)}" title="${esc(label)}">${muted ? ICON.soundOff : ICON.soundOn}</button>`;
}
export const bindMute = (onMute) => (e, b) => { const m = onMute(); b.setAttribute('aria-pressed', String(!m)); b.innerHTML = m ? ICON.soundOff : ICON.soundOn; };
// a hole the validator punched (a star), or the place where one will go
export const hole = (on) => `<i class="hole ${on ? 'on' : ''}" aria-hidden="true"></i>`;
