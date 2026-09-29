// DOM screens over the canvas, dressed as railway hardware and paperwork: the title, the departure board
// (発車標, the level select), the platform ticket (the briefing), pause, the three outcomes (eki stamp,
// delay certificate, 乗り残し) and the stamp rally sheet. Strings come from i18n (trusted, may hold <b>/<kbd>).
import { t, getLang, num } from './i18n.js';
import { Audio } from './audio.js';
import { stampImage, textStamp, STAMP } from './stamp.js';
import { drawPortrait } from './hud.js';
import { serviceOf } from './levels.js';

const root = document.getElementById('ui');
const capEl = document.getElementById('caption');
const toastEl = document.getElementById('toast');
let current = null;

// ---------- plumbing ----------
export function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function wire(node, acts) {
  node.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', (e) => {
      const fn = acts[b.dataset.act];
      if (!fn || b.getAttribute('aria-disabled') === 'true') return;
      Audio.sfx.ui(b.dataset.sfx || (b.classList.contains('primary') ? 'go' : 'click'));
      fn(e, b);
    });
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && Audio.unlocked && b.getAttribute('aria-disabled') !== 'true') Audio.sfx.ui('hover'); });
  });
  return node;
}

export function show(node) {
  const old = current;
  current = node;
  if (old) { old.classList.add('out'); old.inert = true; old._stop?.(); setTimeout(() => old.remove(), 240); }
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
// timers that die with their screen
function later(node, ms, fn) { const id = setTimeout(() => node.isConnected && fn(), ms); const prev = node._stop; node._stop = () => { clearTimeout(id); prev?.(); }; }
function every(node, ms, fn) { const id = setInterval(() => (node.isConnected ? fn() : clearInterval(id)), ms); const prev = node._stop; node._stop = () => { clearInterval(id); prev?.(); }; }

let toastT = 0;
export function toast(html, { top = false, ms = 2200 } = {}) {
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
  fitCaption();
  capEl.classList.remove('in'); void capEl.offsetWidth; capEl.classList.add('in');
}
let capY = 0, capX = 0, capW = 0, capR = null, capAlt = null, capLim = Infinity;
// the caption's box on screen (null when hidden), so floating text and speech bubbles can stay clear of it
export function captionBox() { return capEl.hidden ? null : { l: capX - capW / 2, r: capX + capW / 2, b: capY + capEl.offsetHeight }; }
// r: the usual spot. alt: where it goes instead if, at r, it would reach below `limit` (the heads in the doorway)
export function placeCaption(r, alt = null, limit = Infinity) {
  if (!r) return;
  capR = r; capAlt = alt; capLim = limit;
  fitCaption();
}
function setCaptionRect(r) {
  capY = r.y; capX = r.x; capW = Math.min(r.w, window.innerWidth - 25.6);
  capEl.style.setProperty('--x', `${r.x}px`);
  capEl.style.setProperty('--y', `${r.y}px`);
  capEl.style.setProperty('--w', `${r.w}px`);
}
function fitCaption() {
  if (!capR) return;
  setCaptionRect(capR);
  if (capAlt && !capEl.hidden && capR.y + capEl.offsetHeight > capLim) setCaptionRect(capAlt);
}

// ---------- the house grammar ----------
const I = {
  soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
  lock: '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke="none"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.8M7.5 8L12 3.5 16.5 8"/><path d="M5 12.5v5.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-5.2"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.8 11.2L12 4.5l8.2 6.7"/><path d="M6.3 9.6v9.9h11.4V9.6"/><path d="M10 19.5v-5h4v5"/></svg>',
  retry: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 13a7.5 7.5 0 1 1-2.2-6.3"/><path d="M19.6 4v4.2h-4.2"/></svg>',
  stamp: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="5.6" stroke-width="1.2"/><path d="M9.2 12.4l2 1.9 3.8-4.2" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3.5 9.5h3l5-4v13l-5-4h-3z"/><path d="M15 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  play: '<svg class="pl" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8.6 5.8v12.4a.6.6 0 0 0 .9.5l9.6-6.2a.6.6 0 0 0 0-1L9.5 5.3a.6.6 0 0 0-.9.5z"/></svg>',
  stop: '<svg class="sq" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="6.8" y="6.8" width="10.4" height="10.4" rx="2"/></svg>',
};
export const ICON = I;

const pad2 = (n) => String(n).padStart(2, '0');
export const hhmm = (L) => `${L.dep[0]}:${pad2(L.dep[1])}`;
export const hms = (L) => `${L.dep[0]}:${pad2(L.dep[1])}:${pad2(L.dep[2])}`;
const kindOf = (L) => { const k = serviceOf(L); return { cls: k.key, jp: k.jp, lat: getLang() === 'es' ? k.es : k.en, col: k.col }; };

function soundBtn(muted) {
  return `<button class="btn round ghost" data-act="mute" data-sfx="toggle" aria-pressed="${!muted}" aria-label="${t('sound')}" title="${t('sound')}">${muted ? I.soundOff : I.soundOn}</button>`;
}
function bindMute(onMute) {
  return (e, btn) => { const m = onMute(); btn.setAttribute('aria-pressed', String(!m)); btn.innerHTML = m ? I.soundOff : I.soundOn; };
}

// a stamp printed into a fresh <canvas> (the cached one is shared)
export function stampCanvas(L, px, cls = '', opts) {
  const c = document.createElement('canvas');
  c.width = c.height = px; c.className = cls;
  c.getContext('2d').drawImage(stampImage(L, px, opts), 0, 0);
  c.setAttribute('aria-hidden', 'true');
  return c;
}
function textStampCanvas(text, sub, px, cls, ink) {
  const src = textStamp(text, sub, px, ink);
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height; c.className = cls;
  c.getContext('2d').drawImage(src, 0, 0);
  c.setAttribute('aria-hidden', 'true');
  return c;
}
const dpx = (css) => Math.round(Math.min(640, css * Math.min(2.5, window.devicePixelRatio || 1)));

// ---------- title ----------
export function titleScreen({ muted, cont, stars, maxStars, touch, onPlay, onBoard, onMute, onLang }) {
  const word = t('title'), cut = word.indexOf(' ') > 0 ? word.indexOf(' ') : Math.ceil(word.length / 2);
  const left = word.slice(0, cut), right = word.slice(cut).trim();
  const node = el(`<section class="screen title" data-screen="title">
    <div class="corner">
      ${soundBtn(muted)}
      <button class="btn small ghost" data-act="lang" lang="${getLang() === 'es' ? 'en' : 'es'}">${t('lang')}</button>
    </div>
    <header class="brand">
      <h1 class="logo" aria-label="${word}"><span class="door l" aria-hidden="true">${left}</span><span class="door r" aria-hidden="true">${right}</span></h1>
      <p class="plate" lang="ja"><span>ドアが閉まります</span></p>
      <p class="tagline">${t('tagline')}</p>
    </header>
    <div class="actions">
      <p class="sub">${t('sub')}</p>
      <button class="btn primary big" data-act="play" data-autofocus>${cont ? t('cont') : t('play')}</button>
      ${cont ? `<div class="row"><button class="btn small" data-act="board">${t('stations')}</button><span class="tally" aria-label="${t('board.stamps')}: ${stars}/${maxStars}">${I.stamp}<b>${stars}</b>/${maxStars}</span></div>` : ''}
      <p class="hint">${touch ? t('hintTouch') : t('hint')}</p>
      <p class="about">${t('about')}</p>
    </div>
  </section>`);
  later(node, 520, () => Audio.sfx.doorThunk?.(0));
  return wire(node, { play: onPlay, board: onBoard, mute: bindMute(onMute), lang: onLang });
}

export function bootScreen() {
  return el(`<section class="screen" data-screen="boot"><p class="boot">${t('loading')}</p></section>`);
}

// ---------- 発車標: the departure board is the level select ----------
// states[i]: { state: 'locked'|'next'|'open'|'done', set: [b,b,b] }
export function boardScreen({ levels, states, stars, maxStars, onPick, onBack }) {
  const next = states.findIndex((s) => s.state === 'next');
  const row = (L, i) => {
    const s = states[i], k = kindOf(L), locked = s.state === 'locked';
    const dots = locked ? I.lock
      : s.state === 'next' ? `<span class="soon"><b lang="ja">次発</b>${t('board.next')}</span>`
      : `<span class="dots">${[0, 1, 2].map((j) => `<i class="${s.set?.[j] ? (j === 2 ? 'on gold' : 'on') : ''}"></i>`).join('')}</span>`;
    const label = `${hhmm(L)} · ${L.code} · ${L.kanji} ${L.romaji} (${t('lv.' + L.id)})${locked ? ' · ' + t('locked') : ''}`;
    return `<button class="dep ${s.state}" style="--n:${i}" data-act="pick" data-i="${i}" aria-label="${label}"${locked ? ' aria-disabled="true"' : ''}${i === (next >= 0 ? next : 0) ? ' data-autofocus' : ''}>
      <span class="c-time">${hhmm(L)}</span>
      <span class="c-kind" style="--k:${k.col}"><b class="jp" lang="ja">${k.jp}</b><b class="lat">${k.lat}</b></span>
      <span class="c-code">${L.code}</span>
      <span class="c-dest"><b class="jp" lang="ja">${L.kanji}</b><b class="lat">${L.romaji}</b></span>
      <span class="c-st">${dots}</span>
    </button>`;
  };
  const node = el(`<section class="screen scrim" data-screen="board">
    <div class="board" role="dialog" aria-labelledby="bd-t">
      <div class="board-bar">
        <button class="link" data-act="back" data-sfx="back" aria-label="${t('back')}">${I.back}</button>
        <h2 id="bd-t"><span lang="ja">発車案内</span>${t('board.title')}</h2>
        <span class="tally" aria-label="${t('board.stamps')}: ${stars}/${maxStars}">${I.stamp}<b>${stars}</b>/${maxStars}</span>
      </div>
      <div class="board-head" aria-hidden="true"><span>${t('board.time')}</span><span>${t('board.train')}</span><span></span><span>${t('board.dest')}</span><span>${t('board.stamps')}</span></div>
      <div class="board-rows">${levels.map(row).join('')}</div>
      <p class="board-foot"><span class="line-chip">${t('line')}</span>${t('lineNote')}</p>
    </div>
  </section>`);
  // split-flap: rows clack into place one after another, then the board alternates JP / translation like the real ones
  levels.forEach((_, i) => later(node, 140 + i * 70, () => Audio.sfx.flap()));
  const board = node.querySelector('.board');
  every(node, 3800, () => { board.classList.toggle('lat'); levels.forEach((_, i) => later(node, i * 45, () => Audio.sfx.flap())); });
  node.querySelectorAll('.dep.locked').forEach((b) => b.addEventListener('click', () => { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); Audio.sfx.ui('back'); }));
  return wire(node, { back: onBack, pick: (e, b) => onPick(+b.dataset.i) });
}

