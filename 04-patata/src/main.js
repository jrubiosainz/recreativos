// ¡PATATA!: boot, screens, the clock, input and the frame loop. The rules live in sim.js, the
// picture in scene.js and gfx/, the camera in hud.js, sound in audio.js; this file wires them.
import { Sim, setLines, judge } from './sim.js';
import { Bot, playOut } from './bot.js';
import { EVENTS, framesFor, humans } from './levels.js';
import { PEOPLE } from './people.js';
import { drawScene, drawFinder, bgSrc } from './scene.js';
import { playLayout, drawBody, drawLCD, drawButton, btnLabel, Speech, drawChorus } from './hud.js';
import { renderPrint, markSpots } from './print.js';
import { Audio } from './audio.js';
import { loadFonts } from './fonts.js';
import { t, setLang, getLang, detectLang } from './i18n.js';
import { loadSave, writeSave, loadPrints, recordResult, isUnlocked, totalStars } from './save.js';
import { buildCard, cardFile, shareCard } from './share.js';
import { Tutorial } from './tutorial.js';
import { clamp } from './util.js';
import * as UI from './ui/dom.js';
import { bootScreen, coverScreen, albumScreen, briefScreen } from './ui/album.js';
import { playScreen, pauseScreen } from './ui/play.js';
import { labScreen } from './ui/lab.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const save = loadSave();
if (!Array.isArray(save.hints)) save.hints = [];
if (q.get('unlock') === '1') save.unlockAll = true;
const forceMute = q.get('mute') === '1', skipTut = q.get('skip') === '1';
const botName = q.get('bot') ? (q.get('bot') === '1' ? 'skilled' : q.get('bot')) : null;
setLang(q.get('lang') || save.lang || detectLang());

const IDS = EVENTS.map((e) => e.id), MAX = EVENTS.length * 3, DT = 1 / 120, LEAD = 0.45;
const S = {
  state: 'boot', // boot | title | album | brief | play | pause | end
  idx: 0, ev: null, mode: 'h', sim: null, bot: null, tut: null, Lo: null, bg: null, anim: new Map(), speech: new Speech(),
  fx: null, voices: {}, node: null, end: null, prep: null, qa: false, quiet: false, fade: { a: 1, v: -2 },
};
let manifest = null, lines = {}, W = 1, H = 1, dpr = 1, safe = { t: 0, b: 0, l: 0, r: 0 }, last = performance.now();
const Q = { cap: Math.min(2, +q.get('dpr') || 2), n: 0, t: 0, done: false };
let lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const isTouch = () => q.get('touch') === '1' || lastPointer !== 'mouse';
const isMuted = () => forceMute || !!save.muted;
const modeFor = () => (H > W ? 'v' : 'h');
const seed = () => (q.has('seed') ? +q.get('seed') : (Math.random() * 1e9) | 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const unlocked = (i) => isUnlocked(save, IDS, i);
const nextIndex = () => { const i = IDS.findIndex((id, k) => unlocked(k) && !save.evs[id]?.won); return i < 0 ? 0 : i; };
const voices = () => manifest?.voices?.[getLang()] || manifest?.voices?.es || {};
const lineText = (id) => lines[id]?.[getLang()] || lines[id]?.es || '';

// ---------- images ----------
const imgCache = new Map();
function img(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res) => {
      const i = new Image(); i.decoding = 'async';
      i.onload = () => res(i); i.onerror = () => { console.info('[PATATA] image missing', src); res(null); }; i.src = src;
    }));
  }
  return imgCache.get(src);
}
const bgFor = (ev, mode) => img(bgSrc(ev, mode));

