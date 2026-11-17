// ================= PHASE 6: BOMB MAZE '85 (Bomberman meets MUNCHBOT) =================
// A grid arena: stone pillars that never break, brick blocks that do. Drop bombs to blast a way
// through, blow up the glitches and dig out the coins (coin bricks show a gold coin on their faces).
// Every coin lights a lamp on the gate;
// when all of them are lit the gate opens. Some bricks also hide FIRE (longer blasts),
// BOMB (one more bomb at a time) and CHOMP (a power diamond: eat the glitches).
import * as THREE from 'three';
import {GS} from '../core/state.js';
import {PI, TAU, TOUCH, clamp, ease, easeOut, mulberry} from '../core/utils.js';
import {SFX, tone} from '../core/audio.js';
import {OPEN, WALL, DIRS, idxOf} from '../core/maze.js';
import {addScore, mazeTick, startFright} from '../core/maze-game.js';
import {S, ZERO, _m4, _o, _v, _v2, _v3, basisMat, envFrom, hemi, scene, sun, SUN} from '../engine/renderer.js';
import {dotGeo, hideDot3, layoutWalls, riseAt} from '../engine/world.js';
import {cam, camPose} from '../engine/camera.js';
import {burstAt, pop3} from '../engine/actors.js';
import {cvTex, cvTex2, fbm, grain, hg, once, pxFill} from '../engine/textures.js';
import {glowSprite, skyDome} from '../engine/environments.js';
import {banner, flash, hint} from '../ui/hud.js';
import {mazeGo, mazeSync, startMazePhase} from './maze-phase.js';
import {endPhase, hurtHero, runSeq} from '../main.js';

const GW=19, GH=15, BOMB=4;                 // arena size (with the outer wall); BOMB = cell holding a bomb
const HERO=[1,13], GATE=[9,1];
const SPAWNS=[[17,1],[17,13],[9,7],[1,1]];
const FUSE=2.3, FIRE_T=.6, HARD_H=1.15, RIM_H=1.5, SOFT_H=1.0;
const IT={COIN:1,FIRE:2,BOMB:3,CHOMP:4};
const COIN_GOAL=3;                           // coins to find to open the gate
// B = everything this phase keeps besides the shared maze game (GS.G)
const B={};

// ---------- the arena ----------
// border and every even/even cell are stone; ~35% of the rest are bricks, never next to a start
function genArena(seed){
  const R=mulberry(seed), rows=[], soft=new Uint8Array(GW*GH), item=new Uint8Array(GW*GH);
  const near=(x,y,[ax,ay],d)=>Math.abs(x-ax)+Math.abs(y-ay)<=d;
  const keep=(x,y)=>near(x,y,HERO,2)||SPAWNS.some(s=>near(x,y,s,1))||near(x,y,GATE,1);
  for(let y=0;y<GH;y++){ let s='';
    for(let x=0;x<GW;x++){
      if(x===0||y===0||x===GW-1||y===GH-1||(x%2===0&&y%2===0)){ s+='#'; continue; }
      const i=y*GW+x;
      if(!keep(x,y)&&R()<.35) soft[i]=1;
      s+=(x===HERO[0]&&y===HERO[1])||(x===GATE[0]&&y===GATE[1])?' ':'.';
    }
    rows.push(s); }
  // hide the coins far apart from each other, then the power-ups
  const bricks=[]; for(let i=0;i<soft.length;i++) if(soft[i]) bricks.push(i);
  for(let k=bricks.length-1;k>0;k--){ const j=Math.floor(R()*(k+1)); [bricks[k],bricks[j]]=[bricks[j],bricks[k]]; }
  const need=COIN_GOAL, coins=[];
  for(const minD of [6,4,2,0]) for(const i of bricks){ if(coins.length>=need) break; if(item[i]) continue;
    const x=i%GW, y=(i/GW)|0; if(near(x,y,HERO,3)&&minD) continue;
    if(coins.every(c=>Math.abs(c%GW-x)+Math.abs(((c/GW)|0)-y)>=minD)){ coins.push(i); item[i]=IT.COIN; } }
  let p=0; for(const t of [IT.FIRE,IT.BOMB,IT.FIRE,IT.BOMB,IT.CHOMP,IT.FIRE,IT.CHOMP]){ while(p<bricks.length&&item[bricks[p]]) p++; if(p<bricks.length) item[bricks[p++]]=t; }
  return {rows,soft,item,need};
}

