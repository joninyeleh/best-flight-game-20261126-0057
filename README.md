[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/joninyeleh/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/joninyeleh/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Sky Courier

A small mail plane, an island chain, and a sky full of golden rings. Fly the
mail run: thread the rings, watch your fuel, and bring her home on the strip.

## How to play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and open
http://localhost:8080). No network needed — everything is local files.

- **↑ / ↓** — pitch up / down
- **← / →** or **A / D** — bank left / right (banking turns the plane)
- **W / S** — throttle up / down
- **Drag with the mouse** — steer too
- **P** — pause · **R** — restart · **T** — mission list · **M** — mute

## Missions

1. **Ring Run** — fly through 8 golden rings over the islands before the
   clock or the tank runs out. Each ring pays points and a splash of fuel.
2. **Island Hop** — cross the archipelago and land on the far runway. Touch
   down slow, level and gentle, or the landing bends the plane.
3. **Storm Courier** — 10 rings in a crosswind with a tight tank. Gusts shove
   the plane sideways and the sky is low and grey.

Stall below flying speed and the nose drops. Hit the ground and the sortie is
over. The HUD shows airspeed, altitude, heading, throttle, fuel and an
attitude ball; the golden arrow points at the next ring.

All art is drawn in code on a canvas and all sound is synthesised with
WebAudio — no image or audio files, no libraries, no network requests.
