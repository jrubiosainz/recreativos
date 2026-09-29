// Sound direction for one departure: the station's approach chime and name, then sim
// events turned into foley, voices and PA announcements; feeds the captions (the
// departure board's LED ticker for the PA, speech bubbles for people), keeps the melody
// and the train glued to the sim clock, and schedules the turn tick so it lands on the
// perfect-push moment.
import { Audio } from './audio.js';
import { TUNE } from './sim.js';
import { tc } from './i18n.js';

const OOF = ['x_oof1', 'x_oof2', 'x_oof3', 'x_oof4', 'x_oof5'];
const RATE = { sumo: 0.8, kid: 1.35, student: 1.08, office: 1.12, tourist: 1.02, sleepy: 0.92, cake: 1.1, runner: 1.05, mascot: 0.7 };
const LOUD = new Set(['angry', 'wail', 'shock', 'run', 'shout', 'big']);
const FAR_PA = ['j_line', 'j_arrive', 'j_thanks', 'j_close'];
const heard = new Set();                            // stations whose approach chime has played this session

class Bag {
  constructor(ids) { this.ids = ids; this.q = []; this.last = null; }
  next() {
    if (!this.q.length) { this.q = this.ids.slice().sort(() => Math.random() - 0.5); if (this.q[this.q.length - 1] === this.last) this.q.unshift(this.q.pop()); }
    return (this.last = this.q.pop());
  }
}

export class Director {
  constructor(scene, hud, bubbles, { intro = false, lang = 'es' } = {}) {
    this.scene = scene; this.sim = scene.sim; this.L = scene.L; this.hud = hud; this.bub = bubbles; this.lang = lang;
    this.t = 0; this.timers = []; this.last = {}; this.voice = null; this.pa = null;
    this.tick = null; this.doorSt = 'open'; this.oofEnd = 0; this.oof = new Bag(OOF); this.crowdF = -1;
    this.saidFull = false; this.beckons = 0; this.stopped = false;
    this.off = scene.on((type, e) => this.on(type, e));
    Audio.sfx.setStation(this.L.id);
    Audio.amb.start(this.L.id, { distantPA: () => this.farPA() });
    Audio.train.reset();
    Audio.train.onStop = () => Audio.sfx.airBrake(1);
    this.preroll = 0; this.chime = null;
    if (intro) {                                    // the platform chime, then the train is announced as it pulls in
      scene.frozen = true;
      const id = this.L.id, ch = heard.has(id) ? null : Audio.approach(id);
      if (ch) {                                     // the station's own 接近メロディ the first time, the plain four tones on a retry
        heard.add(id); this.chime = ch;
        this.preroll = Math.max(1.3, ch.dur + 0.25);
        hud.pa?.('♪ ' + (Audio.APPROACH[id].title || '接近メロディ'), tc('hud.appr.' + id, '') || tc('hud.approach', ''), this.preroll);
      } else {
        this.preroll = Audio.live ? 1.3 : 0.5;
        Audio.sfx.paChime(true);
      }
    }
  }

  // ------------------------------------------------------------------ clock
  after(dt, fn) { this.timers.push({ at: this.t + dt, fn }); }
  gap(key, sec) { if (this.t - (this.last[key] ?? -1e9) < sec) return false; this.last[key] = this.t; return true; }

  update(dt) {
    if (this.stopped) return;
    const sc = this.scene, s = this.sim, k = dt * sc.slow;
    this.t += k;
    if (this.preroll > 0 && (this.preroll -= k) <= 0) { sc.frozen = false; this.announce(this.L.id === 's6' ? 'j_delay' : 'j_arrive'); }
    if (this.timers.length) {
      const due = this.timers.filter((x) => x.at <= this.t);
      if (due.length) { this.timers = this.timers.filter((x) => x.at > this.t); for (const x of due) x.fn(); }
    }
    Audio.train.update(sc.trainX(), sc.trainV(), k);
    if (Math.abs(sc.fillShown - this.crowdF) > 0.01) { this.crowdF = sc.fillShown; Audio.amb.setCrowd(this.crowdF); }
    if (Audio.melody.playing) {
      const pos = s.t - s.T.melody;
      if (pos > this.L.melody + 0.25) Audio.melody.finish(); else Audio.melody.sync(pos, sc.slow);
    }
    const st = s.doors.st;                          // after a stall the doors try again, with no event of their own
    if (st !== this.doorSt) { if (st === 'closing' && this.doorSt === 'hold') this.reclose(); this.doorSt = st; }
    this.scheduleTick();
  }

