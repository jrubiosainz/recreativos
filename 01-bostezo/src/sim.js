// Deterministic simulation of a BOSTEZO meeting. No DOM, no rendering: pure rules.
import { mulberry32, hashStr, clamp, angDiff } from './util.js';

export const DT = 1 / 120;
export const Y = { IDLE: 0, TELL: 1, INHALE: 2, PEAK: 3, CLOSE: 4, STIFLE: 5 };
export const SEAT_W = 0.92;
export const ROW_D = 1.12;

export const TUNE = {
  tell: 0.34, inhale: 0.42, peak: 0.95, close: 0.45, stifle: 0.5,
  fill: 1.15, decay: 0.35, refract: 9.0, alert: 8.0,
  playerRefract: 0.55, playerMaxPeak: 3.2, stifleBefore: 0.2,
  react: 0.2, suspect: 0.8, drowsy: 1.7, callout: 2.3,
  warn: 0.9, turn: 0.42, fastTurn: 0.28,
  psstDur: 3.2, psstCd: 1.0, psstRange: 4.6,
  loudRadius: 1.75, snitchDelay: 0.4, snitchCd: 7,
};

const FOV = {
  fwd: { half: (44 * Math.PI) / 180, range: 2.6 },
  L: { half: (42 * Math.PI) / 180, range: 2.1 },
  R: { half: (42 * Math.PI) / 180, range: 2.1 },
  back: { half: (38 * Math.PI) / 180, range: 2.5 },
  person: { half: (26 * Math.PI) / 180, range: 5.2 },
};
const BLIND = new Set(['down', 'up', 'sleep', 'cup', 'phone']);
export const KINDS = { n: 'normal', P: 'player', i: 'intern', f: 'phone', c: 'coffee', s: 'sleeper', p: 'pelota' };
const SURNAMES = ['López', 'García', 'Fernández', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz', 'Díaz', 'Moreno', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Domínguez', 'Gil', 'Vázquez', 'Serrano', 'Ramos', 'Blanco', 'Molina', 'Castro', 'Ortega', 'Rubio', 'Marín', 'Sanz', 'Iglesias', 'Medina', 'Garrido', 'Cortés', 'Castillo', 'Santos', 'Lozano', 'Guerrero', 'Cano', 'Prieto', 'Méndez', 'Cruz', 'Calvo', 'Gallego', 'Vidal', 'León', 'Herrera'];

export class Sim {
  constructor(level, opts = {}) {
    this.level = level;
    this.rng = mulberry32(hashStr(level.id) ^ (opts.seed || 0x5eed));
    this.t = 0;
    this.events = [];
    this.people = [];
    this.player = null;
    this.K = level.K;
    this.target = level.target;
    this.timeLimit = level.time;
    this.strikes = 0;
    this.maxStrikes = 3;
    this.over = null; // 'win' | 'fired' | 'time'
    this.overT = 0;
    this.input = { hold: false };
    this.psstCd = 0;
    this.holdRead = !!opts.holdRead;
    this.holdFace = !!opts.holdFace;
    this.stats = { maxChain: 0, npcYawns: 0, psst: 0, caught: 0, episodes: 0, playerYawns: 0 };
    this.yawningNow = 0;
    this.build();
    this.initBoss();
  }

  emit(type, data = {}) { data.type = type; data.t = this.t; this.events.push(data); }

