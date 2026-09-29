// Progress in localStorage (tolerates private mode and corrupted data). Per stadium: the three stars
// ever earned (the goal, the stadium's feat, one lap beyond the goal), the longest wave in laps, how
// often it was played, and whether the goal was ever reached (that is what opens the next ground).
// Plus the hints already read, sound and language.
const KEY = 'laola.v1';

export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') s = {};
  if (!s.lv || typeof s.lv !== 'object') s.lv = {};
  if (!Array.isArray(s.hints)) s.hints = [];
  return s;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

// merge a finished match into the save; returns what changed, for the full-time board
export function recordResult(save, lv, sim) {
  const id = lv.id, prev = save.lv[id] || {}, rec = { ...prev }, st = sim.stars(), e = sim.end;
  const was = prev.set?.slice() || [false, false, false];
  rec.plays = (prev.plays || 0) + 1;
  rec.set = [0, 1, 2].map((i) => !!(was[i] || st[i]));
  rec.stars = rec.set.filter(Boolean).length;
  const laps = Math.floor(e.best * 10) / 10;
  const best = e.best > 0 && prev.best != null && laps > prev.best;
  if (prev.best == null || laps > prev.best) rec.best = laps;
  const opened = st[0] && !prev.done;
  if (st[0]) rec.done = true;
  save.lv[id] = rec;
  writeSave(save);
  return { set: st, was, first: !prev.plays, best, opened, all: rec.stars === 3 && (prev.stars || 0) < 3 };
}

export function isUnlocked(save, levels, i) {
  if (i <= 0 || save.unlockAll) return true;
  return !!save.lv[levels[i - 1].id]?.done;
}