// ---------- textures ----------
// grey stone block with a bevelled face (colour + bump)
const stoneT=once(()=>cvTex2(256,256,(g,b,w,h)=>{
  pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*6,y/h*6,6,4), n2=fbm(x/w*24,y/h*24,24,2); const v=112+n*58+n2*16; return [v,v+3,v+10]; });
  const e=24;
  g.fillStyle='rgba(255,255,255,.24)'; g.beginPath(); g.moveTo(0,0); g.lineTo(w,0); g.lineTo(w-e,e); g.lineTo(e,e); g.lineTo(e,h-e); g.lineTo(0,h); g.fill();
  g.fillStyle='rgba(0,0,0,.32)'; g.beginPath(); g.moveTo(w,h); g.lineTo(0,h); g.lineTo(e,h-e); g.lineTo(w-e,h-e); g.lineTo(w-e,e); g.lineTo(w,0); g.fill();
  g.strokeStyle='rgba(20,22,30,.6)'; g.lineWidth=3; g.strokeRect(1.5,1.5,w-3,h-3);
  b.fillStyle=hg(70); b.fillRect(0,0,w,h);
  for(let k=0;k<e;k++){ b.fillStyle=hg(70+k/e*140); b.fillRect(k,k,w-2*k,h-2*k); }
  const R=mulberry(11); g.strokeStyle='rgba(30,30,36,.45)'; b.strokeStyle=hg(120); g.lineWidth=b.lineWidth=1.4;
  for(let c=0;c<3;c++){ let x=e+R()*(w-2*e), y=e+R()*(h-2*e); g.beginPath(); b.beginPath(); g.moveTo(x,y); b.moveTo(x,y);
    for(let s=0;s<5;s++){ x+=(R()-.5)*34; y+=(R()-.5)*34; g.lineTo(x,y); b.lineTo(x,y); } g.stroke(); b.stroke(); }
  grain(g,b,w,h,16,.1,3,3,.04);
},false));
// warm red bricks with mortar lines (colour + bump)
const brickT=once(()=>cvTex2(256,256,(g,b,w,h)=>{
  g.fillStyle='#5e5044'; g.fillRect(0,0,w,h); b.fillStyle=hg(60); b.fillRect(0,0,w,h);
  const R=mulberry(7), rows=4, bh=h/rows, bw=w/2;
  for(let r=0;r<rows;r++) for(let c=-1;c<3;c++){
    const x=c*bw+(r%2?bw/2:0)+4, y=r*bh+4, ww=bw-8, hh=bh-8, v=R();
    const gr=g.createLinearGradient(0,y,0,y+hh); gr.addColorStop(0,`rgb(${206+v*30|0},${110+v*26|0},${62+v*16|0})`); gr.addColorStop(1,`rgb(${150+v*24|0},${70+v*16|0},${40+v*10|0})`);
    g.fillStyle=gr; g.beginPath(); g.roundRect(x,y,ww,hh,5); g.fill();
    g.fillStyle='rgba(255,230,200,.22)'; g.fillRect(x+4,y+3,ww-8,4);
    b.fillStyle=hg(200+v*40); b.beginPath(); b.roundRect(x,y,ww,hh,5); b.fill();
  }
  grain(g,b,w,h,12,.16,5,4,.06);
},false));
// the same bricks with a gold coin set into the face, plus a mask that makes only the coin glow
function drawCoin(g,cx,cy,r){
  const gr=g.createRadialGradient(cx-r*.3,cy-r*.35,r*.1,cx,cy,r); gr.addColorStop(0,'#fff6c0'); gr.addColorStop(.5,'#f4c430'); gr.addColorStop(1,'#a06a08');
  g.fillStyle='#4a2a08'; g.beginPath(); g.arc(cx,cy,r+6,0,TAU); g.fill();
  g.fillStyle=gr; g.beginPath(); g.arc(cx,cy,r,0,TAU); g.fill();
  g.strokeStyle='#a87010'; g.lineWidth=4; g.beginPath(); g.arc(cx,cy,r*.78,0,TAU); g.stroke();
  g.fillStyle='#ffe680'; g.strokeStyle='#8a5a06'; g.lineWidth=2.5; g.beginPath();
  for(let k=0;k<10;k++){ const a=-PI/2+k*PI/5, rr=k%2?r*.26:r*.58; g.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr); } g.closePath(); g.fill(); g.stroke();
}
const coinBrickT=once(()=>{
  const t=brickT(), w=256, h=256, r=76;
  const mk=()=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
  const cv=mk(), bv=mk(), ev=mk(), g=cv.getContext('2d'), b=bv.getContext('2d'), e=ev.getContext('2d');
  g.drawImage(t.map.image,0,0); b.drawImage(t.bump.image,0,0); drawCoin(g,w/2,h/2,r);
  b.fillStyle=hg(40); b.beginPath(); b.arc(w/2,h/2,r+6,0,TAU); b.fill(); b.fillStyle=hg(235); b.beginPath(); b.arc(w/2,h/2,r,0,TAU); b.fill();
  e.fillStyle='#000'; e.fillRect(0,0,w,h); drawCoin(e,w/2,h/2,r);
  const map=new THREE.CanvasTexture(cv), bump=new THREE.CanvasTexture(bv), glow=new THREE.CanvasTexture(ev);
  map.colorSpace=glow.colorSpace=THREE.SRGBColorSpace; return {map,bump,glow};
});
// checkered lawn, one 2x2 tile = 2x2 cells
const lawnT=once(()=>cvTex2(256,256,(g,b,w,h)=>{
  pxFill(g,w,h,(x,y)=>{ const dark=((x>>7)+(y>>7))%2, n=fbm(x/w*10,y/h*10,10,4), n2=fbm(x/w*48,y/h*48,48,2);
    const k=(dark?.86:1)*(.86+n*.22+n2*.12); return [86*k,170*k,58*k]; });
  const R=mulberry(5); g.strokeStyle='rgba(210,255,170,.25)'; g.lineWidth=1.2;
  for(let i=0;i<500;i++){ const x=R()*w, y=R()*h; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(R()-.5)*3,y-3-R()*4); g.stroke(); }
  g.strokeStyle='rgba(20,60,10,.25)'; g.lineWidth=2; g.strokeRect(0,0,w/2,h/2); g.strokeRect(w/2,h/2,w/2,h/2);
  grain(g,b,w,h,16,.08,9,3,.05);
}));
const meadowT=once(()=>cvTex(128,128,(g,w,h)=>pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*6,y/h*6,6,4); return [52+n*30,98+n*40,40+n*16]; }),true));
// gold coin face with an embossed star
const coinFaceT=once(()=>cvTex(128,128,(g,w,h)=>{
  const gr=g.createRadialGradient(52,48,6,64,64,64); gr.addColorStop(0,'#fff4b0'); gr.addColorStop(.55,'#f2c030'); gr.addColorStop(1,'#a87010'); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.strokeStyle='#b07a10'; g.lineWidth=6; g.beginPath(); g.arc(64,64,52,0,TAU); g.stroke();
  g.fillStyle='#ffe680'; g.strokeStyle='#9a6a08'; g.lineWidth=3; g.beginPath();
  for(let k=0;k<10;k++){ const a=-PI/2+k*PI/5, r=k%2?16:36; g.lineTo(64+Math.cos(a)*r,64+Math.sin(a)*r); } g.closePath(); g.fill(); g.stroke();
}));
// power-up panel faces
function iconT(bg,draw){ return cvTex(128,128,(g,w,h)=>{
  const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,bg[0]); gr.addColorStop(1,bg[1]); g.fillStyle=gr; g.beginPath(); g.roundRect(4,4,120,120,18); g.fill();
  g.strokeStyle='rgba(255,255,255,.7)'; g.lineWidth=4; g.beginPath(); g.roundRect(8,8,112,112,15); g.stroke(); draw(g); }); }
