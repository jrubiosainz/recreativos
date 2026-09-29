// CRUJIDO: boot, screens, the clock, input and the frame loop. Rules live in sim.js, pictures in
// gfx/, sound in audio.js; this file only wires them together.
import { Sim } from './sim.js';
import { Film } from './film.js';
import { FILMS, LEVEL_COUNT, buildLevel, durations } from './levels.js';
import { makeBot } from './bot.js';
import { View } from './gfx/view.js';
import { Facade, layoutFacade } from './gfx/facade.js';
import { number } from './audio/reel.js';
import { Audio } from './audio.js';
import { loadFonts } from './fonts.js';
import { t, tr, word, setLang, getLang, detectLang } from './i18n.js';
import { loadSave, writeSave, recordResult, isUnlocked, totalStars } from './save.js';
import { buildCard, buildSeasonCard, cardFile, shareCard } from './share.js';
import { Tutorial } from './tutorial.js';
import { clamp } from './util.js';
import * as UI from './ui.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const save = loadSave();
const forceMute = q.get('mute') === '1', skipTut = q.get('skip') === '1';
const botName = q.get('bot') ? (q.get('bot') === '1' ? 'skilled' : q.get('bot')) : null;
setLang(q.get('lang') || save.lang || detectLang());

const IDS = FILMS.map((f) => f.meta.id), MAX = LEVEL_COUNT * 3, HZ = 10, LEAD = 0.55;
const S = {
  state: 'boot', // boot | title | brief | play | pause | end | allDone
  sel: 0, idx: 0, lv: null, prep: null, sim: null, view: null, bot: null, tut: null, reel: null,
  ev: 0, curve: [], curveT: 0, end: null, backdrop: 'facade', dim: 0, dimTo: 0, quiet: false,
  fade: { a: 1, v: -1 / 0.6, col: '#000' }, node: null, qa: false,
};
let manifest = null, lines = {}, W = 1, H = 1, dpr = 1, safeBottom = 0, last = performance.now(), RF = null;
const Q = { cap: Math.min(2, +q.get('dpr') || 2), n: 0, t: 0, skip: 1.5, before: 0, prev: 0, done: false };
let lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const isTouch = () => q.get('touch') === '1' || lastPointer !== 'mouse';
const isMuted = () => forceMute || !!save.muted;
const portrait = () => H > W * 1.1;
const seed = () => (q.has('seed') ? +q.get('seed') : (Math.random() * 1e9) | 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const unlocked = (i) => q.get('unlock') === '1' || isUnlocked(save, IDS, i);
const nextIndex = () => { const i = IDS.findIndex((id, k) => unlocked(k) && !save.films[id]?.won); return i < 0 ? 0 : i; };

// ---------- assets ----------
const imgCache = new Map();
function img(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res) => {
      const i = new Image(); i.decoding = 'async';
      i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
    }));
  }
  return imgCache.get(src);
}
const FIMG = {}, SPR = {};
const posterSrc = (id) => `assets/img/poster_${id}.jpg`;
const loadPoster = (id) => img(posterSrc(id)).then((im) => { if (im) FIMG['poster_' + id] = im; return im; });
const loadStreet = (k) => img(`assets/img/bg_street_${k}.jpg`).then((im) => { if (im) FIMG['street_' + k] = im; });
let spritesP = null;
function sprites() {
  const keys = [...['palomitas', 'nachos', 'patatas', 'caramelo', 'kikos', 'hielo'].flatMap((s) => ['snk_' + s, 'pc_' + s]), 'hand_pick', 'seat_back'];
  return (spritesP ||= Promise.all(keys.map((k) => img(`assets/img/${k}.webp`).then((im) => { SPR[k] = im; }))));
}
const FAC = new Facade(FIMG);

