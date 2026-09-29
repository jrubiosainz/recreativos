// BOSTEZO: boot, screens, input and the frame loop. Rules, drawing and sound live in their own modules.
import { Scene } from './scene.js';
import { Hud } from './hud.js';
import { Director } from './director.js';
import { Tutorial } from './tutorial.js';
import { Bot } from './bot.js';
import { LEVELS, levelById } from './levels.js';
import { Audio } from './audio.js';
import { TUNE } from './sim.js';
import { t, setLang, getLang, detectLang } from './i18n.js';
import { loadSave, writeSave, recordResult, isUnlocked, totalStars } from './save.js';
import { snapshot, buildCard, cardFile, shareCard } from './share.js';
import { fmtTime } from './util.js';
import * as UI from './ui.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const save = loadSave();
const unlockAll = q.get('unlock') === '1';
const forceMute = q.get('mute') === '1';
const useBot = q.get('bot') === '1';
const skipTut = q.get('skip') === '1';
setLang(q.get('lang') || save.lang || detectLang());

const S = {
  state: 'boot', // boot | title | week | invite | play | pause | end | allDone
  demo: null, demoPort: false,
  scene: null, hud: null, dir: null, tut: null, bot: null,
  idx: 0, level: null, from: 'title',
  end: null, pics: null, picWait: 0,
  holdKeys: false, holdPtrs: new Set(),
  loadP: 0, onLoadP: null,
};
let manifest = null;
let W = 1, H = 1, dpr = 1, safeBottom = 0;
// resolution guard: weak GPUs drop frames at 2x, so step the backing store down; undo a step that didn't help
const Q = { cap: Math.min(2, +q.get('dpr') || 2), n: 0, t: 0, skip: 1.5, before: 0, prev: 0, done: false };
let lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const isTouch = () => q.get('touch') === '1' || lastPointer !== 'mouse';
const isMuted = () => forceMute || !!save.muted;
const portrait = () => H > W * 1.05;
const seed = () => (q.has('seed') ? +q.get('seed') : (Math.random() * 1e9) | 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const inLevel = () => S.state === 'invite' || S.state === 'play' || S.state === 'pause' || S.state === 'end';

// ---------- assets ----------
const images = {};
const imgP = {};
function room(key) {
  if (!imgP[key]) {
    imgP[key] = new Promise((res) => {
      const src = manifest?.images?.[key] || `assets/img/${key}.jpg`;
      const i = new Image();
      i.decoding = 'async';
      i.onload = () => { images[key] = i; res(i); };
      i.onerror = () => res(null);
      i.src = src;
    });
  }
  return imgP[key];
}

// ---------- audio ----------
let audioReady = null;
let wantMusic = null;
function unlockAudio() {
  const first = !Audio.unlocked;
  if (first) Audio.init().then(() => { Audio.setMuted(isMuted()); music(wantMusic); if (S.state === 'play' || S.state === 'end') Audio.ambience.start(); });
  Audio.setMuted(isMuted());
  if (!audioReady && manifest) {
    audioReady = Audio.loadManifest(manifest, getLang(), (p) => { S.loadP = p; S.onLoadP?.(p); });
  }
}
function music(style) {
  wantMusic = style;
  if (!Audio.unlocked) return;
  if (style) Audio.music.start(style);
  else Audio.music.stop(0.8);
}
function toggleMute() {
  save.muted = !save.muted;
  writeSave(save);
  Audio.setMuted(isMuted());
  return isMuted();
}
function switchLang() {
  const next = getLang() === 'es' ? 'en' : 'es';
  setLang(next);
  save.lang = next;
  writeSave(save);
  document.title = `${t('title')} · ${t('tagline')}`;
  if (audioReady) {
    Audio.unloadVoices();
    S.loadP = 0;
    audioReady = Audio.loadManifest(manifest, next, (p) => { S.loadP = p; S.onLoadP?.(p); });
  }
  goTitle();
}

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
  if (S.demo) {
    if (portrait() !== S.demoPort) makeDemo();
    else layoutDemo();
  }
  if (S.scene) layoutLevel();
  draw();
}
// the crowd sits under the logo and above the buttons
function layoutDemo() { S.demo.layout(W, H, { top: H * (portrait() ? 0.3 : 0.27), bottom: H * (portrait() ? 0.2 : 0.14), left: W * 0.03, right: W * 0.03 }); }
function layoutLevel() {
  const ins = S.hud.layout(W, H, safeBottom);
  S.scene.layout(W, H, ins);
  UI.placeCaption(S.hud.captionRect);
}

