import { clamp, hashStr, mulberry32 } from './util.js';
import { framesFor, patienceFor, beh } from './levels.js';
import { PEOPLE } from './people.js';
import { layout } from './layout.js';

// ¡PATATA! simulation: deterministic, fixed step, no DOM. Everything the family does comes from here;
// the renderer only draws the snapshots and the print is judged on exactly what was drawn.

export const DT = 1 / 120;
export const OPEN = 0.55; // eyes narrower than this come out closed in the print
export const LOOK_X = 0.3, LOOK_Y = 0.35; // gaze further off than this is not looking at the camera
export const SMILE = 0.45; // you say «patata» to smile: a face below this comes out serious
export const MOUTH = 0.45; // a mouth this open means you caught them talking
const KAPPA = 0.45; // when a word ends, anyone past this share of their blink urge lets the blink go
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const TIMER = 10; // the self-timer, like the real thing

export const blinkLen = (bd) => 0.3 * bd;
// one blink: the lid falls fast, stays shut a moment, rises more slowly
export function blinkCurve(tb, bd = 1) {
  const c = 0.08 * bd, h = 0.05 * bd, o = 0.17 * bd;
  if (tb < 0 || tb >= c + h + o) return 1;
  if (tb < c) { const x = tb / c; return 1 - x * x; }
  if (tb < c + h) return 0;
  const x = (tb - c - h) / o;
  return 1 - (1 - x) * (1 - x);
}

export function clipInfo(v) {
  const env = new Float32Array(v.env.length);
  for (let i = 0; i < env.length; i++) env[i] = B36.indexOf(v.env[i]) / 35;
  // the last word starts after the last real pause: the grandpa's «¿Eh? ¡Ah!» comes before it.
  // Words are loud stretches between silences of a sixth of a second; a trailing breath is not a word.
  const weF = Math.min(env.length, Math.round(v.we * 30) + 1), words = [];
  let run = 99, cur = null;
  for (let i = 0; i < weF; i++) {
    if (env[i] < 0.17) { run++; continue; }
    if (run >= 5 || !cur) { cur = { a: i, peak: 0 }; words.push(cur); }
    cur.peak = Math.max(cur.peak, env[i]); run = 0;
  }
  const real = words.filter((w) => w.peak >= 0.45);
  const pw = real.length > 1 ? real[real.length - 1].a / 30 : 0;
  return { dur: v.dur, we: v.we, env, pw };
}

export function envAt(c, dt) {
  if (!c || dt < 0) return 0;
  const f = dt * 30, i = Math.floor(f);
  if (i >= c.env.length) return 0;
  const a = c.env[i], b = i + 1 < c.env.length ? c.env[i + 1] : 0;
  return a + (b - a) * (f - i);
}

const U = (r, a, b) => a + (b - a) * r();
const damp = (v, target, lambda, h) => v + (target - v) * (1 - Math.exp(-lambda * h));

class Person {
  constructor(sim, id, slot) {
    this.sim = sim; this.id = id; this.slot = slot; this.x = slot.x;
    this.B = beh(sim.ev, id);
    this.voice = PEOPLE[id].voice;
    this.r = mulberry32(hashStr(id + sim.ev.id) ^ sim.seed);
    const r = this.r;
    this.u = r() * 0.85; this.th = 1 + (r() * 2 - 1) * 0.15;
    this.bStart = -9; this.bq = []; this.refr = 0; this.second = false;
    this.gx = (r() - 0.5) * 1.2; this.gy = (r() - 0.5) * 0.4; this.tgx = this.gx; this.tgy = this.gy;
    this.yaw = this.gx * 0.6; this.pitch = this.gy * 0.5;
    this.nextGaze = r() * 1.5;
    this.att = 'relax';
    this.smile = 0.25; this.smileT = 0.25; this.squint = 0; this.drowsy = 0; this.wide = 0;
    this.sleep = this.B.baby ? 1 : 0; this.sleepT = this.sleep; this.maxOpen = 1;
    this.speak = null; this.tear = 0; this.roll = -9; this.grin = null;
    this.turnAt = 0; this.sayAt = 0; this.sayLine = null; this.wordEnd = 0; this.eowAt = 0; this.lookAt = 0; this.reflexAt = 0;
    this.flickAt = 0; this.flickEnd = 0; this.confuse = null; this.wakeAt = 0; this.camAt = 0; this.dozeAt = 0; this.dozeLen = 1.9;
    this.nextTalk = 1 + r() * 2; this.talkI = Math.floor(r() * 5); this.poseTalk = Math.floor(r() * 2);
    this.present = id !== 'you';
    this.run = this.present ? null : { t0: -9, dir: 0 };
    this.p = 0; this.phone = !!this.B.phone; this.pigeon = false;
  }