// ---------- audio ----------
let audioReady = null, wantMusic = false;
function unlockAudio() {
  Audio.setMuted(isMuted());
  if (!Audio.unlocked) Audio.unlock().then((ok) => { if (ok) { Audio.setMuted(isMuted()); if (wantMusic) Audio.lobby.start(); } });
  if (!audioReady && manifest) audioReady = Audio.loadManifest(manifest, getLang());
}
function music(on) { wantMusic = on; if (on) Audio.lobby.start(); else Audio.lobby.stop(0.8); }
function toggleMute() { save.muted = !save.muted; writeSave(save); Audio.setMuted(isMuted()); return isMuted(); }
function switchLang() {
  const next = getLang() === 'es' ? 'en' : 'es';
  setLang(next); save.lang = next; writeSave(save);
  document.documentElement.lang = next;
  document.title = `${t('title')} · ${t('tagline')}`;
  if (audioReady) audioReady = Audio.switchLang(next);
  S.prep = null;
  goTitle();
}
// a line said in the room, panned to the seat of whoever says it
function say(id, who, panTo = null) {
  const p = who && S.sim?.ppl.find((x) => x.id === who);
  Audio.say(id, { pan: panTo ?? (p ? clamp(p.x / 1.3, -0.9, 0.9) : 0) });
}

// ---------- the clock: film time is what you hear ----------
const clock = {
  mode: 'perf', when: 0, base: 0, held: null, last: 0,
  // film second 0 plays at context time `when`; what you hear decides what the film is doing
  start(lead, reel, film, at = 0) {
    this.last = at - lead; this.held = null;
    if (reel && Audio.running) { this.mode = 'audio'; this.when = Audio.now + lead - at; reel.start(film, this.when + at, at); }
    else { this.mode = 'perf'; this.base = performance.now() / 1000 + lead - at; }
  },
  now() {
    const v = this.mode === 'audio' ? Audio.heard() - this.when : (this.held ?? performance.now() / 1000) - this.base;
    return (this.last = Math.max(this.last, v));
  },
  // the fallback clock stops with the pause card; the audio one stops with the suspended context
  hold() { if (this.mode === 'perf' && this.held == null) this.held = performance.now() / 1000; },
  release() { if (this.mode === 'perf' && this.held != null) { this.base += performance.now() / 1000 - this.held; this.held = null; } },
};

// ---------- layout ----------
function probeSafe() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(d);
  const v = parseFloat(getComputedStyle(d).paddingBottom) || 0;
  d.remove();
  return v;
}
function resize() {
  dpr = Math.min(Q.cap, window.devicePixelRatio || 1);
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  safeBottom = probeSafe();
  RF = layoutFacade(W, H, safeBottom);
  loadStreet(portrait() ? 'v' : 'h');
  S.node?.place?.(S.state === 'title' ? RF : S.view?.pauseRect(W, H));
  S.tut?.place();
  draw();
}
// the tutorial's note: under the meter (or beside it), its tail on the arrow
function hintWhere() {
  const L = S.view?.lay(W, H);
  if (!L) return { r: { x: W / 2, y: H * 0.4, w: Math.min(W - 32, 340) }, dir: 'up' };
  const m = L.meter, a = S.view.meter.arrowAt(m);
  if (L.port) {
    const w = Math.min(W - 32, 360), x = W / 2, ax = a ? a.x : x;
    return { r: { x, y: m.y + m.h + 14, w, p: clamp(ax - (x - w / 2), 22, w - 22) }, dir: 'up' };
  }
  const edge = a ? a.left : m.x, w = Math.min(340, edge - 60);
  return { r: { x: edge - 16 - w / 2, y: a ? a.y : m.y + m.h * 0.55, w }, dir: 'right' };
}

