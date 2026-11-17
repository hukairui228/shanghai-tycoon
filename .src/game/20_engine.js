// ===================== ENGINE =====================
// 纯逻辑：不碰 DOM。对局状态 m 由 newMatch 创建，step(m) 推进一天，act(m,pid,cmd) 执行玩家指令。
const MAP_W = 22, MAP_H = 22;

function genMap(seed) {
  const rng = mulberry32(seed);
  const T = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) T.push({ x, y, t: 'land', res: null, r: 0, port: false, owner: -1, b: null, deco: rng() });
  const at = (x, y) => (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) ? T[y * MAP_W + x] : null;
  // 东海：东侧三列，海岸线带一点起伏
  for (let y = 0; y < MAP_H; y++) { const edge = MAP_W - 3 - (Math.sin(y / 3.1 + seed % 7) > .55 ? 1 : 0); for (let x = edge; x < MAP_W; x++) at(x, y).t = 'sea'; }
  // 黄浦江：自西南蜿蜒向东北入海
  let rx = 6 + Math.floor(rng() * 3);
  for (let y = MAP_H - 1; y >= 0; y--) {
    const c = at(rx, y); if (c && c.t !== 'sea') c.t = 'water';
    if (y < 7 && rx < MAP_W - 4) { rx++; const c2 = at(rx, y); if (c2 && c2.t !== 'sea') c2.t = 'water'; }
    else if (rng() < .45) { rx += rng() < .7 ? 1 : -1; rx = clamp(rx, 5, MAP_W - 5); const c2 = at(rx, y); if (c2 && c2.t !== 'sea') c2.t = 'water'; }
  }
  // 城区：江边一片
  const ucx = 11 + Math.floor(rng() * 2), ucy = 9 + Math.floor(rng() * 2);
  for (const c of T) if (c.t === 'land' && Math.hypot(c.x - ucx, c.y - ucy) < 3.3) c.t = 'urban';
  // 地标：东方明珠，不可占
  const lm = T.filter(c => c.t === 'urban').sort((a, b) => Math.hypot(a.x - ucx - 1, a.y - ucy) - Math.hypot(b.x - ucx - 1, b.y - ucy))[0];
  if (lm) { lm.t = 'landmark'; }
  // 资源簇
  const clusters = [];
  const addC = (res, n, xr, yr) => { for (let i = 0; i < n; i++) clusters.push({ res, x: xr[0] + rng() * (xr[1] - xr[0]), y: yr[0] + rng() * (yr[1] - yr[0]), s: 1.6 + rng() * 1.6 }); };
  addC('food', 5, [0, 9], [3, 21]);
  addC('ore', 4, [2, 18], [0, 7]);
  addC('oil', 3, [8, 18], [14, 21]);
  addC('oil', 1, [12, 18], [2, 10]);
  addC('food', 1, [12, 18], [12, 18]);
  addC('ore', 1, [0, 6], [14, 21]);
  for (const c of T) {
    if (c.t !== 'land') continue;
    let best = null, bd = 9;
    for (const k of clusters) { const d = Math.hypot(c.x - k.x, c.y - k.y) / k.s; if (d < bd) { bd = d; best = k; } }
    if (best && bd < 1.35) { c.res = best.res; c.r = bd < .45 ? 3 : bd < .9 ? 2 : 1; }
  }
  for (const c of T) if (c.t === 'land' || c.t === 'urban') {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = at(c.x + dx, c.y + dy); if (n && n.t === 'sea') c.port = true; }
  }
  return T;
}

