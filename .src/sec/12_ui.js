// ================= UI =================
let speed=1,timer=null,win=null,modalOpen=false,dragging=false;
const ui={city:'sh',good:null,mode:'b',pct:30,stock:'600831',smode:'b',spct:25,luxCat:'watch',
  from:null,to:null,sgood:null,shpct:100,bamt:50,ins:false};
const DESKS=[
 {id:'trade',n:'交易所',en:'Commodities',k:'1'},{id:'port',n:'航运',en:'Shipping',k:'2'},
 {id:'deal',n:'合同',en:'Contracts',k:'3'},{id:'stock',n:'证券',en:'Equities',k:'4'},
 {id:'bank',n:'私人银行',en:'Private Bank',lv:2,k:'5'},{id:'hq',n:'总部',en:'Headquarters',k:'6'},
 {id:'lux',n:'珍藏',en:'Collection',k:'7'},{id:'macau',n:'澳门',en:'Macau · Grand Palace',wide:1,k:'8'},
 {id:'rank',n:'富豪榜',en:'Rich List',k:'9'},{id:'wheel',n:'每日红利',en:'Daily Dividend'},
 {id:'ach',n:'荣誉',en:'Honours'},
];
const WT={trade:['交易所','Commodities Exchange'],port:['航运','Shipping & Logistics'],deal:['合同','Contracts Desk'],
  stock:['证券','Equities'],bank:['私人银行','Private Banking'],hq:['总部','Headquarters'],lux:['珍藏','The Collection'],
  macau:['澳门 · 金殿娱乐场','Grand Palace Casino · Macau'],rank:['富豪榜','Rich List'],wheel:['每日红利','Daily Dividend'],
  ach:['荣誉','Honours'],settings:['设置','Preferences']};
const readyContracts=()=>S.contracts.filter(k=>{const i=S.inv[k.city][k.good];return i&&i.q>=k.q-1e-9}).length;
const affordableUpg=()=>UPG.filter(u=>upgLv(u.id)<u.max&&!(u.lv&&S.level<u.lv)&&S.cash>=u.cost(upgLv(u.id))).length;
function idx(){let v=0,p=0;for(const st of STOCKS){v+=S.stk[st.s].p/st.p;p+=S.stk[st.s].prev/st.p}return {v:v/STOCKS.length*3000,ch:p?v/p-1:0}}
function deskStatus(id){switch(id){
 case'trade':{const b=bestArb();return b&&b.r>0?`价差机会 · ${b.g.n} ${b.a.n}→${b.b.n} <b class="up">${pct(b.r,1)}</b>`:'各港口价格平稳'}
 case'port':return S.ships.length?`<b>${S.ships.length}</b> 艘在途 · 最近 ${Math.min(...S.ships.map(s=>s.eta-S.day))} 天到港`:'船队在港待命';
 case'deal':{const r=readyContracts();return r?`<b class="gold">${r} 份可交付</b>`:`${S.offers.length} 份新订单 · ${S.contracts.length} 份执行中`}
 case'stock':{const i=idx();return isWeekend(S.day)?'周末休市':`综指 <b>${i.v.toFixed(0)}</b> <span class="${cls(i.ch)}">${pct(i.ch)}</span>`}
 case'lux':{const nx=LUX.filter(l=>!S.owned.some(o=>o.id===l.id)).sort((a,b)=>a.p-b.p)[0];return S.owned.length?`藏品 <b>${S.owned.length}</b> 件 · 估值 ${fmt(luxValue())}`:nx?`可选 · ${nx.n}`:''}
 case'bank':return S.loan?`负债 <b>${fmt(S.loan)}</b> · 年息 ${(S.rate*100).toFixed(2)}%`:`授信 <b>${fmt(creditLimit())}</b>`;
 case'hq':{const n=affordableUpg();return n?`<b class="gold">${n}</b> 项升级可执行`:`日常开支 ${fmt(dailyCost())}`}
 case'macau':return `百家乐 · 德州扑克 · 老虎机 ｜ 中场 · 贵宾厅 · 至尊厅<br><span class="muted">${S.casino.trips?`累计 ${S.casino.net>=0?'+':''}${fmt(S.casino.net)} · 到访 ${S.casino.trips} 次`:'经济舱 ¥2,800 起'}</span>`;
 case'rank':return `当前第 <b>${myRank()}</b> 名`;
 case'wheel':return S.wheel===todayKey()?'今日已领取':'<b class="gold">今日可领取</b>';
 case'ach':return `<b>${Object.keys(S.ach).length}</b> / ${ACH.length}`}}
