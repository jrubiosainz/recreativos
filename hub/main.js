import { GAMES, progressOf } from './games.js';
import { STR, AFTER, DAY_INK } from './i18n.js';
import { bunting } from './bunting.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const low = (s) => (/^[«“"¡¿]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

// ── what we remember: the edition you chose, and how far along each act was last time you looked ──
const KEY = 'fiestas.v1';
function readMemo() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { m = null; }
  if (!m || typeof m !== 'object') m = {};
  if (!m.seen || typeof m.seen !== 'object') m.seen = {};
  return m;
}
function writeMemo() { try { localStorage.setItem(KEY, JSON.stringify(memo)); } catch { /* storage unavailable */ } }
const memo = readMemo();

const q = new URLSearchParams(location.search);
const detect = () => {
  const l = (navigator.languages?.[0] || navigator.language || 'es').toLowerCase();
  return /^(es|ca|gl|eu)\b/.test(l) ? 'es' : 'en';
};
let lang = STR[q.get('lang')] ? q.get('lang') : STR[memo.lang] ? memo.lang : detect();
let explicit = !!(STR[q.get('lang')] || STR[memo.lang]);
const T = () => STR[lang];
const hrefOf = (g) => `${g.slug}/${explicit ? `?lang=${lang}` : ''}`;

// ── little drawings in the programme's own hand ──
const ICON = {
  cafe: `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M24 8c-3 4 3 6 0 10M33 6c-3 4 3 6 0 10M42 8c-3 4 3 6 0 10"/><path d="M14 26h36v10a16 16 0 0 1-16 16h-4a16 16 0 0 1-16-16z"/>
    <path d="M50 29h3a6 6 0 0 1 0 12h-4"/><path d="M8 57h48"/></g></svg>`,
  optica: `<svg viewBox="0 0 72 40" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round">
    <circle cx="18" cy="22" r="13"/><circle cx="54" cy="22" r="13"/><path d="M31 20q5-5 10 0M5 18 1 10M67 18l4-8"/></g>
    <circle cx="18" cy="23" r="3.6" fill="currentColor"/><path d="M47 24q7 6 14 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  churros: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 34h32l-4 22H20z" fill="#7A3E1D" stroke="#1D1A17" stroke-width="3" stroke-linejoin="round"/>
    <path d="M30 36 44 6" stroke="#1D1A17" stroke-width="10" stroke-linecap="round"/><path d="M30 36 44 6" stroke="#E2A04A" stroke-width="6" stroke-linecap="round"/>
    <path d="M33 29l3 1.5M36 22.5l3 1.5M39 16l3 1.5M42 10l2.4 1.2" stroke="#1D1A17" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M13 34h38" stroke="#1D1A17" stroke-width="3" stroke-linecap="round"/></svg>`,
  tape: `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round">
    <circle cx="24" cy="28" r="20"/><circle cx="24" cy="28" r="8"/><path d="M24 48H58l3-2-3-2 3-2-3-2H40"/></g>
    <circle cx="24" cy="28" r="14" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".55"/>
    <path d="M12 21a13 13 0 0 1 8-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/></svg>`,
};
const SIGN = `<svg viewBox="0 0 150 58" aria-hidden="true"><path d="M6 40C14 14 26 4 26 18s-10 30-2 30 14-26 22-26-4 22 4 22 10-18 18-18 0 14 8 14 12-16 20-16-2 10 6 10 14-8 22-8"/>
  <path d="M22 52c34-6 76-7 122-9"/></svg>`;

// a hand-drawn ring, sized to the thing it circles; it goes round once and a bit, never quite closing
function ringPath(w, h, seed) {
  const cx = w / 2, cy = h / 2, rx = w / 2 + 1, ry = h / 2 + 1, pts = [];
  const a0 = -2.5 + seed * .4, turn = Math.PI * 2 + .55;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, a = a0 + turn * t;
    const wob = 1 + .05 * Math.sin(3 * a + seed) + .07 * t;
    pts.push(`${(cx + rx * wob * Math.cos(a)).toFixed(1)} ${(cy + ry * wob * Math.sin(a) - t * 3).toFixed(1)}`);
  }
  return `M${pts.join('L')}`;
}