  // The turn tick is put on the audio clock ahead of time, so it sounds on the turn
  // itself (the perfect moment), not a frame late. Re-planned whenever a push changes his swing.
  scheduleTick() {
    const s = this.sim, c = s.cur;
    if (!c || c.state !== 'swing' || this.scene.frozen || !Audio.live) { this.cancelTick(); return; }
    const nt = s.nextTurn(c);
    if (!nt || nt.board) { this.cancelTick(); return; }
    const ahead = (nt.t - s.t) / this.scene.slow;
    if (ahead > 0.25) return;
    if (this.tick && this.tick.c === c && Math.abs(this.tick.simT - nt.t) < 0.004) return;
    this.cancelTick();
    const lag = Math.min(0.06, Math.max(0, Audio.latency - 0.016));
    this.tick = { c, simT: nt.t, h: Audio.sfx.tick(Audio.now + Math.max(0.002, ahead - lag), Math.min(1.2, s.energy(c)), 0) };
  }
  cancelTick() { this.tick?.h?.cancel(); this.tick = null; }

  // ------------------------------------------------------------------ voices
  // the platform PA: one announcement at a time, captioned on the departure board
  announce(id, { force = false } = {}) {
    if (!force && this.pa && this.t < this.pa.until) return;
    this.pa?.h?.stop(0.2);
    const r = Audio.say(id); if (!r) return;
    this.pa = { until: this.t + r.dur + 0.3, h: r.h };
    this.hud.pa?.(r.text.split('|')[0], r.sub?.[this.lang] || '', r.dur + 0.4);
  }
  // people: one line at a time; a louder moment can cut in
  talk(id, { prio = 1, at = 'cur', side = 0, key = id, every = 0, pan } = {}) {
    if (every && !this.gap(key, every)) return;
    if (this.voice && this.t < this.voice.until && this.voice.prio >= prio) return;
    this.voice?.h?.stop(0.1);
    const r = Audio.say(id, pan != null ? { pan } : {}); if (!r) return;
    this.voice = { until: this.t + r.dur, prio, h: r.h };
    const m = Audio.meta(id) || {};
    const jp = r.sub ? r.text.split('|')[0] : null;
    if (at !== 'none') this.bub?.add({ text: jp || r.text, sub: jp ? r.sub[this.lang] : '', who: r.who, loud: LOUD.has(m.cat), dur: Math.max(1.4, r.dur + 0.3), at, side });
  }
  grunt(p, q) {
    if (Audio.now < this.oofEnd) return;
    const rate = (RATE[p?.type] || 1) * (0.95 + Math.random() * 0.1);
    const h = Audio.play(q === 'bump' ? 'x_bump' : this.oof.next(), { bus: 'voice', gain: q === 'perfect' ? 0.95 : q === 'bump' ? 0.9 : 0.7, rate, room: 0.12 });
    if (h) this.oofEnd = h.t0 + h.dur * 0.8;
  }
  farPA() {                                         // announcements from the other platforms of a big station
    const ids = FAR_PA.concat('j_st_' + this.L.id), id = ids[(Math.random() * ids.length) | 0];
    Audio.play(id, { bus: 'amb', gain: 0.2, hp: 420, lp: 1700, hall: 0.9, pan: Math.random() < 0.5 ? -0.7 : 0.7 });
  }

