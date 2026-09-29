// Every string in the game. The voice lines are the `say` keys (assets/manifest.json carries the
// recordings); the station's own lettering (posters, signs, name plates) is `world`.
const S = {
  es: {
    world: {
      station: 'PLAZA DEL RELOJ', dest: 'Correderas',
      posters: ['SIN PRISA,|PERO|SIN PAUSA', '¿VAS O|VIENES?', 'PERDONE LAS|MOLESTIAS', 'DEJE SALIR|ANTES DE|ENTRAR'],
      signs: [
        { lines: ['A', 'C'], to: 'Correderas' }, { lines: ['B'], to: 'Los Tilos' },
        { lines: ['D'], to: 'Puente Nuevo' }, { lines: ['A', 'D'], to: 'Alameda Sur' },
      ],
    },
    say: {
      ask: '¡Perdón!', askNone: '¿Perdón?', bumpYou: '¡Ay! ¡Perdón, perdón!', bumpPhone: '¿Eh? Ah… perdón',
      bumpRunner: '¡Perdona, perdona!', bumpTourist: 'Oh, pardon!', bumpThem: '¡Perdón!', brush: '¡Uy, perdón!',
      d1: '¡Perdón!', d2: 'Perdón, perdón…', d3: '¿Bailamos?', d3you: 'Perdón, perdón, perdón', part: 'Un placer',
      aside: 'Perdona', granny: '¡Ay, hija, qué prisas!', cant: 'No puedo, perdona', tuck: 'Venga, pasa',
      split: '¡Uy, perdón!', wait: 'Pasa, pasa', runner: '¡Perdona, perdona!', missed: '¡Espere!', ole: '¡Olé!',
    },
    // the station's public address (recorded; the HUD captions it)
    pa: {
      next: 'Próximo tren con destino Correderas: efectuará su salida en breve. Disculpen las molestias.',
      last: 'Atención: el tren con destino Correderas va a efectuar su salida.',
      missed: 'El próximo tren con destino Correderas llegará en cuarenta minutos. Disculpen las molestias.',
    },
    // ---- the ticket, the validator, the trip and what comes after ----
    title: 'PERDÓN, PERDÓN',
    tagline: 'Cruza la estación sin bailar con nadie',
    hook: 'Todos intentan esquivarte. Por eso acabáis bailando.',
    fine: ['TARJETA DE TRANSPORTE|METROPOLITANO', 'VÁLIDA PARA|6 VIAJES', 'CONSERVE ESTA TARJETA|HASTA EL FINAL DE SU USO', 'NO ES REEMBOLSABLE|NI TRANSFERIBLE'],
    trips: 'Tus seis viajes',
    go: 'Entrar al viaje {n}: {name}',
    enter: 'ENTRAR', validate: 'VALIDAR',
    locked: 'Antes, coge el tren del viaje {n}',
    sound: 'Sonido', langName: 'Switch to English', langShort: 'EN',
    rumbas: 'Rumbas', rumbaOf: 'Rumba con {who}', rumbaNone: 'Aún sin rumba con {who}',
    loading: 'Buscando el billete…',
    canvas: 'La estación: el pasillo, la gente que viene de frente y tú, con el chubasquero amarillo',
    trip: {
      transbordo: ['Transbordo', 'El pasillo entre la línea A y la C'],
      vestibulo: ['Vestíbulo', 'Acaba de llegar un tren'],
      tornos: ['Tornos', 'La entrada, billete en mano'],
      escaleras: ['Escaleras', 'Dos tramos de escalera'],
      anden: ['Andén', 'Todo el mundo esperando su tren'],
      punta: ['Hora punta', 'Todo a la vez'],
    },
    brief: {
      trip: 'VIAJE {n} DE 6', leg: 'VIAJE', now: 'SON LAS', dep: 'SALE A LAS',
      meet: 'Hoy en la estación', none: 'Todo lo que ya conoces, a la vez. Y el tren no espera.',
      goals: 'Tres estrellas', g: ['Coge el tren', 'Como mucho {n} perdones', 'Llega con {n} s de sobra'],
      back: 'Volver', wait: 'Un momento…', ok: 'VÁLIDO · BUEN VIAJE',
    },
    intro: {
      polite: ['Los educados', 'Miran a un lado y se apartan por ahí. Tú, por el otro.'],
      slow: ['Los que van sin prisa', 'Van en tu sentido, a su ritmo. Pídeles paso.'],
      askK: ['¡Perdón!', 'Con <kbd>↑</kbd> o <kbd>Espacio</kbd> pides paso a quien tengas delante.'],
      askT: ['¡Perdón!', 'Toca tu chubasquero y pides paso a quien tengas delante.'],
      zombie: ['El del móvil', 'Ni te ve ni te oye. Rodéalo con tiempo.'],
      espejo: ['El indeciso', 'Te copia cada paso. Amaga, deja que se mueva y cambia.'],
      wave: ['Llega un tren', 'De golpe, medio pasillo viene de frente.'],
      gate: ['Los tornos', 'Entra por los de la flecha verde. Los del aspa roja son de salida.'],
      granny: ['La abuela del carro', 'Tarda en apartarse y el carro va detrás. Pídeselo con tiempo.'],
      tourist: ['El turista', 'Se aparta al revés que los demás. Y la maleta va detrás.'],
      couple: ['La pareja', 'Van de la mano y no se sueltan… salvo que les pidas perdón.'],
      stairs: ['Las escaleras', 'Aquí todo el mundo va más despacio. Tú también.'],
      groupCo: ['Los amigos', 'Tres de frente, a su ritmo. Pide paso y te abren hueco.'],
      group: ['El grupo', 'Un muro de tres que viene hacia ti. Pide perdón y te hacen sitio.'],
      runner: ['La que corre', 'Viene por detrás gritando «¡perdona!». No te pongas en su carril.'],
    },
    hud: { leaves: 'SALE EN', perdones: 'PERDONES', par: 'máx. {n}', pause: 'Pausa', clock: 'Hora' },
    pause: { t: 'Pausa', resume: 'Seguir', restart: 'Empezar de nuevo', quit: 'Volver al billete', keys: '<kbd>←</kbd> <kbd>→</kbd> apartarte · <kbd>↑</kbd> ¡perdón! · <kbd>Esc</kbd> pausa' },
    tut: {
      moveK: '<kbd>←</kbd> <kbd>→</kbd> para apartarte',
      moveT: 'Toca a un lado para apartarte',
      look: 'Mira adónde mira: ahí va a pisar. <b>Tú, al otro lado.</b>',
      dance: '¡Os habéis cruzado! Si le sigues, <b>bailáis</b>. Quieto: ya se aparta.',
      askK: 'Pide paso: <kbd>↑</kbd> o <kbd>Espacio</kbd>',
      askT: 'Pide paso: toca tu chubasquero',
    },
    res: {
      caught: '¡Tren cogido!', missed: 'Se ha ido sin ti',
      spare: 'con {s} s de sobra', tight: 'por los pelos', later: 'el próximo, en 40 minutos',
      one: 'perdón', many: 'perdones', best: 'Récord: {n}',
      dance: 'Tu baile más largo', rumba: '¡Rumba!', clean: 'Ni un baile',
      stars: ['Tren', 'Máx. {n} perdones', '{n} s de sobra'],
      again: 'JUGAR OTRA VEZ', home: 'VOLVER AL BILLETE', next: 'SIGUIENTE VIAJE', share: 'COMPARTIR',
      newRumba: '¡Rumba con {who}! Llevas {n} de 3', unlocked: 'Viaje {n} desbloqueado',
    },
    who: { polite: 'un educado', tourist: 'un turista', espejo: 'un indeciso' },
    share: {
      rumba: 'Me he marcado una rumba en el metro con un desconocido.',
      caught: 'He cogido el tren pidiendo perdón {n} veces. ¿Y tú?',
      zero: 'He cruzado la estación sin pedir perdón ni una vez.',
      missed: 'He perdido el tren de tanto pedir perdón ({n} veces).',
      dare: '¿Cruzas tú sin bailar con nadie?',
      saved: 'Imagen guardada', copied: 'Texto copiado', err: 'No se ha podido compartir',
    },
  },
  en: {
    world: {
      station: 'PLAZA DEL RELOJ', dest: 'Correderas',
      posters: ['NO RUSH,|BUT|NO PAUSE', 'COMING OR|GOING?', 'SORRY FOR THE|INCONVENIENCE', 'LET THEM OFF|BEFORE YOU|GET ON'],
      signs: [
        { lines: ['A', 'C'], to: 'Correderas' }, { lines: ['B'], to: 'Los Tilos' },
        { lines: ['D'], to: 'Puente Nuevo' }, { lines: ['A', 'D'], to: 'Alameda Sur' },
      ],
    },
    say: {
      ask: 'Sorry!', askNone: 'Sorry?', bumpYou: 'Ow! Sorry, sorry!', bumpPhone: 'Huh? Oh… sorry',
      bumpRunner: 'Sorry, sorry!', bumpTourist: 'Oh, pardon!', bumpThem: 'Sorry!', brush: 'Oops, sorry!',
      d1: 'Sorry!', d2: 'Sorry, sorry…', d3: 'Shall we dance?', d3you: 'Sorry, sorry, sorry', part: 'A pleasure',
      aside: 'Sorry', granny: 'Oh, what a hurry!', cant: 'Can\'t, sorry', tuck: 'Go on, squeeze by',
      split: 'Oops, sorry!', wait: 'After you', runner: 'Sorry, sorry!', missed: 'Wait!', ole: '¡Olé!',
    },
    pa: {
      next: 'The next train to Correderas will depart shortly. We apologise for any inconvenience.',
      last: 'Attention please: the train to Correderas is about to depart.',
      missed: 'The next train to Correderas will arrive in forty minutes. We apologise for any inconvenience.',
    },
    title: 'SORRY, SORRY',
    tagline: 'Cross the station without dancing with anyone',
    hook: 'Everyone tries to dodge you. That is why you end up dancing.',
    fine: ['METROPOLITAN|TRANSPORT CARD', 'VALID FOR|6 TRIPS', 'KEEP THIS CARD|UNTIL ITS LAST TRIP', 'NON-REFUNDABLE|NON-TRANSFERABLE'],
    trips: 'Your six trips',
    go: 'Way in to trip {n}: {name}',
    enter: 'WAY IN', validate: 'VALIDATE',
    locked: 'Catch the train on trip {n} first',
    sound: 'Sound', langName: 'Cambiar a español', langShort: 'ES',
    rumbas: 'Rumbas', rumbaOf: 'Rumba with {who}', rumbaNone: 'No rumba with {who} yet',
    loading: 'Finding your ticket…',
    canvas: 'The station: the corridor, the people coming towards you, and you in the yellow raincoat',
    trip: {
      transbordo: ['Transfer', 'The corridor between lines A and C'],
      vestibulo: ['Concourse', 'A train has just pulled in'],
      tornos: ['Turnstiles', 'The way in, ticket in hand'],
      escaleras: ['Stairs', 'Two flights of stairs'],
      anden: ['Platform', 'Everyone waiting for their train'],
      punta: ['Rush hour', 'Everything at once'],
    },
    brief: {
      trip: 'TRIP {n} OF 6', leg: 'TRIP', now: 'TIME', dep: 'LEAVES AT',
      meet: 'In the station today', none: 'Everything you have met, all at once. And the train will not wait.',
      goals: 'Three stars', g: ['Catch the train', 'At most {n} sorries', 'Arrive {n} s early'],
      back: 'Back', wait: 'One moment…', ok: 'VALID · HAVE A GOOD TRIP',
    },
    intro: {
      polite: ['The polite ones', 'They glance to one side and step that way. You take the other.'],
      slow: ['The strollers', 'Going your way, at their own pace. Ask to get by.'],
      askK: ['Sorry!', '<kbd>↑</kbd> or <kbd>Space</kbd> asks whoever is in front to let you by.'],
      askT: ['Sorry!', 'Tap your raincoat to ask whoever is in front to let you by.'],
      zombie: ['The phone zombie', 'Cannot see you, cannot hear you. Go round, early.'],
      espejo: ['The mirror', 'Copies every step you take. Feint, let them move, then switch.'],
      wave: ['A train pulls in', 'Suddenly half the corridor is coming at you.'],
      gate: ['The turnstiles', 'Go in through the green arrows. The red crosses are the way out.'],
      granny: ['Granny and her trolley', 'Slow to step aside, and the trolley trails behind. Ask early.'],
      tourist: ['The tourist', 'Steps aside the other way from everyone else. The suitcase follows.'],
      couple: ['The couple', 'Holding hands and not letting go… unless you say sorry.'],
      stairs: ['The stairs', 'Everyone slows down here. You too.'],
      groupCo: ['The friends', 'Three abreast, at their own pace. Ask and they make a gap.'],
      group: ['The group', 'A wall of three coming at you. Say sorry and they make room.'],
      runner: ['The runner', 'Comes from behind shouting “sorry!”. Stay out of their lane.'],
    },
    hud: { leaves: 'LEAVES IN', perdones: 'SORRIES', par: 'max {n}', pause: 'Pause', clock: 'Time' },
    pause: { t: 'Paused', resume: 'Resume', restart: 'Start again', quit: 'Back to the ticket', keys: '<kbd>←</kbd> <kbd>→</kbd> step aside · <kbd>↑</kbd> sorry! · <kbd>Esc</kbd> pause' },
    tut: {
      moveK: '<kbd>←</kbd> <kbd>→</kbd> to step aside',
      moveT: 'Tap to one side to step aside',
      look: 'Watch where they look: that is where they will step. <b>You go the other way.</b>',
      dance: 'You mirrored each other! Follow them and you <b>dance</b>. Stay put: they will step aside.',
      askK: 'Ask to get by: <kbd>↑</kbd> or <kbd>Space</kbd>',
      askT: 'Ask to get by: tap your raincoat',
    },
    res: {
      caught: 'Train caught!', missed: 'It left without you',
      spare: 'with {s} s to spare', tight: 'by a whisker', later: 'the next one is in 40 minutes',
      one: 'sorry', many: 'sorries', best: 'Best: {n}',
      dance: 'Your longest dance', rumba: 'Rumba!', clean: 'Not a single dance',
      stars: ['Train', 'Max {n} sorries', '{n} s early'],
      again: 'PLAY AGAIN', home: 'BACK TO THE TICKET', next: 'NEXT TRIP', share: 'SHARE',
      newRumba: 'Rumba with {who}! That is {n} of 3', unlocked: 'Trip {n} unlocked',
    },
    who: { polite: 'a polite one', tourist: 'a tourist', espejo: 'a mirror' },
    share: {
      rumba: 'I just danced a rumba with a stranger in the metro.',
      caught: 'I caught the train saying sorry {n} times. How about you?',
      zero: 'I crossed the whole station without saying sorry once.',
      missed: 'I missed the train from saying sorry too much ({n} times).',
      dare: 'Can you get across without dancing with anyone?',
      saved: 'Image saved', copied: 'Text copied', err: 'Could not share',
    },
  },
};
let lang = 'es';
export const setLang = (l) => { lang = S[l] ? l : 'es'; if (typeof document !== 'undefined') document.documentElement.lang = lang; };
export const getLang = () => lang;
export function t(path, vars) {
  let v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), S[lang]);
  if (v == null) v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), S.es);
  if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return v ?? path;
}
export const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars?.[k] ?? m));
// what the scene needs: the station's lettering and what people say
export const worldText = () => ({ ...t('world'), say: t('say') });
export const detectLang = () => (typeof navigator === 'undefined' || /^es\b/i.test(navigator.language || '') ? 'es' : 'en');
export const LANGS = S;
