// One meeting on screen: simulation + audience views + boss + room + effects.
// Pure canvas; the DOM/UI, audio and HUD live elsewhere and listen to scene events.
import { Sim, DT, Y, TUNE } from './sim.js';
import { Stage } from './stage.js';
import { PersonView } from './person.js';
import { BossView, drawBoss, makeCeoLook } from './boss.js';
import { drawChair, drawBody, drawFront, toneLook } from './person_draw.js';
import { FX, FONT } from './fx.js';
import { TAU, clamp, lerp, ease, smooth, rgba, ellipse, roundRect } from './util.js';

const SLIDE_TINTS = ['#9fd0ff', '#ffd59a', '#b8f0c2', '#ffb3c7', '#d6c4ff', '#fff1a8', '#a8f0ec'];
export const COL = { yawn: '#c3b3ff', you: '#ffd166', danger: '#ff5a4f', ok: '#9d7bff', warn: '#ffb341' };

export class Scene {
  constructor(level, images, opts = {}) {
    this.level = level;
    this.opts = opts;
    this.demo = !!opts.demo;
    this.sim = new Sim(level, { seed: opts.seed ?? ((Math.random() * 1e9) | 0), holdRead: !!opts.holdRead || this.demo });
    this.stage = new Stage(level, images);
    this.views = this.sim.people.map((p) => new PersonView(p));
    this.boss = new BossView();
    if (level.ceo) this.boss.look = makeCeoLook();
    this.fx = new FX();
    // the title crowd yawns and ripples, but never shouts over the logo
    if (this.demo) this.fx.text = () => null;
    this.rows = [];
    for (const v of this.views) (this.rows[v.p.r] ||= []).push(v);
    this.rowPeople = this.rows.map((row) => (row || []).map((v) => v.p));
    const nR = this.rows.length, room = this.stage.room;
    for (const v of this.views) {
      v.baseLook = v.look;
      v.look = toneLook(v.look, room.fog, (nR > 1 ? v.p.r / (nR - 1) : 0) * (room.fogK ?? 0.2));
      v.ringT = Math.random() * 0.4; v.zT = Math.random() * 1.2;
    }
    this.me = this.views[this.sim.player.id];
    this.acc = 0;
    this.time = 0;
    this.slow = 1;
    this.handlers = [];
    this.hover = null;
    this.speak = 0;
    this.spot = null;
    this.watchA = 0;
    this.endT = 0;
    this.youT = 0;
    this.demoT = 1;
    this.clockSpin = 0;
    this.W = 1; this.H = 1;
    this.meterTarget = () => ({ x: this.W / 2, y: 40 });
  }

  on(fn) { this.handlers.push(fn); }

  layout(W, H, hud) {
    this.W = W; this.H = H;
    const portrait = H > W * 1.05;
    const R = portrait ? Math.min(W * 0.12, H * 0.062) : Math.min(H * 0.112, W * 0.075);
    this.bossPos = { x: portrait ? W * 0.16 : Math.max(R * 1.75, W * 0.095), y: H - R * (portrait ? 1.25 : 1.6), R };
    const left = portrait ? hud.left : Math.max(hud.left, this.bossPos.x + R * 0.6);
    const safe = { left, right: W - hud.right, top: hud.top, bottom: H - hud.bottom };
    this.stage.layout(W, H, this.sim.people, safe);
    for (const v of this.views) {
      v.seat = this.stage.seat(v.p);
      v.screen.x = v.seat.x; v.screen.y = v.seat.y; v.screen.R = v.seat.R;
      v.screen.headX = v.seat.x; v.screen.headY = v.seat.y - 1.22 * v.seat.R;
    }
  }

  emit(e) { for (const h of this.handlers) h(e, this); }

