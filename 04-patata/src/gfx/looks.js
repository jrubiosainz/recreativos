// How each García looks on each page of the album, 1996–2001: faces stay, clothes change with the
// occasion, Lucía grows from a communion girl into a teenager with a phone, Dani from a baby in a
// christening gown into a toddler in a sun hat. Colours are the saturated, warm ones of 90s prints.

// the face and hair each person keeps from page to page
const FACE = {
  mama: { sex: 'f', skin: '#f0c29f', hair: 'waves', hc: '#5a3322', eye: '#6b4226', lips: '#c4524c', earring: 'pearl', body: 'woman', arms: 'front' },
  papa: { sex: 'm', skin: '#dca27c', hair: 'dad', hc: '#2e2019', eye: '#4a3020', stache: 'dad', w: 1.03, jaw: 1.1, body: 'man', arms: 'side' },
  lucia: { sex: 'f', skin: '#f3cba9', hair: 'kidlong', hc: '#6a3b22', eye: '#5b3a1e', freckles: true, body: 'kid', arms: 'front' },
  abuela: { sex: 'f', skin: '#ecbd9c', hair: 'perm', hc: '#d8d2da', eye: '#4d3a2a', lips: '#b45a5c', earring: 'gold', old: true, body: 'elderF', arms: 'front' },
  abuelo: { sex: 'm', skin: '#d9a384', hair: 'bald', hc: '#ebe7df', eye: '#3f3226', glasses: true, old: true, ears: 1.3, brow: '#efe9e0', browW: 1.35, w: 1.02, body: 'elderM', arms: 'side' },
  paco: { sex: 'm', skin: '#e4a486', hair: 'curly', hc: '#2b1d17', eye: '#3e2a1c', stache: 'big', nose: 1.35, blush: 1.5, w: 1.08, jaw: 1.2, browW: 1.2, body: 'paco', arms: 'side' },
  mari: { sex: 'f', skin: '#f1c7a3', hair: 'long', hc: '#9c6a36', hc2: '#d9b06e', eye: '#3f5a3a', lips: '#d0605a', body: 'woman', arms: 'front' },
  toni: { sex: 'm', skin: '#d29d7a', hair: 'gel', hc: '#1e1612', eye: '#3a2618', w: 0.98, jaw: 1.15, body: 'man', arms: 'side' },
  encarna: { sex: 'f', skin: '#e9b592', hair: 'bigperm', hc: '#9a3a22', eye: '#4a3020', lips: '#b83a3a', earring: 'hoop', w: 1.02, body: 'woman', arms: 'front' },
  raul: { sex: 'm', skin: '#dfab87', hair: 'curtains', hc: '#3b261a', eye: '#3a2618', w: 0.95, body: 'teen', arms: 'side' },
  kiko: { sex: 'm', skin: '#f3c9a6', hair: 'bowl', hc: '#4a2c1a', eye: '#4a3020', freckles: true, body: 'kid', arms: 'side' },
  you: { sex: 'n', skin: '#e4b18f', hair: 'quiff', hc: '#3a2a20', eye: '#4a3526', body: 'you', arms: 'side' },
  dani: { sex: 'm', skin: '#f7d4bb', hair: 'tuft', hc: '#8a5a34', eye: '#4a3526', body: 'baby', arms: 'none', w: 1.06 },
  bolita: { dog: true, fur: '#f6f1e8', fur2: '#e3d5c0', nose: '#2a1d18' },
};