// the title crowd: a big room drones on while yawns ripple through it
function makeDemo() {
  const port = portrait();
  const L = levelById(port ? 'l3' : 'l6');
  const build = () => {
    S.demo = new Scene(L, images, { demo: true, t, seed: 11 });
    S.demoPort = port;
    layoutDemo();
    for (let i = 0; i < 90; i++) S.demo.update(1 / 30);
  };
  if (images[L.room]) build();
  else room(L.room).then(() => { if (portrait() === port) build(); });
}

// ---------- screens ----------
const nextIndex = () => { const i = LEVELS.findIndex((L) => !save.levels[L.id]?.won); return i < 0 ? LEVELS.length - 1 : i; };
const wonCount = () => LEVELS.filter((L) => save.levels[L.id]?.won).length;

function goTitle() {
  leaveLevel();
  S.state = 'title';
  if (!S.demo) makeDemo();
  music('title');
  const won = wonCount();
  UI.show(UI.titleScreen({
    muted: isMuted(),
    cont: won > 0,
    bestLine: won ? `${UI.star(true)}<b>${totalStars(save)}</b>/${LEVELS.length * 3}` : '',
    onPlay: () => { unlockAudio(); if (won >= LEVELS.length) goWeek(); else goInvite(nextIndex(), 'title'); },
    onWeek: () => { unlockAudio(); goWeek(); },
    onMute: toggleMute,
    onLang: switchLang,
  }));
}

function goWeek() {
  leaveLevel();
  S.state = 'week';
  if (!S.demo) makeDemo();
  music('title');
  const sv = unlockAll ? { ...save, unlockAll: true } : save;
  let nextSet = false;
  const states = LEVELS.map((L, i) => {
    const r = save.levels[L.id];
    let state = 'open';
    if (!isUnlocked(sv, LEVELS, i)) state = 'locked';
    else if (r?.won) state = 'done';
    else if (!nextSet) { state = 'next'; nextSet = true; }
    return { state, stars: r?.stars || 0 };
  });
  UI.show(UI.weekScreen({
    levels: LEVELS, states, stars: totalStars(save), maxStars: LEVELS.length * 3,
    onPick: (i) => goInvite(i, 'week'),
    onBack: goTitle,
  }));
}

function goWeekDone() {
  leaveLevel();
  S.state = 'allDone';
  if (!S.demo) makeDemo();
  music('title');
  UI.show(UI.weekDoneScreen({ stars: totalStars(save), maxStars: LEVELS.length * 3, onMenu: goTitle }));
}

// the invite sits on top of the real room, frozen, so accepting simply lets the meeting start
async function goInvite(i, from = S.from) {
  leaveLevel();
  const L = LEVELS[i];
  S.idx = i; S.level = L; S.from = from;
  S.state = 'invite';
  music('title');
  await room(L.room);
  if (S.state !== 'invite' || S.level !== L) return;
  makeLevel(L);
  S.scene.frozen = true;
  const news = (L.news || []).map((k) => {
    const pic = document.createElement('canvas');
    pic.width = pic.height = 144;
    return { key: k, pic, html: t('news.' + (k === 'psst' && isTouch() ? 'psstTouch' : k)) };
  });
  S.pics = news; S.picWait = 2;
  const node = UI.inviteScreen({
    level: L, people: S.scene.sim.people.length, news,
    onAccept: () => accept(node),
    onBack: () => (S.from === 'week' ? goWeek() : goTitle()),
  });
  UI.show(node);
}

