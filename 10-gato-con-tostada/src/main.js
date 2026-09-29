// GATO CON TOSTADA: cats always land on their feet, toast always lands butter side down, and somebody has taped
// a buttered slice to a cat's back. Neither law gives way, so it hovers. You turn it (that's all you do): tilted
// it travels, level it stops, spun it climbs, and on its tail it gives up the fight and sits. It only really sits
// in one place: the cardboard box. This file is the conductor: the fixed-step clock, the two-way turn, the
// screens, the title's attract loop, the landing, sharing, QA entry points.
import { Sim, DT } from './sim.js';
import { LEVELS } from './levels.js';
import { Bot } from './bot.js';
import { Scene } from './scene.js';
import { Attract } from './attract.js';
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
const S = { state: 'boot', i: 0, level: null, sim: null, scene: null, hud: null, tut: null, bot: null, att: null, acc: 0, endShown: false, shot: null, rec: null, pauseNode: null, qa: false, attract: false, quiet: false, sound: false };
// the turn: arrow keys (or A/D) held, and fingers (or the mouse) held on either half of the screen
const Keys = { l: false, r: false }, ptrs = new Map();
let W = 1, H = 1, dpr = 1, last = performance.now(), lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const Q = { cap: Math.min(2, +q.get('dpr') || 2), n: 0, t: 0, done: false };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = () => q.get('touch') === '1' || lastPointer === 'touch';
const isMuted = () => forceMute || !!save.muted;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const buzz = (ms) => { if (isTouch() && !isMuted()) navigator.vibrate?.(ms); };
const seedOf = () => (q.get('seed') != null ? +q.get('seed') : (Math.random() * 1e9) >>> 0);

