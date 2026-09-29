// Film 3 · LA CASA CALLADA (horror). Horror is mostly silence and the scares are loud, but they
// come when they want. The violins teach you when a scare is due, and then, once, they lie.
// Your friend sits right next to you: she hears every crunch, and she screams at every scare.
import { hit, boom, bed, swell, line } from '../film.js';
import { seat } from '../snacks.js';

export const meta = {
  id: 'casa', genre: 'terror', snack: 'nachos', combo: 6, studio: 'noche',
  grade: { sky: '#6f8fa8', mid: '#2c3d4f', low: '#0d1218', light: '#9ec2dc' },
};

export const cast = [
  { id: 'amiga', kind: 'miedica', ...seat(0, 1), look: { hair: 'pony', hc: '#b3542e', skin: '#f0c3a0', top: '#5b3a6e', v: 'f1' } },
  { id: 'a', kind: 'normal', ...seat(1, -0.5), look: { hair: 'short', hc: '#221a16', skin: '#d6a07a', top: '#34495e', v: 'm1' } },
  { id: 'b', kind: 'normal', ...seat(1, 1.5), look: { hair: 'bob', hc: '#141217', skin: '#e8b996', top: '#7a2f36', v: 'f2' } },
  { id: 'c', kind: 'normal', ...seat(2, 0.5), look: { hair: 'beanie', hc: '#2f5d50', skin: '#9b6a4b', top: '#3a3a44', v: 'm2' } },
  { id: 'd', kind: 'normal', ...seat(3, -1), look: { hair: 'long', hc: '#3a2a20', skin: '#f2cfb3', top: '#56607a', v: 'f1' } },
];

