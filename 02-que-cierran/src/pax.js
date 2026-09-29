// How a passenger looks at any moment: queueing, stepping over and turning round, bouncing in the doorway,
// squashed inside, stomping off. Reads the sim record, keeps its own springs for overlapping motion.
import { TYPES } from './types.js';
import { makeLook } from './look.js';
import { CAR_Z, DOOR_W } from './cam.js';
import { TAU, clamp, lerp, smooth, damp, Spring, mulberry32 } from './util.js';

const HALF = DOOR_W / 2;
export const LANE_X = HALF + 0.42;
// the queue: first in line right by the door, the rest drifting out and back toward the edges of the view
export const slot = (side, i) => ({ x: side * (LANE_X - 0.07 + i * 0.5), z: 0.18 + i * 0.52 });
const HANG = { a: 0.14, b: 0.05 };

// where his chest is for a given bounce: in past the door line at u = 1, sticking out by his depth at u = 0,
// and leaning out toward the pusher (softly saturating) on the rebound
export function chestZ(P, u) {
  const d = P.depth ?? 0.3;
  if (u >= 0) return CAR_Z + 0.03 + 0.6 * d * (1 - u);
  return CAR_Z + 0.03 + 0.6 * d + 1.2 * Math.tanh(-u) * (0.8 + 0.4 * d);
}
export const restZ = (P) => chestZ(P, 0);

const BASE_FACE = {
  salary: { eyes: 'dot', mouth: 'flat' }, office: { eyes: 'dot', mouth: 'flat' }, student: { eyes: 'dot', mouth: 'cat' },
  tourist: { eyes: 'dot', mouth: 'grin' }, sumo: { eyes: 'dot', mouth: 'flat', brow: 0.5 }, granny: { eyes: 'happy', mouth: 'smile' },
  cake: { eyes: 'dot', mouth: 'wavy', browUp: 0.6 }, sleepy: { eyes: 'half', mouth: 'o', mouthK: 0.5 }, runner: { eyes: 'dot', mouth: 'grit', sweat: 1 },
  mascot: { eyes: 'dot', mouth: 'cat' }, kid: { eyes: 'dot', mouth: 'grin' },
};

function braceArms(type, t, ph) {
  const w = Math.sin(t * 1.7 + ph) * 0.05;
  switch (type) {
    case 'cake': return [{ a: 0.3, b: -1.85 }, { a: 0.3, b: -1.85 }];
    case 'sumo': return [{ a: 1.3 + w, b: 0.3 }, { a: 1.3 - w, b: 0.3 }];
    case 'mascot': return [{ a: 1.9 + w }, { a: 1.9 - w }];
    case 'kid': return [{ a: 2.5 + w, b: -0.2 }, HANG];
    case 'sleepy': return [HANG, { a: 0.2 + w, b: 0.1 }];
    case 'tourist': return [{ a: 2.45 + w, b: 0.3 }, { a: 0.12, b: -2.7 }];
    case 'student': return [{ a: 2.5 + w, b: 0.3 }, { a: 0.3, b: -2.2 }];
    default: return [{ a: 2.55 + w, b: 0.35 }, { a: 0.16 + w * 0.5, b: 0.08 }];
  }
}
function flailArms(type, t, k) {
  if (type === 'cake') return [{ a: 0.9, b: -2.1 }, { a: 0.9, b: -2.1 }]; // the cake goes up, out of harm's way
  // windmilling for balance as he tips out of the doorway
  const a = Math.sin(t * 13) * 0.45 * k, b = Math.cos(t * 13) * 0.3 * k;
  return [{ a: lerp(2.55, 1.7, k) + a, b: 0.3 + b }, { a: lerp(0.3, 1.5, k) - a, b: 0.3 - b }];
}
function squeezedArms(type) {
  if (type === 'cake') return [{ a: 0.5, b: -2.0 }, { a: 0.5, b: -2.0 }];
  if (type === 'sumo' || type === 'mascot') return [{ a: 2.2, b: 0.2 }, { a: 2.2, b: 0.2 }];
  return [{ a: 2.85, b: 0.25 }, { a: 2.75, b: 0.2 }];
}
const walkArms = (t, k) => [{ a: 0.18 + Math.sin(t * 6.5) * 0.35 * k, b: 0.15 }, { a: 0.18 - Math.sin(t * 6.5) * 0.35 * k, b: 0.15 }];