  update(dt, bot) {
    const sim = this.sim;
    dt *= this.slow;
    this.time += dt;
    this.acc += dt;
    let n = 0;
    // frozen: the room breathes (views, boss, fx) but the meeting clock does not run
    if (this.frozen) this.acc = 0;
    while (this.acc >= DT && n < 16) {
      this.acc -= DT; n++;
      if (bot) bot.step();
      if (this.demo) this.demoStep(DT);
      sim.step(DT);
      for (const e of sim.events) { this.visual(e); this.emit(e); }
      sim.events.length = 0;
    }
    if (n >= 16) this.acc = 0;
    if (sim.over) this.endT += dt;
    this.slow = sim.over === 'win' ? lerp(0.55, 1, smooth((this.endT - 0.25) / 1.4)) : 1;

    const bs = this.boss.screen;
    for (const v of this.views) {
      const dx = bs.headX - v.screen.headX, dy = bs.headY - v.screen.headY, d = Math.hypot(dx, dy) || 1;
      v.update(dt, sim, { bossDir: { x: dx / d, y: dy / d } });
      this.ambient(v, dt);
    }
    let culprit = null;
    if (sim.boss.phase === 'callout' && sim.boss.calloutIds.length) {
      const c = this.views[sim.boss.calloutIds.includes(sim.player.id) ? sim.player.id : sim.boss.calloutIds[0]].screen;
      const sx = this.bossPos.x + this.bossPos.R * 1.4, sy = this.bossPos.y - this.bossPos.R * 0.2;
      const dx = c.headX - sx, dy = c.headY - sy, d = Math.hypot(dx, dy) || 1;
      culprit = { x: dx / d, y: dy / d };
    }
    this.boss.update(dt, sim, { speak: this.speak, culpritDir: culprit });
    if (sim.boss.phase === 'bossYawn') {
      this.boss.ringT = (this.boss.ringT || 0) - dt;
      if (this.boss.mouth.x > 0.8 && this.boss.ringT <= 0) { this.boss.ringT = 0.32; this.fx.ring(bs.headX, bs.headY, bs.R * 1.2, bs.R * 5, COL.ok, 1.4, bs.R * 0.12); }
    }
    this.fx.update(dt);
    this.watchA = lerp(this.watchA, sim.bossWatching() && !sim.over ? 1 : 0, 1 - Math.exp(-10 * dt));
    if (this.spot) { this.spot.t += dt; if (this.spot.t > this.spot.dur) this.spot = null; }
    this.youT += dt;
    if (this.psstLink && (this.psstLink.t += dt) > 0.6) this.psstLink = null;
    if (sim.over === 'time') this.clockSpin += dt;
  }

  // title-screen crowd: random people yawn while the boss drones on
  demoStep(dt) {
    this.demoT -= dt;
    const sim = this.sim;
    if (this.demoT <= 0) {
      this.demoT = 0.9 + Math.random() * 1.6;
      const idle = sim.people.filter((p) => p.yp === Y.IDLE && !p.sleeping && p.refr <= 0 && p !== sim.player);
      if (idle.length) { const p = idle[(Math.random() * idle.length) | 0]; p.big = Math.random() < 0.2 ? 1.5 : 1; sim.forceYawn(p, 0); }
    }
    sim.player.refr = 1;
  }

  ambient(v, dt) {
    const p = v.p, s = v.screen;
    if (this.sim.isYawning(p)) {
      v.ringT -= dt;
      if (v.ringT <= 0) {
        v.ringT = 0.42;
        const you = p === this.sim.player;
        this.fx.ring(s.headX, s.headY + s.R * 0.2, s.R * 1.05, s.R * (p.big > 1 ? 3.6 : 2.7), you ? COL.you : COL.yawn, 1.0, Math.max(1.5, s.R * 0.1));
      }
    }
    if (p.sleeping) { v.zT -= dt; if (v.zT <= 0) { v.zT = 1.1 + Math.random() * 0.5; this.fx.zzz(s.headX + s.R * 0.8, s.headY - s.R * 0.9, s.R * 0.8); } }
    if (v.tears > 0.6 && Math.random() < dt * 2.2) this.fx.tear(s.headX + (Math.random() < 0.5 ? -1 : 1) * s.R * 0.45, s.headY, Math.random() < 0.5 ? -1 : 1, s.R * 0.09);
  }

