import {GS} from '../core/state.js';
import {TOUCH} from '../core/utils.js';
import {SUN, setPix, setSamples, sunSetup} from './renderer.js';
// auto quality: if a 3D phase runs under ~48 fps, step down one level at a time
//   1: a bit less resolution + 2x MSAA   2: 1x resolution, no MSAA
//   3: no shadows                        4: below 1x resolution
// a phase can ask for less from the start with ui.pix (max pixel ratio) and ui.msaa (samples)
export const QA={n:0,acc:0,lvl:0,off:false};
const ui=()=>(GS.P&&GS.P.ui)||{};
export function qaPix(){ const b=Math.min(devicePixelRatio||1,TOUCH?1.5:1.75,ui().pix||9);
  return QA.lvl>=4?.85:QA.lvl>=2?Math.min(b,1):QA.lvl===1?Math.max(1,b*.8):b; }
export function qaSamples(){ const b=Math.min(TOUCH?2:4,ui().msaa??9); return QA.lvl>=2?0:QA.lvl===1?Math.min(b,2):b; }
export function qaApply(){ setPix(qaPix()); setSamples(qaSamples()); }
export function autoQuality(dt){
  if(QA.off||!GS.is3||GS.mode!=='play'||QA.lvl>=4) { QA.n=QA.acc=0; return; }
  QA.acc+=dt; QA.n++; if(QA.n<90) return;
  const avg=QA.acc/QA.n; QA.n=QA.acc=0;
  if(avg>1/48){ QA.lvl++; if(QA.lvl===3) sunSetup(false,SUN.ext); else qaApply(); }
}
