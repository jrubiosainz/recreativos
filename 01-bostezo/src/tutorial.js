// Guided first meetings. 'basic' (l1): the boss keeps reading until you have yawned and
// someone has caught it, then he turns — so the first success is staged but real.
// 'psst' (l2): point at a coworker who can't see you and teach the click.
import { TUNE, Y } from './sim.js';

export class Tutorial {
  constructor(kind, scene, hud, caption, t) {
    this.kind = kind; this.scene = scene; this.sim = scene.sim; this.hud = hud;
    this.caption = caption; this.t = t;
    this.step = 'start'; this.st = 0;
    this.shown = new Set();
    this.firstStrike = false;
    scene.on((e) => this.onEvent(e));
  }

  go(step, key, vars) { this.step = step; this.st = 0; if (key !== undefined) this.say(key, vars); }
  say(key, vars) { this.caption(key ? this.t('tut.' + key, { k: this.sim.K, ...vars }) : null); if (key) this.shown.add(key); }

  locksInput() { return this.kind === 'basic' && (this.step === 'start' || this.step === 'read'); }
  freezesClock() { return this.step !== 'free' && this.step !== 'done'; }

  onEvent(e) {
    const sim = this.sim, me = sim.player;
    if (this.kind === 'basic') {
      switch (this.step) {
        case 'hold': if (e.type === 'yawn' && e.id === me.id) this.go('spread', 't3'); break;
        case 'spread':
          if ((e.type === 'tell' || e.type === 'yawn') && e.id !== me.id) {
            const p = sim.people[e.id];
            p.peakDur = TUNE.peak * 2.2;
            sim.forceWarn();
            this.go('turn', 't4');
          } else if ((e.type === 'close' || e.type === 'stifle') && e.id === me.id) this.go('hold', 't2');
          break;
        case 'turn':
          if (e.type === 'infect') this.go('good', 't5');
          else if (e.type === 'callout') this.go('retry', 't6');
          break;
      }
    } else if (this.kind === 'psst') {
      if (this.step === 'psst' && e.type === 'psst') { this.hud.hintId = null; this.go('spread', 't3'); }
      if (this.step === 'spread' && (e.type === 'tell' || e.type === 'yawn') && e.id !== me.id) { sim.forceWarn(); this.go('free', 't4'); this.tipT = 3.5; }
    }
    // general tips, once
    if (e.type === 'callout' && e.player && !this.firstStrike) {
      this.firstStrike = true;
      if (this.step === 'free' && this.kind === 'basic') { this.say('t8'); this.tipT = 5; }
    }
  }

  update(dt) {
    const sim = this.sim, b = sim.boss;
    this.st += dt;
    if (this.freezesClock()) sim.timeLimit += dt;
    if (this.tipT != null) { this.tipT -= dt; if (this.tipT <= 0) { this.tipT = null; if (this.step === 'free') this.say(null); } }
    if (this.kind === 'basic') {
      switch (this.step) {
        case 'start': if (b.phase === 'read') { sim.holdRead = true; this.go('read', 't1'); } break;
        case 'read': if (this.st > 3.4) this.go('hold', 't2'); break;
        case 'hold': case 'spread': if (b.phase === 'read') sim.holdRead = true; break;
        case 'retry': if (this.st > 4.5 && b.phase === 'read') { sim.holdRead = true; this.go('hold', 't2'); } break;
        case 'good': if (this.st > 4.2) this.go('tip', 't7'); break;
        case 'tip': if (this.st > 6.5) { this.go('free'); this.say(null); } break;
      }
    } else if (this.kind === 'psst') {
      switch (this.step) {
        case 'start':
          if (b.phase === 'read') { sim.holdRead = true; this.go('psst', 'p1'); }
          break;
        case 'psst': {
          if (b.phase === 'read') sim.holdRead = true;
          this.hud.hintId = this.bestTarget();
          if (this.st > 14) { this.hud.hintId = null; this.go('free'); this.say(null); sim.holdRead = false; }
          break;
        }
        case 'spread':
          if (b.phase === 'read') sim.holdRead = true;
          if (this.st > 7) { sim.holdRead = false; this.go('free'); this.say(null); }
          break;
      }
    }
  }

  // the nearest coworker who cannot currently see the player
  bestTarget() {
    const sim = this.sim, me = sim.player;
    let best = null, bd = 1e9;
    for (const p of sim.people) {
      if (p === me || p.kind === 'phone' || p.kind === 'pelota' || p.sleeping || p.yp !== Y.IDLE) continue;
      if (sim.canSee(p, me)) continue;
      const d = sim.dist(me, p);
      if (d < TUNE.psstRange && d < bd) { bd = d; best = p; }
    }
    return best ? best.id : null;
  }
}