// ---------- audio ----------
let voicesP = null, voiceK = 0, wantMusic = false;
function loadVoices() {
  if (!voicesP && manifest && Audio.init()) voicesP = Audio.load(manifest, getLang(), (p) => { voiceK = p; S.prep?.tick?.(); }).then(() => { voiceK = 1; });
  return voicesP || Promise.resolve();
}
function unlockAudio() {
  Audio.setMuted(isMuted());
  Audio.unlock().then((ok) => { if (ok) { Audio.setMuted(isMuted()); if (wantMusic) Audio.music.box(); } });
  loadVoices();
}
function music(on) { wantMusic = on; if (on) Audio.music.box(); else Audio.music.stop(0.9); }
function toggleMute() { save.muted = !save.muted; writeSave(save); Audio.setMuted(isMuted()); return isMuted(); }
function switchLang() {
  const next = getLang() === 'es' ? 'en' : 'es';
  setLang(next); save.lang = next; writeSave(save);
  document.title = `${t('title')} · ${t('tagline')}`;
  if (voicesP) { voiceK = 0; voicesP = Audio.switchLang(next).then(() => { voiceK = 1; }); }
  S.prep = null; COVER.view = null;
  if (S.state === 'album') goAlbum(); else goCover();
}

// ---------- the clock: sim time follows the wall clock, and stops with the pause card ----------
const clock = {
  base: 0, held: null, last: 0,
  start(lead, at = 0) { this.base = performance.now() / 1000 + lead - at; this.held = null; this.last = at - lead; },
  now() { const v = (this.held ?? performance.now() / 1000) - this.base; return (this.last = Math.max(this.last, v)); },
  hold() { if (this.held == null) this.held = performance.now() / 1000; },
  release() { if (this.held != null) { this.base += performance.now() / 1000 - this.held; this.held = null; } },
};

// ---------- layout ----------
function probeSafe() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(d);
  const cs = getComputedStyle(d), v = (k) => parseFloat(cs[k]) || 0, r = { t: v('paddingTop'), r: v('paddingRight'), b: v('paddingBottom'), l: v('paddingLeft') };
  d.remove();
  return r;
}
let bodyCv = null;
function relayout() {
  if (!S.sim) return;
  S.Lo = playLayout(W, H, S.mode, safe);
  bodyCv ||= document.createElement('canvas');
  bodyCv.width = canvas.width; bodyCv.height = canvas.height;
  const bg = bodyCv.getContext('2d'); bg.setTransform(dpr, 0, 0, dpr, 0, 0); drawBody(bg, S.Lo);
  S.node?.place?.(S.Lo);
  S.tut?.place();
}
function resize() {
  dpr = Math.min(Q.cap, window.devicePixelRatio || 1);
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  safe = probeSafe();
  relayout();
  draw(0);
}
// the tutorial's note never covers a face or the shutter. Portrait: over the button. Side panel: under
// the button's words, or over the button (on the LCD) when a short screen has no room below. «Develop»:
// just above it, unless that would sit on the shutter; then it goes over the button too.
function hintWhere(target) {
  const Lo = S.Lo, m = 12;
  if (!Lo) return { r: { x: W / 2, y: H * 0.4, w: Math.min(W - 32, 340) }, dir: 'up' };
  const B = Lo.btn, lab = btnLabel(B), P = Lo.panel;
  const need = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) * 5.6 + 12;
  const pw = Math.min(P.w - 6, 280), px = P.x + P.w / 2, pp = clamp(B.cx - (px - pw / 2), 22, pw - 22);
  const over = () => ({ r: { x: px, y: B.cy - B.r * 1.3 - 10, w: pw, p: pp }, dir: 'down' });
  if (target === 'dev') {
    const d = Lo.dev, cx = d.x + d.w / 2;
    if (Lo.mode !== 'v' && d.y - 12 - need < lab.bottom + 6) return over();
    const w = Math.min(W - 2 * m, 300), x = clamp(cx, m + w / 2, W - m - w / 2);
    const y = Lo.mode === 'v' ? Math.min(d.y - 12, B.cy - B.r * 1.3 - 10) : d.y - 12;
    return { r: { x, y, w, p: clamp(cx - (x - w / 2), 22, w - 22) }, dir: 'down' };
  }
  if (Lo.mode === 'v') { const w = Math.min(W - 2 * m, 340); return { r: { x: B.cx, y: B.cy - B.r * 1.3 - 10, w }, dir: 'down' }; }
  const y = lab.bottom + 16;
  return y + need > H - safe.b - 6 ? over() : { r: { x: px, y, w: pw, p: pp }, dir: 'up' };
}

