import * as THREE from 'three';
import {GS} from '../core/state.js';
import {$, clamp, ease, lerp, mulberry, PI, pick, rand, TAU, TOUCH} from '../core/utils.js';
import {keys} from '../core/input.js';
import {SFX, noise, tone} from '../core/audio.js';
import {cellAt, genLattice, parseMaze, WALL, wdx, wdy} from '../core/maze.js';
import {addScore, mazeTick, spawnEnemy} from '../core/maze-game.js';
import {_m4, _o, _v, _v2, _v3, basisMat, camera, envFrom, hemi, heroLight, S, scene, sun} from '../engine/renderer.js';
import {both, cvTex, cvTex2, fbm, grain, hg, once, pxFill} from '../engine/textures.js';
import {cam, camPose} from '../engine/camera.js';
import {A3, burstAt, pop3} from '../engine/actors.js';
import {X} from './extras.js';
import {banner, flash, hint} from '../ui/hud.js';
import {hurtHero, runSeq} from '../main.js';
import {dotGeo, hideDot3, layoutWalls} from '../engine/world.js';
import {mazeGo, mazePlayTick, mazeSync, startMazePhase} from './maze-phase.js';
const FPS_ENEMY_FIRE=false; // demons only chase; flip to let them throw fireballs
// ---------- phase 3 (HELL MAZE) HD textures: 512px with bump + emissive maps ----------
export const doomWallT=once(()=>{
  const W=512,H=704, R=mulberry(77);
  const T=cvTex2(W,H,(g,b,w,h)=>{
    // stone bricks (top), conduit band (middle), riveted rust panels (bottom)
    const y0=Math.round(h*.075), y1=Math.round(h*.40), y2=Math.round(h*.52), y3=Math.round(h*.92);
    // --- top beam
    let gr=g.createLinearGradient(0,0,0,y0); gr.addColorStop(0,'#2a2622'); gr.addColorStop(.5,'#5a5248'); gr.addColorStop(1,'#1e1a16'); g.fillStyle=gr; g.fillRect(0,0,w,y0);
    b.fillStyle=hg(170); b.fillRect(0,0,w,y0-4);
    for(let x=16;x<w;x+=32){ both(g,b,'#8a7e6a',230,c=>{ c.beginPath(); c.arc(x,y0/2,4.5,0,TAU); c.fill(); }); g.fillStyle='#d8ccb0'; g.beginPath(); g.arc(x-1.4,y0/2-1.4,1.6,0,TAU); g.fill(); }
    // --- bricks
    const bh=(y1-y0)/4;
    g.fillStyle='#2a2018'; g.fillRect(0,y0,w,y1-y0); b.fillStyle=hg(55); b.fillRect(0,y0,w,y1-y0);
    for(let r=0;r<4;r++){ const by=y0+r*bh, off=r%2?64:0;
      for(let x=-off;x<w;x+=128){ const v=R(), base=[96+v*40,62+v*22,44+v*14];
        const bx=x+3, bw=122, byy=by+3, bhh=bh-6;
        const grd=g.createLinearGradient(0,byy,0,byy+bhh); grd.addColorStop(0,`rgb(${base[0]+22|0},${base[1]+14|0},${base[2]+10|0})`); grd.addColorStop(1,`rgb(${base[0]-26|0},${base[1]-20|0},${base[2]-14|0})`);
        g.fillStyle=grd; b.fillStyle=hg(205+R()*30);
        for(const dx of bx<0?[0,w]:[0]){ g.beginPath(); g.roundRect(bx+dx,byy,bw,bhh,5); g.fill(); b.beginPath(); b.roundRect(bx+dx,byy,bw,bhh,6); b.fill(); }
        // chips + cracks
        for(let k=0;k<3;k++){ const cx=bx+R()*bw, cy=byy+R()*bhh; g.strokeStyle='rgba(20,10,5,.55)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(cx,cy); for(let s=0;s<4;s++) g.lineTo(cx+(R()-.5)*30,cy+(R()-.5)*14); g.stroke(); b.strokeStyle=hg(120); b.lineWidth=1.5; b.stroke(); }
      }
    }
    // mortar shade under the brick band
    g.fillStyle='rgba(0,0,0,.35)'; g.fillRect(0,y1-4,w,4);
    // --- conduit band
    gr=g.createLinearGradient(0,y1,0,y2); gr.addColorStop(0,'#1a1a1e'); gr.addColorStop(1,'#2c2c32'); g.fillStyle=gr; g.fillRect(0,y1,w,y2-y1); b.fillStyle=hg(90); b.fillRect(0,y1,w,y2-y1);
    for(const [py,pr,c0,c1] of [[y1+16,9,'#7a6a52','#2a2218'],[y1+42,13,'#6a6a74','#1c1c22'],[y1+67,6,'#9a5a2a','#3a1a0a']]){
      const pg=g.createLinearGradient(0,py-pr,0,py+pr); pg.addColorStop(0,c1); pg.addColorStop(.35,c0); pg.addColorStop(.55,'#e8dcc8'); pg.addColorStop(.7,c0); pg.addColorStop(1,c1);
      g.fillStyle=pg; g.fillRect(0,py-pr,w,pr*2); const bg2=b.createLinearGradient(0,py-pr,0,py+pr); bg2.addColorStop(0,hg(110)); bg2.addColorStop(.5,hg(240)); bg2.addColorStop(1,hg(110)); b.fillStyle=bg2; b.fillRect(0,py-pr,w,pr*2);
      for(let x=60;x<w;x+=170){ both(g,b,'#3a3a40',255,c=>c.fillRect(x,py-pr-2,10,pr*2+4)); g.fillStyle='rgba(255,255,255,.25)'; g.fillRect(x+2,py-pr-1,2,pr*2+2); }
    }
    // control box with LEDs
    const cbx=180, cby=y1+6, cbw=96, cbh=y2-y1-12;
    both(g,b,'#151518',200,c=>{ c.beginPath(); c.roundRect(cbx,cby,cbw,cbh,6); c.fill(); });
    g.strokeStyle='#4a4a52'; g.lineWidth=2; g.beginPath(); g.roundRect(cbx+1,cby+1,cbw-2,cbh-2,6); g.stroke();
    for(const [lx,col] of [[cbx+22,'#ff3020'],[cbx+48,'#30ff40'],[cbx+74,'#ffb020']]){ const lg=g.createRadialGradient(lx,cby+cbh/2,0,lx,cby+cbh/2,9); lg.addColorStop(0,'#ffffff'); lg.addColorStop(.35,col); lg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=lg; g.beginPath(); g.arc(lx,cby+cbh/2,9,0,TAU); g.fill(); }
    // --- rust panels
    gr=g.createLinearGradient(0,y2,0,y3); gr.addColorStop(0,'#6a5644'); gr.addColorStop(1,'#4a3a2c'); g.fillStyle=gr; g.fillRect(0,y2,w,y3-y2);
    b.fillStyle=hg(170); b.fillRect(0,y2,w,y3-y2);
    for(const px of [0,w/2]){ // panel seams + rivets
      both(g,b,'#2a2018',60,c=>{ c.fillRect(px-2,y2,4,y3-y2); });
      g.fillStyle='rgba(255,230,190,.18)'; g.fillRect(px+2,y2,2,y3-y2);
      for(let ry=y2+18;ry<y3-8;ry+=34) for(const rx of [px+14,px+w/2-14]){ both(g,b,'#7a6a58',250,c=>{ c.beginPath(); c.arc(rx,ry,4,0,TAU); c.fill(); }); g.fillStyle='#c8b498'; g.beginPath(); g.arc(rx-1.2,ry-1.2,1.4,0,TAU); g.fill(); }
      // embossed cross brace
      g.strokeStyle='rgba(30,22,14,.45)'; g.lineWidth=10; g.beginPath(); g.moveTo(px+30,y2+24); g.lineTo(px+w/2-30,y3-24); g.moveTo(px+w/2-30,y2+24); g.lineTo(px+30,y3-24); g.stroke();
      b.strokeStyle=hg(215); b.lineWidth=10; b.beginPath(); b.moveTo(px+30,y2+24); b.lineTo(px+w/2-30,y3-24); b.moveTo(px+w/2-30,y2+24); b.lineTo(px+30,y3-24); b.stroke();
    }
    // rust streaks running down
    for(let i=0;i<34;i++){ const x=R()*w, y=y1+R()*(y3-y1)*.6, L=40+R()*180, wd=1+R()*5; const sg=g.createLinearGradient(0,y,0,y+L); sg.addColorStop(0,`rgba(${120+R()*60|0},${50+R()*30|0},10,.55)`); sg.addColorStop(1,'rgba(60,20,0,0)'); g.fillStyle=sg; g.fillRect(x,y,wd,L); }
    // --- baseboard grime
    gr=g.createLinearGradient(0,y3,0,h); gr.addColorStop(0,'#2a2420'); gr.addColorStop(1,'#0e0a08'); g.fillStyle=gr; g.fillRect(0,y3,w,h-y3); b.fillStyle=hg(140); b.fillRect(0,y3,w,h-y3);
    grain(g,b,w,h,8,.55,3,4,.18);
  });
  const E=cvTex(W,H,(g,w,h)=>{ g.fillStyle='#000'; g.fillRect(0,0,w,h); const y1=Math.round(h*.40), y2=Math.round(h*.52), cy=(y1+6+(y2-y1-12)/2);
    for(const [lx,col] of [[202,'#ff3020'],[228,'#30ff40'],[254,'#ffb020']]){ const lg=g.createRadialGradient(lx,cy,0,lx,cy,10); lg.addColorStop(0,'#fff'); lg.addColorStop(.4,col); lg.addColorStop(1,'#000'); g.fillStyle=lg; g.beginPath(); g.arc(lx,cy,10,0,TAU); g.fill(); } },true);
  return {map:T.map,bump:T.bump,em:E};
});
export const doomFloorT=once(()=>cvTex2(512,512,(g,b,w,h)=>{ const R=mulberry(5);
  g.fillStyle='#4a443c'; g.fillRect(0,0,w,h);
  for(let j=0;j<2;j++) for(let i=0;i<2;i++){ const x=i*256+5, y=j*256+5, s=246, v=R()*18;
    const gr=g.createLinearGradient(x,y,x+s,y+s); gr.addColorStop(0,`rgb(${92+v|0},${84+v|0},${74+v|0})`); gr.addColorStop(1,`rgb(${62+v|0},${56+v|0},${48+v|0})`);
    g.fillStyle=gr; g.beginPath(); g.roundRect(x,y,s,s,10); g.fill(); b.fillStyle=hg(215); b.beginPath(); b.roundRect(x,y,s,s,14); b.fill();
    // cracks
    for(let k=0;k<2;k++){ let cx=x+R()*s, cy=y+R()*s; g.strokeStyle='rgba(15,10,6,.7)'; b.strokeStyle=hg(80); g.lineWidth=b.lineWidth=1.6; g.beginPath(); b.beginPath(); g.moveTo(cx,cy); b.moveTo(cx,cy); for(let q=0;q<7;q++){ cx+=(R()-.5)*40; cy+=(R()-.5)*40; g.lineTo(cx,cy); b.lineTo(cx,cy);} g.stroke(); b.stroke(); }
  }
  // dark stains
  for(let i=0;i<10;i++){ const x=R()*w, y=R()*h, r=20+R()*60; const sg=g.createRadialGradient(x,y,0,x,y,r); sg.addColorStop(0,`rgba(${30+R()*40|0},8,4,.45)`); sg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=sg; g.fillRect(x-r,y-r,r*2,r*2); }
  grain(g,b,w,h,8,.6,9,4,.25);
}));
export const doomCeilT=once(()=>{
  const T=cvTex2(512,512,(g,b,w,h)=>{ g.fillStyle='#24211e'; g.fillRect(0,0,w,h);
    for(let j=0;j<4;j++) for(let i=0;i<4;i++){ const x=i*128+3, y=j*128+3; const gr=g.createLinearGradient(x,y,x,y+122); gr.addColorStop(0,'#3a3632'); gr.addColorStop(1,'#26231f'); g.fillStyle=gr; g.fillRect(x,y,122,122); b.fillStyle=hg(200); b.fillRect(x,y,122,122);
      g.fillStyle='rgba(0,0,0,.4)'; for(let k=0;k<4;k++) g.fillRect(x+12,y+20+k*26,98,3); }
    // light fixture in the middle
    both(g,b,'#8a8478',230,c=>{ c.beginPath(); c.roundRect(170,170,172,172,8); c.fill(); });
    const lg=g.createLinearGradient(0,186,0,326); lg.addColorStop(0,'#fff6d8'); lg.addColorStop(.5,'#fffbe8'); lg.addColorStop(1,'#f0e2b8'); g.fillStyle=lg; g.fillRect(184,184,144,144);
    g.fillStyle='rgba(120,110,90,.55)'; for(let k=0;k<5;k++){ g.fillRect(184,196+k*28,144,3); }
    grain(g,b,w,h,8,.35,13,3,.12);
  });
  const E=cvTex(512,512,(g,w,h)=>{ g.fillStyle='#000'; g.fillRect(0,0,w,h); const lg=g.createRadialGradient(256,256,20,256,256,110); lg.addColorStop(0,'#fff6d0'); lg.addColorStop(1,'#d8c890'); g.fillStyle=lg; g.fillRect(184,184,144,144); g.fillStyle='#3a362a'; for(let k=0;k<5;k++) g.fillRect(184,196+k*28,144,3); },true);
  return {map:T.map,bump:T.bump,em:E};
});

// ================= PHASE 3: HELL MAZE (first-person shooter) =================
export const P3F={hero:[13,13],spawns:[[1,1],[25,1],[1,25],[25,25],[13,1],[1,13],[25,13],[13,25]],exit:null,enemies:5,release:[2,3,4,5.5,7],heroSpd:3.6,enSpd:2.4,fright:7,killOnEat:true,noScatter:true,fps:true,
  corners:[[0,0],[26,0],[0,26],[26,26]],dur:60,hitR:.7,enRamp:.15};
// HD demon sprites: drawn at 4x with shaded spheres, curved spikes and horns, glossy eyes
function demonTex(kind){
  return cvTex(256,256,(g,w,h)=>{ g.scale(4,4);
    const Hh=kind==='H', F=kind==='F', open=kind==='B';
    const c=Hh?['#fff','#fff','#fff']:F?['#4a6aa0','#142440','#a8c8f0']:['#b8341c','#3a0804','#ff9a6a'];
    for(let k=0;k<10;k++){ const a=k/10*TAU+(open?.15:0), tx=32+Math.cos(a)*29, ty=34+Math.sin(a)*29;
      const sg=g.createLinearGradient(32+Math.cos(a)*14,34+Math.sin(a)*14,tx,ty); sg.addColorStop(0,c[1]); sg.addColorStop(1,Hh?'#fff':F?'#8ab0e0':'#ecd2a8');
      g.fillStyle=sg; g.beginPath(); g.moveTo(32+Math.cos(a-.27)*16,34+Math.sin(a-.27)*16); g.quadraticCurveTo(32+Math.cos(a-.07)*24,34+Math.sin(a-.07)*24,tx,ty);
      g.quadraticCurveTo(32+Math.cos(a+.09)*23,34+Math.sin(a+.09)*23,32+Math.cos(a+.27)*16,34+Math.sin(a+.27)*16); g.fill(); }
    const bg=g.createRadialGradient(25,26,1,32,34,19); bg.addColorStop(0,c[2]); bg.addColorStop(.42,c[0]); bg.addColorStop(1,c[1]);
    g.fillStyle=bg; g.beginPath(); g.arc(32,34,18,0,TAU); g.fill();
    if(!Hh){ g.strokeStyle=F?'rgba(10,30,70,.45)':'rgba(60,0,0,.45)'; g.lineWidth=.35;
      for(let i=0;i<11;i++){ const a=i/11*TAU+.3; g.beginPath(); g.moveTo(32+Math.cos(a)*17.5,34+Math.sin(a)*17.5); g.quadraticCurveTo(32+Math.cos(a+.35)*12,34+Math.sin(a+.35)*12,32+Math.cos(a+.15)*7,34+Math.sin(a+.15)*7); g.stroke(); } }
    for(const sx of [-1,1]){ const hgr=g.createLinearGradient(32+sx*10,22,32+sx*20,4); hgr.addColorStop(0,Hh?'#fff':'#7a6a4a'); hgr.addColorStop(1,Hh?'#fff':'#fbf4e2'); g.fillStyle=hgr;
      g.beginPath(); g.moveTo(32+sx*15,23); g.quadraticCurveTo(32+sx*23,15,32+sx*20,3); g.quadraticCurveTo(32+sx*15,13,32+sx*7,18); g.closePath(); g.fill();
      if(!Hh){ g.strokeStyle='rgba(70,50,25,.55)'; g.lineWidth=.45; for(let r=0;r<4;r++){ const t=.2+r*.18; g.beginPath(); g.moveTo(32+sx*(15-t*6),23-t*9); g.lineTo(32+sx*(10+t*9),19-t*10); g.stroke(); } } }
    if(Hh) return;
    g.fillStyle='rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(24.5,25,5,2.6,-.65,0,TAU); g.fill();
    g.fillStyle='rgba(0,0,0,.5)'; g.beginPath(); g.ellipse(32,29.4,9,8.4,0,0,TAU); g.fill();
    const eg=g.createRadialGradient(30,27,.5,32,29,7.2); eg.addColorStop(0,'#ffffff'); eg.addColorStop(1,F?'#c8d8f0':'#e8d088'); g.fillStyle=eg; g.beginPath(); g.arc(32,29,7,0,TAU); g.fill();
    const ig=g.createRadialGradient(32,30,0,32,30,3.8); ig.addColorStop(0,F?'#e8f8ff':'#ffe060'); ig.addColorStop(.6,F?'#5aa8e8':'#ff3a10'); ig.addColorStop(1,F?'#1a5a9a':'#900800'); g.fillStyle=ig; g.beginPath(); g.arc(32,30,3.8,0,TAU); g.fill();
    g.fillStyle='#000'; g.beginPath(); g.ellipse(32,30,.95,2.7,0,0,TAU); g.fill(); g.fillStyle='rgba(255,255,255,.9)'; g.beginPath(); g.arc(30.4,28.2,1,0,TAU); g.fill();
    if(!F){ g.strokeStyle='#2a0200'; g.lineWidth=1.4; g.beginPath(); g.moveTo(23,21.5); g.lineTo(31,24.5); g.moveTo(41,21.5); g.lineTo(33,24.5); g.stroke(); }
    const mh=open?9:4, mg=g.createLinearGradient(0,40,0,40+mh); mg.addColorStop(0,'#400404'); mg.addColorStop(1,'#100000'); g.fillStyle=mg; g.beginPath(); g.roundRect(21.5,40,21,mh,[1,1,4,4]); g.fill();
    if(open){ g.fillStyle='#b01818'; g.beginPath(); g.ellipse(32,47.5,5.5,2,0,0,TAU); g.fill(); }
    for(let x=22.6;x<42;x+=3.9){ const tg=g.createLinearGradient(0,40,0,43.5); tg.addColorStop(0,'#fffaf0'); tg.addColorStop(1,'#c8b488'); g.fillStyle=tg;
      g.beginPath(); g.moveTo(x,40); g.lineTo(x+2.6,40); g.lineTo(x+1.3,43.5); g.fill();
      if(open){ g.beginPath(); g.moveTo(x+1,49); g.lineTo(x+3.6,49); g.lineTo(x+2.3,45.6); g.fill(); } }
    if(F){ const dg=g.createLinearGradient(44,28,46,37); dg.addColorStop(0,'#ffffff'); dg.addColorStop(1,'#8ac8ff'); g.fillStyle=dg; g.beginPath(); g.moveTo(45,28); g.quadraticCurveTo(48,34,45,36.5); g.quadraticCurveTo(42,34,45,28); g.fill(); }
  });
}
const DT={A:demonTex('A'),B:demonTex('B'),F:demonTex('F'),H:demonTex('H')};
function bruteTex(kind){
  return cvTex(384,384,(g,w,h)=>{ g.scale(4,4);
    const white=kind==='H', open=kind==='B';
    const c=white?['#fff','#fff','#fff']:['#4a1468','#12021c','#9a4ac0'];
    for(let k=0;k<14;k++){ const a=k/14*TAU+(open?.12:0), L=k%2?40:46, tx=48+Math.cos(a)*L, ty=54+Math.sin(a)*L;
      const sg=g.createLinearGradient(48+Math.cos(a)*22,54+Math.sin(a)*22,tx,ty); sg.addColorStop(0,c[1]); sg.addColorStop(1,white?'#fff':'#c8a0e0');
      g.fillStyle=sg; g.beginPath(); g.moveTo(48+Math.cos(a-.21)*24,54+Math.sin(a-.21)*24); g.quadraticCurveTo(48+Math.cos(a-.05)*34,54+Math.sin(a-.05)*34,tx,ty); g.quadraticCurveTo(48+Math.cos(a+.07)*33,54+Math.sin(a+.07)*33,48+Math.cos(a+.21)*24,54+Math.sin(a+.21)*24); g.fill(); }
    const bg=g.createRadialGradient(38,42,2,48,54,29); bg.addColorStop(0,c[2]); bg.addColorStop(.45,c[0]); bg.addColorStop(1,c[1]); g.fillStyle=bg; g.beginPath(); g.arc(48,54,28,0,TAU); g.fill();
    if(!white){ g.strokeStyle='rgba(20,0,30,.5)'; g.lineWidth=.5; for(let i=0;i<14;i++){ const a=i/14*TAU; g.beginPath(); g.moveTo(48+Math.cos(a)*27,54+Math.sin(a)*27); g.quadraticCurveTo(48+Math.cos(a+.3)*18,54+Math.sin(a+.3)*18,48+Math.cos(a+.12)*10,54+Math.sin(a+.12)*10); g.stroke(); } }
    for(const sx of [-1,1]){ const hgr=g.createLinearGradient(48+sx*14,36,48+sx*40,2); hgr.addColorStop(0,white?'#fff':'#7a6a48'); hgr.addColorStop(1,white?'#fff':'#fff6e0'); g.fillStyle=hgr;
      g.beginPath(); g.moveTo(48+sx*22,36); g.quadraticCurveTo(48+sx*44,26,48+sx*38,2); g.quadraticCurveTo(48+sx*28,22,48+sx*12,30); g.closePath(); g.fill();
      if(!white){ g.strokeStyle='rgba(70,50,25,.5)'; g.lineWidth=.6; for(let r=0;r<6;r++){ const t=r/6; g.beginPath(); g.moveTo(48+sx*(22+t*16),36-t*24); g.lineTo(48+sx*(12+t*24),30-t*22); g.stroke(); } } }
    if(white) return;
    g.fillStyle='rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(38,40,8,4,-.6,0,TAU); g.fill();
    for(const [x,y,r] of [[48,42,7],[34,50,5],[62,50,5]]){
      g.fillStyle='rgba(0,0,0,.5)'; g.beginPath(); g.arc(x,y,r+1.6,0,TAU); g.fill();
      const eg=g.createRadialGradient(x-r*.3,y-r*.3,.5,x,y,r); eg.addColorStop(0,'#f8ffb0'); eg.addColorStop(.6,'#c8ff40'); eg.addColorStop(1,'#5a8a00'); g.fillStyle=eg; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill();
      g.fillStyle='#000'; g.beginPath(); g.ellipse(x,y,r*.18,r*.75,0,0,TAU); g.fill(); g.fillStyle='rgba(255,255,255,.9)'; g.beginPath(); g.arc(x-r*.35,y-r*.4,r*.18,0,TAU); g.fill(); }
    const mh=open?14:7, mg=g.createLinearGradient(0,64,0,64+mh); mg.addColorStop(0,'#ff3a14'); mg.addColorStop(1,'#5a0000'); g.fillStyle=mg; g.beginPath(); g.roundRect(31,64,34,mh,[2,2,6,6]); g.fill();
    for(let x=32.5;x<63;x+=5){ const tg=g.createLinearGradient(0,64,0,69); tg.addColorStop(0,'#fffaf0'); tg.addColorStop(1,'#c8b488'); g.fillStyle=tg;
      g.beginPath(); g.moveTo(x,64); g.lineTo(x+3.4,64); g.lineTo(x+1.7,69); g.fill(); if(open){ g.beginPath(); g.moveTo(x+1,78); g.lineTo(x+4.4,78); g.lineTo(x+2.7,73); g.fill(); } }
  });
}
const BT={A:bruteTex('A'),B:bruteTex('B'),H:bruteTex('H')};
const fireTex=cvTex(128,128,(g,w,h)=>{ const gr=g.createRadialGradient(64,64,0,64,64,62); gr.addColorStop(0,'#fffbe0'); gr.addColorStop(.3,'#ffd040'); gr.addColorStop(.65,'#ff5a10'); gr.addColorStop(1,'rgba(255,40,0,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
function makeBrute(){
  const mat=new THREE.SpriteMaterial({map:BT.A,transparent:true,alphaTest:.3,fog:true});
  const s=new THREE.Sprite(mat); s.scale.set(3,3,1); s.center.set(.5,.12);
  const g=new THREE.Group(); g.add(s); g.userData={spr:s,mat,style:'brute',hit:0}; return g;
}
function spawnBrute(){
  const h=GS.G.hero, sp=GS.G.cfg.spawns.slice().sort((a,b)=>Math.hypot(b[0]-h.x,b[1]-h.y)-Math.hypot(a[0]-h.x,a[1]-h.y))[0];
  const e=spawnEnemy(90,.5,sp); e.boss=true; e.hp=5; e.pers=0; e.fr=false; X.brute=e;
  banner('WARNING','THE BRUTE','#c040ff'); SFX.alarm(); hint('THE BRUTE IS HUNTING YOU · 5 SHOTS TO DROP IT',2.5);
}
function makeDemon(){
  const mat=new THREE.SpriteMaterial({map:DT.A,transparent:true,alphaTest:.3,fog:true});
  const s=new THREE.Sprite(mat); s.scale.set(1.9,1.9,1); s.center.set(.5,.15);
  const g=new THREE.Group(); g.add(s); g.userData={spr:s,mat,style:'demon',hit:0};
  return g;
}
export function buildFpsEnv(){
  scene.background=new THREE.Color(0x0a0604); scene.fog=new THREE.Fog(0x0c0705,2.5,24);
  hemi.color.set(0xffd8b0); hemi.groundColor.set(0x2a1408); hemi.intensity=.42; sun.color.set(0xffb070); sun.intensity=.35; sun.position.set(10,40,5);
  envFrom('#2a160c','#4a2410','#0c0604',[['#ffe0a0',0,30,0,6]]);
}
export function fpsSetup(){
  X.brute=null; X.ammo=40; X.cool=0; X.kills=0; X.fb=[]; X.flashT=0; X.faceT=0; X.lookDir=0; X.noAmmoT=0;
  for(const e of GS.G.en){ e.hp=2; e.fireCD=rand(2,4); }
}
export function fpsFire(){
  if(GS.mode!=='play'||!GS.G.hero.alive||X.cool>0) return;
  if(X.ammo<=0){ if(X.noAmmoT<=0){ X.noAmmoT=1.2; tone({f:200,d:.05,v:.05,type:'square'}); hint('NO AMMO · EAT DOTS FOR AMMO',1.4); } return; }
  X.ammo--; X.cool=.32; X.flashT=.09;
  noise({f:1800,f2:200,d:.28,v:.32}); tone({f:120,f2:40,d:.2,v:.3,type:'sine'});
  heroLight.intensity=40;
  const m=GS.G.m, h=GS.G.hero, fx=h.fx, fy=h.fy;
  // wall distance
  let wd=0; const rx=Math.round(h.x), ry=Math.round(h.y);
  const off=(h.x-rx)*fx+(h.y-ry)*fy;
  for(let k=1;k<30;k++){ if(cellAt(m,rx+fx*k,ry+fy*k)===WALL){ wd=k-.5-off; break; } }
  let best=null, bd=wd;
  for(const e of GS.G.en){
    if(!(e.st==='run'||e.st==='leave')) continue;
    const dx=wdx(m,h.x,e.x), dy=wdy(m,h.y,e.y), fwd=dx*fx+dy*fy, lat=Math.abs(dx*fy-dy*fx);
    if(fwd>-.2&&fwd<bd&&lat<.65){ bd=fwd; best=e; }
  }
  if(best){
    best.hp=(best.hp??2)-1; const o=A3.en[best.k]; if(o) o.userData.hit=.15;
    if(best.boss&&best.hp>0){ pop3(best.x,best.y,'BRUTE '+best.hp+'/5','#c040ff',2.6); cam.shake=Math.max(cam.shake,.15); }
    burstAt(best.x,best.y,1.1,14,['#ff3a1a','#8a0a00','#ffd04a'],5,.12,.5,2);
    if(best.hp<=0&&best.boss){ best.st='dead'; best.dead=15; best.hp=5; X.kills++; addScore(2000); pop3(best.x,best.y,'2000','#c040ff',2.6);
      burstAt(best.x,best.y,1.4,140,['#c040ff','#3a1050','#d0ff60','#ff2a10','#fff'],12,.3,1.6,7); SFX.boom(true); cam.shake=1; flash(.35,'#c040ff'); hint('THE BRUTE IS DOWN · IT WILL BE BACK',2); }
    else if(best.hp<=0){ best.st='dead'; best.dead=4.5; best.hp=2; X.kills++; addScore(300); pop3(best.x,best.y,'300','#ff5a2a',1.6);
      burstAt(best.x,best.y,1,50,['#ff3a1a','#8a0a00','#5a140c','#ffd04a'],8,.2,1.1,5); SFX.eatEnemy(); }
    else tone({f:300,f2:120,d:.15,v:.12,type:'sawtooth',lp:900});
  } else if(wd>0&&wd<28){
    burstAt(h.x+fx*wd,h.y+fy*wd,1.1,8,['#bfa880','#6a5a44','#ffe0a0'],3,.08,.4,1);
  }
}
export function fpsTick(dt){
  const m=GS.G.m, h=GS.G.hero, t=performance.now()/1000;
  X.cool-=dt; X.flashT-=dt; X.noAmmoT-=dt;
  if((keys.Space||keys.KeyF||keys.KeyJ||keys.ControlLeft||keys.KeyX)) fpsFire();
  if(!X.brute&&GS.G.t>6) spawnBrute();
  heroLight.intensity=lerp(heroLight.intensity,9+Math.sin(t*23)*.6,1-Math.exp(-dt*12));
  hemi.intensity=.5+(Math.random()<.02?-.25:0);
  // enemies only chase (no fireballs): only the player shoots
  for(const e of (FPS_ENEMY_FIRE?GS.G.en:[])){
    if(e.hp==null){ e.hp=2; e.fireCD=rand(2,4); }
    if(e.st!=='run'||e.fr) continue;
    e.fireCD-=dt; if(e.fireCD>0) continue;
    const ex=Math.round(e.x), ey=Math.round(e.y), hx=Math.round(h.x), hy=Math.round(h.y);
    let dx=0,dy=0,d=0;
    if(ex===hx&&Math.abs(ey-hy)<=9){ dy=Math.sign(hy-ey); d=Math.abs(hy-ey); } else if(ey===hy&&Math.abs(ex-hx)<=9){ dx=Math.sign(hx-ex); d=Math.abs(hx-ex); }
    if(!d||d<2) { e.fireCD=.3; continue; }
    let clear=true; for(let k=1;k<d;k++) if(cellAt(m,ex+dx*k,ey+dy*k)===WALL){ clear=false; break; }
    if(!clear){ e.fireCD=.3; continue; }
    e.fireCD=rand(3.2,4.8)/(1+GS.G.t/120);
    const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:fireTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,color:new THREE.Color(2,1.6,1.2)}));
    spr.scale.set(.9,.9,1); GS.W3.fx.add(spr);
    X.fb.push({x:ex,y:ey,dx,dy,spr,life:4}); tone({f:500,f2:150,d:.3,v:.06,type:'sawtooth',lp:1500});
  }
  for(let i=X.fb.length-1;i>=0;i--){ const f=X.fb[i]; f.x+=f.dx*4*dt; f.y+=f.dy*4*dt; f.life-=dt;
    GS.W3.map(f.x,f.y,1.05,_o); f.spr.position.copy(_o.p); f.spr.material.rotation+=dt*6;
    const wall=cellAt(m,Math.round(f.x+f.dx*.45),Math.round(f.y+f.dy*.45))===WALL;
    if(h.alive&&Math.hypot(f.x-h.x,f.y-h.y)<.55){ hurtHero('FIREBALL'); f.life=0; }
    if(wall||f.life<=0){ burstAt(f.x,f.y,1,10,['#ffd040','#ff5a10'],4,.12,.4,1); f.spr.removeFromParent(); f.spr.material.dispose(); X.fb.splice(i,1); }
  }
}
export function fpsSyncEnemies(dt){
  const t=performance.now()/1000;
  for(const e of GS.G.en){
    let o=A3.en[e.k]; if(!o){ o=e.boss?makeBrute():makeDemon(); GS.W3.actors.add(o); A3.en[e.k]=o; }
    const u=o.userData;
    if(e.st==='dead'){ o.visible=false; continue; }
    o.visible=true; GS.W3.map(e.x,e.y,0,_o); o.position.copy(_o.p);
    u.hit-=dt;
    const flashEnd=e.fr&&GS.G.fright<1.6&&(t*8|0)%2;
    if(e.boss){ u.mat.map=u.hit>0?BT.H:((t*2.2)|0)%2?BT.A:BT.B; u.spr.scale.set(3,3+Math.sin(e.bob)*.1,1); continue; }
    u.mat.map=u.hit>0?DT.H:e.fr?(flashEnd?DT.H:DT.F):((t*3+e.k)|0)%2?DT.A:DT.B;
    u.spr.scale.set(1.9,1.9+Math.sin(e.bob)*.06,1);
  }
}
// ---------- weapon + status bar overlays ----------
const gunC=$('gun'), gunX=gunC.getContext('2d'), sbC=$('sbar'), sbX=sbC.getContext('2d');
// HD arm cannon (640x400 canvas, drawn in 160x100 units at 4x with shading and glow)
// perf: the arm is only repainted when its look changes (power on/off, muzzle flash);
// walking bob is a cheap CSS transform instead of a full canvas redraw every frame
let gunKey='';
function drawGun(){
  const g=gunX, h=GS.G.hero, moving=h.dx||h.dy, b=cam.bobT;
  const bx=moving?Math.sin(b*.5)*6:0, by=(moving?Math.abs(Math.cos(b*.5))*5:0)+(X.flashT>0?4:0);
  gunC.style.transform=`translate(${(-50+bx/1.6).toFixed(2)}%,${by.toFixed(2)}%)`;
  const coil=GS.G.fright>0?'#ff6a3a':'#29f0ff', key=coil+(X.flashT>0?'F'+(b*4|0):'');
  if(key===gunKey) return; gunKey=key;
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,640,400); g.setTransform(4,0,0,4,0,0);
  const cx=80, top=46;
  if(X.flashT>0){ const fg=g.createRadialGradient(cx,top-6,0,cx,top-6,24); fg.addColorStop(0,'rgba(255,255,255,1)'); fg.addColorStop(.25,'rgba(255,240,160,.95)'); fg.addColorStop(.6,'rgba(255,140,40,.55)'); fg.addColorStop(1,'rgba(255,80,0,0)');
    g.fillStyle=fg; g.beginPath(); for(let k=0;k<16;k++){ const a=k/16*TAU+b, r=k%2?8:24; g.lineTo(cx+Math.cos(a)*r,top-6+Math.sin(a)*r*.8); } g.closePath(); g.fill(); }
  // forearm
  let gr=g.createLinearGradient(cx-26,0,cx+26,0); gr.addColorStop(0,'#123010'); gr.addColorStop(.28,'#3f8a30'); gr.addColorStop(.52,'#74d454'); gr.addColorStop(.8,'#2f6e24'); gr.addColorStop(1,'#0e260c');
  g.fillStyle=gr; g.beginPath(); g.roundRect(cx-25,top+26,50,62,7); g.fill();
  gr=g.createLinearGradient(0,top+26,0,top+34); gr.addColorStop(0,'rgba(220,255,200,.55)'); gr.addColorStop(1,'rgba(220,255,200,0)'); g.fillStyle=gr; g.beginPath(); g.roundRect(cx-24,top+27,48,8,6); g.fill();
  g.strokeStyle='rgba(5,25,5,.55)'; g.lineWidth=.7; g.beginPath(); g.moveTo(cx-25,top+42); g.lineTo(cx+25,top+42); g.moveTo(cx-25,top+60); g.lineTo(cx+25,top+60); g.moveTo(cx-14,top+42); g.lineTo(cx-14,top+60); g.stroke();
  for(const [x,y] of [[cx-20,top+31],[cx+20,top+31],[cx-20,top+47],[cx+20,top+47]]){ const rg=g.createRadialGradient(x-.5,y-.5,0,x,y,1.8); rg.addColorStop(0,'#e8ffe0'); rg.addColorStop(1,'#1a4a14'); g.fillStyle=rg; g.beginPath(); g.arc(x,y,1.6,0,TAU); g.fill(); }
  // barrel
  gr=g.createLinearGradient(cx-10,0,cx+10,0); gr.addColorStop(0,'#121216'); gr.addColorStop(.3,'#6a6a78'); gr.addColorStop(.48,'#d8d8e4'); gr.addColorStop(.62,'#5a5a66'); gr.addColorStop(1,'#0c0c10');
  g.fillStyle=gr; g.beginPath(); g.roundRect(cx-9,top,18,34,2.5); g.fill();
  gr=g.createLinearGradient(cx-11,0,cx+11,0); gr.addColorStop(0,'#1a1a20'); gr.addColorStop(.45,'#b8b8c8'); gr.addColorStop(1,'#16161c'); g.fillStyle=gr; g.beginPath(); g.roundRect(cx-11,top-1,22,5,2); g.fill();
  g.fillStyle='#030304'; g.beginPath(); g.ellipse(cx,top+1,6.2,1.9,0,0,TAU); g.fill();
  // energy coils
  g.save(); g.shadowColor=coil; g.shadowBlur=8;
  for(let i=0;i<3;i++){ const y=top+8+i*7; gr=g.createLinearGradient(0,y,0,y+3); gr.addColorStop(0,'#ffffff'); gr.addColorStop(.4,coil); gr.addColorStop(1,coil); g.fillStyle=gr; g.beginPath(); g.roundRect(cx-12,y,24,2.8,1.4); g.fill(); }
  g.restore();
  // hand / grip
  gr=g.createLinearGradient(cx+16,0,cx+46,0); gr.addColorStop(0,'#2a6a1e'); gr.addColorStop(.45,'#86e85c'); gr.addColorStop(1,'#1e5216'); g.fillStyle=gr; g.beginPath(); g.roundRect(cx+17,top+44,28,36,6); g.fill();
  g.strokeStyle='rgba(8,36,6,.6)'; g.lineWidth=.8; for(const y of [top+53,top+62,top+71]){ g.beginPath(); g.moveTo(cx+18,y); g.quadraticCurveTo(cx+31,y+2,cx+44,y); g.stroke(); }
  g.fillStyle='rgba(230,255,210,.35)'; for(const y of [top+47,top+56,top+65]){ g.beginPath(); g.ellipse(cx+31,y,9,1.4,0,0,TAU); g.fill(); }
  // status LED
  g.save(); g.shadowColor='#ffcf3a'; g.shadowBlur=6; const lg=g.createRadialGradient(cx-.6,top+42.4,0,cx,top+43,3.2); lg.addColorStop(0,'#fff8d0'); lg.addColorStop(1,'#f0a010'); g.fillStyle=lg; g.beginPath(); g.arc(cx,top+43,3,0,TAU); g.fill(); g.restore();
}
function digits(g,s,x,y,col,size=12){ g.font=size+'px "Press Start 2P",monospace'; g.textAlign='center'; g.textBaseline='top'; g.fillStyle='rgba(0,0,0,.7)'; g.fillText(s,x+.6,y+.6); g.save(); g.shadowColor=col; g.shadowBlur=3; g.fillStyle=col; g.fillText(s,x,y); g.restore(); }
// brushed steel background for the status bar, rendered once
const sbBG=once(()=>{ const cv=document.createElement('canvas'); cv.width=1280; cv.height=128; const g=cv.getContext('2d'); const R=mulberry(3);
  pxFill(g,1280,128,(x,y)=>{ const n=fbm(x/1280*32,y/128*4,4,3)*.6+fbm(x/1280*256,y/128*2,2,2)*.4; const v=58+n*34+(R()-.5)*10; return [v,v,v+3]; });
  const gr=g.createLinearGradient(0,0,0,128); gr.addColorStop(0,'rgba(255,255,255,.18)'); gr.addColorStop(.08,'rgba(255,255,255,0)'); gr.addColorStop(.9,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(0,0,0,.35)'); g.fillStyle=gr; g.fillRect(0,0,1280,128);
  return cv; });
let sbKey='';
function drawSbar(){
  const g=sbX, W=320, H=32;
  X.faceT-=1/60; if(X.faceT<=0){ X.faceT=rand(.6,1.6); X.lookDir=pick([-1,0,1]); }
  // perf: only repaint the status bar when something on it changed
  const key=[X.ammo,GS.G.hearts,X.kills,GS.G.fright>0?Math.ceil(GS.G.fright):'-',GS.G.small,GS.G.inv>0,X.lookDir].join();
  if(key===sbKey) return false; sbKey=key;
  g.setTransform(1,0,0,1,0,0); g.drawImage(sbBG(),0,0); g.setTransform(4,0,0,4,0,0);
  const box=(x,w,label)=>{ g.fillStyle='rgba(0,0,0,.28)'; g.beginPath(); g.roundRect(x+1.5,1.5,w-3,H-3,1.5); g.fill();
    g.strokeStyle='rgba(0,0,0,.6)'; g.lineWidth=.5; g.beginPath(); g.moveTo(x+1.5,H-1.5); g.lineTo(x+1.5,1.5); g.lineTo(x+w-1.5,1.5); g.stroke();
    g.strokeStyle='rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(x+w-1.5,1.5); g.lineTo(x+w-1.5,H-1.5); g.lineTo(x+1.5,H-1.5); g.stroke();
    if(label){ g.font='5.5px "Press Start 2P",monospace'; g.textAlign='center'; g.textBaseline='top'; g.fillStyle='#e0e0e0'; g.fillText(label,x+w/2,H-8.5); } };
  box(0,58,'AMMO'); digits(g,String(Math.max(0,X.ammo)),29,5,'#ff3a28');
  box(58,66,'HEALTH'); digits(g,(Math.max(0,GS.G.hearts)*25)+'%',91,5,'#ff3a28');
  box(124,34,'');
  box(158,58,'KILLS'); digits(g,String(X.kills),187,5,'#ffd030');
  box(216,52,'CHOMP'); digits(g,GS.G.fright>0?String(Math.ceil(GS.G.fright)):'--',242,5,GS.G.fright>0?'#29f0ff':'#8a8a8a');
  box(268,52,'DOTS LEFT'); digits(g,String(Math.max(0,GS.G.small)),294,5,'#ffd030');
  // MUNCHBOT face
  const fx=127, fy=3, hurt=GS.G.inv>0, pw=GS.G.fright>0;
  let gr=g.createLinearGradient(0,fy+1,0,fy+21); gr.addColorStop(0,hurt?'#ff8a70':'#a8ff7a'); gr.addColorStop(.5,hurt?'#c84a3a':'#5fd83a'); gr.addColorStop(1,hurt?'#7a2018':'#2a8a1a');
  g.fillStyle=gr; g.beginPath(); g.roundRect(fx+2,fy+2,24,19,4); g.fill();
  gr=g.createLinearGradient(0,fy+5,0,fy+13); gr.addColorStop(0,hurt?'#600':'#0a3a14'); gr.addColorStop(1,hurt?'#200':'#031408'); g.fillStyle=gr; g.beginPath(); g.roundRect(fx+4,fy+5.5,20,7,1.5); g.fill();
  const ex=hurt?0:X.lookDir;
  if(hurt){ g.strokeStyle='#fff'; g.lineWidth=.7; for(const ox of [8,19]){ g.beginPath(); g.moveTo(fx+ox-1.4,fy+7.4); g.lineTo(fx+ox+1.4,fy+10.4); g.moveTo(fx+ox+1.4,fy+7.4); g.lineTo(fx+ox-1.4,fy+10.4); g.stroke(); } }
  else { g.save(); g.shadowColor=pw?'#29f0ff':'#bfffff'; g.shadowBlur=3; g.fillStyle=pw?'#29f0ff':'#eaffff'; g.beginPath(); g.roundRect(fx+7+ex,fy+7,4,3,1); g.roundRect(fx+17+ex,fy+7,4,3,1); g.fill(); g.restore(); }
  gr=g.createLinearGradient(0,fy+21,0,fy+27); gr.addColorStop(0,hurt?'#e05a48':'#7ae850'); gr.addColorStop(1,hurt?'#8a2a20':'#2a8a1a'); g.fillStyle=gr; g.beginPath(); g.roundRect(fx+4,fy+22+(pw?2:0),20,4.5,1.5); g.fill();
  if(pw){ g.fillStyle='#300'; g.fillRect(fx+4,fy+20.5,20,2.2); g.fillStyle='#fff'; for(let i=0;i<5;i++){ g.beginPath(); g.moveTo(fx+5+i*4,fy+20.5); g.lineTo(fx+7+i*4,fy+20.5); g.lineTo(fx+6+i*4,fy+22.3); g.fill(); } }
  g.save(); g.shadowColor='#ff4060'; g.shadowBlur=3; g.fillStyle='#ff5a78'; g.beginPath(); g.arc(fx+14,fy+1.2,1.3,0,TAU); g.fill(); g.restore();
}
export function fpsOverlays(){
  if(GS.phase!==3||!GS.G||!X.fb) return;
  drawGun(); const ch=drawSbar()!==false;
  if(ch||++sbN>30){ sbN=0; const sh=sbC.getBoundingClientRect().height; if(sh!==sbH){ sbH=sh; gunC.style.bottom=(sh-2)+'px'; document.body.style.setProperty('--sbh',sh+'px'); } }
}
let sbN=0, sbH=-1;
export function fpsClear(){ gunKey=sbKey=''; sbH=-1; for(const f of X.fb||[]){ f.spr.removeFromParent(); } X.fb=null; }
// ---------- phase object ----------
// a lattice maze with solid outer walls and 4 power cells
function hellMaze(){
  const rows=genLattice(27,27,false,666,.32).map(r=>r.split(''));
  for(const [x,y] of [[5,5],[21,5],[5,21],[21,21]]) rows[y][x]='o';
  rows[13][13]=' ';
  const m=parseMaze(rows.map(r=>r.join('')),false,false);
  for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++) if(x===0||y===0||x===m.W-1||y===m.H-1) m.solid[y*m.W+x]=1;
  return m;
}
// ---------- hell corridor look for buildWorld (see engine/world.js) ----------
const FPS_STYLE={
  name:'fps', wallH:2.8,
  syncEnemies:fpsSyncEnemies, // demons are camera-facing sprites
  bodyMat(){ const dw=doomWallT(); return new THREE.MeshStandardMaterial({color:0xffffff,map:dw.map,bumpMap:dw.bump,bumpScale:2.2,emissive:0xffffff,emissiveMap:dw.em,emissiveIntensity:1.2,roughness:.82,metalness:.12}); },
  wallHeights(W,cells,bodies){ bodies.receiveShadow=true; },
  floor(W){ const m=W.m;
    const df=doomFloorT(); df.map.repeat.set(m.W,m.H); df.bump.repeat.set(m.W,m.H);
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(m.W*S,m.H*S),new THREE.MeshStandardMaterial({color:0xffffff,map:df.map,bumpMap:df.bump,bumpScale:2.5,roughness:.85,metalness:.08}));
    fl.rotation.x=-PI/2; W.g.add(fl);
    const dc=doomCeilT(); for(const t of [dc.map,dc.bump,dc.em]) t.repeat.set(m.W/2,m.H/2);
    const ce=new THREE.Mesh(new THREE.PlaneGeometry(m.W*S,m.H*S),new THREE.MeshStandardMaterial({color:0xffffff,map:dc.map,bumpMap:dc.bump,bumpScale:1.5,emissive:0xffffff,emissiveMap:dc.em,emissiveIntensity:1,roughness:.85}));
    ce.rotation.x=PI/2; ce.position.y=W.wallH; W.g.add(ce);
    return fl; },
  // ammo cells: small glowing gems at hip height
  dots:{geo:dotGeo, mat:()=>new THREE.MeshBasicMaterial({color:new THREE.Color(1.4,1.1,.4),toneMapped:false}),
    place(W,i,k){ const x=i%W.m.W, y=(i/W.m.W)|0; W.map(x,y,.45,_o); basisMat(_m4,_o,.45,.6,.45); W.dotMesh.setMatrixAt(k,_m4); }},
};
const P3={
  name:'HELL MAZE', color:'#ff5a2a', song:'p3', world:FPS_STYLE, cfg:P3F, hearts:4,
  deathText:'Torn apart in the hell maze.',
  ui:{cam:'fps', fps:true, bloom:[.3,.32], sun:0, pix:1.5, msaa:2},
  hint:()=>TOUCH?'HOLD TO WALK · SWIPE ← → TO TURN · SWIPE ↓ TURN AROUND · TAP TO SHOOT':'HOLD ↑ TO WALK · ← → TURN · ↓ TURN AROUND · SPACE SHOOTS',
  buildEnv:buildFpsEnv, setup:fpsSetup, extraTick:fpsTick, clear:fpsClear,
  hooks:()=>({
    hit:e=>{ if(e){ e.dx=-e.dx; e.dy=-e.dy; e.decided=false; } hurtHero('CLAWED'); },
    dot:(i,d)=>{ hideDot3(i); X.ammo=Math.min(99,X.ammo+(d===2?20:1)); if(d===2) hint('CHOMP MODE! RUN THEM DOWN · +20 AMMO',2); },
    eatEnemy:(e,pts)=>{ burstAt(e.x,e.y,1,24,['#ff3a1a','#8a0a00','#ffd04a'],9,.25,.9); pop3(e.x,e.y,String(pts)); X.kills++; },
  }),
  camera(){ cam.k=40; cam.fov=78; cam.yaw=Math.atan2(GS.G.hero.fy,GS.G.hero.fx); },
  start(){
    startMazePhase(P3,hellMaze()); const W3=GS.W3;
    W3.map(GS.G.hero.x,GS.G.hero.y,0,_o); camPose(_v.copy(_o.p).addScaledVector(_o.n,24),_v2.copy(_o.p),_v3.set(0,0,-1)); cam.bl=0; W3.rise=1; layoutWalls(); flash(.9);
    runSeq(2.2,(t)=>{ cam.bl=ease(clamp((t-.2)/1.7,0,1)); },mazeGo(P3));
  },
  tick(dt){ mazePlayTick(P3,dt); },
  deadTick(dt){ mazeTick(dt); },
  sync:mazeSync,
  tap(){ if(GS.mode==='play') fpsFire(); },
  outro(next){
    banner('EXIT','FOUND','#ff5a2a'); SFX.whoosh();
    runSeq(1.6,(t)=>{ camera.fov=78+Math.pow(t/1.6,2)*90; camera.updateProjectionMatrix(); cam.fov=camera.fov; if(t>1.3&&!GS.seq.fl){ GS.seq.fl=1; flash(1); } },next);
  },
  hud(){ fpsOverlays(); return {}; },
  mini:{cs:5, scale:[.75,1.5], wall:'#7a5a3a', bg:'rgba(16,8,4,.85)', dot:'#ffd080', pow:'#29f0ff', enemy:()=>'#ff3a1a'},
  miniExtras(g,cs){ if(X.fb){ g.fillStyle='#ff7a20'; for(const f of X.fb) g.fillRect(f.x*cs+1,f.y*cs+1,cs-2,cs-2); } },
};
export default P3;
