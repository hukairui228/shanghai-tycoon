// ================= AI DRAWER =================
const CHAT={open:false,mode:'ask',msgs:[],pending:null,busy:false};
const AI_CHIPS={ask:['现在该干什么？','解读一下今天的盘面','我的风险在哪？','怎么快点赚到 1000 万'],
  cmd:['在深圳买 500 吨大豆','把上海的铜运到鹿特丹','买入 20 手华信科技','查一条内参']};
function aiSubText(){
  if(!AI.cfg.enabled)return '已关闭 · 设置里打开';
  if(AI.cfg.mock)return '演示模式 · 不调用 API';
  if(!AI.cfg.key)return '未配置密钥 · 仍可用本地指令';
  return AI.cfg.model;
}
function openAI(prefill,mode){
  if(!S)return;
  if(CHAT.open&&!prefill){return}
  if(mode)CHAT.mode=mode;
  CHAT.open=true;
  document.body.classList.add('aiopen');
  $('#aiRoot').innerHTML=`<div class="drawer" id="aiDrawer"><div class="dw">
    <div class="dw-h">${ic('ai','width:22px;height:22px;color:var(--gold)')}<div><div class="t">AI 智囊</div><div class="s" id="aiSub">${esc(aiSubText())}</div></div><button class="x" type="button" data-closeai aria-label="关闭">×</button></div>
    <div class="dw-b" id="aiBody"></div>
    <div class="dw-f">
      <div class="row" style="gap:6px"><div class="seg2" id="aiModeSeg"><button type="button" class="b ${CHAT.mode==='ask'?'on':''}" data-aimode="ask" style="padding:4px 12px">咨询</button><button type="button" class="s ${CHAT.mode==='cmd'?'on':''}" data-aimode="cmd" style="padding:4px 12px">下令</button></div><span class="note" id="aiHint" style="margin-left:auto">${CHAT.mode==='ask'?'用你的真实持仓分析':'说人话就行，会先让你确认'}</span></div>
      <div class="qchips" id="aiChips"></div>
      <div class="composer"><textarea id="aiIn" rows="1" placeholder="${CHAT.mode==='ask'?'问策略、问风险、问下一步…':'例如：在深圳买 500 吨大豆'}"></textarea><button class="send" id="aiSend" type="button" aria-label="发送">${ic('send')}</button></div>
    </div></div></div>`;
  paintAI(true);
  const inp=$('#aiIn');if(inp){inp.focus({preventScroll:true});inp.oninput=()=>{inp.style.height='auto';inp.style.height=Math.min(110,inp.scrollHeight)+'px'};
    inp.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAI()}}}
  $('#aiSend').onclick=sendAI;
  if(prefill){const i2=$('#aiIn');if(i2)i2.value=prefill;sendAI()}
  if(!CHAT.msgs.length)pushMsg('a','我是你的家族办公室顾问，看得到你的现金、仓位、在途和行情。\n想问什么直接说；想让我动手，就切到「下令」。');
}
function closeAI(){CHAT.open=false;document.body.classList.remove('aiopen');$('#aiRoot').innerHTML=''}
function pushMsg(who,text,silent){
  CHAT.msgs.push({who,text});
  if(CHAT.msgs.length>40)CHAT.msgs.splice(0,CHAT.msgs.length-40);
  if(silent)return null;
  return appendMsg(CHAT.msgs[CHAT.msgs.length-1]);
}
function mdLite(s){
  return esc(String(s)).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
}
function appendMsg(m){
  const box=$('#aiBody');if(!box)return null;
  const el=document.createElement('div');el.className='msg '+(m.who==='u'?'u':m.who==='e'?'e':'a');
  el.innerHTML=mdLite(m.text);box.appendChild(el);box.scrollTop=box.scrollHeight;return el;
}
function paintAI(force){
  if(!CHAT.open)return;
  const sub=$('#aiSub');if(sub)setTxt(sub,aiSubText());
  if(force){const box=$('#aiBody');if(box){box.innerHTML='';for(const m of CHAT.msgs){if(!String(m.text||'').trim())continue;appendMsg(m)}}
    const c=$('#aiChips');if(c)c.innerHTML=AI_CHIPS[CHAT.mode].map(t=>`<button type="button" data-chip="${esc(t)}">${esc(t)}</button>`).join('');
    const seg=$('#aiModeSeg');if(seg)seg.querySelectorAll('[data-aimode]').forEach(b=>{const on=b.dataset.aimode===CHAT.mode;if(b.classList.contains('on')!==on)b.classList.toggle('on',on)});
    const h=$('#aiHint');if(h)setTxt(h,CHAT.mode==='ask'?'用你的真实持仓分析':'说人话就行，会先让你确认');
    const inp=$('#aiIn');if(inp)inp.placeholder=CHAT.mode==='ask'?'问策略、问风险、问下一步…':'例如：在深圳买 500 吨大豆'}
}
async function sendAI(){
  const inp=$('#aiIn');if(!inp||CHAT.busy)return;
  const text=(inp.value||'').trim();if(!text)return;
  inp.value='';inp.style.height='auto';
  pushMsg('u',text);
  if(CHAT.mode==='cmd')return runCommand(text);
  CHAT.busy=true;AI.busy=true;snd('ai');
  const bubble=pushMsg('a','');
  const el=bubble;let acc='';
  const finish=txt=>{CHAT.busy=false;AI.busy=false;if(el)el.innerHTML=mdLite(txt||'没拿到回复');const b=$('#aiBody');if(b)b.scrollTop=b.scrollHeight};
  if(!AI.ready()){
    CHAT.busy=false;AI.busy=false;
    return finish('还没配置 DeepSeek 密钥，我目前只能用内置的本地规则：\n1. 想让我真正读懂盘面，去「设置 → API 密钥」填一个。\n2. 现在可以直接在「下令」里说人话，本地解析也能下单。\n3. 想先看效果，就在设置里开「演示模式」。');
  }
  try{
    await AI.advise(text,(d,all)=>{acc=all;if(el){el.innerHTML=mdLite(all)+'<span class="cur"></span>';const b=$('#aiBody');if(b)b.scrollTop=b.scrollHeight}});
    grant('ai');
    finish(acc);
    if(el){el.dataset.text=acc}
  }catch(e){
    pushMsg('e',e.message||'请求失败');
    if(el)el.remove();
  }finally{CHAT.busy=false;AI.busy=false}
}
// 下令 → 确认 → 执行
async function runCommand(text){
  CHAT.busy=true;
  const think=pushMsg('a','解析中…');
  let res=null;
  try{
    res=AI.ready()?await AI.command(text):AI.localCommand(text);
  }catch(e){
    res=AI.localCommand(text);
  }
  CHAT.busy=false;
  if(think)think.remove();
  if(!res||!res.actions||!res.actions.length){
    return pushMsg('a',(res&&res.reply)||'这句我听不出要做什么。可以说「在深圳买 500 吨大豆」「把上海的铜运到鹿特丹」「买入 20 手华信科技」。');
  }
  const items=res.actions.map(a=>({a,d:AI.describe(a)}));
  CHAT.pending=items;
  const box=$('#aiBody');
  const el=document.createElement('div');el.className='msg a';el.id='aiConfirm';
  el.innerHTML=mdLite(res.reply||'确认一下：')+'<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">'+
    items.map((it,i)=>`<div style="border:1px solid var(--hair2);border-radius:3px;padding:7px 9px;${it.d.ok?'':'opacity:.55'}"><div>${i+1}. ${esc(it.d.t)}</div>${it.d.sub?`<div class="note">${esc(it.d.sub)}</div>`:''}</div>`).join('')+
    `</div><div class="row" style="margin-top:10px">${items.some(i=>i.d.ok)?'<button class="btn pri sm" type="button" data-run>确认执行</button>':''}<button class="btn sm" type="button" data-cancelrun>取消</button></div>`;
  box.appendChild(el);box.scrollTop=box.scrollHeight;
}
function execPending(){
  const items=CHAT.pending;if(!items)return;
  let n=0;
  for(const it of items){if(!it.d.ok)continue;try{AI.runAction(it.d.act||it.a);n++}catch(e){toast('执行失败：'+e.message,'bad')}}
  CHAT.pending=null;
  const el=$('#aiConfirm');if(el){el.innerHTML=mdLite(n?`已执行 ${n} 项操作。`:'这些操作当前没法执行（现金/库存不足）。')}
  snd(n?'coin':'bad');toast(n?`已执行 ${n} 项操作`:'没有可执行的操作',n?'lv':'bad');refresh();
}
// 合同议价
async function negotiateOffer(id){
  const o=S.offers.find(x=>x.id===id);if(!o)return;
  const demand=await askText({cap:'Negotiation',title:`与 ${o.client} 谈条件`,
    body:`当前回款 <b class="gold">${fmt(o.reward)}</b> · 期限 ${o.days} 天 · 交付 ${C[o.city].n}。`,
    placeholder:'例如：价格再上浮 10%，期限给我 20 天',
    cta:AI.ready()?'发出去':'用内置模型谈',
    hint:AI.ready()?'':'未配置密钥：使用内置议价模型（规则式，不消耗 API）'});
  if(!demand)return;
  toast('谈判中…');snd('click');
  let r=null;
  if(AI.ready()){try{r=await AI.negotiate(o,demand)}catch(e){toast('AI 谈判失败，改用内置模型','bad')}}
  if(!r)r=negotiateLocal(id);
  if(!r){toast('谈判没结果');return}
  if(r.walkAway){
    S.offers=S.offers.filter(x=>x.id!==id);S.prestige=Math.max(0,S.prestige-5);
    news(`${o.client}中止了与${S.company}的谈判`,'bad');snd('bad');
    queueModal(()=>`<div class="cap">Negotiation</div><h2>谈崩了</h2><div class="rule"></div><p>${esc(r.reply||'对方直接结束了会谈。')}</p><button class="btn pri lg" type="button" data-close>回去干活</button>`);
    refresh();return;
  }
  if(r.accept){
    const nr=Math.max(1000,Math.round(o.reward*(1+r.rewardDelta)/100)*100);
    o.reward=nr;o.days=Math.max(4,o.days+(r.daysDelta||0));
    o.prem=Math.max(.02,o.prem+r.rewardDelta);
    S.stats.nego++;grant('nego');snd('coin');
    news(`${o.client}接受新条款，回款调整为 ${fmt(nr)}`,'good');
  }else snd('bad');
  queueModal(()=>`<div class="cap">Negotiation</div><h2>${r.accept?'谈成了':'没谈成'}</h2><div class="rule"></div>
    <p style="text-align:left">${esc(r.reply||'')}</p>
    ${r.accept?`<div class="kv" style="text-align:left"><span class="muted">新回款</span><span class="gold">${fmt(o.reward)}</span><span class="muted">新期限</span><span>${o.days} 天</span></div>`:''}
    <button class="btn pri lg" type="button" data-close>${r.accept?'签下':'知道了'}</button>`);
  refresh();
}
// 黑天鹅
async function aiBlackSwan(){
  toast('突发状况…才怪，是意外');snd('ai');
  let e=null;
  try{e=await AI.blackSwan()}catch(err){}
  if(!e||!e.options.length){decisionTemplate();return}
  grant('blk');
  queueModal(()=>`<div class="cap">Black Swan</div><h2>${esc(e.title)}</h2><div class="rule"></div>
    <p style="text-align:left">${esc(e.body)}</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">${e.options.map((o,i)=>`<button class="opt" type="button" data-act="${i}"><span><b>${esc(o.label)}</b>${o.desc?`<br><span class="note">${esc(o.desc)}</span>`:''}</span></button>`).join('')}</div>`,
    i=>{const o=e.options[i];const eff=applyFx(o.fx);
      news(`${S.company}·${e.title}：${o.label}`,'gold');
      queueModal(()=>`<div class="cap">Outcome</div><h2>${esc(o.label)}</h2><div class="rule"></div>
        <p style="text-align:left">${esc(o.outcome||'')}</p>
        ${eff.length?`<div class="kv" style="text-align:left">${eff.map(([a,v])=>`<span class="muted">${a}</span><span class="${cls(typeof v==='number'?v:1)}">${typeof v==='number'?fmt(v):v}</span>`).join('')}</div>`:''}
        <button class="btn pri lg" type="button" data-close>继续</button>`);
      snd('lv');refresh()});
}

