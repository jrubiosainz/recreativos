// The result is the bottom of the summer poster (comp C) laid over the game, which keeps playing the
// splash above it: ¡BOMBA! or ¡PLANCHAZO! in bubble letters, the splash height in the red roundel,
// and the three PREMIO sticks, stamped in one by one. Portrait screens get it as a bottom band,
// landscape ones as a card on the right, so the splash is never behind it.
import { t, getLang, num, metres } from '../i18n.js';
import { el, esc, wire, show, later, toast, stickH, ICON, mss } from './dom.js';
import { Audio } from '../audio.js';

export function resultScreen({ level, sim, rec, nextLevel, nextOpen, reduce, onAgain, onNext, onShare, onLevels }) {
  const e = sim.end, bomba = e.why === 'bomba', lang = getLang(), st = sim.stars();
  const n = sim.sticks.length;
  const why = [t('res.star.0'), t('res.star.1', { n }), t('res.star.2', { t: mss(sim.par) })];
  const whyA = [t('res.starAria.0'), t('res.starAria.1'), t('res.starAria.2', { t: mss(sim.par) })];
  const held = e.k >= 2 ? t('res.held', { n: e.k }) : e.k === 1 ? t('res.heldOne') : '';
  const [sv] = metres(e.splash).split(' ');
  const word = t(bomba ? 'res.bomba' : 'res.planchazo');
  const node = el(`<section class="scr result ${bomba ? 'is-bomba' : 'is-flop'}" aria-labelledby="r-h">
    <div class="band">
      <span class="rays" aria-hidden="true"></span>
      ${bomba ? '<img class="r-hippo" src="assets/img/m_bomba.webp" alt="" width="677" height="720" decoding="async">' : ''}
      <h2 id="r-h" class="r-word" style="--n:${[...word].length}" data-t="${esc(word)}">${esc(word)}</h2>
      <div class="r-mid">
        ${bomba ? `<p class="roundel" aria-label="${esc(`${t('res.splash')}: ${metres(e.splash)}`)}"><small>${esc(t('res.splash'))}</small><b>${esc(sv)}<i>m</i></b>
          <svg viewBox="0 0 40 8" aria-hidden="true"><path d="M2 4q4.5-3 9 0t9 0 9 0 9 0"/></svg></p>`
        : `<p class="tip">${esc(t('res.flopTip'))}</p>`}
        <p class="facts">${esc(level.name[lang] || level.name.es)} · ${esc(t('res.height', { m: metres(level.h) }))}${held ? ` · ${esc(held)}` : ''} · ${mss(e.t)}</p>
      </div>
      <ul class="prizes">${st.map((on, i) => `<li class="${on ? 'on' : ''}" aria-label="${esc(`${whyA[i]}: ${t(on ? 'res.got' : 'res.miss')}`)}">${stickH(on)}<span>${esc(why[i])}</span></li>`).join('')}</ul>
      <div class="acts">
        <button class="btn blue" data-act="again" ${nextLevel && nextOpen ? '' : 'data-autofocus'}>${ICON.retry}<span>${esc(t('res.again'))}</span></button>
        ${nextLevel && nextOpen ? `<button class="btn yellow" data-act="next" data-autofocus><span>${esc(t('res.next'))}</span>${ICON.next}</button>` : ''}
        <button class="btn red" data-act="share">${ICON.share}<span>${esc(t('res.share'))}</span></button>
        <button class="rb" data-act="levels" aria-label="${esc(t('res.levels'))}" title="${esc(t('res.levels'))}">${ICON.grid}</button>
      </div>
    </div>
  </section>`);
  wire(node, { again: onAgain, next: onNext, share: onShare, levels: onLevels });
  // the sticks are stamped one by one, each with its own tock
  const lis = [...node.querySelectorAll('.prizes li')];
  if (reduce) lis.forEach((li) => li.classList.add('in'));
  else lis.forEach((li, i) => later(node, 700 + i * 260, () => { li.classList.add('in'); if (st[i]) Audio.ui.stamp(i); }));
  later(node, reduce ? 200 : 1600, () => {
    if (rec?.best) toast(esc(t('res.best')));
    else if (rec?.all) toast(esc(t('res.all')));
    else if (rec?.first && nextLevel) toast(esc(t('res.unlocked', { name: nextLevel.name[lang] || nextLevel.name.es })));
  });
  show(node);
  return node;
}
