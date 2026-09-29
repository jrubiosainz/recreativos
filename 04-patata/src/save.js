// Progress in localStorage (tolerates private mode and corrupted data). Per event: the three stars
// ever earned and how often it was played. The album's photos live under their own key: each is the
// exact snapshot that was judged, so the album can print it again at any size.
const KEY = 'patata.v1', PKEY = 'patata.v1.prints';

const read = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export function loadSave() {
  const s = read(KEY) || {};
  if (!s.evs || typeof s.evs !== 'object') s.evs = {};
  return s;
}
export const writeSave = (s) => write(KEY, s);

export const loadPrints = () => read(PKEY) || {};
const round = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
// keep only what the renderer reads, rounded, so six photos fit comfortably in storage
export function packView(v) {
  return {
    t: round(v.t), state: v.state, E: round(v.E), mood: v.mood,
    people: v.people.map((p) => Object.fromEntries(Object.entries(p).map(([k, x]) => [k, x && typeof x === 'object' ? { ...x, k: round(x.k) } : round(x)]))),
  };
}

// merge a finished roll into the save. Returns { set, n, first, better }
export function recordResult(save, ev, sim, mode) {
  const id = ev.id, prev = save.evs[id] || {}, rec = { ...prev }, st = sim.stars();
  rec.plays = (prev.plays || 0) + 1;
  rec.set = [0, 1, 2].map((i) => !!(prev.set?.[i] || st[i]));
  rec.stars = rec.set.filter(Boolean).length;
  const won = st[0];
  if (won) rec.won = true;
  save.evs[id] = rec;
  writeSave(save);
  let better = false;
  const ok = sim.prints.filter((p) => p.ok).sort((a, b) => b.E - a.E)[0];
  if (ok) {
    const P = loadPrints(), old = P[id], score = st.filter(Boolean).length;
    if (!old || score >= (old.score || 0)) {
      const vt = ok.view.t, fl = sim.flock(vt);
      P[id] = {
        mode, score, E: round(ok.E), flash: ok.flash, view: packView(ok.view), seed: sim.seed,
        bands: sim.shade(vt).map((b) => b.map(round)), flock: fl && Object.fromEntries(Object.entries(fl).map(([k, v]) => [k, round(v)])),
      };
      write(PKEY, P); better = true;
    }
  }
  return { set: st, n: st.filter(Boolean).length, first: won && !prev.won, better };
}

export function isUnlocked(save, ids, i) {
  if (i === 0 || save.unlockAll) return true;
  return !!save.evs[ids[i - 1]]?.won;
}
export const totalStars = (save) => Object.values(save.evs).reduce((a, r) => a + (r.stars || 0), 0);
