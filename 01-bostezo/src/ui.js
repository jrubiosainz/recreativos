// DOM screens over the canvas: title, week calendar, invite, pause and the three outcomes.
// Every string comes from i18n (trusted, may contain <b>/<kbd>); numbers are formatted here.
import { t, getLang } from './i18n.js';
import { Audio } from './audio.js';
import { fmtTime } from './util.js';

const root = document.getElementById('ui');
const capEl = document.getElementById('caption');
const toastEl = document.getElementById('toast');
let current = null;

// ---------- plumbing ----------
function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function wire(node, acts) {
  node.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', (e) => {
      const fn = acts[b.dataset.act];
      if (!fn || b.getAttribute('aria-disabled') === 'true') return;
      if (b.dataset.sfx === 'back') Audio.sfx.uiBack(); else Audio.sfx.uiClick();
      fn(e, b);
    });
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && Audio.unlocked && b.getAttribute('aria-disabled') !== 'true') Audio.sfx.uiHover(); });
  });
  return node;
}

export function show(node) {
  const old = current;
  current = node;
  if (old) {
    old.classList.add('out');
    old.inert = true;
    setTimeout(() => old.remove(), 240);
  }
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

let toastT = 0;
export function toast(html, { top = false, ms = 1900 } = {}) {
  toastEl.innerHTML = html;
  toastEl.classList.toggle('top', top);
  toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
}

let capHtml = null;
export function caption(html) {
  if (html === capHtml) return;
  capHtml = html;
  if (!html) { capEl.hidden = true; capEl.innerHTML = ''; return; }
  capEl.innerHTML = html;
  capEl.hidden = false;
  capEl.classList.remove('in'); void capEl.offsetWidth; capEl.classList.add('in');
}
export function placeCaption(r) {
  if (!r) return;
  capEl.style.setProperty('--x', `${r.x}px`);
  capEl.style.setProperty('--y', `${r.y}px`);
  capEl.style.setProperty('--w', `${r.w}px`);
}

// ---------- drawn in the world's grammar ----------
const STAR_PATH = 'M12 2.4l2.85 5.95 6.55.85-4.8 4.5 1.25 6.5L12 16.95 6.15 20.2l1.25-6.5-4.8-4.5 6.55-.85z';
export const star = (on) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="${on ? 'star-on' : 'star-off'}" d="${STAR_PATH}"/></svg>`;
const I = {
  soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
  lock: '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke="none"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.5"/><rect x="13.5" y="5" width="4" height="14" rx="1.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" fill="#ffd166"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="#c3b3ff"/><path d="M3.8 7l8.2 6.2L20.2 7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="7" y="2.8" width="10" height="18.4" rx="2.6" fill="#1d1733"/><path d="M10.5 18h3" stroke="#fff8ec"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="2.4" fill="#c3b3ff"/><path d="M10.5 18h3"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.8M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v5.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-5.2"/></svg>',
};
export const ICON = I;

const pad2 = (n) => String(n).padStart(2, '0');
export const clock = (mins) => `${Math.floor(mins / 60)}:${pad2(Math.floor(mins % 60))}`;
const startMin = (L) => L.hour * 60 + (L.min || 0);
export const whenText = (L) => `${t('days')[L.day]} · ${clock(startMin(L))}`;
const durText = (L) => { const h = Math.floor(L.time / 60), m = L.time % 60; return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; };
const dayShort = (d) => t('days')[d].slice(0, 3).toUpperCase();

function soundBtn(muted) {
  return `<button class="btn round" data-act="mute" aria-pressed="${!muted}" aria-label="${t('sound')}" title="${t('sound')}">${muted ? I.soundOff : I.soundOn}</button>`;
}
function bindMute(onMute) {
  return (e, btn) => { const m = onMute(); btn.setAttribute('aria-pressed', String(!m)); btn.innerHTML = m ? I.soundOff : I.soundOn; };
}

// ---------- title ----------
export function titleScreen({ muted, cont, bestLine, onPlay, onWeek, onMute, onLang }) {
  const word = t('title');
  const letters = [...word].map((c, i) => `<span data-c="${c}" style="--i:${i}" aria-hidden="true">${c}</span>`).join('');
  const node = el(`<section class="screen title" data-screen="title">
    <div class="corner">
      ${soundBtn(muted)}
      <button class="btn small" data-act="lang" lang="${getLang() === 'es' ? 'en' : 'es'}">${t('lang')}</button>
    </div>
    <header class="brand">
      <h1 class="logo" aria-label="${word}">${letters}</h1>
      <p class="tagline">${t('tagline')}</p>
      <p class="sub">${t('sub')}</p>
    </header>
    <div class="actions">
      <button class="btn primary big" data-act="play" data-autofocus>${cont ? t('cont') : t('play')}</button>
      ${cont ? `<div class="row"><button class="btn small" data-act="week">${t('meetings')}</button></div>` : ''}
      ${bestLine ? `<p class="best-line">${bestLine}</p>` : ''}
      <p class="about">${t('about')}</p>
    </div>
  </section>`);
  return wire(node, { play: onPlay, week: onWeek, mute: bindMute(onMute), lang: onLang });
}

// ---------- week ----------
const H0 = 8, H1 = 20;
export function weekScreen({ levels, states, stars, maxStars, onPick, onBack }) {
  const next = levels.findIndex((_, i) => states[i].state === 'next');
  const blocks = (d) => levels.map((L, i) => ({ L, i, s: states[i] })).filter((o) => o.L.day === d);
  const block = ({ L, i, s }, agenda) => {
    const a = startMin(L), b = a + L.time;
    const top = ((a / 60 - H0) / (H1 - H0)) * 100, h = (L.time / 60 / (H1 - H0)) * 100;
    const st = s.state === 'locked' ? '' : `<span class="stars" aria-label="${s.stars}/3">${[0, 1, 2].map((k) => star(k < s.stars)).join('')}</span>`;
    const label = `${t('levels.' + L.id)} · ${t('days')[L.day]} ${clock(a)}${s.state === 'locked' ? ' · ' + t('locked') : ''}`;
    const inner = agenda
      ? `<span class="when">${clock(a)}</span><span class="what"><span class="t">${s.state === 'locked' ? I.lock : ''}${t('levels.' + L.id)}</span><span class="r">${t('rooms.' + L.room)} · ${clock(a)}–${clock(b)}</span></span>${st}`
      : `<b>${clock(a)}–${clock(b)}</b><span class="t">${s.state === 'locked' ? I.lock : ''}${t('levels.' + L.id)}</span><span class="r">${t('rooms.' + L.room)}</span>${st}`;
    return `<button class="mtg ${s.state}" style="--top:${top}%;--h:${h}%;--n:${i}" data-act="pick" data-i="${i}" aria-label="${label}"${s.state === 'locked' ? ' aria-disabled="true"' : ''}${i === next ? ' data-autofocus' : ''}>${inner}</button>`;
  };
  const nowL = levels[next >= 0 ? next : 0];
  const nowTop = (((startMin(nowL) - 6) / 60 - H0) / (H1 - H0)) * 100;
  const hours = Array.from({ length: H1 - H0 - 1 }, (_, k) => `<span style="top:${((k + 1) / (H1 - H0)) * 100}%">${H0 + k + 1}:00</span>`).join('');
  const days = [0, 1, 2, 3, 4];
  const node = el(`<section class="screen scrim" data-screen="week">
    <div class="app" role="dialog" aria-label="${t('week')}">
      <div class="app-bar">
        <button class="link" data-act="back" data-sfx="back" aria-label="${t('back')}">${I.back}</button>
        <h2>${t('week')}</h2>
        <span class="tally" aria-label="${t('res.stars')}: ${stars}/${maxStars}">${star(true)} ${stars}/${maxStars}</span>
      </div>
      <div class="cal">
        <div></div>
        ${days.map((d) => `<div class="cal-head${d === nowL.day ? ' today' : ''}">${t('days')[d]}<small>${blocks(d).length === 1 ? t('mtg1') : t('mtgN', { n: blocks(d).length })}</small></div>`).join('')}
        <div class="cal-gutter">${hours}</div>
        ${days.map((d) => `<div class="cal-day">${blocks(d).map((o) => block(o, false)).join('')}${d === nowL.day && next >= 0 ? `<div class="now-line" style="--top:${nowTop}%"><span>${t('now')}</span></div>` : ''}</div>`).join('')}
      </div>
      <div class="agenda">
        ${days.map((d) => `<h3>${t('days')[d]}</h3>${blocks(d).map((o) => block(o, true)).join('')}`).join('')}
        <h3>${t('weekend')}</h3><p class="weekend">${t('weekendNote')}</p>
      </div>
    </div>
  </section>`);
  node.querySelectorAll('.mtg.locked').forEach((b) => b.addEventListener('click', () => {
    b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
    Audio.sfx.uiBack();
  }));
  return wire(node, { back: onBack, pick: (e, b) => onPick(+b.dataset.i) });
}

export function bootScreen() {
  return el(`<section class="screen" data-screen="boot"><p class="boot">${t('loading')}</p></section>`);
}

// ---------- invite ----------
export function inviteScreen({ level: L, people, news, onAccept, onBack }) {
  const a = startMin(L), org = L.ceo ? t('ceo') : t('boss');
  const node = el(`<section class="screen scrim" data-screen="invite">
    <article class="doc invite" style="--tilt:-0.6deg" aria-labelledby="inv-title">
      <div class="doc-bar">
        <button class="link" data-act="back" data-sfx="back" aria-label="${t('back')}" style="color:var(--ink);margin-left:-0.6rem">${I.back}</button>
        <span class="mini-cal" aria-hidden="true"><b>${dayShort(L.day)}</b><i>${clock(a)}</i></span>
        <span>${t('invite')} · ${t('meeting')}</span>
      </div>
      <div class="doc-body">
        <h2 id="inv-title">${t('levels.' + L.id)}</h2>
        <dl class="fields">
          <dt>${t('organizer')}</dt><dd>${org}</dd>
          <dt>${t('when')}</dt><dd>${t('days')[L.day]}, ${clock(a)}–${clock(a + L.time)} <span class="muted">(${durText(L)})</span></dd>
          <dt>${t('where')}</dt><dd>${t('rooms.' + L.room)}</dd>
          <dt>${t('attendees')}</dt><dd>${t('you')} <span class="muted">+ ${t('people', { n: people - 1 })}</span></dd>
          <dt>${t('attendance')}</dt><dd><span class="tag hot">${t('mandatory')}</span></dd>
        </dl>
        <section class="goal">
          <h3>${t('goal')}</h3>
          <p>${t('goalText', { n: `<b>${L.target}</b>` })}</p>
          <p>${t('kText', { k: L.K })}</p>
        </section>
        ${news.length ? `<section class="news"><h3>${t('new')}</h3>${news.map((n, i) => `<div class="news-card"><div class="pic" data-pic="${i}"></div><div>${n.html}</div></div>`).join('')}</section>` : ''}
      </div>
      <div class="doc-foot">
        <button class="btn small decline" data-act="decline" data-sfx="back">${t('decline')}</button>
        <span class="spacer"></span>
        <button class="btn primary" data-act="accept" data-autofocus>${t('accept')}</button>
      </div>
    </article>
  </section>`);
  news.forEach((n, i) => { const pic = node.querySelector(`[data-pic="${i}"]`); if (n.pic) pic.appendChild(n.pic); });
  const acc = node.querySelector('[data-act="accept"]');
  node.setProgress = (p) => {
    if (p == null) { acc.classList.remove('loading'); acc.removeAttribute('aria-disabled'); acc.textContent = t('accept'); return; }
    acc.classList.add('loading'); acc.setAttribute('aria-disabled', 'true');
    acc.style.setProperty('--p', `${Math.round(p * 100)}%`);
    acc.textContent = t('connecting', { p: Math.round(p * 100) });
  };
  return wire(node, {
    back: onBack,
    accept: onAccept,
    decline: (e, b) => {
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
      b.textContent = t('notOptional');
    },
  });
}

// ---------- pause ----------
export function pauseScreen({ muted, onResume, onRestart, onQuit, onMute }) {
  const node = el(`<section class="screen scrim" data-screen="pause">
    <div class="panel" role="dialog" aria-labelledby="pz">
      <h2 id="pz">${t('paused')}</h2>
      <button class="btn primary" data-act="resume" data-autofocus>${t('resume')}</button>
      <button class="btn" data-act="restart">${t('restart')}</button>
      <button class="btn" data-act="quit" data-sfx="back">${t('quit')}</button>
      <div class="row">${soundBtn(muted)}</div>
    </div>
  </section>`);
  return wire(node, { resume: onResume, restart: onRestart, quit: onQuit, mute: bindMute(onMute) });
}

// ---------- outcomes ----------
function quote(text, label) {
  return text ? `<blockquote class="quote"><cite>${label}</cite>«${text}»</blockquote>` : '';
}

export function winScreen({ level: L, res, stars, newBest, best, lastWords, card, isLast, onNext, onRetry, onMenu, onShare }) {
  const labels = [t('res.star1'), t('res.star2'), t('res.star3', { n: L.chainGoal })];
  const node = el(`<section class="screen scrim-soft" data-screen="win">
    <div class="outcome">
      <article class="doc minutes" aria-labelledby="win-t">
        <div class="doc-bar">${I.mail}<span>${t('res.minutes')} · ${t('levels.' + L.id)} · ${whenText(L)}</span></div>
        <div class="doc-body">
          <h2 id="win-t">${t('res.win')}</h2>
          <p>${t('res.winSub')}</p>
          <div class="stars-row">${labels.map((lb, i) => `<div class="star-item" data-star="${i}" data-on="${stars[i] ? 1 : 0}">${star(false)}<span>${lb}</span></div>`).join('')}</div>
          <dl class="stats">
            <div class="stat"><dt>${t('res.time')}</dt><dd>${fmtTime(res.time)}${newBest ? `<span class="record">${t('res.newBest')}</span>` : ''}<small>${best != null ? `${t('res.best')} ${fmtTime(best)}` : '&nbsp;'}</small></dd></div>
            <div class="stat"><dt>${t('res.chain')}</dt><dd>×${res.maxChain}<small>&nbsp;</small></dd></div>
            <div class="stat"><dt>${t('res.strikes')}</dt><dd>${res.strikes}/3<small>&nbsp;</small></dd></div>
            <div class="stat"><dt>${t('res.spread')}</dt><dd>${res.yawns}<small>&nbsp;</small></dd></div>
          </dl>
          ${quote(lastWords, t('res.lastWords'))}
        </div>
        <div class="doc-foot">
          <button class="btn small" data-act="menu" data-sfx="back">${t('menu')}</button>
          <button class="btn small" data-act="retry">${t('retry')}</button>
          <span class="spacer"></span>
          <button class="btn" data-act="share">${I.share}${t('share')}</button>
          <button class="btn primary" data-act="next" data-autofocus>${isLast ? t('res.weekend') : t('next')}</button>
        </div>
      </article>
      <figure class="shot"></figure>
    </div>
  </section>`);
  if (card) node.querySelector('.shot').appendChild(card);
  else node.querySelector('.shot').remove();
  // stars land one by one, each with its own note
  const items = [...node.querySelectorAll('.star-item')];
  let k = 0;
  items.forEach((it, i) => {
    if (it.dataset.on !== '1') return;
    const n = k++;
    setTimeout(() => { if (!node.isConnected) return; it.classList.add('on'); Audio.sfx.star(n); }, 650 + n * 380);
  });
  if (newBest) setTimeout(() => node.isConnected && Audio.sfx.winJingle(), 1900);
  return wire(node, { next: onNext, retry: onRetry, menu: onMenu, share: onShare });
}

export function firedScreen({ level: L, res, at, lastWords, card, onRetry, onMenu, onShare }) {
  const node = el(`<section class="screen scrim" data-screen="fired">
    <div class="outcome">
      <article class="doc letter" aria-labelledby="fired-t">
        <div class="letterhead"><span class="mark">RRHH</span><div>${t('res.hr')}<small>${whenText({ ...L, hour: Math.floor(at / 60), min: at % 60 })}</small></div></div>
        <div class="doc-body">
          <p class="meta">${t('res.to')}: <b>${t('you').replace(/\s*\(.*\)/, '')}</b><br>${t('res.subject')}: <b>${t('res.subjectText')}</b></p>
          <h2 id="fired-t" class="sr-only">${t('res.fired')}</h2>
          <p>${t('res.letter')}</p>
          <p><b>${t('res.firedSub')}</b></p>
          ${quote(lastWords, t('res.lastWords'))}
          <p class="sign">${t('res.sign')}</p>
          <div class="stamp" aria-hidden="true">${t('res.fired')}</div>
        </div>
        <div class="doc-foot">
          <button class="btn small" data-act="menu" data-sfx="back">${t('menu')}</button>
          <span class="spacer"></span>
          <button class="btn" data-act="share">${I.share}${t('share')}</button>
          <button class="btn primary" data-act="retry" data-autofocus>${t('retry')}</button>
        </div>
      </article>
      <figure class="shot"></figure>
    </div>
  </section>`);
  if (card) node.querySelector('.shot').appendChild(card);
  else node.querySelector('.shot').remove();
  const letter = node.querySelector('.letter');
  setTimeout(() => { if (!node.isConnected) return; Audio.sfx.stampRRHH(); letter.classList.add('thump'); }, 860);
  return wire(node, { retry: onRetry, menu: onMenu, share: onShare });
}

export function timeScreen({ level: L, res, lastWords, onRetry, onMenu }) {
  const v = Math.round(Math.min(1, res.seen / res.target) * 100);
  const node = el(`<section class="screen scrim" data-screen="time">
    <article class="doc reminder" aria-labelledby="time-t">
      <div class="doc-bar">${I.bell}<span>${t('res.reminder')} · ${t('res.extended')}</span></div>
      <div class="doc-body">
        <h2 id="time-t">${t('res.timeUp')}</h2>
        <p>${t('res.timeUpSub')}</p>
        <div class="meter-label"><span>${t('res.sleepLevel')}</span><span>${v}%</span></div>
        <div class="meter" role="img" aria-label="${v}%"><i style="--v:${v}%"></i></div>
        ${quote(lastWords, t('res.lastWords'))}
      </div>
      <div class="doc-foot">
        <button class="btn small" data-act="menu" data-sfx="back">${t('menu')}</button>
        <span class="spacer"></span>
        <button class="btn primary" data-act="retry" data-autofocus>${t('retry')}</button>
      </div>
    </article>
  </section>`);
  setTimeout(() => node.isConnected && Audio.sfx.loseJingle(), 250);
  return wire(node, { retry: onRetry, menu: onMenu });
}

export function weekDoneScreen({ stars, maxStars, onMenu, onShare }) {
  const node = el(`<section class="screen scrim" data-screen="allDone">
    <article class="doc ooo" aria-labelledby="ooo-t">
      <div class="doc-bar">${I.mail}<span>${t('res.ooo')}: ${t('res.oooSubject')}</span></div>
      <div class="doc-body">
        <div class="mail-head"><span>${t('res.subject')}</span><b>${t('res.oooSubject')}</b><span>${t('from')}</span><b>${t('you')}</b></div>
        <h2 id="ooo-t">${t('res.allDone')}</h2>
        <p>${t('res.allDoneSub')}</p>
        <p>${t('res.oooText')}</p>
        <div class="big-stars">${star(true)} ${stars}/${maxStars}</div>
      </div>
      <div class="doc-foot">
        ${onShare ? `<button class="btn" data-act="share">${I.share}${t('share')}</button>` : ''}
        <span class="spacer"></span>
        <button class="btn primary" data-act="menu" data-autofocus>${t('menu')}</button>
      </div>
    </article>
  </section>`);
  setTimeout(() => node.isConnected && Audio.sfx.fanfare(), 300);
  return wire(node, { menu: onMenu, share: onShare });
}
