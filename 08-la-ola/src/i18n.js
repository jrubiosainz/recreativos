// Every string the game prints, in Spanish and English: the shell, the LED lines on the big screen,
// the words that pop out of the stands and the tutorial's asides.
const S = {
  es: {
    title: 'LA OLA',
    tagline: 'Enfoca. Que se levanten.',
    loading: 'Encendiendo el videomarcador…',
    canvas: 'Un estadio visto desde arriba, con miles de aficionados, y un videomarcador que controlas tú',
    lv: {
      amistoso: 'Campo pequeño, grada tranquila. El que sale en la pantalla gigante se levanta.',
      lluvia: 'Chubasqueros y una grada que se ha quedado dormida. Despiértala en pantalla.',
      palco: 'Los del palco no se levantan solos. Enfócalos cuando llegue la ola.',
      visitante: 'La afición de fuera no hará tu ola jamás. Tendrás que saltártela.',
      derbi: 'El derbi. Ultras, sección de abuelos y un realizador que te quita la pantalla.',
      final: 'La final. Un estadio lleno y cansado. Cuatro vueltas, y la kiss cam esperando.',
    },
    lvAria: 'Estadio {n}: {name}. {stars} de 3 estrellas.',
    lvLocked: 'Estadio {n}: {name}, cerrado',
    closed: 'CERRADO',
    locked: 'Antes, haz la ola en {name}.',
    go: '¡A PANTALLA!',
    goAria: 'Jugar {name}',
    goal: 'Meta: {n}', lapsN: ['{n} vuelta', '{n} vueltas'], cap: '{n} espectadores',
    sound: 'Sonido', langShort: 'EN', langName: 'Switch to English',
    footer: ['Minuto 80', '0 – 0', 'El estadio se aburre'],
    hud: { pause: 'Pausa', air: 'EN EL AIRE', airAria: 'Mantener pulsado para salir en la pantalla gigante' },
    led: {
      live: 'EN DIRECTO', preview: 'PREVIO', noSignal: 'SIN SEÑAL', back: 'VOLVEMOS EN', replay: 'REPETICIÓN', replayIn: 'REPE EN {n}',
      home: 'LOCAL', away: 'VISITA', laps: 'VUELTAS', air: 'SEÑAL', goal: 'META {n}', kissCam: 'KISS CAM', hold: 'MANTÉN PARA EMITIR',
      ola: '¡OLA!', lap: 'VUELTA {n}', rescue: '¡SALVADA!', palco: '¡EL PALCO!', end: 'FINAL', minute: "{m}'",
    },
    fx: {
      ola: '¡OLA!', lap: '¡VUELTA {n}!', rescue: '¡SALVADA!', boo: '¡BUUU!', wake: '¡DESPIERTA!', palco: '¡HASTA EL PALCO!',
      kiss: 'KISS CAM', kissOla: '¡BESO CON OLA!',
      die: { gap: 'SE CORTA', away: 'LOS DE FUERA', vip: 'EL PALCO NI SE MUEVE', sleep: 'DORMIDOS', collide: '¡CHOQUE!', tired: 'CANSADOS', weak: 'SE APAGA' },
    },
    pause: {
      title: 'PAUSA', resume: 'SEGUIR', restart: 'EMPEZAR DE NUEVO', levels: 'ESTADIOS',
      keys: '<kbd>ratón</kbd> apuntar la cámara · mantener <kbd>clic</kbd> o <kbd>Espacio</kbd> para emitir · <kbd>←</kbd> <kbd>→</kbd> girar',
      touch: 'Arrastra por el estadio para apuntar · mantén EN EL AIRE para emitir',
    },
    res: {
      win: '¡OLA!', lose: 'FINAL', laps: ['{n} VUELTA', '{n} VUELTAS'], of: 'de {n}', people: '{n} personas se levantaron',
      star: ['{n} vueltas', '', '{n} vueltas'],
      feat: { clockwise: 'Una vuelta en el sentido del reloj', wake: 'Despertar a todos los dormidos', palco: 'Que el palco haga la ola', jump: 'Saltarte a la afición de fuera', nocut: 'Sin quedarte sin señal', kiss: 'La kiss cam con la ola encima' },
      got: 'conseguida', miss: 'pendiente',
      again: '¡OTRA!', next: 'SIGUIENTE', share: 'COMPARTIR', levels: 'ESTADIOS',
      best: '¡Tu mejor ola aquí!', unlocked: 'Abierto: {name}', all: '¡Las tres estrellas!',
      tip: {
        none: 'Mantén pulsado y mueve la cámara a la vez: miran hacia donde vas.',
        short: 'Cuando se apague, enfoca donde parpadea el anillo: la salvas.',
        tired: 'No la pises: si emites donde ya pasó la ola, están cansados.',
      },
    },
    share: { saved: 'Imagen guardada', copied: 'Enlace copiado', err: 'No se pudo compartir', text: '¡{laps} de ola en {lv}! {n} personas de pie. ¿Das tú más vueltas? #LaOla', zero: 'Ni una vuelta de ola en {lv}. El estadio sigue sentado. #LaOla' },
    card: { laps: ['VUELTA', 'VUELTAS'], people: '{n} personas de pie', cta: '¿Das tú más vueltas?' },
    tut: {
      aim: { k: 'Mueve el ratón por la grada: la <b>cámara</b> te sigue.', t: 'Arrastra por el estadio: la <b>cámara</b> te sigue.' },
      air: { k: '<b>Mantén pulsado</b>: lo que enfocas sale en la pantalla gigante. Y el que se ve, <b>se levanta</b>.', t: '<b>Mantén EN EL AIRE</b>: lo que enfocas sale en la pantalla gigante. Y el que se ve, <b>se levanta</b>.' },
      sweep: { k: 'Emite <b>barriendo la grada</b>: miran hacia donde vas, y la ola sale hacia ese lado.' },
      still: { k: 'Con la cámara quieta se levantan <b>hacia los dos lados</b>… y las dos olas acaban chocando.' },
      ola: { k: '¡Ya va sola! <b>Suelta</b> y mírala dar la vuelta.' },
      rescue: { k: '¿Se apaga? Enfoca <b>donde parpadea el anillo</b>: ahí estaría ahora. La salvas.' },
      sleep: { k: 'Esa grada está <b>dormida</b> y corta la ola. Sácala en pantalla y se despierta.' },
      tired: { k: 'Quien se acaba de levantar está <b>cansado</b>. No emitas detrás de la ola.' },
      vip: { k: 'El palco <b>no se levanta solo</b>. Enfócalo justo cuando le llegue la ola.' },
      gap: { k: 'En la tribuna de prensa la ola <b>no salta</b>. Levanta tú el otro lado a tiempo.' },
      away: { k: 'Los de fuera <b>jamás</b> harán tu ola. Sáltatelos: emite al otro lado cuando llegue.' },
      kiss: { k: 'Una parejita… Es la <b>kiss cam</b>. Si la ola les pasa por encima, mejor.' },
      two: { k: 'Dos olas en sentido contrario <b>se anulan</b> al chocar. Una sola, y que no pare.' },
      replay: { k: 'El realizador te quita la pantalla para las <b>repeticiones</b>. Avisa antes: prepárate.' },
      ultras: { k: 'La curva de los <b>ultras</b> se levanta con nada. Aprovéchalos.' },
      cut: { k: 'Emitir gasta <b>señal</b>. Si se acaba, la pantalla se va a negro un rato.' },
      alive: { k: 'Estadio lleno y cansado: la ola que va viva vale más que diez nuevas. <b>Cuídala.</b>' },
    },
  },
  en: {
    title: 'LA OLA',
    tagline: 'Point the camera. Watch them rise.',
    loading: 'Warming up the big screen…',
    canvas: 'A stadium seen from above, thousands of fans, and a big screen you control',
    lv: {
      amistoso: 'A small ground, a calm crowd. Whoever shows up on the big screen stands up.',
      lluvia: 'Rain ponchos and a stand that has fallen asleep. Wake it up on screen.',
      palco: 'The directors’ box won’t stand up on its own. Frame them as the wave arrives.',
      visitante: 'The away fans will never do your wave. You’ll have to jump them.',
      derbi: 'The derby. Ultras, the pensioners’ block, and a director who takes your screen away.',
      final: 'The final. A full, tired stadium. Four laps, and the kiss cam waiting.',
    },
    lvAria: 'Stadium {n}: {name}. {stars} of 3 stars.',
    lvLocked: 'Stadium {n}: {name}, closed',
    closed: 'CLOSED',
    locked: 'First, get a wave going at {name}.',
    go: 'ON SCREEN!',
    goAria: 'Play {name}',
    goal: 'Goal: {n}', lapsN: ['{n} lap', '{n} laps'], cap: '{n} fans',
    sound: 'Sound', langShort: 'ES', langName: 'Cambiar a español',
    footer: ['80th minute', '0 – 0', 'The stadium is bored'],
    hud: { pause: 'Pause', air: 'ON AIR', airAria: 'Hold to put the shot on the big screen' },
    led: {
      live: 'LIVE', preview: 'PREVIEW', noSignal: 'NO SIGNAL', back: 'BACK IN', replay: 'REPLAY', replayIn: 'REPLAY IN {n}',
      home: 'HOME', away: 'AWAY', laps: 'LAPS', air: 'SIGNAL', goal: 'GOAL {n}', kissCam: 'KISS CAM', hold: 'HOLD TO GO LIVE',
      ola: 'WAVE!', lap: 'LAP {n}', rescue: 'SAVED!', palco: 'THE BOX!', end: 'FULL TIME', minute: "{m}'",
    },
    fx: {
      ola: 'WAVE!', lap: 'LAP {n}!', rescue: 'SAVED!', boo: 'BOOO!', wake: 'WAKE UP!', palco: 'EVEN THE BOX!',
      kiss: 'KISS CAM', kissOla: 'KISS + WAVE!',
      die: { gap: 'CUT OFF', away: 'AWAY END', vip: 'THE BOX WON’T MOVE', sleep: 'ASLEEP', collide: 'HEAD-ON!', tired: 'TOO TIRED', weak: 'FIZZLED OUT' },
    },
    pause: {
      title: 'PAUSED', resume: 'RESUME', restart: 'START OVER', levels: 'STADIUMS',
      keys: '<kbd>mouse</kbd> aim the camera · hold <kbd>click</kbd> or <kbd>Space</kbd> to go live · <kbd>←</kbd> <kbd>→</kbd> pan',
      touch: 'Drag over the stadium to aim · hold ON AIR to go live',
    },
    res: {
      win: 'WAVE!', lose: 'FULL TIME', laps: ['{n} LAP', '{n} LAPS'], of: 'of {n}', people: '{n} people stood up',
      star: ['{n} laps', '', '{n} laps'],
      feat: { clockwise: 'A lap going clockwise', wake: 'Wake every sleeper', palco: 'Get the box to do the wave', jump: 'Jump the away end', nocut: 'Never lose the signal', kiss: 'The kiss cam under the wave' },
      got: 'earned', miss: 'to do',
      again: 'AGAIN!', next: 'NEXT', share: 'SHARE', levels: 'STADIUMS',
      best: 'Your best wave here!', unlocked: 'Open: {name}', all: 'All three stars!',
      tip: {
        none: 'Hold and move the camera at the same time: they look the way you pan.',
        short: 'When it fizzles, frame the blinking spot on the ring: that saves it.',
        tired: 'Don’t trample it: behind the wave, people are tired.',
      },
    },
    share: { saved: 'Image saved', copied: 'Link copied', err: 'Could not share', text: '{laps} of Mexican wave at {lv}! {n} people on their feet. Can you go further? #LaOla', zero: 'Not a single lap of wave at {lv}. The stadium stayed seated. #LaOla' },
    card: { laps: ['LAP', 'LAPS'], people: '{n} people on their feet', cta: 'Can you go further?' },
    tut: {
      aim: { k: 'Move the mouse over the stands: the <b>camera</b> follows.', t: 'Drag over the stadium: the <b>camera</b> follows.' },
      air: { k: '<b>Hold the button</b>: your shot goes up on the big screen. Whoever sees himself <b>stands up</b>.', t: '<b>Hold ON AIR</b>: your shot goes up on the big screen. Whoever sees himself <b>stands up</b>.' },
      sweep: { k: 'Go live <b>while panning</b>: they look the way you move, and the wave sets off that way.' },
      still: { k: 'Hold the camera still and they rise <b>both ways</b>… and the two waves end up colliding.' },
      ola: { k: 'It’s going on its own! <b>Let go</b> and watch it go round.' },
      rescue: { k: 'Fizzling out? Frame <b>the blinking spot on the ring</b>: that’s where it would be. Saved.' },
      sleep: { k: 'That stand is <b>asleep</b> and stops the wave. Put them on screen and they wake up.' },
      tired: { k: 'Whoever just stood up is <b>tired</b>. Don’t go live behind the wave.' },
      vip: { k: 'The box <b>won’t stand on its own</b>. Frame them just as the wave reaches them.' },
      gap: { k: 'The wave <b>can’t cross</b> the press box. Get the far side up in time.' },
      away: { k: 'Away fans will <b>never</b> do your wave. Jump them: go live on the other side as it arrives.' },
      kiss: { k: 'A couple… It’s the <b>kiss cam</b>. Even better with the wave going over them.' },
      two: { k: 'Two waves going opposite ways <b>cancel out</b> when they meet. One wave, and keep it going.' },
      replay: { k: 'The director takes your screen for <b>replays</b>. You get a warning: be ready.' },
      ultras: { k: 'The <b>ultras</b> stand up for anything. Use them.' },
      cut: { k: 'Going live uses up <b>signal</b>. Run out and the screen goes black for a while.' },
      alive: { k: 'A full, tired stadium: a living wave is worth ten new ones. <b>Look after it.</b>' },
    },
  },
};

let lang = 'es';
export function setLang(l) { lang = S[l] ? l : 'es'; document.documentElement.lang = lang; }
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
// «1 vuelta» / «3 vueltas»
export function plural(path, n, vars = {}) {
  const pair = t(path);
  const s = Array.isArray(pair) ? pair[n === 1 ? 0 : 1] : pair;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k === 'n' ? fmtNum(n) : vars[k] ?? `{${k}}`));
}
export function fmtNum(n) { return new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB').format(n); }
export function fmtLaps(x) { return (Math.floor(x * 10) / 10).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
