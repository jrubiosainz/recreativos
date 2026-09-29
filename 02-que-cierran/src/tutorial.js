// The guided first departure (s1). While you learn, the departure clock stands still: call the first
// passenger, watch the walk-ins, land the first push on the tick (in slow motion), then the melody and
// the point-and-call. Everything the tutorial stages is real sim behaviour, only the timing waits for you.
const TOUCH = new Set(['t2', 't10']);

export class Tutorial {
  constructor(scene, caption, t, touch) {
    this.scene = scene; this.sim = scene.sim; this.caption = caption; this.t = t; this.touch = touch;
    this.step = 'intro'; this.st = 0; this.lastT = this.sim.t; this.tipT = null;
    this.slow = 1; this.goodPushes = 0; this.saidCombo = false; this.saidMelody = false;
    this.off = scene.on((type, e) => this.onEvent(type, e));
    this.say('t1');
  }

  say(key, sec = null) { this.caption(key ? this.t('tut.' + key + (this.touch && TOUCH.has(key) ? 'Touch' : '')) : null); this.tipT = sec; }
  go(step, key, sec) { this.step = step; this.st = 0; if (key !== undefined) this.say(key, sec); }
  get done() { return this.step === 'done'; }
  // before the melody the clock waits for you; once you're on your own it runs
  holdsClock() { return this.step === 'intro' || this.step === 'call' || this.step === 'walk' || this.step === 'push'; }

  onEvent(type, e) {
    const s = this.sim;
    switch (type) {
      case 'open': if (this.step === 'intro') this.go('call', 't2'); break;
      case 'atDoor':
        if (e.p?.state === 'swing' && (this.step === 'call' || this.step === 'walk')) { this.go('push', 't4'); this.slow = 0.55; }
        else if (this.step === 'call') this.go('walk');
        break;
      case 'board':
        if (this.step === 'walk' && s.fill < 1.3) this.go('call', 't3');
        else if (this.step === 'push') { this.go('free', 't8', 6); this.slow = 1; }
        break;
      case 'push':
        if (this.step !== 'push') { if (e.combo >= 3 && !this.saidCombo && !this.saidTip()) { this.saidCombo = true; this.say('combo', 4.5); } break; }
        if (e.q === 'bump') this.say('t5');
        else if (e.q === 'weak') this.say('t6');
        else if ((e.q === 'perfect' || e.q === 'good') && this.goodPushes++ === 0) this.say('t7');
        break;
      case 'melody': if (!this.saidMelody && (this.step === 'free' || this.step === 'push')) { this.saidMelody = true; if (this.step === 'push') { this.step = 'free'; this.slow = 1; } this.say('t9', 5); } break;
      case 'closed': this.go('shisa', 't10'); break;
      case 'point': this.go('done', null); break;
    }
  }
  saidTip() { return this.tipT != null && this.tipT > 0; }

  update(dt) {
    const s = this.sim, sc = this.scene;
    this.st += dt;
    const d = s.t - this.lastT;
    this.lastT = s.t;
    if (d > 0 && this.holdsClock() && s.phase === 'board') {
      const T = s.T;
      T.melody += d; T.close += d; T.move += d; T.sched += d;
      for (const r of s.runners) r.at += d;
    }
    // the point-and-call waits for your tap (for a while), instead of happening by itself
    s.holdPoint = this.step === 'shisa' && this.st < 8;
    sc.slow += (this.slow - sc.slow) * Math.min(1, dt * 5);
    if (Math.abs(sc.slow - this.slow) < 0.002) sc.slow = this.slow;
    if (this.tipT != null && (this.tipT -= dt) <= 0) { this.tipT = null; if (this.step === 'free' || this.step === 'done') this.say(null); }
  }

  stop() { this.off?.(); this.scene.slow = 1; this.sim.holdPoint = false; this.caption(null); }
}
