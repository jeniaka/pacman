import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GS} from '../core/state.js';
import {$, clamp, ease, lerp, mulberry, PI, pick, rand, TAU, TOUCH} from '../core/utils.js';
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
// ================= PHASE 4: JUNGLE '94 (2.5D side-scrolling platformer) =================
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
// HD jungle textures: 256px tiles (2 world units each) with bump maps, built when phase 4 starts
function makeJungleMats(){
  const dirt=cvTex2(256,256,(g,b,w,h)=>{ const R=mulberry(22);
    pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*8,y/h*8,8,4), band=Math.sin((y/h)*TAU*3+n*3)*.5+.5; const v=.72+n*.42-band*.12; return [136*v,88*v,54*v]; });
    for(let i=0;i<5;i++){ const y=(i+.5)*h/5+(R()-.5)*10; g.strokeStyle='rgba(60,32,12,.45)'; g.lineWidth=3; g.beginPath(); g.moveTo(0,y); for(let x=0;x<=w;x+=16) g.lineTo(x,y+Math.sin(x/w*TAU*2+i)*4); g.stroke(); }
    // roots
    for(let i=0;i<6;i++){ let x=R()*w, y=R()*h*.4; g.strokeStyle='rgba(70,40,18,.8)'; b.strokeStyle=hg(190); g.lineWidth=b.lineWidth=2+R()*2; g.beginPath(); b.beginPath(); g.moveTo(x,y); b.moveTo(x,y); for(let k=0;k<6;k++){ x+=(R()-.5)*30; y+=8+R()*16; g.lineTo(x,y); b.lineTo(x,y); } g.stroke(); b.stroke(); }
    // embedded stones
    for(let i=0;i<22;i++){ const x=R()*w, y=R()*h, rx=4+R()*12, ry=3+R()*8, a=R()*3, v=110+R()*80|0;
      for(const dx of [0,-w,w]){ const sg=g.createRadialGradient(x+dx-rx*.3,y-ry*.4,1,x+dx,y,rx); sg.addColorStop(0,`rgb(${v+50},${v+40},${v+28})`); sg.addColorStop(1,`rgb(${v-40},${v-48},${v-56})`);
        g.fillStyle=sg; g.beginPath(); g.ellipse(x+dx,y,rx,ry,a,0,TAU); g.fill(); g.strokeStyle='rgba(40,20,8,.3)'; g.lineWidth=.8; g.stroke();
        const bg=b.createRadialGradient(x+dx,y,0,x+dx,y,rx); bg.addColorStop(0,hg(250)); bg.addColorStop(1,hg(150)); b.fillStyle=bg; b.beginPath(); b.ellipse(x+dx,y,rx,ry,a,0,TAU); b.fill(); } }
    grain(g,b,w,h,8,.25,4,3,.25);
  });
  const grass=cvTex2(256,256,(g,b,w,h)=>{ const R=mulberry(21);
    pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*8,y/h*8,8,4); return [50+n*60,140+n*90,30+n*40]; });
    for(let i=0;i<2400;i++){ const x=R()*w, y=R()*h, l=4+R()*9, a=-PI/2+(R()-.5)*1.2, c=R(); g.strokeStyle=c<.33?'#8af050':c<.66?'#3a9a24':'#5ac838'; g.lineWidth=1+R();
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); g.stroke(); b.strokeStyle=hg(140+R()*110); b.lineWidth=1.2; b.beginPath(); b.moveTo(x,y); b.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); b.stroke(); }
    for(let i=0;i<14;i++){ const x=R()*w, y=R()*h; g.fillStyle=R()<.5?'#ffe060':'#ff8aa0'; g.beginPath(); g.arc(x,y,2.2,0,TAU); g.fill(); g.fillStyle='#fff6c0'; g.beginPath(); g.arc(x,y,.9,0,TAU); g.fill(); }
  });
  const stone=cvTex2(256,256,(g,b,w,h)=>{ const R=mulberry(23);
    g.fillStyle='#4a4232'; g.fillRect(0,0,w,h); b.fillStyle=hg(40); b.fillRect(0,0,w,h);
    for(let r=0;r<4;r++){ const y=r*64, off=r%2?64:0;
      for(let x=-off;x<w;x+=128){ const v=R()*30; for(const dx of x<0?[0,w]:[0]){ const X=x+dx+3, Y=y+3, ww=122, hh=58;
        const sg=g.createLinearGradient(X,Y,X,Y+hh); sg.addColorStop(0,`rgb(${206+v|0},${190+v|0},${150+v|0})`); sg.addColorStop(1,`rgb(${150+v|0},${134+v|0},${100+v|0})`); g.fillStyle=sg; g.beginPath(); g.roundRect(X,Y,ww,hh,7); g.fill();
        const bg2=b.createLinearGradient(X,Y,X,Y+hh); bg2.addColorStop(0,hg(250)); bg2.addColorStop(.15,hg(215)); bg2.addColorStop(.85,hg(205)); bg2.addColorStop(1,hg(150)); b.fillStyle=bg2; b.beginPath(); b.roundRect(X,Y,ww,hh,9); b.fill(); } } }
    for(let i=0;i<10;i++){ let x=R()*w, y=R()*h; g.strokeStyle='rgba(50,40,24,.75)'; b.strokeStyle=hg(90); g.lineWidth=b.lineWidth=1.3; g.beginPath(); b.beginPath(); g.moveTo(x,y); b.moveTo(x,y); for(let k=0;k<5;k++){ x+=(R()-.5)*26; y+=(R()-.5)*16; g.lineTo(x,y); b.lineTo(x,y); } g.stroke(); b.stroke(); }
    // moss creeping over the stones
    const id=g.getImageData(0,0,w,h), d=id.data; for(let y=0,k=0;y<h;y++) for(let x=0;x<w;x++,k+=4){ const n=fbm(x/w*4+9,y/h*4,4,4); const m=clamp((n-.52)*5,0,1)*(.6+.4*Math.random()); d[k]=lerp(d[k],70,m); d[k+1]=lerp(d[k+1],130,m); d[k+2]=lerp(d[k+2],40,m); } g.putImageData(id,0,0);
    grain(g,b,w,h,8,.22,6,3,.18);
  });
  const plank=cvTex2(256,256,(g,b,w,h)=>{ const R=mulberry(24);
    for(let i=0;i<4;i++){ const x=i*64, v=R()*24;
      const sg=g.createLinearGradient(x,0,x+64,0); sg.addColorStop(0,`rgb(${130+v|0},${82+v|0},${40+v|0})`); sg.addColorStop(.5,`rgb(${178+v|0},${118+v|0},${62+v|0})`); sg.addColorStop(1,`rgb(${120+v|0},${74+v|0},${36+v|0})`); g.fillStyle=sg; g.fillRect(x,0,64,h);
      b.fillStyle=hg(220); b.fillRect(x+2,0,60,h);
      g.strokeStyle='rgba(70,36,12,.45)'; g.lineWidth=1; for(let k=0;k<9;k++){ const gx=x+5+R()*54; g.beginPath(); g.moveTo(gx,0); for(let y=0;y<=h;y+=16) g.lineTo(gx+Math.sin(y*.05+k)*2.5,y); g.stroke(); }
      if(R()<.7){ const kx=x+16+R()*32, ky=R()*h; g.fillStyle='rgba(80,40,14,.7)'; g.beginPath(); g.ellipse(kx,ky,5,9,0,0,TAU); g.fill(); g.strokeStyle='rgba(60,30,10,.6)'; g.beginPath(); g.ellipse(kx,ky,8,14,0,0,TAU); g.stroke(); }
      g.fillStyle='rgba(30,14,4,.8)'; g.fillRect(x,0,2,h); g.fillStyle='rgba(255,220,170,.25)'; g.fillRect(x+2,0,1,h);
      for(const ny of [24,h-24]){ g.fillStyle='#3a3a40'; g.beginPath(); g.arc(x+32,ny,3,0,TAU); g.fill(); g.fillStyle='#9a9aa4'; g.beginPath(); g.arc(x+31,ny-1,1.2,0,TAU); g.fill(); } }
    grain(g,b,w,h,8,.18,7,3,.12);
  });
  return {
    dirt:new THREE.MeshStandardMaterial({map:dirt.map,bumpMap:dirt.bump,bumpScale:3,roughness:.95}),
    grass:new THREE.MeshStandardMaterial({map:grass.map,bumpMap:grass.bump,bumpScale:2,roughness:.85}),
    stone:new THREE.MeshStandardMaterial({map:stone.map,bumpMap:stone.bump,bumpScale:3,roughness:.85}),
    plank:new THREE.MeshStandardMaterial({map:plank.map,bumpMap:plank.bump,bumpScale:2.5,roughness:.75}),
  };
}
let MAT=null;
const waterTexT=once(()=>cvTex(256,256,(g,w,h)=>{ pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*8,y/h*8,8,5); const v=Math.pow(n,1.5); return [20+v*120,90+v*130,160+v*95]; });
  g.strokeStyle='rgba(230,248,255,.5)'; g.lineWidth=1.2; const R=mulberry(41); for(let i=0;i<26;i++){ const x=R()*w, y=R()*h, l=8+R()*26; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+l/2,y-2,x+l,y); g.stroke(); } },true));
