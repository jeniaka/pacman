import * as THREE from 'three';
import {clamp, mulberry} from '../core/utils.js';
// ---------- textures ----------
export const ANISO=8; // three.js clamps this to what the GPU supports
export function cvTex(w,h,fn,rep){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; fn(cv.getContext('2d'),w,h); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; } t.anisotropy=ANISO; return t; }
// ---------- HD texture toolkit (phases 2-5) ----------
export const once=f=>{ let v; return ()=>v||(v=f()); };
// tileable value noise + fbm (per = lattice period, so textures wrap without seams)
function makeNoise(seed){ const R=mulberry(seed), P=new Float32Array(65536); for(let i=0;i<65536;i++) P[i]=R();
  return (x,y,per)=>{ const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi, u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
    const x0=((xi%per)+per)%per&255, x1=(((xi+1)%per)+per)%per&255, y0=((yi%per)+per)%per&255, y1=(((yi+1)%per)+per)%per&255;
    const a=P[y0*256+x0], b=P[y0*256+x1], c=P[y1*256+x0], d=P[y1*256+x1];
    return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }; }
const NZ=makeNoise(1337);
export function fbm(x,y,per,oct=4,N=NZ){ let s=0,a=.5,f=1,t=0; for(let o=0;o<oct;o++){ s+=N(x*f+o*17.3,y*f+o*31.7,per*f)*a; t+=a; a*=.5; f*=2; } return s/t; }
// fill a canvas pixel by pixel: fn(x,y) -> [r,g,b,a]
export function pxFill(g,w,h,fn){ const id=g.getImageData(0,0,w,h), d=id.data; let k=0; for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const c=fn(x,y); d[k]=c[0]; d[k+1]=c[1]; d[k+2]=c[2]; d[k+3]=c[3]??255; k+=4; } g.putImageData(id,0,0); }
// colour map + matching height (bump) map drawn together: fn(g,b,w,h) with g = colour ctx, b = height ctx (grey, white = high)
export function cvTex2(w,h,fn,rep=true){
  const cv=document.createElement('canvas'), bv=document.createElement('canvas'); cv.width=bv.width=w; cv.height=bv.height=h;
  const g=cv.getContext('2d',{willReadFrequently:true}), b=bv.getContext('2d',{willReadFrequently:true}); b.fillStyle='#808080'; b.fillRect(0,0,w,h);
  fn(g,b,w,h);
  const map=new THREE.CanvasTexture(cv), bump=new THREE.CanvasTexture(bv); map.colorSpace=THREE.SRGBColorSpace;
  for(const t of [map,bump]){ if(rep) t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=ANISO; }
  return {map,bump};
}
// multiply a noise layer over what is already drawn (keeps hand drawn details, adds grain)
export function grain(g,b,w,h,per,amt,seed=0,oct=4,bAmt=0){
  const id=g.getImageData(0,0,w,h), d=id.data, bd=b?b.getImageData(0,0,w,h):null; let k=0;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const n=fbm(x/w*per+seed,y/h*per+seed*.7,per,oct)-.5, r=Math.random()-.5, f=1+n*amt+r*amt*.35;
    d[k]=d[k]*f; d[k+1]=d[k+1]*f; d[k+2]=d[k+2]*f; if(bd){ const v=bd.data[k]+(n*bAmt+r*bAmt*.3)*255; bd.data[k]=bd.data[k+1]=bd.data[k+2]=v; } k+=4; }
  g.putImageData(id,0,0); if(bd) b.putImageData(bd,0,0);
}
// draw on both colour and height canvases with the same path
export function both(g,b,col,hcol,fn){ g.fillStyle=col; fn(g); if(b&&hcol!=null){ b.fillStyle=hcol; fn(b); } }
export const hg=v=>{ v=clamp(Math.round(v),0,255); return `rgb(${v},${v},${v})`; };
export const glowTex=cvTex(64,64,(g,w,h)=>{ const gr=g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.3,'rgba(255,255,255,.45)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
export function gridTex(bg,line,glow){ return cvTex(128,128,(g,w,h)=>{ g.fillStyle=bg; g.fillRect(0,0,w,h); g.strokeStyle=glow; g.lineWidth=6; g.globalAlpha=.25; g.strokeRect(0,0,w,h); g.globalAlpha=1; g.strokeStyle=line; g.lineWidth=2; g.strokeRect(0,0,w,h); },true); }
// world-space UVs for instanced boxes: facades tile by world x/z + height, roofs by world x/z
export function worldUV(mat,sx,sy,top=false){
  mat.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      { vec4 wq=modelMatrix*instanceMatrix*vec4(position,1.0); vec3 wn=normalize(mat3(modelMatrix*instanceMatrix)*normal);
        vec2 wuv=${top?'wq.xz/vec2('+sx.toFixed(2)+','+sy.toFixed(2)+')':'vec2((abs(wn.x)>.5?wq.z*sign(wn.x):-wq.x*sign(wn.z))/'+sx.toFixed(2)+', wq.y/'+sy.toFixed(2)+')'};
        #ifdef USE_MAP
        vMapUv=wuv;
        #endif
        #ifdef USE_EMISSIVEMAP
        vEmissiveMapUv=wuv;
        #endif
        #ifdef USE_BUMPMAP
        vBumpMapUv=wuv;
        #endif
      }`);
  };
  mat.customProgramCacheKey=()=>'wuv'+sx+sy+top;
  return mat;
}
