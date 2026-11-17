import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GS} from '../core/state.js';
import {$, clamp, ease, easeOut, irand, lerp, mulberry, PI, pick, TAU, TOUCH} from '../core/utils.js';
import {SFX, now, tone} from '../core/audio.js';
import {cellAt, DIRS, DOOR, MAZE1, OPEN, parseMaze, PEN, stepActor, WALL, wdx, wdy} from '../core/maze.js';
import {addScore, mazeTick, spawnEnemy, startFright} from '../core/maze-game.js';
import {M1CFG} from './p1-1980.js';
import {_c, _m4, _o, _v, _v2, _v3, basisMat, castAll, envFrom, hemi, placeObj, S, scene, SUN, sun, ZERO} from '../engine/renderer.js';
import {ANISO, both, cvTex, cvTex2, fbm, grain, hg, once, pxFill, worldUV} from '../engine/textures.js';
import {eyeWGeo, pupGeo} from '../engine/models.js';
import {cam, camPose} from '../engine/camera.js';
import {glowSprite} from '../engine/environments.js';
import {burstAt, pop3} from '../engine/actors.js';
import {X} from './extras.js';
import {banner, flash, hint} from '../ui/hud.js';
import {hideDot3, layoutWalls, riseAt} from '../engine/world.js';
import {mazeGo, mazePlayTick, mazeSync, startMazePhase} from './maze-phase.js';
import {hurtHero, runSeq} from '../main.js';
// ---------- phase 2 (MEAN STREETS) HD textures ----------
export const cashTex=cvTex(256,128,(g,w,h)=>{
  const gr=g.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#3e9a4a'); gr.addColorStop(.5,'#5cb860'); gr.addColorStop(1,'#2f7a38'); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.strokeStyle='rgba(220,255,200,.35)'; g.lineWidth=1; for(let i=-h;i<w;i+=7){ g.beginPath(); g.moveTo(i,0); g.lineTo(i+h,h); g.stroke(); }
  g.strokeStyle='#e0ffd0'; g.lineWidth=5; g.strokeRect(8,8,w-16,h-16); g.strokeStyle='#1e5a26'; g.lineWidth=2; g.strokeRect(16,16,w-32,h-32);
  const rg=g.createRadialGradient(w/2,h/2,4,w/2,h/2,40); rg.addColorStop(0,'#eaffde'); rg.addColorStop(1,'#8ad08a'); g.fillStyle=rg; g.beginPath(); g.ellipse(w/2,h/2,40,38,0,0,TAU); g.fill();
  g.strokeStyle='#1e5a26'; g.lineWidth=3; g.stroke();
  g.fillStyle='#1a5a22'; g.font='bold 60px Georgia,serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('$',w/2,h/2+3);
  g.font='bold 22px Georgia,serif'; g.fillStyle='#eaffde'; for(const [x,y] of [[34,32],[w-34,32],[34,h-30],[w-34,h-30]]) g.fillText('100',x,y);
});
// tileable asphalt grain (overlaid on the street map)
const asphaltPat=once(()=>{ const cv=document.createElement('canvas'); cv.width=cv.height=256; const g=cv.getContext('2d'); const R=mulberry(31);
  pxFill(g,256,256,(x,y)=>{ const n=fbm(x/256*8,y/256*8,8,4), r=R(); let v=128+(n-.5)*70+(r-.5)*46; if(r>.985) v+=60; if(r<.01) v-=50; return [v,v,v]; }); return cv; });
