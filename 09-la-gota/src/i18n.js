// Every string LA GOTA prints, in Spanish and English: the ticket rack, the bus's LED sign, what the
// kids shout, the result and the tutorial's asides.
const S = {
  es: {
    title: 'LA GOTA',
    tagline: '¡Me pido esa!',
    loading: 'Empañando el cristal…',
    canvas: 'La ventanilla empañada de un autobús con lluvia fuera y gotas que bajan por el cristal',
    pitch: 'Llueve y vas en el bus. Cada uno se pide una gota de la ventanilla. <b>La primera que llegue abajo, gana.</b>',
    how: 'Ábrele camino con el dedo. <b>No toques ninguna gota pedida.</b>',
    call: '¡ME PIDO ESA!',
    meta: 'META',
    kid: { you: 'Tú', dani: 'Dani', lucia: 'Lucía', iker: 'Iker', vega: 'Vega' },
    lv: {
      linea27: 'Lunes, 7:42. Pídete una gota y ábrele camino con el dedo hasta la goma de abajo.',
      horapunta: 'El vaho vuelve enseguida. Y con las puertas abiertas, todavía más rápido.',
      frenazos: 'El conductor va con prisa. En cada frenazo, todas las gotas se van hacia delante.',
      adoquines: 'Pegatinas en el cristal y adoquines en la calle. Todo tiembla.',
      calefaccion: 'La calefacción seca el cristal de abajo. Y alguien ha rayado la ventanilla.',
      buho: 'El búho de las 2:17. Cuatro rivales, el cristal helado y tu parada cerca.',
    },
    stop: { linea27: 'COLEGIO', horapunta: 'COLEGIO', frenazos: 'CASA', adoquines: 'POLIDEPORTIVO', calefaccion: 'CASA DE LA ABUELA', buho: 'CASA' },
    ticket: 'BONOBÚS', tripsN: ['{n} viaje', '{n} viajes'], trip: 'VIAJE {n}', line: 'LÍNEA {n}', rivalsN: ['{n} rival', '{n} rivales'],
    lvAria: 'Viaje {n}: {name}, a las {clock}. {stars} de 3 estrellas.',
    lvLocked: 'Viaje {n}: {name}, todavía no circula',
    closed: 'NO CIRCULA',
    locked: 'Antes, gana en {name}.',
    go: '¡SUBIR!',
    goAria: 'Jugar {name}',
    sound: 'Sonido', langShort: 'EN', langName: 'Switch to English',
    hud: { pause: 'Pausa', stopBtn: 'STOP' },
    led: {
      your: 'TU PARADA', call: '¡PÍDETE UNA GOTA!', ready: 'PREPARADOS…', go: '¡VAMOS!', doors: 'PUERTAS ABIERTAS',
      next: 'PRÓXIMA PARADA', end: 'FIN DEL TRAYECTO', hard: '¡AGARRAOS!', wait: 'ESPERA TU TURNO…',
    },
    fx: {
      go: '¡YA!', brake: '¡FRENAZO!', cobbles: '¡ADOQUINES!', doors: 'PSSSSH', ate: '¡ÑAM!', nam: '¡ÑAM!',
      won: '¡GANÓ LA TUYA!', beaten: '¡GANÓ {name}!', eaten: '¡TE LA COMIÓ {name}!', stop: '¡TU PARADA!', squash: '¡PLAF!', cheat: '¡TRAMPA!',
    },
    pause: {
      title: 'PAUSA', resume: 'SEGUIR', restart: 'OTRA VEZ', levels: 'VIAJES',
      keys: '<kbd>clic</kbd> en una gota para pedírtela · <kbd>arrastra</kbd> para limpiar el vaho · <kbd>Esc</kbd> pausa',
      touch: 'Toca una gota para pedírtela · arrastra el dedo para limpiar el vaho',
    },
    res: {
      win: '¡GANÓ LA TUYA!',
      why: { beaten: 'Ganó la de {name}', eaten: 'Se la comió la de {name}', squash: 'La aplastaste tú', cheat: 'Tocaste la de {name}', stop: 'Se acabó el viaje' },
      by: 'por {cm} cm', time: '{s} s',
      star: ['Llegar la primera', 'Ganar por {n} cm', 'Comerte a una rival o {n} gotitas'],
      stat: { ate: ['{n} gotita comida', '{n} gotitas comidas'], rivals: ['{n} rival comida', '{n} rivales comidas'], left: 'Te faltaban {cm} cm' },
      got: 'conseguida', miss: 'pendiente',
      again: '¡OTRA!', next: 'SIGUIENTE', share: 'COMPARTIR', levels: 'VIAJES',
      best: '¡Tu mejor carrera aquí!', unlocked: 'Nuevo viaje: {name}', all: '¡Las tres estrellas!',
      tip: {
        beaten: 'Límpiale el camino justo delante: el vaho vuelve enseguida.',
        eaten: 'Una gota más gorda que pase cerca se come la tuya. Llévala por otro lado.',
        squash: 'Nunca toques tu gota: ábrele camino por delante, sin rozarla.',
        cheat: 'Las gotas de los demás no se tocan. Ni un poquito.',
        stop: 'Una gota pequeña no baja sola: llévala hacia otras para que engorde.',
      },
    },
    share: {
      saved: 'Imagen guardada', copied: 'Enlace copiado', err: 'No se pudo compartir',
      text: '¡Mi gota ganó por {cm} cm en {lv}! 💧 ¿Te pides una? #LaGota',
      lose: 'Mi gota no llegó en {lv}… 💧 ¿Te pides una? #LaGota',
    },
    card: { won: '¡GANÓ LA MÍA!', lost: 'CASI…', by: 'por {cm} cm', cta: '¿Te pides una?' },
    tut: {
      call: { k: 'Los demás se piden la suya. Luego te toca: <b>haz clic en una gota libre</b> y será tuya.', t: 'Los demás se piden la suya. Luego te toca: <b>toca una gota libre</b> y será tuya.' },
      wipe: { k: '<b>Arrastra</b> por el vaho justo debajo de tu gota: el agua corre por lo limpio.', t: '<b>Arrastra el dedo</b> por el vaho justo debajo de tu gota: el agua corre por lo limpio.' },
      lift: { k: 'Ojo: si tocas una gota pedida, <b>la tuya o la de otro</b>, pierdes.' },
      eat: { k: 'Pásala cerca de otras gotas: <b>se las come y engorda</b>. Cuanto más gorda, más corre.' },
      regrow: { k: 'El vaho <b>vuelve a salir</b>. Limpia justo delante de tu gota, no mucho antes.' },
      doors: { k: 'Con las <b>puertas abiertas</b> entra frío y el vaho vuelve el doble de rápido.' },
      brake: { k: 'En un <b>frenazo</b> todas las gotas se van hacia delante, a la izquierda.' },
      big: { k: 'Si una gota más gorda toca la tuya, <b>se la come</b>. Y al revés.' },
      sticker: { k: 'En las <b>pegatinas</b> no hay vaho: tu gota tiene que rodearlas.' },
      cobbles: { k: 'Los <b>adoquines</b> hacen temblar el cristal: las gotas se sueltan solas.' },
      heater: { k: 'Abajo, la <b>calefacción</b> seca el cristal: una gota pequeña se queda sin agua.' },
      scratch: { k: 'Las <b>rayas</b> del cristal frenan las gotas. Rodéalas.' },
      night: { k: 'De noche el vaho vuelve más rápido. Y hoy se piden gota <b>cuatro</b>.' },
    },
  },
  en: {
    title: 'LA GOTA',
    tagline: 'Dibs on that one!',
    loading: 'Fogging up the glass…',
    canvas: 'A steamed-up bus window with rain outside and drops running down the glass',
    pitch: 'It’s raining and you’re on the bus. Everyone calls dibs on a drop on the window. <b>First one to the bottom wins.</b>',
    how: 'Clear its path with your finger. <b>Never touch a called drop.</b>',
    call: 'DIBS!',
    meta: 'FINISH',
    kid: { you: 'You', dani: 'Dani', lucia: 'Lucía', iker: 'Iker', vega: 'Vega' },
    lv: {
      linea27: 'Monday, 7:42. Call a drop and clear its way with your finger down to the rubber seal.',
      horapunta: 'The fog comes back fast. With the doors open, faster still.',
      frenazos: 'The driver is in a hurry. Every time he brakes, all the drops lurch forward.',
      adoquines: 'Stickers on the glass and cobbles on the road. Everything shakes.',
      calefaccion: 'The heater dries the bottom of the glass. And someone has scratched the window.',
      buho: 'The 2:17 night bus. Four rivals, ice-cold glass and your stop coming up.',
    },
    stop: { linea27: 'SCHOOL', horapunta: 'SCHOOL', frenazos: 'HOME', adoquines: 'SPORTS CENTRE', calefaccion: 'GRANDMA’S', buho: 'HOME' },
    ticket: 'BUS PASS', tripsN: ['{n} trip', '{n} trips'], trip: 'TRIP {n}', line: 'ROUTE {n}', rivalsN: ['{n} rival', '{n} rivals'],
    lvAria: 'Trip {n}: {name}, at {clock}. {stars} of 3 stars.',
    lvLocked: 'Trip {n}: {name}, not in service yet',
    closed: 'NOT IN SERVICE',
    locked: 'Win {name} first.',
    go: 'HOP ON!',
    goAria: 'Play {name}',
    sound: 'Sound', langShort: 'ES', langName: 'Cambiar a español',
    hud: { pause: 'Pause', stopBtn: 'STOP' },
    led: {
      your: 'YOUR STOP', call: 'CALL A DROP!', ready: 'READY…', go: 'GO!', doors: 'DOORS OPEN',
      next: 'NEXT STOP', end: 'END OF THE LINE', hard: 'HOLD ON!', wait: 'WAIT YOUR TURN…',
    },
    fx: {
      go: 'GO!', brake: 'BRAKES!', cobbles: 'COBBLES!', doors: 'PSSSSH', ate: 'NOM!', nam: 'NOM!',
      won: 'YOURS WON!', beaten: '{name} WINS!', eaten: '{name} ATE IT!', stop: 'YOUR STOP!', squash: 'SPLAT!', cheat: 'CHEAT!',
    },
    pause: {
      title: 'PAUSED', resume: 'RESUME', restart: 'START OVER', levels: 'TRIPS',
      keys: '<kbd>click</kbd> a drop to call it · <kbd>drag</kbd> to wipe the fog · <kbd>Esc</kbd> pause',
      touch: 'Tap a drop to call it · drag your finger to wipe the fog',
    },
    res: {
      win: 'YOURS WON!',
      why: { beaten: '{name}’s drop won', eaten: '{name}’s drop ate yours', squash: 'You squashed it', cheat: 'You touched {name}’s', stop: 'The ride is over' },
      by: 'by {cm} cm', time: '{s} s',
      star: ['Get there first', 'Win by {n} cm', 'Eat a rival or {n} beads'],
      stat: { ate: ['{n} bead eaten', '{n} beads eaten'], rivals: ['{n} rival eaten', '{n} rivals eaten'], left: '{cm} cm to go' },
      got: 'done', miss: 'to do',
      again: 'AGAIN!', next: 'NEXT', share: 'SHARE', levels: 'TRIPS',
      best: 'Your best race here!', unlocked: 'New trip: {name}', all: 'All three stars!',
      tip: {
        beaten: 'Wipe just in front of it: the fog comes back fast.',
        eaten: 'A bigger drop passing close will swallow yours. Take it another way.',
        squash: 'Never touch your own drop: clear the way ahead without brushing it.',
        cheat: 'Other people’s drops are off limits. Not even a little.',
        stop: 'A small drop won’t go by itself: steer it into others so it grows.',
      },
    },
    share: {
      saved: 'Image saved', copied: 'Link copied', err: 'Couldn’t share',
      text: 'My drop won by {cm} cm on {lv}! 💧 Dibs on one? #LaGota',
      lose: 'My drop didn’t make it on {lv}… 💧 Dibs on one? #LaGota',
    },
    card: { won: 'MINE WON!', lost: 'SO CLOSE…', by: 'by {cm} cm', cta: 'Dibs on one?' },
    tut: {
      call: { k: 'The others call theirs first. Then it’s you: <b>click a free drop</b> and it’s yours.', t: 'The others call theirs first. Then it’s you: <b>tap a free drop</b> and it’s yours.' },
      wipe: { k: '<b>Drag</b> through the fog just below your drop: water runs where it’s clear.', t: '<b>Drag your finger</b> through the fog just below your drop: water runs where it’s clear.' },
      lift: { k: 'Careful: touch a called drop, <b>yours or anyone’s</b>, and you lose.' },
      eat: { k: 'Steer it past other drops: <b>it swallows them and grows</b>. Bigger is faster.' },
      regrow: { k: 'The fog <b>grows back</b>. Wipe just ahead of your drop, not long before.' },
      doors: { k: 'With the <b>doors open</b> the cold gets in and the fog grows back twice as fast.' },
      brake: { k: 'When the bus <b>brakes hard</b>, every drop lurches forward, to the left.' },
      big: { k: 'If a bigger drop touches yours, <b>it eats it</b>. And the other way round.' },
      sticker: { k: 'No fog grows on <b>stickers</b>: your drop has to go round them.' },
      cobbles: { k: '<b>Cobbles</b> shake the glass: drops let go by themselves.' },
      heater: { k: 'Down low the <b>heater</b> dries the glass: a small drop runs out of water.' },
      scratch: { k: '<b>Scratches</b> in the glass hold drops back. Go round them.' },
      night: { k: 'At night the fog comes back faster. And tonight <b>four</b> of them are calling dibs.' },
    },
  },
};

let lang = 'es';
export function setLang(l) { lang = S[l] ? l : 'es'; if (typeof document !== 'undefined') document.documentElement.lang = lang; }
export const getLang = () => lang;
export function detectLang() {
  const l = (navigator.languages?.[0] || navigator.language || 'es').toLowerCase();
  return l.startsWith('es') || l.startsWith('ca') || l.startsWith('gl') || l.startsWith('eu') ? 'es' : 'en';
}
export function t(path, vars) {
  let v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), S[lang]);
  if (v == null) v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), S.es);
  if (v == null) return path;
  if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
  return v;
}
// «1 gotita» / «3 gotitas»
export function plural(path, n, vars = {}) {
  const pair = t(path);
  const s = Array.isArray(pair) ? pair[n === 1 ? 0 : 1] : pair;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k === 'n' ? fmtNum(n) : vars[k] ?? `{${k}}`));
}
export function fmtNum(n) { return new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB').format(n); }
export function fmtCm(x) { return (Math.round(x * 10) / 10).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
