// The title's backdrop: the next trip's window with nobody racing on it. «LA GOTA» has been written in the
// fog with a finger, the fog never grows back inside the letters, and the bus rolls on while beads
// condense, fatten and run down through the words. A real Sim, only without candidates or rivals.
import { Sim, GW, GH, PW, PH, YOU } from './sim.js';
import { F } from './fonts.js';

export function titleLevel(lv) {
  return {
    ...lv, stop: 1e9, cands: [], rivals: [], teach: [],
    bus: [['go', 0.2, 5.5, 0.8]],
    food: { ...(lv.food || {}), n: 30, top: 1.5 },
    fog: { ...(lv.fog || {}), regen: 0.07 },
    nuc: 0.9,
  };
}

export function titleSim(lv, word, seed) {
  const sim = new Sim(titleLevel(lv), { seed });
  sim.phase = 'race';
  stampLogo(sim, word);
  return sim;
}

// the logo, as a finger would write it: two lines, as wide as the glass allows, in the upper half
function stampLogo(sim, word) {
  if (typeof document === 'undefined') return;
  const S = 4, c = document.createElement('canvas'); c.width = GW * S; c.height = GH * S;
  const g = c.getContext('2d'), lines = word.split(' ');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  let px = 200; g.font = F.wipe(px);
  const widest = Math.max(...lines.map((w) => g.measureText(w).width));
  px = Math.floor((px * c.width * 0.84) / widest); g.font = F.wipe(px);
  const top = c.height * 0.12, lh = px * 0.9;
  g.translate(c.width / 2, 0); g.rotate(-0.05);
  lines.forEach((w, i) => g.fillText(w, 0, top + px * 0.78 + i * lh));
  const d = g.getImageData(0, 0, c.width, c.height).data, ink = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    let a = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) a += d[((j * S + y) * c.width + i * S + x) * 4 + 3];
    const k = j * GW + i, v = Math.min(1, (a / (S * S * 255)) * 1.25);
    ink[k] = v;
    if (v < 0.04) continue;
    sim.fmax[k] *= 1 - v; sim.f[k] *= 1 - v; sim.Lf[k] = Math.max(sim.Lf[k], v * 0.9);
  }
  // no bead sits on the letters when the title comes up
  for (const dr of sim.drops) {
    if (!dr.alive || sim.ownerOf(dr.id) === YOU) continue;
    const i = Math.min(GW - 1, Math.max(0, Math.floor((dr.x / PW) * GW))), j = Math.min(GH - 1, Math.max(0, Math.floor((dr.y / PH) * GH)));
    if (ink[j * GW + i] > 0.2) dr.alive = false;
  }
}