// ================= EVENTS =================
document.addEventListener('pointerdown',e=>{if(e.target.matches&&e.target.matches('input[type=range]'))dragging=true},{passive:true});
const endDrag=()=>{if(dragging){dragging=false;renderWin(true)}};
document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
document.addEventListener('input',e=>{const t=e.target;if(!t.dataset||!t.dataset.range)return;const k=t.dataset.range;
  if(k==='buyPct')CS.buyPct=+t.value;else ui[k]=+t.value;t.style.setProperty('--p',t.value+'%');
  if(dragging){const l=$('#liveQ');if(l&&LIVE[k])l.textContent=LIVE[k]()}else renderWin(true)});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset&&'ins' in t.dataset){ui.ins=!!t.checked;renderWin(true);return}
  if(t.id==='aiModel'){AI.cfg.model=t.value;AI.saveCfg();paintStaticWin()}
  if(t.id==='impFile'&&t.files&&t.files[0])importSave(t.files[0]);
});
document.addEventListener('click',e=>{
  if(!S)return;
  if(e.target.id==='aiDrawer'){closeAI();return}
  if(e.target.id==='ov'){if(win!=='macau')closeWin();return}
  const t=e.target.closest('button,tr[data-stk],tr[data-good]');
  if(!t||t.disabled)return;
  if(t.closest('#modalRoot'))return;
  const d=t.dataset||{};
  // AI 抽屉
  if('closeai' in d){closeAI();return}
  if(d.aimode){CHAT.mode=d.aimode;snd('click');paintAI(true);return}
  if(d.chip){const i2=$('#aiIn');if(i2){i2.value=d.chip;CHAT.mode==='ask'?sendAI():sendAI()}return}
  if('run' in d){execPending();return}
  if('cancelrun' in d){CHAT.pending=null;const el=$('#aiConfirm');if(el)el.innerHTML='<span class="note">已取消。</span>';return}
  // 设置
  if(d.toggle){const k=d.toggle;
    const inp=$('#aiKey');if(inp&&AI.cfg.key!==inp.value)AI.cfg.key=inp.value;   // 别把刚输入的密钥弄丢
    if(k==='sound'){muted=!muted;try{localStorage.setItem('sh_mute',muted?'1':'0')}catch(e){}}
    else{AI.cfg[k]=!AI.cfg[k];AI.saveCfg()}
    snd('click');renderWin(true);return}
  if(t.id==='aiSaveBtn'){AI.cfg.key=($('#aiKey')||{}).value||'';AI.cfg.model=($('#aiModel')||{}).value||AI.cfg.model;
    if(!AI.cfg.key)AI.cfg.mock=false;AI.saveCfg();toast('已保存','lv');renderWin(true);return}
  if(t.id==='aiTest'){
    const inp0=$('#aiKey');if(inp0&&inp0.value)AI.cfg.key=inp0.value;
    if(!AI.ready()){toast('先填密钥或打开演示模式','bad');return}
    toast('测试连通性…');AI.test().then(r=>toast(`连通正常 · ${r.ms}ms · ${r.text}`,'lv')).catch(err=>toast(err.message,'bad'));return}
  if('export' in d){exportSave();return}
  if('import' in d){const f=$('#impFile');f&&f.click();return}
  // 顶栏
  if(t.id==='muteBtn'){muted=!muted;try{localStorage.setItem('sh_mute',muted?'1':'0')}catch(e){}paintTop();snd('click');return}
  if('speed' in d){if(S.started){if(S.inMacau){toast('身在澳门，商业时间暂停');return}setSpeed(+d.speed);snd('click')}return}
  if('open' in d){if(win&&d.open===win)return;if(win)closeWin();openWin(d.open);return}
  if('intel-desk' in d){if(win&&win==='hq')return;if(win)closeWin();openWin('hq');return}
  if('closew' in d){closeWin();return}
  if('ipo' in d){doIPO();return}
  if(!win)return;
  const rw=()=>renderWin(true);
  // 通用
  if(d.city){ui.city=d.city;snd('click');rw();return}
  if(d.good){ui.good=d.good;ui.pct=ui.mode==='b'?30:100;snd('click');rw();setTimeout(()=>{const tr=document.querySelector(`tr[data-good="${d.good}"]`);tr&&tr.scrollIntoView({behavior:reduce?'auto':'smooth',block:'nearest'})},30);return}
  if(d.mode){ui.mode=d.mode;ui.pct=d.mode==='b'?30:100;snd('click');rw();return}
  if(d.pctset){const [k,v]=d.pctset.split(':');ui[k]=+v;snd('click');rw();return}
  if('gtrade' in d){const q=tradeQ();if(ui.mode==='b')buyGood(ui.city,ui.good,q);else sellGood(ui.city,ui.good,q);return}
  if(d.shipfast){const [g,city]=d.shipfast.split(':');ui.from=ui.city;ui.sgood=g;ui.to=city;ui.shpct=100;ui.ins=false;
    toast(`已选好：${C[ui.city].n} → ${C[city].n} · ${G[g].n}`);rw();openWin('port');return}
  if(d.from){ui.from=d.from;snd('click');rw();return}
  if(d.to){ui.to=d.to;snd('click');rw();return}
  if(d.sgood){ui.sgood=d.sgood;snd('click');rw();return}
  if('sail' in d){ship(ui.from,ui.to,ui.sgood,shipQ(),ui.ins);return}
  if(d.stk){ui.stock=d.stk;snd('click');rw();return}
  if(d.smode){ui.smode=d.smode;ui.spct=d.smode==='b'?25:100;snd('click');rw();return}
  if('strade' in d){const l=stockLots();if(ui.smode==='b')buyStock(ui.stock,l);else sellStock(ui.stock,l);return}
  if(d.accept){acceptOffer(+d.accept);return}
  if(d.deliver){deliver(+d.deliver);return}
  if(d.nego){negotiateOffer(+d.nego);return}
  if('borrow' in d){borrow(bankAmt());return}
  if('repayall' in d){repay(S.loan);return}
  if(d.lcat){ui.luxCat=d.lcat;snd('click');rw();return}
  if(d.lbuy){buyLux(d.lbuy);return}
  if(d.lsell){sellLux(+d.lsell);return}
  if(d.upg){buyUpg(d.upg);return}
  if(d.intelbuy){buyIntel(d.intelbuy);return}
  if('spin' in d){spin();return}
  if('rename' in d){startScreen(true);return}
  if('reset' in d){queueModal(()=>'<h2>确定重新开局？</h2><div class="rule"></div><p>当前进度将被清空。</p><div class="row" style="justify-content:center"><button class="btn buy" type="button" data-act="0">清空重来</button><button class="btn" type="button" data-close>取消</button></div>',()=>{try{localStorage.removeItem(LS)}catch(e){}win=null;$('#winRoot').innerHTML='';startScreen()});return}
  if(d.game){if(CS.sl.spinning||CS.phase==='deal')return;CS.game=d.game;snd('click');rw();return}
  if(d.room){CS.room=d.room;CS.chip=0;CS.sl.bet=0;if(CS.phase==='done')baccReset();snd('click');rw();return}
  if(d.chip){CS.chip=+d.chip;snd('chip');rw();return}
  if(d.bet){baccPlace(d.bet);return}
  if('bclear' in d){baccClear();return}
  if('rebet' in d){baccRebet();return}
  if('deal' in d){baccDeal();return}
  if(d.sbet){if(CS.sl.spinning)return;CS.sl.bet=+d.sbet;snd('chip');rw();return}
  if('spinslot' in d){slotSpin();return}
  if('sit' in d){hdSit();return}
  if('hdleave' in d){hdLeave();return}
  if('hdnext' in d){hdNewHand();return}
  if(d.hda){if(!HD||HD.toAct!==0)return;hdAct(0,d.hda,+d.to||0);return}
});
document.addEventListener('click',e=>{const tr=e.target.closest&&e.target.closest('tr[data-sp]');if(!tr||!S)return;
  if(win||modalOpen)return;
  if(!goodUnlocked(tr.dataset.sp))return;
  ui.good=tr.dataset.sp;ui.mode='b';ui.pct=30;openWin('trade');snd('click')});