const ICONS=once(()=>({
  [IT.FIRE]:iconT(['#ff8a2a','#c02a10'],g=>{ g.fillStyle='#ffe040'; g.beginPath(); g.moveTo(64,20); g.bezierCurveTo(96,52,98,72,90,88); g.bezierCurveTo(84,104,44,104,38,88); g.bezierCurveTo(30,70,44,58,48,44); g.bezierCurveTo(56,58,60,60,64,20); g.fill();
    g.fillStyle='#fff6c0'; g.beginPath(); g.ellipse(64,84,12,16,0,0,TAU); g.fill(); }),
  [IT.BOMB]:iconT(['#5a7aff','#2030a0'],g=>{ g.fillStyle='#14151c'; g.beginPath(); g.arc(60,72,30,0,TAU); g.fill(); g.fillStyle='rgba(255,255,255,.55)'; g.beginPath(); g.arc(50,62,8,0,TAU); g.fill();
    g.strokeStyle='#d8b070'; g.lineWidth=5; g.beginPath(); g.moveTo(78,48); g.quadraticCurveTo(88,30,100,32); g.stroke(); g.fillStyle='#ffd040'; g.beginPath(); g.arc(102,30,7,0,TAU); g.fill(); }),
  [IT.CHOMP]:iconT(['#2ae0e8','#0a6a8a'],g=>{ g.fillStyle='#e8ffff'; g.beginPath(); g.moveTo(64,22); g.lineTo(98,64); g.lineTo(64,106); g.lineTo(30,64); g.closePath(); g.fill();
    g.fillStyle='#29f0ff'; g.beginPath(); g.moveTo(64,34); g.lineTo(86,64); g.lineTo(64,94); g.lineTo(42,64); g.closePath(); g.fill(); }),
}));

