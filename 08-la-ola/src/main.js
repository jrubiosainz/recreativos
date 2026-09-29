// LA OLA: minute 80, 0–0, the stadium is bored. You run the big screen; whoever appears on it stands
// up and waves at the camera. Start a Mexican wave and keep it going round the stadium before the
// final whistle. This file is the conductor: the fixed-step clock, input, the screens, the title's
// attract loop, the end of a match, sharing, QA entry points.
import { Sim, DT } from './sim.js';
import { LEVELS, parse } from './levels.js';
import { Bot } from './bot.js';
import { Scene } from './scene.js';
import { loadFonts } from './fonts.js';
import { t, setLang, getLang, detectLang } from './i18n.js';
import { loadSave, writeSave, recordResult, isUnlocked } from './save.js';
import * as UI from './ui/dom.js';
import { titleScreen } from './ui/title.js';
import { Hud, pauseCard } from './ui/play.js';
import { resultScreen } from './ui/result.js';
import { Tutorial } from './tutorial.js';
import { shareResult, makeCard } from './share.js';
import { Audio } from './audio.js';
import { clamp } from './util.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const save = loadSave();
setLang(q.get('lang') || save.lang || detectLang());
const forceMute = q.get('mute') === '1', skipTut = q.get('skip') === '1';
const N = LEVELS.length;
const S = { state: 'boot', i: 0, level: null, ring: null, sim: null, scene: null, hud: null, tut: null, bot: null, acc: 0, endShown: false, shot: null, rec: null, pauseNode: null, qa: false, attract: false };
const keys = { l: false, r: false, fast: false, space: false, mouse: false, touchAir: false, aim: null };
let W = 1, H = 1, dpr = 1, last = performance.now(), lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const Q = { cap: Math.min(2, +q.get('dpr') || 2), n: 0, t: 0, done: false };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = () => q.get('touch') === '1' || lastPointer === 'touch';
const isMuted = () => forceMute || !!save.muted;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const buzz = (ms) => { if (isTouch() && !isMuted()) navigator.vibrate?.(ms); };

function labelDoc() {
  document.title = `LA OLA · ${t('tagline')}`;
  canvas.setAttribute('aria-label', t('canvas'));
}

// ---------- sound: born on the first gesture ----------
function unlockAudio() {
  if (S.state === 'pause') return;
  Audio.setMuted(isMuted());
  if (!Audio.init()) return;
  Audio.unlock().then((ok) => {
    if (!ok) return;
    Audio.setMuted(isMuted());
    if (S.state === 'play' && !S.sound) { S.sound = true; Audio.start(S.level); }
  });
}
function toggleMute() {
  save.muted = !save.muted; writeSave(save);
  Audio.setMuted(isMuted());
  return isMuted();
}
function switchLang() {
  const next = getLang() === 'es' ? 'en' : 'es';
  setLang(next); save.lang = next; writeSave(save);
  labelDoc();
  goTitle();
}

// ---------- layout ----------
function resize() {
  dpr = Math.min(Q.cap, window.devicePixelRatio || 1);
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  document.body.classList.toggle('touch', isTouch());
  if (S.scene && S.sim) { setPad(); S.scene.resize(W, H, dpr); S.scene.draw(); }
  else { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
}
// what the DOM covers, so the stadium is framed beside it: the chip on top, the ON AIR button below,
// and at full time the result board, when it stands on the right. The notch and the home bar too:
// the page runs edge to edge (viewport-fit=cover) and the HUD moves in by the safe-area insets.
let safeProbe = null;
function safeInsets() {
  if (!safeProbe) {
    safeProbe = document.createElement('div');
    safeProbe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l)';
    document.body.append(safeProbe);
  }
  const cs = getComputedStyle(safeProbe), n = (v) => parseFloat(v) || 0;
  return { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) };
}
function setPad() {
  const sc = S.scene; if (!sc) return;
  const touch = isTouch() && S.state !== 'title', tall = H > W * 1.12, s = safeInsets();
  const board = S.state === 'end' ? document.querySelector('.result .board') : null;
  const r = board && board.offsetLeft > W * 0.3 ? W - board.offsetLeft + 6 : 0;
  sc.pad = { t: (tall ? 58 : 0) + s.t, b: (touch ? (tall ? 104 : 20) : 0) + s.b, l: s.l, r: Math.max(r, s.r), hud: 48 + s.t };
}