export class PaxView {
  constructor(p, opts = {}) {
    this.id = p.id; this.type = p.type; this.side = p.side || 1;
    this.P = TYPES[p.type];
    this.L = opts.look || makeLook(p.type, p.look);
    this.c = null; // the sim record once he is called
    this.mode = opts.mode || 'queue'; // queue | active | wall | leaving | missed
    const s0 = slot(this.side, 3);
    this.x = opts.x ?? s0.x; this.z = opts.z ?? s0.z + 0.6;
    this.tx = this.x; this.tz = this.z;
    const r = mulberry32((p.look || p.id * 977) >>> 0);
    this.ph = r() * TAU; this.t = r() * 10;
    this.walkT = 0;
    this.sq = new Spring(0, 320, 12);
    this.pinch = new Spring(0, 240, 9);
    this.lean = new Spring(0, 90, 9);
    this.dent = 0;
    this.hold = null; // { face, until, arms? }
    this.alpha = opts.alpha ?? 1;
    this.back = !!opts.back; // stands inside facing away (walked in on his own)
    this.turn = true; // backs in (pushed) rather than walking in
    this.from = null; // where he stood when he was called
    this.leaveT = 0;
    this.wallZ = 0; this.wallSq = 0;
    this.ruin = 0;
    this.bonk = 0;
  }

  say(face, dur, t) { this.hold = { face, until: t + dur }; }

  // joins the wall of commuters just inside the door, facing out (backed in) or in (walked in)
  toWall(k = 0) {
    this.mode = 'wall'; this.depthK = k;
    const up = { a: 2.7, b: 0.25 }, hold = { a: 2.95, b: 0.1 };
    this.wallArms = this.type === 'cake' ? [{ a: 0.5, b: -2.0 }, { a: 0.5, b: -2.0 }]
      : this.type === 'kid' ? [{ a: 2.4, b: -0.3 }, HANG]
      : this.id % 3 === 0 ? [hold, HANG] : this.id % 3 === 1 ? [HANG, up] : [up, hold];
  }

  update(dt, ctx) {
    this.t += dt;
    this.sq.step(0, dt); this.pinch.step(0, dt); this.lean.step(0, dt);
    this.dent = Math.max(0, this.dent - dt * 5);
    if (this.blendT != null && this.blendT < 1) this.blendT = Math.min(1, this.blendT + dt * 5);
    if (this.hold && ctx.time > this.hold.until) this.hold = null;
    const k = 1 - Math.exp(-dt * (this.mode === 'queue' ? 5 : 9));
    this.x += (this.tx - this.x) * k; this.z += (this.tz - this.z) * k;
    if (this.mode === 'queue') {
      const moving = Math.abs(this.tz - this.z) > 0.02 || Math.abs(this.tx - this.x) > 0.02;
      this.walkT = moving ? this.walkT + dt : 0;
    }
    if (this.c?.ruined) this.ruin = Math.min(1, this.ruin + dt * 6);
    if (this.mode === 'leaving') { this.leaveT += dt; if (this.leaveT > 0.25) this.walkT += dt; }
    if (this.mode === 'missed') this.leaveT += dt;
    if (this.bonk > 0) this.bonk = Math.max(0, this.bonk - dt * 1.6);
  }

  face(base, ctx) {
    if (this.hold) return this.hold.face;
    return base;
  }

