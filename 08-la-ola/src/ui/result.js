// The full-time board. Laid over the stadium, which keeps playing behind it (on the right in landscape,
// along the bottom in portrait, so the bowl stays in view): FINAL and the ground, the longest wave in
// big LED digits lit in that wave's colour, the goal, how many people stood up, a tip when the goal was
// missed, and the three stars as stadium lamps switching on one by one.
import { t, getLang, plural, fmtNum, fmtLaps } from '../i18n.js';
import { el, esc, wire, show, later, toast, lamp, ICON } from './dom.js';
import { lapColour } from '../share.js';
import { Audio } from '../audio.js';

export function resultScreen({ level, sim, rec, deaths = {}, nextLevel, nextOpen, reduce, onAgain, onNext, onShare, onLevels }) {
  const e = sim.end, lang = getLang(), st = sim.stars(), win = st[0];
  const laps = Math.floor(e.best * 10) / 10, colour = lapColour(laps);
  const why = [plural('lapsN', level.goal), t(`res.feat.${level.feat}`), plural('lapsN', level.goal + 1)];
  // what to try next: never started one, let it fade, or trampled on the tired
  let tip = '';
  if (!win) tip = laps < 0.3 && !(deaths.weak || deaths.tired) ? t('res.tip.none') : (deaths.tired || 0) > (deaths.weak || 0) ? t('res.tip.tired') : t('res.tip.short');
  const name = level.name[lang] || level.name.es;
  const node = el(`<section class="scr result ${win ? 'is-win' : 'is-lose'}" aria-labelledby="r-h">
    <div class="board">
      <p class="r-top"><span class="ft">${esc(t(win ? 'res.win' : 'res.lose'))}</span><span>${esc(name)}</span></p>
      <h2 id="r-h" class="r-big" style="--c:${colour}" aria-label="${esc(plural('res.laps', laps, { n: fmtLaps(laps) }))}">${esc(fmtLaps(laps))}<small>${esc(plural('card.laps', laps))}</small></h2>
      <p class="r-of">${esc(t('res.of', { n: plural('lapsN', level.goal) }))}</p>
      <p class="r-ppl">${esc(t('res.people', { n: fmtNum(e.people) }))}</p>
      ${tip ? `<p class="r-tip">${esc(tip)}</p>` : ''}
      <ul class="prizes">${st.map((on, i) => `<li class="${on ? 'on' : ''}" aria-label="${esc(`${why[i]}: ${t(on ? 'res.got' : 'res.miss')}`)}">${lamp(on)}<span>${esc(why[i])}</span></li>`).join('')}</ul>
      <div class="acts">
        <button class="btn ${nextLevel && nextOpen ? '' : 'amber'}" data-act="again" ${nextLevel && nextOpen ? '' : 'data-autofocus'}>${ICON.retry}<span>${esc(t('res.again'))}</span></button>
        ${nextLevel && nextOpen ? `<button class="btn amber" data-act="next" data-autofocus><span>${esc(t('res.next'))}</span>${ICON.next}</button>` : ''}
        <button class="btn red" data-act="share">${ICON.share}<span>${esc(t('res.share'))}</span></button>
        <button class="rb" data-act="levels" aria-label="${esc(t('res.levels'))}" title="${esc(t('res.levels'))}">${ICON.bowl}</button>
      </div>
    </div>
  </section>`);
  wire(node, { again: onAgain, next: onNext, share: onShare, levels: onLevels });
  // the lamps come on one by one, each with the clunk of a floodlight relay
  const lis = [...node.querySelectorAll('.prizes li')];
  if (reduce) lis.forEach((li) => li.classList.add('in'));
  else lis.forEach((li, i) => later(node, 650 + i * 280, () => { li.classList.add('in'); if (st[i]) Audio.ui.stamp(i); }));
  later(node, reduce ? 200 : 1650, () => {
    if (rec?.opened && nextLevel) toast(esc(t('res.unlocked', { name: nextLevel.name[lang] || nextLevel.name.es })));
    else if (rec?.all) toast(esc(t('res.all')));
    else if (rec?.best) toast(esc(t('res.best')));
  });
  show(node);
  return node;
}
