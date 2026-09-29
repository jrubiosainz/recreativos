// The title is the kitchen's fridge door beside the flat: «GATO CON TOSTADA» in plastic magnet letters, the
// two laws and what happens when you tape one to the other, and one biro note per room held up by a magnet,
// with the star magnets it has won. The next room's note says «¡A LA CAJA!»; a room not open yet is a faded
// note that answers with what to finish first. Behind the door, the next room plays itself (the attract loop).
import { t, getLang } from '../i18n.js';
import { el, esc, wire, show, toast, soundBtn, bindMute, star, ICON, NOTE, LETTER } from './dom.js';
import { isUnlocked } from '../save.js';
import { Audio } from '../audio.js';
import { hashStr, mulberry32 } from '../util.js';

// magnet letters: words stay whole; every letter its own colour (never its neighbour's) and its own tilt.
// The same text always gets the same letters, so the door looks the same every time you come back to it.
export function magnetLetters(text) {
  const rnd = mulberry32(hashStr(text));
  let i = 0, prev = -1;
  return text.split(' ').map((w) => [...w].map((ch) => {
    let c; do c = Math.floor(rnd() * LETTER.length); while (c === prev);
    prev = c;
    return { ch, color: LETTER[c], r: (rnd() - 0.5) * 16, y: (rnd() - 0.5) * 0.12, i: i++ };
  }));
}
const logoHtml = (text) => magnetLetters(text).map((w) => `<span class="w" aria-hidden="true">${w.map((l) =>
  `<span class="ml" style="--c:${l.color};--r:${l.r.toFixed(1)}deg;--y:${l.y.toFixed(3)}em;--i:${l.i}">${esc(l.ch)}</span>`).join('')}</span>`).join('');

export function titleScreen({ levels, save, onPlay, onMute, onLang, reduce }) {
  const lang = getLang();
  const next = levels.findIndex((lv, i) => isUnlocked(save, levels, i) && !save.lv[lv.id]?.done);
  const notes = levels.map((lv, i) => {
    const open = isUnlocked(save, levels, i), rec = save.lv[lv.id] || {}, set = rec.set || [false, false, false];
    const name = lv.name[lang] || lv.name.es;
    const aria = open ? t('lvAria', { n: lv.n, name, stars: rec.stars || 0 }) : t('lvLocked', { n: lv.n, name });
    const foot = !open ? '' : i === next ? `<span class="go">${esc(t('go'))}</span>` : set.map(star).join('');
    const look = `--c:${NOTE.paper[i % 6]};--m:${NOTE.mag[i % 6]};--r:${NOTE.tilt[i % 6]}deg;--i:${i}`;
    return `<li><button class="note ${open ? '' : 'shut'} ${i === next ? 'next' : ''}" data-act="play" data-i="${i}" data-quiet="1"
      style="${look}" aria-label="${esc(aria)}" ${open ? '' : 'aria-disabled="true"'}>
      <span class="pin" aria-hidden="true"></span>
      <span class="n-name" aria-hidden="true"><b>${lv.n}</b>${esc(name)}${open ? '' : ICON.lock.replace('class="ic ', 'class="ic lock ')}</span>
      ${open ? `<span class="n-line" aria-hidden="true">${esc(t('lv.' + lv.id))}</span>` : ''}
      <span class="n-foot" aria-hidden="true">${foot}</span>
    </button></li>`;
  }).join('');
  const node = el(`<section class="scr title" aria-labelledby="t-h">
    <div class="door">
      <span class="handle" aria-hidden="true"></span>
      <header class="d-head">
        <h1 id="t-h" class="logo" aria-label="${esc(t('title'))}">${logoHtml(t('title'))}</h1>
        <div class="corner">
          ${soundBtn(save.muted, t('sound'))}
          <button class="rb yellow lang" data-act="lang" aria-label="${esc(t('langName'))}" title="${esc(t('langName'))}">${esc(t('langShort'))}</button>
        </div>
      </header>
      <p class="tagline">${esc(t('tagline'))}</p>
      <ol class="laws"><li>${esc(t('law1'))}</li><li>${esc(t('law2'))}</li></ol>
      <p class="pitch">${t('pitch')} <span class="how">${t('how')}</span></p>
      <ol class="notes">${notes}</ol>
    </div>
  </section>`);

  let going = false;
  wire(node, {
    play: (e, b) => {
      if (going) return;
      going = true;
      Audio.ui.go();
      b.classList.add('pick');
      node.classList.add('leaving');
      setTimeout(() => onPlay(+b.dataset.i), reduce ? 60 : 420);
    },
    mute: bindMute(onMute),
    lang: () => onLang(),
  });
  // a room not open yet swallows the click through aria-disabled; let its note still answer
  node.querySelectorAll('.note.shut').forEach((b) => b.addEventListener('click', () => {
    const prev = levels[+b.dataset.i - 1];
    Audio.ui.deny();
    toast(esc(t('locked', { name: prev.name[lang] || prev.name.es })));
    b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
  }));
  const first = node.querySelector('.note.next') || node.querySelector('.note:not(.shut)');
  first?.setAttribute('data-autofocus', '');
  show(node);
  return node;
}
