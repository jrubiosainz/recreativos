// Paper bunting strung across the top of a cover: parabolic swags, triangle flags sewn along the string,
// a swing when the page opens, a gust now and then, and a flutter wherever the pointer brushes past.
const INKS = ['#FFD02E', '#FFFEFA', '#1B4DA1', '#00874A'];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const f = (n) => n.toFixed(1);

function mulberry(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// cut and hang the flags for the svg's current size; returns the flags with their x centres, left to right
function cut(svg, seed) {
  const r = svg.getBoundingClientRect(), W = r.width, H = r.height - 12;
  if (W < 20 || H < 20) { svg.innerHTML = ''; return []; }
  const R = mulberry(seed * 7919), n = Math.max(1, Math.round(W / 520)), span = (W + 24) / n;
  const top = 2, sag = H * .24, fl = H - top - sag - 6, fw = fl * .78, gap = fw * .16;
  let flags = '', strs = '', k = 0;
  const xs = [];
  for (let s = 0; s < n; s++) {
    const x0 = -12 + s * span, y0 = top + (s % 2) * 3, y1 = top + ((s + 1) % 2) * 3;
    const y = (x) => { const t = (x - x0) / span; return y0 + (y1 - y0) * t + 4 * sag * t * (1 - t); };
    const m = Math.max(2, Math.floor(span / (fw + gap))), pitch = span / m;
    for (let j = 0; j < m; j++, k++) {
      const xc = x0 + pitch * (j + .5), xl = xc - fw / 2, xr = xc + fw / 2, yl = y(xl), yr = y(xr);
      const tip = (yl + yr) / 2 + fl * (.93 + R() * .1), lean = (R() - .5) * 4;
      flags += `<g class="flag"><path d="M${f(xl)} ${f(yl)}L${f(xr)} ${f(yr)}L${f(xc + lean)} ${f(tip)}Z" fill="${INKS[(k + seed) % 4]}"/>`
        + `<path class="fold" d="M${f(xl + 1.5)} ${f(yl + 2.2)}L${f(xr - 1.5)} ${f(yr + 2.2)}"/></g>`;
      xs.push(xc);
    }
    strs += `<path class="str" d="M${f(x0)} ${f(y0)}Q${f(x0 + span / 2)} ${f((y0 + y1) / 2 + 2 * sag)} ${f(x0 + span)} ${f(y1)}"/>`;
  }
  svg.setAttribute('viewBox', `0 0 ${f(W)} ${f(r.height)}`);
  svg.innerHTML = flags + strs;
  return [...svg.querySelectorAll('.flag')].map((el, i) => ({ el, x: xs[i], busy: 0 }));
}

const SWING = [-38, 16, -7, 3, 0].map((d) => ({ transform: `rotate(${d}deg)` }));
const flutter = (a) => [0, a, -a * .55, a * .22, 0].map((d) => ({ transform: `rotate(${d}deg)` }));

// Hangs bunting in `svg` and keeps it alive. `host` is the element whose pointer moves the flags.
export function bunting(svg, host, seed = 1) {
  let flags = [], width = 0, visible = true, timer = 0, entered = false;
  const shake = (fl, a, delay, dur) => {
    const now = performance.now();
    if (fl.busy > now) return;
    fl.busy = now + delay + dur;
    fl.el.animate(flutter(a), { duration: dur, delay, easing: 'ease-out' });
  };
  const gust = () => {
    clearTimeout(timer);
    if (reduce.matches) return;
    if (visible && !document.hidden) flags.forEach((fl, i) => shake(fl, 6 + Math.random() * 3, i * 42, 1300));
    timer = setTimeout(gust, 7000 + Math.random() * 5000);
  };
  const layout = () => {
    const w = Math.round(svg.getBoundingClientRect().width);
    if (w === width) return;
    width = w;
    flags = cut(svg, seed);
  };
  layout();
  new ResizeObserver(() => requestAnimationFrame(layout)).observe(svg);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(svg);

  let lx = null;
  host.addEventListener('pointermove', (e) => {
    if (reduce.matches || !flags.length) return;
    const r = svg.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const dx = lx === null ? 0 : e.clientX - lx;
    lx = e.clientX;
    if (y < -10 || y > r.height + 24 || Math.abs(dx) < 1.5) return;
    const a = Math.max(-14, Math.min(14, dx * 1.6));
    for (const fl of flags) if (Math.abs(fl.x - x) < 34) shake(fl, a, 0, 1100);
  });
  host.addEventListener('pointerleave', () => { lx = null; });
  host.addEventListener('pointerdown', (e) => {
    if (reduce.matches || e.pointerType === 'mouse') return;
    const r = svg.getBoundingClientRect(), x = e.clientX - r.left;
    if (e.clientY - r.top > r.height + 24) return;
    for (const fl of flags) { const d = Math.abs(fl.x - x); if (d < 160) shake(fl, 11 * (fl.x < x ? -1 : 1), d * 2.2, 1200); }
  });

  return {
    // the entrance: the flags swing into place from left to right, then the breeze takes over
    enter() {
      if (entered) return;
      entered = true;
      if (!reduce.matches) {
        flags.forEach((fl, i) => {
          fl.busy = performance.now() + 150 + i * 36 + 1500;
          fl.el.animate(SWING, { duration: 1500, delay: 150 + i * 36, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' });
        });
      }
      timer = setTimeout(gust, 6000);
    },
  };
}
