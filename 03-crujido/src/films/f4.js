// Film 4 · ZAPATOS DE CLAQUÉ (musical). A rhythm film: the band alone is too quiet to hide a
// sweet wrapper, but every tap of the dancer's shoes is loud and exactly on the beat. In the
// stop-time breaks the band drops out and only the shoes are left. The fan next to you whistles
// along with his favourite song, which covers you... as long as you let him enjoy it.
import { hit, boom, bed, swell, line } from '../film.js';
import { seat } from '../snacks.js';

export const BPM = 132, B = 60 / BPM;

export const meta = {
  id: 'claque', genre: 'musical', snack: 'caramelo', combo: 12, studio: 'luces', bpm: BPM,
  grade: { sky: '#ffd66b', mid: '#c2384f', low: '#241233', light: '#ffe2a0' },
};

export const cast = [
  { id: 'fan', kind: 'fan', ...seat(0, 1), look: { hair: 'fedora', hc: '#3b2f2a', skin: '#e6b48f', top: '#8a3b2e', v: 'm2', acc: 'bow' } },
  { id: 'a', kind: 'normal', ...seat(1, -0.5), look: { hair: 'perm', hc: '#d8d2cc', skin: '#f1cfb4', top: '#6d5a8a', v: 'f2' } },
  { id: 'b', kind: 'normal', ...seat(1, 1.5), look: { hair: 'short', hc: '#1b1716', skin: '#a8714f', top: '#2f4f6f', v: 'm1' } },
  { id: 'c', kind: 'normal', ...seat(2, 0.5), look: { hair: 'bun', hc: '#5a3524', skin: '#e9bf9c', top: '#2e6b5a', v: 'f1' } },
  { id: 'd', kind: 'normal', ...seat(3, -1), look: { hair: 'cap', hc: '#b23a3a', skin: '#c68b66', top: '#3b3b3b', v: 'm3' } },
];

