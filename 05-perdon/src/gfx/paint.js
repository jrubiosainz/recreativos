// The print: a few matte inks on off-white stock and the station's haze. Every colour drawn in the
// station goes through fog(), so the far end of a corridor sinks into it without any transparency.
import { mix, clamp, TAU } from '../util.js';
export { TAU };

export const PAL = {
  paper: '#f1ede3', fog: '#dcdfdb', ink: '#1d2233',
  tile: '#f3f2ec', grout: '#cfd1cb', bevel: '#e2e2dc', band: '#2350a8', bandDk: '#1b3f8a',
  floor: '#c6c7c1', floorDk: '#b7b8b2', seam: '#a9aaa4', speck: '#8f908b', speckLt: '#dedfd9',
  sign: '#1e3f95', signLt: '#f4f3ee', pink: '#efb4c4', pinkDk: '#d98ea3', violet: '#643991', violetLt: '#9a78c4',
  steel: '#aeb2b7', steelDk: '#6a6f76', steelLt: '#d7dadd', glass: '#cfe1e6', go: '#2f9d57', stop: '#d5342c',
  yellow: '#f2c21a', yellowDk: '#d5a20c', rubber: '#3a3c40', track: '#4b4a47', trackDk: '#2f2e2c', rail: '#9ea1a4',
  train: '#2b50a4', trainDk: '#1f3d82', trainLt: '#e7e8e3', door: '#d9dbd8', glassDk: '#2a3140', lit: '#f1e4b3',
  shadow: '#9fa09a',
};

// people: a limited set of inks (coats, trousers, skin, hair), all matte
export const COATS = ['#26356b', '#3452a3', '#b88e5e', '#7b2837', '#8f9297', '#3b3d43', '#676842', '#d6cab0'];
export const LEGS = ['#1f2a52', '#2e3036', '#33476f', '#1b1b1f', '#57483a'];
export const SKIN = ['#f2c9a6', '#e4b28c', '#c98f66', '#9c6546', '#6f4631'];
export const HAIR = ['#1e1a19', '#3b2a22', '#5b3d2b', '#7b3b22', '#a09f9b', '#dad7d0'];
export const SHOES = ['#1d1b1b', '#4b2d1f', '#2a2a2e'];
export const BAGS = ['#1e1d20', '#5b3a24', '#7b2837', '#26356b', '#3b3d43'];
export const YOU = { coat: '#f3c21a', coatDk: '#d9a511', legs: '#2f4b87', shoes: '#2b2321', hair: '#4b3122', bag: '#2d4f9e', strap: '#1f3a78', skin: '#eab896' };

const fogC = new Map();
export function fog(c, k) {
  if (k <= 0.02) return c;
  const q = Math.round(clamp(k) * 20), key = c + q;
  let v = fogC.get(key);
  if (v === undefined) fogC.set(key, (v = mix(c, PAL.fog, q / 20)));
  return v;
}
const dk = new Map();
export function darker(c, a = 0.18) {
  const key = c + a;
  let v = dk.get(key);
  if (v === undefined) dk.set(key, (v = mix(c, '#141826', a)));
  return v;
}
export function lighter(c, a = 0.18) {
  const key = c + '+' + a;
  let v = dk.get(key);
  if (v === undefined) dk.set(key, (v = mix(c, '#ffffff', a)));
  return v;
}

export const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.abs(rx) + 1e-5, Math.abs(ry) + 1e-5, rot, 0, TAU); };
export function poly(g, pts, close = true) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  if (close) g.closePath();
}
export function fillPoly(g, col, pts) { poly(g, pts); g.fillStyle = col; g.fill(); }
export function rrect(g, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// a thick round-capped stroke through three points (a limb: shoulder, elbow, hand)
export function limb(g, col, w, x0, y0, x1, y1, x2, y2) {
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x1, y1, x2, y2);
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
}
