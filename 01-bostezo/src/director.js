// Sound direction: turns simulation events into yawns, voice lines, sfx and music, and feeds
// subtitles (HUD) and lip movement (scene.speak) from whatever the boss is saying.
import { Audio } from './audio.js';
import { TUNE } from './sim.js';
import { clamp } from './util.js';

class Bag {
  constructor(ids) { this.ids = ids; this.q = []; this.last = null; }
  next() {
    if (!this.ids.length) return null;
    if (!this.q.length) {
      this.q = this.ids.slice().sort(() => Math.random() - 0.5);
      if (this.q.length > 1 && this.q[this.q.length - 1] === this.last) this.q.unshift(this.q.pop());
    }
    return (this.last = this.q.pop());
  }
}

const SURNAME_LINES = { 'López': 'c03', 'García': 'c04', 'Fernández': 'c05' };

export class Director {
  constructor(scene, hud, manifest, lang) {
    this.scene = scene; this.sim = scene.sim; this.hud = hud;
    this.voices = (manifest && (manifest.voices[lang] || manifest.voices.es)) || {};
    const cat = (c) => Object.keys(this.voices).filter((k) => this.voices[k].cat === c);
    this.bags = {};
    for (const c of ['talk', 'slide', 'cue', 'sus', 'drowsy', 'win']) this.bags[c] = new Bag(cat(c));
    this.yawnM = new Bag(['y01', 'y02', 'y03', 'y04', 'y05', 'y06']);
    this.yawnF = new Bag(['y07', 'y08', 'y09', 'y10', 'y11', 'y12']);
    this.yawnMe = new Bag(['y01', 'y02', 'y06']);
    this.line = null; // { id, h, env, prio, speaker, el, delay, dur, text, shown }
    this.gap = 1.1;
    this.nextSlideLine = false;
    this.yawnH = new Map();
    this.lastTell = -1;
    this.flatterT = 14 + Math.random() * 10;
    this.woke = new Set();
    this.who = scene.level.ceo ? 'ceo' : 'boss';
    this.lastLeft = Infinity;
    this.ended = false;
    scene.on((e) => this.onEvent(e));
  }

  // ---------- voice lines ----------
  // Lines are timed by the game clock, so subtitles and turn-taking also work muted or before audio loads.
  say(id, { prio = 1, delay = 0, speaker = null, gain = 1 } = {}) {
    const meta = id ? this.voices[id] : null;
    if (!id || (!meta && !Audio.has(id))) return null;
    if (this.talking() && this.line.prio > prio) return null;
    if (this.line?.h) this.line.h.stop(0.12);
    const rate = this.scene.level.ceo && speaker == null ? 0.97 : 1;
    const dur = (Audio.duration(id) || meta?.dur || 2) / rate;
    const h = Audio.play(id, { delay, gain, rate, pan: speaker == null ? -0.35 : this.pan(speaker) });
    const env = h ? null : Audio.envelope(id);
    this.line = { id, h, env, prio, speaker, el: 0, delay, dur, text: meta?.text || '', shown: false };
    if (delay <= 0) this.showLine();
    return h;
  }
  showLine() {
    const l = this.line;
    l.shown = true;
    if (!l.text) return;
    if (l.speaker == null) this.hud.subtitle(l.text, l.dur, this.who);
    else this.hud.crowdSay(l.speaker, l.text, l.dur);
  }
  talking() { const l = this.line; return !!l && l.el < l.delay + l.dur + 0.04; }
  lips() {
    const l = this.line;
    if (!l || l.speaker != null || !l.shown) return 0;
    if (l.h) return clamp(l.h.level() * 1.6);
    const tt = l.el - l.delay;
    if (tt < 0 || tt > l.dur) return 0;
    if (l.env && l.env.length) return clamp((l.env[Math.min(l.env.length - 1, Math.floor(tt * 60))] || 0) * 1.6);
    return clamp(0.45 + 0.45 * Math.sin(tt * 19) * Math.sin(tt * 6.3 + 1));
  }
  pan(id) {
    const v = this.scene.views[id];
    return v ? clamp((v.screen.headX / Math.max(1, this.scene.W)) * 2 - 1, -1, 1) * 0.7 : 0;
  }

