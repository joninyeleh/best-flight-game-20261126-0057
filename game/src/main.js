// Sky Courier — game loop, screens and scoring.
// A small mail plane flies rings over an island chain and lands on a strip.

import { VIEW, PLANE, COLORS } from './config.js';
import { createPlane, stepPlane, distanceTo } from './plane.js';
import { createInput, bindInput, readStick, readThrottle, wasPressed, clearPressed } from './input.js';
import { createAudio, ensureAudio, updateEngineSound, playRingChime, playCrash, playLandingFanfare, playWarning, setMuted } from './audio.js';
import { renderScene } from './render.js';
import { drawHud, drawTitle, drawGameOver } from './hud.js';
import { MISSIONS, RUNWAY, createRun, ringScore, landingCheck, runwayGroundY } from './missions.js';
import { groundHeight, buildClouds } from './terrain.js';
import { readShotParams, applyShot } from './shots.js';

const SEED = 20261126;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const game = {
  screen: 'title', // title | playing | over
  selected: 0,
  plane: null,
  run: null,
  clouds: buildClouds(SEED, 26),
  runway: { ...RUNWAY, groundY: 0 },
  time: 0,
  frame: 0,
  freezeAfter: 0,
  banner: '',
  bannerUntil: 0,
  terrainAhead: 999,
  best: 0,
  muted: false,
  paused: false,
  lastWarn: 0,
};

try {
  game.best = Number(window.localStorage.getItem('sky-courier-best') || 0) || 0;
} catch {
  game.best = 0;
}

const input = createInput();
bindInput(input, canvas);
const audio = createAudio();
game.runway.groundY = runwayGroundY(SEED);

function showBanner(text) {
  game.banner = text;
  game.bannerUntil = performance.now() + 1800;
}

game.startMission = function startMission(index) {
  const mission = MISSIONS[index];
  game.selected = index;
  game.plane = createPlane(mission.start.x, mission.start.z, mission.start.y, mission.start.heading);
  game.plane.speed = 55;
  game.plane.throttle = 0.7;
  game.run = createRun(mission, SEED);
  game.screen = 'playing';
  game.paused = false;
  game.banner = '';
  ensureAudio(audio);
  showBanner(mission.name + ' — ' + mission.tagline);
};

function endRun(status, message) {
  const run = game.run;
  run.status = status;
  run.message = message;
  if (status === 'landed') {
    run.score += 500 + Math.max(0, Math.round(run.timeLeft)) * 2;
    playLandingFanfare(audio);
  } else if (status === 'crashed') {
    playCrash(audio);
  }
  if (run.score > game.best) {
    game.best = run.score;
    try {
      window.localStorage.setItem('sky-courier-best', String(game.best));
    } catch {
      // Storage may be unavailable; the score still shows this session.
    }
  }
  game.screen = 'over';
  updateEngineSound(audio, 0, 0, false);
}

function step(dt) {
  const plane = game.plane;
  const run = game.run;
  const mission = run.mission;

  // Storm gusts shove the plane sideways, changing every couple of seconds.
  let wind = { x: 0, z: 0 };
  if (mission.storm) {
    const gust = Math.sin(game.time * 0.7) * 5 + Math.sin(game.time * 1.9) * 3;
    wind = { x: gust, z: Math.cos(game.time * 0.5) * 2 };
  }

  const stick = readStick(input);
  const throttleDelta = readThrottle(input);
  stepPlane(plane, { pitch: stick.pitch, roll: stick.roll, throttleDelta }, dt, SEED, wind);

  run.timeFlown += dt;
  run.timeLeft -= dt;
  // Fuel burns with throttle; a ring pays a little back.
  run.fuel -= PLANE.fuelBurn * (0.35 + plane.throttle) * dt;
  updateEngineSound(audio, plane.throttle, plane.speed, plane.stalled);

  // Terrain clearance straight ahead, for the PULL UP warning.
  const aheadX = plane.x + Math.sin((plane.heading * Math.PI) / 180) * 120;
  const aheadZ = plane.z + Math.cos((plane.heading * Math.PI) / 180) * 120;
  game.terrainAhead = plane.y - groundHeight(aheadX, aheadZ, SEED);

  // Ring passed?
  const next = run.rings[run.nextRing];
  if (next && distanceTo(plane, next) < next.r + 6) {
    next.passed = true;
    run.ringsPassed += 1;
    run.nextRing += 1;
    const pts = ringScore(plane);
    run.score += pts;
    run.fuel = Math.min(mission.fuel, run.fuel + PLANE.fuelRingBonus);
    playRingChime(audio);
    showBanner(`RING ${run.ringsPassed}/${mission.rings}  +${pts}`);
    if (run.ringsPassed === mission.rings && !mission.landToWin) {
      endRun('landed', 'Every ring flown — the mail run is complete.');
      return;
    }
  }

  // Landing: over the strip, low, slow, gentle and level.
  if (mission.landToWin) {
    const check = landingCheck(plane, SEED);
    if (check.overStrip && check.low && plane.y - check.ground < 4) {
      if (check.slow && check.gentle && check.level) {
        plane.landed = true;
        endRun('landed', 'Smooth touchdown on the island strip. The mail is delivered.');
        return;
      }
      // A hard arrival on the strip bends the plane.
      plane.crashed = true;
    }
  }

  if (plane.crashed) {
    const nearStrip = Math.hypot(plane.x - RUNWAY.x, plane.z - RUNWAY.z) < 800;
    endRun(
      'crashed',
      nearStrip
        ? 'The plane came down short of the strip. Walk away, fly again.'
        : 'The plane hit the terrain. Walk away, fly again.',
    );
    return;
  }
  if (run.timeLeft <= 0) {
    endRun('timeout', 'The clock beat you — the mail run is over.');
    return;
  }
  if (run.fuel <= 0) {
    endRun('out-of-fuel', 'The tank ran dry over open water.');
    return;
  }
  if (plane.stalled && game.time - game.lastWarn > 2.5) {
    game.lastWarn = game.time;
    playWarning(audio);
  }
}

