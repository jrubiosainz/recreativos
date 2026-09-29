// The title is the scoreboard's fixture list, lit over the stadium while a wave goes round behind it
// (the attract loop, the real sim driven by the bot). LA OLA in LED dots, its letters doing the wave;
// the six grounds as fixtures with their capacity and target, three floodlight lamps for the stars,
// «A PUERTA CERRADA» on the ones not open yet.
import { t, getLang, fmtNum, plural } from '../i18n.js';
import { el, esc, wire, show, toast, soundBtn, bindMute, lamp } from './dom.js';
import { isUnlocked } from '../save.js';
import { Audio } from '../audio.js';

export function titleScreen({ levels, save, onPlay, onMute, onLang, reduce }) {
  const lang = getLang();
  const next = levels.findIndex((lv, i) => isUnlocked(save, levels, i) && !save.lv[lv.id]?.done);
  const rows = levels.map((lv, i) => {
    const open = isUnlocked(save, levels, i), rec = save.lv[lv.id] || {}, set = rec.set || [false, false, false];
    const name = lv.name[lang] || lv.name.es;
    const aria = open ? `${t('lvAria', { n: lv.n, name, stars: rec.stars || 0 })} ${t('goal', { n: plural('lapsN', lv.goal) })}` : t('lvLocked', { n: lv.n, name });
    const tail = !open ? `<span class="closed" aria-hidden="true">${esc(t('closed'))}</span>`
      : i === next ? `<span class="go" aria-hidden="true">${esc(t('go'))}</span>`
      : `<span class="lamps" aria-hidden="true">${set.map(lamp).join('')}</span>`;
    return `<li><button class="lv ${open ? '' : 'shut'} ${i === next ? 'next' : ''}" data-act="play" data-i="${i}" data-quiet="1"
      aria-label="${esc(aria)}" ${open ? '' : 'aria-disabled="true"'} data-desc="${esc(t('lv.' + lv.id))}">
      <span class="lv-n" aria-hidden="true">${lv.n}</span>
      <span class="lv-name">${esc(name)}</span>
      <span class="lv-meta"><span class="nw">${esc(t('cap', { n: fmtNum(lv.capacity) }))} ·</span> <b class="nw">${esc(t('goal', { n: plural('lapsN', lv.goal) }))}</b></span>
      ${tail}
    </button></li>`;
  }).join('');
  const word = t('title');
  let k = 0;
  const logo = [...word].map((ch) => (ch === ' ' ? ' ' : `<span class="w" style="--i:${k++}">${esc(ch)}</span>`)).join('');
  const foot = t('footer').map((s) => `<span>${esc(s)}</span>`).join('<i aria-hidden="true">•</i>');
  const node = el(`<section class="scr title" aria-labelledby="t-h">
    <div class="board">
      <header class="t-head">
        <h1 id="t-h" class="logo" aria-label="${esc(word)}">${logo}</h1>
        <p class="tag">${esc(t('tagline'))}</p>
      </header>
      <ol class="fx">${rows}</ol>
      <p class="t-desc" aria-hidden="true"></p>
      <footer class="t-foot">${foot}</footer>
    </div>
    <nav class="corner" aria-label="${esc(t('sound'))}">
      ${soundBtn(save.muted, t('sound'))}
      <button class="rb lang" data-act="lang" aria-label="${esc(t('langName'))}" title="${esc(t('langName'))}">${esc(t('langShort'))}</button>
    </nav>
  </section>`);

  const desc = node.querySelector('.t-desc');
  const idle = next >= 0 ? t('lv.' + levels[next].id) : '';
  desc.textContent = idle;
  const say = (b) => { const d = b?.dataset.desc; desc.textContent = d && !b.classList.contains('shut') ? d : idle; };
  node.querySelectorAll('.lv').forEach((b) => {
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
      setTimeout(() => onPlay(i), reduce ? 60 : 380);
    },
    mute: bindMute(onMute),
    lang: () => onLang(),
  });
  // closed grounds swallow the click through aria-disabled; let them still answer
  node.querySelectorAll('.lv.shut').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i, prev = levels[i - 1];
    Audio.ui.deny();
    toast(t('locked', { name: esc(prev.name[lang] || prev.name.es) }));
    b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
  }));
  const first = node.querySelector('.lv.next') || node.querySelector('.lv:not(.shut)');
  first?.setAttribute('data-autofocus', '');
  show(node);
  return node;
}
