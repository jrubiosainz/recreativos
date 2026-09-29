// LA GOTA: it's raining, you're on the bus, and everyone calls dibs on a drop on the steamed-up window.
// First one down to the rubber seal wins. You clear your drop's way through the fog with a fingertip,
// and you never, ever touch a called drop. This file is the conductor: the fixed-step clock, the
// fingertip, the screens, the title's attract loop, the end of a race, sharing, QA entry points.
import { Sim, DT, PW, PH, K, YOU } from './sim.js';
import { LEVELS } from './levels.js';
import { Bot } from './bot.js';
import { Scene } from './scene.js';
import { titleSim } from './attract.js';
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
const canvas = document.getElementById('game'), bgCanvas = document.getElementById('bg');
const save = loadSave();
setLang(q.get('lang') || save.lang || detectLang());
const forceMute = q.get('mute') === '1', skipTut = q.get('skip') === '1';
const N = LEVELS.length;
const S = { state: 'boot', i: 0, level: null, sim: null, scene: null, hud: null, tut: null, bot: null, acc: 0, endShown: false, shot: null, rec: null, pauseNode: null, qa: false, attract: false, quiet: false, sound: false };
// the fingertip: where it is on screen, whether it presses, and whether this press has yet cleared the
// called drops (a press that lands on one doesn't count until it moves off: the tap that called your
// drop must never squash it)
const P = { id: null, down: false, fresh: false, seen: false, cx: -1e4, cy: -1e4 };
let W = 1, H = 1, dpr = 1, last = performance.now(), lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const Q = { cap: Math.min(2, +q.get('dpr') || 2), n: 0, t: 0, done: false };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = () => q.get('touch') === '1' || lastPointer === 'touch';
const isMuted = () => forceMute || !!save.muted;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const buzz = (ms) => { if (isTouch() && !isMuted()) navigator.vibrate?.(ms); };
const seedOf = () => (q.get('seed') != null ? +q.get('seed') : (Math.random() * 1e9) >>> 0);

