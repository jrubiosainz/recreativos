// The box office: the letter board of today's showings (the level select) laid over the painted
// board on the facade, the ticket booth's button, and the ticket it prints (the briefing).
import { t } from '../i18n.js';
import { Audio } from '../audio.js';
import { el, esc, wire, later, ICON, stars, starIcon, soundBtn, bindMute } from './dom.js';

const px = (r) => `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
const place = (node, r) => { if (node && r) node.style.cssText = px(r); };

// films: [{ id, title, time, state: done|next|open|locked, set }]
export function titleScreen({ films, sel, R, muted, total, max, onSelect, onBuy, onMute, onLang }) {
  const rows = films.map((f, i) => `
    <li><button class="row ${f.state}" data-i="${i}" data-quiet="1" aria-pressed="${i === sel}"
        aria-label="${esc(`${f.time} · ${f.title}${f.state === 'locked' ? '' : ` · ${f.set.filter(Boolean).length}/3`}`)}">
      <span class="time">${esc(f.time)}</span><span class="name">${esc(f.title)}</span>
      ${f.state === 'locked' ? ICON.lock : stars(f.set)}
    </button></li>`).join('');
  const node = el(`
    <section class="scr title" data-screen="title">
      <h1 class="sr">${t('title')} · ${esc(t('tagline'))}</h1>
      <div class="corner">
        <button class="rb txt" data-act="lang" aria-label="${esc(t('lang'))}" title="${esc(t('lang'))}">${t('langShort')}</button>
        ${soundBtn(muted, t('sound'))}
      </div>
      <ol class="board" aria-label="${esc(t('sessions'))}">
        <li class="hdr" aria-hidden="true"><span>${esc(t('sessions'))}</span><span class="tot">${starIcon(true)}${total}/${max}</span></li>
        ${rows}
      </ol>
      <button class="buy" data-act="buy" data-autofocus>${ICON.ticket}<span>${esc(t('buy'))}</span></button>
    </section>`);
  const board = node.querySelector('.board'), buy = node.querySelector('.buy'), btns = [...node.querySelectorAll('.row')];
  const [langB, sndB] = node.querySelectorAll('.corner .rb');
  node.place = (r) => {
    place(board, r.board); place(buy, r.buy); node.classList.toggle('land', !r.port);
    buy.style.fontSize = `${Math.max(11, Math.min(21, r.buy.w * 0.072)).toFixed(1)}px`;
    if (r.lang) { place(langB, r.lang); place(sndB, r.snd); } else { langB.style.cssText = sndB.style.cssText = ''; }
  };
  node.select = (i) => { sel = i; btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i))); };
  btns.forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    if (films[i].state === 'locked') { Audio.ui.tap(); onSelect(i, true); return; }
    if (i === sel) { onBuy(i); return; }
    Audio.ui.tap(); node.select(i); onSelect(i, false);
  }));
  node.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    let i = sel;
    do i = (i + dir + films.length) % films.length; while (films[i].state === 'locked' && i !== sel);
    if (i !== sel) { Audio.ui.tap(); node.select(i); onSelect(i, false); btns[i].focus({ preventScroll: true }); }
  });
  wire(node, { buy: () => onBuy(sel), mute: bindMute(onMute), lang: onLang });
  node.place(R);
  return node;
}

// the ticket the booth prints: the film, your seat, the snack, the rules and the three goals
export function ticketScreen({ film, level, i, time, set, snackImg, onGo, onBack }) {
  const seat = [['session', time], ['hall', i + 1], ['row', 7 + (i % 3)], ['seat', 12 - i]];
  const node = el(`
    <section class="scr brief" data-screen="brief">
      <div class="tk" role="dialog" aria-labelledby="tk-title">
        <div class="tk-main">
          <header class="tk-head"><span class="tk-cine">${esc(t('ticket.cinema'))}</span><span class="tk-st">${esc(t('ticket.street'))}</span></header>
          <p class="tk-genre">${esc(t('genre.' + level.meta.genre))}</p>
          <h2 class="tk-title" id="tk-title">${esc(film)}</h2>
          <dl class="tk-seat">${seat.map(([k, v]) => `<div><dt>${esc(t('ticket.' + k))}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          <div class="tk-combo"><img src="${snackImg}" alt="" width="64" height="64"><span><small>${esc(t('ticket.combo'))}</small><b>${esc(t('combo.' + level.id))}</b></span></div>
          <p class="tk-hint">${esc(t('hint.' + level.id))}</p>
          <p class="tk-rules">${t('ticket.rules')}</p>
          <ul class="tk-goals">${t('goals').map((g, k) => `<li class="${set?.[k] ? 'got' : ''}">${starIcon(set?.[k])}<span>${esc(g)}</span></li>`).join('')}</ul>
        </div>
        <div class="tk-stub">
          <button class="go" data-act="go" data-quiet="1" data-autofocus><span class="fill"></span><span class="lbl">${esc(t('ticket.enter'))}</span></button>
          <span class="tk-admit">${esc(t('ticket.admit'))}</span>
        </div>
      </div>
      <button class="ghost back" data-act="back">${ICON.back}<span>${esc(t('ticket.back'))}</span></button>
    </section>`);
  const go = node.querySelector('.go'), fill = go.querySelector('.fill'), lbl = go.querySelector('.lbl');
  node.setProgress = (p) => {
    go.classList.add('loading'); go.setAttribute('aria-disabled', 'true');
    fill.style.transform = `scaleX(${Math.max(0.04, Math.min(1, p))})`;
    lbl.textContent = t('ticket.loading', { p: Math.round(p * 100) });
  };
  node.ready = () => { go.classList.remove('loading'); go.removeAttribute('aria-disabled'); lbl.textContent = t('ticket.enter'); };
  // the stub is torn off along the perforation, then the lights go down
  node.tear = () => new Promise((res) => { Audio.ui.ticket(); node.classList.add('torn'); later(node, 520, res); });
  wire(node, { go: () => onGo(node), back: onBack });
  return node;
}