const streetCache={};
export function streetTex(m){
  const key=m.W+'x'+m.H+':'+m.cell.join('');
  if(streetCache.key===key) return streetCache.tex;
  if(streetCache.tex) streetCache.tex.dispose();
  streetCache.key=key; return streetCache.tex=streetTexBuild(m);
}
function streetTexBuild(m){
  const T=TOUCH?64:128, k=T/32, cv=document.createElement('canvas'); cv.width=m.W*T; cv.height=m.H*T; const g=cv.getContext('2d'); const R=mulberry(99);
  const op=(x,y)=>cellAt(m,x,y)===OPEN;
  const wall=(x,y)=>{ const c=cellAt(m,x,y); return c===WALL; };
  // base layer
  for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++){
    const c=m.cell[y*m.W+x], X=x*T, Y=y*T;
    if(c===WALL){ g.fillStyle='#8c8c92'; g.fillRect(X,Y,T,T); }
    else if(c===PEN||c===DOOR){ g.fillStyle='#3c414b'; g.fillRect(X,Y,T,T); }
    else { g.fillStyle='#303137'; g.fillRect(X,Y,T,T); }
  }
  // decals on the asphalt: patches, oil stains, cracks, manholes
  for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++){
    if(m.cell[y*m.W+x]!==OPEN) continue; const X=x*T, Y=y*T;
    if(R()<.18){ g.fillStyle=`rgba(${R()<.5?20:52},${R()<.5?20:52},${R()<.5?24:58},.45)`; const pw=(8+R()*14)*k, ph=(6+R()*12)*k; g.fillRect(X+R()*(T-pw),Y+R()*(T-ph),pw,ph); }
    if(R()<.22){ const ox=X+R()*T, oy=Y+R()*T, r=(3+R()*7)*k; const sg=g.createRadialGradient(ox,oy,0,ox,oy,r); sg.addColorStop(0,'rgba(0,0,0,.55)'); sg.addColorStop(.7,'rgba(10,10,20,.25)'); sg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=sg; g.beginPath(); g.ellipse(ox,oy,r,r*.7,R()*3,0,TAU); g.fill(); }
    if(R()<.35){ g.strokeStyle='rgba(12,12,14,.7)'; g.lineWidth=.6*k; let cx=X+R()*T, cy=Y+R()*T; g.beginPath(); g.moveTo(cx,cy); for(let q=0;q<6;q++){ cx+=(R()-.5)*9*k; cy+=(R()-.5)*9*k; g.lineTo(cx,cy);} g.stroke(); }
    if(R()<.05){ const cx=X+T/2, cy=Y+T/2, r=5*k; g.fillStyle='#26262a'; g.beginPath(); g.arc(cx,cy,r,0,TAU); g.fill(); g.strokeStyle='#4a4a52'; g.lineWidth=.8*k; g.stroke(); g.strokeStyle='#18181c'; g.lineWidth=.5*k; for(let q=-3;q<=3;q++){ g.beginPath(); g.moveTo(cx+q*1.3*k,cy-r*.85); g.lineTo(cx+q*1.3*k,cy+r*.85); g.stroke(); } }
  }
  // sidewalks, curbs, road markings
  const SW=6*k;
  const slab=(x,y,w,h,hz)=>{ g.fillStyle='#a6a6ac'; g.fillRect(x,y,w,h); g.fillStyle='rgba(60,60,66,.5)';
    if(hz){ for(let i=0;i<w;i+=8*k) g.fillRect(x+i,y,.5*k,h); } else { for(let i=0;i<h;i+=8*k) g.fillRect(x,y+i,w,.5*k); } };
  for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++){
    if(m.cell[y*m.W+x]!==OPEN) continue; const X=x*T, Y=y*T;
    const L=op(x-1,y), Rt=op(x+1,y), U=op(x,y-1), D=op(x,y+1), n=L+Rt+U+D;
    // curb shadow on the road
    const sh=(x0,y0,x1,y1,w,h)=>{ const gr=g.createLinearGradient(x0,y0,x1,y1); gr.addColorStop(0,'rgba(0,0,0,.45)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(Math.min(x0,x1),Math.min(y0,y1),w,h); };
    if(!U){ slab(X,Y,T,SW,true); sh(X,Y+SW,X,Y+SW+3*k,T,3*k); }
    if(!D){ slab(X,Y+T-SW,T,SW,true); sh(X,Y+T-SW,X,Y+T-SW-3*k,T,3*k); }
    if(!L){ slab(X,Y,SW,T,false); sh(X+SW,Y,X+SW+3*k,Y,3*k,T); }
    if(!Rt){ slab(X+T-SW,Y,SW,T,false); sh(X+T-SW,Y,X+T-SW-3*k,Y,3*k,T); }
    // inner corners where two roads meet around a block corner
    for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ if(op(x+dx,y)&&op(x,y+dy)&&!op(x+dx,y+dy)){ const cx=dx<0?X:X+T-SW, cy=dy<0?Y:Y+T-SW; g.fillStyle='#a6a6ac'; g.beginPath(); g.roundRect(cx,cy,SW,SW,dx<0&&dy<0?[0,0,SW*.9,0]:dx>0&&dy<0?[0,0,0,SW*.9]:dx<0?[0,SW*.9,0,0]:[SW*.9,0,0,0]); g.fill(); } }
    // curb edges
    g.fillStyle='#d4d4d8';
    if(!U) g.fillRect(X,Y+SW-1*k,T,1*k); if(!D) g.fillRect(X,Y+T-SW,T,1*k); if(!L) g.fillRect(X+SW-1*k,Y,1*k,T); if(!Rt) g.fillRect(X+T-SW,Y,1*k,T);
    // drains at the curb
    if(R()<.08&&!U){ g.fillStyle='#1a1a1e'; g.fillRect(X+12*k,Y+SW,8*k,2.4*k); g.fillStyle='#3a3a40'; for(let q=0;q<4;q++) g.fillRect(X+12.6*k+q*2*k,Y+SW+.3*k,1*k,1.8*k); }
    if(n>=3){
      g.fillStyle='rgba(236,236,236,.85)';
      if(U) for(let i=7;i<T/k-7;i+=4) g.fillRect(X+i*k,Y+.6*k,2.2*k,6*k);
      if(D) for(let i=7;i<T/k-7;i+=4) g.fillRect(X+i*k,Y+T-6.6*k,2.2*k,6*k);
      if(L) for(let i=7;i<T/k-7;i+=4) g.fillRect(X+.6*k,Y+i*k,6*k,2.2*k);
      if(Rt) for(let i=7;i<T/k-7;i+=4) g.fillRect(X+T-6.6*k,Y+i*k,6*k,2.2*k);
    } else if(L&&Rt&&!U&&!D){ g.fillStyle='#e0b430'; g.fillRect(X,Y+15*k,T,.8*k); g.fillRect(X,Y+16.6*k,T,.8*k); g.fillStyle='rgba(240,240,240,.7)'; g.fillRect(X+4*k,Y+9.5*k,9*k,.7*k); g.fillRect(X+20*k,Y+9.5*k,9*k,.7*k); g.fillRect(X+4*k,Y+22*k,9*k,.7*k); g.fillRect(X+20*k,Y+22*k,9*k,.7*k); }
    else if(U&&D&&!L&&!Rt){ g.fillStyle='#e0b430'; g.fillRect(X+15*k,Y,.8*k,T); g.fillRect(X+16.6*k,Y,.8*k,T); g.fillStyle='rgba(240,240,240,.7)'; g.fillRect(X+9.5*k,Y+4*k,.7*k,9*k); g.fillRect(X+9.5*k,Y+20*k,.7*k,9*k); g.fillRect(X+22*k,Y+4*k,.7*k,9*k); g.fillRect(X+22*k,Y+20*k,.7*k,9*k); }
  }
  // police lot: parking stalls + door hazard stripes
  let px=1e9,py=1e9,qx=-1,qy=-1; for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++){ const c=m.cell[y*m.W+x]; if(c===PEN){ px=Math.min(px,x); py=Math.min(py,y); qx=Math.max(qx,x); qy=Math.max(qy,y); }
    if(c===DOOR){ const X=x*T, Y=y*T; g.save(); g.beginPath(); g.rect(X,Y+10*k,T,12*k); g.clip(); for(let i=-T;i<T*2;i+=8*k){ g.fillStyle=(i/(8*k))%2?'#141414':'#ffcc22'; g.beginPath(); g.moveTo(X+i,Y+10*k); g.lineTo(X+i+4*k,Y+10*k); g.lineTo(X+i-8*k,Y+22*k); g.lineTo(X+i-12*k,Y+22*k); g.fill(); } g.restore(); } }
  if(qx>=0){ const X0=px*T, Y0=py*T, X1=(qx+1)*T, Y1=(qy+1)*T;
    g.strokeStyle='rgba(240,240,240,.8)'; g.lineWidth=1.2*k; for(let x=X0+T*.5;x<X1;x+=T*.75){ g.beginPath(); g.moveTo(x,Y0+3*k); g.lineTo(x,Y0+20*k); g.moveTo(x,Y1-3*k); g.lineTo(x,Y1-20*k); g.stroke(); }
    g.fillStyle='#e8eef8'; g.font=`bold ${26*k}px Impact,Arial Black,sans-serif`; g.textAlign='center'; g.textBaseline='middle'; g.globalAlpha=.9; g.fillText('POLICE',(X0+X1)/2,(Y0+Y1)/2); g.globalAlpha=1;
    g.strokeStyle='#ffd04a'; g.lineWidth=1.5*k; g.strokeRect(X0+2*k,Y0+2*k,X1-X0-4*k,Y1-Y0-4*k); }
  // worn look: asphalt grain overlay over everything
  g.globalCompositeOperation='overlay'; g.fillStyle=g.createPattern(asphaltPat(),'repeat'); g.save(); g.scale(k/2,k/2); g.fillRect(0,0,cv.width*2/k,cv.height*2/k); g.restore(); g.globalCompositeOperation='source-over';
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=ANISO; return t;
}
// building facade: 16 window bays x 4 floors, mapped in world space (8 units wide, 2 units tall) so tall and short buildings share window size
export const facadeT=once(()=>{
  const W=1024,H=512, R=mulberry(57), lit=[];
  const T=cvTex2(W,H,(g,b,w,h)=>{
    g.fillStyle='#e2ddd4'; g.fillRect(0,0,w,h); b.fillStyle=hg(170); b.fillRect(0,0,w,h);
    const bw=w/16, fh=h/4;
    for(let f=0;f<4;f++){ const fy=f*fh;
      // floor slab ledge
      both(g,b,'#f4f0ea',230,c=>c.fillRect(0,fy+fh-12,w,8)); g.fillStyle='rgba(0,0,0,.28)'; g.fillRect(0,fy+fh-4,w,4);
      for(let i=0;i<16;i++){ const x=i*bw+10, y=fy+16, ww=bw-20, wh=fh-38; const isLit=R()<.28; lit.push([x,y,ww,wh,isLit]);
        both(g,b,'#bab4aa',200,c=>c.fillRect(x-4,y-4,ww+8,wh+8)); // frame
        b.fillStyle=hg(70); b.fillRect(x,y,ww,wh); // recessed glass
        const gl=g.createLinearGradient(x,y,x+ww,y+wh);
        if(isLit){ gl.addColorStop(0,'#ffe6a8'); gl.addColorStop(1,'#d89a48'); }
        else { gl.addColorStop(0,'#5a7a9a'); gl.addColorStop(.45,'#1e2c3e'); gl.addColorStop(1,'#101822'); }
        g.fillStyle=gl; g.fillRect(x,y,ww,wh);
        if(!isLit){ g.fillStyle='rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x+ww*.15,y); g.lineTo(x+ww*.45,y); g.lineTo(x+ww*.1,y+wh); g.lineTo(x,y+wh); g.lineTo(x,y+wh*.6); g.fill(); }
        else if(R()<.5){ g.fillStyle='rgba(120,70,30,.45)'; g.fillRect(x,y,ww*.35,wh); }
        g.fillStyle='#a8a298'; g.fillRect(x+ww/2-1.5,y,3,wh); g.fillRect(x,y+wh*.38,ww,3); // mullions
        g.fillStyle='rgba(0,0,0,.35)'; g.fillRect(x,y,ww,3); // lintel shadow
        both(g,b,'#cfc9be',220,c=>c.fillRect(x-6,y+wh+4,ww+12,5)); // sill
      }
    }
    grain(g,b,w,h,8,.22,5,4,.15);
  });
  const E=cvTex(W,H,(g,w,h)=>{ g.fillStyle='#000'; g.fillRect(0,0,w,h); for(const [x,y,ww,wh,l] of lit) if(l){ g.fillStyle='#ffd890'; g.fillRect(x,y,ww,wh); g.fillStyle='#000'; g.fillRect(x+ww/2-1.5,y,3,wh); g.fillRect(x,y+wh*.38,ww,3); } },true);
  return {map:T.map,bump:T.bump,em:E};
});
export const roofT=once(()=>cvTex2(512,512,(g,b,w,h)=>{ const R=mulberry(11);
  pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*8,y/h*8,8,4); const v=160+(n-.5)*36+(R()-.5)*44; return [v,v,v*.98]; });
  for(let i=0;i<2600;i++){ const x=R()*w, y=R()*h, r=1+R()*2.2, v=110+R()*120|0; g.fillStyle=`rgb(${v},${v},${v-6})`; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); b.fillStyle=hg(150+R()*100); b.beginPath(); b.arc(x,y,r,0,TAU); b.fill(); }
  // tar seams + a few stains
  g.strokeStyle='rgba(40,40,44,.5)'; g.lineWidth=3; for(let i=0;i<4;i++){ g.beginPath(); g.moveTo(0,i*128+64+(R()-.5)*20); g.lineTo(w,i*128+64+(R()-.5)*20); g.stroke(); }
  for(let i=0;i<8;i++){ const x=R()*w, y=R()*h, r=20+R()*50; const sg=g.createRadialGradient(x,y,0,x,y,r); sg.addColorStop(0,'rgba(60,55,50,.3)'); sg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=sg; g.fillRect(x-r,y-r,r*2,r*2); }
}));
export const acT=once(()=>cvTex2(256,256,(g,b,w,h)=>{ g.fillStyle='#b8bcc4'; g.fillRect(0,0,w,h); b.fillStyle=hg(200); b.fillRect(0,0,w,h);
  for(let y=20;y<h-20;y+=10){ both(g,b,'#7a7e88',90,c=>c.fillRect(20,y,w-40,4)); }
  g.fillStyle='#2a2c32'; g.beginPath(); g.arc(w*.7,h*.5,56,0,TAU); g.fill(); g.strokeStyle='#d8dce4'; g.lineWidth=5; g.stroke();
  g.fillStyle='#5a5e66'; for(let i=0;i<4;i++){ g.save(); g.translate(w*.7,h*.5); g.rotate(i*PI/2+.4); g.beginPath(); g.ellipse(24,0,24,9,0,0,TAU); g.fill(); g.restore(); }
  grain(g,b,w,h,8,.2,2,3,.1);
},false));