  get thEff() { return this.th * (this.att === 'pose' ? 1 + this.B.cap * this.sim.E : 1); }
  blinking(t) { return t - this.bStart < blinkLen(this.B.bd); }

  blink(t, force = false) {
    if (this.blinking(t)) return false;
    if (!force && t < this.refr) return false;
    this.bStart = t; this.u = 0; this.th = 1 + (this.r() * 2 - 1) * 0.15;
    this.refr = t + blinkLen(this.B.bd) + 0.4;
    if (this.tear > 0.25) this.roll = t;
    this.tear = 0;
    if (this.B.double) {
      if (!this.second) { this.second = true; this.bq.push(t + 0.34); } else this.second = false;
    }
    return true;
  }

  gazeTo(x, y) {
    const big = Math.hypot(x - this.tgx, y - this.tgy) > 0.5;
    this.tgx = x; this.tgy = y;
    // a big glance often carries a blink with it
    if (big && this.p > 0.5 && !this.B.baby) this.bq.push(this.sim.t + 0.03);
  }

  wander() {
    const r = this.r, s = this.sim;
    const speaker = s.people.find((q) => q !== this && q.present && q.speak && s.t < q.speak.t0 + q.speak.dur && q.speak.cat !== 'pat');
    const roll = r();
    if (this.phone) this.gazeTo(0.06 + r() * 0.1, 0.78);
    else if (this.B.dog) this.gazeTo(roll < 0.5 ? (r() - 0.5) * 0.5 : (r() < 0.5 ? -0.8 : 0.8), roll < 0.5 ? 0.62 : 0.05);
    else if (speaker && roll < 0.55) this.gazeTo(Math.sign(speaker.x - this.x) * (0.62 + r() * 0.3), 0.08);
    else if (roll < 0.3) this.gazeTo((r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.35), r() * 0.2);
    else if (roll < 0.48) this.gazeTo((r() - 0.5) * 0.5, 0.5 + r() * 0.2);
    else if (roll < 0.62) this.gazeTo((r() - 0.5) * 1.2, -0.45 - r() * 0.2);
    else this.gazeTo((r() - 0.5) * 0.3, (r() - 0.5) * 0.25);
    this.nextGaze = s.t + (this.B.kind === 'kid' ? U(r, 0.6, 1.8) : U(r, 0.9, 2.6));
  }

  onCall(t, start, mood) {
    if (!this.present) return null;
    const r = this.r, B = this.B;
    this.turnAt = t + U(r, B.react[0], B.react[1]);
    this.flickAt = 0; this.confuse = null; this.lookAt = 0;
    // everybody stops talking to listen to you, even Toni
    if (this.speak && t < this.speak.t0 + this.speak.dur && this.speak.cat !== 'pat') { this.sim.emit('hush', { who: this.id }); this.speak = null; }
    if (B.baby) { this.wakeAt = start + 0.25; return null; }
    if (!this.voice) return null;
    this.sayLine = `pat_${this.id}_${mood}`;
    const c = this.sim.clips[this.sayLine];
    this.sayAt = start + U(r, B.lag[0], B.lag[1]);
    this.wordEnd = this.sayAt + c.we;
    // the vowels of «pa-ta-ta» pull the lips into a smile, and the last one is held as a grin
    this.grin = { a: this.sayAt + (c.pw > 0.3 ? c.pw : 0), b: this.wordEnd, peak: 0.62 + 0.38 * this.sim.E };
    this.eowAt = this.wordEnd + U(r, 0.03, 0.2);
    if (B.talker) this.nextTalk = this.wordEnd + U(r, 1.5, 2.1);
    if (B.late && c.pw > 0.3) this.confuse = { a: this.sayAt, b: this.sayAt + c.pw - 0.15, side: this.x > 0.5 ? -1 : 1 };
    return this.wordEnd;
  }

