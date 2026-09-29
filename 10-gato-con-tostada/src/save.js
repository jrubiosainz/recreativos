// Progress in localStorage (tolerates private mode and corrupted data). Per room: the three stars ever earned
// (sat in the box, knocked the tempting thing over, butter to spare), the most butter ever left, how often it
// was played, and whether it was ever won (that is what opens the next room). Plus the hints already read,
// sound and language.
const KEY = 'gatotostada.v1';

export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') s = {};
  if (!s.lv || typeof s.lv !== 'object') s.lv = {};
  if (!Array.isArray(s.hints)) s.hints = [];
  return s;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

// the three stars of a finished flight: in the box · the tempting thing on the floor · butter left over par
export function starsOf(lv, e) {
  if (!e?.win) return [false, false, false];
  return [true, !!e.tempted, (e.butter ?? 0) >= (e.par ?? lv.par ?? 0.5)];
}

// merge a finished flight into the save; returns what changed, for the Polaroid
export function recordResult(save, lv, sim) {
  const id = lv.id, prev = save.lv[id] || {}, rec = { ...prev }, e = sim.end, st = starsOf(lv, e);
  const was = prev.set?.slice() || [false, false, false];
  rec.plays = (prev.plays || 0) + 1;
  rec.set = [0, 1, 2].map((i) => !!(was[i] || st[i]));
  rec.stars = rec.set.filter(Boolean).length;
  const b = e.win ? Math.round(Math.max(0, Math.min(1, e.butter)) * 100) : null;
  const best = b != null && prev.best != null && b > prev.best;
  if (b != null && (prev.best == null || b > prev.best)) rec.best = b;
  const opened = e.win && !prev.done;
  if (e.win) rec.done = true;
  save.lv[id] = rec;
  writeSave(save);
  return { set: st, was, first: !prev.plays, best, butter: b, opened, all: rec.stars === 3 && (prev.stars || 0) < 3 };
}

export function isUnlocked(save, levels, i) {
  if (i <= 0 || save.unlockAll) return true;
  return !!save.lv[levels[i - 1].id]?.done;
}
