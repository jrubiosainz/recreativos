// Passenger archetypes. Physics is in normalised units: u = 0 resting against the crowd, u = 1 fully past
// the door line. Each boarding passenger is a bouncing oscillator: the crowd behind him is the spring, his
// will to board is the "gravity" that brings him back. You pump that bounce like a swing.
//   T     swing period at 100 % congestion (s)          us    where he leaves the crowd on the rebound
//   N     perfect pushes' worth of energy at 100 %      zeta  damping ratio
//   fill  congestion he adds (fraction of capacity)     w     shoulder width (m), depth (m) front-to-back
//   step  time to walk from the queue into the doorway
export const TYPES = {
  salary: { T: 0.92, us: -0.62, N: 2.2, zeta: 0.018, fill: 0.07, w: 0.5, depth: 0.3, step: 0.5 },
  office: { T: 0.86, us: -0.6, N: 2.0, zeta: 0.018, fill: 0.06, w: 0.44, depth: 0.28, step: 0.5 },
  student: { T: 0.8, us: -0.56, N: 2.0, zeta: 0.018, fill: 0.065, w: 0.46, depth: 0.38, step: 0.46 },
  tourist: { T: 0.6, us: -0.34, N: 2.6, zeta: 0.02, fill: 0.09, w: 0.56, depth: 0.58, step: 0.62 },
  sumo: { T: 1.45, us: -0.92, N: 3.0, zeta: 0.012, fill: 0.16, w: 0.8, depth: 0.56, step: 0.8 },
  granny: { rule: 'nopush', board: 2.6, fill: 0.04, w: 0.42, depth: 0.26, step: 0.9 },
  cake: { T: 0.95, us: -0.62, N: 2.2, zeta: 0.018, fill: 0.07, w: 0.5, depth: 0.32, step: 0.52, rule: 'perfect' },
  sleepy: { T: 1.08, us: -0.5, N: 2.2, zeta: 0.006, fill: 0.07, w: 0.5, depth: 0.3, step: 0.6, wobble: 0.07 },
  runner: { T: 0.78, us: -0.5, N: 2.0, zeta: 0.02, fill: 0.07, w: 0.5, depth: 0.3, step: 0.42, e0: 0.82 },
  mascot: { T: 1.25, us: -0.82, N: 2.6, zeta: 0.014, fill: 0.12, w: 0.74, depth: 0.7, step: 0.75 },
  kid: { T: 0.66, us: -0.5, N: 1.1, zeta: 0.02, fill: 0.03, w: 0.34, depth: 0.2, step: 0.4 },
};

// how the crowd stiffens as the car fills: faster swings, more energy needed
export const crowdScale = (fill) => {
  const over = Math.max(0, fill - 1);
  return { omega: 1 + 0.42 * over, need: 1 + 0.62 * over };
};