  setHold(end, E, mood) {
    if (!this.present) return;
    const r = this.r, B = this.B;
    if (B.baby) {
      const b = mood === 'b';
      // woken by the chorus, the baby looks all around before finding you, then nods off again
      this.camAt = end + U(r, 0.6, 1.2) + (b ? 0.3 : 0); this.dozeAt = this.camAt + (b ? 0.5 : 0.9); this.dozeLen = b ? 1.4 : 1.9; this.maxOpen = b ? 0.8 : 1;
      return;
    }
    this.lookAt = end + B.hold * (0.55 + 0.45 * E) * U(r, 0.85, 1.15);
    if (this.phone) { this.flickAt = this.lookAt - 0.6; this.flickEnd = this.flickAt + 0.16; }
  }

  relax() {
    this.turnAt = 0; this.lookAt = 0; this.flickAt = 0; this.confuse = null; this.wakeAt = 0; this.camAt = 0; this.grin = null;
    if (this.att === 'pose') this.att = 'away';
    this.smileT = 0.2 + this.r() * 0.15;
    this.nextGaze = this.sim.t + 0.15 + this.r() * 0.5;
    if (this.B.baby) { this.dozeAt = this.sim.t + 0.4; this.dozeLen = 1.2; }
  }

  tick(h) {
    const s = this.sim, t = s.t, B = this.B, r = this.r;
    if (!this.present) return;
    if (this.run) {
      const k = (t - this.run.t0) / 1.6;
      if (this.run.dir > 0 && k >= 1) { this.run = null; this.gazeTo(0, 0); }
      else if (this.run && this.run.dir < 0 && k >= 1) { this.present = false; return; }
    }
    // the agenda of this attempt
    if (this.turnAt && t >= this.turnAt) {
      this.turnAt = 0; this.att = 'pose'; this.phone = false;
      this.gazeTo((r() - 0.5) * 0.05, (r() - 0.5) * 0.05);
      this.smileT = B.dog ? 0.6 : 0.3;
    }
    if (this.grin && t >= this.grin.a && this.att === 'pose') {
      const g = this.grin;
      this.smileT = t >= g.b ? g.peak : 0.3 + (g.peak - 0.3) * clamp((t - g.a) / Math.max(0.2, g.b - g.a));
      if (t >= g.b) this.grin = null;
    }
    if (this.sayAt && t >= this.sayAt) { s.say(this, this.sayLine, this.sayAt, 'pat'); this.sayAt = 0; }
    // «¿Eh?»: the grandpa did not hear you and asks his neighbour, then joins in late
    if (this.confuse) {
      if (!this.confuse.on && t >= this.confuse.a) { this.confuse.on = true; this.gazeTo(this.confuse.side * 0.68, 0.06); }
      if (t >= this.confuse.b) { this.confuse = null; if (this.att === 'pose') this.gazeTo(0, 0); }
    }
    if (this.eowAt && t >= this.eowAt) { this.eowAt = 0; if (B.always || this.u >= KAPPA * this.th) this.blink(t, true); }
    if (this.reflexAt && t >= this.reflexAt) { this.reflexAt = 0; this.blink(t, true); }
    if (this.flickAt && t >= this.flickAt && this.att === 'pose') { this.flickAt = 0; this.tgx = 0.05; this.tgy = 0.72; }
    if (this.flickEnd && t >= this.flickEnd) { this.flickEnd = 0; if (this.att === 'pose') { this.tgx = 0; this.tgy = 0; } }
    if (this.lookAt && t >= this.lookAt && this.att === 'pose') {
      this.lookAt = 0; this.att = 'away'; this.smileT = 0.22;
      if (B.phone) this.phone = true;
      this.wander();
    }
    if (B.baby) this.babyTick(t);
    // Toni cannot stop talking: every sentence ends in a blink
    if (B.talker && this.present) {
      const talking = this.speak && t < this.speak.t0 + this.speak.dur;
      const quiet = s.state === 'call' || this.sayAt > 0 || this.turnAt > 0;
      if (!talking && !quiet && t >= this.nextTalk) {
        const posing = this.att === 'pose';
        const line = posing ? (this.poseTalk++ % 2 ? 't4' : 't6') : ['t1', 't2', 't3', 't5', 't4'][this.talkI++ % 5];
        s.say(this, line, t, 'talk');
        const c = s.clips[line];
        if (r() < 0.85) this.bq.push(t + c.we + U(r, 0.05, 0.15));
        this.nextTalk = t + c.dur + U(r, 0.5, 1.1);
      }
    }
    if (this.bq.length) {
      this.bq.sort((a, b) => a - b);
      if (t >= this.bq[0]) { this.bq.shift(); this.blink(t, true); }
    }
    // blink urge: faster in the glare of the flash, the midday sun, or when talking
    const daz = clamp(1 - (t - s.flashT) / 6);
    const sun = s.sunlit(this) ? 1 : 0;
    const talking = this.speak && t < this.speak.t0 + this.speak.dur ? 1 : 0;
    this.u += (h / B.T) * (1 + 0.8 * daz) * (1 + 0.25 * sun) * (1 + 0.3 * talking);
    const th = this.thEff;
    this.p = this.u / th;
    if (!B.baby || this.sleep < 0.5) if (t >= this.refr && this.u >= th) this.blink(t);
    // the eyes go where they are looking, the head follows more slowly
    if (this.att !== 'pose' && !this.run && t >= this.nextGaze && !B.baby) this.wander();
    if (this.pigeonTick(t)) { /* watching the birds */ }
    else if (this.pigeon) { this.pigeon = false; if (this.att === 'pose') this.gazeTo(0, 0); }
    this.gx = damp(this.gx, this.tgx, 32, h); this.gy = damp(this.gy, this.tgy, 32, h);
    this.yaw = damp(this.yaw, this.tgx * 0.62, 7, h); this.pitch = damp(this.pitch, this.tgy * 0.45, 6, h);
    this.smile = damp(this.smile, this.smileT, 5, h);
    const sq = sun ? (this.att === 'pose' ? 1 : 0.72) : 0;
    this.squint = damp(this.squint, sq, sq > this.squint ? 16 : 7, h);
    let dz = 0;
    if (B.drowsy && this.att === 'pose' && s.chorus && t > s.chorus.end + B.drowsy) dz = Math.min(0.9, (t - s.chorus.end - B.drowsy) / 2.4);
    this.drowsy = damp(this.drowsy, dz, dz > this.drowsy ? 3 : 6, h);
    this.wide = damp(this.wide, 0, 2.5, h);
    // tells: watery, then a tear, then a strained brow and a trembling lid
    this.tear = this.p > 0.7 ? Math.max(this.tear, clamp((this.p - 0.7) / 0.3)) : this.tear * Math.exp(-h * 0.5);
  }