function labelDoc() {
  document.title = `${t('title')} · ${t('tagline')}`;
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
    if (S.sound || !S.level) return;
    if (S.state === 'play') { S.sound = true; Audio.start(S.level); }
    else if (S.state === 'title') { S.sound = true; Audio.start(S.level, { quiet: true }); }
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
  document.body.classList.toggle('land', W > H * 1.05);
  if (S.scene && S.sim) { setPad(); S.scene.resize(W, H, dpr); S.scene.draw(); }
  else { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
}
// the notch and the home bar: the page runs edge to edge (viewport-fit=cover)
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
// what the DOM covers, so the flat is framed beside it: the fridge door on the title and at the end (on the right
// when the screen lies down, along the bottom when it stands up), the HUD along the top while flying
function setPad() {
  const sc = S.scene; if (!sc) return;
  const s = safeInsets(), land = W > H * 1.05, st = S.state;
  const p = { t: s.t, b: s.b, l: s.l, r: s.r, hud: s.t };
  if (st === 'play' || st === 'pause') { p.t = s.t + 68; p.hud = p.t; }
  const door = st === 'title' ? document.querySelector('.title:not(.out) .door') : st === 'end' ? document.querySelector('.result:not(.out) .rdoor') : null;
  if (door) {
    if (land) p.r = Math.max(s.r, W - door.offsetLeft + 12);
    else p.b = Math.max(s.b, H - door.offsetTop + 10);
  }
  sc.pad = p;
}

// ---------- screens ----------
function goTitle() {
  leavePlay();
  S.state = 'title';
  document.body.dataset.screen = 'title';
  titleScreen({ levels: LEVELS, save, onPlay: begin, onMute: toggleMute, onLang: switchLang, reduce: reduce() });
  startAttract();
}
// behind the door: the next room, with a cat already having a go at it on its own
function startAttract() {
  const k = Math.max(0, LEVELS.findIndex((lv, i) => isUnlocked(save, LEVELS, i) && !save.lv[lv.id]?.done));
  S.att = new Attract(LEVELS[k]);
  Object.assign(S, { i: k, level: LEVELS[k], endShown: false, shot: null, rec: null, attract: true });
  freshAttract();
  if (Audio.live && !S.sound) { S.sound = true; Audio.start(S.level, { quiet: true }); }
}
function freshAttract() {
  S.sim = S.att.fresh(); S.bot = S.att.bot; S.acc = 0;
  setPad();
  S.scene.load(S.level, S.sim, { title: true });
  S.scene.resize(W, H, dpr);
  // with reduced motion the flat holds still: a cat caught mid-flight
  if (reduce()) fastForward(7);
  S.scene.update(1 / 60); S.scene.draw();
}
function load(i) {
  const lv = LEVELS[i], sim = new Sim(lv, { seed: seedOf() });
  Object.assign(S, { i, level: lv, sim, acc: 0, endShown: false, shot: null, rec: null, bot: null, att: null, attract: false });
  releaseInput();
  setPad();
  S.scene.load(lv, sim);
  S.scene.resize(W, H, dpr);
}
function leavePlay() {
  S.tut?.dispose(); S.tut = null;
  S.hud?.finish(); S.hud = null;
  S.pauseNode?.remove(); S.pauseNode = null;
  document.body.classList.remove('paused');
  UI.hint(null);
  Audio.stop();
  S.sound = false;
  S.attract = false; S.att = null;
}

function begin(i) {
  leavePlay();
  S.state = 'play';
  document.body.dataset.screen = 'play';
  load(i);
  const lv = S.level, sim = S.sim;
  S.bot = q.get('bot') === '1' ? new Bot(sim, q.get('style') || 'sharp') : null;
  S.hud = new Hud({ level: lv, sim, onPause: pause });
  S.hud.mount();
  S.tut = skipTut || (S.bot && q.get('tut') !== '1') ? null : new Tutorial({ level: lv, sim, save, touch: isTouch(), onSeen: (k) => { if (!save.hints.includes(k)) { save.hints.push(k); writeSave(save); } } });
  document.activeElement?.blur?.();
  if (Audio.live) { S.sound = true; Audio.start(lv); }
  last = performance.now();
}

// ---------- pause ----------
function releaseInput() { Keys.l = Keys.r = false; ptrs.clear(); if (S.sim) S.sim.input.turn = 0; S.hud?.pads(false, false); }
function pause() {
  if (S.state !== 'play' || S.sim?.end) return;
  S.state = 'pause';
  releaseInput();
  S.hud?.update();
  UI.hint(null);
  Audio.suspend();
  document.body.classList.add('paused');
  S.pauseNode = pauseCard({
    save, touch: isTouch(),
    onResume: resume,
    onRestart: () => { S.pauseNode?.remove(); S.pauseNode = null; document.body.classList.remove('paused'); Audio.resume(); begin(S.i); },
    onLevels: () => { document.body.classList.remove('paused'); Audio.resume(); goTitle(); },
    onMute: toggleMute,
  });
  document.getElementById('ui').appendChild(S.pauseNode);
  S.scene.draw();
  requestAnimationFrame(() => S.pauseNode?.querySelector('[data-autofocus]')?.focus({ preventScroll: true }));
}
function resume() {
  if (S.state !== 'pause') return;
  S.pauseNode?.remove(); S.pauseNode = null;
  document.body.classList.remove('paused');
  S.state = 'play';
  S.tut?.reshow();
  Audio.resume();
  last = performance.now();
  document.activeElement?.blur?.();
}

// ---------- the landing ----------
// the photo for the Polaroid: the stage a beat after the end, without the shouts, cropped square around the cat
function captureShot() {
  const sc = S.scene, sim = S.sim;
  sc.draw({ fx: false });
  const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
  c.getContext('2d').drawImage(canvas, 0, 0);
  const [k] = sc.origin(), side = Math.min(170 * k, c.width, c.height), [cx, cy] = sc.toScreen(sim.x, sim.y - 20);
  c.crop = { x: clamp(cx - side / 2, 0, c.width - side), y: clamp(cy - side / 2, 0, c.height - side), w: side, h: side };
  S.shot = c;
  sc.draw();
}
function showResult() {
  if (S.endShown) return;
  S.endShown = true;
  const lv = LEVELS[S.i], sim = S.sim;
  if (!S.shot) captureShot();
  S.rec = S.qa && q.get('norecord') === '1' ? null : recordResult(save, lv, sim);
  S.tut?.dispose(); S.tut = null;
  UI.hint(null);
  const nextLevel = LEVELS[S.i + 1] || null;
  S.state = 'end';
  document.body.dataset.screen = 'end';
  S.hud = null;
  resultScreen({
    level: lv, sim, rec: S.rec, shot: S.shot, nextLevel, nextOpen: !!nextLevel && isUnlocked(save, LEVELS, S.i + 1), reduce: reduce(),
    onAgain: () => begin(S.i),
    onNext: () => begin(S.i + 1),
    onShare: () => shareResult({ level: lv, sim, shot: S.shot, toast: UI.toast }),
    onLevels: () => goTitle(),
  });
  // the flat steps aside for the door
  setPad(); S.scene.resize(W, H, dpr); S.scene.draw();
}

// ---------- the clock ----------
function applyInput() {
  const sim = S.sim;
  let l = Keys.l, r = Keys.r;
  for (const side of ptrs.values()) { if (side < 0) l = true; else r = true; }
  const on = !sim.end && S.state === 'play';
  sim.input.turn = on ? (r ? 1 : 0) - (l ? 1 : 0) : 0;
  S.hud?.pads(on && l, on && r);
}
// behind the title only the telling sounds, and quietly: a box, a breakage, the dog
const ATTRACT_SFX = new Set(['sit', 'break', 'thud', 'bonk', 'woof', 'splash', 'cucumber']);
function dispatch(evs) {
  const sc = S.scene, sim = S.sim;
  if (S.attract) {
    sc.events(evs.filter((e) => e.k !== 'end'));
    if (!S.quiet) for (const e of evs) if (ATTRACT_SFX.has(e.k)) Audio.event(e, sim);
    return;
  }
  sc.events(evs);
  S.tut?.events(evs);
  if (!S.quiet) for (const e of evs) Audio.event(e, sim);
  for (const e of evs) {
    if (e.k === 'break' || e.k === 'bonk' || e.k === 'knock') buzz(30);
    else if (e.k === 'sit' && e.box) buzz([20, 40, 20]);
    else if (e.k === 'splash' || e.k === 'cucumber') buzz(60);
    else if (e.k === 'end') { buzz(e.win ? [30, 50, 30, 50, 60] : 90); S.hud?.finish(); S.tut?.dispose(); S.tut = null; UI.hint(null); }
  }
}
function step() {
  const sim = S.sim;
  if (S.bot && !sim.end) S.bot.step(); else if (!S.attract) applyInput();
  sim.tick();
  if (sim.ev.length) { dispatch(sim.ev.slice()); sim.ev.length = 0; }
}
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = clamp((ms - last) / 1000, 0, 0.1); last = ms;
  watchQuality(dt);
  const live = S.state === 'play' || S.state === 'end' || (S.state === 'title' && S.attract && !reduce());
  if (!live || !S.sim) return;
  if (S.attract && S.att?.due()) freshAttract();
  const sc = S.scene, sim = S.sim;
  S.acc += dt;
  let n = 0;
  while (S.acc >= DT && n < 24) { step(); S.acc -= DT; n++; }
  if (n >= 24) S.acc = 0;
  sc.update(dt);
  sc.draw();
  if (!S.quiet) Audio.frame(sim, dt);
  if (S.attract) return;
  S.hud?.update();
  S.tut?.update(dt);
  if (sim.end && !S.shot && sim.time - sim.end.t > 0.35) captureShot();
  if (sim.end && !S.endShown && sim.time - sim.end.t > 1.6) showResult();
}
// a fanless laptop or an old phone: drop the resolution rather than drop frames
function watchQuality(dt) {
  if (Q.done || S.qa || S.state !== 'play' || document.hidden || !S.sim || S.sim.time < 1.5) return;
  Q.n++; Q.t += dt;
  if (Q.t < 2.5) return;
  const avg = Q.t / Q.n;
  if (avg > 1 / 48 && Q.cap > 1) { Q.cap = Math.max(1, Q.cap - 0.5); console.info('[GATO] dpr cap', Q.cap); resize(); }
  else Q.done = true;
  Q.n = 0; Q.t = 0;
}