// ================= PHASE 2: MEAN STREETS (top-down crime city) =================
export const P2G={hero:[13,16],spawns:M1CFG.spawns,exit:[13,10],enemies:3,release:[.5,2.5,4.5],startOut:true,heroSpd:8,enSpd:6.4,fright:6,corners:M1CFG.corners,dur:80,enRamp:.05,killOnEat:true};
// HD car: shared geometry, clear-coat paint, glass with reflections, real wheels with rims
const CARG=once(()=>({
  body:new RoundedBoxGeometry(1.0,.36,1.82,4,.15), skirt:new RoundedBoxGeometry(1.02,.14,1.7,2,.06),
  cab:new RoundedBoxGeometry(.86,.34,.98,4,.13), roof:new RoundedBoxGeometry(.78,.05,.62,3,.025),
  hood:new RoundedBoxGeometry(.9,.03,.52,2,.012), trunk:new RoundedBoxGeometry(.9,.03,.32,2,.012),
  lamp:new RoundedBoxGeometry(.24,.09,.05,2,.02), bumper:new RoundedBoxGeometry(1.02,.11,.1,2,.04),
  tire:new THREE.CylinderGeometry(.19,.19,.15,16), rim:new THREE.CylinderGeometry(.115,.115,.16,12), hub:new THREE.CylinderGeometry(.04,.04,.17,8),
  mirror:new RoundedBoxGeometry(.1,.06,.06,2,.02), grille:new THREE.BoxGeometry(.5,.07,.02),
  bar:new RoundedBoxGeometry(.66,.06,.2,2,.025), beacon:new RoundedBoxGeometry(.27,.09,.17,2,.035),
}));
const CARM=once(()=>({
  glass:new THREE.MeshPhysicalMaterial({color:0x0a1420,roughness:.04,metalness:.2,clearcoat:1,clearcoatRoughness:.02,envMapIntensity:1.6}),
  tire:new THREE.MeshStandardMaterial({color:0x121214,roughness:.85,metalness:0}),
  rim:new THREE.MeshStandardMaterial({color:0xd8dce4,roughness:.18,metalness:1}),
  trim:new THREE.MeshStandardMaterial({color:0x1a1c20,roughness:.5,metalness:.4}),
  chrome:new THREE.MeshStandardMaterial({color:0xe8ecf0,roughness:.1,metalness:1}),
  hl:new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,2.1,1.6),toneMapped:false}),
  tl:new THREE.MeshBasicMaterial({color:new THREE.Color(1.8,.08,.08),toneMapped:false}),
  black:new THREE.MeshPhysicalMaterial({color:0x0c0c10,roughness:.3,metalness:.4,clearcoat:1,clearcoatRoughness:.08}),
}));
// perf: every part that shares a material is merged into one mesh, so a car is ~8 draw calls
// instead of ~25 (and only the big parts cast shadows)
const CARP=once(()=>{
  const G2=CARG(), W4=[[-.5,.58],[.5,.58],[-.5,-.58],[.5,-.58]];
  const mg=list=>mergeGeometries(list.map(([geo,x,y,z,rz])=>{ const g=geo.index?geo.toNonIndexed():geo.clone(); if(rz) g.rotateZ(rz); g.translate(x,y,z); return g; }));
  const wheels=(geo,off)=>W4.map(([x,z])=>[geo,x+(off?Math.sign(x)*.005:0),.2,z,PI/2]);
  const trim=[[G2.skirt,0,.26,0],[G2.bumper,0,.3,.93],[G2.bumper,0,.3,-.93],...wheels(G2.hub,true)];
  return {
    paint:mg([[G2.body,0,.4,0],[G2.roof,0,.885,-.12],[G2.mirror,-.33*1.55,.62,.3],[G2.mirror,.33*1.55,.62,.3]]),
    trim:mg(trim), copTrim:mg([...trim,[G2.bar,0,.92,-.12]]),
    glass:mg([[G2.cab,0,.7,-.12]]), chrome:mg([[G2.grille,0,.42,.915]]),
    hl:mg([[G2.lamp,-.33,.44,.9],[G2.lamp,.33,.44,.9]]), tl:mg([[G2.lamp,-.33,.44,-.9],[G2.lamp,.33,.44,-.9]]),
    tire:mg(wheels(G2.tire)), rim:mg(wheels(G2.rim,true)),
    black:mg([[G2.hood,0,.585,.6],[G2.trunk,0,.585,-.72]]),
  };
});
export function makeCar(col,cop){
  const G2=CARG(), M=CARM(), P=CARP();
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const paint=new THREE.MeshPhysicalMaterial({color:col,roughness:.32,metalness:.55,clearcoat:1,clearcoatRoughness:.06,emissive:col,emissiveIntensity:.05});
  const add=(geo,mat,x,y,z,shadow)=>{ const ms=new THREE.Mesh(geo,mat); ms.position.set(x,y,z); ms.castShadow=!!shadow; body.add(ms); return ms; };
  add(P.paint,paint,0,0,0,1); add(cop?P.copTrim:P.trim,M.trim,0,0,0,1); add(P.glass,M.glass,0,0,0,1); add(P.tire,M.tire,0,0,0,1);
  add(P.rim,M.rim,0,0,0); add(P.chrome,M.chrome,0,0,0); add(P.hl,M.hl,0,0,0); add(P.tl,M.tl,0,0,0);
  const ud={body,core:body,mat:paint,col:new THREE.Color(col),style:'car'};
  if(cop){
    add(P.black,M.black,0,0,0,1);
    const lr=add(G2.beacon,new THREE.MeshBasicMaterial({color:new THREE.Color(3,.15,.15),toneMapped:false}),-.18,.97,-.12);
    const lb=add(G2.beacon,new THREE.MeshBasicMaterial({color:new THREE.Color(.15,.5,3),toneMapped:false}),.18,.97,-.12);
    const eye=new THREE.Group(); eye.position.set(0,.66,.62); eye.scale.setScalar(.7); body.add(eye);
    eye.add(new THREE.Mesh(eyeWGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.15,metalness:0,emissive:0x333333})));
    const pup=new THREE.Mesh(pupGeo,new THREE.MeshStandardMaterial({color:0x050505,roughness:.05})); pup.position.z=.24; eye.add(pup);
    Object.assign(ud,{lr,lb,eye,pup});
  }
  g.userData=ud; return g;
}
const harbourT=once(()=>cvTex(512,512,(g,w,h)=>{ pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*8,y/h*8,8,5), n2=fbm(x/w*4+5,y/h*16,4,3); const v=n*.65+n2*.35; return [14+v*50,52+v*80,76+v*100]; });
    g.strokeStyle='rgba(210,240,255,.22)'; g.lineWidth=1.5; const R=mulberry(8); for(let i=0;i<70;i++){ const x=R()*w, y=R()*h, l=10+R()*40; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+l/2,y-3,x+l,y); g.stroke(); } },true));
