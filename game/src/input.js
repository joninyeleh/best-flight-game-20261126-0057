// Keyboard + mouse input. Arrows/WASD fly, W/S throttle, mouse steers too.

export function createInput() {
  return {
    keys: new Set(),
    mouse: { active: false, dx: 0, dy: 0 },
    pressed: new Set(), // keys pressed since last poll (edge-triggered)
  };
}

export function bindInput(input, element) {
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (!input.keys.has(e.key)) input.pressed.add(e.key);
    input.keys.add(e.key);
  };
  const up = (e) => input.keys.delete(e.key);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => input.keys.clear());

  element.addEventListener('mousedown', (e) => {
    input.mouse.active = true;
    input.mouse.dx = 0;
    input.mouse.dy = 0;
    input.mouse.lastX = e.clientX;
    input.mouse.lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    input.mouse.active = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.mouse.active) return;
    input.mouse.dx += e.clientX - (input.mouse.lastX ?? e.clientX);
    input.mouse.dy += e.clientY - (input.mouse.lastY ?? e.clientY);
    input.mouse.lastX = e.clientX;
    input.mouse.lastY = e.clientY;
  });
}

function keyDown(input, ...names) {
  return names.some((n) => input.keys.has(n));
}

// Read the current flight stick position from keys and mouse drag.
export function readStick(input) {
  // Arrows fly pitch and roll; A/D roll as well. W/S are throttle, not pitch.
  // Arcade sense: Up climbs, Down dives.
  const pitch =
    (keyDown(input, 'ArrowUp') ? 1 : 0) - (keyDown(input, 'ArrowDown') ? 1 : 0);
  const roll =
    (keyDown(input, 'ArrowRight', 'd', 'D') ? 1 : 0) -
    (keyDown(input, 'ArrowLeft', 'a', 'A') ? 1 : 0);
  const mousePitch = input.mouse.active
    ? Math.max(-1, Math.min(1, -input.mouse.dy / 90))
    : 0;
  const mouseRoll = input.mouse.active
    ? Math.max(-1, Math.min(1, input.mouse.dx / 90))
    : 0;
  return {
    pitch: Math.max(-1, Math.min(1, pitch + mousePitch)),
    roll: Math.max(-1, Math.min(1, roll + mouseRoll)),
  };
}

export function readThrottle(input) {
  return (
    (keyDown(input, 'w', 'W', 'Shift') ? 1 : 0) -
    (keyDown(input, 's', 'S', 'Control') ? 1 : 0)
  );
}

// True once when a key was pressed since the last call.
export function wasPressed(input, ...names) {
  for (const n of names) {
    if (input.pressed.has(n)) {
      input.pressed.delete(n);
      return true;
    }
  }
  return false;
}

export function clearPressed(input) {
  input.pressed.clear();
}
