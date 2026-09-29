// Progress in localStorage (tolerates private mode and corrupted data). Per level: the three checks
// ever earned, the best time up, how often it was played. Plus the tutorial notes already shown,
// sound and language.
const KEY = 'unsoloviaje.v1';

export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') s = {};
  if (!s.lv || typeof s.lv !== 'object') s.lv = {};
  if (!Array.isArray(s.hints)) s.hints = [];
  return s;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

// merge a finished level into the save; returns what changed, for the label
export function recordResult(save, lv, sim) {
  const id = lv.id, prev = save.lv[id] || {}, rec = { ...prev }, st = sim.stars(), won = st[0];
  const was = prev.set?.slice() || [false, false, false];
  rec.plays = (prev.plays || 0) + 1;
  rec.set = [0, 1, 2].map((i) => !!(was[i] || st[i]));
  rec.stars = rec.set.filter(Boolean).length;
  let best = false;
  if (won) {
    rec.won = true;
    const T = Math.round(sim.end.t * 10) / 10;
    if (prev.best == null || T < prev.best) { best = prev.best != null; rec.best = T; }
  }
  save.lv[id] = rec;
  writeSave(save);
  return { set: st, was, won, first: won && !prev.won, best, prevBest: prev.best ?? null };
}

export function isUnlocked(save, levels, i) {
  if (i <= 0 || save.unlockAll) return true;
  return !!save.lv[levels[i - 1].id]?.won;
}
