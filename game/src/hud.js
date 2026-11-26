// HUD and screens: instruments, compass, warnings and the title / game-over
// overlays. Everything is drawn on the same canvas, glowing like lit glass.

import { COLORS } from './config.js';
import { bearingTo, distanceTo } from './plane.js';

const knots = (ms) => Math.round(ms * 1.944);
const feet = (m) => Math.round(m * 3.281);

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 20, 32, 0.55)';
  ctx.strokeStyle = 'rgba(160, 210, 240, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function label(ctx, text, x, y, size, color) {
  ctx.fillStyle = color || COLORS.hudDim;
  ctx.font = `600 ${size}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function bigValue(ctx, text, x, y, size, color) {
  ctx.fillStyle = color || COLORS.hud;
  ctx.font = `700 ${size}px "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

export function drawCompass(ctx, w, heading) {
  const cx = w / 2;
  const y = 26;
  panel(ctx, cx - 190, 10, 380, 44);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - 190, 10, 380, 44, 8);
  ctx.clip();
  const pxPerDeg = 4.2;
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let d = -60; d <= 420; d += 5) {
    const deg = ((d % 360) + 360) % 360;
    const dx = (d - heading) * pxPerDeg;
    if (Math.abs(dx) > 185) continue;
    const x = cx + dx;
    const major = deg % 45 === 0;
    const mid = deg % 15 === 0;
    ctx.strokeStyle = major ? COLORS.hud : 'rgba(160, 210, 240, 0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 22);
    ctx.lineTo(x, y + (major ? 8 : mid ? 14 : 18));
    ctx.stroke();
    if (major) {
      ctx.fillStyle = COLORS.hud;
      ctx.font = '700 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(names[deg] || String(deg), x, y + 34);
    }
  }
  ctx.restore();
  // Centre caret + digital heading.
  ctx.fillStyle = COLORS.ringNext;
  ctx.beginPath();
  ctx.moveTo(cx, 12);
  ctx.lineTo(cx - 6, 22);
  ctx.lineTo(cx + 6, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.hud;
  ctx.font = '700 15px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(heading)).padStart(3, '0') + '°', cx, 68);
}

