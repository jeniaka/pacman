import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';
import {GS} from '../core/state.js';
import {clamp, ease, lerp, mulberry, PI, pick, rand, TAU, TOUCH} from '../core/utils.js';
import {inp} from '../core/input.js';
import {noise, setSong, SFX, tone} from '../core/audio.js';
import {DIRS} from '../core/maze.js';
import {addScore} from '../core/maze-game.js';
import {_c, _m4, _o, _v, _v2, _v3, basisMat, castAll, envFrom, hemi, heroLight, mapFlat, S, scene, SUN, sun, ZERO} from '../engine/renderer.js';
import {cvTex, cvTex2, fbm, grain, hg, once, pxFill, worldUV} from '../engine/textures.js';
import {clearWorld, powGeo, updatePow} from '../engine/world.js';
import {cam, camPose, camUpdate} from '../engine/camera.js';
import {cloudTex, skyDome} from '../engine/environments.js';
import {A3, burstAt, pop3} from '../engine/actors.js';
import {miniC, miniX} from '../ui/minimap.js';
import {banner, flash, hint, setGlow, updHearts} from '../ui/hud.js';
import {endPhase, hurtHero, runSeq} from '../main.js';
// ================= PHASE 5: LAND GRAB (Xonix meets MUNCHBOT) =================
// Leave the safe land to draw a line through the glitch sea; close it to claim every pocket without a glitch.
// Pac twist: power diamonds turn the glitches blue: eat them, or close a line around them to trap them.
const GW=34, GH=24, LAND=1, SEA=0, TRAIL=2;
// how much of the board must be claimed: loop 1, loop 2, loop 3 and after
const CLAIM_GOAL=[.9,.95,.97];
export const GR={};
// ---------- AirXonix look: a grass slab (claimed land) over a sunken stone field, floating on the ocean ----------
const LAND_H=.9; // height of the claimed slab
// two land palettes: grass, and golden sand on even loops
const PAL=[{top:[[58,120,30],[110,176,52]],side:[[64,104,30],[96,70,40]]},{top:[[170,128,40],[226,182,80]],side:[[150,108,40],[110,76,36]]}];
const landT=k=>{ const P=PAL[k];
  const top=cvTex2(512,512,(g,b,w,h)=>{ const R=mulberry(301+k);
    pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*8,y/h*8,8,5), m=fbm(x/w*32+3,y/h*32,32,2), v=clamp(n*.75+m*.35,0,1);
      return [lerp(P.top[0][0],P.top[1][0],v),lerp(P.top[0][1],P.top[1][1],v),lerp(P.top[0][2],P.top[1][2],v)]; });
    for(let i=0;i<5000;i++){ const x=R()*w, y=R()*h, l=2+R()*5, c=R(); g.strokeStyle=k?(c<.5?'rgba(255,230,160,.45)':'rgba(120,80,20,.35)'):(c<.5?'rgba(170,230,90,.5)':'rgba(30,70,10,.45)'); g.lineWidth=1;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+(R()-.5)*2,y-l); g.stroke(); b.strokeStyle=hg(110+R()*140); b.beginPath(); b.moveTo(x,y); b.lineTo(x,y-l); b.stroke(); }
  });
  const side=cvTex2(256,256,(g,b,w,h)=>{
    pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*8,y/h*8,8,4), t=clamp((y/h-.12)*5,0,1), c0=P.side[0], c1=P.side[1], v=.75+n*.5;
      return [lerp(c0[0],c1[0],t)*v,lerp(c0[1],c1[1],t)*v,lerp(c0[2],c1[2],t)*v]; });
    grain(g,b,w,h,8,.2,5,3,.25);
  });
  return {top,side};
};
const landTs=[once(()=>landT(0)),once(()=>landT(1))];
const fieldT=once(()=>cvTex2(512,512,(g,b,w,h)=>{ const R=mulberry(311);
  pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*8,y/h*8,8,5), m=fbm(x/w*64,y/h*64,64,2); const v=138+(n-.5)*56+(m-.5)*36+(R()-.5)*24; return [v,v*.96,v*.88]; });
  for(let i=0;i<900;i++){ const x=R()*w, y=R()*h, r=1+R()*2.6, v=120+R()*100|0; g.fillStyle=`rgb(${v},${v-4},${v-14})`; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); b.fillStyle=hg(170+R()*80); b.beginPath(); b.arc(x,y,r,0,TAU); b.fill(); }
  grain(g,b,w,h,8,.1,9,3,.2);
}));
const oceanT=once(()=>cvTex(512,512,(g,w,h)=>{ pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*8,y/h*8,8,5), r=fbm(x/w*4+7,y/h*16,4,3); const v=n*.6+r*.4; return [40+v*70,62+v*80,82+v*90]; });
  g.strokeStyle='rgba(225,235,245,.28)'; g.lineWidth=1.6; const R=mulberry(77); for(let i=0;i<120;i++){ const x=R()*w, y=R()*h, l=10+R()*34; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+l/2,y-3,x+l,y); g.stroke(); } },true));
