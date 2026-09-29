// Canvas HUD: boss sleep meter, presentation status (the timing tool), clock + strike cards,
// the hold-to-yawn button (a sleepy face whose mouth is yours), subtitles and crowd speech.
import { TUNE, Y } from './sim.js';
import { FONT } from './fx.js';
import { COL, drawEye } from './scene.js';
import { clamp, lerp, smooth, rgba, roundRect, ellipse, Spring, fmtTime, TAU, mix } from './util.js';

const INK = '#1d1733', CREAM = '#fff8ec', LAV = '#b9acdf', GREEN = '#5ad38f';
const SLIDE_TINTS = ['#9fd0ff', '#ffd59a', '#b8f0c2', '#ffb3c7', '#d6c4ff', '#fff1a8', '#a8f0ec'];

function panel(g, x, y, w, h, r) {
  roundRect(g, x, y + 3, w, h, r); g.fillStyle = 'rgba(8,5,20,0.28)'; g.fill();
  roundRect(g, x, y, w, h, r); g.fillStyle = 'rgba(26,20,50,0.82)'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.09)'; g.lineWidth = 1; g.stroke();
}

function wrap(g, text, maxW) {
  const words = text.split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const tryL = cur ? cur + ' ' + w : w;
    if (g.measureText(tryL).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tryL;
  }
  if (cur) lines.push(cur);
  return lines;
}

export class Hud {
  constructor(scene, opts = {}) {
    this.scene = scene; this.sim = scene.sim;
    this.t = opts.t || ((k) => k);
    this.touch = !!opts.touch;
    this.time = 0;
    this.shown = 0;
    this.fill = 0;
    this.meterBump = new Spring(1, 320, 12);
    this.meterFlash = 0;
    this.strikeT = [9, 9, 9];
    this.btnScale = new Spring(1, 520, 24);
    this.pressed = false;
    this.sub = null;
    this.says = [];
    this.presShake = 0;
    this.lastSlide = 0; this.slideT = 9;
    this.keyHint = opts.keyHint ?? true;
    this.W = 1; this.H = 1;
    scene.meterTarget = () => this.meterTip();
    scene.on((e) => this.onEvent(e));
  }

  onEvent(e) {
    if (e.type === 'orb') {
      this.shown = Math.max(this.shown, e.n); this.meterFlash = 1;
      // long chains send orbs back to back: kick only with the headroom left so the face pops, never balloons
      const b = this.meterBump; b.v = Math.min(5.5, Math.max(b.v, 0) + 5.5 * (1 - clamp((b.x - 1) / 0.35)));
    }
    else if (e.type === 'callout' && e.player) this.strikeT[e.strikes - 1] = 0;
    else if (e.type === 'suspect') this.presShake = 1;
    else if (e.type === 'end' && e.kind === 'win') this.winT = 0;
  }

