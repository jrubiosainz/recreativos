// LA OLA: the rules. Deterministic, fixed step (120 Hz). The stadium is a ring of C seat columns
// (index grows clockwise), each a stack of rows of people who all do the same thing a moment apart.
//
// The crowd is an excitable medium (Farkas, Helbing & Vicsek, Nature 2002): a seated fan stands when
// enough people within his reach are up on the side he's looking at, stays up a beat, sits, and then
// won't get up again for a while (tired). So a wave travels at its own speed, dies in a gap wider than
// anyone's reach, dies on a tired crowd, and two waves that meet head-on wipe each other out.
//
// The player runs the big screen. Whoever is in the shot while it's ON AIR notices himself after a
// moment, stands and waves, and looks the way the camera is panning: a moving shot starts a wave that
// way; a still shot makes a block that spills both ways. A risen fan who fills the gap in front of a
// dying wave, where that wave would be by now, keeps its lap count: that's a rescue.
import { clamp, mulberry32, hashStr } from './util.js';

export const DT = 1 / 120;
export const REST = 0, WAIT = 1, UP = 2, TIRED = 3;
export const K = { fan: 0, kid: 1, old: 2, ultra: 3, empty: 4, gap: 5, vip: 6, away: 7, kiss: 8, sleep: 9, bocata: 10 };
export const KIND = Object.keys(K);

export const P = {
  reach: 9,                         // columns a fan watches on each side
  rise: 0.24, up: 0.46, sit: 0.36,  // the stand-up, in seconds
  tref: 2.4,                        // tired after it
  tiredK: 0.25, tiredRef: 0.22,     // per wave already done: fewer of them stand, and they rest longer
  heal: 22,                         // seconds to forget one wave
  notice: [0.24, 0.46], vipNotice: [0.75, 1.05],
  frameW: 10,                       // columns in the shot
  pan: 50, panAcc: 360, aimGain: 9, // pan head: max col/s, accel, how hard it chases the pointer
  dirMin: 5,                        // col/s of pan for the risen to look one way
  onAirMax: 2.4,                    // a fan waves at the big screen this long, then he's done
  airDrain: 1 / 5.5, airFill: 1 / 8, cutT: 2.4,
  v: 20,                            // nominal wave speed (col/s), for the rescue rule
  rescueWin: 14, rescueT: 3.0,
  crit: 25,                         // people who joined on their own: it's a wave
  wakeT: 30,
  warnT: 3,                         // the replay is announced this early
};

// per kind: threshold (in full columns of people up within reach), reaction delay, default fill
const KD = {
  fan:    { thr: 3.0, delay: 0.17, fill: 0.92 },
  kid:    { thr: 2.6, delay: 0.11, fill: 0.86 },
  old:    { thr: 3.4, delay: 0.26, fill: 0.9 },
  ultra:  { thr: 2.2, delay: 0.09, fill: 1 },
  empty:  { thr: 3.0, delay: 0.14, fill: 0.14 },
  gap:    { thr: Infinity, delay: 0, fill: 0 },
  vip:    { thr: Infinity, delay: 0.3, fill: 0.7 },
  away:   { thr: Infinity, delay: 0, fill: 1 },
  kiss:   { thr: Infinity, delay: 0, fill: 0.9 },
  sleep:  { thr: Infinity, delay: 0.3, fill: 0.9 },
  bocata: { thr: 5.2, delay: 0.2, fill: 0.9 },
};
export const kindDef = (k) => KD[KIND[k]];
const NEVER = new Set([K.gap, K.away, K.kiss]);

export const ringDelta = (d, C) => { d %= C; if (d > C / 2) d -= C; else if (d < -C / 2) d += C; return d; };
const wrap = (i, C) => ((i % C) + C) % C;