async function accept(node) {
  unlockAudio();
  if (audioReady && S.loadP < 1) {
    node.setProgress(S.loadP);
    S.onLoadP = (p) => node.setProgress(p);
    await Promise.race([audioReady, wait(9000)]);
    S.onLoadP = null;
    if (S.state !== 'invite' || UI.screen() !== 'invite') return;
  }
  beginMeeting();
}

function makeLevel(L) {
  S.scene = new Scene(L, images, { t, seed: seed() });
  S.hud = new Hud(S.scene, { t, touch: isTouch(), keyHint: !isTouch() });
  layoutLevel();
}

const tutT = (k, v) => t(isTouch() && (k === 'tut.t2' || k === 'tut.p1') ? k + 'touch' : k, v);

function beginMeeting() {
  const L = S.level, sc = S.scene;
  sc.frozen = false;
  S.state = 'play';
  S.pics = null;
  UI.hide();
  S.dir = new Director(sc, S.hud, manifest, getLang());
  S.bot = useBot ? new Bot(sc.sim) : null;
  const kind = L.tutorial && !save.tut?.[L.tutorial] && !skipTut ? L.tutorial : null;
  S.tut = kind ? new Tutorial(kind, sc, S.hud, UI.caption, tutT) : null;
  sc.on(onSceneEvent);
  music(L.ceo ? 'keynote' : 'office');
  if (Audio.unlocked) Audio.ambience.start();
  if (portrait() && sc.sim.people.length > 20) UI.toast(`${UI.ICON.rotate}<span>${t('rotate')}</span>`, { top: true, ms: 3600 });
  last = performance.now();
}

function retry() {
  const i = S.idx;
  leaveLevel();
  S.idx = i; S.level = LEVELS[i];
  S.state = 'invite';
  room(S.level.room).then(() => {
    if (S.state !== 'invite' || S.level !== LEVELS[i]) return;
    makeLevel(S.level);
    beginMeeting();
  });
}

function leaveLevel() {
  S.dir?.stopAll();
  if (S.scene && Audio.unlocked) Audio.ambience.stop();
  UI.caption(null);
  S.scene = S.hud = S.dir = S.tut = S.bot = S.end = S.pics = null;
  S.holdPtrs.clear(); S.holdKeys = false;
  canvas.style.cursor = '';
}

function pause() {
  if (S.state !== 'play') return;
  S.state = 'pause';
  S.holdPtrs.clear(); S.holdKeys = false;
  if (S.hud) S.hud.pressed = false;
  Audio.suspend();
  UI.show(UI.pauseScreen({
    muted: isMuted(),
    onResume: resume,
    onRestart: () => { Audio.resume(); retry(); },
    onQuit: () => { Audio.resume(); goTitle(); },
    onMute: toggleMute,
  }));
}
function resume() {
  if (S.state !== 'pause') return;
  UI.hide();
  Audio.resume();
  S.state = 'play';
  last = performance.now();
}

// ---------- play ----------
function doPsst(v) {
  const sc = S.scene, sim = sc.sim, p = v.p;
  if (S.tut?.locksInput()) return;
  const res = sim.psst(p.id);
  const s = v.screen;
  const pop = (key, color) => sc.fx.text(t('pop.' + key), s.headX, s.headY - s.R * 1.9, { size: Math.max(14, s.R * 0.72), color, dur: 0.95, rise: 16 });
  if (res === 'far') { pop('far', '#ffd9d6'); Audio.sfx.uiBack(); }
  else if (res === 'cooldown') pop('cooldown', '#ffffff');
  else if (res === 'ok' && p.kind === 'coffee' && p.cup > 0) pop('immune', '#f1dcc0');
}

function onSceneEvent(e, sc) {
  if (sc !== S.scene) return;
  if (e.type === 'end') onEnd(e.kind);
  else if (e.type === 'callout' && e.player && isTouch()) navigator.vibrate?.(e.strikes >= 3 ? [80, 60, 220] : 70);
}

