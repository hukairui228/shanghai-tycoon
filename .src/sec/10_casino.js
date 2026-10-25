// ================= CASINO =================
const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'],SUITS=['♠','♥','♦','♣'];
function newDeck(n){const d=[];for(let k=0;k<n;k++)for(let c=0;c<52;c++)d.push(c);for(let i=d.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[d[i],d[j]]=[d[j],d[i]]}return d}
function card(c,opt=''){if(c==null||opt.includes('back'))return `<div class="pc back ${opt}"></div>`;const r=c%13,s=c/13|0;return `<div class="pc ${s===1||s===2?'red':''} ${opt}"><span class="r">${RANKS[r]}</span><span class="s">${SUITS[s]}︎</span><span class="b">${SUITS[s]}︎</span></div>`}
const CS={room:'main',game:'bacc',chip:0,bets:{P:0,B:0,T:0,PP:0,BP:0},last:null,shoe:[],road:[],phase:'bet',pc:[],bc:[],msg:'',win:null,sl:{bet:0,spinning:false,msg:'',last:null},buyPct:40,prevSpeed:1};
const room=()=>ROOMS.find(r=>r.id===CS.room);
const roomOpen=r=>S.level>=r.lv;
function casinoResult(net,staked){S.casino.net+=net;S.casino.wagered+=staked;grant('mac');
  if(net>0){snd('coin');floaty('+'+fmt(net));if(net>=1e6)grant('god')}else if(net<0)floaty(fmt(net),'var(--down)')}
// baccarat
const bVal=c=>{const r=c%13;return r===12?1:r>=8?0:r+2};
const bPts=a=>a.reduce((s,c)=>s+bVal(c),0)%10;
function betTotal(){return Object.values(CS.bets).reduce((a,b)=>a+b,0)}
function baccPlace(area){if(CS.phase==='deal')return;if(CS.phase==='done')baccReset();const r=room();const v=CS.chip||r.chips[0];
  if(S.cash<v){toast('现金不足','bad');return}if(betTotal()+v>r.max){toast(`超出本桌限红 ${fmt(r.max)}`,'bad');return}
  S.cash-=v;CS.bets[area]+=v;snd('chip');refresh()}
function baccReset(){CS.phase='bet';CS.pc=[];CS.bc=[];CS.msg='';CS.win=null}
function baccClear(){if(CS.phase!=='bet')return;S.cash+=betTotal();for(const k in CS.bets)CS.bets[k]=0;refresh()}
function baccRebet(){if(!CS.last)return;if(CS.phase==='done')baccReset();if(CS.phase!=='bet')return;const need=Object.values(CS.last).reduce((a,b)=>a+b,0);if(S.cash<need){toast('现金不足','bad');return}
  if(betTotal()+need>room().max){toast('超出本桌限红','bad');return}for(const k in CS.last){CS.bets[k]+=CS.last[k];S.cash-=CS.last[k]}snd('chip');refresh()}
function baccDeal(){const tot=betTotal();const r=room();if(CS.phase!=='bet')return;if(!tot){toast('请先下注');return}if(tot<r.min){toast(`本桌最低下注 ${fmt(r.min)}`);return}
  if(CS.shoe.length<16){CS.shoe=newDeck(8);CS.road=[];toast('更换新牌靴 · 8 副牌')}
  CS.phase='deal';CS.pc=[];CS.bc=[];const draw=()=>CS.shoe.pop();
  const p=[draw()],b=[draw()];p.push(draw());b.push(draw());let p3=null;
  if(!(bPts(p)>=8||bPts(b)>=8)){if(bPts(p)<=5){p3=draw();p.push(p3)}const bs=bPts(b);let bd;
    if(p3===null)bd=bs<=5;else{const t=bVal(p3);bd=bs<=2||(bs===3&&t!==8)||(bs===4&&t>=2&&t<=7)||(bs===5&&t>=4&&t<=7)||(bs===6&&(t===6||t===7))}
    if(bd)b.push(draw())}
  const seq=[['p',p[0]],['b',b[0]],['p',p[1]],['b',b[1]]];if(p.length>2)seq.push(['p',p[2]]);if(b.length>2)seq.push(['b',b[2]]);
  let i=0;const step=()=>{const [w,c]=seq[i++];(w==='p'?CS.pc:CS.bc).push(c);snd('card');renderWin(true);if(i<seq.length)setTimeout(step,i===4?950:520);else setTimeout(()=>baccSettle(p,b),650)};step()}
