import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';
import {GS} from '../core/state.js';
import {clamp, ease, lerp, mulberry, PI, pick, rand, TAU, TOUCH} from '../core/utils.js';
import {inp} from '../core/input.js';
import {noise, setSong, SFX, tone} from '../core/audio.js';
import {DIRS} from '../core/maze.js';
import {addScore} from '../core/maze-game.js';
import {_c, _m4, _o, _v, _v2, _v3, basisMat, envFrom, hemi, mapFlat, S, scene, SUN, sun, ZERO} from '../engine/renderer.js';
import {cvTex, cvTex2, fbm, grain, hg, once, pxFill} from '../engine/textures.js';
import {clearWorld, dotGeo, powGeo, updatePow} from '../engine/world.js';
import {makeBot, makeVirus} from '../engine/models.js';
import {cam, camPose, camUpdate} from '../engine/camera.js';
import {buildSpaceEnv} from '../engine/environments.js';
import {A3, burstAt, pop3, syncActors3} from '../engine/actors.js';
import {miniC, miniX} from '../ui/minimap.js';
import {banner, flash, hint, setGlow, updHearts} from '../ui/hud.js';
import {endPhase, hurtHero, runSeq} from '../main.js';
// ================= PHASE 5: LAND GRAB (Xonix meets MUNCHBOT) =================
// Leave the safe land to draw a line through the glitch sea; close it to claim every pocket without a glitch.
// Pac twist: power diamonds turn the glitches blue: eat them, or close a line around them to trap them.
const GW=34, GH=24, LAND=1, SEA=0, TRAIL=2;
export const GR={};
const grabTileT=once(()=>{ const W=256;
  const T=cvTex2(W,W,(g,b,w,h)=>{
    const gr=g.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#18206a'); gr.addColorStop(1,'#0c1040'); g.fillStyle=gr; g.fillRect(0,0,w,h);
    b.fillStyle=hg(200); b.fillRect(0,0,w,h);
    for(const [ins,lw] of [[22,9],[46,5]]){ g.strokeStyle='#3a7aff'; g.lineWidth=lw; g.beginPath(); g.roundRect(ins,ins,w-2*ins,h-2*ins,26-ins*.3); g.stroke(); b.strokeStyle=hg(240); b.lineWidth=lw+2; b.beginPath(); b.roundRect(ins,ins,w-2*ins,h-2*ins,26-ins*.3); b.stroke(); }
    g.fillStyle='rgba(255,255,255,.07)'; g.fillRect(0,0,w,h*.45);
    grain(g,b,w,h,8,.18,21,3,.06);
  },false);
  const E=cvTex(W,W,(g,w,h)=>{ g.fillStyle='#000'; g.fillRect(0,0,w,h); g.save(); g.shadowColor='#2a6aff'; g.shadowBlur=14;
    for(const [ins,lw] of [[22,7],[46,4]]){ g.strokeStyle='#4a8aff'; g.lineWidth=lw; g.beginPath(); g.roundRect(ins,ins,w-2*ins,h-2*ins,26-ins*.3); g.stroke(); } g.restore(); });
  return {map:T.map,bump:T.bump,em:E};
});
const grabSeaT=once(()=>{ const W=256;
  const map=cvTex(W,W,(g,w,h)=>{ pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*4,y/h*4,4,4); return [6+n*14,4+n*8,20+n*30]; });
    g.strokeStyle='rgba(120,80,255,.35)'; g.lineWidth=2; g.strokeRect(1,1,w-2,h-2); },true);
  const em=cvTex(W,W,(g,w,h)=>{ g.fillStyle='#000'; g.fillRect(0,0,w,h); g.strokeStyle='#5a2ad0'; g.lineWidth=2.5; g.strokeRect(1.25,1.25,w-2.5,h-2.5);
    g.fillStyle='#3a1a90'; for(const [x,y] of [[0,0],[w,0],[0,h],[w,h]]){ g.beginPath(); g.arc(x,y,7,0,TAU); g.fill(); } },true);
  return {map,em};
});
const tileGeo=new RoundedBoxGeometry(1,1,1,3,.07), trailGeo=new RoundedBoxGeometry(1,1,1,2,.12);
const gIdx=(x,y)=>x<0||y<0||x>=GW||y>=GH?-1:y*GW+x;
export function grabSetup(){
  const W=GW, H=GH, c=new Uint8Array(W*H), dot=new Uint8Array(W*H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const border=x<2||y<2||x>=W-2||y>=H-2; c[y*W+x]=border?LAND:SEA; if(!border&&x%2===1&&y%2===1) dot[y*W+x]=1; }
  for(const [x,y] of [[7,6],[W-8,6],[7,H-7],[W-8,H-7]]) dot[y*W+x]=2;
  const m={W,H,wrapX:false,wrapY:false,cell:c,dot,solid:new Uint8Array(W*H),hgt:new Float32Array(W*H)};
  const g=new THREE.Group(); scene.add(g);
  GS.W3={g,m,style:'grab',map:mapFlat(m),rise:1,bg:new THREE.Group(),actors:new THREE.Group(),fx:new THREE.Group(),powList:[],t:0,heroH:0};
  g.add(GS.W3.bg,GS.W3.actors,GS.W3.fx);
  buildSpaceEnv();
  envFrom('#0a0c30','#2a2a7a','#04040c',[['#8aa0ff',0,30,10,5],['#ff60d0',-30,8,-20,3]]);
  sun.color.set(0xd8d0ff); sun.intensity=1.6; SUN.dir.set(-20,50,30).normalize(); hemi.intensity=.55;
  // glitch sea + plinth
  const st=grabSeaT(); st.map.repeat.set(W,H); st.em.repeat.set(W,H);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(W*S,H*S),new THREE.MeshStandardMaterial({color:0xffffff,map:st.map,emissive:0xffffff,emissiveMap:st.em,emissiveIntensity:.8,roughness:.25,metalness:.5}));
  sea.rotation.x=-PI/2; sea.position.y=-.06; sea.receiveShadow=true; g.add(sea); GS.W3.sea=st;
  const pl=new THREE.Mesh(new RoundedBoxGeometry(W*S+1.2,6,H*S+1.2,3,.4),new THREE.MeshStandardMaterial({color:0x10122a,roughness:.35,metalness:.8})); pl.position.y=-3.1; pl.receiveShadow=true; g.add(pl);
  // land tiles, trail, dots, power diamonds
  const tt=grabTileT();
  const tm=new THREE.MeshStandardMaterial({color:0xffffff,map:tt.map,bumpMap:tt.bump,bumpScale:1.2,emissive:0xffffff,emissiveMap:tt.em,emissiveIntensity:1.1,roughness:.3,metalness:.4});
  GS.W3.tiles=new THREE.InstancedMesh(tileGeo,tm,W*H); GS.W3.tiles.castShadow=GS.W3.tiles.receiveShadow=true; g.add(GS.W3.tiles);
  GS.W3.trail=new THREE.InstancedMesh(trailGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(.5,2.6,.9),toneMapped:false}),W*H); g.add(GS.W3.trail);
  GS.W3.dotMesh=new THREE.InstancedMesh(dotGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.4,.7),toneMapped:false}),W*H); g.add(GS.W3.dotMesh);
  GS.W3.powMesh=new THREE.InstancedMesh(powGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(.6,2.2,2.4),toneMapped:false}),24); g.add(GS.W3.powMesh);
  for(let i=0;i<W*H;i++){ GS.W3.tiles.setMatrixAt(i,ZERO); GS.W3.trail.setMatrixAt(i,ZERO); GS.W3.dotMesh.setMatrixAt(i,ZERO); GS.W3.tiles.setColorAt(i,_c.setRGB(1,1,1)); if(dot[i]===2) GS.W3.powList.push(i); }
  Object.assign(GR,{c,m,trail:[],drawing:false,cx:17,cy:0,dx:0,dy:0,p:0,lastLand:[17,0],anim:[],claimed:0,total:(W-4)*(H-4),target:.75,pct:0,powT:0,won:false,winT:0,combo:0,spd:7.6});
  for(let i=0;i<W*H;i++){ if(c[i]===LAND) setTile(i,1); if(dot[i]===1) setDot(i,true); }
  GS.W3.tiles.instanceMatrix.needsUpdate=true; GS.W3.tiles.instanceColor.needsUpdate=true; GS.W3.dotMesh.instanceMatrix.needsUpdate=true; GS.W3.trail.instanceMatrix.needsUpdate=true;
  // game state shim used by the shared HUD / hearts / camera code
  GS.G={m,cfg:{dur:999,fright:7,heroSpd:8},t:0,hero:{x:17,y:0,dx:0,dy:0,wx:0,wy:0,fx:0,fy:1,alive:true,mouth:0},en:[],small:1,smallTotal:1,dots:1,
    hearts:3,fright:0,frightMax:7,inv:0,turbo:0,ramp:0,fields:{},items:[],bombs:[]};
  A3.hero=makeBot(); GS.W3.actors.add(A3.hero); A3.hero.userData.fx=0; A3.hero.userData.fy=1; A3.en=[]; A3.style='virus';
  const cols=['#ff3b3b','#ff7ad8','#29f0ff','#ffb020'];
  const seaCells=[]; for(let y=6;y<H-4;y++) for(let x=4;x<W-4;x++) if(c[y*W+x]===SEA) seaCells.push([x,y]);
  const R=mulberry(555+GS.loop);
  cols.forEach((col,k)=>{ const [x,y]=seaCells[(R()*seaCells.length)|0]; GS.G.en.push({k,x,y,vx:R()<.5?1:-1,vy:R()<.5?1:-1,dx:0,dy:0,col,st:'run',fr:false,bob:R()*6,spin:0,land:false,pers:k,dead:0}); });
  const nLand=1+(GS.loop>0?1:0);
  for(let j=0;j<nLand;j++){ const k=cols.length+j, e={k,x:j?W-6:5,y:H-1,vx:j?-1:1,vy:-1,dx:0,dy:0,col:'#a66bff',st:'run',fr:false,bob:0,spin:0,land:true,pers:0,dead:0};
    GS.G.en.push(e); const o=makeVirus(e.col,'drone'); GS.W3.actors.add(o); A3.en[k]=o; o.userData.fx=0; o.userData.fy=1; }
  GS.hooks={}; grabCount();
}
function setTile(i,k){ const x=i%GW, y=(i/GW)|0, hgt=Math.max(.001,.5*k); GS.W3.map(x,y,hgt/2-.05,_o); basisMat(_m4,_o,1.94,hgt,1.94); GS.W3.tiles.setMatrixAt(i,_m4); }
function setTrail(i,on){ if(!on){ GS.W3.trail.setMatrixAt(i,ZERO); return; } const x=i%GW, y=(i/GW)|0; GS.W3.map(x,y,.06,_o); basisMat(_m4,_o,1.3,.16,1.3); GS.W3.trail.setMatrixAt(i,_m4); }
function setDot(i,on){ if(!on){ GS.W3.dotMesh.setMatrixAt(i,ZERO); return; } const x=i%GW, y=(i/GW)|0; GS.W3.map(x,y,.55,_o); basisMat(_m4,_o,.8,1,.8); GS.W3.dotMesh.setMatrixAt(i,_m4); }
function grabCount(){ let n=0; const c=GR.c; for(let y=2;y<GH-2;y++) for(let x=2;x<GW-2;x++) if(c[y*GW+x]===LAND) n++; GR.claimed=n; GR.pct=n/GR.total; }
function grabPower(){ GS.G.fright=7; GS.G.frightMax=7; GR.combo=0; for(const e of GS.G.en) if(e.st!=='dead') e.fr=true; SFX.power(); hint('POWER! EAT THE GLITCHES OR TRAP THEM INSIDE A LINE',2.2); }
function grabEat(e,trap){
  e.st='dead'; e.dead=trap?7:6; e.fr=false; GR.combo++; const pts=(trap?800:400)*GR.combo; addScore(pts);
  burstAt(e.x,e.y,1,36,[e.col,'#ffffff','#2a8a96'],9,.25,.9); pop3(e.x,e.y,(trap?'TRAPPED ':'')+pts,trap?'#7dff4a':'#29f0ff',2.4); SFX.eatEnemy(); if(trap) cam.shake=Math.max(cam.shake,.3);
}
function grabHurt(why){
  const h=GS.G.hero, before=GS.G.hearts; hurtHero(why);
  if(GS.G.hearts<before&&GS.G.hero.alive){ for(const i of GR.trail){ GR.c[i]=SEA; setTrail(i,false); } GS.W3.trail.instanceMatrix.needsUpdate=true; GR.trail=[]; GR.drawing=false;
    [GR.cx,GR.cy]=GR.lastLand; GR.p=0; GR.dx=GR.dy=0; h.wx=h.wy=0; h.x=GR.cx; h.y=GR.cy; }
}
function grabArrive(){
  const c=GR.c, i=gIdx(GR.cx,GR.cy), m=GR.m;
  if(c[i]===SEA){
    if(!GR.drawing){ GR.drawing=true; tone({f:520,f2:780,d:.08,v:.05,type:'square',lp:2500}); }
    c[i]=TRAIL; GR.trail.push(i); setTrail(i,true); GS.W3.trail.instanceMatrix.needsUpdate=true;
    if(m.dot[i]===1){ m.dot[i]=0; setDot(i,false); GS.W3.dotMesh.instanceMatrix.needsUpdate=true; addScore(10); SFX.munch(); }
    else if(m.dot[i]===2){ m.dot[i]=0; addScore(50); grabPower(); }
  } else if(c[i]===LAND){ GR.lastLand=[GR.cx,GR.cy]; if(GR.drawing) grabClose(); }
}
function grabClose(){
  const c=GR.c, m=GR.m, W=GW, H=GH, newly=[];
  for(const i of GR.trail){ c[i]=LAND; newly.push(i); setTrail(i,false); } GR.trail=[]; GR.drawing=false; GS.W3.trail.instanceMatrix.needsUpdate=true;
  // split the sea into pockets. A pocket stays sea if a normal glitch is in it; the biggest pocket always stays.
  // Every other pocket is claimed, including pockets that only hold blue glitches (they get trapped).
  const lab=new Int32Array(W*H).fill(-1), pk=[];
  for(let s0=0;s0<W*H;s0++){ if(c[s0]!==SEA||lab[s0]>=0) continue; const id=pk.length, st=[s0]; lab[s0]=id; let n=0;
    while(st.length){ const i=st.pop(); n++; const x=i%W, y=(i/W)|0; for(const [dx,dy] of DIRS){ const j=gIdx(x+dx,y+dy); if(j>=0&&lab[j]<0&&c[j]===SEA){ lab[j]=id; st.push(j); } } }
    pk.push({n,keep:false}); }
  for(const e of GS.G.en){ if(e.land||e.st==='dead'||e.fr) continue; const i=gIdx(Math.round(e.x),Math.round(e.y)); if(i>=0&&lab[i]>=0) pk[lab[i]].keep=true; }
  if(pk.length){ let big=0; for(let k=1;k<pk.length;k++) if(pk[k].n>pk[big].n) big=k; pk[big].keep=true; }
  for(let i=0;i<W*H;i++) if(c[i]===SEA&&!pk[lab[i]].keep){ c[i]=LAND; newly.push(i); }
  let dots=0, pw=false;
  for(const i of newly){ if(m.dot[i]===1){ dots++; m.dot[i]=0; setDot(i,false); } else if(m.dot[i]===2){ pw=true; m.dot[i]=0; } }
  GS.W3.dotMesh.instanceMatrix.needsUpdate=true;
  // blue glitches caught inside the new land are trapped
  for(const e of GS.G.en){ if(e.land||e.st==='dead') continue; const i=gIdx(Math.round(e.x),Math.round(e.y)); if(i>=0&&c[i]===LAND) grabEat(e,true); }
  const pts=newly.length*10+dots*10; addScore(pts);
  const hx=GR.cx, hy=GR.cy;
  for(const i of newly){ const x=i%W, y=(i/W)|0; GR.anim.push({i,t:-Math.hypot(x-hx,y-hy)*.025}); }
  grabCount();
  SFX.coin(); noise({f:300,f2:3000,d:.35,v:.08,ft:'bandpass',q:1});
  if(newly.length>=10) pop3(hx,hy,'+'+pts,'#7dff4a',2.5);
  if(newly.length>=120){ banner('HUGE','GRAB!','#7dff4a'); cam.shake=Math.max(cam.shake,.35); }
  if(pw) grabPower();
  if(GR.pct>=GR.target&&!GR.won){ GR.won=true; endPhase(); }
}
// claimed enough: the rest of the sea floods up as land, then the flow moves on
function grabOutro(next){
  SFX.win(); banner('GRID','CLAIMED','#7dff4a'); flash(.6);
  const c=GR.c; for(let i=0;i<GW*GH;i++) if(c[i]!==LAND){ c[i]=LAND; setTrail(i,false); setDot(i,false); const x=i%GW, y=(i/GW)|0; GR.anim.push({i,t:-.3-Math.hypot(x-GR.cx,y-GR.cy)*.03}); }
  GS.W3.trail.instanceMatrix.needsUpdate=true; GS.W3.dotMesh.instanceMatrix.needsUpdate=true; GR.m.dot.fill(0); addScore(5000); pop3(GR.cx,GR.cy,'+5000','#ffd04a',3);
  runSeq(2.6,()=>{},next);
}
function grabHeroTick(dt){
  const h=GS.G.hero, c=GR.c;
  if(inp.has){ h.wx=inp.dx; h.wy=inp.dy; inp.has=false; }
  let d=GR.spd*GS.speedMul*dt, guard=0;
  while(d>0&&h.alive&&guard++<40){
    if(GR.p===0){
      const ok=(dx,dy)=>{ const j=gIdx(GR.cx+dx,GR.cy+dy); return j>=0&&c[j]!==TRAIL; };
      if((h.wx||h.wy)&&!(GR.drawing&&h.wx===-GR.dx&&h.wy===-GR.dy&&(GR.dx||GR.dy))&&ok(h.wx,h.wy)){ GR.dx=h.wx; GR.dy=h.wy; }
      if(!(GR.dx||GR.dy)||!ok(GR.dx,GR.dy)){ GR.dx=GR.dy=0; break; }
    }
    const step=Math.min(d,1-GR.p); GR.p+=step; d-=step;
    if(GR.p>=1-1e-6){ GR.p=0; GR.cx+=GR.dx; GR.cy+=GR.dy; grabArrive(); if(GS.mode!=='play') break; }
  }
  h.x=GR.cx+GR.dx*GR.p; h.y=GR.cy+GR.dy*GR.p; h.dx=GR.dx; h.dy=GR.dy;
  if(GR.dx||GR.dy){ h.fx=GR.dx; h.fy=GR.dy; h.mouth+=dt*14; }
}
function grabBlocked(e,x,y){ const i=gIdx(x,y); if(i<0) return true; const v=GR.c[i]; return e.land?v!==LAND:v===LAND; }
function grabRespawn(e){
  const h=GS.G.hero, c=GR.c, cand=[];
  for(let y=0;y<GH;y++) for(let x=0;x<GW;x++){ const v=c[y*GW+x]; if((e.land?v===LAND:v===SEA)&&Math.hypot(x-h.x,y-h.y)>9) cand.push([x,y]); }
  if(!cand.length){ e.dead=2; return; }
  const [x,y]=pick(cand); e.x=x; e.y=y; e.st='run'; e.fr=GS.G.fright>0; burstAt(x,y,1,20,[e.col,'#fff'],6,.2,.6);
}
function grabEnemyTick(dt){
  const h=GS.G.hero, c=GR.c, heroCell=gIdx(GR.cx,GR.cy), heroInSea=GR.drawing;
  for(const e of GS.G.en){
    e.bob+=dt*4; e.spin+=dt*3;
    if(e.st==='dead'){ e.dead-=dt; if(e.dead<=0) grabRespawn(e); continue; }
    let rem=(e.land?3:4.2)*GS.speedMul*(e.fr?.65:1)*dt;
    while(rem>0){ const s=Math.min(rem,.2); rem-=s;
      const sx=Math.sign(e.vx), sy=Math.sign(e.vy), nx=e.x+e.vx*s, ny=e.y+e.vy*s;
      let bx=grabBlocked(e,Math.round(nx+sx*.5),Math.round(e.y)), by=grabBlocked(e,Math.round(e.x),Math.round(ny+sy*.5));
      if(!bx&&!by&&grabBlocked(e,Math.round(nx+sx*.5),Math.round(ny+sy*.5))) bx=by=true;
      if(bx) e.vx=-e.vx; else e.x=nx; if(by) e.vy=-e.vy; else e.y=ny;
      if((bx||by)&&!e.land&&Math.random()<.3) tone({f:rand(300,500),d:.03,v:.012,type:'square'}); }
    e.dx=Math.sign(e.vx)*.7; e.dy=Math.sign(e.vy)*.7;
    if(!h.alive||GS.mode!=='play') continue;
    const ci=gIdx(Math.round(e.x),Math.round(e.y));
    if(!e.land&&!e.fr&&ci>=0&&c[ci]===TRAIL&&GS.G.inv<=0){ burstAt(e.x,e.y,.3,20,['#7dff4a','#fff'],6,.15,.5); grabHurt('A GLITCH CUT YOUR LINE'); continue; }
    if(Math.hypot(e.x-h.x,e.y-h.y)<.85){ if(e.fr) grabEat(e,false); else if((e.land||heroInSea)&&GS.G.inv<=0) grabHurt(e.land?'THE LAND GLITCH GOT YOU':'CAUGHT IN THE SEA'); }
  }
}
export function grabTick(dt){
  GS.G.t+=dt; if(GS.G.inv>0) GS.G.inv-=dt;
  if(GS.G.fright>0){ GS.G.fright-=dt; if(GS.G.fright<=0) for(const e of GS.G.en) e.fr=false; }
  if(GS.mode==='play'&&GS.G.hero.alive) grabHeroTick(dt);
  grabEnemyTick(dt);
  // a new power diamond shows up when none is left
  if(!GR.won&&!GS.W3.powList.some(i=>GR.m.dot[i]===2)){ GR.powT+=dt; if(GR.powT>10){ GR.powT=0; const cand=[]; for(let i=0;i<GW*GH;i++){ const x=i%GW, y=(i/GW)|0; if(GR.c[i]===SEA&&Math.hypot(x-GS.G.hero.x,y-GS.G.hero.y)>6) cand.push(i); }
    if(cand.length){ const i=pick(cand); GR.m.dot[i]=2; if(!GS.W3.powList.includes(i)) GS.W3.powList.push(i); SFX.coin(); hint('A POWER DIAMOND APPEARED',1.6); } } }
}
export function grabSync(dt){
  const t=performance.now()/1000, h=GS.G.hero;
  // hero rides on top of the land tiles
  const onLand=GR.c[gIdx(Math.round(h.x),Math.round(h.y))]===LAND; GS.W3.heroH=lerp(GS.W3.heroH||0,onLand?.45:0,1-Math.exp(-dt*14));
  for(const e of GS.G.en) e.hOff=e.land?.45:0;
  // rising tiles
  if(GR.anim.length){ for(const a of GR.anim){ a.t+=dt*1.6; const k=clamp(a.t,0,1), bk=k<1?1+Math.sin(k*PI)*.35:1; setTile(a.i,k*bk); const f=1+Math.max(0,1-k)*1.4; GS.W3.tiles.setColorAt(a.i,_c.setRGB(f*.8,f,f*1.2)); }
    GR.anim=GR.anim.filter(a=>a.t<1.05); GS.W3.tiles.instanceMatrix.needsUpdate=true; GS.W3.tiles.instanceColor.needsUpdate=true; }
  // the line pulses
  GS.W3.trail.material.color.setRGB(.5,2.2+Math.sin(t*10)*.5,.9);
  if(GS.W3.sea){ GS.W3.sea.map.offset.x=Math.sin(t*.2)*.02; }
}
export function drawGrabMini(){
  const cs=innerWidth<640?3:4, W=GW*cs, H=GH*cs;
  if(GS.miniKey!=='grab'+cs){ GS.miniKey='grab'+cs; miniC.width=W; miniC.height=H; const sc=innerWidth<640?1:1.25; miniC.style.width=(W*sc)+'px'; miniC.style.height=(H*sc)+'px'; document.body.style.setProperty('--miniw',(W*sc)+'px'); document.body.style.setProperty('--minih',(H*sc)+'px'); }
  const g=miniX, c=GR.c, t=performance.now()/1000;
  g.fillStyle='#08051a'; g.fillRect(0,0,W,H);
  for(let i=0;i<GW*GH;i++){ const v=c[i]; if(v===SEA){ if(GR.m.dot[i]===1){ g.fillStyle='#ffe8a0'; g.fillRect((i%GW)*cs+cs/2-.5,((i/GW)|0)*cs+cs/2-.5,1,1); } else if(GR.m.dot[i]===2&&(t*4|0)%2){ g.fillStyle='#29f0ff'; g.fillRect((i%GW)*cs,((i/GW)|0)*cs,cs,cs); } continue; }
    g.fillStyle=v===LAND?'#2a4ac8':'#7dff4a'; g.fillRect((i%GW)*cs,((i/GW)|0)*cs,cs,cs); }
  for(const e of GS.G.en){ if(e.st==='dead') continue; g.fillStyle=e.fr?((t*6|0)%2?'#fff':'#3a8aff'):e.col; g.fillRect(e.x*cs-1,e.y*cs-1,cs+2,cs+2); }
  const h=GS.G.hero; g.fillStyle=(t*6|0)%2?'#7dff4a':'#ffffff'; g.fillRect(h.x*cs-1,h.y*cs-1,cs+2,cs+2);
}
export function grabHint(){ return TOUCH?'SWIPE TO STEER · LEAVE THE BLUE LAND TO DRAW A LINE · CLOSE IT TO CLAIM · CLAIM 75%':'ARROWS STEER · LEAVE THE BLUE LAND TO DRAW A LINE · CLOSE IT TO CLAIM · CLAIM 75%'; }
export const grabCamX=()=>lerp((GW-1)/2,GS.G.hero.x,.55), grabCamY=()=>lerp((GH-1)/2,GS.G.hero.y,.5);
// ---------- phase object ----------
const ORIGIN=new THREE.Vector3();
const P5={
  name:'LAND GRAB', color:'#29f0ff', song:'boss',
  deathText:'The glitches kept the grid.',
  ui:{cam:'follow', bloom:[.42,.32], sun:40},
  start(){
    clearWorld(); grabSetup(); setGlow(P5.color); updHearts(); GS.mode='seq'; setSong(null);
    cam.hgt=35; cam.back=21; cam.ahead=0; cam.k=3; cam.fov=55;
    camUpdate(0,grabCamX(),grabCamY(),true);
    camPose(_v.set(0,70,40),_v2.set(0,0,0),_v3.set(0,1,0)); cam.bl=0; flash(.7);
    runSeq(2.6,(t)=>{ cam.bl=ease(clamp((t-.3)/2.1,0,1)); },()=>{ GS.mode='play'; cam.bl=1; banner('PHASE '+GS.phase,P5.name,P5.color); setSong(P5.song); setTimeout(()=>{ if(GS.P===P5&&GS.mode==='play') hint(grabHint(),4.5); },1600); });
  },
  tick:grabTick, deadTick:grabTick,
  sync(dt){ syncActors3(dt); updatePow(performance.now()/1000); grabSync(dt); },
  camTarget:()=>[grabCamX(),grabCamY()],
  sunTarget:()=>ORIGIN,
  outro:grabOutro,
  hud(){ return {progress:GR.pct/GR.target, left:'CLAIMED '+Math.floor(GR.pct*100)+'% / '+Math.round(GR.target*100)+'%'}; },
  minimap:drawGrabMini,
};
export default P5;
