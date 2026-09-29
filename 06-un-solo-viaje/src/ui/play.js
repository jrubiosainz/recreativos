// Over the building while you climb: a strip of thermal label along the top (pause, the level, how
// long until the car you blocked starts honking, sound) and its green band, which prints what comes
// next on the way up: each door or button, the hand it wants and how far it is. A chip turns into a
// yellow sticker when you have no hand for it (you'll do it with your nose). At the bottom, between
// your hands, the key that sets everything down and picks it up again.
import { t } from '../i18n.js';
import { FALLBACKS } from '../sim.js';
import { el, esc, wire, ICON, WHAT, soundBtn, bindMute, mss, mssUp } from './dom.js';

const ARROW = { L: '◀\uFE0E', R: '▶\uFE0E' };
// the next three things that want a hand: the one you're at, then what's ahead (and, last, your door)
function upcoming(sim) {
  const out = [], st = sim.step;
  if (st && st.k === 'act') out.push({ st, i: sim.si, d: 0 });
  for (const a of sim.ahead(12)) {
    if (out.length >= 3) break;
    if (a.st.k === 'act' || a.st.k === 'end') out.push(a);
  }
  return out;
}
function chipState(sim, st) {
  if (st.k === 'end') return { k: 'home' };
  const h = sim.howFor(st);
  if (FALLBACKS.includes(h.how)) return { k: 'fb', how: h.how };
  return { k: h.how === 'cross' ? 'cross' : 'ok' };
}

