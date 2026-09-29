// Every string GATO CON TOSTADA prints, in Spanish and English: the fridge door, the notes, the HUD,
// what the flat shouts, the Polaroid and the tutorial's asides.
const S = {
  es: {
    title: 'GATO CON TOSTADA',
    tagline: 'Si quepo, me siento.',
    loading: 'Untando la tostada…',
    canvas: 'Un piso visto en sección. Un gato naranja con una tostada con mantequilla atada a la espalda flota sin poder aterrizar.',
    law1: 'Los gatos siempre caen de pie.',
    law2: 'Las tostadas, del lado de la mantequilla.',
    pitch: 'Alguien le ha atado una tostada a un gato. <b>Ninguna ley gana: el gato flota.</b>',
    how: '<b>Gíralo</b> para moverlo. Para bajar, <b>siéntalo de culo en la caja</b>.',
    lv: {
      desayuno: 'No tirar el vaso de leche. (Ja.)',
      nevera: 'Fregadero lleno y el fuego encendido. OJO.',
      salon: 'El jarrón de la abuela NO se toca.',
      pasillo: 'Cuidado con Tobi, que salta.',
      bano: 'El papel higiénico, EN SU SITIO.',
      terraza: 'Hace viento. La caja está en la terraza del vecino.',
    },
    obj: { milk: 'el vaso de leche', oil: 'la aceitera', vase: 'el jarrón de la abuela', keys: 'las llaves', roll: 'el papel higiénico', gnome: 'el gnomo del vecino' },
    lvAria: 'Nivel {n}: {name}. {stars} de 3 estrellas.',
    lvLocked: 'Nivel {n}: {name}, bloqueado',
    locked: 'Antes, termina {name}.',
    go: '¡A LA CAJA!',
    goAria: 'Jugar {name}',
    sound: 'Sonido', langShort: 'EN', langName: 'Switch to English',
    hud: { pause: 'Pausa', butter: 'Mantequilla', left: 'Girar a la izquierda', right: 'Girar a la derecha' },
    fx: {
      meow: '¡MIAU!', splat: '¡PLAF!', crash: '¡CRAS!', woof: '¡GUAU!', hiss: '¡FFFSSS!', sizzle: '¡CHSSS!', purr: 'rrrrr…',
      bonk: '¡BONK!', oops: '¡UPS! ★', low: '¡QUEDA POCA!', whee: '¡WIIII!', gust: '¡FIUUU!', thud: '¡PUM!', smear: '¡PRINGUE!',
      fits: '¡QUEPO!', splash: '¡CHOF!', ouch: '¡AY!', sit: 'me siento', rise: '¡HOP!',
    },
    pause: {
      title: 'PAUSA', resume: 'SEGUIR', restart: 'OTRA VEZ', levels: 'NEVERA',
      keys: '<kbd>←</kbd> <kbd>→</kbd> girar (mantén para girar más) · <kbd>Esc</kbd> pausa · <kbd>R</kbd> otra vez',
      touch: 'Mantén el dedo a la izquierda o a la derecha de la pantalla para girar',
    },
    res: {
      win: '¡SI QUEPO, ME SIENTO!',
      why: {
        butter: 'SE ACABÓ LA MANTEQUILLA', water: '¡AL AGUA!', fell: '¡AL VACÍO!',
      },
      sub: {
        win: 'Tostada arriba, gato abajo. Paradoja resuelta.',
        butter: 'Sin mantequilla no hay paradoja: cayó de pie, como cualquier gato.',
        water: 'El agua no es suelo. Ni para un gato ni para una tostada.',
        fell: 'Sin nada debajo, ninguna de las dos leyes tiene dónde aterrizar.',
      },
      star: ['Sentarse en la caja', 'Tirar {obj}', 'Llegar con {p} % de mantequilla'],
      stat: { butter: 'Mantequilla: {p} %', broke: ['{n} destrozo', '{n} destrozos'], time: '{s} s' },
      got: 'conseguida', miss: 'pendiente',
      again: '¡OTRA!', next: 'SIGUIENTE', share: 'COMPARTIR', levels: 'NEVERA',
      best: '¡Tu mejor aterrizaje aquí!', unlocked: 'Nueva nota en la nevera: {name}', all: '¡Las tres estrellas!',
      tip: {
        butter: 'Girar como una peonza gasta mantequilla. Y rozar con la tostada, también.',
        water: 'Encima del agua no flota: crúzala con impulso, inclinado y alto.',
        fell: 'Sobre el hueco no hay suelo: coge carrerilla desde lejos y no lo cruces bajo.',
      },
    },
    share: {
      saved: 'Imagen guardada', copied: 'Enlace copiado', err: 'No se pudo compartir',
      text: 'He sentado a un gato con una tostada en una caja 🐈🍞 {stars}/3 ★ en {lv}. ¿De pie o de mantequilla? #GatoConTostada',
      lose: 'Mi gato con tostada no llegó a la caja en {lv} 🐈🍞 ¿De pie o de mantequilla? #GatoConTostada',
    },
    card: { won: 'SI QUEPO, ME SIENTO', lost: 'CASI…', cta: '¿De pie o de mantequilla?' },
    tut: {
      turn: { k: '<kbd>←</kbd> <kbd>→</kbd> giran el gato. <b>Mantén pulsado</b> y gira más deprisa.', t: '<b>Mantén el dedo</b> a la izquierda o a la derecha de la pantalla para girar el gato.' },
      move: { k: '<b>Inclínalo</b> y avanza hacia ese lado. Cuanto más inclinado, más corre.' },
      stop: { k: '<b>Recto</b>, tostada arriba o abajo, se para. Y cuanto más recto, <b>más alto</b> flota.' },
      tempt: { k: 'Ese vaso de leche en el borde… Un gato de verdad lo tiraría. <b>★</b>' },
      sit: { k: 'Para bajar, ponlo <b>de culo</b>, cola abajo: se sienta. Siéntalo <b>dentro de la caja</b>.' },
      climb: { k: '<b>Gira sin parar</b>: las dos leyes se pelean más y sube más alto.' },
      water: { k: 'El <b>agua</b> no es suelo: encima de ella no flota. Crúzala con impulso.' },
      hob: { k: 'El <b>fuego</b> derrite la mantequilla. Sin mantequilla no hay paradoja.' },
      cucumber: { k: 'Un <b>pepino</b>. Ya sabes lo que pasa.' },
      lamp: { k: 'La <b>lámpara</b> cuelga del techo. Pasa por debajo o por encima.' },
      dog: { k: '<b>Tobi</b> salta si vuelas bajo delante de él. Espera a que se dé la vuelta.' },
      tub: { k: 'La <b>bañera</b> está llena. Crúzala alto, con un buen giro.' },
      wind: { k: '<b>Rachas de viento</b>: las hojas avisan de dónde viene la siguiente.' },
      gap: { k: 'Entre los dos edificios <b>no hay suelo</b>. Coge carrerilla y crúzalo alto.' },
    },
  },
  en: {
    title: 'CAT WITH TOAST',
    tagline: 'If I fits, I sits.',
    loading: 'Buttering the toast…',
    canvas: 'A flat seen in cross-section. A ginger cat with a buttered slice of toast taped to its back hovers, unable to land.',
    law1: 'Cats always land on their feet.',
    law2: 'Toast always lands butter side down.',
    pitch: 'Somebody taped a slice of toast to a cat. <b>Neither law wins, so the cat hovers.</b>',
    how: '<b>Turn it</b> to move it. To get down, <b>sit it on its bottom in the box</b>.',
    lv: {
      desayuno: 'Do NOT knock the milk off. (Ha.)',
      nevera: 'Sink full, hob on. CAREFUL.',
      salon: 'Nobody touches Grandma\'s vase.',
      pasillo: 'Mind Toby, he jumps.',
      bano: 'Loo roll STAYS where it is.',
      terraza: 'Windy tonight. The box is on next door\'s terrace.',
    },
    obj: { milk: 'the glass of milk', oil: 'the oil cruet', vase: 'Grandma\'s vase', keys: 'the keys', roll: 'the loo roll', gnome: 'next door\'s gnome' },
    lvAria: 'Level {n}: {name}. {stars} of 3 stars.',
    lvLocked: 'Level {n}: {name}, locked',
    locked: 'Finish {name} first.',
    go: 'TO THE BOX!',
    goAria: 'Play {name}',
    sound: 'Sound', langShort: 'ES', langName: 'Cambiar a español',
    hud: { pause: 'Pause', butter: 'Butter', left: 'Turn left', right: 'Turn right' },
    fx: {
      meow: 'MEOW!', splat: 'SPLAT!', crash: 'CRASH!', woof: 'WOOF!', hiss: 'HISSSS!', sizzle: 'SIZZLE!', purr: 'purrrr…',
      bonk: 'BONK!', oops: 'OOPS! ★', low: 'RUNNING LOW!', whee: 'WHEEE!', gust: 'WHOOSH!', thud: 'THUD!', smear: 'SMEAR!',
      fits: 'I FITS!', splash: 'SPLOSH!', ouch: 'OW!', sit: 'I sits', rise: 'HOP!',
    },
    pause: {
      title: 'PAUSED', resume: 'RESUME', restart: 'RETRY', levels: 'FRIDGE',
      keys: '<kbd>←</kbd> <kbd>→</kbd> turn (hold to turn faster) · <kbd>Esc</kbd> pause · <kbd>R</kbd> retry',
      touch: 'Hold a finger on the left or right side of the screen to turn',
    },
    res: {
      win: 'IF I FITS, I SITS!',
      why: { butter: 'OUT OF BUTTER', water: 'SPLASHDOWN!', fell: 'INTO THE VOID!' },
      sub: {
        win: 'Toast up, cat down. Paradox resolved.',
        butter: 'No butter, no paradox: it landed on its feet, like any cat.',
        water: 'Water is not ground. Not for a cat, not for toast.',
        fell: 'With nothing below, neither law has anywhere to land.',
      },
      star: ['Sit in the box', 'Knock off {obj}', 'Arrive with {p}% butter'],
      stat: { butter: 'Butter: {p}%', broke: ['{n} breakage', '{n} breakages'], time: '{s} s' },
      got: 'earned', miss: 'missing',
      again: 'AGAIN!', next: 'NEXT', share: 'SHARE', levels: 'FRIDGE',
      best: 'Your best landing here!', unlocked: 'New note on the fridge: {name}', all: 'All three stars!',
      tip: {
        butter: 'Spinning like a top burns butter. So does scraping the toast on things.',
        water: 'It can\'t hover over water: cross it with speed, tilted and high.',
        fell: 'There is no ground over the gap: take a long run-up and don\'t cross it low.',
      },
    },
    share: {
      saved: 'Image saved', copied: 'Link copied', err: 'Could not share',
      text: 'I sat a cat with toast in a box 🐈🍞 {stars}/3 ★ on {lv}. Feet or butter? #CatWithToast',
      lose: 'My toast cat didn\'t make it to the box on {lv} 🐈🍞 Feet or butter? #CatWithToast',
    },
    card: { won: 'IF I FITS, I SITS', lost: 'SO CLOSE…', cta: 'Feet or butter?' },
    tut: {
      turn: { k: '<kbd>←</kbd> <kbd>→</kbd> turn the cat. <b>Hold</b> to turn faster.', t: '<b>Hold a finger</b> on the left or right side of the screen to turn the cat.' },
      move: { k: '<b>Tilt it</b> and it moves that way. The more it leans, the faster it goes.' },
      stop: { k: '<b>Level</b>, toast up or down, it stops. And the more level, <b>the higher</b> it hovers.' },
      tempt: { k: 'That glass of milk on the edge… A real cat would knock it off. <b>★</b>' },
      sit: { k: 'To get down, turn it <b>tail down</b>: it sits. Sit it <b>inside the box</b>.' },
      climb: { k: '<b>Keep spinning</b>: the two laws fight harder and it climbs higher.' },
      water: { k: '<b>Water</b> is not ground: it can\'t hover over it. Cross with speed.' },
      hob: { k: 'The <b>hob</b> melts the butter. No butter, no paradox.' },
      cucumber: { k: 'A <b>cucumber</b>. You know what happens.' },
      lamp: { k: 'The <b>lamp</b> hangs from the ceiling. Go under it or over it.' },
      dog: { k: '<b>Toby</b> jumps if you fly low in front of him. Wait for him to turn round.' },
      tub: { k: 'The <b>bath</b> is full. Cross it high, with a good spin.' },
      wind: { k: '<b>Gusts</b>: the leaves tell you where the next one comes from.' },
      gap: { k: 'There is <b>no ground</b> between the two buildings. Take a run-up and cross high.' },
    },
  },
};

let lang = 'es';
export function setLang(l) { lang = S[l] ? l : 'es'; if (typeof document !== 'undefined') document.documentElement.lang = lang; }
export const getLang = () => lang;
export function detectLang() {
  const l = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language) || 'es').toLowerCase();
  return l.startsWith('es') || l.startsWith('ca') || l.startsWith('gl') || l.startsWith('eu') ? 'es' : 'en';
}
export function t(path, vars) {
  let v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), S[lang]);
  if (v == null) v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), S.es);
  if (v == null) return path;
  if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
  return v;
}
// «1 destrozo» / «3 destrozos»
export function plural(path, n, vars = {}) {
  const pair = t(path);
  const s = Array.isArray(pair) ? pair[n === 1 ? 0 : 1] : pair;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k === 'n' ? fmtNum(n) : vars[k] ?? `{${k}}`));
}
export function fmtNum(n) { return new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB').format(n); }
export const nameOf = (lv) => (lv.name && (lv.name[lang] || lv.name.es)) || lv.id;
