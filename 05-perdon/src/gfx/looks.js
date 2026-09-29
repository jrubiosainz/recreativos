// Who they are, to look at. Drawn from the seed each person carries, so a commuter looks the same in
// every frame and in the photo afterwards. The kinds dress for their parts: the one glued to the
// phone, the tourist with the suitcase, the granny and her shopping trolley, the runner.
import { mulberry32 } from '../util.js';
import { COATS, LEGS, SKIN, HAIR, SHOES, BAGS } from './paint.js';

const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const HAIR_F = ['bob', 'long', 'curly', 'bun', 'pony', 'curly', 'bob'];
const HAIR_M = ['short', 'side', 'curly', 'short', 'crop', 'side'];
const HOODS = ['#3b3d43', '#8f9297', '#7b2837', '#26356b', '#676842', '#b88e5e'];
const looks = new WeakMap();

export function lookOf(a) {
  let L = looks.get(a);
  if (!L) looks.set(a, (L = make(a.kind, a.look >>> 0)));
  return L;
}

export function make(kind, seed) {
  const r = mulberry32(seed ^ 0x9e3779b9);
  const old = kind === 'granny' || (kind === 'slow' && r() < 0.55) || r() < 0.08;
  const young = !old && (kind === 'group' || kind === 'groupCo' || kind === 'zombie' || kind === 'zombieCo' || kind === 'runner' || r() < 0.25);
  const fem = kind === 'granny' ? true : r() < 0.52;
  const L = {
    kind, fem, old, young,
    h: (fem ? 1.6 : 1.7) + r() * 0.16 - (old ? 0.05 : 0),
    w: 0.94 + r() * 0.16 + (old ? 0.04 : 0),
    skin: pick(r, SKIN),
    hair: old ? (r() < 0.6 ? HAIR[4] : HAIR[5]) : pick(r, HAIR.slice(0, 4)),
    style: old && !fem ? (r() < 0.55 ? 'bald' : 'side') : old && fem ? (r() < 0.6 ? 'bun' : 'curly') : fem ? pick(r, HAIR_F) : pick(r, HAIR_M),
    coat: pick(r, COATS), len: r() < 0.55 ? 'long' : r() < 0.6 ? 'mid' : 'short',
    legs: pick(r, LEGS), skirt: fem && !young && r() < 0.3,
    shoes: pick(r, SHOES),
    scarf: r() < 0.3 ? pick(r, ['#7b2837', '#26356b', '#b88e5e', '#8f9297', '#3452a3']) : null,
    collar: !fem && r() < 0.45 ? 'tie' : r() < 0.3 ? 'turtle' : 'open',
    tie: pick(r, ['#3452a3', '#7b2837', '#26356b']),
    glasses: r() < (old ? 0.55 : 0.16),
    beard: !fem && !young && r() < 0.18,
    bag: null, hat: null, props: {},
    lookSeed: seed,
  };
  const b = r();
  L.bag = b < 0.3 ? { t: 'brief', c: pick(r, BAGS.slice(0, 2)), side: r() < 0.5 ? -1 : 1 }
    : b < 0.58 ? { t: 'shoulder', c: pick(r, BAGS), side: r() < 0.5 ? -1 : 1 }
    : b < 0.75 ? { t: 'back', c: pick(r, BAGS), side: 1 }
    : b < 0.85 ? { t: 'tote', c: pick(r, ['#d6cab0', '#b88e5e', '#8f9297']), side: r() < 0.5 ? -1 : 1 } : null;
  if (young) {
    L.len = r() < 0.6 ? 'short' : 'mid';
    if (r() < 0.55) { L.coat = pick(r, HOODS); L.hood = true; L.collar = 'open'; }
    L.legs = pick(r, [LEGS[2], LEGS[1], LEGS[3]]);
    if (r() < 0.5) L.bag = { t: 'back', c: pick(r, BAGS), side: 1 };
    L.shoes = r() < 0.5 ? '#e9e7e1' : L.shoes;
  }
  switch (kind) {
    case 'zombie': case 'zombieCo': L.props.phone = true; L.props.buds = r() < 0.5; if (L.bag?.t === 'brief') L.bag = null; break;
    case 'tourist':
      L.hat = r() < 0.6 ? 'sun' : 'cap'; L.coat = pick(r, ['#d6cab0', '#676842', '#b88e5e', '#8f9297']); L.len = 'short';
      L.legs = pick(r, ['#b88e5e', '#33476f', '#676842']); L.bag = { t: 'back', c: pick(r, BAGS), side: 1 }; L.props.suitcase = pick(r, ['#7b2837', '#3452a3', '#3b3d43', '#676842']);
      L.collar = 'open'; L.scarf = null;
      break;
    case 'granny':
      L.style = r() < 0.7 ? 'bun' : 'curly'; L.hair = r() < 0.5 ? HAIR[5] : HAIR[4]; L.coat = pick(r, ['#7b2837', '#b88e5e', '#26356b', '#676842']);
      L.len = 'long'; L.skirt = true; L.legs = '#6a5a4c'; L.bag = null; L.props.trolley = pick(r, ['#7b2837', '#26356b', '#2f5a3a']); L.h = 1.52 + r() * 0.06;
      L.glasses = r() < 0.7; L.scarf = r() < 0.5 ? '#d6cab0' : null; L.collar = 'open';
      break;
    case 'slow': if (old && r() < 0.35) L.props.cane = true; break;
    case 'runner':
      L.coat = pick(r, ['#3452a3', '#7b2837', '#3b3d43']); L.len = 'short'; L.hood = false; L.legs = '#1b1b1f'; L.shoes = '#e9e7e1';
      L.bag = { t: 'back', c: pick(r, BAGS), side: 1 }; L.collar = 'open'; L.scarf = null; L.props.sport = true;
      break;
    case 'espejo': L.props.unsure = true; break;
  }
  return L;
}

// You: the yellow raincoat, a blue satchel across it, curls.
export const YOU_LOOK = {
  kind: 'you', fem: true, h: 1.68, w: 1.0, skin: '#eab896', hair: '#4b3122', style: 'curly', coat: '#f3c21a', len: 'mid',
  legs: '#2f4b87', shoes: '#2b2321', scarf: null, collar: 'open', glasses: false, beard: false, hood: true, raincoat: true,
  bag: { t: 'shoulder', c: '#2d4f9e', side: -1, strap: '#1f3a78' }, hat: null, props: {},
};
