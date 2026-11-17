// ===================== AI =====================
const DIFF = { easy: { eco: .8, agg: .55, think: 3 }, normal: { eco: 1, agg: 1, think: 2 }, hard: { eco: 1.15, agg: 1.35, think: 1 } };
const refPrice = (m, r) => m.mkt[r].p * .55 + RES[r].base * .45;
function bProfit(m, t, k, lv) { // 估算某地块建某建筑的每日利润
  const B = BLD[k]; if (!B.out) return 0;
  const fake = { ...t, b: { k, lv: lv || 1 } }; const e = eff(m, fake);
  let v = 0; for (const r in B.out) v += B.out[r] * e * refPrice(m, r);
  if (B.in) for (const r in B.in) v -= B.in[r] * e * refPrice(m, r) * 1.04;
  return v;
}
function crowd(m, k) { let n = 0; for (const t of m.tiles) if (t.b && t.b.k === k) n++; return n; }
function aiSay(m, pid, key, prob) { const p = m.players[pid]; if (mrng(m) > (prob ?? 1)) return; if (p.lastSay && m.day - p.lastSay < 22 && key !== 'takeover' && key !== 'lose') return; p.lastSay = m.day; say(m, pid, key); }

function aiPlaceHQ(m, pid) {
  const others = m.players.filter(q => q.hq);
  let best = null, bs = -1e9;
  for (const t of m.tiles) {
    if (!isBuildable(t) || t.owner !== -1) continue;
    if (others.some(q => cheb(q.hq.x, q.hq.y, t.x, t.y) < 6)) continue;
    let s = 0; const seen = {};
    for (const u of m.tiles) { const d = cheb(u.x, u.y, t.x, t.y); if (d > 4 || !isBuildable(u)) continue; if (u.res) { s += u.r * (u.r === 3 ? 1.6 : 1); seen[u.res] = 1; } if (u.port) s += .4; if (u.t === 'urban') s += .5; }
    s += Object.keys(seen).length * 3 + mrng(m) * 4;
    if (s > bs) { bs = s; best = t; }
  }
  if (best) act(m, pid, { t: 'hq', x: best.x, y: best.y });
}