const fallTexT=once(()=>cvTex(256,256,(g,w,h)=>{ pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*16,y/h*2,16,4), n2=fbm(x/w*32+7,y/h*4,32,2); const v=clamp(n*.7+n2*.5,0,1.2); const edge=Math.min(1,Math.min(x,w-1-x)/26);
  return [110+v*140,190+v*60,235+v*20,(150+v*105)*edge]; }); },true));
// cloud puff (alpha) for the sunset sky and the waterfall mist
const cloudTex=once(()=>cvTex(256,128,(g,w,h)=>{ pxFill(g,w,h,(x,y)=>{ const dx=(x-w/2)/(w/2), dy=(y-h*.62)/(h*.42); const m=clamp(1-(dx*dx+dy*dy),0,1); const n=fbm(x/w*8,y/h*4,8,5);
  const a=clamp((n*1.6-.55)*m*2.2,0,1); const lit=clamp(1-(y/h)*.6,0,1); return [255,200+lit*55,180+lit*70,a*255]; }); }));
// palm kit: bark + frond textures and a few pre-merged palm/fern variants (2 meshes per tree)
const palmKit=once(()=>{
  const bark=cvTex2(128,256,(g,b,w,h)=>{ const R=mulberry(51);
    pxFill(g,w,h,(x,y)=>{ const n=fbm(x/w*4,y/h*8,4,4); return [118+n*50,84+n*36,52+n*24]; });
    for(let y=0;y<h;y+=32){ const yy=y+R()*4; const gr=g.createLinearGradient(0,yy,0,yy+14); gr.addColorStop(0,'rgba(40,24,10,.75)'); gr.addColorStop(.4,'rgba(170,130,90,.4)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,yy,w,14);
      const bg=b.createLinearGradient(0,yy,0,yy+14); bg.addColorStop(0,hg(40)); bg.addColorStop(.4,hg(230)); bg.addColorStop(1,hg(128)); b.fillStyle=bg; b.fillRect(0,yy,w,14); }
    grain(g,b,w,h,4,.2,2,3,.12);
  });
  const frond=(dark)=>cvTex(256,512,(g,w,h)=>{ const R=mulberry(dark?62:61);
    const c0=dark?'#1a5a1c':'#2a8a26', c1=dark?'#3a9a30':'#6ad84a';
    for(let i=0;i<46;i++){ const t=i/46, y=h*(.04+t*.94), len=w*.46*Math.sin(PI*(.12+t*.82))*(dark?.8:1), wd=7+10*(1-t);
      for(const s of [-1,1]){ const gr=g.createLinearGradient(w/2,y,w/2+s*len,y-len*.5); gr.addColorStop(0,c0); gr.addColorStop(1,c1); g.fillStyle=gr;
        g.beginPath(); g.moveTo(w/2,y+wd*.3); g.quadraticCurveTo(w/2+s*len*.5,y-len*.18-wd*.5,w/2+s*len,y-len*.45); g.quadraticCurveTo(w/2+s*len*.5,y-len*.18+wd*.5,w/2,y+wd); g.fill();
        g.strokeStyle='rgba(20,60,10,.5)'; g.lineWidth=1; g.beginPath(); g.moveTo(w/2,y+wd*.6); g.quadraticCurveTo(w/2+s*len*.5,y-len*.18,w/2+s*len,y-len*.45); g.stroke(); } }
    const rg=g.createLinearGradient(w/2-5,0,w/2+5,0); rg.addColorStop(0,'#5a7a20'); rg.addColorStop(.5,'#c8d870'); rg.addColorStop(1,'#4a6a18'); g.fillStyle=rg; g.beginPath(); g.moveTo(w/2-5,h); g.lineTo(w/2+5,h); g.lineTo(w/2+1,0); g.lineTo(w/2-1,0); g.fill();
  });
  const leafA=frond(false), leafB=frond(true);
  const trunkMat=new THREE.MeshStandardMaterial({map:bark.map,bumpMap:bark.bump,bumpScale:4,roughness:.92});
  const leafMat=new THREE.MeshStandardMaterial({map:leafA,alphaTest:.45,side:THREE.DoubleSide,roughness:.65,metalness:0});
  const fernMat=new THREE.MeshStandardMaterial({map:leafB,alphaTest:.45,side:THREE.DoubleSide,roughness:.7});
  // one arched frond: plane bent along its length, folded into a V
  const frondGeo=(L,W,droop,a,tilt,x0,y0,z0)=>{ const pg=new THREE.PlaneGeometry(W,L,2,12); pg.translate(0,L/2,0); const p=pg.attributes.position;
    for(let i=0;i<p.count;i++){ const u=p.getX(i), v=p.getY(i)/L; const out=v*L*Math.cos(tilt), up=v*L*Math.sin(tilt)-droop*v*v*L+Math.abs(u)*.35;
      p.setXYZ(i,out,up,u); }
    pg.rotateY(a); pg.translate(x0,y0,z0); pg.computeVertexNormals(); return pg; };
  const tree=(h,bend,seed)=>{ const R=mulberry(seed), N=14, RS=12, pos=[], uv=[], idx=[]; let tx=0, ty=0;
    for(let i=0;i<=N;i++){ const t=i/N, cx=bend*t*t*h, cy=t*h, r=.3*(1-t*.42)+(i===0?.12:0);
      for(let j=0;j<=RS;j++){ const a=j/RS*TAU; pos.push(cx+Math.cos(a)*r,cy,Math.sin(a)*r); uv.push(j/RS,cy/2); }
      if(i===N){ tx=cx; ty=cy; } }
    for(let i=0;i<N;i++) for(let j=0;j<RS;j++){ const a=i*(RS+1)+j, b2=a+RS+1; idx.push(a,b2,a+1,b2,b2+1,a+1); }
    const tg=new THREE.BufferGeometry(); tg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); tg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); tg.setIndex(idx); tg.computeVertexNormals();
    const parts=[tg]; for(let k=0;k<3;k++){ const s=new THREE.SphereGeometry(.2,12,8); s.translate(tx+Math.cos(k*2.1)*.22,ty-.25,Math.sin(k*2.1)*.22); parts.push(s); }
    const fr=[]; const n=9; for(let k=0;k<n;k++){ const a=k/n*TAU+R()*.3; fr.push(frondGeo(3+R()*1.3,1.35,.55+R()*.25,a,.55+R()*.35,tx,ty-.05,0)); }
    for(let k=0;k<3;k++) fr.push(frondGeo(1.8,1,.1,k*2.1,1.2,tx,ty,0));
    return {trunk:mergeGeometries(parts),leaves:mergeGeometries(fr)}; };
  const fern=seed=>{ const R=mulberry(seed), fr=[]; for(let k=0;k<8;k++) fr.push(frondGeo(1.1+R()*.5,.6,.45,k/8*TAU+R()*.4,.9,0,0,0)); return mergeGeometries(fr); };
  const trees=[]; for(let i=0;i<6;i++) trees.push(tree(6+i*1,.12+(i%3)*.1,80+i));
  const ferns=[fern(1),fern(2),fern(3)];
  return {trunkMat,leafMat,fernMat,trees,ferns};
});
function makePalm(){ const K=palmKit(), v=pick(K.trees), g=new THREE.Group();
  const t=new THREE.Mesh(v.trunk,K.trunkMat), l=new THREE.Mesh(v.leaves,K.leafMat); t.castShadow=l.castShadow=true; t.receiveShadow=l.receiveShadow=true; g.add(t,l); return g; }
