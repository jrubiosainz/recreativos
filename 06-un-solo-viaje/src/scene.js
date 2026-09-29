// The frame: the way up as your eyes see it, and the comic laid over it. The rooms seen from an eye
// that walks, bobs under the load, glances at whatever it has to press next and whips round at each
// turn of the stairs; your two hands and all that hangs from them; and over it, the fruit shop's
// scale: a readout over each fist, a thermal sticker each time no hand is free, pops, what people
// say to you, and the ending. The simulation decides everything. This only shows it, asks for the
// sounds through `cues`, and keeps one photo of the best moment for the result.
import { Cam, EYE } from './gfx/cam.js';
import { World } from './gfx/world.js';
import { Rooms } from './gfx/rooms.js';
import { Hands } from './gfx/hands.js';
import { bagArt, lookOf, setBagRes, drawStanding } from './gfx/bags.js';
import { PAL, FACE, TEXT, seg7, seg7w, rrect, ell, poly, canvas, tone, darker, rgba } from './gfx/paint.js';
import { ACT, T_PICK, tDown } from './sim.js';
import { BAG } from './levels.js';
import { clamp, lerp, damp, smooth, ease, noise1, mulberry32, TAU } from './util.js';

export const SCENE_ES = {
  kg: 'kg', max: 'MÁX', band: 'SIN MANOS', time: 'TIEMPO', sec: 's', dec: ',', meanwhile: 'MIENTRAS TANTO…', street: 'ABAJO, EN LA CALLE…',
  how: { head: 'CON LA CABEZA', crouch: 'EN CUCLILLAS', bum: 'CON EL CULO', foot: 'CON EL PIE', nose: 'CON LA NARIZ', elbow: 'CON EL CODO' },
  what: {
    trunk: 'MALETERO', portal: 'PORTAL', door: 'PUERTA', call: 'BOTÓN DEL ASCENSOR', floor: 'BOTÓN DEL PISO', light: 'INTERRUPTOR',
    liftdoor: 'PUERTA DEL ASCENSOR', reja: 'REJA DEL ASCENSOR', intercom: 'PORTERO AUTOMÁTICO', bell: 'TIMBRE',
  },
  pop: { plof: '¡PLOF!', plaf: '¡PLAF!', cataplof: '¡CATAPLOF!', chof: '¡CHOF!', crac: '¡CRAC!', clonc: '¡CLONC!', pam: '¡PAM!', bip: '¡BIP!', honk: '¡PIII!', honk2: '¡PIII-PIII!', nooo: '¡NOOO!' },
  stamp: { win: 'UN SOLO VIAJE', lose: 'DOS VIAJES' },
  say: {
    vecina1: '¡Ay, cariño! ¿Todo eso llevas?',
    vecina2: 'Mi Paco subía las garrafas de dos en dos…',
    vecina3: 'Bueno, no te entretengo, ¡que se te cae!',
    vecina4: '¿Te ayudo? … Uy, no, que tengo la espalda fatal.',
    buzz1: '¿Sííí? ¿Quién es?',
    buzz2: '¡Ay, sois vosotros! ¡Empujad cuando suene!',
    buzzAgain: '¿Otra vez? ¡Que empujéis cuando suena!',
    door1: '¡Voooy!',
    door2: '¡Un momento, que tengo las manos en la masa!',
    chat1: '¡Pero si no hacía falta traer nada!',
    chat2: '¿Y el turrón blando? Que el duro no lo puedo.',
    chat3: '¡Pasad, pasad, que se enfría la sopa!',
    chat4: '¿Queréis que os coja algo? …Uy, no, que me he hecho las uñas.',
    driver1: '¡Oiga! ¡Que es para hoy!',
    driver2: '¡Que no puedo salir!',
    driver3: '¡Voy a llamar a la grúa!',
  },
};
export const SCENE_EN = {
  kg: 'kg', max: 'MAX', band: 'NO HANDS', time: 'TIME', sec: 's', dec: '.', meanwhile: 'MEANWHILE…', street: 'DOWN IN THE STREET…',
  how: { head: 'WITH YOUR HEAD', crouch: 'SQUATTING', bum: 'WITH YOUR BUM', foot: 'WITH YOUR FOOT', nose: 'WITH YOUR NOSE', elbow: 'WITH YOUR ELBOW' },
  what: {
    trunk: 'BOOT', portal: 'FRONT DOOR', door: 'DOOR', call: 'LIFT BUTTON', floor: 'FLOOR BUTTON', light: 'LIGHT SWITCH',
    liftdoor: 'LIFT DOOR', reja: 'LIFT GATE', intercom: 'ENTRYPHONE', bell: 'DOORBELL',
  },
  pop: { plof: 'THUD!', plaf: 'FLOMP!', cataplof: 'KER-FLOMP!', chof: 'SPLOTCH!', crac: 'CRACK!', clonc: 'BONK!', pam: 'BAM!', bip: 'BEEP!', honk: 'HOOONK!', honk2: 'HONK-HONK!', nooo: 'NOOO!' },
  stamp: { win: 'ONE TRIP', lose: 'TWO TRIPS' },
  say: {
    vecina1: 'Oh, love! You’re carrying all that?',
    vecina2: 'My Paco used to carry the water jugs two at a time…',
    vecina3: 'Well, I won’t keep you. You’re dropping it!',
    vecina4: 'Shall I help? … Oh, no, my back’s terrible.',
    buzz1: 'Hellooo? Who is it?',
    buzz2: 'Oh, it’s you! Push when it buzzes!',
    buzzAgain: 'Again? Push when it buzzes!',
    door1: 'Coming!',
    door2: 'Just a minute, my hands are in the dough!',
    chat1: 'You didn’t have to bring anything!',
    chat2: 'And the soft turrón? I can’t do the hard one.',
    chat3: 'Come in, come in, the soup’s getting cold!',
    chat4: 'Shall I take something? …Oh, no, I’ve just done my nails.',
    driver1: 'Hey! Today, please!',
    driver2: 'I can’t get out!',
    driver3: 'I’m calling the tow truck!',
  },
};

