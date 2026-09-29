// The way up, as places: each room of the level laid out in metres, and strung into "legs", the
// straight stretches you walk without turning (the pavement and the lobby and the lift are one leg;
// each flight of stairs with the landing at its top is another; you turn at the half landings). Here
// is also everything in the building that moves on its own account: doors that swing and slide, the
// lift and its lamp, the stair light and its ticking, a neighbour at her door. What happens is the
// simulation's; this only knows where and how far along.
import { flatten, BAG } from '../levels.js';
import { EYE } from './cam.js';
import { clamp, smooth, damp, lerp } from '../util.js';

export const STOP = 0.6, TREAD = 0.32, RISER = 0.15, NST = 10, STOREY = 3, ROAD = -0.12;
export const FLAT = { x: 0.45, h: 2.1, lockX: 0.33, lockY: [1.05, 1.32], knob: 1.0 };

// how dark each kind of room goes when the stair light runs out (the lobby gets the street through
// the portal's glass; the half landing has its window)
const DARK = { lobby: 0.62, flight: 0.9, half: 0.74, landing: 0.92 };

export function buildWorld(lv) {
  const { steps } = flatten(lv);
  const stairRoom = lv.rooms.find((r) => r.stairs);
  const sg = stairRoom && stairRoom.stairs === 'L' ? -1 : 1;     // the side of the stairs' wall; the stairwell is the other
  const night = lv.id === 'nochebuena';
  const rooms = lv.rooms.map((r, ri) => ({ ri, kind: r.kind, src: r, walk: 0, sIn: 0, acts: [], waits: [], first: -1, last: -1, targets: new Map() }));
  steps.forEach((st, i) => {
    const R = rooms[st.room];
    if (R.first < 0) R.first = i;
    R.last = i;
    if (st.k === 'walk') R.walk += st.len;
    if (st.k === 'act') R.acts.push({ i, ...st });
    if (st.k === 'wait') R.waits.push({ i, ...st });
  });
  rooms.forEach((R) => { R.sIn = steps[R.first].s0; });

  const legs = [];
  let leg = null, cz = 0, prev = null;
  const newLeg = (turn) => { leg = { i: legs.length, rooms: [], turn }; legs.push(leg); cz = 0; };
  for (const R of rooms) {
    const k = R.kind;
    if (k === 'trunk') newLeg(0);
    else if (k === 'street') newLeg(1);
    else if (k === 'flight' && prev && (prev.kind === 'half' || prev.kind === 'landing')) newLeg(-sg);
    R.leg = leg.i; leg.rooms.push(R);
    R.cz0 = cz; R.cz1 = cz + R.walk; cz = R.cz1;
    layout(R, prev, lv, sg, night, rooms);
    prev = R;
    if (k === 'cabin') {
      // you turn round in the lift while it goes up, and face its doors
      newLeg(1);
      const O = { ...R, kind: 'cabinOut', cab: R, leg: leg.i, cz0: 0, cz1: 0, targets: new Map() };
      layoutCabinOut(O, R);
      leg.rooms.push(O); R.outLeg = leg.i; R.out = O;
      prev = O;
    }
  }
  for (const L of legs) L.rooms.forEach((R, j) => { R.next = L.rooms[j + 1] || null; R.prevIn = L.rooms[j - 1] || null; });
  return { lv, steps, rooms, legs, sg, night, xmas: night };
}

const act = (R, what, type) => R.acts.find((a) => a.what === what && (!type || a.type === type));

