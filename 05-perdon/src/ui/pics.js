// Portraits for the validator's «Hoy en la estación» plate: each kind of traveller a trip introduces,
// drawn by the same hand as the station so you know them when you meet them, in the pose that gives
// them away. Plus the things that are not people: a train emptying out, the turnstiles, the stairs.
import { drawWalker, drawSuitcase, drawTrolley, handAt } from '../gfx/walker.js';
import { make, YOU_LOOK } from '../gfx/looks.js';
import { PAL, rrect } from '../gfx/paint.js';
import { glance } from '../scene.js';

const BASE = { face: false, ph: 0, amp: 0, dir: 1, lean: 0, turn: 0, gx: 0, gy: 0, brows: 0, mouth: 0, blink: 0, arms: null, armK: 1, side: 1, beat: 0, spin: 1, down: 0, run: 0, hip: 0 };
const FACE = { face: true, dir: -1 };
const cache = new Map();

function who(g, kind, seed, x, y, s, pose) {
  const L = kind === 'you' ? YOU_LOOK : make(kind, seed), T = { sx: x, sy: y, s, d: 5, cr: 1.7, fog: 0 }, p = { ...BASE, ...pose };
  return { L, T, p, draw: () => drawWalker(g, T, L, p) };
}
function arrowSign(g, x, y, S, ok) {
  rrect(g, x - S / 2, y - S / 2, S, S, S * 0.18); g.fillStyle = PAL.ink; g.fill();
  g.fillStyle = ok ? PAL.go : PAL.stop; g.strokeStyle = PAL.stop;
  if (ok) {
    const u = S / 40;
    g.beginPath(); g.moveTo(x, y - 14 * u); g.lineTo(x + 12 * u, y); g.lineTo(x + 5 * u, y); g.lineTo(x + 5 * u, y + 13 * u);
    g.lineTo(x - 5 * u, y + 13 * u); g.lineTo(x - 5 * u, y); g.lineTo(x - 12 * u, y); g.closePath(); g.fill();
  } else {
    g.lineWidth = S * 0.14; g.lineCap = 'round'; const r = S * 0.26;
    g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke();
  }
}
// a turnstile seen from behind: the cabinet, the validator's sign on top, the paddles
function gate(g, x, y, s, ok) {
  const w = 0.3 * s, h = 1.0 * s;
  g.fillStyle = PAL.steelDk; g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle = PAL.steel; g.fillRect(x - w / 2, y - h, w, h * 0.12);
  arrowSign(g, x, y - h - 0.2 * s, 0.3 * s, ok);
  g.fillStyle = ok ? PAL.steelLt : PAL.stop;
  g.fillRect(x + w / 2, y - 0.62 * h, 0.26 * s, 0.1 * s);
  g.fillRect(x - w / 2 - 0.26 * s, y - 0.62 * h, 0.26 * s, 0.1 * s);
}

