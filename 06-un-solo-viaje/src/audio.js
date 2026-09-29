// UN SOLO VIAJE sound: the one import the game uses. The voices are recorded (assets/audio);
// everything else is synthesised in src/audio/: the bags and the building (foley.js), the verbena
// band that walks to your steps, the strain, the lifts and the stingers (music.js), and the air of
// each room (amb.js). The scene only says what happened (scene.cues); this file decides how it sounds.
import { E } from './audio/core.js';
import { burst, sweep } from './audio/kit.js';
import * as F from './audio/foley.js';
import { Band, Strain, Lift, Muzak, win, fail, miss, oops, star, beep } from './audio/music.js';
import { Amb } from './audio/amb.js';

const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const log = (k, e) => console.info('[UN SOLO VIAJE audio]', k, e?.message || e);

// ---------- people ----------
// one clip per speaker at a time: a new line from the same mouth cuts the last one short
const VOX = new Map();
function voice(c, delay = 0) {
  const k = c.key, who = c.who || '?';
  let o;
  // the entryphone's grille: a speaker the size of a coin, and the street around it
  if (k.startsWith('buzz')) o = { dest: F.intercomIn(), gain: 1.15 };
  // behind the door: the flat first, then her in the hall, still on the other side
  else if (k === 'door1') o = { bus: 'ppl', lp: 850, gain: 0.75, room: 0.8 };
  else if (k === 'door2') o = { bus: 'ppl', lp: 1500, gain: 0.85, room: 0.55 };
  // you've gone on up and she hasn't stopped: calling after you, a flight of stairs away
  else if (c.behind) o = { bus: 'ppl', lp: 1100, gain: 0.7, room: 0.85 };
  // the driver down in the street, fainter and duller and more stairwell the higher you get
  else if (who === 'driver') { const f = cl(c.far || 0); o = { bus: 'ppl', lp: 7000 - 5200 * f, gain: 1 - 0.5 * f, room: 0.2 + 0.7 * f, pan: -0.2 }; }
  else o = { bus: 'ppl', gain: 1 };
  VOX.get(who)?.stop(0.08);
  const h = E.play(k, { ...o, delay, duck: true });
  if (h) VOX.set(who, h); else VOX.delete(who);
  return h;
}
function hush(f = 0.1) { for (const h of VOX.values()) h.stop(f); VOX.clear(); }

// ---------- the interface: paper and the scale's keys ----------
function tap(t = E.now) {
  const d = F.out('ui', 0, 1);
  burst(d, t, { f: 2400, q: 1.1, pk: 0.08, a: 0.0008, d: 0.01, len: 0.008, r: 0.01 });
  sweep(d, t, 620, 280, { pk: 0.05, a: 0.001, d: 0.015, len: 0.015, r: 0.01 });
}
function paper(t = E.now, up = true) {
  burst(F.out('ui', 0, 1), t, { color: 'pink', f: up ? 1100 : 2800, to: up ? 2800 : 1100, q: 0.9, pk: 0.07, a: 0.05, d: 0.08, sus: 0.4, len: 0.14, r: 0.07 });
}

// ---------- what the scene said ----------
const S = { lit: false, timer: false, lapse: false, strain: 0, on: false };
const CUE = {
  room(t, c) { E.g.setSpace(c.kind); Amb.setRoom(c.kind); },
  ding(t, c) { F.ding(t, c.old); },
  liftDoor(t, c) { F.liftDoor(t, c.open); },
  buzzer(t, c) { if (c.on) F.Buzzer.start(t); else F.Buzzer.stop(t); },
  ride(t, c) {
    if (c.on) { Lift.start(t, !!c.old); if (!c.old) Muzak.start(); }
    else { Lift.stop(t); Muzak.stop(0.4); }
  },
  gone(t) { miss(t + 0.12); },
  light(t, c) { F.light(t, c.on); },
  honk(t, c) { F.honk(t, c.n || 0, c.far || 0); },
  rustle(t, c) { F.rustle(t, c.n || 1); },
  hook(t, c) { F.hook(t, c.kg); },
  grab(t, c) { F.grab(t, c.kg); },
  nope(t) { F.nope(t); },
  thud(t, c) { F.thud(t, c.n || 1); },
  sigh(t) { F.sigh(t); },
  slip(t, c) { F.slip(t, c.kg, c.stairs); },
  break(t, c) { if (c.glass) F.shatter(t, 1, true); else F.splat(t, 1); },
  keys(t) { F.keys(t); },
  lock(t) { F.lock(t); },
  trunk(t) { F.trunk(t); },
  door(t, c) { F.door(t, c.what); },
  reja(t) { F.reja(t); },
  button(t, c) { F.button(t, c.what); },
  switch(t) { F.switchClick(t); },
  bell(t) { F.bell(t); },
  crouch(t) { F.crouch(t); },
  boop(t) { F.boop(t); },
  elbow(t) { F.elbow(t); },
  foot(t) { F.foot(t); },
  bum(t) { F.bum(t); },
  clonc(t) { F.clonc(t); },
  whoosh(t, c) { F.whoosh(t, c.turn || 1); },
  step(t, c) { F.step(t, c); Band.step(t, c); },
  sticker(t) { F.sticker(t); },
  voice(t, c) { voice(c, Math.max(0, t - E.now)); },
  stamp(t, c) {
    F.stamp(t, c.good); Strain.stop(0.2); Muzak.stop(0.2); Amb.duck(0.5, 0.4);
    if (c.good) win(t + 0.15); else fail(t + 0.3);
  },
  hop(t, c) { F.hop(t, c); },
  tumble(t) { F.tumble(t); oops(t); Band.quiet = true; Strain.stop(0.15); },
};
// the menu's attract run: only the band, following the ghost's feet, and the rooms' echo
const ATTRACT = { room: CUE.room, step: (t, c) => Band.step(t, c) };