function layout(R, P, lv, sg, night, rooms) {
  const r = R.src;
  R.y0 = STOREY * (r.floor ?? 0); R.sg = sg; R.night = night; R.dark = DARK[R.kind] ?? 0;
  R.timer = r.lit === 'timer';
  const T = (a, x, y, z) => { if (a) R.targets.set(a.i, [x, y, z]); };
  switch (R.kind) {
    case 'trunk': {
      R.y0 = ROAD; R.z0 = 0; R.zE = 3;
      R.lid = { hz: 1.35, hy: 1.45, L: 1.05, open: 0.62, shut: -0.47 };
      T(act(R, 'trunk'), 0, 1.95, 0.62);
      break;
    }
    case 'street': {
      R.y0 = 0; R.zP = R.cz1 + STOP; R.zF = R.zP - 0.25; R.zc = 3.1; R.z0 = -3; R.zE = R.zP;
      R.exit = { kind: 'portal', Z: R.zP, x0: -0.65, x1: 0.65, h: 2.7, hinge: -1, glass: true };
      const o = act(R, 'portal', 'push') || act(R, 'portal', 'pull');
      R.exit.step = o ? o.i : -1; R.exit.pull = !!(o && o.type === 'pull');
      T(act(R, 'portal', 'keys'), 0.51, 1.1, R.zP);
      T(o, R.exit.pull ? 0.5 : 0.05, 1.02, R.zP);
      T(act(R, 'intercom'), -0.86, 1.3, R.zP);
      break;
    }
    case 'lobby': {
      R.zIn = P.exit.Z; R.z0 = R.zIn; R.w = [-1.1, 1.1]; R.hc = 2.75;
      R.end = r.lift === 'auto' ? 'lift' : r.lift === 'old' ? 'oldlift' : r.stairs ? 'stairs' : 'door';
      R.zE = R.end === 'stairs' ? R.cz1 + 0.16 : R.cz1 + STOP;
      if (r.lift === 'broken' || r.lift === 'full') R.sideLift = { X: -sg * 1.1, za: R.zE - 1.75, zb: R.zE - 0.85, state: r.lift };
      R.mail = { X: R.sideLift && R.sideLift.X < 0 ? 1.1 : -1.1, za: R.zIn + 0.9, zb: R.zIn + 2.15 };
      R.lamps = [R.zIn + 1.6, R.zIn + 4.2].filter((z) => z < R.zE - 0.4);
      const sw = act(R, 'light');
      if (sw) {
        const side = sw.side === 'L' ? -1 : 1, zs = R.zIn + (r.steps[0].len || 1.2) - STOP + 1.25;
        R.sw = { X: side * 1.1, z: zs, y: 1.15 };
        T(sw, side * 1.1, 1.15, zs);
      }
      if (R.end === 'door') {
        R.exit = { kind: 'flat', Z: R.zE, x0: -FLAT.x, x1: FLAT.x, h: FLAT.h, hinge: -1, letter: lv.door, locks: 1, mine: true };
        const o = act(R, 'door', 'push');
        R.exit.step = o.i;
        T(act(R, 'door', 'keys'), FLAT.lockX, FLAT.lockY[0], R.zE); T(o, 0, 1.0, R.zE);
      } else if (R.end === 'lift' || R.end === 'oldlift') {
        R.exit = { kind: R.end, Z: R.zE, x0: -0.45, x1: 0.45, h: 2.05 };
        R.call = { x: -0.66, y: 1.2 };
        T(act(R, 'call'), -0.66, 1.2, R.zE);
        R.arrive = R.waits.find((w) => w.what === 'arrive');
        if (R.end === 'oldlift') {
          const d = act(R, 'liftdoor'), g = act(R, 'reja');
          R.exit.step = d.i; R.exit.reja = g.i;
          T(d, 0.33, 1.0, R.zE); T(g, -0.36, 1.05, R.zE + 0.14);
        }
      }
      break;
    }
    case 'cabin': {
      R.zIn = P.exit.Z; R.z0 = R.zIn; R.old = r.lift === 'old';
      R.depth = R.old ? 1.12 : 1.3; R.w = [-0.55, 0.55]; R.hc = 2.2; R.zE = R.zIn + R.depth;
      R.ride = R.waits.find((w) => w.what === 'ride');
      R.to = r.to;
      const b = act(R, 'floor');
      T(b, 0.55, 1.2, R.zE - 0.3);
      R.panel = { X: 0.55, za: R.zE - 0.42, zb: R.zE - 0.2 };
      break;
    }
    case 'flight': {
      R.yTop = STOREY * r.floor; R.y0 = R.yTop - NST * RISER;
      R.zr0 = R.cz0 + 0.16; R.zT = R.zr0 + (NST - 1) * TREAD; R.z0 = R.cz0 - 0.05; R.zE = R.zT;
      R.hc = 2.75;
      break;
    }
    case 'landing':
      if (P.kind === 'cabinOut') {
        // out of the lift: a corridor to your door, a neighbour's door on each side
        R.corridor = true; R.zIn = P.exit.Z; R.z0 = R.zIn; R.yTop = R.y0;
        R.w = [-1.1, 1.1]; R.hc = 2.6; R.zE = R.cz1 + STOP; R.final = true;
        const keys = act(R, 'door', 'keys2') || act(R, 'door', 'keys'), push = act(R, 'door', 'push');
        const lockSide = keys && keys.side === 'L' ? -1 : 1;
        R.exit = { kind: 'flat', Z: R.zE, x0: -FLAT.x, x1: FLAT.x, h: FLAT.h, hinge: -lockSide, letter: lv.door, locks: keys && keys.type === 'keys2' ? 2 : 1, mine: true };
        if (push) { R.exit.step = push.i; T(push, 0, 1.0, R.zE); }
        if (keys) T(keys, lockSide * FLAT.lockX, FLAT.lockY[0], R.zE);
        const n = Math.round(R.y0 / STOREY), L4 = 'ABCD', k = L4.indexOf(lv.door);
        R.plaque = n + 'º';
        R.sides = [{ X: -1.1, z: R.zIn + 1.55, letter: L4[(k + 3) % 4] }, { X: 1.1, z: R.zIn + 1.55, letter: L4[(k + 1) % 4] }];
        R.lamps = [R.zIn + 1.4];
        break;
      }
    // falls through
    case 'half': {
      R.zIn = P.zT; R.z0 = R.zIn; R.yTop = R.y0;
      const final = R.kind === 'landing' && !R.src.steps.some((s) => s.k === 'act' && s.type === 'switch');
      R.final = final;
      R.zE = R.cz1 + (final || R.kind === 'half' ? STOP : 1.25);
      R.w = sg > 0 ? [-2.1, 0.6] : [-0.6, 2.1];
      R.hc = 2.75;
      const sw = act(R, 'light');
      if (sw) {
        const side = sw.side === 'L' ? -1 : 1;
        if (side === sg) { R.sw = { X: sg * 0.6, z: R.zE - 0.35, y: 1.15 }; T(sw, sg * 0.6, 1.15, R.zE - 0.35); }
        else { R.sw = { x: -sg * 0.72, y: 1.15, Z: R.zE }; T(sw, -sg * 0.72, 1.15, R.zE); }
      }
      if (R.kind === 'half') { R.win = { x0: -0.5, x1: 0.5, y0: 0.95, y1: 2.15 }; break; }
      const n = Math.round(R.y0 / STOREY);
      R.plaque = n + 'º';
      const letters = 'ABCD';
      if (final) {
        const keys = act(R, 'door', 'keys2') || act(R, 'door', 'keys'), push = act(R, 'door', 'push'), bell = act(R, 'bell');
        const lockSide = keys ? (keys.side === 'L' ? -1 : 1) : 1;
        R.exit = { kind: 'flat', Z: R.zE, x0: -FLAT.x, x1: FLAT.x, h: FLAT.h, hinge: -lockSide, letter: lv.door, locks: keys && keys.type === 'keys2' ? 2 : 1, mine: !bell };
        if (push) { R.exit.step = push.i; T(push, 0, 1.0, R.zE); }
        if (keys) T(keys, lockSide * FLAT.lockX, FLAT.lockY[0], R.zE);
        if (bell) { R.bell = { x: 0.64, y: 1.45 }; T(bell, 0.64, 1.45, R.zE); R.exit.opener = R.waits.find((w) => w.what === 'open'); R.exit.chat = R.waits.find((w) => w.what === 'chat'); R.exit.who = 'suegra'; }
        R.side = { x: -sg * 1.45, letter: letters[(letters.indexOf(lv.door) + 1) % 4] };
      } else {
        const chat = R.waits.find((w) => w.what === 'chat');
        R.exit = { kind: 'flat', Z: R.zE, x0: -FLAT.x, x1: FLAT.x, h: FLAT.h, hinge: sg, letter: letters[(n + 1) % 4], locks: 1, neighbour: true };
        if (chat) { R.exit.chat = chat; R.exit.who = chat.who; }
        R.side = { x: -sg * 1.45, letter: letters[(n + 2) % 4] };
      }
      break;
    }
    case 'home': {
      R.zIn = P.exit.Z; R.z0 = R.zIn; R.w = [-0.62, 0.62]; R.hc = 2.55;
      R.zK = R.cz1 - 0.9; R.zE = R.cz1 + 0.75; R.wk = [-1.5, 1.5];
      R.xmas = night;
      break;
    }
  }
}

