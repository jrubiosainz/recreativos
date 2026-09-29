// The Gyūgyū Line (ぎゅうぎゅう線), inbound, morning rush: one station per level, one train, fuller every stop.
//   fill0   congestion when the train pulls in      target / gold  congestion for the pass stamp / the gold one
//   dwell   seconds of boarding before the melody   melody         length of the departure melody (s)
//   queue   scripted start of the platform queue    mix            weights for the rest of it
//   runners seconds relative to the melody's end when someone sprints for the door
export const LEVELS = [
  {
    id: 's1', code: 'GY01', kanji: '始発', romaji: 'Shihatsu', dep: [7, 31, 0], bg: 'st_shihatsu',
    fill0: 0.9, dwell: 20, melody: 9, target: 1.2, gold: 1.5,
    queue: ['salary', 'office', 'salary', 'salary', 'office', 'salary'], mix: { salary: 3, office: 2 },
  },
  {
    id: 's2', code: 'GY02', kanji: '朝霧', romaji: 'Asagiri', dep: [7, 36, 30], bg: 'st_asagiri',
    fill0: 1.0, dwell: 21, melody: 9, target: 1.38, gold: 1.62,
    queue: ['student', 'salary', 'student', 'kid', 'student', 'office'], mix: { student: 4, salary: 2, office: 2, kid: 1 },
  },
  {
    id: 's3', code: 'GY03', kanji: '雨宮', romaji: 'Amemiya', dep: [7, 42, 15], bg: 'st_amemiya',
    fill0: 1.08, dwell: 22, melody: 9, target: 1.46, gold: 1.74,
    queue: ['salary', 'tourist', 'office', 'tourist', 'student', 'salary', 'tourist'], mix: { tourist: 3, salary: 3, office: 2, student: 2 },
  },
  {
    id: 's4', code: 'GY04', kanji: '桜坂', romaji: 'Sakurazaka', dep: [7, 48, 0], bg: 'st_sakurazaka',
    fill0: 1.12, dwell: 24, melody: 10, target: 1.52, gold: 1.7,
    queue: ['office', 'granny', 'salary', 'cake', 'student', 'granny', 'office', 'cake'], mix: { salary: 3, office: 3, student: 2, cake: 1, granny: 1 },
  },
  {
    id: 's5', code: 'GY05', kanji: '相撲町', romaji: 'Sumōchō', dep: [7, 54, 45], bg: 'st_sumocho',
    fill0: 1.18, dwell: 24, melody: 10, target: 1.66, gold: 1.86,
    queue: ['salary', 'sumo', 'office', 'student', 'sumo', 'salary', 'kid', 'sumo'], mix: { salary: 3, sumo: 2, office: 2, student: 1, kid: 1 },
  },
  {
    id: 's6', code: 'GY06', kanji: '遅延', romaji: 'Chien', dep: [8, 1, 30], bg: 'st_chien',
    fill0: 1.3, dwell: 15, melody: 8, target: 1.62, gold: 1.8, runners: [-3.5, 0.4],
    queue: ['office', 'salary', 'tourist', 'sleepy', 'salary', 'office'], mix: { salary: 3, office: 3, sleepy: 2, tourist: 1 },
  },
  {
    id: 's7', code: 'GY07', kanji: '乗換', romaji: 'Norikae', dep: [8, 8, 15], bg: 'st_norikae',
    fill0: 1.32, dwell: 25, melody: 10, target: 1.84, gold: 2.02, runners: [0.6],
    queue: ['salary', 'sleepy', 'mascot', 'tourist', 'granny', 'cake', 'student', 'mascot'], mix: { salary: 3, office: 2, sleepy: 1, tourist: 1, student: 1, cake: 1, mascot: 1 },
  },
  {
    id: 's8', code: 'GY08', kanji: '新押込', romaji: 'Shin-Oshikomi', dep: [8, 15, 0], bg: 'st_shinoshikomi',
    fill0: 1.4, dwell: 27, melody: 11, target: 2.0, gold: 2.2, runners: [-2.2, 0.5],
    queue: ['sumo', 'salary', 'tourist', 'granny', 'cake', 'sleepy', 'mascot', 'office', 'sumo', 'student'],
    mix: { salary: 4, office: 3, student: 2, tourist: 2, sleepy: 1, cake: 1, granny: 1, sumo: 1, mascot: 1, kid: 1 },
  },
];

export const levelById = (id) => LEVELS.find((L) => L.id === id) || null;

// the service each departure runs as: the departure board's type tag and the HUD's board say the same
export const SERVICE = {
  local: { jp: '普通', es: 'LOCAL', en: 'LOCAL', col: '#4d5566' },
  rapid: { jp: '快速', es: 'RÁPIDO', en: 'RAPID', col: '#c2540a' },
  express: { jp: '急行', es: 'EXPRÉS', en: 'EXPRESS', col: '#d63a26' },
  ltd: { jp: '特急', es: 'EXP. LTD.', en: 'LTD. EXP.', col: '#2f64b1' },
  commuter: { jp: '通快', es: 'HORA PUNTA', en: 'COMMUTER', col: '#9b3fb5' },
};
const SVC = { s1: 'local', s2: 'local', s3: 'rapid', s4: 'rapid', s5: 'express', s6: 'express', s7: 'ltd', s8: 'commuter' };
export const serviceOf = (L) => ({ key: SVC[L.id] || 'local', ...(SERVICE[SVC[L.id]] || SERVICE.local) });
