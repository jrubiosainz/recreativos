// Bots that play CRUJIDO, for balancing and for the title-screen demo.
// The "prophet" tiers know the film (like a player on their third viewing) and differ in how
// precisely they tap, how much risk they accept and how impatient they get.
import { mulberry32 } from './util.js';
import { JAW, SWALLOW } from './sim.js';

const TIERS = {
  skilled: { sd: 0.012, edge: 3, margin: 1, lag: 0.03, urgency: 1 },
  average: { sd: 0.04, edge: 1.5, margin: 0, lag: 0.05, urgency: 1, slip: 0.04 },
  novice: { sd: 0.085, edge: 1, margin: -4, lag: 0.08, urgency: 0.6, slip: 0.1, bored: 3.5, freeze: 1 },
  first: { sd: 0.035, edge: 1.5, margin: 1, lag: 0.05, urgency: 0.8, slip: 0.06, react: 0.22, freeze: 2.2 },
};

// telegraphs a first-timer can time a bite to (lightning and swells only warn, they do not count)
const COUNTDOWN = new Set(['fuse', 'timer', 'button', 'lever', 'swell']);

function gauss(rng) { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function remaining(sim) {
  let n = 0;
  for (let k = sim.piece; k < sim.combo.length; k++) n += sim.combo[k].pattern.length;
  if (sim.state === 'chew') n -= sim.i;
  return n;
}

export function makeBot(kind = 'skilled', seed = 1) {
  const rng = mulberry32(seed * 7919 + 13);
  let pending = -1, lastTap = -9, next = 0;
  if (kind === 'spam' || kind === 'metronome') {
    const every = kind === 'spam' ? 0.11 : 0.5;
    return { kind, update(sim, t) { if (t >= next) { sim.tap(t); next = t + every; } } };
  }
  const P = TIERS[kind] || TIERS.skilled;
  return {
    kind,
    update(sim, t) {
      if (sim.over || pending > sim.t) return;
      // someone just turned round to look: keep still for a moment
      if (P.freeze) {
        const e = sim.events.findLast((x) => x.type === 'shush' || (x.type === 'turn' && x.mood >= 2 && P.freeze > 1.5));
        if (e && t - e.t < P.freeze) return;
      }
      const L = sim.next(t + P.lag);
      if (L == null) return;
      const at = Math.max(t + P.lag, sim.lastChew + JAW + 0.004);
      // running out of film: accept more risk
      const left = sim.film.dur - t - 1, need = remaining(sim) * 0.75 + 1.2 * (sim.combo.length - sim.piece);
      const hurry = left < need ? Math.min(14, (need - left) * 0.9) * P.urgency : 0;
      // a careful player leaves room for their own timing error
      const w = P.edge * P.sd;
      // aim a timing error inside the window rather than at its very edge
      const low = (u) => { let m = Infinity; for (let k = 0; k <= 8; k++) m = Math.min(m, sim.needle(u + (k * w) / 4)); return m; };
      let cover = low(at), aim = at + w;
      // the last chew sends your hand back into a noisy bag: that has to be covered too
      const bag = sim.bagAfter();
      if (bag && !P.react) cover = Math.min(cover, L - bag + low(at + SWALLOW + 0.12));
      if (P.react) {
        // what the gauge showed a moment ago, unless the screen is counting down to something loud
        cover = sim.gauge(t - P.react);
        const g = sim.film.tele.find((x) => COUNTDOWN.has(x.k) && at >= x.t1 - 0.35 && at <= x.t1 + 0.05);
        if (g) { aim = g.t1 + 0.02; cover = sim.needle(aim); }
        // in a musical number they only tap on the beat, and only after a beat they heard hid a crunch
        const sec = !g && sim.film.grid?.find((s) => at >= s.t0 && at < s.t1);
        if (sec) {
          const beat = sec.t0 + Math.ceil((at - sec.t0) / sec.B - 0.1) * sec.B;
          const kh = Math.floor((t - P.react - sec.t0) / sec.B);
          aim = Math.max(at, beat + 0.01);
          cover = kh >= 0 ? sim.needle(sec.t0 + kh * sec.B + 0.01) : -Infinity;
        }
      }
      let ok = L <= cover - P.margin + hurry;
      if (!ok && P.bored && t - lastTap > P.bored && rng() < 0.02) ok = true;
      if (ok && P.slip && rng() < P.slip * 0.05) return;
      if (!ok) return;
      const when = Math.max(sim.t, sim.lastChew + JAW + 0.004, aim + gauss(rng) * P.sd);
      sim.tap(when); pending = when; lastTap = when;
    },
  };
}

// run a whole film with a bot; returns the sim
export function play(sim, bot, hz = 120) {
  const dt = 1 / hz;
  let guard = 0;
  while (!sim.done && guard++ < 1e6) { bot.update(sim, sim.t); sim.step(dt); }
  return sim;
}