  // everything drawPerson needs, plus a depth to sort by and an optional horizontal flip (turning round)
  pose(ctx) {
    const P = this.P, L = this.L, t = this.t;
    const base = BASE_FACE[this.type] || BASE_FACE.salary;
    const st = { x: this.x, t, lod: 1, alpha: this.alpha };
    let flip = 1;
    if (this.mode === 'queue') {
      Object.assign(st, { view: 'back', zf: this.z, zb: this.z, zh: this.z, arms: this.walkT > 0 ? walkArms(t, 0.6) : [HANG, HANG], run: this.walkT > 0 ? 0.4 : 0, sway: Math.sin(t * 1.3 + this.ph) * 0.01 });
      return { st, z: this.z, flip };
    }
    if (this.mode === 'wall') return this.wallPose(ctx, st, base);
    if (this.mode === 'leaving') {
      // turned his back on us and on the train: off along the platform
      const k = clamp(this.leaveT / 1.4);
      const x = this.x + this.side * smooth(k) * 2.8, z = this.z + 0.2 * k;
      Object.assign(st, { x, view: this.leaveT > 0.25 ? 'back' : undefined, zf: z, zb: z, zh: z, run: 0.5, t: this.walkT, arms: walkArms(this.walkT, 0.8), alpha: this.alpha * (1 - smooth((k - 0.7) / 0.3)), face: { eyes: 'dot', mouth: 'wavy', brow: 1.6 } });
      if (this.leaveT < 0.25) flip = Math.abs(Math.cos(Math.PI * this.leaveT / 0.25));
      return { st, z, flip };
    }
    if (this.mode === 'missed') {
      // ran into the closed door; now stands there facing it, deflated
      const k = clamp(this.leaveT / 0.5);
      const z = lerp(CAR_Z + 0.16, CAR_Z + 0.34, smooth(k));
      Object.assign(st, { view: 'back', zf: z, zb: z - 0.02 * (1 - k), zh: z + 0.03 * k, sq: this.bonk * 0.12, nod: 0.08 * k, arms: [HANG, HANG], tilt: Math.sin(this.leaveT * 2) * 0.03 * k });
      return { st, z, flip };
    }
    const c = this.c;
    if (!c) return null;
    const state = c.state;
    if (state === 'step' || state === 'dash') return this.stepPose(ctx, st, base, c);
    if (state === 'free' || state === 'granny') {
      // walks in by himself, back to us; the crowd shuffles aside
      const u = c.u;
      const z0 = CAR_Z + 0.2, z1 = CAR_Z - 0.4;
      const z = lerp(z0, z1, u);
      Object.assign(st, { x: this.x * (1 - u), view: 'back', zf: z, zb: z, zh: z, run: state === 'granny' ? 0.25 : 0.45, t: t * (state === 'granny' ? 0.5 : 1), arms: state === 'granny' ? [{ a: 0.35, b: 0.4 }, { a: 0.4, b: 0.6 }] : walkArms(t, 0.5) });
      if (this.hold) { st.view = undefined; st.face = this.hold.face; }
      return { st, z, flip };
    }
    if (state === 'giveup') {
      const zc = chestZ(P, Math.max(c.u, -2));
      Object.assign(st, { x: this.x, zf: zc - 0.05, zb: zc, zh: zc - 0.02, arms: [HANG, { a: 0.5, b: -1.2 }], face: { eyes: 'dot', mouth: 'wavy', brow: 1.6, look: -this.side }, lod: 2 });
      return { st, z: zc, flip };
    }
    return this.swingPose(ctx, st, base, c);
  }

