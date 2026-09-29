// The menu is the fruit shop's scale. Each level is a PLU key with its product on it; pressing one
// weighs that shopping (the LCD settles on its kilos, and blinks OVERLOAD past the plate's 30 kg) and
// the printer feeds out its label. The green key starts it. Behind the scale, the canvas runs the
// selected level, played by a ghost.
import { t } from '../i18n.js';
import { el, esc, wire, ICON, PLU, checkMark, soundBtn, bindMute, mssUp, barcodeSVG } from './dom.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX = 30;
// DSEG7: a blank the width of a digit is '!'; the decimal point is a segment of the digit before it
// (an LCD has no comma, in any language), and the colon is narrow in both strings alike
const pad = (s, n) => '!'.repeat(Math.max(0, n - s.replace(/[.:]/g, '').length)) + s;
const kgStr = (v) => pad((Math.round(v * 200) / 200).toFixed(3), 5);

function labelHTML(r) {
  return `<article class="lbl">
      <h1 class="lbl-t">${esc(t('title')).replace(/ (\S+)$/, '<br>$1')}</h1>
      <p class="lbl-band"><span>${esc(r.floor)}</span><span>${esc(t('bags', { n: r.bags }))}</span></p>
      <p class="lbl-sub">${esc(r.sub)}</p>
      ${barcodeSVG(r.n, r.kg * 1000)}
    </article>`;
}

export function scaleScreen({ rows, sel, muted, onSelect, onGo, onMute, onLang }) {
  const keys = rows.map((r) => {
    const lock = r.state === 'locked', name = `${r.floor} · ${r.name}`;
    return `<button class="plu ${lock ? 'locked' : ''} ${r.state === 'next' ? 'next' : ''}" data-i="${r.i}" data-quiet="1"
        aria-pressed="false" aria-label="${esc(lock ? t('keyLocked', { n: r.n }) : t('key', { n: r.n, name }))}">
        <span class="plu-n">${r.n}</span>${lock ? ICON.lock : PLU[r.id]}
        <span class="plu-ck">${lock ? '' : [0, 1, 2].map((k) => checkMark(r.set?.[k])).join('')}</span>
      </button>`;
  }).join('');
  const node = el(`
    <section class="scr title" data-screen="title">
      <div class="scale">
        <div class="sc-head">
          <div class="lcd" role="status" aria-live="polite">
            <p class="lcd-name"></p>
            <div class="lcd-fs">
              <p class="lcd-f f-kg"><span class="lcd-l">${esc(t('lcd.peso'))}</span><span class="seg"><i aria-hidden="true">88.888</i><b></b></span></p>
              <p class="lcd-f f-fl"><span class="lcd-l">${esc(t('lcd.piso'))}</span><span class="seg"><i aria-hidden="true">8</i><b></b></span></p>
              <p class="lcd-f f-rec"><span class="lcd-l">${esc(t('lcd.record'))}</span><span class="seg"><i aria-hidden="true">8:88</i><b></b></span></p>
            </div>
            <p class="lcd-over" aria-hidden="true">▲ ${esc(t('lcd.over'))}</p>
          </div>
          <div class="sc-side">
            <span class="pilot" aria-hidden="true"></span>
            <p class="plate" aria-hidden="true"><b>Max ${MAX} kg</b><span>Min 40 g</span><span>e = 5 g</span><span>CE <b>M</b> 26</span></p>
          </div>
        </div>
        <div class="sc-mid">
          <div class="keys">${keys}</div>
          <div class="printer"><div class="slot"></div><div class="tape"></div></div>
        </div>
        <div class="sc-fn">
          <button class="fk fk-lang" data-act="lang" aria-label="${esc(t('langName'))}" title="${esc(t('langName'))}">${esc(t('langShort'))}</button>
          ${soundBtn(muted, t('sound'))}
          <button class="go" data-act="go" data-autofocus><span>${esc(t('go'))}</span></button>
        </div>
      </div>
    </section>`);
  const lcd = node.querySelector('.lcd'), nameEl = lcd.querySelector('.lcd-name'), kgEl = lcd.querySelector('.f-kg b');
  const flEl = lcd.querySelector('.f-fl b'), recEl = lcd.querySelector('.f-rec b'), tape = node.querySelector('.tape'), go = node.querySelector('.go');
  let cur = -1, shown = 0, raf = 0;
  // a scale settles: past the reading, back under it, and still
  function settle(to) {
    cancelAnimationFrame(raf);
    const from = shown, t0 = performance.now(), T = reduced() ? 0 : 560;
    const step = (now) => {
      const k = T ? Math.min(1, (now - t0) / T) : 1;
      shown = k >= 1 ? to : to + (from - to) * Math.exp(-4.5 * k) * Math.cos(9.5 * k);
      kgEl.textContent = kgStr(Math.max(0, shown));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function printLabel(r, first) {
    const old = tape.querySelector('.lbl:not(.torn)');
    if (old) { old.classList.add('torn'); old.setAttribute('aria-hidden', 'true'); setTimeout(() => old.remove(), 300); }
    const l = el(labelHTML(r));
    if (!first || !reduced()) l.classList.add('feed');
    tape.appendChild(l);
  }
  node.select = (i, first = false) => {
    const r = rows[i];
    if (!r || r.state === 'locked' || i === cur) return;
    cur = i;
    node.querySelectorAll('.plu').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
    nameEl.innerHTML = `<b>${esc(r.floor)}</b> ${esc(r.name)}`;
    flEl.textContent = String(r.floor_n);
    recEl.textContent = r.best != null ? mssUp(r.best) : '-:--';
    settle(r.kg);
    lcd.classList.toggle('over', r.kg > MAX);
    node.querySelector('.pilot').classList.toggle('over', r.kg > MAX);
    go.setAttribute('aria-label', t('goAria', { n: r.n, name: `${r.floor} · ${r.name}` }));
    printLabel(r, first);
  };
  node.querySelectorAll('.plu').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i, r = rows[i];
    if (r.state === 'locked') { onSelect(i, 'locked'); return; }
    if (i === cur) { onGo(i); return; }
    onSelect(i, 'key');
    node.select(i);
  }));
  wire(node, { go: () => onGo(cur), mute: bindMute(onMute), lang: onLang });
  node.current = () => cur;
  node.scaleRect = () => node.querySelector('.scale').getBoundingClientRect();
  const stop = node._stop; node._stop = () => { cancelAnimationFrame(raf); stop?.(); };
  node.select(sel, true);
  return node;
}