// Artificial horizon: a lit attitude ball that rolls and pitches.
export function drawAttitude(ctx, x, y, r, roll, pitch) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate((-roll * Math.PI) / 180);
  const pitchPx = (pitch / 30) * r;
  ctx.fillStyle = '#2f7fc4';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + 1);
  ctx.strokeStyle = '#eaf6ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  // Pitch ladder.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(234, 246, 255, 0.7)';
  for (const deg of [-20, -10, 10, 20]) {
    const py = pitchPx - (deg / 30) * r;
    ctx.beginPath();
    ctx.moveTo(-14, py);
    ctx.lineTo(14, py);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed wings marker + rim.
  ctx.strokeStyle = COLORS.ringNext;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r - 2, y);
  ctx.lineTo(x - r + 12, y);
  ctx.moveTo(x + r - 12, y);
  ctx.lineTo(x + r + 2, y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160, 210, 240, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawHud(ctx, w, h, game) {
  const { plane, run } = game;
  const pad = 16;

  // Left: speed and altitude, the two numbers a pilot lives by.
  panel(ctx, pad, pad + 54, 208, 122);
  label(ctx, 'AIRSPEED', pad + 14, pad + 78, 11);
  bigValue(ctx, `${knots(plane.speed)}`, pad + 14, pad + 110, 30);
  label(ctx, 'KT', pad + 112, pad + 110, 13);
  label(ctx, 'ALTITUDE', pad + 14, pad + 136, 11);
  bigValue(ctx, `${feet(plane.y)}`, pad + 14, pad + 162, 22);
  label(ctx, 'FT', pad + 100, pad + 162, 12);
  const vs = plane.verticalSpeed;
  ctx.fillStyle = vs > 1 ? COLORS.hudGood : vs < -1 ? COLORS.hudWarn : COLORS.hudDim;
  ctx.font = '700 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${vs >= 0 ? '▲' : '▼'}${Math.abs(Math.round(vs * 196))}`, pad + 138, pad + 162);

  drawCompass(ctx, w, plane.heading);

  // Right: mission, timer, score, rings.
  panel(ctx, w - pad - 224, pad + 54, 224, 122);
  label(ctx, run.mission.name, w - pad - 210, pad + 78, 12, COLORS.ringNext);
  bigValue(ctx, `${Math.max(0, Math.ceil(run.timeLeft))}s`, w - pad - 210, pad + 110, 26);
  label(ctx, 'SCORE  ' + run.score, w - pad - 210, pad + 136, 12);
  const ringText = `RINGS  ${run.ringsPassed}/${run.mission.rings}`;
  ctx.fillStyle = run.ringsPassed === run.mission.rings ? COLORS.hudGood : COLORS.hud;
  ctx.font = '700 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(ringText, w - pad - 210, pad + 162);

  // Bottom-left: throttle and fuel.
  panel(ctx, pad, h - pad - 92, 208, 76);
  label(ctx, 'THROTTLE', pad + 14, h - pad - 70, 11);
  const barX = pad + 14;
  const barY = h - pad - 60;
  const barW = 180;
  ctx.fillStyle = 'rgba(160, 210, 240, 0.25)';
  ctx.fillRect(barX, barY, barW, 12);
  ctx.fillStyle = plane.throttle > 0.85 ? COLORS.hudWarn : '#58b6e8';
  ctx.fillRect(barX, barY, barW * plane.throttle, 12);
  label(ctx, 'FUEL', pad + 14, h - pad - 32, 11);
  ctx.fillStyle = 'rgba(160, 210, 240, 0.25)';
  ctx.fillRect(barX, h - pad - 26, barW, 12);
  const fuelFrac = Math.max(0, run.fuel / run.mission.fuel);
  ctx.fillStyle = fuelFrac < 0.25 ? COLORS.hudWarn : COLORS.hudGood;
  ctx.fillRect(barX, h - pad - 26, barW * fuelFrac, 12);

  // Bottom-right: attitude ball.
  panel(ctx, w - pad - 148, h - pad - 148, 148, 132);
  label(ctx, 'ATTITUDE', w - pad - 134, h - pad - 126, 11);
  drawAttitude(ctx, w - pad - 74, h - pad - 66, 42, plane.roll, plane.pitch);
  if (plane.stalled) {
    ctx.fillStyle = COLORS.hudWarn;
    ctx.font = '700 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALL', w - pad - 74, h - pad - 22);
  }

  // Next-ring guidance: distance and a steering arrow, under the compass.
  const next = run.rings[run.nextRing];
  if (next && run.status === 'flying') {
    const dist = Math.round(distanceTo(plane, next));
    const brg = bearingTo(plane, next);
    let rel = ((brg - plane.heading + 540) % 360) - 180;
    ctx.fillStyle = 'rgba(8, 20, 32, 0.55)';
    ctx.font = '700 16px monospace';
    ctx.textAlign = 'center';
    const tx = w / 2;
    const ty = 96;
    ctx.save();
    ctx.translate(tx - 78, ty - 5);
    ctx.rotate((rel * Math.PI) / 180);
    ctx.fillStyle = COLORS.ringNext;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(9, 8);
    ctx.lineTo(0, 3);
    ctx.lineTo(-9, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = COLORS.hud;
    ctx.fillText(`NEXT RING  ${dist}m`, tx + 14, ty);
  }

  // Warnings.
  const warnY = 168;
  ctx.textAlign = 'center';
  ctx.font = '700 22px sans-serif';
  const flash = Math.floor(performance.now() / 350) % 2 === 0;
  if (plane.stalled && flash) {
    ctx.fillStyle = COLORS.hudWarn;
    ctx.fillText('⚠ STALL — NOSE DOWN, FULL THROTTLE', w / 2, warnY);
  } else if (run.fuel < 20 && flash) {
    ctx.fillStyle = COLORS.hudWarn;
    ctx.fillText('⚠ LOW FUEL', w / 2, warnY);
  } else if (game.terrainAhead < 26 && plane.verticalSpeed < 0) {
    ctx.fillStyle = COLORS.hudWarn;
    ctx.fillText('⚠ PULL UP', w / 2, warnY);
  }

  // Transient banner (ring scored, touchdown...).
  if (game.banner && game.bannerUntil > performance.now()) {
    ctx.font = '700 26px sans-serif';
    ctx.fillStyle = COLORS.ringNext;
    ctx.fillText(game.banner, w / 2, h * 0.3);
  }

  // Controls reminder, small.
  ctx.fillStyle = 'rgba(234, 246, 255, 0.6)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↑↓ pitch · ←→ / A D bank · W/S throttle · drag mouse to steer · M mute · P pause', w / 2, h - 8);
}

