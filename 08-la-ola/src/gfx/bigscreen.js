// The videomarcador. On air it shows the PROGRAMA feed, live; off air, the dimmed preview of the shot
// and the scoreboard's shouts. The band along the bottom never goes away: the minute, 0–0, the laps of
// the best wave and how much signal is left. When the director takes it for a replay, or the signal
// runs out, you see that too.
import { Feed } from './pip.js';
import { LAP, lapColour } from './crowd.js';
import { F } from '../fonts.js';
import { t, plural, fmtLaps } from '../i18n.js';
import { P as SP } from '../sim.js';
import { clamp, TAU, ease, roundRect } from '../util.js';

const AMBER = '#ffb31a', GREEN = '#39ff7a', RED = '#ff3b30', WHITE = '#f4f1ea';

export class BigScreen {
  constructor() { this.feed = new Feed(); this.msgs = []; this.kissT = 0; this.t = 0; this.aired = false; }
  load(lv, ring, sim) { this.lv = lv; this.feed.load(ring); this.msgs.length = 0; this.kissT = 0; this.t = 0; this.aired = false; this.intro = 3.4; }
  resize(r, d) {
    this.r = r; this.d = d;
    const b = Math.round(Math.max(3 * d, r.w * 0.016));
    const ix = r.x + b, iy = r.y + b, iw = r.w - 2 * b, ih = r.h - 2 * b;
    const bh = Math.round(Math.max(24 * d, ih * 0.2));
    this.b = b; this.in = { x: ix, y: iy, w: iw, h: ih - bh }; this.band = { x: ix, y: iy + ih - bh, w: iw, h: bh };
    this.feed.resize(iw, ih - bh);
    // the LED grid, one cell every few device pixels
    const cell = Math.max(2, Math.round(2.5 * d)), p = document.createElement('canvas'); p.width = p.height = cell;
    const pg = p.getContext('2d'); pg.fillStyle = 'rgba(0,0,0,0.3)'; pg.fillRect(cell - Math.max(1, cell / 3), 0, Math.max(1, cell / 3), cell); pg.fillRect(0, cell - Math.max(1, cell / 3), cell, Math.max(1, cell / 3));
    this.grid = p; this.gridPat = null;
  }
  event(e, sim) {
    const say = (text, color, life = 1.6) => { this.msgs.push({ text, color, t: 0, life }); if (this.msgs.length > 3) this.msgs.shift(); };
    switch (e.k) {
      case 'ola': say(t('led.ola'), AMBER, 1.8); break;
      case 'lap': if (e.id === sim.bestId || sim.waves[e.id]?.laps >= sim.best - 1e-6) say(t('led.lap', { n: e.n }), LAP[Math.min(LAP.length - 1, e.n)], 2); break;
      case 'rescue': say(t('led.rescue'), WHITE, 1.4); break;
      case 'palco': say(t('led.palco'), '#ffd45e', 1.8); break;
      case 'kiss': this.kissT = 2.6; break;
      case 'air': if (e.on) this.aired = true; break;
    }
  }
  update(dt) {
    this.t += dt; this.intro -= dt; this.kissT = Math.max(0, this.kissT - dt);
    for (const m of this.msgs) m.t += dt;
    this.msgs = this.msgs.filter((m) => m.t < m.life);
  }

