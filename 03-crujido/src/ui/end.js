// The screens around the film: the pause card (an intermission slide), the play HUD, the result
// (your film on a strip, the stars, the numbers) and the end of the season.
import { t } from '../i18n.js';
import { Audio } from '../audio.js';
import { drawCurve } from '../gfx/curve.js';
import { el, esc, wire, later, ICON, starIcon, soundBtn, bindMute } from './dom.js';

export function bootScreen() {
  return el(`<section class="scr boot" data-screen="boot"><p><span class="dot"></span>${esc(t('boot'))}</p></section>`);
}

// during the film: one small button; everything else is the canvas
export function playScreen({ onPause, r }) {
  const node = el(`<section class="scr play" data-screen="play">
    <button class="rb pause" data-act="pause" aria-label="${esc(t('pauseBtn'))}" title="${esc(t('pauseBtn'))}">${ICON.pause}</button></section>`);
  const b = node.querySelector('.pause');
  node.place = (q) => { if (q) b.style.cssText = `left:${q.x}px;top:${q.y}px;width:${q.w}px;height:${q.w}px`; };
  node.place(r);
  wire(node, { pause: onPause });
  return node;
}

export function pauseScreen({ muted, onResume, onRestart, onQuit, onMute }) {
  const node = el(`
    <section class="scr pause" data-screen="pause">
      <div class="slide" role="dialog" aria-labelledby="ps-t">
        <h2 id="ps-t">${esc(t('pause.title'))}</h2>
        <div class="col">
          <button class="btn primary" data-act="resume" data-autofocus>${esc(t('pause.resume'))}</button>
          <button class="btn" data-act="restart">${ICON.retry}<span>${esc(t('pause.restart'))}</span></button>
          <button class="btn" data-act="quit">${esc(t('pause.quit'))}</button>
        </div>
        <div class="corner in">${soundBtn(muted, t('sound'))}</div>
      </div>
    </section>`);
  wire(node, { resume: onResume, restart: onRestart, quit: onQuit, mute: bindMute(onMute) });
  return node;
}

// kind: full | expelled | hungry
export function resultScreen({ kind, res, film, data, isLast, onNext, onRetry, onMenu, onShare }) {
  const three = kind === 'full' && res.stars.every(Boolean);
  const head = t('result.' + (three ? 'full3' : kind));
  const sub = kind === 'full' ? t('result.subFull', { film }) : kind === 'expelled' ? t('result.subExpelled') : t('result.subHungry', { ate: res.ate, total: res.total });
  const stats = [['ate', `${res.ate}/${res.total}`], ['heard', res.heard], ['shushes', res.strikes], ['hidden', `${Math.round(res.hidden * 100)} %`]];
  const next = kind === 'full'
    ? `<button class="btn primary" data-act="next" data-autofocus><span>${esc(isLast ? t('result.done') : t('result.next'))}</span>${ICON.next}</button>`
    : `<button class="btn primary" data-act="retry" data-autofocus>${ICON.retry}<span>${esc(t('result.retry'))}</span></button>`;
  const node = el(`
    <section class="scr result k-${kind}" data-screen="result">
      <div class="res" role="dialog" aria-labelledby="rs-h">
        <h2 class="res-h" id="rs-h">${esc(head)}</h2>
        <p class="res-sub">${esc(sub)}</p>
        <figure class="res-fig">
          <canvas class="res-curve" role="img" aria-label="${esc(`${t('card.film')} · ${t('card.hid')} ${res.noises - res.heard} · ${t('card.heard')} ${res.heard}`)}"></canvas>
          <figcaption class="key"><span class="k-film">${esc(t('card.film'))}</span><span class="k-hid">${esc(t('card.hid'))}</span><span class="k-heard">${esc(t('card.heard'))}</span></figcaption>
        </figure>
        <ul class="res-goals">${t('goals').map((g, k) => `<li data-k="${k}">${starIcon(false)}<span>${esc(g)}</span></li>`).join('')}${res.pass ? '' : `<li class="note">${esc(t('result.needPass'))}</li>`}</ul>
        <dl class="res-stats">${stats.map(([k, v]) => `<div><dt>${esc(t('result.' + k))}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <div class="res-btns">
          ${next}
          <div class="row3">
            ${kind === 'full' ? `<button class="btn" data-act="retry">${ICON.retry}<span>${esc(t('result.retry'))}</span></button>` : ''}
            <button class="btn" data-act="share">${ICON.share}<span>${esc(t('result.share'))}</span></button>
            <button class="btn" data-act="menu">${esc(t('result.menu'))}</button>
          </div>
        </div>
      </div>
    </section>`);
  // the strip replays your film, then the stars you earned light one by one
  const cv = node.querySelector('.res-curve');
  let t0 = null, raf = 0;
  const paint = (now) => {
    if (!node.isConnected) return;
    const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w && h) {
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      t0 ??= now;
      const u = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.min(1, (now - t0) / 1300);
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      drawCurve(g, 0, 0, w, h, data, { u: 1 - (1 - u) ** 2, dpr });
      if (u >= 1) return;
    }
    raf = requestAnimationFrame(paint);
  };
  raf = requestAnimationFrame(paint);
  window.addEventListener('resize', () => { t0 = -1e9; cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }, { signal: stopSignal(node) });
  const lis = [...node.querySelectorAll('.res-goals li[data-k]')];
  res.stars.forEach((on, k) => later(node, 1450 + k * 330, () => {
    lis[k].classList.add(on ? 'got' : res.pass ? 'miss' : 'void');
    if (on) { lis[k].querySelector('.star').classList.add('on'); Audio.ui.star(k); }
  }));
  wire(node, { next: onNext, retry: onRetry, menu: onMenu, share: onShare });
  return node;
}

// posters: [{ id, title, src, set }]
export function doneScreen({ posters, stars, max, onShare, onMenu }) {
  const node = el(`
    <section class="scr done" data-screen="allDone">
      <div class="dn" role="dialog" aria-labelledby="dn-h">
        <h2 id="dn-h">${esc(t('done.title'))}</h2>
        <p class="dn-sub">${esc(t('done.sub'))}</p>
        <ol class="dn-grid">${posters.map((p) => `<li><img src="${p.src}" alt="${esc(p.title)}" width="200" height="300" loading="lazy">
          <span class="stars">${[0, 1, 2].map((k) => starIcon(p.set?.[k])).join('')}</span></li>`).join('')}</ol>
        <p class="dn-tot">${starIcon(true)}<span>${esc(t('done.stars', { n: stars, m: max }))}</span></p>
        <div class="res-btns"><div class="row3">
          <button class="btn primary" data-act="share" data-autofocus>${ICON.share}<span>${esc(t('done.share'))}</span></button>
          <button class="btn" data-act="menu">${esc(t('done.menu'))}</button>
        </div></div>
      </div>
    </section>`);
  wire(node, { share: onShare, menu: onMenu });
  return node;
}

// an AbortSignal that fires when the screen is swapped out
function stopSignal(node) {
  const ac = new AbortController(), prev = node._stop;
  node._stop = () => { ac.abort(); prev?.(); };
  return ac.signal;
}