export function drawTitle(ctx, w, h, missions, selected, best) {
  ctx.fillStyle = 'rgba(6, 16, 28, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff3c4';
  ctx.font = '700 64px sans-serif';
  ctx.fillText('SKY COURIER', w / 2, 150);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '400 20px sans-serif';
  ctx.fillText('Fly the mail run. Thread the rings. Bring her home.', w / 2, 188);

  const cardW = 340;
  const gap = 24;
  const total = missions.length * cardW + (missions.length - 1) * gap;
  const startX = (w - total) / 2;
  missions.forEach((m, i) => {
    const x = startX + i * (cardW + gap);
    const y = 250;
    const sel = i === selected;
    ctx.fillStyle = sel ? 'rgba(255, 207, 61, 0.16)' : 'rgba(8, 20, 32, 0.6)';
    ctx.strokeStyle = sel ? COLORS.ringNext : 'rgba(160, 210, 240, 0.4)';
    ctx.lineWidth = sel ? 3 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, 190, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = sel ? COLORS.ringNext : COLORS.hud;
    ctx.font = '700 22px sans-serif';
    ctx.fillText(`${i + 1} · ${m.name}`, x + cardW / 2, y + 40);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '400 15px sans-serif';
    ctx.fillText(m.tagline, x + cardW / 2, y + 68);
    ctx.fillStyle = COLORS.hud;
    ctx.font = '400 14px sans-serif';
    wrapText(ctx, m.description, x + 22, y + 96, cardW - 44, 20);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '600 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${m.rings} RINGS · ${m.timeLimit}s · FUEL ${m.fuel}${m.storm ? ' · STORM' : ''}`,
      x + cardW / 2,
      y + 168,
    );
  });

  ctx.fillStyle = COLORS.hud;
  ctx.font = '400 16px sans-serif';
  ctx.fillText('Click a mission or press 1 / 2 / 3 — then fly with the arrow keys.', w / 2, 486);
  ctx.fillStyle = 'rgba(234, 246, 255, 0.75)';
  ctx.font = '400 14px sans-serif';
  ctx.fillText('↑↓ pitch   ←→ bank   W/S throttle   drag mouse to steer   M mute   P pause', w / 2, 516);
  if (best > 0) {
    ctx.fillStyle = COLORS.ringNext;
    ctx.font = '700 16px sans-serif';
    ctx.fillText(`Best score so far: ${best}`, w / 2, 552);
  }
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  ctx.textAlign = 'left';
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawGameOver(ctx, w, h, game) {
  const run = game.run;
  ctx.fillStyle = 'rgba(6, 16, 28, 0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  const titles = {
    landed: '✈ TOUCHDOWN — MISSION COMPLETE',
    crashed: '💥 CRASHED',
    timeout: '⏱ OUT OF TIME',
    'out-of-fuel': '⛽ OUT OF FUEL',
  };
  const colors = {
    landed: COLORS.hudGood,
    crashed: COLORS.hudWarn,
    timeout: COLORS.hudWarn,
    'out-of-fuel': COLORS.hudWarn,
  };
  ctx.fillStyle = colors[run.status] || COLORS.hud;
  ctx.font = '700 44px sans-serif';
  ctx.fillText(titles[run.status] || 'FLIGHT OVER', w / 2, 250);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '400 20px sans-serif';
  ctx.fillText(run.message, w / 2, 292);
  ctx.font = '700 30px monospace';
  ctx.fillText(`SCORE  ${run.score}`, w / 2, 350);
  ctx.font = '400 17px sans-serif';
  ctx.fillText(
    `Rings ${run.ringsPassed}/${run.mission.rings} · Time flown ${Math.round(run.timeFlown)}s · Best ${game.best}`,
    w / 2,
    388,
  );
  ctx.fillStyle = COLORS.ringNext;
  ctx.font = '700 18px sans-serif';
  ctx.fillText('Press R or Enter to fly again · T for the mission list', w / 2, 448);
}
