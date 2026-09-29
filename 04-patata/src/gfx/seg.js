// Seven-segment digits: the camera's LCD and the orange date a 90s camera burns into the corner.
//  a
// f b
//  g
// e c
//  d
const MAP = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', E: 'afged', r: 'eg', o: 'cdeg' };
function segPath(g, s, x, y, w, h, t) {
  const k = t * 0.5, sl = w * 0.12; // slant
  const P = {
    a: [[x + k + sl, y], [x + w - k + sl, y]], d: [[x + k - sl, y + h], [x + w - k - sl, y + h]], g: [[x + k, y + h / 2], [x + w - k, y + h / 2]],
    f: [[x + sl, y + k], [x, y + h / 2 - k]], b: [[x + w + sl, y + k], [x + w, y + h / 2 - k]],
    e: [[x, y + h / 2 + k], [x - sl, y + h - k]], c: [[x + w, y + h / 2 + k], [x + w - sl, y + h - k]],
  };
  const [p, q] = P[s];
  g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]);
}
// draws str with its top-left at (x, y), digit height h; returns the width used
export function seg7(g, str, x, y, h, { on = '#ff7a1a', off = null, glow = 0, lw = null } = {}) {
  const w = h * 0.5, t = lw || h * 0.14, gap = h * 0.26;
  let cx = x;
  g.save(); g.lineCap = 'round'; g.lineWidth = t;
  for (const ch of String(str)) {
    if (ch === "'") { g.beginPath(); g.moveTo(cx + w * 0.3, y); g.lineTo(cx + w * 0.18, y + h * 0.22); g.strokeStyle = on; g.stroke(); cx += w * 0.55; continue; }
    if (ch === ':') { g.fillStyle = on; for (const f of [0.3, 0.72]) { g.beginPath(); g.arc(cx + w * 0.2, y + h * f, t * 0.55, 0, Math.PI * 2); g.fill(); } cx += w * 0.5; continue; }
    const segs = MAP[ch] ?? '';
    if (off) { g.beginPath(); for (const s of 'abcdefg') segPath(g, s, cx, y, w, h, t); g.strokeStyle = off; g.stroke(); }
    if (segs) {
      g.beginPath(); for (const s of segs) segPath(g, s, cx, y, w, h, t);
      if (glow) { g.shadowColor = on; g.shadowBlur = glow; }
      g.strokeStyle = on; g.stroke(); g.shadowBlur = 0;
    }
    cx += w + gap;
  }
  g.restore();
  return cx - x - gap;
}
export const segWidth = (str, h) => { let n = 0; for (const ch of String(str)) n += ch === "'" ? h * 0.275 : ch === ':' ? h * 0.25 : h * 0.76; return n - h * 0.26; };