// ---------- screens ----------
function filmRows() {
  let nextSet = false;
  return IDS.map((id, i) => {
    const r = save.films[id];
    let state = 'open';
    if (!unlocked(i)) state = 'locked';
    else if (r?.won) state = 'done';
    else if (!nextSet) { state = 'next'; nextSet = true; }
    return { id, title: t('films.' + id), time: t('times')[i], state, set: r?.set || [false, false, false] };
  });
}
// back out to the street: from the hall it is a cut through black, otherwise undo a pending fade
function toStreet(dimTo) {
  if (S.backdrop === 'view') S.fade = { a: 1, v: -1 / 0.55, col: '#000' };
  else if (S.fade.v > 0) S.fade = { a: S.fade.a, v: -1 / 0.4, col: '#000' };
  S.backdrop = 'facade'; S.dimTo = dimTo;
}
let rowsCache = null;
function boardRows() {
  const key = `${getLang()}|${S.sel}|${IDS.map((id) => (save.films[id]?.won ? 1 : 0)).join('')}`;
  if (rowsCache?.key !== key) rowsCache = { key, head: t('sessions'), list: filmRows().map((r, i) => ({ time: r.time, name: r.title, locked: r.state === 'locked', lit: i === S.sel })) };
  return rowsCache;
}
function goTitle() {
  leavePlay(); toStreet(0);
  S.state = 'title';
  if (!unlocked(S.sel)) S.sel = nextIndex();
  loadPoster(IDS[S.sel]);
  FAC.poster(IDS[S.sel], performance.now() / 1000);
  music(true);
  S.node = UI.titleScreen({
    films: filmRows(), sel: S.sel, R: RF, muted: isMuted(), total: totalStars(save), max: MAX,
    onSelect: (i, locked) => {
      if (locked) { UI.toast(t('lockedToast', { time: t('times')[Math.max(0, i - 1)] })); return; }
      S.sel = i; loadPoster(IDS[i]); FAC.poster(IDS[i], performance.now() / 1000);
    },
    onBuy: (i) => { unlockAudio(); openTicket(i); },
    onMute: toggleMute, onLang: switchLang,
  });
  UI.show(S.node);
}

// ---------- the ticket: everything the film needs loads while you read it ----------
const D = () => durations(manifest, lines, getLang());
const lineOf = (id) => lines[id] && { text: lines[id][getLang()], dur: D()(id) };
function prepare(i) {
  const lang = getLang();
  if (S.prep && S.prep.i === i && S.prep.lang === lang) return S.prep;
  const level = buildLevel(i, D()), film = number(new Film(level.script, level.cast));
  const keys = [...new Set(film.shots.map((s) => s.img).filter(Boolean))];
  const P = { i, lang, p: 0, ready: false, reel: null, images: {}, on: null };
  let reelP = 0, pics = 0;
  const prog = () => { P.p = Math.min(0.99, 0.75 * reelP + 0.25 * (pics / (keys.length + 1))); P.on?.(P.p); };
  const ctx = Audio.init();
  P.promise = Promise.all([
    ctx ? new Audio.Reel().load(level, film, lang, { onProgress: (p) => { reelP = p; prog(); } })
      .then((r) => { P.reel = r; }).catch((e) => { console.warn('[CRUJIDO] reel', e); reelP = 1; }) : ((reelP = 1), null),
    ...keys.map((k) => img(manifest?.images?.[k] || `assets/img/${k}.jpg`).then((im) => { P.images[k] = im; pics++; prog(); })),
    sprites().then(() => { pics++; prog(); }),
  ]).then(() => { P.ready = true; P.p = 1; P.on?.(1); return P; });
  return (S.prep = P);
}
function openTicket(i) {
  if (!unlocked(i)) return;
  leavePlay(); toStreet(0.68);
  S.idx = S.sel = i; S.state = 'brief';
  FAC.poster(IDS[i], performance.now() / 1000); loadPoster(IDS[i]);
  music(true);
  const level = buildLevel(i, D()), id = IDS[i];
  S.node = UI.ticketScreen({
    film: t('films.' + id), level, i, time: t('times')[i], set: save.films[id]?.set,
    snackImg: `assets/img/snk_${level.combo[0]}.webp`,
    onGo: enter, onBack: goTitle,
  });
  UI.show(S.node);
  if (manifest) prepare(i);
}
let entering = false;
async function enter(node) {
  if (entering || node.classList.contains('torn')) return;
  entering = true;
  unlockAudio();
  try {
    const P = prepare(S.idx);
    if (!P.ready) {
      P.on = (p) => node.setProgress(p); node.setProgress(P.p);
      await Promise.race([P.promise, wait(20000)]);
      P.on = null;
      if (S.node !== node) return;
      node.ready();
    }
    await node.tear();
    if (S.node !== node) return;
    S.fade = { a: S.fade.a, v: 1 / 0.3, col: '#000' };            // the lights go down
    await wait(320);
    if (S.node === node) begin(P);
  } finally { entering = false; }
}

