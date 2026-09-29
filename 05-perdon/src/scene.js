// The scene: what the rules decide, acted out. Each frame it walks everyone to where the simulation
// has them (the feet keep time with the ground they cover), gives every face what its state means (the
// glance before a step, the phone, the look over the shoulder, the apology), draws the station and the
// people in depth order and the cards over their heads. After the whistle it plays the ending on its
// own: you step onto the train, turn and wave, and the doors close; or they close without you.
import { clamp, lerp, damp, smooth, smoother, mulberry32, ease, TAU } from './util.js';
import { LW } from './route.js';
import { FACE, RUMBA } from './sim.js';
import { Cam, laneX, floorAt, fogAt, FOG1 } from './gfx/cam.js';
import { Station, TX } from './gfx/station.js';
import { drawWalker, drawSuitcase, drawTrolley, handAt } from './gfx/walker.js';
import { lookOf, YOU_LOOK } from './gfx/looks.js';
import { PAL, fog } from './gfx/paint.js';
import { Bubbles } from './gfx/fx.js';

export const BEAT = 60 / 141;                 // the rumba's tempo
const OLE = [1.3, 2.6];                        // when the bystanders shout
const cyc = (v) => (v > 2.2 ? 0.8 * v : 0.55 + 0.68 * Math.max(v, 0.6)); // metres per pair of steps
const sgn = (v, d = 1) => (v > 0 ? 1 : v < 0 ? -1 : d);
// the three strokes of a glance: they come on once eye contact is over, and go before the step
const glanceK = (since) => smooth((since - 0.22) / 0.08) * (1 - smooth((since - 0.8) / 0.15));

function anim(rng, x, z) {
  return {
    ph: rng() * TAU, amp: 0, spd: 0, lat: 0, lean: 0, lx: x, lz: z, turn: 0, gx: 0, gy: 0, down: 0, brows: 0,
    arms: null, armK: 1, nb: 1 + rng() * 4, talk0: -9, talk1: -9, sq: 0, sk: 1, ez: 0, cv: null,
    p: { face: false, ph: 0, amp: 0, dir: 1, lean: 0, turn: 0, gx: 0, gy: 0, brows: 0, mouth: 0, blink: 0, arms: null, armK: 1, side: 1, beat: 0, spin: 1, down: 0, run: 0, hip: 0 },
  };
}

export class Scene {
  constructor(sim, text) {
    this.sim = sim; this.text = text;
    this.cam = new Cam();
    this.station = new Station(sim.lv, sim.route, text);
    this.bub = new Bubbles();
    this.st = { t: 0, off: 0, open: 1, lit: 1, board: false };
    this.rng = mulberry32((sim.seed ^ 0x5eed1e) >>> 0);
    this.an = new WeakMap(); this.chats = new WeakMap();
    this.me = anim(this.rng, laneX(sim.P.x), sim.P.z);
    this.t = sim.t; this.lt = sim.t; this.top = 0; this.snap = true;
    this.cast = []; this.out = []; this.pos = new Map(); this.bursts = [];
    this.attn = null; this.rum = null; this.rumC = 1; this.E = null;
    this.cues = []; this.shot = null; this.photo = null; this.done = false;
    this.mx = laneX(sim.P.x); this.mz = sim.P.z;
  }

  resize(W, H, top = 0, bottom = 0, zoom = 1) { this.cam.fit(W, H, top, bottom, zoom); this.top = top; this.snap = true; }
  focus() { return this.E?.camP || this.sim.P; }
  byId(id) { for (const a of this.sim.agents) if (a.id === id) return a; return null; }

