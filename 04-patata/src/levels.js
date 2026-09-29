import { hashStr, mulberry32 } from './util.js';
import { behaviour, isHuman, PEOPLE } from './people.js';

// Six pages of the García family album. Frames follow Barnes & Svenson (CSIRO): with fewer than
// twenty people, divide by three in good light and by two in poor light to know how many photos
// you need so that, statistically, one of them has nobody blinking. Patience is two calls more.
export const EVENTS = [
  {
    id: 'comunion', star: 'abuela', n: 1, date: [1996, 5, 12], light: 'good', bg: 'comunion', amb: 'church',
    cast: ['abuela', 'mama', 'lucia', 'papa'],
    rows: { h: [['abuela', 'mama', 'lucia', 'papa']], v: [['mama', 'papa'], ['abuela', 'lucia']] },
    chat: ['c_vestido', 'c_donde', 'c_barriga', 'c_bajita'],
  },
  {
    id: 'patio', star: 'abuelo', n: 2, date: [1997, 7, 19], light: 'good', bg: 'patio', amb: 'patio',
    cast: ['paco', 'mama', 'papa', 'abuela', 'abuelo', 'lucia'],
    rows: { h: [['paco', 'mama', 'papa'], ['abuela', 'abuelo', 'lucia']], v: [['paco', 'mama', 'papa'], ['abuela', 'abuelo', 'lucia']] },
    chat: ['c_gafas', 'c_ojos', 'c_barriga', 'c_donde', 'c_bajita'],
  },
  {
    id: 'playa', star: 'paco', n: 3, date: [1998, 8, 22], light: 'good', bg: 'playa', amb: 'sea', sun: true,
    cast: ['paco', 'mama', 'toni', 'mari', 'papa', 'abuela', 'lucia', 'abuelo'],
    rows: {
      h: [['paco', 'mama', 'toni', 'mari', 'papa'], ['abuela', 'lucia', 'abuelo']],
      v: [['papa', 'toni', 'mari', 'mama'], ['paco', 'abuela', 'lucia', 'abuelo']],
    },
    chat: ['c_pelo', 'c_calor', 'c_arena', 'c_pajarito', 'c_ojos', 'c_vestido'],
  },
  {
    id: 'salon', star: 'you', n: 4, date: [1999, 12, 24], light: 'poor', bg: 'salon', amb: 'home', flash: true, timer: true,
    cast: ['paco', 'encarna', 'papa', 'mama', 'mari', 'abuela', 'lucia', 'abuelo', 'you'],
    rows: {
      h: [['paco', 'encarna', 'papa', 'mama', 'mari'], ['abuela', 'lucia', 'abuelo', 'you']],
      v: [['paco', 'encarna', 'papa'], ['mama', 'mari', 'abuela'], ['lucia', 'abuelo', 'you']],
    },
    chat: ['c_turron', 'c_gafas', 'c_ojos', 'c_barriga', 'c_donde'],
    variant: { abuelo: { beh: { drowsy: 2.2 } } },
  },
  {
    id: 'bautizo', star: 'dani', n: 5, date: [2000, 5, 14], light: 'good', bg: 'bautizo', amb: 'garden',
    cast: ['paco', 'encarna', 'toni', 'mari', 'dani', 'papa', 'mama', 'lucia', 'abuela', 'abuelo', 'kiko'],
    rows: {
      h: [['paco', 'encarna', 'papa', 'mama', 'toni'], ['abuela', 'lucia', 'mari', 'kiko', 'abuelo']],
      v: [['paco', 'encarna', 'papa'], ['toni', 'mama', 'abuelo'], ['lucia', 'mari', 'kiko', 'abuela']],
    },
    held: { dani: 'mari' },
    chat: ['c_nino', 'c_tarta', 'c_pelo', 'c_ojos', 'c_donde'],
    variant: { toni: { beh: { talker: true } }, kiko: { beh: { pigeons: false } } },
  },
  {
    id: 'plaza', star: 'lucia', n: 6, date: [2001, 8, 15], light: 'poor', bg: 'plaza', amb: 'fiesta', flash: true, pigeons: true,
    cast: ['paco', 'encarna', 'toni', 'mari', 'dani', 'papa', 'mama', 'raul', 'lucia', 'abuela', 'abuelo', 'kiko', 'bolita'],
    rows: {
      h: [['paco', 'encarna', 'toni', 'papa', 'mama', 'abuelo'], ['lucia', 'raul', 'abuela', 'mari', 'kiko']],
      v: [['paco', 'encarna', 'papa', 'mama'], ['toni', 'lucia', 'abuelo'], ['raul', 'abuela', 'mari', 'kiko']],
    },
    held: { dani: 'mari', bolita: 'raul' },
    chat: ['c_movil', 'c_perro', 'c_calor', 'c_tarta', 'c_ojos', 'c_pajarito'],
    variant: {
      toni: { beh: { talker: true } }, dani: { kind: 'toddler' },
      lucia: { kind: 'teen', beh: { phone: true, hold: 2.4 } }, abuelo: { beh: { drowsy: 2.8 } },
    },
  },
];

export const humans = (ev) => ev.cast.filter((id) => isHuman(id, (ev.variant || {})[id])).length;
export const framesFor = (ev) => Math.ceil(humans(ev) / (ev.light === 'good' ? 3 : 2));
export const patienceFor = (ev) => framesFor(ev) + 2;
export const beh = (ev, id) => behaviour(id, (ev.variant || {})[id]);
export const voiced = (ev, id) => PEOPLE[id].voice;
export const seedFor = (ev, n = 0) => hashStr(ev.id + ':' + n);
export const rngFor = (ev, n = 0) => mulberry32(seedFor(ev, n));