// far scenery: a layered ridge silhouette with a vertical colour gradient
function ridgeMesh(x0,x1,z,base,amp,freq,seed,top,bot,canopy=0){
  const N=260, pos=[], col=[], idx=[], ct=new THREE.Color(top), cb=new THREE.Color(bot);
  for(let i=0;i<=N;i++){ const t=i/N, x=lerp(x0,x1,t), u=t*freq;
    let n=fbm(u,seed,256,5); n=1-Math.abs(n*2-1); let hgt=base+amp*n*n;
    if(canopy) hgt+=canopy*Math.abs(Math.sin(t*N*.9+seed))*.5+canopy*.5*fbm(u*8,seed+3,256,2);
    pos.push(x,hgt,z, x,base-30,z); col.push(ct.r,ct.g,ct.b, cb.r,cb.g,cb.b);
    if(i<N){ const a=i*2; idx.push(a,a+1,a+2,a+1,a+3,a+2); } }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); geo.setIndex(idx);
  return new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,depthWrite:true}));
}
function buildJungleEnv(L){
  const bg=GS.W3.bg, end=L.end;
  scene.background=new THREE.Color(0xff9a5a); scene.fog=new THREE.Fog(0xffa070,70,260);
  bg.add(skyDome('#1e0c48','#ff6a3a','#ffd88a'));
  const sunS=glowSprite(0xffc070,150,.85); sunS.position.set(end/2,30,-320); bg.add(sunS);
  const sunT=cvTex(256,256,(g,w,h)=>{ const gr=g.createRadialGradient(128,110,10,128,128,126); gr.addColorStop(0,'#fffbe8'); gr.addColorStop(.6,'#ffe0a0'); gr.addColorStop(1,'#ffb060'); g.fillStyle=gr; g.beginPath(); g.arc(128,128,124,0,TAU); g.fill(); });
  const sunD=new THREE.Mesh(new THREE.CircleGeometry(26,64),new THREE.MeshBasicMaterial({map:sunT,transparent:true,fog:false})); sunD.position.set(end/2,26,-330); bg.add(sunD);
  // layered mountains + jungle canopy silhouettes (far to near)
  bg.add(ridgeMesh(-200,end+200,-300,-6,52,5,11,'#c8608a','#ff9a70'));
  bg.add(ridgeMesh(-200,end+200,-240,-6,40,7,23,'#8a2e66','#d86a6a'));
  bg.add(ridgeMesh(-160,end+160,-170,-6,22,9,37,'#4a1a4a','#9a3a50',3));
  bg.add(ridgeMesh(-120,end+120,-110,-6,10,14,53,'#2a1638','#6a2a40',4));
  // clouds lit by the sunset
  const ct=cloudTex();
  for(let i=0;i<18;i++){ const c=new THREE.Sprite(new THREE.SpriteMaterial({map:ct,color:i%3?0xffd0b8:0xffa890,transparent:true,opacity:rand(.55,.85),depthWrite:false,fog:false})); const s=rand(40,90); c.scale.set(s,s*.45,1); c.position.set(rand(-60,end+60),rand(22,60),-rand(150,260)); bg.add(c); }
  for(let i=0;i<58;i++){ const p=makePalm(); p.position.set(rand(-20,end+20),-2,-rand(7,36)); p.rotation.y=rand(0,TAU); p.scale.setScalar(rand(.8,1.3)); bg.add(p); }
  for(let i=0;i<9;i++){ const x=rand(0,end), h=rand(5,12); const pl=new THREE.Mesh(boxUV(new THREE.BoxGeometry(2.2,h,2.2),2.2,h,2.2),MAT.stone); pl.position.set(x,h/2-2,-rand(12,22)); pl.castShadow=pl.receiveShadow=true; bg.add(pl);
    if(i%3===0){ const top=new THREE.Mesh(boxUV(new THREE.BoxGeometry(8,1.6,2.2),8,1.6,2.2),MAT.stone); top.position.set(x+3,h-1.2,pl.position.z); top.rotation.z=.12; top.castShadow=top.receiveShadow=true; bg.add(top); } }
  GS.W3.falls=[];
  for(const fx of [30,95,150]){ const cl=new THREE.Mesh(boxUV(new THREE.BoxGeometry(14,26,6),14,26,6),MAT.stone); cl.position.set(fx,9,-30); cl.receiveShadow=true; bg.add(cl);
    const ft=fallTexT().clone(); ft.needsUpdate=true; ft.repeat.set(1,3);
    const wf=new THREE.Mesh(new THREE.PlaneGeometry(5.4,24),new THREE.MeshBasicMaterial({map:ft,transparent:true,opacity:.95,depthWrite:false})); wf.position.set(fx,8,-26.9); bg.add(wf); GS.W3.falls.push(ft);
    for(let k=0;k<4;k++){ const mist=new THREE.Sprite(new THREE.SpriteMaterial({map:ct,color:0xffffff,transparent:true,opacity:.5,depthWrite:false})); mist.scale.set(9,4,1); mist.position.set(fx+rand(-2.5,2.5),-3.6+rand(0,1),-26+k*.1); bg.add(mist); } }
  const wt=waterTexT().clone(); wt.needsUpdate=true; wt.repeat.set((end+80)/6,12); GS.W3.water=wt;
  const water=new THREE.Mesh(new THREE.PlaneGeometry(end+80,80),new THREE.MeshStandardMaterial({color:0x5a8ab8,map:wt,bumpMap:wt,bumpScale:1.5,transparent:true,opacity:.92,roughness:.22,metalness:0}));
  water.rotation.x=-PI/2; water.position.set(end/2,-4.6,-20); water.receiveShadow=true; bg.add(water);
  const K=palmKit();
  for(let i=0;i<34;i++){ const x=rand(-4,end); const s=L.S.find(s=>s.type==='ground'&&x>s.x0+.4&&x<s.x1-.4); if(!s) continue; const f=new THREE.Mesh(pick(K.ferns),K.fernMat); f.position.set(x,s.y1+.05,rand(-2,-1.3)); f.rotation.y=rand(0,TAU); f.scale.setScalar(rand(.8,1.2)); f.castShadow=true; bg.add(f); }
  envFrom('#3a1c60','#ff8a50','#2a3a1c',[['#ffe8b0',0,10,-40,7]]);
  hemi.color.set(0xffe0b0); hemi.groundColor.set(0x3a6a2a); hemi.intensity=.7; sun.color.set(0xffc890); sun.intensity=2.4; sun.position.set(-40,60,50); SUN.dir.set(-40,55,50).normalize();
}
// ---------- lion costume for MUNCHBOT ----------
function lionize(bot){
  const ud=bot.userData, body=ud.body;
  ud.lime.color.set(0xe0a840); ud.lime.emissive.set(0x5a3008); ud.lime.emissiveIntensity=.25;
  ud.tip.visible=false; body.children.forEach(c=>{ if(c.geometry&&c.geometry.type==='CylinderGeometry'&&c.position.y>1.6) c.visible=false; });
  ud.thr.material.color.setRGB(2,1,.3);
  ud.eyes.children.forEach(e=>e.material.color.setRGB(2.2,1.8,.6));
  const maneM=new THREE.MeshStandardMaterial({color:0xb0521e,roughness:.9}), maneD=new THREE.MeshStandardMaterial({color:0x7a3010,roughness:.95});
  const mane=new THREE.Group(); mane.position.set(0,.95,-.05); body.add(mane);
  const tuft=new THREE.SphereGeometry(.34,18,14);
  for(let i=0;i<16;i++){ const a=i/16*TAU; const m=new THREE.Mesh(tuft,i%2?maneM:maneD); m.position.set(Math.cos(a)*.98,Math.sin(a)*.82,-.08); m.scale.set(1,1,.8); mane.add(m); }
  for(let i=0;i<10;i++){ const a=i/10*TAU+.3; const m=new THREE.Mesh(tuft,i%2?maneD:maneM); m.position.set(Math.cos(a)*.7,Math.sin(a)*.6,-.45); m.scale.setScalar(1.15); mane.add(m); }
  const earM=new THREE.MeshStandardMaterial({color:0xe0a840,roughness:.7}), earIn=new THREE.MeshStandardMaterial({color:0x8a4a20});
  for(const sx of [-1,1]){ const e=new THREE.Mesh(new THREE.SphereGeometry(.2,20,14),earM); e.position.set(sx*.5,1.62,.12); e.scale.set(1,1,.6); body.add(e);
    const ei=new THREE.Mesh(new THREE.SphereGeometry(.11,16,12),earIn); ei.position.set(sx*.5,1.62,.22); ei.scale.set(1,1,.4); body.add(ei); }
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.09,16,12),new THREE.MeshStandardMaterial({color:0x3a1a0a,roughness:.25})); nose.position.set(0,.88,.74); body.add(nose);
  const tail=new THREE.Group(); tail.position.set(0,.55,-.7); body.add(tail);
  const tseg=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,1.1,14),earM); tseg.position.set(0,.3,-.45); tseg.rotation.x=-1.0; tail.add(tseg);
  const tt=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),maneD); tt.position.set(0,.62,-.9); tail.add(tt);
  ud.tail=tail; ud.lion=true; castAll(bot);
}
// ---------- setup ----------
// HD gem: brilliant cut (lathe profile, faceted)
const gemGeo=new THREE.LatheGeometry([new THREE.Vector2(0,-.36),new THREE.Vector2(.27,-.04),new THREE.Vector2(.3,.02),new THREE.Vector2(.24,.12),new THREE.Vector2(.13,.16),new THREE.Vector2(0,.16)].map(v=>v.multiplyScalar(1.15)),8);
const grassFringeT=once(()=>cvTex(256,64,(g,w,h)=>{ const R=mulberry(71);
  for(let i=0;i<320;i++){ const x=R()*w, l=h*(.35+R()*.6), c=R(); g.strokeStyle=c<.3?'#2a7a1c':c<.7?'#3fae2a':'#6ad83e'; g.lineWidth=1.5+R()*2.5;
    for(const dx of [0,-w,w]){ g.beginPath(); g.moveTo(x+dx,0); g.quadraticCurveTo(x+dx+(R()-.5)*8,l*.5,x+dx+(R()-.5)*10,l); g.stroke(); } }
  g.fillStyle='#3fae2a'; g.fillRect(0,0,w,6); },true));