// ---------- screens ----------
function goTitle() {
  leavePlay();
  S.state = 'title';
  document.body.dataset.screen = 'title';
  startAttract();
  titleScreen({ levels: LEVELS, save, onPlay: begin, onMute: toggleMute, onLang: switchLang, reduce: reduce() });
}
// the title's backdrop: the next ground to play, with the autopilot director getting a wave round
function startAttract() {
  const k = Math.max(0, LEVELS.findIndex((lv, i) => isUnlocked(save, LEVELS, i) && !save.lv[lv.id]?.done));
  load(k, true);
  S.bot = new Bot(S.sim, { dir: 1, seed: 11 + Math.floor(Math.random() * 1000) });
  S.attract = true;
  // start with the wave already on its way
  fastForward(reduce() ? 24 : 9);
  S.scene.draw();
}
function load(i, attract = false) {
  const lv = LEVELS[i], ring = parse(lv), sim = new Sim(lv, ring);
  Object.assign(S, { i, level: lv, ring, sim, acc: 0, endShown: false, shot: null, rec: null, bot: null, attract, deaths: {} });
  keys.aim = null;
  setPad();
  S.scene.load(lv, ring, sim);
  S.scene.resize(W, H, dpr);
}
function leavePlay() {
  S.tut?.dispose(); S.tut = null;
  S.hud?.finish(); S.hud = null;
  S.pauseNode?.remove(); S.pauseNode = null;
  UI.hint(null);
  Audio.stop();
  S.sound = false;
  S.attract = false;
}

function begin(i) {
  leavePlay();
  S.state = 'play';
  document.body.dataset.screen = 'play';
  load(i);
  const lv = S.level, sim = S.sim;
  S.bot = q.get('bot') === '1' ? new Bot(sim, { dir: 1, seed: 7 }) : null;
  S.hud = new Hud({ level: lv, sim, input: keys, touch: isTouch(), onPause: pause });
  S.hud.mount();
  S.tut = skipTut || (S.bot && q.get('tut') !== '1') ? null : new Tutorial({ level: lv, sim, scene: S.scene, save, touch: isTouch(), onSeen: (k) => { if (!save.hints.includes(k)) { save.hints.push(k); writeSave(save); } } });
  document.activeElement?.blur?.();
  if (Audio.live) { S.sound = true; Audio.start(lv); }
  last = performance.now();
}

// ---------- pause ----------
function releaseKeys() { keys.l = keys.r = keys.fast = keys.space = keys.mouse = keys.touchAir = false; S.hud?.release?.(); }
function pause() {
  if (S.state !== 'play' || S.sim?.end) return;
  S.state = 'pause';
  releaseKeys();
  Audio.suspend();
  S.pauseNode = pauseCard({
    save, touch: isTouch(),
    onResume: resume,
    onRestart: () => { S.pauseNode?.remove(); S.pauseNode = null; Audio.resume(); begin(S.i); },
    onLevels: () => { Audio.resume(); goTitle(); },
    onMute: toggleMute,
  });
  document.getElementById('ui').appendChild(S.pauseNode);
  S.scene.draw();
  requestAnimationFrame(() => S.pauseNode?.querySelector('[data-autofocus]')?.focus({ preventScroll: true }));
}
function resume() {
  if (S.state !== 'pause') return;
  S.pauseNode?.remove(); S.pauseNode = null;
  S.state = 'play';
  Audio.resume();
  last = performance.now();
  document.activeElement?.blur?.();
}