function layoutCabinOut(O, C) {
  const inside = C.cz1 - (C.zIn - STOP) - STOP;    // how far past the doors you stand
  O.zIn = -1; O.dIn = inside; O.y0 = STOREY * (C.to ?? 0);
  O.z0 = -(C.depth - inside); O.zE = inside; O.w = [-0.55, 0.55]; O.hc = 2.2;
  O.exit = { kind: C.old ? 'oldliftOut' : 'liftOut', Z: inside, x0: -0.45, x1: 0.45, h: 2.05 };
  if (C.old) {
    const g = act(C, 'reja'), d = act(C, 'liftdoor');
    O.exit.reja = g.i; O.exit.step = d.i;
    O.targets.set(g.i, [0.34, 1.05, inside - 0.12]); O.targets.set(d.i, [0.05, 1.05, inside]);
  }
  O.panel = { X: -0.55, za: O.z0 + 0.2, zb: O.z0 + 0.42 };
}

// ---------- where you are ----------
export class World {
  constructor(lv) {
    this.W = buildWorld(lv);
    this.lv = lv;
    this.door = new Map();      // room index → how open its exit is (0..1), smoothed
    this.reja = new Map();
    this.lift = { open: 0, lamp: 0, floor: 0, outOpen: 0 };
    this.light = 0; this.flick = 0; this.wasOn = false;
    this.who = { vecina: 0, suegra: 0 };
    this.hazard = 0; this.t = 0;
  }
  legOf(sim) {
    const R = this.W.rooms[sim.step.room];
    if (R.kind === 'cabin' && R.ride) {
      if (sim.si > R.ride.i || (sim.si === R.ride.i && sim.sp > 1.1)) return this.W.legs[R.outLeg];
    }
    return this.W.legs[R.leg];
  }
  // the room the eye is drawn from, and how far along its leg
  where(sim) {
    const L = this.legOf(sim), R0 = this.W.rooms[sim.step.room];
    const R = R0.kind === 'cabin' && L.i === R0.outLeg ? R0.out : R0;
    const z = R.kind === 'cabinOut' || R.kind === 'trunk' ? 0 : R.cz0 + Math.max(0, sim.s - R.sIn);
    return { L, R, z, y: this.floorY(R, z) };
  }
  floorY(R, z) {
    if (R.kind === 'trunk') return ROAD;
    if (R.kind === 'street') return z < R.zc - 0.35 ? ROAD : z > R.zc ? 0 : lerp(ROAD, 0, smooth((z - R.zc + 0.35) / 0.35));
    if (R.kind === 'flight') {
      const n = clamp((z - R.cz0) / TREAD, 0, NST), k = Math.floor(n);
      return R.y0 + RISER * (Math.min(k, NST) + (k < NST ? smooth((n - k) * 1.6) : 0));
    }
    return R.y0;
  }

