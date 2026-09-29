// The people around you: what each of them is doing at every moment, as springs (a head turns,
// overshoots and settles; a jump lands). Their state is the sim's (how annoyed they are, whether
// they are awake, hushing you or away from their seat); the film adds what they do on their own:
// the couple leaning in, the sneeze that never comes, the friend hiding behind her hands.
import { Spring, clamp, lerp, hash, pop, rr, text, wrap } from './paint.js';
import { drawPerson } from './person.js';
import { A } from '../sim.js';

const JOLT = new Set(['stinger', 'crowdscream', 'roar', 'thunder', 'boom']);
// the voice line of someone telling you off for the n-th time (each regular has their own)
const OWN = new Set(['amiga', 'cine', 'fan', 'abu', 'crit', 'dir']);
export const shushId = (p, n) => `p_shh${Math.max(1, Math.min(3, n))}_${OWN.has(p.id) ? p.id : p.id === 'nino' ? 'kid' : p.look?.v || 'm1'}`;
const SAY = 1.9;     // s a speech card stays up after its line (the shortest lines need time to be read)

export class Audience {
  constructor(sim, film) {
    this.sim = sim; this.film = film; this.cards = []; this.zs = []; this.spray = [];
    this.ppl = sim.ppl.map((p, i) => {
      const h = hash(i * 13.7 + p.x * 3.1 + p.z * 7.3), row = Math.round(p.z / 0.95);
      const sd = p.x > 0.01 ? -1 : p.x < -0.01 ? 1 : h > 0.5 ? 1 : -1;
      return {
        p, row, sd, h, id: p.id, kind: p.kind,
        yaw: new Spring(0, 55, 0.72), lift: new Spring(0, 140, 0.42), tilt: new Spring(0, 45, 0.85), dx: new Spring(0, 30, 1),
        shush: new Spring(0, 80, 1), cover: new Spring(0, 36, 1), ear: new Spring(0, 60, 1), mo: new Spring(0, 420, 1),
        say: null, sayT1: -1, twitchT: -99, lines: film.local.filter((c) => c.src === p.id),
      };
    });
    this.byId = new Map(this.ppl.map((q) => [q.id, q]));
    this.jolts = film.global.filter((c) => JOLT.has(c.k)).map((c) => c.t);
    this.lastT = 0;
  }

  // one sim event, as it happens
  event(e) {
    const q = e.who && this.byId.get(e.who);
    if (e.type === 'noise') for (const id of e.who) { const r = this.byId.get(id); if (r) { r.twitchT = e.t; r.yaw.kick(r.sd * 5); r.tilt.kick(r.sd * 1.6); } }
    if (e.type === 'shush' && q) { q.lift.kick(3); }
    if (e.type === 'wake' && q) { q.lift.kick(9); q.tilt.kick(-5); }
    if (e.type === 'aid' && q) q.aidT = e.t;
  }
  // a line said by someone in the room: a painted card over their head
  say(who, textS, dur, t, kind = 'say') {
    const q = this.byId.get(who);
    if (!q) return;
    this.cards = this.cards.filter((c) => c.q !== q);
    this.cards.push({ q, text: textS, t0: t, t1: t + Math.max(dur, 0.6) + SAY, kind, rot: (hash(t * 7.1) - 0.5) * 0.14 });
    q.sayT1 = t + dur;
  }