export function script(D) {
  const cues = [], cc = [], shots = [], tele = [];
  const say = (t, id, L = 56) => { cues.push(line(t, id, L, D(id))); cc.push({ t, dur: D(id), line: id }); };
  const room = (t, id, src, L, k = 'line') => { cues.push(line(t, id, L, D(id), { src, k })); cc.push({ t, dur: D(id), line: id, src }); };
  const sub = (t, dur, key) => cc.push({ t, dur, key });

  shots.push({ t: 0, k: 'logo' });
  cues.push(swell(0.3, 3.4, 50, 62, { h: 0.4, rate: 18, k: 'drone' }));
  // the house on the hill
  shots.push({ t: 4.2, img: 'f3_house', kb: [0.5, 0.52, 1.02, 0.5, 0.46, 1.16], fx: ['fog'] });
  cues.push(bed(4.2, 13.5, 46, { k: 'wind', lfo: { f: 0.21, m: 5 } }));
  cues.push(hit(6.6, 60, { h: 0.45, rate: 40, k: 'owl' }), hit(7.5, 58, { h: 0.55, rate: 40, k: 'owl' }));
  sub(6.6, 1.8, 'cc_owl');
  say(9.4, 'f3_girl_hello', 56);
  // the hallway: a clock and the floorboards
  shots.push({ t: 13.5, img: 'f3_hall', kb: [0.5, 0.5, 1.04, 0.5, 0.48, 1.22], fx: ['flicker'] });
  cues.push(bed(13.5, 24, 40, { k: 'drone', fi: 1.5 }));
  for (let t = 14; t < 23.5; t += 1) cues.push(hit(t, 48, { h: 0.015, rate: 200, k: 'tick' }));
  cues.push(hit(15.6, 62, { h: 0.5, rate: 30, k: 'creak' }), hit(18.1, 64, { h: 0.7, rate: 30, k: 'creak' }));
  sub(14, 1.6, 'cc_clock'); sub(15.6, 1.4, 'cc_creak');
  // the violins creep up...
  tele.push({ k: 'swell', t0: 20.2, t1: 24 });
  cues.push(swell(20.2, 24, 42, 66, { k: 'strings', rate: 60 }));
  sub(20.4, 2.4, 'cc_strings');
  // SCARE 1: the cat
  shots.push({ t: 24, img: 'f3_cat', kb: [0.5, 0.5, 1.3, 0.5, 0.5, 1.06], fx: ['punch'] });
  cues.push(boom(24, 93, { h: 0.25, rate: 13, k: 'stinger' }));
  cues.push(bed(24.02, 25.1, 72, { k: 'hiss', fo: 0.3 }));
  room(24.1, 'p_scream1', 'amiga', 90, 'scream');
  sub(24, 1.4, 'cc_stinger');
  cues.push(bed(25.8, 27.6, 60, { k: 'laugh', fi: 0.2, fo: 0.8 }));
  sub(25.8, 1.8, 'cc_laugh');
  shots.push({ t: 26.6, img: 'f3_hall', kb: [0.46, 0.5, 1.3, 0.5, 0.5, 1.36] });
  say(27.8, 'f3_girl_cat', 54);
  // the basement: a music box and her heartbeat
  shots.push({ t: 31, img: 'f3_stairs', kb: [0.5, 0.4, 1.02, 0.5, 0.56, 1.3], fx: ['flicker'] });
  cues.push(bed(31, 46.8, 44, { k: 'musicbox', fi: 2, rate: 400 }));
  for (let t = 32.2; t < 46.6; t += 0.83) cues.push(hit(t, 54, { h: 0.05, rate: 70, k: 'heart' }));
  say(36.5, 'f3_girl_mama', 50);
  tele.push({ k: 'swell', t0: 40, t1: 46.8 });
  cues.push(swell(40, 46.8, 46, 72, { k: 'strings', rate: 400 }));
  sub(40.2, 3, 'cc_strings');
  // ...and nothing. The trap.
  shots.push({ t: 46.8, img: 'f3_stairs', kb: [0.5, 0.56, 1.3, 0.5, 0.58, 1.34], fx: ['dark'] });
  sub(47.2, 2.6, 'cc_silence');
  // SCARE 2: the real one
  shots.push({ t: 50.4, img: 'f3_ghost', kb: [0.5, 0.5, 1.28, 0.5, 0.47, 1.08], fx: ['punch'] });
  cues.push(boom(50.4, 96, { h: 0.3, rate: 12, k: 'stinger' }));
  room(50.46, 'p_scream2', 'amiga', 92, 'scream');
  cues.push(bed(50.5, 51.9, 80, { k: 'crowdscream', fo: 0.4 }));
  sub(50.4, 1.8, 'cc_scream');
  // ...and it lunges again, the moment everybody breathes out
  shots.push({ t: 52.5, img: 'f3_ghost', kb: [0.5, 0.44, 1.5, 0.5, 0.42, 1.2], fx: ['punch', 'shake'] });
  cues.push(boom(52.5, 94, { h: 0.3, rate: 12, k: 'stinger' }));
  cues.push(bed(52.56, 53.8, 80, { k: 'crowdscream', fo: 0.4 }));
  sub(52.5, 1.2, 'cc_scream');
  // running up the stairs, thunder outside: the lightning comes first
  shots.push({ t: 53.9, img: 'f3_stairs', kb: [0.5, 0.58, 1.3, 0.5, 0.36, 1.05], fx: ['shake', 'red'] });
  for (let t = 53.9; t < 58.8; t += 0.32) cues.push(hit(t, 66, { h: 0.03, rate: 150, k: 'step' }));
  cues.push(bed(53.9, 59, 56, { k: 'breath', lfo: { f: 1.6, m: 4 } }));
  tele.push({ k: 'lightning', t0: 54.0, t1: 55.2 }, { k: 'lightning', t0: 57.1, t1: 58.0 });
  cues.push(boom(55.2, 90, { h: 0.6, rate: 10, k: 'thunder' }), boom(58.0, 91, { h: 0.7, rate: 10, k: 'thunder' }));
  sub(55.2, 2, 'cc_thunder');
  // the attic
  shots.push({ t: 60, img: 'f3_attic', kb: [0.42, 0.5, 1.02, 0.56, 0.5, 1.3], fx: ['dust'] });
  cues.push(bed(60, 73.4, 38, { k: 'whisper', fi: 2, rate: 400 }));
  for (let t = 61.2; t < 72; t += 1.7) cues.push(hit(t, 50, { h: 0.4, rate: 40, k: 'rock' }));
  sub(61.2, 2, 'cc_rock');
  say(64.8, 'f3_doll_play', 58);
  say(67.6, 'f3_girl_no', 50);
  tele.push({ k: 'swell', t0: 68.6, t1: 73.4 });
  cues.push(swell(68.6, 72.2, 36, 58, { k: 'strings', rate: 40 }));
  say(72.1, 'f3_doll_found', 56);
  // SCARE 3
  shots.push({ t: 73.4, img: 'f3_doll', kb: [0.5, 0.46, 1.34, 0.5, 0.48, 1.08], fx: ['punch'] });
  cues.push(boom(73.4, 97, { h: 0.35, rate: 12, k: 'stinger' }));
  room(73.46, 'p_scream3', 'amiga', 94, 'scream');
  cues.push(bed(73.5, 75, 84, { k: 'crowdscream', fo: 0.5 }));
  cues.push(bed(75.8, 78.4, 62, { k: 'laugh', fo: 1 }));
  sub(73.4, 1.8, 'cc_scream'); sub(75.8, 2.4, 'cc_laugh');
  shots.push({ t: 79, k: 'end', q: 1 });
  cues.push(bed(79, 86, 44, { k: 'musicbox' }));
  return { dur: 86, cues, cc, shots, tele };
}
