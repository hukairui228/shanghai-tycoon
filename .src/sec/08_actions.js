// ================= ACTIONS =================
function buyGood(city,g,q){q=Math.floor(q);if(!(q>0))return;const room=whCap(upgLv('wh'))-invUsed(city);
  if(q*G[g].sz>room+1e-9){toast(`${C[city].n}仓库只剩 ${fmtQ(room)} 吨`,'bad');snd('bad');return}
  const qt=quoteBuy(city,g,q);if(qt.total>S.cash){toast('现金不足','bad');snd('bad');return}
  S.cash-=qt.total;S.mkt[city][g].p*=1+qt.impact;const cur=S.inv[city][g]||{q:0,cost:0};S.inv[city][g]={q:cur.q+q,cost:(cur.q*cur.cost+qt.total)/(cur.q+q)};
  S.stats.trades++;if(S.stats.trades>=100)grant('tr100');snd('buy');toast(`买入 ${G[g].n} ${fmtQ(q)}${G[g].u} · ${fmt(qt.total)}`);flag('buy');refresh()}
function sellGood(city,g,q){const cur=S.inv[city][g];if(!cur)return;q=Math.min(Math.floor(q*1000)/1000,cur.q);if(!(q>0))return;const qt=quoteSell(city,g,q);
  S.mkt[city][g].p*=Math.max(.5,1-qt.impact);S.cash+=qt.total;const profit=qt.total-cur.cost*q;cur.q-=q;if(cur.q<1e-6)delete S.inv[city][g];
  S.stats.trades++;S.stats.tradeProfit+=profit;
  if(profit>0){gainXP(profit/500);grant('t1');flag('sellProfit');if(profit>=1e5)grant('p100k');snd('coin');floaty('+'+fmt(profit))}else{snd('bad');floaty(fmt(profit),'var(--down)')}
  if(S.stats.trades>=100)grant('tr100');toast(`卖出 ${G[g].n} · ${profit>=0?'盈利':'亏损'} ${fmt(Math.abs(profit))}`);refresh()}
function ship(from,to,g,q,ins){const cur=S.inv[from][g];if(!cur||from===to)return;q=Math.min(Math.floor(q*1000)/1000,cur.q);if(!(q>0))return;
  if(shipUsed()+q*G[g].sz>fleetCap(upgLv('fleet'))+1e-9){toast('船队运力不足','bad');snd('bad');return}
  const d=shipDays(from,to);const prem=ins?Math.round(cur.cost*q*.016):0;
  const fee=freight(from,to,g,q)+prem;if(fee>S.cash){toast('现金不够付运费','bad');return}
  S.cash-=fee;if(ins)S.stats.insPaid+=prem;const unit=cur.cost+(fee-prem)/q+prem/q;cur.q-=q;if(cur.q<1e-6)delete S.inv[from][g];
  S.ships.push({id:S.shipId++,from,to,good:g,q,unit,dep:S.day,eta:S.day+d,plan:S.day+d,ins:!!ins});
  snd('coin');toast(`起航 · ${C[from].n} → ${C[to].n}，预计 ${d} 天${ins?' · 已投保':''}`);flag('ship');refresh()}
function buyStock(s,lots){if(isWeekend(S.day)){toast('周末休市');return}const q=lots*100,k=S.stk[s],amt=k.p*q,fee=Math.max(5,amt*.00025);
  if(!(lots>0)||amt+fee>S.cash){toast('现金不足','bad');return}S.cash-=amt+fee;const h=S.hold[s]||{q:0,cost:0};S.hold[s]={q:h.q+q,cost:(h.q*h.cost+amt+fee)/(h.q+q)};
  grant('s1');flag('stock');snd('buy');toast(`买入 ${stockName(s)} ${q} 股`);refresh()}
function sellStock(s,lots){if(isWeekend(S.day)){toast('周末休市');return}const h=S.hold[s];if(!h)return;const q=Math.min(lots*100,h.q),k=S.stk[s],amt=k.p*q,fee=Math.max(5,amt*.00025)+amt*.0005;
  S.cash+=amt-fee;const profit=amt-fee-h.cost*q;h.q-=q;if(h.q<=0)delete S.hold[s];S.stats.stockProfit+=profit;
  if(profit>0){gainXP(profit/1000);snd('coin');floaty('+'+fmt(profit))}else{snd('bad');floaty(fmt(profit),'var(--down)')}
  if(S.stats.stockProfit>=5e5)grant('s50');toast(`卖出 ${stockName(s)} ${q} 股`);refresh()}
