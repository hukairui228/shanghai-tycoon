// AI 对打平衡模拟：node .src/tests/sim.js [局数] [easy|normal|hard]
const fs=require('fs');const SRC=['10_data.js','11_util.js','20_engine.js','30_ai.js'].map(f=>fs.readFileSync(__dirname+'/../game/'+f,'utf8')).join('\n');eval(SRC+';global.E={newMatch,step,aiDay,aiPlaceHQ,valuation,flows,m:0,RK,BLD,claimsUsed,sharePrice}');
const N=+process.argv[2]||20,diff=process.argv[3]||'normal';let agg={takeovers:0,bank:0,winBy:{},finals:[],blds:{},sab:0,auc:0,hql:0,len:0,priceEnd:{}};
for(let g=0;g<N;g++){const ps=['wang','chen','zhao','li'];const m=E.newMatch({seed:1000+g,diff,players:ps.map(k=>({ai:1,persona:k,name:k,co:k}))});
 for(const p of m.players)E.aiPlaceHQ(m,p.id);
 let t0=Date.now();while(!m.over){E.step(m);E.aiDay(m);}
 agg.len+=m.day;agg.takeovers+=m.log.filter(l=>l.k==='takeover'&&l.txt.includes('收购')).length;agg.bank+=m.log.filter(l=>l.txt.includes('破产')).length;
 agg.auc+=m.log.filter(l=>l.k==='auction'&&l.txt.includes('拍得')).length;agg.sab+=m.players.reduce((a,p)=>a+p.stats.sabUsed,0);
 const w=m.players[m.winner].persona;agg.winBy[w]=(agg.winBy[w]||0)+1;
 for(const t of m.tiles)if(t.b)agg.blds[t.b.k]=(agg.blds[t.b.k]||0)+1;
 for(const r of E.RK)agg.priceEnd[r]=(agg.priceEnd[r]||0)+m.mkt[r].p/E.RK.length;
 agg.hql+=m.players.reduce((a,p)=>a+p.hql,0)/4;
 agg.finals.push(m.players.map(p=>p.alive?Math.round(E.valuation(m,p.id)):'X').join(' '));
 if(g<3){console.log('g',g,'ms',Date.now()-t0,'day',m.day);for(const p of m.players)console.log(' ',p.persona,p.alive?'':'OUT d'+p.outDay,'val',Math.round(E.valuation(m,p.id)),'cash',Math.round(p.cash),'claims',E.claimsUsed(m,p.id),'hql',p.hql,'hold',m.hold[p.id].join(','),'sab',p.stats.sabUsed);
  console.log('  prices',E.RK.map(r=>r+':'+m.mkt[r].p.toFixed(1)).join(' '));console.log('  says',m.says.length,'logs',m.logN);}
}
console.log('avg len',agg.len/N,'takeovers/game',agg.takeovers/N,'bankrupt/game',agg.bank/N,'auctions',agg.auc/N,'sab',agg.sab/N,'hql',(agg.hql/N).toFixed(2));
console.log('wins',agg.winBy);console.log('blds/game',Object.fromEntries(Object.entries(agg.blds).map(([k,v])=>[k,(v/N).toFixed(1)])));
console.log(agg.finals.slice(0,8).join('\n'));