// every call is fenced: a synth bug must never stop the game
function safe(o) {
  const w = {};
  for (const [k, fn] of Object.entries(o)) w[k] = (...a) => { if (!E.live) return; try { fn(...a); } catch (e) { log(k, e); } };
  return w;
}
function run(map, sc) {
  const cs = sc.cues;
  if (!cs.length) return;
  if (E.live) {
    const now = E.now;
    for (const c of cs) { const fn = map[c.k]; if (fn) try { fn(now + Math.max(0, c.at - sc.t), c); } catch (e) { log(c.k, e); } }
  }
  cs.length = 0;
}

export const Audio = {
  E,
  init: () => E.init(),
  unlock: () => E.unlock(),
  get live() { return E.live; },
  get muted() { return E.muted; },
  setMuted(m) { E.setMuted(m); },
  suspend() { E.suspend(); },
  resume() { E.resume(); },
  load: (man, lang, onP) => E.loadManifest(man, lang, onP),
  switchLang: (l) => E.switchLang(l),

  // a level starts at the car's open boot; the band waits for your first step
  start() {
    if (!E.ctx) return;
    try {
      this.stop(0.2);
      S.on = true; S.lit = S.timer = S.lapse = false; S.strain = 0;
      Band.reset(); E.g.setSpace('trunk', 0.1); Amb.start('trunk'); Strain.start();
    } catch (e) { log('start', e); }
  },
  stop(f = 0.8) {
    S.on = false;
    try {
      const t = E.now;
      Amb.stop(f); Strain.stop(Math.min(f, 0.4)); Muzak.stop(Math.min(f, 0.5)); hush(0.1);
      if (E.ctx) { Lift.stop(t); F.Buzzer.stop(t); }
    } catch (e) { log('stop', e); }
  },
  // back at the scale: the ghost's steps play the band again, even after a bag went down the stairs
  menu() {
    S.on = false;
    try { Band.reset(); } catch (e) { log('menu', e); }
  },
  cues(sc) { run(CUE, sc); },
  attract(sc) { run(ATTRACT, sc); },
  drop(sc) { if (sc?.cues) sc.cues.length = 0; },
  // every frame: how close a hand is to giving (0..1), the stair light and its timer, the time-lapse rest
  update({ strain = 0, lit = false, timer = false, lapse = false } = {}) {
    if (!S.on || !E.ctx) return;
    try {
      if (Math.abs(strain - S.strain) > 0.01) { S.strain = strain; Strain.set(strain); }
      if (lit !== S.lit || timer !== S.timer) { S.lit = lit; S.timer = timer; Amb.setLight(lit, timer); }
      if (lapse !== S.lapse) { S.lapse = lapse; Amb.setLapse(lapse); }
    } catch (e) { log('update', e); }
  },
  voice: (c, d) => (E.live ? voice(c, d) : null),
  ui: safe({ tap, paper, beep: (hi = true, t = E.now) => beep(t, hi), star: (i = 0, t = E.now) => star(t, i), sticker: (t = E.now) => F.sticker(t) }),
  music: safe({ win: (t = E.now) => win(t), fail: (t = E.now) => fail(t) }),
  can: () => E.live,
};