function baccSettle(p,b){const P=bPts(p),B=bPts(b);const res=P>B?'P':B>P?'B':'T';const bt=CS.bets;let ret=0;
  if(res==='P')ret+=bt.P*2;if(res==='B')ret+=bt.B*1.95;if(res==='T')ret+=bt.T*9+bt.P+bt.B;
  const pp=p[0]%13===p[1]%13,bp=b[0]%13===b[1]%13;if(pp)ret+=bt.PP*12;if(bp)ret+=bt.BP*12;
  const staked=betTotal();S.cash+=ret;CS.last={...bt};for(const k in bt)bt[k]=0;
  CS.road.push(res);if(CS.road.length>120)CS.road.splice(0,6);
  CS.phase='done';CS.win={res,pp,bp};const net=ret-staked;
  CS.msg=`${res==='P'?'闲赢':res==='B'?'庄赢':'和局'} · 闲 ${P} 点 · 庄 ${B} 点${pp?' · 闲对':''}${bp?' · 庄对':''} · ${net>=0?'赢':'输'} ${fmt(Math.abs(net))}`;
  casinoResult(net,staked);refresh()}
// slots
const SYM=[['7',1,300],['D',2,100],['B',3,40],['C',4,20],['S',7,10],['P',15,4]];
const STRIP=[];SYM.forEach(([k,w])=>{for(let i=0;i<w;i++)STRIP.push(k)});
const symHTML=k=>k==='7'?'<div class="sym s7">7</div>':k==='D'?'<div class="sym sD">◆</div>':k==='B'?'<div class="sym sB"><span>BAR</span></div>':k==='C'?'<div class="sym sC">♛︎</div>':k==='S'?'<div class="sym">♠︎</div>':'<div class="sym" style="color:#a8262a">♥︎</div>';
function slotPay(a){if(a[0]===a[1]&&a[1]===a[2])return SYM.find(s=>s[0]===a[0])[2];const n7=a.filter(x=>x==='7').length;if(n7===2)return 10;const nd=a.filter(x=>x==='D').length;if(nd===2)return 5;if(n7===1)return 2;if(a[0]==='D')return 1;return 0}
const jackpot=()=>{const r=room();if(S.jackpot[r.id]==null)S.jackpot[r.id]=r.seed;return S.jackpot[r.id]};
function slotSpin(){const sl=CS.sl;if(sl.spinning)return;const r=room();const bet=sl.bet||r.slot[0];if(S.cash<bet){toast('现金不足','bad');return}
  S.cash-=bet;jackpot();S.jackpot[r.id]+=bet*.015;sl.spinning=true;sl.msg='';const res=[0,1,2].map(()=>pick(STRIP));
  renderTop();const btn=$('[data-spinslot]');if(btn)btn.disabled=true;const msg=$('#slotMsg');if(msg)msg.innerHTML='&nbsp;';
  const els=[...document.querySelectorAll('.strip')];
  els.forEach((el,i)=>{const n=24+i*8;const syms=[pick(STRIP)];for(let k=0;k<n;k++)syms.push(pick(STRIP));syms.push(pick(STRIP),res[i],pick(STRIP));
    el.style.transition='none';el.style.transform='translateY(0)';el.innerHTML=syms.map(symHTML).join('');const h=el.firstElementChild.offsetHeight;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transition=`transform ${1.3+i*.45}s cubic-bezier(.2,.7,.2,1)`;el.style.transform=`translateY(-${(syms.length-3)*h}px)`}))});
  let t=0;const iv=setInterval(()=>{snd('tick');if(++t>14)clearInterval(iv)},140);
  setTimeout(()=>{sl.spinning=false;sl.last=res;const mult=slotPay(res);let win=bet*mult;let jp=false;
    if(res.every(x=>x==='7')&&bet===r.slot[r.slot.length-1]){win+=S.jackpot[r.id];jp=true;S.jackpot[r.id]=r.seed;grant('jp')}
    S.cash+=win;sl.msg=jp?`累积大奖 · ${fmt(win)}`:win?`赢得 ${fmt(win)}（${mult} 倍）`:'未中奖';if(jp)snd('lv');
    casinoResult(win-bet,bet);refresh()},reduce?200:2400)}
