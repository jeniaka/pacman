import {GS} from '../core/state.js';
import {$, PI, TAU, TOUCH, clamp, irand, pad, rand} from '../core/utils.js';
import {SFX, setSong} from '../core/audio.js';
import {DOOR, MAZE1, WALL, cellAt, isEdgeWall, parseMaze, wdx, wdy} from '../core/maze.js';
import {EN_COL, EN_NAME, mazeTick, newMazeGame, spawnEnemy} from '../core/maze-game.js';
import {startPhase} from '../main.js';
// ================= PHASE 1: 1980 (2D canvas) =================
export const c2=$('c2'), x2=c2.getContext('2d');
const LW=224, LH=288, OY=24;
const LC=document.createElement('canvas'); LC.width=LW; LC.height=LH; const lx=LC.getContext('2d');
let wallCv=null, wallCvHot=null;
export const P1={st:'title',t:0,lives:3,glitch:0,pops:[],dieT:0,overT:0,first:true,stT:0};
const WALLC='#ff3ea5', DOTC='#a8f4ff';
function buildWallCanvas(m,col,glow){
  const cv=document.createElement('canvas'); cv.width=LW; cv.height=m.H*8; const g=cv.getContext('2d');
  const ew=(x,y)=>x>=0&&y>=0&&x<m.W&&y<m.H&&isEdgeWall(m,x,y)&&cellAt(m,x,y)===WALL;
  const nw=(x,y)=>{ if(y<0||y>=m.H) return false; return cellAt(m,x,y)!==WALL; };
  const path=()=>{
    g.beginPath();
    for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++){
      if(!ew(x,y)) continue; const cx=x*8+4, cy=y*8+4; let any=false;
      if(ew(x+1,y)&&(nw(x,y-1)||nw(x+1,y-1)||nw(x,y+1)||nw(x+1,y+1))){ g.moveTo(cx,cy); g.lineTo(cx+8,cy); any=true; }
      if(ew(x,y+1)&&(nw(x-1,y)||nw(x-1,y+1)||nw(x+1,y)||nw(x+1,y+1))){ g.moveTo(cx,cy); g.lineTo(cx,cy+8); any=true; }
      if(!any&&!ew(x-1,y)&&!ew(x,y-1)){ g.moveTo(cx-1,cy); g.lineTo(cx+1,cy); }
    }
  };
  g.lineCap='round'; g.lineJoin='round';
  g.shadowColor=glow; g.shadowBlur=5; g.strokeStyle=col; g.lineWidth=2; path(); g.stroke();
  g.shadowBlur=0; g.strokeStyle='rgba(255,255,255,.35)'; g.lineWidth=.6; path(); g.stroke();
  // pen door
  g.fillStyle='#ffd1ea';
  for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++) if(cellAt(m,x,y)===DOOR) g.fillRect(x*8,y*8+3,8,2);
  return cv;
}
function drawBot(g,px,py,fx,fy,mouth,col,a=1){
  px=Math.round(px); py=Math.round(py);
  const o=Math.round(Math.abs(Math.sin(mouth))*3);
  g.globalAlpha=a;
  g.fillStyle=col;
  g.fillRect(px,py-10,1,3);
  g.fillStyle=(performance.now()/250|0)%2?'#ff4060':'#ffd0d8'; g.fillRect(px-1,py-11,3,2);
  g.fillStyle=col; g.fillRect(px-5,py-7,11,8); g.fillRect(px-6,py-6,13,6);
  g.fillStyle='#08240e'; g.fillRect(px-5,py-5,11,4);
  const ex=fx, ey=fy<0?-1:fy>0?1:0;
  g.fillStyle='#eaffff'; g.fillRect(px-4+ex,py-4+ey*.5|0,3,2); g.fillRect(px+1+ex,py-4+ey*.5|0,3,2);
  if(o>0){ g.fillStyle='#2a0010'; g.fillRect(px-5,py+1,11,o); }
  g.fillStyle=col; g.fillRect(px-5,py+1+o,11,3); g.fillRect(px-4,py+4+o,9,1);
  if(o>0){ g.fillStyle='#fff'; for(let i=-4;i<=4;i+=3) g.fillRect(px+i,py+1+o-1,1,1); }
  g.globalAlpha=1;
}
function drawVirus(g,px,py,col,spin,lx_,ly_,fr,eyeOnly,flash){
  px=Math.round(px)+.5; py=Math.round(py)+.5;
  if(!eyeOnly){
    const c=fr?(flash?'#e8f6ff':'#2a7a86'):col;
    g.strokeStyle=c; g.fillStyle=c; g.lineWidth=1.6;
    g.beginPath();
    for(let k=0;k<8;k++){ const a=spin+k*PI/4, r2=(k%2?7:8); g.moveTo(px+Math.cos(a)*4,py+Math.sin(a)*4); g.lineTo(px+Math.cos(a)*r2,py+Math.sin(a)*r2); }
    g.stroke();
    for(let k=0;k<8;k+=2){ const a=spin+k*PI/4; g.fillRect(Math.round(px+Math.cos(a)*8)-1,Math.round(py+Math.sin(a)*8)-1,2,2); }
    g.beginPath(); g.arc(px,py,5,0,TAU); g.fill();
  }
  g.fillStyle='#fff'; g.beginPath(); g.arc(px,py-.5,2.7,0,TAU); g.fill();
  if(fr&&!eyeOnly){ g.fillStyle='#ff6fa0'; g.fillRect(px-2,py-1,4,1); }
  else { g.fillStyle='#111'; g.beginPath(); g.arc(px+lx_*1.3,py-.5+ly_*1.3,1.3,0,TAU); g.fill(); }
}
function txt(s,x,y,col,size=8,align='left'){ lx.font=size+'px "Press Start 2P"'; lx.textAlign=align; lx.textBaseline='top'; lx.fillStyle=col; lx.fillText(s,x,y); }
function p1Pop(x,y,s,col='#7dfcff'){ P1.pops.push({x,y,s,col,t:1}); }
export function drawP1(dt){
  const g=lx, t=performance.now()/1000;
  g.fillStyle='#000'; g.fillRect(0,0,LW,LH);
  if(P1.st==='title'){ drawTitle(t); return; }
  const m=GS.G.m;
  txt('1UP',24,1,(t*3|0)%2?'#fff':'#666'); txt(pad(GS.score),8,10,'#fff');
  txt('HIGH SCORE',72,1,'#fff'); txt(pad(GS.HI),88,10,'#fff');
  // phase timer bar
  const pt=clamp(GS.G.t/20,0,1);
  g.fillStyle='#222'; g.fillRect(176,12,40,4);
  g.fillStyle=pt>.75&&(t*6|0)%2?'#ff3355':'#7dfcff'; g.fillRect(176,12,40*pt,4);
  txt('1980',176,1,'#888');
  const hot=GS.G.over&&(t*8|0)%2;
  g.drawImage(hot?wallCvHot:wallCv,0,OY);
  // dots
  for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++){
    const d=m.dot[y*m.W+x]; if(!d) continue;
    if(d===1){ g.fillStyle=DOTC; g.fillRect(x*8+3,y*8+3+OY,2,2); }
    else if((t*4|0)%2||P1.st!=='play'){ g.fillStyle='#7dfcff'; g.beginPath(); g.moveTo(x*8+4,y*8+OY);g.lineTo(x*8+8,y*8+4+OY);g.lineTo(x*8+4,y*8+8+OY);g.lineTo(x*8,y*8+4+OY);g.fill(); }
  }
  // enemies
  const h=GS.G.hero;
  if(P1.st!=='over'&&P1.st!=='kid'&&!(P1.st==='dying'&&P1.dieT>.4)){
    for(const e of GS.G.en){
      if(e.st==='dead') continue;
      let px=e.x*8+4, py=e.y*8+4+OY;
      if(e.st==='pen') py+=Math.sin(e.bob)*1.5;
      const ldx=Math.sign(wdx(m,e.x,h.x)), ldy=Math.sign(wdy(m,e.y,h.y));
      const flash=e.fr&&GS.G.fright<2&&(t*8|0)%2;
      drawVirus(g,px,py,GS.G.over?'#ff2a2a':e.col,e.spin,e.dx||ldx,e.dy||ldy,e.fr,e.st==='eaten',flash);
      if(e.x<.5&&m.wrapX) drawVirus(g,px+LW,py,e.col,e.spin,0,0,e.fr,e.st==='eaten',flash);
    }
  }
  // hero
  if(P1.st==='dying'){
    const k=P1.dieT, px=Math.round(h.x*8+4), py=Math.round(h.y*8+4+OY);
    if(k<1.3){
      g.save(); g.translate(px,py-k*10); g.rotate(k*3); g.fillStyle='#7dff4a'; g.fillRect(-6,-5,13,7); g.fillStyle='#eaffff'; g.fillRect(-4,-3,3,2); g.fillRect(1,-3,3,2); g.restore();
      g.fillStyle='#7dff4a'; g.fillRect(px-5-k*6,py+2+k*14,11,3);
      for(let i=0;i<10;i++){ const a=i*.63+k, r=k*30; g.fillStyle=i%2?'#ff4060':'#7dff4a'; g.fillRect(px+Math.cos(a)*r,py+Math.sin(a)*r,2,2); }
    }
  } else if(P1.st!=='over'&&P1.st!=='kid'){
    const blink=GS.G.inv>0&&(t*12|0)%2;
    if(!blink) drawBot(g,h.x*8+4,h.y*8+4+OY,h.fx,h.fy,h.mouth,'#7dff4a');
  }
  // pops
  for(const p of P1.pops){ p.t-=dt; txt(p.s,p.x,p.y-(1-p.t)*6,p.col,8,'center'); }
  P1.pops=P1.pops.filter(p=>p.t>0);
  // lives
  for(let i=0;i<P1.lives-(P1.st==='play'||P1.st==='dying'?1:0);i++) drawBot(g,16+i*16,LH-8,1,0,0,'#7dff4a');
  txt('◆',196,LH-12,'#7dfcff');
  // texts
  const cy=17*8+OY+1;
  if(P1.st==='ready'){ g.fillStyle='#000'; g.fillRect(84,cy-1,56,9); txt('READY!',112,cy,'#7dff4a',8,'center'); }
  if(GS.G.over&&P1.st==='play'){
    if((t*5|0)%2){ g.fillStyle='#000'; g.fillRect(64,cy-1,96,9); txt('OVERCLOCK!!',112,cy,'#ff3355',8,'center'); }
    g.fillStyle='#000'; g.fillRect(72,10*8+OY,80,9); txt('NO ESCAPE',112,10*8+OY+1,(t*8|0)%2?'#fff':'#ff3355',8,'center');
  }
  if(P1.st==='over'||P1.st==='kid'){
    g.fillStyle='#000'; g.fillRect(56,cy-1,112,9);
    if(P1.st==='over') txt('GAME  OVER',112,cy,'#ff3355',8,'center');
    else txt((t*10|0)%2?'JUST KIDDING':'JUST K1DD1NG',112,cy,'#7dfcff',8,'center');
  }
}
function drawTitle(t){
  const g=lx;
  txt('1UP',24,1,'#fff'); txt('HIGH SCORE',72,1,'#fff'); txt(pad(GS.HI),88,10,'#fff'); txt(pad(GS.score),8,10,'#fff');
  g.save(); g.shadowColor='#ff3ea5'; g.shadowBlur=6; txt('MUNCHBOT',112,40,'#ff3ea5',16,'center'); g.restore();
  txt("'80",112,62,'#7dfcff',8,'center');
  drawBot(g,112,96,Math.sin(t*2)>0?1:-1,0,t*8,'#7dff4a');
  txt('- THE GLITCHES -',112,118,'#fff',8,'center');
  const D=['THE CHASER','THE AMBUSHER','THE FLANKER','THE DRIFTER'];
  for(let k=0;k<4;k++){
    const y=136+k*18, show=((t-.5)*2)>k;
    if(!show) continue;
    drawVirus(g,40,y+3,EN_COL[k],t*3+k,1,0,false,false,false);
    txt(EN_NAME[k],58,y,EN_COL[k]); txt(D[k],58,y+9,'#888',8);
  }
  g.fillStyle=DOTC; g.fillRect(70,214,2,2); txt('10 PTS',84,211,'#fff');
  g.fillStyle='#7dfcff'; g.beginPath(); g.moveTo(71,224);g.lineTo(75,228);g.lineTo(71,232);g.lineTo(67,228);g.fill(); txt('50 PTS',84,225,'#fff');
  if((t*2|0)%2) txt(TOUCH?'TAP TO START':'PRESS SPACE',112,248,'#ffd04a',8,'center');
  txt(TOUCH?'SWIPE TO STEER':'ARROWS / WASD',112,262,'#666',8,'center');
  txt('© 1980 MUNCHWARE',112,276,'#ff3ea5',8,'center');
}
export function blit2D(){
  const dpr=Math.min(devicePixelRatio||1,2), W=innerWidth, H=innerHeight;
  if(c2.width!==Math.round(W*dpr)||c2.height!==Math.round(H*dpr)){ c2.width=Math.round(W*dpr); c2.height=Math.round(H*dpr); }
  const s=Math.min(c2.width/LW,c2.height/LH)*.98, dw=LW*s, dh=LH*s, ox=(c2.width-dw)/2, oy=(c2.height-dh)/2;
  x2.imageSmoothingEnabled=false; x2.fillStyle='#000'; x2.fillRect(0,0,c2.width,c2.height);
  x2.drawImage(LC,ox,oy,dw,dh);
  const gl=P1.glitch;
  if(gl>0){
    const n=Math.floor(gl*10);
    for(let i=0;i<n;i++){ if(Math.random()>gl) continue; const sy=Math.random()*LH, sh=rand(2,14), off=rand(-14,14)*gl;
      x2.drawImage(LC,0,sy,LW,sh,ox+off*s,oy+sy*s,dw,sh*s); }
    if(Math.random()<gl*.4){ x2.globalCompositeOperation='lighter'; x2.globalAlpha=.35*gl; x2.drawImage(LC,ox+rand(-3,3)*s,oy,dw,dh); x2.globalAlpha=1; x2.globalCompositeOperation='source-over'; }
    if(Math.random()<gl*.15){ x2.fillStyle=`rgba(${irand(0,255)},${irand(0,80)},${irand(100,255)},.25)`; x2.fillRect(ox,oy+rand(0,dh),dw,rand(4,40)*s); }
  }
}
// ----- phase 1 flow -----
export const M1CFG={hero:[13,16],spawns:[[13,10],[11,13],[13,13],[15,13],[12,13],[14,13],[11,12],[16,13]],exit:[13,10],enemies:4,release:[0,1.5,4,7],startOut:true,
  heroSpd:7.6,enSpd:7.1,fright:5,corners:[[25,-3],[2,-3],[27,31],[0,31]],dur:20};
