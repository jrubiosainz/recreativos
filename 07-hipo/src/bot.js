// The route bot: plays a level from a list of steps. It exists to prove every level can be done
// (and in what time), to feed QA screenshots mid-level, and to play the title screen by itself.
//
// A step is a string: input, then a condition that ends it.  'R x>14'  'RH k>=1'  '. ground&y<9.01'
//   input  R / L / .  = walk right / left / stand;  a trailing H holds the breath
//   cond   terms joined by & (and) and | (or): name, or name op number
//          x y vx vy k ph (hiccup phase) cure st (seconds in this step) and the flags
//          ground air wet dive end hic land store boing launch susto stick board whistle whistleUp cold fizz, t (clock),
//          gx (x along the float/chair it stands on) and p0…p15 (x of the n-th floating thing)
const V = {
  x: (s) => s.hp.x, y: (s) => s.hp.y, vx: (s) => s.hp.vx, vy: (s) => s.hp.vy,
  k: (s) => s.hic.k, ph: (s) => s.hic.phase, cure: (s) => s.hic.cure, st: (s, b) => s.t - b.t0,
  ground: (s) => (s.hp.ground ? 1 : 0), air: (s) => (s.hp.ground ? 0 : 1), wet: (s) => (s.hp.inWater ? 1 : 0),
  dive: (s) => (s.dive ? 1 : 0), end: (s) => (s.end ? 1 : 0), t: (s) => s.t,
  gx: (s) => (s.hp.ground && s.hp.ground !== 'tile' ? s.hp.x - s.hp.ground.x0 : -1), // how far along the thing it stands on
};
for (let i = 0; i < 16; i++) V['p' + i] = (s) => s.plats[i].x0;                     // where the i-th floating thing is
for (const e of ['hic', 'land', 'store', 'boing', 'launch', 'susto', 'stick', 'board', 'whistle', 'whistleUp', 'dive', 'impact', 'cold', 'fizz'].filter((e) => !V[e])) V[e] = (s) => (s.ev.some((v) => v.k === e) ? 1 : 0);
const OPS = { '>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '==': (a, b) => a === b };

function cond(str) {
  const ors = str.split('|').map((a) => a.split('&').map((term) => {
    const m = term.trim().match(/^([a-z]+\d*)\s*(>=|<=|==|>|<)?\s*(-?[\d.]+)?$/i);
    if (!m || !V[m[1]]) throw new Error(`bot: bad condition «${term}»`);
    const f = V[m[1]], op = OPS[m[2]], v = +m[3];
    return op ? (s, b) => op(f(s, b), v) : (s, b) => !!f(s, b);
  }));
  return (s, b) => ors.some((ands) => ands.every((t) => t(s, b)));
}
export function compile(route) {
  return route.map((str) => {
    const sp = str.indexOf(' '), inp = str.slice(0, sp), c = str.slice(sp + 1);
    return { src: str, dir: inp[0] === 'R' ? 1 : inp[0] === 'L' ? -1 : 0, hold: inp.includes('H'), until: cond(c) };
  });
}

export class Bot {
  constructor(sim, route, { max = 7 } = {}) {
    this.sim = sim; this.steps = compile(route); this.i = 0; this.t0 = sim.t; this.max = max; this.fail = null;
  }
  get done() { return this.i >= this.steps.length; }
  // call before each tick (sim.ev still holds the previous tick's events)
  update() {
    const s = this.sim;
    while (!this.fail && this.i < this.steps.length && this.steps[this.i].until(s, this)) { this.i++; this.t0 = s.t; }
    const st = this.steps[this.i];
    if (!st || this.fail) { s.input.dir = 0; s.input.hold = !!(s.dive && !s.end); return; }
    if (s.t - this.t0 > this.max) { this.fail = { step: this.i, src: st.src, t: s.t, x: s.hp.x, y: s.hp.y }; return; }
    s.input.dir = st.dir; s.input.hold = st.hold;
  }
}