function newMatch(opts) {
  const seed = opts.seed >>> 0 || (Math.random() * 2 ** 31) >>> 0;
  const m = {
    v: 1, seed, day: 0, len: opts.len || MATCH_LEN.std, phase: 'setup', diff: opts.diff || 'normal',
    tiles: genMap(seed), players: [], mkt: {}, float: [], hold: [],
    fx: [], log: [], says: [], logN: 0, auction: null, nextAuction: 70, nextEvent: 55, pendingEvent: null,
    winner: -1, over: false, rngState: seed ^ 0x9e3779b9,
  };
  for (const r of RK) m.mkt[r] = { p: RES[r].base, t: RES[r].base, h: [RES[r].base] };
  opts.players.forEach((pl, i) => {
    m.players.push({
      id: i, name: pl.name, co: pl.co, color: PLAYER_COLORS[i], ai: !!pl.ai, persona: pl.persona || null, human: !pl.ai, uid: pl.uid || null,
      cash: opts.startCash || 2500, inv: Object.fromEntries(RK.map(r => [r, 0])), mode: Object.fromEntries(RK.map(r => [r, 'sell'])),
      autobuy: true, hq: null, hql: 1, alive: true, sabCd: {}, guard: 0, scandal: null, debtDays: 0,
      stats: { sold: 0, bought: 0, sabUsed: 0, sabHit: 0, hist: [] }, rank: 0, aiT: i,
    });
  });
  m.float = m.players.map(() => SHARES);
  m.hold = m.players.map(() => m.players.map(() => 0));
  return m;
}
function mrng(m) { m.rngState = (m.rngState * 1664525 + 1013904223) >>> 0; return m.rngState / 4294967296; }
const tileAt = (m, x, y) => (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) ? m.tiles[y * MAP_W + x] : null;
function log(m, txt, k, pid) { m.log.push({ d: m.day, txt, k: k || '', pid: pid == null ? -1 : pid, n: ++m.logN }); if (m.log.length > 120) m.log.shift(); }
function aiSayMaybe(m, pid, key, prob) { const p = m.players[pid]; if (mrng(m) > prob) return; if (p.lastSay && m.day - p.lastSay < 22) return; p.lastSay = m.day; say(m, pid, key); }
function say(m, pid, key) {
  const p = m.players[pid]; if (!p.persona) return;
  const L = PERSONAS[p.persona].lines[key]; if (!L) return;
  const txt = L[Math.floor(mrng(m) * L.length)];
  m.says.push({ d: m.day, pid, txt, n: ++m.logN }); if (m.says.length > 40) m.says.shift();
}