export class Sim {
  constructor(level, ring) {
    this.level = level;
    const C = (this.C = ring.C);
    this.rows = level.rows;
    this.kind = ring.kind; this.fill = ring.fill;
    this.thr = new Float32Array(C); this.delay = new Float32Array(C);
    this.notice = new Float32Array(C);
    const rnd = mulberry32(hashStr(level.id) ^ 0x9e3779b9);
    for (let i = 0; i < C; i++) {
      const d = kindDef(this.kind[i]), base = this.kind[i] === K.sleep ? KD.fan : d;
      this.thr[i] = base.thr * (1 + (rnd() - 0.5) * 0.12);
      this.delay[i] = d.delay * (1 + (rnd() - 0.5) * 0.3);
      const [a, b] = this.kind[i] === K.vip ? P.vipNotice : P.notice;
      this.notice[i] = a + (b - a) * rnd();
    }
    this.st = new Uint8Array(C); this.t = new Float32Array(C); this.lift = new Float32Array(C);
    this.dir = new Int8Array(C); this.id = new Int32Array(C); this.src = new Uint8Array(C);
    this.tired = new Float32Array(C); this.seen = new Float32Array(C); this.held = new Float32Array(C);
    this.woke = new Float32Array(C); this.once = new Uint8Array(C); this.didT = new Float32Array(C);
    this.upR = new Float32Array(C); this.upL = new Float32Array(C); this.amp = new Float32Array(C);
    this.time = 0; this.lastBoo = -9; this.lastKiss = -9; this.cuts = 0; this.heal = level.heal || P.heal; this.tire = level.tire || 1;
    this.sleepTotal = 0; for (let i = 0; i < C; i++) if (this.kind[i] === K.sleep) this.sleepTotal++;
    this.waves = [null]; this.children = new Map();
    this.cam = { x: level.cam ?? 0, v: 0, onAir: false, block: 0, still: 0 };
    this.air = 1; this.cut = 0; this.lock = 0; this.lockT = 0; this.warn = 0;
    this.input = { aim: null, pan: 0, fast: false, air: false };
    this.ev = []; this.feat = {};
    this.people = 0; this.best = 0; this.bestId = 0;
    this.end = null;
    this.feat.woke = 0;
    this.replays = (level.replays || []).map(([t, d]) => ({ t, d, done: false }));
  }

  // after the whistle the crowd keeps celebrating, but nothing more counts
  emit(k, o = {}) { if (!this.end || k === 'whistle') this.ev.push({ k, ...o }); }
  up(i) { return this.fill[i] * this.lift[i] * this.amp[i]; }
  // how far up the stand-up is, from its clock
  static liftAt(t) {
    if (t < P.rise) { const u = t / P.rise; return u * u * (3 - 2 * u); }
    if (t < P.rise + P.up) return 1;
    const u = clamp((t - P.rise - P.up) / P.sit); return 1 - u * u * (3 - 2 * u);
  }
  framed(i) { return this.cam.onAir && Math.abs(ringDelta(i - this.cam.x, this.C)) <= P.frameW / 2; }

