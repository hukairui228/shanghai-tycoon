// ================= SIMULATION =================
const EVENTS=[
 {t:'主产区遭遇罕见干旱，{g}减产预期升温',goods:['rice','soy','cotton','coffee'],m:[1.12,1.25],days:[20,40]},
 {t:'全球大丰收，{g}供应过剩',goods:['rice','soy','cotton'],m:[.82,.9],days:[20,35]},
 {t:'OPEC+ 宣布联合减产，原油供给收紧',goods:['oil'],m:[1.15,1.3],days:[25,45],stocks:{'600028':.06}},
 {t:'美国页岩油产量创新高，原油承压',goods:['oil'],m:[.8,.9],days:[20,35],stocks:{'600028':-.05}},
 {t:'全球晶圆产能告急，芯片缺货潮再现',goods:['chip'],m:[1.18,1.35],days:[25,45],stocks:{'600831':.05}},
 {t:'新能源车销量暴增，铜需求大幅上调',goods:['copper'],m:[1.1,1.2],days:[25,40],stocks:{'600831':.03}},
 {t:'房地产调控加码，钢材需求走弱',goods:['steel'],m:[.82,.9],days:[20,40],stocks:{'600019':-.07}},
 {t:'基建刺激计划出台，钢铁有色需求回暖',goods:['steel','copper'],m:[1.08,1.18],days:[20,40],stocks:{'600019':.06}},
 {t:'地缘局势紧张，避险资金涌入黄金原油',goods:['gold','oil'],m:[1.06,1.14],days:[20,40],stocks:{'601899':.06},mkt:-.02},
 {t:'巴西咖啡锈病蔓延，咖啡豆暴涨',goods:['coffee'],m:[1.2,1.4],days:[25,45]},
 {t:'{c}港口工人罢工，进口商品价格飙升',city:1,goods:null,m:[1.08,1.15],days:[8,15],stocks:{'601872':-.03}},
 {t:'台风过境{c}，港口停摆数日',city:1,goods:null,m:[1.05,1.1],days:[5,10],delay:3},
 {t:'央行意外降息25个基点，市场情绪大振',goods:[],m:[1,1],days:[1,1],mkt:.03,rate:-.0025},
 {t:'央行加息抑制通胀，股市承压',goods:[],m:[1,1],days:[1,1],mkt:-.03,rate:.0025},
 {t:'全球航运运价指数大涨',goods:[],m:[1,1],days:[1,1],stocks:{'601872':.08}},
 {t:'监管约谈电商平台，板块大跌',goods:[],m:[1,1],days:[1,1],stocks:{'300750':-.09}},
 {t:'创新药获批上市，医药板块走强',goods:[],m:[1,1],days:[1,1],stocks:{'600276':.08}},
];
function scheduleEvent(){const e=pick(EVENTS);const ug=unlockedGoods().map(g=>g.id);let city=null,gid=null;
  if(e.city)city=pick(unlockedCities()).id;
  if(e.goods&&e.goods.length){const o=e.goods.filter(g=>ug.includes(g));gid=o.length?pick(o):pick(e.goods)}
  const m=e.m[0]+rnd()*(e.m[1]-e.m[0]),days=Math.round(e.days[0]+rnd()*(e.days[1]-e.days[0]));
  const t=e.t.replace('{g}',gid?G[gid].n:'').replace('{c}',city?C[city].n:'');const lead=2+Math.floor(rnd()*3);
  S.queued.push({t,city,goods:e.goods===null?'all':(e.goods.length>2?[gid]:e.goods.slice()),m,days,stocks:e.stocks||null,mkt:e.mkt||0,rate:e.rate||0,delay:e.delay||0,at:S.day+lead});
  const al=upgLv('analyst');if(al>0&&rnd()<[0,.65,.8,.95][al])news(`内参 · 消息人士透露：${t}（${lead}天内）`,'rumor')}
