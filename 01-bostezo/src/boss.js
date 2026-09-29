// The boss: a big pseudo-3D presenter in the foreground. Facing us = reading the slides
// (safe). Back to us = watching the audience (danger).
import { clamp, lerp, smooth, ease, Spring, noise1, rgba, shade, mix } from './util.js';
import { PersonView } from './person.js';
import { drawBody, drawFront, headPath } from './person_draw.js';
import { TUNE } from './sim.js';

const HALF_PI = Math.PI / 2;
const FRONT = 0.16, BACK = 2.78, OVER = 0.95, CALL = 1.3;

export function makeBossLook() {
  const L = {
    gender: 'm', skin: '#eab893', hair: '#857a72', hairStyle: 'bald', top: '#6e7482', topKind: 'suit', tie: '#bd3f37',
    lanyard: null, glasses: 'round', facial: 'mustache', blush: true, freckles: false, headW: 1.1, headH: 1.04,
    shoulders: 1.66, eyeGap: 0.4, eyeSize: 0.92, noseKind: 2, browW: 1.35, mouthY: 0.52, pose: 'boss',
    yawnStyle: 'stretch', prop: 'none', earring: false, age: 0.9, bags: true, combover: true,
  };
  L.skinDark = shade(L.skin, -0.16); L.skinDeep = shade(L.skin, -0.32); L.skinLight = shade(L.skin, 0.12);
  L.lip = mix(L.skin, '#b8505a', 0.38);
  L.hairDark = shade(L.hair, -0.25); L.hairLight = shade(L.hair, 0.18);
  L.topDark = shade(L.top, -0.22); L.topLight = shade(L.top, 0.12); L.shirt = '#f3f0e9';
  return L;
}

// the final boss: black turtleneck, silver crop, designer glasses
export function makeCeoLook() {
  const L = { ...makeBossLook(), hair: '#bdb6ad', hairStyle: 'short', top: '#2a2a31', topKind: 'sweater', tie: null, glasses: 'rect', facial: 'stubble',
    combover: false, headW: 1.02, headH: 1.08, shoulders: 1.58, skin: '#e2ab86', noseKind: 1, browW: 1.15, bags: false };
  L.skinDark = shade(L.skin, -0.16); L.skinDeep = shade(L.skin, -0.32); L.skinLight = shade(L.skin, 0.12);
  L.lip = mix(L.skin, '#b8505a', 0.38);
  L.hairDark = shade(L.hair, -0.25); L.hairLight = shade(L.hair, 0.18);
  L.topDark = shade(L.top, -0.22); L.topLight = shade(L.top, 0.12); L.shirt = shade(L.top, 0.1);
  return L;
}

export class BossView extends PersonView {
  constructor() {
    super({ id: -1, seed: 0.37, kind: 'boss', yp: 0, yt: 0, gazeA: 0, meter: 0, refr: 0, alert: 0, caughtT: -99, wakeT: 0, psst: 0, sipT: 0, handUp: 0, cup: 0 });
    this.look = makeBossLook();
    this.point = new Spring(0, 140, 14);
    this.pointDir = { x: 1, y: -0.35 };
    this.clickFlash = 0;
    this.sleepy = 0;
    this.phaseT = 0; this.lastPhase = '';
    this.winT = -1;
    this.glare = 0;
    this.q = 0; // question-mark bubble
    this.bang = 0; // exclamation
  }

  click() { this.clickFlash = 0.18; this.raise.v -= 4; }

