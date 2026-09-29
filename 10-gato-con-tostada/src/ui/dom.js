// DOM plumbing for the fridge door: building, wiring, swapping screens, the notes slid under a magnet (toasts)
// and the sticky notes (hints); the pictograms and the star magnets. Strings come from i18n (trusted, may hold
// <b>/<kbd>); anything else goes through esc().
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

// data-act buttons call acts[name](event, button); every press clacks like a magnet
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

// a sticky note on the fridge: how things work in this flat
let hintHtml = null;
export function hint(html) {
  if (html === hintHtml) return;
  hintHtml = html;
  if (!html) { hintEl.classList.remove('in'); hintEl.hidden = true; return; }
  hintEl.innerHTML = html; hintEl.hidden = false;
  hintEl.classList.remove('in'); void hintEl.offsetWidth; hintEl.classList.add('in');
}

// ---- pictograms: round strokes, the ink of the stage ----
const svg = (body, cls = '', vb = '0 0 24 24') => `<svg class="ic ${cls}" viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ICON = {
  soundOn: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2"/>'),
  soundOff: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  play: svg('<path d="M8 5.2v13.6L19 12z" fill="currentColor"/>'),
  next: svg('<path d="M9.5 5.5L16 12l-6.5 6.5" stroke-width="3"/>'),
  share: svg('<path d="M12 15V3.8M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v5.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-5.2"/>'),
  retry: svg('<path d="M19.5 13a7.5 7.5 0 1 1-2.2-6.3"/><path d="M19.6 4v4.2h-4.2"/>'),
  pause: svg('<path d="M9 6.5v11M15 6.5v11" stroke-width="3.6"/>'),
  // the fridge: back to the door with the notes
  fridge: svg('<rect x="6" y="2.8" width="12" height="18.4" rx="2.6"/><path d="M6 9.4h12M9 5.2v2M9 11.8v4"/>'),
  lock: svg('<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" fill="currentColor"/><path d="M8.5 10.5V8.2a3.5 3.5 0 0 1 7 0v2.3"/>'),
  // the two ways to turn the cat: anticlockwise (left) and clockwise (right)
  turnL: svg('<path d="M16.95 16.95A7 7 0 1 0 5.24 13.81"/><path d="M6.93 10.18L5.24 13.81 1.96 11.52"/>'),
  turnR: svg('<path d="M7.05 16.95A7 7 0 1 1 18.76 13.81"/><path d="M17.07 10.18l1.69 3.63 3.28-2.29"/>'),
};

export function soundBtn(muted, label, cls = 'rb blue') {
  return `<button class="${cls}" data-act="mute" aria-pressed="${!muted}" aria-label="${esc(label)}" title="${esc(label)}">${muted ? ICON.soundOff : ICON.soundOn}</button>`;
}
export const bindMute = (onMute) => (e, b) => { const m = onMute(); b.setAttribute('aria-pressed', String(!m)); b.innerHTML = m ? ICON.soundOff : ICON.soundOn; };

// each room's note keeps its paper, its magnet and its tilt wherever it appears (the door, the HUD, the card)
export const NOTE = {
  paper: ['#fff3a6', '#ffd9e0', '#d6ecff', '#e2f5cc', '#fffdf6', '#ffe7b8'],
  mag: ['#e0463b', '#3b7be0', '#43b67a', '#f2c230', '#8e5bd0', '#e0463b'],
  tilt: [-2.2, 1.6, -1.1, 2.3, -1.7, 1.2],
};
// the magnet alphabet's plastic colours
export const LETTER = ['#e0463b', '#3b7be0', '#f2c230', '#43b67a', '#f08a3c', '#8e5bd0'];

// a star magnet: gold plastic once earned, a dashed biro outline where one will go
const STAR = 'M12 2.1L14.7 8.88L21.99 9.36L16.38 14.02L18.17 21.09L12 17.2L5.83 21.09L7.62 14.02L2.01 9.36L9.3 8.88Z';
export const star = (on) => `<svg class="star ${on ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR}"/>${on ? '<ellipse cx="9.6" cy="10" rx="1.7" ry="1.1" fill="#fff" opacity=".85" transform="rotate(-30 9.6 10)"/>' : ''}</svg>`;
export const STAR_PATH = STAR;
