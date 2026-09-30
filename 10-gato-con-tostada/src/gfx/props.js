// Everything in the room that moves or reacts, drawn live over the painted room: water with a real surface, the
// hob's glow, the loose objects and their wreckage, jam smears and gloops, the squeezy jam bottles and their jets,
// the dog, the cucumber, the wind, and the box's front lip that hides the bottom half of a sitting cat.
import { TAU, clamp, lerp, rgba, shade, mulberry32, ellipse, roundRect } from '../util.js';
import { INK } from './room.js';
import { star } from './cat.js';

const SPILL = { milk: '#fbfaf3', oil: '#e2b62a', vase: '#9cc9ef', mug: '#6b3e1f', bottle: '#bfe6d8', pot: '#5a3b24' };
const JAM = '#d2283c', JAMD = '#8e1426', JAML = '#f25a68';
const SHARD = { milk: '#dcebf5', oil: '#b9d39a', vase: '#4f7fc4', mug: '#f4efe6', bowl: '#f2ead8', bottle: '#9fd8c8', gnome: '#d8423a', pot: '#c8643a' };

export class Props {
  constructor(sim) {
    this.sim = sim; this.t = 0; this.px = 0.4;
    this.waves = sim.water.map((w) => { const n = Math.max(6, Math.round(w.w / 3)); return { w, n, h: new Float32Array(n + 1), v: new Float32Array(n + 1) }; });
    this.smears = []; this.dots = []; this.wreck = new Map(); this.drops = [];
    this.pups = sim.dogs.map(() => ({ ph: 0, mouth: 0, wag: 0 }));
    this.tap = 1.4; this.rng = mulberry32(4242);
    this.squirts = sim.jars.map(() => -9); this.hit = sim.jars.map(() => true); this.spray = 0; this.bs = null;
  }
  event(e) {
    const s = this.sim;
    switch (e.k) {
      case 'smear': {
        const tx = -e.ny, ty = e.nx;
        this.smears.push({ x: e.x, y: e.y, a: Math.atan2(ty, tx), l: 7 + this.rng() * 7, t: this.t, s: this.rng() });
        if (this.smears.length > 36) this.smears.shift();
        break;
      }
      case 'break': this.wreck.set(e.id, { t: this.t, x: e.x, y: e.y, kind: e.kind, seed: e.id * 31 + 7 }); break;
      case 'splash': this.poke(e.x, e.y, 18, 26); break;
      case 'woof': for (const d of this.pups) d.mouth = 1; break;
      case 'fell': if (s.objs[e.id]) this.poke(e.x, e.y, 6, 10); break;
      case 'drip': this.fling(e.x, e.y, s.vx * 0.85 + (this.rng() - 0.5) * 18, s.vy * 0.85 + 12, 1.1 + this.rng() * 0.7, true); break;
      case 'squirt': this.squirts[e.id] = this.t; this.hit[e.id] = false; break;
    }
  }
  // push a water surface down around x
  poke(x, y, amt, rad) {
    for (const W of this.waves) {
      const w = W.w; if (x < w.x - rad || x > w.x + w.w + rad || Math.abs(y - w.y) > 40) continue;
      for (let i = 0; i <= W.n; i++) { const cx = w.x + (i / W.n) * w.w, d = Math.abs(cx - x); if (d < rad) W.v[i] += amt * 10 * (1 - d / rad); }
    }
  }
  // a flick of jam leaving a spinning cat, or a gloop running off an upside-down toast
  fling(x, y, vx, vy, r, gloop = false) { this.drops.push({ x, y, vx, vy, t: 0, r: r ?? 0.6 + this.rng() * 0.8, gloop }); if (this.drops.length > 70) this.drops.shift(); }

  update(dt) {
    const s = this.sim; this.t += dt;
    // water surfaces: a damped 1-D wave with a little spread each step
    for (const W of this.waves) {
      const { h, v, n } = W;
      for (let k = 0; k < 2; k++) {
        for (let i = 0; i <= n; i++) { const l = h[Math.max(0, i - 1)], r = h[Math.min(n, i + 1)]; v[i] += ((l + r - 2 * h[i]) * 900 - h[i] * 40 - v[i] * 3.2) * (dt / 2); }
        for (let i = 0; i <= n; i++) h[i] = clamp(h[i] + v[i] * (dt / 2), -6, 6);
      }
      // the laws can't land on water, but they do dimple it
      const w = W.w, d = w.y - s.lowY();
      if (!s.end && s.x > w.x - 10 && s.x < w.x + w.w + 10 && d > 0 && d < 60) this.poke(s.x, w.y, 0.9 * (1 - d / 60) * s.fight, s.extX());
    }
    // the tap in the kitchen drips now and then
    if (this.waves.length && s.lv.id === 'nevera' && (this.tap -= dt) <= 0) { this.tap = 1.8 + this.rng() * 1.6; const w = this.waves[0].w; this.drops.push({ x: w.x + w.w * 0.62, y: w.y - 20, vx: 0, vy: 0, t: 0, r: 0.9, water: true }); }
    for (const p of this.drops) {
      const y0 = p.y;
      p.t += dt; p.vy += 981 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.water) { for (const W of this.waves) if (p.x > W.w.x && p.x < W.w.x + W.w.w && p.y > W.w.y) { this.poke(p.x, W.w.y, 3, 6); p.t = 9; } }
      else if (p.vy > 0) {
        // jam lands where it lands: a dot on the floor, a ring on the water
        const q = s.probe(p.x, y0);
        if (isFinite(q.y) && p.y >= q.y) {
          p.t = 9;
          if (q.water) this.poke(p.x, q.y, p.gloop ? 3 : 1.5, 5);
          else { this.dots.push({ x: p.x, y: q.y, r: p.r * (p.gloop ? 1.5 : 1), t: this.t, g: p.gloop }); if (this.dots.length > 110) this.dots.shift(); }
        }
      }
    }
    this.spatter(dt);
    this.drops = this.drops.filter((p) => p.t < 1.4 && p.y < s.fallY + 50);
    s.dogs.forEach((d, i) => {
      const D = this.pups[i]; D.ph += dt * (d.jump ? 2 : 11); D.mouth = Math.max(0, D.mouth - dt * 2.6); D.wag += dt * (d.bark > 0 ? 26 : 12);
    });
  }
}

