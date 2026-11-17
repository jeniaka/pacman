import {GS} from './state.js';
import {$, rand} from './utils.js';
// ================= AUDIO =================
let AC=null, master, sfxG, musG, noiseBuf; GS.muted=false;
export function initAudio(){
  if(AC){ if(AC.state==='suspended') AC.resume(); return; }
  try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
  const comp=AC.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=4; comp.connect(AC.destination);
  master=AC.createGain(); master.gain.value=GS.muted?0:.7; master.connect(comp);
  sfxG=AC.createGain(); sfxG.gain.value=.8; sfxG.connect(master);
  musG=AC.createGain(); musG.gain.value=.42; musG.connect(master);
  noiseBuf=AC.createBuffer(1,AC.sampleRate*1.5,AC.sampleRate);
  const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  music.next=AC.currentTime+.1;
}
export function setMute(m){ GS.muted=m; if(master) master.gain.setTargetAtTime(m?0:.7,AC.currentTime,.02); $('mute').textContent='M · SOUND '+(m?'OFF':'ON')+' · v16'; }
export function tone(o){
  if(!AC) return; const t=o.t??AC.currentTime, d=o.d??.1;
  const os=AC.createOscillator(), g=AC.createGain();
  os.type=o.type||'square'; os.frequency.setValueAtTime(o.f||440,t);
  if(o.f2) os.frequency.exponentialRampToValueAtTime(Math.max(1,o.f2),t+(o.sweep??d));
  if(o.det) os.detune.value=o.det;
  const v=o.v??.15; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+(o.a??.005));
  g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  let node=os;
  if(o.lp){ const f=AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=o.lp; f.Q.value=o.q??1; os.connect(f); node=f; }
  node.connect(g); g.connect(o.dest||sfxG); os.start(t); os.stop(t+d+.05);
}
export function noise(o){
  if(!AC) return; const t=o.t??AC.currentTime, d=o.d??.2;
  const s=AC.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
  const f=AC.createBiquadFilter(); f.type=o.ft||'lowpass'; f.frequency.setValueAtTime(o.f||2000,t); f.Q.value=o.q??1;
  if(o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20,o.f2),t+d);
  const g=AC.createGain(); const v=o.v??.2;
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+(o.a??.004)); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  s.connect(f); f.connect(g); g.connect(o.dest||sfxG); s.start(t,Math.random()); s.stop(t+d+.05);
}
export const now=()=>AC?AC.currentTime:0;
let munchAlt=0;
export const SFX={
  munch(){ munchAlt^=1; tone({f:munchAlt?660:495,f2:munchAlt?330:250,d:.07,v:.055,type:'triangle'}); },
  crunch(){ noise({f:2600,f2:500,d:.08,v:.09,ft:'bandpass',q:1.5}); tone({f:180,f2:90,d:.07,v:.06,type:'square',lp:900}); },
  power(){ const t=now(); [392,523,659,784,1046].forEach((f,i)=>tone({f,d:.12,v:.07,t:t+i*.05,type:'square',lp:3000})); },
  eatEnemy(){ tone({f:180,f2:1800,d:.28,v:.09,type:'square',lp:4000}); noise({f:6000,f2:1500,d:.15,v:.06,ft:'highpass'}); },
  die(){ const t=now(); for(let i=0;i<10;i++) tone({f:900-i*75,f2:700-i*70,d:.1,v:.07,t:t+i*.09,type:'square',lp:2500}); noise({f:900,f2:60,d:1.1,v:.15,t:t+.85}); },
  ready(){ const t=now(); const M=[[72,.12],[79,.12],[76,.12],[84,.24],[83,.12],[79,.12],[76,.24],[74,.12],[77,.12],[81,.12],[86,.36]];
    let tt=t; M.forEach(([n,d])=>{ const f=440*Math.pow(2,(n-69)/12); tone({f,d:d*.9,v:.07,t:tt,type:'square',lp:3200}); tone({f:f/4,d:d*.9,v:.06,t:tt,type:'triangle'}); tt+=d; }); },
  glitch(){ noise({f:rand(800,6000),d:rand(.04,.12),v:.07,ft:'bandpass',q:4}); },
  alarm(){ const t=now(); for(let i=0;i<4;i++){ tone({f:880,d:.18,v:.08,t:t+i*.4,type:'sawtooth',lp:2400}); tone({f:660,d:.18,v:.08,t:t+i*.4+.2,type:'sawtooth',lp:2400}); } },
  boom(big){ noise({f:big?2400:3600,f2:60,d:big?1.4:.45,v:big?.45:.25}); tone({f:big?130:180,f2:30,d:big?.9:.3,v:big?.4:.22,type:'sine'}); },
  hurt(){ noise({f:900,f2:60,d:.5,v:.35}); tone({f:220,f2:40,d:.45,v:.25,type:'sawtooth',lp:1200}); },
  turbo(){ tone({f:200,f2:1400,d:.35,v:.07,type:'sawtooth',lp:3000}); },
  warn(){ tone({f:1200,d:.06,v:.05,type:'square'}); },
  laser(){ tone({f:1600,f2:120,d:.5,v:.07,type:'sawtooth',lp:3000}); noise({f:4000,f2:300,d:.5,v:.08}); },
  shot(){ tone({f:900,f2:300,d:.08,v:.025,type:'square',lp:2500}); },
  whoosh(){ noise({f:400,f2:5000,d:1.2,v:.25,ft:'bandpass',q:.8}); },
  slam(){ noise({f:1200,f2:40,d:.9,v:.5}); tone({f:90,f2:25,d:.8,v:.5,type:'sine'}); },
  hole(){ tone({f:400,f2:40,d:1.5,v:.14,type:'sawtooth',lp:900}); noise({f:300,f2:2000,d:1.2,v:.12,ft:'bandpass'}); },
  coin(){ const t=now(); tone({f:988,d:.08,v:.06,t,type:'square'}); tone({f:1319,d:.3,v:.06,t:t+.08,type:'square'}); },
  win(){ const t=now(); [60,64,67,72,67,72,76,79,84].forEach((n,i)=>{ const f=440*Math.pow(2,(n-69)/12); tone({f,d:.22,v:.07,t:t+i*.13,type:'square',lp:3500}); tone({f:f/2,d:.22,v:.05,t:t+i*.13,type:'triangle'}); }); },
};

