// ================= VIEWS =================
const VIEWS={
trade(){
  const cap=whCap(upgLv('wh')),used=invUsed(ui.city);
  const tabs=`<div class="tabs">${CITIES.map(c=>`<button type="button" class="tab ${c.id===ui.city?'on':''}" data-city="${c.id}" ${cityUnlocked(c.id)?'':'disabled'}>${c.n}${cityUnlocked(c.id)?'':' · Lv'+c.lv}</button>`).join('')}</div>`;
  const rows=GOODS.map(g=>{
    if(!goodUnlocked(g.id))return `<tr class="lk"><td><span class="code">${g.code}</span>${g.n}</td><td colspan="6">Lv${g.lv} 开放交易</td></tr>`;
    const m=S.mkt[ui.city][g.id],ch=(m.p-m.prev)/m.prev,inv=S.inv[ui.city][g.id];let best=null;
    for(const c of unlockedCities()){if(c.id===ui.city)continue;const p=bidP(c.id,g.id);if(!best||p>best.p)best={c,p}}
    const gap=best?(best.p-askP(ui.city,g.id))/askP(ui.city,g.id):0;const E=g.base*C[ui.city].cf[g.id]*S.trend[g.id]*evMult(ui.city,g.id);const dev=(m.p-E)/E;
    return `<tr class="cl ${ui.good===g.id?'sel':''}" data-good="${g.id}"><td><span class="code">${g.code}</span>${g.n} <span class="note">/${g.u}</span>${upgLv('analyst')>=2&&Math.abs(dev)>.04?` <span class="tag ${dev<0?'cold':'hot'}">${dev<0?'低估':'高估'}</span>`:''}</td><td class="r m">${fmtP(m.p)}</td><td class="r m ${cls(ch)}">${pct(ch)}</td><td><canvas class="spark" data-cid="spark:${g.id}"></canvas></td><td>${best?`<button type="button" class="chip" data-shipfast="${g.id}:${best.c.id}" title="安排航运到${best.c.n}，预计每单位多卖 ${pct(gap,1)}">${best.c.n} <span class="m ${cls(gap)}">${pct(gap,1)}</span></button>`:'—'}</td><td class="r m">${inv?fmtQ(inv.q):'—'}</td><td class="r m ${inv?cls(bidP(ui.city,g.id)-inv.cost):''}">${inv?pct((bidP(ui.city,g.id)-inv.cost)/inv.cost,1):''}</td></tr>`}).join('');
  for(const g of GOODS)if(goodUnlocked(g.id))CH.set('spark:'+g.id,S.mkt[ui.city][g.id].h.slice(-30));
  return {sub:`${C[ui.city].n}港 · 仓库 ${fmtQ(used)} / ${fmtQ(cap)} 吨 · 买卖价差 ${(spread(upgLv('trader'))*100).toFixed(2)}% · 点「调货到」可直接发船`,tabs,
    body:`<div class="tbl"><table><thead><tr><th>品种</th><th class="r">现价</th><th class="r">日涨跌</th><th>30日</th><th>调货到</th><th class="r">持仓</th><th class="r">浮盈</th></tr></thead><tbody>${rows}</tbody></table></div>${ui.good&&goodUnlocked(ui.good)?ticket():`<div class="empty"><span class="dsk-only">点一行品种下单。第五列显示「换个港口能多卖多少」，点它直接安排航运。</span><span class="mob-only">点一行品种下单；表格可左右滑动，「调货到」那一列点一下就能直接安排航运。</span></div>`}`}
},
port(){
  const al=unlockedCities();
  const fromOpts=al.filter(c=>Object.keys(S.inv[c.id]).length);
  if(!fromOpts.find(c=>c.id===ui.from))ui.from=fromOpts[0]?fromOpts[0].id:null;
  const goods=ui.from?Object.keys(S.inv[ui.from]):[];if(!goods.includes(ui.sgood))ui.sgood=goods[0]||null;
  let dests=[];
  if(ui.from&&ui.sgood){const q=shipQ();
    dests=al.filter(c=>c.id!==ui.from).map(c=>{const gain=(bidP(c.id,ui.sgood)-bidP(ui.from,ui.sgood))*q-freight(ui.from,c.id,ui.sgood,q);return {c,gain,days:shipDays(ui.from,c.id)}}).sort((a,b)=>b.gain-a.gain)}
  if(dests.length&&(!ui.to||ui.to===ui.from||!cityUnlocked(ui.to)))ui.to=dests[0].c.id;
  let form='<div class="empty">各港口仓库暂无存货。先在交易所买入，再回来安排运输。</div>';
  if(ui.from&&ui.sgood){const q=shipQ();const prem=ui.ins?Math.round((S.inv[ui.from][ui.sgood]?S.inv[ui.from][ui.sgood].cost:0)*q*.016):0;
    const fee=freight(ui.from,ui.to,ui.sgood,q)+prem;const gain=(bidP(ui.to,ui.sgood)-bidP(ui.from,ui.sgood))*q;const bestD=dests[0];
    form=`<div class="ticket" style="margin-top:0"><div class="g2"><div><div class="k">起运港</div><div class="row" style="margin-top:8px">${fromOpts.map(c=>`<button type="button" class="chip ${c.id===ui.from?'on':''}" data-from="${c.id}">${c.n}</button>`).join('')}</div></div>
     <div><div class="k">目的港 <span class="note">按净收益排序</span></div><div class="row" style="margin-top:8px">${dests.map(d=>`<button type="button" class="chip ${d.c.id===ui.to?'on':''}" data-to="${d.c.id}" title="预计净收益 ${fmt(d.gain)}">${d.c.n} · ${d.days}天 <span class="${cls(d.gain)}">${d.gain>=0?'+':''}${fmt(d.gain)}</span></button>`).join('')}</div></div></div>
     <div><div class="k">货物</div><div class="row" style="margin-top:8px">${goods.map(g=>`<button type="button" class="chip ${g===ui.sgood?'on':''}" data-sgood="${g}">${G[g].n} ${fmtQ(S.inv[ui.from][g].q)}${G[g].u}</button>`).join('')}</div></div>
     <div><div class="sp"><span class="k">装船数量</span><span class="m" id="liveQ">${LIVE.shpct()}</span></div><input type="range" min="1" max="100" value="${ui.shpct}" data-range="shpct" style="--p:${ui.shpct}%" aria-label="装船比例"></div>
     <label class="ins ${ui.ins?'on':''}" style="cursor:pointer"><input type="checkbox" data-ins ${ui.ins?'checked':''}><span>投保航运险 <span class="note">保费 ${fmt(prem)} · 途中跌价或延误赔 80%</span></span></label>
     <div class="sp" style="flex-wrap:wrap"><div class="kv"><span class="muted">运费及保险</span><span>${fmt(fee)}</span><span class="muted">航程</span><span>${shipDays(ui.from,ui.to)} 天</span><span class="muted">按现价预计净利</span><span class="${cls(gain-fee)}">${fmt(gain-fee)}</span></div>
     <button class="btn pri lg" type="button" data-sail>确认起航${bestD&&bestD.c.id===ui.to&&gain-fee>=0?' · 最优':''}</button></div>
     ${gain-fee<0?`<div class="note" style="border-top:1px solid var(--hair2);padding-top:8px">这一趟按现价会亏 <b class="down">${fmt(Math.abs(gain-fee))}</b>：可以少装一些、换个目的港，或者等价格回到成本之上再走 —— 运费是固定支出，走一趟就收不回。</div>`:''}</div>`}
  const routes=[];for(let i=0;i<al.length;i++)for(let j=i+1;j<al.length;j++)routes.push([al[i],al[j]]);
  const map=`<svg viewBox="330 60 560 290" aria-label="航线图">${Array.from({length:12},(_,i)=>`<line x1="${330+i*50}" y1="60" x2="${330+i*50}" y2="350" stroke="rgba(236,230,218,.04)"/>`).join('')}${Array.from({length:7},(_,i)=>`<line x1="330" y1="${60+i*50}" x2="890" y2="${60+i*50}" stroke="rgba(236,230,218,.04)"/>`).join('')}
   ${CONT}${routes.map(([a,b])=>`<path d="${routePath(a,b)}" fill="none" stroke="rgba(200,169,106,.22)" stroke-width=".8" stroke-dasharray="2 4"/>`).join('')}
   ${ui.from&&ui.to?`<path d="${routePath(C[ui.from],C[ui.to])}" fill="none" stroke="#e4cb93" stroke-width="1.4"/>`:''}<g id="shipLayer"></g>
   ${CITIES.map(c=>{const ok=cityUnlocked(c.id);const n=Object.keys(S.inv[c.id]).length;return `<g opacity="${ok?1:.35}"><circle cx="${c.x}" cy="${c.y}" r="4" fill="${ok?'#c8a96a':'#5f5c56'}"/><circle cx="${c.x}" cy="${c.y}" r="8" fill="none" stroke="${ok?'rgba(200,169,106,.4)':'transparent'}"/><text x="${c.x}" y="${c.y-13}" text-anchor="middle">${c.n}${ok?'':' · Lv'+c.lv}</text>${n?`<text x="${c.x}" y="${c.y+21}" text-anchor="middle" style="font-size:10px;fill:#c8a96a">${n} 种存货</text>`:''}</g>`}).join('')}</svg>`;
  const list=S.ships.length?S.ships.map(s=>{const tot=s.eta-s.dep,done=S.day-s.dep;return `<div class="box"><div class="sp"><span>${C[s.from].n} → ${C[s.to].n}</span><span class="tag ${s.ins?'g':''}">${s.eta-S.day} 天${s.ins?' · 已投保':''}</span></div><div class="note" style="margin-top:4px">${G[s.good].n} ${fmtQ(s.q)}${G[s.good].u} · 到港估值 ${fmt(s.q*bidP(s.to,s.good))}</div><div class="bar"><i style="width:${clamp(done/tot*100,0,100)}%"></i></div></div>`}).join(''):'<div class="note">暂无在途货船</div>';
  return {sub:`运力 ${fmtQ(shipUsed())} / ${fmtQ(fleetCap(upgLv('fleet')))} 吨 · ${S.ships.length} 艘在途`,body:`<div class="map">${map}</div><div style="margin-top:14px">${form}</div><div class="sec">船队动态</div><div class="g3">${list}</div>`}
},
stock(){
  const all=[...STOCKS.map(s=>({s:s.s,n:s.n,sec:s.sec})),...RIVALS.map(r=>({s:r.s,n:r.co,sec:'对手'}))];
  const k=S.stk[ui.stock],h=S.hold[ui.stock],wk=isWeekend(S.day);const i=idx();const lots=stockLots();
  CH.set('kline',k.c.slice(-60));
  return {sub:`沪深综指 ${i.v.toFixed(1)} <span class="${cls(i.ch)}">${pct(i.ch)}</span> · ${wk?'周末休市':'交易中'} · 持仓市值 ${fmt(stockValue())}`,
  body:`<div class="g2" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)"><div><div class="sp"><div><span class="code">${ui.stock}</span><b style="font-family:var(--f-serif);font-size:20px;font-weight:600">${stockName(ui.stock)}</b></div><div style="text-align:right"><div class="v ${cls(k.p-k.prev)}">${k.p.toFixed(2)}</div><div class="m ${cls(k.p-k.prev)}" style="font-size:12px">${pct((k.p-k.prev)/k.prev)}</div></div></div>
   <canvas class="chart" data-cid="kline"></canvas><div class="note">日 K 线 · 金线为 5 日均线</div>
   ${h?`<div class="row" style="margin-top:8px"><span class="tag g">持有 ${h.q} 股</span><span class="tag">成本 ${h.cost.toFixed(2)}</span><span class="tag ${k.p>=h.cost?'hot':'cold'}">${fmt((k.p-h.cost)*h.q)}</span></div>`:''}
   <div class="ticket"><div class="sp"><div class="seg2"><button type="button" class="b ${ui.smode==='b'?'on':''}" data-smode="b">买入</button><button type="button" class="s ${ui.smode==='s'?'on':''}" data-smode="s">卖出</button></div><span class="m" id="liveQ">${lots} 手</span></div>
    <input type="range" min="0" max="100" value="${ui.spct}" data-range="spct" style="--p:${ui.spct}%" aria-label="仓位比例"><div class="quick">${[10,25,50,100].map(v=>`<button type="button" data-pctset="spct:${v}">${v===100?'全部':v+'%'}</button>`).join('')}</div>
    <div class="sp" style="flex-wrap:wrap"><span class="note">1 手 = 100 股 · 佣金万 2.5 · 卖出印花税 0.05% · 涨跌停 ±10%</span><button class="btn ${ui.smode==='b'?'buy':'sell'}" type="button" data-strade ${wk||!lots?'disabled':''}>${wk?'休市':ui.smode==='b'?'买入':'卖出'}</button></div></div></div>
   <div class="tbl"><table><thead><tr><th>证券</th><th class="r">现价</th><th class="r">涨跌</th><th class="r">持仓</th></tr></thead><tbody>${all.map(a=>{const q=S.stk[a.s],hh=S.hold[a.s],ch=(q.p-q.prev)/q.prev;return `<tr class="cl ${a.s===ui.stock?'sel':''}" data-stk="${a.s}"><td>${a.n}<div class="note m">${a.s} · ${a.sec}</div></td><td class="r m">${q.p.toFixed(2)}</td><td class="r m ${cls(ch)}">${pct(ch)}</td><td class="r m">${hh?hh.q:''}</td></tr>`}).join('')}</tbody></table></div></div>`}
},
deal(){
  const slots=3+upgLv('office');
  const cd=(o,active)=>{const t=tier(o.prem);const inv=S.inv[o.city][o.good];const have=inv?inv.q:0;const mv=o.q*S.mkt[o.city][o.good].p;const left=active?o.due-S.day:o.exp-S.day;
   return `<div class="ct" style="--rc:${t[3]}"><div class="sp"><span class="tier">${t[2]} · ${t[1]}</span><span class="tag ${left<=(active?5:2)?'hot':''}">${active?'剩 '+left+' 天':left+' 天内签约'}</span></div><div class="cl">${o.client}</div>
    <div class="note">${G[o.good].n} <span class="m" style="color:var(--ink)">${fmtQ(o.q)}</span> ${G[o.good].u} · 交付 ${C[o.city].n}港 · 期限 ${o.days} 天</div>
    <div class="sp"><span class="v gold">${fmt(o.reward)}</span><span class="note">溢价 ${pct(o.reward/mv-1,0)}</span></div>
    ${active?`<div class="note">当地库存 <span class="m ${have>=o.q?'up':''}">${fmtQ(have)}</span> / ${fmtQ(o.q)}</div><div class="bar" style="margin-top:0"><i style="width:${clamp(have/o.q*100,0,100)}%"></i></div><button class="btn ${have>=o.q?'pri':''}" type="button" data-deliver="${o.id}" ${have>=o.q?'':'disabled'}>${have>=o.q?'交付结算':'备货中'}</button>`
     :`<div class="row"><button class="btn pri" type="button" data-accept="${o.id}">签约</button><button class="btn" type="button" data-nego="${o.id}" title="和对方采购总监谈条件">议价</button></div>`}</div>`};
  return {sub:`执行中 ${S.contracts.length} / ${slots} · 声望溢价 +${Math.round((rewardMul()-1)*100)}% · 逾期未签的订单会被对手拿走`,body:`<div class="sec">执行中</div>${S.contracts.length?`<div class="g3">${S.contracts.map(k=>cd(k,1)).join('')}</div>`:'<div class="note">暂无执行中的合同</div>'}
   <div class="sec">新订单 <span class="note">「议价」可以要求对方加价或放宽期限</span></div>${S.offers.length?`<div class="g3">${S.offers.map(o=>cd(o,0)).join('')}</div>`:'<div class="note">新订单会陆续到来。升级总部大楼可增加栏位。</div>'}`}
},
bank(){const lim=creditLimit();const amt=bankAmt();
  return {sub:`年利率 ${(S.rate*100).toFixed(2)}% · 随央行政策调整`,body:`<div class="g3" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">${[['贷款余额',fmt(S.loan)],['授信额度',fmt(lim)],['可用额度',fmt(Math.max(0,lim-S.loan))],['每日利息',fmt(S.loan*S.rate/365)]].map(([a,b])=>`<div class="box"><div class="k">${a}</div><div class="v">${b}</div></div>`).join('')}</div>
   <div class="bar" style="margin:16px 0"><i style="width:${lim?clamp(S.loan/lim*100,0,100):0}%"></i></div>
   <div class="ticket"><div class="sp"><span class="k">借款金额</span><span class="v gold" id="liveQ" style="font-size:22px">${fmt(amt)}</span></div><input type="range" min="0" max="100" value="${ui.bamt}" data-range="bamt" style="--p:${ui.bamt}%" aria-label="借款比例">
    <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-borrow ${amt>0?'':'disabled'}>提款</button><button class="btn" type="button" data-repayall ${S.loan?'':'disabled'}>全部还清</button></div></div>
   <p class="note">授信随净资产、等级与声望提高。现金不足时银行自动放贷周转；资不抵债将破产清算。</p>
   <div class="sec">天使投资</div>${S.pendingInv.length?S.pendingInv.map(i=>`<div class="box sp"><span>${esc(i.name)}</span><span class="m">${fmt(i.amt)} · ${i.at-S.day} 天后揭晓</span></div>`).join(''):'<div class="note">经营中会遇到投资机会</div>'}`}},
lux(){const tabs=`<div class="tabs">${Object.entries(LUXCAT).map(([k,v])=>`<button type="button" class="tab ${k===ui.luxCat?'on':''}" data-lcat="${k}">${v}</button>`).join('')}<button type="button" class="tab ${ui.luxCat==='mine'?'on':''}" data-lcat="mine">我的藏品${S.owned.length?' · '+S.owned.length:''}</button></div>`;
  if(ui.luxCat==='mine')return {sub:`藏品估值 ${fmt(luxValue())} · 声望 ${prestigeTotal()}`,tabs,body:S.owned.length?`<div class="g3">${S.owned.map((o,i)=>{const l=LUXBY[o.id];return `<div class="lot"><span class="ln">INV · ${String(i+1).padStart(3,'0')}</span>${ic(l.cat)}<div class="nm">${l.n}</div><div class="note">${l.spec} · 购于 ${dateStr(o.day)}</div><div class="sp"><span class="pr" style="font-size:22px">${fmt(o.val)}</span><span class="m ${cls(o.val-o.paid)}">${pct(o.val/o.paid-1,1)}</span></div><button class="btn sm" type="button" data-lsell="${i}">委托出售</button></div>`}).join('')}</div>`:'<div class="empty">尚无藏品</div>'};
  return {sub:`声望 ${prestigeTotal()} · 合同溢价 +${Math.round((rewardMul()-1)*100)}% · 新购藏品转手约有 8% 损耗`,tabs,body:`<div class="g3">${LUX.filter(l=>l.cat===ui.luxCat).map(l=>{const own=S.owned.filter(o=>o.id===l.id).length;const ok=S.cash>=l.p;const n=LUX.indexOf(l)+1;
   return `<div class="lot">${own?`<span class="tag g own">已藏 ×${own}</span>`:''}<span class="ln">LOT ${String(n).padStart(3,'0')}</span>${ic(l.cat)}<div class="nm">${l.n}</div><div class="note">${l.spec}</div><div class="pr">${fmt(l.p)}</div><div class="note">声望 +${l.pr} · 年${l.ap>=0?'升值':'折旧'}约 ${Math.abs(l.ap*100).toFixed(0)}%${l.up?' · 日养护 '+fmt(l.up):''}</div>
    <button class="btn ${ok?'pri':''}" type="button" data-lbuy="${l.id}" ${ok?'':'disabled'}>${ok?'购入':'尚差 '+fmt(l.p-S.cash)}</button></div>`}).join('')}</div>`}},
hq(){const nw=netWorth();
  CH.set('nw',S.nwHist.length>1?S.nwHist:[nw,nw]);
  return {sub:`${TITLES[S.level]} · 经营第 ${S.day} 天 · 日常开支 ${fmt(dailyCost())}`,
  body:`<div class="g3" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${[['净资产',fmt(nw)],['现金',fmt(S.cash)],['库存与在途',fmt(invValue()+shipValue())],['股票',fmt(stockValue())],['藏品',fmt(luxValue())],['负债',fmt(S.loan)]].map(([a,b])=>`<div class="box"><div class="k">${a}</div><div class="v" style="font-size:21px">${b}</div></div>`).join('')}</div>
  <div class="box" style="margin-top:14px"><div class="sp" style="flex-wrap:wrap"><span class="k">净资产走势</span><span class="note">贸易利润 ${fmt(S.stats.tradeProfit)} · 股票利润 ${fmt(S.stats.stockProfit)} · 澳门 ${fmt(S.casino.net)}</span></div><canvas class="chart" id="nwChart" style="height:180px" data-cid="nw"></canvas></div>
  <div class="sec">研究部 · 情报</div>
  <div class="box"><div class="sp" style="flex-wrap:wrap;gap:12px"><div><b style="font-family:var(--f-serif);font-weight:600">情报点数 ${Math.round(S.intel)}</b><div class="note">研究部每日产出 ${upgLv('analyst')*2} 点${upgLv('analyst')?'':'（先在下方建设研究部）'} · 上限 ${INTEL_MAX}</div></div>
    <div class="row"><button class="btn sm ${S.intel>=INTEL_COST.event?'pri':''}" type="button" data-intelbuy="event" ${S.intel>=INTEL_COST.event?'':'disabled'} title="查一条还没公开的事件">未公开消息 · ${INTEL_COST.event}</button>
    <button class="btn sm ${S.intel>=INTEL_COST.forecast&&ui.good?'pri':''}" type="button" data-intelbuy="forecast" ${S.intel>=INTEL_COST.forecast&&ui.good?'':'disabled'} title="${ui.good?'当前品种：'+G[ui.good].n:'先在交易所选中品种'}">价格模型 · ${INTEL_COST.forecast}</button>
    <button class="btn sm ${S.intel>=INTEL_COST.rival&&S.rivalIntent?'pri':''}" type="button" data-intelbuy="rival" ${S.intel>=INTEL_COST.rival&&S.rivalIntent?'':'disabled'} title="侦查对手下一步动作">对手动向 · ${INTEL_COST.rival}</button></div></div></div>
  <div class="sec">公司建设</div><div class="g2">${UPG.map(u=>{const l=upgLv(u.id),max=l>=u.max,lock=u.lv&&S.level<u.lv,c=u.cost(l);
   return `<div class="box up-r">${ic(u.ic)}<div style="flex:1;min-width:0"><div class="sp"><b style="font-family:var(--f-serif);font-weight:600">${u.n}</b><span class="m note">${l} / ${u.max}</span></div><div class="pips">${Array.from({length:u.max},(_,i)=>`<i class="${i<l?'on':''}"></i>`).join('')}</div><div class="note">${u.d(l)}${max?'':` → <span class="gold">${u.d(l+1)}</span>`}</div>
    <div class="sp" style="margin-top:8px"><span class="note">${max?'':'日薪 +'+fmt(u.sal)}</span><button class="btn sm ${!max&&!lock&&S.cash>=c?'pri':''}" type="button" data-upg="${u.id}" ${max||lock||S.cash<c?'disabled':''}>${max?'已满级':lock?`Lv${u.lv} 开放`:fmt(c)}</button></div></div></div>`}).join('')}</div>
  <div class="row" style="margin-top:18px"><button class="btn sm" type="button" data-rename>更改公司名称</button><button class="btn sm" type="button" data-open="settings">设置</button><button class="btn sm" type="button" data-reset>重新开局</button></div>`}},
rank(){const rows=rankRows();return {sub:players.length?`${players.length} 位真人玩家 · 4 家 AI 财团`:db?'分享链接，邀请朋友同榜竞争':'本地模式：榜单上只有 AI 财团',
  body:rows.map((r,i)=>`<div class="rl ${i<3?'top3':''} ${r.me?'me':''}"><span class="no">${i+1}</span><span class="av">${esc(String(r.name).slice(0,1))}</span><div style="flex:1;min-width:0"><div><b style="font-family:var(--f-serif);font-weight:600">${esc(r.name)}</b> ${r.ai?'<span class="tag">AI</span>':''}${r.real?`<span class="tag ${r.on?'g':''}">${r.on?'在线':'玩家'}</span>`:''}${r.me?'<span class="tag g">你</span>':''}${r.ipo?' <span class="tag g">已上市</span>':''}</div><div class="note">${esc(r.who)} · Lv${r.level} ${TITLES[r.level]||''}${r.top?' · '+esc(r.top):''}</div></div><span class="v" style="font-size:22px">${fmt(r.nw)}</span></div>`).join('')+'<p class="note" style="margin-top:12px">AI 财团会在各港口扫货抛售、抢夺订单；它们也在证券所挂牌交易。研究部可以侦查它们的下一步。</p>'}},
wheel(){const done=S.wheel===todayKey();
  const segs=WHEEL.map((w,i)=>{const a0=(i*45-90-22.5)*Math.PI/180,a1=(i*45-90+22.5)*Math.PI/180,mid=(i*45-90)*Math.PI/180;const tx=100+64*Math.cos(mid),ty=100+64*Math.sin(mid);
   return `<path d="M100 100L${(100+92*Math.cos(a0)).toFixed(1)} ${(100+92*Math.sin(a0)).toFixed(1)}A92 92 0 0 1 ${(100+92*Math.cos(a1)).toFixed(1)} ${(100+92*Math.sin(a1)).toFixed(1)}z" fill="${i%2?'#13161b':'#1d2128'}" stroke="rgba(200,169,106,.5)" stroke-width=".8"/><text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" fill="${w[1]==='l'?'#e4cb93':'#ece6da'}" font-size="12" font-family="Noto Serif SC,serif" text-anchor="middle" dominant-baseline="middle" transform="rotate(${i*45} ${tx.toFixed(1)} ${ty.toFixed(1)})">${w[0]}</text>`}).join('');
  return {sub:'每个自然日可领取一次',body:`<div style="display:flex;flex-direction:column;align-items:center;gap:18px;padding:16px 0"><div class="dial"><span class="ptr"></span><svg id="wheelSvg" viewBox="0 0 200 200" style="transform:rotate(${S.wheelAng||0}deg)"><circle cx="100" cy="100" r="97" fill="#0b0d10" stroke="#c8a96a"/>${segs}<circle cx="100" cy="100" r="12" fill="#0b0d10" stroke="#c8a96a"/></svg></div>
   <button class="btn pri lg" type="button" data-spin ${done?'disabled':''}>${done?'明日再来':'领取今日红利'}</button><p class="note" style="text-align:center">奖励与净资产挂钩：现金、经验、声望、仓储升级，以及头奖。</p></div>`}},
ach(){return {sub:`${Object.keys(S.ach).length} / ${ACH.length}`,body:`<div class="g3">${ACH.map(a=>{const ok=S.ach[a.id]!=null;return `<div class="hon ${ok?'got':''}"><span class="md">${a.n.slice(0,1)}</span><div><b style="font-family:var(--f-serif);font-weight:600">${a.n}</b><div class="note">${a.d}${ok?' · '+dateStr(S.ach[a.id],1):''}</div></div></div>`}).join('')}</div>`}},
macau(){const r=room();const busy=HD||CS.phase==='deal'||CS.sl.spinning||betTotal();
  const tabs=`<div class="tabs">${[['bacc','百家乐'],['hd','德州扑克'],['slot','老虎机']].map(([k,v])=>`<button type="button" class="tab ${CS.game===k?'on':''}" data-game="${k}">${v}</button>`).join('')}<span style="flex:1"></span>${ROOMS.map(x=>`<button type="button" class="tab ${x.id===CS.room?'on':''}" data-room="${x.id}" ${roomOpen(x)&&(!busy||x.id===CS.room)?'':'disabled'}>${x.n}${roomOpen(x)?'':' · Lv'+x.lv}</button>`).join('')}</div>`;
  return {sub:`${r.n} · ${r.en} · 限红 ${fmt(r.min)} – ${fmt(r.max)} · 在澳门期间商业时间暂停`,tabs,body:CS.game==='bacc'?baccView():CS.game==='hd'?hdView():slotView()}},
settings(){
  const c=AI.cfg,st=AI.stat;
  return {static:true,sub:'数据只存在本机浏览器；密钥不写进存档，也不会随排行榜上传',body:`
   <div class="sec">DeepSeek · AI 智囊</div>
   <div class="box">
     <div class="set-row"><div><div class="lab">API 密钥</div><div class="hint">sk- 开头；只存在本机。也可以先开演示模式看交互</div></div>
       <input type="password" id="aiKey" value="${esc(c.key)}" placeholder="sk-..." autocomplete="off" spellcheck="false"></div>
     <div class="set-row"><div><div class="lab">模型</div><div class="hint">deepseek-chat 便宜快；reasoner 思考更久更贵</div></div>
       <select id="aiModel"><option value="deepseek-chat"${c.model==='deepseek-chat'?' selected':''}>deepseek-chat</option><option value="deepseek-reasoner"${c.model==='deepseek-reasoner'?' selected':''}>deepseek-reasoner</option></select></div>
     <div class="set-row"><div><div class="lab">启用 AI 功能</div><div class="hint">关闭后不产生任何请求</div></div><button class="sw ${c.enabled?'on':''}" type="button" data-toggle="enabled" aria-label="启用 AI"></button></div>
     <div class="set-row"><div><div class="lab">演示模式</div><div class="hint">不调用 API，用内置脚本模拟回复</div></div><button class="sw ${c.mock?'on':''}" type="button" data-toggle="mock" aria-label="演示模式"></button></div>
     <div class="set-row"><div><div class="lab">AI 时事</div><div class="hint">自动生成会真实影响价格的财经事件</div></div><button class="sw ${c.news?'on':''}" type="button" data-toggle="news" aria-label="AI 时事"></button></div>
     <div class="set-row"><div><div class="lab">对手喊话</div><div class="hint">AI 财团会就你的动作发表评论</div></div><button class="sw ${c.taunt?'on':''}" type="button" data-toggle="taunt" aria-label="对手喊话"></button></div>
     <div class="set-row"><div><div class="lab">状态</div><div class="hint" id="aiErr">${esc(st.lastErr||'')}</div></div><span id="aiStat"></span></div>
     <div class="row" style="margin-top:12px;justify-content:flex-end"><span class="note" id="aiUse"></span><button class="btn sm" type="button" id="aiTest">测试连接</button><button class="btn sm pri" type="button" id="aiSaveBtn">保存</button></div>
   </div>
   <div class="sec">玩法</div>
   <div class="box">
     <div class="set-row"><div><div class="lab">音效</div><div class="hint">操作与结算提示音</div></div><button class="sw ${muted?'':'on'}" type="button" data-toggle="sound" aria-label="音效"></button></div>
     <div class="set-row"><div><div class="lab">时间流速</div><div class="hint">空格暂停 / 继续</div></div><div class="seg">${[[0,'暂停'],[1,'1×'],[2,'2×'],[4,'4×']].map(([s,l])=>`<button type="button" data-speed="${s}" class="${speed===s?'on':''}">${l}</button>`).join('')}</div></div>
     <div class="set-row"><div><div class="lab">存档</div><div class="hint">导出 JSON 备份，或从备份恢复</div></div><div class="row"><button class="btn sm" type="button" data-export>导出</button><button class="btn sm" type="button" data-import>导入</button><input type="file" id="impFile" accept=".json" hidden></div></div>
     <div class="set-row"><div><div class="lab">重开</div><div class="hint">清空当前进度，重新创办公司</div></div><button class="btn sm" type="button" data-reset>重新开局</button></div>
   </div>
   <div class="sec">快捷键</div>
   <div class="box"><div class="sc-grid">
     ${[['1 – 9','打开对应交易所 / 窗口'],['空格','暂停 / 继续'],['A','唤起 AI 智囊'],['S','设置'],['M','静音'],['Esc','关闭窗口'],['?','这份帮助']].map(([k,v])=>`<span class="k2"><span class="kbd">${k}</span></span><span>${v}</span>`).join('')}
   </div></div>
   <p class="note" style="margin-top:14px">商海浮沉 v4 · 单文件网页游戏 · 存档键 ${LS} · 密钥键 ${AI_LS}</p>`}
},
};
