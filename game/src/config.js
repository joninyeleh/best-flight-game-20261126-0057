// Sky Courier — shared tuning constants for the whole game.
// One place for every number that shapes how the plane feels.

export const WORLD = {
  // Size of the terrain patch drawn around the plane (metres).
  viewAhead: 620,
  viewBehind: 60,
  viewHalfWidth: 460,
  gridStep: 26,
  seaLevel: 0,
  // Terrain height range (metres above sea level).
  maxHeight: 170,
};

export const PLANE = {
  maxSpeed: 92, // m/s at full throttle
  cruiseSpeed: 55,
  minFlySpeed: 26, // below this the wing stops flying
  accel: 14, // m/s^2 toward throttle target
  pitchRate: 34, // deg/s at full stick
  rollRate: 80, // deg/s at full stick
  maxPitch: 28,
  maxRoll: 62,
  turnFactor: 0.45, // how much roll turns the heading
  climbFactor: 0.9, // how much pitch becomes vertical speed
  fuelBurn: 0.55, // fuel units per second at full throttle
  fuelRingBonus: 6,
};

export const CAMERA = {
  fovDeg: 68,
  behind: 15, // metres behind the plane
  above: 4.5, // metres above the plane
  lookAhead: 42, // metres ahead of the plane the camera aims at
};

export const VIEW = {
  width: 1280,
  height: 720,
};

export const COLORS = {
  skyTop: '#1c4e9b',
  skyMid: '#5ea4dd',
  skyHorizon: '#cfe8f7',
  seaDeep: '#0f5e8c',
  seaShallow: '#2f8fb8',
  sand: '#e3d191',
  grassLow: '#5d9b4a',
  grassHigh: '#3f7d38',
  rock: '#7a6a58',
  snow: '#f4f7fa',
  runway: '#3a3f46',
  runwayLine: '#f5f0dc',
  ring: '#ffb400',
  ringNext: '#ffcf3d',
  hud: '#eaf6ff',
  hudDim: '#9fc4de',
  hudWarn: '#ff5a4e',
  hudGood: '#7dffa8',
};
