import {GS} from './state.js';
import {pick} from './utils.js';
import {inp, keys, ptr} from './input.js';
import {SFX} from './audio.js';
import {DIRS, OPEN, WALL, bfs, cellAt, idxOf, stepActor, wdx, wdy} from './maze.js';
// ================= MAZE GAME (shared by phases 1-4) =================
export const EN_COL=['#ff3b3b','#ffb020','#a66bff','#d8e4ff'];
export const EN_NAME=['SPIKE','ZAP','FUZZ','ROT'];
GS.G=null;
GS.hooks={};
GS.score=0; GS.speedMul=1; GS.loop=0;
export function addScore(n){ GS.score+=n; if(GS.score>GS.HI){ GS.HI=GS.score; try{localStorage.setItem('munchbot80hi',GS.HI)}catch(e){} } }
const passN=c=>c===OPEN, passT=c=>c!==WALL;

export function newMazeGame(m,cfg){
  let dots=0, small=0; for(let i=0;i<m.dot.length;i++){ if(m.dot[i]) dots++; if(m.dot[i]===1) small++; }
  GS.G={m,cfg,t:0,hero:{x:cfg.hero[0],y:cfg.hero[1],dx:-1,dy:0,wx:-1,wy:0,decided:false,mouth:0,fx:-1,fy:0,alive:true},
    en:[],gIdx:0,gT:0,gmode:'scatter',fright:0,frightMax:1,combo:0,dots,total:dots,small,smallTotal:Math.max(1,small),eaten:0,inv:0,turbo:0,ramp:0,
    over:false,fields:{},items:[],bombs:[],hearts:3,frozen:0};
  if(cfg.exit) GS.G.fExit=bfs(m,cfg.exit[0],cfg.exit[1],passT);
  for(let k=0;k<cfg.enemies;k++) spawnEnemy(k,cfg.release[k]??(k*2));
  return GS.G;
}
export function spawnEnemy(k,rel,sp){
  const c=GS.G.cfg, s=sp||c.spawns[k%c.spawns.length];
  const e={k,pers:k%4,col:EN_COL[k%4],x:s[0],y:s[1],sx:s[0],sy:s[1],dx:0,dy:0,decided:false,st:'pen',relT:rel,fr:false,spin:Math.random()*6,dead:0,bob:Math.random()*6};
  if(c.startOut&&k===0){ e.st='run'; e.dx=-1; }
  GS.G.en.push(e); return e;
}
function fieldTo(x,y){
  const key=x+','+y; let f=GS.G.fields[key];
  if(!f){ f=GS.G.fields[key]=bfs(GS.G.m,x,y,passT); }
  return f;
}
function heroPass(x,y){
  const m=GS.G.m, i=idxOf(m,x,y); if(i<0) return false;
  const c=m.cell[i];
  if(c===OPEN) return true;
  if(GS.G.ramp>0&&c===WALL&&!m.solid[i]) return true;
  return false;
}
// first-person: hold forward to walk, turns happen on tile centres, never automatic
function fpsWalkHeld(){ return !!(keys.ArrowUp||keys.KeyW||(ptr.down&&!ptr.moved&&performance.now()-ptr.downT>230)); }
function fpsDecide(h){
  if(h.turnQ){ const q=h.turnQ; h.turnQ=0; const fx=h.fx, fy=h.fy;
    if(q===-1){ h.fx=fy; h.fy=-fx; } else if(q===1){ h.fx=-fy; h.fy=fx; } else { h.fx=-fx; h.fy=-fy; } }
  if(fpsWalkHeld()&&heroPass(h.x+h.fx,h.y+h.fy)){ h.dx=h.fx; h.dy=h.fy; } else { h.dx=0; h.dy=0; }
}
function fpsHeroMove(h,sp,dt){
  if(inp.has){ inp.has=false;
    if(inp.dx<0) h.turnQ=-1; else if(inp.dx>0) h.turnQ=1;
    else if(inp.dy>0){ if(h.dx||h.dy){ h.dx=-h.dx; h.dy=-h.dy; h.fx=h.dx; h.fy=h.dy; h.decided=false; h.turnQ=0; } else h.turnQ=2; }
  }
  stepActor(GS.G.m,h,sp*dt,fpsDecide);
}
function heroDecide(h){
  const c=GS.G.cfg;
  if((h.wx||h.wy)&&heroPass(h.x+h.wx,h.y+h.wy)){ h.dx=h.wx; h.dy=h.wy; }
  else if(c.fps&&!h.dx&&!h.dy){ if(h.wx||h.wy){ h.fx=h.wx; h.fy=h.wy; } }
  else if(!heroPass(h.x+h.dx,h.y+h.dy)){
    if(c.fps){ const opts=[[h.dy,-h.dx],[-h.dy,h.dx]].filter(d=>heroPass(h.x+d[0],h.y+d[1]));
      if(opts.length===1){ h.dx=opts[0][0]; h.dy=opts[0][1]; h.wx=h.dx; h.wy=h.dy; } else { h.fx=h.dx; h.fy=h.dy; h.dx=0; h.dy=0; } }
    else { h.dx=0; h.dy=0; }
  }
  if(h.dx||h.dy){
    const i=idxOf(GS.G.m,h.x+h.dx,h.y+h.dy);
    if(i>=0&&GS.G.m.cell[i]===WALL&&GS.hooks.smash) GS.hooks.smash(i);
  }
}
function enTarget(e){
  const h=GS.G.hero, m=GS.G.m;
  if(GS.G.over) return [h.x,h.y];
  if(GS.G.gmode==='scatter'&&!GS.G.cfg.noScatter) return GS.G.cfg.corners[e.k%4];
  const hx=Math.round(h.x), hy=Math.round(h.y), fx=h.fx, fy=h.fy;
  switch(e.pers){
    case 0: return [hx,hy];
    case 1: return [hx+fx*4,hy+fy*4];
    case 2: { const l=GS.G.en[0]||e; const px=hx+fx*2, py=hy+fy*2; return [px+(px-Math.round(l.x)),py+(py-Math.round(l.y))]; }
    default: { const d=Math.hypot(wdx(m,e.x,hx),wdy(m,e.y,hy)); return d>8?[hx,hy]:GS.G.cfg.corners[e.k%4]; }
  }
}
function enDecide(e){
  const ex=GS.G.cfg.exit;
  if(e.st==='leave'&&(!ex||(e.x===ex[0]&&e.y===ex[1]))){ e.st='run'; e.dx=0; e.dy=0; }
  if(e.st==='eaten'&&e.x===e.sx&&e.y===e.sy){ e.fr=false; e.dx=0; e.dy=0; if(ex) e.st='leave'; else { e.st='pen'; e.relT=.4; return; } }
  const m=GS.G.m, field=e.st==='leave'||e.st==='eaten';
  const pass=field?passT:passN;
  const cand=[];
  for(const [dx,dy] of DIRS){
    if(!field&&(e.dx||e.dy)&&dx===-e.dx&&dy===-e.dy) continue;
    if(pass(cellAt(m,e.x+dx,e.y+dy))) cand.push([dx,dy]);
  }
  if(!cand.length){ if(e.dx||e.dy){ e.dx=-e.dx; e.dy=-e.dy; } return; }
  let best=cand[0];
  if(field){
    const F=e.st==='leave'?GS.G.fExit:fieldTo(e.sx,e.sy);
    let bd=1e9; for(const c of cand){ const v=F[idxOf(m,e.x+c[0],e.y+c[1])]; if(v>=0&&v<bd){bd=v;best=c;} }
  } else if(e.fr){ best=pick(cand); }
  else {
    const [tx,ty]=enTarget(e); let bd=1e9;
    for(const c of cand){ const ddx=wdx(m,e.x+c[0],tx), ddy=wdy(m,e.y+c[1],ty), d=ddx*ddx+ddy*ddy; if(d<bd-1e-6){bd=d;best=c;} }
  }
  e.dx=best[0]; e.dy=best[1];
}
function reverseRunners(){ for(const e of GS.G.en) if(e.st==='run'){ e.dx=-e.dx; e.dy=-e.dy; e.decided=false; } }
export function startFright(dur){
  GS.G.fright=dur; GS.G.frightMax=dur; GS.G.combo=0;
  for(const e of GS.G.en) if((e.st==='run'||e.st==='pen'||e.st==='leave')&&!e.boss){ e.fr=true; }
  for(const e of GS.G.en) if(e.st==='run'&&!e.boss){ e.dx=-e.dx; e.dy=-e.dy; e.decided=false; }
}
function eatDotAt(i){
  const m=GS.G.m, d=m.dot[i]; if(!d) return;
  m.dot[i]=0; GS.G.dots--; GS.G.eaten++; if(d===1) GS.G.small--;
  if(d===1){ addScore(10); SFX[GS.G.cfg.crunch?'crunch':'munch'](); }
  else { addScore(50); SFX.power(); startFright(GS.G.cfg.fright); if(GS.G.cfg.ramp){ GS.G.ramp=GS.G.cfg.fright; } }
  if(GS.hooks.dot) GS.hooks.dot(i,d);
}
export function mazeTick(dt){
  const m=GS.G.m, h=GS.G.hero, c=GS.G.cfg;
  GS.G.t+=dt;
  if(GS.G.inv>0) GS.G.inv-=dt; if(GS.G.turbo>0) GS.G.turbo-=dt; if(GS.G.ramp>0) GS.G.ramp-=dt;
  // global mode schedule
  if(GS.G.fright<=0){
    GS.G.gT+=dt; const S=[['scatter',4],['chase',18],['scatter',4],['chase',1e9]];
    if(GS.G.gT>S[GS.G.gIdx][1]){ GS.G.gT=0; GS.G.gIdx=Math.min(GS.G.gIdx+1,S.length-1); GS.G.gmode=S[GS.G.gIdx][0]; reverseRunners(); }
  } else { GS.G.fright-=dt; if(GS.G.fright<=0){ for(const e of GS.G.en) e.fr=false; } }
  // hero
  if(h.alive&&GS.G.frozen<=0){
    const sp=c.heroSpd*GS.speedMul*(GS.G.turbo>0?1.55:1)*(GS.G.ramp>0?1.15:1);
    if(c.fps) fpsHeroMove(h,sp,dt);
    else {
      if(inp.has){ h.wx=inp.dx; h.wy=inp.dy; inp.has=false; }
      if((h.dx||h.dy)&&h.wx===-h.dx&&h.wy===-h.dy){ h.dx=h.wx; h.dy=h.wy; h.decided=false; }
      stepActor(m,h,sp*dt,heroDecide);
    }
    if(h.dx||h.dy){ h.fx=h.dx; h.fy=h.dy; h.mouth+=dt*14; }
    const rx=Math.round(h.x), ry=Math.round(h.y);
    if(Math.abs(h.x-rx)+Math.abs(h.y-ry)<.5){ const i=idxOf(m,rx,ry); if(i>=0) eatDotAt(i); }
  }
  if(GS.G.frozen>0){ GS.G.frozen-=dt; return; }
  // enemies
  for(const e of GS.G.en){
    e.spin+=dt*(e.fr?2:5); e.bob+=dt*4;
    if(e.st==='dead'){ e.dead-=dt; if(e.dead<=0){ e.x=e.sx; e.y=e.sy; e.dx=e.dy=0; e.st='pen'; e.relT=.6; e.fr=false; } continue; }
    if(e.st==='pen'){ e.relT-=dt; if(e.relT<=0){ e.st=c.exit?'leave':'run'; e.decided=false; } continue; }
    let sp=c.enSpd*GS.speedMul;
    if(e.st==='leave') sp=c.exit?4:sp;
    else if(e.st==='eaten') sp=17;
    else if(e.fr) sp=c.enSpd*.6*GS.speedMul;
    if(GS.G.over) sp=c.enSpd*1.55;
    if(c.enRamp) sp*=1+c.enRamp*Math.min(1,GS.G.t/(c.dur||40));
    stepActor(m,e,sp*dt,enDecide);
    // collide
    if(h.alive&&(e.st==='run'||e.st==='leave')){
      const d=Math.hypot(wdx(m,h.x,e.x),wdy(m,h.y,e.y));
      if(d<(c.hitR||.75)){
        if(e.fr) eatEnemy(e);
        else if(GS.G.inv<=0&&!(GS.GOD&&!GS.G.over)) heroHit(e);
      }
    }
  }
}
function eatEnemy(e){
  GS.G.combo++; const pts=200*Math.pow(2,Math.min(GS.G.combo-1,3)); addScore(pts);
  e.fr=false; SFX.eatEnemy();
  if(GS.hooks.eatEnemy) GS.hooks.eatEnemy(e,pts);
  if(GS.G.cfg.killOnEat){ e.st='dead'; e.dead=2.5; } else { e.st='eaten'; e.decided=false; }
}
function heroHit(e){ if(GS.hooks.hit) GS.hooks.hit(e); }