// ---------- 查询 ----------
function ownedTiles(m, pid) { return m.tiles.filter(t => t.owner === pid); }
function claimsUsed(m, pid) { let n = 0; for (const t of m.tiles) if (t.owner === pid && !t.bonus) n++; return n; }
function claimLimit(m, pid) { const p = m.players[pid]; return HQ_LV[p.hql].claims + (p.extraClaims || 0); }
function centers(m, pid) { return m.tiles.filter(t => t.owner === pid && t.b && (t.b.k === 'hq' || t.b.k === 'branch')); }
function inRange(m, pid, x, y) { const R = HQ_LV[m.players[pid].hql].radius; return centers(m, pid).some(c => cheb(c.x, c.y, x, y) <= R); }
const isBuildable = t => t && (t.t === 'land' || t.t === 'urban');
function canClaim(m, pid, x, y) {
  const t = tileAt(m, x, y), p = m.players[pid];
  if (m.phase !== 'play' || !p.alive) return '对局未开始';
  if (!isBuildable(t)) return '此地块不可占用';
  if (t.owner !== -1) return '已被占用';
  if (m.auction && m.auction.x === x && m.auction.y === y) return '正在拍卖';
  if (!inRange(m, pid, x, y)) return '超出总部辐射范围';
  if (claimsUsed(m, pid) >= claimLimit(m, pid)) return '地块许可已用完，升级总部可增加';
  return '';
}
function canBuild(m, pid, x, y, k) {
  const t = tileAt(m, x, y), p = m.players[pid], B = BLD[k];
  if (!t || t.owner !== pid) return '不是你的地块';
  if (t.b) return '地块上已有建筑';
  if (B.need && t.res !== B.need) return '需要' + RES[B.need].n + '资源地块';
  if (B.port && !t.port) return '只能建在临海地块';
  if (k === 'port' && ownedTiles(m, pid).filter(q => q.b && q.b.k === 'port').length >= 2) return '最多两座码头';
  if (B.need && t.t === 'urban') return '城区没有矿产资源';
  if (p.cash < B.cost) return '现金不足';
  return '';
}
function eff(m, t) {
  const B = BLD[t.b.k]; let e = LVM[t.b.lv];
  if (B.need) { e *= RICH[t.r]; for (const f of m.fx) if (f.raw) e *= f.raw; }
  else if (t.t === 'urban') e *= 1.15;
  if (t.metro) e *= 1.3;
  return e;
}
function portBonus(m, pid) {
  if (m.fx.some(f => f.port)) return 0;
  return Math.min(2, ownedTiles(m, pid).filter(t => t.b && t.b.k === 'port' && !t.b.prog && !t.b.idle).length) * PORT_BONUS;
}
function depth(m, r) { return RES[r].depth * (1 + m.day / 380); }
function bookValue(t) { if (!t.b) return 0; const B = BLD[t.b.k]; if (t.b.k === 'hq' || t.b.k === 'branch') return 0; return B.cost * (1 + (t.b.lv - 1) * 1.2) * .7; }
function hqValue(m, pid) { let v = 0; for (let l = 2; l <= m.players[pid].hql; l++) v += HQ_LV[l].cash * .7 + HQ_LV[l].steel * RES.steel.base * .7; return v; }
function baseVal(m, pid) {
  const p = m.players[pid]; let v = p.cash + hqValue(m, pid);
  for (const r of RK) v += p.inv[r] * m.mkt[r].p * .85;
  for (const t of m.tiles) if (t.owner === pid) v += bookValue(t) + 150;
  return v;
}
function sharePrice(m, pid) {
  const p = m.players[pid];
  let price = Math.max(60, baseVal(m, pid) / SHARES) * (1 + .07 * (SHARES - m.float[pid]));
  if (p.scandal) price *= p.scandal.m;
  for (const f of m.fx) if (f.share) price *= f.share;
  return price;
}
function valuation(m, pid) {
  let v = baseVal(m, pid);
  m.players.forEach((q, j) => { if (j !== pid && q.alive) v += m.hold[pid][j] * sharePrice(m, j); });
  return v;
}
function debtLimit(m, pid) { return Math.max(800, baseVal(m, pid) * .3 + 600); }
function flows(m, pid) { // 每日净产出（估算）
  const f = Object.fromEntries(RK.map(r => [r, 0]));
  for (const t of m.tiles) if (t.owner === pid && t.b && BLD[t.b.k].out && !t.b.prog && !t.b.idle) {
    const B = BLD[t.b.k], e = eff(m, t);
    for (const r in B.out) f[r] += B.out[r] * e;
    if (B.in) for (const r in B.in) f[r] -= B.in[r] * e;
  }
  return f;
}
function needs(m, pid) { const n = Object.fromEntries(RK.map(r => [r, 0])); for (const t of m.tiles) if (t.owner === pid && t.b && BLD[t.b.k].in && !t.b.prog) { const B = BLD[t.b.k], e = eff(m, t); for (const r in B.in) n[r] += B.in[r] * e; } return n; }

// ---------- 市场 ----------
function mSell(m, pid, r, q) {
  const p = m.players[pid], k = m.mkt[r]; q = Math.min(q, p.inv[r]); if (q <= 0) return 0;
  const d = depth(m, r), avg = k.p * Math.max(.3, 1 - q / d / 2), gross = avg * q * (1 + portBonus(m, pid));
  k.p = Math.max(RES[r].base * .15, k.p * Math.max(.4, 1 - q / d));
  p.inv[r] -= q; p.cash += gross; p.stats.sold += gross; return gross;
}
function mBuy(m, pid, r, q, force) {
  const p = m.players[pid], k = m.mkt[r]; if (q <= 0) return 0;
  const d = depth(m, r), avg = k.p * (1 + q / d / 2), cost = avg * q;
  if (!force && p.cash - cost < -debtLimit(m, pid)) return 0;
  k.p = Math.min(RES[r].base * 6, k.p * (1 + q / d));
  p.inv[r] += q; p.cash -= cost; p.stats.bought += cost; return cost;
}
const quoteSell = (m, pid, r, q) => { const k = m.mkt[r], d = depth(m, r); return k.p * Math.max(.3, 1 - q / d / 2) * q * (1 + portBonus(m, pid)); };
const quoteBuy = (m, r, q) => { const k = m.mkt[r], d = depth(m, r); return k.p * (1 + q / d / 2) * q; };

