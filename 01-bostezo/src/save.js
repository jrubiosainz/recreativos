// Progress in localStorage (tolerates private mode and corrupted data).
const KEY = 'bostezo.v1';

export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') s = {};
  s.levels ||= {};
  return s;
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export function starsFor(res, level) {
  if (res.kind !== 'win') return [false, false, false];
  return [true, res.strikes === 0, res.maxChain >= level.chainGoal];
}

// merge a finished meeting into the save; returns { stars, newBest }
export function recordResult(save, level, res) {
  const st = starsFor(res, level);
  const n = st.filter(Boolean).length;
  const prev = save.levels[level.id] || {};
  const rec = { ...prev };
  let newBest = false;
  if (res.kind === 'win') {
    rec.won = true;
    rec.stars = Math.max(prev.stars || 0, n);
    rec.starSet = [0, 1, 2].map((i) => !!(prev.starSet?.[i] || st[i]));
    rec.stars = Math.max(rec.stars, rec.starSet.filter(Boolean).length);
    if (prev.best == null || res.time < prev.best) { rec.best = res.time; newBest = prev.best != null; }
    rec.chain = Math.max(prev.chain || 0, res.maxChain);
  }
  rec.plays = (prev.plays || 0) + 1;
  save.levels[level.id] = rec;
  writeSave(save);
  return { stars: st, n, newBest };
}

export function isUnlocked(save, levels, i) {
  if (i === 0) return true;
  if (save.unlockAll) return true;
  return !!save.levels[levels[i - 1].id]?.won;
}

export function totalStars(save) {
  return Object.values(save.levels).reduce((a, r) => a + (r.stars || 0), 0);
}
