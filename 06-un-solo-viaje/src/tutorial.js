// The first trip teaches itself, with a strip of label tape that points at what it means: you're
// double-parked; grab the bags; free the hand the next door wants. After that, the first time ever
// something new happens (a hand giving out, a stair light, a lift that won't wait, a nose on a
// button) it gets one short note, and never again.
import { HONK_EVERY, FALLBACKS } from './sim.js';

const LAST = { park: 3.6, load: 8, free: 6, fb: 5, strain: 5.5, rest: 7, light: 5.5, lift: 5.5, oldlift: 5, buzz: 5, stairs: 6, honk: 4.5 };
const ONCE = ['fb', 'strain', 'rest', 'light', 'lift', 'oldlift', 'buzz', 'stairs', 'honk'];
const KT = ['load', 'free', 'strain', 'rest'];          // keyboard and touch say it differently
const AT = { free: 'chip', strain: 'rest', rest: 'rest' };  // what the note points at (else the middle)
const QUEUED = 4;

export class Tutorial {
  // basics: teach the first trip; seen: notes already shown ever (Set); hint(html|null, r, dir);
  // where('mid' | 'chip' | 'rest') → { r, dir }
  constructor(sim, { t, hint, where, basics, touch, seen, onSeen, onDone }) {
    Object.assign(this, { sim, t, hint, where, basics, touch, seen, onSeen, onDone });
    this.cur = null; this.html = null; this.until = 0; this.said = new Set(); this.queue = [];
    this.grabbed = false; this.done = false; this.freeFor = -1;
  }
  say(k, now, vars) {
    this.cur = k; this.until = now + (LAST[k] || 5); this.said.add(k);
    this.html = this.t(`tut.${k}${KT.includes(k) ? (this.touch ? 'T' : 'K') : ''}`, vars);
    this.place();
    if (ONCE.includes(k)) { this.seen.add(k); this.onSeen?.(k); }
  }
  // once ever; if another note is up it waits its turn (and is dropped if the moment has passed)
  note(k, now, vars) {
    if (this.done || this.seen.has(k) || this.said.has(k)) return;
    if (this.cur) { if (!this.queue.some((q) => q.k === k)) this.queue.push({ k, at: now, vars }); return; }
    this.say(k, now, vars);
  }
  place() {
    if (!this.cur || !this.html) return;
    const w = this.where(AT[this.cur] || 'mid');
    if (w) this.hint(this.html, w.r, w.dir);
  }
  clear(k) {
    if (k && this.cur !== k) return;
    this.cur = null; this.html = null; this.hint(null);
  }
  event(e) {
    if (this.done) return;
    const s = this.sim, now = e.t;
    switch (e.type) {
      case 'grab':
        if (!this.grabbed) { this.grabbed = true; if (this.cur === 'park') this.until = Math.min(this.until, now + 1.4); }
        break;
      case 'act':
        this.clear('free');
        if (s.loading() === false) this.clear('load');
        if (FALLBACKS.includes(e.how)) {
          if (this.cur && this.cur !== 'fb' && !ONCE.includes(this.cur)) this.clear();
          this.note('fb', now, { how: this.t('tut.fbHow.' + e.how) });
        }
        break;
      case 'rested': this.clear('strain'); this.note('rest', now); break;
      case 'up': this.clear('rest'); break;
      case 'light': if (e.on && s.lv.light) this.note('light', now, { s: s.lv.light }); break;
      case 'wait': {
        const st = s.step;
        if (e.what === 'arrive') this.note(st.door === 'auto' ? 'lift' : 'oldlift', now);
        else if (e.what === 'buzz') this.note('buzz', now, { s: st.win || 3 });
        break;
      }
      case 'room': if (e.kind === 'flight' && s.held() > 0) this.note('stairs', now); break;
      case 'honk': if (e.n === 0) this.note('honk', now, { s: HONK_EVERY }); break;
      case 'end': this.stop(e.why === 'arrive'); break;
    }
  }
  // the hand the next door wants is full, and the door is close
  freeNeed() {
    const s = this.sim, st = s.step;
    if (!st || st.k !== 'walk' || s.rest) return null;
    const na = s.nextAct();
    if (!na || !na.st.side) return null;
    const h = na.st.side === 'L' ? 0 : 1;
    if (!s.H[h].bags.length) return null;
    const a = s.ahead(12).find((x) => x.i === na.i);
    return a && a.d < 9 ? na : null;
  }
  update(now, strain = 0) {
    if (this.done) return;
    const s = this.sim;
    if (this.cur && now >= this.until) this.clear();
    if (this.cur === 'load' && !s.loading()) this.clear();
    if (this.cur === 'free' && !this.freeNeed()) this.clear();
    if (this.cur === 'strain' && (s.rest || strain < 0.3)) this.clear();
    if (this.cur) { this.place(); return; }
    if (this.basics) {
      // the double parking first (the clock starts at 0 and the boot is already open: nothing else can come before it)
      if (!this.said.has('park')) { if (now > 0.3) this.say('park', now); return; }
      if (!this.said.has('load') && s.loading() && !this.grabbed) { this.say('load', now); return; }
      const na = this.freeNeed();
      if (na && na.i !== this.freeFor) {
        this.freeFor = na.i;
        const side = na.st.side, other = side === 'R' ? 'L' : 'R';
        this.say('free', now, { what: this.t('what.' + na.st.what), side: this.t('side.' + side), key: side === 'R' ? '←' : '→', other: this.t('side.' + other) });
        return;
      }
    }
    if (strain > 0.55 && !s.rest && !s.loading() && !s.end) { this.note('strain', now); if (this.cur) return; }
    while (this.queue.length) {
      const q = this.queue.shift();
      if (now - q.at < QUEUED) { this.note(q.k, now, q.vars); break; }
    }
  }
  stop(won) {
    if (this.basics && won) { this.basics = false; this.onDone?.(); }
    this.done = true; this.clear();
  }
}