  // ---------- setup ----------
  build() {
    const L = this.level, rows = L.rows, rng = this.rng;
    const names = SURNAMES.slice();
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    // keep the voiced surnames early so callouts can use recorded lines
    for (const n of ['Fernández', 'García', 'López']) { names.splice(names.indexOf(n), 1); names.unshift(n); }
    let ni = 0;
    rows.forEach((row, r) => {
      const cells = row.split('');
      const n = cells.length;
      cells.forEach((ch, c) => {
        if (ch === '.' || ch === ' ') return;
        const kind = KINDS[ch] || 'normal';
        const p = {
          id: this.people.length, r, c, kind,
          x: (c - (n - 1) / 2) * SEAT_W + (L.stagger && r % 2 ? SEAT_W * 0.5 : 0),
          z: r * ROW_D,
          name: kind === 'player' ? 'Martínez' : names[ni++ % names.length],
          yp: Y.IDLE, yt: 0, peakDur: TUNE.peak * (0.88 + rng() * 0.3), w: 1, loud: false, big: 1,
          meter: 0, expo: 0, blocked: false, sources: [],
          refr: 0, alert: 0, psst: 0, sus: 1,
          gaze: 'fwd', gazeTarget: -1, sched: null, schedLen: 0, schedT: 0,
          sleeping: kind === 'sleeper', sleepT: 0, wakeT: 0,
          cup: kind === 'coffee' ? 1 : 0, sipT: 0, nextSip: 3 + rng() * 3, crashed: false,
          snitchT: 0, snitchCd: 0, handUp: 0,
          seed: rng(), pitch: 0.86 + rng() * 0.3,
          caughtT: -99, lastYawnT: -99, infectedBy: -1, chainDepth: 0,
          holdT: 0,
        };
        if (kind === 'intern') { p.sus = 1.7; p.loud = true; p.peakDur = TUNE.peak * 1.35; }
        if (kind === 'phone') p.sus = 1.0;
        if (kind === 'sleeper') { p.sus = 1.4; }
        if (kind === 'player') this.player = p;
        this.people.push(p);
      });
    });
    const N = this.people.length;
    this.geo = new Array(N * N);
    for (const a of this.people) for (const b of this.people) {
      const dx = b.x - a.x, dz = b.z - a.z;
      this.geo[a.id * N + b.id] = { dist: Math.hypot(dx, dz), ang: Math.atan2(dx, -dz) };
    }
    for (const p of this.people) if (p !== this.player) this.makeSchedule(p);
  }

  makeSchedule(p) {
    const rng = this.rng, segs = [];
    const override = this.level.gaze && this.level.gaze[`${p.r},${p.c}`];
    const side = () => (rng() < 0.5 ? 'L' : 'R');
    if (override) segs.push(...override.map((s) => [s[0], s[1]]));
    else if (p.kind === 'phone') {
      for (let i = 0; i < 3; i++) { segs.push(['phone', 4.2 + rng() * 3]); segs.push([rng() < 0.7 ? 'fwd' : side(), 1.6 + rng() * 1.2]); }
    } else if (p.kind === 'pelota') {
      segs.push(['fwd', 2.6 + rng() * 1.5], ['down', 1.4 + rng()], ['fwd', 2 + rng() * 1.5], [side(), 1.5], ['fwd', 2.2], ['back', 1.4], ['fwd', 2], [side(), 1.4]);
    } else {
      for (let i = 0; i < 4; i++) {
        segs.push(['fwd', 2.4 + rng() * 3.6]);
        const x = rng();
        segs.push([x < 0.52 ? side() : x < 0.7 ? 'down' : x < 0.82 ? 'up' : 'back', 1.1 + rng() * 1.2]);
      }
    }
    p.sched = segs;
    p.schedLen = segs.reduce((s, g) => s + g[1], 0);
    p.schedT = override ? 0 : rng() * p.schedLen;
  }

  initBoss() {
    const B = this.level.boss || {};
    this.boss = {
      phase: 'face', t: 0, dur: B.intro ?? 3.2, pat: B.pattern || [[5, 4]], pi: 0,
      seen: 0, ep: null, notice: 0, drowsyAdd: 0, forced: null,
      side: B.side || 'L', glances: B.glances || null, glanceI: 0, slide: 0, slideLen: 5,
      tension: 0, lastLine: '', calloutIds: [],
    };
  }

