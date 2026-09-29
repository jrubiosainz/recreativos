// All UI text. Voice-line captions come from the audio manifest; Japanese on the canvas stays Japanese.
const S = {
  es: {
    title: '¡QUE CIERRAN!', tagline: 'Que no se quede nadie en el andén.',
    sub: 'Eres el <b>oshiya</b>, el empujador oficial del metro de Tokio.',
    play: 'Jugar', cont: 'Continuar', stations: 'Estaciones', sound: 'Sonido', lang: 'English', retry: 'Otra vez',
    next: 'Siguiente estación', share: 'Compartir', menu: 'Menú', resume: 'Seguir empujando', restart: 'Reiniciar',
    quit: 'Salir al menú', paused: 'Pausa', back: 'Volver', loading: 'Llegando a la estación…', locked: 'Bloqueada',
    hint: 'Un solo botón: <kbd>ESPACIO</kbd> o clic.', hintTouch: 'Un solo botón: toca la pantalla.',
    about: 'Voces: Azure OpenAI TTS · Estaciones: GPT-image · Música y sonido sintetizados en directo · Hecho a mano con Canvas 2D',
    connecting: 'Preparando el andén… {p}%',
    line: 'Línea Gyūgyū', lineNote: '<span lang="ja">ぎゅうぎゅう</span> (gyū-gyū): apretados como sardinas.',
    board: { title: 'Próximas salidas', time: 'Hora', train: 'Tren', dest: 'Estación', stamps: 'Sellos', next: 'PRÓXIMO', locked: 'Cerrada', rally: 'Sellos' },
    lv: {
      s1: 'Primer tren', s2: 'Niebla matinal', s3: 'Santuario de la lluvia', s4: 'Cuesta de los cerezos',
      s5: 'Barrio del sumo', s6: 'Retraso', s7: 'Transbordo', s8: 'Nuevo Empujón',
    },
    brief: {
      ticket: 'Billete de andén', train: 'Tren', dep: 'Salida', target: 'Objetivo', time: 'Tiempo',
      targetText: 'Llena el vagón al <b>{n}%</b> antes de que cierren las puertas.',
      goldText: 'Al <b>{n}%</b>, sello de oro.',
      timeText: '{d} s de embarque + {m} s de melodía de salida',
      go: '¡A empujar!', news: 'Nuevo en el andén', runnersNote: 'Hoy llega gente <b>corriendo</b> en el último segundo.',
      controls: 'Un botón para todo: <b>llamar</b>, <b>empujar</b> y <b>señalar</b>.',
      finale: '<b>Hora punta total.</b> Todos a la vez, y el vagón ya llega a reventar.',
      melody: 'Melodía', listen: 'Escuchar la melodía de salida', muted: 'El sonido está desactivado.',
    },
    // each station's own departure melody (発車メロディ), and the two real tunes that announce a train
    mel: {
      s1: 'Amanecer', s2: 'Puente en la niebla', s3: 'Gotas de lluvia', s4: 'Balsa de pétalos',
      s5: 'Tambor de llamada', s6: 'Cuenta atrás', s7: 'Paso de transbordo', s8: 'Fanfarria de fin de línea',
      arr: {
        s1: 'El tren llega con <span lang="ja">鉄道唱歌</span> (Tetsudō Shōka, 1900), la melodía de llegada del Shinkansen de Hokuriku.',
        s4: 'El tren llega con <span lang="ja">さくらさくら</span> (Sakura Sakura), canción tradicional.',
      },
    },
    types: {
      salary: { n: 'Oficinistas', d: 'El pan de cada día. Rebotan con buen ritmo.' },
      student: { n: 'Estudiantes', d: 'Mochila a la espalda y rebote rápido. No pierdas el ritmo.' },
      kid: { n: 'Niños', d: 'Pequeñitos y ligeros: entran con nada. Ocupan poquito.' },
      tourist: { n: 'Turistas', d: 'Con maleta: rebotan rapidísimo, cuestan más y ocupan casi el doble.' },
      granny: { n: 'La abuela', d: '<b>Ni se te ocurra empujarla.</b> Entra sola, a su ritmo. Tú, quieto.' },
      cake: { n: 'El de la tarta', d: 'Solo empujones <b>perfectos</b>. Uno regular y la tarta acaba hecha papilla.' },
      sumo: { n: 'Luchadores de sumo', d: 'Pesadísimos: rebote lento y muchos empujones. Pero llenan por dos.' },
      sleepy: { n: 'El dormido', d: 'Se tambalea y su ritmo cambia sin avisar. Fíate del <b>tic</b>, no de tus ojos.' },
      runner: { n: 'El que llega corriendo', d: 'Aparece con las puertas cerrándose. Si el hueco está libre, se lanza: <b>remátalo</b>.' },
      mascot: { n: 'La mascota', d: 'Un disfraz gigante y blandito. Rebota lento y ocupa muchísimo.' },
    },
    hud: {
      load: 'ocupación', arrive: 'llegando', board: 'embarque', melody: 'melodía de salida', closing: 'cierre de puertas',
      pointTap: 'toca: ¡señala!', pointKey: 'espacio: ¡señala!', depart: 'salida', next: 'sig.',
      approach: 'Melodía de llegada', appr: { s1: 'Tetsudō Shōka (1900)', s4: 'Sakura Sakura (tradicional)' },
    },
    fx: {
      perfect: '¡PERFECTO!', good: 'BIEN', late: 'TARDE', bump: '¡PRONTO!',
      sorry: { sub: '¡perdón, perdón!' }, point: { sub: 'shuppatsu shinkō: ¡vía libre!' },
    },
    tut: {
      t1: 'Eres el <b>oshiya</b>: tu trabajo es meter a todo el mundo en el tren.',
      t2: 'Pulsa <kbd>ESPACIO</kbd> para <b>llamar</b> al primero de la cola.',
      t2Touch: '<b>Toca</b> la pantalla para llamar al primero de la cola.',
      t3: 'Mientras hay sitio, entran solos. <b>Llama al siguiente.</b>',
      t4: '¡Ya no cabe! Rebota contra la gente. Empuja <b>justo cuando llega a tus guantes</b>: suena un <b>tic</b>.',
      t5: '¡Muy <b>pronto</b>! Aún venía hacia ti. Espera al <b>tic</b>.',
      t6: 'Un pelín <b>tarde</b>. Empuja <b>en el tic</b>, cuando se para en tus guantes.',
      t7: '¡Eso es! Cada empujón a tiempo lo mete más. <b>Sigue el ritmo.</b>',
      t8: '¡Dentro! Ahora tú solo: <b>llena el vagón</b> antes de que cierren las puertas.',
      t9: 'Suena la <b>melodía de salida</b>. Cuando acabe, se cierran las puertas.',
      t10: 'Puertas cerradas. <b>Señala y grita</b> para dar la salida: pulsa <kbd>ESPACIO</kbd>.',
      t10Touch: 'Puertas cerradas. <b>Señala y grita</b> para dar la salida: toca la pantalla.',
      combo: '¡Combo! Varios <b>perfectos</b> seguidos empujan todavía más.',
    },
    res: {
      pass: '¡Salida puntual!', late: 'Salida con retraso', fail: 'Se han quedado en el andén', gold: '¡Lleno hasta la bandera!',
      passSub: 'El vagón sale al <b>{fill}%</b>. Ni un alfiler más.',
      goldSub: 'El vagón sale al <b>{fill}%</b> y a su hora. Ya no cabe ni el aire.',
      lateSub: 'Lo has metido todo… pero el tren ha salido <b>{s} s</b> tarde. En Tokio, eso es noticia.',
      failSub: 'El tren sale al <b>{fill}%</b> y hacía falta un <b>{target}%</b>. Esa gente llegará tarde al trabajo.',
      load: 'Ocupación', target: 'objetivo {n}%', delay: 'Retraso', onTime: 'Puntual', combo: 'Mejor combo',
      boarded: 'Han subido', perfects: 'Perfectos', incidents: 'Incidentes', best: 'récord {n}%', newBest: '¡Récord!',
      star1: 'Objetivo {n}%', star2: 'Puntual', star3: 'Oro {n}%',
      stamp: 'Sello de estación', left: '乗り残し', leftSub: 'Gente en el andén', goldBand: 'Lleno total',
      allLine: 'Fin de línea',
    },
    cert: {
      title: 'Certificado de retraso',
      body: 'Se certifica que el tren <b>{code}</b> de las <b>{time}</b> salió de la estación de <b>{st}</b> con un retraso de <b>{s} segundos</b>.',
      cause: 'Motivo', note: 'Presente este certificado en su empresa. Rogamos disculpen las molestias.', master: 'Jefe de estación',
    },
    cause: {
      salary: 'un oficinista que no cabía', office: 'una oficinista atascada', student: 'un estudiante encajado con su mochila',
      tourist: 'un turista y su maleta', sumo: 'un luchador de sumo', granny: 'una abuela (muy digna)', cake: 'una tarta de cumpleaños',
      sleepy: 'un pasajero dormido de pie', runner: 'uno que llegó corriendo', mascot: 'una mascota gigante', kid: 'un niño', none: 'causas ajenas a la compañía',
    },
    done: {
      title: '¡Sellos completos!', jp: 'スタンプラリー達成',
      sub: 'Has sellado las ocho estaciones de la línea Gyūgyū. Tokio llega a trabajar gracias a ti.',
      text: 'Los <b>oshiya</b> existen de verdad: en hora punta, empujan con guantes blancos para que las puertas cierren. Ahora ya sabes lo que se siente.',
      stars: 'Sellos',
    },
    shareText: {
      pass: '🚃 He llenado un tren de Tokio al {fill}% en {st}. ¿Cabe alguien más? #QueCierran',
      gold: '🚃 He llenado un tren de Tokio al {fill}% en {st}, y salió puntual. ¿Metes a alguien más? #QueCierran',
      late: '🚃 Mi tren salió {s} s tarde por culpa de {cause}. Tengo el certificado oficial. #QueCierran',
      fail: '🚃 Se me ha quedado media estación en el andén de {st}. ¿Tú lo harías mejor? #QueCierran',
      done: '🚃 He completado la línea Gyūgyū de ¡QUE CIERRAN!: {n}/{m} sellos. #QueCierran',
    },
    shareCard: { load: 'ocupación', dare: '¿Cabe alguien más?', dareGold: '¿Metes más del {fill}%?', dareLate: 'Disculpen las molestias.', dareFail: '¿Tú lo harías mejor?' },
    copied: '¡Copiado!', shareBoth: 'Imagen descargada y texto copiado', shareDown: 'Imagen descargada', shareErr: 'No se ha podido compartir',
  },
  en: {
    title: 'DOORS CLOSING!', tagline: 'Leave no one on the platform.',
    sub: 'You are the <b>oshiya</b>, the official train pusher of the Tokyo rush hour.',
    play: 'Play', cont: 'Continue', stations: 'Stations', sound: 'Sound', lang: 'Español', retry: 'Try again',
    next: 'Next station', share: 'Share', menu: 'Menu', resume: 'Keep pushing', restart: 'Restart',
    quit: 'Quit to menu', paused: 'Paused', back: 'Back', loading: 'Pulling into the station…', locked: 'Locked',
    hint: 'One button: <kbd>SPACE</kbd> or click.', hintTouch: 'One button: tap the screen.',
    about: 'Voices: Azure OpenAI TTS · Stations: GPT-image · Music and sound synthesised live · Hand-made with Canvas 2D',
    connecting: 'Preparing the platform… {p}%',
    line: 'Gyūgyū Line', lineNote: '<span lang="ja">ぎゅうぎゅう</span> (gyū-gyū): packed like sardines.',
    board: { title: 'Departures', time: 'Time', train: 'Train', dest: 'Station', stamps: 'Stamps', next: 'NEXT', locked: 'Locked', rally: 'Stamps' },
    lv: {
      s1: 'First Train', s2: 'Morning Mist', s3: 'Rain Shrine', s4: 'Cherry Slope',
      s5: 'Sumo Town', s6: 'Delay', s7: 'Transfer', s8: 'New Push-In',
    },
    brief: {
      ticket: 'Platform ticket', train: 'Train', dep: 'Departs', target: 'Target', time: 'Time',
      targetText: 'Pack the car to <b>{n}%</b> before the doors close.',
      goldText: 'At <b>{n}%</b>, the gold stamp.',
      timeText: '{d} s of boarding + a {m} s departure melody',
      go: 'Start pushing!', news: 'New on the platform', runnersNote: 'Today people come <b>running</b> at the last second.',
      controls: 'One button for everything: <b>call</b>, <b>push</b> and <b>point</b>.',
      finale: '<b>Peak rush hour.</b> Everyone at once, and the car arrives already bursting.',
      melody: 'Melody', listen: 'Play the departure melody', muted: 'Sound is off.',
    },
    mel: {
      s1: 'Daybreak', s2: 'Bridge in the Mist', s3: 'Raindrops', s4: 'Petal Raft',
      s5: 'Gathering Drum', s6: 'Countdown', s7: 'Transfer Step', s8: 'End-of-the-Line Fanfare',
      arr: {
        s1: 'The train pulls in to <span lang="ja">鉄道唱歌</span> (Tetsudō Shōka, 1900), the approach melody of the Hokuriku Shinkansen.',
        s4: 'The train pulls in to <span lang="ja">さくらさくら</span> (Sakura Sakura), a traditional song.',
      },
    },
    types: {
      salary: { n: 'Office workers', d: 'Your daily bread. They bounce with a steady rhythm.' },
      student: { n: 'Students', d: 'Backpacks on, quick bounce. Don\'t lose the beat.' },
      kid: { n: 'Kids', d: 'Tiny and light: they slip in with barely a push. Take up hardly any room.' },
      tourist: { n: 'Tourists', d: 'With suitcases: they bounce really fast, take more work and fill almost double.' },
      granny: { n: 'Grandma', d: '<b>Don\'t you dare push her.</b> She gets on by herself, at her own pace. Hands off.' },
      cake: { n: 'The cake guy', d: '<b>Perfect</b> pushes only. One sloppy push and the cake is mush.' },
      sumo: { n: 'Sumo wrestlers', d: 'Super heavy: slow bounce, lots of pushes. But each one fills like two.' },
      sleepy: { n: 'The sleeper', d: 'He sways, and his rhythm drifts without warning. Trust the <b>tick</b>, not your eyes.' },
      runner: { n: 'The last-second runner', d: 'Shows up as the doors are closing. If the doorway is free he dives in: <b>finish the job</b>.' },
      mascot: { n: 'The mascot', d: 'A giant, squishy costume. Slow bounce, takes up loads of room.' },
    },
    hud: {
      load: 'load', arrive: 'arriving', board: 'boarding', melody: 'departure melody', closing: 'doors closing',
      pointTap: 'tap: point!', pointKey: 'space: point!', depart: 'departed', next: 'next',
      approach: 'Approach melody', appr: { s1: 'Tetsudō Shōka (1900)', s4: 'Sakura Sakura (traditional)' },
    },
    fx: {
      perfect: 'PERFECT!', good: 'GOOD', late: 'LATE', bump: 'EARLY!',
      sorry: { sub: 'so sorry!' }, point: { sub: 'shuppatsu shinkō: all clear!' },
    },
    tut: {
      t1: 'You are the <b>oshiya</b>: your job is to get everyone onto the train.',
      t2: 'Press <kbd>SPACE</kbd> to <b>call</b> the first person in line.',
      t2Touch: '<b>Tap</b> the screen to call the first person in line.',
      t3: 'While there\'s room, they walk in on their own. <b>Call the next one.</b>',
      t4: 'Full! He bounces off the crowd. Push <b>right as he lands in your gloves</b>: you\'ll hear a <b>tick</b>.',
      t5: 'Too <b>early</b>! He was still coming at you. Wait for the <b>tick</b>.',
      t6: 'A touch <b>late</b>. Push <b>on the tick</b>, when he stops in your gloves.',
      t7: 'That\'s it! Every push on time sends him deeper. <b>Keep the rhythm.</b>',
      t8: 'In! Now it\'s all you: <b>pack the car</b> before the doors close.',
      t9: 'That\'s the <b>departure melody</b>. When it ends, the doors close.',
      t10: 'Doors shut. <b>Point and call</b> to send the train off: press <kbd>SPACE</kbd>.',
      t10Touch: 'Doors shut. <b>Point and call</b> to send the train off: tap the screen.',
      combo: 'Combo! <b>Perfect</b> pushes in a row hit even harder.',
    },
    res: {
      pass: 'On-time departure!', late: 'Late departure', fail: 'Left on the platform', gold: 'Packed to the rafters!',
      passSub: 'The car leaves at <b>{fill}%</b>. Not one more pin.',
      goldSub: 'The car leaves at <b>{fill}%</b>, right on time. Not even air fits in there.',
      lateSub: 'You got them all in… but the train left <b>{s} s</b> late. In Tokyo, that makes the news.',
      failSub: 'The train leaves at <b>{fill}%</b> and it needed <b>{target}%</b>. Those people will be late for work.',
      load: 'Load', target: 'target {n}%', delay: 'Delay', onTime: 'On time', combo: 'Best combo',
      boarded: 'Boarded', perfects: 'Perfects', incidents: 'Incidents', best: 'best {n}%', newBest: 'New best!',
      star1: 'Target {n}%', star2: 'On time', star3: 'Gold {n}%',
      stamp: 'Station stamp', left: '乗り残し', leftSub: 'Left on the platform', goldBand: 'Full house',
      allLine: 'End of the line',
    },
    cert: {
      title: 'Delay certificate',
      body: 'This is to certify that train <b>{code}</b>, scheduled for <b>{time}</b>, departed <b>{st}</b> station <b>{s} seconds</b> late.',
      cause: 'Cause', note: 'Please present this certificate to your employer. We sincerely apologise for the inconvenience.', master: 'Station master',
    },
    cause: {
      salary: 'an office worker who would not fit', office: 'an office worker who got stuck', student: 'a student wedged in by his backpack',
      tourist: 'a tourist and his suitcase', sumo: 'a sumo wrestler', granny: 'a (very dignified) grandmother', cake: 'a birthday cake',
      sleepy: 'a passenger asleep on his feet', runner: 'a last-second runner', mascot: 'a giant mascot', kid: 'a small child', none: 'circumstances beyond our control',
    },
    done: {
      title: 'Stamp rally complete!', jp: 'スタンプラリー達成',
      sub: 'You stamped all eight stations of the Gyūgyū Line. Tokyo gets to work thanks to you.',
      text: '<b>Oshiya</b> are real: at rush hour they push with white gloves so the doors can close. Now you know how it feels.',
      stars: 'Stamps',
    },
    shareText: {
      pass: '🚃 I packed a Tokyo train to {fill}% at {st}. Room for one more? #DoorsClosing',
      gold: '🚃 I packed a Tokyo train to {fill}% at {st}, and it left on time. Can you fit more? #DoorsClosing',
      late: '🚃 My train left {s} s late because of {cause}. I have the official certificate. #DoorsClosing',
      fail: '🚃 I left half of {st} station on the platform. Think you can do better? #DoorsClosing',
      done: '🚃 I finished the Gyūgyū Line in DOORS CLOSING!: {n}/{m} stamps. #DoorsClosing',
    },
    shareCard: { load: 'load', dare: 'Room for one more?', dareGold: 'Can you fit more than {fill}%?', dareLate: 'We apologise for the inconvenience.', dareFail: 'Think you can do better?' },
    copied: 'Copied!', shareBoth: 'Image downloaded and text copied', shareDown: 'Image downloaded', shareErr: 'Could not share',
  },
};

let lang = 'es';
export function setLang(l) { lang = S[l] ? l : 'es'; document.documentElement.lang = lang; }
export function getLang() { return lang; }
export function detectLang() { const n = (navigator.language || 'es').toLowerCase(); return /^(es|ca|gl|eu)/.test(n) ? 'es' : 'en'; }
const dig = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function t(path, vars) {
  let v = dig(S[lang], path);
  if (v == null) v = dig(S.es, path);
  if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return v ?? path;
}
// for the canvas modules: plain text only, with their own fallback (usually the Japanese original)
export function tc(path, fallback) { const v = t(path); return typeof v === 'string' && v !== path ? v.replace(/<[^>]+>/g, '') : fallback ?? path; }
// numbers the way each language writes them
export function num(n, d = 1) { return n.toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }); }
