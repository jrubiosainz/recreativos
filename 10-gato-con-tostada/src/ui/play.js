// The HUD is what's on the fridge door while the cat flies: the room's note in the corner, the butter in its
// own wrapper (the block shrinks from the knife end; a star magnet on the rim marks what the third star needs,
// and falls off when there's less) and the red magnet that pauses. On a touchscreen, two round pads in the
// bottom corners say which half of the screen turns the cat which way, and light up while held.
import { t, getLang } from '../i18n.js';
import { el, esc, wire, soundBtn, bindMute, show, star, ICON, NOTE } from './dom.js';

export class Hud {
  constructor({ level, sim, onPause }) {
    this.sim = sim; this.lv = level; this.par = level.par ?? 0.5;
    const name = level.name[getLang()] || level.name.es, i = (level.n - 1) % 6;
    this.node = el(`<section class="scr play" aria-label="${esc(name)}">
      <div class="hud">
        <div class="lvnote" style="--c:${NOTE.paper[i]};--m:${NOTE.mag[i]}"><span class="pin" aria-hidden="true"></span><b aria-hidden="true">${level.n}</b><span>${esc(name)}</span></div>
        <div class="gauge" role="meter" aria-label="${esc(t('hud.butter'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
          <div class="wrap" aria-hidden="true"><span class="block"></span><span class="par" style="--p:${this.par}">${star(true)}</span></div>
          <span class="pct" aria-hidden="true"></span>
        </div>
        <button class="rb" data-act="pause" aria-label="${esc(t('hud.pause'))}" title="${esc(t('hud.pause'))}">${ICON.pause}</button>
      </div>
      <div class="pads" aria-hidden="true"><span class="tpad l" title="${esc(t('hud.left'))}">${ICON.turnL}</span><span class="tpad r" title="${esc(t('hud.right'))}">${ICON.turnR}</span></div>
    </section>`);
    const $ = (s) => this.node.querySelector(s);
    this.gauge = $('.gauge'); this.block = $('.block'); this.pct = $('.pct'); this.parEl = $('.par');
    this.padL = $('.tpad.l'); this.padR = $('.tpad.r');
    this.last = { pct: -1, under: null, low: null, l: false, r: false };
    wire(this.node, { pause: () => onPause() });
  }
  mount() { show(this.node); this.update(); }

  update() {
    const s = this.sim, L = this.last, b = Math.max(0, Math.min(1, s.b)), pct = Math.round(b * 100);
    if (pct !== L.pct) {
      this.block.style.setProperty('--b', b.toFixed(3));
      this.pct.innerHTML = `${pct}<small>%</small>`;
      this.gauge.setAttribute('aria-valuenow', String(pct));
      L.pct = pct;
    }
    const under = b < this.par - 1e-9, low = !s.end && b < 0.25;
    if (under !== L.under) { this.gauge.classList.toggle('under', under); this.parEl.innerHTML = star(!under); L.under = under; }
    if (low !== L.low) { this.gauge.classList.toggle('low', low); L.low = low; }
  }
  // which way the player is turning, lit on the pads
  pads(l, r) {
    const L = this.last;
    if (l !== L.l) { this.padL.classList.toggle('on', l); L.l = l; }
    if (r !== L.r) { this.padR.classList.toggle('on', r); L.r = r; }
  }
  // the flight is over: the pause magnet and the pads step back
  finish() { this.node.classList.add('done'); this.pads(false, false); this.update(); }
}

// the shopping list, torn off the pad: tick what to do next
export function pauseCard({ save, touch, onResume, onRestart, onLevels, onMute }) {
  const item = (act, key, main) => `<button class="item ${main ? 'main' : ''}" data-act="${act}" ${main ? 'data-autofocus' : ''}><i aria-hidden="true"></i><span>${esc(t(key))}</span></button>`;
  const node = el(`<section class="scr pause" role="dialog" aria-modal="true" aria-labelledby="p-h">
    <div class="list">
      <span class="pin" aria-hidden="true"></span>
      <div class="sheet">
        <h2 id="p-h">${esc(t('pause.title'))}</h2>
        <div class="acts">${item('resume', 'pause.resume', true)}${item('restart', 'pause.restart')}${item('levels', 'pause.levels')}</div>
        <p class="keys">${touch ? esc(t('pause.touch')) : t('pause.keys')}</p>
      </div>
      ${soundBtn(save.muted, t('sound'))}
    </div>
  </section>`);
  wire(node, { resume: onResume, restart: onRestart, levels: onLevels, mute: bindMute(onMute) });
  return node;
}
