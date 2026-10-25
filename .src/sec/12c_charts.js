// ================= CHARTS =================
// 图表数据走 CH 注册表（不再把数组 JSON 塞进 data-* 属性），并带签名跳过无变化重绘
const CH_SIG=new WeakMap();
function drawCharts(root){
  if(!root)return;
  const up='#d8604e',down='#4f9f80',muted='#8f8a80',gold='#c8a96a';
  const prep=cv=>{const dpr=Math.min(2,devicePixelRatio||1),w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return [null];
    const W=Math.round(w*dpr),H=Math.round(h*dpr);
    if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
    const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);return [x,w,h]};
  root.querySelectorAll('canvas.spark').forEach(cv=>{
    const d=CH.get(cv.dataset.cid);if(!d||d.length<2)return;
    const sig='s'+d.length+'|'+d[0]+'|'+d[d.length-1];
    if(CH_SIG.get(cv)===sig)return;CH_SIG.set(cv,sig);
    const [x,w,h]=prep(cv);if(!x)return;
    let mn=Infinity,mx=-Infinity;for(const v of d){if(v<mn)mn=v;if(v>mx)mx=v}
    const r=(mx-mn)||1,col=d[d.length-1]>=d[0]?up:down;
    x.beginPath();for(let i=0;i<d.length;i++){const X=i/(d.length-1)*w,Y=2+(1-(d[i]-mn)/r)*(h-4);i?x.lineTo(X,Y):x.moveTo(X,Y)}
    x.strokeStyle=col;x.lineWidth=1.1;x.stroke()});
  root.querySelectorAll('canvas.chart,canvas[data-cid]').forEach(cv=>{
    if(cv.classList.contains('spark'))return;
    const cid=cv.dataset.cid;const d=cid?CH.get(cid):null;if(!d||d.length<2)return;
    const isK=Array.isArray(d[0]);
    const sig=(isK?'k':'l')+d.length+'|'+(isK?d[d.length-1][3]:d[d.length-1])+'|'+cv.clientWidth+'x'+cv.clientHeight;
    if(CH_SIG.get(cv)===sig)return;CH_SIG.set(cv,sig);
    const [x,w,h]=prep(cv);if(!x)return;
    if(isK){
      const pad={l:4,r:54,t:8,b:8};let mn=Infinity,mx=-Infinity;
      for(const c of d){if(c[2]<mn)mn=c[2];if(c[1]>mx)mx=c[1]}
      const rr=(mx-mn)||1;mn-=rr*.05;mx+=rr*.05;
      const cw=(w-pad.l-pad.r)/d.length,Y=v=>pad.t+(1-(v-mn)/(mx-mn))*(h-pad.t-pad.b);
      x.font='10.5px "IBM Plex Mono", monospace';x.fillStyle=muted;x.strokeStyle='rgba(236,230,218,.05)';
      for(let i=0;i<=3;i++){const v=mn+(mx-mn)*i/3,y=Y(v);x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();x.fillText(v.toFixed(2),w-pad.r+8,y+4)}
      for(let i=0;i<d.length;i++){const [o,hi,lo,cl]=d[i];const col=cl>=o?up:down;const cx=pad.l+i*cw+cw/2;
        x.strokeStyle=col;x.fillStyle=col;x.lineWidth=1;x.beginPath();x.moveTo(cx,Y(hi));x.lineTo(cx,Y(lo));x.stroke();
        const y1=Y(Math.max(o,cl)),y2=Y(Math.min(o,cl));x.fillRect(cx-cw*.32,y1,cw*.64,Math.max(1,y2-y1))}
      x.beginPath();let s=0;for(let i=0;i<d.length;i++){s+=d[i][3];if(i>=5)s-=d[i-5][3];if(i>=4){const cx=pad.l+i*cw+cw/2;i===4?x.moveTo(cx,Y(s/5)):x.lineTo(cx,Y(s/5))}}
      x.strokeStyle=gold;x.lineWidth=1.2;x.stroke();
      return;
    }
    const mini=cv._mini;const pad=mini?{l:2,r:2,t:6,b:6}:{l:4,r:70,t:10,b:10};
    let mn=Infinity,mx=-Infinity;for(const v of d){if(v<mn)mn=v;if(v>mx)mx=v}
    if(mx===mn){mx+=1;mn-=1}
    const rr=mx-mn;mn-=rr*.08;mx+=rr*.08;
    const X=i=>pad.l+i/(d.length-1)*(w-pad.l-pad.r),Y=v=>pad.t+(1-(v-mn)/(mx-mn))*(h-pad.t-pad.b);
    const col=mini?gold:(d[d.length-1]>=d[0]?up:down);
    const money=Math.max(Math.abs(mx),Math.abs(mn))>1e5;
    if(!mini){x.font='10.5px "IBM Plex Mono", monospace';x.fillStyle=muted;x.strokeStyle='rgba(236,230,218,.05)';
      for(let i=0;i<=3;i++){const v=mn+(mx-mn)*i/3,y=Y(v);x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();x.fillText(money?fmt(v):fmtP(v),w-pad.r+8,y+4)}}
    const gr=x.createLinearGradient(0,pad.t,0,h);gr.addColorStop(0,col+'33');gr.addColorStop(1,col+'00');
    x.beginPath();for(let i=0;i<d.length;i++){i?x.lineTo(X(i),Y(d[i])):x.moveTo(X(i),Y(d[i]))}
    x.strokeStyle=col;x.lineWidth=mini?1.3:1.4;x.stroke();
    x.lineTo(X(d.length-1),h-pad.b);x.lineTo(X(0),h-pad.b);x.closePath();x.fillStyle=gr;x.fill();
    if(!mini){x.beginPath();x.arc(X(d.length-1),Y(d[d.length-1]),2.8,0,7);x.fillStyle=col;x.fill()}
  });
}