// ---------- the album ----------
function pageRows() {
  let nextSet = false;
  return EVENTS.map((ev, i) => {
    const r = save.evs[ev.id];
    let state = 'open';
    if (!unlocked(i)) state = 'locked';
    else if (r?.won) state = 'done';
    else if (!nextSet) { state = 'next'; nextSet = true; }
    return {
      id: ev.id, title: t('ev.' + ev.id + '.t'), date: t('ev.' + ev.id + '.d'), year: String(ev.date[0]), state,
      set: r?.set || [false, false, false], lockText: t('locked', { t: t('ev.' + EVENTS[Math.max(0, i - 1)].id + '.t') }),
    };
  });
}
// a saved print, developed again at the size asked for
async function printFromSave(ev, rec, long, canvas = null) {
  const bg = await bgFor(ev, rec.mode);
  return renderPrint({ mode: rec.mode, view: rec.view, flash: rec.flash, bands: rec.bands || [], flock: rec.flock || null }, { ev, bg, long, canvas, date: long >= 480 });
}
// the family posing with every eye open: the album cover before any photo of yours is in it
const COVER = { view: null };
function demoView(ev, mode) {
  const sim = new Sim(ev, { voices: voices(), seed: 11, mode });
  sim.step(1.2); sim.act(null);
  let best = null;
  for (let k = 0; k < 1400 && !sim.end; k++) {
    sim.tick(DT); sim.drain();
    if (sim.state === 'pose' && sim.t > sim.chorus.end + 0.3) { const v = sim.view(); if (judge(v).ok) { best = v; break; } }
  }
  return best || sim.view();
}
async function paintCover(node) {
  const cv = node.photo; if (!cv) return;
  const P = loadPrints(), id = [...IDS].reverse().find((k) => P[k]?.mode === 'h');
  const ev = id ? EVENTS[IDS.indexOf(id)] : EVENTS[0];
  let src;
  if (id) src = await printFromSave(ev, P[id], cv.width);
  else {
    COVER.view ||= demoView(ev, 'h');
    src = renderPrint({ mode: 'h', view: COVER.view, flash: false, bands: [], flock: null }, { ev, bg: await bgFor(ev, 'h'), long: cv.width });
  }
  if (S.node === node) cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
}
function goCover() {
  leavePlay();
  S.state = 'title';
  music(true);
  S.node = coverScreen({ muted: isMuted(), total: totalStars(save), max: MAX, started: Object.keys(save.evs).length > 0, onOpen: goAlbum, onMute: toggleMute, onLang: switchLang });
  UI.show(S.node);
  if (manifest) paintCover(S.node);
}
function goAlbum() {
  leavePlay();
  S.state = 'album';
  music(true);
  const pages = pageRows(), P = loadPrints();
  S.node = albumScreen({
    pages, muted: isMuted(), total: totalStars(save), max: MAX, finale: pages.every((p) => p.state === 'done'),
    onPick: (i) => { if (pages[i].state === 'locked') { UI.toast(UI.esc(pages[i].lockText)); Audio.cam.deny(); return; } openBrief(i); },
    onBack: goCover, onMute: toggleMute, onLang: switchLang,
  });
  UI.show(S.node);
  const node = S.node;
  node.thumbs.forEach((cv, i) => {
    const ev = EVENTS[i], rec = P[ev.id];
    if (!rec) return;
    const tall = rec.mode === 'v';
    cv.width = tall ? 240 : 360; cv.height = tall ? 360 : 240;
    cv.closest('.slot')?.classList.add('has', tall ? 'tall' : 'wide');
    printFromSave(ev, rec, 360, cv).catch((e) => console.info('[PATATA] thumb', e));
  });
}