// end of the meeting: freeze the result, grab the money shot, then hand over to the paperwork
const END = { win: { snap: 3.2, show: 5.2 }, fired: { snap: 2.72, show: 2.8 }, time: { snap: null, show: 3.4 } };
function onEnd(kind) {
  const sc = S.scene, sim = sc.sim, L = S.level;
  S.state = 'end';
  S.holdPtrs.clear(); S.holdKeys = false;
  S.hud.pressed = false;
  S.scene.hover = null;
  canvas.style.cursor = '';
  UI.caption(null);
  const res = {
    kind,
    strikes: sim.strikes,
    maxChain: Math.max(sim.stats.maxChain, sim.boss.ep?.members?.size || 0),
    time: sim.t,
    yawns: sim.stats.npcYawns,
    seen: sim.boss.seen,
    target: sim.target,
  };
  const prevBest = save.levels[L.id]?.best ?? null;
  const rec = recordResult(save, L, res);
  S.end = { kind, res, rec, prevBest, at: L.hour * 60 + (L.min || 0) + Math.floor(sim.t), ...END[kind], card: null, file: null, shown: false };
}

function stepEnd() {
  const E = S.end, et = S.scene.endT;
  if (E.snap != null && !E.card && et >= E.snap) {
    draw();
    const L = S.level;
    E.card = buildCard({
      kind: E.kind, shot: snapshot(canvas), t,
      levelName: t('levels.' + L.id), when: UI.whenText(L),
      time: E.res.time, chain: E.res.maxChain, stars: E.rec.stars,
    });
    cardFile(E.card).then((f) => { E.file = f; });
  }
  if (!E.shown && et >= E.show) { E.shown = true; showResult(); }
}

function showResult() {
  const E = S.end, L = S.level, words = S.dir?.finalText() || '';
  const common = { level: L, res: E.res, lastWords: words, onRetry: retry, onMenu: goTitle };
  if (E.kind === 'win') {
    const isLast = S.idx === LEVELS.length - 1;
    UI.show(UI.winScreen({
      ...common, stars: E.rec.stars, newBest: E.rec.newBest, best: E.prevBest, card: E.card, isLast,
      onNext: () => (isLast ? goWeekDone() : goInvite(S.idx + 1, S.from)),
      onShare: share,
    }));
  } else if (E.kind === 'fired') {
    UI.show(UI.firedScreen({ ...common, at: E.at, card: E.card, onShare: share }));
  } else {
    UI.show(UI.timeScreen(common));
  }
}

async function share() {
  const E = S.end;
  if (!E) return;
  const lvl = t('levels.' + S.level.id);
  const text = E.kind === 'win' ? t('shareText', { t: fmtTime(E.res.time), lvl, c: E.res.maxChain }) : t('shareTextFired', { lvl });
  const url = /^https?:/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) ? ` ${location.origin}${location.pathname}` : '';
  const r = await shareCard(E.file, text + url);
  const msg = { copied: t('copied'), both: t('shareBoth'), downloaded: t('shareDown'), error: t('shareErr') }[r];
  if (msg) UI.toast(msg);
}

// ---------- loop ----------
let last = performance.now();
let fpsEl = null, fpsN = 0, fpsT = 0;

function stepLevel(dt) {
  const sc = S.scene, sim = sc.sim;
  const locked = !!S.tut?.locksInput();
  const hold = (S.holdKeys || S.holdPtrs.size > 0) && S.state === 'play';
  if (!S.bot && S.state === 'play') sim.input.hold = hold && !locked;
  sc.update(dt, S.bot);
  if (S.tut) {
    S.tut.update(dt);
    if ((S.tut.step === 'free' || S.tut.step === 'done') && !save.tut?.[S.tut.kind]) { (save.tut ||= {})[S.tut.kind] = true; writeSave(save); }
  }
  S.hud.pressed = S.bot ? sim.input.hold && !sim.over : hold && !locked;
  S.hud.update(dt);
  S.dir.update(dt);
  if (S.state === 'end') stepEnd();
}