export function platSetup(){
  const L=buildLevel(); PL.L=L;
  const g=new THREE.Group(); scene.add(g);
  GS.W3={g,m:{W:1,H:1,wrapX:false,wrapY:false,cell:new Uint8Array(1),dot:new Uint8Array(0)},style:'plat',
    map:(x,y,h,o)=>{ o.p.set(x,y+h,0); o.e.set(1,0,0); o.s.set(0,0,1); o.n.set(0,1,0); o.ke=1; o.ks=1; return o; },
    bg:new THREE.Group(),actors:new THREE.Group(),fx:new THREE.Group(),t:0};
  g.add(GS.W3.bg); g.add(GS.W3.actors); g.add(GS.W3.fx);
  MAT=MAT||makeJungleMats();
  buildJungleEnv(L);
  const fringeM=new THREE.MeshStandardMaterial({map:grassFringeT(),alphaTest:.5,side:THREE.DoubleSide,roughness:.85});
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
  PL.springs=L.SP.map(([x,y])=>{ const o=new THREE.Group(); const st=new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,.5,20),new THREE.MeshStandardMaterial({color:0xf0e0c0,roughness:.6}));
    st.position.y=.25; o.add(st); const cap=new THREE.Mesh(new THREE.SphereGeometry(.8,40,20,0,TAU,0,PI/2),new THREE.MeshPhysicalMaterial({color:0xe02a2a,emissive:0x400000,roughness:.35,clearcoat:.8,clearcoatRoughness:.2})); cap.position.y=.45; cap.scale.y=.7; o.add(cap);
    for(let i=0;i<5;i++){ const d=new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.4})); const a=i/5*TAU; d.position.set(Math.cos(a)*.45,.85,Math.sin(a)*.45); o.add(d); }
    o.position.set(x,y,0); castAll(o); g.add(o); return {x,y,obj:o,cap,sq:0}; });
  // gate at the end: locked until every gem is collected
  { const gx=L.gate, gg=new THREE.Group(); gg.position.set(gx,0,-.6); g.add(gg);
    for(const sx of [-1.35,1.35]){ const p=new THREE.Mesh(boxUV(new THREE.BoxGeometry(.9,4.6,1.4),.9,4.6,1.4),MAT.stone); p.position.set(sx,2.3,0); gg.add(p); }
    const top=new THREE.Mesh(boxUV(new THREE.BoxGeometry(4.2,.9,1.6),4.2,.9,1.6),MAT.stone); top.position.y=5; gg.add(top);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(.6,1,4),new THREE.MeshStandardMaterial({color:0xffc040,emissive:0x804000})); cap.position.y=6; gg.add(cap);
    const portalM=new THREE.MeshBasicMaterial({color:new THREE.Color(.5,.08,.08),transparent:true,opacity:.75,side:THREE.DoubleSide});
    const portal=new THREE.Mesh(new THREE.PlaneGeometry(1.8,4.5),portalM); portal.position.set(0,2.25,0); gg.add(portal);
    const bars=new THREE.Group(); gg.add(bars); const bm=new THREE.MeshStandardMaterial({color:0x4a4a52,metalness:.8,roughness:.4});
    for(let i=0;i<5;i++){ const b=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,4.4,16),bm); b.position.set(-.8+i*.4,2.2,.3); bars.add(b); }
    const glow=glowSprite(0xff3020,5,.35); glow.position.set(0,2.4,.5); gg.add(glow);
    castAll(gg); PL.gate={x:gx,obj:gg,portal,portalM,bars,glow,open:false,openT:0}; }
  // gems
  PL.gems=L.D.map(([x,y])=>({x,y,alive:true}));
  PL.gemMesh=new THREE.InstancedMesh(gemGeo,new THREE.MeshStandardMaterial({color:0xffd040,emissive:0xb07a00,emissiveIntensity:.55,roughness:.12,metalness:.85,flatShading:true}),PL.gems.length); PL.gemMesh.castShadow=true; g.add(PL.gemMesh);
  PL.pows=L.P.map(([x,y])=>{ const o=new THREE.Group(); o.add(new THREE.Mesh(new THREE.OctahedronGeometry(.6,1),new THREE.MeshBasicMaterial({color:new THREE.Color(.5,2.2,2.4),toneMapped:false}))); o.add(glowSprite(0x60f0ff,3.2,.6)); o.position.set(x,y,0); g.add(o); return {x,y,obj:o,alive:true}; });
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
  A3.hero=makeBot(); lionize(A3.hero); GS.W3.actors.add(A3.hero); A3.hero.userData.fx=1; A3.style='plat';
  updGems(0);
}
function updGems(t){
  const M=PL.gemMesh;
  PL.gems.forEach((gm,i)=>{ if(!gm.alive){ M.setMatrixAt(i,ZERO); return; } _q.setFromAxisAngle(_v.set(0,1,0),t*2.5+i*.4); _m4.compose(_v2.set(gm.x,gm.y+Math.sin(t*3+i*.7)*.12,0),_q,_v3.set(1,1.25,1)); M.setMatrixAt(i,_m4); });
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
  if(GS.G.small<=0&&!GT.open){ GT.open=true; banner('ALL GEMS!','THE GATE IS OPEN','#ffd040'); SFX.win(); hint('RUN TO THE GATE AT THE END →',3); }
  if(GT.open){ GT.openT+=dt; GT.bars.position.y=Math.min(4.6,GT.openT*3); GT.portalM.color.setHSL((t*.15)%1,.9,.6); GT.portalM.opacity=.85; GT.glow.material.color.set(0xffd040); GT.glow.material.opacity=.6+Math.sin(t*6)*.2; GT.portal.rotation.y=Math.sin(t*2)*.1;
    if(Math.abs(h.x-GT.x)<1.1&&h.y<4&&!PL.done){ PL.done=true; SFX.power(); burst(new THREE.Vector3(GT.x,2.4,0),120,['#ffd040','#fff6a0','#ff9a3c','#ffffff'],12,.25,1.4,new THREE.Vector3(0,-1,0),null,0); } }
  else if(Math.abs(h.x-GT.x)<2.2&&!PL.lockHint){ PL.lockHint=3; hint('THE GATE IS LOCKED · '+GS.G.small+' GEMS LEFT',2.2); }
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
  if(GS.W3.water) GS.W3.water.offset.x+=dt*.05;
  for(const f of GS.W3.falls||[]) f.offset.y+=dt*1.6;
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
  const pw=GS.G.fright>0; ud.lime.color.set(pw?0xffe070:0xe0a840); ud.lime.emissive.set(pw?0xff9a10:0x5a3008); ud.lime.emissiveIntensity=pw?.6+Math.sin(t*20)*.2:.25;
  if(ud.tail) ud.tail.rotation.x=Math.sin(t*(Math.abs(h.vx)>.5?10:3))*.35;
  ud.thr.scale.y=1+(h.ground?0:1.4)+Math.sin(t*30)*.2;
  heroLight.position.set(h.x,h.y+4,4); heroLight.intensity=6; heroLight.color.set(0xffe0b0);
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
export function platHint(){ return TOUCH?'◀ ▶ RUN · JUMP (TAP AGAIN IN AIR) · GRAB EVERY GEM TO OPEN THE GATE AT THE END':'← → RUN · SPACE / ↑ JUMP (AGAIN IN AIR) · GRAB EVERY GEM TO OPEN THE GATE AT THE END'; }
export function drawPlatMini(){
  const L=PL.L, cs=1.3, vs=2.6, W=Math.round((L.end+12)*cs), H=Math.round(16*vs), ox=9, oy=10;
  if(GS.miniKey!=='plat'){ GS.miniKey='plat'; miniC.width=W; miniC.height=H; const sc=innerWidth<640?.75:1; miniC.style.width=(W*sc)+'px'; miniC.style.height=(H*sc)+'px'; document.body.style.setProperty('--miniw',(W*sc)+'px'); document.body.style.setProperty('--minih',(H*sc)+'px'); }
  const g=miniX, t=performance.now()/1000, X=x=>(x+ox)*cs, Y=y=>H-(y+oy)*vs*.9-6;
  g.fillStyle='rgba(30,14,40,.85)'; g.fillRect(0,0,W,H);
  for(const s of PL.solids){ g.fillStyle=s.type==='ground'?'#7a5030':s.type==='plat'?'#c88a4a':'#b8a888'; const y1=Y(s.y1), y0=Math.min(H,Y(Math.max(s.y0,-3))); g.fillRect(X(s.x0),y1,(s.x1-s.x0)*cs,Math.max(2,y0-y1)); if(s.type==='ground'){ g.fillStyle='#4fc03a'; g.fillRect(X(s.x0),y1,(s.x1-s.x0)*cs,2); } }
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
  name:"JUNGLE '94", color:'#ffb020', song:'p4',
  deathText:'Swallowed by the jungle.',
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
    $('warn').style.display='flex'; SFX.alarm(); setTimeout(()=>SFX.alarm(),1600); banner('JUNGLE','CLEARED','#ffb020');
    camPose(_v.set(GS.G.hero.x,30,70),_v2.set(GS.G.hero.x,4,0),_v3.set(0,1,0));
    runSeq(3.3,(t)=>{ cam.bl=1-ease(clamp(t/2.2,0,1)); if(t>3&&!GS.seq.fl){ GS.seq.fl=1; flash(1); } },()=>{ $('warn').style.display='none'; next(); });
  },
  hud(){ return {left:PL.gate&&PL.gate.open?'GATE OPEN → GO!':'GEMS LEFT '+Math.max(0,GS.G.small)}; },
  minimap:drawPlatMini,
};
export default P4;
