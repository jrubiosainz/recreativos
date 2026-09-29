// The title is the travel card itself. The front: the game's name and the small print. The back: the
// validator's log of your six trips, a star punched through for each thing done well. Underneath, the
// validator's slot, whose green arrow takes you to the next trip. Then the brief, which is the
// validator's own display: the trip, the time, who you will meet, and VALIDAR, which swallows the card.
import { t } from '../i18n.js';
import { el, esc, wire, ICON, GO, MARK, punch, punches, soundBtn, bindMute, hm, hms, later } from './dom.js';
import { pic } from './pics.js';
import { RUMBA_KINDS } from '../save.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const lines = (s) => String(s).split('|').map(esc).join('<br>');

// rows: [{ i, n, name, dep (seconds of the day), state: done|next|open|locked, set }]
export function titleScreen({ rows, next, muted, rumbas, onPick, onGo, onMute, onLang }) {
  const nx = rows[next];
  const row = (r) => `
    <li><button class="trip ${r.state}" data-act="pick" data-i="${r.i}" ${r.state === 'locked' ? 'aria-disabled="true"' : ''}
      aria-label="${esc(r.state === 'locked' ? `${r.n}. ${r.name} · ${t('locked', { n: r.n - 1 })}` : t('go', { n: r.n, name: r.name }))}">
      <span class="t-n">${r.n}</span><span class="t-nm">${esc(r.name.toUpperCase())}</span>
      <span class="t-h">${r.state === 'locked' ? ICON.lock : hm(r.dep)}</span>${punches(r.set)}
    </button></li>`;
  const rumba = (k) => {
    const on = rumbas.includes(k), lab = t(on ? 'rumbaOf' : 'rumbaNone', { who: t('who.' + k) });
    return `<li class="rum ${on ? 'on' : ''}" data-k="${k}" title="${esc(lab)}"><span class="sr">${esc(lab)}</span></li>`;
  };
  const node = el(`
    <section class="scr title" data-screen="title" aria-labelledby="tt-h">
      <div class="stack">
        <div class="tk front">
          <div class="tk-in">
            ${t('fine').map((f, i) => `<p class="fine f${i}">${lines(f)}</p>`).join('')}
            <h1 id="tt-h">${t('title').split(', ').map(esc).join(',<br>')}</h1>
            <p class="tag">${esc(t('tagline'))}</p>
          </div>
        </div>
        <div class="tk back">
          <div class="tk-in">
            <div class="stripe" aria-hidden="true"></div>
            <h2 class="sr">${esc(t('trips'))}</h2>
            <ol class="trips">${rows.map(row).join('')}</ol>
            <div class="tk-foot">
              <div class="rums"><span class="rums-t">${esc(t('rumbas'))}</span><ul class="rums-l">${RUMBA_KINDS.map(rumba).join('')}</ul></div>
              <button class="tb lang" data-act="lang" aria-label="${esc(t('langName'))}" title="${esc(t('langName'))}">${esc(t('langShort'))}</button>
              ${soundBtn(muted, t('sound'), 'tb')}
            </div>
          </div>
        </div>
        <div class="val">
          <span class="slot" aria-hidden="true"></span>
          <button class="go" data-act="go" data-autofocus aria-label="${esc(t('go', { n: nx.n, name: nx.name }))}">
            ${GO}<span class="go-t">${esc(t('enter'))}</span><span class="go-s">${nx.n} · ${esc(nx.name)}</span>
          </button>
        </div>
      </div>
    </section>`);
  // the rumbas you have had, as the portraits of who you had them with
  node.querySelectorAll('.rum').forEach((li) => li.prepend(pic(li.dataset.k, 34, 40)));
  node.stackRect = () => node.querySelector('.stack').getBoundingClientRect();
  wire(node, {
    pick: (e, b) => onPick(+b.dataset.i),
    go: () => onGo(next),
    mute: bindMute(onMute),
    lang: onLang,
  });
  // a locked trip still answers: it says which train to catch first
  node.querySelectorAll('.trip.locked').forEach((b) => b.addEventListener('click', () => onPick(+b.dataset.i)));
  return node;
}

