// ===================== 局外：董事长办公室 =====================
const PROF_KEY = 'shz_profile_v5', OLD_KEY = 'shanghai_tycoon_v1';
const TITLES = ['', '街头小贩', '个体户', '小老板', '贸易新秀', '进出口商', '区域大亨', '跨国贸易商', '商界精英', '财团董事', '上市公司董事长', '商业巨头', '财阀', '全球富豪', '商业帝国', '商界传奇'];
const lvNeed = L => Math.round(220 * Math.pow(1.42, L - 1));
let PF = null;
function newProfile() { return { v: 5, name: '', co: '', look: 0, wealth: 50000, xp: 0, level: 1, owned: [], stats: { games: 0, wins: 0, takeovers: 0, best: 0 }, history: [], casino: { net: 0, trips: 0 }, jackpot: {}, set: { len: 'std', diff: 'normal' }, rivals: null }; }
function saveProfile() { if (!PF) return; try { localStorage.setItem(PROF_KEY, JSON.stringify(PF)); } catch (e) { } cloudSave(); }
function loadProfile() { try { const s = localStorage.getItem(PROF_KEY); if (s) return JSON.parse(s); } catch (e) { } return null; }
function migrateOld(old, src) {
  const p = newProfile();
  p.co = old.company || ''; p.name = '董事长'; p.wealth = Math.max(50000, Math.round(old.cash || 0));
  p.level = clamp(old.level || 1, 1, 15); p.owned = (old.owned || []).filter(o => LUXBY[o.id]).map(o => ({ id: o.id, val: o.val, paid: o.paid, day: Date.now() }));
  p.casino.net = old.casino && old.casino.net || 0; p.migrated = { from: src, day: old.day, cash: Math.round(old.cash || 0) };
  return p;
}
function gainXP(x) { PF.xp += x; let up = 0; while (PF.level < 15 && PF.xp >= lvNeed(PF.level)) { PF.xp -= lvNeed(PF.level); PF.level++; up = PF.level; } return up; }
function matchReward(m, me, quit) {
  const p = m.players[me], rank = p.rank, dm = { easy: .7, normal: 1, hard: 1.5 }[m.diff] || 1, lm = m.len <= MATCH_LEN.quick ? .6 : 1;
  const won = m.log.filter(l => l.k === 'takeover' && l.pid === me && l.txt.includes('收购')).length;
  const wealth = quit ? 0 : Math.round((p.final || 0) * [0, .5, .22, .1, .04][rank] * dm * lm);
  const xp = quit ? 10 : Math.round(([0, 160, 95, 60, 35][rank] + won * 40) * dm * lm);
  PF.wealth += wealth; const lvUp = gainXP(xp);
  PF.stats.games++; if (rank === 1 && !quit) PF.stats.wins++; PF.stats.takeovers += won; PF.stats.best = Math.max(PF.stats.best, Math.round(p.final || 0));
  PF.history.unshift({ at: Date.now(), rank, val: Math.round(p.final || 0), diff: m.diff, len: m.len, rivals: m.players.filter(q => q.persona).map(q => q.persona), mp: G.role !== 'solo' }); PF.history.length = Math.min(PF.history.length, 20);
  saveProfile(); pushBoard(true);
  return { wealth, xp, lvUp };
}