function fireEvent(ev){news(ev.t,ev.m>1||ev.mkt>0?'good':(ev.m<1||ev.mkt<0?'bad':''));
  if(ev.goods==='all'||(ev.goods&&ev.goods.length))S.events.push({city:ev.city,goods:ev.goods,m:ev.m,until:S.day+ev.days});
  if(ev.stocks)for(const s in ev.stocks)S.stk[s].p*=1+ev.stocks[s];
  if(ev.mkt)for(const st of STOCKS)S.stk[st.s].p*=1+ev.mkt*st.beta;
  if(ev.rate)S.rate=clamp(S.rate+ev.rate,.03,.09);
  if(ev.delay&&ev.city)for(const sh of S.ships)if(sh.to===ev.city)sh.eta+=ev.delay}
function evMult(city,g){let m=1;for(const e of S.events){if(e.city&&e.city!==city)continue;if(e.goods==='all'||e.goods.includes(g))m*=e.m}return m}
function pushCandle(k,np){const o=k.c.length?k.c[k.c.length-1][3]:k.p;const hi=Math.max(o,np)*(1+Math.abs(randn())*.006),lo=Math.min(o,np)*(1-Math.abs(randn())*.006);k.prev=o;k.p=np;k.c.push([+o.toFixed(2),+hi.toFixed(2),+lo.toFixed(2),+np.toFixed(2)]);if(k.c.length>90)k.c.shift()}
let lastTick=performance.now();
function rivalMove(){const r=pick(RIVALS),c=pick(unlockedCities()),g=pick(unlockedGoods()),dir=rnd()<.55?1:-1,mag=.03+rnd()*.05;S.mkt[c.id][g.id].p*=1+dir*mag;
  news(`${r.co}${r.boss}在${c.n}${dir>0?'大举扫货':'集中抛售'}${g.n}，当地价格${dir>0?'上涨':'下跌'}${(mag*100).toFixed(1)}%`,dir>0?'good':'bad');AI.maybeTaunt(r,dir,g)}
// 对手先「起意」再动手：给了情报系统可侦查的窗口
function planRivalMove(){const r=pick(RIVALS),c=pick(unlockedCities()),g=pick(unlockedGoods());
  return {r:r.id,c:c.id,g:g.id,dir:rnd()<.55?1:-1,mag:.03+rnd()*.055,at:S.day+1+Math.floor(rnd()*3)}}
function execRivalMove(it){const r=RIVALS.find(x=>x.id===it.r);if(!r)return;
  S.mkt[it.c][it.g].p*=1+it.dir*it.mag;
  news(`${r.co}${r.boss}在${C[it.c].n}${it.dir>0?'大举扫货':'集中抛售'}${G[it.g].n}，当地价格${it.dir>0?'上涨':'下跌'}${(it.mag*100).toFixed(1)}%`,it.dir>0?'good':'bad');
  AI.maybeTaunt(r,it.dir,G[it.g])}
// 宏观周期切换
function rotateMacro(){const cur=S.macro.id;const pool=MACRO.filter(m=>m.id!==cur);const next=pick(pool);
  S.macro={id:next.id,until:S.day+40+Math.floor(rnd()*40)};
  news(`宏观转入「${next.n}」 · ${next.d}`,next.seed||'');S.prestige=Math.max(0,S.prestige);
  toast(`宏观周期 · ${next.n}`,'lv')}
const macro=()=>MACROBY[S.macro.id]||MACRO[0];
// 价格预期：用模拟自身的均值回归模型推算，不是拍脑袋
function forecast(gid,days){
  const mb=macro();const out=[];
  for(const c of unlockedCities()){const m=S.mkt[c.id][gid];const E=G[gid].base*C[c.id].cf[gid]*S.trend[gid]*(1+mb.bias)*evMult(c.id,gid);
    const k=Math.pow(.93,days);const exp=m.p*k+E*(1-k);out.push({c:c.id,r:exp/m.p-1})}
  return out.sort((a,b)=>b.r-a.r)}
