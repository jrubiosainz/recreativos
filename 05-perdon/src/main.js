// PERDÓN, PERDÓN: boot, screens, the clock, input and the frame loop. The rules live in sim.js, the
// picture in scene.js and gfx/, sound in audio.js, the screens in ui/; this file wires them together.
import { clamp } from './util.js';
import { LEVELS } from './levels.js';
import { Sim } from './sim.js';
import { Bot, playOut } from './bot.js';
import { Scene } from './scene.js';
import { Audio } from './audio.js';
import { loadFonts } from './fonts.js';
import { t, setLang, getLang, detectLang, worldText } from './i18n.js';
import { loadSave, writeSave, recordResult, isUnlocked } from './save.js';
import { duotone, buildCard, cardFile, shareCard, shareText } from './share.js';
import { Tutorial } from './tutorial.js';
import * as UI from './ui/dom.js';
import { titleScreen, briefScreen } from './ui/ticket.js';
import { playScreen, pauseScreen } from './ui/play.js';
import { resultScreen } from './ui/result.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const hintEl = document.getElementById('hint');
const save = loadSave();
if (q.get('unlock') === '1') save.unlockAll = true;
const forceMute = q.get('mute') === '1', skipTut = q.get('skip') === '1';
const botName = q.get('bot') ? (q.get('bot') === '1' ? 'skilled' : q.get('bot')) : null;
setLang(q.get('lang') || save.lang || detectLang());