  // doors, the lift, the light: eased toward what the simulation says
  update(sim, dt) {
    this.t += dt;
    const si = sim.si, A = sim.act;
    const prog = (i, t0 = 0.25, t1 = 1) => (si > i ? 1 : si < i || !A ? 0 : smooth((A.t / A.T - t0) / (t1 - t0)));
    for (const R of this.W.rooms) {
      const E = R.exit;
      if (!E || !E.kind) continue;
      let target = 0;
      if (E.kind === 'portal' || E.kind === 'flat') {
        if (E.step >= 0 && E.step != null) {
          const how = si === E.step && A ? A.how : 'fast';
          target = prog(E.step, how === 'bum' ? 0.55 : how === 'foot' ? 0.5 : 0.25);
        }
        if (E.opener) target = si > E.opener.i ? 1 : si === E.opener.i ? smooth((sim.sp - (sim.waitT - 1.1)) / 0.9) : 0;
        if (E.neighbour && E.chat) target = si === E.chat.i ? smooth(sim.sp / 0.7) * (1 - smooth((sim.sp - sim.waitT + 0.2) / 0.6)) : 0;
      }
      const cur = this.door.get(R.ri + R.kind) ?? 0;
      this.door.set(R.ri + R.kind, E.kind === 'portal' || E.kind === 'flat' ? (Math.abs(target - cur) < 0.002 ? target : damp(cur, target, 18, dt)) : target);
    }
    // the lift: arriving, its doors, the ride
    const R = this.W.rooms[sim.step.room];
    const L = this.W.rooms.find((x) => x.kind === 'lobby' && x.arrive);
    if (L) {
      const C = this.W.rooms.find((x) => x.kind === 'cabin');
      const ar = L.arrive, ride = C && C.ride;
      let open = 0, here = 0, fl = 0;
      if (si < ar.i) { fl = 7; here = 0; }
      else if (si === ar.i) { const p = clamp(sim.sp / sim.waitT); fl = Math.round((1 - p) * 7); here = p >= 1 ? 1 : 0; open = sim.win ? 1 : 0; }
      else if (ride && si < ride.i) { here = 1; open = 1; fl = 0; }
      else if (ride && si === ride.i) { const p = clamp(sim.sp / sim.waitT); fl = Math.min(C.to, Math.floor(p * (C.to + 0.999))); here = 1; open = 0; }
      else { here = 1; fl = C ? C.to : 0; open = 0; }
      if (L.end === 'oldlift') {
        // the old one: you open its wooden door and its folding gate yourself; they shut when you press
        const Lx = L.exit, dOpen = prog(Lx.step, 0.2), gOpen = prog(Lx.reja, 0.2);
        const b = C && C.acts.find((a) => a.what === 'floor');
        const shut = b ? prog(b.i, 0, 0.9) : 0;
        this.lift.door = dOpen * (1 - shut); this.lift.reja = gOpen * (1 - shut);
        const O = C.out, og = prog(O.exit.reja, 0.2), od = prog(O.exit.step, 0.2);
        this.lift.outReja = og; this.lift.outDoor = od;
      }
      this.lift.open = damp(this.lift.open, open, open > this.lift.open ? 5 : 4, dt);
      this.lift.here = here; this.lift.floor = fl;
      const outT = ride ? (si > ride.i ? 1 : si === ride.i && sim.sp > sim.waitT - 0.9 ? 1 : 0) : 0;
      this.lift.outOpen = damp(this.lift.outOpen, outT, 5, dt);
      this.lift.riding = !!(ride && si === ride.i);
      this.lift.rideP = ride && si === ride.i ? clamp(sim.sp / sim.waitT) : si > (ride ? ride.i : 1e9) ? 1 : 0;
    }
    // the stair light: a click, a flicker, then steady; out all at once
    const on = sim.light.on;
    if (on && !this.wasOn) this.flick = 0.18;
    this.wasOn = on;
    this.flick = Math.max(0, this.flick - dt);
    const lit = on ? (this.flick > 0 ? (Math.sin(this.flick * 140) > 0 ? 0.9 : 0.35) : 1) : 0;
    this.light = on ? lit : damp(this.light, 0, 30, dt);
    // who is at a door
    for (const who of ['vecina', 'suegra']) {
      let tgt = 0;
      for (const Rm of this.W.rooms) {
        const E = Rm.exit;
        if (!E || E.who !== who) continue;
        if (E.chat && si === E.chat.i) tgt = 1;
        if (who === 'suegra' && E.opener && si >= E.opener.i && si <= E.chat.i) tgt = si === E.opener.i ? smooth((sim.sp - sim.waitT + 0.4) / 0.4) : 1;
        if (who === 'suegra' && si > E.chat.i && Rm.next) tgt = 0;
      }
      this.who[who] = damp(this.who[who], tgt, tgt > this.who[who] ? 7 : 3, dt);
    }
    this.hazard = (this.t % 0.72) < 0.36 ? 1 : 0;
    this.room = R;
  }
  // how dark it is where you are (0 lit … 1 black), for the veil drawn over everything
  darkness(sim) {
    const st = sim.step;
    if (!st || st.lit !== 'timer') return 0;
    const R = this.W.rooms[st.room];
    return (1 - this.light) * (R.dark || 0.9) * (this.W.night && R.kind === 'half' ? 1.12 : 1);
  }
  doorOpen(R) { return this.door.get(R.ri + R.kind) ?? 0; }
  bagLook(i) { return BAG[this.lv.bags[i]].look; }
}