  // ---------- waves ----------
  newWave(dir, i, parent = 0) {
    const w = { id: this.waves.length, dir, pos: i, start: i, t: this.time, tl: this.lockT, t0: this.time, n: 0, dead: -1, deadLock: 0, laps: 0, lapN: 0, self: 0, saves: 0, ola: false, vip: false, palco: false, parent };
    this.waves.push(w);
    return w;
  }
  childOf(pid, dir, i) {
    const key = pid * 4 + (dir + 1);
    let w = this.children.get(key);
    if (!w || w.dead >= 0) { w = this.newWave(dir, i, pid); this.children.set(key, w); }
    return w;
  }
  // a frame-risen fan where a wave going `dir` would be by now joins that wave
  rescue(i, dir, out) {
    let best = null, bd = out ? out.d : Infinity;
    for (let k = 1; k < this.waves.length; k++) {
      const w = this.waves[k];
      if (w.dir !== dir || (w.dead >= 0 && this.deadFor(w) > P.rescueT)) continue;
      const exp = this.ghost(w);
      const d = Math.abs(ringDelta(i - exp, this.C));
      const behind = ringDelta(i - w.pos, this.C) * dir;
      if (d <= P.rescueWin && behind > -P.frameW && d < bd) { bd = d; best = w; }
    }
    if (out && best) { out.d = bd; out.w = best; }
    return best;
  }
  // seconds a wave has been dead, not counting the replays (the stadium holds its breath)
  deadFor(w) { return w.dead < 0 ? 0 : this.time - w.dead - (this.lockT - w.deadLock); }
  // where a wave's front would be by now
  ghost(w) { return w.pos + w.dir * P.v * Math.max(0, this.time - w.t - (this.lockT - w.tl)); }
  advance(w, i) {
    if (!w.dir) return;
    const d = ringDelta(i - w.pos, this.C);
    if (d * w.dir > 0) {
      w.pos += d; w.t = this.time; w.tl = this.lockT;
      w.laps = ((w.pos - w.start) * w.dir) / this.C;
      if (w.laps > this.best && !this.end) { this.best = w.laps; this.bestId = w.id; }
      while (w.laps >= w.lapN + 1) { w.lapN++; this.emit('lap', { id: w.id, n: w.lapN }); }
    }
  }
  riseCol(i, src, dir, w) {
    this.st[i] = UP; this.t[i] = 0; this.src[i] = src; this.dir[i] = dir; this.id[i] = w.id; this.held[i] = 0;
    // tired people half-stand: fewer of them get up, unless they're on the big screen
    this.amp[i] = src ? 1 : 1 / (1 + P.tiredK * this.tired[i]);
    this.didT[i] = this.time;
    w.n++;
    // the screen carried it over something it couldn't cross (or brought it back from the dead)
    if (src === 1 && w.dir && (w.dead >= 0 || ringDelta(i - w.pos, this.C) * w.dir > 2)) {
      const over = this.overKind(w.pos, i, w.dir);
      if (w.dead >= 0 || over !== 'none') {
        w.dead = -1; w.saves++;
        this.emit('rescue', { id: w.id, over, i, laps: w.laps });
        if (over === 'away') this.feat.jump = true;
      }
    }
    w.dead = -1;
    this.advance(w, i);
    const ppl = this.fill[i] * this.amp[i] * this.rows;
    this.people += ppl;
    if (src === 0) {
      w.self += ppl;
      if (!w.ola && w.self >= P.crit && w.dir) { w.ola = true; this.emit('ola', { id: w.id, i }); }
      if (w.vip && !w.palco && this.kind[i] !== K.vip) { w.palco = true; this.feat.palco = true; this.emit('palco', { id: w.id, i }); }
    }
    if (this.kind[i] === K.vip) w.vip = true;
  }
  // what's in the way just ahead of a front
  gapKind(pos, dir) {
    const C = this.C;
    for (let d = 1; d <= P.reach + 2; d++) {
      const k = this.kind[wrap(Math.round(pos) + dir * d, C)];
      const j = wrap(Math.round(pos) + dir * d, C);
      if (k === K.gap || k === K.away || k === K.vip || (k === K.sleep && this.woke[j] <= 0)) return KIND[k];
    }
    return 'none';
  }
  // the most telling thing a rescue jumped over, between the dead front and the new fan
  overKind(from, to, dir) {
    const C = this.C, n = Math.abs(Math.round(ringDelta(to - from, C)));
    let seen = 0;
    for (let d = 1; d < n; d++) {
      const k = this.kind[wrap(Math.round(from) + dir * d, C)];
      if (k === K.away) seen |= 8; else if (k === K.vip) seen |= 4; else if (k === K.sleep) seen |= 2; else if (k === K.gap) seen |= 1;
    }
    return seen & 8 ? 'away' : seen & 4 ? 'vip' : seen & 2 ? 'sleep' : seen & 1 ? 'gap' : 'none';
  }
  dieReason(w) {
    const C = this.C, g = this.gapKind(w.pos, w.dir);
    if (g !== 'none' && g !== 'sleep') return g;
    if (g === 'sleep') return 'sleep';
    for (let d = 1; d <= P.reach; d++) {
      const j = wrap(Math.round(w.pos) + w.dir * d, C);
      if ((this.st[j] === UP || this.st[j] === TIRED) && this.id[j] && this.waves[this.id[j]]?.dir === -w.dir) return 'collide';
    }
    for (let d = 1; d <= P.reach; d++) { const j = wrap(Math.round(w.pos) + w.dir * d, C); if (this.st[j] === TIRED) return 'tired'; }
    return 'weak';
  }

