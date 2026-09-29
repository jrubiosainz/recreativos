// UN SOLO VIAJE: boot, screens, the clock, input and the frame loop. The rules live in sim.js, the
// picture in scene.js and gfx/, the sound in audio.js, the screens in ui/; this file wires them together.
import { clamp, damp, mulberry32, mix } from './util.js';
import { LEVELS, totalKg } from './levels.js';
import { Sim, DT } from './sim.js';
import { Bot, playOut } from './bot.js';
import { Scene, SCENE_ES, SCENE_EN } from './scene.js';
import { Audio } from './audio.js';
import { loadFonts } from './fonts.js';
import { t, setLang, getLang, detectLang } from './i18n.js';
import { loadSave, writeSave, recordResult, isUnlocked } from './save.js';
import { buildCard, cardFile, shareCard, shareText } from './share.js';
import { Tutorial } from './tutorial.js';
import * as UI from './ui/dom.js';
import { scaleScreen } from './ui/scale.js';
import { playScreen, pauseScreen } from './ui/play.js';
import { resultScreen } from './ui/result.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const save = loadSave();
if (q.get('unlock') === '1') save.unlockAll = true;
const forceMute = q.get('mute') === '1', skipTut = q.get('skip') === '1';
const botName = q.get('bot') ? (q.get('bot') === '1' ? 'good' : q.get('bot')) : null;
setLang(q.get('lang') || save.lang || detectLang());

// LEAD: a breath before the clock starts. LAPSE: how fast time runs while you sit on the stairs
const N = LEVELS.length, LEAD = 0.35, LAPSE = 4;
const S = {
  state: 'boot', // boot | title | play | pause | end
  idx: 0, sel: 0, sim: null, scene: null, bot: null, tut: null, node: null, end: null, attract: null,
  hudBottom: 0, qa: false, quiet: false, sound: false, fade: { a: 1, v: -2.5 },
};
let manifest = null, W = 1, H = 1, dpr = 1, safe = { t: 0, b: 0, l: 0, r: 0 }, last = performance.now();
const Q = { cap: Math.min(2, +q.get('dpr') || 2), n: 0, t: 0, done: false };
let lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
// reduced motion: the camera stops walking and cuts between flights instead of whipping round
const stillCam = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = () => q.get('touch') === '1' || lastPointer !== 'mouse';
const isMuted = () => forceMute || !!save.muted;
const newSeed = () => (q.has('seed') ? +q.get('seed') : (Math.random() * 1e9) | 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const unlocked = (i) => isUnlocked(save, LEVELS, i);
const recOf = (i) => save.lv[LEVELS[i].id] || {};
const lvText = (i) => t('lv.' + LEVELS[i].id);   // [floor, NAME, what it is about]
const sceneText = () => (getLang() === 'en' ? SCENE_EN : SCENE_ES);
// how long a recorded line lasts (to its last word): the scene chains lines and captions on it
const voiceDur = (k) => { const m = manifest?.voices?.[getLang()]?.[k]; return m ? m.we || m.dur : 0; };
const buzz = (ms) => { if (isTouch() && !isMuted()) navigator.vibrate?.(ms); };
// the first level not yet carried up, then the first without its three checks
function nextIndex() {
  let i = LEVELS.findIndex((lv, k) => unlocked(k) && !recOf(k).won);
  if (i < 0) i = LEVELS.findIndex((lv, k) => unlocked(k) && (recOf(k).stars || 0) < 3);
  return i < 0 ? 0 : i;
}
function labelDoc() {
  document.title = `${t('title')} · ${t('tagline')}`;
  canvas.setAttribute('aria-label', t('canvas'));
}
// how close a hand is to giving: the same reading the fists show (white knuckles, the shake)
function strainOf(sim) {
  let s = 0;
  for (const x of sim.H) if (x.bags.length) s = Math.max(s, clamp((x.TL / Math.max(0.05, 1 - x.MF) - 0.55) / 0.45));
  return s;
}

// ---------- sound: the context is born on the first gesture; the voices load right after ----------
let voicesP = null, hiddenHush = false;
function loadVoices() {
  if (!voicesP && manifest && Audio.E.ctx) voicesP = Audio.load(manifest, getLang()).catch((e) => console.info('[UN SOLO VIAJE] voices', e));
  return voicesP || Promise.resolve();
}
function unlockAudio() {
  if (S.state === 'pause') return;
  Audio.setMuted(isMuted());
  if (!Audio.init()) return;
  Audio.unlock().then((ok) => {
    if (!ok) return;
    Audio.setMuted(isMuted());
    // the first gesture came mid-level (a shared link straight into play): the building catches up
    if (S.state === 'play' && !S.sound) { S.sound = true; Audio.start(); }
  });
  loadVoices();
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
  if (voicesP) voicesP = Audio.switchLang(next).catch(() => {});
  S.attract = null;   // stickers and speech bubbles are painted in the language
  goTitle(S.sel);
}

// ---------- the clock: follows the wall clock, runs ×4 while you rest, stops with the pause card ----------
const clock = { t: 0, rate: 1, held: false };
function tickClock(dt) {
  const sim = S.sim;
  const target = !sim.end && sim.rest?.phase === 'idle' ? LAPSE : 1;
  clock.rate = damp(clock.rate, target, target > clock.rate ? 3 : 10, dt);
  clock.t += dt * clock.rate;
}

// ---------- layout ----------
function probeSafe() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(d);
  const cs = getComputedStyle(d), v = (k) => parseFloat(cs[k]) || 0, r = { t: v('paddingTop'), r: v('paddingRight'), b: v('paddingBottom'), l: v('paddingLeft') };
  d.remove();
  return r;
}
function relayout() {
  if (S.scene && (S.state === 'play' || S.state === 'pause' || S.state === 'end')) {
    if (S.node?.hudRect) S.hudBottom = S.node.hudRect().bottom;
    S.scene.resize(W, H, dpr, { top: S.hudBottom, bottom: safe.b });
    S.tut?.place();
  }
  wall = null;
  layoutAttract();
}
function resize() {
  dpr = Math.min(Q.cap, window.devicePixelRatio || 1);
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  safe = probeSafe();
  relayout();
  draw(0);
}