// ---------- the index card: the place and the voices load while you read it ----------
function prepare(i) {
  const ev = EVENTS[i], mode = modeFor(), lang = getLang();
  if (S.prep && S.prep.i === i && S.prep.mode === mode && S.prep.lang === lang) return S.prep;
  const P = { i, mode, lang, p: 0, ready: false, bg: null, on: null };
  let pic = 0;
  P.tick = () => { P.p = Math.min(0.99, 0.7 * voiceK + 0.3 * pic); P.on?.(P.p); };
  P.promise = Promise.all([
    Promise.race([loadVoices(), wait(20000)]),
    bgFor(ev, mode).then((im) => { P.bg = im; pic = 1; P.tick(); }),
    loadFonts(),
  ]).then(() => { P.ready = true; P.p = 1; P.on?.(1); return P; });
  return (S.prep = P);
}
function openBrief(i) {
  if (!unlocked(i)) return;
  leavePlay();
  S.idx = i; S.state = 'brief';
  music(true);
  const ev = EVENTS[i];
  S.node = briefScreen({ ev, i, n: EVENTS.length, people: humans(ev), shots: framesFor(ev), set: save.evs[ev.id]?.set, onGo: enter, onBack: goAlbum });
  UI.show(S.node);
  if (manifest) prepare(i);
}
let entering = false;
async function enter(node) {
  if (entering) return;
  entering = true;
  unlockAudio();
  try {
    const P = prepare(S.idx);
    if (!P.ready) {
      P.on = (p) => node.setProgress(p); node.setProgress(P.p);
      await P.promise;
      P.on = null;
      if (S.node !== node) return;
      node.ready();
    }
    Audio.ui.flip();
    node.classList.add('leaving');
    await wait(S.qa ? 0 : 280);
    if (S.node === node) begin(P);
  } finally { entering = false; }
}

// ---------- the photo ----------
const freshFx = () => ({ flash: 0, shut: 0, press: 0, shake: 0, beepAt: 0, flashWas: true, denyT: -9 });
function begin(P) {
  leavePlay();
  const i = P.i, ev = EVENTS[i], sd = seed();
  const sim = new Sim(ev, { voices: voices(), seed: sd, mode: P.mode });
  Object.assign(S, { sim, idx: i, ev, mode: P.mode, bg: P.bg, state: 'play', end: null, view: null, anim: new Map(), fx: freshFx(), voices: {} });
  S.speech.clear();
  S.bot = botName ? new Bot(sim, botName, sd) : null;
  const basics = i === 0 && !save.tut && !skipTut && !S.bot;
  S.tut = !S.bot && !skipTut ? new Tutorial(sim, {
    t, hint: UI.hint, where: hintWhere, basics, seen: new Set(save.hints),
    onSeen: (k) => { if (!save.hints.includes(k)) { save.hints.push(k); writeSave(save); } },
    onDone: () => { save.tut = 1; writeSave(save); },
  }) : null;
  if (S.tut?.done) S.tut = null;
  music(false); Audio.amb.start(ev.amb);
  clock.start(LEAD);
  S.fade = { a: 1, v: -1 / 0.45 };
  Q.n = 0; Q.t = 0;
  S.node = playScreen({ ev, muted: isMuted(), onPause: pause, onDevelop: develop, onMute: toggleMute });
  UI.show(S.node);
  relayout();
}
function restart(i) { const P = prepare(i); if (P.ready) begin(P); else P.promise.then((R) => { if (S.state !== 'play') begin(R); }); }
function leavePlay() {
  if (!S.sim) return;
  Audio.amb.stop(0.4);
  for (const h of Object.values(S.voices)) h?.stop?.(0.08);
  Audio.resume(); clock.release();
  S.tut?.stop(); UI.hint(null);
  S.speech.clear();
  S.sim = S.bot = S.tut = S.end = S.view = null; S.voices = {};
}
function develop() {
  const sim = S.sim;
  if (S.state !== 'play' || !sim || sim.end || !sim.prints.length) return;
  Audio.ui.tap();
  sim.develop(); pump();
}

