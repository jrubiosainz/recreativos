// Over the camera: the pause button, which photo this is, the sound, and «develop the roll».
import { t } from '../i18n.js';
import { el, esc, wire, ICON, soundBtn, bindMute } from './dom.js';

const px = (r) => `left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${r.w.toFixed(1)}px;height:${r.h.toFixed(1)}px`;

export function playScreen({ ev, muted, onPause, onDevelop, onMute }) {
  const node = el(`
    <section class="scr play" data-screen="play">
      <header class="pbar">
        <button class="rb" data-act="pause" aria-label="${esc(t('pause'))}" title="${esc(t('pause'))} (Esc)">${ICON.pause}</button>
        <p class="p-t"><span class="p-n">${esc(t('ev.' + ev.id + '.t'))}</span><span class="p-d">${esc(t('ev.' + ev.id + '.d'))}</span></p>
        ${soundBtn(muted, t('sound'))}
      </header>
      <button class="dev" data-act="develop" hidden>${ICON.roll}<span>${esc(t('btn.last'))}</span></button>
    </section>`);
  const dev = node.querySelector('.dev');
  node.place = (Lo) => { if (Lo?.dev) dev.style.cssText = px(Lo.dev); };
  node.showDevelop = (on) => { if (dev.hidden === !on) return; dev.hidden = !on; if (on) { dev.classList.remove('in'); void dev.offsetWidth; dev.classList.add('in'); } };
  wire(node, { pause: onPause, develop: onDevelop, mute: bindMute(onMute) });
  return node;
}

export function pauseScreen({ muted, onResume, onRestart, onQuit, onMute }) {
  const node = el(`
    <section class="scr pause" data-screen="pause">
      <div class="pcard" role="dialog" aria-labelledby="pz-t">
        <h2 id="pz-t">${esc(t('pause'))}</h2>
        <button class="cta" data-act="resume" data-autofocus>${esc(t('resume'))}</button>
        <button class="ghost" data-act="restart">${ICON.retry}<span>${esc(t('restart'))}</span></button>
        <button class="ghost" data-act="quit">${ICON.back}<span>${esc(t('quit'))}</span></button>
        <div class="p-snd">${soundBtn(muted, t('sound'))}</div>
        <p class="keys">${esc(t('keys'))}</p>
      </div>
    </section>`);
  wire(node, { resume: onResume, restart: onRestart, quit: onQuit, mute: bindMute(onMute) });
  return node;
}
