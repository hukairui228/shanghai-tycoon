import { chromium } from 'playwright';
const SP=process.env.SHOTS||'/tmp/shz-shots';import('fs').then(f=>f.mkdirSync(SP,{recursive:true}));const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];p.on('pageerror',e=>errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.clock.install();
await p.goto((process.env.BASE||'http://127.0.0.1:8765')+'/index.html');await p.clock.runFor(1500);
await p.screenshot({path:SP+'/h0.png'});
await p.fill('#pfName','胡总');await p.fill('#pfCo','万和贸易');await p.click('[data-pf=save]');await p.clock.runFor(500);
await p.screenshot({path:SP+'/h1.png'});
await p.click('[data-h=start]');await p.clock.runFor(800);
await p.screenshot({path:SP+'/g0.png'});
// pick best valid HQ tile via page eval and click its screen position
const pos=await p.evaluate(()=>{const m=window.__G.m;let best=null,bs=-1;for(const t of m.tiles){if(!(t.t==='land'||t.t==='urban')||t.owner!==-1)continue;if(m.players.some(q=>q.hq&&Math.max(Math.abs(q.hq.x-t.x),Math.abs(q.hq.y-t.y))<5))continue;let s=0;for(const u of m.tiles){if(Math.max(Math.abs(u.x-t.x),Math.abs(u.y-t.y))<=4&&u.res)s+=u.r;}if(s>bs){bs=s;best=t}}
 const R=window.__R;R.cam.tx=(best.x+.5-11)*10;R.cam.tz=(best.y+.5-11)*10;return [best.x,best.y]});
await p.clock.runFor(600);const xy=await p.evaluate(([x,y])=>window.__tileScreen(x,y),pos);pos.unshift(...xy);
await p.mouse.click(pos[0],pos[1]);await p.clock.runFor(800);
await p.screenshot({path:SP+'/g1.png'});
// claim+build on a resource tile in range
const did=await p.evaluate(()=>{const G=window.__G,m=G.m;let n=0;const ts=m.tiles.filter(t=>t.res&&t.t==='land'&&t.owner===-1).sort((a,b)=>b.r-a.r);for(const t of ts){if(n>=5)break;const k={food:'farm',oil:'well',ore:'mine'}[t.res];if(window.__canClaim(m,0,t.x,t.y))continue;const r=window.__doAct({t:'claim',x:t.x,y:t.y});if(r.ok){window.__doAct({t:'build',x:t.x,y:t.y,k});n++}}return n});
console.log('built',did);
await p.click('[data-speed="4"]');
for(let i=0;i<40;i++){await p.clock.runFor(1000);const mb=await p.$('#modal .mbg');}
await p.screenshot({path:SP+'/g2.png'});
// select own building
await p.evaluate(()=>{const G=window.__G,m=G.m;const t=m.tiles.find(t=>t.owner===0&&t.b&&t.b.k!=='hq');G.sel=t.y*22+t.x;window.__R.sel=G.sel;window.__renderAct(true)});
await p.screenshot({path:SP+'/g3.png'});
await p.click('[data-co="1"]');await p.clock.runFor(300);await p.screenshot({path:SP+'/g4.png'});
await p.keyboard.press('Escape');
for(let i=0;i<200;i++){await p.clock.runFor(1000);const st=await p.evaluate(()=>window.__G.m.over);if(st)break;}
await p.clock.runFor(3000);
await p.screenshot({path:SP+'/g5.png'});
const info=await p.evaluate(()=>{const m=window.__G.m;return {day:m.day,over:m.over,me:m.players[0].rank,val:Math.round(m.players[0].final||0),logs:m.logN}});
console.log(JSON.stringify(info));
console.log(errs.slice(0,8).join('\n'));await b.close();