  // ---------- the clock ----------
  tick() {
    this.ev.length = 0;
    if (this.end) { this.time += DT; this.stepCrowd(false); return; }
    const L = this.level, C = this.C;
    this.time += DT;
    // the director takes the big screen for the replay
    this.lock = 0; this.warn = 0;
    for (const r of this.replays) {
      if (this.time >= r.t - P.warnT && this.time < r.t) { this.warn = r.t - this.time; if (!r.warned) { r.warned = true; this.emit('replayWarn', { in: P.warnT }); } }
      if (this.time >= r.t && this.time < r.t + r.d) { this.lock = r.t + r.d - this.time; if (!r.done) { r.done = true; this.emit('replay', { d: r.d }); } }
    }
    if (this.lock) this.lockT += DT;
    this.moveCam();
    const wantAir = this.input.air && !this.lock && this.cut <= 0;
    if (this.cut > 0) { this.cut -= DT; if (this.cut <= 0) this.emit('back'); }
    if (wantAir && !this.cam.onAir) { this.cam.onAir = true; this.cam.block = 0; this.emit('air', { on: true }); }
    else if (!wantAir && this.cam.onAir) { this.cam.onAir = false; this.emit('air', { on: false }); }
    if (this.cam.onAir) {
      this.air -= P.airDrain * DT;
      if (this.air <= 0) { this.air = 0; this.cam.onAir = false; this.cut = P.cutT; this.cuts++; this.emit('cut'); }
    } else this.air = Math.min(1, this.air + P.airFill * DT);
    if (Math.abs(this.cam.v) > P.dirMin) this.cam.block = 0;
    this.stepCrowd(true);
    if (this.time >= L.time) this.finish();
  }

  moveCam() {
    const c = this.cam, inp = this.input, C = this.C;
    let want;
    if (inp.aim != null) want = clamp(ringDelta(inp.aim - c.x, C) * P.aimGain, -P.pan, P.pan);
    else want = inp.pan * P.pan * (inp.fast ? 1 : 0.55);
    const dv = want - c.v, a = P.panAcc * DT;
    c.v += clamp(dv, -a, a);
    c.x = wrap(c.x + c.v * DT, C);
  }

  stepCrowd(live) {
    const C = this.C, R = P.reach, st = this.st, upR = this.upR, upL = this.upL;
    for (let i = 0; i < C; i++) {
      const u = this.fill[i] * this.lift[i] * this.amp[i];
      upR[i] = this.dir[i] >= 0 && st[i] === UP ? u : 0;
      upL[i] = this.dir[i] <= 0 && st[i] === UP ? u : 0;
    }
    const tt = this.time;
    for (let i = 0; i < C; i++) {
      const k = this.kind[i];
      if (this.tired[i] > 0) this.tired[i] = Math.max(0, this.tired[i] - DT / this.heal);
      if (this.woke[i] > 0) this.woke[i] -= DT;
      const s = st[i];
      if (s === UP) {
        const onScreen = live && this.framed(i);
        const holdEnd = P.rise + P.up;
        if (onScreen && this.t[i] >= holdEnd - 1e-6 && this.held[i] < P.onAirMax) { this.held[i] += DT; this.t[i] = holdEnd; }
        else this.t[i] += DT;
        this.lift[i] = Sim.liftAt(this.t[i]);
        if (this.t[i] >= P.rise + P.up + P.sit) {
          st[i] = TIRED; this.t[i] = 0; this.lift[i] = 0;
          this.tired[i] += this.tire;
          const w = this.waves[this.id[i]];
          if (w && --w.n <= 0 && w.dead < 0) { w.dead = tt; w.deadLock = this.lockT; if (w.dir) this.emit('die', { id: w.id, laps: w.laps, why: this.dieReason(w), i: Math.round(wrap(w.pos, C)) }); }
        }
        continue;
      }
      if (s === TIRED) {
        this.t[i] += DT;
        if (this.t[i] >= P.tref * (1 + P.tiredRef * this.tired[i])) { st[i] = REST; this.t[i] = 0; }
        this.seen[i] = 0;
        continue;
      }
      if (s === WAIT) {
        this.t[i] += DT;
        if (this.t[i] >= this.delay[i]) { const w = this.waves[this.id[i]]; this.t[i] = 0; w.n--; this.riseCol(i, 0, this.dir[i], w); }
        continue;
      }
      // REST: first the big screen, then the neighbours
      if (live && this.framed(i)) {
        this.seen[i] += DT;
        if (this.seen[i] >= this.notice[i]) {
          if (k === K.gap) continue;
          if (k === K.away) { if (tt - this.lastBoo > 2.5) { this.lastBoo = tt; this.emit('boo', { i }); } continue; }
          if (k === K.kiss) {
            // the kiss cam, with the wave going over them: that's the clip of the night
            const ola = this.waves.some((w) => w && w.dir && w.dead < 0 && Math.abs(ringDelta(i - w.pos, C)) <= 10);
            if (ola && !this.feat.kiss) { this.feat.kiss = true; this.lastKiss = tt; this.emit('kiss', { i, ola }); }
            else if (tt - this.lastKiss > 3) { this.lastKiss = tt; this.emit('kiss', { i, ola }); }
            continue;
          }
          if (k === K.sleep && this.woke[i] <= 0) {
            // woken by his own face on the screen: up he gets, and he'll stay awake a while
            this.woke[i] = P.wakeT;
            if (!this.once[i]) { this.once[i] = 1; this.feat.woke++; }
            this.emit('wake', { i });
          }
          if (k === K.vip) this.emit('vip', { i });
          this.frameRise(i);
          continue;
        }
      } else this.seen[i] = Math.max(0, this.seen[i] - 2 * DT);
      if (NEVER.has(k) || k === K.vip || (k === K.sleep && this.woke[i] <= 0)) continue;
      let sl = 0, sr = 0;
      for (let d = 1; d <= R; d++) { sl += upR[(i - d + C) % C]; sr += upL[(i + d) % C]; }
      const thr = this.thr[i];
      if (sl + sr >= thr) {
        const fromLeft = sl >= sr, dir = fromLeft ? 1 : -1;
        // the nearest risen neighbour on that side tells which wave this is
        let src = -1;
        for (let d = 1; d <= R; d++) { const j = fromLeft ? (i - d + C) % C : (i + d) % C; if ((fromLeft ? upR[j] : upL[j]) > 0.02) { src = j; break; } }
        let w = src >= 0 ? this.waves[this.id[src]] : null;
        if (!w) continue;
        if (!w.dir) w = this.childOf(w.id, dir, i);
        else if (w.dir !== dir) continue; // a wave only pulls people along its own way
        st[i] = WAIT; this.t[i] = 0; this.dir[i] = dir; this.id[i] = w.id; this.src[i] = 0; w.n++;
      }
    }
  }