  stepPose(ctx, st, base, c) {
    const P = this.P, t = this.t;
    const k = clamp(c.st / P.step);
    const from = this.from || slot(this.side, 0);
    const front = { x: 0, z: CAR_Z + 0.42 };
    const rz = restZ(P);
    const dash = c.state === 'dash';
    if (dash) {
      // sprints in from behind the pusher, back to us, shrinking into the doorway
      // enters from the edge of the frame at full sprint and brakes into the doorway
      const kk = 1 - Math.pow(1 - clamp(k / 0.82), 2.2);
      const x = lerp(this.side * 1.25, 0, kk), z = lerp(1.55, front.z, kk);
      if (k < 0.82) {
        Object.assign(st, { x, view: 'back', zf: z, zb: z - 0.04, zh: z - 0.06, run: 1, t: t * 1.5, arms: [{ a: 0.9 + Math.sin(t * 20) * 0.6, b: -1.2 }, { a: 0.9 - Math.sin(t * 20) * 0.6, b: -1.2 }], lod: 1, bagSwing: Math.sin(t * 20) * 0.5 });
        return { st, z, flip: 1 };
      }
      const q = (k - 0.82) / 0.18;
      const zz = lerp(front.z, rz, smooth(q));
      Object.assign(st, { x: 0, view: q < 0.5 ? 'back' : undefined, zf: zz, zb: zz + 0.02, zh: zz, arms: braceArms(this.type, t, this.ph), face: { eyes: 'wide', mouth: 'grit', sweat: 1 }, lod: 2 });
      return { st, z: zz, flip: Math.abs(Math.cos(Math.PI * q)) };
    }
    if (!this.turn) {
      // no turning round: sidestep in front of the door, then straight in
      const kk = smooth(k);
      const x = lerp(from.x, 0, kk), z = lerp(from.z, CAR_Z + 0.2, kk);
      Object.assign(st, { x, view: 'back', zf: z, zb: z, zh: z, run: 0.45, arms: walkArms(t, 0.6) });
      if (this.type === 'granny') { st.run = 0.25; st.t = t * 0.5; st.arms = [{ a: 0.35, b: 0.4 }, { a: 0.4, b: 0.6 }]; }
      return { st, z, flip: 1 };
    }
    if (k < 0.5) {
      const kk = smooth(k / 0.5);
      const x = lerp(from.x, front.x, kk), z = lerp(from.z, front.z, kk);
      Object.assign(st, { x, view: 'back', zf: z, zb: z, zh: z, run: 0.45, arms: walkArms(t, 0.6), sway: Math.sin(t * 6.5) * 0.02 });
      return { st, z, flip: 1 };
    }
    if (k < 0.7) {
      // turning round: a little hop, a flip hidden in the squash
      const q = (k - 0.5) / 0.2;
      const hop = Math.sin(q * Math.PI) * 0.04;
      Object.assign(st, { x: front.x, view: q < 0.5 ? 'back' : undefined, zf: front.z, zb: front.z, zh: front.z, sq: -hop, arms: [HANG, HANG], face: { ...base }, lod: 2 });
      return { st, z: front.z, flip: Math.max(0.08, Math.abs(Math.cos(Math.PI * q))) };
    }
    // backing into the doorway, reaching up for the frame
    const q = smooth((k - 0.7) / 0.3);
    const z = lerp(front.z, rz, q);
    const reach = braceArms(this.type, this.t, this.ph);
    Object.assign(st, { x: 0, zf: lerp(front.z, rz - 0.02, q), zb: z + 0.02 * (1 - q), zh: z, arms: reach.map((a) => ({ a: lerp(0.3, a.a, q), b: lerp(0.1, a.b ?? 0, q) })), face: { ...base, look: 0 }, lod: 2 });
    return { st, z, flip: 1 };
  }

  swingPose(ctx, st, base, c) {
    const P = this.P, t = this.t, L = this.L;
    const u = c.u, om = c.om || 6, vn = c.v / om; // normalised velocity (amplitude units)
    const zc = chestZ(P, u);
    const zf0 = CAR_Z + 0.06 + 0.45 * (P.depth ?? 0.3);
    const inK = smooth((u - 0.5) / 0.5);
    const out = u < 0 ? clamp(-u / Math.max(0.3, -(c.us ?? -0.6))) : 0;
    const zf = lerp(zf0 + (u < 0 ? 0.4 * (zc - chestZ(P, 0)) : 0), CAR_Z - 0.08, inK);
    const zh = zc + clamp(vn, -1.5, 1.5) * 0.06 - 0.02 + this.lean.x;
    const press = smooth((u - 0.45) / 0.5);
    let face, arms;
    if (press > 0.35) {
      face = { eyes: 'squeeze', mouth: 'grit', brow: 1, press, blush: 0.5 * press, sweat: press > 0.7 ? 1 : 0 };
      arms = squeezedArms(this.type);
      const br = braceArms(this.type, t, this.ph);
      const kk = smooth((press - 0.35) / 0.4);
      arms = br.map((a, i) => ({ a: lerp(a.a, arms[i].a, kk), b: lerp(a.b ?? 0, arms[i].b ?? 0, kk) }));
    } else if (out > 0.55) {
      face = { eyes: 'wide', mouth: 'o', browUp: 1, mouthK: 0.6 + out * 0.4, look: 0 };
      if (this.type === 'sleepy') face = { eyes: 'wide', mouth: 'o', browUp: 1.3 };
      arms = flailArms(this.type, t, smooth((out - 0.55) / 0.35));
    } else {
      face = { ...base, look: 0 };
      if (this.type === 'sleepy') face = { eyes: Math.sin(t * 0.7 + this.ph) > 0.3 ? 'closed' : 'half', mouth: 'o', mouthK: 0.4 };
      arms = braceArms(this.type, t, this.ph);
    }
    if (c.ruined) face = { eyes: 'shock', mouth: 'wavy', browUp: 1.4, sweat: 1 };
    face = this.face(face, ctx);
    const sq = 0.08 * press - 0.03 * out + this.sq.x;
    Object.assign(st, {
      x: this.x * 0.2 + Math.sin(t * 2.1 + this.ph) * 0.01, zf, zb: zc, zh,
      sq, pinch: clamp(this.pinch.x), dent: this.dent, dentY: undefined,
      arms, face, lod: 2, tieFly: clamp(-vn * 0.9), charm: Math.sin(t * 9) * 0.5 - vn * 0.8,
      bagSwing: -vn * 0.6 + Math.sin(t * 5) * 0.1, jiggle: this.sq.x * 3,
      nod: this.type === 'sleepy' ? 0.1 + Math.sin(t * 0.9) * 0.04 : 0, tilt: this.type === 'sleepy' ? 0.12 : 0,
      headSq: press * 0.05, ruined: this.ruin, wobble: P.w > 0.7 ? 0.6 + Math.abs(vn) : 0,
    });
    if (L.balloon) st.balloon = [-0.3 + Math.sin(t * 1.4) * 0.05, 2.05 + Math.sin(t * 1.9) * 0.03];
    return { st, z: zc, flip: 1 };
  }