  layout(W, H, safeBottom = 0) {
    this.W = W; this.H = H;
    const port = H > W * 1.05;
    this.port = port;
    const u = port ? clamp(W / 400, 0.72, 1.12) : clamp(Math.min(W / 1280, H / 760), 0.7, 1.3);
    const m = Math.round(14 * u);
    this.u = u; this.m = m;
    if (!port) {
      const h = Math.round(62 * u), gap = Math.round(10 * u);
      this.meter = { x: m, y: m, w: Math.round(318 * u), h };
      this.pauseB = { r: Math.round(h * 0.4) };
      this.pauseB.x = W - m - this.pauseB.r; this.pauseB.y = m + h / 2;
      this.clock = { w: Math.round(196 * u), h, y: m };
      this.clock.x = this.pauseB.x - this.pauseB.r - gap - this.clock.w;
      const pw = Math.round(372 * u);
      this.pres = { x: Math.round((W - pw) / 2), y: m, w: pw, h };
      const x0 = this.meter.x + this.meter.w + gap, x1 = this.clock.x - gap;
      if (this.pres.x < x0 || this.pres.x + pw > x1) { this.pres.x = x0; this.pres.w = Math.max(160, x1 - x0); }
      const br = Math.round(58 * u);
      this.btn = { x: W - m - br - Math.round(8 * u), y: H - m - br - Math.round(14 * u) - safeBottom, r: br };
      this.subY = H - m - Math.round(26 * u) - safeBottom;
      this.subW = Math.min(W * 0.46, 620 * u);
      this.insets = { top: m + h + Math.round(14 * u), bottom: Math.round(16 * u), left: m, right: m };
    } else {
      const h1 = Math.round(50 * u), h2 = Math.round(54 * u), gap = Math.round(8 * u);
      this.pauseB = { r: Math.round(h1 * 0.42) };
      this.pauseB.x = W - m - this.pauseB.r; this.pauseB.y = m + h1 / 2;
      this.meter = { x: m, y: m, w: W - 2 * m - this.pauseB.r * 2 - gap, h: h1 };
      const y2 = m + h1 + gap;
      this.pres = { x: m, y: y2, w: Math.round((W - 2 * m - gap) * 0.61), h: h2 };
      this.clock = { x: m + this.pres.w + gap, y: y2, w: W - 2 * m - gap - this.pres.w, h: h2 };
      const br = Math.round(clamp(W * 0.15, 46, 66));
      this.btn = { x: W - m - br - 2, y: H - m - br - Math.round(18 * u) - safeBottom, r: br };
      this.subY = this.btn.y - br - Math.round(40 * u);
      this.subW = W - 2 * m;
      this.insets = { top: y2 + h2 + Math.round(12 * u), bottom: br * 2 + m * 2 + Math.round(30 * u) + safeBottom, left: Math.round(4 * u), right: Math.round(4 * u) };
    }
    // where DOM captions (tutorial) should sit
    this.captionRect = { x: W / 2, y: this.insets.top + Math.round(6 * u), w: Math.min(W - 2 * m, 560 * u) };
    return this.insets;
  }

  // ---------- input helpers ----------
  hitButton(x, y, pad = 1.18) { const b = this.btn; return Math.hypot(x - b.x, y - b.y) <= b.r * pad; }
  hitPause(x, y) { const b = this.pauseB; return Math.hypot(x - b.x, y - b.y) <= b.r * 1.35; }

  subtitle(text, dur, who = 'boss') { this.sub = { text, who, t: 0, dur: Math.max(1.3, dur + 0.45) }; }
  crowdSay(id, text, dur) { this.says = this.says.filter((s) => s.id !== id); this.says.push({ id, text, t: 0, dur: Math.max(1.3, dur + 0.4) }); }

  displayFill() { return this.sim.over === 'win' ? 1 : clamp(this.shown / Math.max(1, this.sim.target)); }
  meterBar() {
    const { x, y, w, h } = this.meter, u = this.u;
    const bx = x + h * 0.98, bw = x + w - Math.round(14 * u) - bx, bh = Math.max(8, h * 0.22), by = y + h * 0.56;
    return { bx, by, bw, bh };
  }
  meterTip() { const b = this.meterBar(); return { x: b.bx + b.bw * this.fill, y: b.by + b.bh / 2 }; }

  update(dt) {
    this.time += dt;
    this.fill = lerp(this.fill, this.displayFill(), 1 - Math.exp(-9 * dt));
    this.meterBump.step(1, dt);
    this.meterFlash = Math.max(0, this.meterFlash - dt * 2.5);
    for (let i = 0; i < 3; i++) this.strikeT[i] += dt;
    this.btnScale.step(this.pressed ? 0.93 : 1, dt);
    this.presShake = Math.max(0, this.presShake - dt * 2.2);
    if (this.sub) { this.sub.t += dt; if (this.sub.t > this.sub.dur) this.sub = null; }
    for (const s of this.says) s.t += dt;
    this.says = this.says.filter((s) => s.t < s.dur);
    const slide = this.sim.boss.slide;
    if (slide !== this.lastSlide) { this.lastSlide = slide; this.slideT = 0; }
    this.slideT += dt;
    if (this.winT != null) this.winT += dt;
  }

