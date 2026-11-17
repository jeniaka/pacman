import {GS} from '../core/state.js';
import {$, clamp, pad} from '../core/utils.js';
import {initAudio} from '../core/audio.js';
import {drawMini, miniC} from './minimap.js';
export function setGlow(c){ document.body.style.setProperty('--glow',c); }
export function banner(k,t,c){ const b=$('banner'); $('bk').textContent=k; $('bt').textContent=t; b.style.setProperty('--c',c||'#29f0ff'); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
let hintTO=0;
export function hint(s,d=2.5){ const h=$('hint'); h.textContent=s; h.classList.add('on'); clearTimeout(hintTO); hintTO=setTimeout(()=>h.classList.remove('on'),d*1000); }
export function flash(a=.6,col='#fff'){ const f=$('flash'); f.style.transition='none'; f.style.background=col; f.style.opacity=a; void f.offsetWidth; f.style.transition='opacity .5s'; f.style.opacity=0; }
export function showPanel(o){
  $('pk').textContent=o.k||''; $('pt').textContent=o.t||''; $('ps').textContent=o.s||'';
  $('pstats').innerHTML=(o.stats||[]).map(([a,b])=>`<div>${a}<b>${b}</b></div>`).join('');
  $('b1').textContent=o.b1[0]; $('b1').onclick=()=>{ initAudio(); o.b1[1](); };
  $('b2').textContent=o.b2[0]; $('b2').onclick=()=>{ initAudio(); o.b2[1](); };
  $('panel').classList.add('on'); GS.mode='panel';
}
export function hidePanel(){ $('panel').classList.remove('on'); }
export function updHearts(){ const n=Math.max(0,GS.G?GS.G.hearts:0); $('hearts').textContent='♥'.repeat(n)+'♡'.repeat(Math.max(0,3-n)); }
// per frame HUD. The phase can return {progress:0..1, left:'TEXT'} from phase.hud() (and update its own widgets there).
export function hud(){
  if(!GS.is3||!GS.G){ miniC.style.display='none'; document.body.classList.remove('mini'); $('left').style.display='none'; return; }
  const P=GS.P, info=(P.hud&&P.hud())||{};
  $('scTxt').textContent=pad(GS.score); $('hiTxt').textContent='HI '+pad(GS.HI);
  $('phName').textContent='PHASE '+GS.phase+' · '+P.name;
  $('phBar').style.width=clamp((info.progress??(1-GS.G.small/GS.G.smallTotal))*100,0,100)+'%';
  const pw=$('power');
  let name='',k=0;
  if(GS.G.ramp>0){ name='RAMPAGE'; k=GS.G.ramp/GS.G.cfg.fright; }
  else if(GS.G.fright>0){ name=P.powerName||'POWER'; k=GS.G.fright/GS.G.frightMax; }
  else if(GS.G.turbo>0){ name='TURBO'; k=GS.G.turbo/3; }
  pw.style.opacity=name?1:0; if(name){ $('powName').textContent=name; $('powBar').style.width=(k*100)+'%'; }
  const lf=$('left'), showL=!!info.left&&(GS.mode==='play'||GS.mode==='seq');
  lf.style.display=showL?'block':'none';
  if(showL&&lf._t!==info.left){ lf._t=info.left; lf.textContent=info.left; }
  drawMini();
}