// ---------- the fruit shop's wall behind the scale: olive tiles, each glazed a shade apart ----------
let wall = null;
function paintWall() {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr));
  const w = c.getContext('2d'), rng = mulberry32(61), s = clamp(Math.round(Math.min(W, H) / 11), 30, 46);
  w.setTransform(dpr, 0, 0, dpr, 0, 0);
  w.fillStyle = '#5f6e45'; w.fillRect(0, 0, W, H);
  const x0 = ((W / 2) % s) - s, y0 = (H % s) - s;
  for (let y = y0; y < H; y += s) {
    for (let x = x0; x < W; x += s) {
      const v = rng(), base = mix('#7f9160', v < 0.5 ? '#72844f' : '#8b9c68', Math.abs(v - 0.5) * 1.3);
      w.fillStyle = base; w.fillRect(x + 1, y + 1, s - 2, s - 2);
      // the glaze pools toward the bottom edge and catches the tube light along the top
      w.fillStyle = 'rgba(255,255,240,0.13)'; w.fillRect(x + 1, y + 1, s - 2, 1.5);
      w.fillStyle = 'rgba(40,48,28,0.16)'; w.fillRect(x + 1, y + s - 3, s - 2, 2);
      if (rng() < 0.5) { w.fillStyle = 'rgba(255,255,240,0.07)'; w.fillRect(x + s * 0.18, y + s * 0.16, s * 0.5, s * 0.1); }
    }
  }
  const lg = w.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, 'rgba(255,250,225,0.10)'); lg.addColorStop(0.55, 'rgba(255,250,225,0)'); lg.addColorStop(1, 'rgba(24,30,16,0.30)');
  w.fillStyle = lg; w.fillRect(0, 0, W, H);
  return c;
}