function tick(){
  S.day++;lastTick=performance.now();const wk=isWeekend(S.day);const mb=macro();
  if(S.day>=S.macro.until)rotateMacro();
  for(const q of S.queued.filter(q=>q.at<=S.day))fireEvent(q);
  S.queued=S.queued.filter(q=>q.at>S.day);S.events=S.events.filter(e=>e.until>S.day);
  if(rnd()<.09)scheduleEvent();
  for(const g of GOODS){let t=S.trend[g.id];t*=Math.exp(randn()*g.vol*.45*(mb.vol||1));t+=.012*((1+(mb.bias||0)*2)-t);S.trend[g.id]=clamp(t,.55,1.8)}
  for(const c of CITIES)for(const g of GOODS){const m=S.mkt[c.id][g.id];m.prev=m.p;const E=g.base*c.cf[g.id]*S.trend[g.id]*evMult(c.id,g.id);
    m.p=Math.max(g.base*.3,m.p+.07*(E-m.p)+m.p*g.vol*(mb.vol||1)*randn());m.h.push(+m.p.toPrecision(5));if(m.h.length>60)m.h.shift()}
  if(!wk){const mk=.0003+(mb.mu||0)+randn()*.009;
    for(const st of STOCKS){const k=S.stk[st.s];let r=st.beta*mk+randn()*st.vol;
      if(st.good){r+=.5*(S.trend[st.good]-(k.lt||S.trend[st.good]));k.lt=S.trend[st.good]}
      if(S.day>=k.earn){const sur=randn()*.06;r+=sur;k.earn=S.day+90;news(`${st.n}发布季报，${sur>0?'净利润超预期，股价大涨':'业绩不及预期，股价重挫'}`,sur>0?'good':'bad')}
      const base=k.c[k.c.length-1][3];pushCandle(k,Math.max(.5,clamp(k.p*(1+r),base*.9,base*1.1)))}}
  const pnw=netWorth();
  for(const r of RIVALS){const rv=S.rivals.find(x=>x.id===r.id);let mu=r.mu;if(pnw>rv.nw*1.5)mu+=.0012;if(pnw<rv.nw/3)mu-=.0008;rv.nw*=Math.exp(mu+r.sig*randn()*.6);
    const k=S.stk[r.s];if(!wk){const base=k.c[k.c.length-1][3];pushCandle(k,clamp(rv.nw/rv.shares*(1+randn()*.01),base*.9,base*1.1))}}
  if(wk)for(const k in S.stk)S.stk[k].prev=S.stk[k].p;
  // 对手：先起意，后执行
  if(!S.rivalIntent&&rnd()<.22)S.rivalIntent=planRivalMove();
  if(S.rivalIntent&&S.day>=S.rivalIntent.at){execRivalMove(S.rivalIntent);S.rivalIntent=null}
  // 研究部产出情报
  const al=upgLv('analyst');if(al>0)S.intel=clamp(S.intel+al*2,0,INTEL_MAX);
  const arrived=S.ships.filter(x=>x.eta<=S.day);
  for(const sh of arrived){const inv=S.inv[sh.to];const cur=inv[sh.good]||{q:0,cost:0};const room=whCap(upgLv('wh'))-invUsed(sh.to);
    if(sh.q*G[sh.good].sz>room+1e-9){news(`${C[sh.to].n}仓库爆仓，${G[sh.good].n}暂存码头，产生堆存费`,'bad');S.cash-=Math.round(sh.q*G[sh.good].sz*40)}
    // 航运保险：途中价格被打崩或延误，才赔
    if(sh.ins){const m=evMult(sh.to,sh.good);const late=sh.eta>(sh.plan||sh.eta);
      if(m<.995||late){const claim=Math.round(sh.unit*sh.q*.8);S.cash+=claim;S.stats.insClaim+=claim;
        news(`保险理赔 · ${G[sh.good].n} 运输途中${late?'延误':'价格跳水'}，获赔 ${fmt(claim)}`,'good');grant('ins1');floaty('+'+fmt(claim));snd('coin')}}
    inv[sh.good]={q:cur.q+sh.q,cost:(cur.q*cur.cost+sh.unit*sh.q)/(cur.q+sh.q)};toast(`货船抵达${C[sh.to].n} · ${G[sh.good].n} ${fmtQ(sh.q)}${G[sh.good].u}`);snd('buy')}
  if(arrived.length)S.ships=S.ships.filter(x=>x.eta>S.day);
  S.loan*=1+S.rate/365;const cost=dailyCost();S.cash-=cost;S.stats.costSum=(S.stats.costSum||0)+cost;S.stats.interestSum=(S.stats.interestSum||0)+S.loan*S.rate/365;
  for(const o of S.owned){const l=LUXBY[o.id];o.val*=Math.exp(l.ap/365+randn()*.004)}
  if(S.cash<0){const need=-S.cash;if(creditLimit()-S.loan>=need){S.loan+=need;S.cash=0;if(!S.seen.autoLoan){S.seen.autoLoan=1;news('现金不足，银行已自动放贷周转','bad')}}}
  const slots=3+upgLv('office');if(S.offers.length<slots&&rnd()<.3)genOffer();
  for(const o of S.offers.filter(o=>o.exp<=S.day))news(`${o.client}的${G[o.good].n}订单被${pick(RIVALS).co}抢走了`,'bad');
  S.offers=S.offers.filter(o=>o.exp>S.day);
  for(const k of S.contracts.filter(k=>k.due<S.day)){const pen=Math.round(k.reward*.1);S.cash-=pen;S.prestige=Math.max(0,S.prestige-15);news(`违约 · 未能按期向${k.client}交付，赔付${fmt(pen)}`,'bad');snd('bad')}
  S.contracts=S.contracts.filter(k=>k.due>=S.day);
  for(const iv of S.pendingInv.filter(x=>x.at<=S.day)){if(rnd()<iv.p){const back=iv.amt*iv.mult;S.cash+=back;news(`${iv.name}被巨头收购，投资回报${fmt(back)}`,'good');toast(`投资回报 +${fmt(back)}`,'lv');gainXP(back/800)}else news(`${iv.name}资金链断裂，投资血本无归`,'bad')}
  S.pendingInv=S.pendingInv.filter(x=>x.at>S.day);
  const nw=netWorth();S.stats.maxNW=Math.max(S.stats.maxNW,nw);
  if(S.day%2===0){S.nwHist.push(Math.round(nw));if(S.nwHist.length>200)S.nwHist.shift()}
  if(nw>=1e6)grant('nw1m');if(nw>=1e7)grant('nw10m');if(nw>=1e8)grant('nw100m');if(nw>=1e9)grant('nw1b');
  if(S.rivals.every(r=>nw>r.nw))grant('beat');
  if(S.tut>=TUT.length){if(!S.goal||S.day>=S.goal.end){const base=Math.max(nw,100000);S.goal={end:S.day+7,target:Math.round(base*(.04+rnd()*.04)/1000)*1000,baseProfit:S.stats.tradeProfit+S.stats.stockProfit,reward:Math.round(base*.02/1000)*1000+5000,done:false}}
    else if(!S.goal.done&&S.stats.tradeProfit+S.stats.stockProfit-S.goal.baseProfit>=S.goal.target){S.goal.done=true;S.cash+=S.goal.reward;gainXP(S.goal.reward/300);toast(`周目标达成 · 奖励 ${fmt(S.goal.reward)}`,'lv');snd('coin');floaty('+'+fmt(S.goal.reward))}}
  if(S.day>=S.nextDecision){S.nextDecision=S.day+20+Math.floor(rnd()*20);decision()}
  if(S.day%30===0)monthlyReport(nw);
  AI.maybeGenerate();          // AI 时事（有 key 才行动，异步、非阻塞）
  if(nw<0&&S.cash<=0&&S.loan>=creditLimit()){gameOver();return}
  checkTut();if(S.day%5===0)save();
  refresh()}
