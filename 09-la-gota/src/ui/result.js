// The back of the ticket, fresh from the validator: the line, the time and the trip stamped in violet
// dots, then how the race went in fog-writing (yours won, or whose did and how), the margin or how far
// yours still had to go, what it ate, a tip when it lost, and the three holes punched one by one.
// It stands beside the window (on the right in landscape, below it in portrait) so the finish stays in view.
import { t, getLang, plural, fmtNum, fmtCm } from '../i18n.js';
import { el, esc, wire, show, later, toast, hole, ICON } from './dom.js';
import { starsOf } from '../save.js';
import { PH } from '../sim.js';
import { Audio } from '../audio.js';

export function starLabels(lv) {
  const s = t('res.star');
  return [s[0], s[1].replace('{n}', fmtNum(lv.margin)), s[2].replace('{n}', fmtNum(lv.beads || 3))];
}
export function verdict(sim) {
  const e = sim.end, who = e.by != null ? t('kid.' + sim.kids[e.by]?.name) : '';
  const head = e.win ? t('res.win') : t('res.why.' + e.why, { name: who });
  const sub = e.win ? (e.margin < PH - 1 ? t('res.by', { cm: fmtCm(e.margin) }) : '') : e.left != null && e.why !== 'squash' ? t('res.stat.left', { cm: fmtCm(e.left) }) : '';
  return { head, sub };
}

export function resultScreen({ level, sim, rec, nextLevel, nextOpen, reduce, onAgain, onNext, onShare, onLevels }) {
  const e = sim.end, lang = getLang(), st = starsOf(level, e), labels = starLabels(level);
  const name = level.name[lang] || level.name.es;
  const { head, sub } = verdict(sim);
  const stats = [];
  if (e.ate) stats.push(plural('res.stat.rivals', e.ate));
  if (e.beads) stats.push(plural('res.stat.ate', e.beads));
  if (e.win) stats.push(t('res.time', { s: fmtCm(e.t) }));
  const tip = e.win ? '' : t('res.tip.' + e.why);
  const stamp = `L${level.line || '27'} · ${level.clock} · ${t('trip', { n: level.n })}`;
  const node = el(`<section class="scr result ${e.win ? 'is-win' : 'is-lose'}" aria-labelledby="r-h">
    <div class="card">
      <p class="stamp" aria-label="${esc(name)}"><span>${esc(stamp)}</span></p>
      <h2 id="r-h" class="r-big">${esc(head)}</h2>
      ${sub ? `<p class="r-sub">${esc(sub)}</p>` : ''}
      ${stats.length ? `<p class="r-stats">${stats.map(esc).join(' · ')}</p>` : ''}
      ${tip ? `<p class="r-tip">${esc(tip)}</p>` : ''}
      <ul class="prizes">${st.map((on, i) => `<li class="${on ? 'on' : ''}" aria-label="${esc(`${labels[i]}: ${t(on ? 'res.got' : 'res.miss')}`)}">${hole(on)}<span>${esc(labels[i])}</span></li>`).join('')}</ul>
      <div class="acts">
        <button class="btn ${nextLevel && nextOpen && e.win ? '' : 'yellow'}" data-act="again" ${nextLevel && nextOpen && e.win ? '' : 'data-autofocus'}>${ICON.retry}<span>${esc(t('res.again'))}</span></button>
        ${nextLevel && nextOpen ? `<button class="btn ${e.win ? 'yellow' : ''}" data-act="next" ${e.win ? 'data-autofocus' : ''}><span>${esc(t('res.next'))}</span>${ICON.next}</button>` : ''}
        <button class="btn blue" data-act="share">${ICON.share}<span>${esc(t('res.share'))}</span></button>
        <button class="rb" data-act="levels" aria-label="${esc(t('res.levels'))}" title="${esc(t('res.levels'))}">${ICON.ticket}</button>
      </div>
    </div>
  </section>`);
  wire(node, { again: onAgain, next: onNext, share: onShare, levels: onLevels });
  // the validator punches the holes one by one
  const lis = [...node.querySelectorAll('.prizes li')];
  if (reduce) lis.forEach((li) => li.classList.add('in'));
  else lis.forEach((li, i) => later(node, 700 + i * 300, () => { li.classList.add('in'); if (st[i]) Audio.ui.stamp(i); }));
  later(node, reduce ? 200 : 1700, () => {
    if (rec?.opened && nextLevel) toast(esc(t('res.unlocked', { name: nextLevel.name[lang] || nextLevel.name.es })));
    else if (rec?.all) toast(esc(t('res.all')));
    else if (rec?.best) toast(esc(t('res.best')));
  });
  show(node);
  return node;
}
