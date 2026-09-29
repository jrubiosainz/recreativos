// Canvas HUD, dressed as station hardware: the station sign (駅名標) with the line colour and the next stop,
// the congestion gauge (乗車率, the score), the departure board (発車標) whose clock is the timer, the melody /
// door status strip, the next passengers in line, and the pause button.
import { FONT, JP } from './fx.js';
import { LINE } from './car.js';
import { LEVELS, serviceOf } from './levels.js';
import { makeLook } from './look.js';
import { drawCrowdHead } from './person.js';
import { clamp, lerp, damp, rgba, roundRect, Spring, TAU, ease } from './util.js';

const INK = '#1b1d26', PAPER = '#fbfaf6', BOARD = '#121317', LED = '#ffb23e', LED_G = '#8dffbf', RED = '#ff5d4d', GOLD = '#ffd35a';
const MONO = "'Fredoka', 'Zen Maru', system-ui, sans-serif";
const FACE = { eyes: 'dot', mouth: 'flat' };
const FACES = {
  granny: { eyes: 'happy', mouth: 'smile' }, tourist: { eyes: 'wide', mouth: 'smile' }, student: { eyes: 'dot', mouth: 'cat' },
  sumo: { eyes: 'dot', mouth: 'flat', brow: 0.8 }, sleepy: { eyes: 'closed', mouth: 'o', mouthK: 0.4 }, kid: { eyes: 'happy', mouth: 'grin' },
  cake: { eyes: 'dot', mouth: 'smile' }, runner: { eyes: 'squeeze', mouth: 'open' },
};

// fixed-advance digits so a ticking clock never jitters
function digits(g, str, x, y, adv, align = 'left') {
  let w = 0;
  for (const ch of str) w += ch === ':' || ch === '.' ? adv * 0.45 : adv;
  let cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  g.textAlign = 'center';
  for (const ch of str) {
    const a = ch === ':' || ch === '.' ? adv * 0.45 : adv;
    g.fillText(ch, cx + a / 2, y);
    cx += a;
  }
  return w;
}

function shadowed(g, x, y, w, h, r, fill, a = 0.3) {
  roundRect(g, x, y + Math.max(2, h * 0.05), w, h, r); g.fillStyle = `rgba(10,8,24,${a})`; g.fill();
  roundRect(g, x, y, w, h, r); g.fillStyle = fill; g.fill();
}

export class Hud {
  constructor(scene, opts = {}) {
    this.scene = scene; this.sim = scene.sim; this.L = scene.L;
    this.t = opts.t || ((k, f) => f ?? k);
    this.touch = !!opts.touch;
    this.time = 0;
    this.shown = this.sim.fill; // the gauge's displayed congestion
    this.base = this.sim.fill; // what it chases: only moves up when a boarding token lands
    this.nextA = 0;
    this.a = 1; this.fadeTo = 1; // whole-HUD fade: the result paperwork takes over the screen
    this.pop = new Spring(1, 380, 14);
    this.tokens = [];
    this.looks = new Map();
    this.flashBad = 0;
    this.W = 1; this.H = 1;
    scene.on((type, e) => this.onEvent(type, e));
  }

  onEvent(type, e) {
    if (type === 'board') {
      const from = this.scene.doorTop();
      this.tokens.push({ x: from.x, y: from.y, t: 0, pct: Math.round(e.p.P.fill * 100), fill: e.fill });
    } else if (type === 'incident') this.flashBad = 1;
  }

