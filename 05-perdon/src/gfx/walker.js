// People, as the station's posters would draw them: flat matte inks, no outlines, big white eyes.
// A figure is drawn in metres around its feet (y down), at its own depth: each shoe is placed through
// the camera, so the forward foot sits lower on the screen than the one behind, and a walk reads as a
// walk from the front and from behind. What the rules are doing shows in the pose: the glance (head
// and eyes to one side), the lean that follows it, the apology (hands up), the phone, the rumba.
import { clamp, lerp } from '../util.js';
import { PAL, fog, darker, lighter, ell, poly, rrect, limb, TAU } from './paint.js';

const TARTAN = new Map();
// pose fields: face, ph, amp, dir, lean, turn, gx, gy, brows, mouth, blink, arms, armK, side, beat, spin, down, run, stagger
export function drawWalker(g, T, L, p) {
  const k = T.fog, C = (c) => fog(c, k), d = T.d, cr = T.cr, s = T.s;
  const detail = s > 34, fine = s > 70;
  const H = L.h, w = L.w, face = p.face;
  const hh = 0.29, hw = 0.245;
  const run = p.run || 0, amp = clamp(p.amp);
  const stride = (0.3 + run * 0.22) * amp;
  const ph = p.ph;
  const bob = -(0.024 + run * 0.03) * amp * (1 - Math.abs(Math.sin(ph))) + (p.down || 0) * 0.03 + run * 0.05;
  const spin = p.spin ?? 1;             // 1 facing as drawn, -1 turned round (the rumba), in between: edge on
  const flip = spin < 0;
  const showFace = flip ? !face : face;
  const sx = Math.max(0.12, Math.abs(spin));

  g.save();
  g.translate(T.sx, T.sy); g.scale(s, s);
  // shadow on the floor, squashed by the viewing angle
  ell(g, 0, 0, 0.3, 0.3 * clamp(cr / Math.max(d, 0.5), 0.18, 0.9) * 0.85);
  g.fillStyle = C(PAL.shadow); g.globalAlpha = 0.45; g.fill(); g.globalAlpha = 1;
  g.rotate(p.lean || 0);
  // feet first: where each shoe is, through the lens
  const feet = [];
  for (let i = 0; i < 2; i++) {
    const phi = ph + i * Math.PI;
    const zo = stride * Math.sin(phi), dw = p.dir * zo, fs = d / Math.max(0.3, d + dw);
    const lift = (0.07 + run * 0.12) * amp * Math.max(0, Math.cos(phi)) ** 2;
    feet.push({ x: (i ? 1 : -1) * 0.088 * sx, y: (-cr * dw) / (d + dw) - lift, fs, lift, fwd: dw < 0 });
  }
  g.scale(sx, 1);
  const yHead = -H + hh / 2 + bob, yChin = yHead + hh / 2, ySh = yChin + 0.06, yWaist = ySh + 0.42;
  const yHem = L.len === 'long' ? -0.5 : L.len === 'mid' ? -0.7 : -0.9;
  const sw = 0.215 * w, hemW = (L.len === 'long' ? 0.25 : L.len === 'mid' ? 0.235 : 0.215) * w;
  const sway = 0.014 * amp * Math.sin(ph) + (p.hip || 0);
  const coat = L.coat, coatDk = L.raincoat ? '#d9a511' : darker(coat, 0.2);

  // ---- legs and shoes
  const legC = C(L.skirt ? darker(L.legs, 0.05) : L.legs);
  for (const f of feet) {
    const top = yHem + 0.02, ax = f.x, ay = f.y - 0.05 * f.fs;
    const hx = Math.sign(f.x) * 0.085;
    poly(g, [hx - 0.062, top, hx + 0.062, top, ax + 0.05 * f.fs, ay, ax - 0.05 * f.fs, ay]);
    g.fillStyle = legC; g.fill();
  }
  // back to front: the foot further from the camera first
  const order = feet[0].fs <= feet[1].fs ? [0, 1] : [1, 0];
  for (const i of order) {
    const f = feet[i], fs = f.fs;
    if (showFace) { ell(g, f.x, f.y - 0.026 * fs, 0.07 * fs, 0.042 * fs); g.fillStyle = C(L.shoes); g.fill(); }
    else {
      ell(g, f.x, f.y - 0.03 * fs, 0.06 * fs, 0.04 * fs); g.fillStyle = C(L.shoes); g.fill();
      if (f.lift > 0.02 && detail) { ell(g, f.x, f.y - 0.012 * fs, 0.052 * fs, 0.02 * fs); g.fillStyle = C(lighter(L.shoes, 0.25)); g.fill(); }
    }
  }

  // ---- things carried behind the body (a backpack seen from the front shows only its straps)
  const bag = L.bag;
  if (bag && bag.t === 'back' && !showFace) { /* drawn over the coat below */ }

  // ---- the coat
  const hemSw = sway * 0.8;
  g.beginPath();
  g.moveTo(-0.07, ySh - 0.035);
  g.quadraticCurveTo(-sw + 0.02, ySh - 0.02, -sw, ySh + 0.07);
  g.lineTo(-sw - 0.012, ySh + 0.2);
  g.quadraticCurveTo(-0.205 * w, yWaist - 0.05, -0.2 * w + sway * 0.4, yWaist);
  g.lineTo(-hemW + hemSw, yHem);
  g.quadraticCurveTo(hemSw, yHem + 0.018, hemW + hemSw, yHem);
  g.lineTo(0.2 * w + sway * 0.4, yWaist);
  g.quadraticCurveTo(0.205 * w, yWaist - 0.05, sw + 0.012, ySh + 0.2);
  g.lineTo(sw, ySh + 0.07);
  g.quadraticCurveTo(sw - 0.02, ySh - 0.02, 0.07, ySh - 0.035);
  g.closePath();
  g.fillStyle = C(coat); g.fill();
  // the shadow side
  g.beginPath();
  g.moveTo(sw * 0.42, ySh + 0.02);
  g.quadraticCurveTo(sw - 0.02, ySh - 0.01, sw, ySh + 0.07);
  g.lineTo(sw + 0.012, ySh + 0.2);
  g.quadraticCurveTo(0.205 * w, yWaist - 0.05, 0.2 * w + sway * 0.4, yWaist);
  g.lineTo(hemW + hemSw, yHem);
  g.quadraticCurveTo(hemW * 0.75 + hemSw, yHem + 0.012, hemW * 0.5 + hemSw, yHem + 0.006);
  g.quadraticCurveTo(sw * 0.55, yWaist - 0.1, sw * 0.42, ySh + 0.02);
  g.fillStyle = C(coatDk); g.fill();
  if (detail) {
    if (showFace) {
      // the opening: shirt and tie, a turtleneck, or a scarf
      const vY = ySh + (L.collar === 'turtle' ? 0.06 : 0.24);
      if (L.collar !== 'turtle') {
        poly(g, [-0.075, ySh - 0.03, 0.075, ySh - 0.03, 0, vY]);
        g.fillStyle = C(L.collar === 'tie' ? '#f2f0ea' : L.raincoat ? '#e8e2cf' : darker(L.legs, -0.1)); g.fill();
        if (L.collar === 'tie') { poly(g, [-0.018, ySh + 0.0, 0.018, ySh + 0.0, 0.014, vY - 0.02, 0, vY + 0.02, -0.014, vY - 0.02]); g.fillStyle = C(L.tie); g.fill(); }
        g.strokeStyle = C(coatDk); g.lineWidth = 0.014; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-0.08, ySh - 0.03); g.lineTo(-0.005, vY); g.lineTo(0.08, ySh - 0.03); g.stroke();
      }
      if (L.len !== 'short' || true) { g.beginPath(); g.moveTo(0, vY); g.lineTo(hemSw * 0.6, yHem + 0.01); g.strokeStyle = C(coatDk); g.lineWidth = 0.012; g.stroke(); }
      if (fine && !L.raincoat) for (let b = 0; b < 3; b++) { ell(g, -0.03 + hemSw * 0.3 * (b / 3), vY + 0.07 + b * 0.13, 0.009, 0.009); g.fillStyle = C(darker(coat, 0.35)); g.fill(); }
    } else {
      // the back: a seam, the yoke of a raincoat, a folded hood
      g.strokeStyle = C(coatDk); g.lineWidth = 0.012; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, yWaist - 0.05); g.lineTo(hemSw * 0.6, yHem + 0.01); g.stroke();
      if (L.raincoat) { g.beginPath(); g.moveTo(-sw + 0.02, ySh + 0.13); g.quadraticCurveTo(0, ySh + 0.17, sw - 0.02, ySh + 0.13); g.stroke(); }
    }
  }
  if (L.hood && !showFace) {
    g.beginPath(); g.moveTo(-0.12, ySh - 0.03); g.quadraticCurveTo(-0.15, ySh + 0.16, 0, ySh + 0.2); g.quadraticCurveTo(0.15, ySh + 0.16, 0.12, ySh - 0.03); g.closePath();
    g.fillStyle = C(L.raincoat ? coat : lighter(coat, 0.06)); g.fill();
    g.strokeStyle = C(coatDk); g.lineWidth = 0.014; g.stroke();
  }
  if (L.hood && showFace && detail) {
    g.beginPath(); g.moveTo(-0.11, ySh - 0.035); g.quadraticCurveTo(0, ySh + 0.04, 0.11, ySh - 0.035); g.strokeStyle = C(coatDk); g.lineWidth = 0.02; g.stroke();
  }
  // a scarf round the neck, its end hanging in front
  if (L.scarf) {
    rrect(g, -0.1, ySh - 0.07, 0.2, 0.08, 0.035); g.fillStyle = C(L.scarf); g.fill();
    if (showFace) { rrect(g, 0.02 + hemSw * 0.2, ySh - 0.01, 0.055, 0.3, 0.02); g.fill(); }
  }
  // backpack from behind; its straps from the front
  if (bag && bag.t === 'back') {
    if (!showFace) {
      rrect(g, -0.17 * w, ySh + 0.04, 0.34 * w, 0.42, 0.07); g.fillStyle = C(bag.c); g.fill();
      if (detail) { rrect(g, -0.13 * w, ySh + 0.25, 0.26 * w, 0.17, 0.04); g.fillStyle = C(darker(bag.c, 0.18)); g.fill(); }
    } else if (detail) {
      g.strokeStyle = C(darker(bag.c, 0.1)); g.lineWidth = 0.035; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-0.12, ySh); g.lineTo(-0.13, ySh + 0.3); g.moveTo(0.12, ySh); g.lineTo(0.13, ySh + 0.3); g.stroke();
    }
  }
  // a shoulder bag: the strap across, the bag at the hip
  if (bag && (bag.t === 'shoulder' || bag.t === 'tote')) {
    const bs = bag.side, bx = bs * (hemW + 0.03) + sway * 0.5, by = yWaist + 0.1;
    if (bag.t === 'shoulder') {
      g.strokeStyle = C(bag.strap || darker(bag.c, 0.15)); g.lineWidth = 0.028; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-bs * (sw - 0.07), ySh - 0.01); g.lineTo(bx - bs * 0.04, by - 0.07); g.stroke();
      rrect(g, bx - 0.1, by - 0.08, 0.2, 0.17, 0.035); g.fillStyle = C(bag.c); g.fill();
      if (detail) { rrect(g, bx - 0.1, by - 0.08, 0.2, 0.07, 0.03); g.fillStyle = C(darker(bag.c, 0.18)); g.fill(); }
    } else {
      g.strokeStyle = C(darker(bag.c, 0.2)); g.lineWidth = 0.02;
      g.beginPath(); g.moveTo(bs * (sw - 0.04), ySh + 0.01); g.lineTo(bx - 0.06, by - 0.12); g.moveTo(bs * (sw - 0.04), ySh + 0.01); g.lineTo(bx + 0.06, by - 0.12); g.stroke();
      poly(g, [bx - 0.11, by - 0.12, bx + 0.11, by - 0.12, bx + 0.13, by + 0.16, bx - 0.13, by + 0.16]); g.fillStyle = C(bag.c); g.fill();
    }
  }

  // ---- arms
  const armC = C(coat), armDk = C(coatDk), skin = C(L.skin);
  const hands = arms(p, L, { sw, ySh, yWaist, amp, ph, d, cr, run, w });
  for (let i = 0; i < 2; i++) {
    const a = hands[i], side = i ? 1 : -1;
    limb(g, i ? armDk : armC, 0.1, side * (sw - 0.035), ySh + 0.06, a.ex, a.ey, a.hx, a.hy);
    ell(g, a.hx, a.hy + 0.01, 0.046 * a.hs, 0.05 * a.hs); g.fillStyle = skin; g.fill();
  }
  // a briefcase hangs from its hand
  if (bag && bag.t === 'brief') {
    const a = hands[bag.side > 0 ? 1 : 0], cx = a.hx, cy = a.hy + 0.05;
    rrect(g, cx - 0.14, cy + 0.03, 0.28, 0.21, 0.025); g.fillStyle = C(bag.c); g.fill();
    if (detail) { g.strokeStyle = C(bag.c); g.lineWidth = 0.02; g.beginPath(); g.moveTo(cx - 0.05, cy + 0.035); g.lineTo(cx - 0.04, cy - 0.01); g.lineTo(cx + 0.04, cy - 0.01); g.lineTo(cx + 0.05, cy + 0.035); g.stroke(); }
  }
  // a cane, planted a little ahead
  if (L.props.cane) {
    const a = hands[1];
    g.strokeStyle = C('#3a2a20'); g.lineWidth = 0.024; g.lineCap = 'round';
    g.beginPath(); g.moveTo(a.hx, a.hy); g.lineTo(a.hx + 0.1, -0.01 + 0.02 * Math.sin(ph)); g.stroke();
  }
  // the phone, held up to the face
  if (L.props.phone && p.arms === 'phone') {
    const hx = (hands[0].hx + hands[1].hx) / 2, hy = (hands[0].hy + hands[1].hy) / 2 - 0.03;
    if (showFace) { rrect(g, hx - 0.04, hy - 0.08, 0.08, 0.14, 0.015); g.fillStyle = C('#22252c'); g.fill(); }
    else {
      g.save(); g.globalAlpha = 0.55 * (1 - k); ell(g, hx + 0.02, hy - 0.1, 0.1, 0.08); g.fillStyle = '#cfe6ff'; g.fill(); g.restore();
    }
  }

  // ---- the head
  const turn = clamp(p.turn || 0, -1, 1) * (flip ? -1 : 1), hx = turn * 0.014 + sway * 0.3, down = p.down || 0;
  const hairC = C(L.hair), skinDk = C(darker(L.skin, 0.12));
  rrect(g, hx * 0.5 - 0.042, yChin - 0.03, 0.084, ySh - yChin + 0.02, 0.02); g.fillStyle = skin; g.fill();
  const hy = yHead + down * 0.035;
  if (showFace) {
    backHair(g, L, hx, hy, hw, hh, hairC, true);
    for (const e of [-1, 1]) { ell(g, hx + e * hw * 0.49 - turn * 0.035, hy + 0.018, 0.028, 0.042); g.fillStyle = skin; g.fill(); }
    ell(g, hx, hy, hw / 2, hh / 2); g.fillStyle = skin; g.fill();
    if (L.beard) { g.beginPath(); g.ellipse(hx + turn * 0.03, hy + 0.06, hw * 0.44, hh * 0.3, 0, 0.05, Math.PI - 0.05); g.fillStyle = hairC; g.fill(); }
    const fx = turn * 0.05 + hx;
    // eyes: the whites are what you read from far off
    const ey = hy + 0.006 + down * 0.028, ex = 0.057;
    const lidDown = clamp(down * 0.9 + (p.blink || 0));
    for (const e of [-1, 1]) {
      const cx = fx + e * ex * (1 - Math.abs(turn) * 0.12 * (e * turn > 0 ? -1 : 1));
      const rx = 0.037 * (1 - Math.abs(turn) * 0.1), ry = 0.044;
      ell(g, cx, ey, rx, ry); g.fillStyle = C('#fbfaf6'); g.fill();
      if (lidDown < 0.92) {
        const px = cx + clamp(p.gx || 0, -1, 1) * 0.017, py = ey + clamp(p.gy || 0, -1, 1) * 0.017;
        ell(g, px, py, 0.021, 0.023); g.fillStyle = C('#15161c'); g.fill();
        if (fine) { ell(g, px - 0.007, py - 0.008, 0.005, 0.005); g.fillStyle = C('#fbfaf6'); g.fill(); }
      }
      if (lidDown > 0.05) { g.beginPath(); g.ellipse(cx, ey, rx + 0.004, ry + 0.004, 0, Math.PI, TAU); g.lineTo(cx + rx + 0.004, ey - ry + (2 * ry) * lidDown); g.lineTo(cx - rx - 0.004, ey - ry + 2 * ry * lidDown); g.closePath(); g.fillStyle = skin; g.fill(); }
      if (detail) {
        const by = ey - 0.058 - (p.brows || 0) * 0.02 + down * 0.01;
        g.strokeStyle = C(darker(L.hair, 0.1)); g.lineWidth = 0.013; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx - 0.024, by + 0.004 + (p.brows || 0) * e * 0.0); g.quadraticCurveTo(cx, by - 0.008 - (p.brows || 0) * 0.006, cx + 0.024, by + 0.004); g.stroke();
      }
    }
    if (L.glasses && detail) {
      g.strokeStyle = C('#2a2626'); g.lineWidth = 0.009;
      for (const e of [-1, 1]) { ell(g, fx + e * ex, ey, 0.047, 0.045); g.stroke(); }
      g.beginPath(); g.moveTo(fx - ex + 0.047, ey - 0.01); g.lineTo(fx + ex - 0.047, ey - 0.01); g.stroke();
    }
    if (detail) {
      ell(g, fx + turn * 0.012, hy + 0.05 + down * 0.02, 0.017, 0.012); g.fillStyle = skinDk; g.fill();
      mouth(g, p.mouth || 0, fx + turn * 0.008, hy + 0.092 + down * 0.012, C('#5a2b2b'), C('#3a1d1f'));
    }
    frontHair(g, L, hx, hy, hw, hh, hairC, turn);
  } else {
    for (const e of [-1, 1]) { ell(g, hx + e * hw * 0.49 + turn * 0.02, hy + 0.02, 0.027, 0.04); g.fillStyle = skin; g.fill(); }
    ell(g, hx, hy, hw / 2, hh / 2); g.fillStyle = skin; g.fill();
    // looking round over a shoulder: a cheek and the tip of the nose
    if (Math.abs(turn) > 0.15) {
      const e = Math.sign(turn), q = Math.min(1, (Math.abs(turn) - 0.15) * 1.6);
      ell(g, hx + e * (hw * 0.44), hy + 0.035, 0.03 * q + 0.004, 0.05); g.fillStyle = skin; g.fill();
    }
    backHair(g, L, hx, hy, hw, hh, hairC, false, turn);
    if (L.props.buds) for (const e of [-1, 1]) { ell(g, hx + e * hw * 0.5, hy + 0.03, 0.012, 0.012); g.fillStyle = C('#f4f4f2'); g.fill(); }
  }
  if (L.hat) hat(g, L, hx, hy, hw, hh, C, showFace);
  g.restore();
}

