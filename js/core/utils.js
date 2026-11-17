import {GS} from './state.js';

// ================= UTILS =================
export const $=id=>document.getElementById(id);
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const rand=(a,b)=>a+Math.random()*(b-a);
export const irand=(a,b)=>Math.floor(rand(a,b+1));
export const pick=a=>a[Math.floor(Math.random()*a.length)];
export const easeOut=t=>1-Math.pow(1-t,3);
export const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
export const PI=Math.PI, TAU=PI*2;
export const TOUCH=('ontouchstart' in window)||navigator.maxTouchPoints>0;
GS.HI=0; try{GS.HI=+localStorage.getItem('munchbot80hi')||0}catch(e){}
GS.GOD=false;
export const pad=(n,l=6)=>String(Math.floor(n)).padStart(l,'0');
export function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
