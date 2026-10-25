// ================= FX =================
// toast：同文案去重（避免每次刷新刷屏）、限长、可点掉、带类型
const _toastSeen=new Map();
function toast(t,k){
  t=String(t);
  const box=$('#toasts');if(!box)return;
  const now=Date.now(),prev=_toastSeen.get(t);
  if(prev&&now-prev<900)return;
  _toastSeen.set(t,now);
  if(_toastSeen.size>80)for(const [key,ts] of _toastSeen)if(now-ts>6000)_toastSeen.delete(key);
  const el=document.createElement('div');el.className='toast'+(k?' '+k:'');
  const span=document.createElement('span');span.textContent=t;el.appendChild(span);
  const x=document.createElement('span');x.className='cls';x.textContent='×';el.appendChild(x);
  const kill=()=>{el.style.opacity='0';el.style.transform='translateX(8px)';setTimeout(()=>el.remove(),160)};
  el.addEventListener('click',kill);
  box.appendChild(el);
  setTimeout(kill,k==='lv'?3800:2600);
  while(box.children.length>3)box.children[0].remove();
}
let actx=null,muted=false;try{muted=localStorage.getItem('sh_mute')==='1'}catch(e){}
function snd(type){if(muted)return;try{actx=actx||new (window.AudioContext||window.webkitAudioContext)()}catch(e){return}if(!actx)return;
  const seq={click:[[880,.025,'sine']],coin:[[1175,.06,'sine'],[1568,.14,'sine']],buy:[[660,.05,'sine'],[880,.07,'sine']],bad:[[196,.16,'triangle']],lv:[[523,.12,'sine'],[784,.12,'sine'],[1047,.32,'sine']],card:[[2200,.02,'triangle']],chip:[[1800,.025,'square'],[2400,.02,'square']],tick:[[1400,.012,'square']],ai:[[1319,.05,'sine'],[1760,.07,'sine']]}[type]||[[700,.04,'sine']];
  let t=actx.currentTime;for(const [f,d,w] of seq){const o=actx.createOscillator(),g=actx.createGain();o.type=w;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(type==='chip'||type==='tick'?.04:.09,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(actx.destination);o.start(t);o.stop(t+d+.02);t+=d*.85}}
function floaty(txt,color){const ref=win?$('#winRoot .x'):$('#cashFig');if(!ref)return;const r=ref.getBoundingClientRect();const el=document.createElement('div');el.className='floaty';el.textContent=txt;el.style.color=color||'var(--gold-hi)';el.style.left=(win?r.left-170:r.left)+'px';el.style.top=(win?r.top+4:r.bottom+2)+'px';document.body.appendChild(el);setTimeout(()=>el.remove(),1500)}