  frameRise(i) {
    const c = this.cam, pd = Math.abs(c.v) > P.dirMin ? Math.sign(c.v) : 0;
    // where a wave would be by now, the screen feeds that wave; a still shot helps either way
    const near = { d: Infinity, w: null };
    if (pd) this.rescue(i, pd, near); else { this.rescue(i, 1, near); this.rescue(i, -1, near); }
    let w = near.w;
    if (!w && pd) w = this.newWave(pd, i);
    if (!w) {
      w = c.block ? this.waves[c.block] : null;
      if (!w || w.dead >= 0) { w = this.newWave(0, i); c.block = w.id; }
    }
    if (w.n === 0 && w.dead < 0 && !w.self && !w.saves) this.emit('start', { id: w.id, dir: w.dir, i });
    this.riseCol(i, 1, w.dir, w);
  }

  finish() {
    const L = this.level;
    this.cam.onAir = false;
    const best = this.best, w = this.waves[this.bestId];
    this.end = {
      t: this.time, best, laps: Math.floor(best + 1e-6), goal: L.goal, people: Math.round(this.people * (L.scale || 1)),
      dir: w ? w.dir : 1, saves: w ? w.saves : 0, cuts: this.cuts, feat: { ...this.feat },
      stars: [best >= L.goal, !!featDone(L, this), best >= L.goal + 1],
    };
    this.emit('whistle', this.end);
  }
  stars() { return this.end ? this.end.stars : [false, false, false]; }
}

export function featDone(L, sim) {
  switch (L.feat) {
    case 'clockwise': return sim.waves.some((w) => w && w.dir === 1 && w.laps >= 1);
    case 'wake': return sim.sleepTotal > 0 && sim.feat.woke >= sim.sleepTotal;
    case 'palco': return !!sim.feat.palco;
    case 'jump': return !!sim.feat.jump;
    case 'people': return sim.people * (L.scale || 1) >= (L.featN || 100000);
    case 'nocut': return sim.cuts === 0 && sim.best >= 1;
    case 'kiss': return !!sim.feat.kiss;
    default: return false;
  }
}
