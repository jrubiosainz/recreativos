// The title is a summer poster taped to the pool's tile wall: HIPO in bubble letters, the six boards
// of the season as painted vignettes with their height in a red roundel, «AGOTADO» tape over the ones
// not open yet, and Hipólito holding his breath at the corner (and losing it now and then).
import { t, getLang, metres } from '../i18n.js';
import { el, esc, wire, show, toast, later, stick, soundBtn, bindMute, ICON } from './dom.js';
import { isUnlocked } from '../save.js';
import { Audio } from '../audio.js';

const burst = (n = 14, r0 = 50, r1 = 34) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? r1 : r0;
    d += `${i ? 'L' : 'M'}${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`;
  }
  return `${d}Z`;
};

export function titleScreen({ levels, save, onPlay, onMute, onLang, reduce }) {
  const lang = getLang();
  const next = levels.findIndex((lv, i) => isUnlocked(save, levels, i) && !save.lv[lv.id]?.done);
  const cards = levels.map((lv, i) => {
    const open = isUnlocked(save, levels, i), rec = save.lv[lv.id] || {}, set = rec.set || [false, false, false];
    const name = lv.name[lang] || lv.name.es, m = metres(lv.h);
    const [mv] = m.split(' ');
    const aria = open ? t('lvAria', { n: lv.n, name, m, stars: rec.stars || 0 }) : t('lvLocked', { n: lv.n, name });
    return `<li><button class="lv ${open ? '' : 'shut'} ${i === next ? 'next' : ''}" data-act="play" data-i="${i}" data-quiet="1"
      style="--img:url(assets/img/v_${lv.id}.jpg)" aria-label="${esc(aria)}" ${open ? '' : 'aria-disabled="true"'} data-desc="${esc(t('lv.' + lv.id))}">
      <span class="lv-name" style="--n:${Math.max(...name.split(/[\s-]+/).map((w) => w.length))}">${esc(name)}</span>
      <span class="lv-m" aria-hidden="true"><b>${esc(mv)}</b><small>m</small></span>
      ${open ? `<span class="lv-st" aria-hidden="true">${set.map((on) => stick(on)).join('')}</span>` : ''}
      ${open ? '' : `<span class="ago" aria-hidden="true">${esc(t('soldOut'))}</span>`}
      ${i === next ? `<span class="go" aria-hidden="true">${esc(t('go'))}</span>` : ''}
    </button></li>`;
  }).join('');
  const foot = t('footer').map((s) => `<span>${esc(s)}</span>`).join('<i aria-hidden="true">•</i>');
  const node = el(`<section class="scr title" aria-labelledby="t-h">
    <div class="poster">
      <span class="tape t1" aria-hidden="true"></span><span class="tape t2" aria-hidden="true"></span><span class="tape t3" aria-hidden="true"></span><span class="tape t4" aria-hidden="true"></span>
      <header class="p-head">
        <h1 id="t-h" class="logo"><span class="logo-t" data-t="HIPO">HIPO</span></h1>
        <span class="hip" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="${burst()}"/></svg><b>${esc(lang === 'es' ? '¡HIP!' : 'HIC!')}</b></span>
        <p class="tag">${esc(t('tagline'))}</p>
      </header>
      <ol class="grid">${cards}</ol>
      <footer class="p-foot"><p class="slog">${foot}</p><p class="desc" aria-hidden="true"></p>
        <svg class="waves" viewBox="0 0 40 14" aria-hidden="true"><path d="M2 3.5q4.5-3 9 0t9 0 9 0 9 0M2 10.5q4.5-3 9 0t9 0 9 0 9 0"/></svg></footer>
    </div>
    <div class="mascot" aria-hidden="true"><img src="assets/img/m_aguanta.webp" alt="" width="558" height="720" decoding="async"><b class="m-hip">${esc(lang === 'es' ? '¡hip!' : 'hic!')}</b></div>
    <nav class="corner" aria-label="${esc(t('sound'))}">
      ${soundBtn(save.muted, t('sound'))}
      <button class="rb lang" data-act="lang" aria-label="${esc(t('langName'))}" title="${esc(t('langName'))}">${esc(t('langShort'))}</button>
    </nav>
  </section>`);

  const desc = node.querySelector('.desc'), foot$ = node.querySelector('.p-foot');
  const say = (b) => { const d = b?.dataset.desc; desc.textContent = d && !b.classList.contains('shut') ? d : ''; foot$.classList.toggle('on', !!desc.textContent); };
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
  // shut cards swallow clicks through aria-disabled; let them still answer with the toast
  node.querySelectorAll('.lv.shut').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i, prev = levels[i - 1];
    Audio.ui.deny();
    toast(t('locked', { name: esc(prev.name[lang] || prev.name.es) }));
    b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
  }));

  // the mascot holds his breath… and then hiccups, on the game's own clock
  if (!reduce) {
    const m = node.querySelector('.mascot');
    const hic = () => { m.classList.remove('hic'); void m.offsetWidth; m.classList.add('hic'); Audio.ui.hic(); later(node, 2600 + Math.random() * 1400, hic); };
    later(node, 1500, hic);
  }
  show(node);
  return node;
}
