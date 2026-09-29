// «Revelado en una hora»: the photo shop's envelope. The prints come out still developing, then
// somebody goes over them with a red marker: who blinked, who looked away. The best one is kept.
import { t } from '../i18n.js';
import { Audio } from '../audio.js';
import { drawMarks } from '../print.js';
import { el, esc, wire, later, ICON, starIcon } from './dom.js';

// prints: [{ canvas, ok, spots, best }]; set/was: the stars now and before; line: { text, who } | null
export function labScreen({ ev, prints, set, was, line, isLast, won, fast, onJudge, onRetry, onAlbum, onNext, onShare }) {
  const n = prints.length, best = prints.findIndex((p) => p.best), mode = prints[0]?.canvas.width > prints[0]?.canvas.height ? 'h' : 'v';
  const node = el(`
    <section class="scr lab ${mode === 'h' ? 'land' : 'port'} n${n}" data-screen="end">
      <div class="env" aria-hidden="true">
        <p class="env-shop">${esc(t('labShop'))}</p>
        <p class="env-t">${esc(t('lab'))}</p>
        <p class="env-sub">${esc(t('labSub', { n, d: t('ev.' + ev.id + '.d') }))}</p>
        <p class="env-name">${esc(t('labName'))}</p>
      </div>
      <h2 class="sr">${esc(won ? t('good') : n ? t('bad') : t('noShot'))}</h2>
      <ol class="prints" aria-label="${esc(t('lab'))}">${prints.map((p, i) => `
        <li class="print ${p.ok ? 'ok' : 'bad'} ${p.best ? 'best' : ''}" style="--i:${i};--r:${[-2.2, 1.6, -1, 2.4, -1.8, 1.2][i % 6]}deg">
          <span class="paper"><span class="ph-slot"></span></span>
          <span class="num">${i + 1}</span>
          ${p.best ? `<span class="keep">${starIcon(true)}${esc(t('keep'))}</span>` : ''}
        </li>`).join('')}
      </ol>
      ${n ? '' : `<p class="nothing">${esc(t('noShot'))}</p>`}
      <div class="verdict">
        <ul class="got">${t('star').map((g, k) => `<li class="${set[k] ? 'on' : ''} ${set[k] && !was?.[k] ? 'new' : ''}" style="--k:${k}">${starIcon(set[k])}<span>${esc(g)}</span></li>`).join('')}</ul>
        <p class="said" hidden></p>
      </div>
      <nav class="acts">
        <button class="${won && !isLast ? 'ghost' : 'cta'} retry" data-act="retry">${ICON.retry}<span>${esc(t('again'))}</span></button>
        <button class="ghost" data-act="album">${ICON.album}<span>${esc(t('toAlbum'))}</span></button>
        ${n ? `<button class="ghost share" data-act="share">${ICON.share}<span>${esc(t('share'))}</span></button>` : ''}
        ${won && !isLast ? `<button class="cta" data-act="next" data-autofocus>${esc(t('next'))}${ICON.next}</button>` : ''}
      </nav>
    </section>`);
  const items = [...node.querySelectorAll('.print')], said = node.querySelector('.said');
  prints.forEach((p, i) => {
    const slot = items[i].querySelector('.ph-slot'), mk = document.createElement('canvas');
    p.canvas.className = 'ph'; mk.className = 'mk'; mk.width = p.canvas.width; mk.height = p.canvas.height;
    slot.append(p.canvas, mk); p.mk = mk;
  });
  if (!node.querySelector('[data-autofocus]')) node.querySelector('[data-act="retry"]').setAttribute('data-autofocus', '');
  let done = false, raf = 0;
  const marks = (k) => prints.forEach((p) => { if (p.spots?.length) { const g = p.mk.getContext('2d'); g.clearRect(0, 0, p.mk.width, p.mk.height); drawMarks(g, p.spots, k, p.mk.width); } });
  let spoken = false;
  if (line) said.innerHTML = `<q>${esc(line.text)}</q><span>— ${esc(line.name)}</span>`;
  const say = (voice = true) => { if (voice && !spoken) { spoken = true; onJudge?.(); } if (line) said.hidden = false; };
  const finish = () => {
    if (done) return; done = true; cancelAnimationFrame(raf);
    node.classList.add('open', 'developed', 'marked', 'judged'); marks(1); say(!fast);
  };
  node.finish = finish;
  if (fast) { node.classList.add('fast'); finish(); }
  else {
    node.classList.add('intro');
    later(node, 380, () => { if (done) return; Audio.ui.tear(); node.classList.add('open'); prints.forEach((p, i) => later(node, 120 + i * 150, () => !done && Audio.ui.slide())); });
    const tDev = 380 + 150 * n + 1350;
    later(node, tDev, () => {
      if (done) return; node.classList.add('developed');
      const most = Math.max(0, ...prints.map((p) => p.spots?.length || 0)), per = 520, T = Math.max(1, most) * per, t0 = performance.now();
      for (let j = 0; j < Math.min(most, 4); j++) later(node, j * per, () => !done && Audio.ui.squeak(undefined, 0.42));
      const step = () => { if (done) return; const k = Math.min(1, (performance.now() - t0) / T); marks(k); if (k < 1) raf = requestAnimationFrame(step); };
      if (most) step();
      later(node, T + 200, () => {
        if (done) return; node.classList.add('marked');
        if (best >= 0) { Audio.ui.sticker(); Audio.music.win(); } else Audio.music.fail();
        set.forEach((s, k) => s && !was?.[k] && later(node, 500 + k * 260, () => Audio.ui.sticker()));
        later(node, 700, () => { if (done) return; node.classList.add('judged'); say(); done = true; });
      });
    });
    node.addEventListener('pointerdown', (e) => { if (!done && !e.target.closest('button')) finish(); });
  }
  wire(node, { retry: onRetry, album: onAlbum, next: onNext, share: onShare });
  return node;
}
