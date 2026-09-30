// The family's sticky notes on the fridge. Each room lists what it teaches (level.teach); each lesson waits for
// its moment (the first second, the first tilt, the box in sight, the sink ahead…), goes up once on a sticky
// note and stays until the player has done it or a while has passed. Notes already read are kept in the save,
// so a second flight is quiet.
import { t } from './i18n.js';
import { hint } from './ui/dom.js';

const near = (s, x0, x1, ahead = 160) => s.x > x0 - ahead && s.x < x1;
const lamp = (s) => s.solids.find((q) => q.tag === 'lamp');
// when: may it go up now (a = event counts so far, st = lessons done)? done: has the player got it (e = events
// since it went up, c = the lesson's own clock and tallies)?
const L = {
  turn: { when: (s) => s.time > 0.4, done: (s, e, c) => c.turned > 1.1, max: 14 },
  move: { when: (s, a, st) => st.turnDone, done: (s, e, c) => c.moved > 1.4, max: 9 },
  stop: { when: (s, a, st) => st.moveDone, done: (s, e, c) => c.age > 5.5, max: 6 },
  tempt: { when: (s, a, st) => !s.tempted && (st.stopDone || s.time > 12) && s.x > 200, done: (s) => s.tempted, max: 9 },
  sit: { when: (s) => s.box && (Math.abs(s.x - (s.box.x + 30)) < 190 || s.time > 16), done: (s) => !!s.sit, max: 12 },
  climb: { when: (s) => s.time > 0.8 && (!s.lv.teach?.includes('run') || s.x > 430), done: (s, e, c) => s.charge > 0.55 && c.age > 2.2, max: 9 },
  run: { when: (s) => s.time > 0.8, done: (s, e, c) => e.hop >= 1 || s.x > 200, max: 10 },
  jar: {
    when: (s, a, st) => s.b < 0.95 && (!s.lv.teach?.includes('stop') || st.stopDone) && s.jars.some((j) => Math.abs(j.x - s.x) < 150),
    done: (s, e, c) => e.refill >= 2 || (e.refill && c.age > 4), max: 11,
  },
  drip: { when: (s) => s.sag > 0.55 && !s.jars.some((j) => j.on), done: (s, e, c) => c.age > 5, max: 6 },
  water: { when: (s) => s.water.some((w) => near(s, w.x, w.x + w.w)), done: (s, e, c) => c.age > 6.5, max: 7 },
  hob: { when: (s) => s.hobs.some((h) => near(s, h.x0, h.x1)), done: (s, e, c) => c.age > 6, max: 6 },
  cucumber: { when: (s) => s.cukes.some((q) => Math.abs(s.x - q.x) < 170), done: (s, e, c) => c.age > 5.5, max: 6 },
  lamp: { when: (s) => { const q = lamp(s); return q && near(s, q.x, q.x + q.w, 190); }, done: (s, e, c) => c.age > 6, max: 6 },
  dog: { when: (s) => s.dogs.some((d) => Math.abs(d.x - s.x) < 250), done: (s, e, c) => c.age > 7, max: 7 },
  tub: { when: (s) => s.water.some((w) => near(s, w.x, w.x + w.w, 150)), done: (s, e, c) => c.age > 6.5, max: 7 },
  wind: { when: (s) => s.time > 4.2, done: (s, e, c) => (e.gust >= 1 && c.age > 3.5) || c.age > 9, max: 9 },
  gap: { when: (s) => s.x > 250, done: (s, e, c) => s.x > 720 || c.age > 12, max: 12 },
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
      this.all[e.k] = (this.all[e.k] || 0) + 1;
      this.ev[e.k] = (this.ev[e.k] || 0) + 1;
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
      if (s.input.turn) c.turned += dt;
      if (Math.abs(s.vx) > 55 && !s.sit) c.moved += dt;
      if (c.age > 1.6 && (def.done(s, this.ev, c) || c.age > def.max)) this.finish();
    }
    if (!this.cur) {
      for (let i = 0; i < this.queue.length; i++) {
        const k = this.queue[i];
        if (L[k].when(s, this.all, this.st)) {
          this.queue.splice(i, 1);
          this.ev = {};
          this.cur = { k, age: 0, turned: 0, moved: 0 };
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
  // the pause card hides the note; it comes back with the game
  reshow() { if (this.cur) hint(this.text(this.cur.k)); }
  close() { if (this.cur) { this.cur = null; hint(null); } }
  dispose() { this.close(); }
}
