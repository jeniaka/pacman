import * as THREE from 'three';
import {GS} from './core/state.js';
import {$, TOUCH, clamp, pad, pick, rand} from './core/utils.js';
import {inp} from './core/input.js';
import {SFX, initAudio, music, musicTick, setMute, setSong} from './core/audio.js';
import {P1, c2, p1Setup, p1Start} from './phases/p1-1980.js';
import {_o, _v, _v2, _v3, bloom, c3, camera, composer, composerRT, renderer, scene, setPix, sun, sunFollow, sunSetup} from './engine/renderer.js';
import {clearWorld} from './engine/world.js';
import {burst, clearDebris, clearMarkers, updDebris, updMarkers} from './engine/fx.js';
import {_cL, cam, camPose, camUpdate, render3} from './engine/camera.js';
import {A3, burstAt} from './engine/actors.js';
import {X} from './phases/extras.js';
import {PL} from './phases/p4-block-world.js';
import {GR} from './phases/p5-land-grab.js';
import {miniC} from './ui/minimap.js';
import {banner, flash, hidePanel, hint, hud, setGlow, showPanel, updHearts} from './ui/hud.js';
import {QA, autoQuality, qaApply} from './engine/quality.js';
import {phases} from './phases/index.js';
// ================= MAIN: game flow, shared by every phase =================
// GS.P is the current phase object (see js/phases/README.md). Phases never call each other:
// they call endPhase() when they are won and the flow moves on to the next phase in the list.
let timeScale=1, deadT=0, deadWhy='', phaseScore=0, vicT=0, startedAt=performance.now(); GS.mode='p1'; GS.phase=1; GS.P=null; GS.is3=false; GS.seq=null;
// a timed sequence (intro / outro camera moves). upd(t) every frame, done() at the end; block=true pauses the phase tick
export function runSeq(dur,upd,done,block=true){ GS.seq={t:0,dur,upd,done,block}; }
function to2D(){ GS.is3=false; document.body.classList.remove('d3'); c2.style.transition='none'; c2.style.opacity=1; c3.style.transition='none'; c3.style.opacity=0; clearMarkers(); clearDebris(); clearWorld(); }
function to3D(){ if(!GS.is3){ c3.style.transition='opacity .35s'; c3.style.opacity=1; c2.style.transition='opacity .35s'; c2.style.opacity=0; } GS.is3=true; document.body.classList.add('d3'); }
export function hurtHero(why){
  if(!GS.G||!GS.G.hero.alive||GS.G.inv>0||GS.GOD) return;
  if(GS.mode!=='play') return;
  GS.G.hearts--; GS.G.inv=1.8; SFX.hurt(); cam.shake=Math.max(cam.shake,.8); flash(.35,'#ff2040'); updHearts();
  burstAt(GS.G.hero.x,GS.G.hero.y,1,30,['#7dff4a','#ffffff','#ff4060'],8,.22,.8);
  if(GS.G.hearts<=0) die3(why);
  else hint(why+' · '+GS.G.hearts+(GS.G.hearts===1?' HEART LEFT':' HEARTS LEFT'),1.6);
}
function die3(why){
  GS.mode='dead'; deadT=0; deadWhy=why; GS.G.hero.alive=false; timeScale=.35; setSong(null); SFX.boom(true); SFX.die();
  burstAt(GS.G.hero.x,GS.G.hero.y,1,140,['#7dff4a','#3aff10','#ffffff','#08240e','#ff4060'],13,.35,1.6,9); cam.shake=1;
}
function deathPanel(){
  timeScale=1; const P=GS.P;
  showPanel({k:'PHASE '+GS.phase+' · '+P.name,t:P.deathTitle||'CRASHED',s:(deadWhy?deadWhy+'. ':'')+(P.deathText||''),stats:[['SCORE',pad(GS.score)],['HI',pad(GS.HI)]],
    b1:['RETRY PHASE '+GS.phase,()=>{ GS.score=phaseScore; startPhase(GS.phase); }],
    b2:['FROM 1980',()=>{ GS.score=0; GS.loop=0; GS.speedMul=1; music.rate=1; startPhase(1,{title:false}); }]});
}
// screen furniture driven by the phase's ui block
function setPhaseUI(P){
  const u=P.ui||{};
  document.body.classList.toggle('fps',!!u.fps); document.body.classList.toggle('pix',!!u.pad);
  $('pad').style.display=(u.pad&&TOUCH)?'flex':'none';
  for(const id of ['gun','sbar','xhair']) $(id).style.display=u.fps?'block':'none';
  qaApply(); const [bs,bt]=u.bloom||[.42,.32]; bloom.strength=bs; bloom.threshold=bt;
  sunSetup(!!u.sun&&QA.lvl<3,u.sun||26);
  $('wanted').style.display=u.wanted?'block':'none'; $('mission').style.display='none'; $('siren').style.opacity=0;
  cam.mode=u.cam||'follow'; cam.lax=cam.lay=0;
  GS.miniLayer=null;
}
export function startPhase(n,opt={}){
  const P=phases()[n-1]; if(!P) return;
  if(GS.P&&GS.P.clear) GS.P.clear();
  GS.phase=n; GS.P=P; hidePanel(); setPhaseUI(P); $('hint').classList.remove('on'); GS.seq=null; timeScale=1; $('warn').style.display='none';
  if(P.is2D){ to2D(); GS.mode='p1'; miniC.style.display='none'; $('left').style.display='none'; setGlow(P.color); setSong(null); P.start(opt); return; }
  phaseScore=GS.score;
  clearMarkers(); clearDebris();
  to3D(); GS.heroScale=1; GS.heroLift=0; cam.shake=0; inp.has=false; GS.hooks={};
  P.start(opt);
}
// the current phase is won: its outro plays, then the next phase in the list starts (or the victory lap after the last one)
export function endPhase(){
  const n=GS.phase, P=GS.P, nextP=phases()[n]; GS.mode='seq'; setSong(null);
  for(const e of GS.G.en) if(e.st!=='dead'){ burstAt(e.x,e.y,1,18,[e.col,'#fff'],8,.25,.9); e.st='dead'; e.dead=99; }
  const next=nextP?()=>startPhase(n+1):startVictory;
  if(P.outro) P.outro(next,nextP); else next();
}
export function startVictory(){
  GS.mode='victory'; vicT=0; GS.G.inv=0; SFX.win(); setSong('calm'); banner('VICTORY','SYSTEM RESTORED','#7dff4a');
  cam.bl=0; GS.G.hero.alive=true;
}
function victoryTick(dt){
  vicT+=dt; const h=GS.G.hero;
  GS.heroLift=Math.abs(Math.sin(vicT*4))*2.2; h.mouth+=dt*10; h.dx=0; h.dy=1;
  A3.hero.userData.fx=Math.sin(vicT*2); A3.hero.userData.fy=Math.cos(vicT*2);
  GS.W3.map(h.x,h.y,0,_o);
  const a=vicT*.5; camPose(_v.copy(_o.p).add(_v2.set(Math.sin(a)*11,6+Math.sin(vicT*.7)*1.5,Math.cos(a)*11)),_v3.copy(_o.p).add(_v2.set(0,2,0)),_v2.set(0,1,0));
  if(Math.random()<dt*4){ const p=new THREE.Vector3(rand(-22,22),rand(14,26),rand(-18,10)); burst(p,70,pick([['#ff3ea5','#fff'],['#29f0ff','#fff'],['#ffd04a','#ff8a2a'],['#7dff4a','#fff'],['#a66bff','#fff']]),14,.28,1.6,_v.set(0,-.25,0).clone(),null,0); SFX.boom(); }
  if(vicT>5.5&&GS.mode==='victory') victoryPanel();
}
function victoryPanel(){
  const secs=Math.round((performance.now()-startedAt)/1000);
  showPanel({k:'LOOP '+(GS.loop+1)+' COMPLETE',t:'YOU WIN',s:'The grid is yours and the glitches are gone. Want it faster?',stats:[['SCORE',pad(GS.score)],['HI',pad(GS.HI)],['TIME',Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0')]],
    b1:['LOOP ×'+(GS.loop+2),()=>{ GS.loop++; GS.speedMul=Math.pow(1.25,GS.loop); music.rate=1+.08*GS.loop; startedAt=performance.now(); startPhase(1,{title:false}); }],
    b2:['FROM 1980',()=>{ GS.score=0; GS.loop=0; GS.speedMul=1; music.rate=1; startedAt=performance.now(); startPhase(1,{title:true}); }]});
}
function tick3(dt){
  const P=GS.P, sdt=dt*timeScale;
  if(GS.seq){ GS.seq.t+=dt; GS.seq.upd(GS.seq.t,clamp(GS.seq.t/GS.seq.dur,0,1),dt); if(GS.seq&&GS.seq.t>=GS.seq.dur){ const d=GS.seq.done; GS.seq=null; if(d) d(); if(!GS.is3) return; } }
  const blocked=GS.seq&&GS.seq.block;
  if(!blocked){
    if(GS.mode==='play') P.tick(sdt);
    else if(GS.mode==='dead'){ deadT+=dt; if(P.deadTick) P.deadTick(sdt); if(deadT>1.5) deathPanel(); }
    else if(GS.mode==='victory') victoryTick(dt);
  }
  if(GS.W3&&GS.G){
    GS.P.sync(sdt); updMarkers(sdt); updDebris(sdt);
    const [cx,cy]=GS.mode!=='victory'&&GS.P.camTarget?GS.P.camTarget():[GS.G.hero.x,GS.G.hero.y];
    camUpdate(dt,cx,cy,false);
    sunFollow(GS.P.sunTarget?GS.P.sunTarget():_cL);
  }
}
let last=performance.now(), DTCAP=.05, FRAMES=0;
function frame(nw){
  requestAnimationFrame(frame);
  const dt=Math.min(DTCAP,(nw-last)/1000); last=nw; FRAMES++;
  musicTick();
  try{
    if(!GS.is3) GS.P.frame(dt);
    else { tick3(dt); render3(); autoQuality(Math.min(.05,dt)); }
    hud();
  }catch(err){ console.error(err); }
}
// ---------- keys ----------
let typed='', tapN=0, tapT=0;
function jumpTo(n){ initAudio(); if(n<1||n>phases().length) return; startPhase(n,{skip:true}); }
GS.onAnyKey=e=>{
  initAudio();
  if(e.code==='KeyM'){ setMute(!GS.muted); return; }
  // secret level select: type the phase number three times (222, 333, ...)
  if(/^(Digit|Numpad)[0-9]$/.test(e.code)){ typed=(typed+e.code.slice(-1)).slice(-3); if(/^([1-9])\1\1$/.test(typed)){ const n=+typed[0]; typed=''; jumpTo(n); return; } }
  if(GS.mode==='panel'&&(e.code==='Space'||e.code==='Enter')){ $('b1').click(); return; }
  if(GS.mode==='victory'&&(e.code==='Space'||e.pointer)&&vicT>1){ victoryPanel(); return; }
  if(!GS.is3&&P1.st==='title'&&(e.code==='Space'||e.code==='Enter'||e.pointer)){ GS.score=0; startedAt=performance.now(); p1Start(); }
};
GS.onTap=()=>{ if(GS.is3&&GS.P&&GS.P.tap) GS.P.tap(); };
// phone: tap the score 3 times quickly to skip to the next phase
$('score').addEventListener('pointerdown',e=>{ const n=performance.now(); if(n-tapT>700) tapN=0; tapN++; tapT=n; if(tapN>=3){ tapN=0; jumpTo(Math.min(phases().length,GS.phase+1)); } });
// debug / test handle
window.__game={get mode(){return GS.mode},get phase(){return GS.phase},get G(){return GS.G},GR,P1,X,jumpTo,startPhase,get score(){return GS.score},set god(v){GS.GOD=v},get god(){return GS.GOD},endPhase,cam,get W3(){return GS.W3},A3,PL,hurtHero,get seq(){return GS.seq},set dtcap(v){DTCAP=v},get frames(){return FRAMES},renderer,composer,composerRT,sun,scene,camera,QA,phases};
// ---------- boot ----------
GS.P=phases()[0]; p1Setup(); P1.st='title';
requestAnimationFrame(frame);