// ---------- models ----------
const GEO=once(()=>({
  bomb:new THREE.SphereGeometry(.62,28,20), cap:new THREE.CylinderGeometry(.2,.24,.18,16),
  fuse:new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.04,.16,0),new THREE.Vector3(.18,.28,0),new THREE.Vector3(.3,.26,0)]),12,.045,6),
  coin:new THREE.CylinderGeometry(.5,.5,.12,32), panel:new THREE.BoxGeometry(.95,.95,.16),
  fire:new THREE.SphereGeometry(1,16,12), post:new THREE.BoxGeometry(.5,2.3,.5), arch:new THREE.BoxGeometry(2.2,.45,.62), lamp:new THREE.SphereGeometry(.11,12,8),
}));
const MAT=once(()=>({
  cap:new THREE.MeshStandardMaterial({color:0x9aa0aa,roughness:.28,metalness:.9}),
  fuse:new THREE.MeshStandardMaterial({color:0x8a6a3a,roughness:.85}),
  coinSide:new THREE.MeshStandardMaterial({color:0xe0a820,roughness:.3,metalness:1,emissive:0x5a3a00,emissiveIntensity:.5}),
  coinFace:new THREE.MeshStandardMaterial({map:coinFaceT(),roughness:.28,metalness:.85,emissive:0x6a4800,emissiveIntensity:.5,emissiveMap:coinFaceT()}),
  panelSide:new THREE.MeshStandardMaterial({color:0xe8e8f0,roughness:.35,metalness:.3}),
  fireOut:new THREE.MeshBasicMaterial({color:new THREE.Color(1.7,.52,.07),transparent:true,opacity:.9,depthWrite:false,toneMapped:false}),
  fireCore:new THREE.MeshBasicMaterial({color:new THREE.Color(1.5,1.05,.35),transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}),
  lampOff:new THREE.MeshStandardMaterial({color:0x3a2a10,roughness:.4,metalness:.6}),
  lampOn:new THREE.MeshBasicMaterial({color:new THREE.Color(2.6,1.9,.4),toneMapped:false}),
}));
function makeBomb(){
  const G=GEO(), M=MAT(), g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:0x15161e,roughness:.2,metalness:.35,emissive:0xff2000,emissiveIntensity:0});
  const body=new THREE.Mesh(G.bomb,mat); body.position.y=.64; body.castShadow=true; g.add(body);
  const cap=new THREE.Mesh(G.cap,M.cap); cap.position.y=1.26; g.add(cap);
  const fuse=new THREE.Mesh(G.fuse,M.fuse); fuse.position.y=1.32; g.add(fuse);
  const spark=glowSprite(0xffa040,1.2); spark.position.set(.3,1.58,0); g.add(spark);
  g.userData={body,mat,spark}; return g;
}
function makeItem(type){
  const G=GEO(), M=MAT(), g=new THREE.Group(), spin=new THREE.Group(); g.add(spin);
  let m;
  if(type===IT.COIN){ m=new THREE.Mesh(G.coin,[M.coinSide,M.coinFace,M.coinFace]); m.rotation.x=PI/2; }
  else { const face=new THREE.MeshStandardMaterial({map:ICONS()[type],roughness:.3,metalness:.1,emissive:0xffffff,emissiveMap:ICONS()[type],emissiveIntensity:.35});
    m=new THREE.Mesh(G.panel,[M.panelSide,M.panelSide,M.panelSide,M.panelSide,face,face]); }
  m.castShadow=true; spin.add(m);
  const glow=glowSprite(type===IT.COIN?0xffc030:type===IT.FIRE?0xff6a20:type===IT.BOMB?0x5a7aff:0x29f0ff,2.4,.55); glow.position.y=-.2; g.add(glow);
  g.userData={spin}; return g;
}
// the exit: a stone gate with one lamp per coin, a red force field until every lamp is lit
function makeGate(n){
  const G=GEO(), M=MAT(), st=stoneT(), sm=new THREE.MeshStandardMaterial({map:st.map,bumpMap:st.bump,bumpScale:2,roughness:.8});
  const g=new THREE.Group();
  for(const x of [-.95,.95]){ const p=new THREE.Mesh(G.post,sm); p.position.set(x,1.15,0); p.castShadow=true; g.add(p); }
  const a=new THREE.Mesh(G.arch,sm); a.position.y=2.5; a.castShadow=true; g.add(a);
  const lamps=[]; for(let k=0;k<n;k++){ const l=new THREE.Mesh(G.lamp,M.lampOff); l.position.set((k-(n-1)/2)*.28,2.5,.33); g.add(l); lamps.push(l); }
  const fieldM=new THREE.MeshBasicMaterial({color:new THREE.Color(2,.15,.2),transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const field=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.25),fieldM); field.position.y=1.15; g.add(field);
  const glow=glowSprite(0xff3040,3,.5); glow.position.y=1.2; g.add(glow);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,40,16,1,true),new THREE.MeshBasicMaterial({color:new THREE.Color(.3,2,.6),transparent:true,opacity:.25,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  beam.geometry.translate(0,20,0); beam.visible=false; g.add(beam);
  g.userData={lamps,fieldM,field,glow,beam}; return g;
}

// ---------- world style (engine/world.js) ----------
const WORLD={name:'bomb', wallH:HARD_H,
  bodyMat(){ const t=stoneT(); return new THREE.MeshStandardMaterial({color:0xffffff,map:t.map,bumpMap:t.bump,bumpScale:2.2,roughness:.82,metalness:.05}); },
  wallHeights(W,cells,bodies){
    const R=mulberry(3);
    W.bodyInfo.forEach((b,k)=>{ const i=b.y*GW+b.x;
      if(B.soft[i]){ b.alive=false; W.hgt[i]=SOFT_H; return; }
      const rim=b.x===0||b.y===0||b.x===GW-1||b.y===GH-1; b.h=rim?RIM_H:HARD_H; W.hgt[i]=b.h;
      const v=(rim?.78:1)*(.92+R()*.12); bodies.setColorAt(k,new THREE.Color(v,v,v*1.03)); });
  },
  decorate(W){
    W.bodies.castShadow=W.bodies.receiveShadow=true;
    // two brick meshes: plain bricks and coin bricks (gold coin on every face, softly glowing)
    const t=brickT(), ct=coinBrickT(), lists=[[],[]];
    for(let i=0;i<B.soft.length;i++) if(B.soft[i]) lists[B.item[i]===IT.COIN?1:0].push(i);
    const mats=[new THREE.MeshStandardMaterial({color:0xffffff,map:t.map,bumpMap:t.bump,bumpScale:2.6,roughness:.75}),
      new THREE.MeshStandardMaterial({color:0xffffff,map:ct.map,bumpMap:ct.bump,bumpScale:2.6,roughness:.6,metalness:.15,emissive:0xffc040,emissiveMap:ct.glow,emissiveIntensity:.7})];
    const R=mulberry(9);
    B.softMeshes=lists.map((list,m)=>{ const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mats[m],Math.max(1,list.length));
      list.forEach((i,k)=>{ const v=.9+R()*.18; mesh.setColorAt(k,new THREE.Color(v,v*.97,v*.95)); B.softK[i]=k; B.softM[i]=m; });
      if(!list.length) mesh.setMatrixAt(0,ZERO);
      mesh.castShadow=mesh.receiveShadow=true; W.g.add(mesh); return mesh; });
    B.softList=[...lists[0],...lists[1]];
  },
  layout(W,r){ for(const i of B.softList) placeSoft(i,riseAt(r,i%GW,(i/GW)|0),1); softDirty(); },
  floor(W){
    const t=lawnT(); for(const x of [t.map,t.bump]){ x.repeat.set(GW/2,GH/2); x.offset.set(.5,.5); }
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(GW*S,GH*S),new THREE.MeshStandardMaterial({color:0xffffff,map:t.map,bumpMap:t.bump,bumpScale:1.2,roughness:.92}));
    fl.rotation.x=-PI/2; W.g.add(fl); return fl;
  },
  dots:{geo:dotGeo, mat:()=>new THREE.MeshBasicMaterial({color:new THREE.Color(1.7,1.35,.45),toneMapped:false}),
    place(W,i,k){ W.map(i%GW,(i/GW)|0,.5,_o); basisMat(_m4,_o,.8,.8,.8); W.dotMesh.setMatrixAt(k,_m4); }},
};
function placeSoft(i,h,sc){
  const mesh=B.softMeshes[B.softM[i]], k=B.softK[i];
  if(h<=0||sc<=0){ mesh.setMatrixAt(k,ZERO); return; }
  const hh=Math.max(.02,SOFT_H*h*sc); GS.W3.map(i%GW,(i/GW)|0,hh/2,_o); basisMat(_m4,_o,S*.92*sc,hh,S*.92*sc); mesh.setMatrixAt(k,_m4);
}
function softDirty(){ for(const m of B.softMeshes) m.instanceMatrix.needsUpdate=true; }