// ---------- 声音 ----------
let actx = null, muted = false; try { muted = localStorage.getItem('shz_mute') === '1'; } catch (e) { }
const MUTED = () => muted;
function toggleMute() { muted = !muted; try { localStorage.setItem('shz_mute', muted ? '1' : '0'); } catch (e) { } }
function snd(type) {
  if (muted) return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } if (!actx) return;
  const S = { click: [[900, .02, 'sine', .04]], build: [[330, .06, 'triangle', .08], [440, .08, 'triangle', .07]], coin: [[1175, .05, 'sine', .06], [1568, .1, 'sine', .05]], buy: [[620, .04, 'sine', .05], [780, .05, 'sine', .05]], lv: [[523, .1, 'sine', .08], [659, .1, 'sine', .08], [784, .18, 'sine', .08]], bad: [[220, .16, 'sawtooth', .04]], sab: [[180, .08, 'square', .04], [140, .12, 'square', .04]], chip: [[2000, .02, 'square', .03], [2600, .02, 'square', .025]], event: [[740, .08, 'triangle', .06], [988, .14, 'triangle', .06]], say: [[880, .04, 'sine', .035]], start: [[392, .1, 'sine', .07], [523, .1, 'sine', .07], [659, .1, 'sine', .07], [784, .22, 'sine', .07]], win: [[523, .14, 'sine', .08], [659, .14, 'sine', .08], [784, .14, 'sine', .08], [1047, .4, 'sine', .08]], lose: [[392, .2, 'triangle', .06], [330, .2, 'triangle', .06], [262, .4, 'triangle', .06]], card: [[2400, .015, 'triangle', .04]], tick: [[1500, .01, 'square', .03]] }[type] || [[700, .04, 'sine', .05]];
  let t = actx.currentTime; for (const [f, d, w, v] of S) { const o = actx.createOscillator(), g = actx.createGain(); o.type = w; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + .02); t += d * .85; }
}