  // ---------- boss status (drives the presentation panel) ----------
  status() {
    const sim = this.sim, b = sim.boss, T = TUNE;
    const drain = clamp(1 - b.t / Math.max(0.01, b.dur));
    switch (b.phase) {
      case 'read': { const p = sim.readProgress(); return { key: 'reading', col: GREEN, bar: p, barCol: mix(GREEN, COL.warn, smooth((p - 0.55) / 0.45)) }; }
      case 'warn': return { key: 'turning', col: COL.warn, bar: 1, barCol: COL.warn, blink: 7 };
      case 'glanceWarn': return { key: 'glance', col: COL.warn, bar: sim.readProgress(), barCol: COL.warn, blink: 8 };
      case 'glance': return { key: 'watching', col: COL.danger, bar: sim.readProgress(), barCol: COL.danger, eye: true };
      case 'toAud': return { key: 'turning', col: COL.danger, bar: 1, barCol: COL.danger };
      case 'face': return { key: 'watching', col: COL.danger, bar: drain, barCol: COL.danger, eye: true };
      case 'suspect': return { key: 'watching', col: COL.danger, bar: 1, barCol: COL.danger, eye: true, blink: 10 };
      case 'callout': return { key: 'watching', col: COL.danger, bar: drain, barCol: COL.danger, eye: true };
      case 'drowsy': return { key: 'yawning', col: COL.ok, bar: drain, barCol: COL.yawn, blink: 3 };
      case 'toScr': return { key: 'reading', col: GREEN, bar: 0, barCol: GREEN };
      case 'bossYawn': return { key: 'sleeping', col: COL.ok, bar: 1, barCol: COL.yawn };
      default: return { key: 'reading', col: GREEN, bar: 0, barCol: GREEN };
    }
  }

  draw(g) {
    const hideAll = this.sim.over && this.scene.endT > 2.2;
    const a = hideAll ? clamp(1 - (this.scene.endT - 2.2) / 0.5) : 1;
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a;
    this.drawMeter(g);
    this.drawPres(g);
    this.drawClock(g);
    this.drawPause(g);
    this.drawButton(g);
    this.drawSays(g);
    this.drawSub(g);
    this.drawHint(g);
    g.restore();
  }