// ---------- the film ----------
function begin(P, o = {}) {
  leavePlay();
  // restarting from the pause card: the context is waking up, and the reel must start on its clock
  if (Audio.init() && !Audio.running && !forceMute) return Promise.race([Audio.unlock(), wait(500)]).then(() => start(P, o));
  start(P, o);
  return Promise.resolve();
}
function start(P, { at = 0 } = {}) {
  const i = P.i, level = buildLevel(i, D()), sd = seed();
  const sim = new Sim(level, { seed: sd, env: P.reel?.env || null });
  S.view = new View({ sim, level, images: P.images, sprites: SPR, tr, title: t('films.' + level.id), word, line: lineOf });
  Object.assign(S, { sim, lv: level, idx: i, reel: P.reel, ev: 0, curve: [], curveT: 0, end: null, state: 'play', backdrop: 'view', dimTo: 0, dim: 0 });
  S.bot = botName ? makeBot(botName, sd) : null;
  S.tut = i === 0 && !save.tut && !skipTut && !S.bot ? new Tutorial(sim, { t, touch: isTouch, hint: UI.hint, where: hintWhere }) : null;
  music(false); Audio.house.start();
  clock.start(at ? 0.05 : LEAD, S.reel, sim.film, at);
  S.fade = { a: 1, v: -1 / 0.9, col: '#000' };
  Q.n = 0; Q.t = 0;
  S.node = UI.playScreen({ onPause: pause, r: S.view.pauseRect(W, H) });
  UI.show(S.node);
}
function leavePlay() {
  if (!S.sim) return;
  S.reel?.stop(0.25); Audio.house.stop(0.3);
  Audio.resume();
  clock.release();
  S.tut?.stop(); UI.hint(null);
  S.sim = S.view = S.bot = S.tut = S.end = S.reel = null;
}
// every sim event becomes what you see and hear
function pump() {
  const sim = S.sim, E = sim.events;
  while (S.ev < E.length) {
    const e = E[S.ev++];
    const id = S.view.event(e);
    S.tut?.event(e);
    if (S.quiet) { if (e.type === 'end') onEnd(); continue; }
    if (id) say(id, e.who);
    switch (e.type) {
      case 'noise': {
        const snack = sim.combo[Math.min(e.piece, sim.combo.length - 1)]?.id;
        Audio.me.noise(e.kind, e.L, { snack, heard: e.heard, i: e.i, n: e.n, soak: e.soak });
        if (e.heard && isTouch()) navigator.vibrate?.(12);
        break;
      }
      case 'fetch': Audio.me.fetch(e.snack); break;
      case 'swallow': Audio.me.swallow(); break;
      case 'bolt': Audio.me.bolt(e.n); break;
      case 'shush': if (e.strike && isTouch()) navigator.vibrate?.([28, 60, 28]); break;
      case 'end': onEnd(); break;
    }
  }
  while (S.curveT <= sim.t + 1e-9) { const v = sim.needle(S.curveT); S.curve.push(Number.isFinite(v) ? Math.round(v * 10) / 10 : 99); S.curveT += 1 / HZ; }
}
function stepTo(tt) {
  const sim = S.sim;
  if (!sim || sim.done || tt <= sim.t) return;
  if (S.bot) while (sim.t < tt - 1e-9 && !sim.done) { S.bot.update(sim, sim.t); sim.step(Math.min(1 / 120, tt - sim.t)); pump(); }
  else { sim.step(tt - sim.t); pump(); }
}
// a tap counts at the moment it happened against what you were hearing then
function tapAt(stamp = performance.now()) {
  const sim = S.sim;
  if (S.state !== 'play' || !sim || sim.over) return;
  const tt = clock.now() - clamp((performance.now() - stamp) / 1000, 0, 0.1);
  if (tt < 0) return;
  stepTo(tt);
  sim.tap(Math.max(tt, sim.t));
  sim.step(1e-3); pump();
}
function fastForward(T) {
  const sim = S.sim; if (!sim) return;
  S.quiet = true;
  while (sim.t < T - 1e-9 && !sim.done) { S.bot?.update(sim, sim.t); sim.step(Math.min(1 / 60, T - sim.t)); pump(); S.view?.update(sim.t, 1 / 60); }
  S.quiet = false;
  if (S.state === 'play') clock.start(0.05, S.reel, sim.film, sim.t);
}

