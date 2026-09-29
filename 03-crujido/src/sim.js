// CRUJIDO rules. Deterministic: the same film, the same taps, the same result.
// You make noise only when you tap (bite, chew, unwrap) or when you choke on food you bolted.
// Every noise is checked against every listener: your crunch, attenuated over the distance to
// their ears, against what masks it at their seat (the film plus any local source) and their
// own threshold. Heard crunches annoy; annoyance turns heads, then earns a "¡Chsst!".
import { Film, atten, dist } from './film.js';
import { SNACKS, KINDS } from './snacks.js';

export const JAW = 0.15;            // s: a jaw cannot close again sooner than this
export const SWALLOW = 0.34, FETCH = 0.5, COUGH = 1.3, SOAK_WAIT = 0.5;
// annoyance levels. From calm, a single crunch gets you a glare at most; once they have turned
// to look at you, the next one counts in full.
export const A = { twitch: 4, turn: 10, glare: 18, shush: 26 };
export const GRACE = 1.5;           // s: a chorus of shushes counts as one telling-off
export const USHER = 2.6;           // s: from the third strike to the torch in your face
const DT = 1 / 240;
// gauge ballistics: over the last GAUGE s the reading may exceed what was there by RISE dB/s at most
export const GAUGE = 0.18, GAUGE_N = 6, RISE = 60;

export class Neighbor {
  constructor(p) {
    Object.assign(this, p);
    this.K = KINDS[p.kind] || KINDS.normal;
    this.d = dist(0, 0, p.x, p.z);
    this.a = 0; this.peak = 0; this.lastHeard = -99; this.wary = 0; this.aid = 0;
    this.woke = this.K.sleeps ? null : 0;
    this.shushT = -99; this.heardT = -99; this.shushes = 0;
  }
  // asleep, or out of their seat (the director takes his bow at the premiere)
  listening(t) {
    if (this.away) for (const [a, b] of this.away) if (t >= a && t < b) return false;
    return !this.K.sleeps || (this.woke != null && t >= this.woke);
  }
  // their own noise has stopped: the snorer woke up, or the fan stopped whistling to glare at you
  hush(t) { return (!!this.K.sleeps && this.woke != null && t >= this.woke) || (!!this.K.sulks && this.a >= A.turn); }
  watching(t) { return this.a >= A.glare || t - this.shushT < 2; }
  T(t) { return 2 + this.K.sens - this.aid + (this.wary > 0 || this.watching(t) ? -3 : 0); }
  get mood() { return this.a >= A.glare ? 3 : this.a >= A.turn ? 2 : this.a >= A.twitch ? 1 : 0; }
}

export class Sim {
  // env: the reel's measured loudness (Film.hear); without it the script's curves stand in
  constructor(level, { seed = 1, env = null } = {}) {
    this.L = level; this.seed = seed;
    this.ppl = level.cast.map((p) => new Neighbor(p));
    this.film = new Film(level.script, this.ppl).hear(env);
    this.combo = level.combo.map((id) => SNACKS[id]);
    this.t = 0; this.taps = []; this.pend = [];
    this.piece = 0; this.state = 'ready'; this.stateT = 0; this.i = 0;
    this.soak = 0; this.lastChew = -99; this.choke = 0; this.back = 'ready';
    this.strikes = 0; this.lastStrike = -99; this.shushes = 0; this.usherT = null; this.doneT = null;
    this.events = []; this.crunches = []; this.done = false; this.result = null;
  }
  get snack() { return this.combo[Math.min(this.piece, this.combo.length - 1)]; }
  get over() { return this.done || this.usherT != null || this.doneT != null; }