const rockT=once(()=>cvTex2(256,256,(g,b,w,h)=>{ pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*8,y/h*4,8,5); return [88+n*70,64+n*50,44+n*34]; }); grain(g,b,w,h,8,.3,4,4,.35); }));
// glossy monster balls: one beach-ball with rainbow segments, the rest solid
const ballTex=once(()=>cvTex(256,128,(g,w,h)=>{ const C=['#ff3a3a','#ffd23a','#3ae06a','#3ab0ff','#c84aff','#ff7a2a','#ffffff','#ff4aa8']; for(let i=0;i<8;i++){ g.fillStyle=C[i]; g.fillRect(i*w/8,0,w/8+1,h); } }));
const BALL_R=.85, ballGeo=new THREE.SphereGeometry(BALL_R,48,32), cubeGeo=new RoundedBoxGeometry(1.1,1.1,1.1,4,.16);
const tileGeo=new THREE.BoxGeometry(1,1,1), trailGeo=new RoundedBoxGeometry(1,1,1,2,.12), pearlGeo=new THREE.SphereGeometry(.14,16,12);
const gIdx=(x,y)=>x<0||y<0||x>=GW||y>=GH?-1:y*GW+x;
// the player's hover craft: a teal saucer with a glass canopy, little wings and a glowing thruster ring
function makeCraft(){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const hull=new THREE.MeshPhysicalMaterial({color:0x1aa8b8,roughness:.25,metalness:.6,clearcoat:1,clearcoatRoughness:.08});
  const dark=new THREE.MeshStandardMaterial({color:0x1a2a34,roughness:.4,metalness:.8});
  const disc=new THREE.Mesh(new THREE.SphereGeometry(.62,40,20),hull); disc.scale.set(1,.34,1.15); body.add(disc);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.6,.06,12,48),dark); rim.rotation.x=PI/2; body.add(rim);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(.3,32,16,0,TAU,0,PI/2),new THREE.MeshPhysicalMaterial({color:0x9ad8ff,roughness:.03,metalness:.1,clearcoat:1,transparent:true,opacity:.7})); dome.position.set(0,.14,.08); body.add(dome);
  for(const sx of [-1,1]){ const w=new THREE.Mesh(new RoundedBoxGeometry(.5,.06,.34,2,.03),hull); w.position.set(sx*.72,.02,-.12); w.rotation.z=sx*.18; body.add(w);
    const tip=new THREE.Mesh(new THREE.SphereGeometry(.06,12,8),new THREE.MeshBasicMaterial({color:sx<0?new THREE.Color(2.4,.3,.3):new THREE.Color(.3,2.4,.5),toneMapped:false})); tip.position.set(sx*.97,.05,-.12); body.add(tip); }
  const glow=new THREE.Mesh(new THREE.TorusGeometry(.36,.05,10,40),new THREE.MeshBasicMaterial({color:new THREE.Color(.6,2.2,2.6),toneMapped:false})); glow.rotation.x=PI/2; glow.position.y=-.17; body.add(glow);
  g.scale.setScalar(1.45); castAll(g); g.userData={body,glow,hull,fx:0,fy:1}; return g;
}
function makeBall(k,col){
  const mat=k===0?new THREE.MeshPhysicalMaterial({map:ballTex(),roughness:.15,metalness:.1,clearcoat:1,clearcoatRoughness:.05})
    :new THREE.MeshPhysicalMaterial({color:col,roughness:.12,metalness:.35,clearcoat:1,clearcoatRoughness:.04});
  const m=new THREE.Mesh(ballGeo,mat); m.castShadow=true; const g=new THREE.Group(); g.add(m); g.userData={m,mat,col:new THREE.Color(col),tex:mat.map}; return g;
}
function makeCube(col){
  const mat=new THREE.MeshPhysicalMaterial({color:col,roughness:.22,metalness:.2,clearcoat:1,clearcoatRoughness:.1});
  const m=new THREE.Mesh(cubeGeo,mat); m.castShadow=true; const g=new THREE.Group(); g.add(m); g.userData={m,mat,col:new THREE.Color(col)}; return g;
}
export function grabSetup(){
  const W=GW, H=GH, c=new Uint8Array(W*H), dot=new Uint8Array(W*H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const border=x<2||y<2||x>=W-2||y>=H-2; c[y*W+x]=border?LAND:SEA; if(!border&&x%2===1&&y%2===1) dot[y*W+x]=1; }
  for(const [x,y] of [[7,6],[W-8,6],[7,H-7],[W-8,H-7]]) dot[y*W+x]=2;
  const m={W,H,wrapX:false,wrapY:false,cell:c,dot,solid:new Uint8Array(W*H),hgt:new Float32Array(W*H)};
  const g=new THREE.Group(); scene.add(g);
  const W3=GS.W3={g,m,style:'grab',map:mapFlat(m),rise:1,bg:new THREE.Group(),actors:new THREE.Group(),fx:new THREE.Group(),powList:[],t:0,heroH:0};
  g.add(W3.bg,W3.actors,W3.fx);
  // overcast sky + ocean all around
  scene.background=new THREE.Color(0x8a98a8); scene.fog=new THREE.Fog(0x9aa6b4,90,330);
  W3.bg.add(skyDome('#46566a','#9aa8b8','#c8d2dc'));
  const ct=cloudTex();
  for(let i=0;i<14;i++){ const cl=new THREE.Sprite(new THREE.SpriteMaterial({map:ct,color:0xe8eef4,transparent:true,opacity:rand(.5,.85),depthWrite:false,fog:false})); const sc=rand(60,140); cl.scale.set(sc,sc*.4,1); cl.position.set(rand(-260,260),rand(40,110),rand(-320,-160)); W3.bg.add(cl); }
  const ot=oceanT(); ot.repeat.set(40,40);
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),new THREE.MeshStandardMaterial({color:0xffffff,map:ot,bumpMap:ot,bumpScale:2,roughness:.2,metalness:.15}));
  ocean.rotation.x=-PI/2; ocean.position.y=-7; ocean.receiveShadow=true; W3.bg.add(ocean); W3.ocean=ot;
  envFrom('#6a7a8c','#c0cad4','#3a4654',[['#fff6e8',-20,40,30,6]]);
  hemi.color.set(0xdde6f0); hemi.groundColor.set(0x5a5040); hemi.intensity=.55; sun.color.set(0xfff0dc); sun.intensity=2.3; SUN.dir.set(-20,50,30).normalize();
  // the board: a rocky plinth whose top is the stone field
  const rt=rockT(), rm=rt.map.clone(), rb=rt.bump.clone(); rm.needsUpdate=rb.needsUpdate=true; rm.repeat.set(14,1); rb.repeat.set(14,1);
  const pl=new THREE.Mesh(new THREE.BoxGeometry(W*S,6.9,H*S),new THREE.MeshStandardMaterial({color:0xffffff,map:rm,bumpMap:rb,bumpScale:3,roughness:.95})); pl.position.y=-3.5; pl.receiveShadow=true; g.add(pl);
  const ft=fieldT(); ft.map.repeat.set(W/3,H/3); ft.bump.repeat.set(W/3,H/3);
  const field=new THREE.Mesh(new THREE.PlaneGeometry(W*S,H*S),new THREE.MeshStandardMaterial({color:0xffffff,map:ft.map,bumpMap:ft.bump,bumpScale:2,roughness:.9,metalness:0}));
  field.rotation.x=-PI/2; field.position.y=-.04; field.receiveShadow=true; g.add(field);
  // claimed land: one block per cell, textured in world space so the slab reads as one piece
  const lt=landTs[GS.loop%2]();
  const topM=worldUV(new THREE.MeshStandardMaterial({color:0xffffff,map:lt.top.map,bumpMap:lt.top.bump,bumpScale:1.6,roughness:.85}),10,10,true);
  const sideM=worldUV(new THREE.MeshStandardMaterial({color:0xffffff,map:lt.side.map,bumpMap:lt.side.bump,bumpScale:2,roughness:.9}),2,LAND_H*1.2);
  W3.tiles=new THREE.InstancedMesh(tileGeo,[sideM,sideM,topM,sideM,sideM,sideM],W*H); W3.tiles.castShadow=W3.tiles.receiveShadow=true; g.add(W3.tiles);
  W3.trail=new THREE.InstancedMesh(trailGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,1.8,.45),toneMapped:false}),W*H); g.add(W3.trail);
  W3.dotMesh=new THREE.InstancedMesh(pearlGeo,new THREE.MeshStandardMaterial({color:0xffd060,roughness:.15,metalness:.9,emissive:0x6a4000,emissiveIntensity:.6}),W*H); W3.dotMesh.castShadow=true; g.add(W3.dotMesh);
  W3.powMesh=new THREE.InstancedMesh(powGeo,new THREE.MeshPhysicalMaterial({color:0xff5ab8,roughness:.1,metalness:.3,clearcoat:1,emissive:0xff2a8a,emissiveIntensity:.8,flatShading:true}),24); W3.powMesh.castShadow=true; g.add(W3.powMesh);
  for(let i=0;i<W*H;i++){ W3.tiles.setMatrixAt(i,ZERO); W3.trail.setMatrixAt(i,ZERO); W3.dotMesh.setMatrixAt(i,ZERO); W3.tiles.setColorAt(i,_c.setRGB(1,1,1)); if(dot[i]===2) W3.powList.push(i); }
  Object.assign(GR,{c,m,trail:[],drawing:false,cx:17,cy:0,dx:0,dy:0,p:0,lastLand:[17,0],anim:[],claimed:0,total:(W-4)*(H-4),target:CLAIM_GOAL[Math.min(GS.loop,CLAIM_GOAL.length-1)],pct:0,powT:0,won:false,winT:0,combo:0,spd:7.6,bank:0});
  for(let i=0;i<W*H;i++){ if(c[i]===LAND) setTile(i,1); if(dot[i]===1) setDot(i,true); }
  W3.tiles.instanceMatrix.needsUpdate=true; W3.tiles.instanceColor.needsUpdate=true; W3.dotMesh.instanceMatrix.needsUpdate=true; W3.trail.instanceMatrix.needsUpdate=true;
  // game state shim used by the shared HUD / hearts / camera code
  GS.G={m,cfg:{dur:999,fright:7,heroSpd:8},t:0,hero:{x:17,y:0,dx:0,dy:0,wx:0,wy:0,fx:0,fy:1,alive:true,mouth:0},en:[],small:1,smallTotal:1,dots:1,
    hearts:3,fright:0,frightMax:7,inv:0,turbo:0,ramp:0,fields:{},items:[],bombs:[]};
  A3.hero=makeCraft(); W3.actors.add(A3.hero); A3.en=[]; A3.style='grab';
  // monster balls bounce through the field, green cubes roll on the claimed land
  const cols=['#ff3b3b','#ff4ad0','#29d8ff','#7ae03a'];
  const seaCells=[]; for(let y=6;y<H-4;y++) for(let x=4;x<W-4;x++) if(c[y*W+x]===SEA) seaCells.push([x,y]);
  const R=mulberry(555+GS.loop);
  cols.forEach((col,k)=>{ const [x,y]=seaCells[(R()*seaCells.length)|0]; const e={k,x,y,vx:R()<.5?1:-1,vy:R()<.5?1:-1,dx:0,dy:0,col,st:'run',fr:false,bob:R()*6,spin:0,land:false,pers:k,dead:0,obj:makeBall(k,col)}; GS.G.en.push(e); W3.actors.add(e.obj); });
  const nLand=1+(GS.loop>0?1:0);
  for(let j=0;j<nLand;j++){ const e={k:cols.length+j,x:j?W-6:5,y:H-1,vx:j?-1:1,vy:-1,dx:0,dy:0,col:'#2a9a2a',st:'run',fr:false,bob:0,spin:0,land:true,pers:0,dead:0,obj:makeCube(0x2ab83a)}; GS.G.en.push(e); W3.actors.add(e.obj); }
  GS.hooks={}; grabCount();
}
function setTile(i,k){ const x=i%GW, y=(i/GW)|0, hgt=Math.max(.001,LAND_H*k); GS.W3.map(x,y,hgt/2-.04,_o); basisMat(_m4,_o,S,hgt,S); GS.W3.tiles.setMatrixAt(i,_m4); }
function setTrail(i,on,prev=-1){ if(!on){ GS.W3.trail.setMatrixAt(i,ZERO); return; } const x=i%GW, y=(i/GW)|0, px=prev>=0?prev%GW:x, py=prev>=0?(prev/GW)|0:y, w=.55;
  GS.W3.map((x+px)/2,(y+py)/2,.03,_o); basisMat(_m4,_o,px!==x?S+w:w,.12,py!==y?S+w:w); GS.W3.trail.setMatrixAt(i,_m4); }
