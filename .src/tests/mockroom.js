// 测试用：用 BroadcastChannel 模拟 claude.use('room')，让同一浏览器里的两个页面互相联机
(()=>{const me=Math.random().toString(36).slice(2,10);const enc=new TextEncoder();window.__mockErrs=[];
function mkRoom(chName){const ch=new BroadcastChannel(chName);const peers=new Map();let myPres={};const evL={};const peerL=new Set();
 const snap=()=>[...peers.values()].map(p=>({...p,isMe:p.peer===me,sameTab:p.peer===me,kind:'viewer',by:null,guest:false}));
 const fire=(j=[],l=[])=>{const ps=snap();for(const f of peerL)f({peers:ps,joined:j,left:l,updated:[]});};
 peers.set(me,{peer:me,presence:{},updatedAt:Date.now()});
 ch.onmessage=e=>{const d=e.data;if(d.type==='pres'){const isNew=!peers.has(d.peer);peers.set(d.peer,{peer:d.peer,presence:d.p,updatedAt:Date.now()});if(isNew)ch.postMessage({type:'pres',peer:me,p:myPres});fire(isNew?[{peer:d.peer}]:[],[]);}
  else if(d.type==='bye'){peers.delete(d.peer);fire([],[{peer:d.peer}]);}
  else if(d.type==='ev'){(evL[d.topic]||[]).forEach(f=>f({topic:d.topic,data:d.data,peer:d.peer,isMe:false,sameTab:false,kind:'viewer',by:null,guest:false}));}};
 return {name:chName,emit:async(topic,data)=>{const n=enc.encode(JSON.stringify(data)).length;if(n>4096){window.__mockErrs.push(topic+' '+n);throw {code:'invalid_argument',message:'too big '+n};}ch.postMessage({type:'ev',topic,data,peer:me});(evL[topic]||[]).forEach(f=>f({topic,data,peer:me,isMe:true,sameTab:true}));},
  on:(t,f)=>{(evL[t]=evL[t]||[]).push(f);return()=>{evL[t]=evL[t].filter(x=>x!==f)}},
  presence:async p=>{for(const k in p){if(p[k]===null)delete myPres[k];else myPres[k]=p[k];}peers.set(me,{peer:me,presence:{...myPres},updatedAt:Date.now()});ch.postMessage({type:'pres',peer:me,p:{...myPres}});fire();},
  peers:()=>snap(),onPeers:f=>{peerL.add(f);setTimeout(()=>f({peers:snap(),joined:snap(),left:[],updated:[]}),0);return()=>peerL.delete(f)},
  connected:()=>true,onConnection:f=>{setTimeout(()=>f(true));return()=>{}},leave:async()=>{ch.postMessage({type:'bye',peer:me});ch.close();}};}
const lobby=mkRoom('lobby');lobby.join=async n=>{const r=mkRoom('nr-'+n);await r.presence({});return r;};
window.claude={use:async n=>n==='room'?lobby:null};})();
