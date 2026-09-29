// Procedural looks: every passenger gets a seeded outfit, face and props that fit his archetype.
import { mulberry32, pick } from './util.js';

export const SKIN = ['#f7dcc6', '#f3cfb1', '#eec29d', '#e2b088', '#d49c73', '#bb8360', '#9c6a4c'];
const HAIR_DARK = ['#1d1b22', '#2b221d', '#382a21', '#231f2c', '#4a3526'];
const HAIR_ALL = [...HAIR_DARK, '#6b4a33', '#8b5a3c', '#b07a4a'];
const SUIT = ['#26324f', '#2e3038', '#3b4150', '#20293d', '#474d5a', '#353c49', '#2c3a52'];
const SHIRT = ['#ffffff', '#eef4fc', '#f6f1e7', '#e8f2f6'];
const TIE = ['#d0434f', '#2f6fd0', '#e6a232', '#7a48b0', '#239072', '#c24a7e', '#3c4c9c'];
const BRIGHT = ['#ff8a5b', '#43b6a7', '#f2c14e', '#7aa6e8', '#e56b8f', '#8fc46a', '#b58ae0'];
const MUTED = ['#c9b79c', '#9fb3a8', '#b8a1b3', '#a7b6cf', '#d3a58f', '#bfc59a', '#e7d6bd'];

