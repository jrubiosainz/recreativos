// Your own hands: the left one holds the snack, the right one waits by your mouth with the next
// piece, so a bite happens the instant you tap. It goes back into the box for another piece
// after you swallow. Every crunch is painted where it happens: loud and red when somebody heard
// it, small and swallowed by the film when nobody did.
import { Spring, clamp, lerp, easeOut, easeInOut, hash, text } from './paint.js';

// per container: where the right hand dips in (fraction of the sprite), and its tilt
const MOUTH = { palomitas: [0.6, 0.12], nachos: [0.5, 0.22], patatas: [0.62, 0.16], caramelo: [0.6, 0.14], kikos: [0.6, 0.12], hielo: [0.62, 0.14] };
const PINCH = [40 / 454, 45 / 640];
// where each new crunch word goes across your view: neighbours in time are never neighbours in space
const LANES = [0, -0.5, 0.25, -0.25, 0.5];

export class Hands {
  // img: { snk_<id>, pc_<id>, hand_pick }, word(kind, snackId) -> painted text for a noise
  constructor(sim, img, word) {
    this.sim = sim; this.img = img; this.word = word;
    this.snack = sim.snack.id; this.prev = null; this.swapT = -9;
    this.holding = true; this.pieceIn = -9; this.fetchT = -9; this.fullT = null; this.lastT = 0;
    this.bob = new Spring(0, 260, 0.35); this.shake = new Spring(0, 400, 0.3); this.jig = new Spring(0, 300, 0.25);
    this.words = []; this.crumbs = []; this.nw = 0;
  }
  event(e) {
    const t = e.t;
    if (e.type === 'noise') {
      // (a wrapped sweet stays in your fingers through the crinkles and goes in when you swallow)
      const s = this.sim.combo[e.piece] || this.sim.snack, wrap = e.kind === 'wrap';
      if (e.kind === 'bite') { this.holding = false; this.pieceIn = t; }
      if (e.kind === 'bite' || e.kind === 'chew') this.bob.kick(6 + (e.L - 55) * 0.4);
      if (wrap) this.jig.kick(9);
      if (e.kind === 'cough') this.shake.kick(26);
      this.words.push({ t0: t, text: this.word(e.kind, s.id), L: e.L, heard: e.heard, kind: e.kind, r: hash(t * 3.1), x: LANES[this.nw++ % LANES.length] + (hash(t * 7.3) - 0.5) * 0.08, col: s.color });
      if (e.kind !== 'rustle' && e.kind !== 'cough' && e.kind !== 'wrap') for (let i = 0; i < (e.heard ? 9 : 4); i++) this.crumbs.push({ t0: t, a: hash(t + i * 1.7), b: hash(t * 2 + i * 3.3), col: s.color });
    } else if (e.type === 'swallow') { this.bob.kick(-4); if (this.holding) { this.holding = false; this.pieceIn = t; } }
    else if (e.type === 'fetch') {
      this.fetchT = t;
      if (e.snack !== this.snack) { this.prev = this.snack; this.snack = e.snack; this.swapT = t; }
    } else if (e.type === 'ready') this.holding = true;
    else if (e.type === 'early') this.jig.kick(7);
    else if (e.type === 'full') this.fullT = t;
  }
  update(t, dt) {
    for (const s of [this.bob, this.shake, this.jig]) s.step(dt);
    this.words = this.words.filter((w) => t - w.t0 < 1.1);
    this.crumbs = this.crumbs.filter((c) => t - c.t0 < 0.8);
    this.lastT = t;
  }
  // how far the view bobs with your jaw (px per unit of view height)
  view(H) { return this.bob.v * H * 0.0016 + Math.sin(this.lastT * 60) * this.shake.v * H * 0.0004; }