// where a hand is on the screen (i: 0 the one on the left as drawn, 1 the right): for what is held in it
export function handAt(T, L, p, i) {
  const amp = clamp(p.amp), run = p.run || 0;
  const bob = -(0.024 + run * 0.03) * amp * (1 - Math.abs(Math.sin(p.ph))) + (p.down || 0) * 0.03 + run * 0.05;
  const ySh = -L.h + 0.29 + bob + 0.06, sw = 0.215 * L.w;
  const a = arms(p, L, { sw, ySh, yWaist: ySh + 0.42, amp, ph: p.ph, d: T.d, cr: T.cr, run, w: L.w })[i];
  const X = a.hx * Math.max(0.12, Math.abs(p.spin ?? 1)), Y = a.hy, c = Math.cos(p.lean || 0), n = Math.sin(p.lean || 0);
  return [T.sx + T.s * (c * X - n * Y), T.sy + T.s * (n * X + c * Y)];
}

// where the hands go: swinging at the sides, or a pose (sorry, phone, clap, rumba, hold, wave, trolley, pull)
function arms(p, L, o) {
  const { sw, ySh, yWaist, amp, ph, d, cr, run } = o, out = [];
  const yH = ySh + 0.6, sK = clamp(p.armK ?? 1);
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    // the swing, through the lens: a hand swung toward the camera drops on the screen
    const heavy = L.bag?.t === 'brief' && (L.bag.side > 0) === (i === 1);
    const sw2 = (run ? 0.34 : heavy ? 0.07 : 0.2) * amp;
    const dh = p.dir * sw2 * Math.sin(ph + i * Math.PI + Math.PI);
    const persp = (-cr * dh) / (d + dh);
    let hx = side * (sw + 0.015), hy = yH + persp - Math.abs(Math.sin(ph)) * 0.025 * amp, ex = side * (sw + 0.035), ey = (ySh + yH) / 2;
    if (run) { hx = side * (sw - 0.02); hy = ySh + 0.32 + persp * 0.8; ex = side * (sw + 0.06); ey = ySh + 0.26; }
    let hs = d / (d + dh);
    let tx = hx, ty = hy, tex = ex, tey = ey;
    switch (p.arms) {
      case 'sorry': tx = side * 0.1; ty = ySh + 0.17 - (i ? 0.02 : 0); tex = side * (sw + 0.07); tey = ySh + 0.3; hs = 1.15; break;
      case 'phone': tx = side * 0.035; ty = ySh + 0.26; tex = side * (sw + 0.01); tey = ySh + 0.34; break;
      case 'clap': { const c = 0.018 + 0.1 * Math.abs(Math.sin(p.beat * Math.PI)); tx = side * c; ty = ySh + 0.14 - Math.abs(Math.sin(p.beat * Math.PI)) * 0.03; tex = side * (sw + 0.07); tey = ySh + 0.26; break; }
      case 'rumba': {
        const up = (p.side || 1) === side;
        if (up) { tx = side * 0.1; ty = ySh - 0.5; tex = side * 0.3; tey = ySh - 0.2; }
        else { tx = side * 0.19; ty = yWaist + 0.04; tex = side * (sw + 0.14); tey = yWaist - 0.12; }
        break;
      }
      case 'hold': if ((p.side || 1) === side) { tx = side * 0.36; ty = yH - 0.06; tex = side * (sw + 0.1); tey = (ySh + yH) / 2 + 0.02; } break;
      case 'pull': if (side < 0) { tx = side * (sw + 0.03); ty = yH - 0.02; tex = side * (sw + 0.05); tey = (ySh + yH) / 2; } break;
      case 'trolley': if (side > 0) { tx = side * (sw + 0.06); ty = yH + 0.12; tex = side * (sw + 0.07); tey = (ySh + yH) / 2 + 0.04; } break;
      case 'wave': if (side > 0) { tx = side * 0.28 + Math.sin(p.beat * 9) * 0.04; ty = ySh - 0.35; tex = side * 0.34; tey = ySh - 0.05; } break;
    }
    out.push({ hx: lerp(hx, tx, sK), hy: lerp(hy, ty, sK), ex: lerp(ex, tex, sK), ey: lerp(ey, tey, sK), hs });
  }
  return out;
}