  // ---------- what happened since the last frame ----------
  events(list) {
    for (const e of list) {
      const t = e.t;
      switch (e.k) {
        case 'ask': this.say('you', e.id == null ? 'askNone' : 'ask', { at: t }); break;
        case 'bump': this.bump(e); break;
        case 'brush': {
          const a = this.byId(e.id), P = this.sim.P;
          this.cam.bump(0.5); this.say('you', 'brush', { at: t });
          if (a) { const x = (laneX(P.x) + laneX(a.x)) / 2, z = (P.z + a.z) / 2; this.burst(x, floorAt(this.sim.route, z) + 1.05, z, 4, t, false); }
          break;
        }
        case 'dance':
          if (e.n === 1) { this.say(e.id, 'd1', { at: t }); this.say('you', 'd1', { at: t, delay: 0.3 }); }
          else if (e.n === 2) { this.say(e.id, 'd2', { at: t }); this.say('you', 'd2', { at: t, delay: 0.35 }); }
          else if (e.n === 3) { this.say('you', 'd3you', { at: t }); this.say(e.id, 'd3', { at: t, delay: 0.45, big: true }); }
          if (e.n < 4) this.shotAt(t + 0.55, 10 + e.n, { why: 'dance', k: e.n, kind: e.kind, id: e.id });
          break;
        case 'rumba':
          this.rum = { t0: t, a: this.byId(e.id), next: 0 };
          this.cues.push({ k: 'rumba', at: t });
          this.shotAt(t + 1.7, 100, { why: 'rumba', k: 4, kind: e.kind, id: e.id });
          break;
        case 'part': if (e.why === 'rumba') this.say(e.id, 'part', { at: t, delay: 0.15 }); break;
        case 'aside': this.say(e.id, e.kind === 'granny' ? 'granny' : 'aside', { at: t }); break;
        case 'cant': this.say(e.id, 'cant', { at: t }); break;
        case 'tuck': this.say(e.id, 'tuck', { at: t }); break;
        case 'split': this.say(e.id, 'split', { at: t }); break;
        case 'wait': this.say(e.id, 'wait', { at: t }); break;
        case 'runner': this.say(e.id, 'runner', { at: t, low: true, dur: 1.4 }); break;
        case 'deny': this.cam.bump(0.3); break;
        case 'end': this.startEnd(e); break;
      }
    }
  }
  say(who, key, o = {}) {
    const txt = this.text.say?.[key];
    if (!txt) return;
    const at = o.at ?? this.t, t0 = at + (o.delay || 0), a = who === 'you' ? null : this.byId(who);
    this.bub.add(who, txt, at, o);
    const A = who === 'you' ? this.me : a && this.an.get(a);
    if (A) { A.talk0 = t0; A.talk1 = t0 + Math.min(1.3, 0.3 + txt.length * 0.045); }
    const L = a ? lookOf(a) : YOU_LOOK, P = this.sim.P;
    this.cues.push({
      k: 'say', key, you: who === 'you', fem: !!L.fem, old: !!L.old, at: t0,
      id: a ? a.id : 0, vi: a ? a.id & 1 : 0, dx: a ? laneX(a.x) - laneX(P.x) : 0, dz: a ? Math.abs(a.z - P.z) : 0,
    });
  }
  bump(e) {
    const a = this.byId(e.id), P = this.sim.P, t = e.t;
    this.cam.bump(1);
    this.say('you', 'bumpYou', { at: t, big: true });
    const k = e.why === 'phone' ? ['bumpPhone', 0.35] : e.why === 'runner' ? ['bumpRunner', 0.1] : e.kind === 'tourist' ? ['bumpTourist', 0.3] : ['bumpThem', 0.3];
    this.say(e.id, k[0], { at: t, delay: k[1] });
    if (a) {
      const bag = e.why === 'bag';
      const bx = bag ? laneX(a.bag.x) - 0.18 : laneX(a.x), bz = bag ? a.z + 0.75 : a.z;
      const x = (laneX(P.x) + bx) / 2, z = (P.z + bz) / 2;
      this.burst(x, floorAt(this.sim.route, z) + (bag ? 0.5 : 1.2), z, 7, t, true);
      this.attn = { x, z, t0: t, a };
    }
    this.shotAt(t + 0.15, 1, { why: 'bump', k: 1, kind: e.kind, id: e.id });
  }
  burst(x, y, z, n, t, big) { this.bursts.push({ x, y, z, n, t0: t, big, a0: this.rng() * TAU }); }
  shotAt(at, rank, info) {
    if ((this.photo && this.photo.rank >= rank) || (this.shot && this.shot.rank >= rank)) return;
    this.shot = { at, rank, ...info };
  }