  draw(g, L, t, dpr) {
    const { W, H, port } = L, I = this.img, sh = H * (port ? 0.34 : 0.42), sim = this.sim;
    const out = this.fullT != null ? easeInOut((t - this.fullT - 0.3) / 0.9) : 0;
    // the box in your left hand: bottom left, breathing a little; it swaps when the snack does
    const box = (id, dy) => {
      const im = I['snk_' + id]; if (!im) return null;
      const h = sh, w = h * im.width / im.height, x = port ? W * 0.03 : W * 0.07, y = H - h * 0.9 + dy + Math.sin(t * 1.1) * h * 0.006;
      g.drawImage(im, x, y, w, h);
      const m = MOUTH[id] || [0.6, 0.14];
      return { x: x + w * m[0], y: y + h * m[1], w, h, x0: x, y0: y };
    };
    let open = null;
    const sw = t - this.swapT;
    if (sw < 0.5 && this.prev) {
      box(this.prev, easeOut(sw / 0.22) * sh);
      open = box(this.snack, (1 - easeOut((sw - 0.22) / 0.28)) * sh);
    } else open = box(this.snack, out * sh * 1.1 + this.shake.v * 0.2);
    if (!open) return;
    // the right hand: by your mouth with a piece, lowered while you chew, into the box and back
    const bx = (port ? W * 0.03 : W * 0.07) + sh * 0.72, by = H - sh * 0.9;
    const ready = [Math.max(W * (port ? 0.6 : 0), bx + sh * 0.2), by + sh * 0.2], low = [bx + sh * 0.75, H * 1.07], dip = [open.x, open.y + sh * 0.04];
    const fe = t - this.fetchT, bi = t - this.pieceIn;
    let P, sc = 1, piece = this.holding;
    if (fe >= 0 && fe < 0.5 && sim.state !== 'ready') {
      if (fe < 0.22) { const u = easeInOut(fe / 0.22); P = [lerp(low[0], dip[0], u), lerp(low[1], dip[1], u)]; piece = false; }
      else { const u = easeOut((fe - 0.22) / 0.28); P = [lerp(dip[0], ready[0], u), lerp(dip[1], ready[1], u)]; piece = true; }
    } else if (!this.holding) {
      const u = easeOut(bi / 0.3); P = [lerp(ready[0] - W * 0.04, low[0], u), lerp(ready[1] + H * 0.05, low[1], u)]; sc = lerp(1.08, 1, u);
    } else P = [ready[0], ready[1] + Math.sin(t * 1.7) * H * 0.004];
    P[1] += out * sh * 1.2 + this.jig.v * 0.4; P[0] += Math.sin(t * 40) * this.jig.v * 0.15;
    const hp = I.hand_pick;
    if (hp) {
      const h = sh * 0.98 * sc, w = h * hp.width / hp.height;
      g.drawImage(hp, P[0] - w * PINCH[0], P[1] - h * PINCH[1], w, h);
      const pc = I['pc_' + this.snack];
      if (piece && pc) {
        const ps = w * 0.3, pw = ps, ph = ps * pc.height / pc.width, wob = this.sim.snack.wrap ? Math.sin(t * 30) * this.jig.v * 0.01 : 0;
        g.save(); g.translate(P[0] + w * 0.01, P[1] - ph * 0.28); g.rotate(-0.25 + wob); g.drawImage(pc, -pw / 2, -ph / 2, pw, ph); g.restore();
      }
    }
    this.drawWords(g, L, t);
  }
  drawWords(g, L, t) {
    // from your mouth: bottom centre of your view
    const { W, H } = L, mx = W * (L.port ? 0.56 : 0.5), my = H * (L.port ? 0.84 : 0.86);
    // crumbs: flakes thrown up out of your mouth (below the frame) that tumble back down
    const unit0 = Math.min(W, H * 0.8);
    for (const c of this.crumbs) {
      const u = (t - c.t0) / 0.8, T = u * 0.8, vx = (c.a - 0.5) * unit0 * 0.7, vy = -unit0 * (0.55 + c.b * 0.45);
      const x = mx + vx * T, y = H * 1.01 + vy * T + unit0 * 2.2 * T * T, r = unit0 * (0.006 + c.b * 0.006);
      if (y > H + r) continue;
      g.save(); g.translate(x, y); g.rotate(c.a * 9 + T * (c.b - 0.5) * 20); g.globalAlpha = clamp((1 - u) * 2.5);
      g.fillStyle = c.col; g.strokeStyle = 'rgba(20,10,6,0.85)'; g.lineWidth = Math.max(1, r * 0.35);
      g.beginPath(); g.moveTo(-r, -r * 0.4); g.lineTo(r * 0.3, -r * 0.9); g.lineTo(r, r * 0.2); g.lineTo(-r * 0.2, r * 0.8); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    for (const w of this.words) {
      const u = (t - w.t0) / 1.1, big = clamp((w.L - 45) / 40), unit = Math.min(W, H * 0.8);
      // heard: it jumps up and hangs there for the whole row. Swallowed: a short hop, then it sinks
      // steadily as it fades, so a quick run of chews stacks into a clean falling line, never a smudge
      const x = mx + w.x * unit * 0.28, y = my - unit * (w.heard ? 0.02 + 0.12 * easeOut(u * 2) : 0.02 + 0.07 * easeOut(u * 5) - 0.2 * u);
      const pop = u < 0.12 ? easeOut(u / 0.12) * 1.25 : lerp(1.25, 1, easeOut((u - 0.12) / 0.2));
      const size = unit * (w.heard ? 0.075 + 0.07 * big : 0.045 + 0.02 * big) * pop;
      const a = w.heard ? clamp((1 - u) * 3) : clamp((1 - u) * 2) * 0.55;
      g.save(); g.globalAlpha = a; g.translate(x + (w.heard ? Math.sin(t * 70) * size * 0.03 * (1 - u) : 0), y); g.rotate(w.x * 0.3 + (w.r - 0.5) * 0.08);
      if (w.heard) {
        // a comic burst behind the word: the whole row heard that
        g.font = `${Math.round(size)}px "Caveat Brush", cursive`;
        const rx = g.measureText(w.text).width * 0.62 + size * 0.45, ry = size * 0.82, n = 13;
        g.beginPath();
        for (let i = 0; i < n * 2; i++) {
          const q = (i / (n * 2)) * Math.PI * 2 + w.r, k = i % 2 ? 0.78 : 1.12 + 0.12 * Math.sin(i * 2.7 + w.r * 9);
          g.lineTo(Math.cos(q) * rx * k, Math.sin(q) * ry * k);
        }
        g.closePath(); g.fillStyle = '#fff1c9'; g.fill();
        g.lineWidth = Math.max(2, size * 0.07); g.strokeStyle = '#1b0a06'; g.stroke();
      }
      text(g, w.text, 0, 0, { font: `${Math.round(size)}px "Caveat Brush", cursive`, fill: w.heard ? '#e8252f' : 'rgba(200,215,235,0.9)', stroke: w.heard ? '#1b0a06' : 'rgba(10,16,32,0.8)', lw: Math.max(2, size * (w.heard ? 0.12 : 0.1)) });
      g.restore();
    }
  }
}
