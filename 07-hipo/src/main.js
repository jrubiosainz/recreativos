// HIPO: a baby hippo with hiccups at the municipal pool. Every hiccup is a hop; hold your breath to
// save it up for a bigger one, and reach the edge of the board to jump: tucked up, it's a bomba;
// not, a belly flop. This file is the conductor: the fixed-step clock, input, the screens, the
// end of a dive, sharing, QA entry points.
import { Sim, DT } from './sim.js';
import { LEVELS, parse } from './levels.js';
import { ROUTES } from './routes.js';
import { Bot } from './bot.js';
import { Scene } from './scene.js';
import { loadFonts } from './fonts.js';
import { setSignLang } from './gfx/tiles.js';
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
setSignLang(getLang());
const forceMute = q.get('mute') === '1', skipTut = q.get('skip') === '1';
const N = LEVELS.length;
const S = { state: 'boot', i: 0, level: null, sim: null, scene: null, hud: null, tut: null, bot: null, acc: 0, endShown: false, shot: null, rec: null, pauseNode: null, qa: false, slow: 1 };
const keys = { l: false, r: false, hold: false, mouse: false, touchDir: 0, touchHold: false };
let W = 1, H = 1, dpr = 1, last = performance.now(), lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const Q = { cap: Math.min(2, +q.get('dpr') || 2), n: 0, t: 0, done: false };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = () => q.get('touch') === '1' || lastPointer === 'touch';
const isMuted = () => forceMute || !!save.muted;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const buzz = (ms) => { if (isTouch() && !isMuted()) navigator.vibrate?.(ms); };
const img = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

function labelDoc() {
  document.title = `HIPO · ${t('tagline')}`;
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
  setLang(next); setSignLang(next); save.lang = next; writeSave(save);
  labelDoc();
  S.scene?.rebuildStatic();
  goTitle();
}

// ---------- layout ----------
function resize() {
  dpr = Math.min(Q.cap, window.devicePixelRatio || 1);
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  if (S.scene && S.sim && S.state !== 'title') { setPad(); S.scene.resize(W, H, dpr); setInset(); S.scene.draw(1); }
  else { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
}
// on a phone held upright the thumbs' pad covers the bottom of the screen: the camera keeps the ground above it
function setPad() { if (S.scene) S.scene.pad = isTouch() && H > W ? Math.min(0.2, 150 / H) : 0; }
// what the result card covers, so the camera frames the splash beside it
function setInset() {
  if (!S.scene) return;
  if (!S.endShown) { S.scene.inset = { r: 0, b: 0 }; return; }
  // measured, not assumed: the card is as big as its words in this language on this screen
  const band = document.querySelector('.result .band'), wide = W > H * 1.05;
  const bw = band ? band.offsetWidth : Math.min(520, W * 0.46), bh = band ? band.offsetHeight : Math.min(440, H * 0.52);
  S.scene.inset = wide ? { r: Math.min(0.5, bw / W), b: 0 } : { r: 0, b: Math.min(0.72, bh / H) };
}

// ---------- screens ----------
function goTitle() {
  leavePlay();
  S.state = 'title';
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  document.body.dataset.screen = 'title';
  titleScreen({ levels: LEVELS, save, onPlay: begin, onMute: toggleMute, onLang: switchLang, reduce: reduce() });
}
function leavePlay() {
  S.tut?.dispose(); S.tut = null;
  S.hud?.finish(); S.hud = null;
  S.pauseNode?.remove(); S.pauseNode = null;
  UI.hint(null);
  Audio.stop();
  S.sound = false;
}

function begin(i) {
  leavePlay();
  const lv = LEVELS[i], map = parse(lv), sim = new Sim(lv, map, { slow: q.get('slow') === '1' });
  Object.assign(S, { i, level: lv, map, sim, acc: 0, endShown: false, shot: null, rec: null, slow: 1 });
  S.scene.inset = { r: 0, b: 0 };
  setPad();
  S.scene.load(lv, map, sim);
  S.scene.resize(W, H, dpr);
  S.scene.snapCamera();
  S.bot = q.get('bot') === '1' ? new Bot(sim, ROUTES[lv.id] || []) : null;
  S.hud = new Hud({ level: lv, sim, input: keys, touch: isTouch(), onPause: pause, onTowel: towel });
  S.hud.mount();
  S.tut = skipTut || S.bot ? null : new Tutorial({ level: lv, sim, scene: S.scene, save, touch: isTouch(), onSeen: (k) => { if (!save.hints.includes(k)) { save.hints.push(k); writeSave(save); } } });
  document.activeElement?.blur?.();
  document.body.dataset.screen = 'play';
  S.state = 'play';
  if (Audio.live) { S.sound = true; Audio.start(lv); }
  last = performance.now();
}
function towel() {
  const sim = S.sim;
  if (S.state !== 'play' || !sim || sim.end || !sim.lost()) return;
  sim.respawn();
  S.scene.events(sim.ev); S.tut?.events(sim.ev); for (const e of sim.ev) Audio.event(e, sim);
  S.scene.snapCamera();
}

// ---------- pause ----------
function pause() {
  if (S.state !== 'play' || S.sim?.end) return;
  S.state = 'pause';
  keys.l = keys.r = keys.hold = keys.mouse = false; keys.touchDir = 0; keys.touchHold = false;
  Audio.suspend();
  S.pauseNode = pauseCard({
    save, touch: isTouch(),
    onResume: resume,
    onRestart: () => { S.pauseNode?.remove(); S.pauseNode = null; Audio.resume(); begin(S.i); },
    onLevels: () => { Audio.resume(); goTitle(); },
    onMute: toggleMute,
  });
  document.getElementById('ui').appendChild(S.pauseNode);
  S.scene.draw(1);
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

// ---------- the end of a dive ----------
function captureShot() {
  const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
  c.getContext('2d').drawImage(canvas, 0, 0);
  // where the splash is in the frame, so the card crops around it and not around the middle
  const e = S.sim?.end, sc = S.scene;
  if (e) { const [fx, fy] = sc.worldToScreen(e.x, e.y - 1.2); c.focus = [fx / sc.W, fy / sc.H]; }
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
    level: lv, sim, rec: S.rec, nextLevel, nextOpen: !!nextLevel && isUnlocked(save, LEVELS, S.i + 1), reduce: reduce(),
    onAgain: () => begin(S.i),
    onNext: () => begin(S.i + 1),
    onShare: () => shareResult({ level: lv, sim, shot: S.shot, toast: UI.toast }),
    onLevels: () => goTitle(),
  });
  setInset();
}
function onEvents(evs) {
  for (const e of evs) {
    if (e.k === 'hic' && e.L >= 2) buzz(e.L === 3 ? 30 : 12);
    else if (e.k === 'impact') { buzz(e.why === 'bomba' ? [40, 30, 60] : 25); S.hud?.finish(); S.tut?.dispose(); S.tut = null; UI.hint(null); }
  }
}

