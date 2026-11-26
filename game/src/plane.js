// Flight model: an arcade plane with pitch, roll, throttle and stall.
// Position is metres (x east, z north), y is altitude above sea level.

import { PLANE } from './config.js';
import { groundHeight } from './terrain.js';

export function createPlane(x, z, y, headingDeg) {
  return {
    x,
    z,
    y,
    heading: headingDeg, // degrees, 0 = north (+z)
    pitch: 0, // degrees, + = nose up
    roll: 0, // degrees, + = bank right
    speed: 0, // m/s
    throttle: 0, // 0..1
    verticalSpeed: 0,
    crashed: false,
    landed: false,
    stalled: false,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const deg2rad = (d) => (d * Math.PI) / 180;

// control: { pitch: -1..1 (pull up positive), roll: -1..1 (right positive),
//             throttleDelta: -1..1 } — dt in seconds, wind in m/s (gusts).
export function stepPlane(p, control, dt, seed, wind) {
  if (p.crashed || p.landed) return;

  // Stick response: the plane answers at every speed, sluggish when slow.
  const authority = 0.45 + 0.55 * clamp(p.speed / PLANE.cruiseSpeed, 0, 1);
  p.pitch = clamp(
    p.pitch + control.pitch * PLANE.pitchRate * authority * dt,
    -PLANE.maxPitch,
    PLANE.maxPitch,
  );
  p.roll = clamp(
    p.roll + control.roll * PLANE.rollRate * authority * dt,
    -PLANE.maxRoll,
    PLANE.maxRoll,
  );
  // Stick centres itself: release the keys and the wings level out.
  if (control.roll === 0) p.roll -= p.roll * Math.min(1, 1.6 * dt);
  if (control.pitch === 0) p.pitch -= p.pitch * Math.min(1, 1.1 * dt);

  // Throttle and speed.
  p.throttle = clamp(p.throttle + control.throttleDelta * 0.9 * dt, 0, 1);
  const targetSpeed = p.throttle * PLANE.maxSpeed;
  p.speed += (targetSpeed - p.speed) * Math.min(1, (PLANE.accel / PLANE.maxSpeed) * dt * 3.2);
  if (p.speed < 0) p.speed = 0;

  // A banked turn changes heading; the turn tightens with speed.
  const turnRate = Math.sin(deg2rad(p.roll)) * PLANE.turnFactor * (p.speed / PLANE.cruiseSpeed);
  p.heading = (p.heading + turnRate * 57.2958 * dt + 360) % 360;

  // Stall: below minimum flying speed the nose drops and the plane sinks.
  p.stalled = p.speed < PLANE.minFlySpeed && p.y > groundHeight(p.x, p.z, seed) + 6;
  const pitchEffect = p.stalled ? -14 : p.pitch;
  p.verticalSpeed = Math.sin(deg2rad(pitchEffect)) * p.speed * PLANE.climbFactor;
  if (p.stalled) p.verticalSpeed -= 9;
  p.y += p.verticalSpeed * dt;

  // Move forward along the heading, pushed sideways by wind gusts.
  const hr = deg2rad(p.heading);
  p.x += Math.sin(hr) * p.speed * dt + (wind?.x ?? 0) * dt;
  p.z += Math.cos(hr) * p.speed * dt + (wind?.z ?? 0) * dt;

  // Ground contact.
  const ground = groundHeight(p.x, p.z, seed);
  if (p.y <= ground + 1.2) {
    p.y = ground + 1.2;
    p.crashed = true;
  }
  if (p.y < 1.2) {
    p.y = 1.2;
    p.crashed = true;
  }
}

// Distance from the plane to a point, in metres.
export function distanceTo(p, point) {
  const dx = p.x - point.x;
  const dy = p.y - point.y;
  const dz = p.z - point.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Bearing from the plane to a point, in degrees (0 = north).
export function bearingTo(p, point) {
  return (Math.atan2(point.x - p.x, point.z - p.z) * 180) / Math.PI;
}