function step(dt) {
  if (S.state === 'play' || S.state === 'end') stepLevel(dt);
  else if (S.state === 'invite' && S.scene) {
    S.scene.update(dt);
    if (S.pics && --S.picWait < 0) { fillPics(); S.pics = null; }
  } else if (S.state !== 'pause' && S.demo) S.demo.update(dt);
}

function draw() {
  const sc = inLevel() && S.scene ? S.scene : S.demo;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!sc) { g.fillStyle = '#1d1733'; g.fillRect(0, 0, W, H); return; }
  g.clearRect(0, 0, W, H);
  sc.draw(g);
  if (S.hud && sc === S.scene && S.state !== 'invite') S.hud.draw(g);
  sc.fx.drawOver(g, W, H);
}

function watchQuality(raw) {
  if (Q.done || document.hidden || S.state === 'pause' || S.state === 'boot') return;
  if (raw > 0.25) { Q.n = 0; Q.t = 0; return; }
  if (Q.skip > 0) { Q.skip -= raw; return; }
  Q.n++; Q.t += raw;
  if (Q.t < 2.5) return;
  const fps = Q.n / Q.t;
  Q.n = 0; Q.t = 0;
  if (Q.before) {
    // not fill-bound (or throttled, like iOS Low Power Mode): keep the sharp picture and stop adapting
    if (fps < Q.before * 1.12) { Q.cap = Q.prev; Q.done = true; resize(); return; }
    Q.before = 0;
  }
  if (fps < 48 && dpr > 1) {
    Q.before = fps; Q.prev = Q.cap;
    Q.cap = Math.max(1, dpr - 0.5);
    Q.skip = 0.5;
    resize();
  }
}

function frame(now) {
  const raw = Math.max(0, (now - last) / 1000);
  const dt = Math.min(0.05, raw);
  last = now;
  if (S.state !== 'pause') { step(dt); draw(); }
  watchQuality(raw);
  if (fpsEl) {
    fpsN++; fpsT += dt;
    if (fpsT >= 0.5) { fpsEl.textContent = `${Math.round(fpsN / fpsT)} fps · ${dpr}x`; fpsN = 0; fpsT = 0; }
  }
  requestAnimationFrame(frame);
}

// cut the invite's portraits out of the room itself, so every newcomer is recognisable in play
function fillPics() {
  const sc = S.scene, sim = sc.sim;
  const byKind = { intern: 'intern', phone: 'phone', pelota: 'pelota', coffee: 'coffee', sleeper: 'sleeper' };
  for (const n of S.pics) {
    let s = null;
    if (byKind[n.key]) s = sc.views.find((v) => v.p.kind === byKind[n.key])?.screen;
    else if (n.key === 'back') s = sc.me.screen;
    else if (n.key === 'glance' || n.key === 'ceo') s = sc.boss.screen;
    else if (n.key === 'psst') {
      const near = sc.views.filter((v) => v.p !== sim.player && v.p.kind === 'normal').sort((a, b) => sim.dist(sim.player, a.p) - sim.dist(sim.player, b.p))[0];
      s = near?.screen;
    }
    const pg = n.pic.getContext('2d');
    let sx, sy, size;
    if (s) { size = s.R * 3.3; sx = s.headX - size / 2; sy = s.headY - size * 0.42; }
    else { size = Math.min(W, H) * 0.92; sx = (W - size) / 2; sy = (H - size) * 0.55; }
    pg.drawImage(canvas, sx * dpr, sy * dpr, size * dpr, size * dpr, 0, 0, n.pic.width, n.pic.height);
  }
}

// ---------- input ----------
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; unlockAudio(); }, { capture: true });
window.addEventListener('keydown', () => unlockAudio(), { capture: true });