  // ---------- the ending ----------
  startEnd(e) {
    const P = this.sim.P, S = this.station;
    const E = (this.E = { why: e.why, t0: e.t, phase: 'walk', x: laneX(P.x), z: P.z, i: 0, inside: false, hidden: false, camP: null, door: null, path: null });
    if (e.why === 'arrive') {
      const d = (E.door = S.door(P));
      E.path = d.side ? [[TX + 0.35, d.z], [TX - 0.45, d.z]] : [[d.x, S.len + 0.3], [d.x, S.zT + 0.28]];
      E.camP = { x: P.x, z: P.z }; E.z0 = P.z;
    } else {
      E.phase = 'close'; E.closeT = e.t;
      this.cues.push({ k: 'doors', at: e.t });
      this.say('you', 'missed', { at: e.t, big: true, dur: 1.6 });
      this.shotAt(e.t + 0.6, 20, { why: 'missed', k: 0 });
    }
  }
  endTick(dt) {
    const E = this.E, t = this.t, st = this.st, S = this.station;
    if (E.phase === 'walk') {
      let left = 1.7 * dt;
      while (left > 0 && E.i < E.path.length) {
        const [px, pz] = E.path[E.i], dx = px - E.x, dz = pz - E.z, d = Math.hypot(dx, dz);
        if (d <= left) { E.x = px; E.z = pz; left -= d; E.i++; } else { E.x += (dx / d) * left; E.z += (dz / d) * left; left = 0; }
      }
      if (!E.inside && (E.door.side ? E.x < TX + 0.05 : E.z > S.zT - 0.05)) { E.inside = true; st.board = true; }
      if (E.i >= E.path.length) { E.phase = 'turn'; E.turnT = t; this.shotAt(t + 0.4, 0.5, { why: 'board', k: 0 }); }
    } else if (E.phase === 'turn') {
      if (t - E.turnT >= 0.5) { E.phase = 'close'; E.closeT = t; this.cues.push({ k: 'doors', at: t }); }
    }
    if (E.phase === 'close' || E.phase === 'depart') {
      const k = (t - E.closeT) / 0.6;
      st.open = 1 - smooth(k);
      if (k >= 1 && E.inside && !E.hidden) { E.hidden = true; st.board = false; if (E.door.side) st.you = { L: YOU_LOOK, t0: t }; }
      if (E.phase === 'close' && t - E.closeT >= 0.95) { E.phase = 'depart'; E.depT = t; this.cues.push({ k: 'depart', at: t }); }
    }
    if (E.phase === 'depart') {
      const u = t - E.depT;
      st.off = 0.8 * u * u;
      if (u >= (E.why === 'arrive' ? 0.9 : 2.2)) this.done = true;
    }
    // the camera stays on the platform and watches you step in (going with you, the lintel would take your
    // head); along a platform it backs off and edges out, to take in the train you are getting on
    if (E.camP) {
      if (E.door.side) {
        const u = smooth(clamp((t - E.t0) / 1.8));
        E.camP.x = (Math.max(E.x, -0.35) + 0.5 * u) / LW + 3; E.camP.z = Math.min(E.z, E.z0) - 2.8 * u;
      } else { E.camP.x = E.x / LW + 3; E.camP.z = Math.min(E.z, E.z0); }
    }
  }
  // after the whistle the rules stop; the crowd does not
  coast(a, A, dt) {
    if (A.cv == null) A.cv = a.v;
    const z = a.z + A.ez, gap = (this.mz - z) * a.dir, dx = Math.abs(laneX(a.x) - this.mx);
    let want = a.kind === 'stander' ? 0 : a.v0 * this.sim.route.speedAt(z);
    if ((dx < 0.6 && gap > 0 && gap < 1.4) || (a.dir > 0 && z > this.station.len - 0.6)) want = 0;
    A.cv = damp(A.cv, want, 5, dt);
    A.ez += a.dir * A.cv * dt;
  }