export function script(D) {
  const cues = [], cc = [], shots = [], tele = [], grid = [];
  const say = (t, id, L = 56) => { cues.push(line(t, id, L, D(id))); cc.push({ t, dur: D(id), line: id }); };
  const room = (t, id, src, L, k = 'line') => { cues.push(line(t, id, L, D(id), { src, k })); cc.push({ t, dur: D(id), line: id, src }); };
  const sub = (t, dur, key) => cc.push({ t, dur, key });
  const tap = (t, L, n = 1) => cues.push(hit(t, L, { h: 0.02, rate: 160, k: 'tap', n }));
  // a stop-time bar: the band hits beat 1, then only the shoes (offsets in beats)
  const STOP = [1, 1.5, 2, 2.75, 3, 3.5];
  const stopBars = (t0, bars, L, n = 1) => {
    for (let b = 0; b < bars; b++) {
      const t = t0 + b * 4 * B;
      cues.push(hit(t, L + 2, { h: 0.08, rate: 60, k: 'bandhit' }));
      for (const o of STOP) tap(t + o * B, L, n);
    }
    return t0 + bars * 4 * B;
  };
  // the fan whistles the verse from his seat: a local cover that only helps the people near him
  const whistle = (t0, t1) => { cues.push(bed(t0, t1, 70, { src: 'fan', k: 'whistle', fi: 0.3, fo: 0.3 })); cc.push({ t: t0, dur: 2.4, key: 'cc_whistle_fan', src: 'fan' }); };
  const onBeats = (t0, beats, L, n = 1) => { for (let i = 0; i < beats; i++) tap(t0 + i * B, L, n); return t0 + beats * B; };

  shots.push({ t: 0, k: 'logo' });
  cues.push(swell(0.3, 1.2, 66, 78, { h: 0.3, rate: 30, k: 'fanfare' }));
  // the marquee: the band warms up
  shots.push({ t: 4.2, img: 'f4_marquee', kb: [0.5, 0.52, 1.02, 0.5, 0.46, 1.14], fx: ['bulbs'] });
  cues.push(bed(4.2, 9, 66, { k: 'swing', fi: 0.6, fo: 0.3 }));
  cues.push(boom(9.0, 86, { h: 0.1, rate: 30, k: 'bandhit' }));
  // NUMBER 1: count-in, a soft verse, eight beats of taps, then two stop-time bars
  shots.push({ t: 9.4, img: 'f4_stage', kb: [0.5, 0.5, 1.12, 0.5, 0.5, 1.02], fx: ['spot'] });
  say(9.6, 'f4_count', 64);
  let t = 11.4, g0 = t;
  cues.push(bed(t, t + 16 * B, 56, { k: 'swing', mood: 'soft', fi: 0.3, fo: 0.2 }));
  t += 16 * B;
  cues.push(bed(t, t + 8 * B, 64, { k: 'swing', fi: 0.1, fo: 0.1 }));
  shots.push({ t, img: 'f4_stage', kb: [0.5, 0.62, 1.5, 0.5, 0.64, 1.6], fx: ['spot', 'beat'] });
  sub(t, 2.4, 'cc_taps');
  t = onBeats(t, 8, 80);
  shots.push({ t, img: 'f4_stage', kb: [0.5, 0.56, 1.3, 0.5, 0.5, 1.1], fx: ['spot', 'beat'] });
  sub(t, 2.6, 'cc_stoptime');
  t = stopBars(t, 2, 82);
  cues.push(boom(t, 92, { h: 0.12, rate: 26, k: 'bandhit' }));
  grid.push({ t0: g0, t1: t + B, B });
  cues.push(bed(t + 0.35, t + 2.8, 74, { k: 'applause', fi: 0.3, fo: 1.2 }));
  sub(t + 0.35, 2.4, 'cc_applause');
  // the dressing room
  const dr = t + 4.4;
  shots.push({ t: dr, img: 'f4_dressing', kb: [0.5, 0.5, 1.04, 0.5, 0.5, 1.1] });
  cues.push(bed(dr, dr + 11.6, 42, { k: 'piano', fi: 1 }));
  shots.push({ t: dr + 0.9, img: 'f4_dressing', kb: [0.64, 0.5, 1.55, 0.64, 0.5, 1.6] });
  say(dr + 1.0, 'f4_her_premiere', 56);
  shots.push({ t: dr + 3.4, img: 'f4_dressing', kb: [0.36, 0.5, 1.55, 0.36, 0.5, 1.6] });
  say(dr + 3.6, 'f4_him_shoes', 56);
  shots.push({ t: dr + 6.0, img: 'f4_dressing', kb: [0.64, 0.5, 1.55, 0.64, 0.5, 1.6] });
  say(dr + 6.2, 'f4_her_what', 58);
  shots.push({ t: dr + 8.2, img: 'f4_dressing', kb: [0.36, 0.5, 1.55, 0.36, 0.5, 1.6] });
  say(dr + 8.4, 'f4_him_stolen', 56);
  // NUMBER 2: singing in the rain, in borrowed boots. His favourite: the fan whistles along
  t = dr + 11.6; g0 = t;
  shots.push({ t, img: 'f4_rain', kb: [0.5, 0.5, 1.03, 0.5, 0.5, 1.12], fx: ['rain', 'spot'] });
  cues.push(bed(t, t + 40 * B, 50, { k: 'rain', fi: 0.8, fo: 1 }));
  cues.push(bed(t + 0.4, t + 16 * B, 54, { k: 'swing', mood: 'soft', fi: 0.6 }));
  whistle(t + 8 * B, t + 16 * B - 0.2);
  t += 16 * B;
  cues.push(bed(t, t + 16 * B, 64, { k: 'swing', fi: 0.1, fo: 0.1 }));
  shots.push({ t, img: 'f4_rain', kb: [0.46, 0.6, 1.4, 0.54, 0.6, 1.5], fx: ['rain', 'beat', 'splash'] });
  t = onBeats(t, 16, 81, 2);
  sub(t, 2.6, 'cc_stoptime');
  t = stopBars(t, 2, 82, 2);
  cues.push(boom(t, 90, { h: 0.12, rate: 26, k: 'bandhit' }));
  grid.push({ t0: g0, t1: t + B, B });
  // FINALE: opening night, the whole chorus line in step
  const fin = t + 0.8;
  shots.push({ t: fin, img: 'f4_finale', kb: [0.5, 0.5, 1.02, 0.5, 0.5, 1.1], fx: ['spot', 'bulbs'] });
  say(fin + 0.2, 'f4_count', 66);
  t = fin + 2.0; g0 = t;
  cues.push(bed(t, t + 16 * B, 66, { k: 'swing', fi: 0.1, fo: 0.1 }));
  shots.push({ t, img: 'f4_finale', kb: [0.5, 0.62, 1.34, 0.5, 0.6, 1.44], fx: ['spot', 'beat'] });
  sub(t, 2.4, 'cc_chorus');
  t = onBeats(t, 16, 83, 3);
  sub(t, 2.6, 'cc_stoptime');
  t = stopBars(t, 2, 84, 3);
  cues.push(boom(t, 96, { h: 0.2, rate: 16, k: 'bandhit' }));
  grid.push({ t0: g0, t1: t + B, B });
  cues.push(bed(t + 0.4, t + 6, 80, { k: 'applause', fi: 0.3, fo: 1.4 }));
  sub(t + 0.4, 2.6, 'cc_ovation');
  shots.push({ t: t + 6.2, k: 'end' });
  const dur = Math.ceil(t + 9);
  cues.push(bed(t + 6.2, dur, 50, { k: 'swing', mood: 'soft', fi: 0.8 }));
  return { dur, cues, cc, shots, tele, grid };
}