const stockName=s=>{const a=STOCKS.find(x=>x.s===s);if(a)return a.n;const r=RIVALS.find(x=>x.s===s);return r?r.co:s};
function acceptOffer(id){const o=S.offers.find(x=>x.id===id);if(!o)return;if(S.contracts.length>=3+upgLv('office')){toast('进行中的合同已满','bad');return}
  S.offers=S.offers.filter(x=>x.id!==id);S.contracts.push({...o,due:S.day+o.days});flag('contract');snd('coin');toast(`签约 · ${o.client}`);refresh()}
function deliver(id){const k=S.contracts.find(x=>x.id===id);if(!k)return;const inv=S.inv[k.city][k.good];if(!inv||inv.q<k.q-1e-9){toast('库存不足');return}
  const basis=inv.cost*k.q;inv.q-=k.q;if(inv.q<1e-6)delete S.inv[k.city][k.good];S.cash+=k.reward;const profit=k.reward-basis;S.stats.tradeProfit+=profit;
  S.contracts=S.contracts.filter(x=>x.id!==id);S.stats.contracts++;S.prestige+=5+(k.prem>=.3?20:0);gainXP(k.reward/400+Math.max(0,profit)/500);
  grant('k1');if(S.stats.contracts>=10)grant('k10');if(k.prem>=.3)grant('leg');news(`按期向${k.client}交付${G[k.good].n}，回款${fmt(k.reward)}`,'good');
  snd('coin');floaty('+'+fmt(k.reward));toast(`合同完成 · 回款 ${fmt(k.reward)}`,'lv');refresh()}
function buyLux(id){const l=LUXBY[id];if(S.cash<l.p){toast('现金不足','bad');return}S.cash-=l.p;S.owned.push({id,val:l.p*.92,day:S.day,paid:l.p});
  news(`${S.company}董事长购入${l.n}`,'gold');snd('lv');flag('lux');
  if(l.cat==='watch')grant('lw');if(l.cat==='car')grant('lc');if(l.cat==='house')grant('lh');if(l.cat==='yacht'||l.cat==='jet')grant('ly');
  queueModal(()=>`<div class="cap">Acquisition</div><div style="color:var(--gold);margin:6px auto">${ic(l.cat,'width:84px;height:84px;stroke-width:.9')}</div><h2>${l.n}</h2><div class="note">${l.spec}</div><div class="rule"></div><p>成交价 <span class="gold">${fmt(l.p)}</span> · 声望 +${l.pr}</p><button class="btn pri lg" type="button" data-close>收下</button>`);refresh()}
function sellLux(i){const o=S.owned[i];if(!o)return;S.cash+=o.val;S.owned.splice(i,1);snd('coin');toast(`出售 ${LUXBY[o.id].n} · ${fmt(o.val)}`);refresh()}
function buyUpg(id){const u=UPG.find(x=>x.id===id),l=upgLv(id);if(l>=u.max)return;if(u.lv&&S.level<u.lv){toast(`需要 Lv${u.lv}`);return}const c=u.cost(l);if(S.cash<c){toast('现金不足','bad');return}
  S.cash-=c;S.upg[id]=l+1;snd('lv');toast(`${u.n} 升至 ${l+1} 级`,'lv');refresh()}
function borrow(a){a=Math.min(a,creditLimit()-S.loan);if(a<=0){toast('额度不足');return}S.loan+=a;S.cash+=a;snd('coin');floaty('+'+fmt(a));toast(`贷款到账 ${fmt(a)}`);refresh()}
function repay(a){a=Math.min(a,S.loan,S.cash);if(a<=0)return;S.loan-=a;S.cash-=a;if(S.loan<1)S.loan=0;snd('buy');toast(`已还款 ${fmt(a)}`);refresh()}
function doIPO(){const nw=netWorth();if(S.level<10||nw<5e7||S.ipo)return;const raise=nw*.25;S.cash+=raise;S.ipo=true;S.prestige+=600;grant('ipo');news(`${S.company}今日挂牌上市，募资${fmt(raise)}`,'gold');snd('lv');
  queueModal(()=>`<div class="cap">Listing</div><h2>${esc(S.company)} 上市</h2><div class="rule"></div><p>募资 <span class="gold">${fmt(raise)}</span> · 声望 +600</p><button class="btn pri lg" type="button" data-close>敲钟</button>`);refresh()}