  babyTick(t) {
    const s = this.sim;
    if (this.wakeAt && t >= this.wakeAt) {
      this.wakeAt = 0; this.sleepT = 0; this.wide = 1; this.att = 'pose';
      this.bq.push(t + 0.12);
      this.nextGaze = t + 0.3;
    }
    if (this.att === 'pose' && !this.wakeAt && this.sleepT < 1) {
      if (this.camAt && t < this.camAt) {
        // everywhere but at you: the lamp, the ceiling, his mother's earring
        if (t >= this.nextGaze) { const sx = this.r() < 0.5 ? -1 : 1; this.gazeTo(sx * (0.42 + this.r() * 0.4), (this.r() - 0.5) * 0.9); this.nextGaze = t + 0.3 + this.r() * 0.3; }
      } else if (this.camAt) { this.camAt = 0; this.gazeTo(0, 0); }
    }
    if (this.dozeAt && t >= this.dozeAt) this.sleepT = Math.max(this.sleepT, clamp((t - this.dozeAt) / this.dozeLen));
    if (this.sleepT >= 1) { this.dozeAt = 0; this.att = 'relax'; }
    this.sleep = damp(this.sleep, this.sleepT, this.sleepT < this.sleep ? 22 : 9, DT);
  }

  pigeonTick(t) {
    if (!this.B.pigeons || !this.sim.flights) return false;
    const f = this.sim.flights.find((q) => t >= q.start - 0.05 && t <= q.end + 0.3);
    if (!f) return false;
    const fx = f.x0 + (f.x1 - f.x0) * clamp((t - f.start) / (f.end - f.start));
    const want = { x: clamp((fx - this.x) * 2.2, -1, 1), y: -0.55 };
    if (!this.pigeon) this.gazeTo(want.x, want.y); else { this.tgx = want.x; this.tgy = want.y; }
    this.pigeon = true;
    return true;
  }