// ---------- behind the scale: the selected level, carried up by someone who has done it before ----------
function setAttract(i) {
  const A0 = S.attract;
  if (A0 && A0.i === i) return layoutAttract();
  const seed = S.qa ? 11 + i : (Math.random() * 1e9) | 0, sim = new Sim(LEVELS[i], { seed });
  const cv = document.createElement('canvas');
  S.attract = {
    i, sim, bot: new Bot(sim, 'good', seed), scene: new Scene(sim, sceneText(), { calm: true, still: stillCam(), voiceDur }),
    cv, g: cv.getContext('2d'), t: 0, rate: 1, w: 1, h: 1, veil: A0 ? 1 : 0, vv: -3.2, out: false,
  };
  layoutAttract();
}
// portrait: everything above the scale. Landscape: everything left of it. The scene gets its own
// canvas, the size of that window, because it paints (the dark, its layers) as if it had the screen
function layoutAttract() {
  const A = S.attract; if (!A) return;
  const r = S.node?.scaleRect?.();
  let w = W, h = H;
  if (r && r.width > 1) { if (W >= H * 1.25) w = clamp(r.left + 8, 1, W); else h = clamp(r.top + 8, 1, H); }
  A.w = w; A.h = h;
  const cw = Math.max(1, Math.round(w * dpr)), ch = Math.max(1, Math.round(h * dpr));
  if (A.cv.width !== cw || A.cv.height !== ch) { A.cv.width = cw; A.cv.height = ch; }
  A.scene.resize(w, h, dpr, { top: safe.t, bottom: 0 });
}
function attractTick(dt) {
  const A = S.attract; if (!A) return;
  const sim = A.sim, target = !sim.end && sim.rest?.phase === 'idle' ? LAPSE : 1;
  A.rate = damp(A.rate, target, target > A.rate ? 3 : 10, dt);
  A.t += dt * A.rate;
  while (sim.t + DT <= A.t + 1e-9 && !sim.end) { A.bot.update(); sim.tick(DT); A.scene.events(sim.drain()); }
  A.veil = clamp(A.veil + A.vv * dt, 0, 1);
  // home (or two trips): the lights go, and they go back down to the car for another go
  if (A.scene.done && !A.out) { A.out = true; A.vv = 2.6; }
  if (A.out && A.veil >= 1) {
    S.attract = null; setAttract(A.i);
    S.attract.veil = 1; S.attract.vv = -2.2;
    Audio.menu();
  }
}
function drawAttract(dt) {
  const A = S.attract, sim = A.sim;
  A.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  A.scene.shot = null;
  A.scene.frame(A.g, dt * A.rate, sim.end ? 0 : Math.max(0, A.t - sim.t));
  if (S.quiet) Audio.drop(A.scene); else Audio.attract(A.scene);
  g.drawImage(A.cv, 0, 0, A.w, A.h);
  if (A.veil > 0.004) { g.fillStyle = `rgba(28,29,26,${A.veil.toFixed(3)})`; g.fillRect(0, 0, A.w, A.h); }
}

// ---------- the scale ----------
function goTitle(sel) {
  const from = S.state;
  leavePlay();
  UI.hint(null);
  S.state = 'title'; S.end = null;
  const next = nextIndex();
  if (sel == null || !unlocked(sel)) sel = next;
  S.sel = sel;
  const rows = LEVELS.map((lv, i) => {
    const r = recOf(i), [floor, name, sub] = lvText(i);
    return {
      i, n: lv.n, id: lv.id, floor, floor_n: lv.floor, name, sub, kg: totalKg(lv), bags: lv.bags.length, best: r.best, set: r.set,
      state: !unlocked(i) ? 'locked' : i === next ? 'next' : r.won ? 'done' : 'open',
    };
  });
  S.node = scaleScreen({ rows, sel, muted: isMuted(), onSelect, onGo: begin, onMute: toggleMute, onLang: switchLang });
  UI.show(S.node);
  Audio.menu();
  setAttract(sel);
  if (from !== 'title') { S.fade.a = 1; S.fade.v = from === 'boot' ? -2.2 : -4; }
}
function onSelect(i, why) {
  if (why === 'locked') { UI.toast(UI.esc(t('locked', { n: LEVELS[i - 1].n }))); Audio.ui.beep(false); return; }
  S.sel = i;
  Audio.ui.beep(true); Audio.ui.paper();
  setAttract(i);
}
// ← → walk the keys (the ones that open)
function titleStep(d) {
  let i = S.sel;
  for (let k = 0; k < N; k++) { i = (i + d + N) % N; if (unlocked(i)) break; }
  if (i === S.sel || !S.node?.select) return;
  onSelect(i, 'key');
  S.node.select(i);
  S.node.querySelector(`.plu[data-i="${i}"]`)?.focus({ preventScroll: true });
}

