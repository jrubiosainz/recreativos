// The games, in the order they were made. Titles, lines and level names come from each game's own
// i18n and README; `save`/`box` point at the localStorage record each game keeps (same origin).
export const GAMES = [
  {
    slug: '01-bostezo', n: 8, save: 'bostezo.v1', box: 'levels',
    es: { t: 'BOSTEZO', line: 'Haz bostezar a tu jefe.', pitch: 'Los bostezos se contagian. Úsalo: que media reunión bostece a la vez y el jefe se duerma sin pillarte.', how: 'Mantén pulsado para bostezar', unit: 'reuniones' },
    en: { t: 'YAWN', line: 'Make your boss yawn.', pitch: 'Yawns are contagious. Use it: get half the meeting yawning at once and put the boss to sleep without getting caught.', how: 'Hold to yawn', unit: 'meetings' },
  },
  {
    slug: '02-que-cierran', n: 8, save: 'quecierran.v1', box: 'levels',
    es: { t: '¡QUE CIERRAN!', line: 'Que no se quede nadie en el andén.', pitch: 'Eres el oshiya del metro de Tokio. Empuja justo en el rebote y mételos a todos antes de que acabe la melodía de la estación.', how: 'Un botón, a ritmo', unit: 'estaciones' },
    en: { t: 'DOORS CLOSING!', line: 'Leave no one on the platform.', pitch: 'You are the oshiya of the Tokyo metro. Push right on the rebound and get everyone in before the station jingle ends.', how: 'One button, on the beat', unit: 'stations' },
  },
  {
    slug: '03-crujido', n: 6, save: 'crujido.v1', box: 'films',
    es: { t: 'CRUJIDO', line: 'Come sin que te oigan.', pitch: 'Un cine de los cincuenta y tu merienda. Muerde solo cuando la película suene más que tú: al tercer «chsst», a la calle.', how: 'Un botón: muerde', unit: 'sesiones' },
    en: { t: 'CRUJIDO', line: 'Eat without being heard.', pitch: 'A 1950s picture house and your snack. Only bite when the film is louder than you: third “shh” and you’re out.', how: 'One button: bite', unit: 'showings' },
  },
  {
    slug: '04-patata', n: 6, save: 'patata.v1', box: 'evs',
    es: { t: '¡PATATA!', line: 'Una foto de familia sin nadie con los ojos cerrados.', pitch: 'El «¡patata!» se dice a coro y, al acabar la palabra, todos parpadean. Dispara después. Tío Paco siempre parpadea.', how: 'Un botón: la cámara', unit: 'fotos' },
    en: { t: '¡PATATA!', line: 'One family photo with nobody’s eyes closed.', pitch: 'They all say “cheese” together and blink the moment the word ends. Shoot just after. Uncle Paco always blinks.', how: 'One button: the camera', unit: 'photos' },
  },
  {
    slug: '05-perdon', n: 6, save: 'perdon.v1', box: 'lv',
    es: { t: 'PERDÓN, PERDÓN', line: 'Cruza la estación sin bailar con nadie.', pitch: 'Todos intentan esquivarte, y por eso acabáis bailando. Mira adónde mira cada uno y apártate al otro lado.', how: 'Izquierda, derecha y «¡perdón!»', unit: 'viajes' },
    en: { t: 'SORRY, SORRY', line: 'Cross the station without dancing with anyone.', pitch: 'Everyone tries to dodge you, which is exactly why you end up dancing. Watch where they look and step the other way.', how: 'Left, right and “sorry!”', unit: 'trips' },
  },
  {
    slug: '06-un-solo-viaje', n: 6, save: 'unsoloviaje.v1', box: 'lv',
    es: { t: 'UN SOLO VIAJE', line: 'Súbelo todo de una vez.', pitch: 'Toda la compra, dos manos y ni un viaje de más. Cada puerta pide una mano libre; si no te queda, con la nariz.', how: 'Una tecla por mano', unit: 'pisos' },
    en: { t: 'ONE TRIP', line: 'Carry it all up in one go.', pitch: 'All the shopping, two hands and not one extra trip. Every door needs a free hand; if you’re out, use your nose.', how: 'One key per hand', unit: 'flats' },
  },
  {
    slug: '07-hipo', n: 6, save: 'hipo.v1', box: 'lv',
    es: { t: 'HIPO', line: 'Aguanta el hipo. Haz la bomba.', pitch: 'Un hipopótamo bebé con hipo en la piscina municipal. No sabe saltar: salta cuando le da el hipo. Del trampolín, hecho una bola.', how: 'Camina y aguanta', unit: 'zonas' },
    en: { t: 'HIPO', line: 'Hold the hiccup. Cannonball.', pitch: 'A baby hippo with hiccups at the municipal pool. He can’t jump; he hops when he hiccups. Off the high board, in a ball.', how: 'Walk and hold your breath', unit: 'pool areas' },
  },
  {
    slug: '08-la-ola', n: 6, save: 'laola.v1', box: 'lv',
    es: { t: 'LA OLA', line: 'Enfoca. Que se levanten.', pitch: 'Minuto 80, 0 a 0. Manejas la pantalla gigante: el que sale en ella se levanta. Que la ola dé vueltas antes del pitido final.', how: 'Apunta y mantén', unit: 'partidos' },
    en: { t: 'LA OLA', line: 'Point the camera. Watch them rise.', pitch: '80th minute, nil-nil. You run the big screen: whoever appears on it stands up. Keep the wave going round before the final whistle.', how: 'Aim and hold', unit: 'matches' },
  },
  {
    slug: '09-la-gota', n: 6, save: 'lagota.v1', box: 'lv',
    es: { t: 'LA GOTA', line: '¡Me pido esa!', pitch: 'Llueve y vas en el bus. Cada uno se pide una gota de la ventanilla: la primera que llegue abajo, gana. Tú le abres camino por el vaho.', how: 'Arrastra el dedo por el vaho', unit: 'trayectos' },
    en: { t: 'LA GOTA', line: 'Dibs on that one!', pitch: 'Rain, and you’re on the bus. Everyone calls dibs on a drop on the window: first one down wins. You clear its path through the fog.', how: 'Drag through the fog', unit: 'rides' },
  },
  {
    slug: '10-gato-con-tostada', n: 6, save: 'gatotostada.v1', box: 'lv',
    es: { t: 'GATO CON TOSTADA', line: 'Si quepo, me siento.', pitch: 'Los gatos caen de pie; las tostadas, del lado de la mermelada. Átale una a un gato y flota. Siéntalo de culo en la caja.', how: 'Gira a un lado o al otro', unit: 'habitaciones' },
    en: { t: 'CAT WITH TOAST', line: 'If I fits, I sits.', pitch: 'Cats land on their feet; toast lands jam side down. Tape one to the other and it hovers. Sit it in the box, bottom first.', how: 'Turn it left or right', unit: 'rooms' },
  },
  {
    slug: '11-a-la-francesa', n: 6, save: 'alafrancesa.v1', box: 'lv',
    es: { t: 'A LA FRANCESA', line: 'Son las 18:00. Vete sin que te vean.', pitch: 'Tu jornada ha terminado y la oficina entera sigue ahí. Baja las seis plantas de puntillas, disimulando. Quien te ve, te mete en una reunión.', how: 'Anda, ve de puntillas o disimula', unit: 'plantas' },
    en: { t: 'FRENCH EXIT', line: 'It’s 6 pm. Leave without being seen.', pitch: 'Your day is done and the whole office is still here. Tiptoe down six floors, looking busy. Whoever sees you drags you into a meeting.', how: 'Walk, tiptoe or look busy', unit: 'floors' },
  },
];

// Stars earned so far in one game, read from its own save. Never throws; a missing or foreign save reads as unplayed.
export function progressOf(g) {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(g.save) || 'null'); } catch { s = null; }
  const recs = s && typeof s === 'object' && s[g.box] && typeof s[g.box] === 'object' ? Object.values(s[g.box]) : [];
  let stars = 0, won = 0, plays = 0;
  for (const r of recs) {
    if (!r || typeof r !== 'object') continue;
    const n = Number.isFinite(r.stars) ? r.stars : Array.isArray(r.set) ? r.set.filter(Boolean).length : 0;
    stars += Math.max(0, Math.min(3, n));
    if (r.won || n > 0) won++;
    plays += Number.isFinite(r.plays) ? r.plays : 1;
  }
  return { played: plays > 0, plays, stars, won, max: g.n * 3 };
}
