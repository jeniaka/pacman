import {GS} from '../core/state.js';
import {$} from '../core/utils.js';
import {DOOR, PEN, WALL} from '../core/maze.js';
// ================= MINIMAP =================
// A phase either draws its own map (phase.minimap()) or describes a maze map with phase.mini
// {cs: cell px, scale:[phone,desktop], wall, bg, dot, pow, enemy(e,t)} plus optional phase.miniExtras(g,cs,t).
export const miniC=$('mini'), miniX=miniC.getContext('2d');
let miniF=0; GS.miniLayer=null; GS.miniKey='';
// size the minimap canvas and tell the CSS how much room it takes (the score moves left of it)
export function miniSize(key,W,H,sc){
  if(GS.miniKey===key) return false;
  GS.miniKey=key; miniC.width=W; miniC.height=H; miniC.style.width=(W*sc)+'px'; miniC.style.height=(H*sc)+'px';
  document.body.style.setProperty('--miniw',(W*sc)+'px'); document.body.style.setProperty('--minih',(H*sc)+'px'); return true;
}
function miniWalls(m,cs,col){
  const cv=document.createElement('canvas'); cv.width=m.W*cs; cv.height=m.H*cs; const g=cv.getContext('2d');
  g.fillStyle=col; for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++) if(m.cell[y*m.W+x]===WALL) g.fillRect(x*cs,y*cs,cs,cs);
  g.fillStyle='rgba(120,160,255,.5)'; for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++){ const c=m.cell[y*m.W+x]; if(c===PEN||c===DOOR) g.fillRect(x*cs,y*cs,cs,cs); }
  return cv;
}
export function drawMini(){
  const P=GS.P, show=GS.is3&&GS.G&&GS.W3&&P&&(P.mini||P.minimap)&&(GS.mode==='play'||GS.mode==='seq'||GS.mode==='dead')&&!(GS.seq&&GS.seq.t<.4);
  if(!show){ miniC.style.display='none'; document.body.classList.remove('mini'); return; }
  miniC.style.display='block'; document.body.classList.add('mini');
  if((miniF++)%2) return;
  if(P.minimap){ P.minimap(); return; }
  const M=P.mini, m=GS.G.m, cs=M.cs||4, W=m.W*cs, H=m.H*cs, t=performance.now()/1000;
  const key=GS.phase+':'+m.W+'x'+m.H;
  if(miniSize(key,W,H,innerWidth<640?M.scale[0]:M.scale[1])||!GS.miniLayer) GS.miniLayer=miniWalls(m,cs,M.wall);
  const g=miniX, h=GS.G.hero;
  g.fillStyle=M.bg; g.fillRect(0,0,W,H); g.drawImage(GS.miniLayer,0,0);
  for(let i=0;i<m.dot.length;i++){ const d=m.dot[i]; if(!d) continue; const x=i%m.W, y=(i/m.W)|0;
    if(d===1){ g.fillStyle=M.dot; g.fillRect(x*cs+(cs>>1)-1,y*cs+(cs>>1)-1,cs>4?2:1,cs>4?2:1); }
    else if((t*4|0)%2){ g.fillStyle=M.pow; g.fillRect(x*cs,y*cs,cs,cs); } }
  if(P.miniExtras) P.miniExtras(g,cs,t);
  for(const e of GS.G.en){ if(e.st==='dead'||e.st==='eaten') continue;
    if(e.boss){ g.fillStyle=(t*4|0)%2?'#c040ff':'#ff60ff'; g.fillRect(e.x*cs-3,e.y*cs-3,cs+6,cs+6); continue; }
    g.fillStyle=e.fr?((t*6|0)%2?'#fff':'#3a8aff'):M.enemy?M.enemy(e,t):e.col; g.fillRect(e.x*cs-1,e.y*cs-1,cs+2,cs+2); }
  const hx=h.x*cs+cs/2, hy=h.y*cs+cs/2, a=Math.atan2(h.fy,h.fx), r=cs*1.5;
  g.fillStyle='#7dff4a'; g.beginPath(); g.moveTo(hx+Math.cos(a)*r,hy+Math.sin(a)*r); g.lineTo(hx+Math.cos(a+2.4)*r,hy+Math.sin(a+2.4)*r); g.lineTo(hx+Math.cos(a-2.4)*r,hy+Math.sin(a-2.4)*r); g.fill();
}