  // one-shot visuals for simulation events
  visual(e) {
    const sim = this.sim, fx = this.fx;
    const S = (id) => this.views[id].screen;
    switch (e.type) {
      case 'yawn': {
        const s = S(e.id), you = e.id === sim.player.id;
        fx.ring(s.headX, s.headY, s.R * 0.9, s.R * 2.1, you ? COL.you : COL.yawn, 0.5, Math.max(2, s.R * 0.16));
        break;
      }
      case 'tell': { const s = S(e.id); fx.burst(s.headX, s.headY - s.R * 1.1, 5, COL.yawn, { speed: s.R * 3, size: s.R * 0.08, dur: 0.45, gravity: 0 }); break; }
      case 'stifle': { const s = S(e.id); fx.text(this.t('pop.stifle'), s.headX, s.headY - s.R * 1.8, { size: Math.max(14, s.R * 0.8), color: '#e8e2ff', dur: 1 }); break; }
      case 'psst': {
        const s = S(e.id), m = this.me.screen;
        this.psstLink = { from: sim.player.id, to: e.id, t: 0 };
        fx.text('psst!', lerp(m.headX, s.headX, 0.35), lerp(m.headY, s.headY, 0.35) - m.R * 1.4, { size: Math.max(15, m.R * 0.85), color: '#ffffff', dur: 0.9, rise: 20 });
        fx.ring(s.headX, s.headY, s.R * 1.1, s.R * 1.9, '#ffffff', 0.45, Math.max(2, s.R * 0.12));
        if (e.res === 'pelota') fx.text(this.t('pop.snitch'), s.headX, s.headY - s.R * 2.2, { size: Math.max(16, s.R), color: COL.danger, dur: 1.3, stamp: true, delay: 0.25 });
        break;
      }
      case 'wake': { const s = S(e.id); fx.text('!', s.headX, s.headY - s.R * 1.9, { size: s.R * 1.8, color: COL.warn, dur: 0.9, stamp: true }); fx.burst(s.headX, s.headY - s.R, 10, ['#ffffff', COL.warn], { speed: s.R * 6, size: s.R * 0.1, dur: 0.5, gravity: 0 }); break; }
      case 'snitch': { const s = S(e.id); fx.text(this.t('pop.snitch'), s.headX, s.headY - s.R * 2.3, { size: Math.max(17, s.R * 1.05), color: COL.danger, dur: 1.4, stamp: true }); break; }
      case 'coffeeCrash': { const s = S(e.id); fx.text(this.t('pop.crash'), s.headX, s.headY - s.R * 2, { size: Math.max(14, s.R * 0.8), color: '#e7d2b8', dur: 1.6 }); break; }
      case 'noise': {
        const s = S(e.id);
        for (let i = 0; i < 3; i++) fx.ring(s.headX, s.headY, s.R * 1.2, s.R * 5.5, COL.warn, 0.9, Math.max(2, s.R * 0.14), i * 0.16);
        fx.text(this.t('pop.noise'), s.headX, s.headY - s.R * 2.3, { size: Math.max(16, s.R * 0.95), color: COL.warn, dur: 1.2 });
        break;
      }
      case 'suspect': fx.shake(2.5, 0.25); break;
      case 'infect': {
        fx.flash(COL.ok, 0.16);
        const n = e.ids.length;
        if (n >= Math.max(4, sim.K + 1)) fx.text(this.t('pop.chain', { n }), this.W / 2, this.H * 0.32, { size: 34 + Math.min(20, n * 1.5), color: '#fff3a8', dur: 1.5, stamp: true, outline: '#3b1f6e' });
        break;
      }
      case 'seen': {
        const s = S(e.id), idx = e.idx;
        fx.orb(s.headX, s.headY - s.R, this.meterTarget, { delay: 0.25 + idx * 0.075, dur: 0.75, size: Math.max(7, s.R * 0.36), color: COL.ok,
          onArrive: () => this.emit({ type: 'orb', n: e.n, idx }) });
        fx.text('+1', s.headX, s.headY - s.R * 1.9, { size: Math.max(14, s.R * 0.8), color: '#efe6ff', dur: 0.8, delay: idx * 0.075, outline: '#3b1f6e' });
        break;
      }
      case 'callout': {
        this.spot = { ids: e.ids.slice(), t: 0, dur: TUNE.callout - 0.1 };
        fx.shake(e.player ? 9 : 5, 0.45);
        if (e.player) {
          const s = this.me.screen;
          fx.flash(COL.danger, 0.22);
          fx.text(this.t('pop.busted'), s.headX, s.headY - s.R * 2.4, { size: Math.max(26, s.R * 1.35), color: '#ffffff', outline: '#b3261e', dur: 1.8, stamp: true, rise: 10 });
        }
        break;
      }
      case 'end': {
        if (e.kind === 'win') {
          const b = this.boss.screen;
          this.fx.burst(this.W * 0.5, this.H * 0.25, 60, ['#ffd35a', '#c3b3ff', '#8fd3ff', '#ff9bb3', '#b8f0c2'], { kind: 'conf', speed: this.H * 0.9, size: this.H * 0.008, dur: 2.6, gravity: this.H * 0.55, drag: 1.4 });
          this.fx.ring(b.headX, b.headY, b.R, b.R * 8, COL.ok, 1.6, b.R * 0.2);
        } else if (e.kind === 'fired') fx.flash('#000000', 0.25);
        break;
      }
    }
  }

