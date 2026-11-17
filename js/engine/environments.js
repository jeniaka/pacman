import * as THREE from 'three';
import {GS} from '../core/state.js';
import {rand} from '../core/utils.js';
import {_c, _v, hemi, scene, sun} from './renderer.js';
import {cvTex, glowTex} from './textures.js';
// ================= ENVIRONMENTS =================
export function skyDome(top,mid,bot){
  const tex=cvTex(4,256,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,top); gr.addColorStop(.55,mid); gr.addColorStop(1,bot); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  const m=new THREE.Mesh(new THREE.SphereGeometry(900,32,16),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,fog:false,depthWrite:false}));
  return m;
}
export function glowSprite(col,size,op=1){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:col,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})); s.scale.setScalar(size); return s; }
export function buildSpaceEnv(){
  const bg=GS.W3.bg;
  scene.background=new THREE.Color(0x020108); scene.fog=null;
  const n=3500, pos=new Float32Array(n*3), col=new Float32Array(n*3);
  for(let i=0;i<n;i++){ _v.set(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(rand(300,800)); pos.set([_v.x,_v.y,_v.z],i*3); _c.setHSL(rand(.5,.9),.6,rand(.6,.95)); col.set([_c.r,_c.g,_c.b],i*3); }
  const sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.BufferAttribute(pos,3)); sg.setAttribute('color',new THREE.BufferAttribute(col,3));
  const stars=new THREE.Points(sg,new THREE.PointsMaterial({size:1.6,vertexColors:true,sizeAttenuation:false,transparent:true,opacity:.85,depthWrite:false})); bg.add(stars); GS.W3.stars=stars;
  const neb=[0xff3ea5,0x6a3aff,0x29f0ff,0xff8a3a];
  for(let i=0;i<14;i++){ const s=glowSprite(neb[i%4],rand(160,360),.13); _v.set(rand(-1,1),rand(-.6,.6),rand(-1,1)).normalize().multiplyScalar(rand(380,600)); s.position.copy(_v); bg.add(s); }
  const pl=new THREE.Mesh(new THREE.SphereGeometry(60,40,24),new THREE.MeshStandardMaterial({color:0x5a3aa0,emissive:0x1a0830,roughness:.9})); pl.position.set(220,-120,-380); bg.add(pl);
  const ring=new THREE.Mesh(new THREE.RingGeometry(80,120,64),new THREE.MeshBasicMaterial({color:0xc08aff,transparent:true,opacity:.25,side:THREE.DoubleSide})); ring.position.copy(pl.position); ring.rotation.x=1.2; bg.add(ring);
  hemi.color.set(0xb0a0ff); hemi.groundColor.set(0x301050); hemi.intensity=.9; sun.color.set(0xffffff); sun.intensity=1;
}
