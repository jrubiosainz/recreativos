// The six rides. The pane is 12 × 21 cm (y down, the seal at the bottom is the finish).
//   cands   the drops the kids can call, [x, y, r] in cm; the rivals call first and they always go for the fat ones
//   rivals  who's on the seat next to you: which candidate they want and when they shout «¡me pido esa!»
//   food    the stray beads scattered over the glass (the lanes' reason to bend)
//   fog     max: how thick it gets · regen: how fast a wipe fogs over again (1/s) · lane: how long a wipe stays wet (s)
//   nuc     new beads a second condensing out of thick fog
//   bus     the ride, in race seconds: ['go', t, cruise m/s, accel m/s²] · ['brake', t, to m/s, decel m/s²] ·
//           ['doors', t, open s] · ['bump', t, count, kick in g] · ['cobbles', t, s, kick in g]
//   stop    your stop: the race has to be over by then
//   margin  how far (cm) the nearest rival must still be from the seal for the second star
//   stickers walls on the glass (fog can't form on them); scratches grip hard; heater: the dry band over the vent (cm)
export const KIDS = ['dani', 'lucia', 'iker', 'vega'];

export const LEVELS = [
  {
    id: 'linea27', n: 1, name: { es: 'LÍNEA 27', en: 'ROUTE 27' }, clock: '7:42', stop: 60, margin: 4,
    teach: ['call', 'wipe', 'lift', 'eat'],
    cands: [[3.2, 3.1, 0.31], [6.4, 2.5, 0.27], [9.3, 3.5, 0.28]],
    rivals: [{ kid: 'dani', cand: 0, at: 1.4 }],
    food: { n: 14, r: [0.11, 0.24], top: 5.5 },
    fog: { max: 0.85, regen: 0.16, lane: 6 }, nuc: 0.3,
    bus: [['go', 0.4, 6, 1.0], ['bump', 9, 2, 0.3], ['brake', 17, 0, 1.3], ['doors', 22, 3.5], ['go', 26, 7, 1.1],
      ['bump', 34, 1, 0.35], ['brake', 42, 0, 1.3], ['doors', 47, 3], ['go', 51, 6, 1.0]],
  },
  {
    id: 'horapunta', n: 2, name: { es: 'HORA PUNTA', en: 'RUSH HOUR' }, clock: '8:15', stop: 58, margin: 3.5,
    teach: ['regrow', 'doors'], grow: 1.3,
    cands: [[2.4, 3.4, 0.3], [5.1, 2.5, 0.315], [7.8, 3.1, 0.27], [10.1, 2.8, 0.28]],
    rivals: [{ kid: 'lucia', cand: 1, at: 1.2 }, { kid: 'dani', cand: 0, at: 2.3 }],
    food: { n: 18, r: [0.11, 0.25], top: 5.5 },
    fog: { max: 1, regen: 0.34, lane: 4.5 }, nuc: 0.9,
    bus: [['go', 0.3, 5, 1.2], ['brake', 7, 0, 1.5], ['doors', 10.5, 4], ['go', 15, 5.5, 1.3], ['brake', 23, 0, 1.6],
      ['doors', 27, 4.5], ['go', 32, 6, 1.2], ['bump', 38, 2, 0.3], ['brake', 43, 0, 1.5], ['doors', 47, 5]],
  },
  {
    id: 'frenazos', n: 3, name: { es: 'FRENAZOS', en: 'SLAM THE BRAKES' }, clock: '13:05', stop: 55, margin: 3.5,
    teach: ['brake', 'big'],
    cands: [[2.6, 3, 0.32], [6, 2.4, 0.3], [8.4, 3.4, 0.27], [10.2, 2.6, 0.28], [7.3, 4.6, 0.22]],
    rivals: [{ kid: 'iker', cand: 4, at: 1.1 }, { kid: 'lucia', cand: 1, at: 2.2 }, { kid: 'dani', cand: 0, at: 3.0 }],
    food: { n: 16, r: [0.11, 0.25], top: 5.5 },
    fog: { max: 0.9, regen: 0.2, lane: 5 }, nuc: 0.5,
    bus: [['go', 0.3, 9, 1.8], ['brake', 6, 3, 4.2], ['go', 8, 10, 1.9], ['brake', 14.5, 0, 4.5], ['doors', 17, 3],
      ['go', 20.5, 9, 2.0], ['brake', 26, 2, 4.4], ['go', 28, 10, 1.9], ['bump', 31, 2, 0.35], ['brake', 36, 0, 4.6],
      ['doors', 38.5, 3], ['go', 42, 9, 1.9], ['brake', 48, 4, 4.3], ['go', 50, 9, 1.8]],
  },
  {
    id: 'adoquines', n: 4, name: { es: 'ADOQUINES', en: 'COBBLESTONES' }, clock: '17:30', stop: 55, margin: 3,
    teach: ['sticker', 'cobbles'],
    cands: [[1.9, 3.2, 0.31], [4.4, 2.4, 0.33], [7, 3.3, 0.3], [9, 2.5, 0.27], [10.6, 3.6, 0.28]],
    rivals: [{ kid: 'vega', cand: 1, at: 1.0 }, { kid: 'dani', cand: 0, at: 1.9 }, { kid: 'iker', cand: 2, at: 2.8 }],
    food: { n: 18, r: [0.11, 0.25], top: 5.5 },
    fog: { max: 0.88, regen: 0.2, lane: 5 }, nuc: 0.5,
    stickers: [
      { k: 'rect', x: 6.9, y: 8.2, w: 3.3, h: 1.6, art: 'noapoyarse' },
      { k: 'circ', x: 3.6, y: 11.8, w: 2.2, h: 2.2, art: 'reservado' },
      { k: 'rect', x: 6.2, y: 15.2, w: 2.8, h: 1.1, art: 'salida' },
    ],
    bus: [['go', 0.3, 6, 1.2], ['cobbles', 3, 9, 0.45], ['brake', 14, 0, 1.6], ['doors', 17, 3], ['go', 20.5, 7, 1.3],
      ['cobbles', 23, 10, 0.5], ['bump', 34, 2, 0.4], ['brake', 38, 0, 1.7], ['doors', 41, 3], ['go', 44.5, 6, 1.2],
      ['cobbles', 46, 9, 0.45]],
  },
  {
    id: 'calefaccion', n: 5, name: { es: 'CALEFACCIÓN', en: 'HEATER ON' }, clock: '19:50', stop: 55, margin: 3,
    teach: ['heater', 'scratch'], heater: 4.2,
    cands: [[2.2, 2.6, 0.32], [4.8, 3.3, 0.27], [7.3, 2.4, 0.315], [9.4, 3.2, 0.27], [10.8, 2.3, 0.28], [8.3, 4.4, 0.22]],
    rivals: [{ kid: 'lucia', cand: 0, at: 1.1 }, { kid: 'iker', cand: 5, at: 2.0 }, { kid: 'vega', cand: 2, at: 3.0 }],
    food: { n: 18, r: [0.11, 0.26], top: 5.5 },
    fog: { max: 0.92, regen: 0.22, lane: 4.5 }, nuc: 0.6,
    scratches: [[1.2, 9.4, 6.4, 10.3], [6.8, 6.8, 10.9, 7.6], [4.5, 13.2, 9.6, 12.4]],
    bus: [['go', 0.3, 7, 1.3], ['bump', 7, 2, 0.35], ['brake', 13, 0, 1.8], ['doors', 16, 3.5], ['go', 20, 8, 1.4],
      ['brake', 28, 2, 3.6], ['go', 30, 8, 1.5], ['bump', 36, 1, 0.4], ['brake', 41, 0, 1.7], ['doors', 44, 3.5],
      ['go', 48, 7, 1.3]],
  },
  {
    id: 'buho', n: 6, name: { es: 'BÚHO', en: 'NIGHT OWL' }, clock: '2:17', stop: 60, margin: 2, night: true,
    teach: ['night'], heater: 3.2, grow: 1.15,
    cands: [[1.8, 3, 0.27], [3.9, 2.3, 0.31], [6, 3.4, 0.3], [8, 2.5, 0.3], [9.8, 3.3, 0.27], [11, 2.2, 0.28], [8.9, 4.5, 0.22]],
    rivals: [{ kid: 'vega', cand: 1, at: 0.9 }, { kid: 'iker', cand: 6, at: 1.7 }, { kid: 'dani', cand: 3, at: 2.5 },
      { kid: 'lucia', cand: 2, at: 3.3 }],
    food: { n: 20, r: [0.11, 0.26], top: 5.5 },
    fog: { max: 0.95, regen: 0.26, lane: 4.5 }, nuc: 0.7,
    stickers: [{ k: 'rect', x: 6.6, y: 9.4, w: 3.4, h: 1.5, art: 'noapoyarse' }, { k: 'circ', x: 1.6, y: 13.2, w: 2, h: 2, art: 'reservado' }],
    scratches: [[7.4, 14.2, 11.2, 15.1]],
    bus: [['go', 0.3, 11, 2.0], ['cobbles', 4, 6, 0.4], ['brake', 11, 4, 4.4], ['go', 13, 12, 2.0], ['bump', 17, 3, 0.4],
      ['brake', 22, 0, 4.6], ['doors', 24.5, 2.5], ['go', 27.5, 11, 2.1], ['cobbles', 30, 7, 0.5], ['brake', 38, 3, 4.5],
      ['go', 40, 12, 2.0], ['bump', 45, 2, 0.45], ['brake', 50, 0, 4.4], ['doors', 53, 3]],
  },
];