export function playScreen({ lv, floor, muted, onPause, onMute, onRest }) {
  const node = el(`
    <section class="scr play" data-screen="play">
      <header class="hud">
        <div class="h-top">
          <button class="hb" data-act="pause" aria-label="${esc(t('hud.pause'))}" title="${esc(t('hud.pause'))} (Esc)">${ICON.pause}</button>
          <p class="h-title"><b>${esc(t('title'))}</b><span>${esc(floor)}</span></p>
          <p class="h-lapse" hidden>${ICON.lapse}<span>×4</span></p>
          <p class="h-honk"><span class="h-l">${esc(t('hud.honkIn'))}</span><span class="h-v seg">0:00</span></p>
          ${soundBtn(muted, t('sound'), 'hb')}
        </div>
        <div class="h-band">
          <ol class="route" aria-label="${esc(t('hud.next'))}"></ol>
          <p class="h-light" hidden>${ICON.bulb}<span class="seg">0:00</span></p>
        </div>
      </header>
      <button class="rest" data-act="rest" data-quiet="1" hidden><span class="r-ic"></span><span class="r-t"></span></button>
    </section>`);
  const $ = (s) => node.querySelector(s);
  const route = $('.route'), honk = $('.h-honk'), honkL = honk.querySelector('.h-l'), honkV = honk.querySelector('.h-v');
  const light = $('.h-light'), lightV = light.querySelector('span'), lapse = $('.h-lapse'), rest = $('.rest'), restI = $('.r-ic'), restT = $('.r-t');
  const last = { sig: '', honk: '', late: null, hot: null, light: '', lit: null, dark: null, lapse: null, rest: '', ds: [] };
  function chips(sim) {
    const list = upcoming(sim), states = list.map((a) => chipState(sim, a.st));
    const busy = !!sim.act;
    const sig = list.map((a, k) => `${a.i}:${states[k].k}:${states[k].how || ''}`).join('|') + (busy ? '*' : '');
    if (sig !== last.sig) {
      last.sig = sig; last.ds = [];
      route.innerHTML = list.map((a, k) => {
        const s = states[k], st = a.st, what = st.k === 'end' ? t('hud.home') : t('what.' + st.what);
        const aria = s.k === 'home' ? what : s.k === 'fb' ? t('hud.chipFb', { what, how: t('tut.fbHow.' + s.how).toLowerCase() })
          : st.side ? t('hud.chip', { what, side: t('side.' + st.side), d: Math.ceil(a.d) }) : t('hud.chipAny', { what, d: Math.ceil(a.d) });
        return `<li class="chip c-${s.k} ${k === 0 && busy ? 'now' : ''}" aria-label="${esc(aria)}">
          ${st.side ? `<span class="c-side">${ARROW[st.side]}</span>` : ''}${st.k === 'end' ? WHAT.home : WHAT[st.what] || ''}
          ${s.k === 'fb' ? `<span class="c-fb">${esc(t('hud.how.' + s.how))}</span>` : ''}<span class="c-d"></span></li>`;
      }).join('');
    }
    const els = route.querySelectorAll('.c-d');
    list.forEach((a, k) => {
      const d = a.d < 0.5 ? '' : `${Math.ceil(a.d)} ${t('hud.m')}`;
      if (els[k] && last.ds[k] !== d) { els[k].textContent = d; last.ds[k] = d; }
    });
  }
  function restKey(sim) {
    let k = '', off = false;
    if (sim.end) k = '';
    else if (sim.loading()) { k = 'load'; off = sim.autoLoad || !sim.toGrab(); }
    else if (sim.rest) { k = 'up'; off = sim.rest.phase !== 'idle'; }
    else { k = 'down'; off = !!sim.act || !sim.held(); }
    const sig = k + off;
    if (sig === last.rest) return;
    last.rest = sig;
    rest.hidden = !k;
    if (!k) return;
    restI.innerHTML = k === 'up' ? ICON.up : ICON.down;
    restT.textContent = t('rest.' + k);
    rest.setAttribute('aria-label', t('rest.aria.' + k));
    rest.setAttribute('aria-disabled', String(off));
    rest.dataset.k = k;
  }
  node.update = (sim, lapsing = false) => {
    const left = sim.lv.par - (sim.end ? sim.end.t : sim.t), late = left <= 0;
    const hv = late ? mss(-left) : mssUp(left);
    if (hv !== last.honk) { honkV.textContent = hv; last.honk = hv; }
    if (late !== last.late) { honk.classList.toggle('late', late); honkL.textContent = t(late ? 'hud.honking' : 'hud.honkIn'); last.late = late; }
    const hot = !late && left <= 10;
    if (hot !== last.hot) { honk.classList.toggle('hot', hot); last.hot = hot; }
    const timer = !sim.end && sim.step?.lit === 'timer';
    if (timer !== last.lit) { light.hidden = !timer; last.lit = timer; }
    if (timer) {
      const on = sim.light.on, v = on ? mssUp(sim.light.until - sim.t) : '-:--';
      if (v !== last.light) { lightV.textContent = v; last.light = v; }
      if (!on !== last.dark) { light.classList.toggle('dark', !on); light.setAttribute('aria-label', t(on ? 'hud.light' : 'hud.dark')); last.dark = !on; }
    }
    if (lapsing !== last.lapse) { lapse.hidden = !lapsing; last.lapse = lapsing; }
    if (!sim.end) chips(sim);
    else if (last.sig !== 'end') { last.sig = 'end'; route.innerHTML = ''; }
    restKey(sim);
  };
  node.hudRect = () => $('.hud').getBoundingClientRect();
  node.restRect = () => (rest.hidden ? null : rest.getBoundingClientRect());
  node.chipRect = (k = 0) => route.children[k]?.getBoundingClientRect() || null;
  wire(node, { pause: onPause, mute: bindMute(onMute), rest: onRest });
  return node;
}

export function pauseScreen({ floor, name, muted, touch, onResume, onRestart, onQuit, onMute }) {
  const node = el(`
    <section class="scr pause" data-screen="pause">
      <div class="pcard" role="dialog" aria-modal="true" aria-labelledby="pz-t">
        <h2 id="pz-t">${esc(t('pause.t'))}</h2>
        <p class="lbl-band"><span>${esc(floor)}</span><span>${esc(name)}</span></p>
        <div class="tags">
          <button class="tag go-tag" data-act="resume" data-autofocus><span>${esc(t('pause.resume'))}</span></button>
          <button class="tag" data-act="restart"><span>${esc(t('pause.restart'))}</span></button>
          <button class="tag" data-act="quit"><span>${esc(t('pause.quit'))}</span></button>
        </div>
        <div class="p-snd">${soundBtn(muted, t('sound'), 'hb')}</div>
        ${touch ? '' : `<p class="keys">${t('pause.keys')}</p>`}
      </div>
    </section>`);
  wire(node, { resume: onResume, restart: onRestart, quit: onQuit, mute: bindMute(onMute) });
  return node;
}
