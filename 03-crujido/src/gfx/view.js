// Everything you see from your seat, composed back to front: the room and the screen, the far
// rows, the cast row by row behind their seat backs, the neighbours at your elbows, the meter,
// the speech cards, your hands. The view bobs with your jaw; the usher's torch ends it all.
import { Screen } from './screen.js';
import { Audience, shushId } from './people.js';
import { personLight } from './person.js';
import { Hands } from './hands.js';
import { Meter, board } from './meter.js';
import { layout, place, room, roomLit, seatRow, makeCrowd, drawCrowd, aisle, finish } from './hall.js';
import { clamp, lerp, easeIn, easeOut, grain, text, wrap, rr, pop } from './paint.js';
import { USHER } from '../sim.js';

export class View {
  // line(id) -> { text, dur } for a voice line; tr(key) for cards and captions; word(kind, snack)
  constructor({ sim, level, images, sprites, tr, title, word, line }) {
    this.sim = sim; this.film = sim.film; this.level = level; this.sprites = sprites; this.tr = tr; this.line = line;
    this.screen = new Screen(sim.film, level.meta, images, { tr, title });
    this.aud = new Audience(sim, sim.film);
    this.hands = new Hands(sim, sprites, word);
    this.meter = new Meter();
    this.crowd = makeCrowd(level.i + 3);
    this.tiles = grain();
    this.jolts = sim.film.global.filter((c) => ['stinger', 'crowdscream', 'roar', 'thunder', 'boom'].includes(c.k)).map((c) => c.t);
    this.ccI = 0; this.strikeT = -9; this.L = null; this.inset = 0;
  }
  lay(W, H) { return this.L && this.L.W === W && this.L.H === H ? this.L : (this.L = layout(W, H)); }
  // the pause button: left of the logo in portrait (which moves over for it), the dark top-left corner in landscape
  pauseRect(W, H) {
    const L = this.lay(W, H);
    if (L.port) {
      const h = L.W * 0.105, y = Math.max(4, L.screen.y - h - L.m * 0.7), s = Math.round(clamp(h * 0.92, 34, 44));
      this.inset = s + L.m * 0.7;
      return { x: L.m, y: y + (h - s) / 2, w: s };
    }
    this.inset = 0;
    return { x: L.m, y: L.m, w: Math.round(clamp(L.H * 0.062, 38, 48)) };
  }
  // a sim event: the people and your hands react; returns the voice line it sets off, if any
  event(e) {
    this.aud.event(e); this.hands.event(e);
    let id = null, who = e.who;
    if (e.type === 'shush') { const p = this.sim.ppl.find((q) => q.id === e.who); id = shushId(p, e.n); if (e.strike) this.strikeT = e.t; }
    else if (e.type === 'wake') id = 'p_wake';
    else if (e.type === 'aid') id = 'p_aid';
    else if (e.type === 'usher') this.usherLine = { t: e.t + USHER * 0.45, said: false };
    if (id) { const l = this.line(id); if (l) this.aud.say(who, l.text, l.dur, e.t, e.type === 'shush' ? 'shush' : 'say'); }
    return id;
  }
  // returns the id of a voice line due now (the usher's), for the caller to play
  update(t, dt) {
    let due = null;
    const ul = this.usherLine;
    if (ul && !ul.said && t >= ul.t) { ul.said = true; due = 'p_usher'; const l = this.line('p_usher'); ul.text = l?.text; ul.dur = l?.dur || 1.5; }
    // lines said in the room by the film's own people: a card over their head as they speak
    const cc = this.film.cc;
    while (this.ccI < cc.length && cc[this.ccI].t <= t) {
      const c = cc[this.ccI++];
      if (!c.src || t - c.t > 0.5) continue;
      const who = this.sim.ppl.find((q) => q.id === c.src);
      if (who?.hush?.(c.t)) continue;
      const s = c.line ? this.line(c.line)?.text : this.tr(c.key);
      if (s) this.aud.say(c.src, c.line ? s : `♪ ${s} ♪`, c.dur, c.t);
    }
    this.aud.update(t, dt); this.hands.update(t, dt); this.meter.update(this.sim, t, dt);
    return due;
  }

