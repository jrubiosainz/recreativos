// Film 1 · OPERACIÓN TRUENO (action). Explosions are telegraphed by what the film shows: a lit
// fuse, a bomb timer, a finger on a red button. Loud and generous: the lesson is that silence,
// not the film, is your enemy.
import { hit, boom, bed, swell, line } from '../film.js';
import { seat } from '../snacks.js';

export const meta = {
  id: 'trueno', genre: 'accion', snack: 'palomitas', combo: 12, studio: 'sol',
  grade: { sky: '#ff9a3c', mid: '#b8452a', low: '#2a1320', light: '#ffb45e' },
};

export const cast = [
  { id: 'a', kind: 'normal', ...seat(1, 0.5), look: { hair: 'bun', hc: '#3a2418', skin: '#c98e6a', top: '#4a5a7a', v: 'f1' } },
  { id: 'b', kind: 'normal', ...seat(1, -1.5), look: { hair: 'cap', hc: '#23324a', skin: '#e2b08c', top: '#7a3a2e', v: 'm1' } },
  { id: 'c', kind: 'normal', ...seat(2, 0), look: { hair: 'short', hc: '#1d1512', skin: '#8a5a3c', top: '#2e5a4a', v: 'm2' } },
  { id: 'd', kind: 'normal', ...seat(2, 2), look: { hair: 'long', hc: '#b0703a', skin: '#f0c6a4', top: '#6a3a6a', v: 'f2' } },
  { id: 'e', kind: 'normal', ...seat(3, -1.5), look: { hair: 'curly', hc: '#2b1b14', skin: '#b67a58', top: '#5a5a3a', v: 'm3' } },
];

