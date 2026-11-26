// Missions: three sorties with different goals, fuel and weather.
// Rings are laid out along the flight corridor ahead of the runway strip.

import { groundHeight } from './terrain.js';

export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'RING RUN',
    tagline: 'Thread 8 golden rings over the islands',
    description:
      'Take off from the coast strip and fly through every ring. Each ring pays 100 points and a splash of fuel.',
    rings: 8,
    timeLimit: 200,
    fuel: 100,
    storm: false,
    landToWin: false,
    start: { x: -40, z: -160, y: 60, heading: 8 },
  },
  {
    id: 'island-hop',
    name: 'ISLAND HOP',
    tagline: 'Cross the archipelago and land on the far strip',
    description:
      'Cross the archipelago to the far runway. Mind your fuel and touch down slow, level and gentle — hard landings bend the plane.',
    rings: 4,
    timeLimit: 280,
    fuel: 100,
    storm: false,
    landToWin: true,
    start: { x: -40, z: -160, y: 60, heading: 8 },
  },
  {
    id: 'storm-courier',
    name: 'STORM COURIER',
    tagline: 'Ten rings in a crosswind, mail must fly',
    description:
      'The mail run in bad weather. Gusts shove the plane sideways, the sky is low and grey, and the tank is tight. Ten rings, no excuses.',
    rings: 10,
    timeLimit: 260,
    fuel: 88,
    storm: true,
    landToWin: false,
    start: { x: -40, z: -160, y: 60, heading: 8 },
  },
];

// Lay rings along a gentle S-curve up the corridor, high over the islands.
export function buildRings(mission, seed) {
  const rings = [];
  const n = mission.rings;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    const z = -100 + t * 2900;
    const phase = (seed % 97) * 0.13;
    const x = 120 * Math.sin(z * 0.0011) + 170 * Math.sin(i * 1.7 + phase) * (0.4 + t * 0.6);
    const ground = groundHeight(x, z, seed);
    const y = Math.max(70, ground + 55 + 40 * Math.sin(i * 2.3 + 1));
    rings.push({ x, y, z, r: 26, passed: false, index: i });
  }
  return rings;
}

// The destination strip for landing missions: flat ground north of the chain.
export const RUNWAY = {
  x: 60,
  z: 3050,
  heading: 0, // points north
  length: 420,
  width: 34,
};

export function runwayGroundY(seed) {
  return groundHeight(RUNWAY.x, RUNWAY.z, seed);
}

// Is the plane over the strip, low and slow enough to land?
export function landingCheck(plane, seed) {
  const dx = plane.x - RUNWAY.x;
  const dz = plane.z - RUNWAY.z;
  const along = dz; // runway points north
  const across = dx;
  const ground = runwayGroundY(seed);
  const overStrip = Math.abs(across) < RUNWAY.width / 2 + 6 && Math.abs(along) < RUNWAY.length / 2;
  const low = plane.y - ground < 7;
  const slow = plane.speed < 46;
  const gentle = plane.verticalSpeed > -7;
  const level = Math.abs(plane.roll) < 18 && Math.abs(plane.pitch) < 12;
  return { overStrip, low, slow, gentle, level, ground };
}

export function createRun(mission, seed) {
  return {
    mission,
    rings: buildRings(mission, seed),
    nextRing: 0,
    score: 0,
    fuel: mission.fuel,
    timeLeft: mission.timeLimit,
    timeFlown: 0,
    ringsPassed: 0,
    status: 'flying', // flying | landed | crashed | timeout | out-of-fuel
    message: '',
    bestCombo: 0,
    combo: 0,
  };
}

// Score for passing a ring: base points plus a speed bonus.
export function ringScore(plane) {
  return 100 + Math.round(plane.speed);
}