function deskBadge(id){if(id==='deal')return readyContracts();if(id==='wheel')return S.wheel===todayKey()?0:1;if(id==='hq')return affordableUpg();if(id==='trade'){const b=bestArb();return b&&b.r>.03?1:0}return 0}
function rankRows(){const rows=[{me:1,name:S.company,who:'你',nw:netWorth(),level:S.level}];
  for(const r of RIVALS){const rv=S.rivals.find(x=>x.id===r.id);rows.push({ai:1,name:r.co,who:`${r.boss} · ${r.style}`,nw:rv.nw,level:lvFromNW(rv.nw)})}
  for(const p of players){if(p.id===myId)continue;const pr=profiles[p.id];rows.push({real:1,name:p.company||'神秘商人',who:(pr&&pr.name)||'玩家',nw:+p.nw||0,level:+p.level||1,top:p.top,on:Date.now()-(+p.at||0)<120000,ipo:p.ipo})}
  return rows.sort((a,b)=>b.nw-a.nw)}
const myRank=()=>rankRows().findIndex(r=>r.me)+1;
function lvFromNW(nw){let L=1;const t=[0,0,3e5,8e5,2e6,5e6,1.2e7,3e7,8e7,2e8,5e8,1.2e9,3e9,8e9,2e10,5e10];while(L<15&&nw>=t[L+1])L++;return L}

// —— 渲染调度：一帧只刷一次，且只改动真正变了的节点 ——
let __raf=0,__flushing=false;
function refresh(){if(!S)return;if(!__raf)__raf=requestAnimationFrame(flush)}
function flush(){
  __raf=0;if(!S)return;
  try{
    paintTop();paintMain();paintSide();paintTicker();
    if(win)renderWin();
    paintAI();
  }catch(e){console.error('paint error',e)}
}