canvas.addEventListener('pointerdown', (e) => {
  if (S.state !== 'play') return;
  const x = e.clientX, y = e.clientY, hud = S.hud;
  if (hud.hitPause(x, y)) { e.preventDefault(); pause(); return; }
  if (hud.hitButton(x, y)) {
    e.preventDefault();
    S.holdPtrs.add(e.pointerId);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    return;
  }
  const v = S.scene.pick(x, y, e.pointerType !== 'mouse');
  if (v) doPsst(v);
});
const release = (e) => S.holdPtrs.delete(e.pointerId);
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', release);
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || S.state !== 'play') return;
  const x = e.clientX, y = e.clientY;
  const v = S.holdPtrs.size ? null : S.scene.pick(x, y, false);
  S.scene.hover = v;
  canvas.style.cursor = v || S.hud.hitButton(x, y) || S.hud.hitPause(x, y) ? 'pointer' : '';
});
canvas.addEventListener('pointerleave', () => { if (S.scene) S.scene.hover = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const isSpace = (e) => e.code === 'Space' || e.key === ' ';
window.addEventListener('keydown', (e) => {
  if (isSpace(e) && (S.state === 'play' || (S.state === 'end' && !S.end?.shown))) {
    e.preventDefault();
    if (!e.repeat) S.holdKeys = true;
    return;
  }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (S.state === 'play') { e.preventDefault(); pause(); }
    else if (S.state === 'pause') { e.preventDefault(); resume(); }
    else if (e.key === 'Escape') {
      if (S.state === 'week') goTitle();
      else if (S.state === 'invite') (S.from === 'week' ? goWeek() : goTitle());
    }
  }
});
window.addEventListener('keyup', (e) => { if (isSpace(e)) S.holdKeys = false; });
window.addEventListener('blur', () => { S.holdKeys = false; S.holdPtrs.clear(); pause(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); Audio.suspend(); }
  else if (S.state !== 'pause') Audio.resume();
});
window.addEventListener('resize', resize);

// ---------- boot ----------
async function boot() {
  document.title = `${t('title')} · ${t('tagline')}`;
  resize();
  const slow = setTimeout(() => { if (S.state === 'boot') UI.show(UI.bootScreen()); }, 450);
  const [m] = await Promise.all([
    fetch('assets/manifest.json').then((r) => r.json()).catch(() => null),
    document.fonts.load('600 20px Fredoka').catch(() => null),
  ]);
  manifest = m;
  await room(portrait() ? 'room_training' : 'room_auditorium');
  clearTimeout(slow);
  makeDemo();
  if (q.get('fps') === '1') { fpsEl = document.createElement('div'); fpsEl.className = 'fps'; document.body.appendChild(fpsEl); }
  requestAnimationFrame(frame);
  await qaEntry();
  for (const k of Object.keys(manifest?.images || {})) room(k);
  window.__game = { S, save, LEVELS, UI, Audio, stepLevel, draw, fastForward };
  window.__ready = true;
}

// deterministic time travel for tests: ?screen=win&level=l3&t=20
function fastForward(sec) {
  const n = Math.round(sec * 60);
  for (let i = 0; i < n && S.scene; i++) stepLevel(1 / 60);
  draw();
}

async function qaEntry() {
  const scr = q.get('screen'), lv = levelById(q.get('level') || '') ? LEVELS.findIndex((L) => L.id === q.get('level')) : -1;
  if (!scr && lv < 0) { goTitle(); return; }
  if (scr === 'week') { goWeek(); return; }
  if (scr === 'allDone') { goWeekDone(); return; }
  if (scr === 'title') { goTitle(); return; }
  const i = Math.max(0, lv);
  if (scr === 'invite') { await goInvite(i, 'week'); return; }
  S.idx = i; S.level = LEVELS[i];
  await room(S.level.room);
  makeLevel(S.level);
  beginMeeting();
  const tt = parseFloat(q.get('t') || (scr ? '12' : '0'));
  if (tt > 0) fastForward(tt);
  if (scr === 'pause') pause();
  else if (scr === 'win' || scr === 'fired' || scr === 'time') {
    const sim = S.scene.sim;
    if (scr === 'win') sim.boss.seen = sim.target;
    if (scr === 'fired') sim.strikes = 3;
    sim.finish(scr);
    for (const e of sim.events) { S.scene.visual(e); S.scene.emit(e); }
    sim.events.length = 0;
    fastForward(END[scr].show + 0.2);
  }
}

boot();
