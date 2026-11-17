# Phases

Every phase is one file in this folder that exports a **phase object**. The list in
[`index.js`](index.js) decides the order: phase *n* is `PHASES[n-1]`. The main loop
([`../main.js`](../main.js)) never knows which phase is running. It just calls the hooks below
on the current phase (`GS.P`).

## Adding a phase

1. Copy [`_template.js`](_template.js) to `pN-your-name.js`.
2. Fill in `start`, `tick` and `sync` (the rest is optional).
3. Import it in `index.js` and add it to the list. That's it: the level-select code `NNN`,
   the phone skip (tap the score 3×), death/retry and the move to the next phase all work.

A phase calls `endPhase()` when it is won. The flow then plays the phase's `outro` and starts
the next phase in the list, or the victory lap after the last one.

## The phase object

| field | required | what it is |
|---|---|---|
| `name` | ✓ | shown in the HUD and on banners, e.g. `'LAND GRAB'` |
| `color` | ✓ | glow colour of the HUD for this phase |
| `song` | | key in `SONGS` (`core/audio.js`) |
| `ui` | | screen setup: `{cam:'follow'\|'top'\|'side'\|'fps', sun:<shadow half-size, 0 = no sun shadows>, bloom:[strength,threshold], fps:true (gun + status bar), pad:true (◀ ▶ JUMP on phones), wanted:true}` |
| `start(opt)` | ✓ | build the world (`GS.W3`) and the game state (`GS.G`), set `GS.mode='seq'` and play an intro with `runSeq()`, then set `GS.mode='play'` |
| `tick(dt)` | ✓ | gameplay update while `GS.mode==='play'`; call `endPhase()` when the phase is won |
| `sync(dt)` | ✓ | per frame: put the 3D objects where the game state says |
| `deadTick(dt)` | | keeps the world moving behind the death screen |
| `outro(next, nextPhase)` | | transition when won; call `next()` at the end (usually via `runSeq`) |
| `camTarget()` | | `[x, y]` in map cells for the camera (default: the hero) |
| `sunTarget()` | | `THREE.Vector3` the shadow camera follows (default: what the camera looks at) |
| `hud()` | | return `{progress: 0..1, left: 'TEXT'}`; also the place to update phase-only widgets |
| `minimap()` | | draw your own minimap on `miniX` (use `miniSize()` from `ui/minimap.js`) |
| `mini`, `miniExtras(g,cs,t)` | | for grid mazes: describe the minimap instead of drawing it |
| `tap()` | | phone tap (no swipe) during play |
| `powerName` | | label of the power bar (default `POWER`) |
| `deathTitle`, `deathText` | | death screen texts |
| `clear()` | | remove anything the phase put outside `GS.W3` when it is left |
| `is2D`, `frame(dt)` | | 2D canvas phases only (phase 1) |

## Shared state and helpers

- `core/state.js` → `GS`: `mode`, `phase`, `P` (current phase), `G` (game state: `hero`, `en` enemies, `hearts`, `fright`, `inv`, ...), `W3` (3D world: `g`, `map`, `actors`, `fx`, `bg`), `score`, `hooks`.
- `main.js` → `startPhase`, `endPhase`, `hurtHero(why)`, `runSeq(seconds, update, done)`.
- `engine/` → renderer, lights and sun shadows (`sunSetup`, `envFrom` for reflections), camera (`cam`, `camPose`, `camUpdate`), `buildWorld(m, style)` for grid mazes, models (`makeBot`, `makeVirus`), particles (`burst`, `burstAt`, `pop3`), procedural textures (`cvTex`, `cvTex2`, `fbm`, `grain`).
- `ui/hud.js` → `banner`, `hint`, `flash`, `updHearts`.
- `maze-phase.js` → the plumbing of the Pac-Man style maze phases (2 and 3).
