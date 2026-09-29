// UN SOLO VIAJE: what you bought and the way up. Every bag is a real weight; every trip is a route
// of rooms (the street, the portal, the lobby, the lift, the stairs, your landing, your flat), and
// every room is a list of steps the simulation walks through: walk so many metres, open this door
// with a hand on this side, wait for the lift. The renderer draws the same rooms.

// kg are what these things weigh in a Spanish supermarket bag (packaging included)
export const BAG = {
  agua: { kg: 9.3, fragile: false, look: 'agua', es: 'Agua, 6 × 1,5 l', en: 'Water, 6 × 1.5 l' },
  leche: { kg: 6.4, fragile: false, look: 'leche', es: 'Leche, 6 bricks', en: 'Milk, 6 cartons' },
  huevos: { kg: 1.3, fragile: true, look: 'huevos', es: 'Huevos y pan', en: 'Eggs and bread' },
  fruta: { kg: 3.4, fragile: false, look: 'fruta', es: 'Naranjas y manzanas', en: 'Oranges and apples' },
  verdura: { kg: 2.2, fragile: false, look: 'verdura', es: 'Puerros y tomates', en: 'Leeks and tomatoes' },
  limpieza: { kg: 4.8, fragile: false, look: 'limpieza', es: 'Detergente', en: 'Washing liquid' },
  botellas: { kg: 3.6, fragile: true, look: 'botellas', es: 'Vino y aceite', en: 'Wine and olive oil' },
  latas: { kg: 3.9, fragile: false, look: 'latas', es: 'Latas y garbanzos', en: 'Tins and chickpeas' },
  papel: { kg: 1.4, fragile: false, look: 'papel', es: 'Papel higiénico', en: 'Toilet roll' },
  carne: { kg: 2.7, fragile: false, look: 'carne', es: 'Pollo y filetes', en: 'Chicken and steaks' },
  congelados: { kg: 2.5, fragile: false, look: 'congelados', es: 'Congelados', en: 'Frozen food' },
  pavo: { kg: 6.2, fragile: false, look: 'pavo', es: 'Pavo', en: 'Turkey' },
  cava: { kg: 3.3, fragile: true, look: 'cava', es: 'Cava', en: 'Cava' },
  turron: { kg: 1.6, fragile: false, look: 'turron', es: 'Turrón y polvorones', en: 'Turrón and polvorones' },
};

const W = (m, o = {}) => ({ k: 'walk', len: m, ...o });
const A = (type, side, what) => ({ k: 'act', type, side, what });
const WAIT = (what, T, o = {}) => ({ k: 'wait', what, T, ...o });
const LOAD = { k: 'load' }, END = { k: 'end' };
export const FLIGHT = 3.2;   // metres along one flight of eleven steps

// one storey of a staircase: a flight, the half landing, a flight, the landing with its light switch
const storey = (n, side, extra = []) => [
  { kind: 'flight', floor: n - 0.5, lit: 'timer', steps: [W(FLIGHT, { stairs: true })] },
  { kind: 'half', floor: n - 0.5, lit: 'timer', steps: [W(1.2)] },
  { kind: 'flight', floor: n, lit: 'timer', steps: [W(FLIGHT, { stairs: true })] },
  { kind: 'landing', floor: n, lit: 'timer', steps: [W(1.8), A('switch', side, 'light'), ...extra] },
];