// AI 悬浮按钮
if($('#aiFab'))$('#aiFab').onclick=()=>{if(!S||!S.started)return;snd('click');CHAT.open?closeAI():openAI()};

// ================= KEYBOARD =================
function togglePause(){if(!S||!S.started)return;if(S.inMacau){toast('身在澳门，商业时间暂停');return}setSpeed(speed?0:1);snd('click')}
document.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select')return;
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  const k=e.key;
  if(k==='Escape'){
    if(modalOpen)return;
    if(CHAT.open){closeAI();return}
    if(win&&win!=='macau')closeWin();
    return}
  if(!S||!S.started)return;
  if(k===' '){e.preventDefault();togglePause();return}
  if(k==='a'||k==='A'){e.preventDefault();CHAT.open?closeAI():openAI();return}
  if(k==='s'||k==='S'){if(win==='settings')closeWin();else{if(win)closeWin();openWin('settings')}return}
  if(k==='m'||k==='M'){muted=!muted;try{localStorage.setItem('sh_mute',muted?'1':'0')}catch(err){}paintTop();return}
  if(k==='?'){if(win)closeWin();openWin('settings');return}
  if(/^[1-9]$/.test(k)){const d=DESKS.find(x=>x.k===k);if(!d)return;if(win)closeWin();openWin(d.id)}
});

