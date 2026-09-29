// Eki stamps (駅スタンプ): every station has its own rubber stamp, in its own ink, with a local motif.
// Drawn with Canvas2D so the result screen, the stamp rally sheet and the share card print the same stamp.
import { FONT, JP } from './fx.js';
import { mulberry32, TAU } from './util.js';

export const STAMP = {
  s1: { ink: '#d9472f', frame: 'circle', motif: 'dawn' },
  s2: { ink: '#2f64b1', frame: 'square', motif: 'bridge' },
  s3: { ink: '#1f8a83', frame: 'oct', motif: 'torii' },
  s4: { ink: '#d4447e', frame: 'scallop', motif: 'sakura' },
  s5: { ink: '#6d45b0', frame: 'square', motif: 'sumo' },
  s6: { ink: '#c07a0c', frame: 'oct', motif: 'clock' },
  s7: { ink: '#23915a', frame: 'circle', motif: 'map' },
  s8: { ink: '#b8323a', frame: 'square', motif: 'train' },
};

function framePath(g, kind, r) {
  g.beginPath();
  if (kind === 'circle') g.arc(0, 0, r, 0, TAU);
  else if (kind === 'square') { const k = r * 0.9, c = r * 0.26; g.roundRect(-k, -k, 2 * k, 2 * k, c); }
  else if (kind === 'oct') { for (let i = 0; i < 8; i++) { const a = (i + 0.5) * (TAU / 8); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }
  else if (kind === 'scallop') {
    const n = 18;
    for (let i = 0; i <= n * 8; i++) { const a = (i / (n * 8)) * TAU, rr = r * (0.955 + 0.045 * Math.cos(a * n)); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath();
  }
}

// letters around the rim: top reads clockwise, bottom stays upright
function arcText(g, text, r, size, bottom) {
  g.font = `700 ${size}px ${FONT}`;
  let chars = [...text], ws = chars.map((c) => g.measureText(c).width + size * 0.12);
  let total = ws.reduce((a, b) => a + b, 0) / r;
  if (total > 2.1) { size *= 2.1 / total; g.font = `700 ${size}px ${FONT}`; ws = chars.map((c) => g.measureText(c).width + size * 0.12); total = ws.reduce((a, b) => a + b, 0) / r; }
  let a = bottom ? Math.PI / 2 + total / 2 : -Math.PI / 2 - total / 2;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  chars.forEach((c, i) => {
    const da = ws[i] / r, m = bottom ? a - da / 2 : a + da / 2;
    g.save(); g.translate(Math.cos(m) * r, Math.sin(m) * r); g.rotate(bottom ? m - Math.PI / 2 : m + Math.PI / 2); g.fillText(c, 0, 0); g.restore();
    a += bottom ? -da : da;
  });
}

function cut(g, fn) { g.save(); g.globalCompositeOperation = 'destination-out'; fn(); g.restore(); }

// motifs live in a box of half-size s centred on the origin
const MOTIF = {
  dawn(g, s) {
    g.beginPath(); g.arc(0, s * 0.18, s * 0.46, Math.PI, TAU); g.fill();
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / 7); g.beginPath(); g.moveTo(Math.cos(a) * s * 0.6, s * 0.18 + Math.sin(a) * s * 0.6); g.lineTo(Math.cos(a) * s * 0.84, s * 0.18 + Math.sin(a) * s * 0.84); g.stroke(); }
    g.fillRect(-s, s * 0.2, 2 * s, s * 0.09);
    g.beginPath(); g.moveTo(-s * 0.1, s * 0.3); g.lineTo(-s * 0.55, s); g.moveTo(s * 0.1, s * 0.3); g.lineTo(s * 0.55, s); g.stroke();
    for (let i = 0; i < 3; i++) { const y = s * (0.46 + i * 0.2), w = s * (0.2 + i * 0.13); g.fillRect(-w, y, 2 * w, s * 0.055); }
  },
  bridge(g, s) {
    g.beginPath(); g.moveTo(-s, s * 0.05); g.quadraticCurveTo(0, -s * 0.95, s, s * 0.05); g.stroke();
    g.fillRect(-s, s * 0.02, 2 * s, s * 0.12);
    for (const x of [-0.55, -0.2, 0.2, 0.55]) { const y = -s * 0.9 * (1 - x * x) * 0.52 + s * 0.02; g.fillRect(x * s - s * 0.03, y, s * 0.06, s * 0.05 - y); }
    for (let i = 0; i < 3; i++) {
      const y = s * (0.38 + i * 0.22), x0 = -s * (0.95 - i * 0.18);
      g.beginPath(); g.moveTo(x0, y);
      for (let k = 1; k <= 4; k++) g.quadraticCurveTo(x0 + (k - 0.5) * s * 0.42, y - s * 0.09 * (k % 2 ? 1 : -1), x0 + k * s * 0.42, y);
      g.stroke();
    }
  },
  torii(g, s) {
    g.beginPath(); g.moveTo(-s * 0.95, -s * 0.72); g.quadraticCurveTo(0, -s * 0.52, s * 0.95, -s * 0.72); g.lineTo(s * 0.86, -s * 0.52); g.quadraticCurveTo(0, -s * 0.36, -s * 0.86, -s * 0.52); g.closePath(); g.fill();
    g.fillRect(-s * 0.72, -s * 0.28, s * 1.44, s * 0.13);
    g.fillRect(-s * 0.08, -s * 0.46, s * 0.16, s * 0.2);
    g.fillRect(-s * 0.58, -s * 0.46, s * 0.17, s * 1.42); g.fillRect(s * 0.41, -s * 0.46, s * 0.17, s * 1.42);
    for (const [x, y, k] of [[-0.86, -0.12, 1], [0.86, -0.02, 0.8], [-0.84, 0.5, 0.75], [0.85, 0.56, 1]]) {
      const r = s * 0.1 * k, cx = x * s, cy = y * s;
      g.beginPath(); g.moveTo(cx, cy - r * 2.3); g.quadraticCurveTo(cx + r * 1.05, cy - r * 0.5, cx + r, cy); g.arc(cx, cy, r, 0, Math.PI); g.quadraticCurveTo(cx - r * 1.05, cy - r * 0.5, cx, cy - r * 2.3); g.fill();
    }
  },
  sakura(g, s) {
    for (let i = 0; i < 5; i++) {
      g.save(); g.rotate((i / 5) * TAU);
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(-s * 0.46, -s * 0.28, -s * 0.36, -s * 0.9, -s * 0.1, -s * 0.9); g.lineTo(0, -s * 0.76); g.lineTo(s * 0.1, -s * 0.9);
      g.bezierCurveTo(s * 0.36, -s * 0.9, s * 0.46, -s * 0.28, 0, 0); g.fill();
      g.restore();
    }
    cut(g, () => { g.beginPath(); g.arc(0, 0, s * 0.17, 0, TAU); g.fill(); for (let i = 0; i < 5; i++) { const a = (i / 5 + 0.1) * TAU; g.beginPath(); g.arc(Math.cos(a - Math.PI / 2) * s * 0.36, Math.sin(a - Math.PI / 2) * s * 0.36, s * 0.045, 0, TAU); g.fill(); } });
    g.beginPath(); g.arc(0, 0, s * 0.08, 0, TAU); g.fill();
  },
  sumo(g, s) {
    // a rikishi's face under his ginkgo-leaf topknot (大銀杏)
    g.beginPath(); g.ellipse(0, s * 0.2, s * 0.66, s * 0.62, 0, 0, TAU); g.fill();
    for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * s * 0.66, s * 0.22, s * 0.12, s * 0.17, 0, 0, TAU); g.fill(); }
    g.fillRect(-s * 0.09, -s * 0.52, s * 0.18, s * 0.16);
    g.beginPath(); g.moveTo(0, -s * 0.5); g.quadraticCurveTo(-s * 0.5, -s * 0.62, -s * 0.46, -s * 0.9); g.quadraticCurveTo(0, -s * 0.78, s * 0.46, -s * 0.9); g.quadraticCurveTo(s * 0.5, -s * 0.62, 0, -s * 0.5); g.fill();
    cut(g, () => {
      g.lineWidth = s * 0.09; g.lineCap = 'round';
      for (const k of [-1, 1]) { g.beginPath(); g.arc(k * s * 0.25, s * 0.14, s * 0.12, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      g.beginPath(); g.arc(0, s * 0.36, s * 0.15, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
      g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(-s * 0.3, -s * 0.2); g.quadraticCurveTo(0, -s * 0.32, s * 0.3, -s * 0.2); g.stroke();
    });
  },
  clock(g, s) {
    g.beginPath(); g.arc(0, 0, s * 0.92, 0, TAU); g.fill();
    cut(g, () => { g.beginPath(); g.arc(0, 0, s * 0.78, 0, TAU); g.fill(); });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, k = i % 3 ? 0.62 : 0.52; g.beginPath(); g.moveTo(Math.cos(a) * s * k, Math.sin(a) * s * k); g.lineTo(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7); g.stroke(); }
    const hand = (a, len, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(a) * len, -Math.cos(a) * len); g.stroke(); };
    const lw = g.lineWidth;
    hand(((8 + 1 / 60) / 12) * TAU, s * 0.4, lw * 1.5); hand((1 / 60) * TAU, s * 0.6, lw);
    g.beginPath(); g.arc(0, 0, s * 0.08, 0, TAU); g.fill();
  },
  map(g, s) {
    // the transfer sign: two trains' worth of arrows going opposite ways
    const arrow = (y, dir) => {
      g.fillRect(-s * 0.72, y - s * 0.11, s * 1.44, s * 0.22);
      g.beginPath(); g.moveTo(dir * s * 0.98, y); g.lineTo(dir * s * 0.5, y - s * 0.36); g.lineTo(dir * s * 0.5, y + s * 0.36); g.closePath(); g.fill();
    };
    arrow(-s * 0.36, 1); arrow(s * 0.42, -1);
    cut(g, () => { for (const [y, d] of [[-0.36, 1], [0.42, -1]]) for (let i = 0; i < 3; i++) g.fillRect((-d * 0.62 + d * i * 0.26) * s - s * 0.05, (y - 0.035) * s, s * 0.1, s * 0.07); });
  },
  train(g, s) {
    g.beginPath(); g.moveTo(-s * 0.72, s * 0.85); g.lineTo(-s * 0.72, -s * 0.45); g.quadraticCurveTo(-s * 0.7, -s * 0.95, 0, -s * 0.95); g.quadraticCurveTo(s * 0.7, -s * 0.95, s * 0.72, -s * 0.45); g.lineTo(s * 0.72, s * 0.85); g.closePath(); g.fill();
    cut(g, () => {
      g.beginPath(); g.roundRect(-s * 0.54, -s * 0.72, s * 1.08, s * 0.62, s * 0.12); g.fill();
      g.fillRect(-s * 0.72, s * 0.14, s * 1.44, s * 0.1);
      for (const x of [-0.42, 0.42]) { g.beginPath(); g.arc(x * s, s * 0.48, s * 0.11, 0, TAU); g.fill(); }
    });
    g.fillRect(-s * 0.9, s * 0.9, s * 1.8, s * 0.1);
  },
};