// ---------------------------------------------------------------- surfaces: water, hob, jam
Object.assign(Props.prototype, {
  ink(g, k = 1) { g.strokeStyle = INK; g.lineWidth = Math.max(0.55, this.px * 1.1) * k; g.stroke(); },
  fillInk(g, c, k = 1) { g.fillStyle = c; g.fill(); this.ink(g, k); },
  water(g) {
    const t = this.t;
    for (const W of this.waves) {
      const { w, h, n } = W, surf = (i) => w.y + h[i] + Math.sin(t * 2.2 + i * 0.7) * 0.35;
      g.beginPath(); g.moveTo(w.x, w.y + w.h);
      for (let i = 0; i <= n; i++) g.lineTo(w.x + (i / n) * w.w, surf(i));
      g.lineTo(w.x + w.w, w.y + w.h); g.closePath();
      const gr = g.createLinearGradient(0, w.y - 3, 0, w.y + w.h);
      gr.addColorStop(0, 'rgba(150,215,245,0.62)'); gr.addColorStop(1, 'rgba(70,140,200,0.78)');
      g.fillStyle = gr; g.fill();
      g.beginPath(); for (let i = 0; i <= n; i++) { const X = w.x + (i / n) * w.w; i ? g.lineTo(X, surf(i)) : g.moveTo(X, surf(i)); }
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.9; g.stroke();
      // lazy caustic glints under the surface
      g.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < w.w / 18; i++) { const x = w.x + ((i * 18 + t * 6 * (i % 2 ? 1 : -1)) % w.w + w.w) % w.w, y = w.y + 4 + ((i * 7) % Math.max(4, w.h - 6)); g.fillRect(x, y, 5, 0.7); }
    }
  },
  hobs(g) {
    const s = this.sim, t = this.t;
    for (const hb of s.hobs) {
      const hot = !s.hover.none && s.hover.solid && s.hover.solid.tag === 'hob' ? 1 : 0;
      const cx = [hb.x0 + (hb.x1 - hb.x0) * 0.28, hb.x0 + (hb.x1 - hb.x0) * 0.72];
      for (const x of cx) {
        const p = 0.75 + 0.25 * Math.sin(t * 5 + x);
        const gl = g.createRadialGradient(x, hb.y, 0, x, hb.y, 18);
        gl.addColorStop(0, `rgba(255,120,40,${0.55 * p})`); gl.addColorStop(1, 'rgba(255,80,20,0)');
        g.fillStyle = gl; g.fillRect(x - 18, hb.y - 18, 36, 18);
        g.strokeStyle = `rgba(255,${(90 + 60 * p) | 0},40,${0.85})`; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(x, hb.y - 0.6, 9, 1.4, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(x, hb.y - 0.6, 5, 0.8, 0, 0, TAU); g.stroke();
      }
      // heat haze
      g.strokeStyle = `rgba(255,190,140,${0.18 + 0.25 * hot})`; g.lineWidth = 0.8; g.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const x = lerp(hb.x0 + 8, hb.x1 - 8, i / 4), u = (t * 0.8 + i * 0.37) % 1, y = hb.y - 6 - u * 60;
        g.globalAlpha = Math.sin(Math.PI * u); g.beginPath(); g.moveTo(x, y + 10);
        for (let k = 1; k <= 5; k++) g.lineTo(x + Math.sin(t * 6 + k + i) * 2.2, y + 10 - k * 3.4);
        g.stroke(); g.globalAlpha = 1;
      }
    }
  },
  smearDecals(g) {
    for (const m of this.dots) {
      const age = this.t - m.t, a = clamp(1 - (age - 18) / 6) * 0.9; if (a <= 0) continue;
      const k = Math.min(1, 0.4 + age * 10);
      ellipse(g, m.x, m.y - 0.3, m.r * 1.5 * k, m.g ? 0.85 : 0.6); g.fillStyle = rgba(JAM, a); g.fill();
      if (m.g) { ellipse(g, m.x - m.r * 0.4, m.y - 0.6, m.r * 0.45 * k, 0.22); g.fillStyle = rgba('#ffffff', a * 0.5); g.fill(); }
    }
    for (const m of this.smears) {
      const age = this.t - m.t, a = clamp(1 - (age - 18) / 6) * 0.85; if (a <= 0) continue;
      const k = Math.min(1, age * 8);
      g.save(); g.translate(m.x, m.y); g.rotate(m.a);
      g.beginPath(); g.moveTo(-m.l / 2 * k, 0);
      g.bezierCurveTo(-m.l / 4, -1.8, m.l / 4, -1.4 - m.s, m.l / 2 * k, 0);
      g.bezierCurveTo(m.l / 4, 0.8, -m.l / 4, 0.9, -m.l / 2 * k, 0);
      g.fillStyle = rgba(JAM, a); g.fill();
      g.fillStyle = rgba('#ffffff', a * 0.5); g.fillRect(-m.l * 0.2, -0.9, m.l * 0.25, 0.4);
      g.restore();
    }
  },
});

