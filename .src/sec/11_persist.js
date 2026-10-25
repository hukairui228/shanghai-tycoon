// ================= PERSIST / MULTIPLAYER =================
const LS='shanghai_tycoon_v1';
let db=null,userCap=null,myId=null,canWrite=true,players=[],lastPush=0,profiles={};
function snapshot(){S.pokerStack=tableValue();
  // 记住上次待的港口/品种，下次打开直接接着玩
  if(typeof ui==='object'&&ui)S.ui={city:ui.city,good:ui.good,mode:ui.mode,stock:ui.stock,smode:ui.smode,luxCat:ui.luxCat,from:ui.from,to:ui.to,sgood:ui.sgood,pct:ui.pct,spct:ui.spct,shpct:ui.shpct,bamt:ui.bamt};
  const s=JSON.stringify(S);S.pokerStack=0;return s}
function save(){if(!S||!S.started)return;const js=snapshot();try{localStorage.setItem(LS,js)}catch(e){}
  if(db&&myId&&canWrite)db.doc('data/users/'+myId+'/game').set({json:js,day:S.day}).catch(e=>{if(e&&e.code==='invalid_argument')canWrite=false});pushPlayer()}
function exportSave(){
  const blob=new Blob([snapshot()],{type:'application/json'});const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`商海浮沉-${dateStr(S.day)}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('存档已导出')}
function importSave(file){if(!file)return;const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);if(!d||!d.started)throw new Error('不是有效存档');
    S=migrate(d);S.inMacau=false;$('#modalRoot').innerHTML='';mq.length=0;modalOpen=false;win=null;$('#winRoot').innerHTML='';
    if(S.ui)Object.assign(ui,S.ui);setSpeed(1);refresh();save();toast('存档已导入','lv')}catch(e){toast('存档格式不对：'+e.message,'bad')}};
  r.readAsText(file)}

function pushPlayer(force){if(!db||!myId||!canWrite||!S||!S.started)return;const now=Date.now();if(!force&&now-lastPush<15000)return;lastPush=now;
  const top=S.owned.map(o=>LUXBY[o.id]).sort((a,b)=>b.p-a.p)[0];
  db.doc('players/'+myId).set({company:String(S.company).slice(0,24),nw:Math.round(netWorth()),level:S.level,day:S.day,ach:Object.keys(S.ach).length,top:top?top.n:'',ipo:!!S.ipo,at:now}).catch(e=>{if(e&&e.code==='invalid_argument')canWrite=false})}
async function initCloud(){try{const cl=window.claude;if(!cl||!cl.use)return;userCap=await cl.use('user');db=await cl.use('db');if(!db)return;
  myId=userCap?await userCap.id():null;if(userCap&&userCap.can){const w=await userCap.can('data.write');if(w===false)canWrite=false}
  db.collection('players').orderBy('nw','desc').limit(50).onSnapshot(async snap=>{players=snap.docs.map(d=>({id:d.id,...d.data()}));if(userCap&&userCap.profiles){try{profiles=await userCap.profiles(players.map(p=>p.id))}catch(e){}}refresh()});
  if(myId){const snap=await db.doc('data/users/'+myId+'/game').get();if(snap.exists){const d=snap.data();if(d&&d.json){try{const cloud=JSON.parse(d.json);if(cloud.started&&(!S||!S.started||cloud.day>S.day)){S=migrate(cloud);S.inMacau=false;$('#modalRoot').innerHTML='';mq.length=0;modalOpen=false;setSpeed(speed||1);refresh();toast('已读取云端存档')}}catch(e){}}}}
}catch(e){}}