  // ---------- helpers ----------
  isYawning(p) { return p.yp === Y.INHALE || p.yp === Y.PEAK; }
  gazeOf(p) {
    if (p === this.player) return p.psstLook > 0 ? 'person' : 'fwd';
    if (p.sleeping) return 'sleep';
    if (p.psst > 0) return 'person';
    if (p.kind === 'coffee' && p.sipT > 0) return 'cup';
    if (p.alert > 0) return 'fwd';
    if (p.yp !== Y.IDLE) return p.gaze; // keep while yawning
    let t = p.schedT % p.schedLen;
    for (const s of p.sched) { if (t < s[1]) return s[0]; t -= s[1]; }
    return 'fwd';
  }
  gazeAngle(p, g) {
    if (g === 'fwd') return 0;
    if (g === 'L') return -1.4;
    if (g === 'R') return 1.4;
    if (g === 'back') return p.x > 0.01 ? -2.7 : 2.7;
    if (g === 'person' && p.gazeTarget >= 0) return this.geo[p.id * this.people.length + p.gazeTarget].ang;
    return 0;
  }
  canSee(v, y) {
    const g = v.gaze;
    if (BLIND.has(g)) return false;
    const geo = this.geo[v.id * this.people.length + y.id];
    const f = FOV[g] || FOV.fwd;
    if (g === 'person' && y.id !== v.gazeTarget) return false;
    if (geo.dist > f.range) return false;
    return Math.abs(angDiff(geo.ang, v.gazeA)) <= f.half;
  }
  dist(a, b) { return this.geo[a.id * this.people.length + b.id].dist; }
  bossWatching() { const b = this.boss; return b.phase === 'face' || b.phase === 'suspect' || b.phase === 'drowsy' || (b.phase === 'glance' && b.t > 0.22 && b.t < b.dur - 0.2); }
  bossSafe() { const ph = this.boss.phase; return ph === 'read' || ph === 'warn' || ph === 'toScr' || ph === 'glanceWarn'; }

  // ---------- player input ----------
  psst(id) {
    if (this.over) return 'over';
    const p = this.people[id], me = this.player;
    if (!p || p === me) return 'self';
    if (this.psstCd > 0) return 'cooldown';
    if (this.dist(me, p) > TUNE.psstRange) return 'far';
    this.psstCd = TUNE.psstCd;
    this.stats.psst++;
    me.psstLook = 0.7; me.gazeTarget = p.id;
    if (p.sleeping) { this.wake(p); this.emit('psst', { id, res: 'wake' }); return 'wake'; }
    if (p.kind === 'pelota') {
      p.psst = 1.2; p.gazeTarget = me.id;
      this.emit('psst', { id, res: 'pelota' });
      if (this.bossSafe()) this.snitch(p, 'psst');
      return 'pelota';
    }
    p.psst = TUNE.psstDur; p.gazeTarget = me.id;
    this.emit('psst', { id, res: 'ok' });
    return 'ok';
  }

  wake(p) {
    p.sleeping = false; p.wakeT = 0.55; p.sleepT = 0; p.meter = 0;
    p.gaze = 'fwd';
    this.emit('wake', { id: p.id });
  }

  snitch(p, why) {
    p.snitchCd = TUNE.snitchCd; p.handUp = 1.6;
    this.emit('snitch', { id: p.id, why });
    const b = this.boss;
    if (b.phase === 'read' || b.phase === 'warn' || b.phase === 'toScr' || b.phase === 'glanceWarn' || b.phase === 'glance') {
      b.forced = { delay: 0.45, why: 'snitch' };
    }
  }

  // ---------- yawns ----------
  startTell(p) {
    p.yp = Y.TELL; p.yt = 0; p.meter = 1;
    this.emit('tell', { id: p.id });
  }
  startYawn(p) {
    p.yp = Y.INHALE; p.yt = 0; p.lastYawnT = this.t;
    if (p !== this.player) this.stats.npcYawns++;
    else this.stats.playerYawns++;
    this.emit('yawn', { id: p.id, big: p.big, loud: p.loud });
  }
  forceYawn(p, delay = 0) {
    if (p.yp !== Y.IDLE || p.sleeping) return;
    p.forceT = delay;
  }

