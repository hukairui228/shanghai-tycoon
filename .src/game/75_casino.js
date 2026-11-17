// ===================== 澳门 · 金殿娱乐场 =====================
const ROOMS = [
  { id: 'main', n: '中场', lv: 1, min: 1000, max: 500000, chips: [1000, 5000, 10000, 50000, 100000], blinds: [500, 1000], buy: [20000, 200000], slot: [100, 500, 1000, 5000], seed: 1500000 },
  { id: 'vip', n: '贵宾厅', lv: 5, min: 50000, max: 20000000, chips: [50000, 100000, 500000, 1000000, 5000000], blinds: [10000, 20000], buy: [500000, 4000000], slot: [10000, 50000, 100000], seed: 30000000 },
  { id: 'pr', n: '至尊厅', lv: 9, min: 500000, max: 300000000, chips: [500000, 1000000, 5000000, 10000000, 50000000], blinds: [100000, 200000], buy: [5000000, 40000000], slot: [100000, 500000, 1000000], seed: 400000000 },
];
const CHIPCOL = ['#2f5fa8', '#a8262a', '#2f7a55', '#2a2a2a', '#7a3fa0', '#b8892b'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], SUITS = ['♠', '♥', '♦', '♣'];
const chipLbl = v => v >= 1e8 ? (v / 1e8) + '亿' : v >= 1e4 ? (+(v / 1e4).toFixed(1)) + '万' : v >= 1000 ? (v / 1000) + 'K' : String(v);
function newDeck(n) { const d = []; for (let k = 0; k < n; k++) for (let c = 0; c < 52; c++) d.push(c); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; }
function card(c, opt) { opt = opt || ''; if (c == null || opt.includes('back')) return `<div class="pc back ${opt}"></div>`; const r = c % 13, s = c / 13 | 0; return `<div class="pc ${s === 1 || s === 2 ? 'red' : ''} ${opt}"><span class="r">${RANKS[r]}</span><span class="s">${SUITS[s]}︎</span><span class="b">${SUITS[s]}︎</span></div>`; }
const CS = { room: 'main', game: 'bacc', chip: 0, bets: { P: 0, B: 0, T: 0, PP: 0, BP: 0 }, last: null, shoe: [], road: [], phase: 'bet', pc: [], bc: [], msg: '', win: null, sl: { bet: 0, spinning: false, msg: '', last: null }, buyPct: 30, open: false };
const room = () => ROOMS.find(r => r.id === CS.room);
function cResult(net, staked) { PF.casino.net += net; if (net > 0) { snd('coin'); toast(`赢得 ${fmt(net)}`, 'good'); } saveProfileSoon(); }
let saveT = 0; function saveProfileSoon() { clearTimeout(saveT); saveT = setTimeout(saveProfile, 800); }
function macauOpen() {
  const own = PF.owned.some(o => o.id === 'j1');
  modal(`<button class="x" type="button" data-mx="close" aria-label="关闭">×</button><div class="k" style="letter-spacing:.3em">PVG → MFM</div><h2>飞往澳门</h2><p class="mut">金殿娱乐场用你的个人财富下注。离开时自动飞回上海。</p>
   <div style="display:flex;flex-direction:column;gap:8px">
   ${[['经济舱', '直飞 · 2小时50分', 2800, false], ['头等舱', '贵宾休息室', 26000, false], ['湾流 G700 公务机', own ? '随时起飞' : '购入公务机后可用', 0, !own]].map(([n, d, c, dis], i) => `<button class="opt" type="button" data-fly="${i}" ${dis || PF.wealth < c ? 'disabled' : ''} style="flex-direction:row;justify-content:space-between;align-items:center"><span><b>${n}</b><br><span class="e">${d}</span></span><span class="c">${c ? fmt(c) : own ? '¥0' : '—'}</span></button>`).join('')}</div>`);
  G.onModal = d => { if (d.fly != null) { const c = [2800, 26000, 0][+d.fly]; if (PF.wealth < c) return; PF.wealth -= c; PF.casino.trips++; saveProfile(); CS.open = true; snd('start'); macauRender(); } };
}
function macauRender() {
  if (!CS.open) return; const r = room();
  const busy = HD || CS.phase === 'deal' || CS.sl.spinning || betTotal();
  const html = `<button class="x" type="button" data-cz="leave" aria-label="离开">×</button>
   <div class="k" style="letter-spacing:.3em">GRAND PALACE · MACAU</div><h2>澳门 · 金殿娱乐场</h2>
   <div class="mut">个人财富 <b class="gold n">${fmt(PF.wealth)}</b> · ${r.n} 限红 ${fmt(r.min)}–${fmt(r.max)} · 累计 ${PF.casino.net >= 0 ? '+' : ''}${fmt(PF.casino.net)}</div>
   <div class="tabs">${[['bacc', '百家乐'], ['hd', '德州扑克'], ['slot', '老虎机']].map(([k, v]) => `<button type="button" data-cg="${k}" class="${CS.game === k ? 'on' : ''}">${v}</button>`).join('')}<span style="flex:1"></span>${ROOMS.map(x => `<button type="button" data-cr="${x.id}" class="${x.id === CS.room ? 'on' : ''}" ${PF.level >= x.lv && (!busy || x.id === CS.room) ? '' : 'disabled'}>${x.n}${PF.level >= x.lv ? '' : ' · Lv' + x.lv}</button>`).join('')}</div>
   ${CS.game === 'bacc' ? baccView() : CS.game === 'hd' ? hdView() : slotView()}`;
  const el = $('#modal .modal.casino');
  if (el) { if (!(CS.sl.spinning && CS.game === 'slot')) el.innerHTML = html; } else modal(html, 'wide casino');
  G.onModal = casinoClick;
}
function casinoClick(d) {
  if (d.cz === 'leave') { if (CS.phase === 'deal' || CS.sl.spinning) return; if (HD) hdLeave(); if (CS.phase === 'bet' && betTotal()) { PF.wealth += betTotal(); for (const k in CS.bets) CS.bets[k] = 0; } CS.open = false; saveProfile(); closeModal(); renderHome(); toast('已返回上海'); return; }
  if (d.cg) { if (CS.sl.spinning || CS.phase === 'deal') return; CS.game = d.cg; snd('click'); return macauRender(); }
  if (d.cr) { CS.room = d.cr; CS.chip = 0; CS.sl.bet = 0; if (CS.phase === 'done') baccReset(); snd('click'); return macauRender(); }
  if (d.chip) { CS.chip = +d.chip; snd('chip'); return macauRender(); }
  if (d.bet) return baccPlace(d.bet);
  if (d.cb === 'clear') return baccClear();
  if (d.cb === 'rebet') return baccRebet();
  if (d.cb === 'deal') return baccDeal();
  if (d.sbet) { if (CS.sl.spinning) return; CS.sl.bet = +d.sbet; snd('chip'); return macauRender(); }
  if (d.cb === 'spin') return slotSpin();
  if (d.cb === 'sit') return hdSit();
  if (d.cb === 'leave') return hdLeave();
  if (d.cb === 'next') return hdNewHand();
  if (d.hda) { if (!HD || HD.toAct !== 0) return; hdAct(0, d.hda, +d.to || 0); }
  if (d.bp != null) { CS.buyPct = +d.bp; macauRender(); }
}
function chipsRow(vals, cur, attr) { return `<div class="chips">${vals.map((v, i) => `<button type="button" class="tok ${v === cur ? 'on' : ''}" style="--cc:${CHIPCOL[i % CHIPCOL.length]}" data-${attr}="${v}" aria-label="筹码 ${fmt(v)}"><span>${chipLbl(v)}</span></button>`).join('')}</div>`; }
// ---- 百家乐 ----
const bVal = c => { const r = c % 13; return r === 12 ? 1 : r >= 8 ? 0 : r + 2; };
const bPts = a => a.reduce((s, c) => s + bVal(c), 0) % 10;
function betTotal() { return Object.values(CS.bets).reduce((a, b) => a + b, 0); }
function baccReset() { CS.phase = 'bet'; CS.pc = []; CS.bc = []; CS.msg = ''; CS.win = null; }
function baccPlace(a) { if (CS.phase === 'deal') return; if (CS.phase === 'done') baccReset(); const r = room(), v = CS.chip || r.chips[0]; if (PF.wealth < v) return toast('个人财富不足', 'bad'); if (betTotal() + v > r.max) return toast(`超出限红 ${fmt(r.max)}`, 'bad'); PF.wealth -= v; CS.bets[a] += v; snd('chip'); macauRender(); }
function baccClear() { if (CS.phase !== 'bet') return; PF.wealth += betTotal(); for (const k in CS.bets) CS.bets[k] = 0; macauRender(); }
function baccRebet() { if (!CS.last) return; if (CS.phase === 'done') baccReset(); if (CS.phase !== 'bet') return; const need = Object.values(CS.last).reduce((a, b) => a + b, 0); if (PF.wealth < need) return toast('个人财富不足', 'bad'); if (betTotal() + need > room().max) return toast('超出限红', 'bad'); for (const k in CS.last) { CS.bets[k] += CS.last[k]; PF.wealth -= CS.last[k]; } snd('chip'); macauRender(); }
function baccDeal() {
  const tot = betTotal(), r = room(); if (CS.phase !== 'bet') return; if (!tot) return toast('请先下注'); if (tot < r.min) return toast(`本桌最低 ${fmt(r.min)}`);
  if (CS.shoe.length < 16) { CS.shoe = newDeck(8); CS.road = []; toast('换新牌靴 · 8 副牌'); }
  CS.phase = 'deal'; CS.pc = []; CS.bc = []; const draw = () => CS.shoe.pop();
  const p = [draw()], b = [draw()]; p.push(draw()); b.push(draw()); let p3 = null;
  if (!(bPts(p) >= 8 || bPts(b) >= 8)) { if (bPts(p) <= 5) { p3 = draw(); p.push(p3); } const bs = bPts(b); let bd; if (p3 === null) bd = bs <= 5; else { const t = bVal(p3); bd = bs <= 2 || (bs === 3 && t !== 8) || (bs === 4 && t >= 2 && t <= 7) || (bs === 5 && t >= 4 && t <= 7) || (bs === 6 && (t === 6 || t === 7)); } if (bd) b.push(draw()); }
  const seq = [['p', p[0]], ['b', b[0]], ['p', p[1]], ['b', b[1]]]; if (p.length > 2) seq.push(['p', p[2]]); if (b.length > 2) seq.push(['b', b[2]]);
  let i = 0; const stepC = () => { const [w, c] = seq[i++]; (w === 'p' ? CS.pc : CS.bc).push(c); snd('card'); macauRender(); if (i < seq.length) setTimeout(stepC, i === 4 ? 900 : 500); else setTimeout(() => baccSettle(p, b), 600); }; stepC();
}
function baccSettle(p, b) {
  const P = bPts(p), B = bPts(b), res = P > B ? 'P' : B > P ? 'B' : 'T', bt = CS.bets; let ret = 0;
  if (res === 'P') ret += bt.P * 2; if (res === 'B') ret += bt.B * 1.95; if (res === 'T') ret += bt.T * 9 + bt.P + bt.B;
  const pp = p[0] % 13 === p[1] % 13, bp = b[0] % 13 === b[1] % 13; if (pp) ret += bt.PP * 12; if (bp) ret += bt.BP * 12;
  const staked = betTotal(); PF.wealth += ret; CS.last = { ...bt }; for (const k in bt) bt[k] = 0;
  CS.road.push(res); if (CS.road.length > 120) CS.road.splice(0, 6); CS.phase = 'done'; CS.win = { res, pp, bp };
  const net = ret - staked; CS.msg = `${res === 'P' ? '闲赢' : res === 'B' ? '庄赢' : '和局'} · 闲 ${P} 点 · 庄 ${B} 点${pp ? ' · 闲对' : ''}${bp ? ' · 庄对' : ''} · ${net >= 0 ? '赢' : '输'} ${fmt(Math.abs(net))}`;
  cResult(net, staked); macauRender();
}
function baccView() {
  const r = room(); if (!r.chips.includes(CS.chip)) CS.chip = r.chips[0]; const w = CS.win || {}, done = CS.phase === 'done';
  const spot = (k, n, po) => `<button type="button" class="spot ${k} ${done && (k === w.res || (k === 'PP' && w.pp) || (k === 'BP' && w.bp)) ? 'win' : ''}" data-bet="${k}"><span class="sn">${n}</span><span class="po">${po}</span><span class="amt">${CS.bets[k] ? chipLbl(CS.bets[k]) : ''}</span></button>`;
  return `<div class="felt"><div class="lgd">PUNTO BANCO · 8 DECKS · BANKER PAYS 0.95</div>
   <div class="hands"><div class="hand"><div class="who" style="color:#9cc0f0">闲 PLAYER</div><div class="pts">${CS.pc.length ? bPts(CS.pc) : ''}</div><div class="cards">${CS.pc.map(c => card(c)).join('')}</div></div><div class="hand"><div class="who" style="color:#f0a09a">庄 BANKER</div><div class="pts">${CS.bc.length ? bPts(CS.bc) : ''}</div><div class="cards">${CS.bc.map(c => card(c)).join('')}</div></div></div>
   <div style="text-align:center;min-height:22px;color:var(--gold2);margin-bottom:10px">${CS.msg || (CS.phase === 'deal' ? '发牌中…' : '选筹码，点下注区')}</div>
   <div class="spots">${spot('P', '闲', '1 : 1')}${spot('T', '和', '8 : 1')}${spot('B', '庄', '0.95 : 1')}</div><div class="spots2">${spot('PP', '闲对', '11 : 1')}${spot('BP', '庄对', '11 : 1')}</div></div>
   <div style="margin:14px 0">${chipsRow(r.chips, CS.chip, 'chip')}</div>
   <div class="row" style="justify-content:center;flex-wrap:wrap"><span class="mut">本局 <b class="n">${fmt(betTotal())}</b></span><button class="btn" type="button" data-cb="clear" ${CS.phase === 'bet' && betTotal() ? '' : 'disabled'}>撤回</button><button class="btn" type="button" data-cb="rebet" ${CS.last && CS.phase !== 'deal' ? '' : 'disabled'}>重复上局</button><button class="btn pri" type="button" data-cb="deal" ${CS.phase === 'bet' && betTotal() ? '' : 'disabled'}>发牌</button></div>
   <div class="k" style="margin:14px 0 6px">珠盘路 · 庄 ${CS.road.filter(x => x === 'B').length} · 闲 ${CS.road.filter(x => x === 'P').length} · 和 ${CS.road.filter(x => x === 'T').length}</div>
   <div class="road">${CS.road.map(x => `<i class="${x}">${x === 'B' ? '庄' : x === 'P' ? '闲' : '和'}</i>`).join('')}</div>`;
}
// ---- 老虎机（理论返还约 94.7%）----
const SYM = [['7', 1, 300], ['D', 2, 100], ['B', 3, 40], ['C', 4, 20], ['S', 7, 10], ['P', 15, 4]];
const STRIP = []; SYM.forEach(([k, w]) => { for (let i = 0; i < w; i++) STRIP.push(k); });
const symHTML = k => k === '7' ? '<div class="sym s7">7</div>' : k === 'D' ? '<div class="sym sD">◆</div>' : k === 'B' ? '<div class="sym sB"><span>BAR</span></div>' : k === 'C' ? '<div class="sym sC">♛︎</div>' : k === 'S' ? '<div class="sym">♠︎</div>' : '<div class="sym" style="color:#a8262a">♥︎</div>';
function slotPay(a) { if (a[0] === a[1] && a[1] === a[2]) return SYM.find(s => s[0] === a[0])[2]; const n7 = a.filter(x => x === '7').length; if (n7 === 2) return 10; if (a.filter(x => x === 'D').length === 2) return 5; if (n7 === 1) return 2; if (a[0] === 'D') return 1; return 0; }
const jackpot = () => { const r = room(); if (PF.jackpot[r.id] == null) PF.jackpot[r.id] = r.seed; return PF.jackpot[r.id]; };
function slotSpin() {
  const sl = CS.sl; if (sl.spinning) return; const r = room(), bet = sl.bet || r.slot[0]; if (PF.wealth < bet) return toast('个人财富不足', 'bad');
  PF.wealth -= bet; jackpot(); PF.jackpot[r.id] += bet * .015; sl.spinning = true; sl.msg = ''; const res = [0, 1, 2].map(() => pickR(Math.random, STRIP));
  const btn = $('[data-cb="spin"]'); if (btn) btn.disabled = true;
  [...document.querySelectorAll('.strip')].forEach((el, i) => { const n = 22 + i * 8, syms = [pickR(Math.random, STRIP)]; for (let k = 0; k < n; k++) syms.push(pickR(Math.random, STRIP)); syms.push(pickR(Math.random, STRIP), res[i], pickR(Math.random, STRIP));
    el.style.transition = 'none'; el.style.transform = 'translateY(0)'; el.innerHTML = syms.map(symHTML).join(''); const h = el.firstElementChild.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = `transform ${1.3 + i * .45}s cubic-bezier(.2,.7,.2,1)`; el.style.transform = `translateY(-${(syms.length - 3) * h}px)`; })); });
  let t = 0; const iv = setInterval(() => { snd('tick'); if (++t > 14) clearInterval(iv); }, 140);
  setTimeout(() => { sl.spinning = false; sl.last = res; const mult = slotPay(res); let win = bet * mult, jp = false;
    if (res.every(x => x === '7') && bet === r.slot[r.slot.length - 1]) { win += PF.jackpot[r.id]; jp = true; PF.jackpot[r.id] = r.seed; }
    PF.wealth += win; sl.msg = jp ? `累积大奖 · ${fmt(win)}` : win ? `赢得 ${fmt(win)}（${mult} 倍）` : '未中奖'; if (jp) snd('win');
    cResult(win - bet, bet); macauRender(); }, 2400);
}
function slotView() {
  const r = room(), sl = CS.sl; if (!r.slot.includes(sl.bet)) sl.bet = r.slot[0]; const last = sl.last || ['7', 'D', 'B'], maxb = r.slot[r.slot.length - 1];
  return `<div style="text-align:center;margin-bottom:12px"><div class="k" style="letter-spacing:.3em">PROGRESSIVE JACKPOT · ${r.n}</div><div class="n gold" style="font-size:38px">${fmt(jackpot())}</div><div class="k">押注 ${fmt(maxb)} 转出 7 7 7 赢得全部奖池</div></div>
   <div class="reels">${[0, 1, 2].map(i => `<div class="reel"><div class="strip">${['P', last[i], 'S'].map(symHTML).join('')}</div></div>`).join('')}</div>
   <div style="text-align:center;min-height:24px;margin:12px 0 6px;color:var(--gold2)">${sl.msg || '&nbsp;'}</div>
   <div style="margin:6px 0 12px">${chipsRow(r.slot, sl.bet, 'sbet')}</div>
   <div class="row" style="justify-content:center"><button class="btn pri" type="button" data-cb="spin" ${sl.spinning ? 'disabled' : ''} style="padding:11px 26px;font-size:15px">拉杆 · ${fmt(sl.bet)}</button></div>
   <div class="k" style="margin:14px 0 4px">赔率表 · 理论返还率约 94.7%（含奖池）</div>
   <div style="display:grid;grid-template-columns:1fr auto;gap:2px 16px;font-size:12px">${[['7 7 7', '300 倍 + 奖池'], ['◆ ◆ ◆', '100 倍'], ['BAR ×3', '40 倍'], ['♛ ×3', '20 倍'], ['♠ ×3', '10 倍'], ['♥ ×3', '4 倍'], ['任意两个 7', '10 倍'], ['任意两个 ◆', '5 倍'], ['任意一个 7', '2 倍'], ['首轴 ◆', '1 倍']].map(([a, b]) => `<span class="n">${a}</span><span style="text-align:right">${b}</span>`).join('')}</div>`;
}
// ---- 德州扑克 ----
let HD = null;
const AINAMES = [['陈先生', '香港'], ['Tanaka', '东京'], ['Viktor', '莫斯科'], ['林太太', '台北'], ['Mr. Kim', '首尔'], ['Rashid', '迪拜'], ['Sophie', '巴黎'], ['何公子', '澳门']];
const STY = { tight: { t: .06, bl: .03, ag: 0, n: '谨慎' }, loose: { t: -.06, bl: .07, ag: .04, n: '松散' }, aggro: { t: 0, bl: .13, ag: .14, n: '激进' } };
const HN = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];
function evalH(cs) {
  const rc = Array(13).fill(0), sc = [0, 0, 0, 0], bs = [0, 0, 0, 0]; let mask = 0;
  for (const c of cs) { const r = c % 13, s = c / 13 | 0; rc[r]++; sc[s]++; mask |= 1 << r; bs[s] |= 1 << r; }
  const sh = m => { for (let h = 12; h >= 4; h--) if (((m >> (h - 4)) & 31) === 31) return h; if ((m & 0b1000000001111) === 0b1000000001111) return 3; return -1; };
  const enc = (cat, ks) => { let v = cat; for (let i = 0; i < 5; i++) v = v * 13 + (ks[i] || 0); return v; };
  const fs = sc.findIndex(n => n >= 5); let flush;
  if (fs >= 0) { const h = sh(bs[fs]); if (h >= 0) return enc(8, [h]); const ks = []; for (let r = 12; r >= 0 && ks.length < 5; r--) if (bs[fs] >> r & 1) ks.push(r); flush = enc(5, ks); }
  const g4 = [], g3 = [], g2 = [], g1 = []; for (let r = 12; r >= 0; r--) { if (rc[r] === 4) g4.push(r); else if (rc[r] === 3) g3.push(r); else if (rc[r] === 2) g2.push(r); else if (rc[r] === 1) g1.push(r); }
  if (g4.length) return enc(7, [g4[0], [...g3, ...g2, ...g1].sort((a, b) => b - a)[0]]);
  if (g3.length && (g3.length > 1 || g2.length)) return enc(6, [g3[0], Math.max(g3[1] ?? -1, g2[0] ?? -1)]);
  if (flush !== undefined) return flush;
  const st = sh(mask); if (st >= 0) return enc(4, [st]);
  if (g3.length) return enc(3, [g3[0], ...g1.slice(0, 2)]);
  if (g2.length >= 2) return enc(2, [g2[0], g2[1], [...g2.slice(2), ...g1].sort((a, b) => b - a)[0]]);
  if (g2.length) return enc(1, [g2[0], ...g1.slice(0, 3)]);
  return enc(0, g1.slice(0, 5));
}
const catOf = v => Math.floor(v / Math.pow(13, 5));
function equity(hole, board, nOpp, it) {
  const known = new Set([...hole, ...board]), rest = []; for (let c = 0; c < 52; c++) if (!known.has(c)) rest.push(c); let w = 0; const need = nOpp * 2 + 5 - board.length;
  for (let t = 0; t < it; t++) { for (let i = 0; i < need; i++) { const j = i + Math.floor(Math.random() * (rest.length - i)); const tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp; }
    const bd = board.concat(rest.slice(nOpp * 2, need)), me = evalH(hole.concat(bd)); let ties = 0, lose = false;
    for (let o = 0; o < nOpp; o++) { const v = evalH([rest[o * 2], rest[o * 2 + 1]].concat(bd)); if (v > me) { lose = true; break; } if (v === me) ties++; }
    if (!lose) w += 1 / (ties + 1); }
  return w / it;
}
function newAI() { const used = HD ? HD.players.map(p => p.name) : [], [n, f] = pickR(Math.random, AINAMES.filter(a => !used.includes(a[0]))), r = room(); return { name: n, from: f, ai: true, style: pickR(Math.random, Object.keys(STY)), stack: Math.round((r.buy[0] + Math.random() * (r.buy[1] - r.buy[0])) / r.blinds[1]) * r.blinds[1], cards: [], bet: 0, inv: 0, folded: false, allin: false, acted: false, la: '' }; }
const buyAmt = () => { const r = room(); return Math.round((r.buy[0] + (r.buy[1] - r.buy[0]) * CS.buyPct / 100) / r.blinds[1]) * r.blinds[1]; };
function hdSit() { const r = room(), buy = buyAmt(); if (PF.wealth < buy) return toast('个人财富不足', 'bad'); PF.wealth -= buy; HD = { blinds: r.blinds, players: [{ name: '你', from: PF.co, ai: false, stack: buy, cards: [], bet: 0, inv: 0, folded: false, allin: false, acted: false, la: '' }], dealer: Math.floor(Math.random() * 4), stage: 'idle', board: [], log: [], toAct: -1 }; for (let i = 0; i < 3; i++) HD.players.push(newAI()); hdLog(`你以 ${fmt(buy)} 买入入座`); snd('chip'); hdNewHand(); }
function hdLeave() { if (!HD) return; clearTimeout(HD.timer); const me = HD.players[0]; PF.wealth += me.stack; if (HD.stage !== 'done' && HD.stage !== 'broke' && me.inv > 0) cResult(-me.inv, me.inv); toast(`离桌 · 兑回 ${fmt(me.stack)}`); HD = null; saveProfile(); macauRender(); }
function hdLog(t) { HD.log.unshift(t); if (HD.log.length > 30) HD.log.length = 30; }
function hdNewHand() {
  const [sb, bb] = HD.blinds; HD.players.forEach((p, i) => { if (p.ai && p.stack < bb * 2) { HD.players[i] = newAI(); hdLog(`${HD.players[i].name}（${HD.players[i].from}）入座`); } });
  const me = HD.players[0]; if (me.stack < bb) { HD.stage = 'broke'; return macauRender(); }
  HD.deck = newDeck(1); HD.board = []; HD.res = null; HD.start = me.stack;
  HD.players.forEach(p => { p.cards = [HD.deck.pop(), HD.deck.pop()]; p.bet = 0; p.inv = 0; p.folded = false; p.allin = false; p.acted = false; p.show = false; p.la = ''; p.won = 0; p.hn = ''; });
  HD.dealer = (HD.dealer + 1) % 4; const sbi = (HD.dealer + 1) % 4, bbi = (HD.dealer + 2) % 4; hdPost(sbi, sb, '小盲'); hdPost(bbi, bb, '大盲');
  HD.curBet = bb; HD.minRaise = bb; HD.stage = 'preflop'; snd('card'); hdStep(bbi);
}
function hdPost(i, a, l) { const p = HD.players[i], x = Math.min(a, p.stack); p.stack -= x; p.bet += x; p.inv += x; if (!p.stack) p.allin = true; p.la = l; }
const hdPot = () => HD.players.reduce((a, p) => a + p.inv, 0);
const canActH = p => !p.folded && !p.allin;
const needsH = p => canActH(p) && (!p.acted || p.bet < HD.curBet);
function hdStep(from) {
  const live = HD.players.filter(p => !p.folded); if (live.length === 1) return hdFold(live[0]);
  if (!HD.players.some(needsH)) return hdStreet();
  let i = from; for (let k = 0; k < 4; k++) { i = (i + 1) % 4; if (needsH(HD.players[i])) break; }
  HD.toAct = i; macauRender(); if (HD.players[i].ai) { const h = HD; HD.timer = setTimeout(() => { if (HD === h) aiActH(i); }, 650 + Math.random() * 600); }
}
function hdStreet() {
  HD.players.forEach(p => { p.bet = 0; p.acted = false; if (!p.folded && !p.allin) p.la = ''; }); HD.curBet = 0; HD.minRaise = HD.blinds[1];
  if (HD.stage === 'river') return hdShow();
  if (HD.stage === 'preflop') { HD.board.push(HD.deck.pop(), HD.deck.pop(), HD.deck.pop()); HD.stage = 'flop'; } else if (HD.stage === 'flop') { HD.board.push(HD.deck.pop()); HD.stage = 'turn'; } else { HD.board.push(HD.deck.pop()); HD.stage = 'river'; }
  snd('card'); HD.toAct = -1;
  if (HD.players.filter(canActH).length <= 1) { macauRender(); const h = HD; HD.timer = setTimeout(() => { if (HD === h) hdStreet(); }, 1000); return; }
  hdStep(HD.dealer);
}
function hdAct(i, type, to) {
  const p = HD.players[i], call = HD.curBet - p.bet;
  if (type === 'fold') { p.folded = true; p.la = '弃牌'; }
  else if (type === 'call') { const x = Math.min(call, p.stack); p.stack -= x; p.bet += x; p.inv += x; if (!p.stack) p.allin = true; p.la = p.allin ? '全下' : x ? '跟注 ' + chipLbl(x) : '过牌'; }
  else { const cap = p.stack + p.bet; let t = Math.min(to, cap); const minTo = HD.curBet + HD.minRaise; if (t < minTo) t = Math.min(minTo, cap); const prevBet = HD.curBet, x = t - p.bet; p.stack -= x; p.bet = t; p.inv += x; if (!p.stack) p.allin = true;
    if (t > HD.curBet) { const inc = t - HD.curBet; if (inc >= HD.minRaise) HD.minRaise = inc; HD.curBet = t; HD.players.forEach(q => { if (q !== p) q.acted = false; }); }
    p.la = p.allin ? '全下 ' + chipLbl(t) : (prevBet === 0 ? '下注 ' : '加注到 ') + chipLbl(t); }
  p.acted = true; snd(type === 'fold' ? 'card' : 'chip'); hdLog(`${p.name} ${p.la}`); hdStep(i);
}
function aiActH(i) {
  const p = HD.players[i], st = STY[p.style], call = HD.curBet - p.bet, pot = hdPot(), opp = HD.players.filter(q => !q.folded).length - 1;
  const eq = equity(p.cards, HD.board, Math.max(1, opp), HD.board.length ? 260 : 200), rel = eq * (opp + 1), odds = call > 0 ? call / (pot + call) : 0, r = Math.random(), bb = HD.blinds[1];
  const size = f => Math.max(HD.curBet + HD.minRaise, Math.round((HD.curBet + (pot + call) * f) / bb) * bb);
  if (call === 0) { if (rel > 1.45 - st.ag * 2 || r < st.bl) return hdAct(i, 'raise', size(.45 + Math.random() * .4)); return hdAct(i, 'call'); }
  if (call >= p.stack && eq < .5 + st.t && r > st.bl) return hdAct(i, 'fold');
  if (rel > 1.85 - st.ag * 2 && r < .75) return hdAct(i, 'raise', size(.6 + Math.random() * .5));
  if (eq > odds + .03 + st.t) return hdAct(i, 'call');
  if (r < st.bl * .5) return hdAct(i, 'raise', size(.7));
  return hdAct(i, 'fold');
}
function hdFold(w) { const pot = hdPot(); w.stack += pot; w.won = pot; HD.stage = 'done'; HD.toAct = -1; HD.res = `${w.name} 赢得底池 ${fmt(pot)}`; hdLog(HD.res); hdEnd(); }
function hdShow() {
  HD.stage = 'done'; HD.toAct = -1; const ps = HD.players; ps.forEach(p => { if (!p.folded) { p.show = true; p.score = evalH(p.cards.concat(HD.board)); p.hn = HN[catOf(p.score)]; } });
  const rem = ps.map(p => p.inv), msgs = [];
  while (true) { const live = ps.filter((p, i) => !p.folded && rem[i] > 0); if (!live.length) break; const mn = Math.min(...live.map(p => rem[ps.indexOf(p)])); let pot = 0; ps.forEach((p, i) => { const t = Math.min(rem[i], mn); pot += t; rem[i] -= t; });
    const top = Math.max(...live.map(p => p.score)), ws = live.filter(p => p.score === top), share = Math.floor(pot / ws.length); ws.forEach((p, k) => { const amt = share + (k === 0 ? pot - share * ws.length : 0); p.stack += amt; p.won += amt; }); msgs.push(ws.map(p => p.name).join('、') + ' 以' + HN[catOf(top)] + '胜出'); }
  const extra = rem.reduce((a, b) => a + b, 0); if (extra) { const w = ps.filter(p => !p.folded).sort((a, b) => b.score - a.score)[0]; w.stack += extra; w.won += extra; }
  HD.res = '摊牌 · ' + msgs.join(' ｜ '); hdLog(HD.res); hdEnd();
}
function hdEnd() { const me = HD.players[0], net = me.stack - HD.start; if (me.inv > 0) cResult(net, me.inv); macauRender(); }
function hdView() {
  const r = room();
  if (!HD) return `<div class="felt" style="text-align:center"><div class="lgd">NO-LIMIT TEXAS HOLD'EM · 4-MAX</div><h3 style="font:900 20px var(--fs);margin:14px 0 4px">${r.n} · 盲注 ${chipLbl(r.blinds[0])} / ${chipLbl(r.blinds[1])}</h3><p class="mut">和三位来自各地的牌手同桌。买入 ${fmt(r.buy[0])}–${fmt(r.buy[1])}，离桌时筹码兑回个人财富。</p>
   <div class="row" style="justify-content:center;margin:12px 0">${[10, 30, 60, 100].map(v => `<button class="btn sm ${CS.buyPct === v ? 'pri' : ''}" type="button" data-bp="${v}">${v === 100 ? '最高' : v + '%'}</button>`).join('')}</div>
   <div class="n gold" style="font-size:24px;margin-bottom:10px">${fmt(buyAmt())}</div><button class="btn pri" type="button" data-cb="sit" ${PF.wealth >= buyAmt() ? '' : 'disabled'}>入座</button></div>`;
  const me = HD.players[0], myTurn = HD.toAct === 0 && HD.stage !== 'done' && HD.stage !== 'broke', call = HD.curBet - me.bet, pot = hdPot();
  const seat = i => { const p = HD.players[i], showC = i === 0 || p.show; return `<div class="seat ${HD.toAct === i ? 'act' : ''} ${p.folded ? 'out' : ''}" style="grid-area:s${i}"><div class="nm">${esc(p.name)}${HD.dealer === i ? '<span class="dbtn">D</span>' : ''}</div><div class="k">${p.ai ? esc(p.from) + ' · ' + STY[p.style].n : '你的座位'}</div><div class="stk n">${fmt(p.stack)}</div><div class="cards">${p.cards.map(c => card(c, 'sm ' + (showC ? '' : 'back') + (p.folded && i === 0 ? ' dim' : ''))).join('')}</div><div class="la">${[p.won ? '<span class="gold">赢 ' + fmt(p.won) + '</span>' : esc(p.la || ''), p.hn && p.show ? p.hn : '', p.bet && !p.won ? '注 ' + chipLbl(p.bet) : ''].filter(Boolean).join(' · ')}</div></div>`; };
  let ctl = '';
  if (HD.stage === 'broke') ctl = `<span class="mut">筹码不足大盲，请离桌后重新买入。</span><button class="btn" type="button" data-cb="leave">离桌</button>`;
  else if (HD.stage === 'done') ctl = `<button class="btn pri" type="button" data-cb="next">下一手</button><button class="btn" type="button" data-cb="leave">离桌兑现</button>`;
  else if (myTurn) { const cap = me.stack + me.bet, minTo = Math.min(cap, HD.curBet + HD.minRaise), bb = HD.blinds[1]; const seen = new Set(); const ro = [[minTo, '最小加注'], [HD.curBet + Math.round((pot + call) * .5 / bb) * bb, '½ 底池'], [HD.curBet + Math.round((pot + call) / bb) * bb, '底池'], [cap, '全下']].filter(([v]) => v > HD.curBet && v <= cap && v >= minTo).filter(([v]) => { if (seen.has(v)) return false; seen.add(v); return true; });
    ctl = `<button class="btn" type="button" data-hda="fold">弃牌</button><button class="btn" type="button" data-hda="call">${call ? '跟注 ' + fmt(Math.min(call, me.stack)) : '过牌'}</button>${ro.map(([v, l]) => `<button class="btn pri" type="button" data-hda="raise" data-to="${v}">${l} · ${chipLbl(v)}</button>`).join('')}`; }
  else ctl = `<span class="mut">${me.folded ? '已弃牌，等待本手结束…' : '等待其他牌手行动…'}</span>`;
  return `<div class="felt"><div class="lgd">NO-LIMIT HOLD'EM · 盲注 ${chipLbl(HD.blinds[0])}/${chipLbl(HD.blinds[1])}</div><div class="pk">${seat(2)}${seat(1)}<div class="mid" style="grid-area:mid"><div class="cards">${HD.board.map(c => card(c)).join('') || '<span class="mut" style="align-self:center">翻牌前</span>'}</div><div class="k" style="margin-top:4px">底池</div><div class="pot n">${fmt(pot)}</div><div class="k" style="min-height:16px;color:var(--gold2)">${HD.res ? esc(HD.res) : ''}</div></div>${seat(3)}${seat(0)}</div></div>
   <div class="row" style="justify-content:center;margin-top:12px;flex-wrap:wrap">${ctl}</div>
   <div class="k" style="margin:12px 0 4px">牌局记录</div><div style="max-height:110px;overflow:auto;font-size:12px;color:var(--mut)">${HD.log.map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
}
