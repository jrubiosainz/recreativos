// The whole family on the print: everybody in depth order, and whoever is carried drawn between the
// body of the person carrying them and that person's forearms.
import { layout } from '../layout.js';
import { lookFor } from './looks.js';
import { drawPerson, drawHolderFront } from './person.js';

// R: the print's rectangle in px. S: a Map of per-person animation state that lives across frames
export function drawGroup(g, ev, mode, V, R, S, t, dt, fx = {}) {
  const lay = layout(ev, mode), byId = {}, holders = {};
  for (const p of V.people) byId[p.id] = p;
  for (const [id, by] of Object.entries(ev.held || {})) holders[by] = id;
  const stOf = (id) => { let s = S.get(id); if (!s) S.set(id, (s = {})); return s; };
  const faces = {};
  for (const q of Object.values(lay).filter((q) => !q.held).sort((a, b) => a.z - b.z)) {
    const v = byId[q.id]; if (!v) continue;
    const L = lookFor(ev, q.id), X = R.x + q.x * R.w, Y = R.y + q.y * R.h, D = q.d * R.w;
    const hid = holders[q.id], hv = hid && byId[hid], h = hid && lay[hid], L2 = hid && lookFor(ev, hid);
    const o = { t, dt, G: q.G, W: R.w, st: stOf(q.id), flash: fx.flash, redeye: fx.redeye, hold: hv ? { kind: L2.dog ? 'dog' : L2.body, side: h.side } : null };
    faces[q.id] = drawPerson(g, L, v, X, Y, D, o);
    if (!hv) continue;
    const st = o.st, P = st.P, lv = st.lv;
    let hx = ((h.x - q.x) * R.w) / D, hy = ((h.y - q.y) * R.h) / D;
    if (P) {
      const c = Math.cos(P.sway), s = Math.sin(P.sway), px = hx, ry = hy - lv.yH - P.breath * 0.5;
      hx = P.dx + px * c - ry * s; hy = P.dy + lv.yH + px * s + ry * c;
    }
    const o2 = { t, dt, G: 0, W: R.w, st: stOf(hid), side: h.side, flash: fx.flash, redeye: fx.redeye };
    faces[hid] = drawPerson(g, L2, hv, X + hx * D, Y + hy * D, h.d * R.w, o2);
    drawHolderFront(g, L, v, X, Y, D, o);
  }
  return faces;
}