  draw(g, sim, now, sc) {
    const r = this.r, d = this.d, b = this.b, A = this.in, lv = this.lv;
    // the housing
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(g, r.x + 3 * d, r.y + 5 * d, r.w, r.h, b * 1.6); g.fill();
    g.fillStyle = '#1b1d23'; roundRect(g, r.x, r.y, r.w, r.h, b * 1.6); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = Math.max(1, d); roundRect(g, r.x + 0.5 * d, r.y + 0.5 * d, r.w - d, r.h - d, b * 1.5); g.stroke();
    g.fillStyle = '#040506'; g.fillRect(A.x, A.y, A.w, A.h + this.band.h);
    g.beginPath(); g.rect(A.x, A.y, A.w, A.h); g.clip();
    const on = sim.cam.onAir && !sim.end;
    if (sim.end) this.drawEnd(g, sim, now);
    else if (sim.cut > 0) this.drawBars(g, sim, now);
    else if (sim.lock > 0) this.drawReplay(g, sim, now);
    else {
      this.feed.draw(sim, sc.crowd, sc.camX, now, sc.wx, this.kissT);
      g.globalAlpha = on ? 1 : 0.34;
      g.drawImage(this.feed.c, A.x, A.y);
      g.globalAlpha = 1;
      if (on && this.kissT > 0) this.drawKissCam(g, now);
      this.tag(g, on ? `● ${t('led.live')}` : t('led.preview'), on ? RED : 'rgba(244,241,234,0.7)', on && Math.sin(now * 6) < -0.6);
      if (!on) {
        if (this.intro > 0) this.drawIntro(g, sim, now);
        else if (!this.msgs.length && !this.aired) this.led(g, t('led.hold'), A.x + A.w / 2, A.y + A.h * 0.52, A.h * 0.13, WHITE, 0.55 + 0.45 * Math.sin(now * 3.4));
      }
      if (sim.warn > 0) this.lowerThird(g, t('led.replayIn', { n: Math.ceil(sim.warn) }), AMBER, Math.sin(now * 10) > -0.4);
    }
    // the shouts: big when off air, a lower third over a live picture
    for (const m of this.msgs) {
      if (sim.cut > 0 || sim.end) break;
      const u = m.t / m.life, a = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1, pop = m.t < 0.2 ? ease.outBack(m.t / 0.2, 2) : 1;
      if (on || sim.lock > 0) { this.lowerThird(g, m.text, m.color, true, a); break; }
      this.led(g, m.text, A.x + A.w / 2, A.y + A.h * 0.5, A.h * 0.3 * pop, m.color, a * (Math.sin(m.t * 22) > -0.7 ? 1 : 0.6));
      break;
    }
    // the LED texture over the picture
    g.globalAlpha = 1;
    this.gridPat ||= g.createPattern(this.grid, 'repeat');
    g.fillStyle = this.gridPat; g.fillRect(A.x, A.y, A.w, A.h);
    g.restore();
    this.drawBand(g, sim, now);
    // a sheen across the glass
    g.save(); g.beginPath(); g.rect(A.x, A.y, A.w, A.h + this.band.h); g.clip();
    const sh = g.createLinearGradient(A.x, A.y, A.x + A.w * 0.5, A.y + A.h);
    sh.addColorStop(0, 'rgba(255,255,255,0.07)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(A.x, A.y, A.w, A.h + this.band.h);
    g.restore();
  }

  led(g, text, x, y, px, color, alpha = 1, align = 'center') {
    px = Math.max(8, Math.round(px));
    g.save();
    g.globalAlpha = clamp(alpha);
    g.font = F.led(px, 900); g.textAlign = align; g.textBaseline = 'middle';
    // shrink to fit the screen
    const maxW = this.in.w * 0.92, w = g.measureText(text).width;
    if (w > maxW) { px = Math.floor(px * (maxW / w)); g.font = F.led(px, 900); }
    g.shadowColor = color; g.shadowBlur = px * 0.35; g.fillStyle = color;
    g.fillText(text, x, y);
    g.shadowBlur = 0; g.restore();
  }
  tag(g, text, color, dim) {
    const A = this.in, px = Math.max(9 * this.d, Math.round(A.h * 0.075));
    g.font = F.body(px, 700); g.textAlign = 'left'; g.textBaseline = 'middle';
    const w = g.measureText(text).width, pad = px * 0.45;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(A.x + pad, A.y + pad, w + pad * 2, px * 1.5);
    g.fillStyle = dim ? 'rgba(255,255,255,0.35)' : color; g.fillText(text, A.x + pad * 2, A.y + pad + px * 0.78);
  }
  lowerThird(g, text, color, show = true, a = 1) {
    if (!show) return;
    const A = this.in, h = Math.round(A.h * 0.2), y = A.y + A.h - h - A.h * 0.07;
    g.save(); g.globalAlpha = a;
    g.fillStyle = 'rgba(4,5,8,0.82)'; g.fillRect(A.x, y, A.w, h);
    g.fillStyle = color; g.fillRect(A.x, y, Math.max(3, this.d * 3), h);
    g.restore();
    this.led(g, text, A.x + A.w / 2, y + h / 2, h * 0.62, color, a);
  }
  drawIntro(g, sim, now) {
    const A = this.in, lv = this.lv, lang = document.documentElement.lang === 'en' ? 'en' : 'es';
    const a = clamp(Math.min(this.intro / 0.4, (3.4 - this.intro) / 0.3));
    g.fillStyle = `rgba(4,5,6,${0.75 * a})`; g.fillRect(A.x, A.y, A.w, A.h);
    this.led(g, lv.name[lang], A.x + A.w / 2, A.y + A.h * 0.36, A.h * 0.2, AMBER, a);
    const goal = t('led.goal', { n: `${lv.goal} ${t('led.laps')}` });
    this.led(g, goal, A.x + A.w / 2, A.y + A.h * 0.64, A.h * 0.12, WHITE, a);
  }
  drawBars(g, sim, now) {
    const A = this.in, cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
    const bw = A.w / cols.length;
    cols.forEach((c, j) => { g.fillStyle = c; g.fillRect(A.x + j * bw, A.y, bw + 1, A.h * 0.7); });
    g.fillStyle = '#101010'; g.fillRect(A.x, A.y + A.h * 0.7, A.w, A.h * 0.3);
    // snow
    g.fillStyle = 'rgba(255,255,255,0.15)';
    for (let j = 0; j < 120; j++) g.fillRect(A.x + Math.random() * A.w, A.y + Math.random() * A.h, 2 * this.d, 1 * this.d);
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(A.x + A.w * 0.12, A.y + A.h * 0.26, A.w * 0.76, A.h * 0.3);
    this.led(g, t('led.noSignal'), A.x + A.w / 2, A.y + A.h * 0.41, A.h * 0.17, WHITE);
    this.led(g, `${t('led.back')} ${Math.ceil(sim.cut)}`, A.x + A.w / 2, A.y + A.h * 0.85, A.h * 0.11, AMBER);
  }
  drawReplay(g, sim, now) {
    const A = this.in;
    // a toy replay of the chance that wasn't: the ball rolls wide of the post
    g.fillStyle = '#1f5e2a'; g.fillRect(A.x, A.y, A.w, A.h);
    for (let j = 0; j < 8; j++) { g.fillStyle = j % 2 ? '#236832' : '#1f5e2a'; g.fillRect(A.x + (j * A.w) / 8, A.y, A.w / 8 + 1, A.h); }
    const u = 1 - sim.lock / 4, gx = A.x + A.w * 0.86, gy = A.y + A.h * 0.5;
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, this.d * 2);
    g.strokeRect(gx, gy - A.h * 0.18, A.w * 0.1, A.h * 0.36);
    const bx = A.x + A.w * (0.2 + 0.72 * u), by = gy + A.h * (0.1 - 0.4 * u * u);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, Math.max(3, A.h * 0.035), 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(A.x, A.y, A.w, A.h * 0.24);
    this.led(g, `◀◀ ${t('led.replay')}`, A.x + A.w / 2, A.y + A.h * 0.12, A.h * 0.13, AMBER, Math.sin(now * 5) > -0.5 ? 1 : 0.6);
  }
  drawKissCam(g, now) {
    const A = this.in, cx = A.x + A.w / 2, cy = A.y + A.h * 0.5, s = A.h * 0.55;
    g.save();
    g.strokeStyle = '#ff4f7b'; g.lineWidth = Math.max(3, this.d * 4); g.shadowColor = '#ff4f7b'; g.shadowBlur = 12 * this.d;
    g.beginPath(); g.moveTo(cx, cy + s * 0.8);
    g.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.4);
    g.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.8); g.stroke();
    g.restore();
    this.led(g, t('led.kissCam'), cx, A.y + A.h * 0.1, A.h * 0.11, '#ff7fa3');
  }
  // the same number the result board and the share card show: the best wave, to a tenth of a lap
  drawEnd(g, sim, now) {
    const A = this.in, e = sim.end, cx = A.x + A.w / 2, laps = Math.floor(e.best * 10 + 1e-6) / 10;
    const col = laps > 0 ? lapColour(laps) : '#ff5a4f', blink = Math.sin(now * 4) > -0.8 ? 1 : 0.7;
    this.led(g, t('led.end'), cx, A.y + A.h * 0.2, A.h * 0.12, WHITE);
    this.led(g, fmtLaps(laps), cx, A.y + A.h * 0.52, A.h * 0.36, col, blink);
    this.led(g, plural('card.laps', laps), cx, A.y + A.h * 0.83, A.h * 0.12, col);
  }

  drawBand(g, sim, now) {
    const B = this.band, d = this.d, lv = this.lv, h = B.h;
    g.fillStyle = '#07080b'; g.fillRect(B.x, B.y, B.w, h);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(B.x, B.y, B.w, Math.max(1, d));
    const [m0, m1] = lv.min, T = sim.end ? lv.time : sim.time;
    const minute = Math.min(m1, Math.floor(m0 + ((m1 - m0) * T) / lv.time));
    const best = sim.best, col = best > 0 ? lapColour(best) : WHITE;
    const clock = t('led.minute', { m: minute }), score = '0-0', lapsL = t('led.laps'), val = fmtLaps(best), goal = `/${lv.goal}`, airL = t('led.air');
    const segs = 8;
    // measure everything at full size, then shrink the lot if the band is too narrow for it
    const lay = (k) => {
      const big = h * 0.62 * k, small = Math.max(7 * d, h * 0.26 * k), pad = h * 0.32 * k, sw = Math.max(2 * d, h * 0.15 * k), sg = sw * 0.45;
      g.font = F.led(big, 900); const cw = g.measureText(clock).width, vw = g.measureText(val).width;
      g.font = F.led(big * 0.62, 800); const scw = g.measureText(score).width;
      g.font = F.led(big * 0.55, 800); const gw = g.measureText(goal).width;
      g.font = F.body(small, 700); const lw = g.measureText(lapsL).width, aw = g.measureText(airL).width;
      const mw = segs * (sw + sg) - sg;
      const need = pad + cw + pad + scw + pad * 1.5 + lw + pad * 0.4 + vw + gw + pad * 1.5 + aw + pad * 0.5 + mw + pad;
      return { big, small, pad, sw, sg, cw, vw, scw, gw, lw, aw, mw, need };
    };
    let L = lay(1);
    if (L.need > B.w) L = lay(B.w / L.need);
    const { big, small, pad, sw, sg } = L, cy = B.y + h / 2;
    g.save(); g.textBaseline = 'middle'; g.textAlign = 'left';
    // the clock, 80' to 90'
    let x = B.x + pad;
    g.font = F.led(big, 900); g.shadowColor = AMBER; g.shadowBlur = big * 0.3; g.fillStyle = AMBER;
    g.fillText(clock, x, cy); x += L.cw + pad; g.shadowBlur = 0;
    g.font = F.led(big * 0.62, 800); g.fillStyle = WHITE; g.fillText(score, x, cy); x += L.scw + pad * 1.5;
    // the signal meter, on the right
    const mx = B.x + B.w - pad - L.mw, lit = Math.ceil(sim.air * segs - 1e-6);
    const c = sim.air > 0.5 ? GREEN : sim.air > 0.25 ? AMBER : RED, blink = sim.cam.onAir && sim.air < 0.25 && Math.sin(now * 14) < 0;
    for (let j = 0; j < segs; j++) {
      g.fillStyle = j < lit && !blink ? c : 'rgba(255,255,255,0.08)';
      g.fillRect(mx + j * (sw + sg), cy - h * 0.25, sw, h * 0.5);
    }
    g.font = F.body(small, 700); g.fillStyle = 'rgba(244,241,234,0.55)';
    const ax = mx - pad * 0.5 - L.aw; g.fillText(airL, ax, cy);
    // the laps of the best wave, centred in what's left between
    const block = L.lw + pad * 0.4 + L.vw + L.gw, x1 = ax - pad * 1.5;
    let lx = x + Math.max(0, (x1 - x - block) / 2);
    g.fillText(lapsL, lx, cy); lx += L.lw + pad * 0.4;
    g.font = F.led(big, 900); g.shadowColor = col; g.shadowBlur = big * 0.3; g.fillStyle = col; g.fillText(val, lx, cy); lx += L.vw;
    g.shadowBlur = 0; g.font = F.led(big * 0.55, 800); g.fillStyle = 'rgba(244,241,234,0.6)'; g.fillText(goal, lx, cy + big * 0.12);
    g.restore();
  }
}

