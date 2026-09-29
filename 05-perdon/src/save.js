// Progress in localStorage (tolerates private mode and corrupted data). Per trip: the three stars ever
// punched, the fewest «perdones» on a train caught, the best margin, how often it was played. Plus the
// rumbas collected (one with each kind of dancer), the tutorial notes already shown, sound and language.
const KEY = 'perdon.v1';
export const RUMBA_KINDS = ['polite', 'tourist', 'espejo'];

export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') s = {};
  if (!s.lv || typeof s.lv !== 'object') s.lv = {};
  if (!Array.isArray(s.rumbas)) s.rumbas = [];
  if (!Array.isArray(s.hints)) s.hints = [];
  return s;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

// merge a finished trip into the save. Returns what changed, for the result card
export function recordResult(save, lv, sim) {
  const id = lv.id, prev = save.lv[id] || {}, rec = { ...prev }, st = sim.stars(), P = sim.P, e = sim.end;
  const won = st[0], was = prev.set?.slice() || [false, false, false];
  rec.plays = (prev.plays || 0) + 1;
  rec.set = [0, 1, 2].map((i) => !!(was[i] || st[i]));
  rec.stars = rec.set.filter(Boolean).length;
  let best = false;
  if (won) {
    rec.won = true;
    if (prev.best == null || P.perdones < prev.best) { best = prev.best != null; rec.best = P.perdones; }
    rec.margin = Math.max(prev.margin ?? -Infinity, Math.round(e.margin * 10) / 10);
  }
  save.lv[id] = rec;
  const fresh = [];
  for (const k of P.rumbas) if (RUMBA_KINDS.includes(k) && !save.rumbas.includes(k)) { save.rumbas.push(k); fresh.push(k); }
  writeSave(save);
  return { set: st, was, won, first: won && !prev.won, best, prevBest: prev.best ?? null, rumbas: fresh };
}

export function isUnlocked(save, levels, i) {
  if (i <= 0 || save.unlockAll) return true;
  return !!save.lv[levels[i - 1].id]?.won;
}
export const totalStars = (save) => Object.values(save.lv).reduce((a, r) => a + (r.stars || 0), 0);