  stepPerson(p, dt) {
    const T = TUNE;
    if (p.psst > 0) p.psst -= dt;
    if (p.psstLook > 0) p.psstLook -= dt;
    if (p.alert > 0) p.alert -= dt;
    if (p.refr > 0) p.refr -= dt;
    if (p.handUp > 0) p.handUp -= dt;
    if (p.snitchCd > 0) p.snitchCd -= dt;
    if (p.sched && p.psst <= 0 && p.yp === Y.IDLE && !p.sleeping) p.schedT += dt;
    if (p.forceT != null) { p.forceT -= dt; if (p.forceT <= 0) { p.forceT = null; if (p.yp === Y.IDLE && !p.sleeping) { p.big = Math.max(p.big, 1); this.startYawn(p); } } }

    // archetype timers
    if (p.kind === 'coffee' && !this.over) {
      if (p.sipT > 0) { p.sipT -= dt; if (p.sipT <= 0) this.emit('sip', { id: p.id }); }
      else if (p.cup > 0 && p.yp === Y.IDLE) {
        p.nextSip -= dt;
        if (p.nextSip <= 0) {
          p.sipT = 1.25; p.nextSip = 5 + this.rng() * 2.5;
          p.cup = Math.max(0, p.cup - 0.26);
          if (p.cup <= 0.001 && !p.crashed) { p.cup = 0; p.crashed = true; p.sus = 2.3; p.w = 1.25; this.emit('coffeeCrash', { id: p.id }); }
        }
      }
    }
    if (p.kind === 'sleeper') {
      if (p.wakeT > 0) {
        p.wakeT -= dt;
        if (p.wakeT <= 0) { p.big = 1.8; p.loud = true; p.peakDur = T.peak * 1.5; this.startYawn(p); this.emit('noise', { id: p.id, why: 'wake' }); }
      } else if (!p.sleeping && p.yp === Y.IDLE && p.refr <= 0 && !this.over) {
        p.sleepT += dt;
        if (p.sleepT > 26) { p.sleeping = true; p.sleepT = 0; p.meter = 0; p.big = 1; p.loud = false; this.emit('fallAsleep', { id: p.id }); }
      }
    }

    // yawn phase machine
    p.yt += dt;
    switch (p.yp) {
      case Y.TELL: if (p.yt >= T.tell) this.startYawn(p); break;
      case Y.INHALE:
        if (p === this.player) {
          if (!this.input.hold && p.yt < T.stifleBefore) { p.yp = Y.STIFLE; p.yt = 0; this.emit('stifle', { id: p.id }); break; }
          if (p.yt >= T.inhale) { p.yp = Y.PEAK; p.yt = 0; this.emit('peak', { id: p.id }); }
        } else if (p.yt >= T.inhale) { p.yp = Y.PEAK; p.yt = 0; this.emit('peak', { id: p.id, loud: p.loud }); if (p.loud) this.emit('noise', { id: p.id, why: 'loud' }); }
        break;
      case Y.PEAK: {
        const done = p === this.player ? (!this.input.hold || p.yt >= T.playerMaxPeak) : p.yt >= p.peakDur;
        if (done) { p.yp = Y.CLOSE; p.yt = 0; this.emit('close', { id: p.id }); }
        break;
      }
      case Y.CLOSE:
        if (p.yt >= T.close) {
          p.yp = Y.IDLE; p.yt = 0; p.meter = 0;
          p.refr = p === this.player ? T.playerRefract : T.refract;
          if (p.kind === 'sleeper') { p.big = 1; p.loud = false; p.peakDur = T.peak; }
          if (p.big > 1 && p.kind !== 'sleeper') p.big = 1;
        }
        break;
      case Y.STIFLE: if (p.yt >= T.stifle) { p.yp = Y.IDLE; p.yt = 0; p.refr = T.playerRefract; } break;
    }
  }

