// ¡QUE CIERRAN! on screen: the platform, the train, the queue, the passenger in the doorway and your gloves.
// Reads the sim, never writes to it except through taps. Everything here is presentation.
import { Sim, TUNE } from './sim.js';
import { Cam, CAR_Z, DOOR_W, DOOR_H } from './cam.js';
import { Train, CAR, LINE } from './car.js';
import { Stage } from './platform.js';
import { drawPerson, rig } from './person.js';
import { drawGlove, drawSleeve } from './gloves.js';
import { PaxView, slot, chestZ } from './pax.js';
import { FX, FONT, JP } from './fx.js';
import { TAU, clamp, lerp, smooth, ease, damp, Spring, rgba, mulberry32 } from './util.js';

const HALF = DOOR_W / 2;
const WALL = [{ x: 0.02, z: -0.2 }, { x: -0.31, z: -0.3 }, { x: 0.3, z: -0.38 }, { x: -0.1, z: -0.52 }, { x: 0.24, z: -0.64 }];
const GLASS = [{ x: -0.3, z: CAR_Z - 0.07 }, { x: 0.31, z: CAR_Z - 0.08 }]; // faces pressed on the two door windows
const ARRIVE_X = 26, DEPART_A = 4;
const LEAN = 0.1; // how far he pushes your waiting gloves back at his outer turn (m)
const GLOVE = 0.16; // glove size (m): cartoon-big, they are the star
const OPEN_T = 0.55;
const GYU = { sumo: 'ドスン', mascot: 'ぷるん', kid: 'ちょこん', tourist: 'ぎゅむ', granny: 'よいしょ' };
const GYUS = ['ぎゅっ', 'むぎゅ', 'ぎゅう'];

export class Scene {
  constructor(level, images = {}, opts = {}) {
    this.L = level;
    this.opts = opts;
    this.seed = opts.seed ?? ((Math.random() * 1e9) | 0);
    this.demo = !!opts.demo;
    this.tr = opts.t || ((k) => k);
    this.assist = opts.assist ?? level.id === 's1';
    this.sim = new Sim(level, this.seed);
    this.cam = new Cam();
    this.train = new Train((this.seed % 9973) + 3);
    this.stage = new Stage(level, images[level.bg]);
    this.fx = new FX();
    if (this.demo) this.fx.text = () => null;
    this.cbs = [];
    this.rng = mulberry32((this.seed ^ 0x5bd1e995) >>> 0);
    this.time = 0; this.W = 1; this.H = 1; this.dpr = 1;
    this.frozen = false; this.endT = 0; this.slow = 1;
    // people
    this.views = new Map(); this.cur = null; this.wall = []; this.extras = []; this.nBoard = 0;
    // train, doors, crowd
    this.fillShown = this.sim.fill;
    this.sink = new Spring(0, 70, 5);
    this.rock = new Spring(0, 30, 2.6);
    this.wave = 0; this.doorHit = 0; this.bounce = new Spring(0, 900, 14);
    this.mood = 0; this.moodT = 0; this.lookAt = null; this.lookT = 0;
    this.openAt = null; this.lampOn = false;
    // hands
    this.hand = { act: 'idle', t: 9, q: null, side: 1 };
    this.hands = [-1, 1].map((side) => ({ side, x: side * 0.36, y: 0.5, z: 1.2, rot: 0, pose: 'open', k: 0, sq: 0 }));
    this.anchor = null; this.contact = null;
    this.bowK = 0;
    this.petalT = 0;
    this.rain = level.id === 's3' ? Array.from({ length: 70 }, () => [this.rng(), this.rng(), 0.6 + this.rng() * 0.8]) : null;
    this.syncQueue(true);
  }

  on(cb) { this.cbs.push(cb); return () => { this.cbs = this.cbs.filter((c) => c !== cb); }; }
  emit(type, data = {}) { for (const cb of this.cbs) cb(type, data, this); }
  say(key, fallback) { const s = this.tr(key); return s && s !== key ? s : fallback; }

  layout(W, H, ins = {}, dpr = 1) {
    this.W = W; this.H = H; this.dpr = dpr;
    this.cam.layout(W, H, ins.top || 0, ins.bottom || 0);
    this.safeTop = ins.safeTop || 0;
    this.stage.build(this.cam, dpr);
  }

  tap(at) { this.sim.input(at ?? this.sim.t); }
  // where the doorway's top sits on screen (HUD tokens fly from here)
  doorTop() { const c = this.cam; return { x: c.X(this.trainX(), CAR_Z), y: c.Y(DOOR_H * 0.92, CAR_Z) }; }
  // the doorway of the stopped train on screen (the HUD keeps its captions off it)
  doorRect() { const c = this.cam, x = c.X(0, CAR_Z), h = HALF * c.s(CAR_Z); return { l: x - h, r: x + h, top: c.Y(DOOR_H, CAR_Z) }; }

