// The stage: a Spanish flat cut open like a doll's house. The room is painted once per size (room.js); every
// frame the camera follows the cat and everything alive is drawn over it: the hob, the jam bottles, the objects, the
// dog, the cushion of paradox under the cat, the cat, the jets of jam, the box's lip, the water, the wind, and the
// shouts on top. Before each level, the intro: the cat's leap from somewhere high, taping the toast on as it falls.
import { Room } from './gfx/room.js';
import { CatViz } from './gfx/cat.js';
import { Props } from './gfx/props.js';
import { C as CAT } from './gfx/cat.js';
import { Fx } from './gfx/fx.js';
import { drawRoll } from './intro.js';
import { clamp, mulberry32 } from './util.js';

const SHARDS = { milk: '#dcebf5', oil: '#b9d39a', vase: '#4f7fc4', mug: '#f4efe6', bowl: '#f2ead8', bottle: '#9fd8c8', gnome: '#d8423a', pot: '#c8643a' };
const QUIET = { smear: 1.1, sizzle: 1.3, woof: 0.5, thud: 0.35, bump: 0.25, whee: 3, rise: 1.5, hop: 1.2, refill: 2.6, full: 3, squirt: 1.4, drip: 9 };
const JAMC = '#ff5a6a', JAMB = '#d2283c';

export class Scene {
  constructor(canvas, opts = {}) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.reduce = !!opts.reduce; this.maxArea = opts.maxArea || 16e6;
    this.room = new Room(); this.cat = new CatViz(); this.fx = new Fx();
    this.pad = { t: 0, b: 0, l: 0, r: 0, hud: 0 };
    this.W = 1; this.H = 1; this.dpr = 1; this.time = 0; this.shake = 0; this.kick = [0, 0];
    this.cam = { x: 0, y: 0, vx: 0, vy: 0 }; this.s = 1; this.view = { x: 0, y: 0, w: 1, h: 1 };
    this.rng = mulberry32(5); this.said = {}; this.paintKey = '';
  }
  load(lv, sim, o = {}) {
    this.lv = lv; this.sim = sim; this.title = !!o.title;
    this.props = new Props(sim); this.cat.reset(); this.fx.clear();
    this.shake = 0; this.kick = [0, 0]; this.said = {}; this.flingAcc = 0; this.purred = false; this.intro = null; this.rollA = 0;
    this.layout(); this.snap();
  }
  resize(W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (this.c.width !== cw || this.c.height !== ch) { this.c.width = cw; this.c.height = ch; }
    this.fx.resize(dpr, cw, ch, (this.pad.hud || 0) * dpr);
    if (this.lv) { this.layout(); this.snap(); }
  }
  // the play area (CSS px), the scale (CSS px per cm), and the room painted for it
  layout() {
    const lv = this.lv, p = this.pad, vw = Math.max(60, this.W - p.l - p.r), vh = Math.max(60, this.H - p.t - p.b);
    const tall = lv.id === 'terraza' ? 330 : lv.H + 90;
    this.s = Math.max(0.4, Math.min(vh / tall, vw / 300));
    this.view = { x: p.l, y: p.t, w: vw, h: vh };
    // painted tall enough for the far edge of the screen: with the door along the bottom the room sits high up
    const cy = p.t + vh / 2, k = this.s * Math.min(this.dpr, 2), viewH = 2 * Math.max(cy, this.H - cy) / this.s + 40;
    const key = `${lv.id}|${k.toFixed(3)}|${Math.round(viewH / 20)}`;
    if (key !== this.paintKey && typeof document !== 'undefined') { this.paintKey = key; this.room.paint(lv, k, viewH, this.maxArea); }
  }
  // half the screen in cm, measured from the play area's centre
  // (a fridge door over one side: the flat may run on under it, so the box at the far end still shows beside it)
  half() {
    const v = this.view, s = this.s, p = this.pad, cx = v.x + v.w / 2;
    return [(p.l > 120 ? v.w / 2 : cx) / s, (p.r > 120 ? v.w / 2 : this.W - cx) / s, (v.y + v.h / 2) / s, (this.H - v.y - v.h / 2) / s];
  }
  // who the camera and the rig follow: the intro's puppet while it plays, the sim's cat after
  get actor() { return this.intro ? this.intro.p : this.sim; }
  camTarget() {
    const sim = this.actor, lv = this.lv, [l, r, u, d] = this.half(), [bx0, by0, bx1, by1] = this.room.b;
    let x = sim.x + clamp(sim.vx * (this.intro ? 0.15 : 0.5), -140, 140), y;
    if (lv.id === 'terraza') y = sim.y - 30 + clamp(sim.vy * 0.2, -40, 60);
    else y = lv.H / 2 + 4;
    // a sliver of the walls' section at either end, no more
    const m = lv.id === 'terraza' ? 60 : 26, ex0 = Math.max(bx0, -m), ex1 = Math.min(bx1, lv.W + m);
    const lo = ex0 + l, hi = ex1 - r; x = lo > hi ? (ex0 + ex1) / 2 + (l - r) / 2 : clamp(x, lo, hi);
    const top = by0 + u, bot = by1 - d; y = top > bot ? (by0 + by1) / 2 : clamp(y, top, bot);
    return [x, y];
  }
  snap() { if (!this.sim) return; const [x, y] = this.camTarget(); Object.assign(this.cam, { x, y, vx: 0, vy: 0 }); }
  origin() {
    const d = this.dpr, S = this.s * d, v = this.view;
    return [S, Math.round((v.x + v.w / 2) * d - this.cam.x * S), Math.round((v.y + v.h / 2) * d - this.cam.y * S)];
  }
  toScreen(x, y) { const [S, ox, oy] = this.origin(); return [ox + x * S, oy + y * S]; }
  // a pointer on the screen (CSS px), in the sim's centimetres
  toSim(cx, cy) { const [S, ox, oy] = this.origin(); return [(cx * this.dpr - ox) / S, (cy * this.dpr - oy) / S]; }
  bump(k) { if (this.reduce) return; this.shake = Math.min(1.2, this.shake + k); this.kick = [(this.rng() - 0.5) * k * 8, k * 5]; }
  say(key, at, color, scale = 1, arg) {
    const q = QUIET[key]; if (q) { if (this.time - (this.said[key] ?? -9) < q) return false; this.said[key] = this.time; }
    this.fx.word(at, key, color, scale, arg);
    return true;
  }
}