// ---------------------------------------------------------------- loose objects, each drawn on its own circle
// (0, r) is where it stands; the sim spins it about the centre when it tumbles
const glassLine = (g, x0, y0, x1, y1) => { g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
Object.assign(Props.prototype, {
  obj(g, o) {
    const r = o.r, t = this.t, fi = (c, k) => this.fillInk(g, c, k);
    switch (o.k) {
      case 'milk':
        g.beginPath(); g.moveTo(-3.6, r); g.lineTo(-5, r - 13); g.lineTo(5, r - 13); g.lineTo(3.6, r); g.closePath(); g.fillStyle = 'rgba(215,236,250,0.5)'; g.fill();
        g.beginPath(); g.moveTo(-3.3, r - 0.8); g.lineTo(-4.4, r - 10); g.lineTo(4.4, r - 10); g.lineTo(3.3, r - 0.8); g.closePath(); g.fillStyle = '#fbfaf3'; g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(-4.3, r - 10.4, 8.6, 1);
        g.beginPath(); g.moveTo(-3.6, r); g.lineTo(-5, r - 13); g.lineTo(5, r - 13); g.lineTo(3.6, r); g.closePath(); this.ink(g, 0.8);
        glassLine(g, -3.2, r - 11.5, -2.4, r - 2); break;
      case 'fruit':
        g.beginPath(); g.arc(0, 0, r, 0, TAU); fi('#f7931e');
        g.fillStyle = rgba('#c96a0c', 0.5); for (let i = 0; i < 9; i++) { const a = i * 2.4, d = r * (0.3 + (i % 3) * 0.2); g.fillRect(Math.cos(a) * d, Math.sin(a) * d, 0.7, 0.7); }
        g.fillStyle = rgba('#ffffff', 0.4); ellipse(g, -r * 0.35, -r * 0.4, r * 0.3, r * 0.18, -0.6); g.fill();
        g.beginPath(); g.moveTo(0, -r + 0.5); g.quadraticCurveTo(5, -r - 5, 9, -r - 2); g.quadraticCurveTo(4, -r + 1, 0, -r + 0.5); fi('#4c9a3c', 0.7); break;
      case 'oil':
        g.beginPath(); g.moveTo(-r, r); g.lineTo(-2.2, r - 12); g.lineTo(2.2, r - 12); g.lineTo(r, r); g.closePath(); g.fillStyle = 'rgba(210,235,200,0.45)'; g.fill();
        g.beginPath(); g.moveTo(-r + 0.8, r - 0.6); g.lineTo(-3.4, r - 8); g.lineTo(3.4, r - 8); g.lineTo(r - 0.8, r - 0.6); g.closePath(); g.fillStyle = '#d9b21f'; g.fill();
        g.beginPath(); g.moveTo(-r, r); g.lineTo(-2.2, r - 12); g.lineTo(2.2, r - 12); g.lineTo(r, r); g.closePath(); this.ink(g, 0.8);
        roundRect(g, -2.8, r - 15, 5.6, 3.4, 1); fi('#c9ccd1', 0.7);
        g.beginPath(); g.moveTo(1.5, r - 14); g.lineTo(6.5, r - 18.5); g.lineTo(7.2, r - 17.6); g.lineTo(2.6, r - 12.8); g.closePath(); fi('#aeb2b8', 0.6);
        glassLine(g, -3.4, r - 2, -1.5, r - 9); break;
      case 'mug':
        g.beginPath(); g.arc(r - 0.5, r - 5.5, 3.2, -1.3, 1.3); g.lineWidth = 3.4; g.strokeStyle = INK; g.stroke(); g.lineWidth = 1.8; g.strokeStyle = '#f4efe6'; g.stroke();
        roundRect(g, -r, r - 11.4, 2 * r - 1.5, 11.4, 1.6); fi('#f4efe6');
        g.fillStyle = '#d8423a'; g.fillRect(-r + 0.5, r - 8, 2 * r - 2.5, 2.2);
        g.fillStyle = '#6b3e1f'; g.fillRect(-r + 1, r - 11.2, 2 * r - 3.5, 0.8); break;
      case 'vase': {
        g.strokeStyle = '#3f7d34'; g.lineWidth = 0.8;
        const fl = [[-4, -24, '#f25c54'], [1, -27, '#ffd23f'], [5, -22, '#ffffff']];
        for (const [x, y] of fl) { g.beginPath(); g.moveTo(0, -r + 2); g.quadraticCurveTo(x * 0.3, (y - r) / 2, x, y + r * 0.2); g.stroke(); }
        for (const [x, y, c] of fl) { for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5 + t * 0.2; g.beginPath(); g.arc(x + Math.cos(a) * 1.8, y + r * 0.2 + Math.sin(a) * 1.8, 1.4, 0, TAU); fi(c, 0.5); } g.beginPath(); g.arc(x, y + r * 0.2, 1, 0, TAU); g.fillStyle = '#f2a33a'; g.fill(); }
        g.beginPath(); g.moveTo(-3, r); g.bezierCurveTo(-9, r - 4, -8, r - 12, -2.6, r - 15); g.lineTo(-2.6, r - 17); g.lineTo(2.6, r - 17); g.lineTo(2.6, r - 15); g.bezierCurveTo(8, r - 12, 9, r - 4, 3, r); g.closePath(); fi('#4f7fc4');
        g.fillStyle = rgba('#ffffff', 0.85); g.fillRect(-6.4, r - 8, 12.8, 1.2); g.fillStyle = rgba('#ffffff', 0.35); ellipse(g, -3.6, r - 9, 1, 3, 0.3); g.fill(); break;
      }
      case 'remote':
        roundRect(g, -8, r - 3.4, 16, 3.4, 1.5); fi('#2c2c33');
        g.fillStyle = '#e8443a'; g.fillRect(4.6, r - 2.9, 1.4, 0.9); g.fillStyle = '#9aa0ab'; for (let i = 0; i < 4; i++) g.fillRect(-5 + i * 2.3, r - 2.9, 1.2, 0.7); break;
      case 'keys':
        g.beginPath(); g.arc(-1.5, r - 2.4, 1.9, 0, TAU); g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke(); g.strokeStyle = '#c9ccd1'; g.lineWidth = 0.6; g.stroke();
        roundRect(g, 0, r - 2.2, 6.5, 1.6, 0.5); fi('#e2b84a', 0.6); roundRect(g, -7, r - 1.9, 5.6, 1.5, 0.5); fi('#c9ccd1', 0.6);
        roundRect(g, -3.2, r - 6.4, 3.6, 3, 0.8); fi('#d8423a', 0.6); break;
      case 'bowl':
        g.beginPath(); g.moveTo(-r, r - 7); g.bezierCurveTo(-r, r - 1, -4, r, 0, r); g.bezierCurveTo(4, r, r, r - 1, r, r - 7); g.closePath(); fi('#f2ead8');
        g.strokeStyle = '#2f5fa8'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-r + 1, r - 5.5); for (let x = -r + 1; x <= r - 1; x += 2) g.lineTo(x + 1, r - 5.5 + ((x / 2) % 2 ? 1 : -0.6)); g.stroke();
        g.fillStyle = '#f2b632'; for (const x of [-3.5, 0, 3.5]) { g.beginPath(); g.arc(x, r - 2.4, 0.8, 0, TAU); g.fill(); } break;
      case 'roll':
        g.beginPath(); g.arc(0, 0, r, 0, TAU); fi('#fbfaf6');
        g.strokeStyle = rgba('#b8b2a4', 0.7); g.lineWidth = 0.5; g.beginPath(); for (let a = 0; a < 5 * TAU; a += 0.3) { const d = 2.2 + (a / (5 * TAU)) * (r - 2.8); a ? g.lineTo(Math.cos(a) * d, Math.sin(a) * d) : g.moveTo(d, 0); } g.stroke();
        g.beginPath(); g.arc(0, 0, 2.1, 0, TAU); fi('#b88a55', 0.6); break;
      case 'duck': {
        const wet = this.sim.water.some((w) => o.x > w.x && o.x < w.x + w.w && Math.abs(o.y + r - w.y) < 3);
        if (wet) g.translate(0, 2 + Math.sin(t * 2.4) * 0.7), g.rotate(Math.sin(t * 1.7) * 0.08);
        ellipse(g, 0, r - 3.2, r + 1.2, 3.6); fi('#ffd23f');
        g.beginPath(); g.arc(2.2, r - 8, 3.2, 0, TAU); fi('#ffd23f');
        g.beginPath(); g.moveTo(5, r - 8.6); g.quadraticCurveTo(8.4, r - 8.4, 7.8, r - 7); g.lineTo(5, r - 7.2); g.closePath(); fi('#f57c1f', 0.6);
        g.fillStyle = INK; g.beginPath(); g.arc(3.2, r - 9, 0.6, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(-3.4, r - 4.4); g.quadraticCurveTo(-1, r - 6.6, 1.2, r - 4.2); g.strokeStyle = rgba('#d9a800', 0.9); g.lineWidth = 0.7; g.stroke(); break;
      }
      case 'bottle':
        roundRect(g, -r, r - 11, 2 * r, 11, 2.2); g.fillStyle = 'rgba(160,216,200,0.7)'; g.fill(); this.ink(g, 0.8);
        g.fillStyle = 'rgba(120,196,176,0.9)'; roundRect(g, -r + 0.8, r - 7.5, 2 * r - 1.6, 6.8, 1.6); g.fill();
        g.fillStyle = '#f7f1e3'; g.fillRect(-3, r - 6.5, 6, 3.2);
        roundRect(g, -1.8, r - 14.5, 3.6, 3.8, 0.8); fi('#e2b84a', 0.7);
        glassLine(g, -3.6, r - 9.5, -3.6, r - 2); break;
      case 'gnome':
        g.beginPath(); g.moveTo(-r + 0.5, r); g.lineTo(-r + 2, r - 9); g.lineTo(r - 2, r - 9); g.lineTo(r - 0.5, r); g.closePath(); fi('#3d6fb6');
        g.beginPath(); g.moveTo(-5.6, r - 10); g.quadraticCurveTo(0, r - 1, 5.6, r - 10); g.lineTo(3, r - 13); g.lineTo(-3, r - 13); g.closePath(); fi('#f7f3ea');
        g.beginPath(); g.arc(0, r - 14, 3.4, 0, TAU); fi('#f4b894', 0.7);
        g.beginPath(); g.moveTo(-5, r - 15.6); g.quadraticCurveTo(-1, r - 29, 6, r - 27); g.quadraticCurveTo(2, r - 23, 5, r - 15.6); g.closePath(); fi('#d8423a');
        g.beginPath(); g.arc(1.4, r - 13.2, 1.1, 0, TAU); g.fillStyle = '#e58a74'; g.fill();
        g.fillStyle = INK; g.fillRect(-1.6, r - 15.2, 0.8, 0.8); g.fillRect(1.6, r - 15.2, 0.8, 0.8); break;
      case 'pot':
        for (const [x, y, c] of [[-4, r - 17, '#e8453c'], [2, r - 20, '#f25c54'], [5.5, r - 15, '#e8453c'], [-1, r - 14, '#4c9a3c'], [4, r - 12.6, '#4c9a3c'], [-5.4, r - 12.2, '#4c9a3c']]) { g.beginPath(); g.arc(x, y, c === '#4c9a3c' ? 3 : 2.4, 0, TAU); fi(c, 0.6); }
        g.beginPath(); g.moveTo(-r, r - 11); g.lineTo(r, r - 11); g.lineTo(r - 1.8, r); g.lineTo(-r + 1.8, r); g.closePath(); fi('#c8643a');
        roundRect(g, -r - 0.6, r - 12, 2 * r + 1.2, 3, 0.8); fi('#d8744a', 0.8); break;
    }
  },
});