function mouth(g, m, x, y, col, dark) {
  g.lineCap = 'round';
  if (m === 1) { ell(g, x, y + 0.004, 0.02, 0.022); g.fillStyle = dark; g.fill(); return; }          // «¡perdón!»
  g.strokeStyle = col; g.lineWidth = 0.012;
  g.beginPath();
  if (m === 2) { g.moveTo(x - 0.035, y - 0.006); g.quadraticCurveTo(x, y + 0.03, x + 0.035, y - 0.006); }  // a smile
  else if (m === 3) { g.moveTo(x - 0.03, y + 0.004); g.quadraticCurveTo(x - 0.012, y - 0.01, x, y + 0.002); g.quadraticCurveTo(x + 0.014, y + 0.012, x + 0.03, y - 0.004); } // awkward
  else { g.moveTo(x - 0.022, y); g.lineTo(x + 0.022, y); }
  g.stroke();
}

// hair behind the face (long, bob volume, curls), or all of it seen from behind
function backHair(g, L, hx, hy, hw, hh, c, front, turn = 0) {
  const st = L.style;
  g.fillStyle = c;
  if (front) {
    if (st === 'long') { rrect(g, hx - hw * 0.62, hy - hh * 0.35, hw * 1.24, hh * 1.18, 0.1); g.fill(); }
    else if (st === 'bob') { rrect(g, hx - hw * 0.6, hy - hh * 0.45, hw * 1.2, hh * 0.92, 0.1); g.fill(); }
    else if (st === 'curly') { for (const [a, b, r] of CURLS) { ell(g, hx + a * hw, hy + b * hh, r * hw, r * hw); g.fill(); } }
    else if (st === 'pony' || st === 'bun') { ell(g, hx, hy - hh * 0.05, hw * 0.54, hh * 0.54); g.fill(); }
    return;
  }
  const tx = turn * 0.02;
  switch (st) {
    case 'bald':
      g.beginPath(); g.ellipse(hx, hy + 0.01, hw * 0.52, hh * 0.44, 0, 0.15, Math.PI - 0.15); g.fill();
      break;
    case 'long': rrect(g, hx - hw * 0.6 + tx, hy - hh * 0.52, hw * 1.2, hh * 1.3, 0.11); g.fill(); break;
    case 'bob': rrect(g, hx - hw * 0.6 + tx, hy - hh * 0.52, hw * 1.2, hh * 0.98, 0.11); g.fill(); break;
    case 'curly': for (const [a, b, r] of CURLS_B) { ell(g, hx + a * hw + tx, hy + b * hh, r * hw, r * hw); g.fill(); } break;
    case 'pony':
      ell(g, hx + tx, hy - 0.01, hw * 0.53, hh * 0.52); g.fill();
      rrect(g, hx - 0.035 + tx * 2, hy + 0.02, 0.07, hh * 0.72, 0.035); g.fill();
      break;
    case 'bun':
      ell(g, hx + tx, hy - 0.005, hw * 0.53, hh * 0.52); g.fill();
      ell(g, hx + tx * 1.5, hy - hh * 0.36, hw * 0.24, hw * 0.22); g.fill();
      break;
    default: // short, side, crop: a cap of hair down to the nape
      g.beginPath(); g.ellipse(hx + tx, hy - 0.004, hw * 0.53, hh * 0.52, 0, Math.PI * 0.94, Math.PI * 2.06); g.lineTo(hx + hw * 0.5, hy + hh * 0.26); g.quadraticCurveTo(hx, hy + hh * 0.36, hx - hw * 0.5, hy + hh * 0.26); g.closePath(); g.fill();
  }
}
const CURLS = [[-0.42, -0.2, 0.26], [0.42, -0.2, 0.26], [-0.5, 0.08, 0.22], [0.5, 0.08, 0.22], [-0.3, -0.42, 0.26], [0.3, -0.42, 0.26], [0, -0.5, 0.28], [-0.46, 0.3, 0.18], [0.46, 0.3, 0.18]];
const CURLS_B = [...CURLS, [0, -0.2, 0.34], [-0.2, 0.1, 0.3], [0.2, 0.1, 0.3], [0, 0.25, 0.26]];
// the hair that frames the face: a fringe, a parting, a hairline
function frontHair(g, L, hx, hy, hw, hh, c, turn) {
  const st = L.style, tx = turn * 0.02;
  g.fillStyle = c;
  g.beginPath();
  switch (st) {
    case 'bald':
      g.ellipse(hx - hw * 0.47, hy - 0.02, 0.035, 0.06, 0.2, 0, TAU); g.fill(); g.beginPath(); g.ellipse(hx + hw * 0.47, hy - 0.02, 0.035, 0.06, -0.2, 0, TAU);
      break;
    case 'side':
      g.moveTo(hx - hw * 0.52, hy - 0.01); g.quadraticCurveTo(hx - hw * 0.56, hy - hh * 0.6, hx + tx, hy - hh * 0.56);
      g.quadraticCurveTo(hx + hw * 0.58, hy - hh * 0.52, hx + hw * 0.52, hy - 0.02); g.quadraticCurveTo(hx + hw * 0.3, hy - hh * 0.3, hx - hw * 0.12 + tx, hy - hh * 0.3);
      g.quadraticCurveTo(hx - hw * 0.4, hy - hh * 0.24, hx - hw * 0.52, hy - 0.01);
      break;
    case 'crop':
      g.moveTo(hx - hw * 0.5, hy - 0.03); g.quadraticCurveTo(hx - hw * 0.5, hy - hh * 0.56, hx, hy - hh * 0.55); g.quadraticCurveTo(hx + hw * 0.5, hy - hh * 0.56, hx + hw * 0.5, hy - 0.03);
      g.quadraticCurveTo(hx + hw * 0.4, hy - hh * 0.36, hx + tx, hy - hh * 0.38); g.quadraticCurveTo(hx - hw * 0.4, hy - hh * 0.36, hx - hw * 0.5, hy - 0.03);
      break;
    case 'bob': case 'long':
      g.moveTo(hx - hw * 0.56, hy + hh * 0.12); g.quadraticCurveTo(hx - hw * 0.62, hy - hh * 0.62, hx + tx, hy - hh * 0.56);
      g.quadraticCurveTo(hx + hw * 0.62, hy - hh * 0.62, hx + hw * 0.56, hy + hh * 0.12); g.lineTo(hx + hw * 0.4, hy - hh * 0.12);
      g.quadraticCurveTo(hx + hw * 0.1 + tx, hy - hh * 0.26, hx - hw * 0.1 + tx, hy - hh * 0.2); g.quadraticCurveTo(hx - hw * 0.35, hy - hh * 0.14, hx - hw * 0.4, hy - hh * 0.1);
      break;
    case 'curly':
      for (const [a, b, r] of [[-0.3, -0.36, 0.2], [0, -0.42, 0.22], [0.3, -0.36, 0.2], [-0.46, -0.12, 0.14], [0.46, -0.12, 0.14]]) { g.moveTo(hx + a * hw + tx + r * hw, hy + b * hh); g.ellipse(hx + a * hw + tx, hy + b * hh, r * hw, r * hw * 0.9, 0, 0, TAU); }
      break;
    case 'pony': case 'bun':
      g.moveTo(hx - hw * 0.5, hy - 0.01); g.quadraticCurveTo(hx - hw * 0.52, hy - hh * 0.58, hx + tx, hy - hh * 0.55); g.quadraticCurveTo(hx + hw * 0.52, hy - hh * 0.58, hx + hw * 0.5, hy - 0.01);
      g.quadraticCurveTo(hx + hw * 0.36, hy - hh * 0.34, hx + tx, hy - hh * 0.36); g.quadraticCurveTo(hx - hw * 0.36, hy - hh * 0.34, hx - hw * 0.5, hy - 0.01);
      if (st === 'bun') { g.moveTo(hx + tx + hw * 0.22, hy - hh * 0.62); g.ellipse(hx + tx, hy - hh * 0.62, hw * 0.22, hw * 0.19, 0, 0, TAU); }
      break;
    default: // short
      g.moveTo(hx - hw * 0.52, hy - 0.02); g.quadraticCurveTo(hx - hw * 0.54, hy - hh * 0.6, hx, hy - hh * 0.56); g.quadraticCurveTo(hx + hw * 0.54, hy - hh * 0.6, hx + hw * 0.52, hy - 0.02);
      g.quadraticCurveTo(hx + hw * 0.44, hy - hh * 0.32, hx + hw * 0.1 + tx, hy - hh * 0.36); g.quadraticCurveTo(hx - hw * 0.3 + tx, hy - hh * 0.28, hx - hw * 0.52, hy - 0.02);
  }
  g.fill();
}
function hat(g, L, hx, hy, hw, hh, C, front) {
  if (L.hat === 'sun') {
    ell(g, hx, hy - hh * 0.36, hw * 0.95, hh * 0.13); g.fillStyle = C('#e6d7ad'); g.fill();
    g.beginPath(); g.ellipse(hx, hy - hh * 0.42, hw * 0.5, hh * 0.3, 0, Math.PI, TAU); g.fill();
    g.fillStyle = C('#7b2837'); g.fillRect(hx - hw * 0.5, hy - hh * 0.46, hw, 0.025);
  } else if (L.hat === 'cap') {
    g.beginPath(); g.ellipse(hx, hy - hh * 0.3, hw * 0.54, hh * 0.34, 0, Math.PI, TAU); g.fillStyle = C('#3452a3'); g.fill();
    if (front) { ell(g, hx, hy - hh * 0.3, hw * 0.46, hh * 0.08); g.fillStyle = C('#26356b'); g.fill(); }
  }
}