  // env: { speak: 0..1 voice level, culpritDir: {x,y}, over, dt }
  update(dt, sim, env = {}) {
    const b = sim.boss, ph = b.phase, T = TUNE;
    this.t += dt;
    const tt = this.t;
    if (ph !== this.lastPhase) { this.lastPhase = ph; this.phaseT = 0; }
    this.phaseT += dt;
    const k = b.dur > 0 ? clamp(b.t / b.dur) : 1;
    this.sleepy = lerp(this.sleepy, clamp(b.seen / Math.max(1, sim.target)), 1 - Math.exp(-3 * dt));
    const sl = this.sleepy;

    let yaw = FRONT + noise1(tt * 0.4, 3.1) * 0.07, bodyYaw = 0.1, pitch = 0.1 + noise1(tt * 0.3, 7) * 0.04, roll = 0, lift = Math.sin(tt * 1.3) * 0.012;
    let mouth = 0, eyes = 1 - sl * 0.4, squeeze = 0, brow = 0.05, up = 0, cover = 0, raise = 0, point = 0, stretch = 1, smile = 0, alarm = 0, shoulder = 0;
    let lx = noise1(tt * 0.5, 1) * 0.25, ly = -0.35;
    const speak = clamp(env.speak || 0);
    const talkMouth = speak * (0.3 + 0.1 * Math.sin(tt * 23));

    switch (ph) {
      case 'read': case 'toScr': {
        if (ph === 'toScr') { const e = ease.inOutCubic(k); yaw = lerp(BACK, FRONT, e); bodyYaw = lerp(BACK - 0.15, 0.1, ease.inOutCubic(clamp(k * 1.15 - 0.1))); }
        mouth = talkMouth; this.glare = 1;
        break;
      }
      case 'warn': {
        // the tell: eyes slide, head starts to turn, brows up
        const e = smooth(clamp(b.t / T.warn));
        yaw = FRONT + 0.42 * e + Math.sin(tt * 9) * 0.02 * e; bodyYaw = 0.1 + 0.22 * e; lx = 1.1 * e; ly = -0.1; brow = 0.25 + 0.4 * e;
        mouth = talkMouth; this.glare = 1 - e * 0.5;
        break;
      }
      case 'toAud': {
        const e = ease.inOutCubic(k);
        yaw = lerp(FRONT + 0.42, BACK, e); bodyYaw = lerp(0.3, BACK - 0.15, ease.inOutCubic(clamp(k * 1.1 - 0.12)));
        lift = -0.03 * Math.sin(k * Math.PI); this.glare = 0;
        break;
      }
      case 'face': case 'suspect': case 'drowsy': case 'callout': break;
      case 'glanceWarn': {
        const e = smooth(k);
        yaw = FRONT + 0.5 * e; lx = 1.25 * e; brow = 0.5 * e; mouth = talkMouth * (1 - e); this.glare = 1 - e * 0.6;
        break;
      }
      case 'glance': {
        const inn = ease.outCubic(clamp(b.t / 0.22)), out = ease.inOutCubic(clamp((b.t - (b.dur - 0.2)) / 0.2));
        const e = inn * (1 - out);
        yaw = lerp(FRONT + 0.5, 2.25, e); bodyYaw = 0.1 + 0.55 * e; pitch = 0.05; brow = 0.5; lx = 1; this.glare = 0;
        break;
      }
      case 'bossYawn': break;
    }

    const back = ph === 'face' || ph === 'suspect' || ph === 'drowsy' || ph === 'callout';
    if (back) {
      this.glare = 0;
      yaw = BACK + Math.sin(tt * 0.75) * 0.2 + noise1(tt * 0.6, 5) * 0.08; bodyYaw = BACK - 0.15; pitch = 0.0;
      if (ph === 'suspect') {
        const e = smooth(clamp(this.phaseT / 0.25));
        pitch = -0.12 * e; roll = 0.14 * e; lift = -0.05 * e; yaw = lerp(yaw, BACK - 0.12, e); this.q = 1;
      }
      if (ph === 'drowsy') {
        // turn to profile and give in to the yawn
        const t = this.phaseT, e = ease.inOutCubic(clamp(t / 0.32));
        yaw = lerp(BACK, OVER, e); bodyYaw = lerp(BACK - 0.15, 2.0, e);
        const inh = ease.outCubic(clamp((t - 0.2) / 0.45)), cl = smooth(clamp((t - 1.55) / 0.45));
        const open = inh * (1 - cl);
        mouth = open * (1.05 + Math.sin(tt * 8) * 0.04) + (1 - open) * talkMouth; pitch = 0.42 * open; squeeze = open; stretch = 1 + 0.1 * open;
        up = open; lift = -0.12 * open; brow = 0.5 * open; eyes = Math.min(eyes, 1 - 0.5 * cl);
        if (open > 0.5) this.tears = Math.min(1, this.tears + dt * 1.2);
      }
      if (ph === 'callout') {
        const e = ease.outBack(clamp(this.phaseT / 0.28));
        yaw = lerp(BACK, CALL, clamp(e)); bodyYaw = lerp(BACK - 0.15, 1.75, clamp(e));
        point = e; brow = -0.35; mouth = 0.12 + speak * 0.55; lift = -0.04; shoulder = 0.08; this.bang = 1;
        if (env.culpritDir) { this.pointDir.x = env.culpritDir.x; this.pointDir.y = env.culpritDir.y; }
      }
    }

    // finale: the giant boss yawn, then he falls asleep standing up
    if (ph === 'bossYawn') {
      if (this.winT < 0) this.winT = 0;
      this.winT += dt;
      const t = this.winT;
      yaw = lerp(this.yaw.x, FRONT * 0.4, 1 - Math.exp(-6 * dt)); bodyYaw = 0.05; this.glare = 0.4;
      const pre = smooth(clamp(t / 0.6)), inh = ease.outCubic(clamp((t - 0.6) / 0.7)), cl = smooth(clamp((t - 4.3) / 0.6));
      const open = inh * (1 - cl);
      eyes = lerp(0.6, 0, cl); mouth = lerp(0.15 * pre, 1.42 + Math.sin(tt * 7) * 0.05, open);
      pitch = lerp(-0.05, 0.5, open) - 0.45 * cl; squeeze = open; stretch = 1 + 0.16 * open; up = open * 1.05; lift = -0.2 * open;
      brow = 0.6 * open; roll = Math.sin(tt * 1.1) * 0.05 * cl;
      if (open > 0.4) this.tears = Math.min(1, this.tears + dt);
      if (cl > 0.5) { mouth = 0.12 + Math.sin(tt * 1.6) * 0.04; lift = -0.08 + Math.sin(tt * 1.6) * 0.03; }
    } else this.winT = -1;
    if (sim.over === 'time') { yaw = FRONT; bodyYaw = 0.1; smile = 1; mouth = talkMouth; this.glare = 0.6; raise = 0.6; }

    // pupils
    this.lookAt.x = damp(this.lookAt.x, lx, 16, dt);
    this.lookAt.y = damp(this.lookAt.y, ly, 16, dt);
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.14; this.blinkT = 2 + Math.random() * 3; }
    if (this.blink > 0) { this.blink -= dt; eyes *= this.blink > 0.07 ? 0.25 : 0.5; }