// ---------- the final whistle ----------
function captureShot() {
  const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
  c.getContext('2d').drawImage(canvas, 0, 0);
  c.box = S.scene.bowlBox();
  c.scr = { ...S.scene.scr };
  S.shot = c;
}
function showResult() {
  if (S.endShown) return;
  S.endShown = true;
  const lv = LEVELS[S.i], sim = S.sim;
  S.rec = S.qa && q.get('norecord') === '1' ? null : recordResult(save, lv, sim);
  S.tut?.dispose(); S.tut = null;
  const nextLevel = LEVELS[S.i + 1] || null;
  S.state = 'end';
  document.body.dataset.screen = 'end';
  resultScreen({
    level: lv, sim, rec: S.rec, deaths: S.deaths, nextLevel, nextOpen: !!nextLevel && isUnlocked(save, LEVELS, S.i + 1), reduce: reduce(),
    onAgain: () => begin(S.i),
    onNext: () => begin(S.i + 1),
    onShare: () => shareResult({ level: lv, sim, shot: S.shot, toast: UI.toast }),
    onLevels: () => goTitle(),
  });
  // the director cuts to a wide shot that leaves room for the board
  setPad();
  if (S.scene.pad.r) { S.scene.resize(W, H, dpr); S.scene.draw(); }
}
function onEvents(evs) {
  for (const e of evs) {
    if (e.k === 'die') S.deaths[e.why] = (S.deaths[e.why] || 0) + 1;
    else if (e.k === 'lap' && e.id === S.sim.bestId) buzz([20, 40, 20]);
    else if (e.k === 'ola') buzz(25);
    else if (e.k === 'cut') buzz(60);
    else if (e.k === 'whistle') { S.hud?.finish(); S.tut?.dispose(); S.tut = null; UI.hint(null); }
  }
}

// ---------- the clock ----------
function applyInput() {
  const sim = S.sim, pan = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
  if (pan) keys.aim = null;
  sim.input.aim = keys.aim; sim.input.pan = pan; sim.input.fast = keys.fast;
  sim.input.air = !sim.end && (keys.space || keys.mouse || keys.touchAir);
  S.scene.aim = sim.end ? null : keys.aim;
}
function step() {
  const sim = S.sim, sc = S.scene;
  if (S.bot && !sim.end) S.bot.step(); else applyInput();
  sim.tick();
  if (sim.ev.length) {
    sc.events(sim.ev);
    if (!S.attract) {
      S.tut?.events(sim.ev);
      if (!S.quiet) for (const e of sim.ev) Audio.event(e, sim);
      onEvents(sim.ev);
    }
  }
}
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = clamp((ms - last) / 1000, 0, 0.1); last = ms;
  watchQuality(dt);
  const live = S.state === 'play' || S.state === 'end' || (S.state === 'title' && S.attract && !reduce());
  if (live && S.sim) {
    const sc = S.scene, sim = S.sim;
    S.acc += dt;
    let n = 0;
    while (S.acc >= DT && n < 30) { step(); S.acc -= DT; n++; }
    if (n >= 30) S.acc = 0;
    sc.update(dt);
    sc.draw();
    if (S.attract) { if (sim.end && sim.time - sim.end.t > 4) startAttract(); return; }
    if (!S.quiet) Audio.frame(sim, dt, sc);
    S.hud?.update();
    S.tut?.update(dt);
    if (sim.end && !S.shot && sim.time - sim.end.t > 0.35) captureShot();
    if (sim.end && !S.endShown && sim.time - sim.end.t > 1.6) showResult();
  }
}
// a fanless laptop or an old phone: drop the resolution once rather than drop frames
function watchQuality(dt) {
  if (Q.done || S.qa || S.state !== 'play' || document.hidden || !S.sim || S.sim.time < 1.5) return;
  Q.n++; Q.t += dt;
  if (Q.t < 3) return;
  const avg = Q.t / Q.n;
  if (avg > 1 / 45 && Q.cap > 1) { Q.cap = Math.max(1, Q.cap - 0.5); console.info('[LA OLA] dpr cap', Q.cap); resize(); }
  else Q.done = true;
  Q.n = 0; Q.t = 0;
}

