// ¡QUE CIERRAN!: boot, screens, input and the frame loop. Rules, drawing and sound live in their own modules.
import { Scene } from './scene.js';
import { Hud } from './hud.js';
import { Bubbles } from './bubbles.js';
import { Director } from './director.js';
import { Tutorial } from './tutorial.js';
import { Bot } from './bot.js';
import { LEVELS, levelById } from './levels.js';
import { Audio } from './audio.js';
import { t, tc, num, setLang, getLang, detectLang } from './i18n.js';
import { loadSave, writeSave, recordResult, isUnlocked, totalStars } from './save.js';
import { snapshot, buildCard, buildRallyCard, cardFile, shareCard } from './share.js';
import { clamp } from './util.js';
import * as UI from './ui.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const g = canvas.getContext('2d');
const save = loadSave();
const unlockAll = q.get('unlock') === '1';
const forceMute = q.get('mute') === '1';
const botName = q.get('bot') ? (q.get('bot') === '1' ? 'skilled' : q.get('bot')) : null;
const skipTut = q.get('skip') === '1';
setLang(q.get('lang') || save.lang || detectLang());

const MAX = LEVELS.length * 3;
const DEMO = ['s4', 's5', 's3', 's7', 's2', 's8'];
const S = {
  state: 'boot', // boot | title | board | brief | play | pause | end | allDone
  demo: null, demoBot: null, demoN: 0,
  scene: null, hud: null, bub: null, dir: null, tut: null, bot: null,
  idx: 0, level: null, from: 'title',
  shot: null, snapAt: null, end: null, rally: null,
  loadP: 0, onLoadP: null, qaForce: q.get('outcome'),
  fade: { a: 0, dir: 0 },
};
let manifest = null;
let W = 1, H = 1, dpr = 1, safeBottom = 0, last = performance.now();
// resolution guard: weak GPUs drop frames at 2x, so step the backing store down; undo a step that didn't help
const Q = { cap: Math.min(2, +q.get('dpr') || 2), n: 0, t: 0, skip: 1.5, before: 0, prev: 0, done: false };
let lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const isTouch = () => q.get('touch') === '1' || lastPointer !== 'mouse';
const isMuted = () => forceMute || !!save.muted;
const portrait = () => H > W * 1.05;
const seed = () => (q.has('seed') ? +q.get('seed') : (Math.random() * 1e9) | 0);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const inLevel = () => S.state === 'brief' || S.state === 'play' || S.state === 'pause' || S.state === 'end';
const wonCount = () => LEVELS.filter((L) => save.levels[L.id]?.won).length;
const nextIndex = () => { const i = LEVELS.findIndex((L) => !save.levels[L.id]?.won); return i < 0 ? LEVELS.length - 1 : i; };

// ---------- assets ----------
const images = {};
const imgP = {};
function room(key) {
  if (!imgP[key]) {
    imgP[key] = new Promise((res) => {
      const i = new Image();
      i.decoding = 'async';
      i.onload = () => { images[key] = i; res(i); };
      i.onerror = () => res(null);
      i.src = manifest?.images?.[key] || `assets/img/${key}.jpg`;
    });
  }
  return imgP[key];
}

// ---------- audio ----------
let audioReady = null, wantMusic = false;
function unlockAudio() {
  Audio.setMuted(isMuted());
  if (!Audio.unlocked) Audio.unlock().then((ok) => { if (ok) { Audio.setMuted(isMuted()); if (wantMusic) Audio.menu.start(); } });
  if (!audioReady && manifest) audioReady = Audio.loadManifest(manifest, getLang(), (p) => { S.loadP = p; S.onLoadP?.(p); });
}
function music(on) {
  wantMusic = on;
  if (on) Audio.menu.start(); else Audio.menu.stop(0.8);
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
    S.loadP = 0;
    audioReady = Audio.switchLang(next).then(() => { S.loadP = 1; S.onLoadP?.(1); });
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
  if (S.demo) layoutDemo(S.demo);
  if (S.scene) layoutLevel();
  draw();
}
function layoutLevel() {
  const ins = S.hud.layout(W, H, safeBottom);
  S.scene.layout(W, H, ins, dpr);
  const fit = S.hud.captionFit(S.scene.doorRect());
  UI.placeCaption(S.hud.captionRect, fit.alt, fit.limit);
  clearCaption();
}
// while a tutorial caption hangs over the doorway, judgement text and speech bubbles float below it, not behind it
function clearCaption() {
  if (!S.scene || !S.hud) return;
  const c = UI.captionBox(), over = c && c.l < W / 2 && c.r > W / 2;
  S.scene.safeTop = over ? Math.max(S.hud.safeTop, c.b + Math.round(6 * S.hud.u)) : S.hud.safeTop;
}
function tutCaption(html) { UI.caption(html); clearCaption(); }

