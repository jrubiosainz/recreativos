// The album: its padded cover (the title), the page with the six photo slots (the level select)
// and the index card clipped over it before each photo (the briefing).
import { t } from '../i18n.js';
import { Audio } from '../audio.js';
import { el, esc, wire, ICON, stars, starIcon, soundBtn, bindMute } from './dom.js';

export function bootScreen() {
  return el(`<section class="scr boot" data-screen="boot" aria-busy="true"><p class="boot-l">${esc(t('boot'))}</p></section>`);
}

const corner = () => '<i class="pc tl"></i><i class="pc tr"></i><i class="pc bl"></i><i class="pc br"></i>';
const corners = (html) => `<span class="corners">${html}</span>`;

// cover: the family's best photo in the window, the sticker a kid put on it, and the open button
export function coverScreen({ muted, total, max, started, onOpen, onMute, onLang }) {
  const node = el(`
    <section class="scr cover" data-screen="title">
      <h1 class="sr">${esc(t('title'))} · ${esc(t('tagline'))}</h1>
      <div class="corner-btns">
        <button class="rb txt" data-act="lang" aria-label="${esc(t('lang'))}" title="${esc(t('lang'))}">${t('langShort')}</button>
        ${soundBtn(muted, t('sound'))}
      </div>
      <div class="book" aria-hidden="true">
        <p class="foil">${esc(t('memories'))}</p>
        <div class="window"><canvas class="win-photo" width="600" height="400"></canvas></div>
        <p class="logo"><span>${esc(t('title'))}</span></p>
        <p class="label"><span class="lbl-a">${esc(t('album'))}</span><span class="lbl-y">${esc(t('years'))}</span></p>
      </div>
      <p class="tagline">${esc(t('tagline'))}</p>
      <button class="cta" data-act="open" data-autofocus>${esc(started ? t('cont') : t('open'))}</button>
      ${total ? `<p class="tot">${starIcon(true)}<span>${esc(t('total', { n: total, m: max }))}</span></p>` : ''}
    </section>`);
  wire(node, { open: onOpen, mute: bindMute(onMute), lang: onLang });
  node.photo = node.querySelector('.win-photo');
  return node;
}

// pages: [{ id, title, date, year, state: done|next|open|locked, set, lockText }]
export function albumScreen({ pages, muted, total, max, finale, onPick, onBack, onMute, onLang }) {
  const slots = pages.map((p, i) => `
    <li class="slot ${p.state}" style="--r:${[-1.6, 1.2, -0.8, 1.8, -1.3, 0.9][i]}deg">
      <button class="snap" data-i="${i}" data-quiet="1" aria-label="${esc(`${p.title} · ${p.date}${p.state === 'locked' ? ' · ' + p.lockText : ` · ${p.set.filter(Boolean).length}/3`}`)}">
        ${corners(`<canvas class="thumb" width="360" height="240" data-i="${i}"></canvas>${corner()}`)}
        ${p.state === 'locked' ? `<span class="lock">${ICON.lock}</span>` : ''}
        ${p.state === 'next' ? `<span class="next-tag">${esc(t('nextTag'))}</span>` : ''}
      </button>
      <p class="cap"><span class="cap-t">${esc(p.title)}</span><span class="cap-d">${esc(p.year)}</span></p>
      ${p.state === 'locked' ? '' : stars(p.set)}
    </li>`).join('');
  const node = el(`
    <section class="scr album" data-screen="album">
      <header class="bar">
        <button class="rb" data-act="back" aria-label="${esc(t('toCover'))}" title="${esc(t('toCover'))}">${ICON.back}</button>
        <h2 class="page-t">${esc(t('album'))}</h2>
        <span class="tot">${starIcon(true)}<span>${total}/${max}</span></span>
        <button class="rb txt" data-act="lang" aria-label="${esc(t('lang'))}" title="${esc(t('lang'))}">${t('langShort')}</button>
        ${soundBtn(muted, t('sound'))}
      </header>
      ${finale ? `<p class="finale">${esc(t('finale'))}</p>` : ''}
      <ol class="page">${slots}</ol>
      <p class="science"><b>${esc(t('scienceT'))}</b> ${esc(t('science'))} <cite>${esc(t('scienceBy'))}</cite></p>
    </section>`);
  node.querySelectorAll('.snap').forEach((b) => b.addEventListener('click', () => { Audio.ui.tap(); onPick(+b.dataset.i); }));
  wire(node, { back: onBack, mute: bindMute(onMute), lang: onLang });
  node.thumbs = [...node.querySelectorAll('canvas.thumb')];
  return node;
}

// the index card: what is going on, how many shots you have, and the three stickers to earn
export function briefScreen({ ev, i, n, people, shots, set, onGo, onBack }) {
  const node = el(`
    <section class="scr brief" data-screen="brief">
      <div class="card" role="dialog" aria-labelledby="bf-t">
        <i class="clip" aria-hidden="true"></i>
        <h2 class="bf-t" id="bf-t">${esc(t('ev.' + ev.id + '.t'))}</h2>
        <p class="bf-n">${esc(t('ev.' + ev.id + '.d'))} · ${esc(t('page', { n: i + 1 }))}</p>
        <p class="bf-b">${esc(t('ev.' + ev.id + '.b'))}</p>
        <dl class="bf-k"><div><dt>${esc(t('peopleK'))}</dt><dd>${people}</dd></div><div><dt>${esc(t('shotsK'))}</dt><dd>${shots}</dd></div><div><dt>${esc(t('lightK'))}</dt><dd>${esc(t('light.' + ev.light))}</dd></div></dl>
        <p class="bf-why">${esc(t('why3', { n: people, d: ev.light === 'good' ? 3 : 2, s: shots }))}</p>
        <ul class="goals">${t('star').map((g, k) => `<li class="${set?.[k] ? 'got' : ''}">${starIcon(set?.[k])}<span><b>${esc(g)}</b><small>${esc(t('starHint')[k])}</small></span></li>`).join('')}</ul>
        <button class="cta go" data-act="go" data-autofocus><span class="fill"></span><span class="lbl">${esc(t('shoot'))}</span></button>
      </div>
      <button class="ghost back" data-act="back">${ICON.back}<span>${esc(t('toAlbum'))}</span></button>
    </section>`);
  const go = node.querySelector('.go'), fill = go.querySelector('.fill'), lbl = go.querySelector('.lbl');
  node.setProgress = (p) => {
    go.classList.add('loading'); go.setAttribute('aria-disabled', 'true');
    fill.style.transform = `scaleX(${Math.max(0.04, Math.min(1, p))})`;
    lbl.textContent = t('loading', { p: Math.round(p * 100) });
  };
  node.ready = () => { go.classList.remove('loading'); go.removeAttribute('aria-disabled'); lbl.textContent = t('shoot'); };
  wire(node, { go: () => onGo(node), back: onBack });
  return node;
}