// ---------- 办公室 ----------
let demo = null, demoTimer = null, pickRivals = null;
function runDemo() {
  const ks = Object.keys(PERSONAS);
  demo = newMatch({ seed: (Math.random() * 1e9) | 0, players: ks.map(k => ({ ai: 1, persona: k, name: PERSONAS[k].name, co: PERSONAS[k].co })) });
  for (const p of demo.players) aiPlaceHQ(demo, p.id);
  for (let i = 0; i < 160; i++) { step(demo); aiDay(demo); }
  rSetMatch(demo, -1); R.cam.z *= 1.25; R.drift = true; R.onClick = null; R.onHover = null;
  clearInterval(demoTimer); demoTimer = setInterval(() => { if (!G.m && demo && !document.hidden) { if (demo.over) runDemo(); else { step(demo); aiDay(demo); } } }, 900);
}
function goHome() {
  clearInterval(G.timer); if (G.net) { G.net.leave(); G.net = null; }
  G.m = null; $('#hud').hidden = true; $('#hud').innerHTML = ''; R.hl = null; R.resView = false; R.sel = null;
  runDemo(); renderHome();
}
function rollRivals() { const ks = Object.keys(PERSONAS).sort(() => Math.random() - .5); pickRivals = ks.slice(0, 3); }
function renderHome() {
  if (G.m) return;
  const el = $('#home'); el.hidden = false; if (!pickRivals) rollRivals();
  const need = lvNeed(PF.level), lv = PF.level, set = PF.set;
  const meP = { color: PLAYER_COLORS[0], look: PF.look };
  el.innerHTML = `<div class="hm">
   <div class="pnl me-card">
     <span class="pt">${portrait(MY_LOOKS[PF.look % MY_LOOKS.length], '#3a2f1a')}</span>
     <div style="text-align:center"><h2>${esc(PF.co || '未命名公司')}</h2><div class="mut">${esc(PF.name || '董事长')} · Lv${lv} ${TITLES[lv]}</div></div>
     <div><div class="sp k"><span>经验</span><span class="n">${lv >= 15 ? 'MAX' : Math.floor(PF.xp) + ' / ' + need}</span></div><div class="lvbar"><i style="width:${lv >= 15 ? 100 : clamp(PF.xp / need * 100, 0, 100)}%"></i></div></div>
     <div class="grid2"><div class="cell"><div class="k">个人财富</div><div class="v gold">${fmt(PF.wealth)}</div></div><div class="cell"><div class="k">战绩</div><div class="v">${PF.stats.wins}<span class="mut" style="font-size:.6em"> 胜 / ${PF.stats.games} 局</span></div></div><div class="cell"><div class="k">收购对手</div><div class="v">${PF.stats.takeovers}</div></div><div class="cell"><div class="k">藏品</div><div class="v">${PF.owned.length}</div></div></div>
     <button class="btn" type="button" data-h="profile">修改形象与公司名</button>
     ${PF.history.length ? `<div><div class="k" style="margin-bottom:4px">最近战绩</div>${PF.history.slice(0, 5).map(h => `<div class="sp" style="font-size:12px;padding:3px 0;border-top:1px solid var(--line)"><span>${h.rank === 1 ? '<b class="gold">冠军</b>' : '第 ' + h.rank + ' 名'}${h.mp ? ' · 联机' : ''}</span><span class="n mut">${fmt(h.val)}</span></div>`).join('')}</div>` : ''}
   </div>
   <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
     <div class="title-big">商海浮沉<small>SHANGHAI · 商战</small></div>
     <div class="pnl play">
       <div class="modes">
         <button class="mode${G.hmode !== 'mp' ? ' on' : ''}" type="button" data-h="m-solo"><b>单人商战</b><span class="mut">你对三位 AI 大亨。抢地、建厂、操纵市场、恶意收购。</span></button>
         <button class="mode${G.hmode === 'mp' ? ' on' : ''}" type="button" data-h="m-mp"><b>好友对战</b><span class="mut">建房间发给朋友，最多 4 人同场，空位由 AI 补上。</span></button>
         <button class="mode" type="button" data-h="help"><b>怎么玩</b><span class="mut">生产链、共享市场、股权收购规则，一分钟看懂。</span></button>
       </div>
       ${G.hmode === 'mp' ? mpPanel() : `
       <div class="row" style="flex-wrap:wrap;gap:10px 18px"><div class="row"><span class="k">难度</span><div class="seg">${[['easy', '轻松'], ['normal', '标准'], ['hard', '困难']].map(([k, l]) => `<button type="button" data-h="diff-${k}" class="${set.diff === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
         <div class="row"><span class="k">时长</span><div class="seg">${[['quick', '快速 7 分钟'], ['std', '标准 12 分钟']].map(([k, l]) => `<button type="button" data-h="len-${k}" class="${set.len === k ? 'on' : ''}">${l}</button>`).join('')}</div></div></div>
       <div><div class="sp"><span class="k">本局对手</span><button class="btn sm" type="button" data-h="reroll">换一批</button></div>
         <div class="rival-row" style="margin-top:6px">${pickRivals.map((k, i) => { const P = PERSONAS[k]; return `<span class="rv"><span class="pt" style="box-shadow:0 0 0 2px ${PLAYER_COLORS[i + 1]}">${portrait(P.look, shade(PLAYER_COLORS[i + 1], -.55))}</span><span><b>${P.name}</b> <span class="mut">${P.co} · ${P.tag}</span></span></span>`; }).join('')}</div></div>
       <button class="btn pri" type="button" data-h="start" style="font-size:17px;padding:13px">开始商战</button>`}
     </div>
     <div class="tiles">
       <button class="tl" type="button" data-h="lux"><b>私人收藏</b><span class="mut">名表、豪车、豪宅、游艇、公务机</span><span class="n gold">${PF.owned.length} 件 · ${fmt(PF.owned.reduce((a, o) => a + o.val, 0))}</span></button>
       <button class="tl" type="button" data-h="macau"><b>澳门</b><span class="mut">百家乐 · 德州扑克 · 老虎机</span><span class="n ${PF.casino.net >= 0 ? 'gold' : 'down'}">${PF.casino.trips ? (PF.casino.net >= 0 ? '+' : '') + fmt(PF.casino.net) : '用个人财富下注'}</span></button>
       <button class="tl" type="button" data-h="board"><b>富豪榜</b><span class="mut">和朋友比个人财富</span><span class="n">${board.length ? board.length + ' 位玩家' : '—'}</span></button>
       <button class="tl" type="button" data-h="mute"><b>${muted ? '音效已关' : '音效已开'}</b><span class="mut">点击切换</span></button>
     </div>
   </div></div>`;
  el.onclick = homeClick;
}
function homeClick(e) {
  const b = e.target.closest('button'); if (!b) return; const h = b.dataset.h; if (!h) return; snd('click');
  if (h === 'm-solo') { G.hmode = 'solo'; renderHome(); return; }
  if (h === 'm-mp') { G.hmode = 'mp'; renderHome(); return; }
  if (h === 'help') { helpModal(); return; }
  if (h.startsWith('diff-')) { PF.set.diff = h.slice(5); saveProfile(); renderHome(); return; }
  if (h.startsWith('len-')) { PF.set.len = h.slice(4); saveProfile(); renderHome(); return; }
  if (h === 'reroll') { rollRivals(); renderHome(); return; }
  if (h === 'start') { startSolo(); return; }
  if (h === 'profile') { profileModal(); return; }
  if (h === 'lux') { luxModal(); return; }
  if (h === 'macau') { macauOpen(); return; }
  if (h === 'board') { boardModal(); return; }
  if (h === 'mute') { toggleMute(); renderHome(); return; }
  if (h.startsWith('mp-')) { mpClick(h, b); return; }
}
function soloPlayers() {
  return [{ name: PF.name || '董事长', co: PF.co || '你的公司', look: PF.look }, ...pickRivals.map(k => ({ ai: 1, persona: k, name: PERSONAS[k].name, co: PERSONAS[k].co }))];
}
function startSolo(seed) {
  clearInterval(demoTimer); demo = null;
  const m = newMatch({ seed, len: MATCH_LEN[PF.set.len], diff: PF.set.diff, players: soloPlayers() });
  m.players[0].look = PF.look;
  for (const p of m.players) if (p.ai) aiPlaceHQ(m, p.id);
  G.onEnd = matchReward; startMatch(m, 0, 'solo');
}
function quickRematch() { rollRivals(); startSolo(); }
function profileModal() {
  let look = PF.look;
  const draw = () => modal(`<button class="x" type="button" data-mx="close" aria-label="关闭">×</button><h2>董事长档案</h2>
   <div class="row" style="flex-wrap:wrap;gap:10px;margin:14px 0">${MY_LOOKS.map((L, i) => `<button type="button" data-pf="look" data-i="${i}" style="width:62px;height:62px;border-radius:50%;overflow:hidden;padding:0;border:0;box-shadow:0 0 0 ${i === look ? 3 : 1}px ${i === look ? 'var(--gold)' : 'var(--line2)'}">${portrait(L, '#3a2f1a')}</button>`).join('')}</div>
   <label class="k">你的称呼</label><input id="pfName" type="text" maxlength="10" value="${esc(PF.name || '')}" placeholder="董事长" style="width:100%;margin:4px 0 10px;background:rgba(255,255,255,.04);border:1px solid var(--line2);border-radius:7px;padding:9px">
   <label class="k">公司名称</label><input id="pfCo" type="text" maxlength="12" value="${esc(PF.co || '')}" placeholder="恒远贸易" style="width:100%;margin:4px 0 14px;background:rgba(255,255,255,.04);border:1px solid var(--line2);border-radius:7px;padding:9px">
   <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-pf="save">保存</button></div>`);
  draw();
  G.onModal = d => {
    if (d.pf === 'look') { const n = $('#pfName').value, c = $('#pfCo').value; look = +d.i; draw(); $('#pfName').value = n; $('#pfCo').value = c; }
    if (d.pf === 'save') { PF.look = look; PF.name = $('#pfName').value.trim() || '董事长'; PF.co = $('#pfCo').value.trim() || '恒远贸易'; saveProfile(); pushBoard(true); closeModal(); renderHome(); }
  };
}

// ---------- 收藏 ----------
const LUX = [
  { id: 'w1', cat: 'watch', n: '天梭 力洛克', spec: '自动机械 · 39.3mm', p: 4800, ap: -.06 },
  { id: 'w2', cat: 'watch', n: '欧米茄 海马300', spec: '同轴擒纵 · 42mm', p: 52000, ap: -.03 },
  { id: 'w3', cat: 'watch', n: '劳力士 潜航者', spec: '蚝式钢 · 41mm', p: 98000, ap: .04 },
  { id: 'w4', cat: 'watch', n: '百达翡丽 鹦鹉螺', spec: '5811/1G · 41mm', p: 1650000, ap: .07 },
  { id: 'w5', cat: 'watch', n: '理查德米勒 RM 011', spec: '飞返计时 · 钛金属', p: 6200000, ap: .03 },
  { id: 'c1', cat: 'car', n: '比亚迪 汉EV', spec: '纯电 · 610km', p: 209800, ap: -.15 },
  { id: 'c2', cat: 'car', n: '宝马 5系', spec: '2.0T · 长轴距', p: 439900, ap: -.14 },
  { id: 'c3', cat: 'car', n: '保时捷 911 Carrera', spec: '3.0T 水平对置六缸', p: 1458000, ap: -.08 },
  { id: 'c4', cat: 'car', n: '劳斯莱斯 库里南', spec: '6.75L V12', p: 7050000, ap: -.07 },
  { id: 'c5', cat: 'car', n: '布加迪 Chiron', spec: '8.0L W16 · 1500匹', p: 32000000, ap: .02 },
  { id: 'h1', cat: 'house', n: '郊区两居室', spec: '89㎡ · 精装', p: 2800000, ap: .025 },
  { id: 'h2', cat: 'house', n: '陆家嘴江景大平层', spec: '320㎡ · 一线江景', p: 16800000, ap: .035 },
  { id: 'h3', cat: 'house', n: '佘山独栋别墅', spec: '占地 1.2 亩 · 私家园林', p: 52000000, ap: .04 },
  { id: 'h4', cat: 'house', n: '太平山顶豪宅', spec: '维港全景 · 独立泳池', p: 280000000, ap: .045 },
  { id: 'a1', cat: 'art', n: '当代油画 限量版', spec: '布面油画 · 120×90cm', p: 850000, ap: .05 },
  { id: 'a2', cat: 'art', n: '清乾隆 粉彩瓷瓶', spec: '春拍成交 · 附证书', p: 36000000, ap: .06 },
  { id: 'y1', cat: 'yacht', n: '圣汐 42米游艇', spec: '5 间套房 · 12 名船员', p: 88000000, ap: -.06 },
  { id: 'j1', cat: 'jet', n: '湾流 G700', spec: '航程 13,890km · 19 座', p: 560000000, ap: -.05 },
];
const LUXBY = Object.fromEntries(LUX.map(l => [l.id, l]));
const LUXCAT = { watch: '腕表', car: '座驾', house: '物业', art: '艺术品', yacht: '游艇', jet: '公务机', mine: '我的藏品' };
const LUXIC = {
  watch: '<rect x="12" y="2.5" width="8" height="6"/><rect x="12" y="23.5" width="8" height="6"/><circle cx="16" cy="16" r="8"/><path d="M16 12v4l2.5 1.5"/>',
  car: '<path d="M3 21l1.5-4.5C5.5 14 7 13 9.5 13h13c2.5 0 4 1 5 3.5L29 21v4H3zM8 13l3-4.5h10L24 13"/><circle cx="9" cy="25" r="2.5"/><circle cx="23" cy="25" r="2.5"/>',
  house: '<path d="M3 15 16 5l13 10M6.5 12.5V27h19V12.5M13 27v-7h6v7"/>',
  art: '<path d="M12 4h8M13 4v3.5C9 9.5 7 13.5 7 18c0 5.5 4 9.5 9 9.5s9-4 9-9.5c0-4.5-2-8.5-6-10.5V4"/><path d="M8.5 17c3-2 5 2 7.5 0s4.5-2 7.5 0"/>',
  yacht: '<path d="M3 21h26l-4 6H7zM8 21l3-6h12l3 6M12 15l2-4h7l2 4M15 11V6"/>',
  jet: '<path d="M3 17h19c3.5 0 6-1 7-2-1-1-3.5-2-7-2H3zM12.5 13 8.5 5h3l7 8M12.5 17l-4 9h3l7-9M4 13 2 8h2l4 5"/>',
};
const luxIc = c => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${LUXIC[c]}</svg>`;
function revalue() { const now = Date.now(); for (const o of PF.owned) { const l = LUXBY[o.id]; const days = (now - (o.vt || o.day || now)) / 864e5; if (days > .01) { o.val *= Math.exp(l.ap / 365 * days * 30); o.vt = now; } } } // 现实一天 ≈ 游戏一个月
function luxModal(cat) {
  cat = cat || G.luxCat || 'watch'; G.luxCat = cat; revalue();
  const items = cat === 'mine' ? PF.owned.map((o, i) => ({ o, i, l: LUXBY[o.id] })) : LUX.filter(l => l.cat === cat).map(l => ({ l }));
  modal(`<button class="x" type="button" data-mx="close" aria-label="关闭">×</button><h2>私人收藏</h2><div class="mut">个人财富 <b class="gold n">${fmt(PF.wealth)}</b> · 藏品估值 ${fmt(PF.owned.reduce((a, o) => a + o.val, 0))}</div>
   <div class="tabs">${Object.entries(LUXCAT).map(([k, v]) => `<button type="button" data-lx="${k}" class="${k === cat ? 'on' : ''}">${v}</button>`).join('')}</div>
   ${items.length ? `<div class="lots">${items.map(({ o, i, l }) => o ? `<div class="lot">${luxIc(l.cat)}<b>${l.n}</b><span class="k">${l.spec}</span><span class="pr">${fmt(o.val)}</span><span class="k ${o.val >= o.paid ? 'up' : 'down'}">${pct(o.val / o.paid - 1)}</span><button class="btn sm" type="button" data-lsell="${i}">委托出售</button></div>`
    : `<div class="lot">${luxIc(l.cat)}<b>${l.n}</b><span class="k">${l.spec}</span><span class="pr">${fmt(l.p)}</span><span class="k">${l.ap >= 0 ? '升值' : '折旧'}约 ${Math.abs(l.ap * 100).toFixed(0)}%/年${PF.owned.some(x => x.id === l.id) ? ' · 已收藏' : ''}</span><button class="btn sm ${PF.wealth >= l.p ? 'pri' : ''}" type="button" data-lbuy="${l.id}" ${PF.wealth >= l.p ? '' : 'disabled'}>${PF.wealth >= l.p ? '购入' : '尚差 ' + fmt(l.p - PF.wealth)}</button></div>`).join('')}</div>` : '<p class="mut">还没有藏品。</p>'}`, 'wide');
  G.onModal = d => {
    if (d.lx) luxModal(d.lx);
    if (d.lbuy) { const l = LUXBY[d.lbuy]; if (PF.wealth < l.p) return; PF.wealth -= l.p; PF.owned.push({ id: l.id, val: l.p * .92, paid: l.p, day: Date.now(), vt: Date.now() }); saveProfile(); pushBoard(true); snd('lv'); toast(`购入 ${l.n}`, 'good'); luxModal(); renderHome(); }
    if (d.lsell != null) { const o = PF.owned[+d.lsell]; if (!o) return; PF.wealth += o.val; PF.owned.splice(+d.lsell, 1); saveProfile(); snd('coin'); toast(`售出 ${LUXBY[o.id].n}，到账 ${fmt(o.val)}`); luxModal(); renderHome(); }
  };
}

// ---------- 云端 ----------
let db = null, userCap = null, myId = null, canWrite = true, board = [], profiles = {}, lastPush = 0;
function cloudSave() { if (db && myId && canWrite && PF) db.doc('data/users/' + myId + '/profile').set({ json: JSON.stringify(PF), at: Date.now() }).catch(e => { if (e && e.code === 'invalid_argument') canWrite = false; }); }
function pushBoard(force) {
  if (!db || !myId || !canWrite || !PF) return; const now = Date.now(); if (!force && now - lastPush < 20000) return; lastPush = now;
  const top = PF.owned.map(o => LUXBY[o.id]).sort((a, b) => b.p - a.p)[0];
  db.doc('players/' + myId).set({ company: String(PF.co || '').slice(0, 24), nw: Math.round(PF.wealth + PF.owned.reduce((a, o) => a + o.val, 0)), level: PF.level, wins: PF.stats.wins, games: PF.stats.games, top: top ? top.n : '', look: PF.look, v: 5, at: now }).catch(e => { if (e && e.code === 'invalid_argument') canWrite = false; });
}
async function initCloud() {
  try {
    const cl = window.claude; if (!cl || !cl.use) return;
    userCap = await cl.use('user'); db = await cl.use('db'); if (!db) return;
    myId = userCap ? await userCap.id() : null;
    if (userCap && userCap.can) { const w = await userCap.can('data.write'); if (w === false) canWrite = false; }
    db.collection('players').orderBy('nw', 'desc').limit(50).onSnapshot(async snap => { board = snap.docs.map(d => ({ id: d.id, ...d.data() })); if (userCap && userCap.profiles) { try { profiles = await userCap.profiles(board.map(p => p.id)); } catch (e) { } } if (!G.m && !$('#home').hidden && !$('#modal').innerHTML) renderHome(); });
    if (myId) {
      const s = await db.doc('data/users/' + myId + '/profile').get();
      if (s.exists && s.data().json) { try { const cp = JSON.parse(s.data().json); if (!PF || (cp.stats && PF.stats && cp.stats.games > PF.stats.games) || PF.fresh) { PF = cp; delete PF.fresh; localStorage.setItem(PROF_KEY, JSON.stringify(PF)); if (!G.m) renderHome(); } } catch (e) { } }
      else if (PF && (PF.fresh || (PF.migrated && PF.migrated.from === 'local' && !PF.stats.games))) { // 旧版云存档迁移（本机旧档比云端旧时，以云端为准）
        const o = await db.doc('data/users/' + myId + '/game').get();
        if (o.exists && o.data().json) { try { const old = JSON.parse(o.data().json); if (old.started && (PF.fresh || old.day > (PF.migrated.day || 0))) { const noted = PF.migrated && PF.migrated.noted; PF = migrateOld(old, 'cloud'); if (noted) PF.migrated.noted = 0; saveProfile(); if (!G.m) { renderHome(); migratedNote(); } } } catch (e) { } }
      }
      if (PF) { delete PF.fresh; pushBoard(true); }
    }
  } catch (e) { }
}
function migratedNote() { if (!PF.migrated || PF.migrated.noted) return; PF.migrated.noted = 1; saveProfile(); modal(`<h2>欢迎回来，${esc(PF.co || '董事长')}</h2><p class="mut" style="line-height:1.7">游戏改版成了对战式的「商战」。你旧存档里经营 ${PF.migrated.day} 天攒下的现金 <b class="gold">${fmt(PF.migrated.cash)}</b> 已经转成个人财富，藏品 ${PF.owned.length} 件也都保留了。个人财富用来买收藏、去澳门；每局商战打完会继续往里加钱。</p><div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-mx="close">开始</button></div>`); }
function boardModal() {
  const rows = board.slice(); if (!rows.some(r => r.id === myId)) rows.push({ id: 'me', company: PF.co, nw: PF.wealth + PF.owned.reduce((a, o) => a + o.val, 0), level: PF.level, wins: PF.stats.wins, me: 1 });
  rows.sort((a, b) => b.nw - a.nw);
  modal(`<button class="x" type="button" data-mx="close" aria-label="关闭">×</button><h2>富豪榜</h2><p class="mut">按个人财富与藏品估值排名。${db ? '把链接分享给朋友（设为可编辑的协作者），他们玩过就会上榜。' : '在 Claude 中打开才能看到真人榜单。'}</p>
   ${rows.map((r, i) => `<div class="res-row ${r.id === myId || r.me ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="pt">${portrait(MY_LOOKS[(r.look || 0) % MY_LOOKS.length], '#2a3240')}</span><div><b>${esc(r.company || '神秘公司')}</b><div class="k">${esc((profiles[r.id] && profiles[r.id].name) || (r.id === myId || r.me ? '你' : '玩家'))} · Lv${r.level || 1} · ${r.wins || 0} 胜${r.top ? ' · ' + esc(r.top) : ''}</div></div><span class="n" style="font-size:17px">${fmt(r.nw)}</span></div>`).join('')}`, 'wide');
}