function labelDoc() {
  document.title = `LA GOTA · ${t('tagline')}`;
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
  const land = W > H * 1.05;
  document.body.classList.toggle('land', land);
  document.body.classList.toggle('side', land && H < 520);
  if (S.scene && S.sim) { setPad(); S.scene.resize(W, H, dpr); placeHint(); S.scene.draw(); }
  else for (const c of [canvas, bgCanvas]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  S.hud?.roll();
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
// what the DOM covers, so the window is framed beside it: the pass on the title, the LED sign on top
// while riding (on a phone on its side it moves into the wall on the left; on a phone upright, the room
// below the window is for the whispered hints), the ticket at the end
function setPad() {
  const sc = S.scene; if (!sc) return;
  const s = safeInsets(), land = W > H * 1.05, st = S.state, m = Math.min(W, H) < 500 ? 8 : 16;
  const p = { t: s.t, b: s.b, l: s.l, r: s.r, hud: s.t };
  const riding = st === 'play' || st === 'pause';
  if (riding && !(land && H < 520)) p.t = s.t + (W < 500 ? 56 : 66);
  p.hud = p.t;
  const card = st === 'title' ? document.querySelector('.title:not(.out) .pass') : st === 'end' ? document.querySelector('.result:not(.out) .card') : null;
  if (card) {
    const under = H - card.offsetTop + 10;
    if (land) p.r = Math.max(s.r, W - card.offsetLeft + 12);
    else if (st === 'title') {
      // upright, the pass is held up against the lower half of the window: the glass keeps its full size
      // and rises to the top, where the logo is written in the fog
      const pw = Math.min((W - s.l - s.r - 2 * m) / 1.16, 560), need = pw * (PH / PW + 0.16);
      p.b = Math.max(s.b, Math.min(under, H - p.t - 2 * m - need));
    } else p.b = Math.max(s.b, under);
  } else if (riding && !land) p.b = s.b + 84;
  sc.pad = p;
}
// the friend's whisper goes beside the window if there's room, else below it
function placeHint() {
  const sc = S.scene, hint = document.getElementById('hint'); if (!sc?.cssPane) return;
  const cp = sc.cssPane, right = cp.x + cp.w * 1.1 + 18, room = W - right - 16;
  const side = W > H * 1.05 && room >= 180;
  hint.classList.toggle('side', side);
  if (side) { hint.style.left = `${right}px`; hint.style.top = `${cp.y + cp.h * 0.12}px`; hint.style.width = `${Math.min(340, room)}px`; }
  else { hint.style.left = ''; hint.style.top = ''; hint.style.width = ''; }
}

// ---------- screens ----------
function goTitle() {
  leavePlay();
  S.state = 'title';
  document.body.dataset.screen = 'title';
  titleScreen({ levels: LEVELS, save, onPlay: begin, onMute: toggleMute, onLang: switchLang, reduce: reduce() });
  startAttract();
}
// the title's backdrop: the next trip's window, with the logo written in its fog
function startAttract() {
  const k = Math.max(0, LEVELS.findIndex((lv, i) => isUnlocked(save, LEVELS, i) && !save.lv[lv.id]?.done));
  const sim = titleSim(LEVELS[k], t('title'), 17 + Math.floor(Math.random() * 1000));
  Object.assign(S, { i: k, level: LEVELS[k], sim, acc: 0, endShown: false, shot: null, rec: null, bot: null, attract: true });
  setPad();
  S.scene.load(sim.lv, sim, { title: true });
  S.scene.resize(W, H, dpr);
  fastForward(reduce() ? 14 : 5);
  S.scene.update(1 / 60); S.scene.draw();
  if (Audio.live && !S.sound) { S.sound = true; Audio.start(S.level, { quiet: true }); }
}
function load(i) {
  const lv = LEVELS[i], sim = new Sim(lv, { seed: seedOf() });
  Object.assign(S, { i, level: lv, sim, acc: 0, endShown: false, shot: null, rec: null, bot: null, attract: false, want: null });
  P.down = false; P.id = null; P.fresh = false;
  setPad();
  S.scene.load(lv, sim);
  S.scene.resize(W, H, dpr);
  placeHint();
}
function leavePlay() {
  S.tut?.dispose(); S.tut = null;
  canvas.style.cursor = ''; S.cursor = '';
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
  S.bot = q.get('bot') === '1' ? new Bot(sim, q.get('style') || 'sharp') : null;
  S.hud = new Hud({ level: lv, sim, onPause: pause });
  S.hud.mount();
  S.tut = skipTut || (S.bot && q.get('tut') !== '1') ? null : new Tutorial({ level: lv, sim, save, touch: isTouch(), onSeen: (k) => { if (!save.hints.includes(k)) { save.hints.push(k); writeSave(save); } } });
  document.activeElement?.blur?.();
  if (Audio.live) { S.sound = true; Audio.start(lv); }
  last = performance.now();
}

// ---------- pause ----------
function releasePointer() { P.down = false; P.id = null; P.fresh = false; if (S.sim) S.sim.input.down = false; }
function pause() {
  if (S.state !== 'play' || S.sim?.end) return;
  S.state = 'pause';
  releasePointer();
  S.hud?.update();
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
  Audio.resume();
  last = performance.now();
  document.activeElement?.blur?.();
}

// ---------- the finish ----------
// the window at the finish, without the shouts (they overflow the glass; the ticket says it anyway)
function captureShot() {
  const sc = S.scene;
  sc.draw({ fx: false });
  const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
  c.getContext('2d').drawImage(canvas, 0, 0);
  const pn = sc.pane; c.box = { x: pn.x, y: pn.y, w: pn.w, h: pn.h };
  S.shot = c;
  sc.draw();
}
function showResult() {
  if (S.endShown) return;
  S.endShown = true;
  const lv = LEVELS[S.i], sim = S.sim;
  S.rec = S.qa && q.get('norecord') === '1' ? null : recordResult(save, lv, sim);
  S.tut?.dispose(); S.tut = null;
  UI.hint(null);
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
  // the window steps aside for the ticket
  setPad(); S.scene.resize(W, H, dpr); S.scene.draw();
}

// ---------- the clock ----------
const nearCalled = (sim, x, y) => sim.kids.some((k) => { const d = !k.out && sim.drop(k.drop); return d && d.alive && Math.hypot(d.x - x, d.y - y) < d.r + K.touch + 0.12; });
function applyInput() {
  const sim = S.sim, sc = S.scene, p = sc.toSim(P.cx, P.cy);
  const x = clamp(p.x, 0, PW), y = clamp(p.y, 0, PH);
  let down = P.down && sim.phase === 'race' && !sim.end && p.in;
  if (down && P.fresh) { if (nearCalled(sim, x, y)) down = false; else P.fresh = false; }
  sim.input.down = down; sim.input.x = x; sim.input.y = y;
  sc.ptr.x = x; sc.ptr.y = y; sc.ptr.on = down; sc.ptr.in = P.seen && p.in && !sim.end;
  sc.mouse = lastPointer === 'mouse';
  const cur = sc.ptr.in && sc.mouse ? 'none' : '';
  if (cur !== S.cursor) { canvas.style.cursor = cur; S.cursor = cur; }
}
// «¡Me pido esa!»: the free candidate under (or nearest) the tap. The others shout first; a tap made
// while they're still at it is kept, and called the moment it's your turn, if nobody took that one.
function tryCall(cx, cy) {
  const sim = S.sim; if (sim.phase !== 'call' || sim.kids[0].drop) return false;
  const p = S.scene.toSim(cx, cy); if (!p.in) return false;
  let best = null, bd = Infinity;
  for (const id of sim.free()) { const d = sim.drop(id), g = Math.hypot(d.x - p.x, d.y - p.y) - d.r; if (g < bd) { bd = g; best = d; } }
  if (!best || bd > 1.3) return false;
  if (sim.call(best.id)) { S.want = null; return true; }
  S.want = best.id; Audio.ui.tap();
  return true;
}
function callWanted() {
  const sim = S.sim;
  if (S.want == null || sim.phase !== 'call') { S.want = null; return; }
  if (!sim.free().includes(S.want)) { S.want = null; Audio.ui.deny(); return; }
  if (sim.call(S.want)) S.want = null;
}
function dispatch(evs) {
  const sc = S.scene, sim = S.sim;
  if (S.attract) { sc.events(evs.filter((e) => e.k === 'merge' || e.k === 'smear')); if (!S.quiet) for (const e of evs) if (e.k === 'merge') Audio.event(e, sim); return; }
  sc.events(evs);
  S.hud?.events(evs);
  S.tut?.events(evs);
  if (!S.quiet) for (const e of evs) Audio.event(e, sim);
  for (const e of evs) {
    if (e.k === 'call' && e.own === YOU) buzz(18);
    else if (e.k === 'eat' && e.own === YOU) buzz([15, 30, 15]);
    else if (e.k === 'bus' && e.what === 'hard') buzz(50);
    else if (e.k === 'end') { buzz(e.win ? [30, 50, 30, 50, 60] : 90); S.hud?.finish(); S.tut?.dispose(); S.tut = null; UI.hint(null); }
  }
}
function step() {
  const sim = S.sim;
  if (S.bot && !sim.end) S.bot.step(); else if (!S.attract) { applyInput(); if (S.want != null) callWanted(); }
  // a call made between ticks (a tap, or the bot) left its events waiting
  if (sim.ev.length) { dispatch(sim.ev.slice()); sim.ev.length = 0; }
  sim.tick();
  if (sim.ev.length) { dispatch(sim.ev.slice()); sim.ev.length = 0; }
}
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = clamp((ms - last) / 1000, 0, 0.1); last = ms;
  watchQuality(dt);
  const live = S.state === 'play' || S.state === 'end' || (S.state === 'title' && S.attract && !reduce());
  if (!live || !S.sim) return;
  const sc = S.scene, sim = S.sim;
  if (S.state !== 'title' && S.bot == null) applyInput();
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
  if (sim.end && !S.shot && sim.race - sim.end.t > 0.35) captureShot();
  if (sim.end && !S.endShown && sim.race - sim.end.t > 1.6) showResult();
}
// a fanless laptop or an old phone: drop the resolution rather than drop frames
function watchQuality(dt) {
  if (Q.done || S.qa || S.state !== 'play' || document.hidden || !S.sim || S.sim.time < 1.5) return;
  Q.n++; Q.t += dt;
  if (Q.t < 2.5) return;
  const avg = Q.t / Q.n;
  if (avg > 1 / 48 && Q.cap > 1) { Q.cap = Math.max(1, Q.cap - 0.5); console.info('[LA GOTA] dpr cap', Q.cap); resize(); }
  else Q.done = true;
  Q.n = 0; Q.t = 0;
}

// ---------- input ----------
// Tap (or click) a free drop to call it. Then press and drag to wipe the fog: water runs where the glass
// is clear. Esc or P pause. The pointer is the fingertip; its ring shows where it would touch.
const track = (e) => { P.cx = e.clientX; P.cy = e.clientY; P.seen = true; };
canvas.addEventListener('pointerdown', (e) => {
  lastPointer = e.pointerType || 'mouse';
  if (S.state !== 'play' || !S.sim || S.sim.end) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (P.id != null && P.id !== e.pointerId) return;
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer tracks */ }
  track(e);
  P.id = e.pointerId; P.down = true; P.fresh = true;
  if (S.sim.phase === 'call' && tryCall(e.clientX, e.clientY)) { P.down = false; P.id = null; }
});
canvas.addEventListener('pointermove', (e) => {
  if (P.id != null && e.pointerId !== P.id) return;
  if (e.pointerType !== 'mouse' && P.id == null) return;
  const evs = e.getCoalescedEvents?.() || [];
  track(evs.length ? evs[evs.length - 1] : e);
});
const lift = (e) => { if (e.pointerId === P.id) { P.down = false; P.id = null; P.fresh = false; if (e.pointerType !== 'mouse') { P.cx = P.cy = -1e4; } } };
window.addEventListener('pointerup', lift);
window.addEventListener('pointercancel', lift);
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && P.id == null) { P.cx = P.cy = -1e4; } });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || lastPointer; document.body.classList.toggle('touch', isTouch()); unlockAudio(); }, { capture: true, passive: true });
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key !== 'Tab') lastPointer = 'mouse';
  unlockAudio();
  const k = e.key;
  if (S.state === 'play' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); pause(); }
  else if (S.state === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); resume(); }
  else if (S.state === 'end' && S.endShown && k === 'Escape') { e.preventDefault(); goTitle(); }
  else if (S.state === 'end' && S.endShown && (k === 'r' || k === 'R')) { e.preventDefault(); begin(S.i); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S.state === 'play') pause(); else Audio.suspend(); } else if (S.state !== 'pause') Audio.resume(); });
