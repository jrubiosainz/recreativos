// The first trip teaches itself, with a note pinned under your feet (or over whoever it is about) that
// follows what you actually do: step aside; watch where they look; what a dance is; ask to get by.
// After that, each new kind of traveller, the first time ever you meet one, gets one short note.
const LAST = { move: 6, look: 5, dance: 6, ask: 7 };
const NOTE = 4.8;
const KINDS = ['zombie', 'espejo', 'wave', 'gate', 'granny', 'tourist', 'couple', 'stairs', 'groupCo', 'group', 'runner'];
const ALIAS = { zombieCo: 'zombie' };

export class Tutorial {
  // basics: teach the first trip; seen: kinds already explained (Set); hint(html|null, r, dir);
  // where(target) → { r, dir } | null for 'you' or an agent id
  constructor(sim, { t, hint, where, basics, touch, seen, onSeen, onDone }) {
    Object.assign(this, { sim, t, hint, where, basics, touch, seen, onSeen, onDone });
    this.cur = null; this.html = null; this.target = 'you'; this.until = 0;
    this.said = new Set(); this.queue = []; this.stepped = false; this.done = false;
  }
  say(k, now, target = 'you', html = null) {
    this.cur = k; this.target = target; this.until = now + (LAST[k] || NOTE); this.said.add(k);
    this.html = html ?? this.t(`tut.${k}${k === 'move' || k === 'ask' ? (this.touch ? 'T' : 'K') : ''}`);
    this.place();
    if (KINDS.includes(k)) { this.seen.add(k); this.onSeen?.(k); }
  }
  note(kind, now, target = 'you') {
    kind = ALIAS[kind] || kind;
    if (this.done || !KINDS.includes(kind) || this.seen.has(kind) || this.said.has(kind)) return;
    if (this.cur || this.sim.P.dance) { if (!this.queue.some((q) => q.kind === kind)) this.queue.push({ kind, at: now, target }); return; }
    const [name, desc] = this.t('intro.' + kind);
    this.say(kind, now, target, `<b>${name}.</b> ${desc}`);
  }
  place() {
    if (!this.cur || !this.html) return;
    const w = this.where(this.target);
    if (!w && this.target !== 'you') { this.target = 'you'; return this.place(); }
    if (w) this.hint(this.html, w.r, w.dir);
  }
  clear() { this.cur = null; this.html = null; this.hint(null); }
  event(e) {
    if (this.done) return;
    const now = e.t, b = this.basics;
    switch (e.k) {
      case 'step': if (!e.auto) { this.stepped = true; if (this.cur === 'move') this.clear(); } break;
      case 'notice': if (b && e.kind === 'polite' && !this.said.has('look') && !this.cur) this.say('look', now, e.id); break;
      case 'dance':
        if (e.n === 1 && b && !this.said.has('dance')) { if (this.cur) this.clear(); this.say('dance', now); }
        else if (this.cur && this.cur !== 'dance') this.clear();
        break;
      case 'part': if (this.cur === 'dance' || this.cur === 'look') this.clear(); break;
      case 'stuck': if (b && !this.said.has('ask') && this.cur !== 'dance') { if (this.cur) this.clear(); this.say('ask', now); } break;
      case 'ask': if (this.cur === 'ask') this.clear(); break;
      case 'meet': if (e.kind !== 'polite' && e.kind !== 'slow') this.note(e.kind, now, e.id); break;
      case 'wave': this.note('wave', now); break;
      case 'runner': this.note('runner', now); break;
      case 'end': this.stop(e.why === 'arrive'); break;
    }
  }
  update(now) {
    if (this.done) return;
    const s = this.sim, P = s.P;
    if (this.cur && now >= this.until) this.clear();
    if (this.cur) { this.place(); return; }
    if (this.basics && !this.stepped && !this.said.has('move') && now > 0.8) { this.say('move', now); return; }
    // places, not people: the turnstiles and the stairs, a few steps before you get there
    const g = s.route.gates[0];
    if (g && g.z - P.z < 7 && g.z > P.z) this.note('gate', now);
    for (const [z0] of s.route.stairs) if (z0 - P.z < 5 && z0 > P.z) this.note('stairs', now);
    if (this.cur) return;
    while (this.queue.length) {
      const q = this.queue.shift();
      if (now - q.at < 3) { this.note(q.kind, now, q.target); break; }
    }
  }
  stop(won) {
    if (this.basics && won) { this.basics = false; this.onDone?.(); }
    this.done = true; this.clear();
  }
}