  // tutorial pointer: a bouncing arrow over a coworker
  drawHint(g) {
    if (this.hintId == null) return;
    const v = this.scene.views[this.hintId];
    if (!v) return;
    const q = v.screen, u = this.u, bob = Math.abs(Math.sin(this.time * 4.2)) * 10 * u;
    const x = q.headX, y = q.headY - q.R * 1.6 - bob - 14 * u, s = 13 * u;
    g.save();
    g.beginPath(); g.moveTo(x, y + s); g.lineTo(x - s, y - s * 0.2); g.lineTo(x - s * 0.42, y - s * 0.2); g.lineTo(x - s * 0.42, y - s * 1.2);
    g.lineTo(x + s * 0.42, y - s * 1.2); g.lineTo(x + s * 0.42, y - s * 0.2); g.lineTo(x + s, y - s * 0.2); g.closePath();
    g.fillStyle = COL.you; g.fill(); g.lineWidth = 2.5 * u; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
    g.font = `700 ${Math.round(14 * u)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.lineWidth = 4 * u; g.strokeStyle = INK; g.strokeText('psst?', x, y - s * 1.35); g.fillStyle = '#ffffff'; g.fillText('psst?', x, y - s * 1.35);
    g.restore();
  }

  // ---------- sleep meter ----------
  drawMeter(g) {
    const { x, y, w, h } = this.meter, u = this.u, sim = this.sim;
    panel(g, x, y, w, h, h * 0.34);
    const fr = h * 0.34 * Math.min(1.4, this.meterBump.x), fx = x + h * 0.52, fy = y + h * 0.5;
    this.drawSleepyFace(g, fx, fy, fr, this.fill);
    const { bx, by, bw, bh } = this.meterBar();
    g.textBaseline = 'alphabetic';
    g.font = `600 ${Math.round(11.5 * u)}px ${FONT}`; g.fillStyle = LAV; g.textAlign = 'left';
    g.fillText(this.t('hud.sleep').toUpperCase(), bx, y + h * 0.4);
    // simultaneous-yawns requirement: eye ×K
    const kTxt = `×${sim.K}`;
    g.font = `700 ${Math.round(14 * u)}px ${FONT}`; g.textAlign = 'right';
    const cnt = `${Math.min(this.shown, sim.target)}/${sim.target}`;
    g.fillStyle = CREAM; g.fillText(cnt, bx + bw, y + h * 0.41);
    const cw = g.measureText(cnt).width;
    g.font = `700 ${Math.round(12 * u)}px ${FONT}`; g.fillStyle = COL.yawn;
    const kx = bx + bw - cw - Math.round(12 * u);
    g.fillText(kTxt, kx, y + h * 0.41);
    const kw = g.measureText(kTxt).width;
    drawEye(g, kx - kw - Math.round(10 * u), y + h * 0.41 - Math.round(4.5 * u), Math.round(13 * u), COL.yawn, INK);
    // bar
    roundRect(g, bx, by, bw, bh, bh / 2); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill();
    const fw = Math.max(bh, bw * this.fill);
    if (this.fill > 0.002) {
      const gr = g.createLinearGradient(bx, 0, bx + bw, 0);
      gr.addColorStop(0, '#8f6cff'); gr.addColorStop(1, '#d8ccff');
      roundRect(g, bx, by, fw, bh, bh / 2); g.fillStyle = gr; g.fill();
      roundRect(g, bx + 2, by + 1.5, fw - 4, bh * 0.36, bh * 0.2); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fill();
      if (this.meterFlash > 0) { roundRect(g, bx, by, fw, bh, bh / 2); g.fillStyle = rgba('#ffffff', this.meterFlash * 0.55); g.fill(); }
    }
    // tick marks every 5
    g.fillStyle = 'rgba(20,14,40,0.35)';
    const step = sim.target > 30 ? 10 : 5;
    for (let k = step; k < sim.target; k += step) g.fillRect(bx + (bw * k) / sim.target - 0.75, by + 2, 1.5, bh - 4);
  }

  drawSleepyFace(g, x, y, r, s) {
    const lid = smooth(s) * 0.9 + (this.sim.over === 'win' ? 0.1 : 0);
    g.save(); g.translate(x, y);
    g.fillStyle = '#f0c29f'; ellipse(g, 0, 0, r * 0.95, r); g.fill();
    g.strokeStyle = '#7a6a60'; g.lineWidth = Math.max(1, r * 0.09); g.lineCap = 'round';
    for (const k of [-0.5, -0.1, 0.3]) { g.beginPath(); g.moveTo(-r * 0.7, -r * 0.55 + k * r * 0.25); g.quadraticCurveTo(0, -r * (1.05 - k * 0.1), r * 0.72, -r * 0.62 + k * r * 0.2); g.stroke(); }
    // eyes behind glasses
    const ey = -r * 0.08;
    for (const sx of [-1, 1]) {
      const ex = sx * r * 0.36;
      g.fillStyle = '#ffffff'; ellipse(g, ex, ey, r * 0.22, r * 0.2); g.fill();
      g.fillStyle = INK; ellipse(g, ex, ey + r * 0.03, r * 0.09, r * 0.09); g.fill();
      g.fillStyle = '#e0ab86'; g.beginPath(); g.rect(ex - r * 0.24, ey - r * 0.22, r * 0.48, r * 0.44 * lid); g.fill();
      g.strokeStyle = INK; g.lineWidth = Math.max(1, r * 0.07); ellipse(g, ex, ey, r * 0.26, r * 0.24); g.stroke();
    }
    g.beginPath(); g.moveTo(-r * 0.1, ey); g.lineTo(r * 0.1, ey); g.stroke();
    // mouth opens as he gets sleepy
    const mo = s > 0.85 || this.sim.over === 'win' ? 0.5 + 0.5 * Math.abs(Math.sin(this.time * 2.2)) : s * 0.3;
    g.fillStyle = '#5a2430'; ellipse(g, 0, r * 0.5, r * 0.18, r * (0.05 + 0.26 * mo)); g.fill();
    g.strokeStyle = '#5b4a40'; g.lineWidth = Math.max(1, r * 0.1); g.beginPath(); g.moveTo(-r * 0.22, r * 0.3); g.quadraticCurveTo(0, r * 0.22, r * 0.22, r * 0.3); g.stroke();
    if (s > 0.6 || this.sim.over === 'win') {
      g.fillStyle = rgba('#ffffff', 0.85); g.font = `700 ${Math.round(r * 0.55)}px ${FONT}`; g.textAlign = 'center';
      const zt = (this.time * 0.8) % 1;
      g.globalAlpha *= 1 - zt; g.fillText('z', r * 0.95 + zt * r * 0.4, -r * 0.7 - zt * r * 0.6);
    }
    g.restore();
  }

  // ---------- presentation / boss status ----------
  drawPres(g) {
    const { y, w, h } = this.pres, u = this.u, sim = this.sim, b = sim.boss;
    const st = this.status();
    const sh = this.presShake > 0 ? Math.sin(this.time * 70) * 4 * u * this.presShake : 0;
    const x = this.pres.x + sh;
    panel(g, x, y, w, h, h * 0.34);
    const pad = Math.round(8 * u);
    const th = h - pad * 2, tw = Math.round(th * 1.42);
    const slideIn = smooth(this.slideT / 0.35);
    this.drawSlideThumb(g, x + pad, y + pad, tw, th, b.slide, slideIn);
    // status pill (right)
    const blinkOn = st.blink ? Math.sin(this.time * st.blink * TAU * 0.5) > -0.2 : true;
    const label = this.t('hud.' + st.key);
    g.font = `700 ${Math.round((this.port ? 12 : 13.5) * u)}px ${FONT}`;
    const lw = g.measureText(label).width, pillW = lw + (st.eye ? 30 : 18) * u, pillH = Math.round(24 * u);
    const px = x + w - pad - pillW, py = y + pad - 1;
    roundRect(g, px, py, pillW, pillH, pillH / 2);
    g.fillStyle = blinkOn ? st.col : rgba(st.col, 0.35); g.fill();
    g.fillStyle = st.col === GREEN ? '#0f2e1d' : st.key === 'yawning' || st.key === 'sleeping' ? '#ffffff' : '#2b0f0c';
    if (st.key === 'turning' && st.col === COL.warn) g.fillStyle = '#3a2204';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    let tx = px + 9 * u;
    if (st.eye) { drawEye(g, tx + 6 * u, py + pillH / 2, Math.round(12 * u), '#ffffff', '#2b0f0c'); tx += 15 * u; }
    g.fillText(label, tx, py + pillH / 2 + 0.5);
    // slide caption
    const cx = x + pad + tw + Math.round(10 * u), cw = px - cx - 6 * u;
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = `600 ${Math.round(10.5 * u)}px ${FONT}`; g.fillStyle = LAV;
    g.fillText(`${this.t('hud.slide').toUpperCase()} ${b.slide + 1}`, cx, y + pad + 10 * u);
    g.font = `600 ${Math.round((this.port ? 12.5 : 14) * u)}px ${FONT}`; g.fillStyle = CREAM;
    const slides = this.t('slides');
    let title = Array.isArray(slides) ? slides[b.slide % slides.length] : '';
    while (title && g.measureText(title).width > cw && title.length > 3) title = title.slice(0, -2).trimEnd() + '…';
    g.save(); g.globalAlpha *= slideIn; g.fillText(title, cx, y + pad + 27 * u); g.restore();
    // progress bar (bottom)
    const bx = cx, bw = x + w - pad - bx, bh = Math.max(6, Math.round(8 * u)), by = y + h - pad - bh;
    roundRect(g, bx, by, bw, bh, bh / 2); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill();
    if (st.bar > 0.004) {
      roundRect(g, bx, by, Math.max(bh, bw * st.bar), bh, bh / 2);
      g.fillStyle = blinkOn || st.key !== 'turning' ? st.barCol : rgba(st.barCol, 0.4); g.fill();
    }
    // the ideal moment to start yawning: a notch on the bar
    // (reading ends at progress 1; the turn completes warn + turn seconds later)
    if (b.phase === 'read' && !sim.holdRead) {
      const total = Math.max(0.01, b.dur - TUNE.warn);
      const best = clamp((b.dur + sim.slow(TUNE.turn) - 1.9) / total, 0.05, 1);
      g.fillStyle = rgba('#ffffff', 0.6); roundRect(g, bx + bw * best - 1, by - 3 * u, 2.5, bh + 6 * u, 1); g.fill();
    }
  }

  drawSlideThumb(g, x, y, w, h, slide, k) {
    const tint = SLIDE_TINTS[slide % SLIDE_TINTS.length];
    roundRect(g, x, y, w, h, 5 * this.u); g.fillStyle = '#f7f5ff'; g.fill();
    g.save(); roundRect(g, x, y, w, h, 5 * this.u); g.clip();
    g.fillStyle = tint; g.fillRect(x, y, w, h * 0.24);
    g.fillStyle = rgba(INK, 0.55); g.fillRect(x + w * 0.1, y + h * 0.08, w * 0.5 * k, h * 0.08);
    const kind = slide % 3;
    g.globalAlpha *= k;
    if (kind === 0) {
      for (let i = 0; i < 4; i++) { const bh = h * (0.18 + ((slide * 7 + i * 13) % 10) / 22); g.fillStyle = i === 2 ? '#ff7b6b' : '#7c8cff'; g.fillRect(x + w * (0.14 + i * 0.19), y + h * 0.9 - bh, w * 0.12, bh); }
    } else if (kind === 1) {
      const cx = x + w * 0.35, cy = y + h * 0.6, r = h * 0.26;
      const parts = [0.45, 0.3, 0.25], cols = ['#7c8cff', '#ffb341', '#5ad38f'];
      let a0 = -Math.PI / 2;
      parts.forEach((p, i) => { g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a0 + p * TAU); g.closePath(); g.fillStyle = cols[i]; g.fill(); a0 += p * TAU; });
      g.fillStyle = rgba(INK, 0.35); for (let i = 0; i < 3; i++) g.fillRect(x + w * 0.64, y + h * (0.42 + i * 0.16), w * 0.26, h * 0.06);
    } else {
      g.fillStyle = rgba(INK, 0.35);
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + w * 0.14, y + h * (0.4 + i * 0.15), h * 0.035, 0, TAU); g.fill(); g.fillRect(x + w * 0.22, y + h * (0.38 + i * 0.15), w * (0.6 - (i % 2) * 0.18), h * 0.05); }
    }
    g.restore();
  }

  // ---------- clock and strikes ----------
  drawClock(g) {
    const { x, y, w, h } = this.clock, u = this.u, sim = this.sim;
    panel(g, x, y, w, h, h * 0.34);
    const left = Math.max(0, sim.timeLimit - sim.t);
    const low = left < 20 && !sim.over;
    const pad = Math.round(12 * u);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = `600 ${Math.round(10.5 * u)}px ${FONT}`; g.fillStyle = LAV;
    g.fillText(this.t('hud.left').toUpperCase(), x + pad, y + h * 0.38);
    const pulse = low ? 1 + 0.08 * Math.max(0, Math.sin(this.time * TAU)) : 1;
    g.save();
    g.translate(x + pad, y + h * 0.8);
    g.scale(pulse, pulse);
    g.font = `700 ${Math.round((this.port ? 19 : 22) * u)}px ${FONT}`; g.fillStyle = low ? '#ff8a80' : CREAM;
    g.fillText(fmtTime(Math.ceil(left)), 0, 0);
    g.restore();
    // three strike cards
    const ch = Math.round(h * 0.5), cw = Math.round(ch * 0.7), gap = Math.round(5 * u);
    const cx0 = x + w - pad - cw * 3 - gap * 2, cy = y + (h - ch) / 2 + 2 * u;
    for (let i = 0; i < 3; i++) {
      const cx = cx0 + i * (cw + gap), on = i < sim.strikes;
      g.save();
      g.translate(cx + cw / 2, cy + ch / 2);
      const k = this.strikeT[i];
      if (on && k < 0.5) { const e = smooth(k / 0.5); const s = lerp(2.2, 1, e); g.scale(s, s); g.rotate((1 - e) * 0.6); }
      g.rotate((i - 1) * 0.08);
      roundRect(g, -cw / 2, -ch / 2, cw, ch, 3 * u);
      if (on) {
        g.fillStyle = COL.danger; g.fill();
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-cw / 2, ch * 0.2, cw, ch * 0.3);
        g.fillStyle = '#ffffff'; g.font = `800 ${Math.round(ch * 0.62)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('!', 0, 1);
      } else {
        g.setLineDash([3 * u, 2.5 * u]); g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
      }
      g.restore();
    }
  }

  drawPause(g) {
    const { x, y, r } = this.pauseB;
    g.beginPath(); g.arc(x, y + 2, r, 0, TAU); g.fillStyle = 'rgba(8,5,20,0.28)'; g.fill();
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = 'rgba(26,20,50,0.82)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = CREAM;
    const bw = r * 0.2, bh = r * 0.75;
    roundRect(g, x - bw * 1.6, y - bh / 2, bw, bh, bw / 2); g.fill();
    roundRect(g, x + bw * 0.6, y - bh / 2, bw, bh, bw / 2); g.fill();
  }

  // ---------- the yawn button: a sleepy face, your mouth ----------
  drawButton(g) {
    const sim = this.sim, me = sim.player, v = this.scene.me, u = this.u;
    const { x, y } = this.btn, r = this.btn.r * this.btnScale.x;
    const active = me.yp === Y.INHALE || me.yp === Y.PEAK;
    const watched = sim.bossWatching() && sim.boss.phase !== 'drowsy' && !sim.over;
    const danger = active && watched;
    g.save();
    g.beginPath(); g.arc(x, y + r * 0.09, r, 0, TAU); g.fillStyle = 'rgba(8,5,20,0.35)'; g.fill();
    const base = danger ? '#ffb4ab' : active ? '#d9ceff' : CREAM;
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 1.05);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, base);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = gr; g.fill();
    g.lineWidth = Math.max(2.5, 3.5 * u); g.strokeStyle = INK; g.stroke();
    // rings: peak countdown or refractory
    const ringR = r + Math.max(4, 6 * u);
    if (me.yp === Y.PEAK) {
      const left = 1 - clamp(me.yt / TUNE.playerMaxPeak);
      g.beginPath(); g.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + left * TAU);
      g.strokeStyle = danger ? COL.danger : COL.yawn; g.lineWidth = Math.max(3, 5 * u); g.lineCap = 'round'; g.stroke();
    } else if (me.refr > 0 && me.yp === Y.IDLE) {
      const k = 1 - clamp(me.refr / TUNE.playerRefract);
      g.beginPath(); g.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + k * TAU);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(2, 3 * u); g.lineCap = 'round'; g.stroke();
    }
    // face
    const mouth = clamp(v.mouth?.x ?? 0);
    const eyeY = y - r * 0.2 - mouth * r * 0.06, ex = r * 0.32;
    g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = Math.max(2.2, r * 0.07);
    for (const s of [-1, 1]) {
      g.beginPath();
      if (mouth > 0.25) { g.moveTo(x + s * ex - r * 0.13, eyeY - r * 0.02); g.lineTo(x + s * ex + r * 0.13, eyeY + r * 0.02 * s); }
      else g.arc(x + s * ex, eyeY - r * 0.05, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    }
    g.fillStyle = rgba('#ff8fa3', 0.45); ellipse(g, x - r * 0.52, y + r * 0.08, r * 0.14, r * 0.09); g.fill(); ellipse(g, x + r * 0.52, y + r * 0.08, r * 0.14, r * 0.09); g.fill();
    const mw = r * (0.16 + 0.12 * mouth), mh = r * (0.07 + 0.4 * mouth), my = y + r * 0.2 + mouth * r * 0.05;
    g.fillStyle = '#5a1f2c'; ellipse(g, x, my, mw, mh); g.fill();
    if (mouth > 0.3) { g.fillStyle = '#e86a7c'; ellipse(g, x, my + mh * 0.55, mw * 0.62, mh * 0.35); g.fill(); }
    g.lineWidth = Math.max(2, r * 0.05); g.strokeStyle = INK; ellipse(g, x, my, mw, mh); g.stroke();
    // label pill
    const label = this.t('hud.btn');
    g.font = `700 ${Math.round(Math.max(11, r * 0.24))}px ${FONT}`;
    const lw = g.measureText(label).width + r * 0.36, lh = Math.max(18, r * 0.36);
    const ly = y + r * 0.86;
    roundRect(g, x - lw / 2, ly - lh / 2, lw, lh, lh / 2); g.fillStyle = danger ? COL.danger : active ? COL.ok : INK; g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x, ly + 0.5);
    g.restore();
    // hint: "hold SPACE"
    if (this.keyHint && !sim.over) {
      const hy = y - r - Math.round(18 * u);
      g.font = `600 ${Math.round(12 * u)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (this.touch) { g.fillStyle = rgba(CREAM, 0.85); g.fillText(this.t('hud.holdTouch'), x, hy); }
      else {
        const a = this.t('hud.hold') + ' ', k = this.t('hud.key');
        const aw = g.measureText(a).width; g.font = `700 ${Math.round(11 * u)}px ${FONT}`; const kw = g.measureText(k).width + 12 * u;
        const tw = aw + kw, sx = x - tw / 2;
        g.font = `600 ${Math.round(12 * u)}px ${FONT}`; g.textAlign = 'left'; g.fillStyle = rgba(CREAM, 0.9);
        g.fillText(a, sx, hy);
        roundRect(g, sx + aw, hy - 9 * u, kw, 18 * u, 4 * u); g.fillStyle = 'rgba(26,20,50,0.85)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.stroke();
        g.font = `700 ${Math.round(11 * u)}px ${FONT}`; g.fillStyle = CREAM; g.textAlign = 'center'; g.fillText(k, sx + aw + kw / 2, hy + 0.5);
      }
    }
  }

  // ---------- speech ----------
  drawSub(g) {
    const s = this.sub;
    if (!s) return;
    const u = this.u, a = clamp(s.t / 0.12) * clamp((s.dur - s.t) / 0.25);
    if (a <= 0) return;
    const fs = Math.round((this.port ? 15 : 17) * u);
    g.save();
    g.globalAlpha *= a;
    g.font = `600 ${fs}px ${FONT}`;
    const tag = this.t(s.who === 'ceo' ? 'ceo' : 'boss').toUpperCase() + ':';
    g.font = `700 ${Math.round(fs * 0.78)}px ${FONT}`; const tagW = g.measureText(tag).width + 8 * u;
    g.font = `600 ${fs}px ${FONT}`;
    const lines = wrap(g, s.text, this.subW - tagW - 28 * u);
    const lh = fs * 1.28, bw = Math.min(this.subW, Math.max(...lines.map((l) => g.measureText(l).width)) + tagW + 28 * u), bh = lines.length * lh + 14 * u;
    const bx = this.port ? (this.W - bw) / 2 : (this.W - bw) / 2 + this.W * 0.04, by = this.subY - bh - (1 - smooth(s.t / 0.2)) * -6 * u;
    roundRect(g, bx, by, bw, bh, 12 * u); g.fillStyle = 'rgba(14,10,30,0.8)'; g.fill();
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(fs * 0.78)}px ${FONT}`; g.fillStyle = COL.warn;
    g.fillText(tag, bx + 14 * u, by + 7 * u + lh / 2);
    g.font = `600 ${fs}px ${FONT}`; g.fillStyle = '#ffffff';
    lines.forEach((l, i) => g.fillText(l, bx + 14 * u + tagW, by + 7 * u + lh / 2 + i * lh));
    g.restore();
  }

  drawSays(g) {
    for (const s of this.says) {
      const v = this.scene.views[s.id];
      if (!v) continue;
      const q = v.screen, u = this.u;
      const a = clamp(s.t / 0.12) * clamp((s.dur - s.t) / 0.25);
      const fs = Math.round(clamp(q.R * 0.5, 12, 16 * u));
      g.save(); g.globalAlpha *= a;
      g.font = `600 ${fs}px ${FONT}`;
      const lines = wrap(g, s.text, Math.min(240 * u, this.W * 0.5));
      const lh = fs * 1.25, bw = Math.max(...lines.map((l) => g.measureText(l).width)) + 20 * u, bh = lines.length * lh + 12 * u;
      let bx = q.headX - bw / 2; bx = clamp(bx, 8, this.W - bw - 8);
      const by = q.headY - q.R * 1.5 - bh - 10 * u;
      roundRect(g, bx, by, bw, bh, 10 * u); g.fillStyle = '#ffffff'; g.fill();
      g.beginPath(); g.moveTo(q.headX - 7 * u, by + bh - 1); g.lineTo(q.headX + 7 * u, by + bh - 1); g.lineTo(q.headX, by + bh + 9 * u); g.closePath(); g.fill();
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach((l, i) => g.fillText(l, bx + bw / 2, by + 6 * u + lh / 2 + i * lh));
      g.restore();
    }
  }
}