// ---------- a trip ----------
function begin(i) {
  if (i == null || i < 0 || !unlocked(i)) return;
  leavePlay();
  UI.hint(null);
  S.attract = null;
  const lv = LEVELS[i], seed = newSeed(), [floor] = lvText(i);
  const sim = (S.sim = new Sim(lv, { seed }));
  S.idx = i; S.sel = i; S.state = 'play'; S.end = null;
  S.scene = new Scene(sim, sceneText(), { voiceDur, still: stillCam() });
  S.bot = botName ? new Bot(sim, botName, seed) : null;
  S.node = playScreen({ lv, floor, muted: isMuted(), onPause: pause, onMute: toggleMute, onRest: () => act((s) => s.down()) });
  UI.show(S.node);
  S.hudBottom = S.node.hudRect().bottom;
  S.scene.resize(W, H, dpr, { top: S.hudBottom, bottom: safe.b });
  S.tut = new Tutorial(sim, {
    t, hint: UI.hint, where: hintWhere, touch: isTouch(), seen: new Set(save.hints),
    basics: i === 0 && !save.tut && !skipTut && !S.bot,
    onSeen: (k) => { if (!save.hints.includes(k)) { save.hints.push(k); writeSave(save); } },
    onDone: () => { save.tut = true; writeSave(save); },
  });
  if (skipTut || S.bot) S.tut.stop(false);
  clock.t = -LEAD; clock.rate = 1; clock.held = false;
  S.sound = !!Audio.E.ctx;
  Audio.start();
  loadVoices();
  S.fade.a = 1; S.fade.v = -3;
}
function leavePlay(f = 0.4) {
  if (S.state === 'pause') { Audio.resume(); clock.held = false; }
  if (S.sim) Audio.stop(f);
  S.tut?.stop(false); UI.hint(null);
  S.sim = null; S.scene = null; S.bot = null; S.tut = null; S.sound = false;
}
function pump() {
  const sim = S.sim, list = sim.drain();
  if (!list.length) return;
  S.scene.events(list);
  for (const e of list) {
    S.tut?.event(e);
    if (e.type === 'end') onEnd(e);
    else if (e.type === 'slip' && !S.quiet) buzz(35);
  }
}
function stepTo(tt) {
  const sim = S.sim;
  while (sim.t + DT <= tt + 1e-9 && !sim.end) { S.bot?.update(); sim.tick(DT); pump(); }
}
// a key counts against the moment it was pressed: the simulation catches up with the clock first
function act(fn) {
  const sim = S.sim;
  if (S.state !== 'play' || !sim || sim.end || S.bot || clock.held) return;
  stepTo(clock.t);
  if (sim.end) return;
  fn(sim);
  pump();
}

// ---------- the tutorial's note: under the next chip, over the key, or in the middle of the stairwell ----------
function hintWhere(k) {
  const w = Math.min(W - 24, 340);
  const at = (cx, y, dir) => {
    const x = clamp(cx, 12 + w / 2, W - 12 - w / 2);
    return { r: { x, y, w, p: clamp(cx - (x - w / 2), 22, w - 22) }, dir };
  };
  if (k === 'chip') { const r = S.node?.chipRect?.(0); if (r) return at(r.left + r.width / 2, r.bottom + 12, 'up'); }
  if (k === 'rest' || k === 'chip') { const r = S.node?.restRect?.(); if (r) return at(r.left + r.width / 2, r.top - 12, 'down'); }
  return { r: { x: W / 2, y: Math.max(S.hudBottom + 18, H * 0.3), w }, dir: 'none' };
}

