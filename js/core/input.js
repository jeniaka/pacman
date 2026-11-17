import {GS} from './state.js';
import {initAudio} from './audio.js';
// ================= INPUT =================
export const keys={};
export const inp={dx:0,dy:0,has:false};
GS.onAnyKey=null;
const DIRK={ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0],ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1]};
addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
  if(DIRK[e.code]){ inp.dx=DIRK[e.code][0]; inp.dy=DIRK[e.code][1]; inp.has=true; }
  if(!keys[e.code]){ keys[e.code]=true; if(GS.onAnyKey) GS.onAnyKey(e); }
});
addEventListener('keyup',e=>{keys[e.code]=false});
addEventListener('blur',()=>{for(const k in keys) keys[k]=false;});
export const ptr={down:false,id:null,lx:0,ly:0,ax:0,ay:0};
addEventListener('pointerdown',e=>{
  if(e.target.closest('button')) return;
  initAudio();
  ptr.down=true; ptr.id=e.pointerId; ptr.lx=e.clientX; ptr.ly=e.clientY; ptr.ax=0; ptr.ay=0; ptr.moved=false; ptr.downT=performance.now();
  if(GS.onAnyKey) GS.onAnyKey({code:'Pointer',pointer:true});
},{passive:true});
addEventListener('pointermove',e=>{
  if(!ptr.down||e.pointerId!==ptr.id) return;
  ptr.ax+=e.clientX-ptr.lx; ptr.ay+=e.clientY-ptr.ly; ptr.lx=e.clientX; ptr.ly=e.clientY;
  const th=20;
  if(Math.abs(ptr.ax)>th||Math.abs(ptr.ay)>th){
    if(Math.abs(ptr.ax)>Math.abs(ptr.ay)){ inp.dx=Math.sign(ptr.ax); inp.dy=0; } else { inp.dx=0; inp.dy=Math.sign(ptr.ay); }
    inp.has=true; ptr.ax=0; ptr.ay=0; ptr.moved=true;
  }
},{passive:true});
GS.onTap=null;
const ptrUp=e=>{ if(e.pointerId===ptr.id){ptr.down=false;ptr.id=null; if(!ptr.moved&&e.type==='pointerup'&&performance.now()-ptr.downT<230&&GS.onTap&&!(e.target.closest&&e.target.closest('button'))) GS.onTap();} };
addEventListener('pointerup',ptrUp); addEventListener('pointercancel',ptrUp);
