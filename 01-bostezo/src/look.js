// Appearance generator: turns a person (seed + kind) into a stable cartoon "look".
import { mulberry32, pick, shade, mix } from './util.js';

export const SKIN = ['#f5d2b5', '#efc29f', '#e2ad86', '#d39a70', '#bd8058', '#a06843', '#855234', '#6a3f29', '#f2c6a8', '#dba27c'];
export const HAIR = ['#241915', '#332219', '#4b3020', '#6b4225', '#8f5a2c', '#b98a4a', '#d9bd7c', '#8d8a86', '#c9c6c0', '#a8452b', '#1b1b24', '#5a3b2e'];
export const TOPS = ['#5d8193', '#7f9f78', '#c47a5a', '#8b72a6', '#d4ae55', '#4f6e6b', '#b35f6e', '#6c7c8f', '#e3dccb', '#3b4760', '#a88859', '#5f93a0', '#9aa36b', '#c9936a', '#735a7d'];
const TIES = ['#b8433c', '#3e5f8a', '#d4a13a', '#6b3c6e', '#2f6b58'];
const LANYARD = ['#3d6fb6', '#c9463d', '#2f8f6f', '#d49a2a'];

const M_HAIR = ['short', 'short', 'side', 'side', 'buzz', 'bald', 'spiky', 'curly', 'quiff'];
const F_HAIR = ['bob', 'long', 'long', 'bun', 'ponytail', 'curly', 'short', 'side', 'afro'];
const TOP_KINDS = ['shirt', 'sweater', 'hoodie', 'blouse', 'suit', 'polo', 'tee'];

export function makeLook(p) {
  const rng = mulberry32(Math.floor(p.seed * 1e9) ^ 0x9e3779b9);
  const gender = rng() < 0.5 ? 'm' : 'f';
  const L = {
    gender,
    skin: pick(rng, SKIN),
    hair: pick(rng, HAIR),
    hairStyle: pick(rng, gender === 'm' ? M_HAIR : F_HAIR),
    top: pick(rng, TOPS),
    topKind: pick(rng, TOP_KINDS),
    tie: null,
    lanyard: rng() < 0.28 ? pick(rng, LANYARD) : null,
    glasses: rng() < 0.28 ? (rng() < 0.5 ? 'round' : 'rect') : null,
    facial: null,
    blush: rng() < 0.45,
    freckles: rng() < 0.12,
    headW: 0.94 + rng() * 0.14,
    headH: 1.0 + rng() * 0.12,
    shoulders: 1.22 + rng() * 0.28 + (gender === 'm' ? 0.08 : -0.04),
    eyeGap: 0.4 + rng() * 0.06,
    eyeSize: 0.92 + rng() * 0.2,
    noseKind: Math.floor(rng() * 3),
    browW: 0.8 + rng() * 0.5,
    mouthY: 0.46 + rng() * 0.06,
    pose: pick(rng, ['desk', 'desk', 'desk', 'chin', 'crossed', 'pen', 'chin']),
    yawnStyle: pick(rng, ['stretch', 'stretch', 'cover', 'oneArm', 'cover', 'none']),
    prop: pick(rng, ['laptop', 'notebook', 'notebook', 'none', 'laptop', 'bottle', 'none']),
    earring: gender === 'f' && rng() < 0.4,
    age: rng(),
  };
  if (gender === 'm' && rng() < 0.38) L.facial = pick(rng, ['mustache', 'beard', 'stubble', 'stubble', 'goatee']);
  if (L.age > 0.82 && gender === 'm' && rng() < 0.6) { L.hair = pick(rng, ['#8d8a86', '#c9c6c0', '#a9a49c']); if (rng() < 0.5) L.hairStyle = 'bald'; }
  if (L.topKind === 'suit' || (L.topKind === 'shirt' && rng() < 0.4)) L.tie = pick(rng, TIES);
  if (L.topKind === 'blouse' && gender === 'm') L.topKind = 'shirt';

  // archetype flavour
  switch (p.kind) {
    case 'intern':
      L.topKind = 'hoodie'; L.lanyard = '#d49a2a'; L.badge = 'BECARIO'; L.age = 0.05; L.eyeSize = 1.12; L.facial = null;
      L.prop = 'notebook'; L.yawnStyle = 'stretch'; L.pose = 'desk';
      break;
    case 'phone':
      L.pose = 'phone'; L.prop = 'none';
      break;
    case 'coffee':
      L.prop = 'mug'; L.pose = 'desk'; L.bags = true;
      break;
    case 'sleeper':
      L.topKind = rng() < 0.5 ? 'hoodie' : 'sweater'; L.pose = 'crossed'; L.prop = 'none'; L.bags = true; L.yawnStyle = 'stretch';
      break;
    case 'pelota':
      L.topKind = 'suit'; L.tie = '#b8433c'; L.glasses = 'rect'; L.hairStyle = gender === 'm' ? 'side' : 'bun';
      L.hair = pick(rng, ['#241915', '#332219', '#4b3020']); L.pose = 'pelota'; L.prop = 'notebook'; L.facial = null; L.shoulders = 1.2;
      L.yawnStyle = 'none';
      break;
    case 'player':
      Object.assign(L, {
        gender: 'm', skin: '#e9b995', hair: '#3a261b', hairStyle: 'messy', top: '#d9a441', topKind: 'sweater', tie: null,
        lanyard: '#3d6fb6', glasses: null, facial: 'stubble', blush: true, freckles: false, headW: 1.02, headH: 1.06,
        shoulders: 1.36, eyeGap: 0.42, eyeSize: 1.06, noseKind: 1, browW: 1.1, mouthY: 0.48, pose: 'desk',
        yawnStyle: 'stretch', prop: 'notebook', earring: false, bags: true,
      });
      break;
  }
  L.skinDark = shade(L.skin, -0.16);
  L.skinDeep = shade(L.skin, -0.32);
  L.skinLight = shade(L.skin, 0.12);
  L.lip = mix(L.skin, '#b8505a', 0.38);
  L.hairDark = shade(L.hair, -0.25);
  L.hairLight = shade(L.hair, 0.18);
  L.topDark = shade(L.top, -0.22);
  L.topLight = shade(L.top, 0.12);
  L.shirt = L.topKind === 'suit' ? '#f2efe8' : shade(L.top, 0.55);
  return L;
}
