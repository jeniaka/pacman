// ================= PHASE TEMPLATE =================
// A small, complete phase to copy when adding a new one (see README.md in this folder).
// It is not in the phase list. To try it, import it in index.js and add it to the list.
// This one is a tiny neon Pac-Man maze: eat every dot to win, 3 glitches chase you.
import * as THREE from 'three';
import {GS} from '../core/state.js';
import {clamp, ease, easeOut} from '../core/utils.js';
import {SFX} from '../core/audio.js';
import {parseMaze} from '../core/maze.js';
import {mazeTick} from '../core/maze-game.js';
import {_v, _v2, _v3, envFrom, hemi, sun, SUN} from '../engine/renderer.js';
import {hideDot3, layoutWalls} from '../engine/world.js';
import {cam, camPose} from '../engine/camera.js';
import {burstAt, pop3} from '../engine/actors.js';
import {buildSpaceEnv} from '../engine/environments.js';
import {banner, hint, flash} from '../ui/hud.js';
import {startMazePhase, mazeGo, mazePlayTick, mazeSync} from './maze-phase.js';
import {hurtHero, runSeq} from '../main.js';

// '#' wall, '.' dot, 'o' power diamond, ' ' empty
const ROWS=[
  '#################',
  '#o.....#.#.....o#',
  '#.###.......###.#',
  '#.#...#####...#.#',
  '#...#.......#...#',
  '###.#.## ##.#.###',
  '#.....#   #.....#',
  '#.###.## ##.###.#',
  '#o......#......o#',
  '#################',
];
const P={
  name:'TEMPLATE', color:'#7dff4a', song:'p2',
  deathText:'Back to the drawing board.',
  ui:{cam:'follow', sun:24, bloom:[.42,.32]},
  // rules for the shared maze game (core/maze-game.js): start cells, enemy count and release times, speeds, power time
  cfg:{hero:[8,8],spawns:[[8,6],[7,6],[9,6]],exit:[8,5],enemies:3,release:[1,3,5],heroSpd:7.5,enSpd:6,fright:6,corners:[[16,-2],[0,-2],[16,10],[0,10]],dur:999},
  // look of the maze (engine/world.js): glowing blue blocks like the 1980 walls
  world:{name:'template', wallH:1.2, bodyMat:()=>new THREE.MeshStandardMaterial({color:0x1a2a8a,emissive:0x2a4aff,emissiveIntensity:.45,roughness:.3,metalness:.4})},
  buildEnv(){ buildSpaceEnv(); envFrom('#0a0c30','#2a2a7a','#04040c'); hemi.intensity=.6; sun.intensity=1.4; SUN.dir.set(-20,50,30).normalize(); },
  hint:()=>'EAT EVERY DOT',
  hooks:()=>({
    hit:e=>{ if(e){ e.dx=-e.dx; e.dy=-e.dy; e.decided=false; } hurtHero('CAUGHT'); },
    dot:(i,d)=>{ hideDot3(i); if(d===2) hint('POWER!',1.2); },
    eatEnemy:(e,pts)=>{ burstAt(e.x,e.y,1,24,[e.col,'#fff'],9,.25,.9); pop3(e.x,e.y,String(pts)); },
  }),
  camera(){ cam.hgt=18; cam.back=9; cam.ahead=1; cam.k=5; cam.fov=55; },
  start(){
    startMazePhase(P,parseMaze(ROWS,false,false));
    camPose(_v.set(0,40,30),_v2.set(0,0,0),_v3.set(0,1,0)); cam.bl=0; GS.W3.rise=0;
    runSeq(2.2,(t)=>{ GS.W3.rise=easeOut(clamp(t/1.6,0,1)); layoutWalls(); cam.bl=ease(clamp(t/2,0,1)); },mazeGo(P));
  },
  tick(dt){ mazePlayTick(P,dt); },     // calls endPhase() when every dot is eaten
  deadTick(dt){ mazeTick(dt); },
  sync:mazeSync,
  outro(next){ banner('TEMPLATE','CLEARED',P.color); SFX.win(); flash(.6); runSeq(1.5,()=>{},next); },
  hud:()=>({left:'DOTS LEFT '+Math.max(0,GS.G.small)}),
  mini:{cs:6, scale:[1,1.4], wall:'#3a6aff', bg:'rgba(4,4,20,.85)', dot:'#ffe8a0', pow:'#29f0ff'},
};
export default P;