  // ---------- a frame ----------
  frame(g, dt) {
    const sim = this.sim, P = sim.P, cam = this.cam, st = this.st, R = sim.route;
    this.t = sim.end ? Math.max(this.t + dt, sim.end.t) : sim.t;
    const t = this.t, fdt = clamp(t - this.lt, 0, 0.1);
    this.lt = t; st.t = t;
    if (this.E) this.endTick(fdt);
    cam.track(this.focus(), R, fdt, this.snap); this.snap = false;
    this.station.update(fdt, P, sim.agents);
    this.station.back(g, cam, st);

    // where everybody is: you (bounced back, staggering, dancing, boarding), and the crowd
    const E = this.E, rum = this.rum && t - this.rum.t0 < RUMBA ? this.rum : null;
    let mx, mz;
    if (E && E.why === 'arrive') { mx = E.x; mz = E.z; }
    else {
      const kb = (t - P.bounceAt) / 0.25, u = t < P.stagger ? (P.stagger - t) / 0.7 : 0;
      mx = laneX(P.x) + (kb >= 0 && kb < 1 ? P.bounce * 0.12 * Math.sin(Math.PI * kb) : 0) + 0.09 * Math.sin(u * 16) * u;
      mz = P.z;
    }
    let rx = 0, rz = 0;
    if (rum) {
      const th = TAU * smoother((t - rum.t0) / RUMBA), cx = laneX(P.x), cz = P.z + FACE / 2, r = FACE / 2;
      mx = cx - r * Math.sin(th); mz = cz - r * Math.cos(th);
      rx = cx + r * Math.sin(th); rz = cz + r * Math.cos(th); this.rumC = Math.cos(th);
    }
    this.mx = mx; this.mz = mz;
    const cast = this.cast; cast.length = 0;
    cast.push({ you: true, a: null, A: this.me, L: YOU_LOOK, x: mx, z: mz, q: 0, push: 0, dance: !!rum, marks: 0, mside: 0 });
    for (const a of sim.agents) {
      if (a.gone) continue;
      let A = this.an.get(a);
      if (!A) this.an.set(a, (A = anim(this.rng, laneX(a.x), a.z)));
      if (sim.end) this.coast(a, A, fdt);
      const dancing = !!rum && rum.a === a;
      cast.push({ you: false, a, A, L: lookOf(a), x: dancing ? rx : laneX(a.x), z: dancing ? rz : a.z + A.ez, q: 0, push: 0, dance: dancing, marks: 0, mside: 0 });
    }
    // two bodies passing closer than they fit: both turn sideways and lean out of each other's way
    for (let i = 0; i < cast.length; i++) {
      const a = cast[i];
      if (a.dance) continue;
      for (let j = i + 1; j < cast.length; j++) {
        const b = cast[j];
        if (b.dance || (a.a && b.a && a.a.grp && a.a.grp === b.a.grp)) continue;
        const dz = Math.abs(a.z - b.z);
        if (dz >= 0.55) continue;
        const dx = b.x - a.x, adx = Math.abs(dx);
        if (adx >= 0.6) continue;
        const q = (1 - dz / 0.55) * (1 - adx / 0.6), s = sgn(dx);
        a.q = Math.max(a.q, q); b.q = Math.max(b.q, q);
        a.push -= s * 0.15 * q; b.push += s * 0.15 * q;
      }
    }
    for (const c of cast) {
      const A = c.A;
      A.sq = damp(A.sq, c.push, 12, fdt); A.sk = damp(A.sk, 1 - 0.55 * c.q, 12, fdt);
      if (!c.dance) c.x += A.sq;
      this.walk(A, c.x, c.z, fdt);
      this.pose(c, t, fdt, rum);
    }
    if (rum) while (rum.next < OLE.length && t - rum.t0 >= OLE[rum.next]) { this.ole(rum.t0 + OLE[rum.next]); rum.next++; }

    // draw: the station's fixtures and the people, far to near
    const out = this.out; out.length = 0;
    this.station.fixtures(cam, out, st);
    this.pos.clear();
    for (const c of cast) {
      if (c.you && E?.hidden) continue;
      const A = c.A, L = c.L, a = c.a, y = floorAt(R, c.z), d = c.z - cam.z;
      let T = null;
      if (d >= 0.6 && c.z <= cam.pz + FOG1 + 1) {
        const q = cam.p(c.x, y, c.z);
        if (q) {
          const sx = q[0], sy = q[1], s = q[2];
          if (sy - L.h * s < cam.H && sx + 0.6 * s > 0 && sx - 0.6 * s < cam.W) {
            T = { sx, sy, s, d, cr: cam.y - y, fog: fogAt(cam, c.z) };
            const ln = A.p.lean;
            this.pos.set(c.you ? 'you' : a.id, [sx + Math.sin(ln) * L.h * s, sy - Math.cos(ln) * L.h * s, s, a]);
            const TT = T;
            out.push({ z: c.you && E?.inside ? 1e9 + 1 : c.z, draw: (g2) => this.person(g2, c, TT) });
          }
        }
      }
      if (a?.bag) {
        const bz = (c.dance ? a.z : c.z) + 0.75, bx = laneX(a.bag.x) - 0.18 + (c.dance ? 0 : A.sq), Tb = this.at(bx, bz);
        if (Tb) {
          const hold = T && !c.dance && A.arms === 'pull' && A.armK > 0.6 ? handAt(T, L, A.p, 0) : true;
          out.push({ z: bz, draw: (g2) => drawSuitcase(g2, Tb, L.props.suitcase || '#7b2837', hold) });
        }
      }
      if (a?.trolley) {
        const tz = c.z - 0.45, Tt = this.at(c.x + 0.22, tz);
        if (Tt) {
          const hand = T && A.arms === 'trolley' && A.armK > 0.6 ? handAt(T, L, A.p, 1) : null;
          out.push({ z: tz, draw: (g2) => drawTrolley(g2, Tt, L.props.trolley || '#7b2837', hand) });
        }
      }
    }
    if (E?.inside && !E.hidden) out.push({ z: 1e9, draw: (g2) => this.station.leaves(g2, cam, st, E.door) });
    out.sort((p, q) => q.z - p.z);
    for (const o of out) o.draw(g);
    this.drawBursts(g, t);
    this.bub.draw(g, t, (who) => this.pos.get(who) || null, cam.W, cam.H, this.top);
    this.snapTick(g);
  }
  // a floor-standing thing at (x, z): its transform, or null when it is out of sight
  at(x, z) {
    const cam = this.cam, d = z - cam.z;
    if (d < 0.6 || z > cam.pz + FOG1 + 1) return null;
    const y = floorAt(this.sim.route, z), q = cam.p(x, y, z);
    if (!q || q[1] - 1.1 * q[2] > cam.H || q[0] + 0.5 * q[2] < 0 || q[0] - 0.5 * q[2] > cam.W) return null;
    return { sx: q[0], sy: q[1], s: q[2], d, cr: cam.y - y, fog: fogAt(cam, z) };
  }
  person(g, c, T) {
    const E = this.E;
    if (c.you && E?.inside) {
      g.save(); this.station.doorPath(g, this.cam, E.door); g.clip();
      drawWalker(g, T, c.L, c.A.p);
      g.restore();
      return;
    }
    drawWalker(g, T, c.L, c.A.p);
    if (c.marks > 0.01) glance(g, T, c.L, c.A.p, c.mside, c.marks);
  }

