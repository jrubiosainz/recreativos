// The crowd, drawn once into an atlas at the size one seat takes on screen, then stamped thousands of
// times a frame. A look is a person (shirt, skin, hair, what they carry); each look has two views
// (front: the far stands face us; back: the near stand shows us its necks) and six poses, from sat to
// both arms up, plus two waving-at-the-camera frames.
import { K } from '../sim.js';
import { shade, mix, rgba } from '../util.js';

export const POSES = 6; // 0 sat · 1 getting up · 2 up · 3 arms up · 4, 5 waving at the big screen
export const HOME = '#d6283e', HOME2 = '#f4efe6', AWAY = '#3f8fe0', AWAY2 = '#15285c';
const SKIN = ['#f1c7a5', '#e0a986', '#c58a62', '#8d5a3b', '#f5d6bd', '#6b4128'];
const HAIR = ['#2a1d17', '#4a3222', '#8a5a2b', '#d9b15f', '#9b9b9b', '#1a1a1a', '#b5462d'];

// the wardrobe per kind of stand: [shirt, trim, accessory]
const LOOKS = {
  fan: [[HOME, HOME2, 'scarf'], [HOME2, HOME, ''], [HOME, HOME2, 'stripes'], ['#2b2f3a', HOME, 'scarf'], ['#6d7280', '', ''], [HOME, HOME2, 'cap'], ['#1f3b5a', '', ''], [HOME2, HOME, 'stripes'], ['#e8e2d4', '', 'cap'], [HOME, '', '']],
  kid: [['#ffd23f', '', ''], [HOME, HOME2, 'stripes'], ['#43c59e', '', 'cap'], ['#ff8c42', '', '']],
  old: [['#8b7d6b', '', 'flat'], ['#5b5e66', HOME, 'flat'], ['#a39171', '', 'bald'], ['#3d4452', HOME, 'scarf']],
  ultra: [['#15151a', HOME, 'scarfUp'], [HOME, '#15151a', 'scarfUp'], ['#15151a', HOME, 'bare']],
  vip: [['#20242e', '#f4f4f4', 'tie'], ['#34303a', '#f4f4f4', 'tie'], ['#1d2a3f', '#f4f4f4', 'tie']],
  away: [[AWAY, AWAY2, 'scarf'], [AWAY2, AWAY, ''], [AWAY, '#ffffff', 'stripes']],
  bocata: [[HOME, HOME2, 'bocata'], ['#2b2f3a', HOME, 'bocata']],
  poncho: [['#f2d64b', '', 'poncho'], ['#dfe9ee', '', 'poncho'], [HOME, '', 'poncho'], ['#f2d64b', '', 'poncho']],
};
const KIND_LOOKS = {
  [K.fan]: 'fan', [K.kid]: 'kid', [K.old]: 'old', [K.ultra]: 'ultra', [K.empty]: 'fan', [K.vip]: 'vip',
  [K.away]: 'away', [K.kiss]: 'fan', [K.sleep]: 'fan', [K.bocata]: 'bocata', [K.gap]: 'fan',
};

const rng = (n) => { let h = n | 0; return () => ((h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) ^ (h + 0x6d2b79f5)) >>> 0) / 4294967296; };

export class Crowd {
  // u: device px per seat; light: {c, a} tint for the hour; rain: ponchos on the fans
  constructor(u, { light = null, rain = false } = {}) {
    this.u = Math.max(4, Math.round(u));
    this.cw = Math.ceil(this.u * 1.9); this.ch = Math.ceil(this.u * 3.1);
    this.looks = []; this.byKind = {};
    for (const [name, list] of Object.entries(LOOKS)) {
      this.byKind[name] = [];
      list.forEach((l, j) => {
        for (let v = 0; v < 2; v++) {
          const r = rng(j * 97 + name.length * 131 + v * 7);
          const skin = name === 'vip' ? SKIN[(j * 2) % 4] : SKIN[(r() * SKIN.length) | 0];
          const hair = l[2] === 'bald' ? skin : name === 'old' ? '#c9c6c0' : HAIR[(r() * HAIR.length) | 0];
          this.byKind[name].push(this.looks.length);
          this.looks.push({ shirt: l[0], trim: l[1], acc: l[2], skin, hair, kid: name === 'kid', fat: r() < 0.25, style: (r() * 6) | 0, kind: name });
        }
      });
    }
    this.rain = rain;
    const n = this.looks.length * 2 * POSES;
    this.cols = Math.ceil(Math.sqrt(n * this.ch / this.cw));
    const rows = Math.ceil(n / this.cols);
    const cv = (this.atlas = document.createElement('canvas'));
    cv.width = this.cols * this.cw; cv.height = rows * this.ch;
    const g = cv.getContext('2d');
    this.looks.forEach((L, li) => {
      for (let view = 0; view < 2; view++) for (let p = 0; p < POSES; p++) {
        const k = (li * 2 + view) * POSES + p, x = (k % this.cols) * this.cw, y = ((k / this.cols) | 0) * this.ch;
        g.save(); g.translate(x + this.cw / 2, y + this.ch - 1); drawPerson(g, this.u, L, view, p); g.restore();
      }
    });
    // the hour of the day: dusk and night pull everyone toward the dark
    if (light) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = rgba(light.c, light.a); g.fillRect(0, 0, cv.width, cv.height); g.globalCompositeOperation = 'source-over'; }
  }
  lookFor(kind, i, r) {
    const name = this.rain && (kind === K.fan || kind === K.kid || kind === K.sleep) && ((i * 7 + r * 13) % 5) < 3 ? 'poncho' : KIND_LOOKS[kind] || 'fan';
    const list = this.byKind[name], h = Math.imul(i * 73856093 ^ r * 19349663, 0x9e3779b1) >>> 0;
    return list[(h >>> 7) % list.length];
  }
  cell(look, view, pose) {
    const k = (look * 2 + view) * POSES + pose;
    return [(k % this.cols) * this.cw, ((k / this.cols) | 0) * this.ch];
  }
}

