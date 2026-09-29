// The HUD is the bus's own: across the top, the LED sign over the aisle (the line, what's happening, and
// the time left to your stop, blinking red at the end); beside it the red STOP button, which pauses.
// The window carries everything else: the drops, who called which, the shouts.
import { t, getLang } from '../i18n.js';
import { el, esc, wire, soundBtn, bindMute, show, ICON } from './dom.js';

const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export class Hud {
  constructor({ level, sim, onPause }) {
    this.sim = sim; this.lv = level;
    const name = level.name[getLang()] || level.name.es;
    this.node = el(`<section class="scr play" aria-label="${esc(name)}">
      <div class="hud">
        <div class="sign">
          <span class="line" aria-label="${esc(t('line', { n: level.line || '27' }))}">${esc(level.line || '27')}</span>
          <span class="msg" aria-live="polite"><span class="mt"></span></span>
          <span class="eta" aria-hidden="true"></span>
        </div>
        <button class="stop" data-act="pause" aria-label="${esc(t('hud.pause'))}" title="${esc(t('hud.pause'))}"><span>${esc(t('hud.stopBtn'))}</span></button>
      </div>
    </section>`);
    this.msg = this.node.querySelector('.msg'); this.mt = this.node.querySelector('.mt'); this.eta = this.node.querySelector('.eta'); this.sign = this.node.querySelector('.sign');
    this.last = { msg: null, eta: null, late: null, blink: null };
    this.hardT = -9;
    wire(this.node, { pause: () => onPause() });
  }
  mount() { show(this.node); this.update(); }
  events(evs) { for (const e of evs) if (e.k === 'bus' && e.what === 'hard') this.hardT = this.sim.race; }

  update() {
    const s = this.sim, L = this.last, b = s.bus;
    let msg, blink = false;
    if (s.end) msg = t('led.end');
    else if (s.phase === 'call') { const turn = s.kids.every((k) => k.own === 0 || k.drop); msg = t(turn ? 'led.call' : 'led.wait'); blink = turn; }
    else if (s.phase === 'ready') msg = t('led.ready');
    else if (s.race < 1.2) msg = t('led.go');
    else if (s.race - this.hardT < 1.6) { msg = t('led.hard'); blink = true; }
    else if (b.doors > 0) { msg = t('led.doors'); blink = true; }
    else msg = `${t('led.your')}: ${t('stop.' + this.lv.id)}`;
    if (msg !== L.msg) { this.mt.textContent = msg; L.msg = msg; this.roll(); }
    if (blink !== L.blink) { this.msg.classList.toggle('blink', blink); L.blink = blink; }
    const left = this.lv.stop - s.race, eta = s.end ? '' : mmss(left);
    if (eta !== L.eta) { this.eta.textContent = eta; L.eta = eta; }
    const late = !s.end && s.phase === 'race' && left <= 10;
    if (late !== L.late) { this.sign.classList.toggle('late', late); L.late = late; }
  }
  // a message wider than the sign scrolls across it and back, like the real ones do
  roll() {
    const m = this.msg, over = this.mt.scrollWidth - m.clientWidth;
    m.classList.toggle('roll', over > 2);
    m.style.setProperty('--over', `${-Math.max(0, over + 6)}px`);
    m.style.setProperty('--roll', `${(3 + Math.max(0, over) / 40).toFixed(2)}s`);
  }
  // the end of the race: the sign says so and the STOP button steps back
  finish() { this.node.classList.add('done'); this.update(); }
}

export function pauseCard({ save, touch, onResume, onRestart, onLevels, onMute }) {
  const node = el(`<section class="scr pause" role="dialog" aria-modal="true" aria-labelledby="p-h">
    <div class="card">
      <h2 id="p-h">${esc(t('pause.title'))}</h2>
      <div class="acts">
        <button class="btn yellow" data-act="resume" data-autofocus>${ICON.play}<span>${esc(t('pause.resume'))}</span></button>
        <button class="btn" data-act="restart">${ICON.retry}<span>${esc(t('pause.restart'))}</span></button>
        <button class="btn" data-act="levels">${ICON.ticket}<span>${esc(t('pause.levels'))}</span></button>
      </div>
      <p class="keys">${touch ? esc(t('pause.touch')) : t('pause.keys')}</p>
      ${soundBtn(save.muted, t('sound'))}
    </div>
  </section>`);
  wire(node, { resume: onResume, restart: onRestart, levels: onLevels, mute: bindMute(onMute) });
  return node;
}