  update(dt) {
    const sim = this.sim, b = sim.boss;
    if (this.line) {
      this.line.el += dt;
      if (!this.line.shown && this.line.el >= this.line.delay) this.showLine();
    }
    // boss lips follow his own voice only
    this.scene.speak = this.lips();
    if (this.line && !this.talking()) this.line = null;
    if (sim.over) return;
    // the drone: the boss talks continuously while presenting
    const presenting = b.phase === 'read' || b.phase === 'toScr';
    if (presenting && !this.talking()) {
      this.gap -= dt;
      if (this.gap <= 0) {
        const id = this.nextSlideLine ? this.bags.slide.next() : this.bags.talk.next();
        this.nextSlideLine = false;
        this.say(id, { prio: 0 });
        this.gap = 0.35 + Math.random() * 0.9;
      }
    }
    // the teacher's pet flatters now and then
    const pet = sim.people.find((p) => p.kind === 'pelota');
    if (pet && b.phase === 'read') {
      this.flatterT -= dt;
      if (this.flatterT <= 0 && !this.talking()) { this.flatterT = 22 + Math.random() * 14; this.say('p02', { prio: 1, speaker: pet.id, gain: 0.8 }); }
    }
    // music follows the tension
    const watching = sim.bossWatching() && b.phase !== 'drowsy';
    const near = b.phase === 'read' ? clamp((sim.readProgress() - 0.55) / 0.45) : b.phase === 'warn' || b.phase === 'toAud' ? 1 : 0;
    Audio.music.setIntensity(clamp(0.3 + 0.35 * near + (watching ? 0.3 : 0)));
    Audio.music.setTempoScale(1 - 0.22 * sim.sleepiness());
    const left = sim.timeLimit - sim.t;
    if (left < 10.5 && Math.floor(left) !== Math.floor(this.lastLeft) && left > 0) Audio.sfx.tick();
    this.lastLeft = left;
  }

  // ---------- yawns ----------
  yawn(e) {
    const sim = this.sim, p = sim.people[e.id], v = this.scene.views[e.id];
    const me = p === sim.player, nR = this.scene.rows.length;
    const depth = nR > 1 ? p.r / (nR - 1) : 0;
    let id, gain, rate = 1;
    if (p.kind === 'intern' && e.loud) { id = 'intern_yawn'; gain = 1.05; }
    else if (p.kind === 'sleeper' && e.big > 1) { id = 'sleeper_yawn'; gain = 1.1; }
    else {
      const fem = (v.baseLook || v.look).gender === 'f';
      id = me ? this.yawnMe.next() : (fem ? this.yawnF : this.yawnM).next();
      rate = me ? 1 : 0.93 + ((p.id * 37) % 17) / 100;
      gain = me ? 1 : (0.52 + 0.3 * (1 - depth)) * (e.big > 1 ? 1.25 : 1);
    }
    const h = Audio.play(id, { bus: 'yawn', gain, rate, pan: this.pan(e.id), lowpass: me ? 0 : 9500 - depth * 4200 });
    const old = this.yawnH.get(e.id);
    if (old) old.stop(0.1);
    if (h) this.yawnH.set(e.id, h);
  }
  endYawn(id, fade) { const h = this.yawnH.get(id); if (h) { h.stop(fade); this.yawnH.delete(id); } }

