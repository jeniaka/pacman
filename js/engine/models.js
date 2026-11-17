import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {PI, TAU} from '../core/utils.js';
import {_v, castAll} from './renderer.js';
// ---------- models ----------
function mkStd(col,em,ei=.35,o={}){ return new THREE.MeshStandardMaterial(Object.assign({color:col,emissive:em??col,emissiveIntensity:ei,roughness:.4,metalness:.3},o)); }
export function makeBot(){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const lime=mkStd(0x5fd83a,0x2ad010,.22,{roughness:.32,metalness:.25}), dark=new THREE.MeshPhysicalMaterial({color:0x061a0a,roughness:.08,metalness:.6,clearcoat:1,clearcoatRoughness:.04});
  const head=new THREE.Mesh(new RoundedBoxGeometry(1.5,.95,1.4,6,.25),lime); head.position.y=1.05; body.add(head);
  const visor=new THREE.Mesh(new RoundedBoxGeometry(1.3,.42,.08,3,.035),dark); visor.position.set(0,1.12,.7); body.add(visor);
  const eyeM=new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,2.2,2.2),toneMapped:false});
  const eyes=new THREE.Group(); eyes.position.set(0,1.13,.75); body.add(eyes);
  for(const s of [-1,1]){ const e=new THREE.Mesh(new RoundedBoxGeometry(.3,.16,.04,2,.015),eyeM.clone()); e.position.x=s*.3; eyes.add(e); }
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(1.3,.3,1.2),new THREE.MeshBasicMaterial({color:0x300010})); mouth.position.set(0,.5,.05); body.add(mouth);
  const jawP=new THREE.Group(); jawP.position.set(0,.58,-.6); body.add(jawP);
  const jaw=new THREE.Mesh(new RoundedBoxGeometry(1.5,.32,1.4,5,.12),lime); jaw.position.set(0,-.12,.6); jawP.add(jaw);
  const toothM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.2,emissive:0x555555});
  for(let i=-2;i<=2;i++){ const t=new THREE.Mesh(new THREE.ConeGeometry(.07,.16,10),toothM); t.position.set(i*.27,.1,1.22); jawP.add(t); }
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.55,14),dark); ant.position.set(0,1.75,0); body.add(ant);
  const tipM=new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,.4,.6),toneMapped:false});
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.11,24,16),tipM); tip.position.set(0,2.05,0); body.add(tip);
  const thr=new THREE.Mesh(new THREE.ConeGeometry(.35,.5,28,1,true),new THREE.MeshBasicMaterial({color:new THREE.Color(.5,2,.8),transparent:true,opacity:.55,toneMapped:false,side:THREE.DoubleSide,depthWrite:false}));
  thr.rotation.x=PI; thr.position.y=.12; body.add(thr);
  g.userData={body,jawP,eyes,lime,tip,thr,head};
  castAll(g); return g;
}
const icoV=(()=>{ const geo=new THREE.IcosahedronGeometry(1,0), p=geo.attributes.position, out=[], seen=new Set(); for(let i=0;i<p.count;i++){ const k=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(3)).join(); if(!seen.has(k)){ seen.add(k); out.push(new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)).normalize()); } } return out; })();
const spikeGeo=new THREE.ConeGeometry(.13,.6,14); spikeGeo.translate(0,.3,0);
export const eyeWGeo=new THREE.SphereGeometry(.33,32,24), pupGeo=new THREE.SphereGeometry(.16,24,16);
export function makeVirus(col,style){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const mat=mkStd(col,col,.5,{flatShading:true,roughness:.35,metalness:.35});
  let core;
  if(style==='drone'){
    core=new THREE.Group();
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(.75,1.05,.32,18),new THREE.MeshStandardMaterial({color:0x30384a,roughness:.3,metalness:.8})); core.add(disc);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.95,.06,6,24),mat); ring.rotation.x=PI/2; core.add(ring);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(.55,16,10,0,TAU,0,PI/2),new THREE.MeshStandardMaterial({color:0x99ccff,transparent:true,opacity:.35,roughness:.05,metalness:.2})); dome.position.y=.15; core.add(dome);
    const lr=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color(3,.2,.2),toneMapped:false})); lr.position.set(-.55,.2,0); core.add(lr);
    const lb=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color(.2,.6,3),toneMapped:false})); lb.position.set(.55,.2,0); core.add(lb);
    core.userData={lr,lb}; core.position.y=1.1;
  } else {
    core=new THREE.Group(); core.position.y=.95;
    core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.62,2),mat));
    for(const v of icoV){ const s=new THREE.Mesh(spikeGeo,mat); s.position.copy(v).multiplyScalar(.5); s.quaternion.setFromUnitVectors(_v.set(0,1,0),v); core.add(s); }
  }
  body.add(core);
  const eye=new THREE.Group(); eye.position.set(0,style==='drone'?1.38:.98,style==='drone'?.05:.52); body.add(eye);
  eye.add(new THREE.Mesh(eyeWGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:.12,emissive:0x5a5a5a})));
  const pup=new THREE.Mesh(pupGeo,new THREE.MeshStandardMaterial({color:0x050505,roughness:.05})); pup.position.z=.24; eye.add(pup);
  g.userData={body,core,mat,eye,pup,col:new THREE.Color(col),style};
  castAll(g); return g;
}
