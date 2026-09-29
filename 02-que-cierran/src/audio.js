// ¡QUE CIERRAN! sound: the one import the game uses. The engine and every synthesised
// voice live in src/audio/; this file owns the long-lived players (departure melody,
// menu loop, ticket preview, train, station ambience) and an offline renderer for the audio tests.
import { E } from './audio/core.js';
import { Sfx } from './audio/sfx.js';
import { Melody, Menu, Preview, SONGS, APPROACH, approach, jingle } from './audio/melody.js';
import { Train, Ambience } from './audio/world.js';

const melody = new Melody(), menu = new Menu(), train = new Train(), amb = new Ambience(), preview = new Preview(menu);

function forget() {                     // drop every voice without touching its (possibly foreign) context
  melody.c = null; menu.on = false; menu.lvl = 1; clearInterval(preview.c?.timer); preview.c = null; train.n = null; train.x = null; train.v = 0; amb.on = null;
}

// Render a script into a buffer: the script advances E.clock by hand and calls the
// same players the game uses, so tests hear exactly what a player would. Test-only:
// the players are left idle afterwards.
async function render(seconds, script, { sr = 44100 } = {}) {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!OAC) throw new Error('OfflineAudioContext unavailable');
  const keep = { ctx: E.ctx, g: E.g, nz: E.nz, offline: E.offline, duckEnd: E.duckEnd, muted: E.muted, clock: E.clock };
  const c = new OAC(2, Math.ceil(seconds * sr), sr);
  try {
    E.muted = false; E.attach(c, true); E.clock = 0; forget();
    await script({ E, at: (t) => { E.clock = t; }, melody, menu, train, amb, preview, sfx: Sfx });
    E.clock = null;
    return await c.startRendering();
  } finally { forget(); Object.assign(E, keep); }
}

export const Audio = {
  unlock: () => E.unlock(),
  get unlocked() { return E.unlocked; },
  get live() { return E.live; },
  get now() { return E.now; },
  get muted() { return E.muted; },
  get latency() { const c = E.ctx; return c ? (c.outputLatency || 0) + (c.baseLatency || 0) : 0; },
  setMuted: (m) => E.setMuted(m),
  suspend: () => E.suspend(),
  resume: () => E.resume(),
  loadManifest: (m, lang, onProgress) => E.loadManifest(m, lang, onProgress),
  switchLang: (lang) => E.switchLang(lang),
  meta: (id) => E.meta(id),
  has: (id) => E.has(id),
  play: (id, o) => E.play(id, o),
  say: (id, o) => E.say(id, o),
  jingle: (kind) => jingle(kind),
  approach: (id) => approach(id),
  sfx: Sfx, melody, menu, train, amb, preview, SONGS, APPROACH,
  // leaving a level: everything that belongs to the platform fades together
  quiet(f = 0.35) { melody.stop(f); amb.stop(f); train.reset(); },
  render
};
