import * as THREE from 'three';
import {GS} from '../core/state.js';
import {$, clamp, ease, lerp, mulberry, PI, rand, TAU, TOUCH} from '../core/utils.js';
import {inp, keys} from '../core/input.js';
import {initAudio, setSong, SFX, tone} from '../core/audio.js';
import {addScore} from '../core/maze-game.js';
import {_m4, _o, _q, _v, _v2, _v3, castAll, envFrom, hemi, heroLight, placeObj, scene, SUN, sun, ZERO} from '../engine/renderer.js';
import {cvTex, cvTex2, fbm, grain, hg, once, pxFill} from '../engine/textures.js';
import {makeBot, makeVirus} from '../engine/models.js';
import {burst} from '../engine/fx.js';
import {glowSprite, skyDome} from '../engine/environments.js';
import {A3, pop3} from '../engine/actors.js';
import {miniC, miniX} from '../ui/minimap.js';
import {banner, flash, hint, setGlow, updHearts} from '../ui/hud.js';
import {endPhase, hurtHero, runSeq} from '../main.js';
import {clearWorld} from '../engine/world.js';
import {cam, camPose, camUpdate} from '../engine/camera.js';
// ================= PHASE 4: BLOCK WORLD '85 (2.5D side-scrolling platformer) =================
export const PL={};
function boxUV(geo,w,h,d,k=.5){ const uv=geo.attributes.uv, dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++) for(let v=0;v<4;v++){ const i=f*4+v; uv.setXY(i,uv.getX(i)*dims[f][0]*k,uv.getY(i)*dims[f][1]*k); } uv.needsUpdate=true; return geo; }
// ---------- level ----------
function buildLevel(){
  const S=[],D=[],P=[],E=[],SP=[];
  const line=(a,b,y,st=1.5)=>{ for(let t=a;t<=b+1e-6;t+=st) D.push([t,y]); };
  const arc=(a,b,y,hg)=>{ const n=Math.max(3,Math.round((b-a)/1.3)); for(let i=0;i<=n;i++){ const k=i/n; D.push([lerp(a,b,k),y+Math.sin(k*PI)*hg]); } };
  const ground=(a,b,y=0,dots=true)=>{ S.push({x0:a,x1:b,y0:-9,y1:y,type:'ground'}); if(dots) line(a+1.4,b-1.4,y+1.1); };
  const block=(a,b,h,y0=0,type='stone',dots=true)=>{ S.push({x0:a,x1:b,y0,y1:y0+h,type}); if(dots) line(a+.6,b-.6,y0+h+1.1,1.3); };
  const plat=(a,b,y,dots=true)=>{ S.push({x0:a,x1:b,y0:y-.45,y1:y,type:'plat'}); if(dots) line(a+.5,b-.5,y+1.1,1.3); };
  block(-9,-6,14,0,'stone',false);
  ground(-6,18); E.push({kind:'walk',x0:6,x1:16,y:0});
  arc(17.4,21.6,1.2,2.6);
  ground(21,35,0,false); line(22.4,24.5,1.1); block(25,28,1.3); block(28,31,2.6); block(31,34,1.3);
  arc(34.4,39.6,1.2,2.8);
  ground(39,55); plat(48.5,51.5,3.7,false); P.push([50,5.1]); E.push({kind:'fly',x:45,y:3.4});
  plat(57,59.5,2.2); plat(61,63.5,3.3); arc(63.8,66.6,4.3,1.2);
  ground(66,80); E.push({kind:'chase',x0:67,x1:76,y:0}); SP.push([78,0]);
  ground(80,92,5.6); E.push({kind:'walk',x0:82,x1:91,y:5.6});
  ground(92,110,0); block(99,100.4,1.7,0,'stone',false); E.push({kind:'walk',x0:93,x1:98.4,y:0}); E.push({kind:'walk',x0:101.2,x1:109,y:0});
  S.push({x0:112.5,x1:115.5,y0:1.35,y1:1.8,type:'plat',mv:{amp:4.2,spd:.9}}); line(111,123,3.6,1.4);
  ground(124,140); block(128,130,2); block(133,136,3.3); E.push({kind:'fly',x:137,y:5.4}); E.push({kind:'walk',x0:136.6,x1:139.4,y:0});
  arc(139.4,144.6,1.2,2.8);
  ground(144,152); E.push({kind:'walk',x0:145,x1:151,y:0});
  arc(151.4,157,1.2,3);
  ground(156.5,176); plat(158,161,3.5,false); P.push([159.5,4.9]); E.push({kind:'chase',x0:163,x1:174,y:0});
  block(176,179,14,0,'stone',false);
  // drop any gem that ended up inside a solid block (unreachable)
  const D2=D.filter(([x,y])=>!S.some(s=>s.type!=='plat'&&x>s.x0-.35&&x<s.x1+.35&&y>s.y0-.2&&y<s.y1+.45));
  return {S,D:D2,P,E,SP,end:176,gate:171};
}
// ---------- props ----------
// ---------- BLOCK WORLD look: bright 8/16-bit era platformer, all original designs ----------
// 256px tiles (2 world units each) with bump maps, built when the phase starts
function makeWorldMats(){
  // warm earth with rounded pebbles
  const dirt=cvTex2(256,256,(g,b,w,h)=>{ const R=mulberry(22);
    pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*4,y/h*4,4,3), v=.92+n*.16; return [214*v,132*v,64*v]; });
    for(let i=0;i<46;i++){ const x=R()*w, y=R()*h, r=4+R()*7;
      for(const dx of [0,-w,w]) for(const dy of [0,-h,h]){ const sg=g.createRadialGradient(x+dx-r*.3,y+dy-r*.3,1,x+dx,y+dy,r); sg.addColorStop(0,'#f0a860'); sg.addColorStop(1,'#a85a24');
        g.fillStyle=sg; g.beginPath(); g.ellipse(x+dx,y+dy,r,r*.8,0,0,TAU); g.fill(); b.fillStyle=hg(240); b.beginPath(); b.ellipse(x+dx,y+dy,r,r*.8,0,0,TAU); b.fill(); } }
    grain(g,b,w,h,8,.08,4,3,.15);
  });
  // bright cartoon grass top
  const grass=cvTex2(256,256,(g,b,w,h)=>{ const R=mulberry(21);
    pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*4,y/h*4,4,3); return [70+n*40,190+n*40,50+n*20]; });
    for(let i=0;i<900;i++){ const x=R()*w, y=R()*h, l=3+R()*6; g.strokeStyle=R()<.5?'#9af06a':'#3ea82a'; g.lineWidth=1.5; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(R()-.5)*2,y-l); g.stroke(); }
  });
  // red-orange bricks with light mortar
  const brick=cvTex2(256,256,(g,b,w,h)=>{ const R=mulberry(23);
    g.fillStyle='#f0d8b0'; g.fillRect(0,0,w,h); b.fillStyle=hg(60); b.fillRect(0,0,w,h);
    for(let r=0;r<4;r++){ const y=r*64, off=r%2?64:0;
      for(let x=-off;x<w;x+=128){ const v=R()*18; for(const dx of x<0?[0,w]:[0]){ const X=x+dx+4, Y=y+4, ww=120, hh=56;
        const sg=g.createLinearGradient(X,Y,X,Y+hh); sg.addColorStop(0,`rgb(${236+v|0},${120+v|0},${70+v|0})`); sg.addColorStop(.15,`rgb(${214+v|0},${92+v|0},${48+v|0})`); sg.addColorStop(1,`rgb(${170+v|0},${66+v|0},${34+v|0})`);
        g.fillStyle=sg; g.beginPath(); g.roundRect(X,Y,ww,hh,4); g.fill();
        const bg2=b.createLinearGradient(X,Y,X,Y+hh); bg2.addColorStop(0,hg(255)); bg2.addColorStop(.12,hg(225)); bg2.addColorStop(.9,hg(215)); bg2.addColorStop(1,hg(150)); b.fillStyle=bg2; b.beginPath(); b.roundRect(X,Y,ww,hh,6); b.fill(); } } }
    grain(g,b,w,h,8,.08,6,3,.08);
  });
  // golden riveted blocks for floating platforms
  const block=cvTex2(256,256,(g,b,w,h)=>{
    for(let i=0;i<2;i++){ const X=i*128;
      const sg=g.createLinearGradient(X,0,X+128,128); sg.addColorStop(0,'#ffe080'); sg.addColorStop(.5,'#f0b030'); sg.addColorStop(1,'#b87818'); g.fillStyle=sg; g.fillRect(X,0,128,h);
      g.strokeStyle='#7a4a10'; g.lineWidth=5; g.strokeRect(X+2.5,2.5,123,h-5); g.strokeStyle='rgba(255,255,220,.7)'; g.lineWidth=3; g.beginPath(); g.moveTo(X+8,h-8); g.lineTo(X+8,8); g.lineTo(X+120,8); g.stroke();
      b.fillStyle=hg(225); b.fillRect(X+6,6,116,h-12);
      for(const [rx,ry] of [[18,18],[110,18],[18,h-18],[110,h-18]]){ g.fillStyle='#8a5a14'; g.beginPath(); g.arc(X+rx,ry,6,0,TAU); g.fill(); g.fillStyle='#fff0b0'; g.beginPath(); g.arc(X+rx-1.5,ry-1.5,2.2,0,TAU); g.fill(); b.fillStyle=hg(255); b.beginPath(); b.arc(X+rx,ry,6,0,TAU); b.fill(); } }
  });
  return {
    dirt:new THREE.MeshStandardMaterial({map:dirt.map,bumpMap:dirt.bump,bumpScale:2,roughness:.9}),
    grass:new THREE.MeshStandardMaterial({map:grass.map,bumpMap:grass.bump,bumpScale:1,roughness:.75}),
    stone:new THREE.MeshStandardMaterial({map:brick.map,bumpMap:brick.bump,bumpScale:3,roughness:.7}),
    plank:new THREE.MeshStandardMaterial({map:block.map,bumpMap:block.bump,bumpScale:2.5,roughness:.35,metalness:.3}),
  };
}
let MAT=null;
// far scenery: a layered ridge silhouette with a vertical colour gradient
function ridgeMesh(x0,x1,z,base,amp,freq,seed,top,bot){
  const N=260, pos=[], col=[], idx=[], ct=new THREE.Color(top), cb=new THREE.Color(bot);
  for(let i=0;i<=N;i++){ const t=i/N, x=lerp(x0,x1,t), u=t*freq;
    const n=fbm(u,seed,256,3), hgt=base+amp*n*n*(1.6-n*.6);
    pos.push(x,hgt,z, x,base-30,z); col.push(ct.r,ct.g,ct.b, cb.r,cb.g,cb.b);
    if(i<N){ const a=i*2; idx.push(a,a+1,a+2,a+1,a+3,a+2); } }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); geo.setIndex(idx);
  return new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,depthWrite:true}));
}
// round cartoon hill with soft darker spots
const hillTex=once(()=>cvTex(256,256,(g,w,h)=>{ const R=mulberry(91); g.fillStyle='#4cc23a'; g.fillRect(0,0,w,h);
  for(let i=0;i<22;i++){ g.fillStyle='rgba(30,120,30,.55)'; const x=R()*w, y=R()*h*.85+h*.1; g.beginPath(); g.ellipse(x,y,6+R()*6,10+R()*10,0,0,TAU); g.fill(); } },true));