// ================= BOOT =================
function setSpeed(s){speed=s;clearInterval(timer);if(s>0)timer=setInterval(()=>{if(!document.hidden&&!modalOpen&&S&&S.started&&!S.inMacau)tick()},3000/s);
  try{localStorage.setItem('sh_speed',String(s))}catch(e){}
  if(S){const seg=$('#speedSeg');if(seg)seg.querySelectorAll('[data-speed]').forEach(b=>{const on=+b.dataset.speed===s;if(b.classList.contains('on')!==on)b.classList.toggle('on',on)})}}
function gameOver(){setSpeed(0);queueModal(()=>`<div class="cap">Liquidation</div><h2>${esc(S.company)} 破产清算</h2><div class="rule"></div><p>经营 ${S.day} 天，最高净资产 <span class="gold">${fmt(S.stats.maxNW)}</span>。</p><button class="btn pri lg" type="button" data-act="0">重新创业</button>`,()=>{try{localStorage.removeItem(LS)}catch(e){}startScreen()})}
function startScreen(rename){if(!rename)setSpeed(0);
  queueModal(()=>`<div class="cap">${rename?'Company':'Shanghai · January 2026'}</div><h2>${rename?'更改公司名称':'创办你的贸易公司'}</h2><div class="rule"></div>${rename?'':'<p>启动资金 ¥15 万。在六大港口之间低买高卖大宗商品，承接大客户合同，投资 A 股，与四家 AI 财团及其他真人玩家角逐富豪榜。闲暇时，可以飞往澳门。</p><p class="note">按 A 唤起 AI 智囊；按 ? 看快捷键。</p>'}
   <input type="text" id="nameIn" maxlength="16" aria-label="公司名称" value="${rename?esc(S.company):esc(pick(['恒远','金帆','瑞丰','鸿运','华兴','万和'])+'贸易有限公司')}" style="text-align:center;font-size:16px;font-family:var(--f-serif)">
   <button class="btn pri lg" type="button" id="startBtn">${rename?'保存':'注册开业'}</button>`,null,()=>{
  $('#startBtn').onclick=()=>{const n=($('#nameIn').value||'').trim()||'无名贸易行';
    if(rename){S.company=n;closeModal();save();pushPlayer(true);refresh();return}
    S=newGame(n);S.started=true;news(`${n}在上海正式开业`,'gold');news('提示：交易所「调货到」一列会显示跨港价差','');for(let i=0;i<3;i++)genOffer();
    S.month={start:0,nw:netWorth(),trade0:0,stock0:0,cas0:0,cost0:0,intr0:0};
    closeModal();snd('lv');setSpeed(1);save();pushPlayer(true);refresh()}})}

