// ================= NEWS / XP =================
let newsSeq=0;
function news(t,k){S.news.unshift({d:S.day,t,k:k||''});if(S.news.length>80)S.news.length=80;newsSeq++}
function gainXP(x){if(!(x>0))return;S.xp+=x;while(S.level<15&&S.xp>=xpNeed(S.level)){S.xp-=xpNeed(S.level);S.level++;onLevelUp()}}
function onLevelUp(){const u=UNLOCKS[S.level];snd('lv');news(`${S.company} 晋升「${TITLES[S.level]}」${u?'，解锁 '+u:''}`,'gold');
  queueModal(()=>`<div class="cap">Promotion</div><div class="lvn">${S.level}</div><h2>${TITLES[S.level]}</h2><div class="rule"></div>${u?`<p>新解锁 · <span class="gold">${u}</span></p>`:'<p class="muted">授信额度与订单规模随等级提升</p>'}<button class="btn pri lg" type="button" data-close>继续经营</button>`);
  if(S.level>=9)grant('cAll')}
function grant(id){if(S.ach[id]!=null)return;S.ach[id]=S.day;const a=ACH.find(x=>x.id===id);if(!a)return;toast(`荣誉 · ${a.n}`,'lv');snd('coin');news(`获得荣誉「${a.n}」`,'gold');S.prestige+=10;gainXP(30);pushPlayer(true)}