// ---------- pause ----------
function pause() {
  if (S.state !== 'play') return;
  S.state = 'pause'; clock.hold(); Audio.suspend(); UI.hint(null);
  S.node = UI.pauseScreen({ muted: isMuted(), onResume: resume, onRestart: () => begin(S.prep), onQuit: goTitle, onMute: toggleMute });
  UI.show(S.node);
}
function resume() {
  if (S.state !== 'pause') return;
  unlockAudio(); Audio.resume(); clock.release();
  S.state = 'play';
  S.node = UI.playScreen({ onPause: pause, r: S.view.pauseRect(W, H) });
  UI.show(S.node);
  S.tut?.place();
}

// ---------- the end of the film ----------
const kindOf = (res) => (res.why === 'full' ? 'full' : res.why === 'expelled' ? 'expelled' : 'hungry');
function onEnd() {
  const sim = S.sim, res = sim.result, kind = kindOf(res), id = IDS[S.idx];
  S.state = 'end'; S.tut?.stop(); UI.hint(null); UI.hide();
  S.reel?.stop(kind === 'full' ? 1.4 : 0.45); Audio.house.stop(1);
  const rec = recordResult(save, id, res);
  if (S.idx === 0 && (res.pass || res.ate >= 3) && !save.tut) { save.tut = 1; writeSave(save); }
  const data = {
    curve: S.curve.slice(), hz: HZ, end: res.t, why: kind,
    crunches: sim.crunches.map(({ t: ct, L, heard, kind: k }) => ({ t: ct, L, heard, kind: k })),
    shush: sim.events.filter((e) => e.type === 'shush').map((e) => e.t),
  };
  const end = (S.end = { id, i: S.idx, kind, res, rec, data, snack: sim.snack.id, file: null });
  S.dimTo = kind === 'expelled' ? 0.9 : 0.64;
  setTimeout(() => { if (S.end === end && S.state === 'end') showResult(end); }, S.quiet || S.qa ? 0 : kind === 'expelled' ? 650 : 900);
}
function showResult(end) {
  const { id, i, kind, res, data } = end, isLast = i === LEVEL_COUNT - 1;
  Audio.ui.jingle(kind === 'full' ? 'win' : kind === 'expelled' ? 'lose' : 'hungry');
  S.node = UI.resultScreen({
    kind, res, film: t('films.' + id), data, isLast,
    onNext: () => (isLast ? goDone() : openTicket(i + 1)),
    onRetry: () => begin(S.prep), onMenu: goTitle, onShare: () => shareResult(end),
  });
  UI.show(S.node);
  cardFor(end);
}
function goDone() {
  leavePlay(); toStreet(0.72);
  S.state = 'allDone';
  music(true);
  const posters = IDS.map((id) => ({ id, title: t('films.' + id), src: posterSrc(id), set: save.films[id]?.set || [false, false, false] }));
  S.node = UI.doneScreen({ posters, stars: totalStars(save), max: MAX, onShare: shareSeason, onMenu: goTitle });
  UI.show(S.node);
}

