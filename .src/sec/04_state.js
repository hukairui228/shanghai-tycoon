// ================= STATE =================
let S=null;
function mkCandles(p0,vol,n){const out=[];let p=p0;for(let i=0;i<n;i++){const o=p;p=p*(1+randn()*vol);const hi=Math.max(o,p)*(1+Math.abs(randn())*vol*.5),lo=Math.min(o,p)*(1-Math.abs(randn())*vol*.5);out.push([o,hi,lo,p])}
  const k=p0/p;return out.map(c=>c.map(v=>+(v*k).toFixed(2)))}
function newGame(company){
  const s={v:4,company:company||'未命名贸易行',day:0,cash:150000,xp:0,level:1,prestige:0,loan:0,rate:.055,
    mkt:{},trend:{},inv:{},ships:[],stk:{},hold:{},owned:[],upg:{wh:0,fleet:0,speed:0,trader:0,analyst:0,office:0},
    offers:[],contracts:[],rivals:RIVALS.map(r=>({id:r.id,nw:r.nw,shares:Math.round(r.nw/(12+rnd()*10))})),
    events:[],queued:[],news:[],nwHist:[],stats:{tradeProfit:0,stockProfit:0,trades:0,contracts:0,maxNW:0,spins:0,insPaid:0,insClaim:0,nego:0},
    ach:{},tut:0,goal:null,ipo:false,nextDecision:16,pendingInv:[],shipId:1,offerId:1,seen:{},wheel:'',wheelAng:0,
    casino:{net:0,wagered:0,trips:0},jackpot:{},pokerStack:0,
    // v4 新增
    macro:{id:'recover',until:45},intel:0,rivalIntent:null,month:{start:0,nw:0},
    ai:{events:0,generated:0,lastAt:0}};
  for(const g of GOODS)s.trend[g.id]=1;
  for(const c of CITIES){s.mkt[c.id]={};s.inv[c.id]={};
    for(const g of GOODS){const p=g.base*c.cf[g.id]*(1+randn()*.02);s.mkt[c.id][g.id]={p,prev:p,h:[]};
      for(let i=0;i<30;i++)s.mkt[c.id][g.id].h.push(+(p*(1+randn()*g.vol*1.5)).toPrecision(5))}}
  for(const st of STOCKS){const c=mkCandles(st.p,st.vol,50);s.stk[st.s]={p:st.p,prev:c[c.length-1][0],c,earn:Math.floor(rnd()*80)+20}}
  for(const r of RIVALS){const rv=s.rivals.find(x=>x.id===r.id);const p=+(rv.nw/rv.shares).toFixed(2);const c=mkCandles(p,.02,50);s.stk[r.s]={p,prev:c[c.length-1][0],c,earn:1e9}}
  s.month.nw=0;
  return s}
function migrate(s){s.seen=s.seen||{};s.pendingInv=s.pendingInv||[];s.stats.spins=s.stats.spins||0;s.wheel=s.wheel||'';s.wheelAng=s.wheelAng||0;
  s.casino=s.casino||{net:0,wagered:0,trips:0};s.jackpot=s.jackpot||{};
  if(s.pokerStack){s.cash+=s.pokerStack;s.pokerStack=0}
  for(const k in s.stk){const q=s.stk[k];if(!q.c){q.c=(q.h||[q.p]).map((v,i,a)=>{const o=i?a[i-1]:v;return [o,Math.max(o,v),Math.min(o,v),v]});delete q.h}}
  // v3/v4 兼容
  s.v=4;
  s.stats=s.stats||{};for(const k of ['tradeProfit','stockProfit','trades','contracts','maxNW','spins','insPaid','insClaim','nego'])s.stats[k]=s.stats[k]||0;
  if(!s.macro||!MACROBY[s.macro.id])s.macro={id:'recover',until:s.day+45};
  s.intel=s.intel||0;if(s.rivalIntent===undefined)s.rivalIntent=null;
  if(!s.month)s.month={start:s.day,nw:netWorthRaw(s)};
  if(!s.ai)s.ai={events:0,generated:0,lastAt:0};
  for(const sh of s.ships)if(sh.ins===undefined)sh.ins=false;
  s.upg=s.upg||{wh:0,fleet:0,speed:0,trader:0,analyst:0,office:0};
  for(const k of ['wh','fleet','speed','trader','analyst','office'])s.upg[k]=s.upg[k]||0;
  return s}
