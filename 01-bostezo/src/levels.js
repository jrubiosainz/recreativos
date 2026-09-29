// The eight meetings of the week. Row 0 is the front row (closest to the boss).
// n normal · P player · i intern (loud) · f phone addict (blind) · c coffee (immune until the cup is empty)
// s sleeper (psst to wake: huge loud yawn) · p teacher's pet (snitches)
const calm = (dur) => [['fwd', dur], ['L', 1.5], ['fwd', 4.2], ['R', 1.4], ['fwd', 5], ['down', 1.4], ['fwd', 3.4], ['back', 1.3]];

export const LEVELS = [
  {
    id: 'l1', day: 0, hour: 9, min: 0, room: 'room_small', title: 'l1', rows: ['nPn', 'nnn'],
    K: 2, target: 10, time: 100, chainGoal: 5, tutorial: 'basic',
    boss: { intro: 3.4, pattern: [[6.5, 4], [6, 3.5], [7, 4], [5.5, 3.5]] },
    gaze: { '1,0': calm(14), '1,1': calm(15), '1,2': calm(13.5) },
  },
  {
    id: 'l2', day: 0, hour: 12, min: 30, room: 'room_small', title: 'l2', rows: ['nnPn', 'ninf'],
    K: 3, target: 18, time: 110, chainGoal: 6, tutorial: 'psst', news: ['intern', 'phone', 'psst'],
    boss: { intro: 3, pattern: [[6.5, 4], [5.5, 3.5], [7, 4], [6, 3]] },
  },
  {
    id: 'l3', day: 1, hour: 10, min: 0, room: 'room_training', title: 'l3', rows: ['nnnn', 'nnfn', 'nPnn'],
    K: 3, target: 20, time: 110, chainGoal: 6, news: ['back'],
    boss: { intro: 3, pattern: [[6, 4], [5, 3.5], [6.5, 4], [5.5, 3]] },
  },
  {
    id: 'l4', day: 2, hour: 11, min: 0, room: 'room_training', title: 'l4', rows: ['nnpnn', 'nnnin', 'fnPnn'],
    K: 3, target: 26, time: 120, chainGoal: 8, news: ['pelota'],
    boss: { intro: 3, pattern: [[6, 4], [5.5, 3.5], [6.5, 4], [5, 3]] },
  },
  {
    id: 'l5', day: 3, hour: 16, min: 55, room: 'room_evening', title: 'l5', rows: ['cnsn', 'nPnc', 'snnn'],
    K: 3, target: 24, time: 120, chainGoal: 7, news: ['coffee', 'sleeper'],
    boss: { intro: 3, pattern: [[6, 4], [5.5, 3.5], [6.5, 4], [5, 3.5]] },
  },
  {
    id: 'l6', day: 4, hour: 9, min: 30, room: 'room_auditorium', title: 'l6', stagger: true,
    rows: ['nnnnnn', 'nnfnnn', 'nnPnnc', 'ninnpn'],
    K: 4, target: 36, time: 140, chainGoal: 11, news: ['big'],
    boss: { intro: 3, pattern: [[6, 4.2], [5.5, 3.6], [6.5, 4.2], [5, 3.4]] },
    rake: 0.34,
  },
  {
    id: 'l7', day: 4, hour: 13, min: 0, room: 'room_training', title: 'l7', rows: ['nnpnnn', 'nnnfnn', 'cnnPnn', 'nnsnin'],
    K: 4, target: 40, time: 140, chainGoal: 12, news: ['glance'],
    boss: { intro: 3, pattern: [[6.5, 4], [6, 3.5], [7, 4], [5.5, 3.5]], glances: [[2, 1.8], [4, 2.2], [6, 2.5]] },
  },
  {
    id: 'l8', day: 4, hour: 17, min: 0, room: 'room_keynote', title: 'l8', stagger: true, ceo: true,
    rows: ['nnnpnnn', 'nnfnnnc', 'ninnPnn', 'nnsnnfn', 'cnnnnin'],
    K: 6, target: 70, time: 160, chainGoal: 15, news: ['ceo'],
    boss: { intro: 3.4, pattern: [[6.5, 4], [5.5, 3.5], [7, 4], [6, 3.5], [5, 3]], glances: [[1, 2.4], [2, 1.6], [3, 3.2], [5, 2.2], [6, 1.6], [8, 2.6]] },
    rake: 0.42,
  },
];

export const levelById = (id) => LEVELS.find((l) => l.id === id);