const WHEEL=[['现金','s'],['经验','x'],['现金','m'],['声望','p'],['现金','s'],['仓储','w'],['头奖','l'],['经验','x']];
let spinning=false;
function spin(){if(spinning||S.wheel===todayKey())return;spinning=true;const i=Math.floor(rnd()*8);const a0=S.wheelAng||0;const ang=a0-(a0%360)+1800+((360-i*45)%360);S.wheelAng=ang;S.wheel=todayKey();
  const el=$('#wheelSvg');if(el)el.style.transform=`rotate(${ang}deg)`;let ticks=0;const iv=setInterval(()=>{snd('tick');if(++ticks>22)clearInterval(iv)},180);
  setTimeout(()=>{spinning=false;S.stats.spins++;const nw=Math.max(netWorth(),100000);const k=WHEEL[i][1];let msg='';
    if(k==='s'){const v=Math.round(nw*.01/100)*100+2000;S.cash+=v;msg=`现金 ${fmt(v)}`;floaty('+'+fmt(v))}
    if(k==='m'){const v=Math.round(nw*.03/100)*100+5000;S.cash+=v;msg=`现金 ${fmt(v)}`;floaty('+'+fmt(v))}
    if(k==='l'){const v=Math.round(nw*.08/100)*100+20000;S.cash+=v;msg=`头奖 · 现金 ${fmt(v)}`;floaty('+'+fmt(v))}
    if(k==='x'){const v=Math.round(xpNeed(S.level)*.25);msg=`经验 +${v}`;gainXP(v)}
    if(k==='p'){S.prestige+=30;msg='声望 +30'}
    if(k==='w'){if(upgLv('wh')<12){S.upg.wh++;msg='仓储中心免费升级一级'}else{S.cash+=50000;msg='现金 ¥5万'}}
    snd('lv');toast(`今日红利 · ${msg}`,'lv');save();refresh()},4300)}

