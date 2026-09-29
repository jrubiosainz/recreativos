// The abuela's advice. Each level lists what it teaches (level.teach); each lesson waits for its
// moment (a place, a thing on screen, a state of the hippo), is said once in a speech bubble from her
// deck chair (or from off screen, docked under the HUD, when she isn't in view) and stays until the
// player has done it or a while has passed. Lessons already heard are kept in the save.
import { t } from './i18n.js';
import { hint } from './ui/dom.js';

const near = (hp, x, y, r) => Math.abs(hp.x - x) < r && (y == null || Math.abs(hp.y - y) < r * 0.8);
const nearPlat = (sim, kind, r) => sim.plats.some((p) => p.kind === kind && near(sim.hp, (p.x0 + p.x1) / 2, p.top, r));
const edgeX = (sim) => (sim.goal.edge != null ? sim.goal.edge : sim.hp.x);

// when: may this lesson start now? done: has the player got it (from the sim's events)?
const L = {
  hic: { when: (s) => s.t > 0.5, done: (s, ev) => s.t > 7 && ev.hic >= 2, max: 9 },
  hold: { when: (s, st) => st.hic >= 2 || s.t > 6, done: (s, ev) => ev.store >= 1, max: 12 },
  cold: { when: (s) => s.showers.some((w) => near(s.hp, (w.x0 + w.x1) / 2, null, 4.5)), done: (s, ev) => ev.cold >= 1, max: 8 },
  bomba: { when: (s) => near(s.hp, edgeX(s), s.goal.y, 7), done: (s, ev) => ev.dive >= 1, max: 12 },
  hold2: { when: (s) => s.t > 0.8, done: (s, ev) => ev.store2 >= 1, max: 10 },
  parasol: { when: (s) => nearPlat(s, 'parasol', 5), done: (s, ev) => ev.boing >= 1, max: 9 },
  fizz: { when: (s) => s.fizz.some((z) => !z.gone && near(s.hp, z.x, z.y, 4.5)), done: (s, ev) => ev.drink >= 1 || ev.fizz >= 1, max: 9 },
  chair: { when: (s) => nearPlat(s, 'chair', 4), done: (s, ev) => ev.creak >= 1, max: 7 },
  float: { when: (s) => s.t > 0.8, done: (s, ev) => ev.landFloat >= 1, max: 10 },
  wet: { when: (s) => s.hp.inWater, done: (s, ev) => ev.breach >= 1, max: 9 },
  croc: { when: (s) => nearPlat(s, 'croc', 6), done: (s, ev) => ev.susto >= 1, max: 10 },
  low: { when: (s) => s.t > 0.8, done: (s) => s.t > 7, max: 7 },
  burst: { when: (s, st) => st.lowDone && s.t > 8, done: (s, ev) => ev.burst >= 1, max: 11 },
  showerAir: { when: (s, st) => st.burstDone && s.showers.some((w) => near(s.hp, (w.x0 + w.x1) / 2, null, 5)), done: (s, ev) => ev.cold >= 1, max: 9 },
  board: { when: (s) => nearPlat(s, 'board', 5), done: (s, ev) => ev.board >= 1, max: 9 },
  pump: { when: (s, st) => st.boardDone, done: (s, ev) => ev.pumped >= 1, max: 10 },
  whistle: { when: (s) => s.guards.some((g) => near(s.hp, g.x, g.y, g.range + 3)), done: (s, ev) => ev.whistle >= 1, max: 10 },
  all: { when: (s) => s.t > 0.8, done: (s) => s.t > 8, max: 8 },
  towel: { when: (s) => !s.end && s.lost(), done: (s) => !s.lost(), max: 30 },
};

export class Tutorial {
  constructor({ level, sim, scene, save, touch, onSeen }) {
    this.sim = sim; this.scene = scene; this.save = save; this.touch = touch; this.onSeen = onSeen;
    const seen = new Set(save.hints || []);
    this.queue = [...(level.teach || []).filter((k) => L[k] && !seen.has(k)), ...(seen.has('towel') ? [] : ['towel'])];
    this.cur = null; this.ev = {}; this.st = { hic: 0 };
    const ab = (level.decor || []).find((d) => d.k === 'abuela' && !d.sleep);
    this.ab = ab ? { x: ab.x - 0.27 * (ab.face || 1), y: ab.y - 3.05 } : null;
  }
  // tally what happened, so lessons can tell when they've been learnt
  events(evs) {
    const c = this.ev;
    for (const e of evs) {
      c[e.k] = (c[e.k] || 0) + 1;
      if (e.k === 'store' && e.n >= 2) c.store2 = (c.store2 || 0) + 1;
      if (e.k === 'hic') { this.st.hic++; if (e.src === 'burst') c.burst = (c.burst || 0) + 1; }
      if (e.k === 'launch' && e.pumped) c.pumped = (c.pumped || 0) + 1;
      if (e.k === 'land' && e.on === 'float') c.landFloat = (c.landFloat || 0) + 1;
    }
  }
  text(k) {
    const v = t(`tut.${k}`);
    return (this.touch && v.t) || v.k;
  }
  update(dt) {
    const s = this.sim;
    if (s.end || s.dive) { this.close(); this.scene.talking = false; return; }
    if (this.cur) {
      const c = this.cur, def = L[c.k];
      c.age += dt;
      if (c.age > 1.6 && (def.done(s, this.ev) || c.age > def.max)) this.finish();
    }
    if (!this.cur) {
      for (let i = 0; i < this.queue.length; i++) {
        const k = this.queue[i];
        if (L[k].when(s, this.st)) {
          this.queue.splice(i, 1);
          // start counting the lesson's own evidence from now
          this.ev = {};
          this.cur = { k, age: 0 };
          break;
        }
      }
    }
    this.place();
  }
  finish() {
    const k = this.cur.k;
    this.st[`${k}Done`] = true;
    this.onSeen?.(k);
    this.cur = null;
    hint(null);
  }
  close() { if (this.cur) { this.cur = null; hint(null); } }
  place() {
    if (!this.cur) { this.scene.talking = false; return; }
    let at = null, onScreen = false;
    if (this.ab) {
      const [x, y] = this.scene.worldToScreen(this.ab.x, this.ab.y);
      onScreen = x > 20 && x < innerWidth - 20 && y > 90 && y < innerHeight - 20;
      if (onScreen) at = { x, y };
    }
    document.getElementById('hint').classList.toggle('dock', !onScreen);
    this.scene.talking = onScreen && this.cur.age < 2.2;
    hint(`<b class="who">${t('abuela')}</b>${this.text(this.cur.k)}`, at || { x: innerWidth / 2, y: 0 });
  }
  dispose() { this.close(); this.scene.talking = false; }
}
