// Progress in localStorage (tolerates private mode and corrupted data). Per level: the three PREMIO
// sticks ever earned (bomba, every stick, under par), the biggest splash, the best time, how often it
// was played. Plus the abuela's notes already heard, sound and language.
const KEY = 'hipo.v1';

export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') s = {};
  if (!s.lv || typeof s.lv !== 'object') s.lv = {};
  if (!Array.isArray(s.hints)) s.hints = [];
  return s;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

// merge a finished level into the save; returns what changed, for the poster
export function recordResult(save, lv, sim) {
  const id = lv.id, prev = save.lv[id] || {}, rec = { ...prev }, st = sim.stars(), e = sim.end;
  const was = prev.set?.slice() || [false, false, false];
  rec.plays = (prev.plays || 0) + 1;
  rec.set = [0, 1, 2].map((i) => !!(was[i] || st[i]));
  rec.stars = rec.set.filter(Boolean).length;
  rec.done = true;
  let best = false;
  if (e.why === 'bomba' && (prev.splash == null || e.splash > prev.splash)) { best = prev.splash != null; rec.splash = e.splash; }
  const T = Math.round(e.t * 10) / 10;
  if (prev.time == null || T < prev.time) rec.time = T;
  save.lv[id] = rec;
  writeSave(save);
  return { set: st, was, first: !prev.done, best, prevSplash: prev.splash ?? null, all: rec.stars === 3 && (prev.stars || 0) < 3 };
}

export function isUnlocked(save, levels, i) {
  if (i <= 0 || save.unlockAll) return true;
  return !!save.lv[levels[i - 1].id]?.done;
}
