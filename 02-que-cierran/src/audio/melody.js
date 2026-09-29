// 発車メロディ: eight original departure melodies, one per station, each a 4-bar
// phrase whose tempo is stretched so the cadence lands exactly as the doors must
// close. They play through the platform PA chain. Plus the approach chimes that
// announce each train, the ticket's melody preview, the menu loop and jingles.
// Notation: "D5:1 F#5:1 r:2" = note:eighths; chords "Gmaj7:8", "G/F:4", "E3+B3:8".
import { E, gain, glide } from './core.js';
import { note, chord, hit } from './kit.js';

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const acc = a => (a === '#' ? 1 : a === 'b' ? -1 : 0);
export function nm(s) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); if (!m) throw new Error('bad note ' + s);
  return 12 * (+m[3] + 1) + PC[m[1]] + acc(m[2]);
}
const Q = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14] };
function chordNotes(sym) {
  if (sym.includes('+')) { const ns = sym.split('+').map(nm); return { root: ns[0], tones: ns }; }
  const [main, slash] = sym.split('/'), m = /^([A-G])([#b]?)(.*)$/.exec(main), iv = m && Q[m[3]];
  if (!iv) throw new Error('bad chord ' + sym);
  const pc = PC[m[1]] + acc(m[2]), wrap = x => ((x % 12) + 12) % 12;
  let root = 48 + wrap(pc);
  if (slash) { const s = /^([A-G])([#b]?)$/.exec(slash); root = 48 + wrap(PC[s[1]] + acc(s[2])); }
  if (root > 53) root -= 12;
  const tones = [...new Set(iv.map(i => 60 + wrap(pc + i)))].sort((a, b) => a - b);
  return { root, tones };
}
function seq(str) {
  let b = 0; const ev = [];
  for (const tok of str.trim().split(/\s+/)) {
    const [n, d] = tok.split(':'), len = parseFloat(d) / 2;
    if (n !== 'r') ev.push({ b, ms: n.split('+').map(nm), len });
    b += len;
  }
  return { ev, beats: b };
}
function chords(str) {
  let b = 0; const out = [];
  for (const tok of str.trim().split(/\s+/)) { const [n, d] = tok.split(':'), len = parseFloat(d) / 2; out.push({ b, len, ...chordNotes(n) }); b += len; }
  return { list: out, beats: b };
}

export const SONGS = {
  s1: { title: '夜明け', mel: 'D5:1 F#5:1 A5:2 B5:1 A5:1 F#5:2  E5:1 F#5:1 A5:2 D6:3 r:1  B5:1 A5:1 F#5:1 A5:1 B5:1 D6:1 E6:2  A5:1 F#5:1 E5:1 F#5:1 D5:4',
    ch: 'D:8 Gmaj7:8 Bm7:8 A:4 D:4', lead: ['celesta', 0.85], comp: { inst: 'pad', v: 0.55, pat: 'hold' }, arp: { inst: 'glock', v: 0.12 }, bass: { v: 0.42, pat: 'hold' } },
  s2: { title: '霧の橋', mel: 'A5:3 B5:1 C6:4  E6:3 D6:1 C6:2 B5:2  A5:3 G5:1 A5:2 C6:2  B5:2 E5:2 F5:4',
    ch: 'Fmaj7:8 G/F:8 Dm9:8 G/F:4 Fmaj7:4', lead: ['vibes', 0.8], dbl: ['flute', 0.5, -12], comp: { inst: 'pad', v: 0.6, pat: 'hold' }, bass: { v: 0.38, pat: 'hold' } },
  s3: { title: '雨だれ', mel: 'E6:.5 C6:.5 A5:1 E6:.5 C6:.5 A5:1 B5:1 C6:1 D6:2  E6:.5 D6:.5 C6:1 D6:.5 C6:.5 B5:1 G5:1 B5:1 E5:2  F5:1 A5:1 C6:1 F6:1 E6:.5 D6:.5 C6:1 B5:1 A5:1  G#5:1 B5:1 E6:1 D6:1 C6:1 B5:1 A5:2',
    ch: 'Am:8 G:4 Em:4 F:4 Dm:4 E7:4 Am:4', lead: ['mallet', 0.9], comp: { inst: 'epiano', v: 0.36, pat: 'x...x...' }, bass: { v: 0.5, pat: 'x...x...' }, perc: [{ pat: 'xxxxxxxx', map: { x: ['shaker', 0.5] } }] },
  s4: { title: '花筏', mel: 'E5:1 F5:1 A5:2 B5:1 A5:1 F5:2  E5:1 F5:1 A5:1 B5:1 C6:3 B5:1  E6:2 C6:1 B5:1 A5:1 B5:1 C6:2  B5:1 A5:1 F5:1 A5:1 E5:4',
    ch: 'E3+B3:8 E3+B3:8 A3+E4:8 F3+C4:4 E3+B3:4', lead: ['koto', 1], comp: { inst: 'koto', v: 0.55, pat: 'x...x.x.' }, arp: { inst: 'glock', v: 0.05, step: 2, oct: 24 } },
  s5: { title: '寄せ太鼓', mel: 'D5:1 D5:1 E5:1 G5:1 A5:2 G5:2  A5:1 B5:1 D6:2 B5:1 A5:1 G5:2  E5:1 G5:1 A5:1 B5:1 D6:1 E6:1 D6:2  D6:1 B5:1 A5:1 G5:.5 E5:.5 D5:4',
    ch: 'D3+A3:8 G3+D4:8 E3+B3:8 A3+E4:4 D3+A3:4', lead: ['shami', 1], dbl: ['koto', 0.45, -12], bass: { v: 0.5, pat: 'x...x...' },
    perc: [{ pat: 'D.k.DDk.', last: 'DkDkD...', map: { D: ['don', 1], k: ['ka', 0.8] } }], fin: [['timp', 1]] },
  s6: { title: '秒読み', mel: 'G5:.5 F#5:.5 G5:.5 Ab5:.5 G5:1 Eb5:1 C5:1 D5:1 Eb5:1 F5:1  G5:.5 F#5:.5 G5:.5 Ab5:.5 Bb5:1 Ab5:1 G5:1 F5:1 Eb5:1 D5:1  C6:.5 B5:.5 C6:.5 D6:.5 Eb6:1 D6:1 C6:1 B5:1 Ab5:1 G5:1  F#5:.5 G5:.5 Ab5:.5 A5:.5 B5:1 G5:1 C6:4',
    ch: 'Cm:8 Ab:8 Fm:4 G:4 G7:4 Cm:4', lead: ['square', 0.85], comp: { inst: 'pad', v: 0.5, pat: 'hold' }, bass: { v: 0.55, pat: 'xxxxxxxx' },
    perc: [{ pat: 'xxxxxxxx', map: { x: ['tick', 0.7] } }, { pat: 'x.x.x.x.', map: { x: ['kick', 0.45] } }] },
  s7: { title: '乗換ステップ', mel: 'B5:1 D6:1 r:.5 B5:1 A5:.5 G5:1 A5:1 B5:2  D6:1 E6:.5 D6:1 B5:.5 A5:1 G5:1 E5:1 G5:2  C6:1 E6:1 r:.5 C6:1 B5:.5 A5:1 B5:1 C6:1 D6:1  E6:.5 D6:.5 B5:1 A5:1 D6:1 G5:4',
    ch: 'Gmaj7:8 Em7:8 Cmaj7:4 Am7:4 D7sus4:2 D7:2 Gmaj7:4', lead: ['epiano', 0.9], dbl: ['glock', 0.22, 0], comp: { inst: 'epiano', v: 0.42, pat: '..x..x.x' }, bass: { v: 0.6, pat: 'x..x..o.' },
    perc: [{ pat: 'x..x....', map: { x: ['kick', 0.55] } }, { pat: '..x...x.', map: { x: ['rim', 0.6] } }, { pat: 'xxxxxxxx', map: { x: ['shaker', 0.4] } }] },
  s8: { title: '終点ファンファーレ', mel: 'G5:1.5 G5:.5 C6:2 E6:2 D6:1 C6:1  A5:1.5 A5:.5 D6:2 F6:2 E6:1 D6:1  E6:1 F6:1 G6:2 A6:1 G6:1 F6:1 E6:1  D6:1.5 C6:.5 B5:1 D6:1 C6:4',
    ch: 'C:8 Dm:4 F:4 C:4 F:4 G7:4 C:4', lead: ['brass', 0.95], dbl: ['bell', 0.3, 12], comp: { inst: 'brass', v: 0.5, pat: 'hold' }, bass: { v: 0.6, pat: 'x...x...' },
    perc: [{ pat: 'x...x...', map: { x: ['timp', 0.65] } }], fin: [['swell', 1], ['crash', 1], ['timp', 1.1]] }
};
export const MENU = { mel: 'A5:2 C6:2 F6:4 r:8  G5:2 A5:2 D6:4 r:8  F5:2 A5:2 D6:2 C6:2 r:8  Bb5:2 A5:2 G5:4 r:8',
  ch: 'Fmaj7:8 Em7:4 A7:4 Dm7:8 Cm7:4 F7:4 Bbmaj7:8 Am7:4 D7:4 Gm7:8 C7sus4:4 C7:4',
  lead: ['glock', 0.32], comp: { inst: 'epiano', v: 0.32, pat: 'x..x..x.' }, bass: { v: 0.4, pat: 'x..x.x..' },
  perc: [{ pat: '......xx', map: { x: ['wood', 0.22] } }, { pat: 'x...x...', map: { x: ['kick', 0.28] } }, { pat: '..x...x.', map: { x: ['snare', 0.26] } }] };

// 接近メロディ: the short chime before 「まもなく、電車がまいります」. Two are real public-domain
// tunes: 鉄道唱歌 (Ōno Umewaka, 1900), the approach melody of the Hokuriku Shinkansen, and
// the traditional さくらさくら. The rest are original and start from the opening of their
// station's departure melody, so the timer already sounds familiar when it comes.
// parts: [notes, instrument, volume, pan, octave shift]; hits: [beat, kind, volume, pan];
// perc: [one char per eighth, kind, volume].
export const APPROACH = {
  s1: { title: '鉄道唱歌', spb: 0.38, parts: [
    ['G5:1.5 G5:.5 G5:1.5 A5:.5  B5:1.5 B5:.5 B5:1.5 A5:.5  G5:1.5 G5:.5 G5:1.5 E5:.5  D5:4', 'celesta', 0.78, 0.05],
    ['G3:2 B3+D4:2 G3:2 B3+D4:2  C4:2 E4+G4:2 G3:2 B3+D4:2', 'celesta', 0.36, -0.1]] },
  s2: { spb: 0.36, parts: [
    ['A5:3 B5:1 C6:4  E6:3 D6:1 C6:4', 'vibes', 0.8, 0.05],
    ['A5:3 B5:1 C6:4  E6:3 D6:1 C6:4', 'flute', 0.4, -0.12, -12],
    ['F3+A4+C5+E5:8 F3+G4+B4+D5:4 F3+A4+C5+E5:4', 'pad', 0.5]] },
  s3: { spb: 0.33, parts: [
    ['E6:.5 C6:.5 A5:1 E6:.5 C6:.5 A5:1 B5:1 C6:1 D6:2  E6:.5 D6:.5 C6:1 B5:1 G#5:1 A5:4', 'mallet', 0.9, 0.05],
    ['A3+E4+C5:4 G3+D4+B4:4 A3+E4+C5:2 E3+D4+G#4:2 A3+E4+C5:4', 'epiano', 0.4]],
    perc: [['xxxxxxxxxxxxxxxx', 'shaker', 0.45]] },
  s4: { title: 'さくらさくら', spb: 0.4, parts: [
    ['A5:2 A5:2 B5:4  A5:2 A5:2 B5:4', 'koto', 1, 0.08],
    ['A4:2 A4:2 B4:4  A4:2 A4:2 B4:4', 'koto', 0.32, -0.15],
    ['A3+E4:8 A3+E4:8', 'koto', 0.5]] },
  // the yobidashi's clappers speed up, then the shamisen calls the bout
  s5: { spb: 0.3, parts: [
    ['r:11 D5:.5 E5:.5 G5:.5 A5:.5 D6:3', 'shami', 1, 0.05],
    ['r:11 D5:.5 E5:.5 G5:.5 A5:.5 D6:3', 'koto', 0.45, -0.12, -12]],
    hits: [[0, 'ki', 1, 0.3], [1.4, 'ki', 0.92, 0.3], [2.5, 'ki', 0.88, 0.3], [3.3, 'ki', 0.84, 0.3], [3.85, 'ki', 0.8, 0.3],
      [4.25, 'ki', 0.78, 0.3], [4.55, 'ki', 0.76, 0.3], [4.8, 'ki', 0.74, 0.3], [6.5, 'ki', 0.9, 0.3], [6.5, 'don', 1]] },
  // the usual four-tone chime, except that its last note is running late
  s6: { spb: 0.36, parts: [['G5:1.5 B5:1.5 D6:1.5 r:5.5 G6:4', 'chime', 0.55]],
    hits: [[2.5, 'tick', 0.9], [3.5, 'tick', 0.9], [4.5, 'tick', 0.9]] },
  // two platforms of a big interchange answer each other
  s7: { spb: 0.3, parts: [
    ['B5:1 D6:1 r:.5 B5:1 A5:.5 G5:4', 'glock', 0.5, -0.6],
    ['r:8 D6:1 E6:.5 D6:1 B5:.5 A5:1 G5:4', 'vibes', 0.85, 0.6]] },
  s8: { spb: 0.3, parts: [
    ['G5:1.5 G5:.5 C6:2 E6:2 D6:1.5 E6:.5 C6:6', 'brass', 0.9, 0.05],
    ['G5:1.5 G5:.5 C6:2 E6:2 D6:1.5 E6:.5 C6:6', 'bell', 0.26, -0.1, 12],
    ['C4+E4+G4:6 B3+D4+G4:2 C4+E4+G4:6', 'brass', 0.5]],
    hits: [[0, 'timp', 0.7], [4, 'timp', 1], [4, 'crash', 0.45]] }
};

// Walk a rhythm string across one chord span; each hit lasts until the next one.
function rhythm(pat, ch, cb) {
  const n = Math.round(ch.len * 2), g0 = Math.round(ch.b * 2), hits = [];
  for (let k = 0; k < n; k++) { const x = pat[(g0 + k) % pat.length]; if (x !== '.') hits.push([k, x]); }
  hits.forEach(([k, x], i) => cb(ch.b + k / 2, ((i + 1 < hits.length ? hits[i + 1][0] : n) - k) / 2, x));
}

export function build(sp) {
  const M = seq(sp.mel), C = chords(sp.ch), ev = [], add = (b, fn) => ev.push({ b, fn });
  const [li, lv, lo = 0] = sp.lead;
  for (const n of M.ev) add(n.b, (t, spb, d) => n.ms.forEach(m => note(li, d, t, m + lo, n.len * spb * 0.94, lv * (n.b % 1 ? 0.84 : 1), 0.06)));
  if (sp.dbl) { const [di, dv, dx] = sp.dbl; for (const n of M.ev) add(n.b, (t, spb, d) => n.ms.forEach(m => note(di, d, t, m + dx, n.len * spb * 0.9, dv, -0.12))); }
  for (const ch of C.list) {
    const cp = sp.comp;
    if (cp && cp.pat === 'hold') add(ch.b, (t, spb, d) => chord(cp.inst, d, t, ch.tones, ch.len * spb, cp.v));
    else if (cp) rhythm(cp.pat, ch, (b, len) => add(b, (t, spb, d) => chord(cp.inst, d, t, ch.tones, len * spb * 0.9, cp.v)));
    if (sp.arp) {
      const { inst, v, step = 1, oct = 12 } = sp.arp, s = step / 2;
      for (let k = 0; k * s < ch.len - 1e-6; k++) { const m = ch.tones[k % ch.tones.length] + oct; add(ch.b + k * s, (t, spb, d) => note(inst, d, t, m, s * spb, v, k % 2 ? 0.35 : -0.35)); }
    }
    const bs = sp.bass;
    if (bs && bs.pat === 'hold') add(ch.b, (t, spb, d) => note('bass', d, t, ch.root, ch.len * spb, bs.v));
    else if (bs) rhythm(bs.pat, ch, (b, len, x) => add(b, (t, spb, d) => note('bass', d, t, ch.root + (x === 'o' ? 12 : 0), len * spb * 0.85, bs.v)));
  }
  const bars = Math.round(M.beats / 4);
  for (const p of sp.perc || []) for (let bar = 0; bar < bars; bar++) {
    const pat = bar === bars - 1 && p.last ? p.last : p.pat, step = 4 / pat.length;
    for (let i = 0; i < pat.length; i++) { const hm = p.map[pat[i]]; if (hm) add(bar * 4 + i * step, (t, spb, d) => hit(hm[0], d, t, hm[1] * (i % 2 ? 0.8 : 1))); }
  }
  const last = M.ev[M.ev.length - 1];
  for (const [k, v] of sp.fin || []) {
    if (k === 'swell') add(last.b - 2, (t, spb, d) => hit(k, d, t + 2 * spb, v));   // needs its run-up scheduled early
    else add(last.b, (t, spb, d) => hit(k, d, t, v));
  }
  ev.sort((a, b) => a.b - b.b);
  return { ev, beats: M.beats, chordBeats: C.beats };
}

// Driven by sim time every frame so it stays glued to the timeline through frame
// hitches, pauses (context suspended) and slow motion.
export class Melody {
  constructor() { this.c = null; }
  get playing() { return !!this.c; }
  start(id, dur) {
    this.stop(0.05);
    if (!E.ctx) return;
    const song = build(SONGS[id] || SONGS.s1), out = gain(E.ctx, 1);
    out.connect(E.g.bus.melody);
    this.c = { id, song, spb: dur / song.beats, idx: 0, out };
  }
  sync(pos, rate = 1, now = E.now) {
    const c = this.c; if (!c || !E.live) return;
    const horizon = pos + 0.12 * rate;
    while (c.idx < c.song.ev.length && c.song.ev[c.idx].b * c.spb <= horizon) {
      const ev = c.song.ev[c.idx++], et = ev.b * c.spb;
      if (et < pos - 0.08) continue;
      ev.fn(now + Math.max(0, (et - pos) / rate), c.spb / rate, c.out);
    }
  }
  stop(f = 0.3) {
    const c = this.c; if (!c) return; this.c = null;
    if (!E.ctx) return;
    glide(c.out.gain, 0, E.now, Math.max(0.01, f / 4));
    E.later(() => { try { c.out.disconnect(); } catch { /* gone */ } }, f * 1000 + 400);
  }
  finish() { const c = this.c; if (!c) return; this.c = null; E.later(() => { try { c.out.disconnect(); } catch { /* gone */ } }, 4000); }
}

export class Menu {
  constructor() { this.on = false; this.timer = 0; this.song = null; this.lvl = 1; }
  start() {
    if (this.on || !E.ctx) return;
    this.on = true; this.song = this.song || build(MENU); this.spb = 60 / 92;
    this.out = gain(E.ctx, 0); this.out.connect(E.g.bus.music); glide(this.out.gain, this.lvl, E.now, 0.25);
    this.t0 = E.now + 0.12; this.idx = 0; this.loop = 0;
    if (!E.offline) this.timer = setInterval(() => this.pump(), 60);
    this.pump();
  }
  pump() {
    if (!this.on || !E.live) return;
    const ev = this.song.ev, L = this.song.beats * this.spb, horizon = E.now + 0.35;
    for (let guard = 0; guard < 5000; guard++) {
      if (this.idx >= ev.length) { this.idx = 0; this.loop++; }
      const e = ev[this.idx], t = this.t0 + this.loop * L + e.b * this.spb;
      if (t > horizon) break;
      if (t > E.now - 0.05) e.fn(t, this.spb, this.out);
      this.idx++;
    }
  }
  // sits back while something else plays (the ticket's melody preview); remembered if the loop starts later
  duck(v) { this.lvl = v; if (this.on && this.out && E.ctx) glide(this.out.gain, v, E.now, 0.12); }
  stop(f = 0.6) {
    if (!this.on) return; this.on = false; clearInterval(this.timer);
    const o = this.out; if (!o || !E.ctx) return;
    glide(o.gain, 0, E.now, f / 4); E.later(() => { try { o.disconnect(); } catch { /* gone */ } }, f * 1000 + 600);
  }
}

// The approach chime, all scheduled at once on the platform speakers. Returns { dur, stop }, or null when silent.
export function approach(id) {
  const A = APPROACH[id];
  if (!A || !E.live) return null;
  const out = gain(E.ctx, 1), t0 = E.now + 0.05, spb = A.spb;
  out.connect(E.g.bus.melody);
  let beats = 0;
  for (const [mel, inst, v, pan = 0, oct = 0] of A.parts) {
    const M = seq(mel); beats = Math.max(beats, M.beats);
    for (const n of M.ev) {
      const t = t0 + n.b * spb, len = n.len * spb * 0.94, ms = n.ms.map((m) => m + oct);
      if (ms.length > 1) chord(inst, out, t, ms, len, v, 0.4);
      else note(inst, out, t, ms[0], len, v * (n.b % 1 ? 0.86 : 1), pan);
    }
  }
  for (const [b, kind, v, pan = 0] of A.hits || []) hit(kind, out, t0 + b * spb, v, pan);
  for (const [pat, kind, v] of A.perc || []) [...pat].forEach((x, i) => { if (x !== '.') hit(kind, out, t0 + i * spb / 2, v * (i % 2 ? 0.8 : 1)); });
  return {
    dur: beats * spb + 0.05,
    stop(f = 0.3) {
      if (!E.ctx) return;
      glide(out.gain, 0, E.now, Math.max(0.01, f / 4));
      E.later(() => { try { out.disconnect(); } catch { /* gone */ } }, f * 1000 + 400);
    }
  };
}

// ♪ on the platform ticket: a station's departure melody at its in-game tempo, through the
// same platform speakers, with the menu loop ducked underneath. Pumped like the menu, so
// stopping it early leaves nothing scheduled behind.
export class Preview {
  constructor(menu) { this.menu = menu; this.c = null; }
  get playing() { return !!this.c; }
  get id() { return this.c?.id || null; }
  get beat() { return this.c?.spb || 0.5; }
  play(id, dur, onEnd = null) {
    this.stop(0.08);
    if (!E.live || !SONGS[id]) return 0;
    const song = build(SONGS[id]), out = gain(E.ctx, 1);
    out.connect(E.g.bus.melody);
    const c = this.c = { id, song, spb: dur / song.beats, out, t0: E.now + 0.1, idx: 0, len: dur + 1.2, timer: 0, onEnd };
    this.duck(0.12);
    if (!E.offline) c.timer = setInterval(() => this.pump(), 60);
    this.pump();
    return c.len;
  }
  pump() {
    const c = this.c; if (!c || !E.live) return;
    const ev = c.song.ev, horizon = E.now + 0.3;
    while (c.idx < ev.length && c.t0 + ev[c.idx].b * c.spb <= horizon) { const e = ev[c.idx++]; e.fn(c.t0 + e.b * c.spb, c.spb, c.out); }
    if (!E.offline && E.now > c.t0 + c.len) this.stop(0.05, true);
  }
  duck(v) { this.menu.duck(v); }
  stop(f = 0.3, ended = false) {
    const c = this.c; if (!c) return; this.c = null; clearInterval(c.timer);
    this.duck(1);
    if (E.ctx) {
      glide(c.out.gain, 0, E.now, Math.max(0.01, f / 4));
      E.later(() => { try { c.out.disconnect(); } catch { /* gone */ } }, f * 1000 + 400);
    }
    if (ended) c.onEnd?.();
  }
}

// Result stings; returns their length so the UI can pace itself.
export function jingle(kind) {
  if (!E.live) return 0;
  const d = E.g.bus.music, t = E.now + 0.04, s = 0.1;
  if (kind === 'fail') {                        // two sagging PA pips, then the sad slide
    note('chime', d, t, 81, 0.4, 0.5); note('chime', d, t + 0.28, 76, 0.7, 0.45);
    [64, 63, 62].forEach((m, i) => note('brass', d, t + 0.8 + i * 0.36, m - 12, 0.3, 0.6));
    note('brass', d, t + 1.9, 49, 1.3, 0.6); hit('timp', d, t + 1.9, 0.5);
    return 3.3;
  }
  [72, 76, 79, 84].forEach((m, i) => note('bell', d, t + i * s, m, 0.5, 0.62, (i - 1.5) * 0.2));
  chord('epiano', d, t + 4 * s, [60, 64, 67, 71, 74], 1.6, 0.9);
  note('bass', d, t + 4 * s, 48, 1.2, 0.5); hit('shaker', d, t + 4 * s, 0.7);
  if (kind !== 'gold') { note('glock', d, t + 4 * s, 88, 1.2, 0.4); return 2.2; }
  [79, 84, 88].forEach((m, i) => note('brass', d, t + 0.55 + i * 0.14, m - 12, i === 2 ? 1.1 : 0.14, 0.7));
  [91, 96, 100, 103].forEach((m, i) => note('glock', d, t + 0.9 + i * 0.07, m, 0.8, 0.28, 0.4 - i * 0.25));
  hit('crash', d, t + 0.83, 0.8); hit('timp', d, t + 0.83, 0.8);
  return 2.8;
}