  draw(g, W, H, dpr, t) {
    const L = this.lay(W, H), s = L.screen, sim = this.sim;
    const bob = this.hands.view(H);
    g.save(); g.translate(0, bob);
    room(g, L, this.screen.light, dpr);
    const Ls = this.screen.draw(g, t, s.x, s.y, s.w, s.h, dpr), pl = personLight(Ls), lit = roomLit(Ls);
    const jolt = (h) => { let v = 0; for (const j of this.jolts) { const u = t - j - 0.05 - h * 0.15; if (u > 0 && u < 0.6) v = Math.max(v, Math.sin(u / 0.6 * Math.PI) * 0.35 * (1 - u / 0.6)); } return v; };
    drawCrowd(g, L, this.crowd, Ls, t, jolt);
    this.captions(g, L, t);
    aisle(g, L, lit);
    const at = (p) => place(L, p.x, p.z);
    for (const r of [3, 2, 1]) { this.aud.drawRow(g, r, at, pl); seatRow(g, L, r, this.sprites.seat_back, lit); }
    this.aud.drawRow(g, 0, at, pl);
    this.meter.draw(g, L.meter, dpr, t);
    this.board(g, L, t, dpr);
    g.restore();
    this.aud.drawOver(g, t, W, dpr);
    this.hands.draw(g, L, t, dpr);
    this.usher(g, L, t);
    finish(g, L, t, dpr, this.tiles);
  }
  board(g, L, t, dpr) {
    const sim = this.sim, n = Math.max(0, sim.combo.length - sim.piece), pc = this.sprites['pc_' + sim.snack.id];
    const w = L.port ? L.W * 0.36 : L.H * 0.3, h = L.port ? L.W * 0.105 : L.H * 0.13;
    const R = L.port ? { x: L.W - L.m - w, y: Math.max(4, L.screen.y - h - L.m * 0.7), w, h } : { x: L.W - w - L.m, y: L.H - h - L.m, w, h };
    if (L.port) {
      const size = Math.round(h * 0.62);
      text(g, 'CRUJIDO', L.m + this.inset, R.y + h / 2, { font: `${size}px Limelight, serif`, fill: '#ffd98a', stroke: '#2a0508', lw: Math.max(2, size * 0.14), align: 'left', shadow: 'rgba(255,170,60,0.7)', blur: size * 0.45 });
    }
    board(g, R, { n, piece: pc, strikes: sim.strikes, dpr, t, flash: clamp(1 - (t - this.strikeT) / 0.5) });
  }
  // subtitles for the film's lines and sounds, low in the picture
  captions(g, L, t) {
    const s = L.screen, list = this.film.captionsAt(t).filter((c) => !c.src).slice(-2);
    if (!list.length) return;
    const size = Math.round(clamp(s.h * 0.068, 13, 30)), font = `700 ${size}px Atkinson, sans-serif`;
    g.save(); g.font = font;
    let y = s.y + s.h - size * 0.9;
    for (const c of list.reverse()) {
      const sfx = !c.line, str = c.line ? this.line(c.line)?.text : `[${this.tr(c.key)}]`;
      if (!str) continue;
      const a = clamp((t - c.t) / 0.12) * clamp((c.t + c.dur - t) / 0.15);
      const rows = wrap(g, str, s.w * 0.86, 2);
      g.globalAlpha = a;
      for (let i = rows.length - 1; i >= 0; i--) {
        text(g, rows[i], s.x + s.w / 2, y, { font, fill: sfx ? '#ffd35e' : '#fbf6ea', stroke: 'rgba(0,0,0,0.85)', lw: Math.max(3, size * 0.22) });
        y -= size * 1.18;
      }
    }
    g.restore();
  }
  // three strikes: the usher's torch comes down the aisle, finds you and fills your eyes
  usher(g, L, t) {
    const u0 = this.sim.usherT;
    if (u0 == null || t < u0) return;
    const u = clamp((t - u0) / USHER), { W, H } = L;
    const ox = W * 1.04, oy = L.hz + (H - L.hz) * 0.1, tx = lerp(W * 0.25, W * 0.5, easeOut(u)), ty = lerp(L.hz, H * 0.62, easeOut(u));
    const ang = Math.atan2(ty - oy, tx - ox), len = Math.hypot(tx - ox, ty - oy) * 1.4, spread = lerp(0.12, 0.34, u);
    g.save();
    g.fillStyle = `rgba(0,0,0,${0.35 * easeOut(u * 2)})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(ox, oy, 0, ox, oy, len);
    gr.addColorStop(0, `rgba(255,244,210,${0.3 + 0.25 * u})`); gr.addColorStop(0.6, `rgba(255,230,180,${0.1 + 0.16 * u})`); gr.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = gr;
    for (const f of [1, 0.72, 0.45]) { g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, len, ang - spread * f, ang + spread * f); g.closePath(); g.fill(); }
    const lens = g.createRadialGradient(ox, oy, 0, ox, oy, Math.min(W, H) * 0.12);
    lens.addColorStop(0, 'rgba(255,252,240,0.95)'); lens.addColorStop(0.25, 'rgba(255,236,190,0.45)'); lens.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = lens; g.fillRect(ox - W * 0.2, oy - H * 0.2, W * 0.4, H * 0.4);
    const flare = easeIn(clamp((u - 0.6) / 0.4));
    if (flare > 0) {
      const fg = g.createRadialGradient(W * 0.5, H * 0.62, 0, W * 0.5, H * 0.62, Math.max(W, H) * (0.3 + flare));
      fg.addColorStop(0, `rgba(255,250,235,${flare})`); fg.addColorStop(1, 'rgba(255,250,235,0)');
      g.fillStyle = fg; g.fillRect(0, 0, W, H);
    }
    g.restore();
    const ul = this.usherLine;
    if (ul?.said && ul.text) {
      const k = pop((t - ul.t) * 1.4, 3, 6), fade = clamp(1 - flare * 1.6), size = Math.round(clamp(W * 0.045, 16, 30));
      if (k > 0 && fade > 0) {
        g.save(); g.font = `${size}px "Caveat Brush", cursive`;
        const tw = g.measureText(ul.text).width, bw = tw + size * 1.1, bh = size * 1.6, cx = W - L.m - bw / 2, cy = oy - size * 1.8;
        g.globalAlpha = fade; g.translate(cx, cy); g.rotate(-0.05); g.scale(k, k);
        g.fillStyle = 'rgba(0,0,0,0.45)'; rr(g, -bw / 2 + 3, -bh / 2 + 4, bw, bh, size * 0.2); g.fill();
        g.fillStyle = '#fff7df'; rr(g, -bw / 2, -bh / 2, bw, bh, size * 0.2); g.fill();
        g.lineWidth = Math.max(2, size * 0.1); g.strokeStyle = '#1b1210'; g.stroke();
        text(g, ul.text, 0, 0, { font: g.font, fill: '#1b2430' });
        g.restore();
      }
    }
  }
}