// ── the programme, set in type ──
// a display line never ends on an article or a preposition: «GATO / CON TOSTADA», not «GATO CON / TOSTADA»
const tie = (s) => s.replace(/(^|\s)(\p{L}{1,3}) /gu, '$1$2\u00a0').replace(/(^|\s)(\p{L}{1,3}) /gu, '$1$2\u00a0');
function actHTML(g, i) {
  const t = T(), a = t.acts[g.slug], d = g[lang], id = i + 1, href = hrefOf(g), img = `hub/img/${g.slug}`;
  const load = i ? 'loading="lazy"' : 'fetchpriority="high"';
  return `<article class="act ink-${DAY_INK[i % 4]}" id="d${id}" aria-labelledby="t${id}">
  <p class="ribbon">${esc(t.days[i])}</p>
  <div class="act-body">
    <span class="hour">${esc(t.hour(a.h))}</span>
    <h3 id="t${id}">${esc(tie(d.t))}</h3>
    <p class="what">${esc(a.act)}<em>${esc(a.place)}</em></p>
    <p class="biro went" hidden></p>
    <div class="stage">
      <a class="photo" href="${href}" tabindex="-1" aria-hidden="true"><img src="${img}-480.jpg" srcset="${img}-480.jpg 480w, ${img}-960.jpg 960w" sizes="(min-width: 1024px) 620px, (min-width: 700px) 75vw, 90vw" width="1200" height="630" alt="${esc(t.photo(d.t))}" ${load} decoding="async"></a>
      <a class="go" href="${href}" aria-label="${esc(`${t.go} ${t.goAria(d.t)}`)}"><span>${esc(t.go)}</span></a>
      <p class="stamp" hidden>${esc(t.done)}</p>
    </div>
    <p class="pitch">${esc(d.pitch)}</p>
    <p class="meta"><b>${esc(t.how)}</b>${esc(low(d.how))} · ${esc(t.count(g.n, d.unit))}</p>
    <p class="note">${esc(a.note)}</p>
  </div>
</article>`;
}

function adHTML(id) {
  const t = T(), a = t.ads[id];
  const nm = a.split ? `<span>${esc(a.split[0])}</span>${esc(a.split[1])}` : esc(tie(a.name));
  return `<div class="ad ad-${id}">${ICON[id]}<div><span class="vh">${esc(t.adAria)}: </span><strong class="nm">${nm}</strong>${a.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div></div>`;
}

function saludaHTML() {
  const s = T().saluda;
  return `<section class="saluda"><h3>${esc(tie(s.h))}</h3>${s.p.map((p) => `<p>${esc(p)}</p>`).join('')}`
    + `<p class="bye">${esc(s.bye)}</p><p class="sign">${SIGN}<span class="biro">${esc(s.sign)}</span></p></section>`;
}

function indexHTML() {
  const t = T();
  return GAMES.map((g, i) => `<li><a href="#d${i + 1}"><span>${esc(t.days[i])}</span><span class="ix-t">${esc(g[lang].t)}`
    + `<span class="ix-tick" hidden><span aria-hidden="true">✓</span><span class="vh"> (${esc(t.went)})</span></span></span>`
    + `<span class="ix-h">${esc(t.hour(t.acts[g.slug].h))}</span></a></li>`).join('');
}

function stripHTML() {
  const t = T();
  return GAMES.map((g, i) => `<li><a class="ink-${DAY_INK[i % 4]}" href="#d${i + 1}"><span class="vh">${esc(t.days[i].replace(/\s*\d+$/, ''))} </span>${i + 1}`
    + `<span class="vh">: ${esc(g[lang].t)}</span></a></li>`).join('');
}

function backHTML() {
  const t = T();
  return `<p class="fin">${esc(t.foot.h)}</p>`
    + `<ul>${t.foot.small.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`
    + `<p class="up"><a class="top" href="#portada"><span aria-hidden="true">↑</span>&nbsp;${esc(t.top)}</a></p>`;
}