// ---------- 顶栏 ----------
function buildTop(){
  const el=$('#top');if(!el||el._built)return;
  el.innerHTML=`<button class="mark" type="button" data-open="hq" aria-label="总部"><span class="mono" id="coMon">·</span><span style="min-width:0"><span class="co" id="coName" style="display:block"></span><span class="ti">Lv<span id="lvN">1</span>&nbsp;<span id="lvT"></span><span class="xp"><i id="xpBar"></i></span></span></span></button>
   <div class="figs"><div><span class="cap">Cash</span><b id="cashFig">—</b></div><div><span class="cap">Net Worth</span><b id="nwFig">—</b></div><div><span class="cap">Prestige</span><b id="presFig">—</b></div></div>
   <div class="env">
     <button class="intelp" type="button" data-intel-desk aria-label="情报点数" title="情报点数：研究部每日产出，可换取确定性信息">${ic('intel')}<span>情报</span><b id="intelN">0</b></button>
     <span class="macro" id="macroChip"><i></i><b></b></span>
   </div>
   <div class="ctl"><div class="date"><div class="d" id="dateD"></div><div class="w" id="dateW"></div></div>
   <div class="seg" id="speedSeg">${[[0,'暂停'],[1,'1×'],[2,'2×'],[4,'4×']].map(([s,l])=>`<button type="button" data-speed="${s}" class="${speed===s?'on':''}">${l}</button>`).join('')}</div>
   <button class="ib" type="button" id="muteBtn" aria-label="音效">${ic(muted?'mute':'snd')}</button>
   <button class="ib" type="button" data-open="settings" aria-label="设置" title="设置（S）">${ic('gear2')}</button></div>`;
  el._built=1;
}
function paintTop(){
  buildTop();const el=$('#top');if(!el)return;
  const nw=netWorth(),need=xpNeed(S.level),p=S.level>=15?1:clamp(S.xp/need,0,1);
  setTxt($('#coMon'),String(S.company).slice(0,1));
  setTxt($('#coName'),S.company);
  setTxt($('#lvN'),String(S.level));
  setTxt($('#lvT'),TITLES[S.level]);
  const bar=$('#xpBar');if(bar){const w=(p*100).toFixed(1)+'%';if(bar.style.width!==w)bar.style.width=w}
  setTxt($('#cashFig'),fmt(S.cash));
  setTxt($('#nwFig'),fmt(nw));
  setTxt($('#presFig'),String(prestigeTotal()));
  setTxt($('#intelN'),String(Math.round(S.intel)));
  const ib=$('.intelp');if(ib){const on=S.intel>=INTEL_COST.event;if(ib.classList.contains('on')!==on)ib.classList.toggle('on',on);
    const t=`情报点数 ${Math.round(S.intel)} · 研究部每日 ${upgLv('analyst')*2} 点`;if(ib.title!==t)ib.title=t}
  const mb=macro(),chip=$('#macroChip');
  if(chip){const cl='macro '+mb.id;if(chip.className!==cl)chip.className=cl;setTxt(chip.querySelector('b'),mb.n);
    const t=`宏观周期：${mb.n} · ${mb.d} · 还剩 ${Math.max(0,S.macro.until-S.day)} 天`;if(chip.title!==t)chip.title=t}
  setTxt($('#dateD'),dateStr(S.day));
  setTxt($('#dateW'),`${weekday(S.day)} · 第 ${S.day} 天${S.inMacau?' · 身在澳门':''}`);
  const seg=$('#speedSeg');if(seg)seg.querySelectorAll('[data-speed]').forEach(b=>{const on=+b.dataset.speed===speed;if(b.classList.contains('on')!==on)b.classList.toggle('on',on)});
  const mb2=$('#muteBtn');if(mb2&&mb2._m!==muted){mb2.innerHTML=ic(muted?'mute':'snd');mb2._m=muted}
}

// ---------- 主区 ----------
function buildMain(){
  const el=$('#main');if(!el||el._built)return;
  el.innerHTML=`<div class="hero"><div><div class="cap">Total Net Worth · 净资产</div><div class="big" id="nwBig">—</div><div class="chg" id="chgLine"></div></div><canvas id="heroCv" style="width:min(360px,100%);height:70px"></canvas></div>
   <div class="desks" id="desks">${DESKS.map(d=>`<button type="button" class="desk ${d.wide?'macau':''}" data-open="${d.id}"><div class="row1">${ic(d.id)}<span class="dot" hidden></span></div><div><div class="cap">${d.en}</div><h3>${d.n}</h3></div><div class="st"><span class="stx"></span></div></button>`).join('')}</div>`;
  el._built=1;
}
function paintMain(){
  buildMain();const nw=netWorth(),h=S.nwHist.slice(-30),wk=h.length>4?h[h.length-4]:h[0]||nw;
  setTxt($('#nwBig'),fmt(nw));
  setTxt($('#chgLine'),`${pct(wk?(nw-wk)/Math.abs(wk):0)} 近 7 日 · 富豪榜第 ${myRank()} 名`);
  const cl=$('#chgLine');if(cl)setCls(cl,'chg '+cls(nw-wk));
  const cv=$('#heroCv');if(cv){if(cv.dataset.cid!=='hero')cv.dataset.cid='hero';CH.set('hero',h.length>1?h:[nw,nw]);cv._mini=1}
  const desks=$('#desks');if(desks)for(const d of DESKS){
    const btn=desks.querySelector(`[data-open="${d.id}"]`);if(!btn)continue;
    const locked=d.lv&&S.level<d.lv;
    const dot=btn.querySelector('.dot');const bd=locked?0:deskBadge(d.id);
    if(dot){const show=bd>0;if(dot.hidden===show)dot.hidden=!show;if(show)setTxt(dot,String(bd))}
    const st=btn.querySelector('.stx');
    if(st){const html=locked?`Lv${d.lv} 开放`:deskStatus(d.id);if(st._h!==html){st.innerHTML=html;st._h=html}}
    const want=locked?'desk lock':(d.wide?'desk macau':'desk');
    if(btn.className!==want)btn.className=want;
  }
  drawCharts($('#main'));
}

