// Scratch state shared by the maze phases (MEAN STREETS, HELL MAZE): traffic, missions, ammo, kills...
// Each phase fills what it needs in its setup() and empties it in clear().
import {GS} from '../core/state.js';
import {irand} from '../core/utils.js';
import {OPEN, wdx, wdy} from '../core/maze.js';
export const X={};
export function resetExtras(){ for(const k in X) delete X[k]; X.powT=0; }
// keep a couple of power diamonds on the map: a new one every 10 s while fewer than 2 are left
function placePower(minD){
  const m=GS.G.m, h=GS.G.hero;
  for(let tries=0;tries<200;tries++){
    const x=irand(0,m.W-1), y=irand(0,m.H-1), i=y*m.W+x;
    if(m.cell[i]!==OPEN||m.dot[i]) continue;
    if(Math.hypot(wdx(m,h.x,x),wdy(m,h.y,y))<minD) continue;
    m.dot[i]=2; if(!GS.W3.powList.includes(i)) GS.W3.powList.push(i); GS.G.dots++; return [x,y];
  }
  return null;
}
function powCount(){ let c=0; for(const i of GS.W3.powList) if(GS.G.m.dot[i]===2) c++; return c; }
export function powerRespawnTick(dt){ X.powT=(X.powT||0)+dt; if(X.powT>10){ X.powT=0; if(powCount()<2) placePower(6); } }
