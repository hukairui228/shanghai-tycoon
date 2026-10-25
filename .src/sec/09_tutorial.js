// ================= TUTORIAL =================
const TUT=[
 {t:'在「交易所」买入一批商品',k:'buy',r:5000,desk:'trade'},{t:'在「航运」把货运到另一个港口',k:'ship',r:6000,desk:'port'},
 {t:'在价高的港口卖出获利',k:'sellProfit',r:8000,desk:'trade'},{t:'在「合同」签下一份订单',k:'contract',r:10000,desk:'deal'},
 {t:'在「证券」买入一手股票',k:'stock',r:8000,desk:'stock'},{t:'在「珍藏」购入第一件藏品',k:'lux',r:15000,desk:'lux'},{t:'晋升至 Lv3「小老板」',k:'lv3',r:40000,desk:'hq'},
];
function flag(k){S.seen['f_'+k]=1;checkTut()}
function checkTut(){if(S.level>=3)S.seen.f_lv3=1;while(S.tut<TUT.length&&S.seen['f_'+TUT[S.tut].k]){const t=TUT[S.tut];S.cash+=t.r;toast(`任务完成 · 奖励 ${fmt(t.r)}`,'lv');floaty('+'+fmt(t.r));snd('coin');S.tut++}}
