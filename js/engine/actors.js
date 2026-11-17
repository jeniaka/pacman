import {GS} from '../core/state.js';
import {$, clamp, lerp} from '../core/utils.js';
import {wdx, wdy} from '../core/maze.js';
import {_o, _v, _v3, camera, heroLight, placeObj} from './renderer.js';
import {makeBot, makeVirus} from './models.js';
import {burst} from './fx.js';
// ================= 3D ACTORS =================
// hero + enemies of the maze phases. A world style can supply enemyModel(e) or take over syncEnemies(dt).
export const A3={hero:null,en:[],items:[]};
export function spawnActors3(style){
  A3.hero=makeBot(); GS.W3.actors.add(A3.hero); A3.hero.userData.fx=0; A3.hero.userData.fy=-1;
  A3.en=[]; A3.style=style;
}
function enObj(e){
  let o=A3.en[e.k];
  if(!o){ const st=GS.W3.st; o=st&&st.enemyModel?st.enemyModel(e):makeVirus(e.col,'virus'); GS.W3.actors.add(o); A3.en[e.k]=o; o.userData.fx=0; o.userData.fy=1; }
  return o;
}
GS.heroScale=1; GS.heroLift=0;
export function syncActors3(dt){
  const h=GS.G.hero, t=performance.now()/1000, ud=A3.hero.userData;
  ud.fx=lerp(ud.fx,h.fx,1-Math.exp(-dt*14)); ud.fy=lerp(ud.fy,h.fy,1-Math.exp(-dt*14));
  GS.W3.map(h.x,h.y,.15+Math.sin(t*6)*.08+GS.heroLift+(GS.W3.heroH||0),_o);
  const tsc=1;
  const sc=GS.heroScale*(GS.G.ramp>0?1.3:1)*tsc;
  A3.hero.visible=h.alive&&!(GS.G.inv>0&&(t*12|0)%2)&&A3.style!=='fps';
  placeObj(A3.hero,_o,ud.fx,ud.fy,sc);
  if(A3.style==='fps') heroLight.position.copy(camera.position);
  else heroLight.position.copy(_o.p).addScaledVector(_o.n,5.5*sc).addScaledVector(_o.s,2);
  ud.jawP.rotation.x=(h.dx||h.dy)?Math.abs(Math.sin(h.mouth))*.55:.1;
  const red=GS.G.ramp>0;
  ud.lime.color.set(red?0xff4a2a:GS.G.turbo>0?0x4affd8:0x5fd83a); ud.lime.emissive.set(red?0xff2000:GS.G.turbo>0?0x10ffc0:0x2ad010);
  ud.lime.emissiveIntensity=red?.7+Math.sin(t*20)*.3:.22;
  heroLight.color.set(A3.style==='fps'?0xffd8a0:red?0xff5a3a:0x9dff7a); if(A3.style!=='fps') heroLight.intensity=A3.style==='gta'?4:11;
  ud.thr.scale.y=1+Math.sin(t*30)*.2+(GS.G.turbo>0?1.2:0);
  if(GS.W3.st&&GS.W3.st.syncEnemies){ GS.W3.st.syncEnemies(dt); return; } // the phase draws its own enemies (e.g. sprites)
  for(const e of GS.G.en){
    const o=enObj(e), u=o.userData;
    if(e.st==='dead'&&!e.suck){ o.visible=false; continue; }
    o.visible=true;
    const mv=e.dx||e.dy; if(mv){ u.fx=lerp(u.fx,e.dx,1-Math.exp(-dt*12)); u.fy=lerp(u.fy,e.dy,1-Math.exp(-dt*12)); }
    let ex=e.x, ey=e.y, hgt=.1+Math.sin(e.bob)*.12;
    if(e.st==='pen') hgt+=.15;
    if(u.style==='car') hgt=0;
    hgt+=e.hOff||0;
    if(e.suck){ ex=e.sx2; ey=e.sy2; }
    GS.W3.map(ex,ey,hgt,_o);
    let s=1; if(e.suck) s=Math.max(.01,e.suckS);
    placeObj(o,_o,u.fx,u.fy,s);
    u.core.visible=e.st!=='eaten';
    if(u.style==='virus'){ u.core.rotation.y=e.spin; u.core.rotation.x=e.spin*.6; }
    else if(u.style==='drone'){ u.core.rotation.y=e.spin; const f=(t*6|0)%2; u.core.userData.lr.visible=!!f; u.core.userData.lb.visible=!f; }
    else if(u.lr){ const f=(t*7|0)%2; u.lr.visible=!!f||e.fr; u.lb.visible=!f||e.fr; if(e.fr){ u.lr.visible=u.lb.visible=false; } }
    const fl=e.fr&&GS.G.fright<1.8&&(t*8|0)%2;
    if(GS.G.over) { u.mat.color.set(0xff2020); u.mat.emissive.set(0xff0000); }
    else if(e.fr){ if(u.style==='car'){ u.mat.color.set(fl?0xf0f8ff:0x3a3e46); u.mat.emissive.set(fl?0x8899aa:0x000000); } else { u.mat.color.set(fl?0xf0f8ff:0x2a8a96); u.mat.emissive.set(fl?0xaaccff:0x0a4a56); } }
    else { u.mat.color.copy(u.col); u.mat.emissive.copy(u.col); }
    // pupil looks at hero
    const lx=wdx(GS.G.m,e.x,h.x), ly=wdy(GS.G.m,e.y,h.y), L=Math.hypot(lx,ly)||1;
    u.pup.position.x=clamp(lx/L*.12,-.12,.12)*Math.sign(u.fy||1); u.pup.position.y=clamp(-ly/L*.08,-.1,.1);
  }
}
export function pop3(x,y,s,col='#7dfcff',h=2){
  GS.W3.map(x,y,h,_o); _v.copy(_o.p).project(camera); if(_v.z>1) return;
  const d=document.createElement('div'); d.textContent=s; d.style.color=col; d.style.left=((_v.x+1)/2*innerWidth)+'px'; d.style.top=((1-_v.y)/2*innerHeight)+'px';
  $('pops').appendChild(d); requestAnimationFrame(()=>{ d.style.transform='translate(-50%,-160%)'; d.style.opacity='0'; }); setTimeout(()=>d.remove(),950);
}
export function burstAt(x,y,h,n,cols,spd,size,life,upv=6){ GS.W3.map(x,y,h,_o); _v3.copy(_o.n); burst(_o.p.clone(),n,cols,spd,size,life,_v.copy(_o.n).negate().clone(),_v3.clone(),upv); }