// ---------- the clock ----------
function applyInput() {
  const sim = S.sim;
  const dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0) || keys.touchDir;
  sim.input.dir = sim.end ? 0 : dir;
  sim.input.hold = !sim.end && (keys.hold || keys.mouse || keys.touchHold);
}
function step() {
  const sim = S.sim, sc = S.scene;
  sc.savePrev();
  if (S.bot && !sim.end) { S.bot.update(); if (S.flop && sim.dive) sim.input.hold = false; } else applyInput();
  sim.tick();
  if (sim.ev.length) {
    sc.events(sim.ev);
    S.tut?.events(sim.ev);
    if (!S.quiet) for (const e of sim.ev) Audio.event(e, sim);
    onEvents(sim.ev);
  }
}
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = clamp((ms - last) / 1000, 0, 0.1); last = ms;
  watchQuality(dt);
  if ((S.state === 'play' || S.state === 'end') && S.sim) {
    const sc = S.scene, sim = S.sim;
    let sdt = dt;
    // hit-stop on impact, then the splash in slow motion for a heartbeat
    if (sc.freeze > 0) { const f = Math.min(sc.freeze, sdt); sc.freeze -= f; sdt -= f; }
    if (sim.end && !reduce()) { const a = sim.t - sim.end.t; sdt *= a < 0.55 ? 0.4 : a < 0.9 ? 0.4 + (a - 0.55) / 0.35 * 0.6 : 1; }
    S.acc += sdt;
    let n = 0;
    while (S.acc >= DT && n < 30) { step(); S.acc -= DT; n++; }
    if (n >= 30) S.acc = 0;
    sc.update(sdt);
    sc.draw(clamp(S.acc / DT, 0, 1));
    const v = sc.view(); Audio.listen(sc.cam.x, v.w);
    if (!S.quiet) Audio.frame(sim, sdt);
    S.hud?.update();
    S.tut?.update(dt);
    if (sim.end && !S.shot && sim.t - sim.end.t > 0.3) captureShot();
    if (sim.end && !S.endShown && sim.t - sim.end.t > 1.25) showResult();
  }
}
// a fanless laptop or an old phone: drop the resolution once rather than drop frames
function watchQuality(dt) {
  if (Q.done || S.qa || S.state !== 'play' || document.hidden || !S.sim || S.sim.t < 1.5) return;
  Q.n++; Q.t += dt;
  if (Q.t < 3) return;
  const avg = Q.t / Q.n;
  if (avg > 1 / 45 && Q.cap > 1) { Q.cap = Math.max(1, Q.cap - 0.5); console.info('[HIPO] dpr cap', Q.cap); resize(); }
  else Q.done = true;
  Q.n = 0; Q.t = 0;
}

