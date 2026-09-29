// All text that is not a voice line (those come with their captions in assets/lines.json).
const S = {
  es: {
    title: 'CRUJIDO', tagline: 'Come sin que te oigan',
    boot: 'Abriendo la taquilla…', sound: 'Sonido', lang: 'Language: English', langShort: 'EN', pauseBtn: 'Intermedio',
    sessions: 'SESIONES DE HOY', times: ['17:00', '18:15', '19:30', '20:45', '22:00', '23:30'],
    genre: { accion: 'Acción', romance: 'Romance', terror: 'Terror', musical: 'Musical', documental: 'Documental', autor: 'Cine de autor' },
    buy: 'COMPRAR ENTRADA', lockedToast: 'Antes, termínate la sesión de las {time}.',
    combo: { trueno: '12 palomitas', lluvia: '8 patatas fritas', casa: '6 nachos', claque: '12 caramelos', planeta: '8 kikos', silencio: 'palomitas, hielo y caramelos' },
    hint: {
      trueno: 'Cada explosión es tu oportunidad.', lluvia: 'A tu lado, alguien aguanta un estornudo…',
      casa: 'Silencios eternos. Tu amiga grita en cada susto.', claque: 'Musical: el claqué marca el compás.',
      planeta: 'Tu vecino ronca. No lo despiertes.', silencio: 'Cine mudo. El director está en la sala.',
    },
    ticket: {
      cinema: 'CINE CRUJIDO', street: 'Gran Vía · Madrid', session: 'Sesión', hall: 'Sala', row: 'Fila', seat: 'Butaca',
      combo: 'Tu merienda', rules: 'Muerde solo cuando la peli suene fuerte: si las luces pasan la <b>flecha</b>, nadie te oye. Si te oyen, te chistan. Al tercer «chsst», a la calle.',
      enter: 'ENTRAR A LA SALA', back: 'Volver a la taquilla', loading: 'Rebobinando la película… {p} %', admit: 'VÁLIDA PARA UNA PERSONA',
    },
    goals: ['Cómetelo todo', 'Sin un solo «chsst»', 'Que nadie te oiga'],
    pause: { title: 'INTERMEDIO', resume: 'Seguir viendo', restart: 'Empezar de nuevo', quit: 'Volver a la taquilla' },
    result: {
      full3: '¡Ni se han enterado!', full: '¡Te lo has comido todo!', expelled: '¡A la calle!', hungry: 'Se encienden las luces…',
      subFull: 'Merienda terminada en «{film}».', subExpelled: 'El acomodador te ha acompañado a la salida.', subHungry: '…y te has quedado con hambre ({ate} de {total}).',
      ate: 'Bocados', heard: 'Crujidos oídos', shushes: 'Chistidos', hidden: 'Tapados', next: 'Siguiente sesión', needPass: 'Las estrellas solo cuentan si te acabas la merienda.', retry: 'Repetir', menu: 'Taquilla', share: 'Compartir',
      last: 'Última sesión: ¡ciclo completo!', done: 'Fin del ciclo',
    },
    stamp: { full3: '¡NI SE HAN ENTERADO!', full: '¡TODO COMIDO!', expelled: '¡EXPULSADO!', hungry: '¡CON HAMBRE!' },
    card: { film: 'Ruido de la peli', hid: 'Tapado', heard: 'Oído', shush: 'chsst', url: 'Juega gratis en el navegador',
    },
    done: { title: 'FIN DEL CICLO', sub: 'Has visto las seis películas sin soltar la merienda.', stars: '{n} de {m} estrellas', share: 'Compartir', menu: 'Taquilla' },
    shareText: {
      full3: 'He visto «{film}» comiendo {combo} y nadie se ha enterado. ★★★ ¿Te atreves? #CRUJIDO',
      full: 'Me he comido {combo} en «{film}» y solo me han oído {h} veces. ¿Lo haces mejor? #CRUJIDO',
      expelled: 'Me han echado del cine por comer {snack} en «{film}» 🙊 #CRUJIDO',
      hungry: 'Se acabó «{film}» y me quedé con hambre ({ate}/{total}). ¿Tú te lo comes todo? #CRUJIDO',
      done: 'He completado el ciclo de CRUJIDO: {n}/{m} estrellas 🍿 #CRUJIDO',
    },
    copied: 'Texto copiado', shareBoth: 'Imagen guardada y texto copiado', shareDown: 'Imagen guardada', shareErr: 'No se ha podido compartir',
    tut: {
      meter: 'Si las luces pasan la <b>flecha</b>, la peli tapa tu ruido. <b>{how}</b>', tap: '¡Toca para morder!', key: '¡Pulsa <kbd>Espacio</kbd> para morder!',
      good: '¡Así! Sigue masticando mientras suene fuerte.', heard: '¡Te han oído! Espera a que las luces pasen la flecha.',
      stop: 'Ahora no… la peli se ha quedado callada.', shush: 'Al tercer «chsst», el acomodador te echa.',
      piece: 'Cada bocado son varios mordiscos. ¡Cómetelo todo antes del FIN!',
    },
    presents: 'presenta', end: 'FIN', endQ: '¿FIN?',
    f6_card_title: 'SILENCIO', f6_card_day: 'Al día siguiente...', f6_card_letter: 'Querida Marta:\nel faro no se apaga.', f6_card_end: 'Y el mar calló.',
    films: { trueno: 'OPERACIÓN TRUENO', lluvia: 'AMOR BAJO LA LLUVIA', casa: 'LA CASA CALLADA', claque: 'ZAPATOS DE CLAQUÉ', planeta: 'PLANETA SALVAJE', silencio: 'SILENCIO' },
    cc: {
      applause: 'Aplausos', aww: 'El público: «oooh»', beeps: 'Pitidos', boom: '¡BUM!', booms: 'Explosiones', chorus: 'Coro',
      clock: 'Tic, tac', creak: 'Cruje la madera', engines: 'Motores', foghorn: 'Sirena de niebla', fuse: 'Chisporrotea la mecha',
      horn: 'Bocinazo', laugh: 'Risas en la sala', orchestra: 'Orquesta', ovation: 'Ovación', owl: 'Un búho', roar: 'Rugido',
      rock: 'Rock and roll', rotor: 'Helicóptero', scream: 'Gritos', silence: 'Silencio', stinger: '¡Golpe de violines!',
      stoptime: 'La orquesta para en seco', strings: 'Violines', strings_love: 'Violines románticos', taps: 'Claqué',
      theme: 'Tema principal', thunder: 'Trueno', train: 'Tren', trumpet: 'Trompeta', waterfall: 'Catarata', waves: 'Olas',
      whistle: 'Silbato del tren', whistle_fan: 'Tu vecino silba la melodía',
    },
    word: { palomitas: 'crac', nachos: 'cronch', patatas: 'cruj', caramelo: 'cris', kikos: 'croc', hielo: '¡CRAAC!', cough: '¡cof!', rustle: 'frusss' },
    snack: { palomitas: 'palomitas', nachos: 'nachos', patatas: 'patatas', caramelo: 'caramelos', kikos: 'kikos', hielo: 'hielo' },
  },
  en: {
    title: 'CRUJIDO', tagline: 'Eat without being heard',
    boot: 'Opening the box office…', sound: 'Sound', lang: 'Idioma: español', langShort: 'ES', pauseBtn: 'Intermission',
    sessions: "TODAY'S SHOWINGS", times: ['5:00', '6:15', '7:30', '8:45', '10:00', '11:30'],
    genre: { accion: 'Action', romance: 'Romance', terror: 'Horror', musical: 'Musical', documental: 'Documentary', autor: 'Art house' },
    buy: 'BUY TICKET', lockedToast: 'Finish the {time} showing first.',
    combo: { trueno: '12 bits of popcorn', lluvia: '8 crisps', casa: '6 nachos', claque: '12 sweets', planeta: '8 corn nuts', silencio: 'popcorn, ice and sweets' },
    hint: {
      trueno: 'Every explosion is your chance.', lluvia: 'Next to you, someone is holding in a sneeze…',
      casa: 'Endless silences. Your friend screams at every scare.', claque: 'A musical: the tap dancing keeps the beat.',
      planeta: "Your neighbour is snoring. Don't wake him.", silencio: 'A silent film. The director is in the room.',
    },
    ticket: {
      cinema: 'CINE CRUJIDO', street: 'Gran Vía · Madrid', session: 'Showing', hall: 'Screen', row: 'Row', seat: 'Seat',
      combo: 'Your snack', rules: 'Only bite while the film is loud: when the lights pass the <b>arrow</b>, nobody hears you. If they hear you, they shush you. Third shush and you are out.',
      enter: 'TAKE YOUR SEAT', back: 'Back to the box office', loading: 'Rewinding the reel… {p}%', admit: 'ADMIT ONE',
    },
    goals: ['Eat it all', 'Not a single shush', 'Nobody hears a thing'],
    pause: { title: 'INTERMISSION', resume: 'Keep watching', restart: 'Start over', quit: 'Back to the box office' },
    result: {
      full3: 'They never heard a thing!', full: 'You ate the lot!', expelled: "You're out!", hungry: 'The lights come up…',
      subFull: 'Snack finished during “{film}”.', subExpelled: 'The usher has shown you the way out.', subHungry: "…and you're still hungry ({ate} of {total}).",
      ate: 'Eaten', heard: 'Crunches heard', shushes: 'Shushes', hidden: 'Covered', next: 'Next showing', needPass: 'Stars only count if you finish your snack.', retry: 'Try again', menu: 'Box office', share: 'Share',
      last: 'Last showing: season complete!', done: 'Season finale',
    },
    stamp: { full3: 'NOT A SOUND!', full: 'ALL EATEN!', expelled: 'THROWN OUT!', hungry: 'STILL HUNGRY!' },
    card: { film: 'Film noise', hid: 'Covered', heard: 'Heard', shush: 'shh', url: 'Free to play in your browser',
    },
    done: { title: 'SEASON COMPLETE', sub: 'You sat through all six films without dropping your snack.', stars: '{n} of {m} stars', share: 'Share', menu: 'Box office' },
    shareText: {
      full3: 'I watched “{film}” eating {combo} and nobody noticed. ★★★ Dare you? #CRUJIDO',
      full: 'I ate {combo} during “{film}” and got heard only {h} times. Beat that? #CRUJIDO',
      expelled: 'I got thrown out of the cinema for eating {snack} during “{film}” 🙊 #CRUJIDO',
      hungry: '“{film}” ended and I was still hungry ({ate}/{total}). Can you finish yours? #CRUJIDO',
      done: 'I finished the CRUJIDO season: {n}/{m} stars 🍿 #CRUJIDO',
    },
    copied: 'Text copied', shareBoth: 'Image saved and text copied', shareDown: 'Image saved', shareErr: "Couldn't share",
    tut: {
      meter: 'When the lights pass the <b>arrow</b>, the film covers your noise. <b>{how}</b>', tap: 'Tap to bite!', key: 'Press <kbd>Space</kbd> to bite!',
      good: "That's it! Keep chewing while it's loud.", heard: 'They heard you! Wait for the lights to pass the arrow.',
      stop: 'Not now… the film has gone quiet.', shush: 'Third shush and the usher throws you out.',
      piece: 'Each piece takes a few bites. Finish it all before THE END!',
    },
    presents: 'presents', end: 'THE END', endQ: 'THE END?',
    f6_card_title: 'SILENCE', f6_card_day: 'The next day...', f6_card_letter: 'Dearest Martha:\nthe light never goes out.', f6_card_end: 'And the sea fell silent.',
    films: { trueno: 'OPERATION THUNDER', lluvia: 'LOVE IN THE RAIN', casa: 'THE QUIET HOUSE', claque: 'TAP SHOES', planeta: 'WILD PLANET', silencio: 'SILENCE' },
    cc: {
      applause: 'Applause', aww: 'Audience: "aww"', beeps: 'Beeping', boom: 'BOOM!', booms: 'Explosions', chorus: 'Choir',
      clock: 'Tick, tock', creak: 'Wood creaks', engines: 'Engines', foghorn: 'Foghorn', fuse: 'Fuse fizzing',
      horn: 'Horn blares', laugh: 'The audience laughs', orchestra: 'Orchestra', ovation: 'Standing ovation', owl: 'An owl', roar: 'Roar',
      rock: 'Rock and roll', rotor: 'Helicopter', scream: 'Screams', silence: 'Silence', stinger: 'Strings sting!',
      stoptime: 'The band stops dead', strings: 'Strings', strings_love: 'Romantic strings', taps: 'Tap dancing',
      theme: 'Main theme', thunder: 'Thunder', train: 'Train', trumpet: 'Trumpet', waterfall: 'Waterfall', waves: 'Waves',
      whistle: 'Train whistle', whistle_fan: 'Your neighbour whistles along',
    },
    word: { palomitas: 'crack', nachos: 'crunch', patatas: 'crisp', caramelo: 'crinkle', kikos: 'crock', hielo: 'CRAACK!', cough: 'cough!', rustle: 'rustle' },
    snack: { palomitas: 'popcorn', nachos: 'nachos', patatas: 'crisps', caramelo: 'sweets', kikos: 'corn nuts', hielo: 'ice' },
  },
};

let lang = 'es';
export const setLang = (l) => { lang = S[l] ? l : 'es'; };
export const getLang = () => lang;
export function t(path, vars) {
  let v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), S[lang]);
  if (v == null) v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), S.es);
  if (v == null) return path;
  if (vars && typeof v === 'string') v = v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return v;
}
// what a screen card / caption key says
export const tr = (key) => (key.startsWith('cc_') ? t('cc.' + key.slice(3)) : t(key));
// the painted word for a noise of yours
export const word = (kind, snack) => (kind === 'cough' || kind === 'rustle' ? t('word.' + kind) : t('word.' + snack));
export const detectLang = () => ((typeof navigator !== 'undefined' && /^es\b/i.test(navigator.language || '')) || typeof navigator === 'undefined' ? 'es' : 'en');