// ---------- pause ----------
function pause() {
  if (S.state !== 'play' || !S.sim || S.sim.end) return;
  S.state = 'pause'; clock.held = true; Audio.suspend(); UI.hint(null);
  const [floor, name] = lvText(S.idx);
  S.node = pauseScreen({ floor, name, muted: isMuted(), touch: isTouch(), onResume: resume, onRestart: () => begin(S.idx), onQuit: () => goTitle(S.idx), onMute: toggleMute });
  UI.show(S.node);
  draw(0);
}
function resume() {
  if (S.state !== 'pause') return;
  Audio.resume(); clock.held = false;
  S.state = 'play';
  S.node = playScreen({ lv: S.sim.lv, floor: lvText(S.idx)[0], muted: isMuted(), onPause: pause, onMute: toggleMute, onRest: () => act((s) => s.down()) });
  UI.show(S.node);
  const hb = S.node.hudRect().bottom;
  if (Math.abs(hb - S.hudBottom) > 0.5) { S.hudBottom = hb; S.scene.resize(W, H, dpr, { top: hb, bottom: safe.b }); }
  S.node.update(S.sim, false);
  S.tut?.place();
}

// ---------- home, or two trips ----------
function onEnd() {
  const sim = S.sim, i = S.idx;
  S.state = 'end';
  const rec = recordResult(save, sim.lv, sim);
  S.end = { i, lv: sim.lv, rec, sim, scene: S.scene, file: null, shown: false, photo: null };
  UI.hint(null);
}
// the scene keeps the funniest moment; if it has none, the last frame, framed the same way
function lastFrame() {
  const r = canvas.height / H;
  let x, y, w, h;
  if (H > 1.1 * W) { w = W; h = Math.min(H, 1.25 * W); x = 0; y = clamp(0.45 * H - h / 2, 0, H - h); }
  else { h = H; w = Math.min(W, 0.8 * H); x = (W - w) / 2; y = 0; }
  const c = document.createElement('canvas'), cw = Math.round(Math.min(540, w * r));
  c.width = cw; c.height = Math.round((cw * h) / w);
  c.getContext('2d').drawImage(canvas, x * r, y * r, w * r, h * r, 0, 0, c.width, c.height);
  return { c, rank: 0, why: 'last' };
}
function showResult() {
  const E = S.end; if (!E || E.shown) return;
  E.shown = true;
  const { i, lv, rec, sim, scene } = E;
  E.photo = scene.photo || lastFrame();
  const next = i < N - 1 && unlocked(i + 1), [floor, name] = lvText(i);
  leavePlay(1.2);
  S.state = 'end';
  S.node = resultScreen({
    lv, sim, rec, photo: E.photo, floor, name, next,
    onAgain: () => begin(i), onNext: () => goTitle(i + 1), onHome: () => goTitle(i), onShare: (b) => shareResult(E, b),
  });
  UI.show(S.node);
  if (rec.first && next) UI.later(S.node, 2400, () => UI.toast(UI.esc(t('res.unlocked', { name: lvText(i + 1)[1] }))));
  // the card is ready before anyone asks for it (a share sheet must open inside the tap)
  UI.later(S.node, 1400, () => cardFor(E));
}

// ---------- sharing ----------
const shareUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
function cardFor(E) {
  return (E.file ||= (async () => {
    await loadFonts();
    const [floor, name] = lvText(E.i);
    const cv = await buildCard({ photo: E.photo?.c || null, sim: E.sim, lv: E.lv, floor, name, set: E.rec.set, url: shareUrl() });
    return cardFile(cv, `un-solo-viaje-${E.lv.id}.png`);
  })().catch((err) => { console.info('[UN SOLO VIAJE] card', err); return null; }));
}
async function shareResult(E, btn) {
  btn?.setAttribute('aria-busy', 'true');
  const r = await shareCard(await cardFor(E), `${shareText(E.sim)} ${shareUrl()}`);
  btn?.removeAttribute('aria-busy');
  const k = { both: 'saved', downloaded: 'saved', copied: 'copied', error: 'err' }[r];
  if (k) UI.toast(UI.esc(t('share.' + k)));
}