  // the level of the next noise you would make with a tap now, or null if a tap would do nothing
  next(t = this.t) {
    if (this.over) return null;
    if (this.state === 'ready') return this.snack.pattern[0];
    if (this.state === 'chew') return t - this.lastChew < JAW ? null : this.snack.pattern[this.i] - this.soak;
    return null;
  }
  // the rustle your next tap sets off (the last chew sends your hand into a noisy bag), or 0
  bagAfter() {
    if (this.state !== 'chew' || this.i !== this.snack.pattern.length - 1) return 0;
    return this.combo[this.piece + 1]?.fetch || 0;
  }
  // the loudest noise nobody would notice right now: what the needle shows
  needle(t = this.t) {
    const Fg = this.film.F(t);
    let s = Infinity;
    for (const p of this.ppl) {
      if (!p.listening(t)) continue;
      s = Math.min(s, this.film.maskAtSeat(t, p.x, p.z, Fg) + p.T(t) + atten(p.d));
    }
    return s;
  }
  // the needle as the gauge shows it: it falls with the film at once but only rises for sound
  // that lasts, because a blip is over before anyone could crunch under it
  gauge(t = this.t) {
    let s = this.needle(t);
    for (let k = 1; k <= GAUGE_N; k++) s = Math.min(s, this.needle(t - (k * GAUGE) / GAUGE_N) + (k * GAUGE * RISE) / GAUGE_N);
    return s;
  }
  tap(t = this.t) { if (!this.over) { this.taps.push(Math.max(t, this.t)); this.taps.sort((a, b) => a - b); } }

  step(dt) {
    const end = this.t + dt;
    while (this.t < end - 1e-9 && !this.done) {
      const h = Math.min(DT, end - this.t), t1 = this.t + h;
      while (this.pend.length && this.pend[0].t <= t1) { const e = this.pend.shift(); this.noise(e.t, e.L, e.kind); }
      while (this.taps.length && this.taps[0] <= t1) this.press(this.taps.shift());
      this.tick(t1, h);
      this.t = t1;
    }
  }

  press(t) {
    if (this.over) return;
    const s = this.snack;
    if (this.state === 'ready') {
      this.state = 'chew'; this.stateT = t; this.i = 0; this.soak = 0;
      this.chew(t, s, 'bite');
    } else if (this.state === 'chew') {
      if (t - this.lastChew < JAW) {
        this.choke += 1;
        this.events.push({ t, type: 'bolt', n: this.choke });
        if (this.choke >= 3) this.cough(t);
        return;
      }
      this.chew(t, s, s.wrap ? 'wrap' : 'chew');
    } else this.events.push({ t, type: 'early', state: this.state });
  }
  chew(t, s, kind) {
    const L = s.pattern[this.i] - this.soak;
    this.noise(t, L, s.wrap ? 'wrap' : kind);
    this.i++; this.lastChew = t;
    if (this.i >= s.pattern.length) { this.state = 'swallow'; this.stateT = t; this.events.push({ t, type: 'swallow', piece: this.piece }); }
  }
  cough(t) {
    this.choke = 0; this.back = this.state; this.state = 'cough'; this.stateT = t;
    this.events.push({ t, type: 'cough' });
    [[0, 80], [0.34, 76], [0.7, 71]].forEach(([d, L]) => this.later(t + d, L, 'cough'));
  }
  later(t, L, kind) { this.pend.push({ t, L, kind }); this.pend.sort((a, b) => a.t - b.t); }