const puff=new THREE.SphereGeometry(1,24,16);
function makeCloud(){ const g=new THREE.Group(), m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.9,emissive:0xcfe6ff,emissiveIntensity:.35});
  for(const [x,y,r] of [[0,0,1.6],[1.6,-.2,1.2],[-1.6,-.25,1.15],[.8,.75,1.05],[-.8,.6,1]]){ const p=new THREE.Mesh(puff,m); p.position.set(x,y,0); p.scale.set(r,r,r*.7); g.add(p); } return g; }
function makeBush(){ const g=new THREE.Group(), m=new THREE.MeshStandardMaterial({color:0x3ec82e,roughness:.6,emissive:0x0a3a08,emissiveIntensity:.5});
  for(const [x,r] of [[0,.75],[.75,.6],[-.75,.6],[1.35,.42],[-1.35,.42]]){ const p=new THREE.Mesh(puff,m); p.position.set(x,r*.55,0); p.scale.set(r,r,r*.75); p.castShadow=true; g.add(p); } return g; }
function buildBlockWorldEnv(L){
  const bg=GS.W3.bg, end=L.end;
  scene.background=new THREE.Color(0x6ab4ff); scene.fog=new THREE.Fog(0x9ad0ff,80,300);
  bg.add(skyDome('#2a78ee','#6ab4ff','#cdeaff'));
  // far blue mountains, then round green hills
  bg.add(ridgeMesh(-200,end+200,-260,-8,46,6,11,'#8ac0f0','#b8dcff'));
  bg.add(ridgeMesh(-160,end+160,-190,-8,30,9,23,'#6aa8e0','#a0ccf4'));
  const hm=new THREE.MeshStandardMaterial({map:hillTex(),roughness:.8}), hm2=new THREE.MeshStandardMaterial({color:0x2e9a2a,map:hillTex(),roughness:.8});
  const hillGeo=new THREE.SphereGeometry(1,40,20,0,TAU,0,PI/2);
  for(let i=0;i<26;i++){ const far=i%2, r=far?rand(10,18):rand(5,10), hl=new THREE.Mesh(hillGeo,far?hm2:hm); hl.scale.set(r,r*rand(.8,1.4),r*.6); hl.position.set(rand(-30,end+30),-6,far?-rand(70,110):-rand(22,45)); hl.receiveShadow=true; bg.add(hl); }
  GS.W3.clouds=[];
  for(let i=0;i<16;i++){ const c=makeCloud(); c.scale.setScalar(rand(1.4,2.6)); c.position.set(rand(-30,end+30),rand(16,32),-rand(40,90)); bg.add(c); GS.W3.clouds.push(c); }
  // bushes along the back edge of the ground
  for(let i=0;i<30;i++){ const x=rand(-4,end); const s=L.S.find(s=>s.type==='ground'&&x>s.x0+1&&x<s.x1-1); if(!s) continue; const b=makeBush(); b.position.set(x,s.y1,rand(-2,-1.5)); b.scale.setScalar(rand(.7,1.15)); bg.add(b); }
  envFrom('#3a80e8','#a8d4ff','#5a9a3a',[['#fffbe8',-20,40,30,6]]);
  hemi.color.set(0xeaf4ff); hemi.groundColor.set(0x6a9a4a); hemi.intensity=.75; sun.color.set(0xfff6e4); sun.intensity=2.4; sun.position.set(-30,60,45); SUN.dir.set(-30,60,45).normalize();
}
// ---------- setup ----------
// spinning gold coin (faces the camera, spins around the vertical axis)
const coinTex=once(()=>cvTex(128,128,(g,w,h)=>{ const gr=g.createRadialGradient(48,44,6,64,64,64); gr.addColorStop(0,'#fff6b0'); gr.addColorStop(.6,'#ffcc30'); gr.addColorStop(1,'#c88a10'); g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.strokeStyle='#a86a08'; g.lineWidth=6; g.beginPath(); g.arc(64,64,46,0,TAU); g.stroke();
  g.fillStyle='#e8a818'; g.beginPath(); for(let k=0;k<10;k++){ const a=-PI/2+k*PI/5, r=k%2?14:32; g.lineTo(64+Math.cos(a)*r,64+Math.sin(a)*r); } g.closePath(); g.fill(); g.strokeStyle='#fff3a0'; g.lineWidth=2; g.stroke(); }));
