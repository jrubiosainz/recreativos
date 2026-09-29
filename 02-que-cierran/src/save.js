// Progress in localStorage (tolerates private mode and corrupted data).
// Per station: the three stamps (target, on time, gold), the best load and the fewest delay seconds.
const KEY = 'quecierran.v1';

export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') s = {};
  if (!s.levels || typeof s.levels !== 'object') s.levels = {};
  return s;
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

// res comes from sim.result: { fill, pass, onTime, goldOk, delay, ... }
export function stampsFor(res) {
  if (!res.pass) return [false, false, false];
  return [true, !!res.onTime, !!res.goldOk];
}

// merge a finished departure into the save; returns { stamps, n, newBest, prevBest, first }
export function recordResult(save, level, res) {
  const st = stampsFor(res);
  const prev = save.levels[level.id] || {};
  const rec = { ...prev };
  const prevBest = prev.best ?? null;
  let newBest = false;
  if (res.pass) {
    rec.won = true;
    rec.set = [0, 1, 2].map((i) => !!(prev.set?.[i] || st[i]));
    rec.stars = rec.set.filter(Boolean).length;
  }
  if (prevBest == null || res.fill > prevBest) { rec.best = res.fill; newBest = prevBest != null; }
  if (!res.onTime) rec.certs = (prev.certs || 0) + 1;
  rec.plays = (prev.plays || 0) + 1;
  save.levels[level.id] = rec;
  writeSave(save);
  return { stamps: st, n: st.filter(Boolean).length, newBest, prevBest, first: res.pass && !prev.won };
}

export function isUnlocked(save, levels, i) {
  if (i === 0 || save.unlockAll) return true;
  return !!save.levels[levels[i - 1].id]?.won;
}

export function totalStars(save) {
  return Object.values(save.levels).reduce((a, r) => a + (r.stars || 0), 0);
}