export function buildGtaEnv(m){
  const bg=GS.W3.bg;
  scene.background=new THREE.Color(0x0e1a24); scene.fog=new THREE.Fog(0x0e1a24,80,220);
  // HD harbour water: fbm ripples used as colour + bump, reflecting the sky env map
  const wt=harbourT();
  wt.repeat.set(36,36);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(900,900),new THREE.MeshStandardMaterial({color:0xffffff,map:wt,bumpMap:wt,bumpScale:3,roughness:.14,metalness:.25})); water.rotation.x=-PI/2; water.position.y=-.6; water.receiveShadow=true; bg.add(water); GS.W3.water=wt;
  const rf=roofT(), qt=rf.map.clone(), qb=rf.bump.clone(); qt.needsUpdate=qb.needsUpdate=true; qt.repeat.set(14,.5); qb.repeat.set(14,.5);
  const shore=new THREE.Mesh(new THREE.BoxGeometry(m.W*S+3,.6,m.H*S+3),new THREE.MeshStandardMaterial({color:0x6a6a72,map:qt,bumpMap:qb,bumpScale:2,roughness:.9})); shore.position.y=-.32; shore.receiveShadow=true; bg.add(shore);
  // mooring posts along the quay
  const postM=new THREE.MeshStandardMaterial({color:0x2a2c30,roughness:.5,metalness:.6}), postG=new THREE.CylinderGeometry(.14,.18,.5,14);
  const hw=(m.W*S+3)/2, hh=(m.H*S+3)/2;
  const pp=[]; for(let x=-hw+2;x<hw;x+=5) for(const z of [-hh+.25,hh-.25]) pp.push([x,z]);
  for(let z=-hh+2;z<hh;z+=5) for(const x of [-hw+.25,hw-.25]) pp.push([x,z]);
  const posts=new THREE.InstancedMesh(postG,postM,pp.length); pp.forEach(([x,z],i)=>posts.setMatrixAt(i,_m4.makeTranslation(x,.2,z))); posts.castShadow=true; bg.add(posts);
  envFrom('#34507a','#7a8696','#18191c',[['#c8b8a0',-30,40,20,5]]);
  hemi.color.set(0xd0dcff); hemi.groundColor.set(0x403830); hemi.intensity=.34; sun.color.set(0xffe2c0); sun.intensity=2.5; sun.position.set(-36,40,22); SUN.dir.set(-36,40,22).normalize();
}
// ---- traffic ----
const CARCOL=[0xd83a3a,0x3a7ad8,0xe0c040,0x38a858,0xe8e8e8,0x8a4ad0,0xe07a2a,0x2a2a30];
function farCell(minD){
  const m=GS.G.m, h=GS.G.hero;
  for(let k=0;k<400;k++){ const x=irand(1,m.W-2), y=irand(1,m.H-2); if(m.cell[y*m.W+x]!==OPEN) continue; if(y===13&&(x<6||x>21)) continue;
    if(Math.hypot(x-h.x,y-h.y)>=minD) return [x,y]; }
  return [1,1];
}
function trafficDecide(c){
  const m=GS.G.m, opts=[];
  for(const [dx,dy] of DIRS){ if((c.dx||c.dy)&&dx===-c.dx&&dy===-c.dy) continue; if(cellAt(m,c.x+dx,c.y+dy)===OPEN) opts.push([dx,dy]); }
  if(!opts.length){ c.dx=-c.dx; c.dy=-c.dy; return; }
  const st=opts.find(o=>o[0]===c.dx&&o[1]===c.dy);
  const o=st&&Math.random()<.65?st:pick(opts); c.dx=o[0]; c.dy=o[1];
}
function spawnTraffic(){
  const [x,y]=farCell(7); const col=pick(CARCOL);
  const c={x,y,dx:0,dy:0,decided:false,obj:makeCar(col,false),fx:1,fy:0,dead:0,honk:0};
  GS.W3.actors.add(c.obj); X.traffic.push(c); return c;
}
// ---- mission props ----
function makeBooth(){
  const g=new THREE.Group();
  const m1=new THREE.MeshPhysicalMaterial({color:0x2a60c8,roughness:.3,metalness:.5,clearcoat:1,clearcoatRoughness:.1,emissive:0x0a1a40});
  const gl=new THREE.MeshPhysicalMaterial({color:0x9ad0ff,roughness:.05,metalness:0,transparent:true,opacity:.35,clearcoat:1});
  const frame=new THREE.Mesh(new RoundedBoxGeometry(.74,1.5,.74,3,.06),m1); frame.position.y=.75; g.add(frame);
  for(const [x,z,ry] of [[0,.375,0],[.375,0,PI/2],[-.375,0,PI/2]]){ const p=new THREE.Mesh(new THREE.PlaneGeometry(.5,.95),gl); p.position.set(x,.8,z); p.rotation.y=ry; g.add(p); }
  const sign=new THREE.Mesh(new RoundedBoxGeometry(.78,.24,.78,2,.05),new THREE.MeshBasicMaterial({color:new THREE.Color(.3,2.2,.6),toneMapped:false})); sign.position.y=1.58; g.add(sign);
  const cap=new THREE.Mesh(new RoundedBoxGeometry(.84,.08,.84,2,.03),m1); cap.position.y=1.74; g.add(cap);
  castAll(g); return g;
}
function makeBeam(col){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,40,16,1,true),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  m.geometry.translate(0,20,0); return m;
}
function makeArrow(){
  const g=new THREE.Group(); const mt=new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,1.8,.2),toneMapped:false});
  const head=new THREE.Mesh(new THREE.ConeGeometry(.45,.8,4),mt); head.rotation.x=PI/2; head.position.z=1.1; g.add(head);
  const sh=new THREE.Mesh(new THREE.BoxGeometry(.22,.12,.8),mt); sh.position.z=.4; g.add(sh);
  return g;
}
function setMission(html,tm){ X.msHtml=html; X.msTm=tm; }
export function gtaSetup(){
  X.traffic=[]; for(let i=0;i<6;i++) spawnTraffic();
  X.wanted=1; X.booth=makeBooth(); GS.W3.fx.add(X.booth); X.beam=makeBeam(new THREE.Color(.3,2,.6)); GS.W3.fx.add(X.beam);
  X.arrow=makeArrow(); GS.W3.fx.add(X.arrow); X.tgtBeam=makeBeam(new THREE.Color(2.2,1.8,.2)); GS.W3.fx.add(X.tgtBeam); X.tgtBeam.visible=false;
  X.ms={st:'phone',idx:0,phone:farCell(8),tgt:null,tm:0,count:0,ring:0};
  GS.G.cfg=Object.assign({},GS.G.cfg);
  setMission('A PAYPHONE IS RINGING · FOLLOW THE ARROW',null);
  X.crewN=0; X.crewT=0; X.crew=[]; spawnTokens();
}
function msComplete(){
  const ms=X.ms, pay=5000*(ms.idx+1); addScore(pay); SFX.win(); banner('MISSION COMPLETE','+$'+pay,'#ffd04a');
  ms.idx++; X.wanted=Math.min(5,X.wanted+1);
  if(GS.G.fright>0&&ms.st==='frenzy'){ GS.G.fright=.01; }
  if(ms.idx>=3){ ms.st='done'; ms.tgt=null; setMission('ALL JOBS DONE · NOW GRAB EVERY LAST DOLLAR',null); return; }
  ms.st='phone'; ms.phone=farCell(8); ms.tgt=null; setMission('ANOTHER PAYPHONE IS RINGING',null);
}
function msFail(why){
  const ms=X.ms; banner('MISSION','FAILED','#ff3355'); SFX.hurt();
  ms.st='phone'; ms.phone=farCell(8); ms.tgt=null; setMission(why+' · FIND THE PAYPHONE TO RETRY',null);
}
const near=(a,b,d=.6)=>b&&Math.abs(a.x-b[0])+Math.abs(a.y-b[1])<d;
export function gtaTick(dt){
  const m=GS.G.m, h=GS.G.hero, ms=X.ms, t=performance.now()/1000;
  if(GS.W3.water){ GS.W3.water.offset.x+=dt*.01; GS.W3.water.offset.y+=dt*.004; }
  crewTick(dt);
  // siren warning: stronger the closer a cop gets
  let cd=99; for(const e of GS.G.en){ if((e.st==='run'||e.st==='leave')&&!e.fr){ const d=Math.hypot(wdx(m,h.x,e.x),wdy(m,h.y,e.y)); if(d<cd) cd=d; } }
  const sk=h.alive?clamp((8-cd)/6.5,0,1):0, sr=$('siren');
  sr.style.setProperty('--sc',(t*5|0)%2?'rgba(255,30,40,.95)':'rgba(30,90,255,.95)');
  sr.style.opacity=(sk*sk*(.65+.35*Math.abs(Math.sin(t*10)))).toFixed(3);
  // cops scale with wanted level
  const want=Math.min(7,2+X.wanted);
  if(GS.G.en.length<want&&GS.G.t>2){ const e=spawnEnemy(GS.G.en.length,.4); }
  GS.G.cfg.enSpd=6.2+X.wanted*.3;
  // missions
  if(ms.st==='phone'){
    ms.ring-=dt; if(ms.ring<=0){ ms.ring=1.4; const d=Math.hypot(h.x-ms.phone[0],h.y-ms.phone[1]); if(d<16){ const tt=now(); tone({f:1400,d:.06,v:.035,t:tt,type:'square'}); tone({f:1100,d:.06,v:.035,t:tt+.08,type:'square'}); tone({f:1400,d:.06,v:.035,t:tt+.16,type:'square'}); } }
    if(near(h,ms.phone)){
      SFX.coin();
      if(ms.idx===0){ ms.st='pickup'; ms.tgt=farCell(9); setMission('JOB 1 · GRAB THE HOT DATA. FOLLOW THE ARROW.',null); }
      else if(ms.idx===1){ ms.st='frenzy'; ms.count=0; startFright(15); GS.G.frightMax=15; X.frenzy=true; setMission('JOB 2 · KILL FRENZY! WRECK 4 COP CARS',null); SFX.alarm(); hint('KILL FRENZY!',1.5); }
      else { ms.st='survive'; ms.tm=12; X.wanted=5; setMission('JOB 3 · THE HEAT IS ON. SURVIVE!',12); SFX.alarm(); }
    }
  } else if(ms.st==='pickup'){
    if(near(h,ms.tgt)){ SFX.power(); ms.st='deliver'; ms.tgt=farCell(11); ms.tm=22; setMission('GOT IT! DELIVER TO THE DROP BEFORE THE TIMER ENDS',22); }
  } else if(ms.st==='deliver'){
    ms.tm-=dt; X.msTm=ms.tm; if(near(h,ms.tgt)) msComplete(); else if(ms.tm<=0) msFail('TOO SLOW');
  } else if(ms.st==='frenzy'){
    X.msHtml='JOB 2 · KILL FRENZY! WRECKED '+ms.count+' / 4'; X.msTm=GS.G.fright;
    if(ms.count>=4) msComplete(); else if(GS.G.fright<=0) msFail('FRENZY OVER');
  } else if(ms.st==='survive'){
    ms.tm-=dt; X.msTm=ms.tm; if(ms.tm<=0) msComplete();
  }
  if(ms.st!=='frenzy') X.frenzy=false;
  // props
  const showPhone=ms.st==='phone';
  X.booth.visible=X.beam.visible=showPhone;
  if(showPhone){ GS.W3.map(ms.phone[0],ms.phone[1],0,_o); X.booth.position.copy(_o.p); X.booth.position.y+=Math.abs(Math.sin(t*14))*.05; X.beam.position.copy(_o.p); }
  X.tgtBeam.visible=!!ms.tgt; if(ms.tgt){ GS.W3.map(ms.tgt[0],ms.tgt[1],0,_o); X.tgtBeam.position.copy(_o.p); X.tgtBeam.material.opacity=.2+Math.sin(t*6)*.1; }
  const goal=ms.tgt||(showPhone?ms.phone:null);
  X.arrow.visible=!!goal&&h.alive;
  if(goal){ const dx=goal[0]-h.x, dy=goal[1]-h.y, L=Math.hypot(dx,dy)||1; GS.W3.map(h.x+dx/L*1.6,h.y+dy/L*1.6,2.6+Math.sin(t*5)*.2,_o); placeObj(X.arrow,_o,dx/L,dy/L,1); }
  // traffic
  for(const c of X.traffic){
    if(c.dead>0){ c.dead-=dt; c.obj.visible=false; if(c.dead<=0){ const [x,y]=farCell(8); c.x=x; c.y=y; c.dx=c.dy=0; c.decided=false; } continue; }
    c.obj.visible=true;
    const hx=wdx(m,c.x,h.x), hy=wdy(m,c.y,h.y), ahead=hx*c.dx+hy*c.dy, lat=Math.abs(hx*c.dy-hy*c.dx);
    const blocked=h.alive&&ahead>0&&ahead<1.6&&lat<.5&&GS.G.fright<=0;
    if(!blocked) stepActor(m,c,4.6*GS.speedMul*dt,trafficDecide);
    else { c.honk-=dt; if(c.honk<=0){ c.honk=1.2; tone({f:330,d:.25,v:.05,type:'sawtooth',lp:900}); tone({f:415,d:.25,v:.04,type:'sawtooth',lp:900}); } }
    if(c.dx||c.dy){ c.fx=lerp(c.fx,c.dx,1-Math.exp(-dt*10)); c.fy=lerp(c.fy,c.dy,1-Math.exp(-dt*10)); }
    GS.W3.map(c.x,c.y,0,_o); placeObj(c.obj,_o,c.fx,c.fy,1);
    if(GS.G.fright>0&&h.alive&&Math.hypot(hx,hy)<.8){ c.dead=3; burstAt(c.x,c.y,.6,40,['#ff8a2a','#ffd04a','#333','#fff'],10,.3,1,8); SFX.boom(); cam.shake=Math.max(cam.shake,.4); addScore(100); pop3(c.x,c.y,'+$100','#ffd04a'); }
  }
}
// ---- the crew: collect 4 tokens, a friendly gang hunts the cops for 20s ----
const tokGeo=new THREE.OctahedronGeometry(.42,0);
function spawnTokens(){
  X.tokens=[];
  for(let i=0;i<4;i++){ let c=farCell(6); for(let k=0;k<20&&X.tokens.some(t=>t.x===c[0]&&t.y===c[1]);k++) c=farCell(6);
    const g=new THREE.Group(); g.add(new THREE.Mesh(tokGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(.4,2.4,.6),toneMapped:false}))); g.add(glowSprite(0x40ff70,2.6,.5));
    GS.W3.fx.add(g); X.tokens.push({x:c[0],y:c[1],obj:g}); }
}
function crewDecide(c){
  const m=GS.G.m, cand=[];
  for(const [dx,dy] of DIRS){ if((c.dx||c.dy)&&dx===-c.dx&&dy===-c.dy) continue; if(cellAt(m,c.x+dx,c.y+dy)===OPEN) cand.push([dx,dy]); }
  if(!cand.length){ c.dx=-c.dx; c.dy=-c.dy; return; }
  let best=pick(cand);
  if(c.tgt){ let bd=1e9; for(const d of cand){ const ddx=wdx(m,c.x+d[0],c.tgt.x), ddy=wdy(m,c.y+d[1],c.tgt.y), v=ddx*ddx+ddy*ddy; if(v<bd){bd=v;best=d;} } }
  c.dx=best[0]; c.dy=best[1];
}
function startCrew(){
  const m=GS.G.m, h=GS.G.hero; X.crewT=20; X.crew=[]; X.crewN=0;
  banner('THE CREW','HAS YOUR BACK','#3aff6a'); SFX.win(); hint('YOUR CREW IS HUNTING THE COPS FOR 20 SECONDS',2.5);
  const spots=[]; for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++){ if(m.cell[y*m.W+x]!==OPEN) continue; const d=Math.hypot(x-h.x,y-h.y); if(d>=2&&d<=7&&!(y===13&&(x<6||x>21))) spots.push([x,y]); }
  for(let i=0;i<3;i++){ const s=pick(spots.length?spots:[farCell(3)]); const obj=makeCar(0x1f9a3a,false);
    const lt=new THREE.Mesh(new THREE.BoxGeometry(.5,.12,.2),new THREE.MeshBasicMaterial({color:new THREE.Color(.3,3,.6),toneMapped:false})); lt.position.set(0,.93,-.1); obj.userData.body.add(lt);
    GS.W3.actors.add(obj); X.crew.push({x:s[0],y:s[1],dx:0,dy:0,decided:false,obj,fx:0,fy:1,tgt:null});
    burstAt(s[0],s[1],.5,20,['#3aff6a','#fff'],6,.2,.7); }
}
function crewTick(dt){
  const m=GS.G.m, h=GS.G.hero, t=performance.now()/1000;
  for(let i=X.tokens.length-1;i>=0;i--){ const k=X.tokens[i]; GS.W3.map(k.x,k.y,1+Math.sin(t*4+i)*.2,_o); k.obj.position.copy(_o.p); k.obj.children[0].rotation.y+=dt*3;
    if(h.alive&&Math.abs(h.x-k.x)+Math.abs(h.y-k.y)<.7){ k.obj.removeFromParent(); X.tokens.splice(i,1); X.crewN++; SFX.coin(); burstAt(k.x,k.y,1,18,['#3aff6a','#fff'],5,.15,.6);
      if(X.crewN>=4) startCrew(); else hint('CREW TOKEN '+X.crewN+' / 4',1.4); } }
  if(X.crewT>0){
    X.crewT-=dt;
    for(const c of X.crew){
      let best=null, bd=1e9; for(const e of GS.G.en){ if(!(e.st==='run'||e.st==='leave')) continue; const d=Math.hypot(wdx(m,c.x,e.x),wdy(m,c.y,e.y)); if(d<bd){bd=d;best=e;} }
      c.tgt=best; stepActor(m,c,9.5*GS.speedMul*dt,crewDecide);
      if(c.dx||c.dy){ c.fx=lerp(c.fx,c.dx,1-Math.exp(-dt*10)); c.fy=lerp(c.fy,c.dy,1-Math.exp(-dt*10)); }
      GS.W3.map(c.x,c.y,0,_o); placeObj(c.obj,_o,c.fx,c.fy,1);
      if(best&&bd<.9){ best.st='dead'; best.dead=3; best.fr=false; addScore(300); pop3(best.x,best.y,'+$300','#3aff6a'); burstAt(best.x,best.y,.8,40,['#e8eef8','#ff3030','#3080ff','#ff8a2a','#333'],10,.3,1,8); SFX.boom(); cam.shake=Math.max(cam.shake,.3); }
    }
    if(X.crewT<=0){ for(const c of X.crew){ burstAt(c.x,c.y,.6,16,['#3aff6a','#aaa'],5,.25,.8); c.obj.removeFromParent(); } X.crew=[]; X.crewT=0; hint('THE CREW IS GONE · FIND 4 NEW TOKENS',2); spawnTokens(); }
  }
}
export function gtaClear(){
  for(const k of X.tokens||[]) k.obj.removeFromParent(); for(const c of X.crew||[]) c.obj.removeFromParent(); X.tokens=[]; X.crew=[]; X.crewT=0; X.crewN=0;
  for(const c of X.traffic||[]) c.obj.removeFromParent();
  for(const k of ['booth','beam','arrow','tgtBeam']) if(X[k]){ X[k].removeFromParent(); X[k]=null; }
  X.traffic=[]; X.ms=null; X.msHtml=null;
}