// ---------- sharing ----------
const shareUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
function cardFor(end) {
  return (end.file ||= (async () => {
    await loadFonts();
    const poster = await loadPoster(end.id), meta = FILMS[end.i].meta;
    const cv = buildCard({ res: end.res, kind: end.kind, title: t('films.' + end.id), genre: t('genre.' + meta.genre), poster, data: end.data, t });
    return cardFile(cv, `crujido-${end.id}.png`);
  })().catch((e) => { console.warn('[CRUJIDO] card', e); return null; }));
}
function shareToast(r) {
  const k = { both: 'shareBoth', copied: 'copied', downloaded: 'shareDown', error: 'shareErr' }[r];
  if (k) UI.toast(UI.esc(t(k)));
}
async function shareResult(end) {
  const { res, kind, id } = end, three = kind === 'full' && res.stars.every(Boolean);
  const text = t('shareText.' + (three ? 'full3' : kind), {
    film: t('films.' + id), combo: t('combo.' + id), h: res.heard, snack: t('snack.' + end.snack), ate: res.ate, total: res.total,
  });
  shareToast(await shareCard(await cardFor(end), `${text} ${shareUrl()}`));
}
async function seasonFile() {
  await loadFonts();
  const posters = await Promise.all(IDS.map(async (id) => ({ title: t('films.' + id), img: await loadPoster(id), set: save.films[id]?.set || [false, false, false] })));
  return cardFile(buildSeasonCard({ posters, stars: totalStars(save), max: MAX, t }), 'crujido-ciclo.png');
}
async function shareSeason() {
  shareToast(await shareCard(await seasonFile(), `${t('shareText.done', { n: totalStars(save), m: MAX })} ${shareUrl()}`));
}

// ---------- the frame ----------
const fpsOn = q.get('fps') === '1';
let fpsAvg = 60;
function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (S.backdrop === 'view' && S.view) S.view.draw(g, W, H, dpr, S.sim.t);
  else {
    const i = S.state === 'boot' ? 0 : S.sel;
    FAC.draw(g, RF, dpr, performance.now() / 1000, { title: t('films.' + IDS[i]), genre: t('genre.' + FILMS[i].meta.genre), tagline: t('tagline'), rows: S.state === 'brief' ? boardRows() : null });
  }
  if (S.dim > 0.004) { g.fillStyle = `rgba(6,8,16,${S.dim.toFixed(3)})`; g.fillRect(0, 0, W, H); }
  if (S.fade.a > 0.004) { g.globalAlpha = S.fade.a; g.fillStyle = S.fade.col; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  if (fpsOn) { g.fillStyle = '#0f0'; g.font = '12px monospace'; g.textAlign = 'left'; g.fillText(`${fpsAvg.toFixed(0)} fps · dpr ${dpr}`, 6, H - 8); }
}
// a fanless laptop or an old phone: drop the resolution once rather than drop frames
function watchQuality(dt) {
  if (Q.done || S.state !== 'play' || document.hidden || !S.sim || S.sim.t < Q.skip) return;
  Q.n++; Q.t += dt;
  if (Q.t < 3) return;
  const avg = Q.t / Q.n;
  if (avg > 1 / 42 && Q.cap > 1) { Q.cap = Math.max(1, Q.cap - 0.5); console.info('[CRUJIDO] dpr cap', Q.cap); resize(); }
  else Q.done = true;
  Q.n = 0; Q.t = 0;
}
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = clamp((ms - last) / 1000, 0, 0.1); last = ms;
  if (fpsOn && dt > 0) fpsAvg += (1 / dt - fpsAvg) * 0.05;
  watchQuality(dt);
  if (S.state === 'play' && S.sim) {
    stepTo(clock.now());
    if (S.sim) {
      S.tut?.update(S.sim.t);
      const due = S.view.update(S.sim.t, dt);
      if (due) say(due, null, 0.7);
      S.reel?.update(S.sim);
    }
  } else if (S.state === 'end' && S.view) S.view.update(S.sim.t, dt);
  S.fade.a = clamp(S.fade.a + S.fade.v * dt, 0, 1);
  S.dim += (S.dimTo - S.dim) * (1 - Math.exp(-7 * dt));
  draw();
}

