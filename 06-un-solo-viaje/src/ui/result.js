// The end of a trip: the plastic bag it all came in, the photo of your finest moment taped to it and
// the scale's label for what you carried: every bag and its weight (what broke, struck through; what
// went down the stairs, marked), the net weight, the time against the honk, the three checks the
// printer ticks one by one, and the barcode. A round seal says how it went. Luggage tags for what next.
import { t, getLang, num } from '../i18n.js';
import { BAG } from '../levels.js';
import { Audio } from '../audio.js';
import { el, esc, wire, later, ICON, checkMark, mss, mssUp, barcodeSVG } from './dom.js';

// what made it: everything but a bag at the bottom of the stairs
export function netKg(sim) {
  const lost = sim.end?.why === 'tumble' ? sim.end.bag : -1;
  return sim.lv.bags.reduce((s, k, i) => s + (i === lost ? 0 : BAG[k].kg), 0);
}
const kg3 = (v) => `${num(v, 3)} kg`;
// seals: the text runs round a circle of r 44 (276.5 long), the bag in the middle
export const BAG_D = ['M6.2 8.6h11.6l1.1 12.4H5.1z', 'M9.2 8.6V7a2.8 2.8 0 0 1 5.6 0v1.6', 'M9.3 13.2c.9 1.2 4.5 1.2 5.4 0'];
const BAG_IC = BAG_D.map((d) => `<path d="${d}"/>`).join('');
export function sealSVG(won) {
  return `<svg class="seal ${won ? '' : 'bad'}" viewBox="0 0 120 120" aria-hidden="true">
    <defs><path id="seal-p" d="M16 60a44 44 0 1 1 88 0a44 44 0 1 1-88 0"/></defs>
    <circle cx="60" cy="60" r="57" class="s-disc"/><circle cx="60" cy="60" r="53.5" class="s-ring"/><circle cx="60" cy="60" r="34" class="s-ring"/>
    <text class="s-t"><textPath href="#seal-p" textLength="274" lengthAdjust="spacing">${esc(t(won ? 'res.seal' : 'res.sealLose'))}</textPath></text>
    <g class="s-ic" transform="translate(40.8 38.5) scale(1.6)" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${BAG_IC}</g>
  </svg>`;
}

export function resultScreen({ lv, sim, rec, photo, floor, name, next, onAgain, onNext, onHome, onShare }) {
  const won = sim.end.why === 'arrive', lang = getLang(), set = rec.set;
  const lost = won ? -1 : sim.end.bag, broken = new Set(sim.stats.broken), kg = netKg(sim);
  const items = lv.bags.map((k, i) => {
    const fell = i === lost, br = !fell && broken.has(i);
    const tag = fell ? `<em class="it-tag">${esc(t('res.fell'))}</em>` : br ? `<em class="it-tag">${esc(t('res.broken'))}</em>` : '';
    return `<li class="${fell ? 'fell' : br ? 'broken' : ''}"><span class="it-n">${esc(BAG[k][lang])}</span>${tag}<span class="it-kg">${kg3(BAG[k].kg)}</span></li>`;
  }).join('');
  const stars = t('res.stars').map((s, i) => `<li data-k="${i}">${checkMark(false)}<span>${esc(s)}</span></li>`).join('');
  const tags = [
    next && won ? ['next', ICON.next, t('res.next')] : ['again', ICON.retry, t('res.again')],
    ['share', ICON.share, t('res.share')],
    next && won ? ['again', ICON.retry, t('res.again')] : null,
    ['home', ICON.menu, t('res.menu')],
  ].filter(Boolean);
  const node = el(`
    <section class="scr result ${won ? 'won' : 'lost'}" data-screen="end">
      <div class="r-wrap" style="--n:${lv.bags.length};--r:${rec.best ? 1 : 0}">
        ${photo ? `<figure class="print"><div class="p-img"></div><figcaption class="sr">${esc(t('res.photo'))}</figcaption><span class="p-tape" aria-hidden="true"></span></figure>` : ''}
        <div class="r-card">
          <article class="lbl r-lbl" aria-labelledby="r-t">
            <h1 class="lbl-t" id="r-t">${esc(won ? t('title') : t('res.lose'))}</h1>
            <p class="lbl-band"><span>${esc(floor)} · ${esc(name)}</span><span>${esc(t('res.band'))}</span></p>
            <ul class="r-items">${items}</ul>
            <div class="r-neto">
              <span class="r-l">${esc(t('res.neto'))}</span>
              <span class="seg r-kg" aria-label="${esc(kg3(kg))}"><i aria-hidden="true">88.888</i><b aria-hidden="true">${kg.toFixed(3)}</b></span><span class="r-u" aria-hidden="true">kg</span>
            </div>
            <p class="r-times"><span>${esc(t('res.time'))} <b>${mssUp(sim.end.t)}</b></span><span>${esc(t('res.par'))} <b>${mss(lv.par)}</b></span></p>
            <ol class="r-stars">${stars}</ol>
            ${rec.best ? `<p class="r-rec">${esc(t('res.record'))}</p>` : ''}
            ${barcodeSVG(lv.n, kg * 1000)}
          </article>
          ${sealSVG(won)}
        </div>
        <nav class="r-tags">${tags.map(([k, ic, label], j) => `<button class="tag ${j === 0 ? 'go-tag' : ''}" data-act="${k}" ${j === 0 ? 'data-autofocus' : ''}>${ic}<span>${esc(label)}</span></button>`).join('')}</nav>
      </div>
    </section>`);
  if (photo) node.querySelector('.p-img').appendChild(photo.c);
  wire(node, { again: onAgain, next: onNext, home: onHome, share: (e, b) => onShare(b) });
  // the printer ticks the checks one at a time; then the seal comes down
  const lis = node.querySelectorAll('.r-stars li');
  set.forEach((on, i) => later(node, 820 + 360 * i, () => {
    if (!on) return;
    const li = lis[i];
    li.classList.add('on');
    li.querySelector('.ck').outerHTML = checkMark(true);
    Audio.ui.star(i);
  }));
  later(node, 820 + 360 * 3 + 120, () => { node.classList.add('sealed'); Audio.ui.sticker(); });
  return node;
}
