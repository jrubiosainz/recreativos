// CRUJIDO sound: the one import the game uses. The engine and every voice live in src/audio/;
// this file owns the reel player (the film's soundtrack, baked or rendered, locked to the clock
// the sim runs on) and the offline renderer the audio tests use.
import { E, gain, pan, chain, hold, db } from './audio/core.js';
import { renderReel, parts, envelopes, REEL_VERSION, SLOPE } from './audio/reel.js';
import { unpackEnvs, atten, dist } from './film.js';
import { Me } from './audio/me.js';
import { Lobby, House, Ui } from './audio/lobby.js';

function decode(ab) {
  return new Promise((res, rej) => { const p = E.ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
}
// Where the film starts in a decoded bake: the click at `mark` s inside the `lead` s of silence.
// Browsers disagree about MP3 encoder delay by up to a frame, so find it rather than trust it.
export function findMark(buf, lead, mark) {
  const d = buf.getChannelData(0), n = Math.min(d.length, Math.floor((lead - 0.02) * buf.sampleRate));
  let p = -1, a = 0;
  for (let i = 0; i < n; i++) { const v = Math.abs(d[i]); if (v > a) { a = v; p = i; } }
  return a > 0.2 ? lead + p / buf.sampleRate - mark : lead;
}
// a copy of buf from `off` s on, for envelopes that must start at the film's first second
function from(buf, off) {
  const i0 = Math.round(off * buf.sampleRate), n = Math.max(1, buf.length - i0), b = E.ctx.createBuffer(buf.numberOfChannels, n, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) b.getChannelData(c).set(buf.getChannelData(c).subarray(i0, i0 + n));
  return b;
}

// The reel as the game plays it. load() takes every baked part whose key still matches the film
// (same cues, same timings in this language, same trims) and renders whatever does not.
export class Reel {
  constructor() { this.parts = {}; this.env = null; this.src = []; this.loc = {}; this.id = null; this.baked = 0; this.rendered = 0; }
  async load(level, film, lang, { base = 'assets/reel', onProgress } = {}) {
    const id = level.meta.id, P = parts(film, id), want = Object.entries(P).filter(([k, p]) => k === 'screen' || p.cues.length);
    let J = null;
    try { const r = await fetch(`${base}/${lang}/${id}.json`); if (r.ok) J = await r.json(); } catch { /* render it */ }
    const out = {}, stale = [];
    let done = 0; const tick = () => onProgress?.(++done / (want.length + 1));
    await Promise.all(want.map(async ([name, p]) => {
      const b = J?.v === REEL_VERSION && J.parts?.[name]?.key === p.key ? J.parts[name] : null;
      if (b) {
        try {
          const r = await fetch(b.file.replace(/^assets\/reel/, base)); if (!r.ok) throw new Error(r.status);
          const buf = await decode(await r.arrayBuffer());
          out[name] = { buf, off: findMark(buf, J.lead ?? 0, J.mark ?? 0), baked: true };
          tick(); return;
        } catch (e) { console.info('[CRUJIDO audio] rendering', name, 'of', id, e?.message || e); }
      }
      stale.push(name);
    }));
    if (stale.length) {
      const r = await renderReel(level, film, { only: stale });
      for (const name of stale) { const buf = name === 'screen' ? r.screen : name === 'crowd' ? r.crowd : r.local[name.slice(6)]; if (buf) out[name] = { buf, off: 0, baked: false }; tick(); }
    }
    this.id = id; this.parts = out; this.dur = film.dur;
    this.baked = Object.values(out).filter((p) => p.baked).length; this.rendered = Object.values(out).length - this.baked;
    if (!this.rendered && J?.env) this.env = unpackEnvs(J.env);
    else {
      const view = (n) => (out[n] ? (out[n].off ? from(out[n].buf, out[n].off) : out[n].buf) : null), local = {};
      for (const n of Object.keys(out)) if (n.startsWith('local:')) local[n.slice(6)] = view(n);
      this.env = await envelopes({ screen: view('screen'), crowd: view('crowd'), local, dur: film.dur + 2.5 });
    }
    onProgress?.(1);
    return this;
  }
  // Start so that film time `at` plays at context time `when`. People with their own noise are
  // placed at their seats: panned, and quieter with distance exactly as the sim attenuates them.
  start(film, when, at = 0) {
    this.stop(0);
    const c = E.ctx; if (!c) return;
    for (const [name, p] of Object.entries(this.parts)) {
      const s = c.createBufferSource(), sg = gain(c, 1); s.buffer = p.buf; s.connect(sg);
      if (name.startsWith('local:')) {
        const who = film.seats.get(name.slice(6)), g = gain(c, 1), d = who ? db(-atten(dist(who.x, who.z, 0, 0)) * SLOPE) : 0.5;
        chain(sg, g, gain(c, d * Math.SQRT1_2), pan(c, who ? Math.max(-0.9, Math.min(0.9, who.x / 1.3)) : 0), E.g.bus.local);
        this.loc[name.slice(6)] = { g, on: true };
      } else sg.connect(E.g.bus.reel);
      s.start(when, Math.max(0, p.off + at));
      this.src.push({ s, g: sg });
    }
  }
  // follow the sim: a snorer who woke, a fan sulking, fall silent (and come back when he forgives you)
  update(sim) {
    for (const [src, l] of Object.entries(this.loc)) {
      const who = sim.ppl.find((p) => p.id === src), on = !(who?.hush?.(sim.t));
      if (on !== l.on) { l.on = on; const t = E.now; hold(l.g.gain, t); l.g.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.25 : 0.06); }
    }
  }
  stop(f = 0.5) {
    const t = E.now;
    for (const { s, g } of this.src) {
      try { if (f) { hold(g.gain, t); g.gain.linearRampToValueAtTime(0, t + f); s.stop(t + f + 0.02); } else s.stop(); } catch { /* ended */ }
    }
    this.src = []; this.loc = {};
  }
}

// Render a script offline: it advances E.clock by hand and calls the same voices the game uses.
async function render(seconds, script, { sr = 44100 } = {}) {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const keep = { ctx: E.ctx, g: E.g, nz: E.nz, offline: E.offline, duckEnd: E.duckEnd, muted: E.muted, clock: E.clock };
  const c = new OAC(2, Math.ceil(seconds * sr), sr);
  try {
    E.muted = false; E.attach(c, true); E.clock = 0; Lobby.src = null; House.n = null;
    await script({ E, at: (t) => { E.clock = t; }, me: Me, ui: Ui, house: House });
    E.clock = null;
    return await c.startRendering();
  } finally { Lobby.src = null; House.n = null; Object.assign(E, keep); }
}

// what the listener hears right now, in context time: the output timestamp when the browser
// gives one (it already includes the output latency), else the clock minus the reported latency
function heard() {
  const c = E.ctx; if (!c) return 0;
  if (c.getOutputTimestamp && c.state === 'running') {
    const o = c.getOutputTimestamp();
    if (o.contextTime > 0 && o.performanceTime > 0) return o.contextTime + Math.min(0.1, Math.max(0, (performance.now() - o.performanceTime) / 1000));
  }
  return c.currentTime - ((c.outputLatency || 0) + (c.baseLatency || 0));
}

export const Audio = {
  init: () => E.init(),
  heard,
  unlock: () => E.unlock(),
  get unlocked() { return E.unlocked; },
  get live() { return E.live; },
  get now() { return E.now; },
  get running() { return !!E.ctx && E.ctx.state === 'running'; },
  get latency() { const c = E.ctx; return c ? (c.outputLatency || 0) + (c.baseLatency || 0) : 0; },
  get muted() { return E.muted; },
  setMuted: (m) => E.setMuted(m),
  suspend: () => E.suspend(),
  resume: () => E.resume(),
  loadManifest: (m, lang, onProgress) => E.loadManifest(m, lang, onProgress),
  switchLang: (lang) => E.switchLang(lang),
  meta: (id) => E.meta(id),
  has: (id) => E.has(id),
  play: (id, o) => E.play(id, o),
  say: (id, o) => E.say(id, o),
  me: Me, ui: Ui, lobby: Lobby, house: House, Reel,
  render,
};