  // the feet keep time with the ground covered; the swing grows with the pace, the body leans into a sidestep
  walk(A, x, z, dt) {
    const dx = x - A.lx, dz = z - A.lz, d = Math.hypot(dx, dz);
    if (dt > 0) {
      const ok = d < 0.5;
      if (ok) A.ph += (d * TAU) / cyc(A.spd);
      A.spd = damp(A.spd, ok ? Math.abs(dz) / dt : A.spd, 10, dt);
      A.lat = damp(A.lat, ok ? dx / dt : 0, 14, dt);
      A.amp = damp(A.amp, clamp(Math.max(A.spd / 1.25, Math.abs(A.lat) * 0.9)), 8, dt);
    }
    A.lx = x; A.lz = z;
  }
  blink(A, t) {
    if (t >= A.nb + 0.14 || A.nb > t + 8) A.nb = t + 2.2 + this.rng() * 3.5;
    return t >= A.nb ? Math.sin(Math.PI * clamp((t - A.nb) / 0.14)) : 0;
  }
  chat(grp, t) {
    let G = this.chats.get(grp);
    if (!G || t >= G.until || t < G.until - 4) {
      const n = grp.length, i = G ? (G.i + 1 + Math.floor(this.rng() * (n - 1))) % n : Math.floor(this.rng() * n);
      this.chats.set(grp, (G = { i, until: t + 1.4 + this.rng() * 1.2 }));
    }
    return G;
  }