  aperture(t) {
    const B = this.B;
    const bl = blinkCurve(t - this.bStart, B.bd);
    let a = Math.min(bl, 1 - 0.75 * this.drowsy, 1 - 0.65 * this.squint, 1 - 0.18 * this.smile);
    if (B.baby) a = Math.min(a, 1 - this.sleep, this.maxOpen);
    return clamp(a);
  }

  view(t) {
    const B = this.B, c = this.speak && this.sim.clips[this.speak.id];
    const sp = this.speak && t < this.speak.t0 + this.speak.dur;
    const quiver = clamp((this.p - 0.85) / 0.15);
    return {
      id: this.id, x: this.x, present: this.present,
      run: this.run ? { k: clamp((t - this.run.t0) / 1.6), dir: this.run.dir } : null,
      ap: this.aperture(t), gx: this.gx, gy: this.gy, yaw: this.yaw, pitch: this.pitch,
      smile: this.smile, mouth: sp ? envAt(c, t - this.speak.t0) : 0, talk: sp ? this.speak.id : null, cat: sp ? this.speak.cat : null,
      squint: this.squint, drowsy: this.drowsy, sleep: this.sleep, wide: this.wide,
      tear: this.tear, roll: t - this.roll < 1.1 ? (t - this.roll) / 1.1 : -1,
      gloss: clamp((this.p - 0.55) / 0.3), strain: clamp((this.p - 0.8) / 0.2), quiver, pink: quiver,
      blink: this.blinking(t), att: this.att, p: this.p, phone: this.phone, pigeon: this.pigeon, kind: B.kind,
    };
  }
}

export class Sim {
  constructor(ev, { voices, seed = 1, mode = 'h' } = {}) {
    this.ev = ev; this.mode = mode; this.seed = seed >>> 0;
    this.rng = mulberry32(hashStr(ev.id) ^ this.seed ^ 0x9e3779b9);
    this.clips = {};
    for (const [id, v] of Object.entries(voices)) this.clips[id] = clipInfo(v);
    this.t = 0; this.state = 'relax'; this.stateT = 0;
    this.F = framesFor(ev); this.P = patienceFor(ev);
    this.frames = this.F; this.patience = this.P; this.calls = 0; this.E = 1;
    this.prints = []; this.out = []; this.hist = [];
    this.flashT = -99; this.flashReady = 0; this.chorus = null; this.callT = -99;
    this.timer = null; this.end = null; this.leaveAt = 0; this.endAt = 0; this.reactAt = 0; this.prisa = false;
    const L = layout(ev, mode);
    this.people = ev.cast.map((id) => new Person(this, id, L[id]));
    this.by = Object.fromEntries(this.people.map((p) => [p.id, p]));
    this.chatQ = []; this.nextChat = 1.2 + this.rng() * 1.2;
    this.reacts = [];
    if (ev.sun) this.bands = makeBands(this.rng);
    if (ev.pigeons) this.flights = makeFlights(this.rng);
  }

  emit(k, o = {}) { this.out.push({ k, t: this.t, ...o }); }
  drain() { const o = this.out; this.out = []; return o; }

  say(p, id, t0 = this.t, cat) {
    const c = this.clips[id];
    if (!c) return;
    if (p) p.speak = { id, t0, dur: c.dur, cat };
    this.emit('say', { id, who: p ? p.id : 'you', t0, dur: c.dur, cat, x: p ? p.x : 0.5 });
  }

  speaking(t = this.t, talk = false) { return this.people.some((p) => p.speak && t < p.speak.t0 + p.speak.dur && (talk || p.speak.cat !== 'talk')); }