// ================= TRADE TICKET =================
function ticket(){const g=G[ui.good],c=ui.city,inv=S.inv[c][ui.good];const q=tradeQ();
  const qt=q>0?(ui.mode==='b'?quoteBuy(c,ui.good,q):quoteSell(c,ui.good,q)):null;const profit=ui.mode==='s'&&inv&&qt?qt.total-inv.cost*q:null;const m=S.mkt[c][ui.good];
  CH.set('ticket',m.h);
  // 跨港套利提示：直接给出扣运费后净利最高的目的地
  let hint='';if(ui.mode==='b'){
    let best=null;
    for(const t of unlockedCities()){if(t.id===c)continue;
      const qq=Math.max(1,q||1);const gain=(bidP(t.id,ui.good)-askP(c,ui.good))*qq-freight(c,t.id,ui.good,qq);
      if(!best||gain>best.gain)best={c:t,gain}}
    if(best&&best.gain>0)hint=`运到${best.c.n}卖，扣运费后净赚 <span class="gold">${fmt(best.gain)}</span> <button class="chip" type="button" data-shipfast="${ui.good}:${best.c.id}">安排</button>`}
  return `<div class="ticket"><div class="sp" style="flex-wrap:wrap"><div><span class="code">${g.code}</span><b style="font-family:var(--f-serif);font-size:18px;font-weight:600">${g.n} · ${C[c].n}</b><div class="note" style="margin-top:4px">买价 <span class="m">${fmtP(askP(c,g.id))}</span> · 卖价 <span class="m">${fmtP(bidP(c,g.id))}</span> / ${g.u}${inv?` · 持仓 <span class="m">${fmtQ(inv.q)}</span> · 成本 <span class="m">${fmtP(inv.cost)}</span>`:''}</div></div>
   <div class="seg2"><button type="button" class="b ${ui.mode==='b'?'on':''}" data-mode="b">买入</button><button type="button" class="s ${ui.mode==='s'?'on':''}" data-mode="s">卖出</button></div></div>
   ${hint?`<div class="note">${hint}</div>`:''}
   <canvas class="chart" style="height:150px" data-cid="ticket"></canvas>
   <div><div class="sp"><span class="k">${ui.mode==='b'?'买入数量（受现金与仓容限制）':'卖出数量'}</span><span class="m" style="font-size:15px" id="liveQ">${fmtQ(q)} ${g.u}</span></div><input type="range" min="0" max="100" value="${ui.pct}" data-range="pct" style="--p:${ui.pct}%" aria-label="数量比例"><div class="quick">${[10,25,50,100].map(v=>`<button type="button" data-pctset="pct:${v}">${v===100?'最大':v+'%'}</button>`).join('')}</div></div>
   <div class="sp" style="flex-wrap:wrap"><div class="kv">${qt?`<span class="muted">成交均价</span><span>${fmtP(qt.unit)}</span><span class="muted">${ui.mode==='b'?'成交金额':'成交收入'}</span><span>${fmt(qt.total)}</span><span class="muted">价格冲击 <span class="tip" data-t="你这一单占该港该品种深度的比例，越大越吃亏">?</span></span><span>${pct(qt.impact,1)}</span>${profit!=null?`<span class="muted">本笔盈亏</span><span class="${cls(profit)}">${fmt(profit)}</span>`:''}`:`<span class="muted">${ui.mode==='b'?'现金或仓容不足':'本港无持仓'}</span><span></span>`}</div>
   <button class="btn lg ${ui.mode==='b'?'buy':'sell'}" type="button" data-gtrade ${q>0?'':'disabled'}>${ui.mode==='b'?'确认买入':'确认卖出'}</button></div></div>`}