// ---------- 指令 ----------
function act(m, pid, c) {
  const p = m.players[pid];
  if (!p || (!p.alive && c.t !== 'chat')) return { ok: false, msg: '你已出局' };
  if (m.over) return { ok: false, msg: '对局已结束' };
  const T = c.x != null ? tileAt(m, c.x, c.y) : null;
  switch (c.t) {
    case 'hq': {
      if (p.hq) return { ok: false, msg: '总部已选址' };
      if (!isBuildable(T) || T.owner !== -1) return { ok: false, msg: '这里不能设总部' };
      if (m.players.some(q => q.hq && cheb(q.hq.x, q.hq.y, c.x, c.y) < 5)) return { ok: false, msg: '离其他公司总部太近' };
      T.owner = pid; T.b = { k: 'hq', lv: 1, prog: 0, idle: 0 }; T.bonus = true; p.hq = { x: c.x, y: c.y };
      log(m, `${p.co} 将总部设在 (${c.x},${c.y})`, 'sys', pid);
      if (m.players.every(q => q.hq)) startPlay(m);
      return { ok: true };
    }
    case 'claim': {
      const why = canClaim(m, pid, c.x, c.y); if (why) return { ok: false, msg: why };
      T.owner = pid; return { ok: true };
    }
    case 'build': {
      const why = canBuild(m, pid, c.x, c.y, c.k); if (why) return { ok: false, msg: why };
      p.cash -= BLD[c.k].cost; T.b = { k: c.k, lv: 1, prog: 6, idle: 0 }; return { ok: true };
    }
    case 'upgrade': {
      if (!T || T.owner !== pid || !T.b || T.b.k === 'hq' || T.b.k === 'branch' || T.b.k === 'port') return { ok: false, msg: '不能升级' };
      if (T.b.prog) return { ok: false, msg: '施工中' };
      if (T.b.lv >= 3) return { ok: false, msg: '已满级' };
      const cost = upCost(T), st = upSteel(T);
      if (p.cash < cost) return { ok: false, msg: '现金不足' };
      if (p.inv.steel < st && !mBuyFor(m, pid, 'steel', st - p.inv.steel)) return { ok: false, msg: `需要钢材 ${st}` };
      p.cash -= cost; p.inv.steel -= st; T.b.lv++; T.b.prog = 5; return { ok: true };
    }
    case 'sellb': {
      if (!T || T.owner !== pid || !T.b || T.b.k === 'hq' || T.b.k === 'branch') return { ok: false, msg: '不能拆除' };
      p.cash += bookValue(T) * .7; T.b = null; return { ok: true };
    }
    case 'release': {
      if (!T || T.owner !== pid || T.b) return { ok: false, msg: '先拆除建筑' };
      T.owner = -1; T.bonus = false; return { ok: true };
    }
    case 'hqup': {
      const nx = HQ_LV[p.hql + 1]; if (!nx) return { ok: false, msg: '总部已满级' };
      if (p.cash < nx.cash) return { ok: false, msg: '现金不足' };
      if (p.inv.steel < nx.steel && !mBuyFor(m, pid, 'steel', nx.steel - p.inv.steel)) return { ok: false, msg: `需要钢材 ${nx.steel}` };
      p.cash -= nx.cash; p.inv.steel -= nx.steel; p.hql++;
      log(m, `${p.co} 总部升至 ${p.hql} 级`, 'sys', pid); return { ok: true };
    }
    case 'trade': {
      const q = Math.floor(Math.abs(c.q)); if (!RES[c.r] || !q) return { ok: false, msg: '数量无效' };
      if (c.q > 0) { const cost = mBuy(m, pid, c.r, q); return cost ? { ok: true, v: cost } : { ok: false, msg: '资金不足' }; }
      const got = mSell(m, pid, c.r, q); return got ? { ok: true, v: got } : { ok: false, msg: '库存不足' };
    }
    case 'mode': { if (!RES[c.r]) return { ok: false }; p.mode[c.r] = c.m === 'hold' ? 'hold' : 'sell'; return { ok: true }; }
    case 'autobuy': { p.autobuy = !!c.on; return { ok: true }; }
    case 'share': return shareAct(m, pid, c.tgt, c.q);
    case 'tender': return tenderAct(m, pid, c.tgt);
    case 'sab': return sabAct(m, pid, c);
    case 'bid': {
      const a = m.auction; if (!a) return { ok: false, msg: '没有进行中的拍卖' };
      const amt = Math.round(c.amt); if (amt < minBid(a)) return { ok: false, msg: '出价太低' };
      if (p.cash < amt) return { ok: false, msg: '现金不足' };
      if (a.by === pid) return { ok: false, msg: '你已是最高价' };
      a.best = amt; a.by = pid; a.ends = Math.max(a.ends, m.day + 3); a.bids.push({ pid, amt });
      return { ok: true };
    }
    case 'chat': { m.says.push({ d: m.day, pid, txt: String(c.text || '').slice(0, 80), n: ++m.logN, chat: true }); return { ok: true }; }
  }
  return { ok: false, msg: '未知指令' };
}
const upCost = t => Math.round(BLD[t.b.k].cost * (t.b.lv === 1 ? 1.1 : 1.8));
const upSteel = t => t.b.lv === 1 ? 10 : 30;
const minBid = a => a.best ? Math.ceil(a.best * 1.08 / 10) * 10 : a.start;
function mBuyFor(m, pid, r, q) { return mBuy(m, pid, r, Math.ceil(q)) > 0; }