function handleKeys() {
  if (wasPressed(input, 'm', 'M')) {
    game.muted = !game.muted;
    setMuted(audio, game.muted);
  }
  if (game.screen === 'title') {
    if (wasPressed(input, '1')) game.startMission(0);
    else if (wasPressed(input, '2')) game.startMission(1);
    else if (wasPressed(input, '3')) game.startMission(2);
    else if (wasPressed(input, 'ArrowLeft', 'a', 'A')) {
      game.selected = (game.selected + MISSIONS.length - 1) % MISSIONS.length;
    } else if (wasPressed(input, 'ArrowRight', 'd', 'D')) {
      game.selected = (game.selected + 1) % MISSIONS.length;
    } else if (wasPressed(input, 'Enter', ' ')) {
      game.startMission(game.selected);
    }
    return;
  }
  if (game.screen === 'over') {
    if (wasPressed(input, 'r', 'R', 'Enter', ' ')) game.startMission(game.selected);
    else if (wasPressed(input, 't', 'T')) game.screen = 'title';
    return;
  }
  // Playing.
  if (wasPressed(input, 'p', 'P', 'Escape')) {
    game.paused = !game.paused;
    if (game.paused) updateEngineSound(audio, 0, 0, false);
  }
  if (wasPressed(input, 'r', 'R')) game.startMission(game.selected);
  if (wasPressed(input, 't', 'T')) game.screen = 'title';
}

canvas.addEventListener('click', (e) => {
  ensureAudio(audio);
  if (game.screen !== 'title') return;
  // Click a mission card to start it.
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * VIEW.width;
  const y = ((e.clientY - rect.top) / rect.height) * VIEW.height;
  const cardW = 340;
  const gap = 24;
  const total = MISSIONS.length * cardW + (MISSIONS.length - 1) * gap;
  const startX = (VIEW.width - total) / 2;
  MISSIONS.forEach((m, i) => {
    const cx = startX + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= 250 && y <= 440) {
      game.startMission(i);
    }
  });
});

// Attract-mode camera: a slow cinematic drift over the islands behind the
// title screen, so the menu itself shows the game world.
const attractPlane = createPlane(-40, -160, 90, 8);
attractPlane.speed = 30;
attractPlane.throttle = 0.5;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.time += dt;
  game.frame += 1;

  handleKeys();

  const frozen = game.freezeAfter > 0 && game.frame > game.freezeAfter;
  if (game.screen === 'playing' && !game.paused && !frozen) {
    step(dt);
  } else if (game.screen === 'title') {
    // Drift the attract camera forward and gently weave.
    attractPlane.z += attractPlane.speed * dt;
    attractPlane.x = -40 + Math.sin(game.time * 0.08) * 120;
    attractPlane.y = 90 + Math.sin(game.time * 0.2) * 8;
    attractPlane.heading = 8 + Math.sin(game.time * 0.08) * 12;
  }
  clearPressed(input);

  // Draw.
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  if (game.screen === 'title') {
    renderScene(ctx, VIEW.width, VIEW.height, {
      plane: attractPlane,
      seed: SEED,
      clouds: game.clouds,
      rings: [],
      runway: game.runway,
      storm: false,
      time: game.time,
      nextRing: -1,
      showPlane: false,
    });
    drawTitle(ctx, VIEW.width, VIEW.height, MISSIONS, game.selected, game.best);
  } else if (game.screen === 'playing') {
    renderScene(ctx, VIEW.width, VIEW.height, {
      plane: game.plane,
      seed: SEED,
      clouds: game.clouds,
      rings: game.run.rings,
      runway: game.runway,
      storm: game.run.mission.storm,
      time: game.time,
      nextRing: game.run.nextRing,
    });
    drawHud(ctx, VIEW.width, VIEW.height, game);
    if (game.paused) {
      ctx.fillStyle = 'rgba(6, 16, 28, 0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.fillStyle = COLORS.hud;
      ctx.font = '700 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED — press P to fly on', VIEW.width / 2, VIEW.height / 2);
    }
  } else {
    renderScene(ctx, VIEW.width, VIEW.height, {
      plane: game.plane,
      seed: SEED,
      clouds: game.clouds,
      rings: game.run.rings,
      runway: game.runway,
      storm: game.run.mission.storm,
      time: game.time,
      nextRing: game.run.nextRing,
    });
    drawGameOver(ctx, VIEW.width, VIEW.height, game);
  }
  requestAnimationFrame(frame);
}

// Screenshot states (?shot=...) start the game in a staged moment.
const shotParams = readShotParams();
applyShot(game, shotParams);

requestAnimationFrame(frame);
