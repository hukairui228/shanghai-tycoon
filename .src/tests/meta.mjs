import { chromium } from 'playwright';
const SP=process.env.SHOTS||'/tmp/shz-shots';import('fs').then(f=>f.mkdirSync(SP,{recursive:true}));const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:860}});
const errs=[];p.on('pageerror',e=>errs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
const W=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto((process.env.BASE||'http://127.0.0.1:8765')+'/index.html');await p.evaluate(async()=>{const s=await (await fetch('saves/save.json')).text();localStorage.clear();localStorage.setItem('shanghai_tycoon_v1',s);});
await p.reload();await W(1800);await p.screenshot({path:SP+'/m0.png'});
console.log('wealth',await p.evaluate(()=>JSON.parse(localStorage.getItem('shz_profile_v5')).wealth));
await p.click('[data-mx=close]');await W(300);
await p.click('[data-h=lux]');await W(300);await p.click('[data-lx=house]');await W(200);await p.click('[data-lbuy=h2]');await W(400);await p.screenshot({path:SP+'/m1.png'});await p.click('[data-mx=close]');
await p.click('[data-h=macau]');await W(300);await p.click('[data-fly="1"]');await W(400);
await p.click('[data-chip="100000"]');await p.click('[data-bet=B]');await p.click('[data-bet=P]');await p.click('[data-cb=deal]');await W(5000);await p.screenshot({path:SP+'/m2.png'});
for(let i=0;i<5;i++){await p.click('[data-cb=rebet]');await p.click('[data-cb=deal]');await W(4500);}
await p.click('[data-cg=slot]');await W(300);await p.click('[data-cb=spin]');await W(1200);await p.screenshot({path:SP+'/m3a.png'});await W(1800);await p.screenshot({path:SP+'/m3.png'});
await p.click('[data-cg=hd]');await W(300);await p.click('[data-cb=sit]');let hands=0;
for(let k=0;k<200&&hands<6;k++){await W(500);const n=await p.$('[data-cb=next]');if(n){hands++;if(hands===2)await p.screenshot({path:SP+'/m4.png'});await n.click();continue}const c=await p.$('[data-hda=call]');if(c)await c.click();}
console.log('hands',hands,'casino',await p.evaluate(()=>JSON.stringify(PF?PF.casino:null)).catch(()=>'n/a'));
await p.click('[data-cz=leave]');await W(500);await p.screenshot({path:SP+'/m5.png'});
console.log(errs.slice(0,8).join('\n'));await b.close();
