// ================= UTIL =================
const $=s=>document.querySelector(s);
const rnd=Math.random;
const randn=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const pick=a=>a[Math.floor(rnd()*a.length)];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fmt(n,dec){if(n==null||isNaN(n))return '—';const s=n<0?'-':'';n=Math.abs(n);
  if(n>=1e8)return s+'¥'+(n/1e8).toFixed(2)+'亿';if(n>=1e4)return s+'¥'+(n/1e4).toFixed(n>=1e6?0:1)+'万';return s+'¥'+n.toFixed(dec??(n<100&&n%1?2:0))}
const chipLbl=v=>v>=1e8?(v/1e8)+'亿':v>=1e4?(+(v/1e4).toFixed(1))+'万':v>=1000?(v/1000)+'K':String(v);
const fmtP=n=>n>=1000?Math.round(n).toLocaleString('zh-CN'):n.toFixed(2);
const fmtQ=n=>n>=1e4?(n/1e4).toFixed(1)+'万':(Math.round(n*100)/100).toLocaleString('zh-CN');
const pct=(x,d=2)=>(x>=0?'+':'')+(x*100).toFixed(d)+'%';
const cls=x=>x>0?'up':x<0?'down':'';
const START=new Date(2026,0,5);
function dateOf(day){const d=new Date(START);d.setDate(d.getDate()+day);return d}
function dateStr(day,short){const d=dateOf(day);return short?`${d.getMonth()+1}/${d.getDate()}`:`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`}
const weekday=day=>'周'+'日一二三四五六'[dateOf(day).getDay()];
const isWeekend=day=>{const w=dateOf(day).getDay();return w===0||w===6};
const whCap=l=>100*Math.pow(2,l);
const fleetCap=l=>60*Math.pow(2,l);
const spread=l=>Math.max(.0015,.006-.0008*l);
const xpNeed=L=>Math.round(60*Math.pow(1.75,L-1));
const todayKey=()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
function setHTML(el,h){if(el&&el._h!==h){el.innerHTML=h;el._h=h}}
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

// —— 性能工具 ——
// 把多次 refresh() 合并到同一帧，避免一帧内重复构建 DOM
function raf(fn){return requestAnimationFrame(fn)}
// 只更新变化的文本节点，避免整块 innerHTML 重建
function setTxt(el,v){if(el&&el.textContent!==v)el.textContent=v}
function setAttr(el,k,v){if(el&&el.getAttribute(k)!==v)el.setAttribute(k,v)}
function setCls(el,v){if(el&&el.className!==v)el.className=v}
// 图表数据注册表：取代把数组 JSON 塞进 data-* 属性（每帧序列化+解析的开销）
const CH=new Map();let __chId=0;
function chReg(data){const id='c'+(++__chId);CH.set(id,data);if(CH.size>400)CH.clear();return id}
const uid=((p,n=0)=>()=>p+(++n))('u');