function shareAct(m, pid, tgt, q) {
  const p = m.players[pid], T = m.players[tgt];
  if (!T || !T.alive) return { ok: false, msg: '目标已出局' };
  if (m.day < LISTING_DAY) return { ok: false, msg: `第 ${LISTING_DAY} 天各公司上市后才能交易股票` };
  const price = sharePrice(m, tgt);
  if (q > 0) {
    if (m.float[tgt] <= 0) return { ok: false, msg: '流通股已售罄' };
    if (p.cash < price) return { ok: false, msg: '现金不足' };
    p.cash -= price; m.hold[pid][tgt]++; m.float[tgt]--;
    if (pid !== tgt) { log(m, `${p.co} 买入 ${T.co} 1 股（持有 ${m.hold[pid][tgt]}/${SHARES}）`, 'share', pid); if (p.persona) aiSayMaybe(m, pid, 'share', .5); }
    else log(m, `${p.co} 回购自家股票（${m.hold[pid][pid]}/${SHARES}）`, 'share', pid);
    return { ok: true };
  }
  if (m.hold[pid][tgt] <= 0) return { ok: false, msg: '没有持股' };
  m.hold[pid][tgt]--; m.float[tgt]++; p.cash += price * .95; return { ok: true };
}
// 要约收购：持股 ≥5 且对方自持 <5 时，按 1.25 倍股价买下其余全部股份（含流通股）
function tenderCost(m, acq, tgt) { return (SHARES - m.hold[acq][tgt]) * sharePrice(m, tgt) * TENDER; }
function canTakeover(m, acq, tgt) { return acq !== tgt && m.players[tgt].alive && m.hold[acq][tgt] >= TAKEOVER && m.hold[tgt][tgt] < TAKEOVER; }
function tenderAct(m, acq, tgt) {
  if (m.day < LISTING_DAY) return { ok: false, msg: `第 ${LISTING_DAY} 天上市后才能收购` };
  if (!canTakeover(m, acq, tgt)) return { ok: false, msg: `需持股 ${TAKEOVER} 股，且对方自持少于 ${TAKEOVER} 股` };
  const price = sharePrice(m, tgt) * TENDER, cost = tenderCost(m, acq, tgt), A = m.players[acq];
  if (A.cash < cost) return { ok: false, msg: `要约收购需要 ${fmt(cost)}` };
  takeover(m, acq, tgt, price); return { ok: true, takeover: true };
}
function takeover(m, acq, tgt, price) {
  const A = m.players[acq], T = m.players[tgt];
  A.cash -= m.float[tgt] * price;
  m.players.forEach((q, j) => { if (j !== acq && m.hold[j][tgt] > 0) { const pay = m.hold[j][tgt] * price; A.cash -= pay; if (j !== tgt) q.cash += pay; m.hold[j][tgt] = 0; } });
  for (const t of m.tiles) if (t.owner === tgt) { t.owner = acq; t.bonus = true; if (t.b && t.b.k === 'hq') t.b.k = 'branch'; }
  A.cash += T.cash; for (const r of RK) A.inv[r] += T.inv[r];
  m.players.forEach((q, j) => { if (j !== tgt) { m.hold[acq][j] += m.hold[tgt][j]; } m.hold[tgt][j] = 0; });
  m.hold[acq][tgt] = 0; m.float[tgt] = 0;
  T.alive = false; T.cash = 0; for (const r of RK) T.inv[r] = 0; T.takenBy = acq; T.outDay = m.day;
  log(m, `${A.co} 完成对 ${T.co} 的恶意收购！`, 'takeover', acq);
  say(m, acq, 'takeover'); say(m, tgt, 'lose');
  checkEnd(m);
}