  // ---------- main step ----------
  step(dt = DT) {
    const T = TUNE, P = this.people, me = this.player;
    this.t += dt;
    if (this.psstCd > 0) this.psstCd -= dt;

    // player intent
    if (me && !this.over) {
      if (this.input.hold && me.yp === Y.IDLE && me.refr <= 0) this.startYawn(me);
    }
    for (const p of P) this.stepPerson(p, dt);

    // gaze resolution
    for (const p of P) {
      p.gaze = this.gazeOf(p);
      if (p.gaze !== 'person' && p !== me) p.gazeTarget = p.psst > 0 ? p.gazeTarget : -1;
      p.gazeA = this.gazeAngle(p, p.gaze);
    }

    // contagion
    const yawners = [];
    for (const p of P) if (this.isYawning(p)) yawners.push(p);
    this.yawningNow = yawners.length;
    for (const v of P) {
      v.sources.length = 0; v.blocked = false;
      if (v === me || v.kind === 'pelota' || v.sleeping) { v.expo = 0; continue; }
      let e = 0;
      for (const y of yawners) {
        if (y === v) continue;
        if (this.canSee(v, y)) { e += y.w * (y.big > 1 ? 1.4 : 1); v.sources.push(y.id); }
        else if (y.loud && this.dist(v, y) < T.loudRadius) { e += 0.75 * y.w; v.sources.push(y.id); }
      }
      v.expo = e;
      const immune = v.yp !== Y.IDLE || v.refr > 0 || v.alert > 0 || (v.kind === 'coffee' && v.cup > 0) || v.wakeT > 0;
      if (immune) { if (e > 0 && v.yp === Y.IDLE) v.blocked = true; continue; }
      if (e > 0) {
        v.meter += (e * v.sus * dt) / T.fill;
        if (v.meter >= 1) {
          const src = P[v.sources[0]];
          v.infectedBy = src ? src.id : -1;
          v.chainDepth = src ? src.chainDepth + 1 : 1;
          this.startTell(v);
        }
      } else v.meter = Math.max(0, v.meter - T.decay * dt);
    }
    if (me && me.yp === Y.INHALE && me.yt <= dt * 1.5) me.chainDepth = 0;

    // pelota vigilance
    for (const p of P) {
      if (p.kind !== 'pelota' || p.snitchCd > 0 || this.over) { if (p.kind === 'pelota') p.snitchT = 0; continue; }
      let sees = false;
      for (const y of yawners) if (y !== p && this.canSee(p, y)) { sees = true; break; }
      p.snitchT = sees ? p.snitchT + dt : Math.max(0, p.snitchT - dt * 2);
      if (p.snitchT >= T.snitchDelay) { p.snitchT = 0; if (this.bossSafe() || this.boss.phase === 'glance') this.snitch(p, 'yawn'); else p.snitchCd = 2; }
    }

    // noises make the boss turn around
    for (const e of this.events) if (e.type === 'noise' && e.t === this.t) {
      const b = this.boss;
      if ((this.bossSafe() || b.phase === 'glance') && !b.forced) b.forced = { delay: 0.5, why: e.why };
    }

    this.stepBoss(dt, yawners);

    // clock
    if (!this.over && this.t >= this.timeLimit && this.boss.phase !== 'suspect' && this.boss.phase !== 'callout' && this.boss.phase !== 'drowsy') this.finish('time');
    if (this.over) this.overT += dt;
  }

  // tutorial helper: stop reading now, so the warning (and the turn) start immediately
  forceWarn() {
    const b = this.boss;
    this.holdRead = false;
    if (b.phase !== 'read') return false;
    b.phase = 'warn'; b.t = 0; b.dur = TUNE.warn; this.emit('bossWarn');
    return true;
  }