// ---------- bombs and fire ----------
function dropBomb(){
  const G=GS.G, h=G.hero, m=G.m; if(!h.alive) return;
  const x=Math.round(h.x), y=Math.round(h.y), i=y*GW+x;
  if(m.cell[i]!==OPEN||B.bombs.length>=B.maxBombs||B.gateIdx===i) return;
  m.cell[i]=BOMB;
  const obj=B.pool.pop()||makeBomb(); obj.visible=true; GS.W3.fx.add(obj);
  GS.W3.map(x,y,0,_o); obj.position.copy(_o.p); obj.scale.setScalar(.01);
  B.bombs.push({x,y,i,t:FUSE,obj,age:0});
  tone({f:220,f2:110,d:.12,v:.08,type:'square',lp:1400});
  // glitches walking into that cell turn around
  for(const e of G.en){ if(e.st!=='run'||!(e.dx||e.dy)) continue;
    const nx=Math.round(e.x+e.dx*.49), ny=Math.round(e.y+e.dy*.49);
    if(nx===x&&ny===y&&(Math.abs(e.x-x)+Math.abs(e.y-y))>.05){ e.dx=-e.dx; e.dy=-e.dy; e.decided=false; } }
}
function explode(b){
  const m=GS.G.m; B.bombs.splice(B.bombs.indexOf(b),1);
  m.cell[b.i]=OPEN; b.obj.visible=false; B.pool.push(b.obj);
  SFX.boom(); cam.shake=Math.max(cam.shake,.35);
  addFire(b.x,b.y,'c');
  burstAt(b.x,b.y,.8,22,['#ffe060','#ff8a20','#ffffff','#ff5010'],8,.24,.55);
  for(const [dx,dy] of DIRS){
    for(let k=1;k<=B.range;k++){
      const x=b.x+dx*k, y=b.y+dy*k, i=idxOf(m,x,y); if(i<0) break;
      const c=m.cell[i];
      if(c===WALL){ if(B.soft[i]) breakSoft(i); break; }
      if(c===BOMB){ const o=B.bombs.find(q=>q.i===i); if(o) o.t=Math.min(o.t,.07); addFire(x,y,dx?'h':'v'); break; }
      addFire(x,y,dx?'h':'v',k===B.range);
      if(k%2) burstAt(x,y,.7,4,['#ffd040','#ff7a20','#5a5050'],5,.2,.45);
    }
  }
}
function addFire(x,y,dir,tip){ const i=y*GW+x; B.fire[i]=FIRE_T; B.flames.push({x,y,i,dir,tip:!!tip,t:0}); }
function breakSoft(i){
  B.soft[i]=0; GS.G.m.cell[i]=OPEN; GS.miniLayer=null;
  B.crumbles.push({i,t:0}); addScore(10);
  burstAt(i%GW,(i/GW)|0,.7,16,['#c8683a','#8a4a2a','#e8a070','#5e5044'],6,.26,.8);
}
function fireTick(dt){
  const G=GS.G, h=G.hero;
  for(let k=B.flames.length-1;k>=0;k--){ const f=B.flames[k]; f.t+=dt; if(f.t>=FIRE_T){ B.flames.splice(k,1); if(B.fire[f.i]<=dt) B.fire[f.i]=0; } }
  for(let i=0;i<B.fire.length;i++) if(B.fire[i]>0) B.fire[i]=Math.max(0,B.fire[i]-dt);
  const hot=(x,y)=>{ const i=idxOf(G.m,Math.round(x),Math.round(y)); return i>=0&&B.fire[i]>.1; };
  if(h.alive&&hot(h.x,h.y)) hurtHero('BLOWN UP');
  let combo=0;
  for(const e of G.en){
    if(e.st==='dead'||e.st==='eaten'||!hot(e.x,e.y)) continue;
    combo++; const pts=200*Math.pow(2,Math.min(combo-1,3)); addScore(pts);
    e.st='dead'; e.dead=7; e.fr=false; SFX.eatEnemy();
    burstAt(e.x,e.y,1,28,[e.col,'#ffffff','#ff8a20'],9,.25,.9); pop3(e.x,e.y,String(pts),'#ffd040');
  }
  for(let k=B.crumbles.length-1;k>=0;k--){ const c=B.crumbles[k]; c.t+=dt; if(c.t>=.35){ B.crumbles.splice(k,1); reveal(c.i); } }
}
function bombsTick(dt){
  for(const b of B.bombs.slice()){ b.t-=dt; b.age+=dt; if(b.t<=0) explode(b); }
}
// an item that was under a brick pops up
function reveal(i){
  const t=B.item[i]; placeSoft(i,0,0); softDirty(); if(!t) return;
  const obj=makeItem(t); GS.W3.fx.add(obj); B.items.push({i,t,obj,age:0});
  if(t===IT.COIN){ SFX.coin(); hint('A COIN!',1); }
}
function itemsTick(){
  const G=GS.G, h=G.hero; if(!h.alive) return;
  const hi=idxOf(G.m,Math.round(h.x),Math.round(h.y));
  for(let k=B.items.length-1;k>=0;k--){ const it=B.items[k]; if(it.i!==hi||it.age<.3) continue;
    B.items.splice(k,1); GS.W3.fx.remove(it.obj); const x=it.i%GW, y=(it.i/GW)|0;
    if(it.t===IT.COIN){ B.coins++; addScore(500); SFX.coin(); pop3(x,y,'+500','#ffd040');
      B.gate.userData.lamps[B.coins-1].material=MAT().lampOn;
      burstAt(x,y,1,22,['#ffe060','#fff4b0','#f2c030'],7,.2,.8);
      if(B.coins>=B.need){ openGate(); } else hint('COIN '+B.coins+' / '+B.need,1.4); }
    else if(it.t===IT.FIRE){ B.range=Math.min(7,B.range+1); SFX.power(); hint('FIRE UP · BLAST '+B.range,1.4); }
    else if(it.t===IT.BOMB){ B.maxBombs=Math.min(6,B.maxBombs+1); SFX.power(); hint('EXTRA BOMB · '+B.maxBombs+' AT ONCE',1.4); }
    else if(it.t===IT.CHOMP){ addScore(50); SFX.power(); startFright(G.cfg.fright); hint('CHOMP TIME! EAT THE GLITCHES',1.6); }
  }
}
function openGate(){
  B.gateOpen=true; const u=B.gate.userData; u.beam.visible=true; u.fieldM.color.setRGB(.3,2.2,.6); u.glow.material.color.set(0x40ff80);
  SFX.power(); flash(.35,'#40ff80'); banner('ALL COINS','GATE OPEN',P.color); hint('GATE OPEN · RUN TO IT!',2.5);
}
function gateTick(){
  const h=GS.G.hero; if(!h.alive) return;
  const at=Math.abs(h.x-GATE[0])+Math.abs(h.y-GATE[1])<.35;
  if(at&&B.gateOpen){ endPhase(); return; }
  if(at&&!B.gateNag){ B.gateNag=true; SFX.warn(); hint('LOCKED · '+(B.need-B.coins)+' MORE COIN'+(B.need-B.coins===1?'':'S'),1.6); }
  if(!at) B.gateNag=false;
}