// the title plays a real rush hour: a veteran oshiya on a loop of stations, framed between the logo and the buttons
function layoutDemo(sc) { sc.layout(W, H, { top: H * (portrait() ? 0.25 : 0.19), bottom: H * (portrait() ? 0.2 : 0.15) }, dpr); }
function makeDemo() {
  const L = levelById(DEMO[S.demoN % DEMO.length]);
  const build = () => {
    const sc = new Scene(L, images, { demo: true, t: tc, seed: 11 + S.demoN * 7, assist: false });
    const bot = new Bot(sc.sim, 'skilled', 5 + S.demoN);
    layoutDemo(sc);
    for (let i = 0; i < 300; i++) sc.update(1 / 60, bot);   // skip the arrival: open on a doorway already at work
    S.demo = sc; S.demoBot = bot; S.fade.dir = -1;
  };
  if (images[L.bg]) build();
  else room(L.bg).then(build);
}
// between stations the picture dips to black, so the cut to the next platform is hidden
function stepDemo(dt) {
  const d = S.demo, F = S.fade;
  if (!d) return;
  d.update(dt, S.demoBot);
  if (F.dir === 0 && d.sim.over && d.endT > 0.4) F.dir = 1;
  if (F.dir) {
    F.a = clamp(F.a + F.dir * dt / 0.35);
    if (F.dir === 1 && F.a >= 1) { F.dir = 2; S.demoN++; makeDemo(); }
    else if (F.dir < 0 && F.a <= 0) F.dir = 0;
  }
}

// ---------- screens ----------
function goTitle() {
  leaveLevel();
  S.state = 'title';
  if (!S.demo) makeDemo();
  music(true);
  const won = wonCount();
  UI.show(UI.titleScreen({
    muted: isMuted(), cont: won > 0, stars: totalStars(save), maxStars: MAX, touch: isTouch(),
    onPlay: () => { unlockAudio(); if (won >= LEVELS.length) goBoard(); else goBrief(nextIndex(), 'title'); },
    onBoard: () => { unlockAudio(); goBoard(); },
    onMute: toggleMute,
    onLang: switchLang,
  }));
}

function goBoard() {
  leaveLevel();
  S.state = 'board';
  if (!S.demo) makeDemo();
  music(true);
  const sv = unlockAll ? { ...save, unlockAll: true } : save;
  let nextSet = false;
  const states = LEVELS.map((L, i) => {
    const r = save.levels[L.id];
    let state = 'open';
    if (!isUnlocked(sv, LEVELS, i)) state = 'locked';
    else if (r?.won) state = 'done';
    else if (!nextSet) { state = 'next'; nextSet = true; }
    return { state, set: r?.set || [false, false, false] };
  });
  UI.show(UI.boardScreen({
    levels: LEVELS, states, stars: totalStars(save), maxStars: MAX,
    onPick: (i) => goBrief(i, 'board'),
    onBack: goTitle,
  }));
}

function goDone() {
  leaveLevel();
  S.state = 'allDone';
  if (!S.demo) makeDemo();
  music(true);
  const stars = totalStars(save);
  S.rally = { card: buildRallyCard({ levels: LEVELS, save, stars, maxStars: MAX, t }), file: null };
  cardFile(S.rally.card, 'que-cierran-sellos.png').then((f) => { if (S.rally) S.rally.file = f; });
  UI.show(UI.doneScreen({
    levels: LEVELS, save, stars, maxStars: MAX, onMenu: goTitle,
    onShare: async () => {
      const r = await shareCard(S.rally?.file, t('shareText.done', { n: stars, m: MAX }) + shareUrl());
      shareToast(r);
    },
  }));
}