  sunlit(p) {
    if (!this.bands) return false;
    const x = p.x, t = this.t;
    return !this.bands.some((b) => { const lead = b.lead0 + 0.12 * t; return x <= lead && x >= lead - b.w; });
  }

  shade(t = this.t) { return this.bands ? this.bands.map((b) => { const lead = b.lead0 + 0.12 * t; return [lead - b.w, lead]; }).filter(([a, b]) => b > -0.3 && a < 1.3) : []; }

  flock(t = this.t) {
    if (!this.flights) return null;
    const f = this.flights.find((q) => t >= q.warn && t <= q.end + 0.6);
    if (!f) return null;
    return { warn: t < f.start, k: (t - f.start) / (f.end - f.start), x0: f.x0, x1: f.x1, start: f.start, end: f.end };
  }

  get canShoot() { return !this.ev.timer && ['call', 'chorus', 'pose'].includes(this.state) && this.t >= this.callT + 0.35; }
  get canCall() { return this.state === 'relax' && this.patience > 0 && this.t >= this.flashReady && !this.leaveAt && (!this.ev.timer || (this.timer && !this.timer.called && !this.by.you.run)); }
  get canTimer() { return this.ev.timer && this.state === 'relax' && !this.timer && this.frames > 0 && this.patience > 0 && this.t >= this.flashReady && !this.leaveAt; }

  // the one button: call the family to pose, or take the photo
  act(seen = null) {
    if (this.end) return null;
    if (this.canTimer) { this.startTimer(); return 'timer'; }
    if (this.canCall) { this.call(); return 'call'; }
    if (this.canShoot) { this.shoot(seen); return 'shot'; }
    this.emit('deny', { why: this.state === 'relax' && this.t < this.flashReady ? 'flash' : this.patience <= 0 ? 'patience' : 'busy' });
    return null;
  }

  develop() {
    if (this.end || !this.prints.length) return false;
    this.finish('develop');
    return true;
  }

  startTimer() {
    this.timer = { t0: this.t, fire: this.t + TIMER, called: false, fired: false };
    const you = this.by.you;
    you.present = true; you.run = { t0: this.t, dir: 1 }; you.att = 'relax'; you.tgx = 0.9; you.gx = 0.9;
    this.say(you, 'run', this.t, 'run');
    this.emit('timer', { fire: this.timer.fire });
  }

  call() {
    const t = this.t;
    this.E = 1 - this.calls / this.P;
    this.calls++; this.patience--;
    const mood = this.E >= 0.66 ? 'e' : this.E >= 0.33 ? 'n' : 'b';
    let line;
    if (this.ev.timer) { line = this.timer.fire - t < 3 ? 'call_t' : 'call_n'; this.timer.called = true; }
    else line = this.calls === 1 ? 'call_e' : this.patience === 0 ? 'call_b' : 'call_n';
    const you = this.by.you && this.by.you.present ? this.by.you : null;
    this.say(you, line, t, 'call');
    const start = t + this.clips[line].we + 0.12;
    let end = start + 0.6;
    for (const p of this.people) { const e = p.onCall(t, start, mood); if (e) end = Math.max(end, e); }
    for (const p of this.people) p.setHold(end, this.E, mood);
    this.chorus = { t0: t, start, end, mood, line, n: this.calls };
    this.callT = t; this.state = 'call'; this.stateT = t;
    this.emit('call', { line, mood, start, end, E: this.E });
  }

  relaxAll() { for (const p of this.people) p.relax(); }

  shoot(seen = null) {
    const t = this.t;
    const view = seen || this.view();
    const j = judge(view);
    const print = { i: this.prints.length, t, view, ok: j.ok, culprits: j.culprits, E: this.E, call: this.calls, mood: this.chorus ? this.chorus.mood : 'n', flash: !!this.ev.flash };
    this.prints.push(print);
    this.frames--;
    this.emit('shot', { i: print.i, ok: print.ok, flash: print.flash });
    if (this.ev.flash) {
      this.flashT = t; this.flashReady = t + 2.6;
      for (const p of this.people) if (p.present) p.reflexAt = t + U(p.r, 0.05, 0.15);
    }
    this.relaxAll();
    this.state = 'react'; this.stateT = t; this.reactAt = t + 0.45; this.reactLine = this.pickReact(print);
    if (this.timer) {
      this.timer.fired = true;
      const you = this.by.you;
      you.run = { t0: t + 0.7, dir: -1 };
    }
  }