export function script(D) {
  const cues = [], cc = [], shots = [], tele = [];
  const say = (t, id, L = 61) => { cues.push(line(t, id, L, D(id))); cc.push({ t, dur: D(id), line: id }); };
  const sub = (t, dur, key) => cc.push({ t, dur, key });

  // studio fanfare
  shots.push({ t: 0, k: 'logo' });
  cues.push(swell(0.3, 1.4, 70, 80, { h: 2.4, rate: 26, k: 'fanfare' }));
  // the desert walk
  shots.push({ t: 4.6, img: 'f1_desert', kb: [0.5, 0.56, 1.04, 0.5, 0.5, 1.14], fx: ['heat'] });
  shots.push({ t: 6.0, img: 'f1_desert', kb: [0.4, 0.52, 1.5, 0.42, 0.52, 1.56], fx: ['heat'] });
  shots.push({ t: 8.7, img: 'f1_desert', kb: [0.6, 0.52, 1.5, 0.58, 0.52, 1.56], fx: ['heat'] });
  cues.push(bed(4.6, 11.2, 48, { k: 'score', mood: 'tense' }));
  say(6.0, 'f1_hero_10s', 59); say(8.7, 'f1_ally_always', 59);
  // the fuse
  shots.push({ t: 11.2, img: 'f1_fuse', kb: [0.3, 0.58, 1.12, 0.66, 0.46, 1.32], fx: ['fuse'], boomAt: 15 });
  tele.push({ k: 'fuse', t0: 11.2, t1: 15 });
  cues.push(bed(11.2, 15, 45, { k: 'fusehiss', fo: 0.05 }));
  sub(11.3, 3.5, 'cc_fuse');
  cues.push(boom(15, 94, { h: 0.35, rate: 12 }));
  shots.push({ t: 15, img: 'f1_blast', kb: [0.5, 0.5, 1.26, 0.5, 0.5, 1.04], fx: ['flash', 'shake'] });
  sub(15, 2.2, 'cc_boom');
  // car chase: the engine covers popcorn, the horns cover anything
  shots.push({ t: 18.6, img: 'f1_chase', kb: [0.34, 0.5, 1.1, 0.66, 0.5, 1.2], fx: ['speed'] });
  cues.push(bed(18.6, 26, 58, { k: 'engine', lfo: { f: 0.45, m: 3 } }));
  [20.4, 23.1].forEach((t, i) => cues.push(hit(t, 84, { h: 0.22, rate: 40, k: 'horn', n: i })));
  sub(18.8, 2.4, 'cc_engines'); sub(20.4, 0.8, 'cc_horn');
  say(21.6, 'f1_hero_holdon', 70);
  // the hideout: quiet talk, nothing to hide behind but voices
  shots.push({ t: 26, img: 'f1_hideout', kb: [0.5, 0.5, 1.04, 0.5, 0.5, 1.12], fx: ['dust'] });
  shots.push({ t: 28.2, img: 'f1_hideout', kb: [0.64, 0.5, 1.5, 0.64, 0.5, 1.56], fx: ['dust'] });
  shots.push({ t: 31.4, img: 'f1_hideout', kb: [0.36, 0.5, 1.5, 0.36, 0.5, 1.56], fx: ['dust'] });
  shots.push({ t: 34.8, img: 'f1_hideout', kb: [0.64, 0.5, 1.62, 0.64, 0.5, 1.72], fx: ['dust'] });
  cues.push(bed(26, 38.4, 42, { k: 'score', mood: 'soft' }));
  say(28.4, 'f1_ally_detonator', 58); say(31.6, 'f1_hero_pocket', 58); say(35.0, 'f1_ally_mypocket', 62);
  // the bomb timer: five beeps, then the real thing
  shots.push({ t: 38.4, img: 'f1_bomb', kb: [0.5, 0.5, 1.1, 0.5, 0.5, 1.36], fx: ['timer'], boomAt: 43.5 });
  tele.push({ k: 'timer', t0: 38.5, t1: 43.5 });
  for (let i = 0; i < 5; i++) cues.push(hit(38.5 + i, 70, { h: 0.09, rate: 120, k: 'beep', n: 5 - i }));
  sub(38.5, 4.8, 'cc_beeps');
  cues.push(boom(43.5, 96, { h: 0.5, rate: 11 }));
  shots.push({ t: 43.5, img: 'f1_blast', kb: [0.5, 0.46, 1.36, 0.5, 0.5, 1.02], fx: ['flash', 'shake'], big: 1 });
  sub(43.5, 2.4, 'cc_boom');
  // helicopter
  shots.push({ t: 47.2, img: 'f1_heli', kb: [0.5, 0.52, 1.02, 0.5, 0.44, 1.16], fx: ['rotor'] });
  cues.push(bed(47.2, 56, 60, { k: 'rotor', lfo: { f: 2.4, m: 7, sq: 1 } }));
  sub(47.4, 2.5, 'cc_rotor');
  say(49.2, 'f1_ally_jump', 74);
  // rooftop: the quiet before the end
  shots.push({ t: 56, img: 'f1_roof', kb: [0.46, 0.5, 1.04, 0.5, 0.5, 1.1] });
  shots.push({ t: 59.6, img: 'f1_roof', kb: [0.8, 0.5, 1.62, 0.78, 0.5, 1.7] });
  cues.push(bed(56, 62.6, 42, { k: 'score', mood: 'soft' }));
  say(56.8, 'f1_hero_made', 57); say(59.8, 'f1_villain_notyet', 58);
  // the red button
  shots.push({ t: 62.6, img: 'f1_button', kb: [0.5, 0.5, 1.05, 0.5, 0.54, 1.32], fx: ['button'], boomAt: 65.5 });
  tele.push({ k: 'button', t0: 62.6, t1: 65.5 });
  sub(62.8, 2.4, 'cc_silence');
  [65.5, 66.8, 68.1].forEach((t) => cues.push(boom(t, 95, { h: 0.3, rate: 12 })));
  cues.push(swell(65.6, 67.2, 76, 84, { h: 5.4, rate: 9, k: 'theme' }));
  shots.push({ t: 65.5, img: 'f1_blast', kb: [0.5, 0.5, 1.42, 0.5, 0.5, 1.0], fx: ['flash', 'shake', 'multi'] });
  sub(65.5, 2.5, 'cc_booms'); sub(68.5, 4, 'cc_theme');
  shots.push({ t: 74.6, k: 'end' });
  return { dur: 76, cues, cc, shots, tele };
}