// ---------- 侧栏 ----------
const spotRefs={};
function buildSide(){
  const el=$('#side');if(!el||el._built)return;
  el.innerHTML=`<div class="panel"><h4><span id="agTitle">入门指引</span><span class="cap">Agenda</span></h4><div id="agBody"></div></div>
   <div class="panel"><h4>上海现货<span class="cap">Spot · SHA</span></h4><table class="mini-t"><tbody id="spotBody"></tbody></table></div>
   <div class="panel"><h4>财经快讯<span class="cap" id="newsCap">Newswire</span></h4><div class="feed" id="newsFeed"></div></div>`;
  el._built=1;
}
function buildSpot(){
  const tb=$('#spotBody');if(!tb)return;
  tb.innerHTML=GOODS.map(g=>goodUnlocked(g.id)
    ?`<tr data-sp="${g.id}"><td><span class="code">${g.code}</span>${g.n}</td><td data-c="p"></td><td data-c="c"></td></tr>`
    :`<tr class="lk"><td><span class="code">${g.code}</span>${g.n}</td><td colspan="2" class="note">Lv${g.lv}</td></tr>`).join('');
  for(const k in spotRefs)delete spotRefs[k];
  tb.querySelectorAll('tr[data-sp]').forEach(tr=>{spotRefs[tr.dataset.sp]={p:tr.querySelector('[data-c="p"]'),c:tr.querySelector('[data-c="c"]')}});
  tb._lv=S.level;
}
function renderTop(){paintTop()}
function paintSide(){
  buildSide();
  const tut=S.tut<TUT.length;let q='',title='本周目标';
  if(tut){const t=TUT[S.tut];title='入门指引';q=`<div class="quest"><b>${t.t}</b><div class="note">奖励 <span class="gold m">${fmt(t.r)}</span> · ${S.tut}/${TUT.length}</div><div class="row" style="margin-top:8px"><button class="btn sm" type="button" data-open="${t.desk||'trade'}">去做</button></div></div><div class="bar"><i style="width:${S.tut/TUT.length*100}%"></i></div>`}
  else if(S.goal){const p=S.stats.tradeProfit+S.stats.stockProfit-S.goal.baseProfit;q=`<div class="quest"><b>本周实现利润 ${fmt(S.goal.target)}</b><div class="note">奖励 <span class="gold m">${fmt(S.goal.reward)}</span> · 剩 ${S.goal.end-S.day} 天 · ${S.goal.done?'已达成':'当前 '+fmt(p)}</div></div><div class="bar"><i style="width:${clamp(p/S.goal.target*100,0,100)}%"></i></div>`}
  const nx=UNLOCKS[S.level+1];
  const agHTML=`${q}${nx?`<div class="note" style="margin-top:12px">Lv${S.level+1} 解锁 · <span class="gold">${nx}</span></div>`:''}${S.level>=10&&!S.ipo?`<button class="btn pri" style="margin-top:12px;width:100%" type="button" data-ipo ${netWorth()<5e7?'disabled':''}>申请上市（需净资产 ¥5000万）</button>`:''}`;
  setTxt($('#agTitle'),title);
  setHTML($('#agBody'),agHTML);
  const tb=$('#spotBody');
  if(!tb||tb._lv!==S.level)buildSpot();
  for(const g of GOODS){const r=spotRefs[g.id];if(!r)continue;const m=S.mkt.sh[g.id];const ch=(m.p-m.prev)/m.prev;
    setTxt(r.p,fmtP(m.p));setTxt(r.c,pct(ch));if(r.c)setCls(r.c,cls(ch))}
  const nf=$('#newsFeed');
  if(nf&&nf._seq!==newsSeq){nf._seq=newsSeq;
    nf.innerHTML=S.news.slice(0,25).map(n=>`<div class="it ${n.k}"><span class="d">${dateStr(n.d,1)}</span>${esc(n.t)}</div>`).join('')||'<div class="note">暂无消息</div>'}
  setTxt($('#newsCap'),isWeekend(S.day)?'Market Closed':'Newswire');
}