  // ---------- what each face and pair of arms says ----------
  pose(c, t, dt, rum) {
    const sim = this.sim, P = sim.P, A = c.A, p = A.p, a = c.a, D = P.dance, E = this.E;
    const you = c.you, onc = !you && a.dir < 0, mx = this.mx;
    let turn = 0, gx = 0, gy = onc ? 0.12 : 0, brows = 0, mouth = 0, arms = null, lean = 0, down = 0;
    let side = 1, beat = 0, run = 0, hip = 0, spin = 1;
    const toMe = sgn(mx - c.x, a && a.habit > 0 ? 1 : -1), atMe = clamp((mx - c.x) / 1.2, -1, 1);
    if (you) {
      turn = clamp(A.lat * 0.1, -0.45, 0.45);
      if (t < P.stagger) { arms = 'sorry'; brows = 1; }
      if (t - P.askAt < 0.55) { arms = 'wave'; beat = t - P.askAt; }
      if (t < P.hold) { arms = 'hold'; down = 0.4; }
      if (P.blockBy && !sim.end && t - P.blockT > 0.5) turn = 0.55 * Math.sin((t - P.blockT - 0.5) * 3.4);
      if (D && D.phase !== 'rumba') { arms = 'sorry'; brows = 1; }
      if (E) {
        if (E.why === 'arrive') {
          if (E.phase === 'walk') turn = E.door.side ? -0.7 : 0;
          else {
            const k = E.phase === 'turn' ? smoother((t - E.turnT) / 0.5) : 1, cs = Math.cos(Math.PI * k);
            spin = sgn(cs, -1) * (0.45 + 0.55 * Math.abs(cs)); mouth = 2; brows = 0.4; turn = 0;
            if (k > 0.6) { arms = 'wave'; beat = t; }
          }
        } else {
          const u = t - E.t0;
          if (u < 0.9) { arms = 'wave'; beat = u * 1.6; brows = 1; } else down = 1;
        }
      }
    } else {
      const lead = a.grp ? a.grp[0] : a, partner = D && D.a === a;
      if (onc) {
        if (a.phone) { arms = 'phone'; down = 1; gy = 0.8; }
        if (a.lookUp != null && t - a.lookUp < 1.4) { arms = null; down = 0; brows = 1; mouth = 3; gx = 0.5 * toMe; gy = 0.35; }
        if (a.kind === 'tourist') arms = 'pull';
        switch (lead.st) {
          case 'tell': {
            const since = t - lead.t0, s = lead.tell;
            if (since < 0.22) { gx = atMe; gy = 0.35; brows = 1; }
            else if (s) { turn = 0.85 * s; gx = s; gy = 0.2; lean = 0.1 * s * smooth((since - 0.4) / 0.25); c.marks = glanceK(since); c.mside = s; }
            else { brows = 1; mouth = 3; gx = Math.sin(t * 6 + a.id) * 0.9; }
            break;
          }
          case 'go': turn = 0.6 * lead.tell; gx = 0.8 * lead.tell; break;
          case 'clear': case 'past': { const gap = c.z - this.mz; if (gap > 0.3 && gap < 3.2) { gx = atMe; gy = 0.35; } break; }
          case 'stuck': mouth = 3; brows = 1; gx = atMe; gy = 0.35; break;
          case 'dither': gx = Math.sin(t * 7 + a.id * 1.7) * 0.9; turn = Math.sin(t * 3.1 + a.id) * 0.3; brows = 1; mouth = 3; break;
          case 'walk': if (a.kind === 'tourist') { gy = -0.8; turn = Math.sin(t * 0.7 + a.id) * 0.35; gx = turn; } break;
        }
      } else {
        if (a.phone) { arms = 'phone'; down = 0.8; }
        if (a.kind === 'granny') arms = 'trolley';
        if (a.kind === 'runner') run = clamp((A.spd - 1.8) / 0.8);
        if (a.kind === 'stander') turn = Math.sin(t * 0.8 + a.id) * 0.7;
        if (a.askAt != null) { turn = 0.8 * toMe; brows = 1; }
        if (a.cant != null && t - a.cant < 1.4) { turn = 0.9 * toMe; arms = 'sorry'; brows = 1; mouth = 3; }
      }
      // a couple holds hands (let go to let you through, then find each other again); a group talks
      if (a.kind === 'couple' && !(lead.split && t - lead.split < 2.4)) {
        const o = a.grp.find((m) => m !== a);
        if (o) { arms = 'hold'; side = laneX(o.x) > laneX(a.x) ? 1 : -1; }
      }
      if (a.grp && (a.kind === 'group' || a.kind === 'groupCo')) {
        const G = this.chat(a.grp, t), who = a.grp[G.i];
        if (who === a) { if (!(t < A.talk1)) mouth = (t * 6.5 + a.id * 0.37) % 1 < 0.5 ? 1 : 0; turn += 0.2 * Math.sin(t * 1.3 + a.id); }
        else if (who && !who.gone) { const s = sgn(laneX(who.x) - laneX(a.x)); turn = 0.55 * s; gx = 0.8 * s; gy = 0.1; }
      }
      if (partner && D.phase !== 'rumba') {
        arms = 'sorry'; brows = 1; mouth = 0; gx = atMe; gy = 0.35; turn = 0; down = 0;
        if (D.phase === 'tell' && D.side) {
          const since = t - D.t0;
          if (since > 0.1) { turn = 0.85 * D.side; gx = D.side; gy = 0.2; c.marks = glanceK(since + 0.12); c.mside = D.side; }
        } else if (D.phase === 'step') { turn = 0.5 * D.side; gx = 0.6 * D.side; }
        else if (!D.side) mouth = 3;
      }
      // the rumba: everybody near claps along (except whoever is on the phone)
      if (rum && !c.dance && !a.phone && Math.abs(c.z - this.mz) < 7) {
        arms = 'clap'; beat = (t - rum.t0) / BEAT; mouth = 2; brows = 0.6; down = 0;
        gx = 0.8 * toMe; gy = onc ? 0.3 : 0; turn = (onc ? 0.3 : 0.8) * toMe;
      }
      // a bump nearby: heads turn
      const at = this.attn;
      if (at && !rum && t - at.t0 < 1.2 && a !== at.a && !partner && !a.phone && Math.abs(c.z - at.z) < 6) {
        const s = sgn(at.x - c.x);
        if (onc) { gx = 0.8 * s; gy = at.z < c.z ? 0.35 : 0; turn = 0.3 * s; brows = 1; }
        else if (at.z < c.z) turn = 0.75 * s;
      }
    }
    // the rumba itself: once round each other, arms up, hips on the beat, feet on the beat
    if (c.dance) {
      const tau = t - rum.t0, cs = this.rumC;
      spin = sgn(cs) * (0.45 + 0.55 * Math.abs(cs));
      side = (you ? 1 : -1) * sgn(spin);
      arms = 'rumba'; beat = tau / BEAT; hip = 0.03 * Math.sin(beat * Math.PI); mouth = 2; brows = 0.5;
      turn = 0; gx = 0; gy = 0; down = 0; lean = 0;
      A.ph = beat * Math.PI; A.amp = 0.45; A.lat = 0;
    }
    const kh = 1 - Math.exp(-dt * 12), ke = 1 - Math.exp(-dt * 26);
    A.turn = lerp(A.turn, turn, kh); A.gx = lerp(A.gx, gx, ke); A.gy = lerp(A.gy, gy, ke);
    A.down = lerp(A.down, down, 1 - Math.exp(-dt * 8)); A.brows = lerp(A.brows, brows, ke);
    A.lean = damp(A.lean, clamp(A.lat * 0.035, -0.12, 0.12) + lean, 10, dt);
    // out of one pose, into the next
    if (arms !== A.arms) {
      if (A.arms == null || A.armK <= 0) { A.arms = arms; A.armK = 0; } else A.armK = Math.max(0, A.armK - dt * 8);
    } else A.armK = Math.min(1, A.armK + dt * 8);
    const talking = t >= A.talk0 && t < A.talk1;
    p.face = !you && onc; p.dir = you ? 1 : a.dir; p.ph = A.ph; p.amp = A.amp; p.lean = A.lean;
    p.turn = A.turn; p.gx = A.gx; p.gy = A.gy; p.brows = A.brows; p.down = A.down;
    p.mouth = talking ? ((t - A.talk0) * 9) % 1 < 0.55 ? 1 : 0 : mouth;
    p.blink = this.blink(A, t); p.arms = A.arms; p.armK = A.armK; p.side = side; p.beat = beat;
    p.spin = spin * A.sk; p.run = run; p.hip = hip;
  }