function sabAct(m, pid, c) {
  const S = SAB[c.k], p = m.players[pid]; if (!S) return { ok: false, msg: '未知手段' };
  if ((p.sabCd[c.k] || 0) > m.day) return { ok: false, msg: `冷却中，还需 ${p.sabCd[c.k] - m.day} 天` };
  if (p.cash < S.cost) return { ok: false, msg: '现金不足' };
  let target = -1, T = null;
  if (S.tgt === 'bld') { T = tileAt(m, c.x, c.y); if (!T || !T.b || T.owner === pid || T.owner < 0 || T.b.k === 'hq' || T.b.k === 'branch') return { ok: false, msg: '请选择对手的生产建筑' }; target = T.owner; }
  if (S.tgt === 'co') { target = c.tgt; if (target === pid || !m.players[target] || !m.players[target].alive) return { ok: false, msg: '请选择对手公司' }; }
  if (S.tgt === 'res' && !RES[c.r]) return { ok: false, msg: '请选择资源' };
  p.cash -= S.cost; p.sabCd[c.k] = m.day + S.cd; p.stats.sabUsed++;
  if (target >= 0 && m.players[target].guard > 0) {
    m.players[target].guard--; log(m, `${p.co} 对 ${m.players[target].co} 使用「${S.n}」，被安保合同挡下`, 'sab', pid);
    return { ok: true, blocked: true };
  }
  const tp = target >= 0 ? m.players[target] : null;
  switch (c.k) {
    case 'strike': T.b.idle = Math.max(T.b.idle, 30); break;
    case 'audit': T.b.idle = Math.max(T.b.idle, 60); break;
    case 'scandal': tp.scandal = { m: .8, until: m.day + 40 }; break;
    case 'poach': { let best = null, bv = 0; for (const r of RK) { const v = tp.inv[r] * m.mkt[r].p; if (v > bv) { bv = v; best = r; } }
      if (best) { const q = tp.inv[best] * .25; tp.inv[best] -= q; p.inv[best] += q; c.r = best; c.q = q; } break; }
    case 'corner': m.mkt[c.r].p *= 1.35; break;
    case 'dump': m.mkt[c.r].p *= .7; break;
    case 'guard': p.guard = Math.min(2, p.guard + 1); break;
  }
  if (tp) tp.stats.sabHit++;
  const what = c.k === 'corner' || c.k === 'dump' ? `${RES[c.r].n}` : tp ? tp.co + (T ? `的${BLD[T.b.k].n}` : '') : '';
  log(m, `${p.co} 使用「${S.n}」${what ? ' → ' + what : ''}${c.k === 'poach' && c.q ? `，挖走${RES[c.r].n} ${fmtN(c.q)}` : ''}`, 'sab', pid);
  if (p.persona && c.k !== 'guard') say(m, pid, 'sab');
  if (tp && tp.persona && mrng(m) < .6) say(m, target, 'hurt');
  return { ok: true };
}