// ---------- 入場券: the platform ticket briefs the station ----------
const NEWS = { s2: ['student', 'kid'], s3: ['tourist'], s4: ['granny', 'cake'], s5: ['sumo'], s6: ['sleepy', 'runner'], s7: ['mascot'] };

export function briefScreen({ level: L, onGo, onBack }) {
  const news = NEWS[L.id] || [];
  const arr = t('mel.arr.' + L.id), arrival = typeof arr === 'string' && arr !== 'mel.arr.' + L.id ? `<p class="tk-arr">${arr}</p>` : '';
  const extra = L.id === 's1' ? `<p class="tk-note">${t('brief.controls')}</p>` : L.id === 's8' ? `<p class="tk-note">${t('brief.finale')}</p>` : '';
  const node = el(`<section class="screen scrim" data-screen="brief">
    <article class="ticket" aria-labelledby="tk-t" style="--st:${STAMP[L.id]?.ink || '#16b89c'}">
      <header class="tk-band"><b lang="ja">入場券</b><span>${t('brief.ticket')}</span><span class="tk-code">${L.code}</span></header>
      <div class="tk-body">
        <div class="tk-main">
          <div class="tk-top">
            <div class="tk-station"><h2 id="tk-t" lang="ja">${L.kanji}</h2><p class="tk-rom">${L.romaji}</p><p class="tk-mean">${t('lv.' + L.id)}</p></div>
            <div class="tk-dep"><span>${t('brief.dep')}</span><b class="led">${hms(L)}</b></div>
          </div>
          <dl class="tk-fields">
            <div><dt>${t('brief.target')}</dt><dd>${t('brief.targetText', { n: Math.round(L.target * 100) })}<small>${t('brief.goldText', { n: Math.round(L.gold * 100) })}</small></dd></div>
            <div><dt>${t('brief.time')}</dt><dd>${t('brief.timeText', { d: L.dwell, m: L.melody })}</dd></div>
            <div><dt>${t('brief.melody')}</dt><dd>
              <button class="tk-mel" type="button" data-act="mel" data-sfx="toggle" aria-pressed="false" aria-label="${t('brief.listen')}: ${t('mel.' + L.id)}">
                <span class="tk-mel-ico" aria-hidden="true">${I.play}${I.stop}</span>
                <span class="tk-mel-t"><span class="tk-mel-jp" lang="ja">${Audio.SONGS[L.id].title}</span><span>${t('mel.' + L.id)}</span></span>
                <span class="tk-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
              </button>
            </dd></div>
          </dl>
        </div>
        <div class="tk-side">
          ${arrival}
          ${extra}
          ${news.length ? `<section class="tk-news"><h3>${t('brief.news')}</h3>${news.map((k) => `<div class="news-card"><div class="pic" data-type="${k}"></div><div><b>${t('types.' + k + '.n')}</b><p>${t('types.' + k + '.d')}</p></div></div>`).join('')}</section>` : ''}
        </div>
      </div>
      <footer class="tk-foot">
        <button class="btn small" data-act="back" data-sfx="back">${I.back}${t('back')}</button>
        <span class="spacer"></span>
        <button class="btn primary" data-act="go" data-autofocus>${t('brief.go')}</button>
      </footer>
    </article>
  </section>`);
  node.querySelectorAll('.pic[data-type]').forEach((pic) => {
    const css = 64, px = dpx(css), c = document.createElement('canvas');
    c.width = c.height = px; c.setAttribute('aria-hidden', 'true');
    drawPortrait(c.getContext('2d'), pic.dataset.type, px / 2, px / 2, px * 0.44, pic.dataset.type === 'runner' ? 777 : 20250);
    pic.appendChild(c);
  });
  // ♪ the station's departure melody, at the tempo it will have on the platform
  const mel = node.querySelector('[data-act="mel"]'), setOn = (on) => mel.setAttribute('aria-pressed', String(on));
  const listen = async () => {
    if (Audio.preview.playing) { Audio.preview.stop(0.25); setOn(false); return; }
    await Audio.unlock();
    if (!node.isConnected) return;
    if (Audio.preview.play(L.id, L.melody, () => setOn(false))) { mel.style.setProperty('--beat', `${Audio.preview.beat.toFixed(3)}s`); setOn(true); return; }
    mel.classList.remove('nope'); void mel.offsetWidth; mel.classList.add('nope');
    if (Audio.muted) toast(t('brief.muted'));
  };
  const stop = node._stop; node._stop = () => { Audio.preview.stop(0.2); stop?.(); };
  const go = node.querySelector('[data-act="go"]');
  node.setProgress = (p) => {
    if (p == null) { go.classList.remove('loading'); go.removeAttribute('aria-disabled'); go.textContent = t('brief.go'); return; }
    go.classList.add('loading'); go.setAttribute('aria-disabled', 'true');
    go.style.setProperty('--p', `${Math.round(p * 100)}%`);
    go.textContent = t('connecting', { p: Math.round(p * 100) });
  };
  return wire(node, { back: onBack, go: onGo, mel: listen });
}