// 背景：静态绘制一次（resize 才重画），不参与每帧
const bgc=$('#bgc');
function drawBG(){if(!bgc)return;const W=innerWidth,H=innerHeight,dpr=Math.min(2,devicePixelRatio||1);
  bgc.width=W*dpr;bgc.height=H*dpr;const x=bgc.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);
  const g=x.createRadialGradient(W*.7,-H*.1,0,W*.7,-H*.1,Math.max(W,H)*1.1);g.addColorStop(0,'#1a1712');g.addColorStop(.5,'#0e1013');g.addColorStop(1,'#0a0b0d');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(200,169,106,.05)';x.lineWidth=.6;const cx=W*.82,cy=H*.18,R=Math.min(W,H)*.42;
  for(let k=0;k<26;k++){x.beginPath();for(let t=0;t<=Math.PI*2+.01;t+=.02){const r=R*(.55+.45*Math.cos(7*t+k*.24))*(.7+k*.012);const px=cx+r*Math.cos(t+k*.03),py=cy+r*Math.sin(t+k*.03);t?x.lineTo(px,py):x.moveTo(px,py)}x.stroke()}}
drawBG();

let __rz=0;
window.addEventListener('resize',()=>{clearTimeout(__rz);__rz=setTimeout(()=>{
  drawBG();
  if(win){const b=$('#wb');if(b){b._h='';renderWin(true)}}
  const m=$('#main');if(m){m._h='';paintMain()}
  tk.boxW=0;tk.x=0},160)});