// lv: the level; intro: its intro keys; set: stars punched so far; now/dep: seconds of the day
export function briefScreen({ lv, name, sub, now, dep, intro, touch, set, muted, onGo, onBack, onMute }) {
  const keys = intro.map((k) => (k === 'ask' ? (touch ? 'askT' : 'askK') : k));
  const meet = keys.length
    ? `<ul class="meet">${keys.map((k) => { const [nm, d] = t('intro.' + k); return `<li data-k="${k}"><div class="m-t"><b>${esc(nm)}</b><span>${d}</span></div></li>`; }).join('')}</ul>`
    : `<p class="m-none">${esc(t('brief.none'))}</p>`;
  const goals = [0, 1, 2].map((i) => `<li>${punch(set?.[i])}<span>${esc(t('brief.g.' + i, { n: i === 1 ? lv.par : lv.margin }))}</span></li>`).join('');
  const node = el(`
    <section class="scr brief" data-screen="brief" aria-labelledby="bf-h">
      <div class="panel">
        <header class="board">
          <h2 id="bf-h" class="b-name">${esc(name.toUpperCase())}</h2>
          <p class="b-sub">${esc(sub)}</p>
          <dl class="b-times">
            <div><dt>${esc(t('brief.now'))}</dt><dd>${hms(now)}</dd></div>
            <div><dt>${esc(t('brief.dep'))}</dt><dd>${hms(dep)}</dd></div>
            <div class="b-leg"><dt>${esc(t('brief.leg'))}</dt><dd>${lv.n}/6</dd></div>
          </dl>
          <p class="b-ok" aria-live="assertive"></p>
        </header>
        <section class="plate" aria-labelledby="bf-m">
          <h3 id="bf-m">${MARK}<span>${esc(t('brief.meet'))}</span></h3>
          ${meet}
        </section>
        <section class="goals" aria-labelledby="bf-g">
          <h3 id="bf-g" class="sr">${esc(t('brief.goals'))}</h3>
          <ol>${goals}</ol>
        </section>
        <div class="acts">
          <button class="tb back" data-act="back" aria-label="${esc(t('brief.back'))}">${ICON.back}<span>${esc(t('brief.back'))}</span></button>
          ${soundBtn(muted, t('sound'), 'tb')}
          <div class="val small">
            <span class="card" aria-hidden="true"><i></i></span>
            <span class="slot" aria-hidden="true"></span>
            <button class="go" data-act="go" data-autofocus>${GO}<span class="go-t">${esc(t('validate'))}</span></button>
          </div>
        </div>
      </div>
    </section>`);
  node.querySelectorAll('.meet li').forEach((li) => li.prepend(pic(li.dataset.k, 64, 74)));
  const go = node.querySelector('.go'), goT = go.querySelector('.go-t'), ok = node.querySelector('.b-ok');
  let state = 'idle', ready = false;
  node.panelRect = () => node.querySelector('.panel').getBoundingClientRect();
  // the voices are still on their way: the button waits for them, and says so
  node.setReady = (r) => {
    ready = r;
    if (state === 'waiting' && r) run();
  };
  function run() {
    state = 'validating';
    go.setAttribute('aria-disabled', 'true'); goT.textContent = t('validate');
    node.classList.add('validating');
    const quick = reduced();
    onGo('run');
    // the card goes in, the machine thinks, prints, stamps: green and its beep together
    later(node, quick ? 0 : 700, () => { node.classList.add('stamped'); onGo('stamp'); ok.textContent = t('brief.ok'); });
    later(node, quick ? 700 : 1650, () => onGo('play'));
  }
  wire(node, {
    go: () => {
      if (state !== 'idle') return;
      if (!ready) { state = 'waiting'; goT.textContent = t('brief.wait'); go.setAttribute('aria-busy', 'true'); onGo('wait'); return; }
      run();
    },
    back: () => { if (state === 'idle' || state === 'waiting') onBack(); },
    mute: bindMute(onMute),
  });
  return node;
}