  pickReact(print) {
    const has = (id) => this.by[id] && this.by[id].present && this.by[id].voice;
    const pacoBlinked = print.culprits.some((c) => c.id === 'paco');
    const opts = [];
    if (pacoBlinked && has('paco')) opts.push('r_paco', 'r_paco');
    if (print.flash && has('abuelo')) opts.push('r_flash');
    if (this.ev.sun && has('papa')) opts.push('r_sol');
    if (this.ev.id === 'plaza') opts.push('r_paella', 'r_movil');
    if (has('toni')) opts.push('r_toni');
    if (has('kiko')) opts.push('r_otra');
    if (has('mari')) opts.push('r_cara');
    opts.push('r_ya', 'r_salido');
    const fresh = opts.filter((o) => !this.reacts.includes(o) && has(LINE_WHO[o]));
    const pool = fresh.length ? fresh : opts.filter((o) => has(LINE_WHO[o]));
    const pick = pool[Math.floor(this.rng() * pool.length)];
    this.reacts.push(pick);
    if (this.reacts.length > 3) this.reacts.shift();
    return pick;
  }

  finish(why) {
    this.end = { why, t: this.t };
    this.state = 'done';
    this.emit('end', { why });
  }

  step(dt) {
    let n = Math.round(dt / DT);
    while (n-- > 0 && !this.end) this.tick(DT);
  }

  stepTo(t) { while (this.t + DT / 2 < t && !this.end) this.tick(DT); }

  tick(h) {
    this.t += h;
    const t = this.t;
    if (this.flights) for (const f of this.flights) {
      if (!f.w && t >= f.warn) { f.w = true; this.emit('coo', { x: f.x0 }); }
      if (!f.s && t >= f.start) { f.s = true; this.emit('flap', { x0: f.x0, x1: f.x1, dur: f.end - f.start }); }
    }
    if (this.timer && !this.timer.fired && t >= this.timer.fire) this.shoot(null);
    switch (this.state) {
      case 'relax':
        if (this.patience <= 0 && !this.leaveAt && !this.timer && !this.speaking()) {
          this.leaveAt = t + 0.3;
        }
        if (this.leaveAt && t >= this.leaveAt && !this.leaveSaid) {
          this.leaveSaid = true;
          const who = this.by.abuela ? 'l_hala' : 'l_basta';
          this.say(this.by[LINE_WHO[who]], who, t, 'leave');
          this.endAt = t + this.clips[who].dur + 0.6;
        }
        if (this.endAt && t >= this.endAt) { this.finish('patience'); return; }
        if (!this.leaveAt) this.chat(t);
        break;
      case 'call':
        if (t >= this.chorus.start) { this.state = 'chorus'; this.emit('chorus', { mood: this.chorus.mood }); }
        break;
      case 'chorus':
        if (t >= this.chorus.end) { this.state = 'pose'; this.emit('pose'); }
        break;
      case 'pose': {
        const n = this.people.filter((p) => p.present && !p.B.baby).length;
        const away = this.people.filter((p) => p.present && p.att === 'away').length;
        if (!this.prisa && this.by.abuela && t > this.chorus.end + 3.2 && !this.speaking()) {
          this.prisa = true; this.say(this.by.abuela, 'c_prisa', t, 'chat');
        }
        if (away * 2 >= n || t > this.chorus.end + 6) {
          this.relaxAll(); this.state = 'relax'; this.stateT = t; this.nextChat = t + 1.2;
          this.emit('relax', { why: 'bored' });
        }
        break;
      }
      case 'react':
        if (this.reactAt && t >= this.reactAt) {
          this.reactAt = 0;
          const line = this.reactLine;
          if (line) this.say(this.by[LINE_WHO[line]], line, t, 'react');
        }
        if (t >= this.stateT + (this.timer ? 2.4 : 1.1)) {
          if (this.timer) this.timer = null;
          if (this.frames <= 0) { if (!this.endAt) this.endAt = t + 0.6; }
          else { this.state = 'relax'; this.stateT = t; this.nextChat = t + 1.6; this.emit('relax', { why: 'shot' }); }
        }
        if (this.endAt && t >= this.endAt) { this.finish('frames'); return; }
        break;
    }
    for (const p of this.people) p.tick(h);
  }

