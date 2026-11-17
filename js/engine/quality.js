import {GS} from '../core/state.js';
import {TOUCH} from '../core/utils.js';
import {SUN, setPix, sunSetup} from './renderer.js';
// auto quality: if a 3D phase runs under ~40 fps, step down resolution, then shadows
export const QA={n:0,acc:0,lvl:0,off:false};
export function qaPix(){ const b=Math.min(devicePixelRatio||1,TOUCH?1.5:1.75); return QA.lvl>=2?Math.min(b,1):QA.lvl===1?Math.max(1,b*.8):b; }
export function autoQuality(dt){
  if(QA.off||!GS.is3||GS.mode!=='play'||QA.lvl>=3) { QA.n=QA.acc=0; return; }
  QA.acc+=dt; QA.n++; if(QA.n<120) return;
  const avg=QA.acc/QA.n; QA.n=QA.acc=0;
  if(avg>1/40){ QA.lvl++; if(QA.lvl<3) setPix(qaPix()); else sunSetup(false,SUN.ext); }
}