// ===== 情报：把「研究部」变成真正的信息优势 =====
function intelReady(){return S.intel>=INTEL_COST.event}
function buyIntel(kind){
  const cost=INTEL_COST[kind];if(S.intel<cost){toast(`情报点数不足（需 ${cost}）`,'bad');snd('bad');return}
  if(kind==='event'){
    const q=S.queued.slice().sort((a,b)=>a.at-b.at)[0];
    if(!q){toast('目前没有在途消息');return}
    S.intel-=cost;grant('intel1');snd('ai');
    const gg=q.goods==='all'?'全港商品':(q.goods||[]).map(x=>G[x]?G[x].n:x).join('、');
    const _mg=Math.abs(q.m-1)*100;
    queueModal(()=>`<div class="cap">Intelligence · 内参</div><h2>消息人士透露</h2><div class="rule"></div>
      <p style="text-align:left">${esc(q.t)}</p>
      <div class="kv" style="text-align:left;margin-top:8px"><span class="muted">影响品种</span><span>${gg}</span>
      <span class="muted">影响范围</span><span>${q.city?C[q.city].n+'港':'全部港口'}</span>
      <span class="muted">价格方向</span><span class="${q.m>1?'up':'down'}">${q.m>1?'上涨':'下跌'} 约 ${_mg.toFixed(0)}%<span class="note"> · ${_mg>=8?'剧烈':_mg>=4?'明显':'轻微'}</span></span>
      <span class="muted">生效时间</span><span>${q.at-S.day} 天后</span></div>
      <button class="btn pri lg" type="button" data-close>记下了</button>`);
    news('动用情报网：拿到一条未公开的消息','gold');refresh();return}
  if(kind==='forecast'){
    if(!ui.good||!goodUnlocked(ui.good)){toast('先选中一个品种');return}
    S.intel-=cost;grant('intel1');snd('ai');
    const f=forecast(ui.good,5);const g=G[ui.good];
    queueModal(()=>`<div class="cap">Intelligence · 5 日模型</div><h2>${g.n} 价格展望</h2><div class="rule"></div>
      <p class="note" style="text-align:left">基于均值回归与在途事件推算的 5 日后中枢，不是保证。</p>
      <table class="rep"><tbody>${f.map(x=>`<tr><td>${C[x.c].n} <span class="note m">现价 ${fmtP(S.mkt[x.c][ui.good].p)}</span></td><td class="${cls(x.r)}">${pct(x.r,1)}</td></tr>`).join('')}</tbody></table>
      <button class="btn pri lg" type="button" data-close>收下</button>`);
    news(`研究部提交 ${g.n} 五日价格展望`,'gold');refresh();return}
  if(kind==='rival'){
    if(!S.rivalIntent){toast('暂时没有侦测到对手异动');return}
    S.intel-=cost;grant('intel1');snd('ai');
    const it=S.rivalIntent,r=RIVALS.find(x=>x.id===it.r);
    queueModal(()=>`<div class="cap">Intelligence · 商业间谍</div><h2>${r.co} 的下一步</h2><div class="rule"></div>
      <p style="text-align:left">${r.boss} 正在 ${C[it.c].n} 筹备${it.dir>0?'大举买入':'集中抛售'} <span class="gold">${G[it.g].n}</span>，预计 ${it.at-S.day} 天后动手，幅度约 ${(it.mag*100).toFixed(1)}%。</p>
      <p class="note">提前埋伏或在消息兑现后反向操作，都行。</p>
      <button class="btn pri lg" type="button" data-close>知道了</button>`);
    news(`你买通了${r.co}的一名交易员`,'gold');refresh();return}
}
// AI 事件/抉择的数值效果落地（只接受白名单字段，避免模型乱给数）
function applyFx(fx){
  if(!fx||typeof fx!=='object')return[];
  const out=[];
  if(fx.cashPct){const v=Math.round(netWorth()*clamp(+fx.cashPct,-.25,.25));S.cash+=v;out.push(['现金',v])}
  if(fx.prestige){const v=Math.round(clamp(+fx.prestige,-120,180));S.prestige=Math.max(0,S.prestige+v);out.push(['声望',v])}
  if(fx.xpPct){gainXP(Math.round(xpNeed(S.level)*clamp(+fx.xpPct,0,.8)));out.push(['经验','+' ])}
  if(fx.intel){const v=Math.round(clamp(+fx.intel,0,120));S.intel=clamp(S.intel+v,0,INTEL_MAX);out.push(['情报',v])}
  if(fx.debtPct){const v=Math.round(S.loan*clamp(+fx.debtPct,-.5,.5));S.loan=Math.max(0,S.loan-v);out.push(['债务',-v])}
  if(fx.shipDelay){const d=Math.round(clamp(+fx.shipDelay,0,8));for(const s of S.ships)s.eta+=d;if(d)out.push(['船期延误',d+'天'])}
  if(fx.shock&&G[fx.shock.good]){const g=G[fx.shock.good];const mult=clamp(+fx.shock.mult||1,.75,1.4);const days=Math.round(clamp(+fx.shock.days||20,5,45));
    S.events.push({city:null,goods:[g.id],m:mult,until:S.day+days});out.push([g.n,mult>1?'涨':'跌']);}
  return out
}
// 合同议价：无 API 时用本地模型兜底（也是 AI 的校验器基准）
function negotiateLocal(id){
  const o=S.offers.find(x=>x.id===id);if(!o)return null;
  const gap=o.prem-.2;                    // 溢价越高越难再抬
  const p=clamp(.55-gap*1.2,.08,.6);
  if(rnd()<p)return {accept:true,rewardDelta:clamp(gap<0?.12:.05,0,.15),daysDelta:-2,reply:'对方翻了翻计算器，同意小幅上调，但要求期限更紧。'};
  return {accept:false,rewardDelta:0,daysDelta:0,walkAway:rnd()<.1,reply:'对方表示这个价格已经贴着成本，谈不下来。'};
}

