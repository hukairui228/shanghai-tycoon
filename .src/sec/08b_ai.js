// ================= AI · DeepSeek =================
// 设计原则：
//  1) 没有 key 时游戏完整可玩，所有 AI 功能静默降级（议价用本地模型兜底）
//  2) 模型只输出「白名单字段」，数值一律 clamp 后再进游戏，不让模型直接改账
//  3) 所有请求异步、可中断、有超时与重试；不做逐帧调用，只按事件触发
const AI_LS='sh_ai_v1';
const AI=(function(){
  const cfg={key:'',model:'deepseek-chat',base:'https://api.deepseek.com',enabled:true,news:true,taunt:true,mock:false};
  const stat={calls:0,inTok:0,outTok:0,lastErr:'',ok:0,fail:0};
  let aborter=null,busy=false,lastTaunt=-99,lastNewsGen=-99;

  function load(){
    try{const raw=localStorage.getItem(AI_LS);if(raw){const o=JSON.parse(raw);for(const k in cfg)if(o[k]!==undefined)cfg[k]=o[k]}}
    catch(e){}
    try{if(new URLSearchParams(location.search).get('mock')==='1')cfg.mock=true}catch(e){}
    return cfg;
  }
  function saveCfg(){try{localStorage.setItem(AI_LS,JSON.stringify(cfg))}catch(e){saveCfg.lastErr=e.message}}

  const ready=()=>cfg.enabled&&(cfg.mock||!!cfg.key);
  function errText(code,body){
    if(code===401||code===403)return 'DeepSeek 密钥无效或已过期（设置里重新填一次）';
    if(code===402)return 'DeepSeek 账户余额不足';
    if(code===429)return '请求太频繁，稍后再试';
    if(code>=500)return 'DeepSeek 服务端异常，稍后再试';
    return 'DeepSeek 请求失败：'+(body?String(body).slice(0,120):'网络错误');
  }
  // 核心：一次对话（json=true 时要求返回 JSON 对象）
  async function chat(messages,opt={}){
    if(!ready())throw new Error('未配置 DeepSeek 密钥');
    if(cfg.mock)return mockChat(messages,opt);
    const ctl=new AbortController();aborter=ctl;
    const to=setTimeout(()=>ctl.abort(),opt.timeout||60000);
    const body={model:opt.model||cfg.model,messages,temperature:opt.temperature??.7,stream:!!opt.onDelta,max_tokens:opt.max_tokens||900};
    if(opt.json)body.response_format={type:'json_object'};
    let lastErr=null;
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await fetch(cfg.base.replace(/\/$/,'')+'/chat/completions',{
          method:'POST',signal:ctl.signal,
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
          body:JSON.stringify(body)});
        if(!r.ok){const txt=await r.text().catch(()=>'');throw new Error(errText(r.status,txt))}
        stat.calls++;
        if(opt.onDelta)return await readStream(r,opt.onDelta);
        const j=await r.json();
        if(j.usage){stat.inTok+=j.usage.prompt_tokens||0;stat.outTok+=j.usage.completion_tokens||0}
        const text=j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content||'';
        stat.ok++;
        return text;
      }catch(e){
        lastErr=e;
        if(e.name==='AbortError')throw new Error('请求超时或被中断');
        if(attempt===0)await new Promise(r=>setTimeout(r,700));
      }
    }
    stat.fail++;stat.lastErr=lastErr&&lastErr.message||'未知错误';
    throw lastErr||new Error('请求失败');
  }
  async function readStream(res,onDelta){
    const reader=res.body.getReader();const dec=new TextDecoder();let buf='',all='';
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      buf+=dec.decode(value,{stream:true});
      const parts=buf.split('\n\n');buf=parts.pop()||'';
      for(const p of parts){
        for(const line of p.split('\n')){
          if(!line.startsWith('data:'))continue;
          const d=line.slice(5).trim();if(d==='[DONE]')continue;
          try{const j=JSON.parse(d);const t=j.choices&&j.choices[0]&&j.choices[0].delta&&j.choices[0].delta.content;
            if(t){all+=t;onDelta(t,all)}}catch(e){}
        }
      }
    }
    stat.ok++;return all;
  }
  // JSON 模式下的稳妥解析：容忍代码块、前后缀文本
  function parseJSON(text){
    if(!text)return null;
    let t=String(text).trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
    const a=t.indexOf('{'),b=t.lastIndexOf('}');
    if(a<0||b<a)return null;
    try{return JSON.parse(t.slice(a,b+1))}catch(e){return null}
  }
  function abort(){try{aborter&&aborter.abort()}catch(e){}busy=false}

  // ---------- 上下文：给模型的真实状态（紧凑，控制 token） ----------
  function ctx(){
    const nw=netWorth();
    const inv=[];
    for(const c in S.inv){const rows=[];let v=0;
      for(const g in S.inv[c]){const q=S.inv[c][g].q;v+=q*bidP(c,g);if(q>0)rows.push(`${G[g].n}x${Math.round(q)}@成本${Math.round(S.inv[c][g].cost)}`)}
      if(rows.length)inv.push({港:C[c].n,货:rows.slice(0,4),值:Math.round(v)})}
    const best=[];
    for(const g of unlockedGoods())for(const a of unlockedCities())for(const b of unlockedCities()){
      if(a.id===b.id)continue;
      const r=(bidP(b.id,g.id)-askP(a.id,g.id))/askP(a.id,g.id);
      if(r>.01)best.push({货:g.n,买:a.n,卖:b.n,价差:+(r*100).toFixed(1)})}
    best.sort((x,y)=>y.价差-x.价差);
    const mb=macro();
    return {
      公司:S.company,等级:S.level,头衔:TITLES[S.level],第几天:S.day,日期:dateStr(S.day),
      现金:Math.round(S.cash),净资产:Math.round(nw),负债:Math.round(S.loan),授信:Math.round(creditLimit()-S.loan),
      声望:prestigeTotal(),情报点:S.intel,宏观:`${mb.n}（${mb.d}）`,
      日开销:Math.round(dailyCost()),库存:inv,在途: S.ships.map(x=>`${G[x.good].n} ${Math.round(x.q)}${G[x.good].u} ${C[x.from].n}→${C[x.to].n} 还有${x.eta-S.day}天`),
      可交付合同:S.contracts.filter(k=>{const i=S.inv[k.city][k.good];return i&&i.q>=k.q-1e-9}).map(k=>`${k.client} ${G[k.good].n}${Math.round(k.q)} 于${C[k.city].n}`),
      执行中合同:S.contracts.map(k=>`${k.client} ${G[k.good].n}${Math.round(k.q)} 剩${k.due-S.day}天 回款${Math.round(k.reward)}`),
      新订单:S.offers.slice(0,4).map(o=>`#${o.id} ${o.client} ${G[o.good].n}${Math.round(o.q)} 到${C[o.city].n} 期限${o.days}天 回款${Math.round(o.reward)} 溢价${(o.prem*100).toFixed(0)}%`),
      套利机会:best.slice(0,5),
      持仓股票:Object.keys(S.hold).map(k=>`${stockName(k)} ${S.hold[k].q}股 成本${S.hold[k].cost.toFixed(2)} 现价${S.stk[k].p.toFixed(2)}`),
      在途事件:S.events.map(e=>`${(e.goods==='all'?'全品':e.goods.map(g=>G[g].n).join('/'))}${e.city?'@'+C[e.city].n:''} 价格x${e.m.toFixed(2)} 剩${e.until-S.day}天`),
      澳门累计:S.casino.net,
      升级:UPG.map(u=>u.n+upgLv(u.id)).join(' '),
      最近新闻:S.news.slice(0,4).map(n=>`${dateStr(n.d,1)} ${n.t}`)
    };
  }
  const RULES=`你是《商海浮沉》里的家族办公室首席顾问，玩家是上海一家贸易公司的老板。
游戏机制（必须遵守，不要编造）：
- 跨港套利：A港买入价与B港卖出价之差，扣掉运费和买卖价差才是利润；价格冲击随下单量占深度比例上升。
- 合约化：签下大客户订单后在指定港口交付指定数量，回款含溢价（声望越高溢价越高），逾期违约赔 10% 并掉声望。
- 股市：周末休市，±10% 涨跌停，佣金万 2.5，卖出印花税 0.05%。
- 宏观周期影响商品中枢与波动；研究部每日产出情报点，可查未公开消息、价格模型、对手动向。
- 澳门是负期望游戏，只当消遣。
回答要求：简体中文；先给结论；3 条以内要点，每条不超过 40 字；必须引用玩家真实数字（现金、仓位、价差），不要空话；不要输出表格和代码块。`;

  // ---------- 对话式顾问 ----------
  const history=[];
  async function advise(userText,onDelta){
    const sys={role:'system',content:RULES+'\n当前状态 JSON：\n'+JSON.stringify(ctx())};
    const msgs=[sys,...history.slice(-6),{role:'user',content:userText}];
    history.push({role:'user',content:userText});
    const out=await chat(msgs,{onDelta,temperature:.6,max_tokens:700});
    history.push({role:'assistant',content:out});
    if(history.length>14)history.splice(0,history.length-14);
    return out;
  }
  function resetChat(){history.length=0}

  // ---------- 自然语言下单：解析 → 确认 → 执行 ----------
  const CMD_SYS=`把玩家的话解析成结构化下单指令，只输出 JSON，不要解释。
字段：{"reply":"简短中文回应","actions":[...]}
可用 action（字段严格照抄，数值用阿拉伯数字）：
{"type":"buy","city":"sh|sz|sg|db|sp|rt","good":"rice|soy|steel|cotton|oil|copper|chip|coffee|gold","q":吨数}
{"type":"sell","city":同上,"good":同上,"q":吨数}
{"type":"ship","from":同上,"to":同上,"good":同上,"q":吨数,"ins":true|false}
{"type":"buyStock","code":"股票代码","lots":手数}{"type":"sellStock","code":"...","lots":手数}
{"type":"deliver","id":合同id}{"type":"accept","id":订单id}
{"type":"borrow","amt":金额}{"type":"repay","amt":金额}
{"type":"intel","kind":"event|forecast|rival"}
{"type":"goto","desk":"trade|port|deal|stock|bank|hq|lux|macau|rank|wheel|ach|settings"}
{"type":"say"}   // 当玩家不是在下单，只是聊天，就返回空 actions
规则：玩家没说数量就用 q=0 表示"能买/卖多少就多少"；没说港口就从上下文挑最合理的；看不懂就只返回 {"reply":"...","actions":[]}。最多 3 个 action。城市必须用代码 sh/sz/sg/db/sp/rt。`;
  async function command(text){
    const raw=await chat([{role:'system',content:CMD_SYS+'\n当前状态：\n'+JSON.stringify(ctx())},{role:'user',content:text}],{json:true,temperature:.15,max_tokens:500,tag:'cmd'});
    const j=parseJSON(raw)||{reply:'我没太听懂，可以再说具体点（港口、品种、数量）。',actions:[]};
    return {reply:String(j.reply||''),actions:Array.isArray(j.actions)?j.actions.slice(0,3):[]};
  }
  // 把 action 规整成「可执行 + 可核对」的形式：确认卡上写的，就是真正会执行的
  function describe(a){
    const g=a.good&&G[a.good]?G[a.good]:null,cn=a.city&&C[a.city]?C[a.city].n:'';
    const cityOk=!!(a.city&&C[a.city]),goodOk=!!(a.good&&G[a.good]);
    const bad=t=>({ok:false,t,sub:''});
    switch(a.type){
      case 'buy':{
        if(!cityOk||!goodOk)return bad('港口或品种无效');
        const mx=maxBuy(a.city,a.good);
        if(mx<1)return {ok:false,t:`买入 ${g.n}`,sub:'现金或仓容不足，一吨都买不了'};
        const q=clamp(Math.round(+a.q||0)||mx,1,mx);
        const qt=quoteBuy(a.city,a.good,q);
        return {ok:true,t:`在${cn}买入 ${g.n} ${fmtQ(q)}${g.u}`,sub:`花费 ${fmt(qt.total)} · 均价 ${fmtP(qt.unit)} · 本港最多可买 ${fmtQ(mx)}${g.u}`,act:{...a,q}}}
      case 'sell':{
        if(!cityOk||!goodOk)return bad('港口或品种无效');
        const inv=S.inv[a.city]&&S.inv[a.city][a.good];
        if(!inv||inv.q<=0)return {ok:false,t:`卖出 ${g.n}`,sub:`${cn}没有这个品种的持仓`};
        const q=clamp(Math.round((+a.q||0)||inv.q),0.001,inv.q);
        const total=quoteSell(a.city,a.good,q).total;
        return {ok:true,t:`在${cn}卖出 ${g.n} ${fmtQ(q)}${g.u}`,sub:`收入 ${fmt(total)} · 持仓 ${fmtQ(inv.q)}${g.u}`,act:{...a,q}}}
      case 'ship':{
        if(!cityOk||!goodOk||!C[a.to])return bad('航线无效');
        const inv=S.inv[a.from]&&S.inv[a.from][a.good];
        if(!inv||inv.q<=0)return {ok:false,t:`从${C[a.from].n}发运 ${g.n}`,sub:'起运港没有该品种'};
        const room=Math.max(0,(fleetCap(upgLv('fleet'))-shipUsed())/g.sz);
        const q=Math.min(inv.q,Math.max(0.001,(+a.q||inv.q)),room);
        if(q<0.001)return {ok:false,t:`从${C[a.from].n}发运 ${g.n}`,sub:'船队运力已满'};
        const fee=freight(a.from,a.to,a.good,q);
        return {ok:true,t:`${C[a.from].n} → ${C[a.to].n} 运 ${g.n} ${fmtQ(q)}${g.u}`,
          sub:`运费 ${fmt(fee)} · ${shipDays(a.from,a.to)} 天${a.ins?' · 已投保':''}${q<inv.q?' · 受运力限制已缩量':''}`,act:{...a,q}}}
      case 'buyStock':{
        const k=S.stk[a.code];if(!k)return bad('没有这只票');
        const maxLots=Math.floor(S.cash/(k.p*100*1.001));
        if(maxLots<1)return {ok:false,t:`买入 ${stockName(a.code)}`,sub:'现金不足一手'};
        const lots=clamp(Math.round(+a.lots||0)||1,1,maxLots);
        return {ok:true,t:`买入 ${stockName(a.code)} ${lots} 手`,sub:`约 ${fmt(k.p*lots*100)} · 现价 ${k.p.toFixed(2)}`,act:{...a,lots}}}
      case 'sellStock':{
        const h=S.hold[a.code];if(!h)return {ok:false,t:`卖出 ${stockName(a.code)}`,sub:'没有持仓'};
        const lots=clamp(Math.round(+a.lots||0)||Math.floor(h.q/100),1,Math.floor(h.q/100)||1);
        return {ok:true,t:`卖出 ${stockName(a.code)} ${lots} 手`,sub:`持有 ${h.q} 股 · 现价 ${S.stk[a.code].p.toFixed(2)}`,act:{...a,lots}}}
      case 'deliver':{const k=S.contracts.find(x=>x.id===+a.id);return k?{ok:true,t:`向 ${k.client} 交付 ${G[k.good].n}`,sub:`回款 ${fmt(k.reward)}`,act:a}:bad('合同不存在')}
      case 'accept':{const o=S.offers.find(x=>x.id===+a.id);return o?{ok:true,t:`签下 ${o.client} 的订单`,sub:`回款 ${fmt(o.reward)} · 期限 ${o.days} 天`,act:a}:bad('订单已失效')}
      case 'borrow':{const amt=Math.min(Math.max(0,Math.round(+a.amt||0)),Math.max(0,creditLimit()-S.loan));
        return amt>0?{ok:true,t:`申请贷款 ${fmt(amt)}`,sub:'按日计息，随净资产调整授信',act:{...a,amt}}:bad('可用额度不足')}
      case 'repay':{const amt=Math.min(+a.amt||0,S.loan,S.cash);
        return amt>0?{ok:true,t:`还款 ${fmt(amt)}`,sub:`剩余负债 ${fmt(Math.max(0,S.loan-amt))}`,act:{...a,amt}}:bad('没有可还的金额')}
      case 'intel':{const c=INTEL_COST[a.kind]||0;
        if(S.intel<c)return {ok:false,t:'动用情报',sub:`情报点数不足（需 ${c}，现有 ${Math.round(S.intel)}）`};
        return {ok:true,t:`动用情报：${{event:'未公开消息',forecast:'价格模型',rival:'对手动向'}[a.kind]||''}`,sub:`消耗 ${c} 点 · 剩余 ${Math.round(S.intel-c)}`,act:a}}
      case 'goto':return {ok:true,t:`打开「${(WT[a.desk]||[a.desk])[0]}」`,sub:'',act:a};
      default:return bad('无法识别的操作');
    }
  }
  function runAction(a){
    switch(a.type){
      case 'buy':buyGood(a.city,a.good,Math.round(+a.q||0));break;
      case 'sell':sellGood(a.city,a.good,+a.q||0);break;
      case 'ship':ship(a.from,a.to,a.good,+a.q||0,!!a.ins);break;
      case 'buyStock':buyStock(a.code,Math.max(0,+a.lots||0));break;
      case 'sellStock':sellStock(a.code,Math.max(0,+a.lots||0));break;
      case 'deliver':deliver(+a.id);break;
      case 'accept':acceptOffer(+a.id);break;
      case 'borrow':borrow(+a.amt||0);break;
      case 'repay':repay(+a.amt||0);break;
      case 'intel':buyIntel(a.kind);break;
      case 'goto':if(win)closeWin();openWin(a.desk==='settings'?'settings':a.desk);break;
    }
  }

  // ---------- AI 时事：生成带真实数值的事件，进队列后再按常规规则生效 ----------
  async function generateEvents(n=4){
    if(!ready()||!cfg.news)return 0;
    if(busy)return 0;
    const ug=unlockedGoods().map(g=>g.id),uc=unlockedCities().map(c=>c.id);
    const sys=`你在为商业模拟游戏写财经快讯。只输出 JSON：{"events":[{"title","good","mult","days","city","stock","stockMove","kind"}]}
title 为中文快讯标题（≤28 字，像真实新闻，不要出现"游戏"字样）；good 必须取自 [${ug.join(',')}]；mult 价格倍数 0.78~1.35；days 影响天数 8~40；city 取 [${uc.join(',')}] 或 null；stock 取 [${STOCKS.map(s=>s.s).join(',')}] 或 null；stockMove -0.08~0.08；kind 为 good/bad/''。要有多样性：至少一条利多、一条利空。`;
    const raw=await chat([{role:'system',content:sys},{role:'user',content:`当前是第 ${S.day} 天，宏观：${macro().n}。生成 ${n} 条快讯。`}],{json:true,temperature:.9,max_tokens:800,tag:'news'});
    const j=parseJSON(raw);if(!j||!Array.isArray(j.events))return 0;
    let added=0;
    for(const e of j.events.slice(0,n)){
      if(!e||!G[e.good]||!ug.includes(e.good))continue;
      const mult=clamp(+e.mult||1,.78,1.35),days=Math.round(clamp(+e.days||20,8,40));
      const city=e.city&&uc.includes(e.city)?e.city:null;
      const stock=e.stock&&S.stk[e.stock]?e.stock:null;
      const sm=clamp(+e.stockMove||0,-.08,.08);
      S.queued.push({t:String(e.title||'市场消息').slice(0,40),city,goods:[e.good],m:mult,days,
        stocks:stock?{[stock]:sm}:null,mkt:0,rate:0,delay:0,at:S.day+2+added,ai:1});
      added++;
    }
    if(added){S.ai.generated+=added;S.ai.lastAt=S.day;lastNewsGen=S.day}
    return added;
  }
  function maybeGenerate(){
    if(!ready()||!cfg.news)return;
    if(S.queued.length>=2)return;
    if(S.day-lastNewsGen<22)return;
    lastNewsGen=S.day;
    generateEvents(4).catch(e=>{stat.lastErr=e.message});
  }

  // ---------- 对手喊话（纯氛围，失败就静默） ----------
  async function taunt(rival,dir,good){
    if(!ready()||!cfg.taunt)return;
    if(S.day-lastTaunt<6)return;
    if(rnd()>.4)return;
    lastTaunt=S.day;
    try{
      const t=await chat([{role:'system',content:'用一句中文（≤26字）写商业对手的挑衅/嘲讽，口气符合人物设定，不要引号，不要解释。'},
        {role:'user',content:`对手：${rival.co} 老板 ${rival.boss}，风格${rival.style}。他刚刚在${G[good].n}上${dir>0?'扫货拉涨':'抛售砸盘'}。玩家净资产 ${fmt(netWorth())}。`}],{temperature:1,max_tokens:80,tag:'taunt'});
      const line=String(t||'').replace(/["“”]/g,'').trim().slice(0,40);
      if(line)news(`${rival.boss}：「${line}」`,'rumor');
    }catch(e){}
  }

  // ---------- 黑天鹅抉择 ----------
  async function blackSwan(){
    const sys=`为商业模拟游戏生成一次突发事件抉择。只输出 JSON：
{"title":"事件名(≤8字)","body":"局势描述(≤90字，中文，具体)","options":[{"label":"选项(≤10字)","desc":"后果提示(≤28字)","fx":{...},"outcome":"事后一句结果(≤40字)"}]}
fx 只能包含这些键（全部可选）：cashPct(-0.2~0.2) prestige(-100~150) xpPct(0~0.6) intel(0~80) debtPct(-0.4~0.4) shipDelay(0~6) shock({good:"${unlockedGoods().map(g=>g.id).join('|')}",mult:0.8~1.3,days:10~30})
给 3 个选项，风险/收益要明显不同，其中一个必须是"什么都不做"。`;
    const raw=await chat([{role:'system',content:sys},{role:'user',content:`第 ${S.day} 天，净资产 ${fmt(netWorth())}，宏观 ${macro().n}，现金 ${fmt(S.cash)}，负债 ${fmt(S.loan)}。`}],{json:true,temperature:.95,max_tokens:700,tag:'swan'});
    const j=parseJSON(raw);if(!j||!Array.isArray(j.options)||!j.options.length)return null;
    return {title:String(j.title||'突发').slice(0,12),body:String(j.body||'').slice(0,160),
      options:j.options.slice(0,3).map(o=>({label:String(o.label||'选择').slice(0,14),desc:String(o.desc||'').slice(0,50),fx:o.fx||{},outcome:String(o.outcome||'').slice(0,60)}))};
  }

  // ---------- 合同议价 ----------
  async function negotiate(offer,demand){
    const t=tier(offer.prem);
    const sys=`你是 ${offer.client} 的采购总监，正在和玩家谈一份现货采购合同。只输出 JSON：
{"reply":"你的回应(≤60字，中文，像真人谈判)","accept":true|false,"rewardDelta":-0.2~0.25,"daysDelta":-8~8,"walkAway":true|false}
规则：溢价已经很高(${(offer.prem*100).toFixed(0)}%)时很难再加价；玩家要求明显过分就拒绝，甚至 walkAway（掀桌，订单作废）；接受时给一个具体的 rewardDelta。`;
    const raw=await chat([{role:'system',content:sys},{role:'user',content:`订单：${G[offer.good].n} ${Math.round(offer.q)}${G[offer.good].u} 交到${C[offer.city].n}，当前回款 ${fmt(offer.reward)}，期限 ${offer.days} 天，等级${t[1]}。我的要求：${demand}`}],{json:true,temperature:.8,max_tokens:400,tag:'nego'});
    const j=parseJSON(raw);if(!j)return null;
    return {reply:String(j.reply||'').slice(0,140),accept:!!j.accept,walkAway:!!j.walkAway,
      rewardDelta:clamp(+j.rewardDelta||0,-.2,.25),daysDelta:Math.round(clamp(+j.daysDelta||0,-8,8))};
  }

  // ---------- 连通性自检 ----------
  async function test(){
    const t0=performance.now();
    const txt=await chat([{role:'system',content:'你是连通性测试助手。'},{role:'user',content:'只回复两个字：在位'}],{max_tokens:12,temperature:0,timeout:20000,tag:'test'});
    return {ms:Math.round(performance.now()-t0),text:String(txt).trim().slice(0,20)};
  }

  // ---------- 本地指令解析：没有 key 也能用自然语言下单 ----------
  const CITY_WORDS={'上海':'sh','深圳':'sz','新加坡':'sg','迪拜':'db','圣保罗':'sp','鹿特丹':'rt'};
  function localCommand(text){
    const t=String(text||'');
    let city=null,city2=null;
    for(const k in CITY_WORDS){if(t.includes(k)){if(!city)city=CITY_WORDS[k];else if(!city2)city2=CITY_WORDS[k]}}
    let good=null;for(const g of GOODS){if(t.includes(g.n)||t.toUpperCase().includes(g.code)){good=g.id;break}}
    let code=null;for(const st of STOCKS)if(t.includes(st.n))code=st.s;
    if(!code)for(const r of RIVALS)if(t.includes(r.co))code=r.s;
    const m=t.match(/(\d+(?:\.\d+)?)\s*(万|千)?/);
    let q=0;if(m){q=parseFloat(m[1]);if(m[2]==='万')q*=1e4;if(m[2]==='千')q*=1e3}
    const lots=/手/.test(t)&&q?Math.max(1,Math.round(q)):0;
    const acts=[];
    const isShip=/(运|发|送|ship)/.test(t);
    const isSell=/(卖|抛|清仓)/.test(t);
    const isBuy=/(买|进|囤|收)/.test(t);
    if(code&&lots&&(isBuy||isSell)&&!isShip){acts.push({type:isSell?'sellStock':'buyStock',code,lots})}
    else if(isShip&&good&&city&&city2){acts.push({type:'ship',from:city,to:city2,good,q,ins:/保险/.test(t)})}
    else if(isSell&&good){acts.push({type:'sell',city:city||ui.city,good,q})}
    else if(isBuy&&good){acts.push({type:'buy',city:city||ui.city,good,q})}
    else if(/(情报|内参|消息)/.test(t)){acts.push({type:'intel',kind:/对手|动向/.test(t)?'rival':/价格|预测|展望|模型/.test(t)?'forecast':'event'})}
    else if(/(贷款|借钱|借款)/.test(t)){acts.push({type:'borrow',amt:q||50000})}
    const reply=acts.length?'我按字面理解成这样，确认一下再执行：':'这句我没解析出可执行的操作。可以说「在深圳买 500 吨大豆」或「把上海的铜运到鹿特丹」。';
    return {reply,actions:acts};
  }

  // ---------- 演示模式：无 key 也能完整体验交互（不消耗额度） ----------
  const MOCK_ADVICE=[
    '结论：先别急着加杠杆。\n1. 现金 {cash}，日开销 {cost}，够撑 {days} 天，别把现金压到 20% 以下。\n2. 当前最大价差在 {arb}，一趟毛利约够覆盖 {cover} 天开销。\n3. 研究部攒到 20 点先查一次未公开消息，比赌方向划算。',
    '结论：仓位偏重，先减一半。\n1. 库存值 {inv}，占净资产 {ratio}，宏观一转衰退会同时缩水。\n2. 手上 {ship} 条船在途，等它们落地再开新仓。\n3. 有可交付合同立刻交付，现金流比账面利润重要。'];
  function mockChat(messages,opt){
    const tag=opt.tag||(opt.json?'json':'text');
    const last=String((messages[messages.length-1]||{}).content||'');
    return new Promise(res=>{
      const reply=o=>setTimeout(()=>res(typeof o==='string'?o:JSON.stringify(o)),380);
      if(tag==='cmd'){const l=localCommand(last);return reply({reply:l.reply,actions:l.actions})}
      if(tag==='nego')return reply({reply:'这个价我最多再让两个点，期限也得压缩，不然财务那边过不了。',accept:true,rewardDelta:.06,daysDelta:-2,walkAway:false});
      if(tag==='swan')return reply({title:'釜底抽薪',body:'合作多年的船代突然被对手收购，你的三条主力航线被要求重新议价，对方只给 48 小时。',
        options:[{label:'接受新费率',desc:'运费长期上浮',fx:{cashPct:-.04},outcome:'你签了字，成本悄悄变重。'},
                 {label:'改用现货舱位',desc:'短期更贵，但自主',fx:{cashPct:-.07,prestige:40},outcome:'贵了点，但你保住了主动权。'},
                 {label:'强硬拒绝',desc:'赌对方不敢断你',fx:{cashPct:.03,prestige:-30,shipDelay:3},outcome:'两败俱伤，船期乱了三天。'}]});
      if(tag==='taunt')return reply('听说你最近在扫货？别接最后一棒。');
      if(tag==='test')return reply('在位');
      if(tag==='news')return reply({events:[
        {title:'红海航线保险费率跳涨，欧线运力吃紧',good:'coffee',mult:1.14,days:26,city:'rt',stock:'601872',stockMove:.04,kind:'good'},
        {title:'国内钢材社会库存创三年新高',good:'steel',mult:.87,days:30,city:'sh',stock:'600019',stockMove:-.05,kind:'bad'},
        {title:'东南亚干旱持续，稻米减产预期升温',good:'rice',mult:1.12,days:22,city:'sg',stock:'000998',stockMove:.03,kind:'good'},
        {title:'欧洲制造业PMI跌破荣枯线，铜需求下调',good:'copper',mult:.9,days:24,city:'rt',stock:null,stockMove:0,kind:'bad'}]});
      const nw=Math.max(1,netWorth());
      const txt=pick(MOCK_ADVICE)
        .replace('{cash}',fmt(S.cash)).replace('{cost}',Math.round(dailyCost()))
        .replace('{days}',Math.max(1,Math.round(S.cash/Math.max(1,dailyCost()))))
        .replace('{arb}',(()=>{const b=bestArb();return b?b.g.n+' '+b.a.n+'→'+b.b.n+'（'+pct(b.r,1)+'）':'不明显'})())
        .replace('{cover}',Math.max(1,Math.round(nw*.01/Math.max(1,dailyCost()))))
        .replace('{inv}',fmt(invValue())).replace('{ratio}',((invValue()/nw)*100).toFixed(0)+'%')
        .replace('{ship}',S.ships.length);
      let i=0;const iv=setInterval(()=>{
        i+=2;opt.onDelta&&opt.onDelta(txt.slice(i-2,i),txt.slice(0,i));
        if(i>=txt.length){clearInterval(iv);res(txt)}},14);
    });
  }

  load();
  return {cfg,stat,ready,chat,parseJSON,abort,ctx,advise,resetChat,command,localCommand,describe,runAction,
    maybeGenerate,generateEvents,taunt,maybeTaunt:taunt,blackSwan,negotiate,test,saveCfg,load,
    get busy(){return busy},set busy(v){busy=v},
    counters(){return stat}};
})();