  chat(t) {
    if (t < this.nextChat || this.speaking(t, true)) return;
    if (!this.chatQ.length) {
      this.chatQ = this.ev.chat.filter((id) => this.by[LINE_WHO[id]]);
      for (let i = this.chatQ.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [this.chatQ[i], this.chatQ[j]] = [this.chatQ[j], this.chatQ[i]]; }
    }
    const id = this.chatQ.shift();
    const p = id && this.by[LINE_WHO[id]];
    if (!p || !p.present) { this.nextChat = t + 1; return; }
    this.say(p, id, t, 'chat');
    const c = this.clips[id];
    if (c && this.rng() < 0.6) p.bq.push(t + c.we + U(this.rng, 0.04, 0.14));
    this.nextChat = t + (c ? c.dur : 1) + U(this.rng, 1.8, 3.6);
  }

  view(record = false) {
    const t = this.t;
    const v = {
      t, state: this.state, E: this.E, mood: this.chorus ? this.chorus.mood : null,
      chorus: this.chorus, frames: this.frames, patience: this.patience,
      people: this.people.map((p) => p.view(t)),
    };
    if (record) { this.hist.push(v); if (this.hist.length > 16) this.hist.shift(); }
    return v;
  }

  // what was on screen at sim time ts (the tap came in a little after the frame was drawn)
  seenAt(ts) {
    let best = null;
    for (const v of this.hist) if (v.t <= ts + 1e-6) best = v;
    return best;
  }

  stars() {
    const ok = this.prints.filter((p) => p.ok);
    return [ok.length > 0, ok.some((p) => p.E >= 0.66), this.prints.length === 1 && this.prints[0].ok];
  }
}

export const LINE_WHO = {};
export function setLines(lines) { for (const [id, v] of Object.entries(lines)) LINE_WHO[id] = v.who; }

export function judge(view) {
  const culprits = [];
  for (const p of view.people) {
    if (!p.present || (p.run && p.run.dir > 0)) { culprits.push({ id: p.id, why: 'missing' }); continue; }
    let why = null;
    if (p.ap < OPEN) why = p.sleep > 0.4 ? 'asleep' : p.blink ? 'blink' : p.squint > 0.45 ? 'squint' : p.drowsy > 0.35 ? 'drowsy' : 'blink';
    else if (Math.abs(p.gx) >= LOOK_X || Math.abs(p.gy) >= LOOK_Y) why = p.pigeon ? 'pigeons' : p.phone ? 'phone' : 'look';
    else if (p.talk && p.mouth >= MOUTH) why = p.cat === 'pat' ? 'mouth' : 'talk';
    else if (p.kind !== 'baby' && p.kind !== 'dog' && p.kind !== 'toddler' && p.smile < SMILE) why = 'serious';
    if (why) culprits.push({ id: p.id, why });
  }
  return { ok: culprits.length === 0, culprits };
}

// Cloud shadows drift across the beach: bands a little wider than the family, with sun in between.
function makeBands(r) {
  const out = [];
  let lead = 0.1 - 0.12 * U(r, 3.6, 4.6);
  for (let i = 0; i < 14; i++) {
    const w = U(r, 1.05, 1.35);
    out.push({ lead0: lead, w });
    lead -= w + U(r, 0.55, 0.9);
  }
  return out;
}

// Pigeons on the square: a flutter warns, then the flock takes off and circles for a couple of seconds.
function makeFlights(r) {
  const out = [];
  let t = U(r, 3.5, 5.5);
  for (let i = 0; i < 30; i++) {
    const dir = r() < 0.5 ? -1 : 1;
    const x0 = dir > 0 ? U(r, 0.05, 0.3) : U(r, 0.7, 0.95);
    out.push({ warn: t - 0.8, start: t, end: t + U(r, 2.2, 2.8), x0, x1: x0 + dir * U(r, 0.5, 0.8) });
    t += U(r, 6.5, 10);
  }
  return out;
}
