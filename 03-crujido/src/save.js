// Progress in localStorage (tolerates private mode and corrupted data).
// Per film: the three stars ever earned (ate it all, no shush, nobody heard) and the best cover.
const KEY = 'crujido.v1';

export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') s = {};
  if (!s.films || typeof s.films !== 'object') s.films = {};
  return s;
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}

// merge a finished film into the save; res is Sim.result. Returns { stars, n, first, best }
export function recordResult(save, id, res) {
  const prev = save.films[id] || {}, rec = { ...prev };
  if (res.pass) {
    rec.won = true;
    rec.set = [0, 1, 2].map((i) => !!(prev.set?.[i] || res.stars[i]));
    rec.stars = rec.set.filter(Boolean).length;
  }
  const cover = Math.round(res.hidden * 100), best = res.pass && (prev.cover == null || cover > prev.cover);
  if (best) rec.cover = cover;
  rec.plays = (prev.plays || 0) + 1;
  if (res.expelled) rec.out = (prev.out || 0) + 1;
  save.films[id] = rec;
  writeSave(save);
  return { stars: res.stars, n: res.stars.filter(Boolean).length, first: res.pass && !prev.won, best };
}

export function isUnlocked(save, ids, i) {
  if (i === 0 || save.unlockAll) return true;
  return !!save.films[ids[i - 1]]?.won;
}

export const totalStars = (save) => Object.values(save.films).reduce((a, r) => a + (r.stars || 0), 0);
