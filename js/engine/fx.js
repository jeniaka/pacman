import * as THREE from 'three';
import {GS} from '../core/state.js';
import {PI, TAU, pick, rand} from '../core/utils.js';
import {ZERO, _c, _m4, _o, _q, _v, basisMat, scene} from './renderer.js';
// ---------- debris particles ----------
const DMAX=1800;
const debMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),DMAX);
debMesh.frustumCulled=false; scene.add(debMesh);
const DEB=[]; for(let i=0;i<DMAX;i++){ DEB.push({p:new THREE.Vector3(),v:new THREE.Vector3(),g:new THREE.Vector3(),life:0,max:1,s:.2,rot:0,rs:0}); debMesh.setMatrixAt(i,ZERO); debMesh.setColorAt(i,_c.set(1,1,1)); }
let debPtr=0;
export function burst(p,n,cols,spd,size,life,gdir,up,upv){
  for(let i=0;i<n;i++){
    const d=DEB[debPtr]; debMesh.setColorAt(debPtr,_c.set(Array.isArray(cols)?pick(cols):cols)); debPtr=(debPtr+1)%DMAX;
    d.p.copy(p); d.v.set(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(spd*rand(.3,1));
    if(up&&upv) d.v.addScaledVector(up,upv*rand(.4,1));
    d.g.copy(gdir||_v.set(0,-1,0)).multiplyScalar(gdir===null?0:18);
    d.life=d.max=life*rand(.6,1.2); d.s=size*rand(.5,1.3); d.rot=rand(0,6); d.rs=rand(-8,8);
  }
  debMesh.instanceColor.needsUpdate=true;
}
const _e=new THREE.Euler();
export function updDebris(dt){
  for(let i=0;i<DMAX;i++){
    const d=DEB[i]; if(d.life<=0) continue;
    d.life-=dt; d.v.addScaledVector(d.g,dt); d.v.multiplyScalar(1-dt*.6); d.p.addScaledVector(d.v,dt); d.rot+=d.rs*dt;
    const k=d.life>0?Math.min(1,d.life/d.max*2)*d.s:0;
    _q.setFromEuler(_e.set(d.rot,d.rot*.7,0)); _m4.compose(d.p,_q,_v.set(k,k,k)); debMesh.setMatrixAt(i,_m4);
  }
  debMesh.instanceMatrix.needsUpdate=true;
}
export function clearDebris(){ for(let i=0;i<DMAX;i++){ DEB[i].life=0; debMesh.setMatrixAt(i,ZERO);} debMesh.instanceMatrix.needsUpdate=true; }
// ---------- markers (rings on the floor) ----------
const ringGeo=new THREE.RingGeometry(.86,1,48); ringGeo.rotateX(-PI/2);
const discGeo=new THREE.CircleGeometry(1,40); discGeo.rotateX(-PI/2);
const MK=[];
export function marker(x,y,r,col,life,o={}){
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
  const mesh=new THREE.Mesh(o.disc?discGeo:ringGeo,mat); GS.W3.fx.add(mesh);
  const mk={x,y,r,life,max:life,mesh,mat,grow:o.grow||0,pulse:o.pulse||0,h:o.h??.08,fade:o.fade??true,onEnd:o.onEnd,op:o.op??.9};
  MK.push(mk); return mk;
}
export function updMarkers(dt){
  for(const k of MK){
    k.life-=dt; const a=1-k.life/k.max;
    GS.W3.map(k.x,k.y,k.h,_o); const r=k.r*(1+k.grow*a)*(k.pulse?1+Math.sin(a*k.pulse*TAU)*.08:1);
    basisMat(_m4,_o,r*_o.ke,1,r*_o.ks); k.mesh.matrixAutoUpdate=false; k.mesh.matrix.copy(_m4);
    k.mat.opacity=k.fade?k.op*Math.min(1,k.life/k.max*2.5):k.op;
    if(k.life<=0){ k.mesh.removeFromParent(); k.mat.dispose(); if(k.onEnd) k.onEnd(k); }
  }
  for(let i=MK.length-1;i>=0;i--) if(MK[i].life<=0) MK.splice(i,1);
}
export function clearMarkers(){ for(const k of MK){ k.mesh.removeFromParent(); k.mat.dispose(); } MK.length=0; }