// 月度经营回顾
function monthlyReport(nw){
  const m=S.month||{start:S.day,nw:nw};const d=nw-m.nw;
  const trade=S.stats.tradeProfit-(m.trade0||0),stock=S.stats.stockProfit-(m.stock0||0),cas=S.casino.net-(m.cas0||0);
  const cost=(S.stats.costSum||0)-(m.cost0||0),intr=(S.stats.interestSum||0)-(m.intr0||0);
  const other=d-trade-stock-cas+cost+intr;
  news(`月度结算 · 净资产 ${d>=0?'+':''}${fmt(d)}`,'gold');
  queueModal(()=>`<div class="cap">Monthly Statement · ${dateStr(S.day)}</div><h2>第 ${Math.floor(S.day/30)} 个月经营回顾</h2><div class="rule"></div>
   <table class="rep"><tbody>
    <tr><td>期初净资产</td><td>${fmt(m.nw)}</td></tr>
    <tr><td>贸易利润</td><td class="${cls(trade)}">${fmt(trade)}</td></tr>
    <tr><td>股票盈亏</td><td class="${cls(stock)}">${fmt(stock)}</td></tr>
    <tr><td>澳门净额</td><td class="${cls(cas)}">${fmt(cas)}</td></tr>
    <tr><td>经营开支</td><td class="down">${fmt(-cost)}</td></tr>
    <tr><td>利息</td><td class="down">${fmt(-intr)}</td></tr>
    <tr><td>其他（藏品、合约、行情）</td><td class="${cls(other)}">${fmt(other)}</td></tr>
    <tr class="tot"><td>期末净资产</td><td class="${cls(d)}">${fmt(nw)}</td></tr>
   </tbody></table>
   <p class="note">宏观：${macro().n} · ${macro().d}</p>
   <button class="btn pri lg" type="button" data-close>继续</button>`);
  S.month={start:S.day,nw,trade0:S.stats.tradeProfit,stock0:S.stats.stockProfit,cas0:S.casino.net,cost0:S.stats.costSum||0,intr0:S.stats.interestSum||0}}