  onEvent(e) {
    const sim = this.sim, sfx = Audio.sfx;
    switch (e.type) {
      case 'yawn': this.yawn(e); break;
      case 'close': this.endYawn(e.id, e.id === sim.player.id ? 0.35 : 0.55); break;
      case 'stifle': this.endYawn(e.id, 0.06); Audio.play('stifle', { gain: 0.7, pan: this.pan(e.id) }) || sfx.pop(0.6); break;
      case 'tell': if (sim.t - this.lastTell > 0.14) { this.lastTell = sim.t; sfx.tell(); } break;
      case 'psst': (Audio.has('psst') ? Audio.play('psst', { gain: 0.75, pan: this.pan(sim.player.id) }) : sfx.psst()); break;
      case 'wake':
        Audio.snore.stop(e.id); sfx.snort();
        if (!this.woke.has(e.id)) { this.woke.add(e.id); this.say('z01', { prio: 2, speaker: e.id, delay: 0.15 }); }
        break;
      case 'fallAsleep': Audio.snore.start(e.id, { gain: 0.45, pan: this.pan(e.id) }); break;
      case 'snitch': {
        const pet = sim.people[e.id];
        const namesYou = e.why === 'psst' || sim.isYawning(sim.player);
        this.say(namesYou ? 'p01' : 'p03', { prio: 3, speaker: pet.id });
        sfx.whoosh(1);
        break;
      }
      case 'coffeeCrash': sfx.pop(0.5); break;
      case 'bossWarn': if (Math.random() < 0.6) this.say(this.bags.cue.next(), { prio: 1 }); break;
      case 'bossTurn': sfx.whoosh(e.to === 'aud' ? 1 : -1); break;
      case 'bossRead': sfx.click(); this.scene.boss.click?.(); if (Math.random() < 0.45) this.nextSlideLine = true; this.gap = Math.min(this.gap, 0.3); break;
      case 'glanceWarn': sfx.tick(); break;
      case 'glance': sfx.whoosh(1); break;
      case 'suspect': this.say(this.bags.sus.next(), { prio: 3 }); sfx.suspense(); break;
      case 'infect':
        Audio.choir.setVoices(Math.min(12, e.n + 2)); Audio.choir.swell(TUNE.drowsy + 1.2);
        sfx.ding(Math.min(6, e.n - sim.K));
        this.say(this.bags.drowsy.next(), { prio: 3, delay: 0.55 });
        break;
      case 'orb': sfx.pop(1 + Math.min(12, e.idx) * 0.075); break;
      case 'callout': {
        let id = 'c07';
        if (e.player) id = Math.random() < 0.5 ? 'c01' : 'c02';
        else if (e.ids.length > 1) id = 'c06';
        else { const nm = sim.people[e.ids[0]].name; id = SURNAME_LINES[nm] || 'c07'; }
        this.say(id, { prio: 4, delay: 0.1 });
        sfx.caught();
        if (e.player) setTimeout(() => sfx.strike(), 280);
        break;
      }
      case 'end': this.end(e.kind); break;
    }
  }

  end(kind) {
    if (this.ended) return;
    this.ended = true;
    Audio.music.stop(kind === 'win' ? 0.6 : 1.4);
    for (const [id] of this.yawnH) if (id === this.sim.player.id) this.endYawn(id, 0.2);
    if (kind === 'win') {
      if (this.line?.h) this.line.h.stop(0.1);
      this.line = null;
      Audio.play('boss_yawn', { gain: 1.15, pan: -0.35, delay: 0.25 }) || Audio.sfx.pop(0.5);
      Audio.choir.setVoices(12); Audio.choir.swell(5);
      setTimeout(() => Audio.sfx.fanfare(), 1900);
      this.finalLine = this.bags.win.next();
      this.say(this.finalLine, { prio: 9, delay: 5.2 });
    } else if (kind === 'fired') {
      this.finalLine = 'l01';
      this.say('l01', { prio: 9, delay: 0.3 });
    } else {
      this.finalLine = 'l02';
      this.say('l02', { prio: 9, delay: 0.25 });
    }
  }

  // the boss's closing words, quoted on the result screens
  finalText() { return (this.finalLine && this.voices[this.finalLine]?.text) || ''; }

  stopAll() {
    if (this.line?.h) this.line.h.stop(0.1);
    this.line = null;
    for (const h of this.yawnH.values()) h.stop(0.1);
    this.yawnH.clear();
    for (const p of this.sim.people) Audio.snore.stop(p.id);
    Audio.choir.stop();
  }
}