// ---------------------------------------------------------------- wreckage, the ★ hint, the loo roll's trail
Object.assign(Props.prototype, {
  objects(g) {
    const s = this.sim, t = this.t;
    for (const o of s.objs) {
      if (o.k === 'roll') this.trailStep(o);
      if (o.gone) continue;
      if (o.broken) { this.wreckage(g, o); continue; }
      if (o.k === 'roll' && o.trail) this.trailDraw(g, o);
      g.save(); g.translate(o.x, o.y); g.rotate(o.a); this.obj(g, o); g.restore();
      if (o.tempt && !o.fell && !s.end) {
        const k = 0.6 + 0.4 * Math.sin(t * 4.2), x = o.x + o.r + 3, y = o.y - o.r - 14 - Math.sin(t * 2) * 1.5;
        g.save(); g.translate(x, y); g.rotate(t * 0.8); g.globalAlpha = 0.55 + 0.45 * k;
        g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, d = i % 2 ? 1 : 4.2 * k + 1.2; g.lineTo(Math.cos(a) * d, Math.sin(a) * d); } g.closePath();
        g.fillStyle = '#fff2a8'; g.fill(); g.restore();
      }
    }
  },
  trailStep(o) {
    if (o.sleep && !o.trail) return;
    const T = o.trail || (o.trail = []), last = T[T.length - 1], p = [o.x, o.y + o.r * 0.55];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 2.5) { T.push(p); if (T.length > 90) T.shift(); }
  },
  trailDraw(g, o) {
    const T = o.trail; if (T.length < 2) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [c, w] of [[INK, 2.6], ['#fbfaf6', 1.7]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); T.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.lineTo(o.x, o.y + o.r * 0.55); g.stroke(); }
  },
  wreckage(g, o) {
    const W = this.wreck.get(o.id) || { t: -9, x: o.x, y: o.y + 1, seed: o.id * 31 + 7 };
    const k = clamp((this.t - W.t) / 0.6), e = 1 - (1 - k) ** 3, rng = mulberry32(W.seed), x = W.x, y = W.y;
    const sp = SPILL[o.k];
    if (sp) {
      g.beginPath(); g.ellipse(x + 2, y - 0.2, lerp(3, o.k === 'pot' ? 9 : 17, e), lerp(0.6, o.k === 'pot' ? 3.2 : 1.7, e), 0, Math.PI, TAU);
      g.ellipse(x + 2, y - 0.2, lerp(3, o.k === 'pot' ? 9 : 17, e), 0.6, 0, 0, Math.PI); g.fillStyle = rgba(sp, o.k === 'pot' ? 1 : 0.85); g.fill();
      if (o.k !== 'pot') { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x - 4, y - 1.2, 6 * e, 0.4); }
    }
    const col = SHARD[o.k] || '#ddd';
    for (let i = 0; i < 7; i++) {
      const d = (rng() * 2 - 1) * lerp(4, 18, e), sx = x + d, sz = 1.2 + rng() * 2.2, a = rng() * TAU;
      g.save(); g.translate(sx, y - sz * 0.4); g.rotate(a);
      g.beginPath(); g.moveTo(-sz, 0); g.lineTo(sz * 0.3, -sz * 0.8); g.lineTo(sz, sz * 0.4); g.closePath();
      this.fillInk(g, i % 3 === 0 && o.k === 'gnome' ? '#3d6fb6' : col, 0.55); g.restore();
    }
    if (o.k === 'vase' || o.k === 'pot') for (const [dx, c] of [[-9, '#f25c54'], [7, '#ffd23f'], [12, '#e8453c']]) { g.beginPath(); g.arc(x + dx * e, y - 1.4, 1.5, 0, TAU); this.fillInk(g, c, 0.5); }
    if (o.k === 'gnome') { g.save(); g.translate(x + 9 * e, y - 3); g.rotate(1.3); g.beginPath(); g.moveTo(-3.4, 3); g.quadraticCurveTo(0, -9, 4, -8); g.quadraticCurveTo(1, -4, 3.4, 3); g.closePath(); this.fillInk(g, '#d8423a', 0.7); g.restore(); g.beginPath(); g.arc(x - 6 * e, y - 3.2, 3.2, 0, TAU); this.fillInk(g, '#f4b894', 0.7); }
  },
});