  // ------------------------------------------------------------------ events
  on(type, e) {
    if (this.stopped) return;
    const fx = Audio.sfx, p = e.p, s = this.sim;
    switch (type) {
      case 'open': fx.doorSlide(true, 0.55); fx.doorChime(1); this.stationName(); break;
      case 'melody': Audio.melody.start(this.L.id, this.L.melody); break;
      case 'announce': Audio.melody.finish(); this.announce('j_close', { force: true }); break;
      case 'doors': fx.doorChime(2); fx.doorSlide(false, TUNE.travel); break;
      case 'beckon':
        fx.beckon(p?.side * 0.3 || 0);
        if (this.beckons++ === 0 || (Math.random() < 0.3 && this.gap('hai', 9))) this.talk('m_hai', { at: 'me', prio: 0, every: 4 });
        break;
      case 'atDoor': this.atDoor(p); break;
      case 'push': if (e.q === 'bump') fx.bump(0); else fx.push(e.q, e.combo, 0); this.grunt(p, e.q); if (e.q === 'bump' && s.fill > 1.2 && Math.random() < 0.4) this.talk('w_foot', { at: 'door', side: -1, every: 10 }); break;
      case 'whiff': fx.whiff(0); break;
      case 'squeak': fx.squeak(Math.min(1, e.e), 0); break;
      case 'incident':
        fx.incident(e.kind);
        if (e.kind === 'granny') Audio.play('x_gasp', { bus: 'voice', gain: 0.9, room: 0.15 });
        this.talk('m_sorry', { at: 'none', prio: 4 });  // the scene stamps 失礼しました! itself
        this.after(1.05, () => this.talk(e.kind === 'granny' ? 'g_push' : 'c_ruin', { prio: 5 }));
        break;
      case 'board': this.onBoard(e); break;
      case 'runner': fx.steps(1.3, p.side * 0.9, 0); this.talk('r_wait', { at: 'side', side: p.side, prio: 3 }); if (!(s.t < s.T.close && s.T.close - s.t < 3.4)) this.after(0.7, () => this.announce('j_rush')); break;
      case 'missed': fx.slam(0); this.after(0.25, () => this.talk('r_miss', { at: 'side', side: p.side || 1, prio: 4 })); break;
      case 'stall':
        fx.stall(0);
        if (e.n === 1) this.after(0.3, () => this.announce('j_force'));
        else Audio.play('x_crowd', { bus: 'voice', gain: 0.6, pan: -0.2, room: 0.3 });
        break;
      case 'reopen': fx.reopen(0); break;
      case 'giveup':
        fx.giveup(0);
        if (p?.type === 'salary' || p?.type === 'office') this.talk('s_giveup', { prio: 3 });
        else Audio.play('x_sigh', { bus: 'voice', gain: 0.8, room: 0.2 });
        break;
      case 'closed':
        fx.doorThunk(0);
        if (e.delay > 0.05) this.after(0.5, () => this.announce('j_delay', { force: true }));
        break;
      case 'point': fx.whistle(0.65); this.talk('m_shinko', { at: 'none', prio: 5 }); break;
      case 'depart': if (s.delay <= 0.05) this.after(1.0, () => this.announce('j_thanks')); break;
    }
  }

  atDoor(p) {
    if (!p) return;
    const t = p.type;
    if (t === 'granny') this.talk('g_board', { prio: 1 });
    else if (t === 'sleepy') this.talk('z_board', { prio: 1 });
    else if (t === 'tourist') this.talk('t_board', { prio: 1, every: 14 });
    else if (t === 'student' && Math.random() < 0.5) this.talk('st_sorry', { prio: 1, every: 10 });
    else if (t === 'salary' && Math.random() < 0.6) this.talk('s_late', { prio: 1, every: 30 });
  }

  onBoard(e) {
    const p = e.p, t = p.type, fx = Audio.sfx;
    fx.board(t === 'sumo' || t === 'mascot', 0);
    this.after(0.55, () => fx.token(e.fill));       // when the HUD token lands on the gauge
    if (t === 'sumo') { this.talk('u_board', { at: 'door', prio: 2 }); Audio.play('x_crowd', { bus: 'voice', gain: 0.55, pan: 0.2, room: 0.3, delay: 0.25 }); }
    else if (t === 'kid') this.talk('k_wee', { at: 'door', prio: 2 });
    else if (t === 'cake' && !p.ruined) this.talk('c_safe', { at: 'door', prio: 2 });
    else if (t === 'runner') this.talk('r_made', { at: 'door', prio: 3 });
    if (!this.saidFull && e.fill > 1.3) {           // the car complains, you answer
      this.saidFull = true;
      this.after(0.5, () => this.talk('w_full', { at: 'door', side: 1, prio: 1 }));
      this.after(2.1, () => this.talk('m_oku', { at: 'me', prio: 1 }));
    }
  }

  // 駅名放送: 「始発、始発です。」 as the doors open, once the PA is free, unless the melody is nearly due
  stationName(wait = 0.9) {
    this.after(wait, () => {
      const s = this.sim;
      if (this.pa && this.t < this.pa.until) this.stationName(this.pa.until - this.t + 0.1);
      else if (s.t < s.T.melody - 2.5) this.announce('j_st_' + this.L.id);
    });
  }

  reclose() { Audio.sfx.doorChime(1); Audio.sfx.doorSlide(false, this.sim.doors.dur); this.talk('m_door', { at: 'me', prio: 2 }); }

  stop(f = 0.35) {
    if (this.stopped) return;
    this.stopped = true; this.off?.(); this.cancelTick(); this.timers = [];
    this.voice?.h?.stop(0.15); this.pa?.h?.stop(0.3); this.chime?.stop(0.2);
    Audio.train.onStop = null;
    Audio.quiet(f);
  }
}
