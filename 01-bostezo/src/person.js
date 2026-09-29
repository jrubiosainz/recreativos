// Animated cartoon person. Pose is driven by the simulation state through springs,
// then drawn in two passes (body behind the desk, arms/props in front of it).
import { TAU, clamp, lerp, smooth, ease, Spring, noise1, mix, shade, rgba, ellipse, roundRect } from './util.js';
import { Y, TUNE } from './sim.js';
import { makeLook } from './look.js';

const HALF_PI = Math.PI / 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export class PersonView {
  constructor(p) {
    this.p = p;
    this.look = makeLook(p);
    const s = p.seed;
    this.yaw = new Spring(0, 70);
    this.bodyYaw = new Spring(0, 28);
    this.pitch = new Spring(0, 110);
    this.roll = new Spring(0, 70);
    this.lift = new Spring(0, 150, 16);
    this.mouth = new Spring(0, 520);
    this.eyes = new Spring(1, 320);
    this.squeeze = new Spring(0, 300);
    this.brow = new Spring(0, 200);
    this.up = new Spring(0, 120, 13);
    this.cover = new Spring(0, 150);
    this.raise = new Spring(0, 150, 15);
    this.sip = new Spring(0, 90);
    this.stretch = new Spring(1, 300, 17);
    this.cheek = new Spring(0, 220);
    this.smile = new Spring(0, 50);
    this.alarm = new Spring(0, 160);
    this.hairLag = new Spring(0, 70, 7);
    this.shoulder = new Spring(0, 120, 14);
    this.tears = 0; this.sweat = 0; this.watery = 0;
    this.blinkT = 0.8 + s * 3; this.blink = 0;
    this.saccX = 0; this.saccY = 0; this.saccT = s * 2;
    this.t = s * 10;
    this.penT = 0;
    this.phoneGlow = 0;
    this.lastYp = Y.IDLE;
    this.jolt = 0;
    this.shiver = 0;
    this.talk = 0;
    this.lookAt = { x: 0, y: 0 };
    this.highlight = 0; // UI hover/psst
    this.screen = { x: 0, y: 0, R: 10, headX: 0, headY: 0 };
  }

  // env: { bossDir: {x,y} unit vector in screen space from head to boss, slideTint }
  update(dt, sim, env) {
    const p = this.p, L = this.look, T = TUNE;
    this.t += dt;
    const tt = this.t;
    const gA = p.gazeA || 0;
    // heads turn ~60% of the way (3/4 view reads better); the eyes do the rest
    let yaw = Math.abs(gA) > 2.2 ? Math.sign(gA) * 2.5 : gA * 0.62;
    let pitch = 0, roll = 0, lift = 0, mouth = 0, eyes = 1 - clamp(p.meter) * 0.5, squeeze = 0, brow = 0;
    let up = 0, cover = 0, raise = 0, sip = 0, stretch = 1, cheek = 0, smile = 0, alarm = 0, shoulder = 0;

    // idle life: breathing + tiny head drift
    const br = Math.sin(tt * 1.6 + p.seed * 6);
    lift += br * 0.012;
    yaw += noise1(tt * 0.35, p.seed * 11) * 0.08;
    pitch += noise1(tt * 0.3, p.seed * 7) * 0.05;

    switch (p.gaze) {
      case 'down': pitch -= 0.34; eyes *= 0.6; break;
      case 'up': pitch += 0.32; yaw += (p.seed < 0.5 ? -0.25 : 0.25); eyes *= 0.95; break;
      case 'phone': pitch -= 0.4; eyes = 0.62; break;
      case 'sleep': pitch -= 0.62; roll += 0.22 * (p.seed < 0.5 ? -1 : 1); eyes = 0; mouth = 0.14 + br * 0.03; lift += br * 0.03 - 0.1; break;
      case 'cup': pitch += 0.16; eyes = 0.55; break;
      case 'person': brow += 0.35; break;
    }
    if (p.kind === 'coffee' && p.crashed && p.yp === Y.IDLE) { eyes = Math.min(eyes, 0.42); pitch -= 0.12; }
    if (p.kind === 'pelota') { pitch += 0.05; shoulder -= 0.04; }

    // drowsiness builds up: heavy lids and a slow nod
    const m = clamp(p.meter);
    if (p.yp === Y.IDLE && m > 0.3) {
      const k = (m - 0.3) / 0.7;
      pitch -= k * 0.22 * (0.55 + 0.45 * Math.sin(tt * 2.1 + p.seed * 3));
      eyes = Math.min(eyes, 1 - k * 0.62);
      brow += k * 0.25;
    }

    // yawn choreography
    const yt = p.yt, big = p.big > 1 ? 1 : 0;
    const style = p.kind === 'pelota' ? 'none' : L.yawnStyle;
    const armsFor = (k) => {
      if (style === 'stretch') up = k;
      else if (style === 'cover') cover = k;
      else if (style === 'oneArm') { up = k * 0.999; cover = k; }
      shoulder += 0.12 * k;
    };
    switch (p.yp) {
      case Y.TELL: {
        const k = clamp(yt / T.tell);
        pitch = lerp(pitch, -0.14, smooth(k)); brow = 0.7 * k; mouth = 0.1 * k; eyes = lerp(eyes, 0.72, k);
        this.watery = Math.max(this.watery, k * 0.5);
        break;
      }
      case Y.INHALE: {
        const k = clamp(yt / T.inhale), e = ease.outCubic(k);
        mouth = 0.18 + 0.82 * e; pitch = 0.42 * e + big * 0.1 * e; lift = -0.14 * e - big * 0.05; squeeze = smooth(k * 1.4);
        brow = 0.8 - 0.4 * k; stretch = 1 + (0.09 + big * 0.05) * e; roll = (p.seed - 0.5) * 0.2 * e;
        armsFor(ease.inOutCubic(clamp(k * 1.25 - 0.1)));
        break;
      }
      case Y.PEAK: {
        const w = Math.sin(tt * 8.5) * 0.035 + Math.sin(tt * 5.1) * 0.03;
        mouth = 1 + w + big * 0.12; pitch = 0.44 + big * 0.1 + Math.sin(tt * 2.6) * 0.03; lift = -0.15 - big * 0.06;
        squeeze = 1; brow = 0.45; stretch = 1.1 + big * 0.06 + w * 0.3; roll = (p.seed - 0.5) * 0.22;
        armsFor(1); this.tears = Math.min(1, this.tears + dt * 1.6);
        break;
      }
      case Y.CLOSE: {
        const k = clamp(yt / T.close);
        mouth = 1 - ease.outCubic(clamp(k * 1.5)); pitch = 0.42 * (1 - ease.inOutCubic(k)); squeeze = 1 - smooth(k * 1.3);
        stretch = lerp(1.08, 0.95, ease.outQuad(k)); smile = k; lift = -0.12 * (1 - k);
        if (k < 0.5) armsFor(1 - smooth(k * 2.2));
        this.watery = 1;
        break;
      }
      case Y.STIFLE: {
        const k = clamp(yt / T.stifle);
        cheek = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.9 + 0.1; mouth = 0; eyes = 1.18; brow = 0.9; cover = 1 - smooth((k - 0.7) / 0.3);
        pitch = 0.05;
        break;
      }
    }
    if (p.yp !== this.lastYp) {
      if (p.yp === Y.CLOSE) this.shiver = 0.35;
      this.lastYp = p.yp;
    }
    if (p.yp === Y.IDLE) {
      if (p.refr > 0 && p !== sim.player) {
        const k = clamp(p.refr / T.refract);
        smile = Math.max(smile, k * 0.9); eyes = Math.min(eyes, 1 - k * 0.35);
      }
      if (p === sim.player && p.refr > 0) smile = Math.max(smile, 0.6);
    }
    // caught / alert
    if (p.alert > 0) {
      const k = clamp(p.alert / T.alert);
      alarm = Math.max(alarm, k); eyes = Math.max(eyes, 1.12); brow = Math.max(brow, 0.7 * k); pitch = lerp(pitch, 0.02, k); shoulder += 0.1 * k;
      this.sweat = Math.max(this.sweat, k);
    }
    const since = sim.t - p.caughtT;
    if (since >= 0 && since < 0.4) { this.jolt = 1; }
    if (p.wakeT > 0) { eyes = 1.25; brow = 1; alarm = 1; lift = -0.12; this.jolt = Math.max(this.jolt, 0.6); }
    if (p.psst > 0 && p.kind !== 'pelota') { brow = Math.max(brow, 0.5); }
    if (p.kind === 'coffee' && p.sipT > 0) { sip = 1; pitch = Math.max(pitch, 0.18); eyes = Math.min(eyes, 0.5); }
    if (p.handUp > 0) { raise = 1; this.talk = 1; brow = 0.8; }
    if (p === sim.player && p.psstLook > 0) { brow = Math.max(brow, 0.4); }

    // pupils: towards the boss when looking forward, saccades otherwise
    this.saccT -= dt;
    if (this.saccT <= 0) { this.saccT = 0.6 + Math.random() * 2.2; this.saccX = (Math.random() - 0.5) * 0.5; this.saccY = (Math.random() - 0.5) * 0.3; }
    let lx = this.saccX * 0.4 + clamp(gA, -1, 1) * 0.9, ly = this.saccY * 0.4;
    if (p.gaze === 'fwd' && env && env.bossDir) { lx = env.bossDir.x * 0.75 + this.saccX * 0.2; ly = env.bossDir.y * 0.55 + this.saccY * 0.15; }
    else if (p.gaze === 'down' || p.gaze === 'phone') { lx = 0; ly = 0.85; }
    else if (p.gaze === 'up') { ly = -0.8; }
    this.lookAt.x = damp1(this.lookAt.x, lx, 18, dt);
    this.lookAt.y = damp1(this.lookAt.y, ly, 18, dt);

    // blinks (not while eyes are squeezed)
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.14; this.blinkT = 1.8 + Math.random() * 3.6; if (Math.random() < 0.18) this.blinkT = 0.25; }
    if (this.blink > 0) { this.blink -= dt; eyes *= this.blink > 0.07 ? 0.25 : 0.5; }

    // step springs
    this.yaw.step(yaw, dt);
    this.bodyYaw.step(this.yaw.x * 0.32, dt);
    this.pitch.step(pitch, dt);
    this.roll.step(roll + (this.shiver > 0 ? Math.sin(tt * 55) * this.shiver * 0.18 : 0), dt);
    this.lift.step(lift - this.jolt * 0.22, dt);
    this.mouth.step(mouth, dt);
    this.eyes.step(eyes, dt);
    this.squeeze.step(squeeze, dt);
    this.brow.step(brow, dt);
    this.up.step(up, dt);
    this.cover.step(cover, dt);
    this.raise.step(raise, dt);
    this.sip.step(sip, dt);
    this.stretch.step(stretch, dt);
    this.cheek.step(cheek, dt);
    this.smile.step(smile, dt);
    this.alarm.step(alarm, dt);
    this.shoulder.step(shoulder, dt);
    this.hairLag.step(-this.yaw.v * 0.02 + this.lift.v * 0.05, dt);
    this.jolt = Math.max(0, this.jolt - dt * 4);
    this.shiver = Math.max(0, this.shiver - dt);
    this.tears = p.yp === Y.PEAK || p.yp === Y.CLOSE ? this.tears : Math.max(0, this.tears - dt * 0.7);
    this.watery = Math.max(0, this.watery - dt * 0.5);
    this.sweat = Math.max(0, this.sweat - dt * 0.15);
    this.talk = Math.max(0, this.talk - dt * 1.5);
    this.phoneGlow = damp1(this.phoneGlow, p.gaze === 'phone' ? 1 : 0, 6, dt);
    if (L.pose === 'pen') this.penT += dt;
  }
}

function damp1(a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); }