// ---------- input ----------
// Hold ← or → (A/D), or hold a finger (or the mouse) on the left or right half of the screen: the cat turns that
// way for as long as you hold. Both at once cancel out. Esc or P pause, R starts the room over.
const sideOf = (e) => (e.clientX < W / 2 ? -1 : 1);
canvas.addEventListener('pointerdown', (e) => {
  lastPointer = e.pointerType || 'mouse';
  if (S.state !== 'play' || !S.sim || S.sim.end || S.bot) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer tracks */ }
  ptrs.set(e.pointerId, sideOf(e));
});
canvas.addEventListener('pointermove', (e) => { if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, sideOf(e)); });
const lift = (e) => { ptrs.delete(e.pointerId); };
window.addEventListener('pointerup', lift);
window.addEventListener('pointercancel', lift);
canvas.addEventListener('lostpointercapture', lift);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || lastPointer; document.body.classList.toggle('touch', isTouch()); unlockAudio(); }, { capture: true, passive: true });
const TURN = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key !== 'Tab' && lastPointer !== 'mouse') { lastPointer = 'mouse'; document.body.classList.toggle('touch', isTouch()); }
  unlockAudio();
  const k = e.key, side = TURN[e.code] || TURN[k];
  if (side && S.state === 'play') { e.preventDefault(); Keys[side] = true; return; }
  if (S.state === 'play' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); pause(); }
  else if (S.state === 'play' && (k === 'r' || k === 'R') && !e.repeat) { e.preventDefault(); begin(S.i); }
  else if (S.state === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); resume(); }
  else if (S.state === 'end' && S.endShown && k === 'Escape') { e.preventDefault(); goTitle(); }
  else if (S.state === 'end' && S.endShown && (k === 'r' || k === 'R') && !e.repeat) { e.preventDefault(); begin(S.i); }
});
window.addEventListener('keyup', (e) => { const side = TURN[e.code] || TURN[e.key]; if (side) Keys[side] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseInput(); if (S.state === 'play') pause(); else Audio.suspend(); } else if (S.state !== 'pause') Audio.resume(); });
window.addEventListener('blur', () => { releaseInput(); if (!S.qa) pause(); });
window.addEventListener('pagehide', () => pause());
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// ---------- QA ----------
function fillSave(n) {
  for (let k = 0; k < Math.min(n, N); k++) {
    const lv = LEVELS[k], sim = new Sim(lv, { seed: 1 }), bot = new Bot(sim, 'sharp');
    while (!sim.end && sim.time < 300) { bot.step(); sim.tick(); sim.ev.length = 0; }
    if (sim.end) recordResult(save, lv, sim);
  }
}
// jump ahead without sound; the scene keeps up so the crumbs and the shouts are where they'd be
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
  S.hud?.update();
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
  // idle=1: somebody who holds → and never lets go; the cat spins itself dry (the losing ticket)
  const idle = { step() { S.sim.input.turn = 1; } };
  if (q.get('bot') === '1' || scr === 'end') S.bot ||= q.get('idle') === '1' ? idle : new Bot(S.sim, q.get('style') || 'sharp');
  if (scr === 'end') {
    S.tut?.dispose(); S.tut = null;
    fastForward(T || 999, 0.4);
    captureShot();
    fastForward(S.sim.time + 1.3, 99);
    showResult();
    return true;
  }
  if (T) fastForward(T);
  if (scr === 'pause') pause();
  return true;
}

// ---------- boot ----------
async function boot() {
  labelDoc();
  UI.show(UI.el(`<section class="scr boot"><p>${UI.esc(t('loading'))}</p></section>`));
  resize();
  requestAnimationFrame((ms) => { last = ms; frame(ms); });
  // the magnets, the biro and the sticky notes are lettered in these faces: nothing is drawn before them
  await Promise.race([loadFonts(), wait(6000)]);
  S.scene = new Scene(canvas, { reduce: reduce() });
  Audio.setMuted(isMuted());
  window.__game = {
    S, Keys, ptrs, save, begin, goTitle, pause, resume, showResult, fastForward, Audio, makeCard,
    cardURL: () => S.sim?.end && makeCard({ level: S.level, sim: S.sim, shot: S.shot }).toDataURL('image/jpeg', 0.85),
  };
  const qa = await qaEntry().catch((err) => { console.error(err); return false; });
  if (!qa) goTitle();
  window.__ready = true;
}
boot();