const gemGeo=new THREE.CylinderGeometry(.36,.36,.09,40); gemGeo.rotateX(PI/2);
// scalloped grass edge hanging over the front of the ground
const grassFringeT=once(()=>cvTex(256,64,(g,w,h)=>{
  g.fillStyle='#4ac83a'; g.fillRect(0,0,w,14);
  for(let x=0;x<w+32;x+=32){ g.fillStyle='#2e9a26'; g.beginPath(); g.arc(x,16,17,0,PI); g.fill(); g.fillStyle='#4ac83a'; g.beginPath(); g.arc(x,13,15,0,PI); g.fill(); g.fillStyle='#8af06a'; g.beginPath(); g.arc(x-5,9,4,0,TAU); g.fill(); } },true));
// trampoline: dark base, chrome coil, red bouncy pad (cap = the part that squashes)
function makeTrampoline(){
  const o=new THREE.Group(), dark=new THREE.MeshStandardMaterial({color:0x2a2a34,roughness:.4,metalness:.6}), chrome=new THREE.MeshStandardMaterial({color:0xe8ecf4,roughness:.15,metalness:1});
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.75,.85,.18,32),dark); base.position.y=.09; o.add(base);
  const cap=new THREE.Group(); cap.position.y=.18; cap.scale.y=.7; o.add(cap);
  for(let i=0;i<5;i++){ const r=new THREE.Mesh(new THREE.TorusGeometry(.42,.06,10,32),chrome); r.rotation.x=PI/2; r.position.y=.12+i*.16; cap.add(r); }
  const pad=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,.16,40),new THREE.MeshPhysicalMaterial({color:0xe82a2a,roughness:.35,clearcoat:.8})); pad.position.y=.95; cap.add(pad);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.8,.06,10,40),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.4})); rim.rotation.x=PI/2; rim.position.y=1.03; cap.add(rim);
  castAll(o); return {o,cap};
}
// power star (a plain glowing 5-point star)
const starGeo=(()=>{ const sh=new THREE.Shape(); for(let k=0;k<10;k++){ const a=PI/2+k*PI/5, r=k%2?.3:.7; if(k) sh.lineTo(Math.cos(a)*r,Math.sin(a)*r); else sh.moveTo(Math.cos(a)*r,Math.sin(a)*r); } sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth:.18,bevelEnabled:true,bevelThickness:.06,bevelSize:.05,bevelSegments:3}); g.translate(0,0,-.09); return g; })();
export function platSetup(){
  const L=buildLevel(); PL.L=L;
  const g=new THREE.Group(); scene.add(g);
  GS.W3={g,m:{W:1,H:1,wrapX:false,wrapY:false,cell:new Uint8Array(1),dot:new Uint8Array(0)},style:'plat',
    map:(x,y,h,o)=>{ o.p.set(x,y+h,0); o.e.set(1,0,0); o.s.set(0,0,1); o.n.set(0,1,0); o.ke=1; o.ks=1; return o; },
    bg:new THREE.Group(),actors:new THREE.Group(),fx:new THREE.Group(),t:0};
  g.add(GS.W3.bg); g.add(GS.W3.actors); g.add(GS.W3.fx);
  MAT=MAT||makeWorldMats();
  buildBlockWorldEnv(L);
  const fringeM=new THREE.MeshStandardMaterial({map:grassFringeT(),alphaTest:.5,side:THREE.DoubleSide,roughness:.7});
  // solids
  PL.solids=L.S.map(s=>{
    const w=s.x1-s.x0, h=s.y1-s.y0, d=s.type==='plat'?2.6:4.4;
    const mat=s.type==='ground'?MAT.dirt:s.type==='plat'?MAT.plank:MAT.stone;
    const mesh=new THREE.Mesh(boxUV(new THREE.BoxGeometry(w,h,d),w,h,d),mat); mesh.position.set((s.x0+s.x1)/2,(s.y0+s.y1)/2,0); mesh.castShadow=mesh.receiveShadow=true; g.add(mesh);
    if(s.type==='ground'){ const lip=new THREE.Mesh(boxUV(new THREE.BoxGeometry(w+.2,.35,d+.2),w+.2,.35,d+.2),MAT.grass); lip.position.set(0,h/2-.1,0); lip.castShadow=lip.receiveShadow=true; mesh.add(lip);
      // HD: grass hanging over the front edge
      const fg=new THREE.PlaneGeometry(w+.2,.6); const uv=fg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setX(i,uv.getX(i)*(w+.2)/2);
      const fr=new THREE.Mesh(fg,fringeM); fr.position.set(0,h/2-.47,d/2+.115); fr.receiveShadow=true; mesh.add(fr); }
    return Object.assign({},s,{mesh,bx0:s.x0,bx1:s.x1,dx:0});
  });
  // springs
  PL.springs=L.SP.map(([x,y])=>{ const {o,cap}=makeTrampoline(); o.position.set(x,y,0); g.add(o); return {x,y,obj:o,cap,sq:0}; });
  // brick gate at the end: locked until every coin is collected
  { const gx=L.gate, gg=new THREE.Group(); gg.position.set(gx,0,-.6); g.add(gg);
    for(const sx of [-1.35,1.35]){ const p=new THREE.Mesh(boxUV(new THREE.BoxGeometry(.9,4.6,1.4),.9,4.6,1.4),MAT.stone); p.position.set(sx,2.3,0); gg.add(p); }
    const top=new THREE.Mesh(boxUV(new THREE.BoxGeometry(4.2,.9,1.6),4.2,.9,1.6),MAT.stone); top.position.y=5; gg.add(top);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.12,40),new THREE.MeshStandardMaterial({map:coinTex(),color:0xffffff,emissive:0x805000,metalness:.8,roughness:.2})); cap.rotation.x=PI/2; cap.position.y=6; gg.add(cap);
    const portalM=new THREE.MeshBasicMaterial({color:new THREE.Color(.5,.08,.08),transparent:true,opacity:.75,side:THREE.DoubleSide});
    const portal=new THREE.Mesh(new THREE.PlaneGeometry(1.8,4.5),portalM); portal.position.set(0,2.25,0); gg.add(portal);
    const bars=new THREE.Group(); gg.add(bars); const bm=new THREE.MeshStandardMaterial({color:0x4a4a52,metalness:.8,roughness:.4});
    for(let i=0;i<5;i++){ const b=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,4.4,16),bm); b.position.set(-.8+i*.4,2.2,.3); bars.add(b); }
    const glow=glowSprite(0xff3020,5,.35); glow.position.set(0,2.4,.5); gg.add(glow);
    castAll(gg); PL.gate={x:gx,obj:gg,portal,portalM,bars,glow,open:false,openT:0}; }
  // coins
  PL.gems=L.D.map(([x,y])=>({x,y,alive:true}));
  PL.gemMesh=new THREE.InstancedMesh(gemGeo,new THREE.MeshStandardMaterial({map:coinTex(),color:0xffffff,emissive:0x6a4200,emissiveIntensity:.6,roughness:.18,metalness:.85}),PL.gems.length); PL.gemMesh.castShadow=true; g.add(PL.gemMesh);
  PL.pows=L.P.map(([x,y])=>{ const o=new THREE.Group(); o.add(new THREE.Mesh(starGeo,new THREE.MeshStandardMaterial({color:0xfff2a0,emissive:0xffc020,emissiveIntensity:1.4,roughness:.2,metalness:.3}))); o.add(glowSprite(0xffe060,3.4,.6)); o.position.set(x,y,0); g.add(o); return {x,y,obj:o,alive:true}; });
  // enemies
  PL.en=L.E.map((d,i)=>{ const col=d.kind==='fly'?'#a66bff':d.kind==='chase'?'#ff3b3b':'#ffb020';
    const obj=makeVirus(col,'virus'); GS.W3.actors.add(obj);
    const e={k:i,kind:d.kind,col,x:d.kind==='fly'?d.x:(d.x0+d.x1)/2,y:d.y??0,bx:d.x,by:d.y,x0:d.x0,x1:d.x1,dir:1,st:'run',obj,t:rand(0,6),fr:false,resp:0,spin:0};
    return e; });
  // hero + game state shim
  GS.G={m:GS.W3.m,cfg:{dur:999,fright:7,heroSpd:8},t:0,hero:{x:2,y:0,dx:0,dy:0,fx:1,fy:0,alive:true,mouth:0},en:PL.en,small:PL.gems.length,smallTotal:PL.gems.length,dots:PL.gems.length,
    hearts:3,fright:0,frightMax:1,inv:0,turbo:0,ramp:0,fields:{},items:[],bombs:[]};
  PL.done=false; PL.lockHint=0;
  PL.h={x:2,y:0,vx:0,vy:0,w:.9,hh:1.5,ground:true,on:null,coy:0,jb:0,jumps:0,face:1,sq:1,prevJ:false};
  PL.safe={x:2,y:0};
  A3.hero=makeBot(); GS.W3.actors.add(A3.hero); A3.hero.userData.fx=1; A3.style='plat';
  updGems(0);
}
function updGems(t){
  const M=PL.gemMesh;
  PL.gems.forEach((gm,i)=>{ if(!gm.alive){ M.setMatrixAt(i,ZERO); return; } _q.setFromAxisAngle(_v.set(0,1,0),t*2.5+i*.4); _m4.compose(_v2.set(gm.x,gm.y+Math.sin(t*3+i*.7)*.12,0),_q,_v3.set(1,1.2,1)); M.setMatrixAt(i,_m4); });
  M.instanceMatrix.needsUpdate=true;
}
// ---------- input ----------
export const tpad={l:false,r:false,j:false};
function platInput(){
  const L=keys.ArrowLeft||keys.KeyA||tpad.l, R=keys.ArrowRight||keys.KeyD||tpad.r, J=keys.Space||keys.ArrowUp||keys.KeyW||tpad.j;
  inp.has=false; return {L,R,J};
}
const overlap=(h,s)=>h.x+h.w/2>s.x0&&h.x-h.w/2<s.x1&&h.y+h.hh>s.y0&&h.y<s.y1;
export function platTick(dt){
  const h=PL.h, Hh=GS.G.hero, t=GS.G.t+=dt;
  if(GS.G.inv>0) GS.G.inv-=dt;
  if(GS.G.fright>0){ GS.G.fright-=dt; if(GS.G.fright<=0) for(const e of PL.en) e.fr=false; }
  // moving platforms
  for(const s of PL.solids){ if(!s.mv) continue; const off=Math.sin(t*s.mv.spd)*s.mv.amp; const nx0=s.bx0+off; s.dx=nx0-s.x0; s.x0=nx0; s.x1=s.bx1+off; s.mesh.position.x=(s.x0+s.x1)/2; }
  if(h.on&&h.on.mv&&h.ground) h.x+=h.on.dx;
  if(!Hh.alive) return;
  const I=platInput();
  // horizontal
  const acc=h.ground?62:38, max=8.6;
  if(I.L&&!I.R){ h.vx=Math.max(-max,h.vx-acc*dt); h.face=-1; }
  else if(I.R&&!I.L){ h.vx=Math.min(max,h.vx+acc*dt); h.face=1; }
  else { const f=(h.ground?48:10)*dt; h.vx=Math.abs(h.vx)<=f?0:h.vx-Math.sign(h.vx)*f; }
  // jump (buffer + coyote + double jump, variable height)
  const jp=I.J&&!h.prevJ; h.prevJ=I.J;
  if(jp) h.jb=.13; else h.jb-=dt;
  if(h.ground){ h.coy=.1; h.jumps=0; } else h.coy-=dt;
  if(h.jb>0){
    if(h.coy>0){ h.vy=15.5; h.coy=0; h.jb=0; h.jumps=1; h.ground=false; h.sq=1.35; tone({f:330,f2:660,d:.12,v:.06,type:'square',lp:2500}); }
    else if(h.jumps<2){ h.vy=13; h.jb=0; h.jumps=2; h.sq=1.3; tone({f:500,f2:900,d:.12,v:.06,type:'square',lp:3000}); burst(new THREE.Vector3(h.x,h.y,0),10,['#ffffff','#ffe0a0'],4,.12,.4,new THREE.Vector3(0,-1,0),null,0); }
  }
  if(!I.J&&h.vy>4) h.vy*=Math.pow(.02,dt);
  h.vy=Math.max(-26,h.vy-38*dt);
  // move x
  h.x+=h.vx*dt;
  for(const s of PL.solids){ if(s.type==='plat'||!overlap(h,s)) continue; if(h.vx>0||h.x<(s.x0+s.x1)/2) h.x=Math.min(h.x,s.x0-h.w/2-.001); else h.x=Math.max(h.x,s.x1+h.w/2+.001); h.vx=0; }
  // move y
  const py=h.y; h.y+=h.vy*dt; const wasG=h.ground; h.ground=false; h.on=null;
  for(const s of PL.solids){
    if(!overlap(h,s)) continue;
    if(h.vy<=0&&py>=s.y1-.08){ h.y=s.y1; h.vy=0; h.ground=true; h.on=s; }
    else if(s.type!=='plat'&&h.vy>0&&py+h.hh<=s.y0+.08){ h.y=s.y0-h.hh; h.vy=0; }
  }
  if(h.ground&&!wasG){ h.sq=.75; if(py-h.y>.05||true) burst(new THREE.Vector3(h.x,h.y+.05,0),5,['#c8a070','#a0784a'],2.5,.1,.35,new THREE.Vector3(0,-1,0),null,0); }
  if(h.ground&&h.on&&h.on.type==='ground'&&!h.on.mv) PL.safe={x:clamp(h.x,h.on.x0+.8,h.on.x1-.8),y:h.on.y1};
  h.sq=lerp(h.sq,1,1-Math.exp(-dt*10));
  // springs
  for(const sp of PL.springs){ if(Math.abs(h.x-sp.x)<.9&&h.y<=sp.y+1.1&&h.y>=sp.y-.2&&h.vy<=0){ h.vy=24; h.y=sp.y+1.1; h.ground=false; h.jumps=1; sp.sq=1; h.sq=1.5; tone({f:200,f2:1200,d:.35,v:.08,type:'sawtooth',lp:2400}); } sp.sq=Math.max(0,sp.sq-dt*3); sp.cap.scale.y=.7*(1-sp.sq*.5); }
  // pits
  if(h.y<-6.5){ hurtHero('FELL IN');
    if(Hh.alive){ h.x=PL.safe.x; h.y=PL.safe.y+.2; h.vx=0; h.vy=0; GS.G.inv=Math.max(GS.G.inv,1.5); } }
  // gate
  const GT=PL.gate;
  if(GS.G.small<=0&&!GT.open){ GT.open=true; banner('ALL COINS!','THE GATE IS OPEN','#ffd040'); SFX.win(); hint('RUN TO THE GATE AT THE END →',3); }
  if(GT.open){ GT.openT+=dt; GT.bars.position.y=Math.min(4.6,GT.openT*3); GT.portalM.color.setHSL((t*.15)%1,.9,.6); GT.portalM.opacity=.85; GT.glow.material.color.set(0xffd040); GT.glow.material.opacity=.6+Math.sin(t*6)*.2; GT.portal.rotation.y=Math.sin(t*2)*.1;
    if(Math.abs(h.x-GT.x)<1.1&&h.y<4&&!PL.done){ PL.done=true; SFX.power(); burst(new THREE.Vector3(GT.x,2.4,0),120,['#ffd040','#fff6a0','#ff9a3c','#ffffff'],12,.25,1.4,new THREE.Vector3(0,-1,0),null,0); } }
  else if(Math.abs(h.x-GT.x)<2.2&&!PL.lockHint){ PL.lockHint=3; hint('THE GATE IS LOCKED · '+GS.G.small+' COINS LEFT',2.2); }
  if(PL.lockHint){ PL.lockHint-=dt; if(PL.lockHint<=0) PL.lockHint=0; }
  // gems
  const cx=h.x, cy=h.y+.75;
  for(const gm of PL.gems){ if(gm.alive&&Math.abs(gm.x-cx)<.8&&Math.abs(gm.y-cy)<1.05){ gm.alive=false; GS.G.small--; GS.G.dots--; addScore(10); SFX.munch(); burst(new THREE.Vector3(gm.x,gm.y,0),6,['#ffd040','#fff6a0'],3,.1,.4,null,null,0); } }
  for(const p of PL.pows){ if(p.alive&&Math.abs(p.x-cx)<1&&Math.abs(p.y-cy)<1.2){ p.alive=false; p.obj.visible=false; addScore(50); SFX.power(); GS.G.fright=7; GS.G.frightMax=7; for(const e of PL.en) if(e.st==='run') e.fr=true; hint('POWER! RUN THEM DOWN',1.5); } }
  // enemies
  for(const e of PL.en){
    e.t+=dt; e.spin+=dt*5;
    if(e.st==='dead'){ e.resp-=dt; if(e.resp<=0&&Math.abs(h.x-(e.x0??e.bx))>14){ e.st='run'; e.fr=GS.G.fright>0; e.x=e.kind==='fly'?e.bx:(e.x0+e.x1)/2; } continue; }
    const sp=(e.fr?1.4:e.kind==='chase'?3.6:2.3)*GS.speedMul;
    if(e.kind==='fly'){
      const near=Math.abs(h.x-e.x)<10; const tx=near&&!e.fr?h.x:e.bx+Math.sin(e.t*.7)*3; e.x+=clamp(tx-e.x,-1,1)*2.4*dt*GS.speedMul; e.x=clamp(e.x,e.bx-7,e.bx+7);
      e.y=e.by+Math.sin(e.t*2.2)*.8;
    } else {
      let dir=e.dir;
      if(e.kind==='chase'&&Math.abs(h.x-e.x)<11&&Math.abs(h.y-e.y)<3) dir=Math.sign(h.x-e.x)*(e.fr?-1:1)||1;
      e.x+=dir*sp*dt; if(e.x<e.x0){ e.x=e.x0; e.dir=1; } if(e.x>e.x1){ e.x=e.x1; e.dir=-1; } if(e.kind!=='chase') e.dir=e.x<=e.x0?1:e.x>=e.x1?-1:e.dir; else e.dir=dir;
    }
    // collide
    const ey=e.y+.9, dx=Math.abs(h.x-e.x);
    if(dx<.95&&h.y<ey+.75&&h.y+h.hh>ey-.7){
      if(e.fr){ e.st='dead'; e.resp=14; addScore(400); pop3(e.x,e.y,'400','#29f0ff',2); SFX.eatEnemy(); burst(new THREE.Vector3(e.x,ey,0),30,[e.col,'#fff','#2a8a96'],8,.2,.8,new THREE.Vector3(0,-1,0),null,0); }
      else if(h.vy<0&&h.y>ey-.25){ e.st='dead'; e.resp=14; h.vy=12; h.jumps=1; h.sq=1.4; addScore(200); pop3(e.x,e.y,'200','#ffd040',2); SFX.eatEnemy(); burst(new THREE.Vector3(e.x,ey,0),30,[e.col,'#fff'],8,.2,.8,new THREE.Vector3(0,-1,0),null,0); }
      else if(GS.G.inv<=0){ hurtHero('BUMPED A GLITCH'); h.vx=-Math.sign(e.x-h.x||1)*9; h.vy=8; }
    }
  }
  for(const c of GS.W3.clouds||[]) c.position.x+=dt*.6;
  // sync hero struct for the shared HUD/camera
  Hh.x=h.x; Hh.y=h.y; Hh.dx=Math.abs(h.vx)>.5?Math.sign(h.vx):0; Hh.fx=h.face; Hh.mouth+=Math.abs(h.vx)>.5?dt*14:0;
}
export function platSync(dt){
  const t=performance.now()/1000, h=PL.h, Hh=GS.G.hero, ud=A3.hero.userData;
  ud.fx=lerp(ud.fx,h.face,1-Math.exp(-dt*12));
  GS.W3.map(h.x,h.y,-.12,_o);
  A3.hero.visible=Hh.alive&&!(GS.G.inv>0&&(t*12|0)%2);
  placeObj(A3.hero,_o,ud.fx,.45,.95);
  A3.hero.scale.set(.95/Math.sqrt(h.sq),.95*h.sq,.95/Math.sqrt(h.sq));
  ud.jawP.rotation.x=Math.abs(h.vx)>.5?Math.abs(Math.sin(Hh.mouth))*.55:.1;
  const pw=GS.G.fright>0; ud.lime.color.set(pw?0xffe070:0x5fd83a); ud.lime.emissive.set(pw?0xff9a10:0x2ad010); ud.lime.emissiveIntensity=pw?.6+Math.sin(t*20)*.2:.25;
  ud.thr.scale.y=1+(h.ground?0:1.4)+Math.sin(t*30)*.2;
  heroLight.position.set(h.x,h.y+4,4); heroLight.intensity=6; heroLight.color.set(0xffffff);
  for(const e of PL.en){
    const o=e.obj, u=o.userData; o.visible=e.st!=='dead';
    if(!o.visible) continue;
    GS.W3.map(e.x,e.y,0,_o); placeObj(o,_o,e.kind==='fly'?Math.sign(h.x-e.x)||1:e.dir,.5,e.kind==='fly'?.9:1);
    u.core.rotation.y=e.spin; u.core.rotation.x=e.spin*.6;
    const fl=e.fr&&GS.G.fright<1.8&&(t*8|0)%2;
    if(e.fr){ u.mat.color.set(fl?0xf0f8ff:0x2a8a96); u.mat.emissive.set(fl?0xaaccff:0x0a4a56); } else { u.mat.color.copy(u.col); u.mat.emissive.copy(u.col); }
    u.pup.position.x=clamp((h.x-e.x)*.05,-.12,.12);
  }
  for(const p of PL.pows){ p.obj.rotation.y+=dt*2; p.obj.position.y=p.y+Math.sin(t*3)*.2; }
  updGems(t);
}
export function platHint(){ return TOUCH?'◀ ▶ RUN · JUMP (TAP AGAIN IN AIR) · GRAB EVERY COIN TO OPEN THE GATE AT THE END':'← → RUN · SPACE / ↑ JUMP (AGAIN IN AIR) · GRAB EVERY COIN TO OPEN THE GATE AT THE END'; }
export function drawPlatMini(){
  const L=PL.L, cs=1.3, vs=2.6, W=Math.round((L.end+12)*cs), H=Math.round(16*vs), ox=9, oy=10;
  if(GS.miniKey!=='plat'){ GS.miniKey='plat'; miniC.width=W; miniC.height=H; const sc=innerWidth<640?.75:1; miniC.style.width=(W*sc)+'px'; miniC.style.height=(H*sc)+'px'; document.body.style.setProperty('--miniw',(W*sc)+'px'); document.body.style.setProperty('--minih',(H*sc)+'px'); }
  const g=miniX, t=performance.now()/1000, X=x=>(x+ox)*cs, Y=y=>H-(y+oy)*vs*.9-6;
  g.fillStyle='rgba(60,120,210,.85)'; g.fillRect(0,0,W,H);
  for(const s of PL.solids){ g.fillStyle=s.type==='ground'?'#c8783a':s.type==='plat'?'#f0b030':'#d85a30'; const y1=Y(s.y1), y0=Math.min(H,Y(Math.max(s.y0,-3))); g.fillRect(X(s.x0),y1,(s.x1-s.x0)*cs,Math.max(2,y0-y1)); if(s.type==='ground'){ g.fillStyle='#4fc03a'; g.fillRect(X(s.x0),y1,(s.x1-s.x0)*cs,2); } }
  g.fillStyle='#ffd040'; for(const gm of PL.gems) if(gm.alive) g.fillRect(X(gm.x)-1,Y(gm.y)-1,2,2);
  if((t*4|0)%2){ g.fillStyle='#29f0ff'; for(const p of PL.pows) if(p.alive) g.fillRect(X(p.x)-2,Y(p.y)-2,4,4); }
  for(const e of PL.en){ if(e.st==='dead') continue; g.fillStyle=e.fr?'#3a8aff':e.col; g.fillRect(X(e.x)-2,Y(e.y+.8)-2,4,4); }
  if(PL.gate){ g.fillStyle=PL.gate.open?((t*4|0)%2?'#ffd040':'#fff'):'#ff3020'; g.fillRect(X(PL.gate.x)-3,Y(4.6),6,Y(0)-Y(4.6)); }
  const h=PL.h; g.fillStyle='#ffb020'; g.beginPath(); const hx=X(h.x), hy=Y(h.y+.7); g.moveTo(hx+h.face*4,hy); g.lineTo(hx-h.face*3,hy-3); g.lineTo(hx-h.face*3,hy+3); g.fill();
}
// on-screen ◀ ▶ JUMP buttons (phones)
for(const [id,k] of [['pL','l'],['pR','r'],['pJ','j']]){ const b=$(id); b.addEventListener('pointerdown',e=>{ e.preventDefault(); initAudio(); tpad[k]=true; }); for(const ev of ['pointerup','pointercancel','pointerleave']) b.addEventListener(ev,()=>{ tpad[k]=false; }); }
// ---------- phase object ----------
const P4={
  name:"BLOCK WORLD '85", color:'#ff5a3a', song:'p4',
  deathText:'Fell off the block world.',
  ui:{cam:'side', pad:true, bloom:[.24,.62], sun:24},
  start(){
    clearWorld(); platSetup(); setGlow(P4.color); updHearts(); GS.mode='seq'; setSong(null);
    cam.k=7; cam.fov=50; camUpdate(0,GS.G.hero.x,GS.G.hero.y,true);
    camPose(_v.set(GS.G.hero.x+34,26,70),_v2.set(GS.G.hero.x+22,2,0),_v3.set(0,1,0)); cam.bl=0; flash(.8);
    runSeq(3,(t)=>{ cam.bl=ease(clamp((t-.3)/2.4,0,1)); },()=>{ GS.mode='play'; cam.bl=1; banner('PHASE '+GS.phase,P4.name,P4.color); setSong(P4.song); setTimeout(()=>{ if(GS.P===P4&&GS.mode==='play') hint(platHint(),4); },1600); });
  },
  tick(dt){ platTick(dt); if(GS.mode==='play'&&PL.done) endPhase(); },
  sync:platSync,
  // warning screen announcing the next phase while the camera pulls back
  outro(next,nextP){
    $('warnSub').textContent=nextP?'NEXT · '+nextP.name:'FINAL STRETCH';
    $('warn').style.display='flex'; SFX.alarm(); setTimeout(()=>SFX.alarm(),1600); banner('WORLD','CLEARED','#ff5a3a');
    camPose(_v.set(GS.G.hero.x,30,70),_v2.set(GS.G.hero.x,4,0),_v3.set(0,1,0));
    runSeq(3.3,(t)=>{ cam.bl=1-ease(clamp(t/2.2,0,1)); if(t>3&&!GS.seq.fl){ GS.seq.fl=1; flash(1); } },()=>{ $('warn').style.display='none'; next(); });
  },
  hud(){ return {left:PL.gate&&PL.gate.open?'GATE OPEN → GO!':'COINS LEFT '+Math.max(0,GS.G.small)}; },
  minimap:drawPlatMini,
};
export default P4;
