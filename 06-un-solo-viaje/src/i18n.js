// Every string the shell prints. What is said and painted inside the building (voices, stickers,
// pops, the stamp) lives in scene.js as SCENE_ES / SCENE_EN; bag names in levels.js.
const S = {
  es: {
    title: 'UN SOLO VIAJE',
    tagline: 'Súbelo todo de una vez',
    loading: 'Pesando…',
    canvas: 'Tus dos manos cargadas de bolsas, subiendo la compra por el portal',
    lv: {
      bajo: ['BAJO B', 'LO JUSTO', 'Tres bolsas y dos puertas. Las llaves, en el bolsillo derecho.'],
      primero: ['1.º A', 'PRIMERO SIN ASCENSOR', 'Escalera, y la luz del rellano dura 30 segundos.'],
      quinto: ['5.º C', 'EL ASCENSOR NO ESPERA', 'Se llama con la izquierda. Si tardas en entrar, se cierra.'],
      tercero: ['3.º D', 'ASCENSOR AVERIADO', 'Tres pisos a pie, una luz de 22 segundos y la vecina del segundo.'],
      mes: ['6.º B', 'LA COMPRA DEL MES', 'Nueve bolsas y un ascensor de reja que se abre a mano.'],
      nochebuena: ['2.º A', 'NOCHEBUENA', 'En casa de tu suegra: portero automático, dos pisos y el cava.'],
    },
    lcd: { peso: 'PESO (kg)', piso: 'PLANTA', record: 'RÉCORD', over: 'SOBRECARGA' },
    key: 'Nivel {n}: {name}',
    keyLocked: 'Nivel {n}, bloqueado',
    locked: 'Antes, sube la compra del nivel {n}.',
    go: '¡A CARGAR!', goAria: 'Empezar el nivel {n}: {name}',
    sound: 'Sonido', langShort: 'EN', langName: 'Switch to English',
    bags: '{n} BOLSAS',
    hud: {
      pause: 'Pausa', honkIn: 'PITAN EN', honking: 'PITANDO', light: 'LUZ', dark: 'A OSCURAS', lapse: 'DESCANSO',
      next: 'Lo próximo', home: 'CASA', m: 'm',
      how: { head: 'CABEZA', crouch: 'CUCLILLAS', bum: 'CULO', foot: 'PIE', nose: 'NARIZ', elbow: 'CODO' },
      chip: '{what}: mano {side}, a {d} m', chipAny: '{what}: cualquier mano, a {d} m', chipFb: '{what}: sin mano libre, {how}',
    },
    what: {
      trunk: 'El maletero', portal: 'El portal', door: 'La puerta', call: 'El botón del ascensor', floor: 'El botón del piso',
      light: 'El interruptor', liftdoor: 'La puerta del ascensor', reja: 'La reja', intercom: 'El portero automático', bell: 'El timbre',
    },
    side: { L: 'izquierda', R: 'derecha' },
    rest: { down: 'SOLTAR', up: 'COGER', load: 'REPARTIR', aria: { down: 'Soltarlo todo y descansar', up: 'Cogerlo todo otra vez', load: 'Repartir las bolsas solas' } },
    pause: {
      t: 'PAUSA', resume: 'SEGUIR', restart: 'EMPEZAR DE NUEVO', quit: 'MENÚ PRINCIPAL',
      keys: '<kbd>←</kbd> <kbd>→</kbd> manos · <kbd>↓</kbd> soltar · <kbd>↑</kbd> coger · <kbd>Esc</kbd> pausa',
    },
    res: {
      band: 'PESO EN BALANZA', lose: 'DOS VIAJES', neto: 'PESO NETO', time: 'TIEMPO', par: 'PITIDO A LOS', record: '¡RÉCORD!',
      stars: ['UN SOLO VIAJE', 'NADA ROTO', 'ANTES DEL PITIDO'], broken: 'ROTO', fell: 'ESCALERA ABAJO',
      again: 'VOLVER A JUGAR', next: 'SIGUIENTE', menu: 'MENÚ PRINCIPAL', share: 'COMPARTIR',
      seal: 'SUBIDO A MANO · SUBIDO A MANO · ', sealLose: 'OTRA VEZ ABAJO · OTRA VEZ ABAJO · ',
      unlocked: 'Nuevo en la balanza: {name}', photo: 'Tu mejor momento',
    },
    share: {
      win: '¡UN SOLO VIAJE! {n} bolsas, {kg} kg, en {time}.', winBroken: '¡UN SOLO VIAJE! {n} bolsas, {kg} kg, en {time}… y algo roto por el camino.',
      lose: 'DOS VIAJES. La bolsa de {bag} bajó rodando por la escalera.', dare: '¿Tú lo subes todo de una?',
      saved: 'Imagen guardada', copied: 'Texto copiado', err: 'No se ha podido compartir',
    },
    tut: {
      park: 'Has aparcado <b>en doble fila</b>. Súbelo todo de una vez antes de que te piten.',
      loadK: 'Coge las bolsas: <kbd>←</kbd> con la mano izquierda, <kbd>→</kbd> con la derecha.',
      loadT: 'Toca a la izquierda o a la derecha: esa mano coge la siguiente bolsa.',
      freeK: '{what} pide la mano <b>{side}</b>. <kbd>{key}</kbd> le pasa sus bolsas a la otra.',
      freeT: '{what} pide la mano <b>{side}</b>. Toca a la {other} y le pasas sus bolsas a la otra.',
      fb: '¿Sin una mano libre? <b>{how}</b>. Funciona, pero tardas más.',
      fbHow: { head: 'Con la cabeza', crouch: 'En cuclillas', bum: 'Con el culo', foot: 'Con el pie', nose: 'Con la nariz', elbow: 'Con el codo' },
      strainK: '¡Se te escurren los dedos! <kbd>↓</kbd> lo deja todo en el suelo y descansas.',
      strainT: '¡Se te escurren los dedos! Toca <b>SOLTAR</b>: lo dejas todo en el suelo y descansas.',
      restK: 'Descansando: el reloj corre ×4. <kbd>↑</kbd> lo coge todo como estaba; <kbd>←</kbd> <kbd>→</kbd>, bolsa a bolsa.',
      restT: 'Descansando: el reloj corre ×4. Toca <b>COGER</b> y lo coges como estaba, o a los lados, bolsa a bolsa.',
      light: 'Luz de escalera: se apaga a los <b>{s} s</b>. A oscuras se sube más despacio.',
      lift: 'El ascensor no espera: si no entras a tiempo, se cierra y se va.',
      oldlift: 'Ascensor antiguo: la puerta y la reja se abren a mano.',
      buzz: 'Cuando zumbe, empuja el portal: <b>solo {s} s</b>.',
      stairs: 'En la escalera, una bolsa que se cae rueda hasta abajo. Y eso ya son <b>dos viajes</b>.',
      honk: '¡Te pitan! Otro pitido cada {s} s que tardes.',
    },
  },
  en: {
    title: 'ONE TRIP',
    tagline: 'Carry it all up in one go',
    loading: 'Weighing…',
    canvas: 'Your two hands full of shopping bags, carrying it all up through the building',
    lv: {
      bajo: ['GROUND B', 'THE BASICS', 'Three bags and two doors. Keys in your right pocket.'],
      primero: ['1ST A', 'FIRST FLOOR, NO LIFT', 'Stairs, and the landing light lasts 30 seconds.'],
      quinto: ['5TH C', 'THE LIFT WON’T WAIT', 'Call it with your left. Too slow getting in and it shuts.'],
      tercero: ['3RD D', 'OUT OF ORDER', 'Three flights on foot, a 22-second light and the neighbour on the 2nd.'],
      mes: ['6TH B', 'THE MONTHLY SHOP', 'Nine bags and an old cage lift you open by hand.'],
      nochebuena: ['2ND A', 'CHRISTMAS EVE', 'At your mother-in-law’s: entryphone, two flights and the cava.'],
    },
    lcd: { peso: 'WEIGHT (kg)', piso: 'FLOOR', record: 'BEST', over: 'OVERLOAD' },
    key: 'Level {n}: {name}',
    keyLocked: 'Level {n}, locked',
    locked: 'First, carry up level {n}.',
    go: 'LOAD UP!', goAria: 'Start level {n}: {name}',
    sound: 'Sound', langShort: 'ES', langName: 'Cambiar a español',
    bags: '{n} BAGS',
    hud: {
      pause: 'Pause', honkIn: 'HONK IN', honking: 'HONKING', light: 'LIGHT', dark: 'DARK', lapse: 'RESTING',
      next: 'Coming up', home: 'HOME', m: 'm',
      how: { head: 'HEAD', crouch: 'SQUAT', bum: 'BUM', foot: 'FOOT', nose: 'NOSE', elbow: 'ELBOW' },
      chip: '{what}: {side} hand, {d} m away', chipAny: '{what}: either hand, {d} m away', chipFb: '{what}: no free hand, {how}',
    },
    what: {
      trunk: 'The boot', portal: 'The front door', door: 'The door', call: 'The lift button', floor: 'The floor button',
      light: 'The light switch', liftdoor: 'The lift door', reja: 'The lift gate', intercom: 'The entryphone', bell: 'The doorbell',
    },
    side: { L: 'left', R: 'right' },
    rest: { down: 'PUT DOWN', up: 'PICK UP', load: 'SHARE OUT', aria: { down: 'Put it all down and rest', up: 'Pick it all up again', load: 'Share the bags out for me' } },
    pause: {
      t: 'PAUSED', resume: 'RESUME', restart: 'START AGAIN', quit: 'MAIN MENU',
      keys: '<kbd>←</kbd> <kbd>→</kbd> hands · <kbd>↓</kbd> put down · <kbd>↑</kbd> pick up · <kbd>Esc</kbd> pause',
    },
    res: {
      band: 'WEIGHED AT THE SCALE', lose: 'TWO TRIPS', neto: 'NET WEIGHT', time: 'TIME', par: 'HONKING AT', record: 'NEW BEST!',
      stars: ['ONE TRIP', 'NOTHING BROKEN', 'BEFORE THE HONK'], broken: 'BROKEN', fell: 'DOWN THE STAIRS',
      again: 'PLAY AGAIN', next: 'NEXT', menu: 'MAIN MENU', share: 'SHARE',
      seal: 'CARRIED BY HAND · CARRIED BY HAND · ', sealLose: 'BACK DOWN AGAIN · BACK DOWN AGAIN · ',
      unlocked: 'New on the scale: {name}', photo: 'Your finest moment',
    },
    share: {
      win: 'ONE TRIP! {n} bags, {kg} kg, in {time}.', winBroken: 'ONE TRIP! {n} bags, {kg} kg, in {time}… and something broken on the way.',
      lose: 'TWO TRIPS. The bag of {bag} rolled all the way down the stairs.', dare: 'Could you carry it all in one trip?',
      saved: 'Image saved', copied: 'Text copied', err: 'Couldn’t share',
    },
    tut: {
      park: 'You’re <b>double-parked</b>. Get it all upstairs in one trip before they start honking.',
      loadK: 'Grab the bags: <kbd>←</kbd> with your left hand, <kbd>→</kbd> with your right.',
      loadT: 'Tap left or right: that hand takes the next bag.',
      freeK: '{what} needs your <b>{side}</b> hand. <kbd>{key}</kbd> passes its bags to the other one.',
      freeT: '{what} needs your <b>{side}</b> hand. Tap on the {other} to pass its bags to the other one.',
      fb: 'No free hand? <b>{how}</b>. It works, but it’s slower.',
      fbHow: { head: 'With your head', crouch: 'Squat down', bum: 'With your bum', foot: 'With your foot', nose: 'With your nose', elbow: 'With your elbow' },
      strainK: 'Your fingers are slipping! <kbd>↓</kbd> puts it all on the floor so you can rest.',
      strainT: 'Your fingers are slipping! Tap <b>PUT DOWN</b>: it all goes on the floor and you rest.',
      restK: 'Resting: the clock runs ×4. <kbd>↑</kbd> picks it all up as it was; <kbd>←</kbd> <kbd>→</kbd>, bag by bag.',
      restT: 'Resting: the clock runs ×4. Tap <b>PICK UP</b> to take it all as it was, or the sides, bag by bag.',
      light: 'Timed stair light: it goes off after <b>{s} s</b>. In the dark you climb slower.',
      lift: 'The lift won’t wait: get in in time or the doors close and off it goes.',
      oldlift: 'Old lift: the door and the gate open by hand.',
      buzz: 'When it buzzes, push the door: <b>only {s} s</b>.',
      stairs: 'On the stairs, a dropped bag rolls all the way down. That’s <b>two trips</b>.',
      honk: 'They’re honking! Another honk every {s} s you take.',
    },
  },
};

let lang = 'es';
export const setLang = (l) => { lang = S[l] ? l : 'es'; if (typeof document !== 'undefined') document.documentElement.lang = lang; };
export const getLang = () => lang;
export function t(path, vars) {
  let v = S[lang];
  for (const k of path.split('.')) v = v?.[k];
  if (v === undefined) { v = S.es; for (const k of path.split('.')) v = v?.[k]; }
  return typeof v === 'string' && vars ? fmt(v, vars) : v ?? path;
}
export const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars?.[k] ?? m));
export const detectLang = () => (typeof navigator === 'undefined' || /^es\b/i.test(navigator.language || '') ? 'es' : 'en');
// decimals the way each language writes them
export const num = (v, d = 1) => (lang === 'es' ? v.toFixed(d).replace('.', ',') : v.toFixed(d));