// every sim event becomes what you see and hear
function onSay(e) {
  const sim = S.sim, you = sim.by.you, off = e.who === 'you' && !(you && you.present);
  if (e.cat !== 'pat') S.speech.add({ id: e.id, who: e.who, text: lineText(e.id), t0: e.t0, dur: e.dur, off });
  if (S.quiet) return;
  const late = sim.t - e.t0;
  if (late > e.dur) return;
  const r = Audio.say(e.id, { x: e.x, you: off, delay: Math.max(0, -late), offset: Math.max(0, late) });
  if (r?.h && e.cat !== 'pat') { S.voices[e.who]?.stop?.(0.05); S.voices[e.who] = r.h; }
}
function pump() {
  const sim = S.sim; if (!sim) return;
  for (const e of sim.drain()) {
    S.tut?.event(e);
    switch (e.k) {
      case 'say': onSay(e); break;
      case 'hush': S.speech.cut(e.who, e.t); S.voices[e.who]?.stop?.(0.06); S.voices[e.who] = null; break;
      case 'timer': if (!S.quiet) Audio.cam.beep(undefined, true); S.fx.beepAt = Math.floor(e.fire - e.t) - 1; break;
      case 'call': if (!S.quiet) Audio.cam.focus(); break;
      case 'shot':
        S.fx.shut = 1;
        if (e.flash) { S.fx.flash = 1; S.fx.flashWas = false; }
        if (!S.quiet) { Audio.cam.shutter(); if (e.flash) Audio.cam.flash(undefined, 2.6); if (isTouch()) navigator.vibrate?.(16); }
        break;
      case 'deny':
        S.fx.shake = 1;
        if (!S.quiet) {
          Audio.cam.deny();
          if (performance.now() / 1000 - S.fx.denyT > 1.6) { S.fx.denyT = performance.now() / 1000; UI.toast(UI.esc(t('deny.' + e.why)), 1600); }
        }
        break;
      case 'coo': if (!S.quiet) Audio.birds.coo((e.x - 0.5) * 1.2); break;
      case 'flap': if (!S.quiet) Audio.birds.flap(e.x0, e.x1, e.dur); break;
      case 'end': onEnd(e); return;
    }
  }
}
// the self-timer beeps every second, then fast for the last two; the flash says when it is ready
function camTicks() {
  const sim = S.sim, fx = S.fx;
  if (sim.timer && !sim.timer.fired) {
    const left = sim.timer.fire - sim.t;
    if (left > 2) { const k = Math.ceil(left) - 1; if (k < fx.beepAt) { fx.beepAt = k; if (!S.quiet) Audio.cam.beep(); } }
    else { const k = Math.ceil(left / 0.25); if (fx.fast == null || k < fx.fast) { fx.fast = k; if (!S.quiet && k > 0) Audio.cam.beep(undefined, true); } }
  } else fx.fast = null;
  if (sim.ev.flash && !fx.flashWas && sim.t >= sim.flashReady && !sim.end) { fx.flashWas = true; if (!S.quiet) Audio.cam.ready(); }
}
function stepTo(tt) {
  const sim = S.sim;
  if (!sim || sim.end || tt <= sim.t) return;
  if (S.bot) while (sim.t < tt - 1e-9 && !sim.end) { sim.tick(DT); S.bot.tick(); pump(); if (!S.sim) return; }
  else { sim.stepTo(tt); pump(); }
}
// a tap counts against what was on screen when it happened, not when the frame got to it
function tapAt(stamp = performance.now()) {
  const sim = S.sim;
  if (S.state !== 'play' || !sim || sim.end || S.bot) return;
  const tt = clock.now() - clamp((performance.now() - stamp) / 1000, 0, 0.1);
  if (tt < 0) return;
  stepTo(tt);
  S.fx.press = 1;
  sim.act(sim.seenAt(tt - 0.012));
  pump();
}
function fastForward(T, acts = []) {
  const sim = S.sim; if (!sim) return;
  const A = acts.slice().sort((a, b) => a - b);
  S.quiet = true;
  while (sim.t < T - 1e-9 && !sim.end) {
    sim.tick(DT); S.bot?.tick();
    while (A.length && sim.t >= A[0]) { A.shift(); sim.act(sim.view()); }
    if (T - sim.t < 0.2) sim.view(true);
    pump(); if (!S.sim) break;
  }
  S.quiet = false;
  if (S.state === 'play') clock.start(0, sim.t);
}