  layout(W, H, safeBottom = 0) {
    this.W = W; this.H = H;
    const port = H > W * 1.05;
    this.port = port;
    const u = port ? clamp(W / 400, 0.74, 1.12) : clamp(Math.min(W / 1280, H / 760), 0.66, 1.3);
    const m = Math.round(14 * u);
    this.u = u; this.m = m;
    if (!port) {
      const h = Math.round(80 * u), gap = Math.round(10 * u);
      this.sign = { x: m, y: m, w: Math.round(262 * u), h };
      this.pauseB = { r: Math.round(24 * u) };
      this.pauseB.x = W - m - this.pauseB.r; this.pauseB.y = m + this.pauseB.r;
      this.clock = { w: Math.round(232 * u), h: Math.round(h * 0.78), y: m };
      this.clock.x = this.pauseB.x - this.pauseB.r - gap - this.clock.w;
      this.status = { x: this.clock.x, y: m + this.clock.h + Math.round(6 * u), w: this.clock.w, h: Math.round(30 * u) };
      const gw = Math.round(clamp(W * 0.3, 280 * u, 420 * u));
      this.gauge = { x: Math.round((W - gw) / 2), y: m, w: gw, h: Math.round(h * 0.86) };
      const x0 = this.sign.x + this.sign.w + gap, x1 = this.clock.x - gap;
      if (this.gauge.x < x0 || this.gauge.x + gw > x1) { this.gauge.x = x0; this.gauge.w = Math.max(150, x1 - x0); }
      this.next = { x: m, y: m + h + Math.round(8 * u), h: Math.round(46 * u), n: 4 };
    } else {
      const h1 = Math.round(62 * u), h2 = Math.round(50 * u), gap = Math.round(8 * u);
      this.pauseB = { r: Math.round(20 * u) };
      this.pauseB.x = W - m - this.pauseB.r; this.pauseB.y = m + h1 / 2;
      this.sign = { x: m, y: m, w: W - 2 * m - this.pauseB.r * 2 - gap, h: h1 };
      const y2 = m + h1 + gap;
      const cw = Math.round((W - 2 * m - gap) * 0.42);
      this.clock = { x: W - m - cw, y: y2, w: cw, h: h2 };
      this.gauge = { x: m, y: y2, w: W - 2 * m - gap - cw, h: h2 };
      this.status = { x: this.clock.x, y: y2 + h2 + Math.round(6 * u), w: cw, h: Math.round(26 * u) };
      this.next = { x: m, y: y2 + h2 + Math.round(6 * u), h: Math.round(38 * u), n: 4 };
    }
    this.captionRect = { x: W / 2, y: this.next.y + this.next.h + Math.round(8 * u), w: Math.min(W - 2 * m, 560 * u) };
    if (!port) {
      // wide screens: the caption tucks under the gauge, between the 次 row and the status pill, so it
      // never sits on the face of the person in the doorway
      const nx = this.next.x + Math.round(this.next.h * 4.18 + 24 * u);
      const cw = Math.min(W - 2 * m, 780 * u, 2 * (Math.min(W / 2 - nx, this.status.x - W / 2) - Math.round(12 * u)));
      if (cw >= 400 * u) this.captionRect = { x: W / 2, y: this.gauge.y + this.gauge.h + Math.round(8 * u), w: Math.round(cw) };
    }
    // the camera frames the doorway on its own fractions of the screen; the HUD lives above the door top.
    // safeTop: floating judgement text must stay below the middle of the top bar
    const low = port ? Math.max(this.next.y + this.next.h, this.status.y + this.status.h) : this.gauge.y + this.gauge.h;
    this.safeTop = low + Math.round(6 * u);
    return { top: 0, bottom: 0, safeTop: this.safeTop };
  }
  // short wide screens: a caption that can't end above the heads in the doorway stands beside the door instead
  captionFit(D) {
    if (this.port) return { alt: null, limit: Infinity };
    const u = this.u, x0 = D.r + Math.round(14 * u), x1 = this.W - this.m;
    const alt = x1 - x0 >= 240 * u ? { x: Math.round((x0 + x1) / 2), y: this.status.y + this.status.h + Math.round(10 * u), w: Math.round(x1 - x0) } : null;
    return { alt, limit: D.top + Math.round(6 * u) };
  }

  // a PA announcement, captioned as a scrolling LED message on the status strip
  pa(jp, sub, dur) { this.paLine = jp ? { jp: jp.split('|')[0], sub, t: 0, dur } : null; }

  hitPause(x, y) { const b = this.pauseB; return Math.hypot(x - b.x, y - b.y) <= b.r * 1.4; }

