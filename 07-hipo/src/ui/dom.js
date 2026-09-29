// DOM plumbing for the screens over the canvas: building, wiring, swapping, toasts and the abuela's
// speech bubble; the poster's pictograms. Strings come from i18n (trusted, may hold <b>/<kbd>);
// anything else goes through esc().
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

// data-act buttons call acts[name](event, button); every press gets a little plop
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

// the abuela's speech bubble: anchored at a screen point (her mouth), its tail pointing down-left at
// her unless it had to flip to fit the screen
let hintHtml = null;
export function hint(html, at = null) {
  if (at) {
    const W = innerWidth, bw = Math.min(360, W - 24);
    let x = at.x - 34, flip = false;
    if (x + bw > W - 12) { x = Math.max(12, at.x + 34 - bw); flip = true; }
    x = Math.max(12, x);
    hintEl.style.setProperty('--x', `${Math.round(x)}px`);
    hintEl.style.setProperty('--y', `${Math.round(at.y)}px`);
    hintEl.style.setProperty('--w', `${bw}px`);
    hintEl.style.setProperty('--tx', `${Math.round(Math.min(bw - 30, Math.max(22, at.x - x)))}px`);
    hintEl.dataset.flip = flip ? '1' : '';
  }
  if (html === hintHtml) return;
  hintHtml = html;
  if (!html) { hintEl.classList.remove('in'); hintEl.hidden = true; return; }
  hintEl.innerHTML = html; hintEl.hidden = false;
  hintEl.classList.remove('in'); void hintEl.offsetWidth; hintEl.classList.add('in');
}

// ---- icons: fat rounded strokes, like the pictograms stencilled on a pool wall ----
const svg = (body, cls = '', vb = '0 0 24 24') => `<svg class="ic ${cls}" viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ICON = {
  soundOn: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2"/>'),
  soundOff: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  pause: svg('<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3.4"/>'),
  play: svg('<path d="M8 5.2v13.6L19 12z" fill="currentColor"/>'),
  next: svg('<path d="M9.5 5.5L16 12l-6.5 6.5" stroke-width="3"/>'),
  left: svg('<path d="M15 4.5L7.5 12l7.5 7.5" stroke-width="3.4"/>'),
  right: svg('<path d="M9 4.5l7.5 7.5L9 19.5" stroke-width="3.4"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke="none"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>', 'i-lock'),
  share: svg('<path d="M12 15V3.8M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v5.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-5.2"/>'),
  retry: svg('<path d="M19.5 13a7.5 7.5 0 1 1-2.2-6.3"/><path d="M19.6 4v4.2h-4.2"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>'),
  towel: svg('<path d="M5 6.5h11a3 3 0 0 1 3 3v8H8a3 3 0 0 1-3-3z"/><path d="M5 11h14M5 14.5h14" stroke-width="1.8"/>'),
  // a lung-ish puff: hold your breath
  breath: svg('<path d="M12 4v6.5"/><path d="M12 10.5c-1.8-2.6-6.8-2.2-6.8 3.4 0 3.2 1.4 5.6 4 5.6 2 0 2.8-1.6 2.8-4.2M12 10.5c1.8-2.6 6.8-2.2 6.8 3.4 0 3.2-1.4 5.6-4 5.6-2 0-2.8-1.6-2.8-4.2"/>'),
};
// a PREMIO ice-lolly stick, the game's star: printed wood with the word on it, or an empty slot
export const stick = (on, cls = '') => `<svg class="stk ${on ? 'on' : ''} ${cls}" viewBox="0 0 20 56" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="51" rx="7.5" class="stk-w"/><text x="10" y="28" class="stk-t" transform="rotate(-90 10 28)" text-anchor="middle" dominant-baseline="central">PREMIO</text></svg>`;

// the same stick lying down, as the result prints them: «★ PREMIO ★» burnt into the wood
export const stickH = (on) => `<svg class="stk h ${on ? 'on' : ''}" viewBox="0 0 132 32" aria-hidden="true"><rect x="2.5" y="2.5" width="127" height="27" rx="13.5" class="stk-w"/><text x="66" y="17" class="stk-t" text-anchor="middle" dominant-baseline="central">★ PREMIO ★</text></svg>`;

export function soundBtn(muted, label, cls = 'rb') {
  return `<button class="${cls}" data-act="mute" aria-pressed="${!muted}" aria-label="${esc(label)}" title="${esc(label)}">${muted ? ICON.soundOff : ICON.soundOn}</button>`;
}
export const bindMute = (onMute) => (e, b) => { const m = onMute(); b.setAttribute('aria-pressed', String(!m)); b.innerHTML = m ? ICON.soundOff : ICON.soundOn; };

const p2 = (n) => String(n).padStart(2, '0');
export const mss = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${p2(s % 60)}`; };