// ---------- 底部跑马灯：JS 位移，内容更新不跳回起点 ----------
const tk={x:0,w:0,seq:-1,boxW:0};
function paintTicker(){
  const el=$('#ticker'),box=$('#tkBox');if(!el||!box)return;
  if(tk.seq!==newsSeq){
    tk.seq=newsSeq;
    el.innerHTML=S.news.slice(0,10).map(n=>`<span><b>${dateStr(n.d,1)}</b>${esc(n.t)}</span>`).join('');
    tk.w=el.scrollWidth;tk.boxW=box.clientWidth;
    if(tk.w&&tk.x>-tk.w*2)tk.x=tk.boxW||innerWidth;
  }
  el.style.transform=`translateX(${Math.round(tk.x)}px)`;
}
function tickerStep(dt){
  if(!tk.w)return;
  const box=$('#tkBox');if(!tk.boxW&&box)tk.boxW=box.clientWidth;
  tk.x-=dt*.026;
  if(tk.x<-tk.w)tk.x=tk.boxW||innerWidth;
  const el=$('#ticker');if(el)el.style.transform=`translateX(${Math.round(tk.x)}px)`;
}

const mq=[];
function queueModal(fn,onAct,after){mq.push([fn,onAct,after]);if(!modalOpen)nextModal()}
function nextModal(){const it=mq.shift();if(!it){modalOpen=false;return}modalOpen=true;const [fn,onAct,after]=it;
  $('#modalRoot').innerHTML=`<div class="mbg"><div class="modal" role="dialog" aria-modal="true">${fn()}</div></div>`;
  $('#modalRoot').querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{snd('click');resolveAsk(null);closeModal()});
  $('#modalRoot').querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{snd('click');const i=+b.dataset.act;closeModal();onAct&&onAct(i)});
  after&&after();const f=$('#modalRoot .modal button:not([disabled])');f&&f.focus({preventScroll:true})}
function closeModal(){$('#modalRoot').innerHTML='';modalOpen=false;setTimeout(()=>{if(!modalOpen)nextModal()},150)}
// 文本输入弹窗（议价）
let __ask=null;
function resolveAsk(v){if(__ask){const r=__ask;__ask=null;r(v)}}
function askText(o){
  return new Promise(res=>{
    __ask=res;
    queueModal(()=>`<div class="cap">${o.cap||'Input'}</div><h2>${o.title}</h2><div class="rule"></div>${o.body?`<p>${o.body}</p>`:''}
      <textarea id="askIn" rows="3" placeholder="${o.placeholder||''}" style="width:100%;background:var(--surface);border:1px solid var(--hair3);border-radius:4px;padding:10px;font:13px/1.5 var(--f-sans);color:var(--ink);resize:vertical"></textarea>
      ${o.hint?`<div class="note" style="text-align:left">${o.hint}</div>`:''}
      <div class="row" style="justify-content:center"><button class="btn pri" type="button" id="askGo">${o.cta||'确定'}</button><button class="btn" type="button" data-close>取消</button></div>`,null,()=>{
      const inp=$('#askIn');inp&&inp.focus({preventScroll:true});
      const go=$('#askGo');if(go)go.onclick=()=>{const v=(inp.value||'').trim();resolveAsk(v);closeModal()};
    });
  })
}

