// ===================== 对局界面 =====================
const G = { prof: null, m: null, me: 0, speed: 1, acc: 0, role: 'solo', seenLog: 0, seenSay: 0, sel: null, lastDay: -1, threatWarned: {}, timer: null, onEnd: null, send: null, ended: false };
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function setHTML(el, h) { if (el && el._h !== h) { el.innerHTML = h; el._h = h; } }
const ri = (r, sm) => `<span class="ri${sm ? ' sm' : ''}" style="background:${RES[r].col}">${RES[r].n[0]}</span>`;
function toast(t, k) { const box = $('#toast'), el = document.createElement('div'); el.className = k || ''; el.textContent = t; box.appendChild(el); setTimeout(() => el.remove(), k === 'bad' || k === 'good' ? 4200 : 2600); while (box.children.length > 4) box.firstChild.remove(); }
function popAt(el, txt, col) { if (!el) return; const r = el.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pop'; p.textContent = txt; p.style.color = col || 'var(--gold2)'; p.style.left = (r.left + 8) + 'px'; p.style.top = (r.bottom - 6) + 'px'; document.body.appendChild(p); setTimeout(() => p.remove(), 1300); }
function lookOf(p) { if (p.persona) return PERSONAS[p.persona].look; if (p.look != null) return MY_LOOKS[p.look % MY_LOOKS.length]; return MY_LOOKS[0]; }
function face(p) { return portrait(lookOf(p), shade(p.color, -.55)); }
function estProfit(m, t, k, lv) { const B = BLD[k]; if (!B.out) return 0; const e = eff(m, { ...t, b: { k, lv: lv || 1 } }); let v = 0; for (const r in B.out) v += B.out[r] * e * m.mkt[r].p; if (B.in) for (const r in B.in) v -= B.in[r] * e * m.mkt[r].p; return v; }
function ioText(m, t, k, lv) { const B = BLD[k], e = eff(m, { ...t, b: { k, lv: lv || 1 } }); const f = o => Object.entries(o).map(([r, q]) => `${ri(r, 1)} ${fmtN(q * e)}`).join(' '); return B.in ? `${f(B.in)} → ${f(B.out)}` : B.out ? `产出 ${f(B.out)}` : ''; }
const TERR = { land: '平原', urban: '城区', water: '黄浦江', sea: '东海', landmark: '东方明珠' };

// ---------- 指令 ----------
function doAct(cmd, quiet) {
  const m = G.m; if (!m) return { ok: false };
  if (G.role === 'client') { G.send && G.send(cmd); return { ok: true, pending: true }; }
  const r = act(m, G.me, cmd);
  if (!r.ok && !quiet && r.msg) toast(r.msg, 'bad');
  if (r.ok) afterAct(cmd, r);
  hudUpdate(true);
  if (G.role === 'host' && G.net) G.net.broadcastSoon();
  return r;
}
function afterAct(cmd, r) {
  const m = G.m;
  if (cmd.t === 'build') { snd('build'); if (cmd.k && cmd.x != null) addFloat(cmd.x, cmd.y, '-' + fmt(BLD[cmd.k].cost), '#f3d27c'); }
  if (cmd.t === 'claim') snd('click');
  if (cmd.t === 'upgrade' || cmd.t === 'hqup') { snd('lv'); toast(cmd.t === 'hqup' ? `总部升至 ${m.players[G.me].hql} 级，地块许可与辐射范围增加` : '升级开工', 'good'); }
  if (cmd.t === 'trade') snd(cmd.q > 0 ? 'buy' : 'coin');
  if (cmd.t === 'share') { snd('coin'); }
  if (cmd.t === 'tender') { snd('lv'); }
  if (cmd.t === 'sab') { snd(r.blocked ? 'bad' : 'sab'); toast(r.blocked ? '对方早有防备：手段被安保合同挡下' : `已使用「${SAB[cmd.k].n}」`, r.blocked ? 'bad' : 'good'); }
  if (cmd.t === 'bid') snd('chip');
}

// ---------- 开局 ----------
function startMatch(m, me, role) {
  G.m = m; G.me = me; G.role = role || 'solo'; G.placed = false; G.seenLog = 0; G.seenSay = 0; G.sel = null; G.acc = 0; G.threatWarned = {}; G.ended = false; G.speed = 1;
  rSetMatch(m, me); R.drift = false; R.resView = false;
  R.onClick = onTileClick; R.onHover = onTileHover;
  $('#home').hidden = true; $('#hud').hidden = false; document.body.dataset.mt = 'map';
  hudBuild(); hudUpdate(true);
  if (m.phase === 'setup') setupHQ();
  clearInterval(G.timer); G.timer = setInterval(loop, 100);
  snd('start');
}
function setupHQ() {
  const m = G.m;
  const valid = () => m.tiles.filter(t => isBuildable(t) && t.owner === -1 && !m.players.some(q => q.hq && cheb(q.hq.x, q.hq.y, t.x, t.y) < 5)).map(t => t.y * MAP_W + t.x);
  R.hl = new Set(valid()); R.hlCol = '#7ee08a'; R.resView = true;
  const b = $('#hBanner'); b.hidden = false;
  setHTML(b, `<h3>选择总部位置</h3><div class="mut">绿色地块可以设总部。总部周围 ${HQ_LV[1].radius} 格内可以占地，挑资源多、种类全的地方。对手已经落位。</div>`);
}
function loop() {
  const m = G.m; if (!m) return;
  if (m.phase === 'play' && !m.over && G.role !== 'client' && G.speed > 0 && !document.hidden) {
    G.acc += 100 * G.speed;
    while (G.acc >= 1000 && !m.over) { G.acc -= 1000; dayTick(); }
  }
  const f = m.phase === 'play' ? (m.day + (G.role === 'client' ? 0 : G.acc / 1000)) / m.len : 0; const bar = $('#hBar'); if (bar) bar.style.width = (clamp(f, 0, 1) * 100).toFixed(2) + '%';
  if (m.over && !G.ended) { G.ended = true; setTimeout(showResults, 1400); }
}
function dayTick() {
  const m = G.m; step(m); aiDay(m);
  // 自己的建筑冒产出浮字
  for (const t of m.tiles) if (t.owner === G.me && t.b && !t.b.prog && !t.b.idle && !t.b.stall && BLD[t.b.k].out && Math.random() < .07) {
    const B = BLD[t.b.k], r = Object.keys(B.out)[0]; addFloat(t.x, t.y, `+${fmtN(B.out[r] * eff(m, t))} ${RES[r].n}`, RES[r].col);
  }
  hudUpdate();
  if (G.role === 'host' && G.net) G.net.broadcast();
}

// ---------- 交互 ----------
function onTileClick(t) {
  const m = G.m; if (!m) return;
  if (m.phase === 'setup') {
    if (!t) return; const me = m.players[G.me]; if (me.hq) return;
    const r = doAct({ t: 'hq', x: t.x, y: t.y });
    if (G.role !== 'client' && r.ok) hqPlaced();
    return;
  }
  if (!t) { G.sel = null; R.sel = null; renderAct(); return; }
  const i = t.y * MAP_W + t.x; G.sel = G.sel === i ? null : i; R.sel = G.sel; snd('click');
  if (document.body.dataset.mt !== 'map' && innerWidth <= 760) setTab('map');
  renderAct(true);
}
function hqPlaced() {
  const m = G.m, me = m.players[G.me]; if (!me.hq) return; R.hl = null; R.resView = false;
  if (m.phase === 'setup') { setHTML($('#hBanner'), '<h3>等待其他董事长选址…</h3><div class="mut">所有人选好总部后商战开始。</div>'); } else $('#hBanner').hidden = true;
  if (G.placed) return; G.placed = true;
  camTo(me.hq.x, me.hq.y, Math.min(R.cam.dist, 150));
  G.sel = me.hq.y * MAP_W + me.hq.x; R.sel = G.sel; renderAct(true);
  toast('总部落成。点击周围带资源的地块占地建厂。', 'good');
}
function onTileHover() { }
function setTab(k) { document.body.dataset.mt = k; $$('#hTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === k)); }

// ---------- HUD 骨架 ----------
function hudBuild() {
  const m = G.m, me = m.players[G.me];
  $('#hud').innerHTML = `
  <div class="top">
    <div class="pnl brand"><div class="lg">商海浮沉<small>SHANGHAI · 商战</small></div></div>
    <div class="pnl clock"><div class="sp"><span class="k" id="hDay"></span><span class="fx" id="hFx"></span></div><div class="bar"><i id="hBar"></i></div></div>
    <div class="pnl money"><div><div class="k">现金</div><div class="v n" id="hCash"></div></div><div><div class="k">公司估值</div><div class="v n" id="hVal"></div></div><div><div class="k">地块许可</div><div class="v n" id="hCl"></div></div></div>
    <div class="pnl speed" id="hSpeed">
      ${[[0, 'Ⅱ'], [1, '1×'], [2, '2×'], [4, '4×']].map(([s, l]) => `<button type="button" data-speed="${s}" aria-label="${s ? '速度 ' + l : '暂停'}">${l}</button>`).join('')}
      <button type="button" data-k="resview" title="资源视图 (R)">◈</button><button type="button" data-k="menu" title="菜单">☰</button>
    </div>
  </div>
  <div class="rivals" id="hCos">${m.players.map(p => `<div class="pnl co${p.id === G.me ? ' me' : ''}" data-co="${p.id}" style="--pc:${p.color}"><span class="pt">${face(p)}</span><div class="nm">${esc(p.co)}<small>${esc(p.name)}${p.persona ? ' · ' + PERSONAS[p.persona].tag : p.id === G.me ? ' · 你' : ' · 玩家'}</small></div><div class="sp"><span class="val n" data-v></span><span class="k" data-sp></span></div><div class="shr" data-s>${'<i></i>'.repeat(SHARES)}</div><div class="st" data-st></div></div>`).join('')}</div>
  <div class="bubbles" id="hBub"></div>
  <div class="pnl mkt" id="hMkt"><h4>共享市场 <span class="k">所有公司共用一个价格</span></h4>
    ${RK.map(r => `<div class="res" data-r="${r}">${ri(r)}<div class="row" style="gap:6px"><span class="nm">${RES[r].n}</span><canvas width="124" height="36"></canvas></div><div><div class="pr" data-p></div><div class="ch" data-c></div></div>
    <div class="ln2"><span>库存 <span class="inv" data-i></span></span><span class="flow" data-f></span><span class="tr"><button type="button" data-mode="${r}"></button><button type="button" data-tr="${r}" data-q="-10" title="卖出 10（按住 Shift 卖 100）">卖10</button><button type="button" data-tr="${r}" data-q="10" title="买入 10（按住 Shift 买 100）">买10</button></span></div></div>`).join('')}
    <div class="sp" style="margin-top:6px"><label class="row k" style="cursor:pointer"><input type="checkbox" id="hAutobuy" ${me.autobuy ? 'checked' : ''}> 缺料自动从市场采购</label><span class="k" id="hPort"></span></div>
  </div>
  <div class="pnl feed" id="hFeed"><h4>商战动态</h4><div class="lst" id="hLog"></div></div>
  <div class="pnl act" id="hAct"></div>
  <div class="pnl auc" id="hAuc" hidden></div>
  <div class="pnl banner" id="hBanner" hidden></div>
  <div class="pnl mtabs" id="hTabs">${[['map', '地图'], ['mkt', '市场'], ['co', '对手'], ['log', '动态']].map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === 'map' ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  $('#hud').onclick = hudClick;
  $('#hAutobuy').onchange = e => doAct({ t: 'autobuy', on: e.target.checked });
  setHTML($('#hLog'), ''); renderAct(true);
}
function hudClick(e) {
  const b = e.target.closest('button,[data-co]'); if (!b) return; const d = b.dataset, m = G.m;
  if (d.speed != null) { if (G.role === 'client') { toast('联机对局由房主控制速度'); return; } if (G.role === 'host' && +d.speed === 0) { toast('联机对局不能暂停'); return; } G.speed = +d.speed; snd('click'); hudUpdate(true); if (G.net) G.net.broadcastSoon(); return; }
  if (d.k === 'resview') { R.resView = !R.resView; R.hl = R.resView ? claimableSet() : null; R.hlCol = '#f3d27c'; snd('click'); return; }
  if (d.k === 'menu') { matchMenu(); return; }
  if (d.tab) { setTab(d.tab); return; }
  if (d.co != null) { coModal(+d.co); return; }
  if (d.mode) { const p = m.players[G.me]; doAct({ t: 'mode', r: d.mode, m: p.mode[d.mode] === 'sell' ? 'hold' : 'sell' }); return; }
  if (d.tr) { const q = +d.q * (e.shiftKey ? 10 : 1); const r = doAct({ t: 'trade', r: d.tr, q }); if (r.ok && r.v) popAt(b, (q > 0 ? '-' : '+') + fmt(r.v), q > 0 ? 'var(--mut)' : 'var(--gold2)'); return; }
  if (d.a) return actClick(d, b);
}
function claimableSet() { const m = G.m, s = new Set(); for (const t of m.tiles) if (!canClaim(m, G.me, t.x, t.y)) s.add(t.y * MAP_W + t.x); return s; }

// ---------- HUD 刷新 ----------
function hudUpdate(force) {
  const m = G.m; if (!m || $('#hud').hidden) return;
  const me = m.players[G.me];
  setHTML($('#hDay'), m.phase === 'setup' ? '布局阶段' : `第 <b class="n" style="color:var(--ink)">${m.day}</b> / ${m.len} 天${G.role !== 'solo' ? ' · 联机' : ''}`);
  setHTML($('#hFx'), m.fx.map(f => `<span class="tag">${f.n} · ${f.until - m.day}天</span>`).join('') + (m.pendingEvent ? `<span class="tag rumor">传闻：${m.pendingEvent.e.n}</span>` : ''));
  setHTML($('#hCash'), `<span class="${me.cash < 0 ? 'up' : ''}">${fmt(me.cash)}</span>`);
  setHTML($('#hVal'), fmt(valuation(m, G.me)));
  setHTML($('#hCl'), `${claimsUsed(m, G.me)}<span class="mut" style="font-size:.7em">/${claimLimit(m, G.me)}</span>`);
  $$('#hSpeed [data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === G.speed));
  // 公司卡
  for (const p of m.players) {
    const el = $(`[data-co="${p.id}"]`); if (!el) continue;
    el.classList.toggle('dead', !p.alive);
    setHTML(el.querySelector('[data-v]'), p.alive ? fmt(valuation(m, p.id)) : '出局');
    setHTML(el.querySelector('[data-sp]'), p.alive ? `股价 ${fmt(sharePrice(m, p.id))}` : '');
    const sq = []; m.players.forEach((q, j) => { for (let k = 0; k < m.hold[j][p.id]; k++) sq.push(q.color); });
    el.querySelectorAll('[data-s] i').forEach((i, k) => { i.style.background = sq[k] || ''; });
    let st = '';
    if (!p.alive) st = p.takenBy != null ? `已被 ${esc(m.players[p.takenBy].co)} 收购` : '破产出局';
    else {
      const th = m.players.map((q, j) => ({ q, n: j === p.id ? 0 : m.hold[j][p.id] })).sort((a, b) => b.n - a.n)[0];
      const parts = [];
      if (th.n >= 3) parts.push(`<b>${esc(th.q.name)} 持股 ${th.n}/10${m.hold[p.id][p.id] >= TAKEOVER ? '（已免疫）' : ''}</b>`);
      if (m.hold[p.id][p.id]) parts.push(`自持 ${m.hold[p.id][p.id]}`);
      if (p.scandal) parts.push('<b>舆论危机</b>');
      if (p.guard) parts.push('安保中');
      if (p.cash < 0) parts.push(`负债 ${fmt(-p.cash)}`);
      st = parts.join(' · ');
    }
    setHTML(el.querySelector('[data-st]'), st);
  }
  // 收购威胁提醒
  m.players.forEach((q, j) => { if (j !== G.me && q.alive && m.hold[j][G.me] >= TAKEOVER - 1 && !G.threatWarned[j]) { G.threatWarned[j] = 1; toast(`警告：${q.co} 已持有你 ${m.hold[j][G.me]} 股，到 5 股就能发起收购！回购自家股票可以免疫。`, 'bad'); snd('bad'); } });
  // 市场
  const fl = flows(m, G.me);
  for (const r of RK) {
    const row = $(`.res[data-r="${r}"]`); if (!row) continue; const k = m.mkt[r], h = k.h, prev = h[Math.max(0, h.length - 11)], ch = (k.p - prev) / prev;
    setHTML(row.querySelector('[data-p]'), `<span class="n">${k.p.toFixed(k.p < 100 ? 1 : 0)}</span>`);
    setHTML(row.querySelector('[data-c]'), `<span class="${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}">${pct(ch)}</span>`);
    setHTML(row.querySelector('[data-i]'), fmtN(me.inv[r]));
    const f = fl[r]; setHTML(row.querySelector('[data-f]'), Math.abs(f) < .05 ? '' : `<span class="${f > 0 ? 'down' : 'up'}" style="color:${f > 0 ? '#7fd8a8' : '#f39a8f'}">${f > 0 ? '+' : ''}${fmtN(f)}/天</span>`);
    const mb = row.querySelector('[data-mode]'); setHTML(mb, me.mode[r] === 'hold' ? '囤货中' : '自动卖'); mb.title = me.mode[r] === 'hold' ? '点击改为自动卖出' : '点击改为囤货（不自动卖）'; mb.classList.toggle('hold', me.mode[r] === 'hold');
    spark(row.querySelector('canvas'), h.slice(-40), RES[r].base);
  }
  const pb = portBonus(m, G.me); setHTML($('#hPort'), pb ? `码头加成 +${Math.round(pb * 100)}%` : '');
  // 动态与喊话
  for (const l of m.log.filter(l => l.n > G.seenLog)) feedAdd(l);
  for (const s of m.says.filter(s => s.n > G.seenSay)) bubble(s);
  G.seenLog = m.logN; G.seenSay = m.logN;
  // 拍卖
  renderAuction();
  if (m.phase !== 'setup' && me.hq && !G.placed) hqPlaced();
  if (m.phase === 'play' && !$('#hBanner').hidden) $('#hBanner').hidden = true;
  if (force || m.day !== G.lastDay) { G.lastDay = m.day; renderAct(); }
  if (R.resView && m.phase === 'play') R.hl = claimableSet();
}
function spark(cv, d, base) {
  if (!cv || d.length < 2) return; const x = cv.getContext('2d'), w = cv.width, h = cv.height; x.clearRect(0, 0, w, h);
  const mn = Math.min(...d, base * .9), mx = Math.max(...d, base * 1.1), Y = v => h - 3 - (v - mn) / (mx - mn) * (h - 6);
  x.strokeStyle = 'rgba(255,255,255,.12)'; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(0, Y(base)); x.lineTo(w, Y(base)); x.stroke(); x.setLineDash([]);
  const up = d[d.length - 1] >= d[0]; x.strokeStyle = up ? '#ef5a4c' : '#38b47a'; x.lineWidth = 2; x.beginPath(); d.forEach((v, i) => { const X = i / (d.length - 1) * w; i ? x.lineTo(X, Y(v)) : x.moveTo(X, Y(v)); }); x.stroke();
}
function feedAdd(l) {
  const m = G.m, me = m.players[G.me], box = $('#hLog'); if (!box) return;
  if (l.k === 'share' && l.pid !== G.me && l.txt.includes('回购自家')) return;
  const el = document.createElement('div'); el.className = 'it ' + l.k; el.innerHTML = `<span class="d">D${l.d}</span>${esc(l.txt)}`; box.prepend(el);
  while (box.children.length > 70) box.lastChild.remove();
  const aboutMe = l.txt.includes(me.co);
  if (l.k === 'event') { toast(l.txt, 'good'); snd('event'); }
  else if (l.k === 'rumor' && upgLvMe()) { }
  else if (l.k === 'auction' && l.txt.startsWith('土地拍卖')) { toast('土地拍卖开始！', 'good'); snd('event'); }
  else if (l.k === 'sab' && aboutMe && l.pid !== G.me) { toast(l.txt, 'bad'); snd('bad'); }
  else if (l.k === 'share' && aboutMe && l.pid !== G.me && !l.txt.includes('回购')) { toast(l.txt, 'bad'); }
  else if (l.k === 'takeover') { toast(l.txt, l.pid === G.me ? 'good' : 'bad'); snd(l.pid === G.me ? 'lv' : 'bad'); }
}
function upgLvMe() { return false; }
function bubble(s) {
  const m = G.m, p = m.players[s.pid], box = $('#hBub'); if (!box || !p) return;
  if (s.pid === G.me && !s.chat) return;
  const el = document.createElement('div'); el.className = 'bub'; el.style.setProperty('--pc', p.color);
  el.innerHTML = `<span class="pt">${face(p)}</span><div class="tx"><small>${esc(p.name)} · ${esc(p.co)}</small>${esc(s.txt)}</div>`;
  box.prepend(el); snd('say');
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 6500);
  while (box.children.length > 3) box.lastChild.remove();
}
function renderAuction() {
  const m = G.m, a = m.auction, el = $('#hAuc'); if (!el) return;
  if (!a) { el.hidden = true; return; }
  el.hidden = false; const t = tileAt(m, a.x, a.y), me = m.players[G.me], nb = minBid(a);
  const who = a.by >= 0 ? m.players[a.by] : null;
  setHTML(el, `<div class="sp"><b>土地拍卖 · ${t.metro ? '地铁上盖（加工 +30%）' : RES[t.res].n + ' <span class="stars">★★★</span>'}</b><span class="tag">剩 ${Math.max(0, a.ends - m.day)} 天</span></div>
   <div class="sp" style="margin:8px 0"><div><div class="k">当前最高</div><div class="best n">${a.best ? fmt(a.best) : '—'}</div></div><div style="text-align:right">${who ? `<span class="row" style="justify-content:flex-end"><span class="pt" style="width:26px;height:26px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 2px ${who.color}">${face(who)}</span>${esc(who.co)}</span>` : '<span class="mut">尚无人出价</span>'}</div></div>
   <div class="row"><button class="btn pri" type="button" data-a="bid" data-v="${nb}" ${a.by === G.me || me.cash < nb || !me.alive ? 'disabled' : ''}>${a.by === G.me ? '你领先' : '出价 ' + fmt(nb)}</button><button class="btn" type="button" data-a="look" data-x="${a.x}" data-y="${a.y}">看地块</button><span class="k" style="margin-left:auto">不占许可，不限距离</span></div>`);
}

// ---------- 操作面板 ----------
function renderAct(force) {
  const m = G.m, el = $('#hAct'); if (!el || !m) return;
  if (m.phase === 'setup') { el.hidden = true; return; }
  el.hidden = false;
  const me = m.players[G.me]; let h = '';
  if (!me.alive) { h = `<div class="hd"><span class="t">你已出局</span></div><div class="mut">可以继续观战，或从菜单返回办公室。</div>`; return setHTML(el, h); }
  const t = G.sel != null ? m.tiles[G.sel] : null;
  if (!t) h = actDefault(m, me);
  else h = actTile(m, me, t);
  setHTML(el, h);
}
function optBtn(a, data, title, cost, extra, dis, danger) {
  return `<button type="button" class="opt${danger ? ' danger' : ''}" data-a="${a}" ${Object.entries(data).map(([k, v]) => `data-${k}="${v}"`).join(' ')} ${dis ? 'disabled' : ''}><b>${title}</b>${cost != null ? `<span class="c">${cost}</span>` : ''}${extra ? `<span class="e">${extra}</span>` : ''}</button>`;
}
function actDefault(m, me) {
  const nx = HQ_LV[me.hql + 1]; const cd = k => (me.sabCd[k] || 0) > m.day ? `冷却 ${me.sabCd[k] - m.day} 天` : '';
  const tip = m.day < 40 ? '点击地图上带资源的地块（◈ 可显示资源和可占地块），占地后建农场、油井、矿场，原料自动卖进市场。'
    : m.day < 140 ? '电厂把原油变成电力，钢厂、食品厂、芯片厂再把原料加工成高价货。大家都在卖的东西会越来越便宜。'
      : '点左侧公司卡买对手股票：持股 5 股即可发起要约收购，吞并对方全部产业。也记得回购自家股票，自持 5 股就免疫。';
  return `<div class="hd"><span class="t">${esc(me.co)}</span><span class="tag">总部 ${me.hql} 级 · 辐射 ${HQ_LV[me.hql].radius} 格</span><span class="k" style="margin-left:auto">${tip ? '' : ''}</span></div>
   <div class="mut" style="font-size:12px;margin-bottom:8px">${tip}</div>
   <div class="opts">
     ${nx ? optBtn('hqup', {}, '升级总部', fmt(nx.cash), `+钢材 ${nx.steel} · 许可 ${nx.claims} · 半径 ${nx.radius}`, me.cash < nx.cash) : optBtn('noop', {}, '总部已满级', null, '', true)}
     ${optBtn('sabmenu', { k: 'corner' }, '囤积居奇', fmt(SAB.corner.cost), cd('corner') || '指定资源价格 +35%', me.cash < SAB.corner.cost || cd('corner'))}
     ${optBtn('sabmenu', { k: 'dump' }, '恶意倾销', fmt(SAB.dump.cost), cd('dump') || '打压对手主营产品', me.cash < SAB.dump.cost || cd('dump'), 1)}
     ${optBtn('sab', { k: 'guard' }, '安保合同', fmt(SAB.guard.cost), cd('guard') || `挡下下一次手段${me.guard ? `（已有 ${me.guard}）` : ''}`, me.cash < SAB.guard.cost || cd('guard'))}
   </div>`;
}
function actTile(m, me, t) {
  const owner = t.owner >= 0 ? m.players[t.owner] : null;
  const head = `<div class="hd"><span class="t">${t.b ? BLD[t.b.k].n : TERR[t.t]}</span>${t.res ? `<span class="tag">${ri(t.res, 1)} ${RES[t.res].n} <span class="stars">${'★'.repeat(t.r)}</span></span>` : ''}${t.port ? '<span class="tag">临海</span>' : ''}${t.metro ? '<span class="tag" style="color:#c9b5f5">地铁上盖 +30%</span>' : ''}${t.t === 'urban' && !t.b ? '<span class="tag">城区：加工厂 +15%</span>' : ''}${owner ? `<span class="tag" style="color:${owner.color}">${esc(owner.co)}</span>` : ''}<button class="x" type="button" data-a="desel" aria-label="关闭">×</button></div>`;
  let body = '';
  if (t.t === 'water' || t.t === 'sea') body = `<div class="mut">${t.t === 'sea' ? '东海航道，远洋货轮在这里进出。临海地块可以建码头，提高所有卖价。' : '黄浦江，不能建设。'}</div>`;
  else if (t.t === 'landmark') body = `<div class="mut">东方明珠广播电视塔。城市地标，不可占用。周边城区地块适合建加工厂。</div>`;
  else if (m.auction && m.auction.x === t.x && m.auction.y === t.y) body = `<div class="mut">这块地正在拍卖，见上方拍卖面板。</div>`;
  else if (t.owner === -1) {
    const why = canClaim(m, G.me, t.x, t.y);
    const opts = BUILDABLE.filter(k => { const B = BLD[k]; return !(B.need && (t.res !== B.need || t.t === 'urban')) && !(B.port && !t.port); });
    body = why ? `<div class="mut" style="margin-bottom:8px">无法占地：${why}</div>` : '';
    body += `<div class="opts">${why ? '' : optBtn('claim', { x: t.x, y: t.y }, '只占地', '免费', `占用 1 个许可（剩 ${claimLimit(m, G.me) - claimsUsed(m, G.me)}）`)}${opts.map(k => buildOpt(m, me, t, k, !!why, true)).join('')}</div>`;
  }
  else if (t.owner === G.me) {
    if (!t.b) {
      const opts = BUILDABLE.filter(k => { const B = BLD[k]; return !(B.need && (t.res !== B.need || t.t === 'urban')) && !(B.port && !t.port); });
      body = `<div class="opts">${opts.map(k => buildOpt(m, me, t, k, false, false)).join('')}${optBtn('release', { x: t.x, y: t.y }, '放弃地块', null, '归还 1 个许可', false, 1)}</div>`;
    } else if (t.b.k === 'hq' || t.b.k === 'branch') {
      const nx = HQ_LV[me.hql + 1];
      body = `<div class="mut" style="margin-bottom:8px">${t.b.k === 'hq' ? `总部 ${me.hql} 级：地块许可 ${claimLimit(m, G.me)}，辐射半径 ${HQ_LV[me.hql].radius} 格。` : '收购得来的分公司，同样作为占地辐射中心。'}</div><div class="opts">${t.b.k === 'hq' && nx ? optBtn('hqup', {}, '升级总部', fmt(nx.cash), `+钢材 ${nx.steel} · 许可 ${nx.claims} · 半径 ${nx.radius}`, me.cash < nx.cash) : ''}</div>`;
    } else body = bldInfo(m, me, t, true);
  }
  else { // 对手地块
    if (t.b && t.b.k !== 'hq' && t.b.k !== 'branch') {
      const cd = k => (me.sabCd[k] || 0) > m.day ? `冷却 ${me.sabCd[k] - m.day} 天` : '';
      body = bldInfo(m, me, t, false) + `<div class="k" style="margin:8px 0 6px">对这座建筑下手</div><div class="opts">${optBtn('sab', { k: 'strike', x: t.x, y: t.y }, '组织罢工', fmt(SAB.strike.cost), cd('strike') || '停工 30 天', me.cash < SAB.strike.cost || cd('strike'), 1)}${optBtn('sab', { k: 'audit', x: t.x, y: t.y }, '工商检查', fmt(SAB.audit.cost), cd('audit') || '停工 60 天', me.cash < SAB.audit.cost || cd('audit'), 1)}${optBtn('co', { id: t.owner }, '查看公司', null, '买股 / 收购 / 舆论', false)}</div>`;
    } else body = `<div class="mut" style="margin-bottom:8px">${esc(owner.co)} 的${t.b ? BLD[t.b.k].n : '地块'}。</div><div class="opts">${optBtn('co', { id: t.owner }, '查看公司', null, '买股 / 收购 / 手段', false)}</div>`;
  }
  return head + body;
}
function buildOpt(m, me, t, k, dis, claim) {
  const B = BLD[k]; const why = claim ? '' : canBuild(m, G.me, t.x, t.y, k);
  let extra;
  if (k === 'port') extra = `所有卖价 +${PORT_BONUS * 100}%（最多两座）`;
  else { const p = estProfit(m, t, k); extra = `${ioText(m, t, k)}<br>现价利润 <span class="${p >= 0 ? '' : 'up'}" style="color:${p >= 0 ? '#7fd8a8' : '#f39a8f'}">${p >= 0 ? '+' : ''}${fmt(p)}/天</span>`; }
  return optBtn(claim ? 'claimbuild' : 'build', { x: t.x, y: t.y, k }, (claim ? '占地 + ' : '建') + B.n, fmt(B.cost), extra, dis || me.cash < B.cost || (why && why !== '现金不足'));
}
function bldInfo(m, me, t, mine) {
  const b = t.b, B = BLD[b.k];
  const st = b.prog ? `施工中，还需 ${b.prog} 天` : b.idle ? `<span class="up">停工中，还剩 ${b.idle} 天</span>` : b.stall === 'input' ? '<span style="color:var(--warn)">缺料停产：库存不足，且未开启自动采购或现金不够</span>' : b.stall === 'typhoon' ? '<span style="color:var(--warn)">台风停摆</span>' : '<span style="color:#7fd8a8">生产中</span>';
  let h = `<div class="row" style="flex-wrap:wrap;gap:6px 14px;margin-bottom:8px"><span>${B.n} · ${b.lv} 级</span><span>${st}</span>${B.out ? `<span>${ioText(m, t, b.k, b.lv)} /天</span><span>现价利润 <b class="n" style="color:${estProfit(m, t, b.k, b.lv) >= 0 ? '#7fd8a8' : '#f39a8f'}">${fmt(estProfit(m, t, b.k, b.lv))}/天</b></span>` : b.k === 'port' ? `<span>卖价 +${PORT_BONUS * 100}%</span>` : ''}</div>`;
  if (mine) {
    const canUp = b.k !== 'port' && b.lv < 3;
    h += `<div class="opts">${canUp ? optBtn('upgrade', { x: t.x, y: t.y }, `升到 ${b.lv + 1} 级`, fmt(upCost(t)), `+钢材 ${upSteel(t)} · 产出 ×${(LVM[b.lv + 1] / LVM[b.lv]).toFixed(2)}`, me.cash < upCost(t) || b.prog) : ''}${optBtn('sellb', { x: t.x, y: t.y }, '拆除变卖', '+' + fmt(bookValue(t) * .7), '回收部分建设费', false, 1)}</div>`;
  }
  return h;
}
function actClick(d, b) {
  const m = G.m, a = d.a;
  if (a === 'desel') { G.sel = null; R.sel = null; renderAct(true); return; }
  if (a === 'claim') { doAct({ t: 'claim', x: +d.x, y: +d.y }); return; }
  if (a === 'claimbuild') { const r = doAct({ t: 'claim', x: +d.x, y: +d.y }); if (r.ok) doAct({ t: 'build', x: +d.x, y: +d.y, k: d.k }); return; }
  if (a === 'build') { doAct({ t: 'build', x: +d.x, y: +d.y, k: d.k }); return; }
  if (a === 'upgrade') { doAct({ t: 'upgrade', x: +d.x, y: +d.y }); return; }
  if (a === 'sellb') { confirmBox('拆除建筑？', '建筑会被拆除，回收部分建设费。地块保留。', () => doAct({ t: 'sellb', x: +d.x, y: +d.y })); return; }
  if (a === 'release') { doAct({ t: 'release', x: +d.x, y: +d.y }); G.sel = null; R.sel = null; renderAct(true); return; }
  if (a === 'hqup') { doAct({ t: 'hqup' }); return; }
  if (a === 'sab') { doAct({ t: 'sab', k: d.k, x: d.x != null ? +d.x : undefined, y: d.y != null ? +d.y : undefined, tgt: d.tgt != null ? +d.tgt : undefined, r: d.r }); closeModal(); return; }
  if (a === 'sabmenu') { resPicker(d.k); return; }
  if (a === 'co') { coModal(+d.id); return; }
  if (a === 'bid') { doAct({ t: 'bid', amt: +d.v }); return; }
  if (a === 'look') { camTo(+d.x, +d.y); G.sel = +d.y * MAP_W + +d.x; R.sel = G.sel; renderAct(true); return; }
}

// ---------- 弹窗 ----------
function modal(html, cls) { G.onModal = null; const el = $('#modal'); el.innerHTML = `<div class="mbg"><div class="pnl modal ${cls || ''}" role="dialog" aria-modal="true">${html}</div></div>`; el.querySelector('.mbg').addEventListener('click', e => { if (e.target.classList.contains('mbg')) closeModal(); }); el.querySelector('.modal').addEventListener('click', modalClick); return el.querySelector('.modal'); }
function closeModal() { $('#modal').innerHTML = ''; G.modalCo = null; }
function confirmBox(title, txt, yes) { modal(`<h2>${title}</h2><p class="mut">${txt}</p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-mx="no">取消</button><button class="btn pri" type="button" data-mx="yes">确定</button></div>`); G.confirmYes = yes; }
function modalClick(e) {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.mx === 'no' || d.mx === 'close') { closeModal(); return; }
  if (d.mx === 'yes') { closeModal(); G.confirmYes && G.confirmYes(); return; }
  if (d.a) { actClick(d, b); if (G.modalCo != null) coModal(G.modalCo, true); return; }
  if (d.sh) { doAct({ t: 'share', tgt: +d.tgt, q: +d.sh }); coModal(+d.tgt, true); return; }
  if (d.tender) { const r = doAct({ t: 'tender', tgt: +d.tender }); if (r.ok) closeModal(); else coModal(+d.tender, true); return; }
  if (d.menu) return menuAct(d.menu);
  if (G.onModal) G.onModal(d, b);
}
function resPicker(k) {
  const m = G.m, S = SAB[k];
  modal(`<button class="x" type="button" data-mx="close" aria-label="关闭">×</button><h2>${S.n}</h2><p class="mut">${S.d}。花费 ${fmt(S.cost)}，冷却 ${S.cd} 天。${k === 'corner' ? '先囤好货，再拉高价格卖出。' : '挑对手大量出货的资源，砸他的收入。'}</p>
   <div class="sabs">${RK.map(r => { const f = flows(m, G.me)[r]; return `<button class="opt${k === 'dump' ? ' danger' : ''}" type="button" data-a="sab" data-k="${k}" data-r="${r}"><b>${ri(r, 1)} ${RES[r].n}</b><span class="c">${m.mkt[r].p.toFixed(1)}</span><span class="e">你的库存 ${fmtN(m.players[G.me].inv[r])}${Math.abs(f) > .05 ? ` · ${f > 0 ? '+' : ''}${fmtN(f)}/天` : ''}</span></button>`; }).join('')}</div>`);
}
function coModal(id, keep) {
  const m = G.m, p = m.players[id], me = m.players[G.me], mine = id === G.me; G.modalCo = id;
  const price = sharePrice(m, id), val = valuation(m, id);
  const holders = m.players.map((q, j) => ({ q, n: m.hold[j][id] })).filter(x => x.n > 0);
  const cd = k => (me.sabCd[k] || 0) > m.day ? `冷却 ${me.sabCd[k] - m.day} 天` : '';
  const tenderOk = !mine && canTakeover(m, G.me, id), tc = !mine ? tenderCost(m, G.me, id) : 0;
  const myHold = m.hold[G.me][id], buyDis = !p.alive || m.float[id] <= 0 || me.cash < price || !me.alive;
  const html = `<button class="x" type="button" data-mx="close" aria-label="关闭">×</button>
   <div class="row" style="gap:14px;margin-bottom:12px"><span style="width:64px;height:64px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 3px ${p.color};flex:none">${face(p)}</span><div><h2>${esc(p.co)}</h2><div class="mut">${esc(p.name)}${p.persona ? ' · ' + PERSONAS[p.persona].tag + '型' : ''}${!p.alive ? ' · 已出局' : ''}</div></div></div>
   <div class="grid2" style="grid-template-columns:repeat(3,1fr)"><div class="cell"><div class="k">公司估值</div><div class="v">${fmt(val)}</div></div><div class="cell"><div class="k">每股股价</div><div class="v">${fmt(price)}</div></div><div class="cell"><div class="k">现金</div><div class="v ${p.cash < 0 ? 'up' : ''}">${fmt(p.cash)}</div></div></div>
   <div class="k" style="margin:12px 0 6px">股权结构（10 股）· 流通 ${m.float[id]} 股</div>
   <div class="shr" style="height:12px">${(() => { const sq = []; m.players.forEach((q, j) => { for (let k = 0; k < m.hold[j][id]; k++) sq.push(q.color); }); return Array.from({ length: SHARES }, (_, k) => `<i style="height:12px;background:${sq[k] || ''}"></i>`).join(''); })()}</div>
   <div class="row" style="flex-wrap:wrap;gap:4px 12px;margin-top:6px;font-size:12px">${holders.map(x => `<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${x.q.color};margin-right:4px"></i>${esc(x.q.id === id ? '自持' : x.q.co)} ${x.n}</span>`).join('') || '<span class="mut">全部在流通</span>'}</div>
   ${m.day < LISTING_DAY ? `<div class="tag" style="margin-top:12px">上市锁定期：第 ${LISTING_DAY} 天开放股票交易（还有 ${LISTING_DAY - m.day} 天）</div>` : ''}
   ${p.alive && me.alive && m.day >= LISTING_DAY ? `<div class="k" style="margin:14px 0 6px">${mine ? '股权防御' : '股权进攻'}</div>
   <div class="opts">
     <button class="opt" type="button" data-sh="1" data-tgt="${id}" ${buyDis ? 'disabled' : ''}><b>${mine ? '回购 1 股' : '买入 1 股'}</b><span class="c">${fmt(price)}</span><span class="e">${mine ? `自持 ${myHold}/5 后免疫收购` : `你持有 ${myHold}/10，满 5 股可要约收购`}</span></button>
     <button class="opt" type="button" data-sh="-1" data-tgt="${id}" ${myHold <= 0 ? 'disabled' : ''}><b>卖出 1 股</b><span class="c">${fmt(price * .95)}</span><span class="e">套现</span></button>
     ${!mine ? `<button class="opt" type="button" data-tender="${id}" ${tenderOk && me.cash >= tc ? '' : 'disabled'} style="${tenderOk ? 'border-color:var(--gold)' : ''}"><b>要约收购</b><span class="c">${fmt(tc)}</span><span class="e">${tenderOk ? '以 1.25 倍股价买下其余股份，吞并全部产业' : m.hold[id][id] >= TAKEOVER ? '对方自持 5 股，已免疫' : `还需持股 ${Math.max(0, TAKEOVER - myHold)} 股`}</span></button>` : ''}
   </div>
   ${!mine ? `<div class="k" style="margin:14px 0 6px">商业手段</div><div class="opts">${optBtn('sab', { k: 'scandal', tgt: id }, '舆论危机', fmt(SAB.scandal.cost), cd('scandal') || '股价 -20%，收购更便宜', me.cash < SAB.scandal.cost || cd('scandal'), 1)}${optBtn('sab', { k: 'poach', tgt: id }, '挖走库存', fmt(SAB.poach.cost), cd('poach') || '偷走最值钱库存的 25%', me.cash < SAB.poach.cost || cd('poach'), 1)}</div>` : ''}` : ''}
   <canvas id="coChart" width="900" height="200" style="width:100%;height:100px;margin-top:14px"></canvas>`;
  if (keep && $('#modal .modal')) { $('#modal .modal').innerHTML = html; } else modal(html, '');
  const cv = $('#coChart'); if (cv) { const x = cv.getContext('2d'); m.players.forEach(q => { const d = q.stats.hist; if (d.length < 2) return; const mx = Math.max(...m.players.flatMap(z => z.stats.hist), 1); x.strokeStyle = q.color; x.lineWidth = q.id === id ? 5 : 2; x.globalAlpha = q.id === id ? 1 : .45; x.beginPath(); d.forEach((v, i) => { const X = i / Math.max(1, m.len / 5) * 900, Y = 196 - v / mx * 190; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); }); x.globalAlpha = 1; }
}
function matchMenu() {
  modal(`<button class="x" type="button" data-mx="close" aria-label="关闭">×</button><h2>菜单</h2><p class="mut">空格暂停 · 1/2/3 调速 · R 资源视图 · Esc 取消选择</p>
   <div class="opts" style="grid-template-columns:1fr 1fr"><button class="opt" type="button" data-menu="help"><b>玩法说明</b><span class="e">生产链、市场、收购规则</span></button><button class="opt" type="button" data-menu="mute"><b>${MUTED() ? '打开音效' : '关闭音效'}</b></button><button class="opt danger" type="button" data-menu="quit"><b>${G.role === 'solo' ? '认输并返回办公室' : '退出联机对局'}</b><span class="e">${G.role === 'solo' ? '本局按最后一名结算' : ''}</span></button></div>`);
}
function menuAct(k) {
  if (k === 'mute') { toggleMute(); closeModal(); return; }
  if (k === 'help') { helpModal(); return; }
  if (k === 'quit') { closeModal(); quitMatch(); return; }
}
function helpModal() {
  modal(`<button class="x" type="button" data-mx="close" aria-label="关闭">×</button><h2>怎么玩</h2>
  <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;font-size:13px;line-height:1.7">
   <div><b class="gold">目标</b>　在限定天数内让公司估值最高，或者把对手全部收购。</div>
   <div><b class="gold">占地建厂</b>　总部周围几格内可以占地，地块许可有限，升级总部能拿到更多。农场、油井、矿场只能建在对应资源上，星级越高产量越大。</div>
   <div><b class="gold">生产链</b>　${ri('oil', 1)}原油 → 电厂 → ${ri('power', 1)}电力；${ri('ore', 1)}矿石+电力 → 钢厂 → ${ri('steel', 1)}钢材；${ri('food', 1)}粮食+电力 → 食品厂 → ${ri('goods', 1)}食品；矿石+电力 → 芯片厂 → ${ri('chip', 1)}芯片。缺的原料会自动从市场买。</div>
   <div><b class="gold">共享市场</b>　所有公司在同一个市场买卖。你大量卖出会压低价格，别人也一样。大家都在产的东西会越来越便宜，抢先做稀缺的才赚钱。「囤」可以先存着等涨价。</div>
   <div><b class="gold">股权收购</b>　每家公司 10 股。买入对手股票，持有 5 股就能发起要约收购：按 1.25 倍股价买下剩余股份，吞并对方全部地块、建筑和库存。自持 5 股的公司免疫收购。</div>
   <div><b class="gold">商业手段</b>　罢工、工商检查让对手工厂停工；舆论危机压低对方股价；囤积和倾销操纵价格；安保合同挡下一次攻击。</div>
   <div><b class="gold">拍卖与事件</b>　不时有富矿或地铁上盖地块拍卖，不占许可、不限距离。限电、台风、出口管制等事件会改变供需，传闻会提前一周出现。</div>
  </div>`, 'wide');
}
function quitMatch() {
  const m = G.m; if (!m) return;
  if (G.role !== 'solo' && G.net) G.net.leave();
  if (!m.over) { m.players[G.me].alive = false; m.players[G.me].outDay = m.day; if (G.role === 'solo') finish(m); }
  clearInterval(G.timer); G.ended = true; showResults(true);
}
function showResults(quit) {
  const m = G.m; if (!m) return; clearInterval(G.timer);
  const me = m.players[G.me], rows = m.players.slice().sort((a, b) => a.rank - b.rank);
  const reward = G.onEnd ? G.onEnd(m, G.me, quit) : null;
  snd(me.rank === 1 ? 'win' : 'lose');
  modal(`<div style="text-align:center;margin-bottom:10px"><div class="k" style="letter-spacing:.3em">${me.rank === 1 ? 'VICTORY' : 'RESULT'}</div><h2 style="font-size:30px">${me.rank === 1 ? '你赢下了这场商战' : !me.alive && me.takenBy != null ? `被 ${esc(m.players[me.takenBy].co)} 收购` : `第 ${me.rank} 名`}</h2></div>
   ${rows.map(p => `<div class="res-row ${p.rank === 1 ? 'win' : ''} ${p.id === G.me ? 'me' : ''}"><span class="rk">${p.rank}</span><span class="pt" style="box-shadow:0 0 0 2px ${p.color}">${face(p)}</span><div><b>${esc(p.co)}</b><div class="k">${esc(p.name)}${!p.alive ? (p.takenBy != null ? ' · 被收购' : ' · 出局') : ''}</div></div><span class="n" style="font-size:18px">${p.alive ? fmt(p.final || valuation(m, p.id)) : '—'}</span></div>`).join('')}
   ${reward ? `<div class="grid2" style="margin-top:14px"><div class="cell"><div class="k">个人财富</div><div class="v gold">+${fmt(reward.wealth)}</div></div><div class="cell"><div class="k">经验</div><div class="v">+${reward.xp}${reward.lvUp ? ` · 升至 Lv${reward.lvUp}` : ''}</div></div></div>` : ''}
   <div class="row" style="justify-content:center;margin-top:16px"><button class="btn" type="button" data-mx="home">返回办公室</button>${G.role === 'solo' ? '<button class="btn pri" type="button" data-mx="again">再来一局</button>' : ''}</div>`, '');
  G.onModal = d => { if (d.mx === 'home') { closeModal(); goHome(); } if (d.mx === 'again') { closeModal(); quickRematch(); } };
}
addEventListener('keydown', e => {
  if (!G.m || $('#hud').hidden || e.target.tagName === 'INPUT') return;
  if (e.key === ' ') { e.preventDefault(); if (G.role === 'solo') { G.speed = G.speed ? 0 : 1; hudUpdate(true); } }
  if (e.key === '1' || e.key === '2' || e.key === '3') { if (G.role !== 'client') { G.speed = { 1: 1, 2: 2, 3: 4 }[e.key]; hudUpdate(true); } }
  if (e.key === 'r' || e.key === 'R') { R.resView = !R.resView; R.hl = R.resView ? claimableSet() : null; R.hlCol = '#f3d27c'; }
  if (e.key === 'Escape') { if ($('#modal').innerHTML) closeModal(); else { G.sel = null; R.sel = null; renderAct(true); } }
});
