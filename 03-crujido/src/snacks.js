// What you eat and who sits around you.
// A snack is its noise pattern: the level (dB at 1 m) of every crunch from the first bite to the
// last chew. Chews get quieter as the mouthful breaks down; resting lets saliva soften the rest.
export const SNACKS = {
  palomitas: { id: 'palomitas', pattern: [62, 59, 56, 53], soak: 2, soakMax: 8, color: '#ffe7a3' },
  nachos: { id: 'nachos', pattern: [72, 68, 64, 60], soak: 2.5, soakMax: 10, color: '#f2b23a' },
  patatas: { id: 'patatas', pattern: [76, 71, 66, 61], soak: 2.5, soakMax: 10, fetch: 57, color: '#f6cf52' },
  caramelo: { id: 'caramelo', pattern: [67, 67, 67, 67], soak: 0, soakMax: 0, wrap: true, color: '#e8413c' },
  kikos: { id: 'kikos', pattern: [74, 71, 68, 65, 62], soak: 1.5, soakMax: 6, color: '#d9892b' },
  hielo: { id: 'hielo', pattern: [82, 77, 72, 67], soak: 3, soakMax: 12, color: '#bfe6ff' },
};

// Listener kinds. sens shifts the hearing threshold (negative hears more), gain scales how much
// a heard crunch annoys them.
export const KINDS = {
  normal: { sens: 0, gain: 1 },
  cinefilo: { sens: -5, gain: 1.25 },          // hears everything, forgives nothing
  pareja: { sens: 10, gain: 0.6 },             // busy with each other
  roncador: { sens: 0, gain: 1, sleeps: true }, // asleep: only a loud crunch wakes him, and then the snoring stops
  miedica: { sens: 3, gain: 0.8 },             // your friend: too busy covering her eyes, screams at every scare
  estornudo: { sens: 0, gain: 1 },             // fighting a sneeze all film long
  fan: { sens: -2, gain: 1.1, sulks: true },   // whistles along with every number, unless you annoy him
  abuelo: { sens: 2, gain: 1, aid: true },     // turns his hearing aid up each time he catches you
  critico: { sens: -6, gain: 1.3 },            // takes notes
  director: { sens: -9, gain: 1.6, fast: true },// it's his film
  nino: { sens: -3, gain: 0.8 },               // children hear everything, and tell their mum
};

// Seat geometry: rows 0.95 m apart, seats 0.55 m wide. You sit at (0, 0) facing +z.
export const ROW = 0.95, SEAT = 0.55;
export const seat = (row, col) => ({ x: col * SEAT, z: row * ROW });
