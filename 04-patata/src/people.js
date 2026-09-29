// Who is in the García family, how each of them blinks, and what they are called.
// Behaviour, per person (seconds unless noted):
//   T      mean time between spontaneous blinks when relaxed (adults blink every ~4 s)
//   cap    how hard they hold a blink back while posing: the threshold becomes θ·(1 + cap·E)
//   bd     blink duration scale (a blink is 0.08 close + 0.05 shut + 0.17 open at bd = 1)
//   hold   how long they keep looking at the camera after the last «¡patata!», scaled by enthusiasm
//   react  how fast they turn to the camera when you call, [min, max]
//   lag    how late they start the word, [min, max]
// Flags: double (blinks twice), always (always blinks when the word ends), late (joins the chorus late),
// drowsy (lids droop the longer the pose lasts), baby, dog, talker, pigeons (watches birds), phone.

const BASE = { T: 4.0, cap: 1.0, bd: 1.0, hold: 5.0, react: [0.16, 0.4], lag: [0, 0.1] };

const KIND = {
  adult: {},
  kid: { T: 4.6, cap: 0.75, bd: 0.9, hold: 1.9, react: [0.12, 0.3], lag: [0, 0.06] },
  teen: { T: 3.8, cap: 0.6, hold: 2.3, react: [0.4, 0.75], lag: [0.05, 0.14] },
  elder: { T: 5.0, bd: 1.25, hold: 5.5, react: [0.3, 0.55] },
  baby: { T: 14, cap: 0.4, bd: 1.1, hold: 99, react: [0.3, 0.5], baby: true },
  toddler: { T: 9, cap: 0.3, bd: 0.9, hold: 1.5, react: [0.35, 0.6] },
  dog: { T: 12, cap: 0.5, bd: 0.8, hold: 2.6, react: [0.1, 0.25], dog: true },
};

export const PEOPLE = {
  lucia: { voice: true, kind: 'kid', name: { es: 'Lucía', en: 'Lucía' }, tag: { es: 'Lucía', en: 'Lucía' } },
  mama: { voice: true, kind: 'adult', beh: { T: 4.2 }, name: { es: 'Mamá', en: 'Mum' }, tag: { es: 'Mamá', en: 'Mum' } },
  papa: { voice: true, kind: 'adult', beh: { T: 3.7, cap: 0.9, hold: 4.6 }, name: { es: 'Papá', en: 'Dad' }, tag: { es: 'Papá', en: 'Dad' } },
  abuela: { voice: true, kind: 'elder', beh: { T: 5.6, bd: 1.45, hold: 6 }, name: { es: 'La abuela Rosario', en: 'Grandma Rosario' }, tag: { es: 'Abuela', en: 'Grandma' } },
  abuelo: { voice: true, kind: 'elder', beh: { T: 4.6, cap: 0.9, bd: 1.2, hold: 4.6, late: true, drowsy: 3.4 }, name: { es: 'El abuelo Antonio', en: 'Grandpa Antonio' }, tag: { es: 'Abuelo', en: 'Grandpa' } },
  paco: { voice: true, kind: 'adult', beh: { T: 1.9, cap: 0.3, hold: 6, double: true, always: true }, name: { es: 'El tío Paco', en: 'Uncle Paco' }, tag: { es: 'Tío Paco', en: 'Uncle Paco' } },
  mari: { voice: true, kind: 'adult', beh: { T: 3.4 }, name: { es: 'La tía Mari Carmen', en: 'Aunt Mari Carmen' }, tag: { es: 'Tía Mari', en: 'Aunt Mari' } },
  toni: { voice: true, kind: 'adult', beh: { T: 3.3 }, name: { es: 'Toni', en: 'Toni' }, tag: { es: 'Toni', en: 'Toni' } },
  encarna: { voice: true, kind: 'adult', beh: { T: 4.1, hold: 4.6 }, name: { es: 'La tía Encarna', en: 'Aunt Encarna' }, tag: { es: 'Tía Encarna', en: 'Aunt Encarna' } },
  raul: { voice: true, kind: 'teen', beh: { hold: 2.8 }, name: { es: 'El primo Raúl', en: 'Cousin Raúl' }, tag: { es: 'Raúl', en: 'Raúl' } },
  kiko: { voice: true, kind: 'kid', beh: { pigeons: true }, name: { es: 'El primo Kiko', en: 'Cousin Kiko' }, tag: { es: 'Kiko', en: 'Kiko' } },
  dani: { voice: false, kind: 'baby', name: { es: 'El bebé Dani', en: 'Baby Dani' }, tag: { es: 'Dani', en: 'Dani' } },
  bolita: { voice: false, kind: 'dog', beh: { pigeons: true }, name: { es: 'Bolita', en: 'Bolita' }, tag: { es: 'Bolita', en: 'Bolita' } },
  you: { voice: true, kind: 'adult', beh: { T: 4.0, hold: 4.4 }, name: { es: 'Yo', en: 'Me' }, tag: { es: '¡Yo!', en: 'Me!' } },
};

// The same person changes over five years: Lucía is a teenager with a phone by 2001, Dani learns to stay awake.
export function behaviour(id, variant = {}) {
  const p = PEOPLE[id];
  const kind = variant.kind || p.kind;
  return { ...BASE, ...KIND[kind], ...(p.beh || {}), ...(variant.beh || {}), kind };
}

export const isHuman = (id, variant = {}) => (variant.kind || PEOPLE[id].kind) !== 'dog';