// ================= MAP =================
const CONT=`<g fill="rgba(236,230,218,.035)" stroke="rgba(236,230,218,.12)" stroke-width=".7">
 <path d="M470 70 Q520 60 560 80 L600 70 Q680 60 760 75 Q840 85 880 110 L880 140 Q850 150 845 175 L830 200 Q810 215 795 210 L780 235 Q770 228 760 210 L735 205 Q715 215 700 200 L680 210 Q660 205 650 190 L630 175 Q600 160 585 145 L560 140 Q530 150 515 140 L500 125 Q480 115 470 100 Z"/>
 <path d="M500 150 Q530 145 560 160 L600 170 Q625 200 610 240 L590 290 Q570 310 555 300 L540 260 Q520 230 505 200 Q490 180 500 150 Z"/>
 <path d="M790 260 Q820 255 850 265 L870 300 Q850 320 820 312 L795 290 Z"/>
 <path d="M340 230 Q360 220 395 235 L420 260 Q410 300 390 330 L375 345 Q360 330 362 300 L345 265 Z"/></g>`;
function routePath(a,b){const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,k=.18;return `M${a.x} ${a.y} Q${(mx-dy*k).toFixed(1)} ${(my+dx*k).toFixed(1)} ${b.x} ${b.y}`}
function qpt(a,b,t){const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,k=.18;const cx=mx-dy*k,cy=my+dx*k;const u=1-t;return {x:u*u*a.x+2*u*t*cx+t*t*b.x,y:u*u*a.y+2*u*t*cy+t*t*b.y}}
let shipRAF=0;
function drawShips(){cancelAnimationFrame(shipRAF);const layer=document.getElementById('shipLayer');if(!layer||win!=='port')return;
  const frac=speed&&!modalOpen?clamp((performance.now()-lastTick)/(3000/speed),0,1):0;
  layer.innerHTML=S.ships.map(s=>{const t=clamp((S.day+frac-s.dep)/(s.eta-s.dep),0,1);const a=C[s.from],b=C[s.to];const p=qpt(a,b,t),p2=qpt(a,b,Math.min(1,t+.01)),p0=qpt(a,b,Math.max(0,t-.01));const ang=Math.atan2(p2.y-p0.y,p2.x-p0.x)*180/Math.PI;
    return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(0)})"><path d="M-8 -3h11l4 3-4 3h-11z" fill="#e4cb93"/></g>`}).join('');
  if(!reduce)shipRAF=requestAnimationFrame(drawShips)}

