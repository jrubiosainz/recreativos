// The friend in the next seat. Each trip lists what it teaches (level.teach); each lesson waits for its
// moment (the call, the start, the first brake, the doors), is whispered once beside the window and
// stays until the player has done it or a while has passed. Lessons already heard are kept in the save,
// so a second ride is quiet.
import { t } from './i18n.js';
import { YOU } from './sim.js';
import { hint } from './ui/dom.js';

// when: may this lesson start now (a = everything so far, st = lessons done)? done: has the player got
// it (e = since it started, c = the lesson's own clock)?
const L = {
  call: { when: (s) => s.phase === 'call' && s.time > 0.25, done: (s) => s.phase !== 'call', max: 30 },
  night: { when: (s) => s.phase === 'call' && s.time > 0.25, done: (s, e, c) => s.phase !== 'call' && c.age > 2.5, max: 9 },
  wipe: { when: (s) => s.phase === 'race', done: (s, e, c) => s.wiped - c.w0 > 5 && c.age > 2.4, max: 10 },
  lift: { when: (s, a, st) => s.phase === 'race' && (st.wipeDone || s.race > 9), done: (s, e, c) => c.age > 4.5, max: 5 },
  eat: { when: (s, a, st) => st.liftDone && s.race > 5, done: (s, e, c) => (e.mine >= 1 && c.age > 2) || c.age > 8, max: 8 },
  regrow: { when: (s) => s.phase === 'race' && s.race > 3, done: (s, e, c) => c.age > 6.5, max: 7 },
  doors: { when: (s) => s.phase === 'race' && s.bus.doors > 0, done: (s, e, c) => c.age > 5.5, max: 6 },
  brake: { when: (s, a) => a.hard >= 1, done: (s, e, c) => c.age > 5, max: 5 },
  big: { when: (s, a, st) => s.phase === 'race' && (st.brakeDone || s.race > 12), done: (s, e, c) => c.age > 6, max: 6 },
  sticker: { when: (s) => s.phase === 'race' && s.race > 1.5, done: (s, e, c) => c.age > 6, max: 6 },
  cobbles: { when: (s, a) => a.cobbles >= 1, done: (s, e, c) => c.age > 5.5, max: 6 },
  heater: { when: (s) => s.phase === 'race' && s.race > 2, done: (s, e, c) => c.age > 6.5, max: 7 },
  scratch: { when: (s, a, st) => s.phase === 'race' && (st.heaterDone || s.race > 12), done: (s, e, c) => c.age > 6, max: 6 },
};

export class Tutorial {
  constructor({ level, sim, save, touch, onSeen }) {
    this.sim = sim; this.touch = touch; this.onSeen = onSeen;
    const seen = new Set(save.hints || []);
    this.queue = (level.teach || []).filter((k) => L[k] && !seen.has(k));
    this.cur = null; this.st = {}; this.all = {}; this.ev = {};
  }
  // tally what happened, so lessons can tell when they're due and when they've been learnt
  events(evs) {
    for (const e of evs) {
      const k = e.k === 'bus' ? e.what : e.k;
      this.all[k] = (this.all[k] || 0) + 1;
      this.ev[k] = (this.ev[k] || 0) + 1;
      if (e.k === 'merge' && e.own === YOU) this.ev.mine = (this.ev.mine || 0) + 1;
    }
  }
  text(k) {
    const v = t(`tut.${k}`);
    return (this.touch && v.t) || v.k;
  }
  update(dt) {
    const s = this.sim;
    if (s.end) { this.close(); return; }
    if (this.cur) {
      const c = this.cur, def = L[c.k];
      c.age += dt;
      if (c.age > 1.4 && (def.done(s, this.ev, c) || c.age > def.max)) this.finish();
    }
    if (!this.cur) {
      for (let i = 0; i < this.queue.length; i++) {
        const k = this.queue[i];
        if (L[k].when(s, this.all, this.st)) {
          this.queue.splice(i, 1);
          this.ev = {};
          this.cur = { k, age: 0, w0: s.wiped };
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