// ================= MUSIC =================
const mf=n=>440*Math.pow(2,(n-69)/12);
export const music={next:0,step:0,song:null,rate:1};
function kick(t,v=.5){ tone({f:150,f2:40,d:.22,v,t,type:'sine',sweep:.12,dest:musG}); }
function snare(t,v=.22){ noise({f:1800,d:.14,v,t,ft:'bandpass',q:.9,dest:musG}); tone({f:220,f2:120,d:.08,v:v*.4,t,type:'triangle',dest:musG}); }
function hat(t,v=.06){ noise({f:8000,d:.035,v,t,ft:'highpass',dest:musG}); }
function mkSong(o){
  return {bpm:o.bpm,len:16*o.roots.length,play(i,t,spb){
    const bar=Math.floor(i/16)%o.roots.length, st=i%16, r=o.roots[bar];
    if(o.k&&o.k[st]==='x') kick(t,o.kv??.45);
    if(o.s&&o.s[st]==='x') snare(t,o.sv??.2);
    if(o.h&&o.h[st]==='x') hat(t,o.hv??.05);
    const b=o.bass&&o.bass[st]; if(b!=null&&b!=='.') tone({f:mf(r+(+b)),d:spb*(o.bl??1.6),v:o.bv??.12,t,type:o.bt||'sawtooth',lp:o.blp??600,dest:musG});
    if(o.arp){ const a=o.arp[st%o.arp.length]; if(a!=null) tone({f:mf(r+12+a),d:spb*.9,v:o.av??.035,t,type:o.at||'square',lp:o.alp??2600,dest:musG}); }
  }};
}
const SONGS={
  p1:mkSong({bpm:118,roots:[45,45,41,43],bass:['0',null,'12',null,'0',null,'12',null,'0',null,'12',null,'7',null,'12',null],bt:'square',blp:500,bv:.06,bl:1}),
  p2:mkSong({bpm:112,roots:[45,41,48,43],k:'x...x...x...x...',s:'....x.......x...',h:'..x...x...x...x.',bass:['0','0','12','0','0','0','12','0','0','0','12','0','0','0','12','7'],bl:.9,bv:.1,blp:700,arp:[0,7,12,15,19,15,12,7],av:.03,alp:2200}),
  p3:mkSong({bpm:132,roots:[40,40,43,38],k:'x..xx...x..x..x.',s:'....x.......x..x',h:'x.x.x.x.x.x.x.x.',bass:['0','0','.','0','12','0','.','0','0','3','.','0','12','0','10','0'],bt:'sawtooth',blp:900,bv:.12,bl:.8,arp:[0,null,3,null,7,null,3,null],av:.025}),
  p4:mkSong({bpm:146,roots:[50,46,41,48],k:'x...x...x...x...',s:'....x.......x...',h:'xxxxxxxxxxxxxxxx',hv:.035,bass:['0','.','12','.','0','.','12','.','0','.','12','.','0','.','12','.'],bv:.11,bl:1.2,arp:[0,4,7,12,16,12,7,4,0,7,12,19,24,19,12,7],at:'triangle',av:.045,alp:4000}),
  boss:mkSong({bpm:158,roots:[40,41,40,43],k:'x.x.x.x.x.x.x.x.',kv:.4,s:'....x.......x.x.',h:'.x.x.x.x.x.x.x.x',bass:['0','0','12','0','1','0','12','0','0','0','12','0','3','0','1','0'],bv:.12,bl:.7,blp:1100,arp:[0,3,6,12,6,3],av:.03}),
  p6:mkSong({bpm:150,roots:[48,53,55,48],k:'x...x...x...x...',s:'....x.......x...',h:'..x...x...x...x.',bass:['0','.','7','.','12','.','7','.','0','.','7','.','12','7','5','4'],bt:'square',blp:900,bv:.07,bl:.8,arp:[0,4,7,12,7,4,0,null,4,7,12,16,12,7,4,null],at:'square',av:.022,alp:2800}),
  calm:mkSong({bpm:90,roots:[48,45,41,43],bass:['0',null,null,null,'7',null,null,null,'12',null,null,null,'7',null,null,null],bt:'triangle',bv:.1,bl:3.5,arp:[0,null,7,null,12,null,16,null],at:'triangle',av:.03}),
};
export function setSong(n){ music.song=n?SONGS[n]:null; music.step=0; if(AC) music.next=AC.currentTime+.06; }
export function musicTick(){
  if(!AC||!music.song) return;
  const s=music.song, spb=60/(s.bpm*music.rate)/4;
  if(music.next<AC.currentTime-.3) music.next=AC.currentTime+.02;
  while(music.next<AC.currentTime+.12){ s.play(music.step%s.len,music.next,spb); music.next+=spb; music.step++; }
}