  gaugeRange() { const L = this.L; return [0.8, Math.max(L.gold + 0.3, 1.6)]; }
  gaugeBar() {
    const { x, y, w, h } = this.gauge, u = this.u;
    const bx = x + Math.round(12 * u), bw = w - Math.round(24 * u), bh = Math.max(7, Math.round(h * 0.16)), by = y + h - bh - Math.round(13 * u);
    return { bx, by, bw, bh };
  }
  gaugeX(f) { const [a, b] = this.gaugeRange(), B = this.gaugeBar(); return B.bx + B.bw * clamp((f - a) / (b - a)); }

  update(dt) {
    this.time += dt;
    this.a = damp(this.a, this.fadeTo, 9, dt);
    // tokens fly from the door to the gauge; the gauge only rises when one lands
    for (const k of this.tokens) {
      k.t += dt;
      if (!k.done && k.t >= 0.55) { k.done = true; this.base = Math.max(this.base, k.fill); this.pop.v += 6; }
    }
    this.tokens = this.tokens.filter((k) => k.t < 0.9);
    if (!this.tokens.some((k) => !k.done)) this.base = this.sim.fill;
    this.shown = damp(this.shown, this.base, 12, dt);
    if (Math.abs(this.shown - this.base) < 5e-4) this.shown = this.base;
    this.pop.step(1, dt);
    const ph = this.sim.phase, want = (ph === 'arrive' && this.sim.t < 1.2) || ph === 'closing' || ph === 'shisa' || ph === 'depart' || ph === 'done' ? 0 : 1;
    this.nextA = damp(this.nextA, want, 8, dt);
    this.flashBad = Math.max(0, this.flashBad - dt * 1.6);
    if (this.paLine && (this.paLine.t += dt) > this.paLine.dur) this.paLine = null;
  }

  draw(g) {
    if (this.hidden || this.a < 0.01) return;
    g.save();
    g.globalAlpha = this.a;
    g.lineJoin = 'round';
    this.drawSign(g);
    this.drawGauge(g);
    this.drawClock(g);
    this.drawStatus(g);
    this.drawNext(g);
    this.drawPause(g);
    this.drawTokens(g);
    g.restore();
  }