  // «¡Olé!» from somebody watching (off camera if nobody is)
  ole(t) {
    const cands = [];
    const near = this.cam.f / 11;
    for (const [id, q] of this.pos) if (id !== 'you' && q[3] && q[3] !== this.rum?.a && !q[3].phone && q[1] > this.top + 20 && q[2] > near) cands.push(id);
    if (cands.length) this.say(cands[Math.floor(this.rng() * cands.length)], 'ole', { at: t });
    else this.cues.push({ k: 'say', key: 'ole', you: false, fem: this.rng() < 0.5, old: false, at: t, id: 7, vi: this.rng() < 0.5 ? 1 : 0, dx: this.rng() < 0.5 ? -2.5 : 2.5, dz: 5 });
  }

  drawBursts(g, t) {
    const cam = this.cam;
    this.bursts = this.bursts.filter((b) => t - b.t0 < 0.34);
    for (const b of this.bursts) {
      if (t < b.t0) continue;
      const q = cam.p(b.x, b.y, b.z);
      if (!q) continue;
      const u = clamp((t - b.t0) / 0.32), s = q[2] * (b.big ? 1 : 0.6), e = ease.outCubic(u);
      const r0 = (0.1 + 0.32 * e) * s, r1 = r0 + (0.2 * (1 - u) + 0.05) * s;
      g.strokeStyle = PAL.ink; g.lineWidth = Math.max(1.5, 0.035 * s * (1 - 0.6 * u)); g.lineCap = 'round';
      g.beginPath();
      for (let i = 0; i < b.n; i++) {
        const an = b.a0 + (i * TAU) / b.n, cs = Math.cos(an), sn = Math.sin(an);
        g.moveTo(q[0] + cs * r0, q[1] + sn * r0); g.lineTo(q[0] + cs * r1, q[1] + sn * r1);
      }
      g.stroke();
    }
  }
  snapTick(g) {
    const s = this.shot;
    if (!s || this.t < s.at) return;
    this.shot = null;
    if (this.t > s.at + 0.3) return;                      // skipped past while fast-forwarding
    this.photo = { img: this.crop(g.canvas, s.id), rank: s.rank, why: s.why, k: s.k, kind: s.kind };
  }
  // the photo: you (and whoever you are dancing with) framed from the frame just drawn, at full resolution,
  // with room over your heads for what you are saying
  crop(cv, id) {
    const cam = this.cam, r = cv.height / cam.H, Wc = cv.width / r, Hc = cam.H, A = 1.35;
    const me = this.pos.get('you'), o = id != null ? this.pos.get(id) : null;
    let x = 0, y = 0, w = Wc, h = Hc;
    if (me) {
      const s = me[2];
      let top = me[1], bot = me[1] + 1.68 * s, l = me[0], rr = me[0];
      if (o) { top = Math.min(top, o[1]); bot = Math.max(bot, o[1] + 1.6 * o[2]); l = Math.min(l, o[0]); rr = Math.max(rr, o[0]); }
      const y0 = top - 1.1 * s, y1 = bot + 0.35 * s;
      w = Math.max((y1 - y0) * A, rr - l + 1.6 * s); h = w / A;
      if (w > Wc) { w = Wc; h = w / A; }
      if (h > Hc) { h = Hc; w = h * A; }
      x = clamp((l + rr) / 2 - w / 2, 0, Math.max(0, Wc - w)); y = clamp((y0 + y1) / 2 - h / 2, 0, Math.max(0, Hc - h));
    }
    const k = Math.min(1, 1200 / (w * r)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * r * k)); c.height = Math.max(1, Math.round(h * r * k));
    c.getContext('2d').drawImage(cv, x * r, y * r, w * r, h * r, 0, 0, c.width, c.height);
    return c;
  }
}

// three ink strokes off the side of a head: where they are about to step
export function glance(g, T, L, p, side, k) {
  const s = T.s, ln = p.lean || 0, yh = L.h - 0.145;
  const hx = T.sx + Math.sin(ln) * yh * s, hy = T.sy - Math.cos(ln) * yh * s;
  const r0 = Math.max(0.17 * s, 7), len = Math.max(0.13 * s, 6), w = Math.max(1.6, 0.022 * s), r = r0 + (1 - k) * 0.25 * len;
  g.save();
  g.globalAlpha = k; g.strokeStyle = fog(PAL.ink, T.fog); g.lineWidth = w; g.lineCap = 'round';
  g.beginPath();
  for (const an of [-0.5, 0, 0.5]) {
    const cx = Math.cos(an) * side, cy = Math.sin(an), l = an ? len * 0.78 : len;
    g.moveTo(hx + cx * r, hy + cy * r); g.lineTo(hx + cx * (r + l), hy + cy * (r + l));
  }
  g.stroke();
  g.restore();
}