  noise(t, L, kind) {
    const Fg = this.film.F(t), heard = [];
    let ex = -Infinity;
    for (const p of this.ppl) {
      const here = L - atten(p.d) - this.film.maskAtSeat(t, p.x, p.z, Fg);
      if (!p.listening(t)) {
        if (p.K.sleeps && p.woke == null && here > 14) { p.woke = t; p.a = A.turn + 2; p.lastHeard = t; heard.push(p.id); this.events.push({ t, type: 'wake', who: p.id }); }
        continue;
      }
      const e = here - p.T(t);
      ex = Math.max(ex, e);
      if (e > 0) { heard.push(p.id); this.hear(p, t, e); }
    }
    const c = { t, L, ex, heard: heard.length > 0, who: heard, kind, piece: this.piece, i: this.i, n: this.snack.pattern.length, soak: this.soak };
    this.crunches.push(c);
    this.events.push({ type: 'noise', ...c });
  }
  hear(p, t, e) {
    const before = p.mood, was = p.a;
    p.a += e * p.K.gain;
    if (was < A.turn) p.a = Math.min(p.a, A.glare + 1);
    p.peak = Math.max(p.peak, p.a); p.lastHeard = t; p.heardT = t;
    if (p.K.aid && before < 2 && p.mood >= 2 && p.aid < 9) { p.aid += 3; this.events.push({ t, type: 'aid', who: p.id, aid: p.aid }); }
    if (p.a >= (p.K.fast ? A.glare + 2 : A.shush)) {
      p.a = A.turn + 4; p.wary = 6; p.shushT = t; p.shushes++; this.shushes++;
      const strike = t - this.lastStrike > GRACE;
      if (strike) { this.strikes++; this.lastStrike = t; }
      this.events.push({ t, type: 'shush', who: p.id, strike, n: this.strikes });
      if (strike && this.strikes >= 3) { this.usherT = t; this.events.push({ t, type: 'usher' }); }
    } else if (p.mood > before) this.events.push({ t, type: 'turn', who: p.id, mood: p.mood });
  }

  tick(t, h) {
    for (const p of this.ppl) {
      if (p.wary > 0) p.wary -= h;
      if (t - p.lastHeard > 1.5 && p.a > 0) p.a = Math.max(0, p.a - 2 * h);
    }
    this.choke = Math.max(0, this.choke - 1.5 * h);
    const s = this.snack;
    if (this.state === 'chew' && s.soak > 0 && t - this.lastChew > SOAK_WAIT) this.soak = Math.min(s.soakMax, this.soak + s.soak * h);
    if (this.state === 'cough' && t - this.stateT >= COUGH) { this.state = this.back; this.stateT = t; }
    if (this.state === 'swallow' && t - this.stateT >= SWALLOW) {
      this.piece++;
      this.events.push({ t, type: 'ate', n: this.piece });
      if (this.piece >= this.combo.length) { this.state = 'full'; this.doneT = t; this.events.push({ t, type: 'full' }); }
      else {
        this.state = 'fetch'; this.stateT = t; this.soak = 0; this.i = 0;
        this.events.push({ t, type: 'fetch', snack: this.snack.id });
        if (this.snack.fetch) this.later(t + 0.12, this.snack.fetch, 'rustle');
      }
    }
    if (this.state === 'fetch' && t - this.stateT >= FETCH) { this.state = 'ready'; this.stateT = t; this.events.push({ t, type: 'ready' }); }
    if (this.usherT != null && t - this.usherT >= USHER) this.finish(t, 'expelled');
    else if (this.doneT != null && t - this.doneT >= 1.4) this.finish(t, 'full');
    else if (t >= this.film.dur && !this.over) this.finish(t, 'hungry');
  }

  finish(t, why) {
    if (this.done) return;
    this.done = true; this.state = why === 'full' ? 'full' : this.state;
    const n = this.crunches.filter((c) => c.kind !== 'cough').length, heard = this.crunches.filter((c) => c.heard).length;
    const pass = why === 'full';
    this.result = {
      why, pass, expelled: why === 'expelled', hungry: why === 'hungry', t,
      ate: this.piece, total: this.combo.length, strikes: this.strikes, shushes: this.shushes,
      noises: n, heard, hidden: n ? (n - this.crunches.filter((c) => c.heard && c.kind !== 'cough').length) / n : 1,
      coughs: this.events.filter((e) => e.type === 'cough').length,
      stars: [pass, pass && this.shushes === 0, pass && heard === 0],
    };
    this.events.push({ t, type: 'end', why });
  }
}