export const LEVELS = [
  {
    id: 'bajo', n: 1, floor: 0, door: 'B', par: 26, light: 0,
    bags: ['leche', 'fruta', 'verdura'],
    rooms: [
      { kind: 'trunk', floor: 0, steps: [LOAD, A('trunk', null, 'trunk')] },
      { kind: 'street', floor: 0, steps: [W(8), A('keys', 'R', 'portal'), A('push', null, 'portal')] },
      { kind: 'lobby', floor: 0, steps: [W(6), A('keys', 'R', 'door'), A('push', null, 'door')] },
      { kind: 'home', floor: 0, steps: [W(4), END] },
    ],
  },
  {
    id: 'primero', n: 2, floor: 1, door: 'A', par: 43, light: 30,
    bags: ['agua', 'huevos', 'fruta', 'latas', 'verdura'],
    rooms: [
      { kind: 'trunk', floor: 0, steps: [LOAD, A('trunk', null, 'trunk')] },
      { kind: 'street', floor: 0, steps: [W(8), A('keys', 'R', 'portal'), A('push', null, 'portal')] },
      { kind: 'lobby', floor: 0, lit: 'timer', stairs: 'R', steps: [W(1.2), A('switch', 'L', 'light'), W(4)] },
      ...storey(1, 'R').slice(0, 3),
      { kind: 'landing', floor: 1, lit: 'timer', steps: [W(2.4), A('keys2', 'R', 'door'), A('push', null, 'door')] },
      { kind: 'home', floor: 1, steps: [W(4), END] },
    ],
  },
  {
    id: 'quinto', n: 3, floor: 5, door: 'C', par: 52, light: 0,
    bags: ['leche', 'huevos', 'limpieza', 'carne', 'papel', 'fruta'],
    rooms: [
      { kind: 'trunk', floor: 0, steps: [LOAD, A('trunk', null, 'trunk')] },
      { kind: 'street', floor: 0, steps: [W(7), A('keys', 'R', 'portal'), A('push', null, 'portal')] },
      { kind: 'lobby', floor: 0, lift: 'auto', steps: [W(6), A('button', 'L', 'call'), WAIT('arrive', 6, { door: 'auto', win: 5 })] },
      { kind: 'cabin', floor: 0, lift: 'auto', to: 5, steps: [W(1.2), A('button', 'R', 'floor'), WAIT('ride', 7)] },
      { kind: 'landing', floor: 5, steps: [W(3), A('keys', 'R', 'door'), A('push', null, 'door')] },
      { kind: 'home', floor: 5, steps: [W(4), END] },
    ],
  },
  {
    id: 'tercero', n: 4, floor: 3, door: 'D', par: 96, light: 22, broken: true,
    bags: ['agua', 'botellas', 'latas', 'verdura', 'carne', 'huevos', 'papel'],
    rooms: [
      { kind: 'trunk', floor: 0, steps: [LOAD, A('trunk', null, 'trunk')] },
      { kind: 'street', floor: 0, steps: [W(8), A('keys', 'R', 'portal'), A('pull', 'R', 'portal')] },
      { kind: 'lobby', floor: 0, lit: 'timer', lift: 'broken', stairs: 'R', steps: [W(1.2), A('switch', 'R', 'light'), W(5)] },
      ...storey(1, 'L'),
      ...storey(2, 'L', [WAIT('chat', 7, { who: 'vecina' })]),
      ...storey(3, 'L').slice(0, 3),
      { kind: 'landing', floor: 3, lit: 'timer', steps: [W(2.4), A('keys2', 'L', 'door'), A('push', null, 'door')] },
      { kind: 'home', floor: 3, steps: [W(4), END] },
    ],
  },
  {
    id: 'mes', n: 5, floor: 6, door: 'B', par: 114, light: 0,
    bags: ['agua', 'leche', 'limpieza', 'latas', 'botellas', 'fruta', 'congelados', 'huevos', 'papel'],
    rooms: [
      { kind: 'trunk', floor: 0, steps: [LOAD, A('trunk', null, 'trunk')] },
      { kind: 'street', floor: 0, steps: [W(8), A('keys', 'R', 'portal'), A('push', null, 'portal')] },
      { kind: 'lobby', floor: 0, lift: 'old', steps: [W(6), A('button', 'L', 'call'), WAIT('arrive', 10, { door: 'manual' }), A('pull', 'R', 'liftdoor'), A('pull', 'L', 'reja')] },
      { kind: 'cabin', floor: 0, lift: 'old', to: 6, steps: [W(1.0), A('button', 'R', 'floor'), WAIT('ride', 12), A('push', null, 'reja'), A('push', null, 'liftdoor')] },
      { kind: 'landing', floor: 6, steps: [W(3), A('keys2', 'R', 'door'), A('push', null, 'door')] },
      { kind: 'home', floor: 6, steps: [W(5), END] },
    ],
  },
  {
    // her building, so no keys: the entryphone buzzes the portal open for a moment, and she opens her own door
    id: 'nochebuena', n: 6, floor: 2, door: 'A', par: 123, light: 18,
    bags: ['pavo', 'cava', 'agua', 'turron', 'botellas', 'fruta', 'huevos', 'verdura'],
    rooms: [
      { kind: 'trunk', floor: 0, steps: [LOAD, A('trunk', null, 'trunk')] },
      { kind: 'street', floor: 0, steps: [W(8), A('button', 'L', 'intercom'), WAIT('buzz', 4, { door: 'auto', win: 3, who: 'suegra' }), A('push', null, 'portal')] },
      { kind: 'lobby', floor: 0, lit: 'timer', lift: 'full', stairs: 'L', steps: [W(1.2), A('switch', 'R', 'light'), W(4)] },
      ...storey(1, 'L'),
      ...storey(2, 'L').slice(0, 3),
      { kind: 'landing', floor: 2, lit: 'timer', steps: [W(2.4), A('button', 'R', 'bell'), WAIT('open', 4, { who: 'suegra' }), WAIT('chat', 7, { who: 'suegra' })] },
      { kind: 'home', floor: 2, steps: [W(6), END] },
    ],
  },
];

export const totalKg = (lv) => lv.bags.reduce((s, k) => s + BAG[k].kg, 0);

// the whole trip as one list of steps, each tagged with its room and the metres walked before it
export function flatten(lv) {
  const out = [];
  let s = 0;
  lv.rooms.forEach((room, ri) => {
    for (const st of room.steps) {
      out.push({ ...st, room: ri, s0: s, lit: room.lit || null });
      if (st.k === 'walk') s += st.len;
    }
  });
  return { steps: out, len: s };
}
