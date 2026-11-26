// Renderer: a pseudo-3D chase view drawn on one 2D canvas.
// Sky, sun, clouds, a projected island heightfield, rings, runway and the
// plane itself, all from code — no images, no network.

import { WORLD, CAMERA, COLORS } from './config.js';
import { groundHeight, groundColor } from './terrain.js';

const deg2rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function makeCamera(plane, storm) {
  const hr = deg2rad(plane.heading);
  // Camera sits behind and above the plane, looking slightly down its nose.
  const fx = Math.sin(hr);
  const fz = Math.cos(hr);
  const pos = {
    x: plane.x - fx * CAMERA.behind,
    y: plane.y + CAMERA.above,
    z: plane.z - fz * CAMERA.behind,
  };
  // The camera pitches with the plane, but only half as much, so the view
  // stays calm while the nose moves.
  const pitch = deg2rad(plane.pitch * 0.55);
  const fwd = {
    x: fx * Math.cos(pitch),
    y: Math.sin(pitch),
    z: fz * Math.cos(pitch),
  };
  // Right = fwd x worldUp, normalised; up = fwd x right (right-handed).
  let right = { x: fwd.z, y: 0, z: -fwd.x };
  const rl = Math.hypot(right.x, right.z) || 1;
  right = { x: right.x / rl, y: 0, z: right.z / rl };
  const up = {
    x: fwd.y * right.z - fwd.z * right.y,
    y: fwd.z * right.x - fwd.x * right.z,
    z: fwd.x * right.y - fwd.y * right.x,
  };
  return { pos, fwd, right, up, pitch };
}

function project(cam, focal, cx, cy, p) {
  const dx = p.x - cam.pos.x;
  const dy = p.y - cam.pos.y;
  const dz = p.z - cam.pos.z;
  const xc = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
  const yc = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;
  const zc = dx * cam.fwd.x + dy * cam.fwd.y + dz * cam.fwd.z;
  if (zc < 2) return null;
  return { x: cx + (focal * xc) / zc, y: cy - (focal * yc) / zc, d: zc };
}