    this.yaw.step(yaw, dt);
    this.bodyYaw.step(bodyYaw, dt);
    this.pitch.step(pitch, dt);
    this.roll.step(roll, dt);
    this.lift.step(lift, dt);
    this.mouth.step(mouth, dt);
    this.eyes.step(eyes, dt);
    this.squeeze.step(squeeze, dt);
    this.brow.step(brow, dt);
    this.up.step(up, dt);
    this.cover.step(cover, dt);
    this.raise.step(raise, dt);
    this.point.step(point, dt);
    this.stretch.step(stretch, dt);
    this.cheek.step(0, dt);
    this.smile.step(smile, dt);
    this.alarm.step(alarm, dt);
    this.shoulder.step(shoulder, dt);
    this.hairLag.step(-this.yaw.v * 0.02, dt);
    this.tears = ph === 'drowsy' || ph === 'bossYawn' ? this.tears : Math.max(0, this.tears - dt * 0.6);
    this.clickFlash = Math.max(0, this.clickFlash - dt);
    this.q = Math.max(0, this.q - dt * 2.5);
    this.bang = Math.max(0, this.bang - dt * 2);
    this.p.yp = ph === 'bossYawn' && this.mouth.x > 1 ? 3 : 0;
  }
}

function damp(a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); }

// comb-over strands + projector glare on the glasses, drawn in head space
function overlay(v) {
  return (g, G) => {
    const L = v.look, cy = Math.cos(G.yaw), sy = Math.sin(G.yaw);
    const sa = clamp((Math.abs(cy) - 0.3) / 0.35);
    g.save(); headPath(g, G.rx, G.ryT, G.ryB); g.clip();
    g.strokeStyle = L.hair; g.lineWidth = 0.055; g.lineCap = 'round'; g.globalAlpha = sa;
    for (const f of sa > 0.01 && L.combover ? [-0.62, -0.38, -0.12, 0.1, 0.33, 0.53, 0.7] : []) {
      const r0 = Math.sqrt(1 - f * f);
      g.beginPath();
      let pen = false;
      for (let i = 0; i <= 18; i++) {
        const a = lerp(0.12, 0.86, i / 18) * Math.PI;
        const X = -Math.cos(a) * r0, Y = -Math.sin(a) * r0 * 0.97, Z = f;
        const Xp = X * cy + Z * sy, Zp = -X * sy + Z * cy;
        const vis = Zp > -0.02 || Y < -0.9;
        const px = Xp * G.rx, py = G.fy(Y * G.ryT) + 0.02 * Math.sin(i * 0.9 + f * 9);
        if (vis) { pen ? g.lineTo(px, py) : g.moveTo(px, py); pen = true; } else pen = false;
      }
      g.stroke();
    }
    g.restore();
    if (v.glare > 0.02 && cy > 0.3) {
      const eyeY = G.fy(0.03) + 0.01 - G.mo * 0.05;
      g.fillStyle = rgba('#e9f6ff', 0.62 * v.glare * cy);
      for (const s of [-1, 1]) {
        const th = s * L.eyeGap + G.yaw, c = Math.cos(th);
        if (c < 0.1) continue;
        const ex = Math.sin(th) * G.rx * 0.93, fs = Math.pow(c, 0.8);
        g.beginPath();
        g.moveTo(ex - 0.15 * fs, eyeY - 0.02); g.lineTo(ex - 0.02 * fs, eyeY - 0.15);
        g.lineTo(ex + 0.12 * fs, eyeY - 0.15); g.lineTo(ex - 0.02 * fs, eyeY + 0.0); g.closePath(); g.fill();
      }
    }
  };
}

export function drawBoss(g, v, x, y, R) {
  const back = Math.cos(v.bodyYaw.x) < 0;
  const opt = { overlay: overlay(v), uvula: true, deskY: 3 };
  if (back) { drawFront(g, v, x, y, R, opt); drawBody(g, v, x, y, R, opt); }
  else { drawBody(g, v, x, y, R, opt); drawFront(g, v, x, y, R, opt); }
  const hx = x + Math.sin(v.bodyYaw.x) * 0.25 * R, hy = y + (-1.22 + v.lift.x - v.shoulder.x * 0.8) * R;
  v.screen.x = x; v.screen.y = y; v.screen.R = R; v.screen.headX = hx; v.screen.headY = hy;
}