// ---------------------------------------------------------------- what happened this tick
Object.assign(Scene.prototype, {
  events(evs) {
    const sim = this.sim, at = (x, y) => this.toScreen(x, y), head = () => at(sim.x, sim.y - 42);
    for (const e of evs) {
      this.cat.event(e); this.props.event(e);
      switch (e.k) {
        case 'spin': this.say('whee', head(), '#ffd84a', 1); break;
        case 'gust': this.say('gust', at(sim.x - e.dir * 80, sim.y - 70), '#d8ecff', 1.15); break;
        case 'low': this.say('low', head(), '#ff7a52', 1.1); this.bump(0.12); break;
        case 'smear': this.say('smear', at(e.x, e.y - 22), JAMC, 0.8); this.fx.bits(at(e.x, e.y), 3, JAMB, 5, 0.6); break;
        case 'hop': this.say('hop', at(e.x, e.y - 30), '#fff8ea', 0.9); this.fx.bits(at(e.x, e.y), 5, '#e6d8bd', 5, 0.5); break;
        case 'refill':
          if (e.full) { if (this.say('full', head(), JAMC, 1.2)) this.fx.bits(head(), 3, JAMB, 8, 0.7); }
          else this.say('refill', head(), JAMC, 0.95);
          break;
        case 'squirt': this.say('squirt', head(), JAMC, 1.05); this.bump(0.06); break;
        case 'drip': if (sim.b < 0.9 && sim.sag > 0.8) this.say('drip', head(), JAMC, 0.85); break;
        case 'paw': this.fx.bits(at(sim.x, sim.lowY()), 5, '#e6d8bd', 4, 0.5); break;
        case 'bump': if (e.v > 140) { this.say('ouch', at(e.x, e.y - 20), '#fff8ea', 0.8); this.bump(Math.min(0.35, e.v / 1000)); } break;
        case 'bonk': this.say('bonk', at(e.x, e.y - 34), '#fff8ea', 1.25); this.bump(0.55); this.fx.bits(at(e.x, e.y), 5, '#e6d8bd', 10, 1); break;
        case 'sit':
          if (e.box) { this.say('fits', at(e.x, e.y - 70), '#ffd84a', 1.35); this.fx.bits(at(e.x, e.y), 5, '#e0cfa9', 10, 1); this.bump(0.22); }
          else { this.say('sit', at(e.x, e.y - 64), '#fff8ea', 0.8); this.bump(0.08); }
          break;
        case 'rise': this.say('rise', head(), '#fff8ea', 0.75); break;
        case 'splash': this.say('splash', at(e.x, e.y - 34), '#a8dcff', 1.45); this.fx.spray(at(e.x, e.y), 34, 1.4); this.bump(0.5); break;
        case 'thud': this.say('thud', at(e.x, e.y - 22), '#fff8ea', 0.75); this.fx.bits(at(e.x, e.y + 4), 5, '#e6d8bd', 6, 0.6); break;
        case 'tempt': { const o = sim.objs[e.id]; this.say('oops', at(o ? o.x : sim.x, (o ? o.y : sim.y) - 40), '#ffd84a', 1.3); break; }
        case 'break': this.say('crash', at(e.x, e.y - 26), '#ff8a5c', 1.3); this.fx.bits(at(e.x, e.y - 3), 4, SHARDS[e.kind] || '#f4efe6', 14, 1.1); this.bump(0.35); break;
        case 'cucumber': this.say('hiss', head(), '#9ad86f', 1.4); this.bump(0.6); this.fx.bits(at(sim.x, sim.y), 6, '#f0a050', 12, 1); break;
        case 'sizzle': this.say('sizzle', head(), '#ff9a4a', 0.9); this.fx.bits(at(sim.x, sim.lowY()), 7, '#ffffff', 5, 0.6); break;
        case 'woof': { const d = sim.dogs.find((q) => Math.abs(q.x - e.x) < 1) || sim.dogs[0]; this.say('woof', at(e.x, (d ? d.y : sim.y) - 70), '#fff8ea', 1.1); break; }
        case 'knock': this.say('ouch', at(e.x, e.y - 30), '#ff7a52', 1.15); this.bump(0.6); this.fx.bits(at(e.x, e.y), 6, '#f0a050', 8, 0.8); break;
        case 'end': this.onEnd(e); break;
      }
    }
  },
  // the intro's beats: a push off the perch, the slap of the toast, the tape, the laws taking hold, the catch
  introEvent(e) {
    const it = this.intro, p = it ? it.p : this.sim, at = (x, y) => this.toScreen(x, y), head = () => at(p.x, p.y - 42);
    switch (e.k) {
      case 'leap': if (it) this.fx.bits(at(it.P.x, it.P.y), 5, '#e6d8bd', 5, 0.45); break;
      case 'slap': this.cat.kick(0.16); this.say('splat', at(p.x, p.y - 34), '#fff8ea', 0.85); this.fx.bits(at(p.x, p.y - 14), 0, CAT.crumb, 8, 0.7, 0.9); break;
      case 'tape': if (e.say) this.say('tape', head(), '#e4e7ea', e.rip ? 1.05 : 0.9); if (e.rip) this.cat.kick(0.1); break;
      case 'spin': this.cat.event(e); this.say('whee', head(), '#ffd84a', 1); break;
      case 'turn': this.cat.tail = null; break;
      case 'engage': this.fx.bits(at(p.x, p.lowY()), 7, '#fff2c2', 6, 0.6); this.bump(0.08); break;
      case 'brake': {
        const k = clamp((e.v || 0) / 2600, 0.1, 0.3), gy = p.hover && isFinite(p.hover.gy) ? p.hover.gy : p.lowY() + 40;
        this.cat.kick(k); this.bump(k * 0.6); this.fx.bits(at(p.x, gy), 5, '#e6d8bd', 7, 0.7);
        break;
      }
    }
  },
  onEnd(e) {
    const sim = this.sim, c = this.toScreen(sim.x, sim.y - 70);
    if (e.win) { this.say('purr', c, '#ffd84a', 1.2); if (!this.reduce) this.fx.confetti(this.c.width, this.c.height, true); }
    else if (e.why !== 'water') this.say('meow', c, '#fff8ea', 1.3);
  },

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const it = this.intro, sim = this.actor; if (!sim) return;
    dt = Math.min(dt, 1 / 30); this.time += dt;
    this.shake *= Math.exp(-8 * dt); this.kick[0] *= Math.exp(-10 * dt); this.kick[1] *= Math.exp(-10 * dt);
    // the camera leads the cat a little and springs after it; a room never scrolls vertically
    const [tx, ty] = this.camTarget(), C = this.cam, k = it ? 160 : 38, z = 2 * Math.sqrt(k) * 0.95;
    C.vx += (k * (tx - C.x) - z * C.vx) * dt; C.x += C.vx * dt;
    C.vy += (k * (ty - C.y) - z * C.vy) * dt; C.y += C.vy * dt;
    // jam flicked off the toast of a spinning cat
    if (!it && !sim.end && sim.spin > 0.15 && sim.b > 0) {
      this.flingAcc += dt * sim.spin * sim.spin * 34;
      const c = Math.cos(sim.th), n = Math.sin(sim.th);
      while (this.flingAcc >= 1) {
        this.flingAcc -= 1;
        const lx = -16 + this.rng() * 28, ly = -12.5, rx = lx * c - ly * n, ry = lx * n + ly * c, out = 1.5 + this.rng() * 2;
        this.props.fling(sim.x + rx, sim.y + ry, sim.vx - sim.w * ry + rx * out, sim.vy + sim.w * rx + ry * out);
      }
    }
    if (it) { if (it.face) this.cat.setFace(it.face, 0.15); this.rollA = it.rollA; }
    this.cat.update(dt, sim);
    this.props.update(dt);
    this.fx.update(dt);
  },
  // the view in cm (the whole canvas, not only the play area)
  viewBox() {
    const [S, ox, oy] = this.origin();
    return { x0: -ox / S, y0: -oy / S, x1: (this.c.width - ox) / S, y1: (this.c.height - oy) / S };
  },
  // o.fx === false leaves out the shouts and the wind (the snapshot for the share card)
  draw(o = {}) {
    const g = this.g, it = this.intro, sim = this.actor; if (!sim) return;
    const d = this.dpr, [S, ox0, oy0] = this.origin(), a = this.shake * 5 * d;
    const ox = ox0 + (this.rng() - 0.5) * a + this.kick[0] * d, oy = oy0 + (this.rng() - 0.5) * a + this.kick[1] * d;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.setTransform(S, 0, 0, S, ox, oy);
    const v = { x0: -ox / S, y0: -oy / S, x1: (this.c.width - ox) / S, y1: (this.c.height - oy) / S }, [bx0, by0, bx1, by1] = this.room.b;
    if (v.x0 < bx0 || v.y0 < by0 || v.x1 > bx1 || v.y1 > by1) this.room.fill(g, v.x0 - 2, v.y0 - 2, v.x1 - v.x0 + 4, v.y1 - v.y0 + 4);
    this.room.draw(g);
    const px = 1 / S;
    this.props.drawBack(g, { px });
    drawRoll(g, this.lv, { px, a: this.rollA, tab: it ? it.tab : true });
    if (it) it.drawBack(g, this.cat, px);
    this.cat.drawCushion(g, sim, this.time);
    this.cat.shadow(g, sim);
    this.cat.draw(g, sim, { px });
    this.cat.drawSwirl(g, sim, this.time);
    if (it) it.drawFront(g, this.cat, px);
    this.props.drawFront(g, { px, view: v, fx: o.fx });
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (o.fx !== false) this.fx.draw(g);
  },
});