// ---------- per-frame visuals ----------
function syncFx(dt){
  const t=performance.now()/1000, W=GS.W3;
  for(const b of B.bombs){ const u=b.obj.userData, warn=clamp(1-b.t/FUSE,0,1);
    const pop=easeOut(clamp(b.age/.18,0,1)), puls=1+Math.sin(t*(8+warn*22))*(.04+warn*.07);
    b.obj.scale.setScalar(pop*puls); u.mat.emissiveIntensity=b.t<.9?(Math.sin(t*30)*.5+.5)*1.2:0;
    u.spark.scale.setScalar(1+Math.random()*.9); }
  // flames: a blobby cross of stretched spheres, puffing out and fading
  let n=0; const M=B.fireOut, C=B.fireCore;
  for(const f of B.flames){ if(n>=M.count) break;
    const a=f.t/FIRE_T, k=a<.12?easeOut(a/.12):1-ease((a-.12)/.88), j=1+Math.sin(t*40+f.i)*.07;
    W.map(f.x,f.y,.75,_o);
    let sx,sy,sz; if(f.dir==='c'){ sx=sz=S*.6; sy=.95; } else { const L=S*(f.tip?.46:.62), w=f.tip?.58:.7; sx=f.dir==='h'?L:w; sz=f.dir==='h'?w:L; sy=.75; }
    _m4.makeScale(sx*k*j,sy*k*j,sz*k*j); _m4.setPosition(_o.p); M.setMatrixAt(n,_m4);
    _m4.makeScale(sx*k*.55,sy*k*.6,sz*k*.55); _m4.setPosition(_o.p); C.setMatrixAt(n,_m4); n++; }
  for(let i=n;i<B.fireN;i++){ M.setMatrixAt(i,ZERO); C.setMatrixAt(i,ZERO); }
  B.fireN=n; M.instanceMatrix.needsUpdate=C.instanceMatrix.needsUpdate=true;
  // bricks crumbling: sink and shrink
  if(B.crumbles.length){ for(const c of B.crumbles){ const a=clamp(c.t/.35,0,1); placeSoft(c.i,1-a*.6,1-a*.55); } softDirty(); }
  for(const it of B.items){ it.age+=dt; const s=easeOut(clamp(it.age/.35,0,1));
    W.map(it.i%GW,(it.i/GW)|0,.95+Math.sin(t*3+it.i)*.12,_o); it.obj.position.copy(_o.p); it.obj.scale.setScalar(s*1.3); it.obj.userData.spin.rotation.y=t*2.4+it.i; }
  const u=B.gate.userData; u.fieldM.opacity=(B.gateOpen?.5:.32)+Math.sin(t*(B.gateOpen?9:4))*.12;
  u.beam.material.opacity=.2+Math.sin(t*5)*.06;
}