  nextPattern() {
    const b = this.boss;
    const pr = b.pat[b.pi % b.pat.length];
    b.pi++;
    return pr;
  }

  setBoss(phase, dur) { const b = this.boss; b.phase = phase; b.t = 0; b.dur = dur; }
  // the sleepier the boss, the slower he turns and the longer he drones on
  sleepiness() { return clamp(this.boss.seen / Math.max(1, this.target)); }
  slow(d) { return d * (1 + 0.35 * this.sleepiness()); }

  stepBoss(dt, yawners) {
    const b = this.boss, T = TUNE;
    b.t += dt;
    if (this.over === 'win') { return; }
    if (this.over) return;

    // forced turn (snitch / noise)
    if (b.forced) {
      b.forced.delay -= dt;
      if (b.forced.delay <= 0) {
        const why = b.forced.why; b.forced = null;
        if (this.bossSafe() || b.phase === 'glance') { this.setBoss('toAud', T.fastTurn); b.fastReason = why; this.emit('bossTurn', { to: 'aud', fast: true, why }); }
      }
    }

    switch (b.phase) {
      case 'read':
        if (this.holdRead) { b.t = Math.min(b.t, Math.max(0, b.dur - T.warn - 0.01)); }
        if (b.glances && b.glanceI < b.glances.length) {
          const g = b.glances[b.glanceI];
          if (b.pi === g[0] && b.t >= g[1]) { b.glanceI++; b.resumeT = b.t; b.resumeDur = b.dur; this.setBoss('glanceWarn', 0.55); this.emit('glanceWarn'); break; }
        }
        if (b.t >= b.dur - T.warn) { b.phase = 'warn'; b.t = 0; b.dur = T.warn; this.emit('bossWarn'); }
        break;
      case 'warn':
        if (b.t >= b.dur) { this.setBoss('toAud', this.slow(T.turn)); this.emit('bossTurn', { to: 'aud' }); }
        break;
      case 'glanceWarn':
        if (b.t >= b.dur) { this.setBoss('glance', 1.0); this.emit('glance'); }
        break;
      case 'glance':
        this.watch(dt, yawners);
        if (b.phase === 'glance' && b.t >= b.dur) { b.phase = 'read'; b.t = b.resumeT; b.dur = b.resumeDur; }
        break;
      case 'toAud':
        if (b.t >= b.dur) {
          const pr = b.fastReason ? [0, 2.6] : this.curPair || [0, 4];
          this.setBoss('face', b.fastReason ? 2.6 : pr[1]);
          b.fastReason = null;
          this.emit('bossFace');
        }
        break;
      case 'face':
        this.watch(dt, yawners);
        if (b.phase === 'face' && b.t >= b.dur && !this.holdFace) {
          this.curPair = this.nextPattern();
          this.setBoss('toScr', this.slow(T.turn));
          b.slide++;
          this.emit('bossTurn', { to: 'scr' });
        }
        break;
      case 'toScr':
        if (b.t >= b.dur) { this.setBoss('read', Math.max(T.warn + 0.8, this.curPair[0] * (1 + 0.25 * this.sleepiness()))); this.emit('bossRead', { slide: b.slide }); }
        break;
      case 'suspect': {
        for (const y of yawners) if (!b.ep.members.has(y.id)) b.ep.members.add(y.id);
        if (b.ep.members.size >= this.K) this.resolveEpisode(true);
        else if (b.t >= b.dur) this.resolveEpisode(false);
        break;
      }
      case 'drowsy':
        for (const y of yawners) if (!b.ep.members.has(y.id)) {
          b.ep.members.add(y.id); this.countSeen(y);
        }
        if (this.over) break;
        if (b.t >= b.dur) { this.stats.maxChain = Math.max(this.stats.maxChain, b.ep.members.size); b.ep = null; this.setBoss('face', 1.3); }
        break;
      case 'callout':
        if (b.t >= b.dur) {
          b.ep = null;
          if (this.strikes >= this.maxStrikes) { this.finish('fired'); break; }
          this.setBoss('face', 1.2);
        }
        break;
    }
  }

