import { chromium } from 'playwright';
import fs from 'fs';
const SP=process.env.SHOTS||'/tmp/shz-shots';import('fs').then(f=>f.mkdirSync(SP,{recursive:true}));const mock=fs.readFileSync(new URL('./mockroom.js',import.meta.url),'utf8');
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:820}});await ctx.addInitScript(mock);
const A=await ctx.newPage(),B=await ctx.newPage();const errs=[];for(const [n,p] of [['A',A],['B',B]]){p.on('pageerror',e=>errs.push(n+' PE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(n+' '+m.text())});}
const W=ms=>new Promise(r=>setTimeout(r,ms));
for(const [p,nm,co] of [[A,'房主','甲公司'],[B,'朋友','乙公司']]){await p.goto((process.env.BASE||'http://127.0.0.1:8765')+'/index.html');await W(1500);if(!(await p.$('#pfName'))){await p.click('[data-h=profile]');await W(300);}await p.fill('#pfName',nm);await p.fill('#pfCo',co);await p.click('[data-pf=save]');await W(300);await p.click('[data-h=m-mp]');await W(300);}
await A.click('[data-h=mp-host]');await W(800);
const code=await A.evaluate(()=>document.querySelector('.n.gold').textContent.trim());console.log('code',code);
await B.waitForTimeout(500);await B.screenshot({path:SP+'/mpB0.png'});
await B.fill('#mpCode',code);await B.click('[data-h=mp-join]');await W(1200);
await A.screenshot({path:SP+'/mpA0.png'});
await A.click('[data-h=mp-start]');await W(1500);
console.log('B role',await B.evaluate(()=>__G.role+' me='+__G.me+' phase='+(__G.m&&__G.m.phase)));
// place HQs
const place=async p=>p.evaluate(()=>{const m=__G.m;const t=m.tiles.filter(t=>t.t==='land'&&t.owner===-1&&!m.players.some(q=>q.hq&&Math.max(Math.abs(q.hq.x-t.x),Math.abs(q.hq.y-t.y))<5)).sort((a,b)=>b.deco-a.deco)[0];__doAct({t:'hq',x:t.x,y:t.y});return [t.x,t.y]});
console.log('A hq',await place(A));await W(800);console.log('B hq',await place(B));await W(1500);
console.log('phases',await A.evaluate(()=>__G.m.phase),await B.evaluate(()=>__G.m.phase));
await A.click('[data-speed="4"]');
const build=async p=>p.evaluate(()=>{const G=__G,m=G.m;let n=0;for(const t of m.tiles.filter(t=>t.res&&t.owner===-1).sort((a,b)=>b.r-a.r)){if(n>=3)break;if(__canClaim(m,G.me,t.x,t.y))continue;__doAct({t:'claim',x:t.x,y:t.y});__doAct({t:'build',x:t.x,y:t.y,k:{food:'farm',oil:'well',ore:'mine'}[t.res]});n++;}return n});
console.log('A built',await build(A));console.log('B built',await build(B));
await W(12000);
console.log('B on host',await A.evaluate(()=>{const m=__G.m;return m.tiles.filter(t=>t.owner===1&&t.b).map(t=>t.b.k+':'+t.b.prog).join(',')+' cash '+Math.round(m.players[1].cash)}));
console.log('B local',await B.evaluate(()=>{const m=__G.m;return 'day '+m.day+' mine '+m.tiles.filter(t=>t.owner===1&&t.b).map(t=>t.b.k+':'+t.b.prog).join(',')+' cash '+Math.round(m.players[1].cash)+' ai blds '+m.tiles.filter(t=>t.owner>=2&&t.b).length+' logs '+m.log.length}));
await B.evaluate(()=>__doAct({t:'share',tgt:0,q:1}));await W(1500);
console.log('hold B->A host',await A.evaluate(()=>__G.m.hold[1][0]),'client',await B.evaluate(()=>__G.m.hold[1][0]));
await A.screenshot({path:SP+'/mpA1.png'});await B.screenshot({path:SP+'/mpB1.png'});
console.log('logs A',await A.evaluate(()=>__G.m.log.length+'/'+__G.m.logN),'B',await B.evaluate(()=>__G.m.log.length+'/'+__G.m.logN+' feed '+document.querySelectorAll('#hLog .it').length));console.log('mockErrs',await A.evaluate(()=>window.__mockErrs),await B.evaluate(()=>window.__mockErrs));
console.log(errs.slice(0,10).join('\n'));await b.close();
