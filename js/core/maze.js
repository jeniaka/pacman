import {mulberry} from './utils.js';
// ================= MAZES =================
export const WALL=1, OPEN=0, DOOR=2, PEN=3;
export const MAZE1=["############################", "#.....#..............#.....#", "#.###.#.############.#.###.#", "#o###.#.############.#.###o#", "#..........................#", "#.###.##.##.####.##.##.###.#", "#.###.##.##.####.##.##.###.#", "#.....##....####....##.....#", "#####.#####.####.#####.#####", "#####.#####.####.#####.#####", "#####.##............##.#####", "#####.##.###----###.##.#####", "#####.##.#PPPPPPPP#.##.#####", "      ##.#PPPPPPPP#.##      ", "#####....#PPPPPPPP#....#####", "#####.##.##########.##.#####", "#####.##............##.#####", "#####.##.##########.##.#####", "#............##............#", "#.###.######.##.######.###.#", "#o..#........##........#..o#", "###.#.##.##########.##.#.###", "###.#.##.##########.##.#.###", "#.....##....####....##.....#", "#.#########.####.#########.#", "#.#########.####.#########.#", "#..........................#", "#.##.#####.######.#####.##.#", "#.##.#####.######.#####.##.#", "#..........................#", "############################"];
export function parseMaze(rows,wrapX,wrapY){
  const H=rows.length, W=rows[0].length;
  const m={W,H,wrapX,wrapY,cell:new Uint8Array(W*H),dot:new Uint8Array(W*H),hgt:new Float32Array(W*H),solid:new Uint8Array(W*H)};
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const c=rows[y][x], i=y*W+x;
    m.cell[i]=c==='#'?WALL:c==='-'?DOOR:c==='P'?PEN:OPEN;
    m.dot[i]=c==='.'?1:c==='o'?2:0;
  }
  return m;
}
// lattice city / torus generator: corridors every 4 cells, random block merges, no dead ends
export function genLattice(W,H,wrap,seed,frac){
  const R=mulberry(seed), off=wrap?0:1;
  const NX=wrap?W/4:(W-3)/4+1, NY=wrap?H/4:(H-3)/4+1;
  const rows=[]; for(let y=0;y<H;y++){ let s=''; for(let x=0;x<W;x++){ const border=!wrap&&(x===0||y===0||x===W-1||y===H-1); s+=(!border&&((x-off)%4===0||(y-off)%4===0))?'.':'#'; } rows.push(s.split('')); }
  const edges=[]; // [ax,ay,bx,by]
  for(let j=0;j<NY;j++) for(let i=0;i<NX;i++){
    if(wrap||i<NX-1) edges.push([i,j,(i+1)%NX,j,'h']);
    if(wrap||j<NY-1) edges.push([i,j,i,(j+1)%NY,'v']);
  }
  const deg=new Int32Array(NX*NY); const alive=new Set(edges.map((e,k)=>k));
  edges.forEach(e=>{deg[e[1]*NX+e[0]]++; deg[e[3]*NX+e[2]]++;});
  const connected=()=>{ const adj=Array.from({length:NX*NY},()=>[]); alive.forEach(k=>{const e=edges[k]; adj[e[1]*NX+e[0]].push(e[3]*NX+e[2]); adj[e[3]*NX+e[2]].push(e[1]*NX+e[0]);});
    const seen=new Uint8Array(NX*NY); const st=[0]; seen[0]=1; let c=1; while(st.length){ const a=st.pop(); for(const b of adj[a]) if(!seen[b]){seen[b]=1;c++;st.push(b);} } return c===NX*NY; };
  const order=edges.map((e,k)=>k).sort(()=>R()-.5);
  let target=Math.floor(edges.length*frac), removed=0;
  for(const k of order){
    if(removed>=target) break;
    const e=edges[k], a=e[1]*NX+e[0], b=e[3]*NX+e[2];
    if(deg[a]<3||deg[b]<3) continue;
    alive.delete(k); if(!connected()){ alive.add(k); continue; }
    deg[a]--; deg[b]--; removed++;
    const x0=e[0]*4+off, y0=e[1]*4+off;
    for(let s=1;s<=3;s++){ if(e[4]==='h') rows[y0][(x0+s)%W]='#'; else rows[(y0+s)%H][x0]='#'; }
  }
  return rows.map(r=>r.join(''));
}
export const wrapI=(v,n)=>((v%n)+n)%n;
export function cellAt(m,x,y){
  if(m.wrapX) x=wrapI(x,m.W); if(m.wrapY) y=wrapI(y,m.H);
  if(x<0||y<0||x>=m.W||y>=m.H) return WALL;
  return m.cell[y*m.W+x];
}
export function idxOf(m,x,y){ if(m.wrapX) x=wrapI(x,m.W); if(m.wrapY) y=wrapI(y,m.H); if(x<0||y<0||x>=m.W||y>=m.H) return -1; return y*m.W+x; }
export function wdx(m,a,b){ let d=b-a; if(m.wrapX){ if(d>m.W/2) d-=m.W; if(d<-m.W/2) d+=m.W; } return d; }
export function wdy(m,a,b){ let d=b-a; if(m.wrapY){ if(d>m.H/2) d-=m.H; if(d<-m.H/2) d+=m.H; } return d; }
export function bfs(m,tx,ty,pass){
  const D=new Int16Array(m.W*m.H).fill(-1); const q=[]; const s=idxOf(m,tx,ty); if(s<0) return D; D[s]=0; q.push(s);
  for(let h=0;h<q.length;h++){ const i=q[h], x=i%m.W, y=(i/m.W)|0;
    for(const [dx,dy] of DIRS){ const j=idxOf(m,x+dx,y+dy); if(j<0||D[j]>=0||!pass(m.cell[j],j)) continue; D[j]=D[i]+1; q.push(j); } }
  return D;
}
export const DIRS=[[0,-1],[-1,0],[0,1],[1,0]];
export function isEdgeWall(m,x,y){
  if(cellAt(m,x,y)===OPEN) return false;
  for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; if(cellAt(m,x+dx,y+dy)!==WALL) return true; }
  return false;
}

// ================= ACTORS =================
function wrapActor(m,a){
  if(m.wrapX){ if(a.x<-.5) a.x+=m.W; else if(a.x>=m.W-.5) a.x-=m.W; }
  if(m.wrapY){ if(a.y<-.5) a.y+=m.H; else if(a.y>=m.H-.5) a.y-=m.H; }
}
export function stepActor(m,a,dist,decide){
  let g=0;
  while(dist>1e-5&&g++<40){
    const rx=Math.round(a.x), ry=Math.round(a.y);
    if(Math.abs(a.x-rx)<1e-4&&Math.abs(a.y-ry)<1e-4){
      a.x=rx; a.y=ry; wrapActor(m,a);
      if(!a.decided){ decide(a); a.decided=true; }
      if(!a.dx&&!a.dy){ a.decided=false; return; }
    }
    if(!a.dx&&!a.dy) return;
    const hz=a.dx!==0;
    if(hz) a.y=Math.round(a.y); else a.x=Math.round(a.x);
    const pos=hz?a.x:a.y, d=hz?a.dx:a.dy;
    const tgt=d>0?Math.floor(pos+1e-4)+1:Math.ceil(pos-1e-4)-1;
    const r=Math.abs(tgt-pos), mv=Math.min(r,dist);
    if(mv>=r-1e-6){ if(hz) a.x=tgt; else a.y=tgt; } else { if(hz) a.x+=d*mv; else a.y+=d*mv; }
    dist-=mv; a.decided=false;
    wrapActor(m,a);
  }
}
