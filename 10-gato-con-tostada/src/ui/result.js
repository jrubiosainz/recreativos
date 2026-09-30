// The end: a Polaroid of the landing, stuck on the fridge door with a magnet. The photo is the stage at the
// moment it ended, cropped around the cat, developing out of grey; the caption is the verdict in biro. Under
// it: why, what it cost (jam left, breakages, time), a tip on a sticky note when it went wrong, the three
// star magnets clacking on one by one, and the ways on: again, the next room, share, back to the fridge.
import { t, getLang, plural, fmtNum } from '../i18n.js';
import { el, esc, wire, show, later, toast, star, ICON } from './dom.js';
import { starsOf, jamOf } from '../save.js';
import { drawShot } from '../share.js';
import { Audio } from '../audio.js';

const fmt1 = (v) => new Intl.NumberFormat(getLang() === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
const pctOf = (b) => Math.round(Math.max(0, Math.min(1, b ?? 0)) * 100);

export function starLabels(lv) {
  const s = t('res.star'), tempt = (lv.objects || []).find((o) => o.tempt);
  return [s[0], s[1].replace('{obj}', tempt ? t('obj.' + tempt.k) : '…'), s[2].replace('{p}', fmtNum(pctOf(lv.par ?? 0.5)))];
}
export function verdict(sim) {
  const e = sim.end;
  return { head: e.win ? t('res.win') : t('res.why.' + e.why), sub: t('res.sub.' + (e.win ? 'win' : e.why)) };
}
export function statsOf(sim) {
  const e = sim.end, out = [t('res.stat.jam', { p: fmtNum(pctOf(jamOf(e))) })];
  if (e.broke) out.push(plural('res.stat.broke', e.broke));
  out.push(t('res.stat.time', { s: fmt1(e.t) }));
  return out;
}

export function resultScreen({ level, sim, rec, shot, nextLevel, nextOpen, reduce, onAgain, onNext, onShare, onLevels }) {
  const e = sim.end, lang = getLang(), st = starsOf(level, e), labels = starLabels(level);
  const { head, sub } = verdict(sim), stats = statsOf(sim), tip = e.win ? '' : t('res.tip.' + e.why);
  const hasNext = !!nextLevel && nextOpen, goNext = hasNext && e.win;
  const node = el(`<section class="scr result ${e.win ? 'is-win' : 'is-lose'}" aria-labelledby="r-h">
    <div class="door rdoor">
      <span class="handle" aria-hidden="true"></span>
      <figure class="polaroid">
        <span class="pin" aria-hidden="true"></span>
        <div class="photo"><canvas width="480" height="480" aria-hidden="true"></canvas></div>
        <figcaption><h2 id="r-h" class="cap">${esc(head)}</h2></figcaption>
      </figure>
      <div class="r-body">
        <p class="r-sub">${esc(sub)}</p>
        <p class="r-stats">${stats.map(esc).join(' · ')}</p>
        ${tip ? `<p class="r-tip"><span class="pin" aria-hidden="true"></span>${esc(tip)}</p>` : ''}
        <ul class="prizes">${st.map((on, i) => `<li class="${on ? 'on' : ''}" aria-label="${esc(`${labels[i]}: ${t(on ? 'res.got' : 'res.miss')}`)}">${star(on)}<span aria-hidden="true">${esc(labels[i])}</span></li>`).join('')}</ul>
        <div class="acts">
          <button class="btn ${goNext ? '' : 'butter'}" data-act="again" ${goNext ? '' : 'data-autofocus'}>${ICON.retry}<span>${esc(t('res.again'))}</span></button>
          ${hasNext ? `<button class="btn ${e.win ? 'butter' : ''}" data-act="next" ${e.win ? 'data-autofocus' : ''}><span>${esc(t('res.next'))}</span>${ICON.next}</button>` : ''}
          <button class="btn blue" data-act="share">${ICON.share}<span>${esc(t('res.share'))}</span></button>
          <button class="rb green" data-act="levels" aria-label="${esc(t('res.levels'))}" title="${esc(t('res.levels'))}">${ICON.fridge}</button>
        </div>
      </div>
    </div>
  </section>`);
  const cv = node.querySelector('.photo canvas');
  drawShot(cv.getContext('2d'), shot, 0, 0, cv.width, cv.height);
  wire(node, { again: onAgain, next: onNext, share: onShare, levels: onLevels });
  // the Polaroid meets the door, then the star magnets go on one by one
  const lis = [...node.querySelectorAll('.prizes li')];
  if (reduce) lis.forEach((li) => li.classList.add('in'));
  else {
    later(node, 480, () => Audio.ui.stick());
    lis.forEach((li, i) => later(node, 1050 + i * 330, () => { li.classList.add('in'); if (st[i]) Audio.ui.star(i); }));
  }
  later(node, reduce ? 200 : 2200, () => {
    if (rec?.opened && nextLevel) toast(esc(t('res.unlocked', { name: nextLevel.name[lang] || nextLevel.name.es })));
    else if (rec?.all) toast(esc(t('res.all')));
    else if (rec?.best) toast(esc(t('res.best')));
  });
  show(node);
  return node;
}