// ---------- pause ----------
export function pauseScreen({ muted, onResume, onRestart, onQuit, onMute }) {
  const node = el(`<section class="screen scrim" data-screen="pause">
    <div class="panel" role="dialog" aria-labelledby="pz">
      <h2 id="pz"><span lang="ja">一時停止</span>${t('paused')}</h2>
      <button class="btn primary" data-act="resume" data-autofocus>${t('resume')}</button>
      <button class="btn" data-act="restart">${t('restart')}</button>
      <button class="btn" data-act="quit" data-sfx="back">${t('quit')}</button>
      <div class="row">${soundBtn(muted)}</div>
    </div>
  </section>`);
  return wire(node, { resume: onResume, restart: onRestart, quit: onQuit, mute: bindMute(onMute) });
}

// ---------- outcomes ----------
export const outcome = (res) => (!res.pass ? 'fail' : res.onTime ? 'pass' : 'late');

function certHtml(L, res, cause) {
  const body = t('cert.body', { code: L.code, time: hms(L), st: `${L.romaji} <span lang="ja">(${L.kanji})</span>`, s: num(res.delay, 1) });
  return `<aside class="cert" aria-labelledby="cert-t">
    <header><b id="cert-t" lang="ja">遅延証明書</b><span>${t('cert.title')}</span></header>
    <p>${body}</p>
    <p class="cause"><span>${t('cert.cause')}</span><b>${cause}</b></p>
    <p class="note">${t('cert.note')}</p>
    <div class="cert-sign"><span>${t('cert.master')} · ${L.kanji}</span><span class="hanko" lang="ja" aria-hidden="true">駅長</span></div>
  </aside>`;
}