// hair styles: short | side | spiky | bald | bob | long | bun | perm | cap | topknot | pony
export function makeLook(type, seed) {
  const r = mulberry32(seed || 1);
  const L = {
    type, seed,
    skin: pick(r, SKIN),
    hair: pick(r, HAIR_DARK),
    style: 'short',
    glasses: r() < 0.28 ? (r() < 0.5 ? 'round' : 'square') : null,
    mask: r() < 0.2,
    h: 1.7, sw: 0.46, belly: 0, head: 1,
    top: pick(r, SUIT), shirt: pick(r, SHIRT), tie: pick(r, TIE),
    legs: null, shoes: '#2a2626',
    outfit: 'suit', bag: null, prop: null, pack: null, hat: null,
    brow: 0.5 + r() * 0.5, eyeGap: 0.9 + r() * 0.2, mouthW: 0.8 + r() * 0.4, blush: 0.35 + r() * 0.3,
    lash: false, beard: r() < 0.08, age: r(),
  };
  const bag = () => pick(r, ['brief', 'brief', 'tote', 'none']);
  switch (type) {
    case 'salary':
    case 'cake':
    case 'sleepy':
    case 'runner':
      L.style = pick(r, ['short', 'side', 'side', 'spiky', 'bald', 'short']);
      if (L.style === 'bald') L.hair = pick(r, ['#2b221d', '#6f6a6a', '#9a9696']);
      if (L.age > 0.8) L.hair = pick(r, ['#8e8b8d', '#b9b5b2']);
      L.h = 1.66 + r() * 0.12; L.sw = 0.46 + r() * 0.06; L.belly = r() < 0.3 ? 0.35 + r() * 0.4 : 0;
      L.legs = L.top; L.bag = bag();
      if (type === 'cake') { L.prop = 'cake'; L.bag = 'none'; L.mask = false; }
      if (type === 'sleepy') { L.tieLoose = true; L.glasses = r() < 0.5 ? 'square' : null; L.mask = false; }
      if (type === 'runner') { L.bag = 'brief'; L.mask = false; L.tieFly = true; }
      break;
    case 'office':
      L.style = pick(r, ['bob', 'long', 'bun', 'pony', 'bob']);
      L.hair = pick(r, HAIR_ALL);
      L.h = 1.56 + r() * 0.1; L.sw = 0.4 + r() * 0.04;
      L.outfit = r() < 0.6 ? 'blouse' : 'suitW';
      L.top = L.outfit === 'blouse' ? pick(r, MUTED) : pick(r, SUIT);
      L.shirt = pick(r, SHIRT); L.legs = r() < 0.5 ? pick(r, SUIT) : pick(r, MUTED);
      L.skirt = r() < 0.6; L.lash = true; L.bag = pick(r, ['tote', 'shoulder', 'shoulder']);
      L.shoes = pick(r, ['#2a2626', '#6b3b30', '#3a2f45']);
      L.beard = false;
      break;
    case 'student':
      L.style = pick(r, ['spiky', 'short', 'side', 'bob', 'pony']);
      L.girl = L.style === 'bob' || L.style === 'pony';
      L.h = 1.56 + r() * 0.12; L.sw = 0.42 + r() * 0.04;
      L.outfit = L.girl ? 'sailor' : 'gakuran';
      L.top = L.girl ? '#f4f6fb' : '#1e2230'; L.legs = L.girl ? '#27304a' : '#1e2230'; L.skirt = L.girl;
      L.tie = L.girl ? pick(r, ['#d0434f', '#2f6fd0', '#1f8a6a']) : null;
      L.pack = { front: true, color: pick(r, BRIGHT) };
      L.lash = L.girl; L.beard = false; L.mask = r() < 0.15;
      L.headphones = r() < 0.3 ? pick(r, BRIGHT) : null;
      break;
    case 'tourist':
      L.style = pick(r, ['short', 'long', 'bald', 'spiky', 'cap']);
      L.hair = pick(r, ['#c9a45c', '#8b5a3c', '#2b221d', '#d8b98a', '#b0482f']);
      L.skin = pick(r, SKIN.slice(0, 5));
      L.h = 1.74 + r() * 0.12; L.sw = 0.5 + r() * 0.06;
      L.outfit = 'aloha'; L.top = pick(r, ['#2fb3a6', '#f08a4b', '#f2c14e', '#e0607e', '#5c8fe0']);
      L.legs = pick(r, ['#c9b48e', '#8c9aa8', '#5d6d4f']); L.shorts = true;
      L.pack = { front: false, color: pick(r, ['#e8612c', '#2e7d5b', '#3a6fc4', '#c43a3a', '#6b5b95']), big: true };
      L.camera = true; L.mask = false; L.hat = L.style === 'cap' ? pick(r, BRIGHT) : null;
      L.shoes = '#6b5a4a';
      break;
    case 'sumo':
      L.style = 'topknot'; L.hair = '#15131a';
      L.skin = pick(r, ['#f0c8a4', '#e8b88f', '#dcaa80']);
      L.h = 1.84 + r() * 0.06; L.sw = 0.78; L.belly = 1;
      L.outfit = 'yukata'; L.top = pick(r, ['#8fb8de', '#c9d7c0', '#e8d8b0', '#b8a6d9']);
      L.pattern = pick(r, ['#2b4a7a', '#4a6a3a', '#8a5a2a', '#5a3a8a']);
      L.legs = L.top; L.glasses = null; L.mask = false; L.shoes = '#7a5a3a'; L.geta = true; L.beard = false;
      L.head = 1.12;
      break;
    case 'granny':
      L.style = 'perm'; L.hair = pick(r, ['#d9d6d2', '#c8c4c0', '#e8e4de', '#a9a4a6']);
      L.h = 1.42 + r() * 0.06; L.sw = 0.4;
      L.outfit = 'cardigan'; L.top = pick(r, ['#9a6fb0', '#c56b7a', '#6f8fb0', '#b08a5a']);
      L.shirt = '#f6efe2'; L.legs = pick(r, ['#5a5046', '#3e4452']); L.skirt = true;
      L.bag = 'cart'; L.glasses = 'round'; L.mask = r() < 0.3; L.pearls = true; L.lash = true; L.beard = false;
      L.shoes = '#4a3a33';
      break;
    case 'mascot':
      L.outfit = 'mascot'; L.h = 2.0; L.sw = 0.8;
      L.top = pick(r, ['#fff6de', '#ffe9a8', '#f7f2e8']); L.accent = pick(r, ['#ff8fa8', '#8fd0ff', '#ffb35c']);
      L.style = 'none'; L.glasses = null; L.mask = false; L.beard = false;
      break;
    case 'kid':
      L.style = pick(r, ['short', 'bob', 'spiky']);
      L.h = 1.12 + r() * 0.1; L.sw = 0.32; L.head = 1.08;
      L.outfit = 'kid'; L.top = pick(r, BRIGHT); L.legs = pick(r, ['#2c3a52', '#6b5a4a']); L.shorts = true;
      L.hat = r() < 0.6 ? '#f2d24a' : null; L.pack = { front: false, color: '#d0434f', randoseru: true };
      L.glasses = null; L.mask = false; L.beard = false; L.balloon = r() < 0.5 ? pick(r, BRIGHT) : null;
      break;
    default:
      break;
  }
  if (L.mask) L.beard = false;
  return L;
}

// a random commuter already inside the car (seen mostly as head and shoulders)
export function crowdLook(seed) {
  const r = mulberry32(seed);
  const k = r();
  const type = k < 0.46 ? 'salary' : k < 0.78 ? 'office' : k < 0.93 ? 'student' : k < 0.97 ? 'tourist' : 'granny';
  const L = makeLook(type, (r() * 2 ** 31) | 0);
  L.crowd = true;
  L.phone = r() < 0.25;
  L.sleepy = r() < 0.15;
  return L;
}
