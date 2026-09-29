// The six rooms, a Spanish flat in cross-section. Heights are in cm above the room's floor; the sim works y-down
// with the floor's top at y = H. Solids are [x, y, w, h, tag]; the tag tells the renderer what to draw and the sim
// what's special ('boxfloor' is where a cat sits, 'hob' melts butter). Things along the back wall (cupboards,
// pictures, windows) are scenery in `decor`: the cat flies in front of them.
//   objects   loose things: k, x, surface height (cm), r, m, fragile, tempt (the one to knock off: ★)
//   route     the autopilot's flight plan: [x, 'go' | 'pass' | 'climb' | 'sit', …]
const ROOM = (W, H) => [[-60, -60, W + 120, 60, 'ceil'], [-60, H, W + 120, 80, 'floor'], [-60, -60, 60, H + 140, 'wall'], [W, -60, 60, H + 140, 'wall']];

export function build(def) {
  const { W, H } = def, S = def.room === false ? [] : ROOM(W, H), y = (cm) => H - cm;
  const water = [], decor = def.decor || [];
  let box = null;
  const P = {
    block: (x, w, top, tag, base = 0) => S.push([x, y(top), w, top - base, tag]),
    slab: (x, w, top, tag, th = 4) => S.push([x, y(top), w, th, tag]),
    table: (x, w, top, tag = 'table') => { S.push([x, y(top), w, 4, tag]); S.push([x + 4, y(top) + 4, 5, top - 4, tag + 'leg']); S.push([x + w - 9, y(top) + 4, 5, top - 4, tag + 'leg']); },
    water: (x, w, top, bottom) => water.push([x, y(top), w, top - bottom]),
    box: (x, base = 0) => { S.push([x, y(base) - 2, 60, 2, 'boxfloor']); S.push([x, y(base) - 40, 3, 38, 'box']); S.push([x + 57, y(base) - 40, 3, 38, 'box']); box = [x, y(base) - 2]; },
  };
  def.make(P);
  const objects = (def.objects || []).map((o) => ({ ...o, y: y(o.on) }));
  return {
    ...def, solids: S, water, decor, box, objects,
    start: [def.start[0], y(def.start[1])],
    cucumbers: (def.cucumbers || []).map(([x, on]) => [x, y(on)]),
    hobs: (def.hobs || []).map(([a, b, on]) => [a, b, y(on)]),
    fans: (def.fans || []).map(([x, at, r]) => [x, y(at), r]),
    dogs: (def.dogs || []).map(([a, b, x]) => [a, b, H, x]),
  };
}