// ---------- input ----------
canvas.addEventListener('pointerdown', (e) => {
  lastPointer = e.pointerType || 'mouse';
  unlockAudio();
  if (S.state === 'play' && e.button <= 0) { e.preventDefault(); tapAt(e.timeStamp); }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || lastPointer; unlockAudio(); }, { capture: true, passive: true });
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  lastPointer = 'mouse';
  unlockAudio();
  const k = e.key;
  if (S.state === 'play') {
    if (k === ' ' || k === 'Enter' || k === 'ArrowDown' || k === 'x' || k === 'X') { e.preventDefault(); if (!e.repeat) tapAt(e.timeStamp); }
    else if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); pause(); }
  } else if (S.state === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); resume(); }
  else if (S.state === 'brief' && k === 'Escape') { e.preventDefault(); goTitle(); }
  else if ((S.state === 'end' || S.state === 'allDone') && k === 'Escape' && UI.screen()) { e.preventDefault(); goTitle(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', () => { if (!S.qa) pause(); });
window.addEventListener('pagehide', () => pause());
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// ---------- boot ----------
async function qaEntry() {
  const scr = q.get('screen'); if (!scr) return false;
  S.qa = true;
  const i = clamp((+q.get('level') || 1) - 1, 0, LEVEL_COUNT - 1);
  if (q.get('fill') === '1') {
    IDS.forEach((id, k) => { if (k < LEVEL_COUNT - 1 || scr === 'allDone') save.films[id] = { won: true, set: [true, k % 2 === 0, k % 3 === 0], stars: 1 + (k % 2 === 0) + (k % 3 === 0), plays: 2 }; });
  }
  if (scr === 'title') { S.sel = i; goTitle(); return true; }
  if (scr === 'allDone') { goDone(); return true; }
  openTicket(i);
  if (scr === 'brief') return true;
  const P = await prepare(i).promise;
  await begin(P);
  const tt = +q.get('t') || 0, out = q.get('outcome');
  if (scr === 'result') {
    // a cautious nibbler for the hungry ending: only ever bites deep under the film, and slowly
    let nx = 0;
    const lazy = { update(sim, at) { const L = sim.next(at); if (at > nx && L != null && sim.gauge(at) > L + 6) { sim.tap(at); nx = at + 2.4; } } };
    S.bot ||= out === 'hungry' ? lazy : makeBot(out === 'expelled' ? 'spam' : 'skilled', seed());
    fastForward(tt || 999);
  } else if (tt) fastForward(tt);
  if (scr === 'pause') pause();
  return true;
}
async function boot() {
  document.documentElement.lang = getLang();
  document.title = `${t('title')} · ${t('tagline')}`;
  S.sel = nextIndex();
  S.node = UI.bootScreen(); UI.show(S.node);
  resize();
  requestAnimationFrame((ms) => { last = ms; frame(ms); });
  const get = (u, d) => fetch(u).then((r) => (r.ok ? r.json() : d)).catch(() => d);
  [manifest, lines] = await Promise.all([get('assets/manifest.json', null), get('assets/lines.json', {})]);
  await Promise.race([Promise.all([loadFonts(), loadStreet(portrait() ? 'v' : 'h'), loadPoster(IDS[S.sel])]), wait(6000)]);
  Audio.setMuted(isMuted());
  window.__game = { S, clock, save, fastForward, pause, resume, begin, openTicket, goTitle, goDone, tap: tapAt, prepare, Audio, cardFor, seasonFile };
  const qa = await qaEntry().catch((e) => { console.error(e); return false; });
  if (!qa) goTitle();
  window.__ready = true;
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 400));
  idle(() => { IDS.forEach(loadPoster); loadStreet(portrait() ? 'h' : 'v'); sprites(); });
}
boot();