// ---------- the frame ----------
let clean = false;
function draw(dt) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const A = S.attract;
  if (S.scene && S.sim && (S.state === 'play' || S.state === 'pause' || S.state === 'end')) {
    clean = false;
    const sim = S.sim, still = S.state === 'pause' || clock.held, k = S.state === 'play' ? clock.rate : 1;
    S.scene.frame(g, still ? 0 : dt * k, sim.end ? 0 : Math.max(0, clock.t - sim.t));
    if (S.quiet || still) Audio.drop(S.scene); else Audio.cues(S.scene);
    S.node?.update?.(sim, S.state === 'play' && clock.rate > 1.5);
  } else if (A && S.state === 'title') {
    clean = false;
    if (!wall) wall = paintWall();
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(wall, 0, 0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawAttract(dt);
  } else if (!clean) { g.clearRect(0, 0, W, H); clean = true; }
  if (S.fade.a > 0.004 && !clean) { g.fillStyle = `rgba(28,29,26,${S.fade.a.toFixed(3)})`; g.fillRect(0, 0, W, H); }
}
// a fanless laptop or an old phone: drop the resolution once rather than drop frames
function watchQuality(dt) {
  if (Q.done || S.qa || S.state !== 'play' || document.hidden || !S.sim || S.sim.t < 1.5) return;
  Q.n++; Q.t += dt;
  if (Q.t < 3) return;
  const avg = Q.t / Q.n;
  if (avg > 1 / 42 && Q.cap > 1) { Q.cap = Math.max(1, Q.cap - 0.5); console.info('[UN SOLO VIAJE] dpr cap', Q.cap); resize(); }
  else Q.done = true;
  Q.n = 0; Q.t = 0;
}
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = clamp((ms - last) / 1000, 0, 0.1); last = ms;
  watchQuality(dt);
  if (S.state === 'play' && S.sim) {
    const sim = S.sim;
    if (!clock.held) { tickClock(dt); stepTo(clock.t); }
    if (S.state === 'play') {
      const strain = strainOf(sim), timer = sim.step?.lit === 'timer';
      S.tut?.update(sim.t, strain);
      if (!S.quiet) Audio.update({ strain, lit: !timer || sim.light.on, timer: timer && sim.light.on, lapse: clock.rate > 1.5 });
    }
  }
  if (S.state === 'title') attractTick(dt);
  const veil = S.fade.a;
  S.fade.a = clamp(S.fade.a + S.fade.v * dt, 0, 1);
  if (S.state !== 'pause' || veil > 0) draw(dt);
  if (S.state === 'end' && S.end && !S.end.shown && S.end.scene.done) showResult();
}