// ---------- pause ----------
function pause() {
  if (S.state !== 'play' || !S.sim || S.sim.end) return;
  S.state = 'pause'; clock.hold(); Audio.suspend(); UI.hint(null);
  S.node = pauseScreen({ muted: isMuted(), onResume: resume, onRestart: () => restart(S.idx), onQuit: goAlbum, onMute: toggleMute });
  UI.show(S.node);
  S.fade.a = 0; draw(0);
}
function resume() {
  if (S.state !== 'pause') return;
  unlockAudio(); Audio.resume(); clock.release();
  S.state = 'play';
  S.node = playScreen({ ev: S.ev, muted: isMuted(), onPause: pause, onDevelop: develop, onMute: toggleMute });
  UI.show(S.node);
  S.node.place(S.Lo); S.node.showDevelop(S.sim.prints.length > 0 && !S.bot);
  S.tut?.place();
}

// ---------- the envelope from the photo shop ----------
const bestOf = (sim) => sim.prints.filter((p) => p.ok).sort((a, b) => b.E - a.E || a.i - b.i)[0] || null;
function pickLine(won, ev) {
  const ids = (won ? ['w_1', 'w_2', 'w_3'] : ['f_1', 'f_2', 'f_3']).filter((id) => lines[id] && ev.cast.includes(lines[id].who));
  if (!ids.length) return null;
  const id = ids[Math.floor(Math.random() * ids.length)], who = lines[id].who;
  return { id, who, text: lineText(id), name: PEOPLE[who]?.name?.[getLang()] || '' };
}
function onEnd(e) {
  const sim = S.sim, ev = sim.ev, i = S.idx;
  S.state = 'end'; S.tut?.stop(); UI.hint(null);
  Audio.amb.stop(e.why === 'develop' ? 0.8 : 1.6);
  const was = save.evs[ev.id]?.set?.slice() || [false, false, false];
  const rec = recordResult(save, ev, sim, S.mode);
  const end = (S.end = { i, ev, rec, was, sim, mode: S.mode, bg: S.bg, prints: null });
  S.node?.showDevelop?.(false);
  setTimeout(() => { if (S.end === end && S.state === 'end') showLab(end); }, S.qa ? 0 : e.why === 'develop' ? 420 : 1100);
}
function showLab(end) {
  const { sim, ev, rec, was, i, mode } = end, best = bestOf(sim);
  const prints = sim.prints.map((p) => {
    const canvas = renderPrint({ mode, view: p.view, flash: p.flash, bands: sim.shade(p.view.t), flock: sim.flock(p.view.t) }, { ev, bg: end.bg, long: 960 });
    return { canvas, ok: p.ok, best: p === best, spots: p.ok ? [] : markSpots(ev, mode, p.culprits, canvas.width, canvas.height) };
  });
  end.prints = prints; S.lastEnd = end;
  const won = rec.set[0], isLast = i === EVENTS.length - 1, line = pickLine(won, ev);
  UI.hint(null);
  S.node = labScreen({
    ev, prints, set: rec.set, was, line, isLast, won, fast: S.qa && q.get('anim') !== '1',
    onJudge: () => line && Audio.say(line.id, { x: 0.5 }),
    onRetry: () => restart(i), onAlbum: goAlbum,
    onNext: () => (isLast ? goAlbum() : openBrief(i + 1)),
    onShare: () => shareResult(end),
  });
  UI.show(S.node);
  leavePlay();
  S.state = 'end';
}

