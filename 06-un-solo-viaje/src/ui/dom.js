// DOM plumbing for the screens over the canvas: building, wiring, swapping, toasts and the tutorial's
// note; the pictograms of the scale's keys and the route; the EAN-13 every label carries. Strings
// come from i18n (trusted, may hold <b>/<kbd>); anything else goes through esc().
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

// data-act buttons call acts[name](event, button); every press gets the scale's key click
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

// the tutorial's note: a strip of label tape pointing at what it means. `dir` is where its notch
// points (up: at something above it; down: at something below; none: free)
let hintHtml = null;
export function hint(html, r = null, dir = 'none') {
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

// ---- icons, in the round strokes of a label printer's pictograms ----
const svg = (body, cls = '', vb = '0 0 24 24') => `<svg class="ic ${cls}" viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const dot = (x, y, r = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
export const ICON = {
  soundOn: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2"/>'),
  soundOff: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  pause: svg('<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3"/>'),
  next: svg('<path d="M9.5 5.5L16 12l-6.5 6.5" stroke-width="2.4"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke="none"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>', 'i-lock'),
  share: svg('<path d="M12 15V3.8M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v5.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-5.2"/>'),
  retry: svg('<path d="M19.5 13a7.5 7.5 0 1 1-2.2-6.3"/><path d="M19.6 4v4.2h-4.2"/>'),
  menu: svg('<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>'),
  down: svg('<path d="M12 3.5v10.5M7.2 9.5L12 14.3l4.8-4.8"/><path d="M4 19.5h16"/>'),
  up: svg('<path d="M12 15V4.5M7.2 9L12 4.2 16.8 9"/><path d="M4 19.5h16"/>'),
  car: svg('<path d="M3.5 16.5v-3.7l2.1-4.6a1.6 1.6 0 0 1 1.5-.9h9.8a1.6 1.6 0 0 1 1.5.9l2.1 4.6v3.7z"/><path d="M4 12.8h16"/><circle cx="7.5" cy="16.8" r="1.7" fill="currentColor" stroke="none"/><circle cx="16.5" cy="16.8" r="1.7" fill="currentColor" stroke="none"/>'),
  bulb: svg('<path d="M9.3 17.5h5.4M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.7.6 1.1 1.4 1.1 2.3v.3h4.4v-.3c0-.9.4-1.7 1.1-2.3A5.5 5.5 0 0 0 12 3.5z"/>'),
  lapse: svg('<path d="M3.5 6.5l7.5 5.5-7.5 5.5zM12.5 6.5l7.5 5.5-7.5 5.5z" fill="currentColor" stroke="none"/>'),
  check: svg('<path d="M6.8 12.4l3.4 3.4 7-7.2" stroke-width="2.6"/>'),
};
// what the next step of the route wants a hand for
export const WHAT = {
  trunk: svg('<path d="M3 17.5V13a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4.5z"/><path d="M6.5 11l1.8-6.5h7.4L17.5 11"/><path d="M5.5 17.5v2M18.5 17.5v2M6 14.2h2M16 14.2h2"/>'),
  portal: svg(`<path d="M5 21V10a7 7 0 0 1 14 0v11zM12 21V8.8"/>${dot(10, 14.5, 0.9)}${dot(14, 14.5, 0.9)}`),
  door: svg(`<rect x="6" y="2.5" width="12" height="19" rx="1"/>${dot(15, 12.5, 1.1)}${dot(12, 6.8, 0.8)}`),
  call: svg('<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M12 6.3l2.6 3.4H9.4zM12 17.7l2.6-3.4H9.4z" fill="currentColor" stroke="none"/>'),
  floor: svg(`<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><circle cx="10" cy="7" r="1.3"/><circle cx="14" cy="7" r="1.3"/><circle cx="10" cy="12" r="1.3"/><circle cx="14" cy="12" r="1.3"/><circle cx="10" cy="17" r="1.3"/>${dot(14, 17, 1.5)}`),
  light: svg(`<rect x="6" y="3.5" width="12" height="17" rx="2.5"/><rect x="9.5" y="7.5" width="5" height="9" rx="1.2"/>${dot(12, 10, 1)}`),
  liftdoor: svg('<rect x="6" y="2.5" width="12" height="19" rx="1"/><rect x="10.8" y="5.5" width="2.4" height="7" rx=".6"/><path d="M15.3 12.3v3.4"/>'),
  reja: svg('<path d="M5 3v18M12 3v18M19 3v18"/><path d="M5 6l7 6-7 6M19 6l-7 6 7 6" stroke-width="1.5"/>'),
  intercom: svg('<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M9.2 6.5h5.6M9.2 9h5.6"/><circle cx="12" cy="14" r="1.3"/><circle cx="12" cy="18" r="1.3"/>'),
  bell: svg('<path d="M6 16.5h12l-1.6-2.2V10a4.4 4.4 0 0 0-8.8 0v4.3z"/><path d="M10.3 19a1.8 1.8 0 0 0 3.4 0"/>'),
  home: svg('<path d="M4 11.5L12 4l8 7.5"/><path d="M6.5 10v10h11V10"/><path d="M10.5 20v-5h3v5"/>'),
};
// the scale's PLU keys: one product that stands for each level, in flat print colours
const K = 'stroke="#1c1d1a" stroke-width="1.5" stroke-linejoin="round"';
const pic = (body) => `<svg class="plu-p" viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
const bottle = (x) => `<path d="M${x} 13.5l1.6-3.2V7.6h2.2v2.7l1.6 3.2v14h-5.4z" fill="#d7ebf5" ${K}/><rect x="${x + 1.5}" y="5.2" width="2.4" height="2.4" rx=".5" fill="#2d5f9a"/>`;
export const PLU = {
  bajo: pic(`<path d="M10 11.5l3-6.5h6l3 6.5v16.5H10z" fill="#f7f5ee" ${K}/><path d="M10 11.5h12M13 5l2.4 6.5" fill="none" ${K}/><rect x="10.75" y="16" width="10.5" height="6.5" fill="#3f7fc0"/><path d="M13 19.3h6" stroke="#f7f5ee" stroke-width="1.4"/>`),
  primero: pic(`${bottle(7)}${bottle(13.3)}${bottle(19.6)}<rect x="6" y="18" width="20" height="5" fill="#2d5f9a" ${K}/>`),
  quinto: pic(`<path d="M4.5 18.5h23l-2.4 7H6.9z" fill="#c9b08a" ${K}/><ellipse cx="10" cy="16.3" rx="3.1" ry="3.8" fill="#f6ead2" ${K}/><ellipse cx="16" cy="15.6" rx="3.1" ry="3.8" fill="#e9c9a0" ${K}/><ellipse cx="22" cy="16.3" rx="3.1" ry="3.8" fill="#f6ead2" ${K}/><path d="M4.5 18.5h23" fill="none" ${K}/>`),
  tercero: pic(`<path d="M14 3.5h4v5.7c0 1.2 3.4 2.6 3.4 6V27a1.5 1.5 0 0 1-1.5 1.5h-7.8a1.5 1.5 0 0 1-1.5-1.5V15.2c0-3.4 3.4-4.8 3.4-6z" fill="#2c4a33" ${K}/><rect x="13.6" y="3.2" width="4.8" height="4" fill="#6d1a2a"/><rect x="11.8" y="17" width="8.4" height="6.5" rx=".6" fill="#f3ece2"/><path d="M13.6 20.3h4.8" stroke="#6d1a2a" stroke-width="1.3"/>`),
  mes: pic(`<path d="M5.5 11v13.5a5 2.2 0 0 0 10 0V11" fill="#f7f6f1" ${K}/><ellipse cx="10.5" cy="11" rx="5" ry="2.2" fill="#fff" ${K}/><ellipse cx="10.5" cy="11" rx="1.6" ry=".7" fill="#b89a74"/><path d="M16.5 11v13.5a5 2.2 0 0 0 10 0V11" fill="#f7f6f1" ${K}/><ellipse cx="21.5" cy="11" rx="5" ry="2.2" fill="#fff" ${K}/><ellipse cx="21.5" cy="11" rx="1.6" ry=".7" fill="#b89a74"/><path d="M5.5 17.5h21" stroke="#7aa6c9" stroke-width="2.2"/>`),
  nochebuena: pic(`<ellipse cx="16" cy="25.5" rx="12.5" ry="2.6" fill="#e9eee6" ${K}/><path d="M6 23.5c0-6.2 4.6-10 10-10s10 3.8 10 10z" fill="#c8843f" ${K}/><path d="M10.5 16.5L7 11.5M21.5 16.5L25 11.5" stroke="#1c1d1a" stroke-width="4.6" stroke-linecap="round"/><path d="M10.5 16.5L7 11.5M21.5 16.5L25 11.5" stroke="#b8763f" stroke-width="2.6" stroke-linecap="round"/><circle cx="6.4" cy="10.6" r="1.7" fill="#f3ece2" ${K}/><circle cx="25.6" cy="10.6" r="1.7" fill="#f3ece2" ${K}/><path d="M11 20c2-1.6 8-1.6 10 0" fill="none" stroke="#e3a866" stroke-width="1.5" stroke-linecap="round"/>`),
};
// a check the scale prints: a filled circle with a tick where it was earned, an empty ring where not
export const checkMark = (on) => `<span class="ck ${on ? 'on' : ''}">${on ? ICON.check : ''}</span>`;

export function soundBtn(muted, label, cls = 'fk') {
  return `<button class="${cls}" data-act="mute" aria-pressed="${!muted}" aria-label="${esc(label)}" title="${esc(label)}">${muted ? ICON.soundOff : ICON.soundOn}</button>`;
}
export const bindMute = (onMute) => (e, b) => { const m = onMute(); b.setAttribute('aria-pressed', String(!m)); b.innerHTML = m ? ICON.soundOff : ICON.soundOn; };

const p2 = (n) => String(n).padStart(2, '0');
export const mss = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${p2(s % 60)}`; };
export const mssUp = (s) => { s = Math.max(0, Math.ceil(s - 1e-6)); return `${Math.floor(s / 60)}:${p2(s % 60)}`; };

// ---- EAN-13, the way a scale prints it: prefix 2 (variable weight), the PLU, then the grams ----
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((c) => c.replace(/./g, (b) => (b === '0' ? '1' : '0')));
const G = R.map((c) => [...c].reverse().join(''));
const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
export function ean13(plu, grams) {
  const d12 = `21${String(plu).padStart(5, '0')}${String(Math.round(grams) % 100000).padStart(5, '0')}`;
  const sum = [...d12].reduce((s, c, i) => s + +c * (i % 2 ? 3 : 1), 0);
  const code = d12 + ((10 - (sum % 10)) % 10);
  const par = PAR[+code[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (par[i - 1] === 'L' ? L : G)[+code[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[+code[i]];
  bits += '101';
  // guards run long: modules 0–2, 45–49 and 92–94
  const tall = (i) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  const bars = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    const b = bars[bars.length - 1];
    if (b && b.x + b.w === i && b.tall === tall(i)) b.w++;
    else bars.push({ x: i, w: 1, tall: tall(i) });
  }
  return { code, bars };
}
export function barcodeSVG(plu, grams) {
  const { code, bars } = ean13(plu, grams);
  const rects = bars.map((b) => `<rect x="${b.x + 9}" y="0" width="${b.w}" height="${b.tall ? 58 : 52}"/>`).join('');
  const t = (s, x) => `<text x="${x}" y="67.5">${s}</text>`;
  return `<svg class="ean" viewBox="0 0 113 69" role="img" aria-label="EAN ${code}"><g fill="currentColor">${rects}</g><g class="ean-d" fill="currentColor" text-anchor="middle" font-size="10.5">${t(code[0], 4.5)}${t(code.slice(1, 7), 33)}${t(code.slice(7), 80)}</g></svg>`;
}