// ---------------------------------------------------------------- the cucumber and the dog
Object.assign(Props.prototype, {
  cukes(g) {
    const s = this.sim, t = this.t;
    for (const q of s.cukes) {
      const wob = q.cd > 5 ? Math.sin((6 - q.cd) * 40) * (q.cd - 5) * 0.25 : 0;
      g.save(); g.translate(q.x, q.y - 3.3); g.rotate(-0.04 + wob);
      g.beginPath(); g.moveTo(-13, 0.6); g.bezierCurveTo(-13, -4.4, 12, -4.8, 13, -0.6); g.bezierCurveTo(13.6, 3.2, -12, 4.2, -13, 0.6); g.closePath();
      this.fillInk(g, '#3f8a3a');
      g.strokeStyle = rgba('#8fd06f', 0.8); g.lineWidth = 0.9; g.beginPath(); g.moveTo(-10, -1.6); g.bezierCurveTo(-4, -3.4, 5, -3.4, 10, -2); g.stroke();
      g.fillStyle = '#285f25'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(-10 + i * 2.5, (i % 2 ? 1 : -0.6) + 0.5, 0.45, 0, TAU); g.fill(); }
      g.beginPath(); g.arc(13.2, -0.9, 1, 0, TAU); this.fillInk(g, '#6b8f2a', 0.5);
      g.restore();
      // an armed cucumber glints when a cat comes close. Nobody knows why.
      const d = Math.hypot(s.x - q.x, s.y - q.y);
      if (q.cd <= 0 && d < 170) { const k = (0.5 + 0.5 * Math.sin(t * 7)) * clamp((170 - d) / 80); star(g, q.x - 5, q.y - 7, 2.6 * k + 0.4, t); g.fillStyle = rgba('#ffffff', k); g.fill(); }
    }
  },
  dogs(g) {
    const s = this.sim;
    s.dogs.forEach((d, i) => { const D = this.pups[i]; g.save(); g.translate(d.x, d.y + d.jy); g.scale(d.dir, 1); this.dog(g, d, D); g.restore(); });
  },
  dog(g, d, D) {
    const ph = D.ph, j = d.jump, fi = (c, k) => this.fillInk(g, c, k), bob = j ? 0 : Math.abs(Math.sin(ph)) * 1.2;
    const leg = (hx, a, far) => {
      const hy = -20 - bob, fx = hx + Math.sin(a) * 19, fy = hy + Math.cos(a) * 19;
      g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 5.2; g.beginPath(); g.moveTo(hx, hy); g.lineTo(fx, fy); g.stroke();
      g.strokeStyle = far ? '#d6d0c2' : '#f6f3ec'; g.lineWidth = 3.8; g.stroke();
      ellipse(g, fx + 1.2, fy - 0.4, 2.6, 1.5); fi(far ? '#d6d0c2' : '#f6f3ec', 0.6);
    };
    const sw = (k) => (j ? (k < 2 ? 0.9 : -0.9) : Math.sin(ph + (k % 2) * Math.PI + (k >= 2 ? 0.6 : 0)) * 0.5);
    leg(15, sw(1), true); leg(-17, sw(3), true);
    // tail
    const ta = -0.35 + Math.sin(D.wag) * 0.35;
    g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 4.6; g.beginPath(); g.moveTo(-17, -31 - bob); g.lineTo(-17 - Math.sin(-ta) * 12 - 3, -31 - bob - Math.cos(ta) * 12); g.stroke(); g.strokeStyle = '#f6f3ec'; g.lineWidth = 3; g.stroke();
    ellipse(g, 0, -28 - bob, 19.5, 9.6); fi('#f6f3ec');
    g.fillStyle = '#26211f'; ellipse(g, -8, -33 - bob, 5.4, 3.8, 0.2); g.fill();
    g.fillStyle = '#c98a4a'; g.beginPath(); g.arc(-4.5, -31.5 - bob, 1.3, 0, TAU); g.fill();
    leg(11, sw(0), false); leg(-13, sw(2), false);
    // neck, collar, head
    g.save(); g.translate(0, -bob);
    g.beginPath(); g.moveTo(10, -34); g.lineTo(18, -46); g.lineTo(25, -41); g.lineTo(17, -27); g.closePath(); fi('#f6f3ec');
    g.lineCap = 'round'; g.strokeStyle = '#d8423a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(14.5, -40.5); g.lineTo(21.5, -35.5); g.stroke();
    g.beginPath(); g.arc(18.5, -36, 1.4, 0, TAU); this.fillInk(g, '#f2c230', 0.5);
    const m = D.mouth * (d.bark > 0 || d.jump ? 1 : 0.4), ja = m * 0.5;
    g.save(); g.translate(28, -40); g.rotate(ja);
    roundRect(g, -2, -1.4, 10, 3.4, 1.6); fi('#f6f3ec', 0.8);
    g.restore();
    if (m > 0.05) { g.beginPath(); g.moveTo(27, -40.6); g.lineTo(37, -41 + ja * 2); g.lineTo(37, -40 + ja * 9); g.closePath(); g.fillStyle = '#8a1f2a'; g.fill(); g.fillStyle = '#ef7d8a'; ellipse(g, 32, -38 + ja * 5, 3, 1.2, ja); g.fill(); }
    for (const [bx, tx, ty, c] of [[18.5, 17, -61, '#26211f'], [23.5, 25.5, -62, '#1c1816']]) { g.beginPath(); g.moveTo(bx - 3.2, -48); g.lineTo(tx, ty); g.lineTo(bx + 3.4, -49); g.closePath(); fi(c, 0.8); g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + 3, ty + 2.4); g.lineTo(tx + 0.6, ty + 3.4); g.closePath(); g.fillStyle = '#3a3230'; g.fill(); }
    g.beginPath(); g.arc(23.5, -44.5, 7.8, 0, TAU); fi('#26211f');
    roundRect(g, 26, -45.5, 11, 5.6, 2.6); fi('#f6f3ec', 0.8);
    g.fillStyle = '#c98a4a'; g.beginPath(); g.arc(25.8, -49.6, 1.5, 0, TAU); g.fill(); g.beginPath(); g.arc(26.4, -40.8, 2.3, 0, TAU); g.fill();
    g.beginPath(); g.arc(37, -43.8, 1.9, 0, TAU); g.fillStyle = '#141010'; g.fill();
    g.beginPath(); g.arc(27, -46, 1.6, 0, TAU); g.fillStyle = '#ffffff'; g.fill(); g.beginPath(); g.arc(27.6, -46, 0.9, 0, TAU); g.fillStyle = '#141010'; g.fill();
    if (d.bark > 0.2 || d.jump) { g.strokeStyle = '#c98a4a'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(24.6, -49.4); g.lineTo(28.8, -47.8); g.stroke(); }
    g.restore();
  },
});

