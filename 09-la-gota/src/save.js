// Progress in localStorage (tolerates private mode and corrupted data). Per trip: the three holes ever
// punched (won, won by a clear margin, a glutton's race), the widest winning margin, how often it was
// played, and whether it was ever won (that is what opens the next trip). Plus the hints already read,
// sound and language.
const KEY = 'lagota.v1';

export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') s = {};
  if (!s.lv || typeof s.lv !== 'object') s.lv = {};
  if (!Array.isArray(s.hints)) s.hints = [];
  return s;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

// the three stars of a finished race: first to the seal · by the trip's margin · ate a rival or enough beads
export function starsOf(lv, e) {
  if (!e?.win) return [false, false, false];
  return [true, (e.margin ?? 0) >= lv.margin, !!e.glut];
}

// merge a finished race into the save; returns what changed, for the ticket
export function recordResult(save, lv, sim) {
  const id = lv.id, prev = save.lv[id] || {}, rec = { ...prev }, e = sim.end, st = starsOf(lv, e);
  const was = prev.set?.slice() || [false, false, false];
  rec.plays = (prev.plays || 0) + 1;
  rec.set = [0, 1, 2].map((i) => !!(was[i] || st[i]));
  rec.stars = rec.set.filter(Boolean).length;
  const m = e.win ? Math.round(Math.min(e.margin, 99) * 10) / 10 : null;
  const best = m != null && prev.best != null && m > prev.best;
  if (m != null && (prev.best == null || m > prev.best)) rec.best = m;
  const opened = e.win && !prev.done;
  if (e.win) rec.done = true;
  save.lv[id] = rec;
  writeSave(save);
  return { set: st, was, first: !prev.plays, best, opened, all: rec.stars === 3 && (prev.stars || 0) < 3 };
}

export function isUnlocked(save, levels, i) {
  if (i <= 0 || save.unlockAll) return true;
  return !!save.lv[levels[i - 1].id]?.done;
}