// bomb keys are caught on keydown so a quick tap is never missed between two frames
const BOMB_KEYS=['Space','KeyX','KeyB','Enter'];
addEventListener('keydown',e=>{ if(GS.P===P&&GS.mode==='play'&&!e.repeat&&BOMB_KEYS.includes(e.code)) B.want=true; });

// ---------- the phase ----------
const P={
  name:"BOMB MAZE '85", color:'#ff8a2a', song:'p6',
  deathTitle:'KABOOM', deathText:'Mind the blast: your own bombs hurt too.',
  ui:{cam:'follow', sun:26, bloom:[.38,.86]},
  world:WORLD,
  _B:B, _dbg:{breakSoft,dropBomb,openGate},   // debug / test handles
  cfg:{hero:HERO,spawns:SPAWNS,enemies:4,release:[1.5,3,4.5,6],heroSpd:6.6,enSpd:4.3,fright:7,corners:[[GW,-2],[-1,-2],[GW,GH+1],[-1,GH+1]],dur:150,enRamp:.18,killOnEat:true,hitR:.7},
  buildEnv(m){
    const bg=GS.W3.bg;
    scene.background=new THREE.Color(0x9cc8ee); scene.fog=new THREE.Fog(0xb8d6f0,70,190);
    bg.add(skyDome('#2f6ad0','#8ec0ee','#dcecf8'));
    const mt=meadowT(); mt.repeat.set(60,60);
    const meadow=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:0xffffff,map:mt,roughness:.95})); meadow.rotation.x=-PI/2; meadow.position.y=-.03; meadow.receiveShadow=true; bg.add(meadow);
    envFrom('#3a6ad0','#c8dcf0','#3a5a2a',[['#fff4d0',30,40,20,6]]);
    hemi.color.set(0xcfe4ff); hemi.groundColor.set(0x3a5a28); hemi.intensity=.75;
    sun.color.set(0xfff0d8); sun.intensity=2.3; sun.position.set(24,40,30); SUN.dir.set(24,40,30).normalize();
  },
  setup(){
    const fx=GS.W3.fx, N=160;
    B.fireOut=new THREE.InstancedMesh(GEO().fire,MAT().fireOut,N); B.fireCore=new THREE.InstancedMesh(GEO().fire,MAT().fireCore,N);
    for(const q of [B.fireOut,B.fireCore]){ for(let i=0;i<N;i++) q.setMatrixAt(i,ZERO); q.frustumCulled=false; fx.add(q); }
    B.fireN=N; B.gate=makeGate(B.need); GS.W3.map(GATE[0],GATE[1],0,_o); B.gate.position.copy(_o.p); fx.add(B.gate);
  },
  hint:()=>(TOUCH?'TAP = BOMB':'SPACE = BOMB')+' · BLOW UP THE '+B.need+' GOLD COIN BRICKS',
  hooks:()=>({
    hit:e=>{ if(e){ e.dx=-e.dx; e.dy=-e.dy; e.decided=false; } hurtHero('CAUGHT'); },
    dot:i=>hideDot3(i),
    eatEnemy:(e,pts)=>{ burstAt(e.x,e.y,1,24,[e.col,'#fff'],9,.25,.9); pop3(e.x,e.y,String(pts)); },
  }),
  camera(){ cam.hgt=17; cam.back=10; cam.ahead=1; cam.k=5; cam.fov=55; },
  start(){
    const A=genArena(606+GS.loop*17);
    Object.assign(B,{soft:A.soft,item:A.item,need:A.need,softK:new Int32Array(GW*GH).fill(-1),softM:new Uint8Array(GW*GH),softList:[],softMeshes:[],
      bombs:[],pool:[],flames:[],fire:new Float32Array(GW*GH),crumbles:[],items:[],coins:0,maxBombs:1,range:2,
      gateOpen:false,gateNag:false,gateIdx:GATE[1]*GW+GATE[0],want:false});
    const m={W:GW,H:GH,wrapX:false,wrapY:false,cell:new Uint8Array(GW*GH),dot:new Uint8Array(GW*GH),hgt:new Float32Array(GW*GH),solid:new Uint8Array(GW*GH)};
    for(let y=0;y<GH;y++) for(let x=0;x<GW;x++){ const i=y*GW+x, c=A.rows[y][x];
      m.cell[i]=c==='#'||A.soft[i]?WALL:OPEN; m.dot[i]=c==='.'?1:0; m.solid[i]=c==='#'?1:0; }
    P.cfg.enemies=4+Math.min(GS.loop,2);
    startMazePhase(P,m);
    camPose(_v.set(0,42,34),_v2.set(0,0,0),_v3.set(0,1,0)); cam.bl=0; GS.W3.rise=0; layoutWalls();
    runSeq(2.4,(t)=>{ GS.W3.rise=easeOut(clamp(t/1.8,0,1)); layoutWalls(); cam.bl=ease(clamp(t/2.2,0,1)); },mazeGo(P));
  },
  tick(dt){
    mazeTick(dt); if(GS.mode!=='play') return;
    if(B.want){ B.want=false; dropBomb(); }
    bombsTick(dt); fireTick(dt); itemsTick(); gateTick();
  },
  deadTick(dt){ mazeTick(dt); bombsTick(dt); fireTick(dt); },
  sync(dt){ mazeSync(dt); syncFx(dt); },
  tap(){ if(GS.mode==='play') dropBomb(); },
  // keep the camera over the arena instead of the meadow around it
  camTarget:()=>{ const h=GS.G.hero; return [clamp(h.x,5.5,GW-6.5),clamp(h.y,3.5,GH-3.5)]; },
  outro(next){
    banner('BOMB MAZE','CLEARED',P.color); SFX.win(); flash(.6);
    const h=GS.G.hero; GS.W3.map(h.x,h.y,0,_o);
    camPose(_v.copy(_o.p).add(_v2.set(0,30,26)),_v3.copy(_o.p),_v2.set(0,1,0));
    runSeq(2.6,(t)=>{ cam.bl=1-ease(clamp(t/2,0,1)); if(t>2.3&&!GS.seq.fl){ GS.seq.fl=1; flash(1); } },next);
  },
  hud:()=>({progress:B.coins/Math.max(1,B.need), left:B.gateOpen?'GATE OPEN → GO!':'COINS '+B.coins+'/'+B.need+' · BOMBS '+B.maxBombs+' · FIRE '+B.range}),
  mini:{cs:6, scale:[1,1.3], wall:'#9aa0ac', bg:'rgba(30,70,24,.88)', dot:'#ffe08a', pow:'#29f0ff'},
  miniExtras(g,cs,t){
    for(const i of B.softList) if(B.soft[i]){ g.fillStyle=B.item[i]===IT.COIN?'#ffd040':'#c8683a'; g.fillRect((i%GW)*cs+.5,((i/GW)|0)*cs+.5,cs-1,cs-1); }
    for(const it of B.items){ g.fillStyle=it.t===IT.COIN?'#ffd040':'#ffffff'; g.fillRect((it.i%GW)*cs+1,((it.i/GW)|0)*cs+1,cs-2,cs-2); }
    for(let i=0;i<B.fire.length;i++) if(B.fire[i]>0){ g.fillStyle='#ff8a20'; g.fillRect((i%GW)*cs,((i/GW)|0)*cs,cs,cs); }
    for(const b of B.bombs){ g.fillStyle=(t*8|0)%2?'#ff3020':'#000'; g.fillRect(b.x*cs+1,b.y*cs+1,cs-2,cs-2); }
    g.fillStyle=B.gateOpen?((t*4|0)%2?'#40ff80':'#fff'):'#ff3040'; g.fillRect(GATE[0]*cs,GATE[1]*cs,cs,cs);
  },
};
export default P;