// hold'em
let HD=null;
const AINAMES=[['陈先生','香港'],['Tanaka','东京'],['Viktor','莫斯科'],['林太太','台北'],['Mr. Kim','首尔'],['Rashid','迪拜'],['Sophie','巴黎'],['何公子','澳门']];
const STY={tight:{t:.06,bl:.03,ag:0,n:'谨慎'},loose:{t:-.06,bl:.07,ag:.04,n:'松散'},aggro:{t:0,bl:.13,ag:.14,n:'激进'}};
const HN=['高牌','一对','两对','三条','顺子','同花','葫芦','四条','同花顺'];
function evalH(cs){const rc=Array(13).fill(0),sc=[0,0,0,0],bs=[0,0,0,0];let mask=0;
  for(const c of cs){const r=c%13,s=c/13|0;rc[r]++;sc[s]++;mask|=1<<r;bs[s]|=1<<r}
  const sh=m=>{for(let h=12;h>=4;h--)if(((m>>(h-4))&31)===31)return h;if((m&0b1000000001111)===0b1000000001111)return 3;return -1};
  const enc=(cat,ks)=>{let v=cat;for(let i=0;i<5;i++)v=v*13+(ks[i]||0);return v};
  const fs=sc.findIndex(n=>n>=5);let flush;
  if(fs>=0){const h=sh(bs[fs]);if(h>=0)return enc(8,[h]);const ks=[];for(let r=12;r>=0&&ks.length<5;r--)if(bs[fs]>>r&1)ks.push(r);flush=enc(5,ks)}
  const g4=[],g3=[],g2=[],g1=[];for(let r=12;r>=0;r--){if(rc[r]===4)g4.push(r);else if(rc[r]===3)g3.push(r);else if(rc[r]===2)g2.push(r);else if(rc[r]===1)g1.push(r)}
  if(g4.length){const k=[...g3,...g2,...g1].sort((a,b)=>b-a)[0];return enc(7,[g4[0],k])}
  if(g3.length&&(g3.length>1||g2.length)){const pr=Math.max(g3[1]??-1,g2[0]??-1);return enc(6,[g3[0],pr])}
  if(flush!==undefined)return flush;
  const st=sh(mask);if(st>=0)return enc(4,[st]);
  if(g3.length)return enc(3,[g3[0],...g1.slice(0,2)]);
  if(g2.length>=2){const k=[...g2.slice(2),...g1].sort((a,b)=>b-a)[0];return enc(2,[g2[0],g2[1],k])}
  if(g2.length)return enc(1,[g2[0],...g1.slice(0,3)]);
  return enc(0,g1.slice(0,5))}
const catOf=v=>Math.floor(v/Math.pow(13,5));
function equity(hole,board,nOpp,it){const known=new Set([...hole,...board]);const rest=[];for(let c=0;c<52;c++)if(!known.has(c))rest.push(c);let w=0;const need=nOpp*2+5-board.length;
  for(let t=0;t<it;t++){for(let i=0;i<need;i++){const j=i+Math.floor(rnd()*(rest.length-i));const tmp=rest[i];rest[i]=rest[j];rest[j]=tmp}
    const bd=board.concat(rest.slice(nOpp*2,need));const me=evalH(hole.concat(bd));let ties=0,lose=false;
    for(let o=0;o<nOpp;o++){const v=evalH([rest[o*2],rest[o*2+1]].concat(bd));if(v>me){lose=true;break}if(v===me)ties++}
    if(!lose)w+=1/(ties+1)}
  return w/it}
function newAI(){const used=HD?HD.players.map(p=>p.name):[];const [n,f]=pick(AINAMES.filter(a=>!used.includes(a[0])));const r=room();
  return {name:n,from:f,ai:true,style:pick(Object.keys(STY)),stack:Math.round((r.buy[0]+rnd()*(r.buy[1]-r.buy[0]))/r.blinds[1])*r.blinds[1],cards:[],bet:0,inv:0,folded:false,allin:false,acted:false,la:''}}
const buyAmt=()=>{const r=room();return Math.round((r.buy[0]+(r.buy[1]-r.buy[0])*CS.buyPct/100)/r.blinds[1])*r.blinds[1]};
function hdSit(){const r=room();const buy=buyAmt();if(S.cash<buy){toast('现金不足以买入','bad');return}
  S.cash-=buy;HD={room:r.id,blinds:r.blinds,players:[{name:'你',from:S.company,ai:false,stack:buy,cards:[],bet:0,inv:0,folded:false,allin:false,acted:false,la:''}],dealer:Math.floor(rnd()*4),stage:'idle',board:[],log:[],toAct:-1};
  for(let i=0;i<3;i++)HD.players.push(newAI());hdLog(`你以 ${fmt(buy)} 买入入座`);snd('chip');hdNewHand()}