  // ------------------------------------------------------------------ the queue on the platform
  syncQueue(snap = false) {
    const s = this.sim, n = { '-1': 0, 1: 0 };
    for (let i = s.qi; i < Math.min(s.queue.length, s.qi + 8); i++) {
      const p = s.queue[i];
      let v = this.views.get(p.id);
      const k = n[p.side]++;
      const sl = slot(p.side, k);
      if (!v) {
        v = new PaxView(p);
        this.views.set(p.id, v);
        v.x = sl.x; v.z = sl.z + (snap ? 0 : 0.62);
      }
      v.tx = sl.x; v.tz = sl.z;
      if (snap) { v.x = v.tx; v.z = v.tz; }
    }
  }

  // ------------------------------------------------------------------ time
  update(dt, bot) {
    dt *= this.slow;
    this.time += dt;
    const s = this.sim;
    if (!this.frozen && !s.over) { bot?.update(); s.update(dt); }
    for (const e of s.events) this.handle(e);
    s.events.length = 0;
    if (s.over) this.endT += dt;

    this.fillShown = damp(this.fillShown, s.fill, 7, dt);
    this.sink.step(clamp(s.fill - s.L.fill0, 0, 1.2) * 0.035, dt);
    // the crowd leans into the braking, rocks back when the train stops, sways back as it pulls away
    const lean = s.t < s.T.board ? -0.45 * smooth(s.t / TUNE.arrive) : s.departAt != null ? 0.35 * smooth((s.t - s.departAt) / 0.7) : 0;
    this.rock.step(lean, dt);
    this.bounce.step(0, dt);
    this.wave = Math.max(0, this.wave - dt * 2.2);
    this.doorHit = Math.max(0, this.doorHit - dt * 2.5);
    if (this.moodT > 0) { this.moodT -= dt; if (this.moodT <= 0) this.mood = 0; }
    if (this.lookT > 0) { this.lookT -= dt; if (this.lookT <= 0) this.lookAt = null; }

    const ctx = this.ctx();
    for (const v of this.views.values()) if (v.mode === 'queue') v.update(dt, ctx);
    if (this.cur) this.cur.update(dt, ctx);
    for (const v of this.wall) v.update(dt, ctx);
    for (const v of this.extras) v.update(dt, ctx);
    this.extras = this.extras.filter((v) => !(v.mode === 'leaving' && v.leaveT > 1.6));
    this.arrangeWall(dt);
    this.preparePlatform(ctx);
    this.updateHands(dt);

    const L = this.stage.mood;
    if (L.petals) {
      this.petalT -= dt;
      if (this.petalT <= 0) {
        this.petalT = 0.25 + this.rng() * 0.45;
        const W = this.W, H = this.H;
        this.fx.petal(W * (0.2 + this.rng() * 1.0), -10, { vx: -30 - this.rng() * 40, vy: 25 + this.rng() * 25, size: 4 + this.rng() * 4, dur: 8 });
        if (this.rng() < 0.3) this.fx.petal(W + 10, H * this.rng() * 0.5, { vx: -50, vy: 20, size: 5, dur: 7 });
      }
    }
    this.fx.update(dt);
  }

  ctx() {
    const c = this.sim.cur;
    const press = c && c.state === 'swing' ? clamp((c.u - 0.35) / 0.65) : 0;
    const part = c && (c.state === 'free' || c.state === 'granny') ? Math.sin(clamp(c.u) * Math.PI) : 0;
    return { time: this.time, press: Math.max(press, this.wave * 0.7), part, fill: this.fillShown, closed: this.doorP() > 0.97, mood: this.mood, lookAt: this.lookAt, lean: this.rock.x };
  }