// the platform ticket sits on the real station, frozen before the train comes in
async function goBrief(i, from = S.from) {
  leaveLevel();
  const L = LEVELS[i];
  S.idx = i; S.level = L; S.from = from;
  S.state = 'brief';
  music(true);
  await room(L.bg);
  if (S.state !== 'brief' || S.level !== L) return;
  makeLevel(L);
  S.scene.frozen = true;
  const node = UI.briefScreen({
    level: L,
    onGo: () => accept(node),
    onBack: () => (S.from === 'board' ? goBoard() : goTitle()),
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
    if (S.state !== 'brief' || UI.screen() !== 'brief') return;
  }
  begin();
}

function makeLevel(L) {
  S.scene = new Scene(L, images, { t: tc, seed: seed() });
  S.hud = new Hud(S.scene, { t: tc, touch: isTouch() });
  S.bub = new Bubbles(S.scene);
  layoutLevel();
}

function begin() {
  const L = S.level, sc = S.scene;
  S.state = 'play';
  UI.hide();
  music(false);
  sc.frozen = false;
  S.dir = new Director(sc, S.hud, S.bub, { intro: true, lang: getLang() });
  S.bot = botName ? new Bot(sc.sim, botName, sc.seed + 1) : null;
  S.tut = L.id === 's1' && !save.tut?.s1 && !skipTut && !S.bot ? new Tutorial(sc, tutCaption, t, isTouch()) : null;
  sc.on(onSceneEvent);
  last = performance.now();
}

function retry() {
  const i = S.idx;
  leaveLevel();
  S.idx = i; S.level = LEVELS[i];
  S.state = 'brief';
  room(S.level.bg).then(() => {
    if (S.state !== 'brief' || S.level !== LEVELS[i]) return;
    UI.hide();
    makeLevel(S.level);
    begin();
  });
}

function leaveLevel() {
  S.dir?.stop();
  S.tut?.stop();
  UI.caption(null);
  S.scene = S.hud = S.bub = S.dir = S.tut = S.bot = S.end = S.shot = S.snapAt = null;
  canvas.style.cursor = '';
}

function pause() {
  if (S.state !== 'play') return;
  S.state = 'pause';
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
function onSceneEvent(type, e, sc) {
  if (sc !== S.scene) return;
  if (type === 'point') S.snapAt = sc.time + 0.42;   // the money shot: gloves pointing, faces on the glass
  else if (type === 'end') onEnd(e.result);
  else if (isTouch() && navigator.vibrate && !S.bot && navigator.userActivation?.hasBeenActive !== false) {   // only for a human thumb
    if (type === 'push' && e.q === 'perfect') navigator.vibrate(12);
    else if (type === 'push' && e.q === 'bump') navigator.vibrate([10, 40, 18]);
    else if (type === 'incident') navigator.vibrate([60, 50, 120]);
  }
}

// the photo for the share card: a 4:5 crop around the doorway, without the HUD
function takeShot() {
  const sc = S.scene, d = sc.doorTop();
  S.hud.hidden = true; S.bub.hidden = true;
  draw();
  let w, h;
  if (W / H > 0.8) { h = H; w = H * 0.8; } else { w = W; h = Math.min(H, W * 1.25); }
  const x = clamp(d.x - w / 2, 0, W - w), y = portrait() ? clamp(d.y - h * 0.1, 0, H - h) : 0;
  S.shot = snapshot(canvas, { x: x * dpr, y: y * dpr, w: w * dpr, h: h * dpr });
  S.hud.hidden = false; S.bub.hidden = false;
  draw();
}

// QA only: ?outcome=pass|late|fail bends the result so every screen can be checked
function forceOutcome(res, k) {
  const r = { ...res, stats: { ...res.stats } };
  if (k === 'fail') { r.fill = Math.min(r.fill, r.target - 7); r.pass = false; r.goldOk = false; }
  else { r.fill = Math.max(r.fill, k === 'gold' ? r.gold + 3 : r.target + 4); r.pass = true; r.goldOk = r.fill >= r.gold; }
  if (k === 'late') { r.onTime = false; r.delay = 2.4; S.scene.sim.lateCause = S.scene.sim.lateCause || 'sumo'; } else if (k) { r.onTime = true; r.delay = 0; }
  return r;
}

function onEnd(result) {
  const L = S.level, sc = S.scene;
  const res = S.qaForce ? forceOutcome(result, S.qaForce) : result;
  S.state = 'end';
  UI.caption(null);
  S.tut?.stop(); S.tut = null;
  if (!S.shot) takeShot();
  const rec = recordResult(save, L, res);
  const kind = UI.outcome(res);
  const cause = t('cause.' + (sc.sim.lateCause || 'none'));
  const card = buildCard({ L, res, set: rec.stamps, shot: S.shot, cause, t, num });
  S.end = { res, rec, kind, cause, card, file: null, shown: false, at: sc.endT };
  cardFile(card).then((f) => { if (S.end) S.end.file = f; });
  Audio.jingle(kind === 'fail' ? 'fail' : res.goldOk && kind === 'pass' ? 'gold' : 'win');
}

function showResult() {
  const E = S.end, L = S.level, isLast = S.idx === LEVELS.length - 1;
  E.shown = true;
  if (S.hud) S.hud.fadeTo = 0;
  UI.show(UI.resultScreen({
    level: L, res: E.res, rec: E.rec, cause: E.cause, card: E.card, isLast,
    onNext: () => (isLast ? goDone() : goBrief(S.idx + 1, S.from)),
    onRetry: retry,
    onMenu: goTitle,
    onShare: share,
  }));
}

const shareUrl = () => (/^https?:/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) ? ` ${location.origin}${location.pathname}` : '');
function shareToast(r) {
  const msg = { copied: t('copied'), both: t('shareBoth'), downloaded: t('shareDown'), error: t('shareErr') }[r];
  if (msg) UI.toast(msg);
}
async function share() {
  const E = S.end;
  if (!E) return;
  const L = S.level, st = `${L.romaji} (${L.kanji})`;
  const text = E.kind === 'pass' ? t(E.res.goldOk ? 'shareText.gold' : 'shareText.pass', { fill: E.res.fill, st })
    : E.kind === 'late' ? t('shareText.late', { s: num(E.res.delay, 1), cause: E.cause }) : t('shareText.fail', { st });
  shareToast(await shareCard(E.file, text + shareUrl()));
}

// ---------- loop ----------
let fpsEl = null, fpsN = 0, fpsT = 0;

function stepLevel(dt) {
  const sc = S.scene;
  if (S.tut) clearCaption();
  sc.update(dt, S.dir && S.dir.preroll > 0 ? null : S.bot);
  if (S.tut) {
    S.tut.update(dt);
    if ((S.tut.step === 'free' || S.tut.done) && !save.tut?.s1) { (save.tut ||= {}).s1 = true; writeSave(save); }
  }
  S.dir?.update(dt);
  S.bub.update(dt);
  S.hud.update(dt);
  if (S.snapAt != null && sc.time >= S.snapAt) { S.snapAt = null; takeShot(); }
  if (S.state === 'end' && !S.end.shown && sc.endT - S.end.at >= 0.35) showResult();
}

function step(dt) {
  if (S.state === 'play' || S.state === 'end') stepLevel(dt);
  else if (S.state === 'brief' && S.scene) S.scene.update(dt);
  else if (S.state !== 'pause') stepDemo(dt);
}

function draw() {
  const sc = inLevel() && S.scene ? S.scene : S.demo;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!sc) { g.fillStyle = '#1b1d26'; g.fillRect(0, 0, W, H); return; }
  sc.draw(g);
  if (sc === S.scene) {
    if (S.state !== 'brief') { S.bub.draw(g); S.hud.draw(g); }
  } else if (S.fade.a > 0) { g.fillStyle = `rgba(14,15,20,${S.fade.a})`; g.fillRect(0, 0, W, H); }
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

// ---------- input ----------
// one button. The press is stamped with its own time, so a tap between frames still lands on its sub-step
function tap(e) {
  const sc = S.scene;
  if (!sc || S.state !== 'play') return;
  const ahead = clamp((e.timeStamp - last) / 1000, 0, 0.05);
  sc.tap(sc.sim.t + ahead * sc.slow);
}
window.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; unlockAudio(); }, { capture: true });
window.addEventListener('keydown', () => unlockAudio(), { capture: true });