  // squeezed in behind the door line, part of the wall of commuters you have built
  // the arms settle from however he squeezed in to his strap-hanging pose
  wallArmsNow() {
    const to = this.back ? [HANG, HANG] : this.wallArms;
    if (!this.armsFrom || this.blendT == null || this.blendT >= 1) return to;
    const e = smooth(this.blendT);
    return to.map((a, i) => { const f = this.armsFrom[i] || a; return { a: lerp(f.a, a.a, e), b: lerp(f.b ?? 0, a.b ?? 0, e) }; });
  }

  wallPose(ctx, st, base) {
    const t = this.t;
    const z = this.z - ctx.press * 0.07 * (1 - this.depthK * 0.5);
    const full = clamp((ctx.fill - 1) / 1);
    const glass = ctx.closed ? clamp((ctx.fill - 1.15) / 0.5) * (1 - this.depthK) : 0;
    const zz = z + glass * 0.05;
    let face;
    const relief = this.hold;
    if (relief) face = relief.face;
    else if (ctx.mood < -0.5) face = { eyes: 'dot', mouth: 'wavy', brow: 1.4 };
    else if (ctx.press > 0.55 || glass > 0.5) face = { eyes: 'squeeze', mouth: this.id % 2 ? 'grit' : 'wavy', press: Math.max(ctx.press, glass), blush: 0.4 };
    else if (full > 0.4) face = { eyes: this.id % 3 ? 'closed' : 'dot', mouth: 'wavy', press: full * 0.5, brow: 0.6 };
    else face = { ...base, look: ctx.lookAt ?? 0 };
    if (this.type === 'sleepy' && !relief) face = { eyes: 'closed', mouth: 'o', mouthK: 0.4, press: face.press };
    const sq = 0.03 + full * 0.06 + ctx.press * 0.05 + this.sq.x;
    Object.assign(st, {
      x: this.x + (ctx.part || 0) * Math.sign(this.x || this.side) * 0.12,
      view: this.back ? 'back' : undefined,
      zf: zz - 0.02, zb: zz + 0.05 * (1 - this.depthK), zh: zz + 0.04,
      sq, arms: this.wallArmsNow(), face, lod: this.depthK > 0.5 ? 0 : 1,
      sway: Math.sin(t * 0.9 + this.ph) * 0.012 + (ctx.lean || 0) * 0.05, headSq: glass * 0.12,
      ruined: this.ruin, tilt: this.type === 'sleepy' ? 0.2 : 0, nod: this.type === 'sleepy' ? 0.1 : 0,
    });
    return { st, z: zz, flip: 1 };
  }
}