// ---------- 推进 ----------
function startPlay(m) {
  m.phase = 'play';
  for (const p of m.players) { // 总部周边的免费起始地块：总部本身
    if (p.persona) say(m, p.id, 'start');
  }
  log(m, `商战开始。第 ${LISTING_DAY} 天各公司上市，之后才能买卖股票、发起收购。`, 'sys');
}
function step(m) {
  if (m.phase !== 'play' || m.over) return;
  m.day++;
  // 事件
  m.fx = m.fx.filter(f => f.until > m.day);
  if (m.pendingEvent && m.day >= m.pendingEvent.at) { const E = m.pendingEvent.e; m.fx.push({ ...E, until: m.day + E.days }); log(m, `【${E.n}】${E.d}`, 'event'); m.pendingEvent = null; }
  if (m.day >= m.nextEvent) {
    const E = EVENTS[Math.floor(mrng(m) * EVENTS.length)];
    m.pendingEvent = { e: E, at: m.day + 8 }; m.nextEvent = m.day + 70 + Math.floor(mrng(m) * 45);
    log(m, `传闻：${E.n}可能在一周后到来`, 'rumor');
  }
  for (const p of m.players) if (p.scandal && p.scandal.until <= m.day) p.scandal = null;
  // 生产
  for (const t of m.tiles) {
    if (t.owner < 0 || !t.b) continue;
    const b = t.b, p = m.players[t.owner]; if (!p.alive) continue;
    if (b.prog > 0) { b.prog--; continue; }
    if (b.idle > 0) { b.idle--; continue; }
    const B = BLD[b.k]; if (!B.out) continue;
    if (m.fx.some(f => f.port) && t.port && b.k !== 'farm') { b.stall = 'typhoon'; continue; }
    const e = eff(m, t); let ok = true;
    if (B.in) for (const r in B.in) {
      const need = B.in[r] * e;
      if (p.inv[r] < need) { if (p.autobuy) mBuy(m, t.owner, r, need - p.inv[r] + .001); if (p.inv[r] < need) ok = false; }
    }
    if (!ok) { b.stall = 'input'; continue; }
    b.stall = null;
    if (B.in) for (const r in B.in) p.inv[r] -= B.in[r] * e;
    for (const r in B.out) p.inv[r] += B.out[r] * e;
  }
  // 自动卖出（顺序轮换，避免总是同一家先卖）
  const order = m.players.map(p => p.id).sort((a, b) => ((a + m.day) % 4) - ((b + m.day) % 4));
  for (const id of order) {
    const p = m.players[id]; if (!p.alive) continue;
    const nd = needs(m, id);
    for (const r of RK) if (p.mode[r] === 'sell') { const keep = nd[r] * 3; const q = p.inv[r] - keep; if (q >= 1) mSell(m, id, r, Math.floor(q)); }
  }
  // 利息与破产
  const rate = m.fx.reduce((a, f) => a * (f.rate || 1), 1);
  for (const p of m.players) {
    if (!p.alive) continue;
    if (p.cash < 0) { p.cash -= -p.cash * .0022 * rate; if (p.cash < -debtLimit(m, p.id) * 1.15) p.debtDays++; else p.debtDays = Math.max(0, p.debtDays - 1); }
    else p.debtDays = 0;
    if (p.debtDays > 25) bankrupt(m, p.id);
  }
  // 市场回归
  for (const r of RK) {
    const k = m.mkt[r]; let mult = 1; for (const f of m.fx) if (f.eff && f.eff[r]) mult *= f.eff[r];
    k.t = RES[r].base * mult;
    k.p += (k.t - k.p) * .07 + k.p * (mrng(m) - .5) * .03;
    k.p = clamp(k.p, RES[r].base * .15, RES[r].base * 6);
    k.h.push(+k.p.toFixed(2)); if (k.h.length > 90) k.h.shift();
  }
  if (m.day === LISTING_DAY) log(m, '各公司今日上市，股票交易与收购开放', 'event');
  // 拍卖
  auctionStep(m);
  // 记录
  if (m.day % 5 === 0) for (const p of m.players) p.stats.hist.push(p.alive ? Math.round(valuation(m, p.id)) : 0);
  if (m.day >= m.len) finish(m);
}
function auctionStep(m) {
  const a = m.auction;
  if (a && m.day >= a.ends) {
    const t = tileAt(m, a.x, a.y);
    if (a.by >= 0 && m.players[a.by].alive && t.owner === -1) {
      const p = m.players[a.by]; p.cash -= a.best; t.owner = a.by; t.bonus = true;
      log(m, `${p.co} 以 ${fmt(a.best)} 拍得${t.metro ? '地铁上盖地块' : RES[t.res] ? RES[t.res].n + '富矿地块' : '黄金地块'}`, 'auction', a.by);
      for (const b of a.bids) if (b.pid !== a.by && m.players[b.pid].persona) { say(m, b.pid, 'outbid'); break; }
    } else log(m, '地块流拍', 'auction');
    m.auction = null; m.nextAuction = m.day + 85 + Math.floor(mrng(m) * 40);
  }
  if (!m.auction && m.day >= m.nextAuction) {
    const cands = m.tiles.filter(t => isBuildable(t) && t.owner === -1 && ((t.r === 3) || t.t === 'urban'));
    if (!cands.length) { m.nextAuction = m.day + 60; return; }
    const t = cands[Math.floor(mrng(m) * cands.length)];
    if (t.t === 'urban' && !t.metro) t.metro = true;
    const start = Math.round((600 + m.day * 6) / 10) * 10;
    m.auction = { x: t.x, y: t.y, start, best: 0, by: -1, ends: m.day + 14, bids: [] };
    log(m, `土地拍卖开始：${t.metro ? '地铁上盖地块（加工 +30%）' : RES[t.res].n + '三星富矿'}，起拍 ${fmt(start)}，不占许可、不限距离`, 'auction');
  }
}
function bankrupt(m, pid) {
  const p = m.players[pid]; p.alive = false; p.outDay = m.day;
  for (const t of m.tiles) if (t.owner === pid) { t.owner = -1; t.b = null; t.bonus = false; }
  m.players.forEach((q, j) => { m.hold[j][pid] = 0; }); m.float[pid] = 0;
  log(m, `${p.co} 资不抵债，宣告破产`, 'takeover', pid); say(m, pid, 'lose'); checkEnd(m);
}
function checkEnd(m) {
  const alive = m.players.filter(p => p.alive);
  if (alive.length <= 1) finish(m);
  else if (m.players.filter(p => p.human).length && m.players.filter(p => p.human && p.alive).length === 0) finish(m);
}
function finish(m) {
  if (m.over) return;
  m.over = true; m.phase = 'over';
  const rank = m.players.map(p => ({ id: p.id, v: p.alive ? valuation(m, p.id) : -1e12 + (p.outDay || 0) })).sort((a, b) => b.v - a.v);
  rank.forEach((r, i) => { m.players[r.id].rank = i + 1; m.players[r.id].final = r.v > 0 ? r.v : 0; });
  m.winner = rank[0].id;
  log(m, `商战结束，${m.players[m.winner].co} 胜出`, 'sys', m.winner);
  if (m.players[m.winner].persona) say(m, m.winner, 'win');
}