// ---------------------------------------------------------------- in front of the cat: box lip, water, wind, drops
// ---------------------------------------------------------------- the squeezy jam bottles and their jets
Object.assign(Props.prototype, {
  // a point on the cat, from its own frame to the room's
  onCat(lx, ly) { const s = this.sim, c = Math.cos(s.th), n = Math.sin(s.th); return [s.x + lx * c - ly * n, s.y + lx * n + ly * c]; },
  // how low the cat reaches straight above x: its body is a capsule, padded by the toast when it's jam-down
  catBottom(x) {
    const s = this.sim, c = Math.cos(s.th), n = Math.sin(s.th), r = 13 + 4 * clamp(-c);
    let yb = -Infinity;
    for (let i = 0; i <= 8; i++) {
      const u = -1 + i / 4, cx = s.x + u * 15 * c, cy = s.y + u * 15 * n, dx = Math.abs(cx - x);
      if (dx < r) yb = Math.max(yb, cy + Math.sqrt(r * r - dx * dx));
    }
    return yb;
  },
  // the bottle's shape this frame: squashed by the paradox leaning on it, and never through the cat
  bottleShape(j) {
    const s = this.sim, ago = this.t - this.squirts[j.id];
    const kick = ago < 0.35 ? Math.sin(ago * 38) * (0.35 - ago) * 0.45 : 0;
    const near = !j.on && s.b < 0.8 && !s.end && Math.abs(s.x - j.x) < 170;
    let hk = 1 - 0.24 * clamp(j.sq + kick) + (near ? Math.sin(this.t * 5.5) * 0.025 : 0);
    if (s.y < j.y - 2) { const room = j.y - this.catBottom(j.x) - 5.6; hk = Math.min(hk, Math.max(0.5, room / 14)); }
    const Hb = 14 * hk;
    return { Hb, hw: 4.3 * (1 + 0.85 * (1 - hk)), tip: j.y - Hb - 5.6, near };
  },
  bottles(g) {
    const t = this.t;
    this.bs = this.sim.jars.map((j) => {
      const B = this.bottleShape(j), { Hb, hw } = B, bul = (hw - 4.3) * 0.9;
      g.save(); g.translate(j.x, j.y);
      ellipse(g, 0, 0.2, hw * 1.35, 1); g.fillStyle = rgba('#000000', 0.2); g.fill();
      // soft red plastic full of jam, fatter at the hips when it's squeezed
      g.beginPath(); g.moveTo(-hw + 1.3, 0); g.quadraticCurveTo(-hw, 0, -hw, -1.3);
      g.quadraticCurveTo(-hw - bul, -Hb * 0.36, -hw, -Hb * 0.72); g.quadraticCurveTo(-hw, -Hb, -hw * 0.5, -Hb);
      g.lineTo(hw * 0.5, -Hb); g.quadraticCurveTo(hw, -Hb, hw, -Hb * 0.72);
      g.quadraticCurveTo(hw + bul, -Hb * 0.36, hw, -1.3); g.quadraticCurveTo(hw, 0, hw - 1.3, 0); g.closePath();
      const gr = g.createLinearGradient(-hw, 0, hw, 0);
      gr.addColorStop(0, JAMD); gr.addColorStop(0.3, JAM); gr.addColorStop(0.62, JAML); gr.addColorStop(1, JAMD);
      g.fillStyle = gr; g.fill();
      g.save(); g.clip();
      g.fillStyle = rgba('#ffe0e4', 0.32); g.fillRect(-hw - 2, -Hb - 1, hw * 2 + 4, Hb * 0.17 + 1);
      g.fillStyle = rgba('#ffffff', 0.42); roundRect(g, -hw * 0.66, -Hb * 0.9, hw * 0.24, Hb * 0.74, hw * 0.12); g.fill();
      g.restore();
      this.ink(g, 0.95);
      // the label: a strawberry on cream
      const ly = -Hb * 0.64, lh = Hb * 0.32;
      roundRect(g, -hw * 0.94, ly, hw * 1.88, lh, 0.7); this.fillInk(g, '#fbf1dc', 0.6);
      const sx = hw * 0.05, sy = ly + lh * 0.56, sr = Math.min(1.9, lh * 0.32);
      g.beginPath(); g.moveTo(sx, sy + sr * 1.25);
      g.bezierCurveTo(sx - sr * 1.5, sy + sr * 0.2, sx - sr * 1.1, sy - sr * 1.05, sx, sy - sr * 0.8);
      g.bezierCurveTo(sx + sr * 1.1, sy - sr * 1.05, sx + sr * 1.5, sy + sr * 0.2, sx, sy + sr * 1.25); g.closePath();
      this.fillInk(g, JAM, 0.45);
      g.fillStyle = '#ffe3a3'; for (const [u, v] of [[-0.45, -0.1], [0.4, 0], [0, 0.45]]) { ellipse(g, sx + u * sr, sy + v * sr, 0.2, 0.13); g.fill(); }
      g.beginPath(); g.moveTo(sx - sr * 0.8, sy - sr * 0.95); g.lineTo(sx, sy - sr * 0.55); g.lineTo(sx + sr * 0.8, sy - sr * 0.95); g.lineTo(sx, sy - sr * 1.4); g.closePath();
      g.fillStyle = '#5a9a3a'; g.fill();
      // the flip-top cap and its nozzle
      roundRect(g, -hw * 0.56, -Hb - 3.2, hw * 1.12, 3.4, 0.9); this.fillInk(g, '#f6f1e7', 0.8);
      g.fillStyle = rgba('#000000', 0.12); g.fillRect(-hw * 0.5, -Hb - 1.1, hw, 0.8);
      g.beginPath(); g.moveTo(-1.4, -Hb - 3.1); g.lineTo(-0.5, -Hb - 5.6); g.lineTo(0.5, -Hb - 5.6); g.lineTo(1.4, -Hb - 3.1); g.closePath();
      this.fillInk(g, '#f6f1e7', 0.7);
      // a bead of jam on the nozzle when the toast is running low and a bottle is near
      if (B.near || j.on) {
        const k = j.on ? 1 : (t * 0.8) % 1, r = 0.35 + 0.75 * k;
        g.beginPath(); g.arc(0, -Hb - 5.6 - r * 0.6, r, 0, TAU); g.fillStyle = JAM; g.fill();
        g.fillStyle = rgba('#ffffff', 0.6); ellipse(g, -r * 0.3, -Hb - 5.6 - r, r * 0.3, r * 0.2); g.fill();
      }
      g.restore();
      return B;
    });
  },
  // a stream of jam: out of the nozzle straight up, bending onto whatever it's aimed at. a..b is the stretch that's in
  // the air, from 0 at the nozzle to 1 at the target
  stream(g, x0, y0, x1, y1, a, b, w) {
    if (b - a < 0.02) return;
    const t = this.t, cy = y0 - Math.max(3, (y0 - y1) * 0.6), N = 14;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = a + (b - a) * (i / N), v = 1 - u;
      const x = v * v * x0 + 2 * v * u * x0 + u * u * x1 + Math.sin(u * 10 - t * 28) * 0.45 * Math.sin(u * Math.PI);
      const y = v * v * y0 + 2 * v * u * cy + u * u * y1;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = INK; g.lineWidth = w + Math.max(0.55, this.px * 1.1) * 2; g.stroke();
    g.strokeStyle = JAM; g.lineWidth = w; g.stroke();
    g.strokeStyle = rgba(JAML, 0.9); g.lineWidth = w * 0.38; g.stroke();
  },
  // over a bottle jam-down, the toast gets a steady jet on its face; feet-down, a squirt in the belly
  jets(g) {
    const s = this.sim; if (!s.jars.length) return;
    s.jars.forEach((j, i) => {
      const B = (this.bs && this.bs[i]) || this.bottleShape(j), x0 = j.x, y0 = B.tip - 0.3;
      if (j.catch && s.y < j.y) {
        const [x1, y1] = this.onCat(-6.4, -15.4);
        if (y1 < y0 - 1) {
          this.stream(g, x0, y0, x1, y1, 0, 1, 1.2 + 1.1 * j.sq);
          const r = 1.5 + j.sq * 1.2, wob = Math.sin(this.t * 30) * 0.25;
          ellipse(g, x1, y1, r * (1.5 + wob), r * (0.75 - wob * 0.5), s.th); this.fillInk(g, JAM, 0.7);
          ellipse(g, x1 - 0.4, y1 - 0.2, r * 0.5, r * 0.22, s.th); g.fillStyle = rgba('#ffffff', 0.55); g.fill();
        }
      }
      const ago = this.t - this.squirts[j.id];
      if (ago >= 0 && ago < 0.3) {
        const [x1, y1] = this.onCat(-3, 10);
        if (y1 < y0 - 1) this.stream(g, x0, y0, x1, y1, clamp((ago - 0.1) / 0.2), clamp(ago / 0.07), 1.9);
      }
    });
  },
  // the jet spits a little where it hits the toast; a squirt bursts on the belly
  spatter(dt) {
    const s = this.sim;
    s.jars.forEach((j, i) => {
      if (j.catch && s.y < j.y && (this.spray -= dt) <= 0) {
        this.spray = 0.08 + this.rng() * 0.09;
        const [x, y] = this.onCat(-6.4 + (this.rng() - 0.5) * 12, -16);
        this.fling(x, y, (this.rng() - 0.5) * 80 + s.vx * 0.5, -15 - this.rng() * 45, 0.45 + this.rng() * 0.45);
      }
      if (this.t - this.squirts[i] >= 0.07 && !this.hit[i]) {
        this.hit[i] = true;
        const [x, y] = this.onCat(-3, 10);
        for (let k = 0; k < 5; k++) this.fling(x + (this.rng() - 0.5) * 6, y, (this.rng() - 0.5) * 110 + s.vx * 0.5, -25 - this.rng() * 55, 0.6 + this.rng() * 0.5);
      }
    });
  },
});