canvas.addEventListener('pointerdown', (e) => {
  if (S.state !== 'play') return;
  e.preventDefault();
  if (S.hud.hitPause(e.clientX, e.clientY)) { pause(); return; }
  tap(e);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || S.state !== 'play') return;
  canvas.style.cursor = S.hud.hitPause(e.clientX, e.clientY) ? 'pointer' : '';
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const isTapKey = (e) => e.code === 'Space' || e.key === ' ' || e.key === 'Enter';
window.addEventListener('keydown', (e) => {
  if (isTapKey(e) && (S.state === 'play' || (S.state === 'end' && !S.end?.shown))) {
    e.preventDefault();
    if (!e.repeat) tap(e);
    return;
  }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (S.state === 'play') { e.preventDefault(); pause(); }
    else if (S.state === 'pause') { e.preventDefault(); resume(); }
    else if (e.key === 'Escape') {
      if (S.state === 'board') goTitle();
      else if (S.state === 'brief') (S.from === 'board' ? goBoard() : goTitle());
    }
  }
});
window.addEventListener('blur', () => pause());
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
    document.fonts.load('700 20px Fredoka').catch(() => null),
    document.fonts.load('600 20px Fredoka').catch(() => null),
    document.fonts.load('700 20px "Zen Maru"', '乗車率始発駅').catch(() => null),
  ]);
  manifest = m;
  await room(levelById(DEMO[0]).bg);
  clearTimeout(slow);
  makeDemo();
  if (q.get('fps') === '1') { fpsEl = document.createElement('div'); fpsEl.className = 'fps'; document.body.appendChild(fpsEl); }
  requestAnimationFrame(frame);
  await qaEntry();
  for (const k of Object.keys(manifest?.images || {})) room(k);
  window.__game = { S, save, LEVELS, UI, Audio, stepLevel, draw, fastForward, takeShot };
  window.__ready = true;
}

