// The stadium PA. Each ground lists what it teaches (level.teach); each lesson waits for its moment
// (a state of the camera, of the waves, something that just happened), is read out once on the ribbon
// board and stays until the player has done it or a while has passed. Lessons already heard are kept
// in the save, so a second visit is quiet.
import { t } from './i18n.js';
import { P, ringDelta } from './sim.js';
import { hint } from './ui/dom.js';

const alive = (s) => s.waves.filter((w) => w && w.dir && w.dead < 0);
const fading = (s) => s.waves.some((w) => w && w.dir && w.dead >= 0 && w.laps > 0.12 && s.deadFor(w) < P.rescueT - 0.4);

// when: may this lesson start now (a = everything so far)? done: has the player got it (e = since it started)?
const L = {
  aim: { when: (s) => s.time > 0.4, done: (s, e) => e.moved > 6, max: 9 },
  air: { when: (s, a, st) => st.aimDone || s.time > 6, done: (s, e) => e.onAir > 1.1, max: 14 },
  sweep: { when: (s, a, st) => st.airDone, done: (s, e) => e.ola >= 1, max: 16 },
  ola: { when: (s, a) => a.ola >= 1, done: (s, e, c) => c.age > 3.5 && !s.cam.onAir, max: 7 },
  still: { when: (s, a, st) => a.collide >= 1 || (st.sweepDone && a.stillAir > 1.4), done: (s, e, c) => c.age > 6, max: 7 },
  rescue: { when: (s) => fading(s), done: (s, e) => e.rescue >= 1, max: 10 },
  sleep: { when: (s, a) => s.time > 2.5 && (a.ola >= 1 || a.sleep >= 1 || s.time > 9), done: (s, e) => e.wake >= 1, max: 12 },
  tired: { when: (s, a) => a.tired >= 1 || a.collide >= 1 || s.time > 30, done: (s, e, c) => c.age > 7, max: 8 },
  vip: { when: (s, a) => a.ola >= 1 || a.vip >= 1 || s.time > 10, done: (s, e) => e.palco >= 1, max: 14 },
  gap: { when: (s, a, st) => a.gap >= 1 || (st.vipDone && s.time > 22), done: (s, e, c) => c.age > 7 || e.rescue >= 1, max: 9 },
  away: { when: (s, a) => a.away >= 1 || a.ola >= 1 || s.time > 9, done: (s, e, c) => s.feat.jump || c.age > 12, max: 12 },
  kiss: { when: (s, a) => a.kiss >= 1, done: (s, e, c) => c.age > 6, max: 7 },
  two: { when: (s, a) => a.collide >= 1 || alive(s).some((w, _, all) => all.some((o) => o.dir === -w.dir)), done: (s, e, c) => c.age > 6, max: 8 },
  replay: { when: (s, a) => a.replayWarn >= 1, done: (s, e) => e.replay >= 1 && s.lock <= 0, max: 14 },
  ultras: { when: (s) => s.time > 2, done: (s, e) => e.ola >= 1, max: 10 },
  cut: { when: (s, a) => s.air < 0.5 || a.cut >= 1, done: (s, e, c) => c.age > 7 || e.back >= 1, max: 9 },
  alive: { when: (s) => s.time > 1.2, done: (s, e, c) => c.age > 8, max: 8 },
};

export class Tutorial {
  constructor({ level, sim, save, touch, onSeen }) {
    this.sim = sim; this.touch = touch; this.onSeen = onSeen;
    const seen = new Set(save.hints || []);
    const list = [...(level.teach || [])];
    // the first ground also says it when the wave first carries itself
    if (level.n === 1 && !list.includes('ola')) list.splice(Math.max(0, list.indexOf('sweep') + 1), 0, 'ola');
    this.queue = list.filter((k) => L[k] && !seen.has(k));
    this.cur = null; this.st = {};
    this.all = { ola: 0, stillAir: 0 };
    this.ev = { moved: 0, onAir: 0 };
    this.px = sim.cam.x;
  }
  // tally what happened, so lessons can tell when they're due and when they've been learnt
  events(evs) {
    for (const e of evs) {
      const k = e.k === 'die' ? e.why : e.k;
      this.all[k] = (this.all[k] || 0) + 1;
      this.ev[k] = (this.ev[k] || 0) + 1;
    }
  }
  text(k) {
    const v = t(`tut.${k}`);
    return (this.touch && v.t) || v.k;
  }
  update(dt) {
    const s = this.sim;
    if (s.end) { this.close(); return; }
    const moved = Math.abs(ringDelta(s.cam.x - this.px, s.C)); this.px = s.cam.x;
    this.ev.moved += moved;
    if (s.cam.onAir) { this.ev.onAir += dt; this.all.stillAir = moved < 0.02 ? this.all.stillAir + dt : 0; } else this.all.stillAir = 0;
    if (this.cur) {
      const c = this.cur, def = L[c.k];
      c.age += dt;
      if (c.age > 1.6 && (def.done(s, this.ev, c) || c.age > def.max)) this.finish();
    }
    if (!this.cur && !s.lock) {
      for (let i = 0; i < this.queue.length; i++) {
        const k = this.queue[i];
        if (L[k].when(s, this.all, this.st)) {
          this.queue.splice(i, 1);
          // count the lesson's own evidence from now
          this.ev = { moved: 0, onAir: 0 };
          this.cur = { k, age: 0 };
          hint(this.text(k));
          break;
        }
      }
    }
  }
  finish() {
    const k = this.cur.k;
    this.st[`${k}Done`] = true;
    this.onSeen?.(k);
    this.cur = null;
    hint(null);
  }
  close() { if (this.cur) { this.cur = null; hint(null); } }
  dispose() { this.close(); }
}