Object.assign(Props.prototype, {
  boxLip(g) {
    const B = this.sim.box; if (!B) return;
    const x = B.x, y = B.y + 2, top = y - 17, w = 60;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, top + 1);
    for (let u = x; u <= x + w; u += 3) g.lineTo(u, top + (Math.round((u - x) / 3) % 2 ? 0.8 : 0));
    g.lineTo(x + w, y); g.closePath(); this.fillInk(g, '#d7a86a', 0.8);
    g.fillStyle = '#e9c48c'; g.fillRect(x + 1, top + 1, w - 2, 1.4);
    g.fillStyle = rgba('#7a4f28', 0.9); g.font = '600 3.8px Fredoka, system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText('FRÁGIL', x + 6, y - 4.5);
    g.strokeStyle = rgba('#7a4f28', 0.9); g.lineWidth = 0.8; g.lineCap = 'round';
    for (const ax of [x + 42, x + 48]) { g.beginPath(); g.moveTo(ax, y - 3.5); g.lineTo(ax, y - 11); g.moveTo(ax - 2, y - 9); g.lineTo(ax, y - 11); g.lineTo(ax + 2, y - 9); g.stroke(); }
    g.beginPath(); g.moveTo(x + 31, y - 12); g.lineTo(x + 36, y - 12); g.lineTo(x + 35, y - 8.5); g.lineTo(x + 32, y - 8.5); g.closePath(); g.moveTo(x + 33.5, y - 8.5); g.lineTo(x + 33.5, y - 5); g.moveTo(x + 31.8, y - 4.8); g.lineTo(x + 35.2, y - 4.8); g.stroke();
    g.fillStyle = rgba('#b88a55', 0.55); g.fillRect(x + 22, top, 5, y - top);
  },
  gusts(g, v) {
    const s = this.sim, t = this.t; if (!s.gusts.length) return;
    let pre = 0, dir = Math.sign(s.gust);
    for (const q of s.gusts) { const d = q.t - s.time; if (d > 0 && d < 1) { pre = Math.max(pre, 1 - d); if (!dir) dir = Math.sign(q.a); } }
    const k = Math.max(Math.abs(s.gust) / 210, pre * 0.4); if (k < 0.03 || !dir) return;
    const vw = v.x1 - v.x0, vh = v.y1 - v.y0;
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const sp = 700 + (i % 5) * 160, L = 26 + (i % 4) * 16, y = v.y0 + ((i * 0.618034) % 1) * vh + Math.sin(t * 3 + i) * 5;
      let x = (((i * 173.3 + t * sp) % (vw + 300)) + vw + 300) % (vw + 300) - 150; x = dir > 0 ? v.x0 + x : v.x1 - x;
      g.strokeStyle = `rgba(255,255,255,${(k * (0.25 + 0.2 * (i % 3))).toFixed(3)})`; g.lineWidth = 0.9 + (i % 3) * 0.4;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - dir * L * 0.5, y - 3, x - dir * L, y + 1); g.stroke();
    }
    if (Math.abs(s.gust) > 60) for (let i = 0; i < 6; i++) {
      const sp = 380 + i * 50; let x = (((i * 311 + t * sp) % (vw + 200)) + vw + 200) % (vw + 200) - 100; x = dir > 0 ? v.x0 + x : v.x1 - x;
      const y = v.y0 + ((i * 0.37 + 0.2) % 1) * vh + Math.sin(t * 4 + i * 2) * 14;
      g.save(); g.translate(x, y); g.rotate(t * 6 * dir + i); ellipse(g, 0, 0, 3.2, 1.5); this.fillInk(g, i % 2 ? '#8fb34a' : '#c98a3a', 0.5); g.restore();
    }
  },
  dropsDraw(g) {
    for (const p of this.drops) {
      if (p.water) { g.beginPath(); g.arc(p.x, p.y, p.r * 0.9, 0, TAU); g.fillStyle = 'rgba(190,230,255,0.9)'; g.fill(); continue; }
      // jam: a bead, drawn out into a teardrop along its fall
      const v = Math.hypot(p.vx, p.vy) || 1, L = p.r * (1 + Math.min(1.6, v / 260)), a = Math.atan2(p.vy, p.vx);
      g.save(); g.translate(p.x, p.y); g.rotate(a);
      g.beginPath(); g.arc(0, 0, p.r, -Math.PI / 2, Math.PI / 2); g.quadraticCurveTo(-L * 1.2, p.r * 0.2, -L * 1.6, 0); g.quadraticCurveTo(-L * 1.2, -p.r * 0.2, 0, -p.r);
      g.fillStyle = JAM; g.fill();
      if (p.gloop) { g.fillStyle = rgba('#ffffff', 0.55); ellipse(g, p.r * 0.2, -p.r * 0.35, p.r * 0.35, p.r * 0.2); g.fill(); }
      g.restore();
    }
  },
  drawBack(g, o = {}) { this.px = o.px || this.px; this.hobs(g); this.smearDecals(g); this.cukes(g); this.bottles(g); this.objects(g); this.dogs(g); },
  drawFront(g, o = {}) { this.jets(g); this.boxLip(g); this.water(g); this.dropsDraw(g); if (o.view && o.fx !== false) this.gusts(g, o.view); },
});
