// The HUD is the director's desk, kept to a strip: top left a chip with the ground and the goal, top
// right the pause. The stadium and its big screen carry everything else (laps, signal, the minute).
// On touch screens the whole bottom is the ON AIR tally: a red button you hold, lit while you do.
import { t, getLang, plural } from '../i18n.js';
import { el, esc, wire, show, soundBtn, bindMute, ICON } from './dom.js';
import { Audio } from '../audio.js';

export class Hud {
  constructor({ level, sim, input, touch, onPause }) {
    this.sim = sim; this.input = input; this.touch = touch;
    const name = level.name[getLang()] || level.name.es;
    this.node = el(`<section class="scr play" aria-label="${esc(name)}">
      <div class="hud">
        <p class="chip"><span class="nm">${esc(name)}</span><span class="gl">${esc(t('goal', { n: plural('lapsN', level.goal) }))}</span></p>
        <button class="rb" data-act="pause" aria-label="${esc(t('hud.pause'))}" title="${esc(t('hud.pause'))}">${ICON.pause}</button>
      </div>
      ${touch ? `<button class="air" tabindex="-1" aria-label="${esc(t('hud.airAria'))}"><i class="dot" aria-hidden="true"></i><span>${esc(t('hud.air'))}</span></button>` : ''}
    </section>`);
    this.air = this.node.querySelector('.air');
    this.last = { on: null, dead: null };
    wire(this.node, { pause: () => onPause() });
    if (this.air) this.bindAir();
  }

  // one finger holds the tally while another drags the camera across the stands
  bindAir() {
    const b = this.air, down = new Set();
    const sync = () => { this.input.touchAir = down.size > 0; };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); down.add(e.pointerId); Audio.unlock(); sync(); });
    const up = (e) => { if (down.delete(e.pointerId)) sync(); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    this.release = () => { down.clear(); sync(); };
  }

  mount() { show(this.node); }

  update() {
    if (!this.air) return;
    const sim = this.sim, L = this.last;
    const dead = sim.cut > 0 || sim.lock > 0, on = !!this.input.touchAir && !dead;
    if (on !== L.on) { this.air.classList.toggle('on', on); L.on = on; }
    if (dead !== L.dead) { this.air.classList.toggle('dead', dead); L.dead = dead; }
  }
  // the whistle: the desk clears while the stadium takes its bow
  finish() { this.node.classList.add('done'); this.release?.(); }
}

export function pauseCard({ save, touch, onResume, onRestart, onLevels, onMute }) {
  const node = el(`<section class="scr pause" role="dialog" aria-modal="true" aria-labelledby="p-h">
    <div class="board">
      <h2 id="p-h">${esc(t('pause.title'))}</h2>
      <div class="acts">
        <button class="btn amber" data-act="resume" data-autofocus>${ICON.play}<span>${esc(t('pause.resume'))}</span></button>
        <button class="btn" data-act="restart">${ICON.retry}<span>${esc(t('pause.restart'))}</span></button>
        <button class="btn" data-act="levels">${ICON.bowl}<span>${esc(t('pause.levels'))}</span></button>
      </div>
      <p class="keys">${touch ? esc(t('pause.touch')) : t('pause.keys')}</p>
      ${soundBtn(save.muted, t('sound'))}
    </div>
  </section>`);
  wire(node, { resume: onResume, restart: onRestart, levels: onLevels, mute: bindMute(onMute) });
  return node;
}