// what they wear. top: [kind, colour, second colour, pattern]; bottom colour; hat; things they carry
const W = '#f6f2e9';
const PAGES = {
  comunion: {
    abuela: { top: ['dress', '#2b3352', null, null, 'short'], acc: ['pearls', 'brooch'] },
    mama: { top: ['suit', '#2f6f73', '#f4efe4'], bot: '#2f6f73', skirt: true, acc: ['pearls'] },
    lucia: { top: ['communion', W], hat: 'flowers' },
    papa: { top: ['suit', '#676b74', W], tie: '#7a2432', bot: '#676b74' },
  },
  patio: {
    paco: { top: ['shirt', '#e0673a', '#f3d36a', 'hawaii', 'short'], bot: '#d8c8a8' },
    mama: { top: ['blouse', '#f0c24a', '#e0603a', 'floral', 'short'], bot: '#3b5f8a', skirt: true },
    papa: { top: ['shirt', '#a9c4de', '#6f8fb8', 'check', 'short'], bot: '#5a5448' },
    abuela: { top: ['dress', '#9b7fb8', '#f4e8f0', 'floral', 'short'] },
    abuelo: { top: ['shirt', W, null, null, 'short'], acc: ['suspenders'], bot: '#6d6a60', hat: 'party' },
    lucia: { top: ['dress', '#d8453a', W, 'dots', 'none'] },
  },
  playa: {
    paco: { top: ['suit', '#d9c7a1', W], bot: '#d9c7a1', hat: 'shades', open: true },
    mama: { top: ['dress', '#ef7f6a', null, null, 'none', 'v'] },
    toni: { top: ['suit', '#27324d', W], tie: '#c9c3b8', bot: '#27324d', acc: ['flower'] },
    mari: { top: ['bride', W], hat: 'veil', arms: 'bouquet' },
    papa: { top: ['suit', '#e6dcc6', '#a8c8e0'], tie: '#2b4a7a', bot: '#e6dcc6' },
    abuela: { top: ['dress', '#b59ad0', null, null, 'short'], acc: ['fan', 'pearls'] },
    lucia: { top: ['dress', '#f2b6c6', null, null, 'puff'], hat: 'hairflower' },
    abuelo: { top: ['suit', '#cbb58e', W], tie: '#6a4a2a', bot: '#cbb58e', hat: 'straw' },
  },
  salon: {
    paco: { top: ['jumper', '#2f6b3a', '#efe0a8', 'tree'], bot: '#4a4038', hat: 'santa' },
    encarna: { top: ['blouse', '#b8243a', '#f6d880', 'sequin', 'long'], bot: '#222026', skirt: true },
    papa: { top: ['jumper', '#8a6a4a', '#34466a', 'argyle'], bot: '#3c3a36', collar: W },
    mama: { top: ['jumper', '#c23b35', W, 'snow'], bot: '#2e2c30', skirt: true },
    mari: { top: ['blouse', '#6a1f3a', null, null, 'long'], bot: '#1e1c22', skirt: true },
    abuela: { top: ['cardigan', '#8c8a90', '#f0ece2'], acc: ['pearls'], bot: '#4a4650', skirt: true },
    lucia: { top: ['jumper', '#f0ebe0', '#b83a32', 'deer'], bot: '#3a4a70' },
    abuelo: { top: ['cardigan', '#7a5a3a', '#e8e2d2'], bot: '#5a5448' },
    you: { top: ['jumper', '#2a3a66', '#f0e6d0', 'deer'], bot: '#3a3632' },
  },
  bautizo: {
    paco: { top: ['suit', '#2b3450', W], tie: '#e8b83a', bot: '#2b3450' },
    encarna: { top: ['dress', '#c23a7a', null, null, 'short'] },
    toni: { top: ['suit', '#5a5d66', W], tie: '#7a2a3a', bot: '#5a5d66' },
    mari: { top: ['dress', '#f0b8c0', null, null, 'short'], arms: 'hold' },
    dani: { top: ['gown', W], hat: 'bonnet' },
    papa: { top: ['suit', '#2e2b33', W], tie: '#3a5a8a', bot: '#2e2b33' },
    mama: { top: ['suit', '#9cc7a8', '#f4efe4'], bot: '#9cc7a8', skirt: true, acc: ['pearls'] },
    lucia: { top: ['dress', '#a896d0', null, null, 'short'] },
    abuela: { top: ['dress', '#2b3352', null, null, 'short'], acc: ['brooch', 'pearls'] },
    abuelo: { top: ['suit', '#77777a', W], tie: '#6a2a2a', bot: '#77777a' },
    kiko: { top: ['sailor', W, '#23305a'], bot: '#23305a' },
  },
  plaza: {
    paco: { top: ['shirt', W, null, null, 'short'], acc: ['kerchief'], bot: '#f0ece2' },
    encarna: { top: ['dress', '#c8202a', W, 'dots', 'short'], hat: 'carnation', acc: ['fan'] },
    toni: { top: ['shirt', '#3a6a8a', '#8ab0c8', 'check', 'short'], bot: '#d8ceb8' },
    papa: { top: ['polo', '#2b3a5a'], bot: '#c8bca2' },
    mama: { top: ['dress', '#f2c94a', null, null, 'none', 'v'] },
    raul: { top: ['tee', '#7a8aa0'], bot: '#3c4c6c', arms: 'hold' },
    lucia: { top: ['tee', '#f08ab0'], bot: '#4a5c86', hair: 'pony', arms: 'phone' },
    abuela: { top: ['dress', '#221e26', null, null, 'short'], acc: ['fan'] },
    mari: { top: ['dress', '#3aa0a0', null, null, 'none'], arms: 'hold' },
    dani: { top: ['romper', '#f2d64a'], hat: 'sunhat', body: 'toddler', arms: 'side' },
    abuelo: { top: ['shirt', '#e8e0cc', null, null, 'short'], bot: '#6a6458', hat: 'boina' },
    kiko: { top: ['tee', '#2a5ab0', '#f2d03a', 'stripes'], bot: '#1e2a48' },
    bolita: {},
  },
};

const memo = new Map();
export function lookFor(ev, id) {
  const key = ev.id + ':' + id;
  if (memo.has(key)) return memo.get(key);
  const f = FACE[id], p = (PAGES[ev.id] || {})[id] || {};
  const L = { id, ...f, ...p };
  if (!f.dog) {
    const [kind, c, c2, pat, sleeve, neck] = p.top || ['tee', '#888'];
    L.top = { kind, c, c2, pat, sleeve: sleeve || (kind === 'suit' || kind === 'jumper' || kind === 'cardigan' ? 'long' : 'short'), neck: neck || 'round' };
    L.acc = p.acc || [];
    // Lucía grows up: a teenager's face and body by the fiestas of 2001
    if (id === 'lucia' && ev.date[0] >= 2001) { L.body = 'teen'; L.age = 'teen'; }
    L.age ||= f.old ? 'old' : L.body === 'kid' ? 'kid' : L.body === 'baby' ? 'baby' : L.body === 'toddler' ? 'toddler' : 'adult';
  }
  memo.set(key, L);
  return L;
}