// ---------- input ----------
// keys: ← → a hand (grab a bag, or hand its bags to the other one), ↓ put it all down, ↑ pick it all
// up. Touch: a tap either side of the screen is that hand; the key between your fists sets it down
canvas.addEventListener('pointerdown', (e) => {
  lastPointer = e.pointerType || 'mouse';
  if (S.state !== 'play' || e.button > 0) return;
  e.preventDefault();
  const h = e.clientX < W / 2 ? 0 : 1;
  act((s) => s.take(h));
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || lastPointer; unlockAudio(); }, { capture: true, passive: true });
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  lastPointer = 'mouse';
  unlockAudio();
  const k = e.key;
  if (S.state === 'play') {
    const once = (fn) => { e.preventDefault(); if (!e.repeat) act(fn); };
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') once((s) => s.take(0));
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') once((s) => s.take(1));
    else if (k === 'ArrowDown' || k === 's' || k === 'S' || k === ' ') once((s) => s.down());
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') once((s) => s.up());
    else if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); pause(); }
  } else if (S.state === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); resume(); }
  else if (S.state === 'title' && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); titleStep(k === 'ArrowLeft' ? -1 : 1); }
  else if (S.state === 'end' && S.end?.shown && k === 'Escape') { e.preventDefault(); goTitle(S.idx); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (S.state === 'play') pause();
    else if (S.state !== 'pause') { hiddenHush = true; Audio.suspend(); }
  } else if (hiddenHush) { hiddenHush = false; Audio.resume(); }
});
window.addEventListener('blur', () => { if (!S.qa) pause(); });
window.addEventListener('pagehide', () => pause());
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// ---------- boot ----------
// QA only: pretend the first n levels were carried up by a good player
function fillSave(n) {
  for (let k = 0; k < Math.min(n, N); k++) {
    let r = null;
    for (let s = 0; s < 8; s++) { r = playOut(LEVELS[k], 'good', 7 + k + 100 * s); if (r.end?.why === 'arrive') break; }
    recordResult(save, LEVELS[k], r.sim);
  }
}
// QA: jump ahead without sound. Frames are drawn where they matter (the last moments, and around each
// photo the scene wants to take) so hands, doors and stickers have caught up with the state
function fastForward(T, film = false) {
  const sim = S.sim, sc = S.scene;
  S.quiet = true;
  const shoot = () => { g.setTransform(dpr, 0, 0, dpr, 0, 0); sc.frame(g, DT * 2); Audio.drop(sc); };
  let n = 0;
  while (sim.t < T - 1e-9 && !sim.end) {
    S.bot?.update(); sim.tick(DT); pump(); n++;
    const near = T - sim.t < 0.8 || (sc.shot && sim.t > sc.shot.at - 0.6);
    if (near ? (n & 1) === 0 : film && n % 30 === 0) shoot();
  }
  S.quiet = false;
  Audio.drop(sc);
  clock.t = sim.t; clock.rate = 1;
}
async function qaEntry() {
  const scr = q.get('screen'); if (!scr) return false;
  S.qa = true;
  const i = clamp((+q.get('level') || 1) - 1, 0, N - 1);
  if (q.get('fill')) fillSave(+q.get('fill') || N);
  if (scr === 'title') { goTitle(q.has('level') ? i : undefined); return true; }
  if (!unlocked(i)) save.unlockAll = true;
  begin(i);
  const T = +q.get('t') || 0;
  if (scr === 'end') {
    S.bot ||= new Bot(S.sim, q.get('out') || 'good', 5);
    S.tut.stop(false);
    fastForward(T || 600, true);
    const sc = S.scene;
    S.quiet = true;
    for (let k = 0; k < 600 && !sc.done; k++) { g.setTransform(dpr, 0, 0, dpr, 0, 0); sc.frame(g, 1 / 30); Audio.drop(sc); }
    S.quiet = false;
    showResult();
    return true;
  }
  if (T) fastForward(T);
  if (q.get('hold') === '1') clock.held = true;
  if (scr === 'pause') pause();
  return true;
}
async function boot() {
  labelDoc();
  S.node = UI.el(`<section class="scr boot" data-screen="boot"><p>${UI.esc(t('loading'))}</p></section>`);
  UI.show(S.node);
  resize();
  requestAnimationFrame((ms) => { last = ms; frame(ms); });
  const man = fetch('assets/manifest.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  // the stickers, pops and the stamp are painted once, in these faces: nothing is drawn before them
  await Promise.race([loadFonts(), wait(6000)]);
  manifest = await Promise.race([man, wait(4000).then(() => null)]);
  Audio.setMuted(isMuted());
  window.__game = {
    S, clock, save, fastForward, pause, resume, begin, goTitle, showResult, act, Audio, cardFor,
    cardURL: async () => {
      const f = S.end && (await cardFor(S.end));
      return f && new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
    },
  };
  const qa = await qaEntry().catch((err) => { console.error(err); return false; });
  if (!qa) goTitle();
  window.__ready = true;
}
boot();
