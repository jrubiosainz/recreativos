// DOM plumbing for the screens over the canvas: building, wiring, swapping, toasts and the
// tutorial's note. Strings come from i18n (trusted, may hold <b>/<kbd>); anything else goes through esc().
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

// data-act buttons call acts[name](event, button); every press gets the ticket's soft click
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

// the tutorial's note, pinned under your feet (or over your head); `dir` is where its arrow points
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

// ---- icons, drawn with the signage's round strokes ----
const svg = (body, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const ICON = {
  soundOn: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2"/>'),
  soundOff: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  pause: svg('<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3.2"/>'),
  back: svg('<path d="M14.5 5.5L8 12l6.5 6.5" stroke-width="2.6"/>'),
  next: svg('<path d="M9.5 5.5L16 12l-6.5 6.5" stroke-width="2.6"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke="none"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>', 'i-lock'),
  share: svg('<path d="M12 15V3.8M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v5.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-5.2"/>'),
  retry: svg('<path d="M19.5 13a7.5 7.5 0 1 1-2.2-6.3"/><path d="M19.6 4v4.2h-4.2"/>'),
  ticket: svg('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5v2.2a2.3 2.3 0 0 0 0 4.6v2.2A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5v-2.2a2.3 2.3 0 0 0 0-4.6z"/><path d="M14.5 6.5v11" stroke-dasharray="1.6 2.2" stroke-width="1.8"/>'),
  train: svg('<rect x="5" y="3.5" width="14" height="14" rx="3.5"/><path d="M5 10.5h14" stroke-width="2"/><circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/><path d="M8.5 17.5L6.5 21M15.5 17.5l2 3.5"/>'),
};
// the green arrow of an entry validator (a flat enamel plate, not a stroke)
export const GO = '<svg class="go-ar" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4L36 21H26.5V36h-13V21H4z" fill="currentColor"/></svg>';
// the network's mark: two arrows, one each way, in a rounded square (the canvas draws the same one)
export const MARK = `<svg class="mark" viewBox="-50 -50 100 100" aria-hidden="true"><rect x="-44" y="-44" width="88" height="88" rx="18" fill="none" stroke="currentColor" stroke-width="7"/>${[-1, 1].map((s) => {
  const x = s * 15, p = [[x - 5, s * 26], [x + 5, s * 26], [x + 5, -s * 6], [x + 14, -s * 6], [x, -s * 28], [x - 14, -s * 6], [x - 5, -s * 6]];
  return `<path d="M${p.map((q) => q.join(' ')).join('L')}z" fill="currentColor"/>`;
}).join('')}</svg>`;

// stars are punched through the card by the validator: a hole where it was earned, a faint guide where not
const STAR = 'M12 2.4l2.83 6.08 6.65.77-4.93 4.54 1.34 6.57L12 17.07l-5.89 3.29 1.34-6.57L2.52 9.25l6.65-.77z';
export const punch = (on, cls = '') => `<svg class="pu ${on ? 'on' : ''} ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR}"/></svg>`;
export const punches = (set, cls = '') => `<span class="pus">${[0, 1, 2].map((i) => punch(set?.[i], cls)).join('')}</span>`;

export function soundBtn(muted, label, cls = 'rb') {
  return `<button class="${cls}" data-act="mute" aria-pressed="${!muted}" aria-label="${esc(label)}" title="${esc(label)}">${muted ? ICON.soundOff : ICON.soundOn}</button>`;
}
export const bindMute = (onMute) => (e, b) => { const m = onMute(); b.setAttribute('aria-pressed', String(!m)); b.innerHTML = m ? ICON.soundOff : ICON.soundOn; };

// 08:02:20 from seconds of the day; m:ss for a countdown
const p2 = (n) => String(n).padStart(2, '0');
export const hms = (s) => { s = Math.max(0, Math.floor(s)); return `${p2(Math.floor(s / 3600) % 24)}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}`; };
export const hm = (s) => hms(s).slice(0, 5);
export const mss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${p2(s % 60)}`; };
