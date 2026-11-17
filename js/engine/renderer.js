import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {$, TOUCH} from '../core/utils.js';
import {cvTex} from './textures.js';
// ================= 3D ENGINE =================
export const c3=$('c3');
export const renderer=new THREE.WebGLRenderer({canvas:c3,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
// HD: soft shadows from the sun light (phases 2, 4, 5)
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
export const scene=new THREE.Scene();
export const camera=new THREE.PerspectiveCamera(55,1,.1,3000);
// HD: multisampled render target so the post-processing chain keeps real anti-aliasing
export const composerRT=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:TOUCH?2:4});
export const composer=new EffectComposer(renderer,composerRT); composer.addPass(new RenderPass(scene,camera));
export const bloom=new UnrealBloomPass(new THREE.Vector2(512,512),.42,.4,.32); composer.addPass(bloom); composer.addPass(new OutputPass());
const PMREM=new THREE.PMREMGenerator(renderer);
let PIX=Math.min(devicePixelRatio||1,1.75);
export function setSamples(n){ for(const rt of [composer.renderTarget1,composer.renderTarget2]) if(rt.samples!==n){ rt.samples=n; rt.dispose(); } }
export function setPix(r){ PIX=r; renderer.setPixelRatio(r); composer.setPixelRatio(r); resize3(); }
function resize3(){ renderer.setSize(innerWidth,innerHeight,false); composer.setSize(innerWidth,innerHeight); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize',resize3); resize3();
export const hemi=new THREE.HemisphereLight(0x8899ff,0x221122,.9); scene.add(hemi);
export const sun=new THREE.DirectionalLight(0xffffff,1.1); sun.position.set(20,40,25); scene.add(sun); scene.add(sun.target);
const SHQ=TOUCH?1024:2048;
sun.castShadow=true; sun.shadow.mapSize.set(SHQ,SHQ); sun.shadow.bias=-.0005; sun.shadow.normalBias=.04; sun.shadow.radius=3;
export const SUN={dir:new THREE.Vector3(20,40,25).normalize(),ext:26,on:true};
// keep the shadow camera centred on the action; ext = half size of the shadowed area
export function sunSetup(on,ext,pos){
  SUN.on=on; SUN.ext=ext; sun.castShadow=on; if(pos){ SUN.dir.copy(pos).normalize(); }
  const c=sun.shadow.camera; c.left=-ext; c.right=ext; c.top=ext; c.bottom=-ext; c.near=1; c.far=260; c.updateProjectionMatrix();
}
const _sunP=new THREE.Vector3();
export function sunFollow(p){
  if(!SUN.on) return;
  const tx=2*SUN.ext/SHQ; _sunP.set(Math.round(p.x/tx)*tx,Math.round(p.y/tx)*tx,Math.round(p.z/tx)*tx);
  sun.target.position.copy(_sunP); sun.position.copy(_sunP).addScaledVector(SUN.dir,120); sun.target.updateMatrixWorld();
}
export function castAll(o,recv=false){ o.traverse(c=>{ if(c.isMesh&&!(c.material&&c.material.transparent)){ c.castShadow=true; if(recv) c.receiveShadow=true; } }); return o; }
// image based lighting from a little gradient sky, so metal, glass and paint get real reflections
export function envFrom(top,mid,bot,spots=[]){
  const es=new THREE.Scene();
  const tex=cvTex(8,256,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,top); gr.addColorStop(.5,mid); gr.addColorStop(1,bot); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50,32,16),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide})));
  for(const [col,x,y,z,s] of spots){ const m=new THREE.Mesh(new THREE.SphereGeometry(s,16,8),new THREE.MeshBasicMaterial({color:col})); m.position.set(x,y,z); es.add(m); }
  const rt=PMREM.fromScene(es,.02); es.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); tex.dispose();
  clearEnv(); ENVRT=rt; scene.environment=rt.texture; return rt.texture;
}
let ENVRT=null;
export function clearEnv(){ if(ENVRT){ ENVRT.dispose(); ENVRT=null; } scene.environment=null; }
export const heroLight=new THREE.PointLight(0x9dff7a,18,14,1.6); scene.add(heroLight);
export const S=2;
export const _o={p:new THREE.Vector3(),e:new THREE.Vector3(),s:new THREE.Vector3(),n:new THREE.Vector3(),ke:S,ks:S};
export const _o2={p:new THREE.Vector3(),e:new THREE.Vector3(),s:new THREE.Vector3(),n:new THREE.Vector3(),ke:S,ks:S};
export const _m4=new THREE.Matrix4(), _v=new THREE.Vector3(), _v2=new THREE.Vector3(), _v3=new THREE.Vector3(), _q=new THREE.Quaternion(), _c=new THREE.Color();
export const ZERO=new THREE.Matrix4().makeScale(0,0,0);
export function mapFlat(m){ const ox=(m.W-1)/2, oz=(m.H-1)/2; return (x,y,h,o)=>{ o.p.set((x-ox)*S,h,(y-oz)*S); o.e.set(1,0,0); o.s.set(0,0,1); o.n.set(0,1,0); o.ke=S; o.ks=S; return o; }; }
export function basisMat(mat,o,sx,sy,sz){ _v.copy(o.e).multiplyScalar(sx); _v2.copy(o.n).multiplyScalar(sy); _v3.copy(o.s).multiplyScalar(sz); mat.makeBasis(_v,_v2,_v3); mat.setPosition(o.p); return mat; }
// orient object: forward f (in e/s plane), up n
export function placeObj(obj,o,fx,fy,scale=1){
  _v.copy(o.e).multiplyScalar(fx).addScaledVector(o.s,fy); if(_v.lengthSq()<1e-6) _v.copy(o.s); _v.normalize(); // forward
  _v2.crossVectors(o.n,_v).normalize(); // right
  _m4.makeBasis(_v2,o.n,_v); obj.quaternion.setFromRotationMatrix(_m4); obj.position.copy(o.p); obj.scale.setScalar(scale);
}
