// The first showing teaches itself: a note pinned by the meter the first time you watch
// OPERACIÓN TRUENO, reacting to what you actually do (not a script of timed popups).
const SHOW = { meter: 99, good: 2.6, heard: 3.2, stop: 2.6, shush: 3.2, piece: 3.6 };

export class Tutorial {
  // hint(html|null, rect, dir): the UI's note; where(): { r, dir } beside the meter
  constructor(sim, { t, touch, hint, where }) {
    this.sim = sim; this.t = t; this.touch = touch; this.hint = hint; this.where = where;
    this.seen = new Set(); this.cur = null; this.html = null; this.until = 0; this.lastTap = -9; this.done = false; this.bites = 0;
  }
  say(k, now) {
    if (this.seen.has(k) && k !== 'meter') return;
    this.seen.add(k); this.cur = k; this.until = now + SHOW[k];
    this.html = k === 'meter' ? this.t('tut.meter', { how: this.t(this.touch() ? 'tut.tap' : 'tut.key') }) : this.t('tut.' + k);
    this.place();
  }
  // after a resize (or the pause card), pin the same note again
  place() { if (this.cur && this.html) { const w = this.where(); this.hint(this.html, w.r, w.dir); } }
  clear() { this.cur = null; this.html = null; this.hint(null); }
  event(e) {
    if (this.done) return;
    const now = e.t ?? this.sim.t;
    if (e.type === 'noise' && (e.kind === 'bite' || e.kind === 'chew' || e.kind === 'wrap')) {
      this.lastTap = now; this.bites++;
      if (e.heard) this.say('heard', now);
      else if (this.cur === 'meter' || this.bites === 1) this.say('good', now);
    } else if (e.type === 'shush' && e.strike) this.say('shush', now);
    else if (e.type === 'ate' && e.n === 1) this.say('piece', now);
    else if (e.type === 'end') this.stop();
  }
  update(now) {
    if (this.done) return;
    const s = this.sim;
    this.place();                                  // the arrow moves with the next bite: follow it
    if (this.cur && this.cur !== 'meter' && now >= this.until) {
      this.clear();
      if (this.seen.has('piece')) { this.done = true; return; }
    }
    if (!this.cur && now > 0.6 && !this.bites) this.say('meter', now);
    // chewing on into a quiet stretch: the one moment worth stopping you for
    const nx = s.next(now);
    if (!this.cur && nx != null && now - this.lastTap < 1.2 && s.gauge(now) < nx - 3 && this.bites >= 2) this.say('stop', now);
    // no bite for a long while although the film is loud: point at the meter again
    if (!this.cur && this.bites && now - this.lastTap > 9 && nx != null && s.gauge(now) > nx + 2 && !this.seen.has('again')) { this.seen.add('again'); this.say('meter', now); this.until = now + 3; this.cur = 'again'; }
  }
  stop() { this.done = true; this.clear(); }
}