// 常驻帧循环：进度条 + 跑马灯（统一带宽高控制，只有一处 rAF）
let __lastFrame=performance.now();
(function loop(t){
  const dt=Math.min(120,t-__lastFrame);__lastFrame=t;
  if(S){
    const f=$('#dayFill');
    if(f){const p=speed&&!modalOpen&&!S.inMacau&&S.started?clamp((performance.now()-lastTick)/(3000/speed),0,1):0;const w=(p*100).toFixed(1)+'%';if(f.style.width!==w)f.style.width=w}
    tickerStep(dt);
  }
  requestAnimationFrame(loop);
})(performance.now());

function start(data){
  let loaded=data&&data.state;
  if(!loaded){try{const raw=localStorage.getItem(LS);if(raw)loaded=JSON.parse(raw)}catch(e){}}
  if(loaded&&loaded.started){
    S=migrate(loaded);S.inMacau=false;
    if(data&&data.ui)Object.assign(ui,data.ui);
    else if(S.ui)Object.assign(ui,S.ui);
    refresh();setSpeed(1);
    if(data&&data.win&&data.win!=='macau')openWin(data.win);
  }else{
    S=newGame('商海浮沉');for(let i=0;i<3;i++)genOffer();refresh();startScreen();
  }
  initCloud();
}
// 调试/自动化钩子（不影响正常玩法）
Object.defineProperty(window,'__S',{get:()=>S});
window.__nw=()=>netWorth();
window.__tick=()=>{tick();return S.day};
window.__AI=AI;
window.__ui=ui;
window.__T={clearModals(){mq.length=0;modalOpen=false;const m=$('#modalRoot');if(m)m.innerHTML=''},
  open:openWin,close:closeWin,isModal:()=>modalOpen,
  modalText(){const m=$('#modalRoot .modal');return m?m.textContent:''},
  addDay(n){for(let i=0;i<(n||1);i++)tick()},refresh(){refresh()},ui,speed:()=>speed,winId:()=>win,modalOpen:()=>modalOpen,mqLen:()=>mq.length,
  flush(){flush()},frame(){tick();flush()},toast:(t,k)=>toast(t,k)};

window.claude?.hot?.snapshot?.(()=>({state:JSON.parse(snapshot()),ui,win}));
window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});
})();
</script>
</body>
</html>