function setDot(i,on){ if(!on){ GS.W3.dotMesh.setMatrixAt(i,ZERO); return; } const x=i%GW, y=(i/GW)|0; GS.W3.map(x,y,.14,_o); basisMat(_m4,_o,1,1,1); GS.W3.dotMesh.setMatrixAt(i,_m4); }
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
    const prev=GR.trail.length?GR.trail[GR.trail.length-1]:gIdx(GR.lastLand[0],GR.lastLand[1]); c[i]=TRAIL; GR.trail.push(i); setTrail(i,true,prev); GS.W3.trail.instanceMatrix.needsUpdate=true;
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
  for(let k=0;k<Math.min(70,newly.length);k++){ const i=pick(newly); burstAt(i%W+rand(-.5,.5),((i/W)|0)+rand(-.5,.5),LAND_H+.3,3,['#fff6a0','#ffd040','#ffffff'],3,.09,.9,5); }
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
const _eu=new THREE.Euler(), _qq=new THREE.Quaternion();
export function grabSync(dt){
  const t=performance.now()/1000, h=GS.G.hero, W3=GS.W3, sm=1-Math.exp(-dt*14);
  // hover craft: floats above the field or the land slab, banks into turns
  const onLand=GR.c[gIdx(Math.round(h.x),Math.round(h.y))]===LAND; W3.heroH=lerp(W3.heroH||0,onLand?LAND_H:0,sm);
  const ud=A3.hero.userData; ud.fx=lerp(ud.fx,h.fx,1-Math.exp(-dt*10)); ud.fy=lerp(ud.fy,h.fy,1-Math.exp(-dt*10));
  const yaw=Math.atan2(ud.fx,ud.fy), turn=Math.atan2(Math.sin(yaw-(ud.yaw??yaw)),Math.cos(yaw-(ud.yaw??yaw))); ud.yaw=yaw; GR.bank=lerp(GR.bank,clamp(-turn/Math.max(dt,1e-3)*.05,-.5,.5),1-Math.exp(-dt*6));
  W3.map(h.x,h.y,W3.heroH+.75+Math.sin(t*3)*.08+GS.heroLift,_o); A3.hero.position.copy(_o.p);
  A3.hero.rotation.set(0,yaw,0); ud.body.rotation.z=GR.bank; ud.body.rotation.x=(h.dx||h.dy)?.12:0;
  A3.hero.visible=h.alive&&!(GS.G.inv>0&&(t*12|0)%2);
  ud.glow.material.color.setRGB(.6,2+Math.sin(t*20)*.4,2.6);
  heroLight.position.copy(A3.hero.position).add(_v.set(0,4,2)); heroLight.intensity=3; heroLight.color.set(0xa8f0ff);
  // balls roll along their path, cubes tumble on the land
  const flashEnd=GS.G.fright<1.8&&(t*8|0)%2;
  for(const e of GS.G.en){ const o=e.obj, u=o.userData; o.visible=e.st!=='dead'; if(!o.visible) continue;
    const base=e.land?LAND_H:0, r=e.land?.55:BALL_R;
    W3.map(e.x,e.y,base+r+(e.land?0:Math.abs(Math.sin(e.bob*1.3))*.25),_o); o.position.copy(_o.p);
    const sp=(e.land?3:4.2)*GS.speedMul*dt/r*S;
    _qq.setFromEuler(_eu.set(e.vy*sp*.7,0,-e.vx*sp*.7)); u.m.quaternion.premultiply(_qq);
    if(e.fr){ u.mat.color.set(flashEnd?0xffffff:0x1a3a9a); if(u.tex) u.mat.map=null; u.mat.emissive.set(flashEnd?0x888888:0x0a1a5a); }
    else { if(u.tex){ u.mat.map=u.tex; u.mat.color.set(0xffffff); } else u.mat.color.copy(u.col); u.mat.emissive.set(0x000000); }
    u.mat.needsUpdate=u.mat._hadMap!==!!u.mat.map; u.mat._hadMap=!!u.mat.map; }
  // rising tiles (with a bright flash while they grow)
  if(GR.anim.length){ for(const a of GR.anim){ a.t+=dt*1.6; const k=clamp(a.t,0,1), bk=k<1?1+Math.sin(k*PI)*.3:1; setTile(a.i,k*bk); const f=1+Math.max(0,1-k)*1.2; W3.tiles.setColorAt(a.i,_c.setRGB(f,f,f*.9)); }
    GR.anim=GR.anim.filter(a=>a.t<1.05); W3.tiles.instanceMatrix.needsUpdate=true; W3.tiles.instanceColor.needsUpdate=true; }
  // the line pulses, the gold pearls spin, the ocean drifts
  W3.trail.material.color.setRGB(2.2,1.6+Math.sin(t*10)*.4,.45);
  if(W3.ocean){ W3.ocean.offset.x+=dt*.006; W3.ocean.offset.y+=dt*.003; }
}
export function drawGrabMini(){
  const cs=innerWidth<640?3:4, W=GW*cs, H=GH*cs;
  if(GS.miniKey!=='grab'+cs){ GS.miniKey='grab'+cs; miniC.width=W; miniC.height=H; const sc=innerWidth<640?1:1.25; miniC.style.width=(W*sc)+'px'; miniC.style.height=(H*sc)+'px'; document.body.style.setProperty('--miniw',(W*sc)+'px'); document.body.style.setProperty('--minih',(H*sc)+'px'); }
  const g=miniX, c=GR.c, t=performance.now()/1000;
  g.fillStyle='#6a6660'; g.fillRect(0,0,W,H);
  for(let i=0;i<GW*GH;i++){ const v=c[i]; if(v===SEA){ if(GR.m.dot[i]===1){ g.fillStyle='#ffe8a0'; g.fillRect((i%GW)*cs+cs/2-.5,((i/GW)|0)*cs+cs/2-.5,1,1); } else if(GR.m.dot[i]===2&&(t*4|0)%2){ g.fillStyle='#29f0ff'; g.fillRect((i%GW)*cs,((i/GW)|0)*cs,cs,cs); } continue; }
    g.fillStyle=v===LAND?'#3a8a2a':'#ffd040'; g.fillRect((i%GW)*cs,((i/GW)|0)*cs,cs,cs); }
  for(const e of GS.G.en){ if(e.st==='dead') continue; g.fillStyle=e.fr?((t*6|0)%2?'#fff':'#3a8aff'):e.col; g.fillRect(e.x*cs-1,e.y*cs-1,cs+2,cs+2); }
  const h=GS.G.hero; g.fillStyle=(t*6|0)%2?'#29f0ff':'#ffffff'; g.fillRect(h.x*cs-1,h.y*cs-1,cs+2,cs+2);
}
export function grabHint(){ return TOUCH?'SWIPE TO STEER · LEAVE THE GREEN LAND TO DRAW A LINE · CLOSE IT TO CLAIM · CLAIM '+Math.round(GR.target*100)+'%':'ARROWS STEER · LEAVE THE GREEN LAND TO DRAW A LINE · CLOSE IT TO CLAIM · CLAIM '+Math.round(GR.target*100)+'%'; }
export const grabCamX=()=>lerp((GW-1)/2,GS.G.hero.x,.55), grabCamY=()=>lerp((GH-1)/2,GS.G.hero.y,.5);
// ---------- phase object ----------
const ORIGIN=new THREE.Vector3();
const P5={
  name:'LAND GRAB', color:'#29f0ff', song:'boss',
  deathText:'The glitches kept the grid.',
  ui:{cam:'follow', bloom:[.3,.88], sun:40},
  start(){
    clearWorld(); grabSetup(); setGlow(P5.color); updHearts(); GS.mode='seq'; setSong(null);
    cam.hgt=35; cam.back=21; cam.ahead=0; cam.k=3; cam.fov=55;
    camUpdate(0,grabCamX(),grabCamY(),true);
    camPose(_v.set(0,70,40),_v2.set(0,0,0),_v3.set(0,1,0)); cam.bl=0; flash(.7);
    runSeq(2.6,(t)=>{ cam.bl=ease(clamp((t-.3)/2.1,0,1)); },()=>{ GS.mode='play'; cam.bl=1; banner('PHASE '+GS.phase,P5.name,P5.color); setSong(P5.song); setTimeout(()=>{ if(GS.P===P5&&GS.mode==='play') hint(grabHint(),4.5); },1600); });
  },
  tick:grabTick, deadTick:grabTick,
  sync(dt){ updatePow(performance.now()/1000); grabSync(dt); },
  camTarget:()=>[grabCamX(),grabCamY()],
  sunTarget:()=>ORIGIN,
  outro:grabOutro,
  hud(){ return {progress:GR.pct/GR.target, left:'CLAIMED '+Math.floor(GR.pct*100)+'% / '+Math.round(GR.target*100)+'%'}; },
  minimap:drawGrabMini,
};
export default P5;