// one person, feet at (0,0), facing the viewer (front) or away (back), seat width u
function drawPerson(g, u, L, view, pose) {
  const s = u / 10, kid = L.kid ? 0.82 : 1, fat = L.fat ? 1.12 : 1;
  const lift = [0, 0.45, 0.85, 1, 1, 1][pose];
  const hip = (-3.2 - lift * 4.6) * s * kid;           // hips rise as they stand
  const sh = hip - 6.2 * s * kid;                      // shoulders
  const hw = 3.3 * s * fat * kid;                      // half shoulder width
  const head = 2.35 * s * kid, hy = sh - head * 1.05;
  const shirt = L.shirt, dark = shade(shirt, -0.28), front = view === 0;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const limb = (x0, y0, x1, y1, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  // legs only show once they're up
  if (lift > 0.3) {
    const lc = L.acc === 'tie' ? '#1b1d24' : '#2a3140';
    limb(-1.4 * s, hip, -1.6 * s, -1 * s, 2.2 * s * kid, lc); limb(1.4 * s, hip, 1.6 * s, -1 * s, 2.2 * s * kid, lc);
  }
  // arms: sat = on the knees, up = over the head, waving = swung
  const armC = L.acc === 'bare' ? L.skin : L.acc === 'poncho' ? shade(shirt, -0.1) : shirt;
  const aw = 1.9 * s * kid;
  const hand = (x, y) => { g.fillStyle = L.skin; g.beginPath(); g.arc(x, y, 1.15 * s * kid, 0, 7); g.fill(); };
  let arms;
  if (pose === 0) arms = [[-hw, sh + 1 * s, -hw - 0.4 * s, hip + 0.4 * s], [hw, sh + 1 * s, hw + 0.4 * s, hip + 0.4 * s]];
  else if (pose === 1) arms = [[-hw, sh + 1 * s, -hw - 2.2 * s, sh - 1.6 * s], [hw, sh + 1 * s, hw + 2.2 * s, sh - 1.6 * s]];
  else if (pose === 2) arms = [[-hw, sh + 1 * s, -hw - 2.6 * s, sh - 4.6 * s], [hw, sh + 1 * s, hw + 2.6 * s, sh - 4.6 * s]];
  else if (pose === 3) arms = [[-hw + 0.4 * s, sh + 0.8 * s, -hw - 1.2 * s, sh - 7.4 * s], [hw - 0.4 * s, sh + 0.8 * s, hw + 1.2 * s, sh - 7.4 * s]];
  else { const sw = pose === 4 ? -1 : 1; arms = [[-hw + 0.4 * s, sh + 0.8 * s, -hw - 1.2 * s + sw * 2.6 * s, sh - 7 * s], [hw - 0.4 * s, sh + 0.8 * s, hw + 1.2 * s + sw * 2.6 * s, sh - 7 * s]]; }
  const armsBehind = pose >= 2;
  const drawArms = () => {
    for (const [x0, y0, x1, y1] of arms) { limb(x0, y0, x1, y1, aw, armC); hand(x1, y1); }
    // what they hold up
    if (L.acc === 'scarfUp' && pose >= 2) {
      const [, , ax, ay] = arms[0], [, , bx, by] = arms[1];
      g.fillStyle = L.trim || HOME; g.fillRect(ax, Math.min(ay, by) - 0.9 * s, bx - ax, 2 * s);
      g.fillStyle = '#fff'; g.fillRect(ax + (bx - ax) * 0.33, Math.min(ay, by) - 0.9 * s, (bx - ax) * 0.12, 2 * s); g.fillRect(ax + (bx - ax) * 0.62, Math.min(ay, by) - 0.9 * s, (bx - ax) * 0.12, 2 * s);
    }
    if (L.acc === 'bocata' && pose >= 1) {
      const [, , x, y] = arms[1];
      g.fillStyle = '#e2b46a'; g.beginPath(); g.ellipse(x + 0.6 * s, y - 0.8 * s, 2.6 * s, 1.2 * s, -0.5, 0, 7); g.fill();
      g.fillStyle = '#b8472f'; g.fillRect(x - 1.4 * s, y - 1 * s, 3.8 * s, 0.6 * s);
    }
  };
  if (armsBehind && !front) drawArms();
  // torso
  g.fillStyle = shirt;
  g.beginPath(); g.moveTo(-hw, sh); g.lineTo(hw, sh); g.lineTo(hw * 0.86, hip); g.lineTo(-hw * 0.86, hip); g.closePath(); g.fill();
  if (L.acc === 'stripes') { g.fillStyle = L.trim; for (let k = -1; k <= 1; k++) g.fillRect(k * hw * 0.62 - 0.5 * s, sh, 1.1 * s, hip - sh); }
  if (L.acc === 'bare') { g.fillStyle = L.skin; g.fillRect(-hw * 0.8, sh + 0.5 * s, hw * 1.6, (hip - sh) * 0.7); }
  if (L.acc === 'tie' && front) { g.fillStyle = L.trim; g.beginPath(); g.moveTo(-1.3 * s, sh); g.lineTo(1.3 * s, sh); g.lineTo(0, sh + 3.6 * s); g.fill(); g.fillStyle = '#b3243a'; g.fillRect(-0.45 * s, sh + 0.4 * s, 0.9 * s, 3.6 * s); }
  if (L.acc === 'poncho') {
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.moveTo(-hw * 1.15, hip + 0.4 * s); g.lineTo(0, sh - head * 0.6); g.lineTo(hw * 1.15, hip + 0.4 * s); g.fill();
  }
  // shading down one side
  g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(hw * 0.25, sh, hw * 0.75, hip - sh);
  if (L.acc === 'scarf') { g.fillStyle = L.trim || HOME2; g.fillRect(-hw * 0.75, sh - 0.2 * s, hw * 1.5, 1.4 * s); }
  // head
  g.fillStyle = L.skin; g.beginPath(); g.arc(0, hy, head, 0, 7); g.fill();
  if (front) {
    // hair on top, face below; open mouths at the top of the wave
    g.fillStyle = L.hair; g.beginPath(); g.arc(0, hy - head * 0.15, head * 1.02, Math.PI * 1.08, Math.PI * 1.92); g.fill();
    if (u >= 9) {
      g.fillStyle = 'rgba(30,18,12,0.85)';
      g.fillRect(-head * 0.45, hy - head * 0.05, head * 0.22, head * 0.22); g.fillRect(head * 0.24, hy - head * 0.05, head * 0.22, head * 0.22);
      if (pose >= 3) { g.beginPath(); g.ellipse(0, hy + head * 0.5, head * 0.28, head * 0.24, 0, 0, 7); g.fill(); }
    }
  } else {
    g.fillStyle = L.hair; g.beginPath(); g.arc(0, hy - head * 0.05, head * 1.02, Math.PI * 0.85, Math.PI * 2.15); g.fill();
  }
  if (L.acc === 'cap') { g.fillStyle = L.trim || HOME; g.beginPath(); g.arc(0, hy - head * 0.2, head * 1.05, Math.PI, 0); g.fill(); if (front) g.fillRect(-head * 1.1, hy - head * 0.3, head * 2.2, head * 0.35); }
  if (L.acc === 'flat') { g.fillStyle = '#6e604d'; g.beginPath(); g.ellipse(0, hy - head * 0.55, head * 1.2, head * 0.55, 0, Math.PI, 0); g.fill(); }
  if (L.acc === 'poncho') { g.fillStyle = mix(L.shirt, '#ffffff', 0.25); g.beginPath(); g.arc(0, hy - head * 0.1, head * 1.18, Math.PI * 0.95, Math.PI * 2.05); g.fill(); }
  if (!armsBehind || front) drawArms();
}

// the plastic seat itself, for empty places (and the backs you see behind sat people)
export function seatColor(kind, sec) {
  if (kind === K.vip) return '#7a1f2b';
  if (kind === K.away) return '#2b5aa6';
  return sec % 2 ? '#b8213a' : '#cf2f45';
}