function aiThink(m, pid) {
  const p = m.players[pid]; if (!p.alive || !p.ai) return;
  const P = PERSONAS[p.persona] || PERSONAS.chen, D = DIFF[m.diff] || DIFF.normal;
  const val = valuation(m, pid);
  const reserve = 250 + val * .06;
  // ---- 防御：回购自家股票 ----
  let threat = 0, threatBy = -1; m.players.forEach((q, j) => { if (j !== pid && q.alive && m.hold[j][pid] > threat) { threat = m.hold[j][pid]; threatBy = j; } });
  const myPrice = sharePrice(m, pid);
  if (threat >= 3 && m.hold[pid][pid] < TAKEOVER && m.float[pid] > 0 && p.cash > myPrice * 1.3 && mrng(m) < (threat >= 4 ? .7 : .3) * (1.2 - P.take * .5)) { act(m, pid, { t: 'share', tgt: pid, q: 1 }); }
  if (threat >= 4 && p.cash > 400 && (p.sabCd.guard || 0) <= m.day && p.guard === 0) act(m, pid, { t: 'sab', k: 'guard' });
  // ---- 经济：建造 / 升级 / 圈地 ----
  const opts = [];
  const used = claimsUsed(m, pid), lim = claimLimit(m, pid);
  for (const t of m.tiles) {
    if (!isBuildable(t)) continue;
    const mine = t.owner === pid;
    if (mine && t.b) {
      if (t.b.k !== 'hq' && t.b.k !== 'branch' && t.b.k !== 'port' && t.b.lv < 3 && !t.b.prog) {
        const gain = bProfit(m, t, t.b.k, t.b.lv + 1) - bProfit(m, t, t.b.k, t.b.lv);
        const c = upCost(t) + upSteel(t) * m.mkt.steel.p;
        if (gain > 0) opts.push({ kind: 'up', t, cost: c, score: gain * 70 / c });
      }
      continue;
    }
    const free = mine && !t.b;
    if (!free && (t.owner !== -1 || used >= lim || !inRange(m, pid, t.x, t.y) || (m.auction && m.auction.x === t.x && m.auction.y === t.y))) continue;
    for (const k of BUILDABLE) {
      const B = BLD[k];
      if (B.need && t.res !== B.need) continue;
      if (B.need && t.t === 'urban') continue;
      if (B.port && !t.port) continue;
      if (k === 'port') { const n = ownedTiles(m, pid).filter(q => q.b && q.b.k === 'port').length; if (n >= 2) continue; const sales = Math.max(300, p.stats.sold / Math.max(1, m.day)); opts.push({ kind: 'build', t, k, cost: B.cost, claim: !free, score: sales * PORT_BONUS * 60 / B.cost * .8 }); continue; }
      let prof = bProfit(m, t, k) * D.eco; if (prof <= 0) continue;
      prof *= 1 - Math.min(.45, crowd(m, k) * .035);
      // 已有对应原料/需求时略加分（垂直整合）
      if (B.in) { const f = flows(m, pid); for (const r in B.in) if (f[r] > 0) prof *= 1.06; }
      let score = prof * 60 / B.cost;
      if (!free) score *= (P.land || 1) * (used < lim - 2 ? 1 : .85);
      opts.push({ kind: 'build', t, k, cost: B.cost, claim: !free, score });
    }
  }
  opts.sort((a, b) => b.score - a.score);
  let acted = 0;
  for (const o of opts) {
    if (acted >= (m.diff === 'hard' ? 2 : 1)) break;
    if (o.score < .55 / D.eco) break;
    if (p.cash < o.cost + reserve) continue;
    if (o.kind === 'up') { if (act(m, pid, { t: 'upgrade', x: o.t.x, y: o.t.y }).ok) acted++; continue; }
    if (o.claim) { const r = act(m, pid, { t: 'claim', x: o.t.x, y: o.t.y }); if (!r.ok) continue; if (m.players.some(q => q.human && m.tiles.some(u => u.owner === q.id && cheb(u.x, u.y, o.t.x, o.t.y) <= 1))) aiSay(m, pid, 'claim', .5); }
    if (act(m, pid, { t: 'build', x: o.t.x, y: o.t.y, k: o.k }).ok) acted++;
  }
  // 圈地型：先占好地
  if (P.land && used < lim - 1 && p.cash > 1500 && mrng(m) < .3) {
    const c = m.tiles.filter(t => t.owner === -1 && t.r >= 2 && isBuildable(t) && inRange(m, pid, t.x, t.y) && !(m.auction && m.auction.x === t.x && m.auction.y === t.y)).sort((a, b) => b.r - a.r)[0];
    if (c) act(m, pid, { t: 'claim', x: c.x, y: c.y });
  }
  // 总部升级
  const nx = HQ_LV[p.hql + 1];
  if (nx && used >= lim - 1 && p.cash > nx.cash + nx.steel * m.mkt.steel.p * 1.2 + reserve) act(m, pid, { t: 'hqup' });
  // ---- 囤货 / 出货 ----
  for (const r of RK) {
    const k = m.mkt[r], ratio = k.p / RES[r].base, held = p.inv[r] * k.p;
    const hoardOk = p.cash > 3000 && held < p.cash * (P.manip ? .5 : .25);
    if (p.mode[r] === 'hold') { if (!hoardOk || ratio > (P.manip ? .95 : .88)) p.mode[r] = 'sell'; }
    else if (hoardOk && ratio < (P.manip ? .62 : .45) && mrng(m) < (P.manip ? 1 : .4)) p.mode[r] = 'hold';
  }
  // ---- 进攻：买对手股票 / 收购 ----
  const rivals = m.players.filter(q => q.alive && q.id !== pid);
  for (const q of rivals) if (canTakeover(m, pid, q.id) && p.cash >= tenderCost(m, pid, q.id) + reserve * .3) { act(m, pid, { t: 'tender', tgt: q.id }); return; }
  const rich = p.cash / Math.max(1, val);
  if (p.prey == null || !m.players[p.prey].alive || m.float[p.prey] === 0 || m.hold[p.prey][p.prey] >= TAKEOVER) {
    const c = rivals.filter(q => m.float[q.id] > 0 && m.hold[q.id][q.id] < TAKEOVER).map(q => ({ q, s: (q.human ? (m.diff === 'easy' ? .5 : m.diff === 'hard' ? 1.3 : 1.05) : 1) * (m.hold[pid][q.id] + 1) / (sharePrice(m, q.id) * (1 + m.hold[q.id][q.id] * .5)) })).sort((a, b) => b.s - a.s)[0];
    p.prey = c ? c.q.id : null;
  }
  if (p.prey != null && m.day >= LISTING_DAY) {
    const pr = sharePrice(m, p.prey);
    for (let n = 0; n < (rich > .35 ? 3 : 1); n++) {
      if (m.float[p.prey] <= 0 || p.cash < pr * 1.3 + reserve || m.hold[pid][p.prey] >= TAKEOVER) break;
      if (mrng(m) < P.take * D.agg * (.55 + rich * 3.2)) act(m, pid, { t: 'share', tgt: p.prey, q: 1 }); else break;
    }
  }
  // 缺钱时卖掉持有的对手股票
  if (p.cash < -debtLimit(m, pid) * .6) for (const q of rivals) if (m.hold[pid][q.id] > 0) { act(m, pid, { t: 'share', tgt: q.id, q: -1 }); break; }
  // ---- 商业手段 ----
  if (m.day > 35 && mrng(m) < P.sab * .055 * D.agg && p.cash > 2600) {
    const lead = rivals.map(q => ({ q, v: valuation(m, q.id) * (q.human ? 1.3 : 1) })).sort((a, b) => b.v - a.v)[0];
    if (lead) {
      const tq = lead.q, ready = k => (p.sabCd[k] || 0) <= m.day && p.cash > SAB[k].cost * 2;
      const blds = m.tiles.filter(t => t.owner === tq.id && t.b && BLD[t.b.k].out && !t.b.idle && !t.b.prog).sort((a, b) => bProfit(m, b, b.b.k, b.b.lv) - bProfit(m, a, a.b.k, a.b.lv));
      const f = flows(m, tq.id); const topRes = RK.slice().sort((a, b) => f[b] * m.mkt[b].p - f[a] * m.mkt[a].p)[0];
      const choices = [];
      if (blds[0] && ready('strike')) choices.push(() => act(m, pid, { t: 'sab', k: 'strike', x: blds[0].x, y: blds[0].y }));
      if (blds[0] && ready('audit') && p.cash > 6000) choices.push(() => act(m, pid, { t: 'sab', k: 'audit', x: blds[0].x, y: blds[0].y }));
      if (m.hold[pid][tq.id] >= 2 && ready('scandal')) { choices.push(() => act(m, pid, { t: 'sab', k: 'scandal', tgt: tq.id })); choices.push(() => act(m, pid, { t: 'sab', k: 'scandal', tgt: tq.id })); }
      if (ready('poach')) choices.push(() => act(m, pid, { t: 'sab', k: 'poach', tgt: tq.id }));
      if (topRes && f[topRes] > 1 && ready('dump') && flows(m, pid)[topRes] <= 0) choices.push(() => act(m, pid, { t: 'sab', k: 'dump', r: topRes }));
      if (P.manip && ready('corner')) { const mine = RK.slice().sort((a, b) => p.inv[b] * m.mkt[b].p - p.inv[a] * m.mkt[a].p)[0]; if (p.inv[mine] * m.mkt[mine].p > 1500) choices.push(() => { act(m, pid, { t: 'sab', k: 'corner', r: mine }); p.mode[mine] = 'sell'; }); }
      if (choices.length) choices[Math.floor(mrng(m) * choices.length)]();
    }
  }
}
function aiBid(m, pid) {
  const a = m.auction, p = m.players[pid]; if (!a || !p.alive || !p.ai || a.by === pid) return;
  const P = PERSONAS[p.persona] || PERSONAS.chen, D = DIFF[m.diff] || DIFF.normal, t = tileAt(m, a.x, a.y);
  let v;
  if (t.metro) v = 1100 + m.day * 9;
  else { const k = { food: 'farm', oil: 'well', ore: 'mine' }[t.res]; v = bProfit(m, { ...t, metro: false }, k) * 110 + 300; }
  const cap = v * P.bid * D.eco * (.85 + mrng(m) * .3);
  const nb = minBid(a);
  if (nb <= cap && p.cash > nb * 1.5 + 400 && mrng(m) < .55) act(m, pid, { t: 'bid', amt: nb });
}
function aiDay(m) { // 每日调用：AI 思考、拍卖竞价
  if (m.phase !== 'play' || m.over) return;
  const D = DIFF[m.diff] || DIFF.normal;
  for (const p of m.players) {
    if (!p.ai || !p.alive) continue;
    if ((m.day + p.id) % D.think === 0) aiThink(m, p.id);
    if (m.auction) aiBid(m, p.id);
  }
}
