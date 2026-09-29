// Film 5 · PLANETA SALVAJE (nature documentary). A calm narrator, long quiet stretches and a few
// enormous moments: a roar, a waterfall, elephants, a storm. Corn nuts take five crunches each.
// A man in the front row has been asleep since the trailers: his snoring hides you from the
// people around him, but crunch too loud at the wrong moment and he wakes up, and the snoring
// stops. A little boy asks his mother about everything, out loud.
import { hit, boom, bed, swell, line } from '../film.js';
import { seat } from '../snacks.js';

export const meta = {
  id: 'planeta', genre: 'documental', snack: 'kikos', combo: 8, studio: 'tierra',
  grade: { sky: '#ffc36b', mid: '#8a6a2e', low: '#1c1a10', light: '#ffd690' },
};

export const cast = [
  { id: 'ronc', kind: 'roncador', ...seat(1, 1), look: { hair: 'bald', hc: '#8a7f78', skin: '#e0b08e', top: '#5a6b3a', v: 'old' } },
  { id: 'nino', kind: 'nino', ...seat(1, -1), look: { hair: 'spiky', hc: '#3a2618', skin: '#f2c9a6', top: '#e0a52e', v: 'kid' } },
  { id: 'mama', kind: 'normal', ...seat(1, -2), look: { hair: 'pony', hc: '#2a1a12', skin: '#f0c5a2', top: '#4a6b8a', v: 'f2' } },
  { id: 'c', kind: 'normal', ...seat(2, 0), look: { hair: 'curly', hc: '#171214', skin: '#6e4630', top: '#7a3a4a', v: 'f1' } },
  { id: 'd', kind: 'normal', ...seat(3, 1), look: { hair: 'cap', hc: '#2b4a6b', skin: '#d9a47c', top: '#3a3a3a', v: 'm2' } },
];

export function script(D) {
  const cues = [], cc = [], shots = [], tele = [];
  const say = (t, id, L = 56) => { cues.push(line(t, id, L, D(id))); cc.push({ t, dur: D(id), line: id }); };
  const room = (t, id, src, L, k = 'line') => { cues.push(line(t, id, L, D(id), { src, k })); cc.push({ t, dur: D(id), line: id, src }); };
  const sub = (t, dur, key) => cc.push({ t, dur, key });
  const thunder = (flash, t, L) => { tele.push({ k: 'lightning', t0: flash, t1: t }); cues.push(boom(t, L, { h: 0.8, rate: 10, k: 'thunder' })); };

  // the man in the front row has been snoring since the trailers: breathe in, breathe out
  cues.push(bed(0, 88, 60, { src: 'ronc', k: 'snore', fi: 0.1, lfo: { f: 0.24, m: 9, ph: -1.2 } }));

  shots.push({ t: 0, k: 'logo' });
  cues.push(swell(0.3, 3.6, 58, 70, { h: 0.3, rate: 16, k: 'orchestra' }));
  // dawn on the savanna
  shots.push({ t: 4.2, img: 'f5_savanna', kb: [0.4, 0.5, 1.02, 0.6, 0.48, 1.1], fx: ['dust'] });
  cues.push(bed(4.2, 12.6, 46, { k: 'birds', fi: 1.2 }));
  say(6.0, 'f5_nar_dawn', 58);
  say(9.4, 'f5_nar_calm', 58);
  // the lion in the grass: the narrator whispers, then silence
  shots.push({ t: 12.6, img: 'f5_lion', kb: [0.5, 0.52, 1.02, 0.5, 0.5, 1.34] });
  cues.push(bed(12.6, 19.2, 40, { k: 'grass', fi: 1 }));
  say(13.2, 'f5_nar_watch', 52);
  say(16.2, 'f5_nar_quiet', 50);
  tele.push({ k: 'swell', t0: 16.2, t1: 20 });
  sub(18.6, 1.4, 'cc_silence');
  cues.push(boom(20, 94, { a: 0.08, h: 1.2, sag: 4, rate: 14, k: 'roar' }));
  shots.push({ t: 20, img: 'f5_roar', kb: [0.5, 0.5, 1.3, 0.5, 0.48, 1.06], fx: ['punch'] });
  sub(20, 2, 'cc_roar');
  room(22.4, 'p_kid_roar', 'nino', 66);
  room(24.3, 'p_mum_shh', 'mama', 58);
  // the waterfall: ten seconds of thunder you can eat under
  shots.push({ t: 25, img: 'f5_waterfall', kb: [0.5, 0.4, 1.02, 0.5, 0.6, 1.14], fx: ['mist'] });
  cues.push(bed(25, 31.5, 68, { k: 'waterfall', fi: 1.2, fo: 1.4 }));
  sub(25.3, 2.4, 'cc_waterfall');
  say(27.5, 'f5_nar_water', 66);
  room(30.6, 'p_kid_drink', 'nino', 66);
  // elephants at the waterhole
  shots.push({ t: 35, img: 'f5_elephants', kb: [0.44, 0.5, 1.03, 0.56, 0.5, 1.12], fx: ['dust'] });
  cues.push(bed(35, 45, 48, { k: 'birds', fi: 0.8 }));
  cues.push(hit(37.2, 88, { a: 0.05, h: 0.7, rate: 30, k: 'trumpet' }), hit(40.4, 89, { a: 0.05, h: 0.9, rate: 30, k: 'trumpet' }));
  sub(37.2, 1.6, 'cc_trumpet');
  say(42.4, 'f5_nar_elephants', 58);
  // night: crickets, and the man in the front row
  shots.push({ t: 45, img: 'f5_night', kb: [0.5, 0.46, 1.02, 0.5, 0.54, 1.1], fx: ['fireflies'] });
  cues.push(bed(45, 56, 42, { k: 'crickets', fi: 1.5, lfo: { f: 0.5, m: 3 } }));
  say(46.2, 'f5_nar_night', 54);
  room(51.0, 'p_kid_snore', 'nino', 64);
  room(53.4, 'p_mum_shh', 'mama', 58);
  // the storm: lightning, count, thunder
  shots.push({ t: 56, img: 'f5_storm', kb: [0.5, 0.5, 1.03, 0.5, 0.46, 1.14], fx: ['rain'] });
  cues.push(bed(56, 66.4, 60, { k: 'rain', fi: 1, fo: 1.6 }));
  say(56.6, 'f5_nar_storm', 62);
  thunder(57.0, 58.2, 92);
  thunder(61.0, 62.0, 93);
  thunder(63.9, 64.8, 94);
  sub(58.2, 2, 'cc_thunder');
  // a new day
  shots.push({ t: 66.5, img: 'f5_dawn', kb: [0.5, 0.52, 1.14, 0.5, 0.48, 1.02], fx: ['dust'] });
  cues.push(swell(66.5, 72, 60, 80, { h: 2.4, sag: 3, rate: 9, k: 'orchestra' }));
  sub(66.8, 2.4, 'cc_orchestra');
  say(75.0, 'f5_nar_life', 60);
  shots.push({ t: 80, k: 'end' });
  cues.push(bed(80, 88, 46, { k: 'birds', fi: 0.8 }));
  return { dur: 88, cues, cc, shots, tele };
}