  update(t, dt) {
    const f = this.film, grid = f.grid;
    for (const j of this.jolts) if (j > this.lastT && j <= t) for (const q of this.ppl) q.joltAt = j + 0.04 + q.h * 0.12;
    for (const q of this.ppl) {
      const p = q.p, sd = q.sd, K = p.kind, side = q.row === 0;
      // at rest they face the screen: the ones beside you in profile, the rows ahead a little turned
      const base = side ? sd * 1.3 : -Math.atan2(p.x, p.z + 0.3) * 0.7, nose = Math.sin(q.yaw.v) >= 0 ? 1 : -1;
      let yaw = base + Math.sin(t * 0.21 + q.h * 9) * 0.05, lift = Math.sin(t * 1.3 + q.h * 5) * 0.012, tilt = 0, dx = 0, shush = 0, cover = 0, ear = 0, mo = 0;
      const pose = { glare: 0, brow: 0, eyes: 1, round: 0, look: undefined };
      const mood = p.mood, hushing = t - p.shushT < 1.9, away = p.away && p.away.some(([a, b]) => t >= a - 0.9 && t < b);
      if (q.joltAt && t >= q.joltAt) { q.lift.kick(K === 'miedica' ? 14 : 6); q.joltAt = 0; }
      // what the film makes them do
      const line = q.lines.find((c) => c.dur != null && c.k !== 'sneeze' && t >= c.t && t < c.t + c.dur);   // speech only, not beds
      if (line) mo = 0.2 + 0.65 * Math.abs(Math.sin(t * 16 + q.h * 20) * Math.sin(t * 7.3));
      if (K === 'pareja') {
        const lean = p.look.lean || 0, kiss = f.shots.find((s) => s.img === 'f2_kiss'), k = kiss && t >= kiss.t + 0.6 && t < kiss.t + 5.6 ? 1 : 0;
        tilt = lean * (0.2 + 0.05 * k); dx = lean * (0.22 + 0.38 * k); yaw = lerp(yaw, lean * 1.45, k);
      } else if (K === 'estornudo') {
        const ah = q.lines.find((c) => c.id === 'p_sneeze_ah' && t >= c.t && t < c.t + 2.6);
        const sn = q.lines.find((c) => c.k === 'sneeze' && t >= c.t && t < c.t + 0.9);
        // head back on the "ah... ah...", then it snaps forward (or it never comes)
        if (ah && !sn && !q.lines.some((c) => c.t > ah.t && c.t <= t)) { const u = clamp((t - ah.t) / 1.4); tilt = -nose * 0.34 * u; lift = 0.18 * u; pose.eyes = 1 - u; mo = 0.35 + 0.4 * u; }
        if (sn) {
          if (q.sneezed !== sn.t) { q.sneezed = sn.t; q.tilt.kick(nose * 7); q.lift.kick(-5); this.burst(q, nose); }
          tilt = nose * 0.22; lift = -0.12; pose.eyes = 0; mo = 0.25; cover = 0.55;
        }
      } else if (K === 'miedica') {
        const sw = f.tele.find((x) => x.k === 'swell' && t >= x.t0 - 0.3 && t < x.t1 + 0.2), scream = q.lines.find((c) => c.k === 'scream' && t >= c.t && t < c.t + c.dur + 0.5);
        if (sw) { cover = 1; lift = -0.12; tilt = nose * 0.1; }
        if (scream) { cover = 0.45; mo = 0.95; pose.brow = 1; pose.round = 1; lift = 0.05; }
      } else if (K === 'fan') {
        const g0 = grid && grid.find((x) => t >= x.t0 && t < x.t1);
        if (g0 && p.a < A.turn) { const ph = ((t - g0.t0) / g0.B) % 1; lift += Math.pow(Math.abs(Math.cos(Math.PI * ph)), 3) * 0.1 - 0.04; yaw += Math.sin(Math.PI * (t - g0.t0) / g0.B) * 0.1; }
        const wh = f.local.find((c) => c.src === p.id && c.k === 'whistle' && t >= c.t && t < c.t + c.pts[c.pts.length - 1][0]);
        if (wh && !p.hush(t)) { mo = 0.3; pose.round = 1; pose.eyes = 0.2; lift += 0.04; }
      } else if (K === 'roncador' && !p.listening(t)) {
        const s = Math.sin(Math.PI * 2 * 0.24 * t - 1.2);
        tilt = sd * 0.42; lift = -0.2 + 0.03 * s; pose.eyes = 0; mo = 0.3 + 0.25 * s;
        if (s > 0.96 && t - (q.zT || 0) > 1.5) { q.zT = t; this.zs.push({ q, t0: t }); }
      } else if (K === 'nino') {
        lift += 0.3 + Math.abs(Math.sin(t * 2.1)) * 0.03;
        if (line) yaw = -1.35;                                  // "¡Mamá!": to his mother, on his left
      } else if (K === 'normal' && q.id === 'mama' && line) { yaw = 1.35; shush = 1; }
      else if (K === 'critico') { lift -= 0.07; tilt = 0.06; }
      else if (K === 'abuelo' && q.aidT != null && t - q.aidT < 1.6) ear = 1;
      if (K === 'director' && away) {
        const u = clamp((t - p.away[0][0] + 0.9) / 0.9), v = clamp((t - p.away[0][0]) / 1.6);
        lift = 1.9 * pop(u, 1.2, 7); dx = 4.5 * v * v; yaw = 1.6;
      }
      // what you make them do
      if (!away) {
        if (hushing) { yaw = sd * 2.75; shush = t - p.shushT < 1.5 ? 1 : 0; pose.glare = 1; pose.brow = -1; mo = 0.25; pose.round = 1; }
        else if (mood >= 3) { yaw = sd * 2.6; pose.glare = 1; pose.brow = -1; }
        else if (mood === 2) { yaw = sd * 1.55; pose.brow = -0.6; pose.look = sd * 0.9; }
        else if (mood === 1) { yaw = base + sd * 0.5; tilt += sd * 0.1; }
        if (mood >= 2 && K !== 'pareja') { cover *= 0.2; pose.eyes = Math.max(pose.eyes, 1); }
      }
      q.yaw.to = yaw; q.lift.to = lift; q.tilt.to = tilt; q.dx.to = dx; q.shush.to = shush; q.cover.to = cover; q.ear.to = ear; q.mo.to = mo;
      for (const s of [q.yaw, q.lift, q.tilt, q.dx, q.shush, q.cover, q.ear, q.mo]) s.step(dt);
      q.pose = { ...pose, yaw: q.yaw.v, tilt: q.tilt.v, shush: q.shush.v, cover: q.cover.v, ear: q.ear.v, mo: clamp(q.mo.v), aidSide: p.x < 0 ? 1 : -1 };
      q.gone = K === 'director' && p.away && t >= p.away[0][0] + 1.6 && t < p.away[0][1];
    }
    this.cards = this.cards.filter((c) => t < c.t1);
    this.zs = this.zs.filter((z) => t - z.t0 < 3.2);
    this.spray = this.spray.filter((s) => t - s.t0 < 0.9);
    this.lastT = t;
  }
  burst(q, dir) { for (let i = 0; i < 18; i++) this.spray.push({ q, dir, t0: this.lastT, a: (hash(i * 3.3 + this.lastT) - 0.5) * 1.1, v: 0.6 + hash(i * 5.7) * 1.4 }); }