// ---------- 窗口 ----------
function openWin(id){
  if(id==='settings'){
    win='settings';snd('click');
    $('#winRoot').innerHTML=`<div class="ov" id="ov"><div class="win" role="dialog" aria-modal="true" aria-label="设置"><div class="win-h">${ic('gear2')}<div><div class="cap">Preferences</div><h2>设置</h2><div class="ws" id="ws"></div></div><button class="x" type="button" data-closew>关闭</button></div><div id="wtabs"></div><div class="wb" id="wb"></div></div></div>`;
    renderWin(true);return}
  const d=DESKS.find(x=>x.id===id);if(d&&d.lv&&S.level<d.lv){toast(`Lv${d.lv} 开放`);return}
  if(id==='macau'&&!S.inMacau){flyMacau();return}
  win=id;snd('click');const [n,en]=WT[id];
  $('#winRoot').innerHTML=`<div class="ov" id="ov"><div class="win" role="dialog" aria-modal="true" aria-label="${n}"><div class="win-h">${ic(id)}<div style="min-width:0"><div class="cap">${en}</div><h2>${n}</h2><div class="ws" id="ws"></div></div><button class="x" type="button" data-closew>${id==='macau'?'返回上海':'关闭'}</button></div><div id="wtabs"></div><div class="wb" id="wb"></div></div></div>`;
  renderWin(true);const x=$('#winRoot .x');x&&x.focus({preventScroll:true})
}
function closeWin(){if(win==='macau'){if(CS.phase==='deal'||CS.sl.spinning)return;leaveMacau()}win=null;cancelAnimationFrame(shipRAF);$('#winRoot').innerHTML='';snd('click');refresh()}
function renderWin(force){
  if(!win)return;
  if(!force&&(dragging||(spinning&&win==='wheel')))return;
  if(CS.sl.spinning&&win==='macau'&&CS.game==='slot')return;
  const body=$('#wb');if(!body)return;
  const V=VIEWS[win]?VIEWS[win]():null;if(!V)return;
  if(V.static&&!force){paintStaticWin();return}
  const ae=document.activeElement;const rk=ae&&ae.dataset&&ae.dataset.range;const st=body.scrollTop;
  setHTML($('#ws'),V.sub||'');setHTML($('#wtabs'),V.tabs||'');
  if(body._h!==V.body){body.innerHTML=V.body;body._h=V.body;drawCharts(body)}
  body.scrollTop=st;
  if(rk){const r=body.querySelector(`[data-range="${rk}"]`);r&&r.focus({preventScroll:true})}
  if(win==='port')drawShips();
  if(win==='settings')paintStaticWin();
}
function paintStaticWin(){
  if(win!=='settings')return;
  const st=AI.stat,s=$('#aiStat');
  if(s)s.innerHTML=AI.ready()?(AI.cfg.mock?'<span class="tagline">演示模式</span>':`<span class="tagline ok">已启用</span> ${AI.cfg.model}`):'<span class="tagline bad">未配置</span> 填入密钥后启用';
  const u=$('#aiUse');if(u)u.textContent=`${st.calls} 次请求 · 输入 ${(st.inTok/1000).toFixed(1)}K / 输出 ${(st.outTok/1000).toFixed(1)}K`;
  const e=$('#aiErr');if(e)e.textContent=st.lastErr||'';
}

function tradeQ(){const inv=S.inv[ui.city][ui.good];if(ui.mode==='b'){const mx=maxBuy(ui.city,ui.good);let q=Math.floor(mx*ui.pct/100);if(ui.pct>0&&q<1&&mx>=1)q=1;return q}
  if(!inv)return 0;let q=Math.min(inv.q,Math.round(inv.q*ui.pct/100));if(ui.pct>0&&q<1&&inv.q>=1)q=1;return q}
function stockLots(){const k=S.stk[ui.stock],h=S.hold[ui.stock];if(ui.smode==='b')return Math.round(Math.floor(S.cash/(k.p*100*1.001))*ui.spct/100);return h?Math.round(h.q/100*ui.spct/100):0}
function shipQ(){if(!ui.from||!ui.sgood||!S.inv[ui.from][ui.sgood])return 0;const have=S.inv[ui.from][ui.sgood].q;
  let q=Math.min(have,Math.round(have*ui.shpct/100));if(ui.shpct>0&&q<1&&have>=1)q=1;return q}
const bankAmt=()=>Math.round(Math.max(0,creditLimit()-S.loan)*ui.bamt/100/1000)*1000;
const LIVE={pct:()=>`${fmtQ(tradeQ())} ${G[ui.good]?G[ui.good].u:''}`,spct:()=>`${stockLots()} 手`,shpct:()=>`${fmtQ(shipQ())} ${ui.sgood?G[ui.sgood].u:''}`,bamt:()=>fmt(bankAmt()),buyPct:()=>fmt(buyAmt())};