  // ------------------------------------------------------------------ events
  handle(e) {
    const s = this.sim, fx = this.fx, cam = this.cam;
    const A = this.anchor || { x: this.W / 2, y: this.H * 0.5, s: cam.s(0.1) };
    const doorX = cam.X(0, CAR_Z), doorTop = cam.Y(DOOR_H, CAR_Z);
    switch (e.type) {
      case 'open': this.openAt = this.time; break;
      case 'announce': this.lampOn = true; break;
      case 'beckon': {
        const v = this.views.get(e.p.id);
        if (v) {
          v.c = e.p; v.mode = 'active'; v.from = { x: v.x, z: v.z };
          v.turn = !(e.p.type === 'granny' || s.fill < 1);
          v.tx = 0; v.tz = chestZ(v.P, 0);
          this.views.delete(e.p.id);
          this.cur = v;
        }
        this.hand = { act: 'beckon', t: 0, side: e.p.side };
        this.syncQueue();
        break;
      }
      case 'runner': {
        const v = new PaxView(e.p, { x: e.p.side * 1.25, z: 1.6 });
        v.c = e.p; v.mode = 'active'; v.tx = 0; v.tz = chestZ(v.P, 0);
        this.cur = v;
        this.lookAt = e.p.side * 0.8; this.lookT = 1.4;
        fx.text(this.say('fx.wait', '待ってー!'), this.W * (0.5 + e.p.side * 0.28), this.H * 0.86, { size: A.s * 0.16, color: '#ffffff', font: JP, rise: 60, dur: 1.3 });
        break;
      }
      case 'atDoor': if (this.cur) { this.cur.sq.v += 1.2; } break;
      case 'push': this.onPush(e, A); break;
      case 'whiff': this.hand = { act: 'whiff', t: 0 }; break;
      case 'turn': break;
      case 'squeak': {
        this.wave = Math.max(this.wave, clamp(e.e * 0.5, 0.15, 0.9));
        this.sink.v += 0.03 * e.e;
        if (this.cur) this.cur.pinch.v += 2 * clamp(e.e);
        break;
      }
      case 'incident': {
        this.hand = { act: 'bow', t: 0 };
        this.mood = -1; this.moodT = 2.4; this.lookAt = 0; this.lookT = 2.4;
        const v = this.cur;
        if (e.kind === 'granny') {
          v?.say({ eyes: 'dot', mouth: 'open', brow: 1.6, blush: 0.6 }, 1.6, this.time);
          fx.text('まあ!', A.x + A.s * 0.35, A.y - A.s * 0.75, { size: A.s * 0.2, color: '#ffe3ec', font: JP, rise: 40, dur: 1.2 });
        } else {
          fx.burst(A.x, A.y + A.s * 0.1, 26, ['#ffffff', '#fff3e0', '#ff6b8a', '#ffd6de'], { speed: A.s * 1.6, size: A.s * 0.022, gravity: A.s * 3, spread: TAU });
          fx.text('ぐしゃっ', A.x, A.y - A.s * 0.1, { size: A.s * 0.22, color: '#ff6b8a', font: JP, stamp: true, dur: 1.1 });
          fx.shake(5, 0.3);
        }
        fx.text(this.say('fx.sorry', '失礼しました!'), this.W / 2, this.H * 0.3, { size: Math.min(this.W, this.H) * 0.07, color: '#ffffff', font: JP, stamp: true, dur: 1.6, sub: this.say('fx.sorry.sub', 'sorry!') });
        break;
      }
      case 'board': {
        const v = this.cur;
        this.cur = null;
        if (v) {
          // hand over from the doorway pose to the wall exactly where he is, so nothing jumps
          const lp = this.lastPose;
          if (lp) { v.x = lp.x; v.z = lp.zb - 0.05; v.armsFrom = lp.arms; v.blendT = 0; }
          this.toWall(v, !v.turn);
        }
        this.nBoard++;
        this.wave = 1; this.sink.v += e.p.P.fill * 1.4; this.rock.v += (this.nBoard % 2 ? 1 : -1) * 0.25;
        const w = GYU[e.p.type] || GYUS[this.nBoard % GYUS.length];
        fx.text(w, doorX + (this.nBoard % 2 ? 1 : -1) * A.s * 0.55, A.y - A.s * 0.1, { size: A.s * 0.19, color: '#ffffff', font: JP, rise: 30, dur: 0.9 });
        // the car exhales: little clouds squeeze out of both door edges
        for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
          fx.puff(doorX + sd * HALF * cam.s(CAR_Z) * 0.96, cam.Y(0.75 + i * 0.35 + Math.random() * 0.12, CAR_Z), 1, '#ffffff',
            { angle: sd > 0 ? -0.15 : Math.PI + 0.15, spread: 0.7, speed: A.s * (0.7 + Math.random() * 0.4), size: A.s * 0.045, gravity: -30, dur: 0.5 });
        }
        break;
      }
      case 'giveup': {
        this.cur?.say({ eyes: 'dot', mouth: 'wavy', brow: 1.7 }, 2, this.time);
        { const [gy, gr] = this.textY(A.y - A.s * 0.55, A.s * 0.19, 36); fx.text(this.say('fx.giveup', 'もういい!'), A.x, gy, { size: A.s * 0.19, color: '#ffd0c4', font: JP, rise: gr, dur: 1.2 }); }
        this.mood = -1; this.moodT = 1.2;
        break;
      }
      case 'gone': if (this.cur) { this.cur.mode = 'leaving'; this.cur.leaveT = 0; this.cur.x = this.cur.x * 0.2; this.cur.z = chestZ(this.cur.P, -1.4); this.extras.push(this.cur); this.cur = null; } break;
      case 'stall': {
        this.doorHit = 1; this.bounce.v -= 1.4;
        if (this.cur) { this.cur.pinch.v += 7; this.cur.sq.v -= 1.5; this.cur.say({ eyes: 'squeeze', mouth: 'grit', press: 1, sweat: 1, brow: 1 }, 0.55, this.time); }
        fx.text('ガン!', doorX + A.s * 0.42 * (e.n % 2 ? 1 : -1), cam.Y(1.3, CAR_Z), { size: A.s * 0.2, color: '#ff8a7a', font: JP, stamp: true, dur: 0.8 });
        fx.impact(doorX - HALF * cam.s(CAR_Z) * 0.4, cam.Y(1.1, CAR_Z), A.s * 0.14, '#ffffff', { n: 6, spread: Math.PI, angle: -Math.PI / 2 });
        fx.impact(doorX + HALF * cam.s(CAR_Z) * 0.4, cam.Y(1.1, CAR_Z), A.s * 0.14, '#ffffff', { n: 6, spread: Math.PI, angle: -Math.PI / 2 });
        fx.shake(4, 0.25);
        break;
      }
      case 'reopen': break;
      case 'closed': {
        this.lampOn = false;
        this.mood = 1; this.moodT = 1.8;
        this.bounce.v -= 0.9;
        fx.shake(2.5, 0.2);
        break;
      }
      case 'missed': {
        const v = this.cur;
        this.cur = null;
        if (v) { v.mode = 'missed'; v.leaveT = 0; v.x = 0; v.bonk = 1; this.extras.push(v); }
        fx.text('ゴン!', doorX, cam.Y(1.5, CAR_Z), { size: A.s * 0.22, color: '#ffffff', font: JP, stamp: true, dur: 0.9 });
        fx.impact(doorX, cam.Y(1.45, CAR_Z), A.s * 0.2, '#ffe8a8', { n: 10 });
        fx.shake(5, 0.3);
        break;
      }
      case 'point': {
        this.hand = { act: 'point', t: 0 };
        const sz = Math.min(this.W, this.H) * 0.085;
        fx.text('出発進行!', this.W / 2, this.H * 0.26, { size: sz, color: '#ffffff', outline: '#123b35', font: JP, stamp: true, dur: 1.9, rise: 10, weight: 700, sub: this.say('fx.point.sub', 'shuppatsu shinkō!') });
        fx.flash('#ffffff', 0.18);
        break;
      }
      case 'depart': this.rock.v -= 0.9; break;
      case 'end': break;
    }
    this.emit(e.type, e);
  }

  onPush(e, A) {
    const fx = this.fx, q = e.q, v = this.cur;
    this.hand = { act: q === 'bump' ? 'bump' : 'push', t: 0, q };
    if (v) {
      v.dent = 1;
      v.sq.v += q === 'perfect' ? 3.2 : q === 'bump' ? -2 : 2;
      v.lean.v -= q === 'bump' ? -0.8 : 0.5;
      if (q === 'bump') v.say({ eyes: 'squeeze', mouth: 'o', mouthK: 0.5, brow: 1.2 }, 0.45, this.time);
    }
    const x = A.x, y = A.y, s = A.s;
    const big = Math.min(this.W, this.H) * 0.055;
    const [ty, rise] = this.textY(y - s * 0.6, big, q === 'perfect' ? 46 : 36);
    if (q === 'perfect') {
      const combo = e.combo > 1 ? ` ×${e.combo}` : '';
      fx.text(this.say('fx.perfect', 'PERFECT') + combo, x, ty, { size: big, color: '#ffe066', outline: '#3a2410', rise, dur: 0.9 });
      fx.impact(x, y, s * 0.26, '#fff4c2', { n: 10, w: Math.max(2, s * 0.012) });
      fx.ring(x, y, s * 0.12, s * 0.42, '#ffe066', 0.4, Math.max(2, s * 0.014));
      fx.shake(2 + Math.min(4, e.combo * 0.6), 0.16);
    } else if (q === 'good') {
      fx.text(this.say('fx.good', 'GOOD'), x, ty, { size: big * 0.8, color: '#ffffff', rise, dur: 0.8 });
      fx.impact(x, y, s * 0.2, '#ffffff', { n: 7, w: Math.max(2, s * 0.01) });
    } else if (q === 'weak') {
      fx.text(this.say('fx.late', 'LATE'), x, ty, { size: big * 0.7, color: '#b9c6d8', rise: rise * 0.7, dur: 0.8 });
    } else if (q === 'bump') {
      fx.text(this.say('fx.bump', 'BUMP!'), x, ty, { size: big * 0.85, color: '#ff8a7a', outline: '#3a1010', rise: rise * 0.7, dur: 0.9, stamp: true });
      fx.impact(x, y + s * 0.05, s * 0.3, '#ff8a7a', { n: 8, w: Math.max(2, s * 0.014) });
      fx.shake(6, 0.3);
    } else {
      fx.impact(x, y, s * 0.16, '#ffffff', { n: 6, w: Math.max(2, s * 0.01) });
    }
  }

  // keep floating text (and where it rises to) clear of the HUD's top bar
  textY(y, size, rise) {
    const lo = this.safeTop + size * 0.6;
    if (y - rise >= lo) return [y, rise];
    const ny = Math.max(y, lo + Math.min(rise, 14));
    return [ny, Math.max(0, Math.min(rise, ny - lo))];
  }

  toWall(v, walkedIn) {
    v.back = !!walkedIn;
    v.alpha = 1;
    v.toWall(0);
    v.say({ eyes: 'happy', mouth: 'smile', blush: 0.5 }, 1.1, this.time);
    this.wall.unshift(v);
    if (this.wall.length > WALL.length) this.wall.length = WALL.length;
  }

  arrangeWall(dt) {
    const closed = this.doorP() > 0.9 && this.fillShown > 1.15;
    this.wall.forEach((v, i) => {
      const w = closed && i < 2 && !v.back ? GLASS[(i + this.nBoard) % 2] : WALL[i];
      const flip = this.nBoard % 2 ? -1 : 1;
      v.tx = (closed && i < 2 && !v.back ? w.x : w.x * flip); v.tz = w.z;
      v.depthK = clamp(i / (WALL.length - 1));
      v.glass = closed && i < 2 && !v.back;
      if (i === WALL.length - 1) v.alpha = damp(v.alpha, 0.65, 3, dt);
    });
  }

  // ------------------------------------------------------------------ doors and train
  doorP() {
    const s = this.sim;
    if (this.openAt == null) return 1;
    const k = clamp((this.time - this.openAt) / OPEN_T);
    return Math.max(s.doors.p, 1 - ease.outCubic(k));
  }

  trainX() {
    const s = this.sim;
    if (s.t < s.T.board) return ARRIVE_X * Math.pow(1 - clamp(s.t / TUNE.arrive), 2.6);
    if (s.departAt != null) { const d = s.t - s.departAt; return -0.5 * DEPART_A * d * d; }
    return 0;
  }
  trainV() {
    const s = this.sim;
    if (s.t < s.T.board) return -ARRIVE_X * 2.6 * Math.pow(1 - clamp(s.t / TUNE.arrive), 1.6) / TUNE.arrive;
    if (s.departAt != null) return -DEPART_A * (s.t - s.departAt);
    return 0;
  }

  view() {
    const s = this.sim;
    const p = clamp(this.doorP() + (s.doors.st === 'closed' || s.doors.st === 'stall' ? this.bounce.x * 0.02 : 0));
    return {
      x: this.trainX(), t: this.time, fill: this.fillShown, lean: this.rock.x, wave: this.wave, squash: this.wave * 0.4,
      lod: 1, ownFront: true, drawInside: (g) => this.drawWall(g),
      doorP: p, otherP: this.openAt == null ? 1 : clamp(Math.max(s.doors.p, this.doorP())),
      doorHit: this.doorHit, lamp: this.lampOn ? 1 : 0, otherLamp: true, line: LINE,
      sheen: this.trainX() * 0.04 + this.time * 0.01, mood: this.mood, lookAt: this.lookAt,
    };
  }

  // ------------------------------------------------------------------ hands
  predictContact(c, v) {
    const E = this.sim.energy(c), us = c.us;
    const uo = E <= us * us ? -Math.sqrt(E) : us - (E - us * us) / (2 * -us);
    return chestZ(c.P, uo);
  }

  updateHands(dt) {
    const s = this.sim, H = this.hand, c = s.cur, v = this.cur;
    H.t += dt;
    const swing = c && v && c.state === 'swing';
    const r = v ? rig(v.L) : null;
    const chestY = v ? (v.L.outfit === 'mascot' ? 1.1 : r.chest + 0.06) : 1.2;
    const off = v ? (v.P.w || 0.5) * 0.46 : 0.2;
    const shY = v ? (v.L.outfit === 'mascot' ? 1.35 : r.shoulder - 0.04) : 1.3;
    const zNow = v && this.lastPose ? this.lastPose.zb : 0.2;
    const xNow = v && this.lastPose ? this.lastPose.x : 0;
    // hands wait a little inside his outer turn, so he leans back into them for a beat: that beat is the push
    const zReady = swing ? this.predictContact(c, v) - LEAN : 0;
    this.zChest = swing ? zNow : null;
    const bow = H.act === 'bow' ? (H.t < 0.22 ? ease.outCubic(H.t / 0.22) : H.t < 0.95 ? 1 : 1 - ease.inOutCubic(clamp((H.t - 0.95) / 0.35))) : 0;
    this.bowK = bow;
    // bowing tips the view down (the world slides up); a bump jolts it
    this.bobPx = -bow * this.H * 0.07 + (H.act === 'bump' ? Math.exp(-H.t * 12) * Math.sin(H.t * 50) * this.H * 0.006 : 0);
    for (const h of this.hands) {
      const sd = h.side;
      const t = this.time;
      // base: at rest low in the frame, or hovering where his chest will be at his outer turn
      let tx = sd * 0.36, ty = 0.66 + Math.sin(t * 2.1 + sd) * 0.008, tz = 1.2, rot = sd * -0.12, pose = 'open', k = 0, rate = 9;
      let press = 0;
      if (swing) {
        tx = xNow + sd * off; ty = shY; rot = sd * -0.2; rate = 16;
        const lean = Math.max(0, zNow - zReady); // he is leaning on your gloves: that beat is the push
        press = clamp(lean / LEAN);
        tz = Math.min(1.1, zReady + lean);
        rot -= sd * press * 0.28; ty -= press * 0.03;
      }
      else if (v && (c?.state === 'step' || c?.state === 'dash')) { tx = sd * 0.3; ty = 0.9; tz = 0.95; rot = sd * -0.15; }
      let sq = 0;
      if ((H.act === 'push' || H.act === 'whiff') && H.t < 0.3) {
        const th = H.t < 0.04 ? ease.outCubic(H.t / 0.04) : H.t < 0.1 ? 1 : 1 - ease.inOutCubic(clamp((H.t - 0.1) / 0.18));
        const cx = H.act === 'push' ? xNow + sd * off : sd * 0.12, cy = H.act === 'push' ? shY : 1.25, cz = H.act === 'push' ? zNow - 0.02 : CAR_Z + 0.2;
        tx = lerp(tx, cx, th); ty = lerp(ty, cy, th); tz = lerp(tz, cz, th); rot = lerp(rot, sd * -0.05, th);
        sq = H.act === 'push' ? (H.t < 0.12 ? Math.sin(clamp(H.t / 0.12) * Math.PI) : 0) : 0;
        rate = 60;
      } else if (H.act === 'bump') {
        const th = H.t < 0.04 ? ease.outCubic(H.t / 0.04) : 0;
        const kb = H.t < 0.04 ? 0 : Math.exp(-(H.t - 0.04) * 5);
        tx = lerp(tx, xNow + sd * off, th) + sd * 0.05 * kb; ty = lerp(ty, shY, th) - 0.05 * kb;
        tz = lerp(tz, zNow, th) + 0.28 * kb * (1 + 0.3 * Math.sin(H.t * 30)); rot = sd * (-0.2 + 0.5 * kb * Math.sin(H.t * 22));
        sq = H.t < 0.1 ? 0.6 : 0; rate = 45;
      } else if (H.act === 'beckon' && H.t < 0.7 && !swing) {
        if (sd === H.side) {
          const up = ease.outBack(clamp(H.t / 0.16));
          tx = lerp(tx, sd * 0.5, up); ty = lerp(ty, 1.32, up); tz = lerp(tz, 1.0, up);
          rot = sd * lerp(0.1, 1.25, up); pose = 'beckon'; k = 0.5 + 0.5 * Math.sin(H.t * 26);
          if (H.t > 0.55) { const dn = smooth((H.t - 0.55) / 0.15); ty = lerp(ty, 0.66, dn); tx = lerp(tx, sd * 0.36, dn); tz = lerp(tz, 1.2, dn); }
          rate = 30;
        }
      } else if (H.act === 'bow') {
        ty -= bow * 0.55; tz = lerp(tz, 1.35, bow); rot = sd * (-0.12 - bow * 0.4);
      } else if (H.act === 'point' && H.t < 2.2) {
        const up = ease.outBack(clamp(H.t / 0.2), 1.4), dn = smooth((H.t - 1.8) / 0.4);
        // 指差喚呼: arm out, index finger at the departure signal up the line (the train leaves to the left)
        if (sd > 0) { tx = lerp(sd * 0.36, -0.05, up); ty = lerp(0.66, 1.4, up); tz = lerp(1.2, 1.32, up); rot = lerp(-0.12, -1.05, up); pose = 'point'; }
        else { ty = lerp(0.66, 0.5, up); pose = 'fist'; }
        if (dn > 0) { tx = lerp(tx, sd * 0.36, dn); ty = lerp(ty, 0.66, dn); tz = lerp(tz, 1.2, dn); rot = lerp(rot, sd * -0.12, dn); }
        rate = 28;
      }
      h.x = damp(h.x, tx, rate, dt); h.y = damp(h.y, ty, rate, dt);
      // depth follows fast when he pushes into the gloves, so contact never lags
      h.z = tz > h.z ? damp(h.z, Math.min(tz, 1.55), Math.max(rate, 40), dt) : damp(h.z, Math.min(tz, 1.55), rate, dt);
      h.rot = damp(h.rot, rot, rate * 0.8, dt);
      h.press = damp(h.press || 0, press, 30, dt);
      if (v && h.press > 0.05) v.dent = Math.max(v.dent, h.press * 0.6);
      h.pose = pose; h.k = k; h.sq = Math.max(sq, h.press * 0.55);
    }
  }

  // ------------------------------------------------------------------ drawing
  draw(g) {
    const cam = this.cam, W = this.W, H = this.H, s = this.sim;
    const sh = this.fx.offset();
    g.fillStyle = this.stage.bottom || '#8f8a82'; g.fillRect(0, 0, W, H);
    g.save();
    g.translate(sh.x, sh.y + (this.bobPx || 0));
    this.stage.drawBackdrop(g, cam);
    if (this.rain) this.drawRain(g);
    const V = this.view();
    const sinkPx = this.sink.x * cam.S;
    g.save();
    g.translate(0, sinkPx);
    this.train.drawInterior(g, cam, V);
    this.train.drawLeaves(g, cam, V);
    this.train.drawBody(g, cam, V);
    this.train.drawGlass(g, cam, V);
    this.drawBreath(g, V);
    g.restore();
    const spd = Math.abs(this.trainV());
    if (spd > 5) this.drawSpeed(g, spd);
    this.stage.drawFloor(g, cam);
    this.drawPlatformPeople(g);
    this.drawAssist(g);
    this.drawHands(g);
    this.fx.drawWorld(g);
    g.restore();
    this.fx.drawOver(g, W, H);
  }

  drawRain(g) {
    const cam = this.cam, W = this.W, top = 0, bot = cam.Y(0, 0);
    g.strokeStyle = 'rgba(220,232,245,0.32)'; g.lineWidth = 1.2;
    g.beginPath();
    for (const r of this.rain) {
      const sp = r[2];
      const y = top + ((r[1] + this.time * sp * 1.4) % 1) * (bot - top);
      const x = r[0] * (W + 60) - 30 - (y - top) * 0.08;
      const len = 10 + sp * 16;
      g.moveTo(x, y); g.lineTo(x - len * 0.12, y + len);
    }
    g.stroke();
  }

  drawSpeed(g, spd) {
    const cam = this.cam, k = clamp((spd - 5) / 14);
    const y0 = cam.Y(2.9, CAR_Z), y1 = cam.Y(-0.3, CAR_Z);
    const r = mulberry32(((this.time * 30) | 0) + 1);
    g.save();
    g.globalAlpha = 0.5 * k;
    for (let i = 0; i < 26; i++) {
      const y = lerp(y0, y1, r());
      const x = r() * this.W, len = this.W * (0.15 + r() * 0.4) * k;
      g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(40,50,60,0.4)';
      g.lineWidth = 1 + r() * 2.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
    }
    g.restore();
  }

  drawBreath(g, V) {
    // fog on the door glass in front of the faces pressed against it
    if (V.doorP < 0.9) return;
    for (const v of this.wall) {
      if (!v.glass || !v.lastHead) continue;
      const [x, y, s] = v.lastHead;
      const br = 0.5 + 0.5 * Math.sin(this.time * 2.4 + v.ph);
      const gr = g.createRadialGradient(x, y + s * 0.08, 0, x, y + s * 0.08, s * (0.16 + br * 0.05));
      gr.addColorStop(0, `rgba(255,255,255,${0.32 + br * 0.14})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - s * 0.3, y - s * 0.2, s * 0.6, s * 0.6);
    }
  }

  drawWall(g) {
    const ctx = this.ctx(), cam = this.cam, V = this.trainX();
    const list = this.wall.map((v) => [v, v.pose(ctx)]).filter((a) => a[1]);
    list.sort((a, b) => a[1].z - b[1].z);
    for (const [v, P] of list) {
      P.st.x += V;
      const r = drawPerson(g, cam, v.L, P.st);
      v.lastHead = r?.head || null;
      if (v.glass && r?.head && this.doorP() > 0.9) this.pressFace(g, v, r.head);
    }
  }

  // a cheek flattened on the glass: a paler, flat patch where skin meets window
  pressFace(g, v, head) {
    const [x, y, s] = head;
    g.fillStyle = rgba('#ffffff', 0.16);
    g.beginPath(); g.ellipse(x, y + s * 0.03, s * 0.11, s * 0.13, 0, 0, TAU); g.fill();
  }

  // poses for everyone standing on the platform, computed in update so the hands can follow the chest
  preparePlatform(ctx) {
    const cam = this.cam, list = [];
    for (const v of this.views.values()) {
      if (v.mode !== 'queue') continue;
      const P = v.pose(ctx);
      if (!P || P.z >= 1.75) continue;
      // the far end of the queue stands off-screen on most aspect ratios: skip anyone fully outside the frame
      const X = cam.X(P.st.x, P.z), hw = 0.7 * cam.s(P.z);
      if (X + hw < 0 || X - hw > cam.W) continue;
      list.push([v, P]);
    }
    for (const v of this.extras) { const P = v.pose(ctx); if (P) list.push([v, P]); }
    this.lastPose = null;
    if (this.cur) {
      const P = this.cur.pose(ctx);
      if (P) {
        list.push([this.cur, P]);
        const st = P.st, v = this.cur;
        this.lastPose = st;
        const ch = v.L.outfit === 'mascot' ? 1.1 : rig(v.L).chest + 0.04;
        this.anchor = { x: cam.X(st.x, st.zb), y: cam.Y(ch, st.zb), s: cam.s(st.zb) };
      }
    }
    list.sort((a, b) => a[1].z - b[1].z);
    this.platform = list;
  }

  drawPlatformPeople(g) {
    const cam = this.cam;
    for (const [v, P] of this.platform || []) {
      const st = P.st;
      const zf = st.zf, sx = cam.X(st.x, zf), sy = cam.Y(0, zf), ss = cam.s(zf);
      g.fillStyle = `rgba(30,24,40,${0.16 * (st.alpha ?? 1)})`;
      g.beginPath(); g.ellipse(sx, sy, ss * 0.3 * (v.P.w || 0.5) / 0.5, ss * 0.055, 0, 0, TAU); g.fill();
      const cx = cam.X(st.x, st.zb);
      g.save();
      if (P.flip !== 1) { g.translate(cx, 0); g.scale(Math.max(0.06, P.flip), 1); g.translate(-cx, 0); }
      drawPerson(g, cam, v.L, st);
      g.restore();
    }
  }

  // the tutorial's timing aid: a ring closing onto the spot where his chest will meet your gloves
  drawAssist(g) {
    if (!this.assist || this.demo) return;
    const s = this.sim, c = s.cur;
    if (!c || c.state !== 'swing' || !this.lastPose) return;
    const nt = s.nextTurn(c);
    if (!nt || nt.board) return;
    const tt = nt.t - s.t;
    if (tt > 0.75) return;
    const cam = this.cam, z = this.predictContact(c, this.cur);
    const ch = this.cur.L.outfit === 'mascot' ? 1.1 : rig(this.cur.L).chest + 0.06;
    const x = cam.X(this.lastPose.x, z), y = cam.Y(ch, z), r0 = cam.s(z) * 0.2;
    const a = clamp((0.75 - tt) / 0.3);
    const hot = tt < TUNE.win.pe;
    g.lineWidth = Math.max(2, r0 * 0.06);
    g.strokeStyle = rgba(hot ? '#ffe066' : '#ffffff', 0.5 * a);
    g.beginPath(); g.arc(x, y, r0, 0, TAU); g.stroke();
    g.strokeStyle = rgba(hot ? '#ffe066' : '#ffffff', 0.9 * a);
    g.lineWidth = Math.max(2, r0 * 0.05);
    g.beginPath(); g.arc(x, y, r0 * (1 + tt * 2.6), 0, TAU); g.stroke();
  }

  drawHands(g) {
    const cam = this.cam, W = this.W, H = this.H;
    const unit = Math.min(W, H * 1.2);
    const pts = this.hands.map((h) => {
      const z = h.z;
      const x = cam.X(h.x, z), y = cam.Y(h.y, z), s = cam.s(z) * GLOVE;
      return { h, x, y, s };
    });
    // the gloves' shadows on his jacket slide up under them as he closes the gap: contact reads at a glance
    if (this.zChest != null && this.lastPose) {
      const zc = this.zChest;
      for (const { h } of pts) {
        const gap = Math.max(0, h.z - zc);
        const a = 0.3 * clamp(1 - gap / 0.5);
        if (a < 0.01) continue;
        const sx = cam.X(h.x + h.side * gap * 0.12, zc), sy = cam.Y(h.y - 0.02 - gap * 0.6, zc), r = cam.s(zc) * GLOVE * (0.95 + gap * 0.8);
        const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r);
        gr.addColorStop(0, `rgba(20,16,36,${a})`); gr.addColorStop(0.55, `rgba(20,16,36,${a * 0.6})`); gr.addColorStop(1, 'rgba(20,16,36,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(sx, sy, r, r * 0.8, 0, 0, TAU); g.fill();
      }
    }
    const arms = this.opts.arms || 'slim';
    if (arms !== 'float') for (const p of pts) {
      const { h, x, y, s } = p;
      const wx = x - Math.sin(h.rot) * s * 0.8, wy = y + Math.cos(h.rot) * s * 0.8;
      const sx = W / 2 + h.side * unit * (arms === 'wide' ? 0.5 : 0.36), sy = H + unit * 0.1;
      drawSleeve(g, sx, sy, wx, wy, unit * (this.cam.port ? 0.1 : arms === 'wide' ? 0.16 : 0.13), s * 0.95, h.side, 0.08 + (h.press || 0) * 0.07);
    }
    for (const p of pts) {
      const { h, x, y, s } = p;
      g.save();
      if (h.sq > 0) { g.translate(x, y); g.scale(1 + h.sq * 0.08, 1 - h.sq * 0.1); g.translate(-x, -y); }
      drawGlove(g, x, y, s, h.rot, h.side, h.pose, h.k);
      g.restore();
    }
  }
}