// deterministic time travel for tests: ?level=s3&bot=skilled&t=20, ?screen=result&level=s5&outcome=late
function fastForward(sec) {
  const n = Math.round(sec * 60);
  for (let i = 0; i < n && S.scene && S.state !== 'pause'; i++) stepLevel(1 / 60);
  draw();
}

async function qaEntry() {
  const scr = q.get('screen'), lv = levelById(q.get('level') || '') ? LEVELS.findIndex((L) => L.id === q.get('level')) : -1;
  if (q.get('fill') === '1') {                 // QA: a finished stamp book, in memory only
    LEVELS.forEach((L, i) => { save.levels[L.id] = { won: true, set: [true, i % 3 !== 1, i % 2 === 0], stars: 1 + (i % 3 !== 1) + (i % 2 === 0), best: 150 + i * 9, plays: 2 }; });
  }
  if (!scr && lv < 0) { goTitle(); return; }
  if (scr === 'title') { goTitle(); return; }
  if (scr === 'board') { goBoard(); return; }
  if (scr === 'allDone') { goDone(); return; }
  const i = Math.max(0, lv);
  if (scr === 'brief') { await goBrief(i, 'board'); return; }
  S.idx = i; S.level = LEVELS[i]; S.from = 'board';
  await room(S.level.bg);
  makeLevel(S.level);
  begin();
  if (scr === 'result') {
    for (let k = 0; k < 60 * 150 && S.scene && !S.end; k++) stepLevel(1 / 60);
    fastForward(0.6);
    return;
  }
  const tt = parseFloat(q.get('t') || '0');
  if (tt > 0) fastForward(tt);
  if (scr === 'pause') pause();
}

boot();
