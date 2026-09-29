// Film 2 · AMOR BAJO LA LLUVIA (romance). Rain is a soft, steady cover and the big moments are
// the orchestra, the train and the storm; lightning always arrives before its thunder. Crisps
// are loud, and the bag rustles every time you dig in. The couple in front only have eyes for
// each other, the film buff behind them hears everything, and the woman next to you has been
// fighting a sneeze since the trailers.
import { hit, boom, bed, swell, line } from '../film.js';
import { seat } from '../snacks.js';

export const meta = {
  id: 'lluvia', genre: 'romance', snack: 'patatas', combo: 8, studio: 'estrella',
  grade: { sky: '#f3b7a6', mid: '#7b5a78', low: '#1f1a2c', light: '#ffd0b0' },
};

export const cast = [
  { id: 'p1', kind: 'pareja', ...seat(1, 0), look: { hair: 'side', hc: '#2a1c14', skin: '#e0a882', top: '#394a6b', v: 'm1', lean: 1 } },
  { id: 'p2', kind: 'pareja', ...seat(1, 1), look: { hair: 'long', hc: '#6a3a22', skin: '#f3cdb0', top: '#b0485a', v: 'f2', lean: -1 } },
  { id: 'cine', kind: 'cinefilo', ...seat(2, -0.5), look: { hair: 'short', hc: '#4a4642', skin: '#c89272', top: '#2b2b30', v: 'm2', acc: 'glasses' } },
  { id: 'est', kind: 'estornudo', ...seat(0, -1), look: { hair: 'bun', hc: '#1c1618', skin: '#b87a56', top: '#3f7a6e', v: 'f1' } },
  { id: 'e', kind: 'normal', ...seat(3, 1), look: { hair: 'curly', hc: '#241a14', skin: '#7e5238', top: '#6c5a2e', v: 'm3' } },
];

