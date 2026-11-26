// Deterministic screenshot states, driven by ?shot= in the URL.
// ?shot=start  title screen
// ?shot=play   mid-flight, lining up the first ring
// ?shot=rings  close on a ring, gates glowing
// ?shot=land   final approach to the runway
// &freeze=N pauses the simulation after N frames so the shot is stable.

export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    freeze: Number(q.get('freeze') || 0),
    seed: Number(q.get('seed') || 20261126),
  };
}

// Place the plane and run for a screenshot moment. Returns the mission index.
export function applyShot(game, params) {
  const shot = params.shot;
  if (!shot) return 0;
  if (shot === 'start') {
    game.screen = 'title';
    return 0;
  }
  const missionIndex = shot === 'land' ? 1 : shot === 'rings' ? 2 : 0;
  game.startMission(missionIndex);
  const plane = game.plane;
  const run = game.run;
  if (shot === 'play') {
    // Climbing toward the first ring, throttle high, wings level.
    plane.x = -30;
    plane.z = 60;
    plane.y = 150;
    plane.heading = 6;
    plane.speed = 62;
    plane.throttle = 0.8;
    plane.pitch = 4;
  } else if (shot === 'rings') {
    // Right on top of ring 3, storm weather, banking through it.
    const ring = run.rings[2];
    plane.x = ring.x - 60;
    plane.z = ring.z - 150;
    plane.y = ring.y + 4;
    plane.heading = 2;
    plane.speed = 66;
    plane.throttle = 0.85;
    plane.roll = -18;
    run.ringsPassed = 2;
    run.nextRing = 2;
    run.score = 248;
  } else if (shot === 'land') {
    // Short final: lined up with the strip, gear down in spirit, slow.
    plane.x = 58;
    plane.z = 2620;
    plane.y = 58;
    plane.heading = 0;
    plane.speed = 40;
    plane.throttle = 0.35;
    plane.pitch = -3;
  }
  game.frame = 0;
  game.freezeAfter = params.freeze;
  return missionIndex;
}