export const LEVELS = [
  build({
    id: 'desayuno', n: 1, name: { es: 'EL DESAYUNO', en: 'BREAKFAST' }, W: 760, H: 250, start: [80, 70], par: 0.8,
    teach: ['turn', 'move', 'stop', 'tempt', 'sit'],
    make: (P) => { P.block(170, 80, 45, 'bench'); P.table(300, 170, 76); P.box(620); },
    objects: [{ k: 'milk', x: 442, on: 76, r: 5, m: 0.3, fragile: true, tempt: true }, { k: 'fruit', x: 352, on: 76, r: 9, m: 1.2 }],
    decor: [['window', 60, 150, 90, 100], ['clock', 540, 200], ['calendar', 260, 190], ['shelf', 500, 175, 90]],
    route: [[215, 'go'], [340, 'go'], [452, 'go', { v: 140 }], [650, 'sit']],
  }),
  build({
    id: 'nevera', n: 2, name: { es: 'LA NEVERA', en: 'THE FRIDGE' }, W: 820, H: 280, start: [70, 70], par: 0.7,
    teach: ['climb', 'water', 'hob'],
    make: (P) => {
      P.block(150, 36, 60, 'stool');
      P.block(230, 130, 90, 'counter'); P.block(360, 70, 66, 'sink'); P.water(360, 70, 86, 66);
      P.block(430, 20, 90, 'counter'); P.block(450, 70, 90, 'hob'); P.block(520, 60, 90, 'counter');
      P.block(528, 48, 122, 'micro', 90); P.block(600, 84, 180, 'fridge'); P.box(612, 180);
    },
    hobs: [[450, 520, 90]],
    objects: [{ k: 'oil', x: 250, on: 90, r: 5, m: 0.5, fragile: true, tempt: true }, { k: 'mug', x: 300, on: 90, r: 6, m: 0.35, fragile: true }],
    decor: [['cabinets', 230, 175, 350, 70], ['tiles', 230, 90, 350, 85], ['window', 60, 150, 70, 95], ['magnets', 610, 120]],
    route: [[120, 'go'], [120, 'climb', { c: 0.55 }], [245, 'go', { v: 90 }], [300, 'go'], [345, 'go', { v: 60 }], [345, 'climb', { c: 0.5 }], [450, 'pass', { v: 190 }], [515, 'go'], [515, 'climb', { c: 0.55 }], [640, 'go'], [642, 'sit']],
  }),
  build({
    id: 'salon', n: 3, name: { es: 'EL SALÓN', en: 'THE LIVING ROOM' }, W: 940, H: 260, start: [70, 70], par: 0.65,
    teach: ['cucumber', 'lamp'],
    make: (P) => {
      P.block(300, 190, 42, 'sofa'); P.block(300, 22, 62, 'arm'); P.block(468, 22, 62, 'arm');
      P.table(560, 110, 40, 'ctable'); P.block(720, 110, 55, 'tvstand'); P.block(742, 64, 105, 'tv', 55);
      P.block(612, 16, 260, 'lamp', 165); P.box(862);
    },
    cucumbers: [[228, 0]],
    objects: [{ k: 'vase', x: 820, on: 55, r: 7, m: 0.6, fragile: true, tempt: true }, { k: 'remote', x: 600, on: 40, r: 4, m: 0.15 }, { k: 'mug', x: 640, on: 40, r: 6, m: 0.35, fragile: true }],
    decor: [['picture', 360, 175, 110, 70], ['window', 560, 150, 120, 100], ['plant', 250, 0], ['rug', 120, 0, 380]],
    route: [[140, 'go'], [150, 'climb', { c: 0.75 }], [300, 'pass', { v: 150 }], [385, 'go'], [520, 'go'], [690, 'go', { v: 130 }], [690, 'climb', { c: 0.45 }], [805, 'go', { v: 90 }], [893, 'sit']],
  }),
  build({
    id: 'pasillo', n: 4, name: { es: 'EL PASILLO', en: 'THE HALLWAY' }, W: 1150, H: 250, start: [70, 70], par: 0.6,
    teach: ['dog'],
    make: (P) => { P.block(140, 90, 45, 'shoes'); P.table(250, 120, 80, 'console'); P.block(700, 80, 62, 'radiator'); P.box(1040); },
    dogs: [[240, 960, 640]],
    objects: [{ k: 'keys', x: 352, on: 80, r: 4, m: 0.2, tempt: true }, { k: 'bowl', x: 282, on: 80, r: 7, m: 0.5, fragile: true }],
    decor: [['door', 20, 0, 90, 210], ['mirror', 280, 150, 60, 80], ['coats', 480, 190], ['door', 1060, 0, 90, 210], ['lamp', 800, 250]],
    route: [[110, 'go'], [195, 'go'], [300, 'go'], [345, 'go', { v: 50 }], [335, 'wait', { dog: 1 }], [655, 'go', { v: 230 }], [655, 'climb', { c: 0.45 }], [900, 'go', { v: 200 }], [1070, 'sit']],
  }),
  build({
    id: 'bano', n: 5, name: { es: 'EL BAÑO', en: 'THE BATHROOM' }, W: 820, H: 250, start: [50, 70], par: 0.55,
    teach: ['tub'],
    make: (P) => {
      P.block(80, 60, 42, 'toilet');
      P.block(250, 12, 55, 'tub'); P.block(262, 206, 12, 'tubbase'); P.block(468, 12, 55, 'tub'); P.water(262, 206, 40, 12);
      P.block(350, 30, 50, 'bathstool', 12); P.block(480, 64, 85, 'washer'); P.box(700);
    },
    objects: [{ k: 'roll', x: 128, on: 42, r: 6, m: 0.15, tempt: true }, { k: 'duck', x: 420, on: 40, r: 5, m: 0.05 }, { k: 'bottle', x: 530, on: 85, r: 5, m: 0.4, fragile: true }],
    decor: [['tiles', 0, 0, 820, 120], ['cistern', 80, 42], ['mirror', 600, 140, 70, 70], ['towel', 470, 150], ['window', 300, 160, 90, 60]],
    route: [[105, 'go'], [118, 'go', { v: 45 }], [190, 'go'], [205, 'climb', { c: 0.7 }], [470, 'pass', { v: 240 }], [515, 'go'], [730, 'sit']],
  }),
  build({
    id: 'terraza', n: 6, name: { es: 'LA TERRAZA', en: 'THE BALCONY' }, W: 1250, H: 250, start: [70, 70], par: 0.5, night: true, fallY: 900,
    teach: ['wind', 'gap'], room: false,
    make: (P) => {
      P.block(-60, 490, 0, 'balcony', -40); P.block(-60, 60, 400, 'wall'); P.block(280, 60, 60, 'planter'); P.block(412, 12, 100, 'rail');
      P.slab(470, 190, -70, 'awning', 6);
      P.block(700, 610, -110, 'nbalcony', -150); P.block(700, 12, -10, 'rail', -110); P.block(1250, 60, 400, 'wall', -150);
      P.box(1130, -110);
    },
    gusts: [[6, 1.6, 170], [11, 1.8, -200], [16, 1.6, 220], [21, 1.8, -180], [26, 1.6, 200], [31, 1.8, -200], [36, 1.6, 200], [41, 1.8, -200]],
    objects: [{ k: 'gnome', x: 1060, on: -110, r: 8, m: 0.8, fragile: true, tempt: true }, { k: 'pot', x: 300, on: 60, r: 7, m: 0.7, fragile: true }],
    decor: [['moon', 900, 380], ['lights', 0, 0], ['door', 20, 0, 90, 210], ['ndoor', 1180, -110, 70, 200], ['clothes', 480, 230, 260]],
    route: [[250, 'go'], [250, 'climb', { c: 0.5 }], [330, 'go', { v: 80 }], [330, 'climb', { c: 0.7 }], [520, 'pass', { v: 190 }], [620, 'go'], [620, 'climb', { c: 0.9 }], [760, 'pass', { v: 200 }], [1000, 'go'], [1040, 'go', { v: 90 }], [1160, 'sit']],
  }),
];
export const N = LEVELS.length;