function genOffer(){const g=pick(unlockedGoods()),cities=unlockedCities(),c=pick(cities);const nw=Math.max(netWorth(),80000);const val=nw*(.15+rnd()*.5);
  let q=Math.max(1,Math.round(val/g.base));q=Math.max(1,Math.min(q,Math.floor(whCap(upgLv('wh'))*.8/g.sz)));if(g.sz===1&&q>20)q=Math.round(q/5)*5;
  const mval=q*g.base*c.cf[g.id]*S.trend[g.id];const prem=.1+Math.pow(rnd(),1.6)*.3;const reward=Math.round(mval*(1+prem)*rewardMul()/100)*100;
  const far=Math.max(...cities.map(x=>dist(x.id,c.id)));
  S.offers.push({id:S.offerId++,client:pick(CLIENTS),good:g.id,q,city:c.id,reward,prem,days:Math.round(12+rnd()*12+far*.6),exp:S.day+6+Math.floor(rnd()*6)})}
function decision(){
  // 有 AI 时，有一部分抉择交给模型现场生成（数值仍走白名单）
  if(typeof AI!=='undefined'&&AI.ready()&&!modalOpen&&!S.seen.__swanOnce&&rnd()<.45){S.seen.__swanOnce=1;aiBlackSwan();return}
  decisionTemplate()}