window.addEventListener('blur', () => { releasePointer(); if (!S.qa) pause(); });
window.addEventListener('pagehide', () => pause());
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// ---------- QA ----------
function fillSave(n) {
  for (let k = 0; k < Math.min(n, N); k++) {
    const lv = LEVELS[k], sim = new Sim(lv, { seed: 1 }), bot = new Bot(sim, 'sharp');
    while (!sim.end) { bot.step(); sim.tick(); }
    recordResult(save, lv, sim);
  }
}
// jump ahead without sound; the scene keeps up so the residue and the shouts are where they'd be
function fastForward(T, after = 0) {
  const sim = S.sim, sc = S.scene;
  S.quiet = true;
  let n = 0;
  while (sim.time < T - 1e-9 && !(sim.end && sim.race - sim.end.t >= after)) {
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
  // idle=1: a passenger who calls a drop and then never touches the glass (the losing ticket)
  const idle = { step() { const s = S.sim; s.input.down = false; if (s.phase === 'call' && s.kids.every((k) => k.own === YOU || k.drop)) s.call(s.free()[0]); } };
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
  // the logo in the fog, the shouts and the ticket are lettered in these faces: nothing is drawn before them
  await Promise.race([loadFonts(), wait(6000)]);
  S.scene = new Scene(canvas, { reduce: reduce(), bg: bgCanvas });
  Audio.setMuted(isMuted());
  window.__game = {
    S, P, save, begin, goTitle, pause, resume, showResult, fastForward, Audio, makeCard, tryCall,
    cardURL: () => S.sim?.end && makeCard({ level: S.level, sim: S.sim, shot: S.shot }).toDataURL('image/jpeg', 0.85),
  };
  const qa = await qaEntry().catch((err) => { console.error(err); return false; });
  if (!qa) goTitle();
  window.__ready = true;
}
boot();
