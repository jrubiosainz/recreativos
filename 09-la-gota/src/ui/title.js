// The title is the bonobús: a paper pass laid beside the window, where «LA GOTA» has been written with a
// finger in the fog and the drops run through the letters (the attract loop, a real sim). One row per
// trip, each at its time of day: the line, where you get off, how many kids call dibs with you, and
// the three holes the validator has punched so far. «NO CIRCULA» on the trips not open yet.
import { t, getLang, plural } from '../i18n.js';
import { el, esc, wire, show, toast, soundBtn, bindMute, hole } from './dom.js';
import { isUnlocked } from '../save.js';
import { Audio } from '../audio.js';

export function titleScreen({ levels, save, onPlay, onMute, onLang, reduce }) {
  const lang = getLang();
  const next = levels.findIndex((lv, i) => isUnlocked(save, levels, i) && !save.lv[lv.id]?.done);
  const rows = levels.map((lv, i) => {
    const open = isUnlocked(save, levels, i), rec = save.lv[lv.id] || {}, set = rec.set || [false, false, false];
    const name = lv.name[lang] || lv.name.es;
    const aria = open ? t('lvAria', { n: lv.n, name, clock: lv.clock, stars: rec.stars || 0 }) : t('lvLocked', { n: lv.n, name });
    const tail = !open ? `<span class="closed" aria-hidden="true">${esc(t('closed'))}</span>`
      : i === next ? `<span class="go" aria-hidden="true">${esc(t('go'))}</span>`
      : `<span class="holes" aria-hidden="true">${set.map(hole).join('')}</span>`;
    return `<li><button class="trip ${open ? '' : 'shut'} ${i === next ? 'next' : ''}" data-act="play" data-i="${i}" data-quiet="1"
      aria-label="${esc(aria)}" ${open ? '' : 'aria-disabled="true"'} data-desc="${esc(t('lv.' + lv.id))}">
      <span class="tr-clock" aria-hidden="true">${esc(lv.clock)}</span>
      <span class="tr-name">${esc(name)}</span>
      <span class="tr-meta"><span class="nw">→ ${esc(t('stop.' + lv.id))}</span> · <span class="nw">${esc(plural('rivalsN', lv.rivals.length))}</span></span>
      ${tail}
    </button></li>`;
  }).join('');
  const node = el(`<section class="scr title" aria-labelledby="t-h">
    <div class="pass">
      <header class="p-head">
        <div class="p-id">
          <h1 id="t-h" class="brand">${esc(t('title'))}</h1>
          <p class="kind"><span>${esc(t('ticket'))}</span><span>${esc(plural('tripsN', levels.length))}</span></p>
        </div>
        <nav class="corner" aria-label="${esc(t('sound'))}">
          ${soundBtn(save.muted, t('sound'))}
          <button class="rb lang" data-act="lang" aria-label="${esc(t('langName'))}" title="${esc(t('langName'))}">${esc(t('langShort'))}</button>
        </nav>
      </header>
      <p class="pitch">${t('pitch')} <span class="how">${t('how')}</span></p>
      <ol class="trips">${rows}</ol>
      <p class="t-desc" aria-hidden="true"></p>
      <div class="stripe" aria-hidden="true"></div>
    </div>
  </section>`);

  const desc = node.querySelector('.t-desc');
  const idle = next >= 0 ? t('lv.' + levels[next].id) : '';
  desc.textContent = idle;
  const say = (b) => { const d = b?.dataset.desc; desc.textContent = d && !b.classList.contains('shut') ? d : idle; };
  node.querySelectorAll('.trip').forEach((b) => {
    b.addEventListener('pointerenter', () => say(b));
    b.addEventListener('pointerleave', () => say(null));
    b.addEventListener('focus', () => say(b));
    b.addEventListener('blur', () => say(null));
  });
  wire(node, {
    play: (e, b) => {
      const i = +b.dataset.i;
      Audio.ui.go();
      b.classList.add('pick');
      node.classList.add('leaving');
      setTimeout(() => onPlay(i), reduce ? 60 : 420);
    },
    mute: bindMute(onMute),
    lang: () => onLang(),
  });
  // trips not in service swallow the click through aria-disabled; let them still answer
  node.querySelectorAll('.trip.shut').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i, prev = levels[i - 1];
    Audio.ui.deny();
    toast(t('locked', { name: esc(prev.name[lang] || prev.name.es) }));
    b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
  }));
  const first = node.querySelector('.trip.next') || node.querySelector('.trip:not(.shut)');
  first?.setAttribute('data-autofocus', '');
  show(node);
  return node;
}
