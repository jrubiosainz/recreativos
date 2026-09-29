// The title's backdrop: the next room on the list, where a cat with toast is already having a go by itself.
// The autopilot flies it (now and then the clumsier one); once it has sat in the box, or come to grief, it has
// another go after a breath, on a new seed, so the flat behind the fridge door is never still and never the
// same twice.
import { Sim } from './sim.js';
import { Bot } from './bot.js';

export class Attract {
  constructor(level) { this.lv = level; this.n = 0; this.sim = null; this.bot = null; }
  fresh() {
    this.sim = new Sim(this.lv, { seed: (Math.random() * 1e9) >>> 0 });
    this.bot = new Bot(this.sim, this.n++ % 3 === 2 ? 'late' : 'sharp');
    return this.sim;
  }
  // after the landing, a breath; then again
  due() { const s = this.sim; return !!s?.end && s.time - s.end.t > 2.4; }
}