function hdLeave(){if(!HD)return;clearTimeout(HD.timer);const me=HD.players[0];const st=me.stack;S.cash+=st;
  if(HD.stage!=='done'&&HD.stage!=='broke'&&me.inv>0)casinoResult(-me.inv,me.inv);HD=null;toast(`离桌 · 兑回 ${fmt(st)}`);refresh()}
function hdLog(t){HD.log.unshift(t);if(HD.log.length>30)HD.log.length=30}
function hdNewHand(){const [sb,bb]=HD.blinds;
  HD.players.forEach((p,i)=>{if(p.ai&&p.stack<bb*2){HD.players[i]=newAI();hdLog(`${HD.players[i].name}（${HD.players[i].from}）入座`)}});
  const me=HD.players[0];if(me.stack<bb){HD.stage='broke';refresh();return}
  HD.deck=newDeck(1);HD.board=[];HD.res=null;HD.start=me.stack;
  HD.players.forEach(p=>{p.cards=[HD.deck.pop(),HD.deck.pop()];p.bet=0;p.inv=0;p.folded=false;p.allin=false;p.acted=false;p.show=false;p.la='';p.won=0;p.hn=''});
  HD.dealer=(HD.dealer+1)%4;const sbi=(HD.dealer+1)%4,bbi=(HD.dealer+2)%4;hdPost(sbi,sb,'小盲');hdPost(bbi,bb,'大盲');
  HD.curBet=bb;HD.minRaise=bb;HD.stage='preflop';snd('card');hdStep(bbi)}
function hdPost(i,a,l){const p=HD.players[i];const x=Math.min(a,p.stack);p.stack-=x;p.bet+=x;p.inv+=x;if(!p.stack)p.allin=true;p.la=l}
const hdPot=()=>HD.players.reduce((a,p)=>a+p.inv,0);
const canAct=p=>!p.folded&&!p.allin;
const needs=p=>canAct(p)&&(!p.acted||p.bet<HD.curBet);
function hdStep(from){const live=HD.players.filter(p=>!p.folded);if(live.length===1)return hdFold(live[0]);
  if(!HD.players.some(needs))return hdStreet();
  let i=from;for(let k=0;k<4;k++){i=(i+1)%4;if(needs(HD.players[i]))break}
  HD.toAct=i;refresh();if(HD.players[i].ai){const h=HD;HD.timer=setTimeout(()=>{if(HD===h)aiAct(i)},650+rnd()*600)}}
function hdStreet(){HD.players.forEach(p=>{p.bet=0;p.acted=false;if(!p.folded&&!p.allin)p.la=''});HD.curBet=0;HD.minRaise=HD.blinds[1];
  if(HD.stage==='river')return hdShow();
  if(HD.stage==='preflop'){HD.board.push(HD.deck.pop(),HD.deck.pop(),HD.deck.pop());HD.stage='flop'}else if(HD.stage==='flop'){HD.board.push(HD.deck.pop());HD.stage='turn'}else{HD.board.push(HD.deck.pop());HD.stage='river'}
  snd('card');HD.toAct=-1;
  if(HD.players.filter(canAct).length<=1){refresh();const h=HD;HD.timer=setTimeout(()=>{if(HD===h)hdStreet()},1000);return}
  hdStep(HD.dealer)}
function hdAct(i,type,to){const p=HD.players[i];const call=HD.curBet-p.bet;
  if(type==='fold'){p.folded=true;p.la='弃牌'}
  else if(type==='call'){const x=Math.min(call,p.stack);p.stack-=x;p.bet+=x;p.inv+=x;if(!p.stack)p.allin=true;p.la=p.allin?'全下':x?'跟注 '+chipLbl(x):'过牌'}
  else{const cap=p.stack+p.bet;let t=Math.min(to,cap);const minTo=HD.curBet+HD.minRaise;if(t<minTo)t=Math.min(minTo,cap);const prevBet=HD.curBet;const x=t-p.bet;p.stack-=x;p.bet=t;p.inv+=x;if(!p.stack)p.allin=true;
    if(t>HD.curBet){const inc=t-HD.curBet;if(inc>=HD.minRaise)HD.minRaise=inc;HD.curBet=t;HD.players.forEach(q=>{if(q!==p)q.acted=false})}
    p.la=p.allin?'全下 '+chipLbl(t):(prevBet===0?'下注 ':'加注到 ')+chipLbl(t)}
  p.acted=true;snd(type==='fold'?'card':'chip');hdLog(`${p.name} ${p.la}`);hdStep(i)}