// a worn rubber print: speckles and soft blotches bitten out of the ink, one side pressed harder than the other
function wear(g, size, seed, amount) {
  const r = mulberry32(seed);
  cut(g, () => {
    for (let i = 0; i < 380 * amount; i++) { g.globalAlpha = 0.25 + r() * 0.7; g.beginPath(); g.arc(r() * size, r() * size, size * (0.002 + r() * r() * 0.012), 0, TAU); g.fill(); }
    for (let i = 0; i < 7 * amount; i++) {
      const x = r() * size, y = r() * size, rr = size * (0.06 + r() * 0.12), gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(0,0,0,${0.12 + r() * 0.22})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    const a = r() * TAU, lg = g.createLinearGradient(size / 2 + Math.cos(a) * size / 2, size / 2 + Math.sin(a) * size / 2, size / 2 - Math.cos(a) * size / 2, size / 2 - Math.sin(a) * size / 2);
    lg.addColorStop(0, 'rgba(0,0,0,0.3)'); lg.addColorStop(0.6, 'rgba(0,0,0,0)');
    g.globalAlpha = 1; g.fillStyle = lg; g.fillRect(0, 0, size, size);
  });
}

const cache = new Map();
// the stamp as an offscreen canvas of px × px; L is the level (kanji, romaji, code)
export function stampImage(L, px, { ink, wearAmount = 1 } = {}) {
  const key = `${L.id}|${px}|${ink || ''}|${wearAmount}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d'), R = px / 2, D = STAMP[L.id] || STAMP.s1, col = ink || D.ink;
  g.translate(R, R);
  g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = R * 0.065; framePath(g, D.frame, R * 0.93); g.stroke();
  g.lineWidth = R * 0.024; framePath(g, D.frame, R * 0.72); g.stroke();
  const round = D.frame === 'circle' || D.frame === 'scallop';
  const top = `${L.code} · GYŪGYŪ`, bottom = L.romaji.toUpperCase();
  if (round) { const rr = R * (D.frame === 'scallop' ? 0.795 : 0.815); arcText(g, top, rr, R * 0.12, false); arcText(g, bottom, rr, R * 0.12, true); }
  else {
    const y = R * (D.frame === 'oct' ? 0.752 : 0.733);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${R * 0.115}px ${FONT}`;
    const mw = R * (D.frame === 'oct' ? 0.74 : 1.1);
    g.fillText(top, 0, -y + R * 0.01, mw); g.fillText(bottom, 0, y + R * 0.01, mw);
  }
  g.save(); g.translate(0, -R * 0.24); g.lineWidth = R * 0.04; MOTIF[D.motif](g, R * 0.3); g.restore();
  g.fillRect(-R * 0.42, R * 0.13, R * 0.84, R * 0.018);
  const n = [...L.kanji].length, ks = n > 2 ? R * 0.26 : R * 0.33;
  g.font = `700 ${ks}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(L.kanji, 0, R * 0.39, R * 1.2);
  g.setTransform(1, 0, 0, 1, 0, 0);
  wear(g, px, [...L.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0, wearAmount);
  cache.set(key, c);
  return c;
}

// a plain rubber text stamp (乗り残し, 遅延): double rectangle, big word, small line under it
export function textStamp(text, sub, px, ink = '#d23a2c', seed = 3) {
  const w = px, h = Math.round(px * 0.5);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = ink; g.strokeStyle = ink;
  g.lineWidth = h * 0.06; g.beginPath(); g.roundRect(h * 0.05, h * 0.05, w - h * 0.1, h * 0.9, h * 0.1); g.stroke();
  g.lineWidth = h * 0.02; g.beginPath(); g.roundRect(h * 0.13, h * 0.13, w - h * 0.26, h * 0.74, h * 0.05); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${h * 0.4}px ${JP}`; g.fillText(text, w / 2, sub ? h * 0.42 : h * 0.52, w * 0.8);
  if (sub) { g.font = `700 ${h * 0.13}px ${FONT}`; g.fillText(sub.toUpperCase(), w / 2, h * 0.72, w * 0.78); }
  wear(g, Math.max(w, h), seed, 0.8);
  return c;
}