// ---------- small things ----------
const merge = (a, b) => {
  const o = { ...a };
  for (const k in b || {}) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k];
  return o;
};
// up over [0, a], held to b, down over [b, 1]
const reach3 = (p, a = 0.3, b = 0.75) => (p < a ? smooth(p / a) : p < b ? 1 : 1 - smooth((p - b) / (1 - b)));
const bump = (p, a, b) => (p <= a || p >= b ? 0 : Math.sin((Math.PI * (p - a)) / (b - a)));
const FALLBACK = new Set(['head', 'crouch', 'bum', 'foot', 'nose', 'elbow']);
const RANK = { nose: 6, bum: 5, head: 5, foot: 4, elbow: 3, crouch: 2 };
// in portrait the photo is a slice of a tall screen: where each move happens, 0 its top … 1 its bottom
const FOCUS = { head: 0, crouch: 0.6, bum: 0.6, elbow: 0.8, foot: 1, nose: 1 };
const POP = { fill: '#ffd23f', ink: '#1d1a17', text: '#e0402f' };
const CAPTION = '#f6e27f';
// what spills out of each bag down the stairs: [colour, shape] (b a box or bottle, o round, l long, c a can or a roll)
const SPILL = {
  leche: [['#f3f2ec', 'b'], ['#3f7fc0', 'b']], fruta: [['#f08a24', 'o'], ['#c8372d', 'o'], ['#9bbf3a', 'o']],
  verdura: [['#5d8f3a', 'l'], ['#d9442f', 'o']], agua: [['#bfe0f2', 'b']], huevos: [['#f6ead2', 'o'], ['#d9a55b', 'l']],
  limpieza: [['#e8762a', 'b'], ['#2d5f9a', 'b']], botellas: [['#2c4a33', 'b'], ['#6d1a2a', 'b']], latas: [['#b9bec0', 'c'], ['#c8372d', 'c']],
  papel: [['#f7f6f1', 'c']], carne: [['#e7a3a0', 'b'], ['#f3f2ec', 'b']], congelados: [['#2d5f9a', 'b'], ['#b9c7d3', 'b']],
  pavo: [['#b8763f', 'o']], cava: [['#2c4a33', 'b'], ['#d8b14a', 'b']], turron: [['#e9d7a8', 'l'], ['#8c1f2a', 'b']],
};
// a line of text broken to fit a width
function wrap(g, txt, maxW) {
  const out = [];
  let cur = '';
  for (const wd of String(txt).split(' ')) {
    const t = cur ? cur + ' ' + wd : wd;
    if (cur && g.measureText(t).width > maxW) { out.push(cur); cur = wd; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}
const fmt = (v, dec) => v.toFixed(1).replace('.', dec);

// ---------- the scene ----------
export class Scene {
  // calm: the title's ghost, a gentler gait and no shake; still (reduced motion): no gait, no shake, and
  // the turns of the stairs cut instead of whipping round
  constructor(sim, text = SCENE_ES, { calm = false, still = false, voiceDur = null } = {}) {
    this.sim = sim; this.tx = merge(SCENE_ES, text); this.calm = calm || still; this.still = still;
    // seconds a recorded line lasts (the shell knows, from the audio manifest); without it, a reading-speed guess
    this.voiceDur = voiceDur;
    this.world = new World(sim.lv); this.rooms = new Rooms(this.world); this.cam = new Cam(); this.hands = new Hands();
    this.oldLift = this.world.W.rooms.some((r) => r.kind === 'cabin' && r.old);
    this.rng = mulberry32((sim.seed ^ 0x51d0) >>> 0);
    this.cues = []; this.photo = null; this.shot = null; this.done = false;
    this.t = 0; this.dt = 0; this.fresh = true;
    this.C = { ox: 0, oy: 0, oz: 0, yaw: 0, look: 0, roll: 0, lean: 0, walkK: 0, trauma: 0, bumSide: 1, riding: false, jolt: false };
    this.whip = null; this.legI = -1; this.view = null; this.w = null; this.yawD = null; this.vYaw = 0;
    this.stickers = []; this.sticker = null; this.pops = []; this.lines = []; this.speech = new Map(); this.caption = null;
    this.ro = [0, 1].map(() => ({ x: 0, y: 0, a: 1 }));
    this.actQ = null; this.lat = []; this.E = null; this.stepN = null; this.buzzN = 0; this.slipH = new Map();
    this.layer = null; this.smearC = null; this.stampC = null;
    this.hooks = { bags: (g, cam) => this.hands.trunk(g, cam, sim) };
    this.resize(390, 844);
  }
  resize(W, H, dpr = 1, { top = 0, bottom = 0 } = {}) {
    this.W = W; this.H = H; this.dpr = dpr; this.top = top; this.bottom = bottom;
    this.cam.fit(W, H); this.hands.resize(W, H); setBagRes(Math.min(2, dpr));
    this.u = this.hands.u; this.zoom = H > 1.1 * W ? 1.15 : 1;
    this.stampC = null; if (this.sticker) this.sticker.img = null;
    this.fresh = true;
  }
  cue(k, o = {}) {
    this.cues.push({ k, at: this.t, ...o });
    if (this.cues.length > 200) this.cues.splice(0, this.cues.length - 200);
  }
  after(d, fn) { this.lat.push({ at: this.t + d, fn }); }
  runLater() {
    if (!this.lat.some((q) => q.at <= this.t)) return;
    const due = this.lat.filter((q) => q.at <= this.t);
    this.lat = this.lat.filter((q) => q.at > this.t);
    for (const q of due) q.fn();
  }

  // ---------- what the simulation said happened ----------
  events(evs) {
    const sim = this.sim;
    this.hands.events(evs, sim);
    for (const e of evs) {
      switch (e.type) {
        case 'room': this.cue('room', { kind: e.kind }); break;
        case 'act': this.onAct(e); break;
        case 'actEnd': this.flushAct(); break;
        case 'actStop': this.actQ = null; break;
        case 'wait': this.onWait(e); break;
        case 'open':
          if (e.what === 'arrive') { this.cue('ding', { old: e.door !== 'auto' }); if (e.door === 'auto') this.cue('liftDoor', { open: true }); }
          else if (e.what === 'buzz') this.cue('buzzer', { on: true });
          break;
        case 'waitEnd':
          if (e.what === 'ride') { this.cue('ride', { on: false }); this.cue('ding', { old: this.oldLift }); if (!this.oldLift) this.cue('liftDoor', { open: true }); }
          else if (e.what === 'buzz') this.cue('buzzer', { on: false });
          break;
        case 'gone':
          this.cue('gone', { what: e.what });
          this.cue(e.what === 'buzz' ? 'buzzer' : 'liftDoor', { on: false, open: false });
          this.pop('nooo', this.W / 2, this.H * 0.4, { size: 1.3, trauma: 0.3 });
          break;
        case 'light': this.cue('light', { on: e.on }); break;
        case 'honk': this.onHonk(e); break;
        case 'pass': case 'down': this.cue('rustle', { n: e.n || 1 }); break;
        case 'passed': case 'grabbed': this.cue('hook', { kg: sim.bags[e.bag].kg }); break;
        case 'empty': this.cue('nope'); break;
        case 'grab': this.cue('grab', { kg: sim.bags[e.bag].kg }); break;
        case 'rested': { const R = sim.rest; this.cue('thud', { n: R ? R.prev[0].length + R.prev[1].length : 1 }); this.cue('sigh'); break; }
        case 'slip': this.onSlip(e); break;
        case 'break': this.onBreak(e); break;
        case 'end': this.onEnd(e); break;
      }
    }
  }
  onAct(e) {
    const A = this.sim.act, T = e.T, how = e.how, Q = [];
    const thing = e.what === 'reja' ? 'reja' : e.act === 'trunk' ? 'trunk' : e.act === 'button' ? 'button' : e.act === 'switch' ? 'switch' : e.act === 'keys' || e.act === 'keys2' ? 'lock' : 'door';
    const at = (s, k, o = {}, fx = null) => Q.push({ s, k, o: { what: e.what, ...o }, fx });
    const keys = (t0, t1) => {
      const d = t1 - t0;
      at(t0 + 0.15 * d, 'keys');
      if (e.act === 'keys2') { at(t0 + 0.55 * d, 'lock'); at(t0 + 0.75 * d, 'lock'); } else at(t0 + 0.65 * d, 'lock');
    };
    const press = (s) => { at(s, thing); if (e.what === 'bell') at(s + 0.1, 'bell'); };
    if (how === 'fast' || how === 'cross') {
      if (thing === 'lock') keys(0, T);
      else if (e.act === 'trunk') at(0.85 * T, 'trunk');
      else if (e.act === 'push') at(0.3 * T, thing);
      else if (e.act === 'pull') at(0.45 * T, thing);
      else press(0.5 * T);
    } else if (how === 'crouch') { at(0, 'crouch'); keys(e.a, e.b); at(e.b + 0.05, 'rustle'); }
    else if (how === 'nose') { at(0.45 * T, 'boop', {}, 'bip'); press(0.5 * T); }
    else if (how === 'elbow') { at(0.45 * T, 'elbow'); press(0.5 * T); }
    else if (how === 'foot') { at(0.35 * T, 'foot'); at(0.5 * T, thing); }
    else if (how === 'bum') { at(0.55 * T, 'bum', {}, 'pam'); at(0.58 * T, thing); }
    else if (how === 'head') { at(0.6 * T, 'clonc', {}, 'clonc'); at(0.9 * T, 'trunk'); }
    Q.sort((a, b) => a.s - b.s);
    this.actQ = { A, Q, i: 0 };
    if (!FALLBACK.has(how)) return;
    this.stickers.push({ how, what: e.what, pen: Math.max(0, T - ACT[e.act].fast) });
    if (how === 'bum') this.C.bumSide = this.rng() < 0.5 ? -1 : 1;
    const k = how === 'crouch' ? e.a + 0.5 * (e.b - e.a) : (how === 'head' ? 0.6 : 0.55) * T;
    this.shotAt(this.t + k, RANK[how], { why: how, st: { how, what: e.what, pen: Math.max(0, T - ACT[e.act].fast) } });
  }
  actTick() {
    const q = this.actQ;
    if (!q || this.sim.act !== q.A || !q.A) return;
    while (q.i < q.Q.length && q.Q[q.i].s <= q.A.t) this.fire(q.Q[q.i++]);
  }
  flushAct() {
    const q = this.actQ;
    if (q) while (q.i < q.Q.length) this.fire(q.Q[q.i++]);
    this.actQ = null;
  }
  fire(c) {
    this.cue(c.k, c.o);
    const W = this.W, H = this.H, u = this.u;
    if (c.fx === 'bip') this.pop('bip', W / 2, H - 2.05 * u, { size: 0.62 });
    else if (c.fx === 'pam') this.pop('pam', W / 2 + this.C.bumSide * 0.25 * W, 0.45 * H, { trauma: 0.35 });
    else if (c.fx === 'clonc') {
      const q = this.hands.target(this.sim, this.cam, this.world);
      this.pop('clonc', q ? clamp(q[0], 0.2 * W, 0.8 * W) : W / 2, q ? clamp(q[1], this.top + 0.12 * H, 0.6 * H) : 0.3 * H, { trauma: 0.4 });
    }
  }
  onWait(e) {
    const T = e.T || 4, who = e.who || 'vecina';
    if (e.what === 'chat') {
      // four lines while you stand there, one after the other; the last may follow you out (T is the sim's)
      const base = who === 'vecina' ? 'vecina' : 'chat';
      let at = Math.min(0.35, 0.05 * T);
      for (let i = 0; i < 4; i++) { const k = base + (i + 1); this.say(k, who, at, 'chat'); at += this.lineDur(k) + 0.3; }
    } else if (e.what === 'open') { this.say('door1', who, 0.3, 'open'); this.say('door2', who, 0.3 + this.lineDur('door1') + 0.35, 'open'); }
    else if (e.what === 'buzz') {
      if (this.buzzN++ === 0) { this.say('buzz1', who, 0.4, 'buzz'); this.say('buzz2', who, 0.4 + this.lineDur('buzz1') + 0.25, 'buzz'); }
      else this.say('buzzAgain', who, 0.4, 'buzz');
    } else if (e.what === 'ride') {
      if (!this.oldLift) this.cue('liftDoor', { open: false });
      this.cue('ride', { on: true, old: this.oldLift });
    }
  }
  say(key, who, d, kind) { this.lines.push({ key, who, kind, at: this.t + d, si: this.sim.si }); }
  lineDur(key) {
    const d = this.voiceDur ? this.voiceDur(key) : 0, txt = this.tx.say[key] || '';
    return d > 0 ? d : 0.4 + 0.058 * txt.length;
  }
  onHonk(e) {
    const n = e.n || 0, W = this.W, H = this.H, far = clamp((this.w ? this.w.y : 0) / 9);
    this.cue('honk', { n, far });
    this.pop(n % 3 === 2 ? 'honk2' : 'honk', n % 2 ? 0.2 * W : 0.8 * W, this.top + 0.1 * H, { size: lerp(1, 0.6, far) });
    const k = n === 0 ? 'driver1' : n === 2 ? 'driver2' : n === 5 ? 'driver3' : null;
    if (k) this.after(0.5, () => { this.caption = { key: k, t0: this.t, T: 1.2 + 0.05 * this.tx.say[k].length }; this.cue('voice', { key: k, who: 'driver', far }); });
  }
  fist(h) {
    const d = this.hands.hd[h] || this.hands.hd[0];
    return [clamp(d.x.x, 0.15 * this.W, 0.85 * this.W), clamp(d.y.x - 0.6 * this.u, this.top + 0.1 * this.H, this.H - 0.8 * this.u)];
  }
  onSlip(e) {
    const q = this.fist(e.hand);
    this.slipH.set(e.bag, e.hand);
    // on the stairs it hasn't hit anything yet: the panel shows where it lands
    if (!e.stairs) this.pop('plof', q[0], q[1], { trauma: 0.5 });
    this.cue('slip', { kg: this.sim.bags[e.bag].kg, stairs: !!e.stairs });
  }
  onBreak(e) {
    const h = this.slipH.get(e.bag) ?? 0, glass = this.world.bagLook(e.bag) !== 'huevos';
    this.after(0.35, () => {
      this.pop(glass ? 'crac' : 'chof', this.fist(h)[0], this.H - 1.1 * this.u, { trauma: 0.7 });
      this.cue('break', { glass });
    });
  }
  onEnd(e) {
    // made it: whatever she was saying, she finishes (over the stamp if need be); a fall shuts everyone up
    this.actQ = null; this.lines = e.why === 'arrive' ? this.lines.filter((L) => L.kind === 'chat') : []; this.stickers = [];
    if (e.why === 'arrive') this.startArrive(); else this.startTumble();
  }
  pop(k, x, y, { size = 1, trauma = 0 } = {}) {
    this.pops.push({ k, txt: this.tx.pop[k] || k, x, y, t0: this.t, size, rot: (this.rng() - 0.5) * 0.32, seed: (this.rng() * 1e9) >>> 0 });
    if (this.pops.length > 8) this.pops.shift();
    if (trauma && !this.calm) this.C.trauma = Math.min(1, this.C.trauma + trauma);
  }

  // ---------- time ----------
  // `ahead` is how far the clock has run past the last simulation step: walking is carried on by it
  tick(dt, ahead = 0) {
    const sim = this.sim, C = this.C;
    dt = clamp(dt || 0, 0, 0.1); this.dt = dt;
    this.t = sim.end ? this.t + dt : sim.t + ahead;
    if (dt > 0) this.world.update(sim, dt);
    this.runLater();
    this.endTick(dt);
    const w = (this.w = this.where(ahead));
    if (w.L.i !== this.legI) {
      if (this.legI >= 0 && !this.still) { this.whip = { t0: this.t, turn: Math.sign(w.L.turn) || 1, old: this.view }; this.cue('whoosh', { turn: this.whip.turn }); }
      this.legI = w.L.i;
    }
    if (this.whip && this.t - this.whip.t0 > 0.44) this.whip = null;
    this.dark = this.world.darkness(sim);
    this.camera(w, dt);
    this.hands.update(sim, dt, this.cam, this.world);
    this.feet(w);
    this.actTick();
    this.lineTick();
    this.stickerTick();
    this.readTick(dt);
    C.trauma = Math.max(0, C.trauma - 1.8 * dt);
    if (this.caption && this.t > this.caption.t0 + this.caption.T) this.caption = null;
    this.pops = this.pops.filter((p) => this.t - p.t0 < 1.2);
    this.fresh = false;
  }
  frame(g, dt, ahead = 0) { this.tick(dt, ahead); this.draw(g); }
  walking() {
    const sim = this.sim, st = sim.step, k = this.w && this.w.R.kind;
    return !sim.end && !sim.rest && !!st && st.k === 'walk' && k !== 'trunk' && k !== 'cabinOut';
  }
  // where the eye is: the simulation's position, carried on by `ahead` while walking
  where(ahead) {
    const sim = this.sim, w = this.world.where(sim);
    w.s = sim.s;
    if (ahead > 0 && this.walking.call({ sim, w })) {
      const d = Math.min(sim.speed() * ahead, Math.max(0, sim.step.len - sim.sp));
      w.s += d; w.z += d; w.y = this.world.floorY(w.R, w.z);
    }
    return w;
  }
  feet(w) {
    const sim = this.sim, stairs = w.R.kind === 'flight', n = Math.floor(w.s / (stairs ? 0.32 : 0.75) + 0.5);
    if (this.stepN !== null && n !== this.stepN && this.walking()) this.cue('step', { stairs, kg: sim.carried(), dark: this.dark > 0.5, foot: n & 1 });
    this.stepN = n;
  }

  // ---------- the eye ----------
  // what the eye is drawn to: the thing being pressed, the next one coming up, who's talking. [x, y, z] with .wg
  gaze(w) {
    const sim = this.sim, A = sim.act, st = sim.step, Wd = this.world;
    if (sim.end || sim.rest || !st) return null;
    let P = null, wg = 0;
    if (A) { P = this.hands.targetW(sim, Wd); wg = 1; }
    else if (st.k === 'walk') {
      for (const n of sim.ahead(4)) {
        if (n.st.k === 'wait' || n.st.k === 'end') break;
        if (n.st.k !== 'act') continue;
        if (n.d < 1.4) { P = this.hands.targetW(sim, Wd, n.i); wg = smooth(1 - n.d / 1.4); }
        break;
      }
    } else if (st.k === 'wait') {
      const R = Wd.W.rooms[st.room], E = R.exit || {}, y0 = R.y0;
      const q = st.what === 'arrive' ? [0, y0 + 2.27, R.zE ?? E.Z, 0.55]
        : st.what === 'chat' ? [0, y0 + 1.55, E.Z + 0.35, 1]
        : st.what === 'open' ? [0, y0 + 1.5, E.Z, 0.8]
        : st.what === 'buzz' ? [-0.86, 1.3, R.zP, 0.9] : null;
      if (q && Number.isFinite(q[2])) { P = [q[0], q[1], q[2]]; P.leg = R.leg; wg = q[3]; }
    }
    if (!P || P.leg !== w.L.i) return null;
    P.wg = wg;
    return P;
  }
  kick(a) { if (!this.calm) this.C.trauma = Math.min(1, this.C.trauma + a); }
  camera(w, dt) {
    const sim = this.sim, C = this.C, A = sim.act, R = w.R, cam = this.cam, L = this.world.lift, t = this.t;
    const snap = this.fresh || !this.view, D = (a, b, r) => (snap ? b : damp(a, b, r, dt));
    const trunk = R.kind === 'trunk', ey = w.y + EYE, ez = w.z - (trunk ? 0.25 : 0);
    const P = this.gaze(w), p = A ? clamp(A.t / A.T) : 0, r = A ? reach3(p) : 0;
    let base = trunk ? -0.2 : R.kind === 'flight' ? 0.16 : 0, ox = 0, oy = 0, oz = 0;
    if (A && A.how === 'nose' && P) {
      // lunge until the button meets the tip of the nose, which sits low on the screen
      const dx = P[0], dy = P[1] - ey, dz = P[2] - ez, d = Math.hypot(dx, dy, dz) || 1, f = cam.f0 * this.zoom;
      const up = (0.16 * (this.H - 1.9 * this.u - (this.H * cam.vp + Math.tan(-0.3) * f))) / f;
      ox = r * (dx - (0.16 * dx) / d); oy = r * (dy - (0.16 * dy) / d + up); oz = r * (dz - (0.16 * dz) / d);
    } else if (A && A.how === 'head') { oy = -0.3 * r; oz = 0.2 * r; }
    else if (A && A.how === 'bum') oz = 0.12 * smooth((p - 0.55) / 0.45);
    else if (A && A.how === 'crouch') {
      const k = A.t < A.a ? smooth(A.t / Math.max(0.01, A.a)) : A.t < A.b ? 1 : 1 - smooth((A.t - A.b) / Math.max(0.01, A.T - A.b));
      oy = -0.65 * k;
    }
    const Rs = sim.rest;
    if (Rs) {
      const k = clamp(Rs.t / (Rs.T || 1));
      if (Rs.phase === 'down') { oy -= 0.3 * Math.sin(Math.PI * k); base = -0.25; } else base = Rs.phase === 'idle' ? -0.12 : -0.2;
    }
    if (sim.grab) oy -= (trunk ? 0.12 : 0.22) * Math.sin(Math.PI * clamp(sim.grab.t / T_PICK));
    if (L.riding) oy += -0.035 * bump(L.rideP, 0, 0.14) + 0.03 * bump(L.rideP, 0.86, 1);
    let yaw = 0, look = base;
    if (P) {
      const dx = P[0] - C.ox, dy = P[1] - ey - C.oy, dz = P[2] - ez - C.oz, lim = A && A.how === 'nose' ? 1.3 : 0.8;
      yaw = clamp(Math.atan2(dx, Math.max(dz, 0.02)), -lim, lim) * P.wg;
      look = lerp(base, clamp(Math.atan2(dy, Math.max(0.3, Math.hypot(dx, dz))) * 0.8, -0.5, 0.45), P.wg);
    }
    if (A && A.how === 'nose') look = -0.3;
    else if (A && A.how === 'head') look = -0.45;
    else if (A && A.how === 'foot') { look = -0.4; yaw *= 1 - 0.5 * r; }
    else if (A && A.how === 'bum') yaw = C.bumSide * 0.75;
    if (sim.end && sim.end.why === 'tumble') look = -0.45;
    C.ox = D(C.ox, ox, 12); C.oy = D(C.oy, oy, 12); C.oz = D(C.oz, oz, 12);
    C.yaw = D(C.yaw, yaw, 8); C.look = D(C.look, look, 8);
    // the gait: a dip each step (deeper with more weight), a sway from foot to foot
    const walk = this.walking(), stairs = R.kind === 'flight', calmK = this.still ? 0 : this.calm ? 0.35 : 1;
    C.walkK = D(C.walkK, walk ? 1 : 0, 6);
    const ph = (w.s / (stairs ? 0.32 : 0.75)) * Math.PI, c1 = Math.cos(ph), wk = C.walkK * calmK;
    const by = -(stairs ? 0.01 : 0.012 + 0.018 * clamp(sim.carried() / 40)) * (1 - Math.cos(2 * ph)) * wk;
    const bx = -c1 * (stairs ? 0.025 : 0.02) * wk, br = -c1 * (stairs ? 0.008 : 0.006) * wk;
    // leaning away from the heavier hand, and breathing harder the more tired the hands are
    const l0 = sim.load(0), l1 = sim.load(1), tot = l0 + l1;
    C.lean = D(C.lean, tot > 0 ? -((l1 - l0) / tot) * 0.03 * clamp(tot / 15) : 0, 3);
    const mf = Math.max(sim.H[0].MF, sim.H[1].MF), idle = !walk && !A;
    const breath = Math.sin(t * (idle ? 2.4 : 1.8)) * 0.006 * (1 + 2 * mf) * (idle ? 1.8 : 1) * calmK;
    let vx = 0, vy = 0;
    if (L.riding) {
      vy = noise1(t * 31, 3) * 0.004 * calmK; vx = noise1(t * 27, 7) * 0.002 * calmK;
      if (!C.riding) { C.riding = true; C.jolt = false; this.kick(0.25); }
      if (!C.jolt && L.rideP >= 0.97) { C.jolt = true; this.kick(0.25); }
    } else C.riding = false;
    const X = C.ox + bx + vx, Y = ey + C.oy + by + breath + vy, Z = ez + C.oz;
    cam.set(X, Y, Z, C.look, this.zoom, 0, C.yaw);
    this.roll = C.lean + br;
    this.view = { x: X, y: Y, z: Z, look: C.look, yaw: C.yaw, w };
  }

  // ---------- the frame ----------
  // the view drawn this instant: mid whip-pan it is not quite the true one
  drawnView() {
    const v = this.view, wp = this.whip, roll = this.roll || 0;
    if (!wp) return { ...v, roll };
    const e = this.t - wp.t0;
    if (e < 0.14 && wp.old) return { ...wp.old, yaw: lerp(wp.old.yaw, wp.turn * 0.785, ease.inQuad(e / 0.14)), roll };
    return { ...v, yaw: lerp(-wp.turn * 0.785, v.yaw, ease.outCubic(clamp((e - 0.14) / 0.3))), roll };
  }
  draw(g) {
    if (!this.view) return;
    const W = this.W, H = this.H, C = this.C, cam = this.cam, sim = this.sim, t = this.t;
    const sh = this.calm ? 0 : C.trauma * C.trauma;
    g.save();
    if (sh > 0) {
      const m = 0.035 * Math.min(W, H) * sh;
      g.translate(W / 2 + noise1(t * 23, 1) * m, H * 0.6 + noise1(t * 23, 2) * m);
      g.rotate(noise1(t * 19, 3) * 0.035 * sh); g.translate(-W / 2, -H * 0.6);
    }
    const v = this.drawnView(), keep = [cam.x, cam.y, cam.z, cam.look, cam.yaw];
    g.save();
    if (v.roll) { g.translate(W / 2, H * 0.6); g.rotate(v.roll); g.translate(-W / 2, -H * 0.6); }
    cam.set(v.x, v.y, v.z, v.look, this.zoom, 0, v.yaw);
    this.rooms.draw(g, cam, sim, v.w, this.hooks);
    const dark = this.dark || 0;
    if (dark > 0.005) { g.fillStyle = rgba(PAL.night, dark); g.fillRect(-W, -H, 3 * W, 3 * H); }
    this.rooms.runGlows(g, dark);
    g.restore();
    cam.set(keep[0], keep[1], keep[2], keep[3], this.zoom, 0, keep[4]);
    const dy = this.yawD == null ? 0 : v.yaw - this.yawD;
    this.yawD = v.yaw;
    this.smear(g, dy);
    this.drawHands(g, dark);
    if (this.inset) this.drawInset(g);
    // the photo leaves the sticker off, and puts it back on where it fits
    const snap = this.snapDue();
    if (!snap) this.drawSticker(g);
    this.drawPops(g);
    this.drawSpeech(g);
    this.drawCaption(g);
    if (snap) { this.snapTick(g); this.drawSticker(g); }
    this.drawReadouts(g);
    this.drawStamp(g);
    g.restore();
  }
  // a fast turn of the head smears what it sweeps past
  smear(g, dyaw) {
    const cv = g.canvas, dt = this.dt;
    if (this.calm || !cv || !cv.width || dt <= 0) return;
    const v = dyaw / dt;
    if (!(Math.abs(v) > 2.5)) return;
    const cw = cv.width, ch = cv.height;
    if (!this.smearC || this.smearC.width !== cw || this.smearC.height !== ch) this.smearC = canvas(cw, ch);
    const s = this.smearC.getContext('2d'), off = clamp(Math.abs(v) / 9) * 0.08 * cw * Math.sign(v);
    s.globalCompositeOperation = 'copy'; s.drawImage(cv, 0, 0); s.globalCompositeOperation = 'source-over';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    for (const [k, a] of [[0.34, 0.32], [0.67, 0.22], [1, 0.14]]) { g.globalAlpha = a; g.drawImage(this.smearC, off * k, 0); }
    g.restore();
  }
  // your hands, dimmed with the stairwell when the light goes out (only them, not the air around them)
  drawHands(g, dark) {
    const cv = g.canvas;
    if (dark <= 0.005 || !cv || !cv.width) { this.hands.draw(g, this.sim); return; }
    const cw = cv.width, ch = cv.height, W = this.W, H = this.H;
    if (!this.layer || this.layer.width !== cw || this.layer.height !== ch) this.layer = canvas(cw, ch);
    const l = this.layer.getContext('2d');
    l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, cw, ch);
    l.setTransform(cw / W, 0, 0, ch / H, 0, 0);
    this.hands.draw(l, this.sim);
    l.globalCompositeOperation = 'source-atop'; l.fillStyle = rgba(PAL.night, 0.75 * dark); l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'source-over';
    g.drawImage(this.layer, 0, 0, W, H);
  }

  // ---------- the scale's readouts, one over each fist ----------
  readTick(dt) {
    const hs = this.hands, u = this.u, w = 1.3 * u, h = 0.86 * u;
    for (let i = 0; i < 2; i++) {
      const o = this.ro[i], [hx, hy] = hs.home(i), dx = hs.hd[i].x.x, dy = hs.hd[i].y.x;
      const x = clamp(hx + 0.3 * (dx - hx), w / 2 + 6, this.W - w / 2 - 6);
      const y = Math.max(this.top + h / 2 + 8, hs.baseY - (0.95 * u + h / 2));
      o.x = this.fresh ? x : damp(o.x, x, 10, dt); o.y = this.fresh ? y : damp(o.y, y, 10, dt);
      o.a = lerp(1, 0.35, clamp(Math.hypot(dx - hx, dy - hy) / (1.5 * u)));
      if (this.sim.end) o.a *= 1 - smooth((this.t - this.endT - 0.2) / 0.4);
    }
  }
  drawReadouts(g) {
    const sim = this.sim, u = this.u, w = 1.3 * u, h = 0.86 * u, tx = this.tx;
    const ghost = tone(PAL.lcd, PAL.seg, 0.08);
    for (let i = 0; i < 2; i++) {
      const o = this.ro[i];
      if (!(o.a > 0.01)) continue;
      const load = sim.load(i), cap = sim.cap(i), m = cap - load, n = sim.H[i].bags.length;
      const x = o.x - w / 2, y = o.y - h / 2;
      g.save(); g.globalAlpha = o.a;
      g.fillStyle = 'rgba(28,22,14,0.3)'; rrect(g, x + 0.03 * u, y + 0.07 * u, w, h, 0.12 * u); g.fill();
      g.fillStyle = PAL.bezel; rrect(g, x, y, w, h, 0.12 * u); g.fill();
      g.strokeStyle = PAL.bezelDk; g.lineWidth = Math.max(1, 0.035 * u); g.stroke();
      const p = 0.08 * u, lw = 0.34 * u, wx = x + p, wy = y + p, ww = w - 2 * p - lw, wh = h - 2 * p;
      g.fillStyle = PAL.lcd; rrect(g, wx, wy, ww, wh, 0.05 * u); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(wx + 0.03 * u, wy, ww - 0.06 * u, 0.035 * u);
      // the load, blinking as it nears what the hand can take; and that limit, which drops as it tires
      const warn = n > 0 && m < 3, blink = warn && Math.floor(this.t / (m < 1.5 ? 0.125 : 0.25)) % 2 === 1;
      const sh = wh * 0.36, sw = seg7w(3, sh), sx = wx + ww - 0.07 * u - sw;
      seg7(g, fmt(Math.max(0, load), '.').padStart(4, ' '), sx, wy + wh * 0.08, sh, blink ? ghost : PAL.seg, ghost);
      seg7(g, fmt(Math.max(0, cap), '.').padStart(4, ' '), sx, wy + wh * 0.56, sh, PAL.seg, ghost);
      g.fillStyle = PAL.inkSoft; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.font = `700 ${Math.max(9, 0.17 * u)}px ${TEXT}`;
      g.fillText(tx.kg, wx + ww + 0.06 * u, wy + wh * 0.26);
      g.font = `700 ${Math.max(8, 0.14 * u)}px ${TEXT}`;
      g.fillText(tx.max, wx + ww + 0.06 * u, wy + wh * 0.74);
      if (warn) {
        ell(g, x + w - 0.13 * u, y + 0.13 * u, 0.045 * u, 0.045 * u);
        g.fillStyle = blink ? PAL.red : tone(PAL.red, PAL.bezel, 0.6); g.fill();
      }
      g.restore();
    }
  }

  // ---------- the thermal sticker the scale prints each time no hand is free ----------
  stickerTick() {
    if (this.sticker && this.t - this.sticker.t0 >= 2.3) this.sticker = null;
    if (this.sticker || !this.stickers.length) return;
    const n = this.stickers.shift();
    this.sticker = { ...n, t0: this.t, rot: (this.rng() < 0.5 ? -1 : 1) * lerp(0.05, 0.085, this.rng()), seed: (this.rng() * 1e9) >>> 0, img: null };
    this.cue('sticker', { how: n.how });
  }
  stickerImg(s) {
    const d = Math.min(2, this.dpr || 1), lw = Math.round(Math.min(0.64 * this.W, 320)), lh = Math.round(0.46 * lw), tx = this.tx;
    const c = canvas(lw * d, lh * d), g = c.getContext('2d'), r = 0.03 * lw;
    c.lw = lw; c.lh = lh;
    g.scale(d, d);
    g.fillStyle = PAL.label; rrect(g, 0, 0, lw, lh, r); g.fill();
    g.save(); g.clip();
    const bh = 0.2 * lh;
    g.fillStyle = PAL.brand; g.fillRect(0, 0, lw, bh);
    g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, lh - 0.04 * lh, lw, 0.04 * lh);
    g.restore();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = PAL.label; g.font = `800 ${0.64 * bh}px ${FACE}`;
    g.fillText(tx.band, lw / 2, bh * 0.55);
    const how = tx.how[s.how] || s.how;
    let fs = 0.3 * lh;
    g.font = `800 ${fs}px ${FACE}`;
    const tw = g.measureText(how).width;
    if (tw > 0.9 * lw) { fs *= (0.9 * lw) / tw; g.font = `800 ${fs}px ${FACE}`; }
    g.fillStyle = PAL.ink; g.fillText(how, lw / 2, 0.435 * lh);
    g.font = `600 ${0.1 * lh}px ${TEXT}`; g.fillStyle = PAL.inkSoft;
    g.fillText(tx.what[s.what] || '', lw / 2, 0.62 * lh);
    // a barcode, and what it cost you
    const rnd = mulberry32(s.seed || 1), y0 = 0.72 * lh, bH = 0.17 * lh, q = 0.0042 * lw;
    g.fillStyle = PAL.ink;
    for (let x = 0.06 * lw; x < 0.4 * lw; ) { const bw = (1 + Math.floor(rnd() * 3)) * q; g.fillRect(x, y0, bw, bH); x += bw + (1 + Math.floor(rnd() * 2)) * q; }
    g.textAlign = 'right';
    g.font = `700 ${0.085 * lh}px ${TEXT}`; g.fillStyle = PAL.inkSoft;
    g.fillText(tx.time, 0.94 * lw, 0.75 * lh);
    g.font = `800 ${0.16 * lh}px ${FACE}`; g.fillStyle = PAL.red;
    g.fillText(`+${fmt(s.pen, tx.dec)} ${tx.sec}`, 0.94 * lw, 0.87 * lh);
    g.strokeStyle = 'rgba(28,29,26,0.12)'; g.lineWidth = 1; rrect(g, 0.5, 0.5, lw - 1, lh - 1, r); g.stroke();
    return c;
  }
  stickerBox() {
    const s = this.sticker;
    if (!s) return null;
    const lw = Math.round(Math.min(0.64 * this.W, 320)), lh = Math.round(0.46 * lw);
    return { x: this.W / 2 - lw / 2, y: this.top + 0.035 * this.H, w: lw, h: lh };
  }
  drawSticker(g) {
    const s = this.sticker;
    if (!s) return;
    if (!s.img) s.img = this.stickerImg(s);
    const c = s.img, lw = c.lw, lh = c.lh, e = this.t - s.t0, top = this.top + 0.035 * this.H;
    let sc = 1.08, rot = 0, dy = 0, a = 1, feed = 1;
    if (e < 0.25) feed = ease.outCubic(e / 0.25);                         // it feeds out of the printer
    else if (e < 0.37) { const k = ease.outBack((e - 0.25) / 0.12); sc = lerp(1.08, 1, k); rot = s.rot * clamp(k); }   // slapped on
    else if (e < 1.97) { sc = 1; rot = s.rot; }
    else { const k = ease.inCubic(clamp((e - 1.97) / 0.3)); sc = 1; rot = s.rot + k * 0.3 * Math.sign(s.rot); dy = -k * 0.4 * lh; a = 1 - k; }
    const lift = clamp((sc - 1) / 0.08);
    g.save(); g.globalAlpha = a;
    if (e < 0.25) { g.beginPath(); g.rect(0, top, this.W, lh * 1.3); g.clip(); }
    g.translate(this.W / 2, top + lh / 2 + dy - (1 - feed) * lh);
    g.rotate(rot); g.scale(sc, sc);
    g.fillStyle = `rgba(24,18,10,${0.22 + 0.1 * lift})`; rrect(g, -lw / 2 + 2 + 5 * lift, -lh / 2 + 4 + 8 * lift, lw, lh, 0.03 * lw); g.fill();
    g.drawImage(c, -lw / 2, -lh / 2, lw, lh);
    g.restore();
  }

  // ---------- comic pops ----------
  drawPops(g) {
    for (const p of this.pops) {
      const e = this.t - p.t0;
      if (e < 0 || e > 1.13) continue;
      const sc = e < 0.12 ? 1.25 * ease.outQuad(e / 0.12) : e < 0.18 ? lerp(1.25, 1, (e - 0.12) / 0.06) : 1;
      const fs = 0.46 * this.u * p.size;
      g.save(); g.globalAlpha = e < 0.88 ? 1 : clamp(1 - (e - 0.88) / 0.25);
      g.font = `800 ${fs}px ${FACE}`;
      const tw = g.measureText(p.txt).width, rx = tw * 0.62 + fs * 0.4, ry = fs * 0.95;
      g.translate(clamp(p.x, rx * 1.25, this.W - rx * 1.25), clamp(p.y, this.top + ry * 1.3, this.H - ry * 1.3));
      g.rotate(p.rot); g.scale(sc, sc);
      const rnd = mulberry32(p.seed), n = 11, pts = [];
      for (let i = 0; i < 2 * n; i++) {
        const an = (i / (2 * n)) * TAU + (rnd() - 0.5) * 0.2, k = i % 2 ? 0.74 + rnd() * 0.08 : 1.1 + rnd() * 0.32;
        pts.push(Math.cos(an) * rx * k, Math.sin(an) * ry * k);
      }
      poly(g, pts);
      g.fillStyle = POP.fill; g.fill();
      g.lineJoin = 'round'; g.lineWidth = Math.max(2, fs * 0.09); g.strokeStyle = POP.ink; g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = Math.max(2, fs * 0.15); g.strokeText(p.txt, 0, fs * 0.05);
      g.fillStyle = POP.text; g.fillText(p.txt, 0, fs * 0.05);
      g.restore();
    }
  }

  // ---------- what people say ----------
  lineTick() {
    const sim = this.sim, keep = [];
    for (const L of this.lines) {
      // a chat goes on after you walk off; everything else is about the moment it was said in
      if (L.kind !== 'chat' && (sim.end || L.si !== sim.si)) continue;
      if (L.at > this.t) { keep.push(L); continue; }
      const txt = this.tx.say[L.key];
      if (!txt || this.t - L.at > 1.5) continue;
      // you've walked on and she hasn't stopped: calling up the stairwell after you
      const behind = L.si !== sim.si && L.who === 'vecina', T = Math.max(0.9 + 0.055 * txt.length, this.lineDur(L.key) + 0.35);
      this.speech.set(L.who, { ...L, free: L.si !== sim.si, txt, t0: this.t, T, room: sim.steps[L.si].room });
      this.cue('voice', { key: L.key, who: L.who, behind });
    }
    this.lines = keep;
    for (const [k, b] of this.speech) if (this.t > b.t0 + b.T) this.speech.delete(k);
  }
  // where a bubble points: the face at the door, the door itself, the intercom's grille
  anchor(b) {
    const R = this.world.W.rooms[b.room], E = (R && R.exit) || {};
    if (!R) return null;
    let P;
    if (b.kind === 'buzz') P = [-0.86, 1.3, R.zP];
    else if (b.kind === 'open') P = [0, R.y0 + 1.5, E.Z];
    else P = [0, R.y0 + 1.5, E.Z + (b.who === 'suegra' ? 0.32 : 0.38)];
    if (this.whip) return null;
    if (b.free) return false;
    if (!P.every(Number.isFinite) || R.leg !== this.w.L.i) return null;
    const q = this.cam.p(P[0], P[1], P[2]);
    return q && q[0] > 0 && q[0] < this.W && q[1] > this.top && q[1] < this.H ? [q[0], q[1]] : false;
  }
  drawSpeech(g) {
    if (!this.speech.size) return;
    const W = this.W, fs = clamp(0.23 * this.u, 14, 24), pad = 0.55 * fs, lh = 1.22 * fs;
    let stack = 0;
    for (const b of this.speech.values()) {
      const q = this.anchor(b);
      if (q === null) continue;
      const e = this.t - b.t0, a = clamp(e / 0.12) * clamp((b.t0 + b.T - this.t) / 0.2), sc = lerp(0.85, 1, ease.outBack(clamp(e / 0.18)));
      g.save();
      g.font = `600 ${fs}px ${TEXT}`;
      const lines = wrap(g, b.txt, 0.7 * W), tw = Math.max(...lines.map((l) => g.measureText(l).width));
      const bw = tw + 2 * pad, bh = lines.length * lh + 2 * pad - (lh - fs);
      const tail = q ? 1.3 * fs : 0;
      let x = q ? clamp(q[0] - bw / 2, 10, W - bw - 10) : W / 2 - bw / 2;
      let y = q ? q[1] - tail - bh : this.top + 0.2 * this.H + stack;
      y = Math.max(this.top + 10 + stack, y);
      stack = y + bh + 8 - this.top - 10;
      g.globalAlpha = a;
      g.translate(x + bw / 2, y + bh); g.scale(sc, sc); g.translate(-(x + bw / 2), -(y + bh));
      this.bubble(g, x, y, bw, bh, q, b.kind, fs);
      g.fillStyle = POP.ink; g.textAlign = 'left'; g.textBaseline = 'top';
      lines.forEach((l, i) => g.fillText(l, x + pad, y + pad + i * lh));
      g.restore();
    }
  }
  // a speech balloon with its tail cut into the bottom edge; dashed from behind a door, a crackle from the intercom
  bubble(g, x, y, w, h, q, kind, fs) {
    const r = 0.6 * fs, L = x, R = x + w, T = y, B = y + h, tb = 0.4 * fs;
    g.lineJoin = 'round'; g.lineWidth = Math.max(2, 0.12 * fs); g.strokeStyle = POP.ink;
    if (q && kind === 'buzz') {
      const bx = clamp(q[0], L + r + tb, R - r - tb), dx = q[0] - bx, dy = q[1] - B;
      g.beginPath(); g.moveTo(bx, B);
      for (let i = 1; i <= 5; i++) g.lineTo(bx + (dx * i) / 5 + (i < 5 ? (i % 2 ? 1 : -1) * 0.32 * fs : 0), B + (dy * i) / 5);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(L + r, T); g.arcTo(R, T, R, B, r); g.arcTo(R, B, L, B, r);
    if (q && kind !== 'buzz' && q[1] > B) {
      const bx = clamp(q[0], L + r + tb, R - r - tb);
      g.lineTo(bx + tb, B); g.lineTo(q[0], q[1]); g.lineTo(bx - tb, B);
    }
    g.arcTo(L, B, L, T, r); g.arcTo(L, T, R, T, r); g.closePath();
    g.fillStyle = '#ffffff'; g.fill();
    if (kind === 'open') g.setLineDash([0.5 * fs, 0.32 * fs]);
    g.stroke(); g.setLineDash([]);
  }
  // the driver you've blocked in, shouting up from the street
  drawCaption(g) {
    const c = this.caption, txt = c && this.tx.say[c.key];
    if (!txt) return;
    const e = this.t - c.t0, fs = clamp(0.22 * this.u, 13, 22), pad = 0.5 * fs, tag = this.tx.street, th = 0.72 * fs;
    g.save();
    g.globalAlpha = clamp(e / 0.15) * clamp((c.t0 + c.T - this.t) / 0.25);
    g.font = `italic 700 ${fs}px ${TEXT}`;
    const lines = wrap(g, txt, Math.min(0.6 * this.W, 420)), tw = Math.max(...lines.map((l) => g.measureText(l).width));
    g.font = `800 ${th}px ${FACE}`;
    const bw = Math.max(tw, g.measureText(tag).width) + 2 * pad, bh = th + 0.4 * fs + lines.length * 1.2 * fs + 2 * pad - 0.2 * fs;
    const sb = this.stickerBox(), x = 12;
    let y = this.top + 0.035 * this.H;
    if (sb && x + bw > sb.x - 8) y = sb.y + sb.h + 14;
    g.translate(x, y + lerp(-8, 0, ease.outCubic(clamp(e / 0.2)))); g.rotate(-0.018);
    g.fillStyle = 'rgba(24,18,10,0.25)'; g.fillRect(3, 4, bw, bh);
    g.fillStyle = CAPTION; g.fillRect(0, 0, bw, bh);
    g.lineWidth = Math.max(1.5, 0.1 * fs); g.strokeStyle = POP.ink; g.strokeRect(0, 0, bw, bh);
    g.fillStyle = POP.ink; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(tag, pad, pad);
    g.font = `italic 700 ${fs}px ${TEXT}`;
    lines.forEach((l, i) => g.fillText(l, pad, pad + th + 0.4 * fs + i * 1.2 * fs));
    g.restore();
  }

  // ---------- the endings ----------
  // you made it: everything goes down at the door, with care, and then you look at what the handles did to your palms
  startArrive() {
    const sim = this.sim, prev = [sim.H[0].bags.slice(), sim.H[1].bags.slice()], n = prev[0].length + prev[1].length;
    const T = 1.3 * tDown(n);
    this.endT = this.t;
    sim.passQ.length = 0; sim.grabQ.length = 0; sim.pass = null; sim.act = null; sim.grab = null;
    sim.rest = { phase: 'down', t: 0, T, prev, seq: [], auto: false, reason: 'arrive' };
    this.E = { kind: 'arrive', t0: this.t, T, n };
    this.cue('rustle', { n });
    this.shotAt(this.t + T + 0.95, 1, { why: 'arrive' });
  }
  stamp(good) {
    this.E.stamp = { t0: this.t, good };
    // the stamp gets the frame to itself: whatever is still shouting fades out under its slam
    for (const p of this.pops) p.t0 = Math.min(p.t0, this.t - 1);
    this.cue('stamp', { good });
    this.after(0.12, () => this.kick(good ? 0.3 : 0.45));
  }
  endTick(dt) {
    const E = this.E, sim = this.sim;
    if (!E) return;
    const e = this.t - E.t0;
    if (E.kind === 'arrive') {
      const r = sim.rest;
      if (r && r.phase === 'down') {
        r.t = Math.min(r.T, r.t + dt);
        if (r.t >= r.T) {
          for (const x of sim.H) { for (const i of x.bags) sim.bags[i].at = 'floor'; x.bags.length = 0; }
          r.phase = 'idle';
          this.hands.events([{ type: 'rested' }], sim);
          this.cue('thud', { n: E.n }); this.cue('sigh');
        }
      }
      if (!E.stamp && e >= E.T + 1.05) this.stamp(true);
      if (e >= E.T + 2.3) this.done = true;
      return;
    }
    if (this.inset) this.tumbleTick(this.inset, dt);
    if (!E.stamp && e >= 2.5) this.stamp(false);
    if (e >= 3.4) this.done = true;
  }

  // you didn't: one bag goes, and a comic panel shows it taking the stairs the quick way
  startTumble() {
    const sim = this.sim, bag = sim.end.bag ?? 0, look = this.world.bagLook(bag), b = sim.bags[bag] || {};
    const port = this.H > 1.1 * this.W;
    this.endT = this.t;
    this.E = { kind: 'tumble', t0: this.t };
    this.cue('tumble'); this.kick(0.8);
    this.inset = {
      t0: this.t, bag, look, broken: !!b.broken, glass: look !== 'huevos', j: 0, landT: -1, spill: [], puffs: [], puddle: null,
      asp: port ? (0.88 * this.W) / (0.36 * this.H) : 1.35, rnd: mulberry32(bag * 7919 + 13),
    };
    this.after(0.2, () => this.pop('nooo', this.W / 2, this.top + 0.17 * this.H, { size: 1.2 }));
    this.shotAt(this.t + 1.75, 9, { why: 'tumble' });
  }
  // four hops down the flight, a pop on every landing, the shopping going everywhere
  tumbleTick(I, dt) {
    const e = this.t - I.t0, asp = I.asp;
    let t = HOP0;
    for (let j = 0; j < HOPS.length; j++) {
      const [k, d] = HOPS[j];
      t += d;
      if (e >= t && I.j <= j) {
        I.j = j + 1; I.landT = t;
        const last = j === HOPS.length - 1, [x, y] = stairAt(k, asp), rnd = I.rnd;
        const pk = last ? (I.broken ? (I.glass ? 'crac' : 'chof') : 'cataplof') : j === 1 ? 'plaf' : 'plof';
        // the sound goes up and behind it, where it just was, so the bag itself stays in sight
        const q = this.insetPt(x + (last ? 0.24 : 0.17), y - (last ? 0.4 : 0.34));
        this.pop(pk, q[0], q[1], { size: last ? 0.95 : 0.6, trauma: last ? 0.55 : 0.22 });
        this.cue('hop', { j, last, broken: I.broken && last, glass: I.glass });
        I.puffs.push({ x, y, t0: t, big: last });
        const sp = SPILL[I.look] || [];
        for (let n = [0, 2, 3, 4][j]; sp.length && n-- > 0;) {
          const [col, sh] = sp[(n + j) % sp.length];
          I.spill.push({ x: x + (rnd() - 0.5) * 0.05, y: y - 0.06, vx: -(0.2 + 0.75 * rnd()), vy: -(0.5 + 0.7 * rnd()), a: rnd() * TAU, va: (rnd() - 0.5) * 16, col, sh, rest: false });
        }
        if (last && I.broken) I.puddle = { x: x - 0.03, y, t0: t, col: PUDDLE[I.look] || '#c9b98f' };
      }
    }
    for (const s of I.spill) {
      if (s.rest) continue;
      const px = s.x;
      s.vy += 3.2 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt;
      if (s.x < 0.03) { s.x = 0.03; s.vx = Math.abs(s.vx) * 0.3; }
      const fy = profY(s.x, asp);
      if (s.y > fy + 0.01 && profY(px, asp) > fy) { s.x = px; s.vx *= -0.3; continue; }   // ran into a riser
      if (s.y >= fy) {
        s.y = fy;
        if (s.vy > 0.25) { s.vy *= -0.35; s.vx *= 0.75; s.va *= 0.6; } else s.vy = 0;
        if (!s.vy) {
          s.vx *= 1 - Math.min(1, (s.sh === 'o' ? 1.1 : 7) * dt);
          // round things roll; the rest topple onto a face
          if (s.sh === 'o') s.va = s.vx / 0.022; else { s.va = 0; s.a = damp(s.a, Math.round(s.a / (Math.PI / 2)) * (Math.PI / 2), 14, dt); }
          if (Math.abs(s.vx) < 0.01) s.rest = true;
        }
      }
    }
  }
  // where the panel sits: it slides up from below and settles at a slight tilt
  insetGeo() {
    const I = this.inset, W = this.W, H = this.H;
    let w, h, x, y;
    if (H > 1.1 * W) { w = 0.88 * W; h = w / I.asp; x = 0.06 * W; y = 0.3 * H; }
    else { h = 0.5 * H; w = h * I.asp; if (w > 0.9 * W) { w = 0.9 * W; h = w / I.asp; } x = (W - w) / 2; y = 0.25 * H; }
    const k = ease.outCubic(clamp((this.t - I.t0 - 0.3) / 0.25));
    return { x, y: y + (1 - k) * (H - y + 40), w, h, rot: lerp(-0.08, -0.025, k), k };
  }
  // a point of the panel (in its own units: 1 tall) on the screen
  insetPt(x, y) {
    const G = this.insetGeo(), c = Math.cos(G.rot), s = Math.sin(G.rot), dx = x * G.h - G.w / 2, dy = y * G.h - G.h / 2;
    return [G.x + G.w / 2 + c * dx - s * dy, G.y + G.h / 2 + s * dx + c * dy];
  }
  // where the bag is, e seconds into the panel: teetering on the landing, then hop, hop, hop, floor
  hopPose(I, e) {
    const asp = I.asp;
    if (e < HOP0) { const [x, y] = stairAt(0, asp); return { x, y, a: -0.14 * Math.sin(e * 24) * clamp(e / 0.3), fly: 0 }; }
    let t = HOP0, k0 = 0;
    for (let j = 0; j < HOPS.length; j++) {
      const [k, d] = HOPS[j];
      if (e < t + d) {
        const p = (e - t) / d, [xa, ya] = stairAt(k0, asp), [xb, yb] = stairAt(k, asp), hg = 0.08 + 0.015 * (k - k0);
        return {
          x: lerp(xa, xb, p), y: lerp(ya, yb, p) - 4 * hg * p * (1 - p), a: lerp(HOP_A[j], HOP_A[j + 1], ease.inOutSine(p)),
          fly: Math.sin(Math.PI * p), dx: (xb - xa) / d, dy: (yb - ya + 4 * hg * (2 * p - 1)) / d,
        };
      }
      t += d; k0 = k;
    }
    const [x, y] = stairAt(k0, asp);
    return { x, y, a: HOP_A[HOPS.length], fly: 0 };
  }
  // the flight downstairs seen from the side, in panel units: wall and tiled dado, the handrail, eight steps, the hall
  stairArt(g, asp) {
    const S = STAIR, tw = (S.run * asp) / S.n, xt = S.xTop * asp, fl = S.top + S.n * S.rh, xb = xt - (S.n - 1) * tw;
    g.fillStyle = PAL.paint; g.fillRect(0, 0, asp, 1);
    const d = 0.17, ri = 0.25;
    // the tiles follow the pitch, then run flat along the landing and the hall
    poly(g, [asp, S.top - d, xt + tw / 2, S.top - d, xb - tw / 2, fl - d, 0, fl - d, 0, fl, asp, fl]);
    g.fillStyle = PAL.tile; g.fill();
    g.save(); g.clip();
    g.strokeStyle = PAL.grout; g.lineWidth = 0.004; g.beginPath();
    for (let y = 0; y < fl; y += 0.045) { g.moveTo(0, y); g.lineTo(asp, y); }
    for (let x = 0; x < asp; x += 0.045) { g.moveTo(x, 0); g.lineTo(x, fl); }
    g.stroke(); g.restore();
    g.strokeStyle = PAL.tileDk; g.lineWidth = 0.012;
    poly(g, [asp, S.top - d, xt + tw / 2, S.top - d, xb - tw / 2, fl - d, 0, fl - d], false); g.stroke();
    // the street door at the bottom of the hall, where the bag is headed
    const dx0 = 0.035, dx1 = Math.min(0.17, xb - 0.06);
    if (dx1 - dx0 > 0.07) {
      g.fillStyle = PAL.woodDk; g.fillRect(dx0 - 0.012, fl - 0.43, dx1 - dx0 + 0.024, 0.43);
      g.fillStyle = PAL.wood; g.fillRect(dx0, fl - 0.415, dx1 - dx0, 0.415);
      g.fillStyle = PAL.sky; g.fillRect(dx0 + 0.02, fl - 0.39, dx1 - dx0 - 0.04, 0.17);
      g.strokeStyle = PAL.woodDk; g.lineWidth = 0.008; g.strokeRect(dx0 + 0.02, fl - 0.39, dx1 - dx0 - 0.04, 0.17);
      g.fillStyle = PAL.brass; ell(g, dx1 - 0.018, fl - 0.2, 0.009, 0.009); g.fill();
    }
    // the handrail, on its brackets
    const rail = [asp, S.top - ri, xt + tw / 2, S.top - ri, xb - tw / 2, fl - ri - 0.02, xb - tw, fl - ri + 0.02];
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = PAL.steelDk; g.lineWidth = 0.007; g.beginPath();
    for (let i = 0; i <= 4; i++) { const x = lerp(xt + tw / 2, xb - tw / 2, i / 4), y = lerp(S.top - ri, fl - ri - 0.02, i / 4); g.moveTo(x, y); g.lineTo(x, y + 0.035); }
    g.stroke();
    g.strokeStyle = PAL.rail; g.lineWidth = 0.02; poly(g, rail, false); g.stroke();
    g.strokeStyle = PAL.railLt; g.lineWidth = 0.006; g.save(); g.translate(0, -0.005); poly(g, rail, false); g.stroke(); g.restore();
    // the steps, their shadowed soffit and the ink nosings
    const pts = [asp, S.top];
    for (let k = 1; k <= S.n; k++) { const x = xt - (k - 1) * tw; pts.push(x, S.top + (k - 1) * S.rh, x, S.top + k * S.rh); }
    pts.push(asp, fl);
    poly(g, pts); g.fillStyle = PAL.step; g.fill();
    g.save(); g.clip();
    poly(g, [asp, S.top + 0.09, xt, S.top + 0.09, xb, fl + 0.05, asp, fl + 0.05]); g.fillStyle = PAL.stepDk; g.fill();
    g.restore();
    g.strokeStyle = PAL.ink; g.lineWidth = 0.007; g.beginPath();
    g.moveTo(asp, S.top);
    for (let k = 1; k <= S.n; k++) { const x = xt - (k - 1) * tw; g.lineTo(x + 0.008, S.top + (k - 1) * S.rh); g.lineTo(x, S.top + k * S.rh); }
    g.stroke();
    // the terrazo of the hall
    g.fillStyle = PAL.terr; g.fillRect(0, fl, asp, 1 - fl);
    const r = mulberry32(11);
    for (let i = 0; i < 70; i++) { g.fillStyle = PAL.chips[(r() * 8) | 0]; ell(g, r() * asp, fl + 0.02 + r() * (0.97 - fl), 0.004 + 0.006 * r(), 0.003 + 0.004 * r()); g.fill(); }
    g.strokeStyle = PAL.ink; g.lineWidth = 0.007; g.beginPath(); g.moveTo(0, fl); g.lineTo(xb, fl); g.stroke();
  }
  // «MIENTRAS TANTO…»: the comic panel over the view
  drawInset(g) {
    const I = this.inset, G = this.insetGeo(), e = this.t - I.t0, asp = I.asp;
    if (G.k <= 0) return;
    const { w, h } = G, gut = Math.max(5, 0.03 * h), lw = Math.max(2, 0.011 * h);
    g.save();
    g.translate(G.x + w / 2, G.y + h / 2); g.rotate(G.rot); g.translate(-w / 2, -h / 2);
    g.fillStyle = 'rgba(20,16,12,0.35)'; g.fillRect(-gut + 0.035 * h, -gut + 0.05 * h, w + 2 * gut, h + 2 * gut);
    g.fillStyle = '#fbf8f1'; g.fillRect(-gut, -gut, w + 2 * gut, h + 2 * gut);
    g.save();
    g.beginPath(); g.rect(0, 0, w, h); g.clip();
    g.save(); g.scale(h, h); this.stairArt(g, asp); g.restore();
    // what broke, spreading from under it
    if (I.puddle) {
      const Q = I.puddle, r = 0.15 * ease.outCubic(clamp((e - Q.t0) / 0.7));
      g.globalAlpha = 0.88; g.fillStyle = Q.col; ell(g, Q.x * h, Q.y * h, r * h, 0.16 * r * h); g.fill(); g.globalAlpha = 1;
    }
    // the bag, and the lines it leaves in the air
    const P = this.hopPose(I, e), U = 0.07 * h, L = lookOf(I.look), s = e - I.landT;
    const amt = I.landT > 0 && s < 0.18 ? 0.26 * Math.sin((Math.PI * s) / 0.18) * (1 - s / 0.36) : 0;
    const hs = (Math.abs(Math.cos(P.a)) * L.bh * 0.5 + Math.abs(Math.sin(P.a)) * L.bw) * U * (1 - amt);
    const cx = P.x * h, cy = P.y * h - hs, v = 0.5 * L.bh * U * (1 - amt);
    if (P.fly > 0.15) {
      const m = Math.hypot(P.dx, P.dy) || 1, ux = -P.dx / m, uy = -P.dy / m;
      g.strokeStyle = POP.ink; g.globalAlpha = 0.6 * P.fly; g.lineWidth = Math.max(1.5, 0.007 * h); g.lineCap = 'round'; g.beginPath();
      for (const o of [-0.05, 0, 0.05]) {
        const ox = cx - uy * o * h, oy = cy + ux * o * h, a0 = (0.13 + 0.4 * Math.abs(o)) * h, a1 = a0 + 0.1 * P.fly * h;
        g.moveTo(ox + ux * a0, oy + uy * a0); g.lineTo(ox + ux * a1, oy + uy * a1);
      }
      g.stroke(); g.globalAlpha = 1;
    }
    // inked round like everything else in the panel, so it reads against the paint and the steps
    drawStanding(g, I.look, cx - Math.sin(P.a) * v, cy + Math.cos(P.a) * v, U,
      { broken: I.broken && I.j >= HOPS.length, lean: P.a, sq: 1 - amt, ink: POP.ink, inkW: Math.max(1.5, 0.009 * h) });
    // the shopping, everywhere
    const r = 0.022 * h;
    for (const it of I.spill) {
      const [hw, hh] = ITEM[it.sh] || ITEM.b, ext = (Math.abs(Math.cos(it.a)) * hh + Math.abs(Math.sin(it.a)) * hw) * r;
      g.save(); g.translate(it.x * h, it.y * h - ext); g.rotate(it.a);
      g.fillStyle = it.col; g.strokeStyle = POP.ink; g.lineWidth = Math.max(1, 0.004 * h);
      if (it.sh === 'o') { ell(g, 0, 0, r, r); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.35)'; ell(g, -0.35 * r, -0.35 * r, 0.3 * r, 0.22 * r); g.fill(); }
      else if (it.sh === 'l') { rrect(g, -hw * r, -hh * r, 2 * hw * r, 2 * hh * r, hh * r); g.fill(); g.stroke(); }
      else if (it.sh === 'c') { rrect(g, -hw * r, -hh * r, 2 * hw * r, 2 * hh * r, 0.25 * r); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-hw * r, -0.4 * r, 2 * hw * r, 0.25 * r); }
      else { rrect(g, -hw * r, -hh * r, 2 * hw * r, 2 * hh * r, 0.3 * r); g.fill(); g.stroke(); g.fillStyle = darker(it.col, 0.35); g.fillRect(-0.3 * r, -(hh + 0.25) * r, 0.6 * r, 0.3 * r); }
      g.restore();
    }
    // the dust every landing kicks up
    I.puffs = I.puffs.filter((p) => e - p.t0 < 0.4);
    for (const p of I.puffs) {
      const k = (e - p.t0) / 0.4, R = (0.016 + 0.03 * k) * (p.big ? 1.5 : 1) * h;
      g.fillStyle = `rgba(246,240,228,${(0.75 * (1 - k)).toFixed(3)})`;
      for (const sd of [-1, 1]) { ell(g, (p.x + sd * (0.03 + 0.05 * k)) * h, (p.y - 0.012 - 0.01 * k) * h, R, 0.7 * R); g.fill(); }
    }
    g.restore();
    // the caption in the corner, and the ink border
    const fs = Math.max(11, 0.075 * h), pad = 0.35 * fs, cap = this.tx.meanwhile;
    g.font = `800 ${fs}px ${FACE}`;
    const cw = g.measureText(cap).width + 2 * pad, ch = fs + 1.2 * pad;
    g.fillStyle = CAPTION; g.fillRect(0, 0, cw, ch);
    g.lineWidth = lw; g.strokeStyle = POP.ink; g.strokeRect(0, 0, cw, ch);
    g.fillStyle = POP.ink; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(cap, pad, ch / 2 + 0.05 * fs);
    g.strokeRect(0, 0, w, h);
    g.restore();
  }

  // ---------- the verdict, slammed on like a rubber stamp ----------
  stampArt(good) {
    const d = Math.min(2, this.dpr || 1), txt = good ? this.tx.stamp.win : this.tx.stamp.lose, col = good ? PAL.brand : PAL.red;
    const probe = canvas(4, 4).getContext('2d');
    probe.font = `800 100px ${FACE}`;
    const t100 = probe.measureText(txt).width / 100, fs = Math.min(Math.min(0.74 * this.W, 0.7 * this.H) / (t100 + 0.7), 0.16 * this.H);
    const bw = (t100 + 0.7) * fs, bh = 1.3 * fs, m = 0.1 * fs;
    const c = canvas((bw + 2 * m) * d, (bh + 2 * m) * d), g = c.getContext('2d');
    c.lw = bw + 2 * m; c.lh = bh + 2 * m; c.good = good;
    g.scale(d, d); g.translate(m, m);
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = 0.08 * fs; rrect(g, 0, 0, bw, bh, 0.12 * fs); g.stroke();
    g.lineWidth = 0.03 * fs; rrect(g, 0.14 * fs, 0.14 * fs, bw - 0.28 * fs, bh - 0.28 * fs, 0.06 * fs); g.stroke();
    g.font = `800 ${fs}px ${FACE}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, bw / 2, bh / 2 + 0.06 * fs);
    // where the ink didn't take
    g.globalCompositeOperation = 'destination-out';
    const r = mulberry32(good ? 5 : 9);
    for (let i = 0; i < 160; i++) { ell(g, r() * bw, r() * bh, (0.008 + 0.03 * r() * r()) * fs, (0.006 + 0.016 * r()) * fs, r() * TAU); g.fill(); }
    g.lineWidth = 0.018 * fs; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const y = (0.2 + 0.6 * r()) * bh; g.beginPath(); g.moveTo(r() * 0.3 * bw, y); g.lineTo((0.55 + 0.4 * r()) * bw, y + (r() - 0.5) * 0.15 * fs); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    return c;
  }
  drawStamp(g) {
    const S = this.E && this.E.stamp;
    if (!S) return;
    if (!this.stampC || this.stampC.good !== S.good) this.stampC = this.stampArt(S.good);
    const c = this.stampC, e = this.t - S.t0, sc = lerp(2.4, 1, ease.inQuad(clamp(e / 0.14)));
    g.save();
    g.globalAlpha = 0.92 * clamp(e / 0.05);
    g.translate(this.W / 2, 0.42 * this.H); g.rotate(S.good ? -0.16 : 0.13); g.scale(sc, sc);
    g.drawImage(c, -c.lw / 2, -c.lh / 2, c.lw, c.lh);
    g.restore();
  }

  // ---------- the photo for the result card: the funniest moment, framed 4:5 from the frame just drawn ----------
  shotAt(at, rank, info) {
    if ((this.photo && this.photo.rank >= rank) || (this.shot && this.shot.rank >= rank)) return;
    this.shot = { at, rank, ...info };
  }
  snapDue() { return !!this.shot && this.t >= this.shot.at; }
  snapTick(g) {
    const s = this.shot;
    this.shot = null;
    if (this.t > s.at + 0.3 || !g.canvas) return;                // skipped past while fast-forwarding
    const cv = g.canvas, r = cv.height / this.H, W = this.W, H = this.H;
    let x, y, w, h;
    if (H > 1.1 * W) { w = W; h = Math.min(H, 1.25 * W); x = 0; const f = FOCUS[s.why]; y = f == null ? clamp(0.45 * H - h / 2, 0, H - h) : f * (H - h); }
    else { h = H; w = Math.min(W, 0.8 * H); x = (W - w) / 2; y = 0; }
    const cw = Math.round(Math.min(540, w * r)), c = canvas(cw, Math.round(cw * (h / w))), pg = c.getContext('2d');
    pg.drawImage(cv, x * r, y * r, w * r, h * r, 0, 0, c.width, c.height);
    if (s.st) this.stickOn(pg, s.st, x, y, w, h, c.width / w);
    this.photo = { c, rank: s.rank, why: s.why };
  }
  // the move's own sticker, where it was on the screen if the photo has it, else across its top
  stickOn(pg, st, x, y, w, h, k) {
    const on = this.sticker;
    const S = on && on.how === st.how && on.what === st.what ? on : { ...st, rot: 0.065, seed: 7, img: null };
    const img = S.img || (S.img = this.stickerImg(S)), lw = img.lw, lh = img.lh, b = { x: this.W / 2 - lw / 2, y: this.top + 0.035 * this.H };
    const fits = b.x >= x && b.y >= y && b.x + lw <= x + w && b.y + lh <= y + h;
    const sc = fits ? 1 : Math.min(1, (0.58 * w) / lw), cx = fits ? b.x - x + lw / 2 : w / 2, cy = fits ? b.y - y + lh / 2 : 0.05 * h + (sc * lh) / 2;
    pg.save(); pg.scale(k, k); pg.translate(cx, cy); pg.rotate(S.rot); pg.scale(sc, sc);
    pg.fillStyle = 'rgba(24,18,10,0.22)'; rrect(pg, -lw / 2 + 2, -lh / 2 + 4, lw, lh, 0.03 * lw); pg.fill();
    pg.drawImage(img, -lw / 2, -lh / 2, lw, lh);
    pg.restore();
  }
}

// the comic panel's staircase in its own units (1 tall, asp wide): a landing up on the right, eight steps down to the hall
const STAIR = { top: 0.3, rh: 0.06, n: 8, xTop: 0.8, run: 0.62 };
const HOP0 = 0.55, HOPS = [[1, 0.42], [3, 0.38], [5, 0.34], [8, 0.3]], HOP_A = [0, -1.9, -4.1, -6.0, -2.5 * Math.PI];
const PUDDLE = { botellas: '#6d1a2a', cava: '#e8d27a', huevos: '#f2c14e' };
const ITEM = { o: [1, 1], l: [1.9, 0.45], c: [0.75, 1], b: [0.6, 1.3] };
// where the bag sits after k steps down: 0 teetering on the landing's edge, n on the hall floor by the street door
function stairAt(k, asp) {
  const S = STAIR, tw = (S.run * asp) / S.n, xt = S.xTop * asp;
  if (k <= 0) return [xt + 0.07, S.top];
  if (k >= S.n) return [0.1 * asp, S.top + S.n * S.rh];
  return [xt - (k - 0.5) * tw, S.top + k * S.rh];
}
// the surface under x
function profY(x, asp) {
  const S = STAIR, tw = (S.run * asp) / S.n, xt = S.xTop * asp;
  return x >= xt ? S.top : S.top + Math.min(S.n, Math.floor((xt - x) / tw) + 1) * S.rh;
}
