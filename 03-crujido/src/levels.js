// The six films, in programme order. Each film module exports its metadata, the seats around
// you and a script built from the voice manifest's line durations.
import * as f1 from './films/f1.js';
import * as f2 from './films/f2.js';
import * as f3 from './films/f3.js';
import * as f4 from './films/f4.js';
import * as f5 from './films/f5.js';
import * as f6 from './films/f6.js';

export const FILMS = [f1, f2, f3, f4, f5, f6];

// rough duration of a line before its voice exists: ~14 characters a second plus breath
export const estimate = (text) => Math.max(0.8, text.length / 14 + 0.25);

// D(id) -> seconds; falls back to an estimate from the text, then to one second
export function durations(man, lines, lang = 'es') {
  return (id) => man?.voices?.[lang]?.[id]?.dur || (lines?.[id]?.[lang] ? estimate(lines[id][lang]) : 1);
}

export function buildLevel(i, D) {
  const f = FILMS[i], m = f.meta;
  const combo = Array.isArray(m.combo) ? m.combo.slice() : Array(m.combo).fill(m.snack);
  return { i, id: m.id, meta: m, cast: f.cast.map((p) => ({ ...p })), combo, script: f.script(D) };
}

export const LEVEL_COUNT = FILMS.length;
