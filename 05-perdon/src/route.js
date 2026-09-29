// The station as the rules see it: a trip is a run of segments laid end to end along z (metres,
// toward the train), over a grid of seven 70 cm lanes. Each segment opens a contiguous band of the
// grid and may carry fixtures: pillars, a row of turnstiles, a stair flight with its centre rail.
// The train waits across the end of the last segment. Shared by the simulation and the renderer.
export const LW = 0.7, NL = 7;
export const OPEN = { corridor: [1, 5], narrow: [2, 4], hall: [0, 6], stairs: [1, 5], platform: [1, 5] };

export class Route {
  constructor(def) {
    this.segs = []; this.pillars = []; this.gates = []; this.rails = []; this.stairs = [];
    let z = 0;
    for (const s of def.segs) {
      const o = { ...s, z0: z, z1: z + s.len, open: s.open || OPEN[s.type] };
      this.segs.push(o);
      if (s.type === 'stairs') { this.stairs.push([o.z0, o.z1]); this.rails.push({ z0: o.z0, z1: o.z1, at: s.rail ?? 2 }); }
      for (const p of s.pillars || []) this.pillars.push({ z: o.z0 + p[0], lane: p[1], len: p[2] || 0.6 });
      if (s.every) for (let k = o.z0 + s.every[0]; k < o.z1 - 2; k += s.every[1]) this.pillars.push({ z: k, lane: s.every[2], len: 0.6 });
      if (s.gates) this.gates.push({ z: o.z0 + s.gates.at, depth: 0.8, lanes: s.gates.lanes });
      z = o.z1;
    }
    this.len = z;
  }
  seg(z) {
    const S = this.segs;
    if (z <= 0) return S[0];
    for (let i = 0; i < S.length; i++) if (z < S[i].z1) return S[i];
    return S[S.length - 1];
  }
  band(z) { return this.seg(z).open; }
  inBand(z, lane) { const b = this.band(z); return lane >= b[0] && lane <= b[1]; }
  gateAt(z) { for (const g of this.gates) if (z >= g.z - 0.05 && z <= g.z + g.depth) return g; return null; }
  // a lane is open at z for someone walking in direction dir (+1 toward the train)
  open(z, lane, dir = 1) {
    if (lane < 0 || lane >= NL || !this.inBand(z, lane)) return false;
    for (const p of this.pillars) if (p.lane === lane && z > p.z - 0.3 && z < p.z + p.len + 0.3) return false;
    const g = this.gateAt(z);
    if (g) { const k = g.lanes[lane]; if (k !== (dir > 0 ? 'in' : 'out') && k !== 'both') return false; }
    return true;
  }
  // the next closed stretch in a lane, looking ahead from z in direction dir (for stalls and funnels)
  blockAhead(z, lane, dir, reach) {
    for (let d = 0.1; d <= reach; d += 0.1) if (!this.open(z + dir * d, lane, dir)) return d;
    return Infinity;
  }
  // stepping sideways across a stair rail or between turnstiles is not possible
  sideBlocked(z, a, b) {
    const lo = Math.min(a, b);
    for (const r of this.rails) if (lo === r.at && z > r.z0 - 0.4 && z < r.z1 + 0.2) return 'rail';
    for (const g of this.gates) if (z > g.z - 0.3 && z < g.z + g.depth + 0.1) return 'gate';
    return null;
  }
  // a unit spanning lanes lo..hi would straddle a stair rail somewhere in [z, z + reach] (dir-wise)
  railAhead(z, lo, hi, dir, reach) {
    for (const r of this.rails) {
      if (!(lo <= r.at && hi > r.at)) continue;
      const d = dir > 0 ? r.z0 - 0.4 - z : z - (r.z1 + 0.2);
      if (d < reach && (d > -0.1 || (z > r.z0 - 0.4 && z < r.z1 + 0.2))) return { d: Math.max(0, d), at: r.at };
    }
    return null;
  }
  speedAt(z) { for (const [a, b] of this.stairs) if (z > a && z < b) return 0.72; return 1; }
  onStairs(z) { for (const [a, b] of this.stairs) if (z > a && z < b) return true; return false; }
}