function render() {
  let h = '';
  GAMES.forEach((g, i) => {
    h += actHTML(g, i);
    const x = AFTER[i + 1];
    if (x) h += x === 'saluda' ? saludaHTML() : adHTML(x);
  });
  $('#days').innerHTML = h;
  $('#index ol').innerHTML = indexHTML();
  $('#strip ol').innerHTML = stripHTML();
  const back = $('#back');
  back.querySelectorAll(':scope > :not(.bunting)').forEach((n) => n.remove());
  back.insertAdjacentHTML('beforeend', backHTML());
}

function applyStatic() {
  const t = T();
  document.documentElement.lang = lang;
  document.title = t.title;
  $('meta[name="description"]')?.setAttribute('content', t.desc);
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t[el.dataset.t];
  const b = $('#lang');
  b.textContent = t.lang;
  b.lang = lang === 'es' ? 'en' : 'es';
  $('#salon').href = explicit ? `./?lang=${lang}` : './';
  $('#index').setAttribute('aria-label', t.index);
  $('#strip').setAttribute('aria-label', t.index);
}

// ── the pen: every act you have been to gets a ring round its hour, a note, and a stamp once it is complete ──
const wake = new IntersectionObserver((es) => {
  for (const e of es) {
    if (!e.isIntersecting) continue;
    wake.unobserve(e.target);
    const els = [e.target, ...e.target.querySelectorAll('.pend')].filter((el) => el.classList.contains('pend'));
    for (const el of els) el.classList.replace('pend', el.classList.contains('ring') ? 'draw' : el.classList.contains('stamp') ? 'thunk' : 'write');
  }
}, { threshold: .45 });
document.addEventListener('animationend', (e) => e.target.closest?.('.draw, .write, .thunk')?.classList.remove('draw', 'write', 'thunk'));

function layoutRings() {
  for (const svg of document.querySelectorAll('.ring')) {
    const r = svg.getBoundingClientRect();
    if (!r.width) continue;
    const path = svg.firstElementChild;
    svg.setAttribute('viewBox', `0 0 ${r.width.toFixed(1)} ${r.height.toFixed(1)}`);
    path.setAttribute('d', ringPath(r.width, r.height, +svg.closest('.act').id.slice(1)));
    path.style.setProperty('--len', Math.ceil(path.getTotalLength() + 4));
  }
}

function marks(animate) {
  const t = T(), still = !animate || reduce.matches;
  const before = GAMES.filter((g) => +memo.seen[g.slug] > 0).length;
  let n = 0;
  GAMES.forEach((g, i) => {
    const p = progressOf(g), art = $(`#d${i + 1}`), now = p.played ? 1 + p.stars : 0;
    const fresh = !still && now > (+memo.seen[g.slug] || 0), full = p.played && p.stars >= p.max;
    if (p.played) n++;
    const hour = $('.hour', art);
    let ring = $('.ring', hour);
    if (p.played && !ring) {
      hour.insertAdjacentHTML('beforeend', '<svg class="ring" aria-hidden="true" focusable="false"><path/></svg>');
      ring = $('.ring', hour);
      if (fresh) ring.classList.add('pend');
    } else if (!p.played && ring) ring.remove();
    const went = $('.went', art);
    went.textContent = p.stars ? `${t.went} · ${t.stars(p.stars, p.max)}` : t.went;
    went.hidden = !p.played;
    if (fresh) went.classList.add('pend');
    const stamp = $('.stamp', art);
    if (fresh && full) stamp.classList.add('pend');
    stamp.hidden = !full;
    const tick = $(`#index li:nth-child(${i + 1}) .ix-tick`);
    if (tick) tick.hidden = !p.played;
    if (fresh) wake.observe($('.act-body', art));
    memo.seen[g.slug] = now;
  });
  const been = $('#been');
  been.textContent = t.been(n);
  been.hidden = !n;
  if (!still && n > before) { been.classList.add('pend'); wake.observe(been); }
  writeMemo();
  layoutRings();
}