// one picture per `intro` key; W×H CSS pixels, drawn at the device's density
export function pic(key, W = 112, H = 128, dpr = Math.min(2, globalThis.devicePixelRatio || 1)) {
  const ck = `${key}|${W}|${H}|${dpr}`;
  if (cache.has(ck)) return copy(cache.get(ck));
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const g = c.getContext('2d'), X = c.width, Y = c.height, base = Y * 0.93, s = (Y * 0.76) / 1.75;
  switch (key) {
    case 'polite': {
      const m = who(g, 'polite', 11, X / 2, base, s, { ...FACE, turn: 0.85, gx: 1, gy: 0.2, lean: 0.09 });
      m.draw(); glance(g, m.T, m.L, m.p, 1, 1);
      break;
    }
    case 'slow': who(g, 'slow', 5, X / 2, base, s, { amp: 0.55, ph: 0.9 }).draw(); break;
    case 'ask': case 'askK': case 'askT': who(g, 'you', 0, X / 2, base, s, { arms: 'wave', beat: 0.05 }).draw(); break;
    case 'zombie': who(g, 'zombie', 23, X / 2, base, s, { ...FACE, arms: 'phone', down: 1, gy: 0.8, amp: 0.45, ph: 0.6 }).draw(); break;
    case 'espejo': who(g, 'espejo', 7, X / 2, base, s, { ...FACE, brows: 1, mouth: 3, gx: 0.9, turn: -0.25 }).draw(); break;
    case 'tourist': {
      const m = who(g, 'tourist', 9, X * 0.56, base, s * 0.96, { ...FACE, arms: 'pull', gy: -0.8, turn: 0.3, gx: 0.3 });
      const Tb = { sx: X * 0.56 - 0.36 * s, sy: base - 0.05 * s, s: s * 0.94, d: 5.4, cr: 1.7, fog: 0 };
      drawSuitcase(g, Tb, m.L.props.suitcase || '#7b2837', handAt(m.T, m.L, m.p, 0));
      m.draw();
      break;
    }
    case 'granny': {
      const m = who(g, 'granny', 3, X * 0.42, base - 0.04 * s, s, { arms: 'trolley', amp: 0.35, ph: 0.5 });
      m.draw();
      const Tt = { sx: X * 0.42 + 0.3 * s, sy: base + 0.02 * s, s: s * 1.02, d: 4.6, cr: 1.7, fog: 0 };
      drawTrolley(g, Tt, m.L.props.trolley || '#7b2837', handAt(m.T, m.L, m.p, 1));
      break;
    }
    case 'couple': {
      const k = s * 0.88, a = who(g, 'couple', 31, X * 0.32, base, k, { ...FACE, arms: 'hold', side: 1, turn: 0.2 }), b = who(g, 'couple', 32, X * 0.68, base, k, { ...FACE, arms: 'hold', side: -1, turn: -0.2 });
      a.draw(); b.draw();
      break;
    }
    case 'group': case 'groupCo': {
      const co = key === 'groupCo', k = s * 0.78, xs = [0.22, 0.5, 0.78];
      for (let i = 0; i < 3; i++) {
        const t = i === 1 ? 0 : (i ? -0.5 : 0.5) * (co ? -1 : 1);
        who(g, co ? 'groupCo' : 'group', 17 + i * 13, X * xs[i], base - (i === 1 ? 0.06 * s : 0), k, co ? { turn: t, amp: 0.3, ph: i } : { ...FACE, turn: t, gx: -t, mouth: i === 1 ? 1 : 0 }).draw();
      }
      break;
    }
    case 'runner': who(g, 'runner', 13, X / 2, base, s, { run: 1, amp: 1, ph: 1.25, lean: 0.05 }).draw(); break;
    case 'wave': {
      const rows = [[0.3, 0.72, 0.62], [0.7, 0.72, 0.62], [0.5, 0.86, 0.8], [0.14, 0.97, 0.9], [0.86, 0.97, 0.9]];
      for (const [i, [fx, fy, k]] of rows.entries()) who(g, 'polite', 40 + i * 7, X * fx, Y * fy, s * k, { ...FACE, amp: 0.6, ph: i * 1.3, gx: (i % 2 ? 1 : -1) * 0.4 }).draw();
      break;
    }
    case 'gate': {
      gate(g, X * 0.28, base - 0.1 * s, s * 0.86, true);
      gate(g, X * 0.72, base - 0.1 * s, s * 0.86, false);
      break;
    }
    case 'stairs': {
      const n = 5, sw = X / (n + 0.6), sh = Y * 0.11;
      g.fillStyle = PAL.steelLt;
      for (let i = 0; i < n; i++) g.fillRect(i * sw, base - (i + 1) * sh, X - i * sw, sh);
      g.fillStyle = PAL.steelDk;
      for (let i = 0; i < n; i++) g.fillRect(i * sw, base - (i + 1) * sh, X - i * sw, sh * 0.16);
      who(g, 'you', 0, X * 0.5, base - 2 * sh, s * 0.7, { amp: 0.5, ph: 0.4 }).draw();
      break;
    }
  }
  cache.set(ck, c);
  return copy(c);
}
function copy(c) {
  const d = document.createElement('canvas'); d.width = c.width; d.height = c.height;
  d.getContext('2d').drawImage(c, 0, 0);
  return d;
}