// ================= CASINO VIEWS（沿用原实现） =================
function chipsRow(vals,cur,attr){return `<div class="chips">${vals.map((v,i)=>`<button type="button" class="tok ${v===cur?'on':''}" style="--cc:${CHIPCOL[i%CHIPCOL.length]}" data-${attr}="${v}" aria-label="筹码 ${fmt(v)}"><span>${chipLbl(v)}</span></button>`).join('')}</div>`}
function baccView(){const r=room();if(!r.chips.includes(CS.chip))CS.chip=r.chips[0];const w=CS.win||{};const done=CS.phase==='done';
  const spot=(k,n,po)=>`<button type="button" class="spot ${k} ${done&&((k===w.res)||(k==='PP'&&w.pp)||(k==='BP'&&w.bp))?'win':''}" data-bet="${k}"><span class="sn">${n}</span><span class="po">${po}</span><span class="amt">${CS.bets[k]?chipLbl(CS.bets[k]):''}</span></button>`;
  return `<div class="felt"><div class="lgd">PUNTO BANCO · 8 DECKS · BANKER PAYS 0.95</div>
   <div class="hands"><div class="hand"><div class="who" style="color:#8fb4e8">闲 PLAYER</div><div class="pts">${CS.pc.length?bPts(CS.pc):''}</div><div class="cards">${CS.pc.map(c=>card(c)).join('')}</div></div><div class="hand"><div class="who" style="color:#e8908a">庄 BANKER</div><div class="pts">${CS.bc.length?bPts(CS.bc):''}</div><div class="cards">${CS.bc.map(c=>card(c)).join('')}</div></div></div>
   <div style="text-align:center;min-height:24px;font-family:var(--f-serif);color:var(--gold-hi);margin-bottom:12px">${CS.msg||(CS.phase==='deal'?'发牌中…':'请选择筹码并下注')}</div>
   <div class="spots">${spot('P','闲','1 : 1')}${spot('T','和','8 : 1')}${spot('B','庄','0.95 : 1')}</div><div class="spots2">${spot('PP','闲对','11 : 1')}${spot('BP','庄对','11 : 1')}</div></div>
  <div style="margin:16px 0">${chipsRow(r.chips,CS.chip,'chip')}</div>
  <div class="row" style="justify-content:center"><span class="note">本局下注 <span class="m" style="color:var(--ink)">${fmt(betTotal())}</span> · 现金 <span class="m" style="color:var(--ink)">${fmt(S.cash)}</span></span><button class="btn" type="button" data-bclear ${CS.phase==='bet'&&betTotal()?'':'disabled'}>撤回</button><button class="btn" type="button" data-rebet ${CS.last&&CS.phase!=='deal'?'':'disabled'}>重复上局</button><button class="btn pri lg" type="button" data-deal ${CS.phase==='bet'&&betTotal()?'':'disabled'}>发牌</button></div>
  <div class="sec">珠盘路 <span class="note">牌靴剩余 ${CS.shoe.length||416} 张 · 庄 ${CS.road.filter(x=>x==='B').length} · 闲 ${CS.road.filter(x=>x==='P').length} · 和 ${CS.road.filter(x=>x==='T').length}</span></div>
  <div class="road">${CS.road.map(x=>`<i class="${x}">${x==='B'?'庄':x==='P'?'闲':'和'}</i>`).join('')}</div>`}
function slotView(){const r=room();const sl=CS.sl;if(!r.slot.includes(sl.bet))sl.bet=r.slot[0];const last=sl.last||['7','D','B'];const maxb=r.slot[r.slot.length-1];
  return `<div class="jp"><div class="cap">Progressive Jackpot · ${r.n}</div><div class="v fig">${fmt(jackpot())}</div><div class="note">押注 ${fmt(maxb)} 转出三个 7，赢得全部奖池</div></div>
  <div class="reels">${[0,1,2].map(i=>`<div class="reel"><div class="strip">${['P',last[i],'S'].map(symHTML).join('')}</div></div>`).join('')}</div>
  <div id="slotMsg" style="text-align:center;min-height:26px;margin:14px 0 6px;font-family:var(--f-serif);color:var(--gold-hi)">${sl.msg||'&nbsp;'}</div>
  <div style="margin:6px 0 14px">${chipsRow(r.slot,sl.bet,'sbet')}</div>
  <div class="row" style="justify-content:center"><span class="note">现金 <span class="m" style="color:var(--ink)">${fmt(S.cash)}</span></span><button class="btn pri lg" type="button" data-spinslot ${sl.spinning?'disabled':''}>拉杆 · ${fmt(sl.bet)}</button></div>
  <div class="sec">赔率表 <span class="note">理论返还率约 94.7%（含奖池）</span></div>
  <div class="tbl"><table class="pay"><tbody>${[['7 7 7','300 倍 + 累积奖池（最高押注）'],['◆ ◆ ◆','100 倍'],['BAR BAR BAR','40 倍'],['♛ ♛ ♛','20 倍'],['♠ ♠ ♠','10 倍'],['♥ ♥ ♥','4 倍'],['任意两个 7','10 倍'],['任意两个 ◆','5 倍'],['任意一个 7','2 倍'],['首轴 ◆','1 倍']].map(([a,b])=>`<tr><td class="m">${a.replace(/[♛♠♥]/g,'$&︎')}</td><td class="r">${b}</td></tr>`).join('')}</tbody></table></div>`}
