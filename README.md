<div align="center">

# MUNCHBOT '80

**A 1980 maze chase that turns into a crime city, a first-person shooter, a 16-bit jungle platformer and a neon land grab.**

[![Play now](https://img.shields.io/badge/▶_PLAY_NOW-crazy--pacman.pages.dev-7dff4a?style=for-the-badge)](https://crazy-pacman.pages.dev)

<img src="docs/0-title.jpg" width="49%"> <img src="docs/1-1980.jpg" width="49%">

</div>

You are MUNCHBOT, a hungry little robot, and the Glitches are after you. It starts as an innocent 1980 arcade maze. After twenty seconds the machine OVERCLOCKS, there is no escape, GAME OVER... JUST KIDDING. The maze rises out of the screen and the real game starts.

## The phases

| | Phase | What happens |
|---|---|---|
| 1 | **1980** | A classic 2D maze: eat the dots, grab the power diamonds and eat the Glitches back. 20 seconds, then OVERCLOCK. |
| 2 | **MEAN STREETS** | The same maze rises into a top-down crime city. Grab all the cash to finish, answer ringing payphones for 3 jobs (a delivery run, a kill frenzy, surviving the heat), and dodge the glitch cop cars. The screen flashes red and blue as they close in. Collect 4 green tokens and your crew rolls in for 20 seconds and wrecks the cops for you. |
| 3 | **HELL MAZE** | First person in rusty, bump-mapped HD corridors. Demons hunt you (2 shots each), and so does THE BRUTE, a three-eyed boss demon that takes 5 shots and keeps coming back. Your arm cannon is the only gun in the maze and dots are ammo. Eat every dot to get out. |
| 4 | **JUNGLE '94** | A side-scrolling platformer in the spirit of 90s 16-bit games, built in real 3D. MUNCHBOT turns into a golden lion-bot with a mane: sunset jungle, ruins, waterfalls, pits, springy mushrooms and a moving log. Stomp the Glitches, double jump, and grab every gem (a counter shows how many are left) to open the gate at the end of the level. |
| 5 | **LAND GRAB** | Xonix meets Pac-Man. Leave the safe neon land to draw a line across the glitch sea, then close it: every pocket without a glitch rises up as land and its dots are eaten. Glitches bounce through the sea and cut your line, and a land glitch patrols the safe zone. Power diamonds turn them blue: eat them, or close a line around them to trap them for a big bonus. Claim 75% of the grid to win. |

Phase 1 moves on by itself after 20 seconds. Phases 2 to 5 have no clock: you move on only when the map is cleared (or claimed). Win and you can go again with **LOOP ×2**, faster every time.

<div align="center">
<img src="docs/2-mean-streets.jpg" width="49%"> <img src="docs/3-hell-maze.jpg" width="49%">
<img src="docs/4-jungle-94.jpg" width="49%"> <img src="docs/5-land-grab.jpg" width="49%">
</div>

## Controls

| | Keyboard | Phone |
|---|---|---|
| Steer (phases 1, 2, 5) | Arrows / `WASD` | Swipe |
| Run / jump (phase 4) | `←` `→` / `Space` or `↑` (again in the air for a double jump) | On-screen ◀ ▶ JUMP buttons |
| Walk (phase 3) | Hold `↑` / `W` | Hold a finger |
| Turn / turn around (phase 3) | `←` `→` / `↓` | Swipe left / right / down |
| Shoot (phase 3) | `Space` | Tap |
| Mute | `M` | |

**Secret level select:** type `222`, `333`, `444` or `555`. On a phone, tap the score 3 times quickly to skip to the next phase.

## Under the hood

- One single `index.html`, built from small source files. No image files: the maze, the city, the textures, the demons and the HUD are all drawn in code.
- 3D with [three.js](https://threejs.org): phase 1 stays a crisp 1980 arcade screen, while phases 2 to 5 render in HD with soft sun shadows, multisampled anti-aliasing, bloom, sky-based reflections on paint, glass and metal, and high-res procedural textures with bump maps (asphalt, facades, rusty bricks, mossy ruins, palm fronds, neon maze tiles).
- A built-in quality governor steps the resolution and then the shadows down if a device can't hold the frame rate.
- All sound effects and music are generated live with the Web Audio API.
- Works on desktop and mobile, in landscape and portrait.

Run it locally by opening `index.html` in a browser, or with `python3 -m http.server`.

## More games in the series

| | |
|---|---|
| 🦖 [**404: Dino Not Found**](https://github.com/jeniaka/dino-404) | the offline dino runner that falls into 3D · [play](https://dino-404.pages.dev) |
| 👾 [**INVASION '78**](https://github.com/jeniaka/CrazySpaceShip) | a 1978 space shooter that turns into a 3D boss fight · [play](https://invasion78.pages.dev) |
| 🤖 **MUNCHBOT '80** | you are here |

<div align="center"><sub>Built by <a href="https://github.com/jeniaka">jeniaka</a> with Claude</sub></div>
