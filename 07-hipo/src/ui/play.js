// The HUD is printed in the poster's vocabulary. Top left, the hiccup clock: a red roundel whose
// pink wedge fills towards the next «¡HIP!», with three scoops beside it for the hiccups being held
// (the third one bursts). Top middle, the PREMIO sticks found; top right, the time against the prize
// time and the pause. On touch screens, ◀ ▶ bottom left and a big AGUANTA roundel bottom right.
import { t, getLang } from '../i18n.js';
import { el, esc, wire, show, stick, soundBtn, bindMute, ICON, mss } from './dom.js';
import { Audio } from '../audio.js';

export class Hud {
  constructor({ level, sim, input, touch, onPause, onTowel }) {
    this.sim = sim; this.input = input; this.touch = touch;
    const n = sim.sticks.length;
    this.node = el(`<section class="scr play ${touch ? 'touch' : ''}" aria-label="${esc(level.name[getLang()] || level.name.es)}">
      <div class="hud">
        <div class="clock" role="img" aria-label="${esc(t('hud.clock'))}">
          <span class="dial"><span class="wedge"></span><b class="hipw">${getLang() === 'es' ? '¡HIP!' : 'HIC!'}</b></span>
          <span class="scoops" aria-hidden="true"><i></i><i></i><i class="bust"></i></span>
        </div>
        <div class="sticks" role="img" aria-label="${esc(t('hud.sticks'))}: 0/${n}">${Array.from({ length: n }, () => stick(false)).join('')}</div>
        <div class="tr">
          <p class="time" aria-label="${esc(t('hud.time'))}"><b>0:00</b><small title="${esc(t('hud.par', { t: mss(sim.par) }))}">${mss(sim.par)}</small></p>
          <button class="rb" data-act="pause" aria-label="${esc(t('hud.pause'))}" title="${esc(t('hud.pause'))}">${ICON.pause}</button>
        </div>
      </div>
      <button class="towel" data-act="towel" hidden>${ICON.towel}<span>${esc(t('hud.towel'))}</span>${touch ? '' : '<kbd>R</kbd>'}</button>
      ${touch ? `<div class="pad" aria-hidden="true">
        <button class="pb l" data-dir="-1" tabindex="-1" aria-label="${esc(t('hud.left'))}">${ICON.left}</button>
        <button class="pb r" data-dir="1" tabindex="-1" aria-label="${esc(t('hud.right'))}">${ICON.right}</button>
        <button class="pb hold" data-hold="1" tabindex="-1" aria-label="${esc(t('hud.holdAria'))}">${ICON.breath}<span>${esc(t('hud.hold'))}</span></button>
      </div>` : ''}
    </section>`);
    this.$ = {
      clock: this.node.querySelector('.clock'), scoops: [...this.node.querySelectorAll('.scoops i')],
      sticks: this.node.querySelector('.sticks'), stickEls: [...this.node.querySelectorAll('.sticks .stk')],
      time: this.node.querySelector('.time b'), timeP: this.node.querySelector('.time'), towel: this.node.querySelector('.towel'),
    };
    this.last = { k: -1, got: -1, s: -1, over: null, lost: null, cls: '' };
    wire(this.node, { pause: () => onPause(), towel: () => onTowel() });
    if (touch) this.bindPad();
  }

  // every finger is its own pointer: walking and holding at once is the whole game
  bindPad() {
    const pads = this.node.querySelectorAll('.pb'), down = new Map();
    const sync = () => {
      let dir = 0, hold = false;
      for (const b of down.values()) { if (b.dataset.dir) dir += +b.dataset.dir; if (b.dataset.hold) hold = true; }
      this.input.touchDir = Math.sign(dir); this.input.touchHold = hold;
      pads.forEach((b) => b.classList.toggle('on', [...down.values()].includes(b)));
    };
    pads.forEach((b) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); down.set(e.pointerId, b); Audio.unlock(); sync(); });
      const up = (e) => { if (down.delete(e.pointerId)) sync(); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    this.releasePad = () => { down.clear(); sync(); };
  }

  mount() { show(this.node); }

  update() {
    const sim = this.sim, h = sim.hic, L = this.last, $ = this.$;
    const p = h.cure > 0 ? 0 : Math.min(1, h.phase / sim.period());
    $.clock.style.setProperty('--p', p.toFixed(3));
    const cls = `clock${h.cure > 0 ? ' cured' : ''}${h.mod ? ' fizz' : ''}${sim.hp.hold ? ' held' : ''}${h.dizzy > 0 ? ' dizzy' : ''}${sim.t - sim.hp.hicT < 0.35 ? ' pop' : ''}`;
    if (cls !== L.cls) { $.clock.className = cls; L.cls = cls; }
    if (h.k !== L.k) {
      $.scoops.forEach((s, i) => s.classList.toggle('on', i < h.k));
      $.clock.style.setProperty('--k', h.k);
      L.k = h.k;
    }
    const got = sim.sticksGot();
    if (got !== L.got) {
      sim.sticks.forEach((s, i) => $.stickEls[i]?.classList.toggle('on', s.got));
      $.sticks.setAttribute('aria-label', `${t('hud.sticks')}: ${got}/${sim.sticks.length}`);
      if (L.got >= 0 && got > L.got) { $.sticks.classList.remove('ding'); void $.sticks.offsetWidth; $.sticks.classList.add('ding'); }
      L.got = got;
    }
    const s = Math.floor(sim.t);
    if (s !== L.s) { $.time.textContent = mss(s); L.s = s; }
    const over = sim.t > sim.par;
    if (over !== L.over) { $.timeP.classList.toggle('over', over); L.over = over; }
    const lost = !sim.end && sim.lost();
    if (lost !== L.lost) { $.towel.hidden = !lost; if (lost) { $.towel.classList.remove('in'); void $.towel.offsetWidth; $.towel.classList.add('in'); } L.lost = lost; }
  }
  // the end: the HUD bows out while the camera watches the splash
  finish() { this.node.classList.add('done'); this.releasePad?.(); }
}

export function pauseCard({ save, touch, onResume, onRestart, onLevels, onMute }) {
  const node = el(`<section class="scr pause" role="dialog" aria-modal="true" aria-labelledby="p-h">
    <div class="card">
      <span class="tape t1" aria-hidden="true"></span><span class="tape t2" aria-hidden="true"></span>
      <h2 id="p-h">${esc(t('pause.title'))}</h2>
      <div class="acts">
        <button class="btn blue" data-act="resume" data-autofocus>${ICON.play}<span>${esc(t('pause.resume'))}</span></button>
        <button class="btn" data-act="restart">${ICON.retry}<span>${esc(t('pause.restart'))}</span></button>
        <button class="btn" data-act="levels">${ICON.grid}<span>${esc(t('pause.levels'))}</span></button>
      </div>
      <p class="keys">${touch ? esc(t('pause.touch')) : t('pause.keys')}</p>
      ${soundBtn(save.muted, t('sound'))}
    </div>
  </section>`);
  wire(node, { resume: onResume, restart: onRestart, levels: onLevels, mute: bindMute(onMute) });
  return node;
}