// res: sim.result; rec: recordResult(); cause: translated late cause
export function resultScreen({ level: L, res, rec, cause, card, isLast, onNext, onRetry, onMenu, onShare }) {
  const kind = outcome(res), pass = kind !== 'fail', gold = kind === 'pass' && res.goldOk, head = gold ? 'gold' : kind;
  const labels = [t('res.star1', { n: res.target }), t('res.star2'), t('res.star3', { n: res.gold })];
  const marks = ['', '<span lang="ja">定時</span>', '<span lang="ja">満員</span>'];
  const best = rec.newBest ? `<span class="record">${t('res.newBest')}</span>` : '';
  const bestLine = [t('res.target', { n: res.target }), rec.prevBest != null && !rec.newBest ? t('res.best', { n: rec.prevBest }) : ''].filter(Boolean).join(' · ');
  const stats = [
    [t('res.load'), `${res.fill}%${best}`, bestLine],
    [t('res.delay'), res.onTime ? t('res.onTime') : `+${num(res.delay, 1)} s`, ''],
    [t('res.combo'), `×${res.maxCombo}`, ''],
    [t('res.perfects'), `${res.stats.perfect}`, ''],
  ];
  if (res.incidents) stats.push([t('res.incidents'), `${res.incidents}`, '']);
  const node = el(`<section class="screen scrim-soft" data-screen="result" data-kind="${kind}" data-gold="${gold ? 1 : 0}">
    <div class="outcome">
      <article class="doc sheet" aria-labelledby="res-t" style="--st:${STAMP[L.id]?.ink || '#16b89c'}">
        <header class="doc-band"><b lang="ja">${gold ? '満員御礼' : pass ? '駅スタンプ' : '乗り残し'}</b><span>${gold ? t('res.goldBand') : pass ? t('res.stamp') : t('res.leftSub')} · ${L.code} ${L.romaji} · ${hms(L)}</span></header>
        <div class="doc-body">
          <div class="res-head">
            <div class="res-text"><h2 id="res-t">${t('res.' + head)}</h2><p>${t('res.' + head + 'Sub', { fill: res.fill, target: res.target, s: num(res.delay, 1) })}</p></div>
            <div class="res-stamp"></div>
          </div>
          <div class="marks">${labels.map((lb, i) => `<div class="mark-item" data-i="${i}" data-on="${rec.stamps[i] ? 1 : 0}"><span class="mark m${i}">${marks[i]}</span><span class="lb">${lb}</span></div>`).join('')}</div>
          <dl class="stats" data-n="${stats.length}">${stats.map(([k, v, s]) => `<div class="stat"><dt>${k}</dt><dd>${v}<small>${s || '&nbsp;'}</small></dd></div>`).join('')}</dl>
          ${res.onTime ? '' : certHtml(L, res, cause)}
        </div>
        <footer class="doc-foot">
          <button class="btn round" data-act="menu" data-sfx="back" aria-label="${t('menu')}" title="${t('menu')}">${I.home}</button>
          ${pass ? `<button class="btn round" data-act="retry" aria-label="${t('retry')}" title="${t('retry')}">${I.retry}</button>` : ''}
          <span class="spacer"></span>
          <button class="btn" data-act="share">${I.share}${t('share')}</button>
          ${pass ? `<button class="btn primary" data-act="next" data-autofocus>${isLast ? t('res.allLine') : t('next')}</button>` : `<button class="btn primary" data-act="retry" data-autofocus>${t('retry')}</button>`}
        </footer>
      </article>
      <figure class="shot"></figure>
    </div>
  </section>`);
  const slot = node.querySelector('.res-stamp');
  slot.appendChild(pass ? stampCanvas(L, dpx(150), 'big-stamp') : textStampCanvas('乗り残し', t('res.leftSub'), dpx(190), 'big-stamp text', '#d23a2c'));
  node.querySelector('.m0').appendChild(stampCanvas(L, dpx(40), 'mini'));
  if (card) { card.classList.add('card'); node.querySelector('.shot').appendChild(card); } else node.querySelector('.shot').remove();
  // paperwork lands in order: the big stamp, then each earned mark, then the certificate and its seal
  later(node, 380, () => { slot.classList.add('in'); Audio.sfx.stamp(); });
  let k = 0;
  node.querySelectorAll('.mark-item[data-on="1"]').forEach((it) => { const n = k++; later(node, 900 + n * 340, () => { it.classList.add('on'); Audio.sfx.star(n); }); });
  const cert = node.querySelector('.cert');
  if (cert) {
    const at = 1050 + k * 340;
    later(node, at, () => { cert.classList.add('in'); Audio.sfx.flap(); });
    later(node, at + 650, () => { cert.classList.add('sealed'); Audio.sfx.stamp(); });
  }
  return wire(node, { next: onNext, retry: onRetry, menu: onMenu, share: onShare });
}