function hdView(){const r=room();
  if(!HD)return `<div class="felt" style="text-align:center"><div class="lgd">NO-LIMIT TEXAS HOLD'EM · 4-MAX</div><h3 style="font-family:var(--f-serif);font-weight:600;font-size:22px;margin:16px 0 6px">${r.n} · 盲注 ${chipLbl(r.blinds[0])} / ${chipLbl(r.blinds[1])}</h3><p class="note">与三位来自各地的牌手同桌。买入额 ${fmt(r.buy[0])} – ${fmt(r.buy[1])}，离桌时筹码兑回现金。</p>
   <div style="max-width:360px;margin:18px auto 6px"><div class="sp"><span class="k">买入</span><span class="v gold" id="liveQ" style="font-size:22px">${fmt(buyAmt())}</span></div><input type="range" min="0" max="100" value="${CS.buyPct}" data-range="buyPct" style="--p:${CS.buyPct}%" aria-label="买入金额"></div>
   <button class="btn pri lg" type="button" data-sit ${S.cash>=buyAmt()?'':'disabled'}>入座</button></div>`;
  const me=HD.players[0];const myTurn=HD.toAct===0&&HD.stage!=='done'&&HD.stage!=='broke';const call=HD.curBet-me.bet;const pot=hdPot();
  const seat=i=>{const p=HD.players[i];const showC=i===0||p.show;return `<div class="seat ${HD.toAct===i?'act':''} ${p.folded?'out':''}" style="grid-area:s${i}"><div class="nm">${esc(p.name)}${HD.dealer===i?'<span class="dbtn">D</span>':''}</div><div class="note">${p.ai?esc(p.from)+' · '+STY[p.style].n:'你的座位'}</div><div class="stk fig">${fmt(p.stack)}</div><div class="cards">${p.cards.map(c=>card(c,'sm '+(showC?'':'back')+(p.folded&&i===0?' dim':''))).join('')}</div><div class="la">${[p.won?'<span class="gold">赢 '+fmt(p.won)+'</span>':esc(p.la||''),p.hn&&p.show?p.hn:'',p.bet&&!p.won?'注 '+chipLbl(p.bet):''].filter(Boolean).join(' · ')}</div></div>`};
  let ctl='';
  if(HD.stage==='broke')ctl=`<span class="note">筹码不足大盲，请离桌后重新买入。</span><button class="btn" type="button" data-hdleave>离桌</button>`;
  else if(HD.stage==='done')ctl=`<button class="btn pri lg" type="button" data-hdnext>下一手</button><button class="btn" type="button" data-hdleave>离桌兑现</button>`;
  else if(myTurn){const cap=me.stack+me.bet,minTo=Math.min(cap,HD.curBet+HD.minRaise);const bb=HD.blinds[1];const opts=[[minTo,'最小加注'],[HD.curBet+Math.round((pot+call)*.5/bb)*bb,'½ 底池'],[HD.curBet+Math.round((pot+call)/bb)*bb,'底池'],[cap,'全下']].filter(([v])=>v>HD.curBet&&v<=cap&&v>=minTo);
    const seen=new Set();const ro=opts.filter(([v])=>{if(seen.has(v))return false;seen.add(v);return true});
    ctl=`<button class="btn" type="button" data-hda="fold">弃牌</button><button class="btn" type="button" data-hda="call">${call?'跟注 '+fmt(Math.min(call,me.stack)):'过牌'}</button>${ro.map(([v,l])=>`<button class="btn pri" type="button" data-hda="raise" data-to="${v}">${l} · ${chipLbl(v)}</button>`).join('')}`}
  else ctl=`<span class="note">${me.folded?'已弃牌，等待本手结束…':'等待其他牌手行动…'}</span>`;
  return `<div class="felt"><div class="lgd">NO-LIMIT HOLD'EM · 盲注 ${chipLbl(HD.blinds[0])}/${chipLbl(HD.blinds[1])}</div><div class="pk" style="margin-top:12px">${seat(2)}${seat(1)}<div class="mid" style="grid-area:mid"><div class="cards">${HD.board.map(c=>card(c)).join('')||'<span class="note" style="align-self:center">翻牌前</span>'}</div><div class="cap" style="margin-top:6px">Pot</div><div class="pot fig">${fmt(pot)}</div><div class="note" style="min-height:18px;color:var(--gold-hi)">${HD.res?esc(HD.res):''}</div></div>${seat(3)}${seat(0)}</div></div>
   <div class="row" style="justify-content:center;margin-top:14px">${ctl}</div>
   <div class="sec">牌局记录</div><div class="feed" style="max-height:160px">${HD.log.map(l=>`<div class="it">${esc(l)}</div>`).join('')}</div>`}