  // draw the cast of one row; place(p) -> { X, Y, S } in pixels for their seat
  drawRow(g, row, place, light) {
    const list = this.ppl.filter((q) => q.row === row && !q.gone).sort((a, b) => Math.abs(b.p.x) - Math.abs(a.p.x));
    for (const q of list) {
      const P = place(q.p), S = P.S * (q.p.look.v === 'kid' ? 0.8 : 1);
      q.at = { X: P.X + q.dx.v * S, Y: P.Y, S, lift: q.lift.v * S };
      drawPerson(g, q.p.look, { ...q.pose, lift: q.lift.v * S }, q.at.X, P.Y, S, light);
    }
  }

  // speech cards, snores and sneezes: over everything but your own hands
  drawOver(g, t, W, dpr, font) {
    for (const z of this.zs) {
      const a = z.q.at; if (!a) continue;
      const u = (t - z.t0) / 3.2;
      for (let k = 0; k < 3; k++) {
        const v = clamp(u * 1.4 - k * 0.18); if (v <= 0 || v >= 1) continue;
        const x = a.X + z.q.sd * -a.S * (0.8 + v * 1.6) + Math.sin(v * 7 + k) * a.S * 0.2, y = a.Y - a.lift - a.S * (1.3 + v * 2.2);
        g.globalAlpha = Math.sin(v * Math.PI) * 0.9;
        text(g, 'z', x, y, { font: `${Math.round(a.S * (0.55 + 0.35 * k))}px "Caveat Brush", cursive`, fill: '#f4ecd8', stroke: 'rgba(0,0,0,0.6)', lw: 3 });
      }
      g.globalAlpha = 1;
    }
    for (const s of this.spray) {
      const a = s.q.at; if (!a) continue;
      const u = (t - s.t0) / 0.9, dir = s.dir;
      g.fillStyle = `rgba(230,236,240,${0.8 * (1 - u)})`;
      g.beginPath(); g.arc(a.X + dir * a.S * (1 + s.v * u * 2.2), a.Y - a.lift + a.S * (0.1 + s.a * u * 1.4 + u * u * 0.8), Math.max(0.8, a.S * 0.05), 0, Math.PI * 2); g.fill();
    }
    // lay the cards out newest first: an older card that would sit under a newer one moves up out of its way
    const order = this.cards.filter((c) => c.q.at).sort((a, b) => b.t0 - a.t0), placed = [];
    for (const c of order) {
      const b = (c.box = this.cardBox(g, c, W));
      for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        for (const o of placed) if (b.cx - b.bw / 2 < o.cx + o.bw / 2 && b.cx + b.bw / 2 > o.cx - o.bw / 2 && b.top < o.top + o.bh + 6 && b.top + b.bh + b.size * 0.55 > o.top) { b.top = o.top - b.bh - b.size * 0.7; moved = true; }
        if (!moved) break;
      }
      placed.push(b);
    }
    for (let i = order.length - 1; i >= 0; i--) this.card(g, order[i], t);
  }
  cardBox(g, c, W) {
    const a = c.q.at, sh = c.kind === 'shush', size = Math.max(15, Math.round(a.S * (sh ? 0.78 : 0.62)));
    g.font = `${size}px "Caveat Brush", cursive`;
    const lines = wrap(g, c.text, Math.min(W * 0.62, size * 9), 3), lw = Math.max(...lines.map((l) => g.measureText(l).width)), lh = size * 1.02;
    const bw = lw + size * 1.1, bh = lines.length * lh + size * 0.6;
    return { size, lines, lh, bw, bh, cx: clamp(a.X, bw / 2 + 8, W - bw / 2 - 8), top: Math.max(4, a.Y - a.lift - a.S * 1.45 - bh - size * 0.5) };
  }
  card(g, c, t) {
    const a = c.q.at, B = c.box; if (!a || !B) return;
    const k = pop((t - c.t0) * 1.4, 3, 6), out = clamp((c.t1 - t) / 0.25), sh = c.kind === 'shush';
    if (k <= 0 || out <= 0) return;
    const { size, lines, lh, bw, bh, cx, top } = B;
    g.save();
    g.font = `${size}px "Caveat Brush", cursive`;
    g.translate(cx, top + bh / 2); g.rotate(c.rot); g.scale(k * out, k * out);
    g.fillStyle = 'rgba(0,0,0,0.45)'; rr(g, -bw / 2 + 3, -bh / 2 + 4, bw, bh, size * 0.2); g.fill();
    g.fillStyle = sh ? '#f3e6c8' : '#e9eef2'; rr(g, -bw / 2, -bh / 2, bw, bh, size * 0.2); g.fill();
    g.lineWidth = Math.max(2, size * 0.1); g.strokeStyle = '#1b1210'; g.stroke();
    const tx = clamp(a.X - cx, -bw / 2 + size * 0.6, bw / 2 - size * 0.6);
    g.fillStyle = sh ? '#f3e6c8' : '#e9eef2'; g.beginPath(); g.moveTo(tx - size * 0.3, bh / 2 - 1); g.lineTo(tx + size * 0.1, bh / 2 + size * 0.55); g.lineTo(tx + size * 0.3, bh / 2 - 1); g.fill();
    g.beginPath(); g.moveTo(tx - size * 0.3, bh / 2); g.lineTo(tx + size * 0.1, bh / 2 + size * 0.55); g.lineTo(tx + size * 0.3, bh / 2); g.stroke();
    lines.forEach((l, i) => text(g, l, 0, -bh / 2 + size * 0.3 + lh * (i + 0.5), { font: `${size}px "Caveat Brush", cursive`, fill: sh ? '#b3121f' : '#1b2430' }));
    g.restore();
  }
}