const N = LEVELS.length, DT = 1 / 120, LEAD = 0.45;
const S = {
  state: 'boot', // boot | title | brief | play | pause | end
  idx: 0, sim: null, scene: null, bot: null, tut: null, node: null, end: null, attract: null,
  fx: null, you: null, hudBottom: 0, qa: false, quiet: false, fade: { a: 1, v: -2.5 },
};
let manifest = null, W = 1, H = 1, dpr = 1, safe = { t: 0, b: 0, l: 0, r: 0 }, last = performance.now();
const Q = { cap: Math.min(2, +q.get('dpr') || 2), n: 0, t: 0, done: false };
let lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const isTouch = () => q.get('touch') === '1' || lastPointer !== 'mouse';
const isMuted = () => forceMute || !!save.muted;
const newSeed = () => (q.has('seed') ? +q.get('seed') : (Math.random() * 1e9) | 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const unlocked = (i) => isUnlocked(save, LEVELS, i);
const recOf = (i) => save.lv[LEVELS[i].id] || {};
const tripName = (i) => t('trip.' + LEVELS[i].id);
const daySec = (lv, s) => lv.clock[0] * 3600 + lv.clock[1] * 60 + lv.clock[2] + s;
const mkBot = (kind, sim, seed) => (kind === 'idle' ? { update() {} } : new Bot(sim, kind, seed));
const buzz = (ms) => { if (isTouch() && !isMuted()) navigator.vibrate?.(ms); };
// the next trip: the first one not yet caught, then the first without its three stars
function nextIndex() {
  let i = LEVELS.findIndex((lv, k) => unlocked(k) && !recOf(k).won);
  if (i < 0) i = LEVELS.findIndex((lv, k) => unlocked(k) && (recOf(k).stars || 0) < 3);
  return i < 0 ? 0 : i;
}
function labelDoc() {
  document.title = `${t('title')} · ${t('tagline')}`;
  canvas.setAttribute('aria-label', t('canvas'));
}

// ---------- sound: the context is born on the first gesture; the voices load right after ----------
let voicesP = null, voicesOK = false, wantMusic = false, hiddenHush = false;
const voicesReady = () => voicesOK || isMuted() || !manifest || !Audio.E.ctx;
// (only once a gesture has made the context: creating it earlier gets it blocked, and a warning)
function loadVoices() {
  if (!voicesP && manifest && Audio.E.ctx) {
    voicesP = Audio.load(manifest, getLang()).then(() => { voicesOK = true; S.node?.setReady?.(true); });
  }
  return voicesP || Promise.resolve();
}
function unlockAudio() {
  if (S.state === 'pause') return;
  Audio.setMuted(isMuted());
  if (!Audio.init()) return;
  Audio.unlock().then((ok) => { if (ok) { Audio.setMuted(isMuted()); if (wantMusic) Audio.music.busker(true); } });
  loadVoices();
}
function music(on) { wantMusic = on; Audio.music.busker(on); }
function toggleMute() {
  save.muted = !save.muted; writeSave(save);
  Audio.setMuted(isMuted());
  if (isMuted()) S.node?.setReady?.(true);
  return isMuted();
}
function switchLang() {
  const next = getLang() === 'es' ? 'en' : 'es';
  setLang(next); save.lang = next; writeSave(save);
  labelDoc();
  if (voicesP) { voicesOK = false; voicesP = Audio.switchLang(next).then(() => { voicesOK = true; S.node?.setReady?.(true); }); }
  S.attract = null;   // the station's lettering is painted in the language
  goTitle();
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
const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
function relayout() {
  if (S.scene && (S.state === 'play' || S.state === 'pause' || S.state === 'end')) {
    if (S.node?.hudRect) S.hudBottom = S.node.hudRect().bottom;
    S.scene.resize(W, H, S.hudBottom, 0, 1);
    S.tut?.place();
  }
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

// ---------- the station behind the ticket: the next trip, walked by someone who dances on purpose ----------
function setAttract(i, kind) {
  const A0 = S.attract;
  if (A0 && A0.i === i) return layoutAttract();
  const seed = S.qa ? 11 + i : (Math.random() * 1e9) | 0, lv = LEVELS[i];
  const sim = new Sim(lv, { seed }), bot = mkBot(kind, sim, seed);
  // start where the corridor is already busy
  const T0 = Math.max(0, Math.min(14, lv.dep - 20));
  while (sim.t < T0 - 1e-9 && !sim.end) { bot.update(); sim.tick(DT); sim.drain(); }
  S.attract = { i, kind, sim, bot, scene: new Scene(sim, worldText()), t: sim.t, out: false };
  if (A0) { S.fade.a = Math.max(S.fade.a, 0.85); S.fade.v = -3; }
  layoutAttract();
}
// landscape: the corridor centred in the room the ticket leaves on the right. Portrait: above the
// ticket, the camera stepping back until you fit
function layoutAttract() {
  const A = S.attract; if (!A) return;
  const r = S.node?.stackRect?.() || S.node?.panelRect?.();
  if (!r || r.width < 1) return A.scene.resize(W, H, safe.t, 0, 1);
  if (W >= H * 1.25) return A.scene.resize(W + r.right, H, safe.t, 0, 1);
  const bottom = Math.max(0, H - r.top - 10), portrait = H > W * 1.05;
  const feet = H - Math.max(bottom + 18, H * (portrait ? 0.125 : 0.095)), hy = safe.t + H * (portrait ? 0.05 : 0.04);
  const f0 = Math.min((H * (portrait ? 0.235 : 0.3) * 4) / 1.72, (W * 4) / 3.9);
  A.scene.resize(W, H, safe.t, bottom, clamp((0.6 * (feet - hy)) / ((1.68 * f0) / 4), 0.35, 1));
}
function attractTick(dt) {
  const A = S.attract; if (!A) return;
  A.t += dt;
  const sim = A.sim;
  while (sim.t < A.t - 1e-9 && !sim.end) { A.bot.update(); sim.tick(DT); A.scene.events(sim.drain()); }
  // the train leaves (with or without them): a dip to the tiles, and another commuter
  if (A.scene.done && !A.out) { A.out = true; S.fade.v = 3; }
  if (A.out && S.fade.a >= 1) { S.attract = null; setAttract(A.i, A.kind); S.fade.a = 1; S.fade.v = -2.2; }
}

// ---------- the ticket ----------
function goTitle() {
  leavePlay();
  S.state = 'title'; S.end = null;
  const next = nextIndex();
  const rows = LEVELS.map((lv, i) => {
    const r = recOf(i);
    return { i, n: lv.n, name: tripName(i)[0], dep: daySec(lv, lv.dep), state: i === next ? 'next' : !unlocked(i) ? 'locked' : r.won ? 'done' : 'open', set: r.set };
  });
  S.node = titleScreen({ rows, next, muted: isMuted(), rumbas: save.rumbas, onPick: pick, onGo: openBrief, onMute: toggleMute, onLang: switchLang });
  UI.show(S.node);
  music(true);
  setAttract(next, 'dancer');
}
function pick(i) {
  if (!unlocked(i)) { UI.toast(UI.esc(t('locked', { n: i }))); Audio.ui.beep(undefined, false); return; }
  openBrief(i);
}
function openBrief(i) {
  if (!unlocked(i)) return;
  leavePlay();
  S.idx = i; S.state = 'brief'; S.end = null;
  const lv = LEVELS[i], [name, sub] = tripName(i);
  const node = (S.node = briefScreen({
    lv, name, sub, now: daySec(lv, 0), dep: daySec(lv, lv.dep), intro: lv.intro, touch: isTouch(), set: recOf(i).set, muted: isMuted(),
    onGo: (ph) => {
      if (ph === 'run') Audio.ui.validate();
      else if (ph === 'stamp') { buzz(12); S.fade.v = 2.2; }
      else if (ph === 'play') begin(i);
    },
    onBack: goTitle, onMute: toggleMute,
  }));
  UI.show(node);
  music(true);
  setAttract(i, 'skilled');
  loadVoices();
  if (voicesReady()) node.setReady(true);
  else UI.later(node, 12000, () => node.setReady(true));
}

// ---------- a trip ----------
function begin(i) {
  leavePlay();
  UI.hint(null);
  music(false);
  S.attract = null;
  const lv = LEVELS[i], seed = newSeed(), [name] = tripName(i);
  const sim = (S.sim = new Sim(lv, { seed }));
  S.idx = i; S.state = 'play'; S.end = null;
  S.scene = new Scene(sim, worldText());
  S.bot = botName ? mkBot(botName, sim, seed) : null;
  S.node = playScreen({ lv, name, muted: isMuted(), onPause: pause, onMute: toggleMute });
  UI.show(S.node);
  S.hudBottom = S.node.hudRect().bottom;
  S.scene.resize(W, H, S.hudBottom, 0, 1);
  S.tut = new Tutorial(sim, {
    t, hint: placeHint, where: hintWhere, touch: isTouch(), seen: new Set(save.hints),
    basics: i === 0 && !save.tut && !skipTut && !S.bot,
    onSeen: (k) => { if (!save.hints.includes(k)) { save.hints.push(k); writeSave(save); } },
    onDone: () => { save.tut = true; writeSave(save); },
  });
  if (skipTut || S.bot) S.tut.stop(false);
  S.fx = { next: false, last: false, warn: false, tick: 99, stepK: null, densT: 0 };
  Audio.amb.start();
  clock.start(LEAD);
  S.fade.a = 1; S.fade.v = -3;
}
function leavePlay() {
  S.you?.stop(0.08); S.you = null;
  if (S.state === 'pause') { Audio.resume(); clock.release(); }
  Audio.amb.stop(0.5);
  S.tut?.stop(false); UI.hint(null);
  S.sim = null; S.scene = null; S.bot = null; S.tut = null; S.fx = null;
}
function pump() {
  const sim = S.sim, list = sim.drain();
  if (!list.length) return;
  S.scene.events(list);
  const now = Audio.E.now;
  for (const e of list) {
    S.tut?.event(e);
    if (e.k === 'end') { onEnd(e); continue; }
    if (S.quiet) continue;
    switch (e.k) {
      case 'step': if (!e.auto) Audio.you.sidestep(e.side); break;
      case 'bump': Audio.you.bump(e.why === 'bag'); buzz(28); break;
      case 'brush': Audio.you.brush(); buzz(8); break;
      case 'deny': Audio.you.wall(); break;
      case 'gate': Audio.ui.stamp(now, 0.8); Audio.ui.beep(now + 0.12, true); break;
      case 'dance': if (e.n === 2) Audio.dance.claps(); else if (e.n === 3) Audio.dance.llamada(); break;
    }
  }
}
function stepTo(tt) {
  const sim = S.sim;
  while (sim.t < tt - 1e-9 && !sim.end) { S.bot?.update(); sim.tick(DT); pump(); }
}
// a key counts against what was on screen when it was pressed, not when the frame got to it
function act(fn, stamp = performance.now()) {
  const sim = S.sim;
  if (S.state !== 'play' || !sim || sim.end || S.bot || clock.held != null) return;
  const tt = clock.now() - clamp((performance.now() - stamp) / 1000, 0, 0.1);
  if (tt > sim.t) stepTo(tt);
  if (sim.end) return;
  fn(sim);
  pump();
}
// the station's voice: the recording if there is one, a reading time for the caption either way
function announce(key) {
  const txt = t('pa.' + key), h = S.quiet ? null : Audio.pa(key), m = Audio.E.meta('pa_' + key);
  S.node?.pa?.(txt, h?.dur ?? (m?.dur ? m.dur + 1.05 : 1.2 + txt.length * 0.055));
}
const paHeard = new Set();
function timed() {
  const sim = S.sim, fx = S.fx, lv = sim.lv;
  if (!fx || sim.end || S.quiet) return;
  const tt = sim.t, left = lv.dep - tt;
  if (!fx.next && tt >= 1) { fx.next = true; if (!paHeard.has(lv.id)) { paHeard.add(lv.id); announce('next'); } }
  if (!fx.last && left <= 16) { fx.last = true; announce('last'); }
  const s = Math.ceil(left);
  if (s <= 10 && s > 0 && s !== fx.tick) { fx.tick = s; Audio.ui.tick(undefined, s <= 3); }
  if (!fx.warn && left <= 3) { fx.warn = true; Audio.train.warn(); }
  if (tt >= fx.densT) { fx.densT = tt + 0.5; Audio.amb.density(clamp(sim.agents.length / 14)); }
}
// what the scene asks to hear, when it asks: voices, the rumba, the doors, the train going
function playCues() {
  const sc = S.scene, cues = sc.cues;
  if (!cues.length) return;
  if (S.quiet) { cues.length = 0; return; }
  const now = Audio.E.now, won = S.sim.end?.why === 'arrive';
  for (const c of cues) {
    const d = Math.max(0, c.at - sc.t);
    if (c.k === 'say') {
      if (c.you) S.you?.stop(0.05);
      const h = Audio.voice(c, d);
      if (c.you) S.you = h;
    } else if (c.k === 'rumba') Audio.dance.rumba(now + d);
    else if (c.k === 'doors') Audio.train.doors(now + d);
    else if (c.k === 'depart') {
      Audio.train.depart(now + d, won);
      if (won) Audio.music.win(now + d + 0.5);
      else { Audio.music.fail(now + d + 1.2); Audio.pa('missed', d + 2.4); }
    }
  }
  cues.length = 0;
}
function footsteps() {
  const me = S.scene.me, fx = S.fx;
  if (!fx) return;
  const k = Math.floor(me.ph / Math.PI);
  if (fx.stepK !== null && k !== fx.stepK && me.amp > 0.15 && !S.quiet && !S.scene.E?.hidden) {
    Audio.you.step(undefined, k & 1 ? 1 : -1, clamp(me.amp, 0.3, 1));
  }
  fx.stepK = k;
}

// ---------- the tutorial's note: under your feet, or over the head of whoever it is about ----------
function hintWhere(target) {
  const sc = S.scene; if (!sc) return null;
  const p = sc.pos.get(target), w = Math.min(W - 24, 320);
  if (!p) return target === 'you' ? { r: { x: W / 2, y: H * 0.8, w }, dir: 'up' } : null;
  const [hx, hy, s] = p, x = clamp(hx, 12 + w / 2, W - 12 - w / 2), P = clamp(hx - (x - w / 2), 22, w - 22);
  if (target === 'you') return { r: { x, y: hy + 1.68 * s + 10, w, p: P }, dir: 'up' };
  const y = hy - 10;
  if (y < S.hudBottom + 8 + 3.5 * rem()) return null;
  return { r: { x, y, w, p: P }, dir: 'down' };
}
// under the feet unless that runs off the bottom (a short screen): then over your head. Once a note
// has moved up it stays up, so it never flickers between the two
const flip = { html: null, on: false };
function placeHint(html, r, dir) {
  if (html && r && dir === 'up') {
    if (flip.html !== html) { flip.html = html; flip.on = false; }
    UI.hint(html);
    if (!flip.on && r.y + hintEl.offsetHeight > H - safe.b - 6) flip.on = true;
    const p = flip.on && S.scene?.pos.get('you');
    if (p) { r = { ...r, y: p[1] - 10 }; dir = 'down'; }
  }
  UI.hint(html, r, dir);
}

// ---------- pause ----------
function pause() {
  if (S.state !== 'play' || !S.sim || S.sim.end) return;
  S.state = 'pause'; clock.hold(); Audio.suspend(); UI.hint(null);
  S.node = pauseScreen({ muted: isMuted(), touch: isTouch(), onResume: resume, onRestart: () => begin(S.idx), onQuit: goTitle, onMute: toggleMute });
  UI.show(S.node);
  draw(0);
}
function resume() {
  if (S.state !== 'pause') return;
  Audio.resume(); clock.release();
  S.state = 'play';
  S.node = playScreen({ lv: S.sim.lv, name: tripName(S.idx)[0], muted: isMuted(), onPause: pause, onMute: toggleMute });
  UI.show(S.node);
  const hb = S.node.hudRect().bottom;
  if (Math.abs(hb - S.hudBottom) > 0.5) { S.hudBottom = hb; S.scene.resize(W, H, hb, 0, 1); }
  S.node.update(S.sim);
  S.tut?.place();
}

// ---------- the doors close ----------
function onEnd(e) {
  const sim = S.sim, i = S.idx;
  S.state = 'end';
  const rec = recordResult(save, sim.lv, sim);
  S.end = { i, lv: sim.lv, rec, sim, scene: S.scene, file: null, shown: false, photo: null, duo: null };
  UI.hint(null);
  S.node?.paOff?.();
}
function showResult() {
  const E = S.end; if (!E || E.shown) return;
  E.shown = true;
  const { i, lv, rec, sim, scene } = E;
  E.photo = scene.photo;
  E.duo = E.photo ? duotone(E.photo.img) : null;
  const next = i < N - 1 && unlocked(i + 1);
  Audio.amb.stop(1.5);
  leavePlay();
  S.state = 'end';
  S.node = resultScreen({
    lv, name: tripName(i)[0], sim, rec, duo: E.duo, dance: sim.longestDance(), next, saveRumbas: save.rumbas.length,
    onAgain: () => begin(i), onHome: goTitle, onNext: () => openBrief(i + 1), onShare: (b) => shareResult(E, b),
  });
  UI.show(S.node);
  UI.later(S.node, 2600, () => music(true));
  // the card is ready before anyone asks for it (a share sheet must open inside the tap)
  UI.later(S.node, 1400, () => cardFor(E));
}

// ---------- sharing ----------
const shareUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
function cardFor(E) {
  return (E.file ||= (async () => {
    await loadFonts();
    const sim = E.sim, P = sim.P;
    const cv = buildCard({
      photo: E.photo?.img || null, duo: E.duo, dance: sim.longestDance(), perdones: P.perdones, set: E.rec.set,
      n: E.lv.n, name: tripName(E.i)[0], won: sim.end.why === 'arrive', rumba: P.rumbas.length > 0, margin: sim.end.margin, url: shareUrl(),
    });
    return cardFile(cv, `perdon-${E.lv.id}.png`);
  })().catch((err) => { console.info('[PERDÓN] card', err); return null; }));
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
  if (S.scene && (S.state === 'play' || S.state === 'pause' || S.state === 'end')) {
    clean = false;
    S.scene.frame(g, S.state === 'pause' || clock.held != null ? 0 : dt);
    if (S.state !== 'pause') { playCues(); footsteps(); }
    S.node?.update?.(S.sim);
  } else if (A && (S.state === 'title' || S.state === 'brief')) {
    clean = false;
    A.scene.shot = null;
    A.scene.frame(g, dt);
    A.scene.cues.length = 0;
  } else if (!clean) { g.clearRect(0, 0, W, H); clean = true; }
  if (S.fade.a > 0.004 && !clean) { g.fillStyle = `rgba(243,242,236,${S.fade.a.toFixed(3)})`; g.fillRect(0, 0, W, H); }
}
// a fanless laptop or an old phone: drop the resolution once rather than drop frames
function watchQuality(dt) {
  if (Q.done || S.qa || S.state !== 'play' || document.hidden || !S.sim || S.sim.t < 1.5) return;
  Q.n++; Q.t += dt;
  if (Q.t < 3) return;
  const avg = Q.t / Q.n;
  if (avg > 1 / 42 && Q.cap > 1) { Q.cap = Math.max(1, Q.cap - 0.5); console.info('[PERDÓN] dpr cap', Q.cap); resize(); }
  else Q.done = true;
  Q.n = 0; Q.t = 0;
}
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = clamp((ms - last) / 1000, 0, 0.1); last = ms;
  watchQuality(dt);
  if (S.state === 'play' && S.sim) {
    stepTo(clock.now());
    if (S.state === 'play') { timed(); S.tut?.update(S.sim.t); }
  }
  if (S.state === 'title' || S.state === 'brief') attractTick(dt);
  const veil = S.fade.a;
  S.fade.a = clamp(S.fade.a + S.fade.v * dt, 0, 1);
  if (S.state !== 'pause' || veil > 0) draw(dt);
  if (S.state === 'end' && S.end && !S.end.shown && S.end.scene.done) showResult();
}

// ---------- input ----------
// keys: ← → step aside, ↑ or space «¡perdón!». Touch: a tap either side of you steps that way; a tap
// on your raincoat asks
canvas.addEventListener('pointerdown', (e) => {
  lastPointer = e.pointerType || 'mouse';
  if (S.state !== 'play' || e.button > 0) return;
  e.preventDefault();
  const p = S.scene?.pos.get('you'), x = e.clientX;
  if (p && Math.abs(x - p[0]) < Math.max(0.42 * p[2], 26)) act((s) => s.ask(), e.timeStamp);
  else act((s) => s.move(x < (p ? p[0] : W / 2) ? -1 : 1), e.timeStamp);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || lastPointer; unlockAudio(); }, { capture: true, passive: true });
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  lastPointer = 'mouse';
  unlockAudio();
  const k = e.key;
  if (S.state === 'play') {
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); act((s) => s.move(-1), e.timeStamp); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); act((s) => s.move(1), e.timeStamp); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { e.preventDefault(); if (!e.repeat) act((s) => s.ask(), e.timeStamp); }
    else if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); pause(); }
  } else if (S.state === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) { e.preventDefault(); resume(); }
  else if (k === 'Escape' && (S.state === 'brief' || S.state === 'end')) { e.preventDefault(); goTitle(); }
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
// QA only: pretend the first n trips were walked by a good player
function fillSave(n) {
  for (let k = 0; k < Math.min(n, N); k++) recordResult(save, LEVELS[k], playOut(new Sim(LEVELS[k], { seed: 100 + k }), 'skilled', 7 + k));
}
// QA: jump ahead without sound. Frames are drawn where they matter (the last moments, and around each
// photo the scene wants to take) so every face has caught up with its state
function fastForward(T, film = false) {
  const sim = S.sim, sc = S.scene;
  S.quiet = true;
  const shoot = () => { g.setTransform(dpr, 0, 0, dpr, 0, 0); sc.frame(g, DT * 2); sc.cues.length = 0; };
  let n = 0;
  while (sim.t < T - 1e-9 && !sim.end) {
    S.bot?.update(); sim.tick(DT); pump(); n++;
    const near = T - sim.t < 0.8 || (sc.shot && sim.t > sc.shot.at - 0.6);
    if (near ? (n & 1) === 0 : film && n % 30 === 0) shoot();
  }
  S.quiet = false;
  sc.cues.length = 0;
  const fx = S.fx, left = sim.lv.dep - sim.t;
  if (fx) { fx.next = sim.t >= 1; fx.last = left <= 16; fx.warn = left <= 3; fx.tick = Math.ceil(left); }
  if (S.state === 'play') clock.start(0, sim.t);
}
async function qaEntry() {
  const scr = q.get('screen'); if (!scr) return false;
  S.qa = true;
  const i = clamp((+q.get('level') || 1) - 1, 0, N - 1);
  if (q.get('fill')) fillSave(+q.get('fill') || N);
  if (scr === 'title') { goTitle(); return true; }
  if (!unlocked(i)) save.unlockAll = true;
  openBrief(i);
  if (scr === 'brief') return true;
  begin(i);
  const T = +q.get('t') || 0;
  if (scr === 'end') {
    S.bot ||= mkBot(q.get('out') || 'skilled', S.sim, 5);
    S.tut.stop(false);
    fastForward(T || 400, true);
    const sc = S.scene;
    S.quiet = true;
    for (let k = 0; k < 600 && !sc.done; k++) { g.setTransform(dpr, 0, 0, dpr, 0, 0); sc.frame(g, 1 / 30); sc.cues.length = 0; }
    S.quiet = false;
    showResult();
    return true;
  }
  if (T) fastForward(T);
  if (q.get('hold') === '1') clock.hold();
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
  // the posters and name plates are painted once, in these faces: nothing is drawn before them
  await Promise.race([loadFonts(), wait(6000)]);
  manifest = await Promise.race([man, wait(4000).then(() => null)]);
  Audio.setMuted(isMuted());
  window.__game = {
    S, clock, save, fastForward, pause, resume, begin, openBrief, goTitle, showResult, act, Audio, cardFor,
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