// ---------- input ----------
// The pointer aims (the camera pans toward the seats under it); hold the button, or Space, to put the
// shot ON AIR. ← → (or A D) pan by hand, Shift faster. Esc or P pause. On touch screens: drag on the
// stadium to aim, hold the EN EL AIRE button to broadcast.
const aimAt = (e) => { if (S.state === 'play' && S.scene && !S.sim?.end) keys.aim = S.scene.columnAt(e.clientX, e.clientY); };
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key !== 'Tab') lastPointer = 'mouse';
  unlockAudio();
  const k = e.key;
  if (k === 'Shift') keys.fast = true;
  if (S.state === 'play') {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.l = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.r = true; e.preventDefault(); }
    else if (k === ' ' || k === 'Enter' && e.target === document.body) { keys.space = true; e.preventDefault(); }
    else if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); pause(); }
  } else if (S.state === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); resume(); }
  else if (S.state === 'end' && S.endShown && k === 'Escape') { e.preventDefault(); goTitle(); }
  else if (S.state === 'end' && S.endShown && (k === 'r' || k === 'R')) { e.preventDefault(); begin(S.i); }
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'Shift') keys.fast = false;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.l = false;
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.r = false;
  else if (k === ' ' || k === 'Enter') keys.space = false;
});
canvas.addEventListener('pointerdown', (e) => {
  lastPointer = e.pointerType || 'mouse';
  if (S.state !== 'play') return;
  e.preventDefault();
  aimAt(e);
  if (e.pointerType === 'mouse') { if (e.button === 0) keys.mouse = true; }
  else canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' || e.buttons || e.pointerType === 'pen') aimAt(e);
  else if (e.pointerType === 'touch') aimAt(e);
});
window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') keys.mouse = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || lastPointer; document.body.classList.toggle('touch', isTouch()); unlockAudio(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S.state === 'play') pause(); else Audio.suspend(); } else if (S.state !== 'pause') Audio.resume(); });
window.addEventListener('blur', () => { releaseKeys(); if (!S.qa) pause(); });
window.addEventListener('pagehide', () => pause());
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// ---------- QA ----------
function fillSave(n) {
  for (let k = 0; k < Math.min(n, N); k++) {
    const lv = LEVELS[k], sim = new Sim(lv, parse(lv)), bot = new Bot(sim, { dir: 1, seed: 7 });
    while (!sim.end) { bot.step(); sim.tick(); }
    recordResult(save, lv, sim);
  }
}
// jump ahead without sound; the scene keeps up so the pops and the camera are where they'd be
function fastForward(T, after = 0) {
  const sim = S.sim, sc = S.scene;
  S.quiet = true;
  let n = 0;
  while (sim.time < T - 1e-9 && !(sim.end && sim.time - sim.end.t >= after)) {
    step(); n++;
    if (n % 2 === 0) sc.update(DT * 2);
  }
  S.quiet = false;
  S.acc = 0;
}
async function qaEntry() {
  const scr = q.get('screen'); if (!scr) return false;
  S.qa = true;
  const i = clamp((+q.get('level') || 1) - 1, 0, N - 1);
  if (q.get('fill')) fillSave(+q.get('fill') || N);
  if (q.get('unlock') === '1') save.unlockAll = true;
  if (scr === 'title') { goTitle(); return true; }
  if (!isUnlocked(save, LEVELS, i)) save.unlockAll = true;
  begin(i);
  const T = +q.get('t') || 0;
  if (q.get('bot') === '1' || scr === 'end') S.bot ||= new Bot(S.sim, { dir: 1, seed: 7 });
  if (scr === 'end') {
    S.tut?.dispose(); S.tut = null;
    fastForward(T || 999, 0.4);
    S.scene.draw(); captureShot();
    fastForward(S.sim.time + 1.3, 99);
    showResult();
    return true;
  }
  if (T) fastForward(T);
  if (q.get('air') === '1') keys.space = true;
  if (scr === 'pause') pause();
  return true;
}

// ---------- boot ----------
async function boot() {
  labelDoc();
  UI.show(UI.el(`<section class="scr boot"><p>${UI.esc(t('loading'))}</p></section>`));
  resize();
  requestAnimationFrame((ms) => { last = ms; frame(ms); });
  // the scoreboard, the pops and the share card are lit in these faces: nothing is drawn before them
  await Promise.race([loadFonts(), wait(6000)]);
  S.scene = new Scene(canvas, { reduce: reduce() });
  Audio.setMuted(isMuted());
  window.__game = {
    S, save, keys, begin, goTitle, pause, resume, showResult, fastForward, Audio, makeCard,
    cardURL: () => S.sim?.end && makeCard({ level: S.level, sim: S.sim, shot: S.shot }).toDataURL('image/jpeg', 0.85),
  };
  const qa = await qaEntry().catch((err) => { console.error(err); return false; });
  if (!qa) goTitle();
  window.__ready = true;
}
boot();