// ---------- input ----------
// ← → or A D walk; hold Space (or ↑ W Z, or the mouse button) to hold your breath; R back to the
// towel; Esc or P pause. On touch screens the pad in the HUD does all of it.
const HOLD = new Set([' ', 'ArrowUp', 'w', 'W', 'z', 'Z', 'Shift']);
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key !== 'Tab') lastPointer = 'mouse';
  unlockAudio();
  const k = e.key;
  if (S.state === 'play') {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.l = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.r = true; e.preventDefault(); }
    else if (HOLD.has(k)) { keys.hold = true; e.preventDefault(); }
    else if (k === 'r' || k === 'R') { e.preventDefault(); towel(); }
    else if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); pause(); }
  } else if (S.state === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); resume(); }
  else if (S.state === 'end' && S.endShown && k === 'Escape') { e.preventDefault(); goTitle(); }
  else if (S.state === 'end' && S.endShown && (k === 'r' || k === 'R')) { e.preventDefault(); begin(S.i); }
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.l = false;
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.r = false;
  else if (HOLD.has(k)) keys.hold = false;
});
canvas.addEventListener('pointerdown', (e) => {
  lastPointer = e.pointerType || 'mouse';
  if (S.state !== 'play' || e.pointerType !== 'mouse' || e.button > 0) return;
  e.preventDefault(); keys.mouse = true;
});
window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') keys.mouse = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || lastPointer; unlockAudio(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S.state === 'play') pause(); else Audio.suspend(); } else if (S.state !== 'pause') Audio.resume(); });
window.addEventListener('blur', () => { keys.l = keys.r = keys.hold = keys.mouse = false; if (!S.qa) pause(); });
window.addEventListener('pagehide', () => pause());
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// ---------- QA ----------
function fillSave(n) {
  for (let k = 0; k < Math.min(n, N); k++) {
    const lv = LEVELS[k], sim = new Sim(lv, parse(lv)), bot = new Bot(sim, ROUTES[lv.id] || []);
    for (let s = 0; s < 120 * 240 && !sim.end; s++) { bot.update(); sim.tick(); }
    if (sim.end) recordResult(save, lv, sim);
  }
}
// jump ahead without sound; the scene keeps up so particles, props and the camera are where they'd be
function fastForward(T, after = 0) {
  const sim = S.sim, sc = S.scene;
  S.quiet = true;
  let n = 0;
  while (sim.t < T - 1e-9 && !(sim.end && sim.t - sim.end.t >= after)) {
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
  if (q.get('bot') === '1' || scr === 'end') S.bot ||= new Bot(S.sim, ROUTES[LEVELS[i].id] || []);
  S.flop = q.get('flop') === '1';
  if (scr === 'end') {
    S.tut?.dispose(); S.tut = null;
    fastForward(T || 300, +q.get('after') || 0.35);
    S.scene.draw(1); captureShot();
    fastForward(S.sim.t + 1.2, 99);
    showResult();
    return true;
  }
  if (T) fastForward(T, +q.get('after') || 0);
  if (scr === 'pause') pause();
  return true;
}

// ---------- boot ----------
async function boot() {
  labelDoc();
  UI.show(UI.el(`<section class="scr boot"><p>${UI.esc(t('loading'))}</p></section>`));
  resize();
  requestAnimationFrame((ms) => { last = ms; frame(ms); });
  // the signs, pops and the share card are painted in these faces: nothing is drawn before them
  const [, bg] = await Promise.all([Promise.race([loadFonts(), wait(6000)]), img('assets/img/bg_pool.jpg')]);
  S.scene = new Scene(canvas, { bg }, { reduce: reduce() });
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
