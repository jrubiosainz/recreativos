// Film 6 · SILENCIO (black-and-white art-house film, at its premiere). A lighthouse keeper, the
// sea, a clock, a foghorn and a storm. The director sits right in front of you and hears
// everything; the critic takes notes; the old man next to you turns his hearing aid up every
// time he catches you. Your combo ends with ice from your drink, the loudest thing in the
// building. At the end the lights come up, the room gives a standing ovation and the director
// gets up to take his bow (he stops listening the moment the applause starts).
import { hit, boom, bed, swell, line } from '../film.js';
import { seat } from '../snacks.js';

export const meta = {
  id: 'silencio', genre: 'autor', studio: 'none', bw: true,
  combo: ['palomitas', 'palomitas', 'hielo', 'caramelo', 'palomitas', 'hielo', 'caramelo', 'hielo'],
  grade: { sky: '#d8d8d8', mid: '#6a6a6a', low: '#141414', light: '#e8e8e8' },
};

export const cast = [
  { id: 'dir', kind: 'director', ...seat(1, 0.5), away: [[73.6, 82]], look: { hair: 'beret', hc: '#1a1a1a', skin: '#e2b896', top: '#1f1f24', v: 'm2', acc: 'scarf' } },
  { id: 'crit', kind: 'critico', ...seat(1, -1.5), look: { hair: 'side', hc: '#9a948c', skin: '#efcfb6', top: '#4a3a2e', v: 'm1', acc: 'glasses' } },
  { id: 'abu', kind: 'abuelo', ...seat(0, -1), look: { hair: 'bald', hc: '#e4e0da', skin: '#e8c0a0', top: '#6a5a4a', v: 'old', acc: 'aid' } },
  { id: 'c', kind: 'normal', ...seat(2, 1), look: { hair: 'bob', hc: '#2a1c16', skin: '#f2d0b6', top: '#7a2a3a', v: 'f2' } },
  { id: 'd', kind: 'normal', ...seat(3, -0.5), look: { hair: 'long', hc: '#c9a060', skin: '#f0caa8', top: '#2a4a5a', v: 'f1' } },
];

export function script(D) {
  const cues = [], cc = [], shots = [], tele = [];
  const say = (t, id, L = 52) => { cues.push(line(t, id, L, D(id))); cc.push({ t, dur: D(id), line: id }); };
  const sub = (t, dur, key) => cc.push({ t, dur, key });
  const thunder = (flash, t, L) => { tele.push({ k: 'lightning', t0: flash, t1: t }); cues.push(boom(t, L, { h: 0.8, rate: 10, k: 'thunder' })); };

  // the title card and one piano note
  shots.push({ t: 0, k: 'card', key: 'f6_card_title' });
  cues.push(hit(0.6, 60, { a: 0.01, h: 0.2, rate: 7, k: 'pianonote' }));
  // the lighthouse and the sea: every seventh second a wave breaks
  shots.push({ t: 5, img: 'f6_sea', kb: [0.5, 0.5, 1.02, 0.5, 0.46, 1.12], fx: ['bw'] });
  cues.push(bed(5, 14.2, 56, { k: 'waves', fi: 1.2, lfo: { f: 1 / 7, m: 9, ph: -1.4 } }));
  cues.push(hit(7.2, 60, { h: 0.5, rate: 30, k: 'gull' }), hit(9.9, 62, { h: 0.4, rate: 30, k: 'gull' }));
  sub(5.4, 2.4, 'cc_waves');
  // the keeper, the clock
  shots.push({ t: 14.2, img: 'f6_keeper', kb: [0.5, 0.5, 1.04, 0.5, 0.5, 1.16], fx: ['bw'] });
  cues.push(bed(14.2, 24.2, 46, { k: 'waves', fi: 0.6, lfo: { f: 1 / 7, m: 5, ph: 0.4 }, muffle: 1 }));
  for (let t = 14.6; t < 24; t += 1) cues.push(hit(t, 46, { h: 0.015, rate: 200, k: 'tick' }));
  sub(14.6, 1.6, 'cc_clock');
  say(18.4, 'f6_keeper_day', 50);
  shots.push({ t: 21.4, k: 'card', key: 'f6_card_day' });
  // the foghorn: his hand on the lever, then the horn
  shots.push({ t: 24.2, img: 'f6_lever', kb: [0.5, 0.5, 1.04, 0.5, 0.5, 1.3], fx: ['bw', 'lever'], boomAt: 27.5 });
  tele.push({ k: 'lever', t0: 24.4, t1: 27.5 });
  cues.push(hit(27.5, 92, { a: 0.12, h: 1.8, rate: 18, k: 'foghorn' }));
  shots.push({ t: 27.5, img: 'f6_sea', kb: [0.5, 0.4, 1.3, 0.5, 0.42, 1.36], fx: ['bw', 'shake'] });
  sub(27.5, 2.2, 'cc_foghorn');
  // the letter
  shots.push({ t: 31, img: 'f6_letter', kb: [0.5, 0.5, 1.02, 0.5, 0.52, 1.2], fx: ['bw'] });
  cues.push(bed(31, 40, 44, { k: 'piano', fi: 1.2 }));
  say(34.0, 'f6_woman_letter', 52);
  shots.push({ t: 37.2, k: 'card', key: 'f6_card_letter' });
  // the storm
  shots.push({ t: 40, img: 'f6_storm', kb: [0.5, 0.5, 1.03, 0.5, 0.46, 1.14], fx: ['bw', 'rain', 'shake'] });
  cues.push(bed(40, 52, 62, { k: 'rain', fi: 0.8, fo: 1.2 }));
  cues.push(bed(40, 52, 64, { k: 'waves', fi: 0.8, fo: 1.2, lfo: { f: 1 / 5, m: 8 } }));
  thunder(42.2, 43.2, 90);
  thunder(46.4, 47.5, 92);
  sub(43.2, 2, 'cc_thunder');
  // the lamp is out: darkness, his breathing on the stairs
  shots.push({ t: 52, img: 'f6_dark', kb: [0.5, 0.56, 1.04, 0.5, 0.42, 1.2], fx: ['bw', 'flicker'] });
  cues.push(bed(52, 60, 40, { k: 'breath', fi: 1, lfo: { f: 0.4, m: 3 } }));
  say(56.6, 'f6_keeper_light', 50);
  // he lights it: the orchestra, at last
  shots.push({ t: 60, img: 'f6_light', kb: [0.5, 0.5, 1.2, 0.5, 0.5, 1.02], fx: ['bw', 'beams'] });
  cues.push(swell(60, 68, 58, 90, { h: 3.6, sag: 2, rate: 10, k: 'orchestra' }));
  sub(60.4, 2.4, 'cc_orchestra');
  // the end card, and the premiere's standing ovation
  shots.push({ t: 72.4, k: 'card', key: 'f6_card_end' });
  cues.push(bed(73, 79.4, 82, { k: 'applause', fi: 0.6, fo: 1.6 }));
  [74.0, 75.5, 77.0, 78.4].forEach((t) => cues.push(hit(t, 86, { h: 0.4, rate: 40, k: 'bravo' })));
  sub(73.2, 3, 'cc_ovation');
  return { dur: 82, cues, cc, shots, tele, lightsUp: 72.8 };
}