// ---------- sharing ----------
const shareUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
function cardFor(end) {
  return (end.file ||= (async () => {
    await loadFonts();
    const p = end.prints.find((x) => x.best) || end.prints[end.prints.length - 1];
    if (!p) return null;
    const cv = buildCard({ photo: p.canvas, spots: p.spots, set: end.rec.set, ev: end.ev, won: end.rec.set[0], url: shareUrl() });
    return cardFile(cv, `patata-${end.ev.id}.png`);
  })().catch((e) => { console.info('[PATATA] card', e); return null; }));
}
async function shareResult(end) {
  const n = end.rec.set.filter(Boolean).length;
  const text = end.rec.set[0] ? t('shareText', { s: n }) : t('shareFail');
  const r = await shareCard(await cardFor(end), `${text} ${shareUrl()}`);
  const k = { both: 'saved', downloaded: 'saved', copied: 'copied', error: 'shareErr' }[r];
  if (k) UI.toast(UI.esc(t(k)));
}

// ---------- the frame ----------
function button(sim) {
  let kind;
  if (sim.end) kind = 'out';
  else if (sim.canTimer) kind = 'timer';
  else if (sim.canCall) kind = 'call';
  else if (sim.canShoot) kind = 'shot';
  else if (sim.state === 'relax' && sim.t < sim.flashReady) kind = 'wait';
  else if (sim.patience <= 0 || sim.leaveAt) kind = 'out';
  else kind = 'busy';
  const label = kind === 'busy' && sim.timer && !sim.timer.fired && sim.by.you?.run ? t('timerTag') : t('btn.' + kind);
  return { kind, label, charge: clamp(1 - (sim.flashReady - sim.t) / 2.6) };
}
const LCD_L = () => ({ shots: t('hud.shots'), patience: t('hud.patience'), timer: t('hud.timer') });
function drawPlay(dt) {
  const sim = S.sim, Lo = S.Lo, ev = S.ev, mode = S.mode, now = sim.t, v = S.view || sim.view(), fx = S.fx;
  if (bodyCv) g.drawImage(bodyCv, 0, 0, W, H); else drawBody(g, Lo);
  drawScene(g, Lo.vf, { ev, mode, bg: S.bg, view: v, S: S.anim, t: now, dt, bands: sim.shade(now), flock: sim.flock(now), flash: fx.flash });
  drawFinder(g, Lo.vf, { shutter: Math.sqrt(fx.shut) });
  drawChorus(g, Lo, ev, mode, sim.chorus, now, t('chorus'));
  S.speech.draw(g, Lo, ev, mode, now, v);
  const b = button(sim), timing = sim.timer && !sim.timer.fired;
  drawLCD(g, Lo.lcd, {
    frames: sim.frames, patience: sim.patience, P: sim.P, flash: !!ev.flash, charge: b.charge,
    timer: timing ? sim.timer.fire - now : null, timerOn: ev.timer ? !!sim.timer : null, t: now, L: LCD_L(),
  });
  drawButton(g, Lo.btn, { ...b, press: fx.press, t: now, shake: fx.shake });
}
let clean = false;
function draw(dt) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (S.sim && S.Lo && (S.state === 'play' || S.state === 'pause' || S.state === 'end')) {
    clean = false;
    drawPlay(dt);
    if (S.fade.a > 0.004) { g.fillStyle = `rgba(8,6,6,${S.fade.a.toFixed(3)})`; g.fillRect(0, 0, W, H); }
  } else if (!clean) { g.clearRect(0, 0, W, H); clean = true; }
}
// a fanless laptop or an old phone: drop the resolution once rather than drop frames
function watchQuality(dt) {
  if (Q.done || S.state !== 'play' || document.hidden || !S.sim || S.sim.t < 1.5) return;
  Q.n++; Q.t += dt;
  if (Q.t < 3) return;
  const avg = Q.t / Q.n;
  if (avg > 1 / 42 && Q.cap > 1) { Q.cap = Math.max(1, Q.cap - 0.5); console.info('[PATATA] dpr cap', Q.cap); resize(); }
  else Q.done = true;
  Q.n = 0; Q.t = 0;
}
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = clamp((ms - last) / 1000, 0, 0.1); last = ms;
  watchQuality(dt);
  if (S.state === 'play' && S.sim) {
    stepTo(clock.now());
    if (S.sim) {
      S.view = S.sim.view(true);
      camTicks();
      S.tut?.update(S.sim.t);
      S.node?.showDevelop?.(S.sim.prints.length > 0 && !S.sim.end && !S.bot);
    }
  }
  const fx = S.fx;
  if (fx) {
    fx.flash = Math.max(0, fx.flash - dt / 0.3); fx.shut = Math.max(0, fx.shut - dt / 0.2);
    fx.press = Math.max(0, fx.press - dt / 0.14); fx.shake = Math.max(0, fx.shake - dt / 0.35);
  }
  S.fade.a = clamp(S.fade.a + S.fade.v * dt, 0, 1);
  if (S.state !== 'pause') draw(dt);
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
    if (k === ' ' || k === 'Enter' || k === 'ArrowUp' || k === 'x' || k === 'X') { e.preventDefault(); if (!e.repeat) tapAt(e.timeStamp); }
    else if (k === 'd' || k === 'D' || k === 'r' || k === 'R') { e.preventDefault(); develop(); }
    else if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); pause(); }
  } else if (S.state === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); resume(); }
  else if (k === 'Escape' && (S.state === 'brief' || S.state === 'end')) { e.preventDefault(); goAlbum(); }
  else if (k === 'Escape' && S.state === 'album') { e.preventDefault(); goCover(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', () => { if (!S.qa) pause(); });
window.addEventListener('pagehide', () => pause());
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// ---------- boot ----------
// QA only: pretend the first n photos were taken by a good player, in both orientations
function fillSave(n) {
  for (let k = 0; k < Math.min(n, EVENTS.length); k++) {
    const ev = EVENTS[k], mode = k % 3 === 1 ? 'v' : 'h';
    const sim = playOut(new Sim(ev, { voices: voices(), seed: 100 + k, mode }), 'skilled', 7 + k);
    recordResult(save, ev, sim, mode);
  }
}
async function qaEntry() {
  const scr = q.get('screen'); if (!scr) return false;
  S.qa = true;
  const i = clamp((+q.get('level') || 1) - 1, 0, EVENTS.length - 1);
  if (q.get('fill')) fillSave(+q.get('fill') || EVENTS.length);
  if (scr === 'cover') { goCover(); return true; }
  if (scr === 'album') { goAlbum(); return true; }
  openBrief(i);
  if (scr === 'brief') return true;
  const P = await prepare(i).promise;
  begin(P);
  const T = +q.get('t') || 0, acts = (q.get('acts') || '').split(',').filter(Boolean).map(Number);
  if (scr === 'end') {
    S.bot ||= new Bot(S.sim, q.get('out') || 'skilled', 5);
    fastForward(T || 240, acts);
    const sim = S.sim;
    if (sim && !sim.end) { if (sim.prints.length) sim.develop(); else sim.finish('patience'); pump(); }
    return true;
  }
  if (T || acts.length) fastForward(T || Math.max(...acts) + 0.01, acts);
  if (q.get('hold') === '1') clock.hold();
  if (scr === 'pause') pause();
  return true;
}
async function boot() {
  document.title = `${t('title')} · ${t('tagline')}`;
  S.node = bootScreen(); UI.show(S.node);
  resize();
  requestAnimationFrame((ms) => { last = ms; frame(ms); });
  const get = (u, d) => fetch(u).then((r) => (r.ok ? r.json() : d)).catch(() => d);
  [manifest, lines] = await Promise.all([get('assets/manifest.json', null), get('assets/lines.json', {})]);
  setLines(lines);
  await Promise.race([Promise.all([loadFonts(), bgFor(EVENTS[0], 'h')]), wait(6000)]);
  Audio.setMuted(isMuted());
  window.__game = { S, clock, save, fastForward, pause, resume, begin, restart, openBrief, goAlbum, goCover, tap: tapAt, develop, prepare, Audio, cardFor };
  const qa = await qaEntry().catch((e) => { console.error(e); return false; });
  if (!qa) goCover();
  window.__ready = true;
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 500));
  idle(() => { bgFor(EVENTS[nextIndex()], modeFor()); });
}
boot();