// ---------- city look for buildWorld (see engine/world.js) ----------
const GTA_STYLE={
  name:'gta', wallH:1.5,
  enemyModel:()=>makeCar(0xe8eef8,true), // the glitches are cop cars here
  bodyMat(){
    const fc=facadeT(), rf=roofT();
    const side=worldUV(new THREE.MeshStandardMaterial({color:0xffffff,map:fc.map,bumpMap:fc.bump,bumpScale:1.4,emissive:0xffffff,emissiveMap:fc.em,emissiveIntensity:.55,roughness:.62,metalness:.15}),8,2);
    const roof=worldUV(new THREE.MeshStandardMaterial({color:0xffffff,map:rf.map,bumpMap:rf.bump,bumpScale:1.5,roughness:.92,metalness:.02}),6,6,true);
    return [side,side,roof,roof,side,side];
  },
  // each connected block of wall cells is one building: shared height and colour (edge = low harbour sheds, police HQ = blue)
  wallHeights(W,wallCells,bodies){
    const m=W.m, comp=new Int32Array(m.W*m.H).fill(-1), info=[];
    const PAL=['#b8a58a','#9aa4b4','#c49a82','#8fa08a','#d0c4a4','#a48ca8','#c8b07a','#8c9cb0','#b07a6a'];
    for(const [sx,sy] of wallCells){ const si=sy*m.W+sx; if(comp[si]>=0) continue; const ci=info.length; const st=[si]; comp[si]=ci; let edge=false, pol=false;
      while(st.length){ const a=st.pop(), ax=a%m.W, ay=(a/m.W)|0; if(ax===0||ay===0||ax===m.W-1||ay===m.H-1) edge=true;
        for(const [dx,dy] of DIRS){ const bx=ax+dx, by=ay+dy; if(bx<0||by<0||bx>=m.W||by>=m.H) continue; const b=by*m.W+bx; const cc=m.cell[b];
          if(cc===PEN||cc===DOOR) pol=true; if(cc===WALL&&comp[b]<0){ comp[b]=ci; st.push(b); } } }
      const r=mulberry(ci*97+13);
      info.push(edge?{h:1.1,col:new THREE.Color('#a88a78')}:pol?{h:1.5,col:new THREE.Color('#6a86c0')}:{h:1.7+r()*2.6,col:new THREE.Color(PAL[(r()*PAL.length)|0])});
    }
    W.bodyInfo.forEach((b,k)=>{ const i=b.y*m.W+b.x, cp=info[comp[i]]; b.h=cp.h; W.hgt[i]=cp.h; bodies.setColorAt(k,cp.col); });
    W.comp=comp; W.compInfo=info;
    bodies.castShadow=bodies.receiveShadow=true;
  },
  // roof AC units + low parapet walls around every roof edge
  decorate(W){
    const m=W.m, R2=mulberry(4242), cand=W.bodyInfo.filter(()=>R2()<.22), at=acT();
    const ac=new THREE.InstancedMesh(new RoundedBoxGeometry(1,1,1,2,.06),new THREE.MeshStandardMaterial({color:0xffffff,map:at.map,bumpMap:at.bump,bumpScale:1.2,roughness:.45,metalness:.55}),Math.max(1,cand.length));
    W.acList=cand.map(b=>({b,ox:R2()*.8-.4,oy:R2()*.8-.4,w:.35+R2()*.5,d:.35+R2()*.5,h:.2+R2()*.3}));
    ac.castShadow=ac.receiveShadow=true; W.g.add(ac); W.ac=ac;
    W.parList=[]; W.bodyInfo.forEach((b,k)=>{ for(const [dx,dy] of DIRS){ if(cellAt(m,b.x+dx,b.y+dy)!==WALL) W.parList.push({k,b,dx,dy}); } });
    const par=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.75,metalness:.05}),Math.max(1,W.parList.length));
    W.parList.forEach((p,i)=>{ _c.copy(W.compInfo[W.comp[p.b.y*m.W+p.b.x]].col).offsetHSL(0,-.05,.1); par.setColorAt(i,_c); });
    par.castShadow=par.receiveShadow=true; W.g.add(par); W.par=par;
  },
  layout(W,r){
    W.parList.forEach((p,k)=>{ const b=p.b; if(!b.alive){ W.par.setMatrixAt(k,ZERO); return; } const st=riseAt(r,b.x,b.y), h=b.h*st;
      W.map(b.x+p.dx*.47,b.y+p.dy*.47,h+.08,_o); basisMat(_m4,_o,p.dx?.12:_o.ke+.12,st>.98?.16:.001,p.dy?.12:_o.ks+.12); W.par.setMatrixAt(k,_m4); }); W.par.instanceMatrix.needsUpdate=true;
    W.acList.forEach((a,k)=>{ const st=riseAt(r,a.b.x,a.b.y), h=a.b.h*st; W.map(a.b.x+a.ox,a.b.y+a.oy,h+a.h/2,_o); basisMat(_m4,_o,a.w,st>.98?a.h:.001,a.d); W.ac.setMatrixAt(k,_m4); }); W.ac.instanceMatrix.needsUpdate=true;
  },
  floor(W){ const m=W.m; const fl=new THREE.Mesh(new THREE.PlaneGeometry(m.W*S,m.H*S),new THREE.MeshStandardMaterial({color:0xffffff,map:streetTex(m),roughness:.9,metalness:0}));
    fl.rotation.x=-PI/2; fl.position.y=-.01; W.g.add(fl); return fl; },
  // the dots are banknotes lying on the street
  dots:{geo:(()=>{ const g=new THREE.PlaneGeometry(.62,.34); g.rotateX(-PI/2); return g; })(), mat:()=>new THREE.MeshBasicMaterial({map:cashTex}),
    place(W,i,k){ const x=i%W.m.W, y=(i/W.m.W)|0; W.map(x,y,.06,_o); basisMat(_m4,_o,1,1,1); _m4.multiply(new THREE.Matrix4().makeRotationY(((i*.618)%1)*1.2-.6)); W.dotMesh.setMatrixAt(k,_m4); }},
};
// ---------- phase object ----------
const P2={
  name:'MEAN STREETS', color:'#ffd04a', song:'p2', world:GTA_STYLE, cfg:P2G,
  deathTitle:'WASTED', deathText:'The glitch cops got you.', powerName:'FRENZY',
  ui:{cam:'top', wanted:true, bloom:[.42,.78], sun:30, pix:1.5, msaa:2},
  hint:()=>'GRAB ALL THE CASH TO FINISH · 4 GREEN TOKENS CALL YOUR CREW · PAYPHONES = JOBS',
  buildEnv:buildGtaEnv, setup:gtaSetup, extraTick:gtaTick, clear:gtaClear,
  hooks:()=>({
    hit:e=>{ if(e){ e.dx=-e.dx; e.dy=-e.dy; e.decided=false; } hurtHero('BUSTED'); },
    dot:(i,d)=>{ hideDot3(i); if(d===2) hint('FRENZY! WRECK THE COP CARS',1.5); },
    eatEnemy:(e,pts)=>{ burstAt(e.x,e.y,1,44,['#e8eef8','#ff3030','#3080ff','#ff8a2a','#333'],9,.25,.9); pop3(e.x,e.y,'+$'+pts);
      SFX.boom(); cam.shake=Math.max(cam.shake,.4); if(X.ms&&X.ms.st==='frenzy') X.ms.count++; },
  }),
  camera(){ cam.hgt=23; cam.back=.01; cam.ahead=0; cam.k=6; cam.fov=52; },
  // coming from 1980 the same maze rises out of the screen; otherwise the city rises from below
  start(opt){
    const m=(opt.fromP1&&GS.G)?GS.G.m:parseMaze(MAZE1,true,false);
    startMazePhase(P2,m); const go=mazeGo(P2), W3=GS.W3;
    if(opt.fromP1){
      const asp=innerWidth/innerHeight, tf=Math.tan(27.5*PI/180), d=Math.max((m.H*S/2+6)/tf,(m.W*S/2+3)/(tf*asp));
      camPose(_v.set(0,d,.01),_v2.set(0,0,0),_v3.set(0,0,-1)); cam.bl=0; W3.rise=0; layoutWalls(); flash(.7);
      runSeq(3.2,(t)=>{ W3.rise=easeOut(clamp(t/1.7,0,1)); layoutWalls(); cam.bl=ease(clamp((t-.9)/2.3,0,1)); },go);
    } else {
      camPose(_v.set(0,75,.01),_v2.set(0,0,0),_v3.set(0,0,-1)); cam.bl=0; W3.rise=0; layoutWalls();
      runSeq(2.6,(t)=>{ W3.rise=easeOut(clamp(t/1.6,0,1)); layoutWalls(); cam.bl=ease(clamp((t-.4)/2.2,0,1)); },go);
    }
  },
  tick(dt){ mazePlayTick(P2,dt); },
  deadTick(dt){ mazeTick(dt); },
  sync:mazeSync,
  outro(next){
    banner('GOING','UNDERGROUND','#ff5a2a'); SFX.whoosh(); $('mission').style.display='none';
    const h0=cam.hgt;
    runSeq(1.7,(t)=>{ cam.hgt=lerp(h0,1.2,ease(clamp(t/1.5,0,1))); if(t>1.35&&!GS.seq.fl){ GS.seq.fl=1; flash(1); SFX.slam(); } },next);
  },
  hud(){
    if(GS.mode!=='play') $('siren').style.opacity=0;
    if(X.ms){ const wh='★'.repeat(X.wanted)+'☆'.repeat(5-X.wanted)+`<div style="font-size:9px;letter-spacing:.1em;margin-top:6px;color:#3aff6a">${X.crewT>0?'CREW ACTIVE '+Math.ceil(X.crewT)+'s':'CREW TOKENS '+X.crewN+'/4'}</div>`; const wd=$('wanted'); if(wd._h!==wh){ wd._h=wh; wd.innerHTML=wh; }
      const mi=$('mission'); const show=GS.mode==='play'&&X.msHtml; mi.style.display=show?'block':'none';
      if(show){ const tm=X.msTm!=null?`<span class="tm">${Math.max(0,Math.ceil(X.msTm))}</span>`:''; const html=X.msHtml+tm; if(mi._h!==html){ mi._h=html; mi.innerHTML=html; } } }
    return {left:'$ LEFT '+Math.max(0,GS.G.small)};
  },
  mini:{cs:4, scale:[.85,1.5], wall:'#8a8070', bg:'rgba(30,32,38,.85)', dot:'#7adf7a', pow:'#ff4040', enemy:(e,t)=>(t*6|0)%2?'#ff2a2a':'#2a6aff'},
  miniExtras(g,cs,t){
    if(X.traffic){ g.fillStyle='#c8c8d0'; for(const c of X.traffic) if(c.dead<=0) g.fillRect(c.x*cs+1,c.y*cs+1,cs-2,cs-2); }
    const ms=X.ms; if(ms){ const tg=ms.tgt||(ms.st==='phone'?ms.phone:null); if(tg&&(t*3|0)%2){ g.fillStyle=ms.tgt?'#ffd04a':'#3aff6a'; g.fillRect(tg[0]*cs-2,tg[1]*cs-2,cs+4,cs+4); } }
    if(X.tokens&&(t*3|0)%2){ g.fillStyle='#3aff6a'; for(const k of X.tokens){ g.fillRect(k.x*cs-1,k.y*cs+1,cs+2,cs-2); g.fillRect(k.x*cs+1,k.y*cs-1,cs-2,cs+2); } }
    if(X.crew){ g.fillStyle='#3aff6a'; for(const c of X.crew) g.fillRect(c.x*cs-1,c.y*cs-1,cs+2,cs+2); }
  },
};
export default P2;
