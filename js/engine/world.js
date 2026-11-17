import * as THREE from 'three';
import {GS} from '../core/state.js';
import {PI, clamp} from '../core/utils.js';
import {WALL} from '../core/maze.js';
import {S, ZERO, _m4, _o, _q, _v, basisMat, clearEnv, mapFlat, scene} from './renderer.js';
import {gridTex} from './textures.js';
// ---------- maze world ----------
// buildWorld(m, style) turns a grid maze into 3D: instanced wall blocks, a floor, dots and power diamonds.
// The look comes from the phase's style object:
//   name                      used by actors/camera to pick models ('gta', 'fps', ...)
//   wallH                     default wall height (world units, a cell is S=2 wide)
//   bodyMat()                 material (or 6-material array) of the wall blocks
//   wallHeights(W,cells,bodies)  optional: set W.bodyInfo heights / instance colours per wall cell
//   decorate(W)               optional: extra meshes (roof units, parapets...) added after the walls
//   layout(W,rise)            optional: re-place those extras while the walls rise (rise 0..1)
//   floor(W)                  optional: add floor (and ceiling) meshes, return the floor mesh
//   dots {geo,mat,place(W,i,k)}  optional: how dots look; place() writes W.dotMesh's matrix k for cell i
GS.W3=null;
export function clearWorld(){
  clearEnv();
  if(!GS.W3) return;
  scene.remove(GS.W3.g); GS.W3.g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); });
  GS.W3=null;
}
const wallBodyGeo=new THREE.BoxGeometry(1,1,1);
export const dotGeo=new THREE.OctahedronGeometry(.2,0), powGeo=new THREE.IcosahedronGeometry(.45,0);
const defaultDots={geo:dotGeo,mat:()=>new THREE.MeshBasicMaterial({color:new THREE.Color(.7,1.4,1.6),toneMapped:false}),place(W,i,k){ const x=i%W.m.W, y=(i/W.m.W)|0; W.map(x,y,.55,_o); basisMat(_m4,_o,1,1,1); W.dotMesh.setMatrixAt(k,_m4); }};
export function buildWorld(m,style){
  clearWorld();
  const g=new THREE.Group(); scene.add(g);
  const W={g,m,style:style.name,st:style,map:mapFlat(m),wallH:style.wallH||1.5,rise:1,dotMesh:null,powMesh:null,dotIdx:new Int32Array(m.W*m.H).fill(-1),powList:[],
    bodies:null,bodyIdx:new Int32Array(m.W*m.H).fill(-1),bodyInfo:[],hgt:new Float32Array(m.W*m.H),bg:new THREE.Group(),actors:new THREE.Group(),fx:new THREE.Group(),t:0};
  g.add(W.bg); g.add(W.actors); g.add(W.fx);
  GS.W3=W;
  // ---- walls ----
  const wallCells=[]; for(let y=0;y<m.H;y++) for(let x=0;x<m.W;x++){ if(m.cell[y*m.W+x]===WALL) wallCells.push([x,y]); }
  const bodyMat=style.bodyMat?style.bodyMat():new THREE.MeshStandardMaterial({color:0x16061e,emissive:0x2a0820,roughness:.35,metalness:.5});
  const bodies=new THREE.InstancedMesh(wallBodyGeo,bodyMat,Math.max(1,wallCells.length));
  wallCells.forEach(([x,y],k)=>{ const i=y*m.W+x; W.bodyIdx[i]=k; W.hgt[i]=W.wallH; W.bodyInfo.push({x,y,h:W.wallH,alive:true}); });
  if(style.wallHeights) style.wallHeights(W,wallCells,bodies);
  W.bodies=bodies; g.add(bodies);
  if(style.decorate) style.decorate(W);
  // ---- floor ----
  if(style.floor) W.floor=style.floor(W);
  else { const tex=gridTex('#05020c','#2a1250','#8a2aff'); tex.repeat.set(m.W,m.H); tex.offset.set(.5,.5);
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(m.W*S,m.H*S),new THREE.MeshStandardMaterial({color:0xffffff,map:tex,roughness:.85,metalness:.1}));
    fl.rotation.x=-PI/2; fl.position.y=-.01; g.add(fl); W.floor=fl; }
  if(W.floor) W.floor.receiveShadow=true;
  // ---- dots ----
  const D=style.dots||defaultDots; W.placeDot=D.place;
  const dl=[], pl=[];
  for(let i=0;i<m.dot.length;i++){ if(m.dot[i]===1) dl.push(i); else if(m.dot[i]===2) pl.push(i); }
  W.dotMesh=new THREE.InstancedMesh(D.geo,typeof D.mat==='function'?D.mat():D.mat,Math.max(1,dl.length+400));
  W.dotList=[];
  dl.forEach((i,k)=>{ W.dotIdx[i]=k; W.dotList.push(i); });
  W.dotMesh.count=dl.length;
  W.powMesh=new THREE.InstancedMesh(powGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(.6,2.2,2.4),toneMapped:false}),24);
  W.powList=pl.slice();
  g.add(W.dotMesh); g.add(W.powMesh);
  refreshDots();
  layoutWalls();
  return W;
}
function refreshDots(){
  const W=GS.W3, m=W.m;
  for(let k=0;k<W.dotMesh.count;k++){ const i=W.dotList[k]; if(i==null||!m.dot[i]) W.dotMesh.setMatrixAt(k,ZERO); else W.placeDot(W,i,k); }
  W.dotMesh.instanceMatrix.needsUpdate=true; if(W.dotMesh.instanceColor) W.dotMesh.instanceColor.needsUpdate=true;
}
export function hideDot3(i){ const W=GS.W3; if(!W) return; const k=W.dotIdx[i]; if(k>=0){ W.dotMesh.setMatrixAt(k,ZERO); W.dotMesh.instanceMatrix.needsUpdate=true; W.dotIdx[i]=-1; } }
export function updatePow(t){
  const W=GS.W3, m=W.m; let k=0;
  for(const i of W.powList){ if(m.dot[i]!==2) continue; const x=i%m.W,y=(i/m.W)|0; W.map(x,y,.8+Math.sin(t*4+i)*.15,_o); basisMat(_m4,_o,1,1,1);
    _q.setFromAxisAngle(_v.set(0,1,0),t*2+i); _m4.multiply(new THREE.Matrix4().makeRotationFromQuaternion(_q)); const sc=1+Math.sin(t*6+i)*.18; _m4.multiply(new THREE.Matrix4().makeScale(sc,sc,sc));
    W.powMesh.setMatrixAt(k++,_m4); if(k>=24) break; }
  W.powMesh.count=k; W.powMesh.instanceMatrix.needsUpdate=true;
}
// wall rise: each block grows with a little diagonal delay (W.rise goes 0 -> 1 during intros)
export const riseAt=(r,x,y)=>clamp(r*1.6-((x+y)%7)/7*.6,0,1);
export function layoutWalls(){
  const W=GS.W3, r=W.rise;
  W.bodyInfo.forEach((b,k)=>{
    if(!b.alive){ W.bodies.setMatrixAt(k,ZERO); return; }
    const h=Math.max(.02,b.h*riseAt(r,b.x,b.y));
    W.map(b.x,b.y,h/2,_o); basisMat(_m4,_o,_o.ke,h,_o.ks); W.bodies.setMatrixAt(k,_m4);
  });
  W.bodies.instanceMatrix.needsUpdate=true;
  if(W.st.layout) W.st.layout(W,r);
}
