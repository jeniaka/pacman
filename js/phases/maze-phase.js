// Shared plumbing for phases played on a grid maze with the classic chase rules (MEAN STREETS, HELL MAZE).
import {GS} from '../core/state.js';
import {setSong} from '../core/audio.js';
import {newMazeGame, mazeTick} from '../core/maze-game.js';
import {buildWorld, updatePow} from '../engine/world.js';
import {spawnActors3, syncActors3} from '../engine/actors.js';
import {cam, camUpdate} from '../engine/camera.js';
import {banner, hint, setGlow, updHearts} from '../ui/hud.js';
import {resetExtras, powerRespawnTick} from './extras.js';
import {endPhase} from '../main.js';
// build the maze world for phase P (see the phase objects in p2/p3 for the fields used here)
export function startMazePhase(P,m){
  newMazeGame(m,P.cfg); GS.G.hearts=P.hearts||3; updHearts();
  buildWorld(m,P.world); P.buildEnv(m); spawnActors3(P.world.name);
  resetExtras(); if(P.setup) P.setup(); setGlow(P.color);
  GS.hooks=P.hooks();
  P.camera(); camUpdate(0,GS.G.hero.x,GS.G.hero.y,true);
  GS.mode='seq'; setSong(null);
}
// what runs when the intro camera move ends
export function mazeGo(P){ const n=GS.phase; return ()=>{ GS.mode='play'; cam.bl=1; banner('PHASE '+n,P.name,P.color); setSong(P.song); setTimeout(()=>{ if(GS.P===P&&GS.mode==='play') hint(P.hint(),3.5); },1600); }; }
export function mazePlayTick(P,dt){
  mazeTick(dt); powerRespawnTick(dt); if(P.extraTick) P.extraTick(dt);
  if(GS.mode==='play'&&GS.G.small<=0) endPhase();
}
export function mazeSync(dt){ syncActors3(dt); updatePow(performance.now()/1000); }
