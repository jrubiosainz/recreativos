// DOM plumbing for the screens over the canvas: building, wiring, swapping, toasts and the
// tutorial's sticky note. Strings come from i18n (trusted, may hold <b>/<kbd>).
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

// data-act buttons call acts[name](event, button); every press gets a soft click
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
  if (old) { old.classList.add('out'); old.inert = true; old._stop?.(); setTimeout(() => old.remove(), 260); }
  if (node) {
    root.appendChild(node);
    requestAnimationFrame(() => {
      const f = [...node.querySelectorAll('[data-autofocus]')].find((e) => e.offsetParent !== null);
      if (f && current === node) f.focus({ preventScroll: true });
    });
  }
}
export const hide = () => show(null);
export const screen = () => current?.dataset.screen || null;
export const currentNode = () => current;

// timers that die with their screen
export function later(node, ms, fn) { const id = setTimeout(() => node.isConnected && fn(), ms); const prev = node._stop; node._stop = () => { clearTimeout(id); prev?.(); }; }
export function every(node, ms, fn) { const id = setInterval(() => (node.isConnected ? fn() : clearInterval(id)), ms); const prev = node._stop; node._stop = () => { clearInterval(id); prev?.(); }; }

let toastT = 0;
export function toast(html, ms = 2400) {
  toastEl.innerHTML = html;
  toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// the tutorial's note, pinned beside what it explains; `dir` says where the arrow points: 'up' or 'down'
let hintHtml = null;
export function hint(html, r = null, dir = 'up') {
  if (r) {
    hintEl.style.setProperty('--x', `${r.x}px`); hintEl.style.setProperty('--y', `${r.y}px`); hintEl.style.setProperty('--w', `${r.w}px`);
    hintEl.style.setProperty('--p', r.p != null ? `${r.p}px` : '50%');
    hintEl.dataset.dir = dir;
  }
  if (html === hintHtml) return;
  hintHtml = html;
  if (!html) { hintEl.classList.remove('in'); hintEl.hidden = true; return; }
  hintEl.innerHTML = html; hintEl.hidden = false;
  hintEl.classList.remove('in'); void hintEl.offsetWidth; hintEl.classList.add('in');
}

// ---- icons ----
const svg = (body, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ICON = {
  soundOn: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2"/>'),
  soundOff: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  pause: svg('<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3.2"/>'),
  back: svg('<path d="M14.5 5.5L8 12l6.5 6.5" stroke-width="2.6"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke="none"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>', 'i-lock'),
  share: svg('<path d="M12 15V3.8M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v5.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-5.2"/>'),
  retry: svg('<path d="M19.5 13a7.5 7.5 0 1 1-2.2-6.3"/><path d="M19.6 4v4.2h-4.2"/>'),
  ticket: svg('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5v2.2a2.3 2.3 0 0 0 0 4.6v2.2A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5v-2.2a2.3 2.3 0 0 0 0-4.6z"/><path d="M14.5 6.5v11" stroke-dasharray="1.6 2.2" stroke-width="1.8"/>'),
  next: svg('<path d="M9.5 5.5L16 12l-6.5 6.5" stroke-width="2.6"/>'),
  roll: svg('<rect x="3.5" y="6" width="11" height="12" rx="2"/><path d="M14.5 8.5h6v7h-6M6.5 6V4.5h5V6M17 8.5v7" stroke-width="2"/>'),
  album: svg('<rect x="4" y="3.5" width="15.5" height="17" rx="2"/><path d="M8 3.5v17"/><path d="M11 9.5h5.5M11 13h4" stroke-width="2"/>'),
};
const starSvg = (on) => `<svg class="star ${on ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.75 5.9 6.45.75-4.78 4.4 1.3 6.37L12 17.02l-5.72 3.2 1.3-6.37L2.8 9.45l6.45-.75z"/></svg>`;
export const stars = (set) => `<span class="stars">${[0, 1, 2].map((i) => starSvg(set?.[i])).join('')}</span>`;
export const starIcon = starSvg;

export function soundBtn(muted, label) {
  return `<button class="rb" data-act="mute" aria-pressed="${!muted}" aria-label="${label}" title="${label}">${muted ? ICON.soundOff : ICON.soundOn}</button>`;
}
export const bindMute = (onMute) => (e, b) => { const m = onMute(); b.setAttribute('aria-pressed', String(!m)); b.innerHTML = m ? ICON.soundOff : ICON.soundOn; };
