// Deterministic terrain: seeded value noise over an island archipelago.
// The same seed always builds the same islands, so screenshots are stable.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise from integer lattice points.
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function noise2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx);
  const v = smooth(fz);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 0.5;
}

// Height of the ground (metres above sea level) at world (x, z).
// Islands rise out of the sea; the main island chain runs along +z.
export function groundHeight(x, z, seed) {
  // Broad island mask: a chain of blobs along the flight corridor.
  const chain = Math.exp(-Math.pow((x - 120 * Math.sin(z * 0.0011)) / 420, 2));
  const blob =
    Math.exp(-(Math.pow(x + 260, 2) + Math.pow(z - 900, 2)) / (2 * 260 * 260)) * 0.9 +
    Math.exp(-(Math.pow(x - 320, 2) + Math.pow(z - 1900, 2)) / (2 * 300 * 300)) * 1.0 +
    Math.exp(-(Math.pow(x - 40, 2) + Math.pow(z - 2900, 2)) / (2 * 340 * 340)) * 1.1;
  const mask = Math.max(chain, blob);
  const hills =
    noise2(x * 0.006, z * 0.006, seed) * 0.55 +
    noise2(x * 0.018, z * 0.018, seed + 7) * 0.3 +
    noise2(x * 0.05, z * 0.05, seed + 13) * 0.15;
  let h = (hills * 0.5 + 0.5) * 175 * mask - 14;
  // Flatten the ground where the plane takes off and where it must land,
  // so neither moment starts inside a hill. The runway also gets a flat
  // approach corridor along its centreline.
  h = flattenToward(h, x, z, -40, -160, 240, 6);
  h = flattenCapsule(h, x, z, -40, -160, -8, 520, 230, 8); // departure path
  h = flattenToward(h, x, z, 60, 3050, 680, 18);
  h = flattenCapsule(h, x, z, 60, 2350, 60, 3300, 260, 18);
  return h;
}

function flattenCapsule(h, x, z, ax, az, bx, bz, radius, target) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = ((x - ax) * dx + (z - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const d = Math.hypot(x - (ax + t * dx), z - (az + t * dz));
  if (d >= radius) return h;
  const u = 1 - d / radius;
  const s = u * u * (3 - 2 * u);
  return h * (1 - s) + target * s;
}

function flattenToward(h, x, z, cx, cz, radius, target) {
  const d = Math.hypot(x - cx, z - cz);
  if (d >= radius) return h;
  const t = 1 - d / radius;
  const s = t * t * (3 - 2 * t);
  return h * (1 - s) + target * s;
}

export function isWater(x, z, seed) {
  return groundHeight(x, z, seed) < 0;
}

// Colour of the ground at a point, by height and slope.
export function groundColor(x, z, h, slope, palette) {
  if (h < 1.5) return palette.sand;
  if (h < 34) return shade(palette.grassLow, slope);
  if (h < 78) return shade(palette.grassHigh, slope);
  if (h < 122) return shade(palette.rock, slope);
  return palette.snow;
}

function shade(hex, slope) {
  const f = 1 - Math.min(0.28, Math.max(0, slope) * 0.55);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const to = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${to(r)},${to(g)},${to(b)})`;
}

// Build a deterministic set of clouds for the sky.
export function buildClouds(seed, count) {
  const rand = mulberry32(seed);
  const clouds = [];
  for (let i = 0; i < count; i++) {
    clouds.push({
      x: (rand() - 0.5) * 2400,
      y: 150 + rand() * 130,
      z: rand() * 3600 - 200,
      r: 42 + rand() * 70,
      puffs: 3 + Math.floor(rand() * 3),
      drift: 1.5 + rand() * 2,
    });
  }
  return clouds;
}
