import * as THREE from 'three';
import {GS} from '../core/state.js';
import {clamp, lerp, rand} from '../core/utils.js';
import {wdx, wdy, wrapI} from '../core/maze.js';
import {_o2, _v, camera, composer} from './renderer.js';
// ---------- camera ----------
export const cam={mode:'follow',yaw:0,bobT:0,lax:0,lay:0,shake:0,hgt:20,back:13,ahead:2,fov:55,k:4,tx:0,ty:0,bl:1,cp:new THREE.Vector3(0,60,30),cl:new THREE.Vector3(),cu:new THREE.Vector3(0,1,0)};
export const _cP=new THREE.Vector3(), _cL=new THREE.Vector3(), _cU=new THREE.Vector3();
function camTarget(x,y,o){
  if(cam.mode==='fps'&&GS.G){ const h=GS.G.hero; GS.W3.map(h.x,h.y,1.15+Math.sin(cam.bobT)*.06,o);
    _cP.copy(o.p); _v.copy(o.e).multiplyScalar(Math.cos(cam.yaw)).addScaledVector(o.s,Math.sin(cam.yaw));
    _cL.copy(o.p).addScaledVector(_v,6).addScaledVector(o.n,-.35); _cU.copy(o.n); return; }
  GS.W3.map(x,y,0,o);
  if(cam.mode==='side'){ const asp=innerWidth/innerHeight, port=asp<1?Math.min(1.8,1.2/Math.max(.45,asp)):1;
    o.p.set(x,y,0); _cL.set(x+cam.lax,y*.55+2.2,0); _cP.set(x+cam.lax,y*.55+3.6,19*port); _cU.set(0,1,0); return; }
  if(cam.mode==='top'){ const asp=innerWidth/innerHeight, port=asp<1?Math.min(1.7,1.15/Math.max(.45,asp)):1;
    _cL.copy(o.p).addScaledVector(o.e,cam.lax).addScaledVector(o.s,cam.lay); _cP.copy(_cL).addScaledVector(o.n,cam.hgt*port).addScaledVector(o.s,cam.back); _cU.copy(o.s).negate(); return; }
  const asp=innerWidth/innerHeight, port=asp<1?Math.min(1.9,1.25/Math.max(.45,asp)):1;
  const H=cam.hgt*port, B=cam.back*port;
  _cP.copy(o.p).addScaledVector(o.n,H).addScaledVector(o.s,B);
  _cL.copy(o.p).addScaledVector(o.s,-cam.ahead);
  _cU.copy(o.n);
}
export function camUpdate(dt,x,y,snap){
  if(!GS.W3) return;
  const m=GS.W3.m;
  if(snap){ cam.tx=x; cam.ty=y; }
  else { const k=1-Math.exp(-dt*cam.k); cam.tx+=wdx(m,cam.tx,x)*k; cam.ty+=wdy(m,cam.ty,y)*k;
    if(m.wrapY){ cam.ty=wrapI(cam.ty,m.H); }
    if(m.wrapX&&Math.abs(cam.tx-x)>m.W/2) cam.tx=x; }
  if(cam.mode==='fps'&&GS.G){ const h=GS.G.hero; const ty=Math.atan2(h.fy,h.fx); let d=ty-cam.yaw; d=Math.atan2(Math.sin(d),Math.cos(d)); cam.yaw+=snap?d:d*(1-Math.exp(-dt*11)); if(h.dx||h.dy) cam.bobT+=dt*11; }
  if(cam.mode==='side'&&GS.G){ const k2=1-Math.exp(-dt*2); cam.lax=lerp(cam.lax,(GS.G.hero.fx||1)*2.6,k2); }
  if(cam.mode==='top'&&GS.G){ const h=GS.G.hero, k2=1-Math.exp(-dt*2.5); cam.lax=lerp(cam.lax,h.dx*2.6,k2); cam.lay=lerp(cam.lay,h.dy*2.6,k2); }
  camTarget(cam.tx,cam.ty,_o2);
  if(cam.bl<1){ const b=clamp(cam.bl,0,1); _cP.lerpVectors(cam.cp,_cP,b); _cL.lerpVectors(cam.cl,_cL,b); _cU.lerpVectors(cam.cu,_cU,b).normalize(); }
  camera.position.copy(_cP); camera.up.copy(_cU);
  if(cam.shake>0){ const a=cam.shake; camera.position.x+=rand(-1,1)*a; camera.position.y+=rand(-1,1)*a; camera.position.z+=rand(-1,1)*a; cam.shake=Math.max(0,cam.shake-dt*2.5); }
  camera.lookAt(_cL);
  if(Math.abs(camera.fov-cam.fov)>.05){ camera.fov=lerp(camera.fov,cam.fov,1-Math.exp(-dt*3)); camera.updateProjectionMatrix(); }
}
export function render3(){ composer.render(); }
export function camPose(p,l,u){ cam.cp.copy(p); cam.cl.copy(l); cam.cu.copy(u).normalize(); }