// migrate 期间 S 可能还没赋值，用纯函数版本
function netWorthRaw(s){let t=s.cash||0;
  for(const c in s.inv||{})for(const g in s.inv[c])t+=s.inv[c][g].q*(s.mkt[c]&&s.mkt[c][g]?s.mkt[c][g].p:0)*(1-spread((s.upg&&s.upg.trader)||0));
  for(const x of s.ships||[])t+=x.q*((s.mkt[x.to]&&s.mkt[x.to][x.good])?s.mkt[x.to][x.good].p:0);
  for(const k in s.hold||{})t+=s.hold[k].q*((s.stk[k]||{}).p||0);
  for(const o of s.owned||[])t+=o.val;
  for(const x of s.pendingInv||[])t+=x.amt;
  return t-(s.loan||0)}

const upgLv=id=>S.upg[id]||0;
const cityUnlocked=c=>S.level>=C[c].lv;
const goodUnlocked=g=>S.level>=G[g].lv;
const unlockedCities=()=>CITIES.filter(c=>cityUnlocked(c.id));
const unlockedGoods=()=>GOODS.filter(g=>goodUnlocked(g.id));
function invUsed(city){let t=0;for(const k in S.inv[city])t+=S.inv[city][k].q*G[k].sz;return t}
const shipUsed=()=>S.ships.reduce((a,x)=>a+x.q*G[x.good].sz,0);
const bidP=(c,g)=>S.mkt[c][g].p*(1-spread(upgLv('trader')));
const askP=(c,g)=>S.mkt[c][g].p*(1+spread(upgLv('trader')));
const depthOf=(c,g)=>G[g].depth*C[c].depth*(1+.25*upgLv('trader'));
function invValue(){let t=0;for(const c in S.inv)for(const g in S.inv[c])t+=S.inv[c][g].q*bidP(c,g);return t}
const shipValue=()=>S.ships.reduce((a,x)=>a+x.q*bidP(x.to,x.good),0);
function stockValue(){let t=0;for(const s in S.hold)t+=S.hold[s].q*S.stk[s].p;return t}
const luxValue=()=>S.owned.reduce((a,o)=>a+o.val,0);
const pendingInvValue=()=>S.pendingInv.reduce((a,x)=>a+x.amt,0);
const tableValue=()=>(HD?HD.players[0].stack:0)+(CS.phase==='bet'?betTotal():0);
const netWorth=()=>S.cash+invValue()+shipValue()+stockValue()+luxValue()+pendingInvValue()+tableValue()-S.loan;
const creditLimit=()=>Math.max(0,(netWorth()+S.loan)*.5+S.level*60000)*(1+Math.min(S.prestige,3000)/3000);
const prestigeTotal=()=>S.prestige+upgLv('office')*40+S.owned.reduce((a,o)=>a+LUXBY[o.id].pr,0);
function dailyCost(){let c=150+S.level*60;for(const u of UPG)c+=upgLv(u.id)*u.sal;return c+S.owned.reduce((a,o)=>a+LUXBY[o.id].up,0)}
const rewardMul=()=>1+Math.min(prestigeTotal(),6000)/12000;
const shipDays=(a,b)=>Math.max(1,Math.round(dist(a,b)/(1+.15*upgLv('speed'))));
const freight=(a,b,g,q)=>Math.round(1500+q*G[g].sz*shipDays(a,b)*9+q*bidP(a,g)*.002);
function quoteBuy(city,g,q){const f=q/depthOf(city,g);const u=askP(city,g)*(1+f/2);return {unit:u,total:u*q,impact:f}}
function quoteSell(city,g,q){const f=q/depthOf(city,g);const u=bidP(city,g)*(1-f/2);return {unit:u,total:u*q,impact:f}}
function maxBuy(city,g){const room=(whCap(upgLv('wh'))-invUsed(city))/G[g].sz;let lo=0,hi=Math.max(0,Math.floor(room+1e-9));if(hi<=0)return 0;
  if(quoteBuy(city,g,hi).total<=S.cash)return hi;while(hi-lo>1){const m=Math.floor((lo+hi)/2);if(quoteBuy(city,g,m).total<=S.cash)lo=m;else hi=m}return lo}
const TIERS=[[.3,'至尊','PLATINUM','#d9d4c7'],[.22,'尊享','GOLD','#c8a96a'],[.15,'优选','SILVER','#9aa3ad'],[0,'标准','BRONZE','#9a6f4f']];
const tier=p=>TIERS.find(t=>p>=t[0]);
function bestArb(){let best=null;for(const g of unlockedGoods())for(const a of unlockedCities())for(const b of unlockedCities()){if(a.id===b.id)continue;const r=(bidP(b.id,g.id)-askP(a.id,g.id))/askP(a.id,g.id);if(!best||r>best.r)best={g,a,b,r}}return best}