  t(key, vars) { return this.opts.t ? this.opts.t(key, vars) : key; }

  pick(x, y, touch) {
    let best = null, bd = Infinity;
    for (const v of this.views) {
      if (v.p === this.sim.player) continue;
      const s = v.screen, dx = x - s.headX, dy = (y - (s.headY + s.R * 0.6)) * 0.72;
      const d = Math.hypot(dx, dy) / (s.R * (touch ? 2.6 : 1.9));
      if (d < 1 && d < bd) { bd = d; best = v; }
    }
    return best;
  }

  mood() {
    const L = this.level, sim = this.sim;
    const mins = (L.min || 0) + sim.t + this.clockSpin * 30;
    return { late: clamp(sim.t / sim.timeLimit), minutes: mins % 60, hour: (L.hour || 9) + Math.floor(mins / 60) };
  }

  draw(g) {
    const sim = this.sim, st = this.stage, W = this.W, H = this.H, t = this.time;
    const off = this.fx.offset();
    g.save();
    g.translate(off.x, off.y);
    st.drawBackground(g, t, this.mood());

    // audience, back row first
    const chair = st.room.chair || '#3a3f4a';
    for (let r = this.rows.length - 1; r >= 0; r--) {
      const row = this.rows[r];
      if (!row) continue;
      const tone = (this.rows.length > 1 ? r / (this.rows.length - 1) : 0) * (st.room.fogK ?? 0.2);
      for (const v of row) drawChair(g, v, v.seat.x, v.seat.y, v.seat.R, v.chairTint || (v.chairTint = shadeChair(chair, st.room.fog, tone)));
      for (const v of row) {
        const s = v.seat;
        this.drawHalo(g, v);
        drawBody(g, v, s.x, s.y, s.R, { deskY: s.deskY });
        v.screen.headX = s.x + Math.sin(v.bodyYaw.x) * 0.25 * s.R;
        v.screen.headY = s.y + (-1.22 + v.lift.x - v.shoulder.x * 0.8) * s.R;
      }
      st.drawDesk(g, r, this.rowPeople[r], tone);
      for (const v of row) drawFront(g, v, v.seat.x, v.seat.y, v.seat.R, { deskY: v.seat.deskY });
    }
    st.drawBeam(g, t, SLIDE_TINTS[sim.boss.slide % SLIDE_TINTS.length], sim.over === 'fired' ? 0 : 1 - 0.7 * this.watchA);

    if (!this.demo) {
      this.drawLinks(g);
      this.drawEyes(g);
      this.drawMarkers(g);
    }
    this.fx.drawWorld(g);
    if (this.spot) this.drawSpot(g);

    const b = this.bossPos;
    drawBoss(g, this.boss, b.x, b.y, b.R);
    if (!this.demo) this.drawBossCount(g);
    g.restore();

    // danger: the boss is looking at the room
    if (this.watchA > 0.01 && !this.demo) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 7);
      const k = this.watchA * (sim.boss.phase === 'drowsy' ? 0.35 : 1);
      const col = sim.boss.phase === 'drowsy' ? COL.ok : COL.danger;
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.56);
      gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, rgba(col, 0.34 * k * pulse));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    st.vignette(g, st.room.night ? 0.55 : 0.32);
    if (sim.over === 'fired') { g.fillStyle = rgba('#12060a', clamp(this.endT / 1.2) * 0.45); g.fillRect(0, 0, W, H); }
    if (sim.over === 'time') { g.fillStyle = rgba('#0b1024', clamp(this.endT / 2) * 0.4); g.fillRect(0, 0, W, H); }
  }

  // soft glow behind the player, and hover highlight behind psst targets
  drawHalo(g, v) {
    const s = v.seat, p = v.p;
    let col = null, a = 0;
    if (p === this.sim.player) { col = COL.you; a = 0.28 + 0.08 * Math.sin(this.time * 3); }
    else if (this.hover === v) { col = '#ffffff'; a = 0.3; }
    if (!col) return;
    const hx = s.x, hy = s.y - s.R * 1.1, r = s.R * 2.3;
    const gr = g.createRadialGradient(hx, hy, s.R * 0.4, hx, hy, r);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; ellipse(g, hx, hy, r, r); g.fill();
  }

  drawLinks(g) {
    const sim = this.sim, t = this.time;
    g.save(); g.lineCap = 'round';
    for (const v of this.views) {
      const p = v.p;
      if (!p.sources.length || p.yp !== Y.IDLE || p.refr > 0 || p.alert > 0) continue;
      const m = clamp(p.meter), b = v.screen;
      for (const sid of p.sources) {
        const src = this.views[sid], a = src.screen, you = src.p === sim.player;
        const dx = b.headX - a.headX, dy = b.headY - a.headY, d = Math.hypot(dx, dy) || 1;
        const x0 = a.headX + (dx / d) * a.R * 1.1, y0 = a.headY + (dy / d) * a.R * 1.1, x1 = b.headX - (dx / d) * b.R * 1.25, y1 = b.headY - (dy / d) * b.R * 1.25;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - d * 0.16;
        const w = Math.max(1.5, (a.R + b.R) * 0.07);
        g.setLineDash([w * 1.6, w * 2.2]); g.lineDashOffset = -t * w * 14;
        g.strokeStyle = rgba('#231a3a', 0.25 + 0.3 * m); g.lineWidth = w + 2;
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
        g.strokeStyle = rgba(you ? COL.you : COL.yawn, 0.45 + 0.55 * m); g.lineWidth = w;
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
      }
    }
    g.setLineDash([]);
    if (this.psstLink) {
      const L = this.psstLink;
      if (L.t <= 0.6) {
        const a = this.views[L.from].screen, b = this.views[L.to].screen, k = ease.outCubic(clamp(L.t / 0.25));
        g.strokeStyle = rgba('#ffffff', 0.8 * (1 - L.t / 0.6)); g.lineWidth = Math.max(2, a.R * 0.1);
        g.setLineDash([a.R * 0.2, a.R * 0.25]);
        g.beginPath(); g.moveTo(a.headX, a.headY - a.R); g.lineTo(lerp(a.headX, b.headX, k), lerp(a.headY - a.R, b.headY - b.R * 0.5, k)); g.stroke();
        g.setLineDash([]);
      }
    }
    // sleepiness rings: how close each coworker is to catching the yawn
    for (const v of this.views) {
      const p = v.p, m = clamp(p.meter);
      if (p === sim.player || p.yp !== Y.IDLE || m < 0.03) continue;
      const s = v.screen, r = s.R * 1.42, w = Math.max(2, s.R * 0.17);
      g.strokeStyle = 'rgba(26,18,46,0.45)'; g.lineWidth = w + 2;
      g.beginPath(); g.arc(s.headX, s.headY, r, 0, TAU); g.stroke();
      g.strokeStyle = m > 0.8 ? '#e4dbff' : COL.yawn; g.lineWidth = w;
      g.beginPath(); g.arc(s.headX, s.headY, r, -Math.PI / 2, -Math.PI / 2 + TAU * m); g.stroke();
    }
    g.restore();
  }

  // little eyes over coworkers who can see the player right now
  drawEyes(g) {
    const sim = this.sim, me = sim.player;
    if (sim.over) return;
    for (const v of this.views) {
      const p = v.p;
      if (p === me || !sim.canSee(p, me)) continue;
      const s = v.screen, x = s.headX, y = s.headY - s.R * 1.85 - Math.min(s.R * 0.2, 6), w = clamp(s.R * 0.5, 7, this.H * 0.018);
      drawEye(g, x, y, w, p.kind === 'pelota' ? COL.danger : '#ffffff');
    }
  }

  drawMarkers(g) {
    const sim = this.sim, s = this.me.screen, t = this.time;
    // "YOU" tag
    const a = sim.over ? 0 : this.youT < 5 ? 1 : 0.8;
    if (a > 0) {
      const R = s.R, fs = clamp(R * 0.62, 12, Math.max(14, this.H * 0.022)), bob = Math.sin(t * 3.2) * fs * 0.18;
      const y = s.headY - R * 1.45 - fs * 0.9 + bob, label = this.t('hud.you');
      g.save(); g.globalAlpha = a;
      g.font = `700 ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(label).width + fs * 0.9, th = fs * 1.35;
      g.fillStyle = COL.you; roundRect(g, s.headX - tw / 2, y - th / 2, tw, th, th / 2); g.fill();
      g.beginPath(); g.moveTo(s.headX - fs * 0.32, y + th / 2 - 1); g.lineTo(s.headX + fs * 0.32, y + th / 2 - 1); g.lineTo(s.headX, y + th / 2 + fs * 0.34); g.closePath(); g.fill();
      g.fillStyle = '#3a2a10'; g.fillText(label, s.headX, y + fs * 0.04);
      g.restore();
    }
    // red target rings on yawners while the boss is watching
    if (this.watchA > 0.3 && !sim.over) {
      const drowsy = sim.boss.phase === 'drowsy';
      for (const v of this.views) {
        if (!sim.isYawning(v.p)) continue;
        const q = v.screen, r = q.R * (1.55 + 0.08 * Math.sin(t * 10));
        g.strokeStyle = rgba(drowsy ? COL.ok : COL.danger, 0.9 * this.watchA); g.lineWidth = Math.max(2.5, q.R * 0.16);
        g.beginPath(); g.arc(q.headX, q.headY, r, 0, TAU); g.stroke();
      }
    }
    // hover target
    if (this.hover && !sim.over) {
      const q = this.hover.screen, far = sim.dist(sim.player, this.hover.p) > TUNE.psstRange;
      g.strokeStyle = far ? 'rgba(255,255,255,0.45)' : '#ffffff'; g.lineWidth = Math.max(2, q.R * 0.12);
      g.setLineDash(far ? [q.R * 0.15, q.R * 0.2] : []);
      g.beginPath(); g.arc(q.headX, q.headY, q.R * 1.5, 0, TAU); g.stroke(); g.setLineDash([]);
      const cd = clamp(sim.psstCd / TUNE.psstCd);
      if (cd > 0) { g.strokeStyle = COL.warn; g.beginPath(); g.arc(q.headX, q.headY, q.R * 1.5, -Math.PI / 2, -Math.PI / 2 + TAU * cd); g.stroke(); }
    }
  }

  drawSpot(g) {
    const sp = this.spot, k = clamp(sp.t / 0.18) * (1 - clamp((sp.t - sp.dur + 0.35) / 0.35));
    if (k <= 0) return;
    g.save();
    g.beginPath(); g.rect(-50, -50, this.W + 100, this.H + 100);
    const holes = sp.ids.map((id) => this.views[id].screen);
    for (const s of holes) { g.moveTo(s.headX + s.R * 2.3, s.headY + s.R * 0.4); g.arc(s.headX, s.headY + s.R * 0.4, s.R * 2.3, 0, TAU, true); }
    g.fillStyle = rgba('#12060c', 0.42 * k); g.fill('evenodd');
    for (const s of holes) {
      g.strokeStyle = rgba(COL.danger, 0.8 * k); g.lineWidth = Math.max(2, s.R * 0.14);
      g.beginPath(); g.arc(s.headX, s.headY + s.R * 0.4, s.R * 2.3, 0, TAU); g.stroke();
    }
    g.restore();
  }

  // while he is deciding, show how many yawns he has spotted against what he needs
  drawBossCount(g) {
    const sim = this.sim, b = sim.boss;
    if (b.phase !== 'suspect' || !b.ep) return;
    const n = b.ep.members.size, K = sim.K, bs = this.boss.screen, R = bs.R;
    const x = bs.headX + R * 1.9, y = bs.headY - R * 1.9, fs = Math.max(18, R * 0.5);
    const pop = ease.outBack(clamp(this.boss.phaseT / 0.2));
    g.save(); g.translate(x, y); g.scale(pop, pop);
    const label = `${n}/${K}`;
    g.font = `700 ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(label).width + fs * 2.2, h = fs * 1.6;
    g.fillStyle = 'rgba(255,255,255,0.95)'; roundRect(g, -w / 2, -h / 2, w, h, h / 2); g.fill();
    g.strokeStyle = n >= K ? COL.ok : COL.danger; g.lineWidth = 3; g.stroke();
    drawEye(g, -w / 2 + fs * 0.85, 0, fs * 0.55, '#ffffff', '#2a1e3a');
    g.fillStyle = n >= K ? COL.ok : COL.danger; g.fillText(label, fs * 0.45, fs * 0.04);
    g.restore();
  }
}

function shadeChair(c, fog, k) { return toneLook({ c }, fog, k).c; }

export function drawEye(g, x, y, w, col = '#ffffff', ink = '#261a36') {
  const h = w * 0.62;
  g.save(); g.translate(x, y);
  g.fillStyle = ink; g.beginPath(); g.moveTo(-w * 0.62, 0); g.quadraticCurveTo(0, -h * 1.12, w * 0.62, 0); g.quadraticCurveTo(0, h * 1.12, -w * 0.62, 0); g.fill();
  g.fillStyle = col; g.beginPath(); g.moveTo(-w * 0.5, 0); g.quadraticCurveTo(0, -h * 0.9, w * 0.5, 0); g.quadraticCurveTo(0, h * 0.9, -w * 0.5, 0); g.fill();
  g.fillStyle = ink; ellipse(g, 0, 0, w * 0.2, w * 0.2); g.fill();
  g.restore();
}