function drawSky(ctx, w, h, cam, focal, cy, storm, time) {
  const horizonY = cy - focal * Math.tan(cam.pitch);
  const top = storm ? '#5c6b7d' : COLORS.skyTop;
  const mid = storm ? '#7d8b9b' : COLORS.skyMid;
  const hor = storm ? '#a9b4bd' : COLORS.skyHorizon;
  const g = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, hor);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, Math.max(horizonY, 1));
  // Sea below the horizon: the terrain mesh covers the near part, this is
  // the far band where the mesh ends.
  const sea = ctx.createLinearGradient(0, horizonY, 0, h);
  sea.addColorStop(0, storm ? '#4d6478' : COLORS.seaShallow);
  sea.addColorStop(1, storm ? '#33505f' : COLORS.seaDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, Math.max(horizonY, 0), w, h - Math.max(horizonY, 0));

  // Sun with a soft glow, fixed in the sky north-east, low enough to see.
  const sunDir = { x: 0.62, y: 0.36, z: 0.55 };
  const sun = project(
    cam,
    focal,
    w / 2,
    cy,
    {
      x: cam.pos.x + sunDir.x * 900,
      y: cam.pos.y + sunDir.y * 900,
      z: cam.pos.z + sunDir.z * 900,
    },
  );
  if (sun && sun.y > -60 && sun.y < h) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 110);
    glow.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 226, 140, 0.55)');
    glow.addColorStop(1, 'rgba(255, 226, 140, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thin haze hugging the horizon so far terrain melts into the sky.
  if (horizonY > 0 && horizonY < h) {
    const haze = ctx.createLinearGradient(0, horizonY - 70, 0, horizonY + 40);
    haze.addColorStop(0, 'rgba(207, 232, 247, 0)');
    haze.addColorStop(1, storm ? 'rgba(169, 180, 189, 0.5)' : 'rgba(207, 232, 247, 0.55)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY - 70, w, 110);
  }
  return horizonY;
}

function drawClouds(ctx, cam, focal, cx, cy, clouds, storm, time) {
  const list = [];
  for (const c of clouds) {
    const drifted = { x: c.x + c.drift * time * 0.4, y: c.y, z: c.z };
    const p = project(cam, focal, cx, cy, drifted);
    if (!p || p.y < -80 || p.y > 760) continue;
    list.push({ c, p });
  }
  list.sort((a, b) => b.p.d - a.p.d);
  for (const { c, p } of list) {
    const s = (focal * c.r) / p.d;
    if (s < 4) continue;
    ctx.fillStyle = storm ? 'rgba(226, 232, 238, 0.85)' : 'rgba(255, 255, 255, 0.92)';
    for (let i = 0; i < c.puffs; i++) {
      const ox = ((i - c.puffs / 2) * s) / 1.6;
      const oy = Math.sin(i * 2.1) * s * 0.18;
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + oy, s * 0.62, s * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTerrain(ctx, cam, focal, cx, cy, plane, seed, storm) {
  const step = WORLD.gridStep;
  const zStart = Math.floor((plane.z - WORLD.viewBehind) / step) * step;
  const zEnd = plane.z + WORLD.viewAhead;
  const xStart = Math.floor((plane.x - WORLD.viewHalfWidth) / step) * step;
  const xEnd = plane.x + WORLD.viewHalfWidth;
  const rows = [];
  for (let z = zStart; z < zEnd; z += step) rows.push(z);
  // Painter's order: far rows first.
  rows.sort((a, b) => {
    const da = (a - cam.pos.z) * cam.fwd.z + (plane.x - cam.pos.x) * cam.fwd.x;
    const db = (b - cam.pos.z) * cam.fwd.z + (plane.x - cam.pos.x) * cam.fwd.x;
    return db - da;
  });

  // Pre-project the grid points once, row by row.
  const grid = new Map();
  const projectPoint = (x, z) => {
    const h = groundHeight(x, z, seed);
    return { p: project(cam, focal, cx, cy, { x, y: Math.max(h, 0), z }), h };
  };
  for (const z of rows) {
    const row = [];
    for (let x = xStart; x <= xEnd; x += step) row.push(projectPoint(x, z));
    grid.set(z, row);
  }

  for (const z of rows) {
    const row = grid.get(z);
    const next = grid.get(z + step);
    if (!next) continue;
    for (let i = 0; i < row.length - 1; i++) {
      const a = row[i];
      const b = row[i + 1];
      const c = next[i];
      const d = next[i + 1];
      if (!a.p || !b.p || !c.p || !d.p) continue;
      const hm = (a.h + b.h + c.h + d.h) / 4;
      const slope = Math.abs(a.h - d.h) / (step * 1.4);
      let color;
      if (hm < 0.4) {
        // Shallow water near the shore, deeper further out.
        const depth = clamp(-hm / 14, 0, 1);
        color =
          depth < 0.35
            ? COLORS.seaShallow
            : COLORS.seaDeep;
      } else {
        color = groundColor(0, 0, hm, slope, COLORS);
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(d.p.x, d.p.y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(d.p.x, d.p.y);
      ctx.lineTo(c.p.x, c.p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawRing(ctx, cam, focal, cx, cy, ring, isNext, time) {
  const c = project(cam, focal, cx, cy, ring);
  if (!c) return;
  const s = (focal * ring.r) / c.d;
  if (s < 3) return;
  const pulse = isNext ? 1 + 0.08 * Math.sin(time * 5) : 1;
  const rx = s * pulse;
  const ry = s * 0.94 * pulse;
  ctx.save();
  ctx.lineWidth = Math.max(2, s * 0.1);
  if (isNext) {
    ctx.shadowColor = '#ffcf3d';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = COLORS.ringNext;
  } else {
    ctx.strokeStyle = 'rgba(255, 180, 0, 0.55)';
  }
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeStyle = 'rgba(20, 30, 40, 0.6)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Chevrons on the next ring so the pilot can read it at a glance.
  if (isNext) {
    ctx.fillStyle = '#fff3c4';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(c.x + i * rx * 0.45 - 7, c.y - ry * 0.45);
      ctx.lineTo(c.x + i * rx * 0.45 + 7, c.y - ry * 0.45);
      ctx.lineTo(c.x + i * rx * 0.45, c.y - ry * 0.45 + 12);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawRunway(ctx, cam, focal, cx, cy, runway, seed) {
  const gy = runway.groundY;
  const hw = runway.width / 2;
  const hl = runway.length / 2;
  const corners = [
    { x: runway.x - hw, y: gy + 0.6, z: runway.z - hl },
    { x: runway.x + hw, y: gy + 0.6, z: runway.z - hl },
    { x: runway.x + hw, y: gy + 0.6, z: runway.z + hl },
    { x: runway.x - hw, y: gy + 0.6, z: runway.z + hl },
  ];
  const pts = corners.map((p) => project(cam, focal, cx, cy, p));
  if (pts.some((p) => !p)) return;
  ctx.fillStyle = COLORS.runway;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes.
  ctx.strokeStyle = COLORS.runwayLine;
  ctx.lineWidth = 2;
  for (let t = -0.8; t < 0.9; t += 0.2) {
    const z1 = runway.z + t * hl;
    const z2 = runway.z + (t + 0.1) * hl;
    const p1 = project(cam, focal, cx, cy, { x: runway.x, y: gy + 0.8, z: z1 });
    const p2 = project(cam, focal, cx, cy, { x: runway.x, y: gy + 0.8, z: z2 });
    if (!p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  // Threshold bars at the near end.
  ctx.fillStyle = COLORS.runwayLine;
  for (let i = -2; i <= 2; i++) {
    const z = runway.z - hl + 14;
    const p1 = project(cam, focal, cx, cy, { x: runway.x + i * 6 - 2, y: gy + 0.8, z });
    const p2 = project(cam, focal, cx, cy, { x: runway.x + i * 6 + 2, y: gy + 0.8, z });
    const p3 = project(cam, focal, cx, cy, { x: runway.x + i * 6 + 2, y: gy + 0.8, z: z + 12 });
    const p4 = project(cam, focal, cx, cy, { x: runway.x + i * 6 - 2, y: gy + 0.8, z: z + 12 });
    if (!p1 || !p2 || !p3 || !p4) continue;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
  }
  // Edge lights.
  for (let t = -1; t <= 1; t += 0.25) {
    for (const side of [-1, 1]) {
      const p = project(cam, focal, cx, cy, {
        x: runway.x + side * (hw + 2),
        y: gy + 1.5,
        z: runway.z + t * hl,
      });
      if (!p) continue;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// The plane, seen from behind and slightly above: fuselage, wide wings,
// tail fin and stabiliser, navigation lights, registration SKY-07.
export function drawPlane(ctx, cx, planeY, scale, roll, pitch, time) {
  ctx.save();
  ctx.translate(cx, planeY);
  ctx.rotate(deg2rad(roll) * 0.9);
  ctx.scale(scale, scale);
  const bob = Math.sin(time * 2.2) * 1.5;
  ctx.translate(0, bob);

  // Main wings.
  ctx.fillStyle = '#d8433a';
  ctx.beginPath();
  ctx.moveTo(-118, 6);
  ctx.quadraticCurveTo(-118, -6, -96, -8);
  ctx.lineTo(-14, -4);
  ctx.lineTo(14, -4);
  ctx.lineTo(96, -8);
  ctx.quadraticCurveTo(118, -6, 118, 6);
  ctx.lineTo(14, 12);
  ctx.lineTo(-14, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2f5f7';
  ctx.fillRect(-96, -6, 192, 3);

  // Fuselage: wide at the tail, tapering toward the nose (up-screen).
  const body = ctx.createLinearGradient(-16, 0, 16, 0);
  body.addColorStop(0, '#b9c4cc');
  body.addColorStop(0.5, '#f4f7f9');
  body.addColorStop(1, '#9fb0bc');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-15, 44);
  ctx.quadraticCurveTo(-17, 0, -11, -58);
  ctx.quadraticCurveTo(0, -66, 11, -58);
  ctx.quadraticCurveTo(17, 0, 15, 44);
  ctx.quadraticCurveTo(0, 52, -15, 44);
  ctx.closePath();
  ctx.fill();
  // Canopy glint.
  ctx.fillStyle = '#274b63';
  ctx.beginPath();
  ctx.ellipse(0, -34, 8, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(-2, -40, 3, 7, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Registration.
  ctx.fillStyle = '#24313c';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKY-07', 0, 30);
  // Panel lines.
  ctx.strokeStyle = 'rgba(36, 49, 60, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.lineTo(12, -8);
  ctx.moveTo(-14, 18);
  ctx.lineTo(14, 18);
  ctx.stroke();

  // Tail fin (vertical) and stabiliser.
  ctx.fillStyle = '#d8433a';
  ctx.beginPath();
  ctx.moveTo(-3, 40);
  ctx.lineTo(-13, 66);
  ctx.lineTo(13, 66);
  ctx.lineTo(3, 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#24313c';
  ctx.beginPath();
  ctx.moveTo(-2, 44);
  ctx.lineTo(-9, 62);
  ctx.lineTo(9, 62);
  ctx.lineTo(2, 44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d8433a';
  ctx.beginPath();
  ctx.moveTo(-46, 52);
  ctx.lineTo(-40, 44);
  ctx.lineTo(40, 44);
  ctx.lineTo(46, 52);
  ctx.lineTo(0, 58);
  ctx.closePath();
  ctx.fill();

  // Navigation lights: red port, green starboard, white tail strobe.
  ctx.fillStyle = '#ff2e2e';
  ctx.beginPath();
  ctx.arc(-116, 2, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2eff5e';
  ctx.beginPath();
  ctx.arc(116, 2, 3.4, 0, Math.PI * 2);
  ctx.fill();
  const strobe = (time % 1.2) < 0.12;
  if (strobe) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 66, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Full scene: sky, clouds, terrain, runway, rings, plane.
export function renderScene(ctx, w, h, state) {
  const { plane, seed, clouds, rings, runway, storm, time } = state;
  const focal = (h / 2) / Math.tan(deg2rad(CAMERA.fovDeg / 2));
  const cx = w / 2;
  const cy = h * 0.52;
  const cam = makeCamera(plane, storm);

  drawSky(ctx, w, h, cam, focal, cy, storm, time);
  drawClouds(ctx, cam, focal, cx, cy, clouds, storm, time);
  drawTerrain(ctx, cam, focal, cx, cy, plane, seed, storm);
  drawRunway(ctx, cam, focal, cx, cy, runway, seed);

  // Rings, far first.
  const visibleRings = rings
    .filter((r) => !r.passed)
    .map((r) => ({ r, d: Math.hypot(r.x - plane.x, r.z - plane.z) }))
    .sort((a, b) => b.d - a.d);
  for (const { r } of visibleRings) {
    drawRing(ctx, cam, focal, cx, cy, r, r.index === state.nextRing, time);
  }

  // The plane sits low-centre in frame, big enough to read.
  if (state.showPlane !== false) {
    const planeScale = clamp(1.15 - plane.pitch * 0.004, 0.9, 1.25);
    drawPlane(ctx, cx, h * 0.66, planeScale, plane.roll, plane.pitch, time);
  }

  // Storm rain.
  if (storm) {
    ctx.strokeStyle = 'rgba(220, 232, 240, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 90; i++) {
      const rx = ((i * 137.5 + time * 900) % (w + 40)) - 20;
      const ry = ((i * 89.3 + time * 1400) % (h + 40)) - 20;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 6, ry + 16);
    }
    ctx.stroke();
  }
  return cam;
}
