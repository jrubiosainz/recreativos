// The first photo teaches itself with a note by the button that follows what you actually do:
// call them, wait out the blink, shoot, then decide whether to develop. Each later photo adds one
// note for its new trick (the sun, the self-timer, the baby, the pigeons), shown only once ever.
import { judge } from './sim.js';

const MECH = { playa: 'sun', salon: 'timer', bautizo: 'baby', plaza: 'pigeons' };
const LAST = { sun: 7, timer: 13, baby: 7, pigeons: 4.5, miss: 7 };

export class Tutorial {
  // basics: teach the first photo; seen: mechanic notes already shown; hint(html|null, r, dir); where(target)
  constructor(sim, { t, hint, where, basics, seen, onSeen, onDone }) {
    Object.assign(this, { sim, t, hint, where, basics, onSeen, onDone });
    this.mech = MECH[sim.ev.id] && !seen.has(MECH[sim.ev.id]) ? MECH[sim.ev.id] : null;
    this.cur = null; this.html = null; this.target = 'btn'; this.until = Infinity; this.shots = 0; this.said = new Set();
    this.done = !basics && !this.mech;
  }
  say(k, now, target = 'btn', vars) {
    this.cur = k; this.target = target; this.until = now + (LAST[k] || Infinity); this.said.add(k);
    this.html = this.t('tut.' + k, vars);
    this.place();
    if (k === this.mech) this.onSeen?.(k);
  }
  place() { if (this.cur && this.html) { const w = this.where(this.target); this.hint(this.html, w.r, w.dir); } }
  clear() { this.cur = null; this.html = null; this.hint(null); }
  event(e) {
    if (this.done) return;
    const now = e.t;
    switch (e.k) {
      case 'call':
        if (this.cur === 'call' || this.cur === 'now' || this.cur === 'miss' || this.cur === 'sun' || this.cur === 'baby' || this.cur === 'timer') this.clear();
        break;
      case 'chorus': if (this.basics && !this.shots) this.say('wait', now); break;
      case 'shot':
        this.shots++;
        if (this.cur) this.clear();
        break;
      case 'relax':
        if (this.basics && e.why === 'shot' && this.shots === 1 && this.sim.frames > 0) this.say('miss', now, 'dev');
        else if (this.cur === 'wait' || this.cur === 'now') this.clear();
        break;
      case 'coo': if (this.mech === 'pigeons' && !this.said.has('pigeons')) this.say('pigeons', now); break;
      case 'end': this.stop(); break;
    }
  }
  update(now) {
    if (this.done) return;
    const s = this.sim;
    if (this.cur && now >= this.until) { this.clear(); if (this.said.has('miss')) this.finishBasics(); }
    if (this.cur) {
      if (this.cur === 'wait' && s.state === 'pose' && judge(s.view()).ok) this.say('now', now);
      return;
    }
    if (now < 0.7) return;
    if (this.basics && !this.shots && s.state === 'relax' && s.canCall && !this.said.has('callAgain')) {
      if (this.said.has('call')) this.said.add('callAgain');
      this.say('call', now, 'btn', { n: s.frames });
      return;
    }
    if (this.mech && this.mech !== 'pigeons' && !this.said.has(this.mech) && !s.calls && (this.mech !== 'timer' || s.canTimer)) this.say(this.mech, now);
  }
  finishBasics() { if (this.basics) { this.basics = false; this.onDone?.(); } if (!this.mech || this.said.has(this.mech)) this.done = true; }
  stop() { if (this.said.has('miss') || this.shots) this.finishBasics(); this.done = true; this.clear(); }
}