export function p1Setup(){
  const m=parseMaze(MAZE1,true,false);
  newMazeGame(m,M1CFG);
  wallCv=buildWallCanvas(m,WALLC,'#ff3ea5'); wallCvHot=buildWallCanvas(m,'#ff2a2a','#ff0000');
  P1.lives=3; P1.pops=[]; P1.glitch=0;
  GS.hooks={hit:p1Hit,eatEnemy:(e,pts)=>p1Pop(e.x*8+4,e.y*8+OY,String(pts))};
}
function p1ResetActors(){
  const keep=GS.G.m, t=GS.G.t, dots=GS.G.dots, eaten=GS.G.eaten, total=GS.G.total, gI=GS.G.gIdx, gT=GS.G.gT, gm=GS.G.gmode;
  newMazeGame(keep,M1CFG); GS.G.t=t; GS.G.dots=dots; GS.G.eaten=eaten; GS.G.total=total;
}
export function p1Start(){
  p1Setup(); P1.st='ready'; P1.stT=P1.first?2.2:1.6; GS.G.frozen=0;
  if(P1.first) SFX.ready(); P1.first=false;
  setSong(null);
}
function p1Hit(){
  P1.st='dying'; P1.dieT=0; GS.G.hero.alive=false; SFX.die(); setSong(null);
}
export function p1Tick(dt){
  if(P1.st==='title'){ return; }
  if(P1.st==='ready'){ P1.stT-=dt; if(P1.stT<=0){ P1.st='play'; setSong('p1'); } return; }
  if(P1.st==='play'){
    mazeTick(dt);
    if(GS.G.t>13) P1.glitch=Math.min(1,(GS.G.t-13)/9)*(.35+.65*Math.random()*(Math.random()<.2?1:.2));
    if(GS.G.t>13&&Math.random()<dt*3) SFX.glitch();
    if(GS.G.t>=20&&!GS.G.over) p1Overclock();
    if(GS.G.over){ P1.overT+=dt; if(P1.overT>7&&GS.G.hero.alive) p1Hit(); }
    if(GS.G.dots<=0&&!GS.G.over) p1Overclock();
    return;
  }
  if(P1.st==='dying'){
    P1.dieT+=dt;
    if(P1.dieT>1.6){
      P1.lives--;
      if(GS.G.over||P1.lives<=0){ P1.st='over'; P1.stT=1.5; SFX.boom(); }
      else { p1ResetActors(); P1.st='ready'; P1.stT=1.4; }
    }
    return;
  }
  if(P1.st==='over'){ P1.glitch=.1; P1.stT-=dt; if(P1.stT<=0){ P1.st='kid'; P1.stT=1.6; SFX.coin(); } return; }
  if(P1.st==='kid'){ P1.stT-=dt; P1.glitch=Math.min(1,P1.glitch+dt*.9); if(Math.random()<dt*8) SFX.glitch(); if(P1.stT<=0){ P1.st='done'; startPhase(2,{fromP1:true}); } return; }
}
function p1Overclock(){
  GS.G.over=true; P1.overT=0; GS.G.fright=0; for(const e of GS.G.en){ e.fr=false; if(e.st==='pen'){ e.relT=0; } }
  for(let k=4;k<8;k++){ const e=spawnEnemy(k,.2*(k-3)); e.col='#ff2a2a'; }
  SFX.alarm(); setSong(null);
  for(const e of GS.G.en) if(e.st==='run'){ e.dx=-e.dx; e.dy=-e.dy; }
}
// ---------- phase object ----------
// the original 2D arcade screen. It hands over to phase 2 by itself after the OVERCLOCK.
export default {
  name:'1980', color:'#29f0ff', is2D:true,
  start(opt){ if(opt.title){ P1.st='title'; } else { P1.first=true; p1Start(); } },
  frame(dt){ p1Tick(dt); drawP1(dt); blit2D(); },
};