export function script(D) {
  const cues = [], cc = [], shots = [], tele = [];
  const say = (t, id, L = 56) => { cues.push(line(t, id, L, D(id))); cc.push({ t, dur: D(id), line: id }); };
  const room = (t, id, src, L, k = 'line') => { cues.push(line(t, id, L, D(id), { src, k })); cc.push({ t, dur: D(id), line: id, src }); };
  const sub = (t, dur, key) => cc.push({ t, dur, key });
  const thunder = (flash, t, L) => { tele.push({ k: 'lightning', t0: flash, t1: t }); cues.push(boom(t, L, { h: 0.7, rate: 10, k: 'thunder' })); };

  shots.push({ t: 0, k: 'logo' });
  cues.push(swell(0.3, 2.0, 56, 68, { h: 0.2, rate: 9, k: 'harp' }));      // the glissando climbs 1.5 s to its twinkle, then rings
  // the café, rain on the window
  shots.push({ t: 4, img: 'f2_cafe', kb: [0.5, 0.5, 1.04, 0.5, 0.5, 1.14], fx: ['rain'] });
  cues.push(bed(4, 31, 52, { k: 'rain', fi: 1.5, lfo: { f: 0.07, m: 2 } }));
  cues.push(bed(4.4, 12.4, 46, { k: 'piano', fi: 1 }));
  shots.push({ t: 5.6, img: 'f2_cafe', kb: [0.36, 0.5, 1.5, 0.34, 0.5, 1.56] });
  say(6.0, 'f2_her_rain', 56);
  shots.push({ t: 8.4, img: 'f2_cafe', kb: [0.64, 0.5, 1.5, 0.66, 0.5, 1.56] });
  say(8.8, 'f2_him_always', 56);
  // the window: heavier rain, the first storm
  shots.push({ t: 12.5, img: 'f2_window', kb: [0.5, 0.5, 1.02, 0.5, 0.48, 1.16], fx: ['rain'] });
  cues.push(swell(12.5, 16, 52, 60, { h: 4, rate: 8, k: 'rain' }));
  thunder(15.2, 16.4, 88);
  sub(16.4, 1.8, 'cc_thunder');
  // the woman next to you...
  room(18.0, 'p_sneeze_ah', 'est', 58);
  room(19.5, 'p_sneeze', 'est', 88, 'sneeze');
  // running under one umbrella
  shots.push({ t: 21, img: 'f2_street', kb: [0.44, 0.5, 1.04, 0.56, 0.5, 1.12], fx: ['rain'] });
  cues.push(swell(21, 26, 60, 78, { h: 4.4, sag: 2, rate: 12, k: 'strings' }));
  sub(21.2, 2.4, 'cc_strings_love');
  // the station: the train covers everything
  shots.push({ t: 31, img: 'f2_station', kb: [0.5, 0.48, 1.03, 0.5, 0.5, 1.16], fx: ['steam'] });
  cues.push(bed(31, 38.8, 68, { k: 'train', fi: 0.8, fo: 2.2, lfo: { f: 2.2, m: 2.5 } }));
  cues.push(hit(32.2, 90, { h: 0.9, rate: 30, k: 'whistle' }));
  sub(31.2, 2, 'cc_train'); sub(32.2, 1.2, 'cc_whistle');
  say(35.2, 'f2_him_wait', 70);
  say(37.0, 'f2_her_always', 66);
  // the letters: seasons pass
  shots.push({ t: 40.5, img: 'f2_letters', kb: [0.5, 0.5, 1.02, 0.52, 0.52, 1.18], fx: ['dust'] });
  cues.push(bed(40.5, 54, 46, { k: 'rain', fi: 1.2 }));
  cues.push(bed(40.8, 54, 44, { k: 'piano', fi: 1.5 }));
  say(42.5, 'f2_her_letter', 55);
  say(47.4, 'f2_her_miss', 55);
  room(50.2, 'p_sneeze_ah', 'est', 58);
  room(51.8, 'p_sneeze', 'est', 90, 'sneeze');
  // the storm
  shots.push({ t: 54, img: 'f2_storm', kb: [0.5, 0.5, 1.03, 0.5, 0.46, 1.14], fx: ['rain', 'shake'] });
  cues.push(bed(54, 62.4, 64, { k: 'rain', fi: 0.8, fo: 1.6 }));
  thunder(54.8, 56.0, 92);
  thunder(58.6, 59.6, 93);
  sub(56.0, 2, 'cc_thunder');
  // years later, the same café. Almost nothing to hide behind.
  shots.push({ t: 62.5, img: 'f2_cafe', kb: [0.5, 0.5, 1.12, 0.5, 0.5, 1.2], fx: ['rain'] });
  cues.push(bed(62.5, 72.5, 42, { k: 'rain', fi: 1.4, fo: 0.4 }));
  shots.push({ t: 64.6, img: 'f2_cafe', kb: [0.64, 0.5, 1.56, 0.64, 0.5, 1.6] });
  say(65.0, 'f2_him_changed', 54);
  shots.push({ t: 68.0, img: 'f2_cafe', kb: [0.36, 0.5, 1.56, 0.36, 0.5, 1.6] });
  say(68.4, 'f2_her_you', 54);
  sub(69.8, 2.4, 'cc_silence');
  // the kiss
  shots.push({ t: 72.5, img: 'f2_kiss', kb: [0.5, 0.5, 1.2, 0.5, 0.48, 1.04], fx: ['rain', 'bloom'] });
  cues.push(swell(72.5, 75.5, 68, 86, { h: 5, sag: 3, rate: 10, k: 'strings' }));
  cues.push(bed(73.2, 75, 64, { k: 'aww', fi: 0.4, fo: 0.8 }));
  sub(72.6, 2.4, 'cc_strings_love'); sub(73.3, 1.6, 'cc_aww');
  // ...and one last "ah..."
  room(81.2, 'p_sneeze_ah', 'est', 56);
  room(83.6, 'p_sneeze_false', 'est', 54);
  shots.push({ t: 84.4, k: 'end' });
  cues.push(bed(84.4, 90, 46, { k: 'piano', fi: 0.6 }));
  return { dur: 90, cues, cc, shots, tele };
}
