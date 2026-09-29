// Over the station while you cross it: a strip of the network's white enamel along the top with the
// pause, the trip, how long until the train leaves, the station clock and the «perdones» you have
// said; under it, when the station speaks, its caption crawling across a departures band.
import { t } from '../i18n.js';
import { el, esc, wire, ICON, MARK, soundBtn, bindMute, mss, hms } from './dom.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function playScreen({ lv, name, muted, onPause, onMute }) {
  const node = el(`
    <section class="scr play" data-screen="play">
      <header class="hud">
        <button class="hb" data-act="pause" aria-label="${esc(t('hud.pause'))}" title="${esc(t('hud.pause'))} (Esc)">${ICON.pause}</button>
        <p class="h-trip">${MARK}<span><b>${lv.n}</b> ${esc(name)}</span></p>
        <p class="h-dep" role="timer" aria-live="off"><span class="h-l">${esc(t('hud.leaves'))}</span><span class="h-v">0:00</span></p>
        <p class="h-clock"><span class="h-l">${esc(t('hud.clock'))}</span><span class="h-v">00:00:00</span></p>
        <p class="h-per"><span class="h-l">${esc(t('hud.perdones'))}</span><span class="h-v"><b>0</b><small>/${lv.par}</small></span></p>
        ${soundBtn(muted, t('sound'), 'hb')}
      </header>
      <div class="pa" aria-live="polite" hidden><p><span></span></p></div>
    </section>`);
  const dep = node.querySelector('.h-dep'), depV = dep.querySelector('.h-v'), clk = node.querySelector('.h-clock .h-v');
  const per = node.querySelector('.h-per'), perV = per.querySelector('b'), pa = node.querySelector('.pa'), paT = pa.querySelector('span');
  let last = { dep: '', clk: '', per: -1, hot: null, over: null }, paTimer = 0;
  node.update = (sim) => {
    const left = Math.max(0, lv.dep - sim.t), d = mss(left), c = hms(sim.clockAt());
    if (d !== last.dep) { depV.textContent = d; last.dep = d; }
    const hot = left <= 10 && !sim.end;
    if (hot !== last.hot) { dep.classList.toggle('hot', hot); last.hot = hot; }
    if (c !== last.clk) { clk.textContent = c; last.clk = c; }
    const n = sim.P.perdones;
    if (n !== last.per) {
      perV.textContent = n;
      if (last.per >= 0) { per.classList.remove('bump'); void per.offsetWidth; per.classList.add('bump'); }
      last.per = n;
      const over = n > lv.par;
      if (over !== last.over) { per.classList.toggle('over', over); last.over = over; }
    }
  };
  // the station's announcement: dur is how long the recording lasts (or a reading time when muted)
  node.pa = (text, dur) => {
    clearTimeout(paTimer);
    paT.textContent = text; pa.hidden = false;
    pa.classList.toggle('still', reduced());
    pa.style.setProperty('--dur', `${Math.max(4, dur + 1.2).toFixed(2)}s`);
    pa.classList.remove('run'); void pa.offsetWidth; pa.classList.add('run');
    paTimer = setTimeout(() => { pa.hidden = true; }, Math.max(4, dur + 1.4) * 1000);
  };
  node.paOff = () => { clearTimeout(paTimer); pa.hidden = true; };
  node.hudRect = () => node.querySelector('.hud').getBoundingClientRect();
  const stop = node._stop; node._stop = () => { clearTimeout(paTimer); stop?.(); };
  wire(node, { pause: onPause, mute: bindMute(onMute) });
  return node;
}

export function pauseScreen({ muted, touch, onResume, onRestart, onQuit, onMute }) {
  const node = el(`
    <section class="scr pause" data-screen="pause">
      <div class="pcard" role="dialog" aria-modal="true" aria-labelledby="pz-t">
        <h2 id="pz-t">${esc(t('pause.t'))}</h2>
        <button class="go wide" data-act="resume" data-autofocus><span class="go-t">${esc(t('pause.resume'))}</span></button>
        <button class="tb" data-act="restart">${ICON.retry}<span>${esc(t('pause.restart'))}</span></button>
        <button class="tb" data-act="quit">${ICON.ticket}<span>${esc(t('pause.quit'))}</span></button>
        <div class="p-snd">${soundBtn(muted, t('sound'), 'tb')}</div>
        ${touch ? '' : `<p class="keys">${t('pause.keys')}</p>`}
      </div>
    </section>`);
  wire(node, { resume: onResume, restart: onRestart, quit: onQuit, mute: bindMute(onMute) });
  return node;
}