  watch(dt, yawners) {
    const b = this.boss;
    if (!this.bossWatching()) return;
    const fresh = yawners.filter((y) => !(b.ep && b.ep.members.has(y.id)));
    if (fresh.length) {
      b.notice += dt;
      if (b.notice >= TUNE.react) {
        b.notice = 0;
        b.ep = { members: new Set(yawners.map((y) => y.id)), start: this.t };
        this.stats.episodes++;
        const wasGlance = b.phase === 'glance';
        this.setBoss('suspect', TUNE.suspect);
        b.fromGlance = wasGlance;
        this.emit('suspect');
      }
    } else b.notice = Math.max(0, b.notice - dt);
  }

  countSeen(p) {
    const b = this.boss;
    b.seen++;
    this.emit('seen', { id: p.id, n: b.seen, idx: b.ep ? b.ep.members.size - 1 : 0 });
    if (b.seen >= this.target && !this.over) this.finish('win');
  }

  resolveEpisode(ok) {
    const b = this.boss, ids = [...b.ep.members];
    if (ok) {
      this.setBoss('drowsy', TUNE.drowsy);
      this.emit('infect', { ids, n: ids.length });
      ids.forEach((id) => this.countSeen(this.people[id]));
      this.stats.maxChain = Math.max(this.stats.maxChain, ids.length);
    } else {
      this.setBoss('callout', TUNE.callout);
      b.calloutIds = ids;
      let hitPlayer = false;
      for (const id of ids) {
        const p = this.people[id];
        p.caughtT = this.t;
        if (p === this.player) { hitPlayer = true; this.strikes++; }
        else { p.alert = TUNE.alert; p.meter = 0; }
      }
      this.stats.caught += ids.length;
      this.emit('callout', { ids, player: hitPlayer, strikes: this.strikes });
    }
  }

  finish(kind) {
    if (this.over) return;
    this.over = kind; this.overT = 0;
    const b = this.boss;
    if (kind === 'win') {
      this.setBoss('bossYawn', 99);
      // everybody gives in: a wave of yawns from the front rows to the back
      for (const p of this.people) if (p !== this.player) { p.alert = 0; p.refr = 0; p.psst = 0; if (p.sleeping) continue; p.yp = p.yp === Y.TELL ? Y.IDLE : p.yp; this.forceYawn(p, 1.6 + p.r * 0.16 + p.seed * 0.22); }
    }
    this.input.hold = false;
    this.emit('end', { kind });
  }

  // ---------- queries for rendering / UI ----------
  bossFacingAudience() {
    const b = this.boss;
    switch (b.phase) {
      case 'face': case 'suspect': case 'drowsy': case 'callout': return 1;
      case 'toAud': return clamp(b.t / b.dur);
      case 'toScr': return 1 - clamp(b.t / b.dur);
      default: return 0;
    }
  }
  // 0..1 while reading; reaches 1 exactly when the warning (the tell) starts
  readProgress() {
    const b = this.boss, W = TUNE.warn;
    if (b.phase === 'read') return clamp(b.t / Math.max(0.01, b.dur - W));
    if (b.phase === 'glanceWarn' || b.phase === 'glance') return clamp((b.resumeT || 0) / Math.max(0.01, (b.resumeDur || 1) - W));
    if (b.phase === 'warn') return 1;
    return 0;
  }
  // seconds until the boss faces the audience (Infinity when he is not heading there)
  timeToTurn() {
    const b = this.boss, T = TUNE;
    if (b.phase === 'read') return Math.max(0, b.dur - b.t) + this.slow(T.turn);
    if (b.phase === 'warn') return Math.max(0, b.dur - b.t) + this.slow(T.turn);
    if (b.phase === 'toAud') return Math.max(0, b.dur - b.t);
    return Infinity;
  }
}