function decisionTemplate(){const nw=Math.max(netWorth(),50000);const opts=[
  ()=>{const amt=Math.round(nw*.06/1000)*1000;const name=pick(['云图智能','极光出行','蓝鲸生物','星火机器人','绿洲咖啡连锁']);
    return {h:'创业邀约',b:`大学同学在做「${name}」，A 轮还差一点，想请你投 <span class="gold">${fmt(amt)}</span>。60 天后揭晓：成功拿回 4 倍，失败血本无归。`,a:[['投资',()=>{if(S.cash<amt){toast('现金不够');return}S.cash-=amt;S.pendingInv.push({name,amt,mult:4,p:.32,at:S.day+60});news(`向${name}投资${fmt(amt)}`,'gold')}],['婉拒',()=>{}]]}},
  ()=>{const amt=Math.round(nw*.03/1000)*1000+5000;const pr=Math.round(amt/2000)+20;return {h:'慈善晚宴',b:`商会邀你出席年度慈善晚宴。捐出 <span class="gold">${fmt(amt)}</span>，声望 <span class="gold">+${pr}</span>。`,a:[['捐赠',()=>{if(S.cash<amt){toast('现金不够');return}S.cash-=amt;S.prestige+=pr;news(`${S.company}在慈善晚宴上捐款${fmt(amt)}`,'gold')}],['下次再说',()=>{}]]}},
  ()=>{if(!S.ships.length)return null;const fee=Math.round(shipValue()*.008)+3000;return {h:'海关抽检',b:`货船被列入抽检名单。缴纳 <span class="gold">${fmt(fee)}</span> 加急查验费可正常通关，否则一半概率全部滞港 5 天。`,a:[['缴费加急',()=>{S.cash-=fee}],['不缴费',()=>{if(rnd()<.5){for(const s of S.ships)s.eta+=5;news('货船遭海关扣留，全部延误 5 天','bad')}else news('抽检顺利通过','good')}]]}},
  ()=>{const cost=Math.round(nw*.015/100)*100+3000;return {h:'猎头来电',b:`对手想挖走你的首席交易员。为他加薪 <span class="gold">${fmt(cost)}</span>？否则交易团队可能降一级。`,a:[['加薪挽留',()=>{S.cash-=cost}],['不挽留',()=>{if(upgLv('trader')>0&&rnd()<.6){S.upg.trader--;news('首席交易员跳槽，交易团队降级','bad')}else news('交易员最终选择留下','good')}]]}},
  ()=>{const g=pick(unlockedGoods()),c=pick(unlockedCities());const q=Math.max(1,Math.round(nw*.25/g.base));const disc=.8+rnd()*.06;const price=Math.round(S.mkt[c.id][g.id].p*disc*q);
    return {h:'工厂急售',b:`一家工厂周转困难，愿以市价 <span class="gold">${Math.round(disc*100)} 折</span> 打包转让 ${fmtQ(q)}${g.u} ${g.n}（货在${c.n}），总价 <span class="gold">${fmt(price)}</span>。`,a:[['接货',()=>{if(S.cash<price){toast('现金不够');return}if(invUsed(c.id)+q*g.sz>whCap(upgLv('wh'))){toast(`${c.n}仓库放不下`);return}S.cash-=price;const cur=S.inv[c.id][g.id]||{q:0,cost:0};S.inv[c.id][g.id]={q:cur.q+q,cost:(cur.q*cur.cost+price)/(cur.q+q)};news(`折价接手${g.n} ${fmtQ(q)}${g.u}`,'gold')}],['放弃',()=>{}]]}},
 ];let d=null,n=0;while(!d&&n++<6)d=pick(opts)();if(!d)return;
 queueModal(()=>`<div class="cap">Situation</div><h2>${d.h}</h2><div class="rule"></div><p>${d.b}</p><div class="row" style="justify-content:center">${d.a.map((x,i)=>`<button class="btn ${i?'':'pri'}" type="button" data-act="${i}">${x[0]}</button>`).join('')}</div>`,i=>{d.a[i][1]();refresh()})}