// things that trail behind people, drawn at their own depth: the tourist's suitcase, the granny's trolley
export function drawSuitcase(g, T, col, handle) {
  const k = T.fog, C = (c) => fog(c, k);
  g.save(); g.translate(T.sx, T.sy); g.scale(T.s, T.s);
  ell(g, 0, 0, 0.24, 0.24 * clamp(T.cr / T.d, 0.18, 0.9) * 0.8); g.fillStyle = C(PAL.shadow); g.globalAlpha = 0.4; g.fill(); g.globalAlpha = 1;
  if (Array.isArray(handle)) {
    const hx = (handle[0] - T.sx) / T.s, hy = (handle[1] - T.sy) / T.s;
    g.strokeStyle = C('#44474d'); g.lineWidth = 0.022; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -0.63); g.lineTo(0, -0.74); g.lineTo(hx, hy); g.stroke();
  } else if (handle) { g.strokeStyle = C('#44474d'); g.lineWidth = 0.02; g.beginPath(); g.moveTo(-0.05, -0.62); g.lineTo(-0.05, -0.95); g.lineTo(0.05, -0.95); g.lineTo(0.05, -0.62); g.stroke(); }
  rrect(g, -0.2, -0.64, 0.4, 0.6, 0.05); g.fillStyle = C(col); g.fill();
  g.fillStyle = C(darker(col, 0.2));
  for (const x of [-0.1, 0, 0.1]) g.fillRect(x - 0.01, -0.6, 0.02, 0.52);
  for (const x of [-0.15, 0.15]) { ell(g, x, -0.025, 0.03, 0.03); g.fillStyle = C('#1d1d20'); g.fill(); }
  g.restore();
}
export function drawTrolley(g, T, col, hand) {
  const k = T.fog, C = (c) => fog(c, k);
  g.save(); g.translate(T.sx, T.sy); g.scale(T.s, T.s);
  ell(g, 0, 0, 0.22, 0.22 * clamp(T.cr / T.d, 0.18, 0.9) * 0.8); g.fillStyle = C(PAL.shadow); g.globalAlpha = 0.4; g.fill(); g.globalAlpha = 1;
  g.strokeStyle = C('#8d9196'); g.lineWidth = 0.022; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0.14, -0.1);
  if (hand) { g.lineTo(0.15, -0.72); g.lineTo((hand[0] - T.sx) / T.s, (hand[1] - T.sy) / T.s); }
  else { g.lineTo(0.16, -0.95); g.lineTo(0.02, -0.98); }
  g.stroke();
  rrect(g, -0.17, -0.72, 0.32, 0.56, 0.07); g.fillStyle = C(col); g.fill();
  // the tartan: two crossing bands
  g.fillStyle = C(darker(col, 0.25));
  g.fillRect(-0.17, -0.55, 0.32, 0.05); g.fillRect(-0.17, -0.34, 0.32, 0.05); g.fillRect(-0.09, -0.72, 0.04, 0.56); g.fillRect(0.05, -0.72, 0.04, 0.56);
  g.fillStyle = C(lighter(col, 0.35)); g.fillRect(-0.17, -0.46, 0.32, 0.015); g.fillRect(-0.02, -0.72, 0.015, 0.56);
  for (const x of [-0.12, 0.1]) { ell(g, x, -0.06, 0.06, 0.06); g.fillStyle = C('#232326'); g.fill(); }
  g.restore();
}