  // ---------------------------------------------------------------- 駅名標
  drawSign(g) {
    const { x, y, w, h } = this.sign, u = this.u, L = this.L;
    shadowed(g, x, y, w, h, 8 * u, PAPER, 0.26);
    const bh = Math.round(h * 0.25);
    g.save(); roundRect(g, x, y, w, h, 8 * u); g.clip();
    g.fillStyle = LINE; g.fillRect(x, y + h - bh, w, bh);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y + h - bh, w, Math.max(1, bh * 0.08));
    g.restore();
    // station number badge, JR style: line letters over the number, in a line-coloured frame
    const top = h - bh, bs = Math.round(top * 0.78), bx = x + Math.round(9 * u), by = y + (top - bs) / 2;
    g.fillStyle = '#ffffff'; roundRect(g, bx, by, bs, bs, bs * 0.18); g.fill();
    g.lineWidth = Math.max(2, bs * 0.09); g.strokeStyle = LINE; roundRect(g, bx + g.lineWidth / 2, by + g.lineWidth / 2, bs - g.lineWidth, bs - g.lineWidth, bs * 0.15); g.stroke();
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(bs * 0.27)}px ${FONT}`; g.fillText(L.code.slice(0, 2), bx + bs / 2, by + bs * 0.32);
    g.font = `700 ${Math.round(bs * 0.42)}px ${FONT}`; g.fillText(L.code.slice(2), bx + bs / 2, by + bs * 0.66);
    // name
    const nx = bx + bs + Math.round(10 * u), room = x + w - nx - Math.round(8 * u);
    g.textAlign = 'left';
    let ks = Math.round(top * 0.5);
    g.font = `700 ${ks}px ${JP}`;
    const kw = g.measureText(L.kanji).width;
    if (kw > room) { ks = Math.floor(ks * room / kw); g.font = `700 ${ks}px ${JP}`; }
    g.fillStyle = INK; g.fillText(L.kanji, nx, y + top * 0.42);
    g.font = `600 ${Math.round(top * 0.2)}px ${FONT}`; g.fillStyle = '#5b5e6c';
    g.fillText(L.romaji, nx + 1, y + top * 0.8);
    // neighbours along the line
    const i = LEVELS.indexOf(L);
    const prev = LEVELS[i - 1]?.kanji, next = LEVELS[i + 1]?.kanji ?? '押込中央';
    g.font = `700 ${Math.round(bh * 0.6)}px ${JP}`; g.fillStyle = INK;
    const ty = y + h - bh / 2 + 1;
    if (prev) { g.textAlign = 'left'; g.fillText('◀ ' + prev, x + Math.round(8 * u), ty); }
    g.textAlign = 'right'; g.fillText(next + ' ▶', x + w - Math.round(8 * u), ty);
  }

  // ---------------------------------------------------------------- 乗車率
  drawGauge(g) {
    const { x, y, w, h } = this.gauge, u = this.u, L = this.L;
    const f = this.shown, pass = f >= L.target - 1e-6, gold = f >= L.gold - 1e-6;
    shadowed(g, x, y, w, h, 10 * u, 'rgba(18,19,26,0.86)', 0.28);
    if (this.flashBad > 0) { roundRect(g, x, y, w, h, 10 * u); g.fillStyle = rgba(RED, 0.35 * this.flashBad); g.fill(); }
    const B = this.gaugeBar();
    // label + number
    const midY = y + (B.by - y) * 0.52;
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = `700 ${Math.round(h * 0.25)}px ${JP}`; g.fillStyle = '#ffffff';
    g.fillText('乗車率', B.bx, midY - h * 0.05);
    const lw = g.measureText('乗車率').width;
    g.font = `600 ${Math.round(h * 0.15)}px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.6)';
    if (!this.port || w > 200) g.fillText(this.t('hud.load', 'load'), B.bx + lw + 7 * u, midY - h * 0.03);
    const pct = Math.round(f * 100);
    const sc = this.pop.x;
    g.save();
    const nx = B.bx + B.bw, ny = midY - h * 0.03;
    g.translate(nx, ny); g.scale(sc, sc);
    g.textAlign = 'right';
    g.font = `700 ${Math.round(h * 0.44)}px ${MONO}`;
    g.fillStyle = gold ? GOLD : pass ? LED_G : '#ffffff';
    g.fillText(pct + '%', 0, 0);
    g.restore();
    // bar
    const [a, b] = this.gaugeRange();
    g.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(g, B.bx, B.by, B.bw, B.bh, B.bh / 2); g.fill();
    const fx = this.gaugeX(f);
    if (fx > B.bx + 1) {
      const gr = g.createLinearGradient(B.bx, 0, B.bx + B.bw, 0);
      gr.addColorStop(0, '#39c9a8'); gr.addColorStop(clamp((L.target - a) / (b - a)), '#9df07a'); gr.addColorStop(1, '#ffcf4a');
      g.fillStyle = gr; roundRect(g, B.bx, B.by, fx - B.bx, B.bh, B.bh / 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(g, B.bx + 2, B.by + 1, Math.max(0, fx - B.bx - 4), B.bh * 0.3, B.bh * 0.15); g.fill();
    }
    // 100% notch, the pass mark (a notch with a pointer under the bar) and the gold star sitting on the bar
    const X1 = this.gaugeX(1);
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(X1 - 1, B.by, 2, B.bh);
    const tx = this.gaugeX(L.target), tc = pass ? LED_G : '#ffffff';
    g.fillStyle = tc; g.fillRect(tx - 1.25, B.by - 2 * u, 2.5, B.bh + 3 * u);
    g.beginPath(); g.moveTo(tx, B.by + B.bh + 1 * u); g.lineTo(tx - 4.5 * u, B.by + B.bh + 7.5 * u); g.lineTo(tx + 4.5 * u, B.by + B.bh + 7.5 * u); g.closePath(); g.fill();
    const gx = this.gaugeX(L.gold), gr = Math.max(6, B.bh * 0.95);
    star(g, gx, B.by + B.bh / 2, gr + 1.8, 'rgba(12,12,20,0.9)');
    star(g, gx, B.by + B.bh / 2, gr, gold ? GOLD : '#6b5a2a');
    if (!gold) star(g, gx, B.by + B.bh / 2, gr * 0.55, 'rgba(255,211,90,0.7)');
  }

  // ---------------------------------------------------------------- 発車標
  now() {
    const s = this.sim, [H, M, S] = this.L.dep;
    const sched = H * 3600 + M * 60 + S;
    const closeT = s.closedAt ?? s.t;
    return { now: sched - (s.T.sched - s.t), sched, late: Math.max(0, closeT - s.T.sched), open: s.closedAt == null };
  }

  drawClock(g) {
    const { x, y, w, h } = this.clock, u = this.u;
    shadowed(g, x, y, w, h, 7 * u, BOARD, 0.3);
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; roundRect(g, x + 2.5 * u, y + 2.5 * u, w - 5 * u, h - 5 * u, 5 * u); g.stroke();
    const c = this.now();
    const hms = (t) => { t = Math.max(0, Math.floor(t)); const hh = Math.floor(t / 3600), mm = Math.floor(t / 60) % 60, ss = t % 60; return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`; };
    const pad = Math.round(9 * u);
    // row 1: service, destination, scheduled departure
    const r1 = y + h * 0.3;
    g.textBaseline = 'middle';
    const tag = Math.round(h * 0.22);
    g.font = `700 ${tag}px ${JP}`;
    const sv = serviceOf(this.L), tw = g.measureText(sv.jp).width + tag * 0.7;
    g.fillStyle = sv.col; roundRect(g, x + pad, r1 - tag * 0.72, tw, tag * 1.44, tag * 0.25); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.fillText(sv.jp, x + pad + tw / 2, r1 + 1);
    g.textAlign = 'left'; g.fillStyle = LED; g.fillText('押込中央', x + pad + tw + 6 * u, r1 + 1);
    g.font = `700 ${Math.round(h * 0.25)}px ${MONO}`; g.fillStyle = LED;
    const sh = c.sched, sStr = `${Math.floor(sh / 3600)}:${String(Math.floor(sh / 60) % 60).padStart(2, '0')}`;
    digits(g, sStr, x + w - pad, r1 + 1, h * 0.15, 'right');
    // row 2: the station clock, ticking toward departure; red once you are late
    const r2 = y + h * 0.7;
    const late = c.open ? c.now > c.sched : c.late > 0.05;
    const blink = late && c.open ? (Math.sin(this.time * 9) > -0.2 ? 1 : 0.55) : 1;
    g.font = `700 ${Math.round(h * 0.38)}px ${MONO}`;
    g.fillStyle = late ? rgba(RED, blink) : '#ffffff';
    digits(g, hms(c.open ? c.now : c.sched + c.late), x + pad, r2 + 1, h * 0.215, 'left');
    g.textAlign = 'right';
    if (late) {
      const d = c.open ? c.now - c.sched : c.late;
      g.font = `700 ${Math.round(h * 0.2)}px ${JP}`; g.fillStyle = RED;
      g.fillText(`遅延 +${Math.max(1, Math.round(d))}s`, x + w - pad, r2 + 1);
    } else {
      const left = Math.max(0, c.sched - c.now);
      g.font = `600 ${Math.round(h * 0.18)}px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillText(c.open ? `−${Math.ceil(left)}s` : '✓', x + w - pad, r2 + 1);
    }
  }

  // ---------------------------------------------------------------- phase strip: melody, doors, point
  drawStatus(g) {
    const { x, y, w, h } = this.status, u = this.u, s = this.sim;
    let jp = '', sub = '', col = 'rgba(18,19,26,0.8)', prog = -1, tone = '#ffffff', lamp = false, pulse = 0;
    switch (s.phase) {
      case 'arrive': jp = 'まもなく到着'; sub = this.t('hud.arrive', 'arriving'); break;
      case 'board': jp = '乗車中'; sub = this.t('hud.board', 'boarding'); prog = clamp((s.t - s.T.board) / (s.T.melody - s.T.board)); break;
      case 'melody': jp = '♪ 発車メロディ'; sub = this.t('hud.melody', 'departure melody'); prog = clamp((s.t - s.T.melody) / (s.T.close - s.T.melody)); tone = LED; break;
      case 'closing': jp = 'ドアが閉まります'; sub = this.t('hud.closing', 'doors closing'); lamp = true; tone = '#ffd0c8'; col = 'rgba(120,24,20,0.86)'; break;
      case 'shisa': jp = '出発進行!'; sub = this.touch ? this.t('hud.pointTap', 'tap: point!') : this.t('hud.pointKey', 'space: point!'); pulse = 1; tone = GOLD; break;
      default: jp = '発車'; sub = this.t('hud.depart', 'departed'); tone = LED_G;
    }
    const sc = pulse ? 1 + 0.05 * Math.sin(this.time * 10) : 1;
    g.save();
    g.translate(x + w / 2, y + h / 2); g.scale(sc, sc); g.translate(-(x + w / 2), -(y + h / 2));
    shadowed(g, x, y, w, h, h / 2, col, 0.22);
    if (prog >= 0) {
      g.save(); roundRect(g, x, y, w, h, h / 2); g.clip();
      g.fillStyle = s.phase === 'melody' ? 'rgba(255,178,62,0.28)' : 'rgba(255,255,255,0.1)';
      g.fillRect(x, y, w * prog, h);
      g.restore();
    }
    let lx = x + h * 0.5;
    if (lamp) {
      const on = Math.sin(this.time * 12) > 0;
      g.fillStyle = on ? '#ff4b3e' : '#7a2a26';
      g.beginPath(); g.arc(lx + h * 0.12, y + h / 2, h * 0.2, 0, TAU); g.fill();
      if (on) { g.fillStyle = 'rgba(255,90,70,0.35)'; g.beginPath(); g.arc(lx + h * 0.12, y + h / 2, h * 0.38, 0, TAU); g.fill(); }
      lx += h * 0.5;
    }
    g.textBaseline = 'middle'; g.textAlign = 'left';
    if (this.paLine) { this.drawTicker(g, lx, x + w - h * 0.4, y, h); g.restore(); return; }
    g.font = `700 ${Math.round(h * 0.46)}px ${JP}`; g.fillStyle = tone;
    g.fillText(jp, lx, y + h / 2 + 1);
    const jw = g.measureText(jp).width;
    g.font = `600 ${Math.round(h * 0.34)}px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.62)';
    const room = x + w - h * 0.45 - (lx + jw + 7 * u);
    // the translation is a courtesy: show it whole or not at all
    if (sub && g.measureText(sub).width <= room) { g.textAlign = 'right'; g.fillText(sub, x + w - h * 0.45, y + h / 2 + 1); }
    g.restore();
  }

  drawTicker(g, x0, x1, y, h) {
    const P = this.paLine, u = this.u, cy = y + h / 2 + 1;
    // loudspeaker glyph
    const s = h * 0.2, sx = x0 + s * 0.3;
    g.fillStyle = LED;
    g.beginPath(); g.moveTo(sx, cy - s * 0.45); g.lineTo(sx + s * 0.55, cy - s * 0.45); g.lineTo(sx + s * 1.25, cy - s * 1.05); g.lineTo(sx + s * 1.25, cy + s * 1.05); g.lineTo(sx + s * 0.55, cy + s * 0.45); g.lineTo(sx, cy + s * 0.45); g.closePath(); g.fill();
    g.strokeStyle = LED; g.lineWidth = Math.max(1.2, h * 0.06); g.lineCap = 'round';
    const on = Math.floor(this.time * 3) % 3;
    for (let i = 0; i < 2; i++) { g.globalAlpha = (i <= on ? 1 : 0.35) * this.a; g.beginPath(); g.arc(sx + s * 1.25, cy, s * (0.75 + i * 0.6), -0.8, 0.8); g.stroke(); }
    g.globalAlpha = this.a;
    const a = sx + s * 2.9, room = x1 - a;
    const fj = `700 ${Math.round(h * 0.44)}px ${JP}`, fs = `600 ${Math.round(h * 0.4)}px ${FONT}`, gap = 12 * u;
    g.font = fj; const wj = g.measureText(P.jp).width;
    g.font = fs; const ws = P.sub ? g.measureText(P.sub).width : 0;
    const total = wj + (ws ? gap + ws : 0), over = Math.max(0, total - room);
    // hold, then scroll so the end of the message arrives as the voice finishes
    const off = over ? over * clamp((P.t - 0.55) / Math.max(0.6, P.dur - 1.3)) : 0;
    g.save(); g.beginPath(); g.rect(a - 2, y, room + 4, h); g.clip();
    g.font = fj; g.fillStyle = LED; g.fillText(P.jp, a - off, cy);
    if (ws) { g.font = fs; g.fillStyle = 'rgba(255,255,255,0.86)'; g.fillText(P.sub, a - off + wj + gap, cy); }
    g.restore();
  }

  // ---------------------------------------------------------------- 次: the next few passengers in line
  lookOf(p) {
    let L = this.looks.get(p.id);
    if (!L) { L = makeLook(p.type, p.look); this.looks.set(p.id, L); }
    return L;
  }

  drawNext(g) {
    const s = this.sim, N = this.next, u = this.u;
    if (this.nextA < 0.02) return;
    const list = s.queue.slice(s.qi, s.qi + N.n);
    if (!list.length) return;
    g.save();
    g.globalAlpha = this.nextA * this.a;
    g.translate(0, (1 - this.nextA) * -10 * u);
    const r0 = N.h / 2, r1 = r0 * 0.8, gap = Math.round(6 * u);
    let x = N.x;
    const lab = Math.round(N.h * 0.34);
    shadowed(g, x, N.y, Math.round(N.h * 0.78), N.h, 7 * u, LINE, 0.22);
    g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${lab * 1.25}px ${JP}`; g.fillText('次', x + N.h * 0.39, N.y + N.h * 0.4);
    g.font = `700 ${Math.max(8, lab * 0.55)}px ${FONT}`; g.fillText(this.t('hud.next', 'next').toUpperCase(), x + N.h * 0.39, N.y + N.h * 0.78);
    x += Math.round(N.h * 0.78) + gap;
    list.forEach((p, i) => {
      const r = i === 0 ? r0 : r1, cx = x + r, cy = N.y + N.h / 2 + (i === 0 ? 0 : r0 - r1);
      this.drawBubble(g, p, cx, cy, r, i === 0);
      x += r * 2 + gap;
    });
    g.restore();
  }

  drawBubble(g, p, cx, cy, r, first) {
    const L = this.lookOf(p), u = this.u;
    g.fillStyle = 'rgba(10,8,24,0.25)'; g.beginPath(); g.arc(cx, cy + 2, r, 0, TAU); g.fill();
    g.fillStyle = first ? '#ffffff' : '#e9ecef'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, r * 0.94, 0, TAU); g.clip();
    if (L.outfit === 'mascot') {
      const w = r * 1.05, hgt = r * 1.25;
      g.fillStyle = '#fff6de'; roundRect(g, cx - w / 2, cy - hgt * 0.36, w, hgt, r * 0.22); g.fill();
      g.strokeStyle = 'rgba(80,60,40,0.25)'; g.lineWidth = Math.max(1, r * 0.05); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(cx - w * 0.2, cy, r * 0.07, 0, TAU); g.arc(cx + w * 0.2, cy, r * 0.07, 0, TAU); g.fill();
      g.strokeStyle = '#4fb34a'; g.lineWidth = Math.max(1.5, r * 0.1); g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx, cy - hgt * 0.36); g.quadraticCurveTo(cx + r * 0.05, cy - hgt * 0.6, cx + r * 0.25, cy - hgt * 0.7); g.stroke();
    } else {
      const R = 0.15 * (L.head || 1);
      const sc = (r * 0.5) / R;
      drawCrowdHead(g, L, cx, cy - r * 0.08, sc, FACES[p.type] || FACE, { lod: 2, t: this.time });
    }
    g.restore();
    if (first) { g.strokeStyle = LINE; g.lineWidth = Math.max(2, r * 0.1); g.beginPath(); g.arc(cx, cy, r * 0.97, 0, TAU); g.stroke(); }
    // rule badges: hands off grandma, the cake needs a perfect push, heavy ones need more
    const badge = p.type === 'granny' ? 'nopush' : p.type === 'cake' ? 'cake' : p.type === 'sumo' || p.type === 'mascot' ? 'heavy' : p.type === 'sleepy' ? 'zz' : null;
    if (!badge) return;
    const bx = cx + r * 0.72, by = cy - r * 0.68, br = Math.max(7, r * 0.36);
    g.fillStyle = badge === 'nopush' ? '#e8412f' : badge === 'cake' ? '#ff7eb3' : badge === 'zz' ? '#6f7cff' : '#39424e';
    g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.5, br * 0.16); g.stroke();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (badge === 'nopush') {
      // an open hand with a slash
      g.font = `700 ${Math.round(br * 1.05)}px ${JP}`; g.fillText('✋', bx, by + 1);
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.5, br * 0.2); g.beginPath(); g.moveTo(bx - br * 0.62, by + br * 0.62); g.lineTo(bx + br * 0.62, by - br * 0.62); g.stroke();
    } else if (badge === 'cake') { star(g, bx, by, br * 0.62, '#ffffff'); }
    else if (badge === 'zz') { g.font = `700 ${Math.round(br * 0.95)}px ${FONT}`; g.fillText('z', bx, by + 1); }
    else { g.font = `700 ${Math.round(br * 1.05)}px ${JP}`; g.fillText('重', bx, by + 1); }
  }

  drawPause(g) {
    const b = this.pauseB;
    g.fillStyle = 'rgba(10,8,24,0.3)'; g.beginPath(); g.arc(b.x, b.y + 2, b.r, 0, TAU); g.fill();
    g.fillStyle = 'rgba(18,19,26,0.86)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill();
    g.fillStyle = '#ffffff';
    const bw = b.r * 0.22, bh = b.r * 0.8;
    roundRect(g, b.x - bw * 1.6, b.y - bh / 2, bw, bh, bw * 0.4); g.fill();
    roundRect(g, b.x + bw * 0.6, b.y - bh / 2, bw, bh, bw * 0.4); g.fill();
  }

  // "+7%" chips flying from the doorway into the gauge
  drawTokens(g) {
    const B = this.gaugeBar(), u = this.u;
    for (const k of this.tokens) {
      const p = ease.inOutCubic(clamp(k.t / 0.55));
      const tx = this.gaugeX(k.fill), ty = B.by + B.bh / 2;
      const x = lerp(k.x, tx, p), y = lerp(k.y, ty, p) - Math.sin(p * Math.PI) * 60 * u;
      const a = k.t < 0.55 ? 1 : 1 - (k.t - 0.55) / 0.35;
      const sc = k.t < 0.08 ? ease.outBack(k.t / 0.08) : k.t < 0.55 ? lerp(1, 0.7, p) : 0.7 + (k.t - 0.55) * 1.5;
      g.save(); g.globalAlpha = clamp(a) * this.a; g.translate(x, y); g.scale(sc, sc);
      const txt = `+${k.pct}%`;
      g.font = `700 ${Math.round(22 * u)}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const w = g.measureText(txt).width + 16 * u, h = 30 * u;
      roundRect(g, -w / 2, -h / 2, w, h, h / 2); g.fillStyle = '#16b89c'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#ffffff'; g.fillText(txt, 0, 1);
      g.restore();
    }
  }
}

function star(g, x, y, r, col) {
  g.fillStyle = col; g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}

// the queue bubble on its own, for the briefing ticket's "new on the platform" cards
export function drawPortrait(g, type, cx, cy, r, look = 20250) {
  const self = { looks: new Map(), lookOf: Hud.prototype.lookOf, u: r / 23, time: 0.4 };
  Hud.prototype.drawBubble.call(self, g, { id: 0, type, look }, cx, cy, r, true);
}