// ---------- スタンプラリー: every station stamped ----------
export function doneScreen({ levels, save, stars, maxStars, onMenu, onShare }) {
  const cells = levels.map((L, i) => {
    const r = save.levels[L.id];
    return `<div class="rally-cell${r?.won ? ' won' : ''}${r?.set?.[2] ? ' gold' : ''}" data-i="${i}"><span class="rc-name" lang="ja">${L.kanji}</span><span class="rc-slot"></span><span class="rc-rom">${L.romaji}</span></div>`;
  }).join('');
  const node = el(`<section class="screen scrim" data-screen="allDone">
    <article class="doc rally" aria-labelledby="rl-t">
      <header class="doc-band"><b lang="ja">スタンプラリー</b><span>${t('line')}</span></header>
      <div class="doc-body">
        <h2 id="rl-t"><span class="jp" lang="ja">${t('done.jp')}</span>${t('done.title')}</h2>
        <p>${t('done.sub')}</p>
        <div class="rally-grid">${cells}</div>
        <p class="rally-text">${t('done.text')}</p>
        <p class="big-stars">${I.stamp}<b>${stars}</b>/${maxStars}</p>
      </div>
      <footer class="doc-foot">
        ${onShare ? `<button class="btn" data-act="share">${I.share}${t('share')}</button>` : ''}
        <span class="spacer"></span>
        <button class="btn primary" data-act="menu" data-autofocus>${t('menu')}</button>
      </footer>
    </article>
  </section>`);
  let k = 0;
  levels.forEach((L, i) => {
    const cell = node.querySelector(`.rally-cell[data-i="${i}"]`);
    if (!cell.classList.contains('won')) return;
    const c = stampCanvas(L, dpx(96), 'rc-stamp');
    c.style.setProperty('--rot', `${((i * 37) % 11) - 5}deg`);
    cell.querySelector('.rc-slot').appendChild(c);
    const n = k++;
    later(node, 380 + n * 240, () => { cell.classList.add('in'); Audio.sfx.stamp(); });
  });
  later(node, 420 + k * 240, () => Audio.jingle('gold'));
  return wire(node, { menu: onMenu, share: onShare });
}
