// After the doors close: the photo of your moment, printed in the network's blue, and the back of the
// card, where the validator prints how it went. The steps you danced (or the straight line you walked),
// how many «perdones» it took, a line of dot-matrix, then a star punched through for each thing done well.
import { t } from '../i18n.js';
import { Audio } from '../audio.js';
import { el, esc, wire, ICON, MARK, punch, later } from './dom.js';
import { drawSteps } from '../footprints.js';
import { howText } from '../share.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// r: { lv, name, sim, rec, duo (canvas), dance, next (has a next trip), saveRumbas, onAgain, onHome, onNext, onShare }
export function resultScreen(r) {
  const { lv, sim, rec } = r, P = sim.P, won = sim.end.why === 'arrive', n = P.perdones;
  const how = howText({ won, margin: sim.end.margin });
  const dance = r.dance, lab = !dance ? t('res.clean') : dance.rumba ? t('res.rumba') : t('res.dance');
  const notes = [];
  if (rec.best && rec.prevBest != null) notes.push(t('res.best', { n }));
  for (const k of rec.rumbas) notes.push(t('res.newRumba', { who: t('who.' + k), n: r.saveRumbas }));
  if (rec.first && r.next) notes.push(t('res.unlocked', { n: lv.n + 1 }));
  const nextFirst = won && r.next;
  const btn = (act, icon, text, cls = '') => `<button class="sb ${cls}" data-act="${act}" ${cls.includes('pri') ? 'data-autofocus' : ''}>${icon}<span>${esc(text)}</span></button>`;
  const node = el(`
    <section class="scr result ${won ? 'won' : 'lost'}" data-screen="end" aria-labelledby="rs-h">
      <div class="r-sheet">
        <header class="r-band"><h2 id="rs-h">${esc(t('title'))}</h2><p>${MARK}<span>${lv.n} · ${esc(r.name)}</span></p></header>
        <figure class="r-photo"><figcaption class="sr">${esc(won ? t('res.caught') : t('res.missed'))}</figcaption></figure>
        <div class="r-card">
          <div class="r-in">
            <div class="stripe" aria-hidden="true"></div>
            <div class="r-steps"><canvas aria-hidden="true"></canvas><p>${esc(lab)}</p></div>
            <div class="r-num"><p class="big" aria-label="${n} ${esc(n === 1 ? t('res.one') : t('res.many'))}">${n}</p><p class="big-l">${esc((n === 1 ? t('res.one') : t('res.many')).toUpperCase())}</p></div>
            <p class="r-line" style="--n:${how.length}"><span>${esc(how.toUpperCase())}</span></p>
            <ol class="r-stars">${[0, 1, 2].map((i) => `<li class="${rec.set[i] ? 'got' : ''}">${punch(false)}<span>${esc(t('res.stars.' + i, { n: i === 1 ? lv.par : lv.margin }))}</span></li>`).join('')}</ol>
          </div>
        </div>
        ${notes.length ? `<ul class="r-notes">${notes.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
        <div class="r-acts">
          ${nextFirst ? btn('next', ICON.next, t('res.next'), 'pri') : btn('again', ICON.retry, t('res.again'), 'pri')}
          ${btn('share', ICON.share, t('res.share'))}
          ${nextFirst ? btn('again', ICON.retry, t('res.again')) : ''}
          ${btn('home', ICON.ticket, t('res.home'), 'ter')}
        </div>
      </div>
    </section>`);
  if (r.duo) node.querySelector('.r-photo').prepend(r.duo);
  const cv = node.querySelector('.r-steps canvas');
  // the diagram is drawn at the size the layout gives it
  node.draw = () => {
    const b = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (b.width < 10) return;
    cv.width = Math.round(b.width * dpr); cv.height = Math.round(b.height * dpr);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    drawSteps(g, 0, 0, b.width, b.height, dance, { ink: '#643991', rumba: t('res.rumba').toUpperCase() });
  };
  requestAnimationFrame(() => node.draw());
  // print the line, then punch the stars one by one
  const stars = [...node.querySelectorAll('.r-stars li')], line = node.querySelector('.r-line');
  const quick = reduced(), T0 = quick ? 0 : 380;
  later(node, T0, () => { line.classList.add('on'); Audio.ui.print(undefined, Math.min(how.length, 40)); });
  const T1 = T0 + (quick ? 0 : 200 + Math.min(how.length, 40) * 16);
  stars.forEach((li, i) => later(node, T1 + i * (quick ? 0 : 300), () => {
    li.classList.add('shown');
    if (rec.set[i]) { li.querySelector('.pu').classList.add('on'); Audio.ui.punch(); }
  }));
  later(node, T1 + 3 * (quick ? 0 : 300) + 120, () => node.classList.add('settled'));
  wire(node, { again: r.onAgain, home: r.onHome, next: r.onNext, share: (e, b) => r.onShare(b) });
  return node;
}