// ── the masthead is set to the measure: each line grows until it fills the column exactly ──
const range = document.createRange();
function fit(el, shadow = 0) {
  if (!el) return;
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  for (let k = 0; k < 3; k++) {
    range.selectNodeContents(el);
    const w = range.getBoundingClientRect().width, avail = el.clientWidth;
    if (!w || !avail) return;
    size *= avail / (w + shadow * size);
    el.style.fontSize = `${size.toFixed(2)}px`;
  }
}
function relayout() {
  fit($('.mast-big'), .055);
  fit($('.mast-de'));
  fit($('#back .fin'), .055);
  layoutRings();
}

// ── the contents follow you down the programme: today is the last day whose act has reached 40% of the screen ──
let acts = [], today = null, spyQ = 0;
function spy() {
  spyQ = 0;
  const line = innerHeight * .4;
  let c = acts[0] || null;
  for (const a of acts) { if (a.getBoundingClientRect().top <= line) c = a; else break; }
  if (c === today) return;
  today = c;
  let on = null;
  for (const a of document.querySelectorAll('#index a')) {
    if (c && a.hash === `#${c.id}`) { a.setAttribute('aria-current', 'location'); on = a; } else a.removeAttribute('aria-current');
  }
  // on a short screen the open cover scrolls on its own: keep today's line in sight
  const box = $('#portada');
  if (on && box.scrollHeight > box.clientHeight + 1) {
    const r = on.getBoundingClientRect(), b = box.getBoundingClientRect();
    box.scrollTop = Math.max(0, r.bottom - b.top + box.scrollTop - box.clientHeight + 24);
  }
}
const queueSpy = () => { if (!spyQ) spyQ = requestAnimationFrame(spy); };
const watch = () => { acts = [...document.querySelectorAll('.act')]; today = null; queueSpy(); };
addEventListener('scroll', queueSpy, { passive: true });

function build(animate) {
  render();
  applyStatic();
  marks(animate);
  relayout();
  watch();
}

// ── the other edition: same programme, same page you were reading ──
$('#lang').addEventListener('click', () => {
  const anchor = window.scrollY > 0 ? [...document.querySelectorAll('.act')].find((el) => el.getBoundingClientRect().bottom > 0) : null;
  const top = anchor?.getBoundingClientRect().top;
  lang = lang === 'es' ? 'en' : 'es';
  explicit = true;
  memo.lang = lang;
  writeMemo();
  const u = new URL(location.href);
  u.searchParams.set('lang', lang);
  history.replaceState(history.state, '', u);
  build(false);
  if (anchor) window.scrollBy({ top: document.getElementById(anchor.id).getBoundingClientRect().top - top, behavior: 'instant' });
});

// ── boot: set the type, hang the bunting, then open the programme once the fonts are in ──
$('#back').insertAdjacentHTML('afterbegin', '<svg class="bunting" aria-hidden="true" focusable="false"></svg>');
build(true);
const front = bunting($('#portada .bunting'), $('#portada'), 1);
const rear = bunting($('#back .bunting'), $('#back'), 3);

const fontsIn = Promise.all(['400 16px Ultra', '800 16px Archivo', '16px Biro'].map((s) => document.fonts.load(s))).catch(() => {});
Promise.race([fontsIn, new Promise((r) => setTimeout(r, 900))]).then(() => {
  relayout();
  document.documentElement.classList.add('ready');
  front.enter();
  window.__ready = true;
});
document.fonts.addEventListener?.('loadingdone', () => requestAnimationFrame(relayout));
new IntersectionObserver(([e], o) => { if (e.isIntersecting) { rear.enter(); o.disconnect(); } }, { threshold: .25 }).observe($('#back'));

let raf = 0;
addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { relayout(); queueSpy(); }); });
// back from a game: through the back/forward cache the module does not run again, so look at the saves once more
addEventListener('pageshow', (e) => { if (e.persisted) marks(true); });
addEventListener('storage', (e) => { if (!e.key || GAMES.some((g) => g.save === e.key)) marks(true); });