function aiAct(i){const p=HD.players[i],st=STY[p.style],call=HD.curBet-p.bet,pot=hdPot(),opp=HD.players.filter(q=>!q.folded).length-1;
  const eq=equity(p.cards,HD.board,Math.max(1,opp),HD.board.length?260:200);const rel=eq*(opp+1);const odds=call>0?call/(pot+call):0;const r=rnd();const bb=HD.blinds[1];
  const size=f=>Math.max(HD.curBet+HD.minRaise,Math.round((HD.curBet+(pot+call)*f)/bb)*bb);
  if(call===0){if(rel>1.45-st.ag*2||r<st.bl)return hdAct(i,'raise',size(.45+rnd()*.4));return hdAct(i,'call')}
  if(call>=p.stack&&eq<.5+st.t&&r>st.bl)return hdAct(i,'fold');
  if(rel>1.85-st.ag*2&&r<.75)return hdAct(i,'raise',size(.6+rnd()*.5));
  if(eq>odds+.03+st.t)return hdAct(i,'call');
  if(r<st.bl*.5)return hdAct(i,'raise',size(.7));
  return hdAct(i,'fold')}
function hdFold(w){const pot=hdPot();w.stack+=pot;w.won=pot;HD.stage='done';HD.toAct=-1;HD.res=`${w.name} 赢得底池 ${fmt(pot)}`;hdLog(HD.res);hdEnd()}
function hdShow(){HD.stage='done';HD.toAct=-1;const ps=HD.players;ps.forEach(p=>{if(!p.folded){p.show=true;p.score=evalH(p.cards.concat(HD.board));p.hn=HN[catOf(p.score)]}});
  const rem=ps.map(p=>p.inv);const msgs=[];
  while(true){const live=ps.filter((p,i)=>!p.folded&&rem[i]>0);if(!live.length)break;const m=Math.min(...live.map(p=>rem[ps.indexOf(p)]));let pot=0;ps.forEach((p,i)=>{const t=Math.min(rem[i],m);pot+=t;rem[i]-=t});
    const top=Math.max(...live.map(p=>p.score));const ws=live.filter(p=>p.score===top);const share=Math.floor(pot/ws.length);ws.forEach((p,k)=>{const amt=share+(k===0?pot-share*ws.length:0);p.stack+=amt;p.won+=amt});msgs.push(ws.map(p=>p.name).join('、')+' 以'+HN[catOf(top)]+'胜出')}
  const extra=rem.reduce((a,b)=>a+b,0);if(extra){const w=ps.filter(p=>!p.folded).sort((a,b)=>b.score-a.score)[0];w.stack+=extra;w.won+=extra}
  HD.res='摊牌 · '+msgs.join(' ｜ ');hdLog(HD.res);hdEnd()}
function hdEnd(){const me=HD.players[0];const net=me.stack-HD.start;if(me.inv>0)casinoResult(net,me.inv);refresh()}
// flight
function flyMacau(){const own=S.owned.some(o=>o.id==='j1');
  queueModal(()=>`<div class="cap">Flight · PVG → MFM</div><h2>飞往澳门</h2><div class="rule"></div><p class="note">在澳门期间商业时间暂停，离开时自动返回上海。</p>
   <button class="opt" type="button" data-act="0"><span><b>经济舱</b><br><span class="note">直飞 · 2小时50分</span></span><span class="m">¥2,800</span></button>
   <button class="opt" type="button" data-act="1"><span><b>头等舱</b><br><span class="note">贵宾休息室 · 声望 +5</span></span><span class="m">¥26,000</span></button>
   <button class="opt" type="button" data-act="2" ${own?'':'disabled'}><span><b>湾流 G700 公务机</b><br><span class="note">${own?'随时起飞':'购入公务机后可用'}</span></span><span class="m">${own?'¥0':'—'}</span></button>
   <button class="btn" type="button" data-close>取消</button>`,i=>{const cost=[2800,26000,0][i];if(S.cash<cost){toast('现金不足','bad');return}S.cash-=cost;if(i===1)S.prestige+=5;
    S.casino.trips++;CS.prevSpeed=speed||1;S.inMacau=true;setSpeed(0);news(`${S.company}董事长飞抵澳门`,'gold');snd('lv');openWin('macau')})}
function leaveMacau(){if(HD)hdLeave();if(CS.phase==='bet'&&betTotal()){S.cash+=betTotal();for(const k in CS.bets)CS.bets[k]=0}
  S.inMacau=false;toast(`已返回上海 · 澳门累计 ${S.casino.net>=0?'赢':'输'} ${fmt(Math.abs(S.casino.net))}`);setSpeed(CS.prevSpeed||1)}
