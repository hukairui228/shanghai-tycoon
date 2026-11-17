// ===================== 好友联机（房主权威） =====================
// 房主跑模拟和 AI；其他人发指令、收快照。大厅用 room presence 列出开放房间。
let ROOM = null, myPeer = null;
const MP = { stage: 'idle', code: '', nr: null, unsubs: [], peerPid: {}, hostPeer: null, lastTiles: null, logSent: 0, saySent: 0 };
async function initRoom() {
  try {
    const cl = window.claude; if (!cl || !cl.use) return;
    ROOM = await cl.use('room'); if (!ROOM) return;
    ROOM.onPeers(ch => { const me = ch.peers.find(p => p.isMe && p.sameTab); if (me) myPeer = me.peer; if (!G.m && G.hmode === 'mp' && !$('#home').hidden) renderHomeSoon(); });
  } catch (e) { ROOM = null; }
}
let rhT = 0; function renderHomeSoon() { clearTimeout(rhT); rhT = setTimeout(() => { if (!G.m && !$('#modal').innerHTML) renderHome(); }, 150); }
const openRooms = () => ROOM ? ROOM.peers().filter(p => p.presence && p.presence.host && !p.isMe && Date.now() - (p.presence.host.at || 0) < 6 * 3600e3).map(p => ({ peer: p.peer, ...p.presence.host })) : [];
function mpPanel() {
  if (!ROOM) return `<div class="mut" style="line-height:1.7">好友对战需要在 Claude 里打开这个页面。把链接分享给朋友时，请把他们设为「可编辑的协作者」（Contributor），他们才能进房间。</div>`;
  const nr = MP.nr, list = nr ? nr.peers() : [];
  if (MP.stage === 'idle') {
    const rooms = openRooms();
    return `<div class="row" style="flex-wrap:wrap;gap:10px"><button class="btn pri" type="button" data-h="mp-host">创建房间</button><span class="mut">或输入房间号</span><input id="mpCode" type="text" maxlength="4" placeholder="ABCD" style="width:90px;text-transform:uppercase;background:rgba(255,255,255,.04);border:1px solid var(--line2);border-radius:7px;padding:7px 10px;font:700 15px var(--fn);letter-spacing:.2em"><button class="btn" type="button" data-h="mp-join">加入</button></div>
     <div><div class="k" style="margin:4px 0">正在等人的房间</div>${rooms.length ? rooms.map(r => `<div class="sp" style="padding:7px 0;border-top:1px solid var(--line)"><span><b class="n" style="letter-spacing:.15em">${esc(r.code)}</b> · ${esc(r.co)} 的房间 · ${r.n || 1}/4 人</span><button class="btn sm" type="button" data-h="mp-join" data-code="${esc(r.code)}">加入</button></div>`).join('') : '<div class="mut">暂时没有。创建一个，把房间号发给朋友。</div>'}</div>`;
  }
  const host = MP.stage === 'hosting';
  return `<div class="sp"><div><div class="k">房间号</div><div class="n gold" style="font-size:34px;letter-spacing:.25em">${MP.code}</div></div><div class="mut" style="text-align:right">${host ? '把房间号发给朋友，他们在「好友对战」里输入即可加入。' : '等待房主开始…'}</div></div>
   <div class="rival-row">${list.map(p => { const pr = p.presence || {}; return `<span class="rv"><span class="pt">${portrait(MY_LOOKS[(pr.look || 0) % MY_LOOKS.length], '#2a3240')}</span><span><b>${esc(pr.co || '…')}</b> <span class="mut">${p.isMe ? '你' : pr.role === 'host' ? '房主' : '玩家'}</span></span></span>`; }).join('')}${Array.from({ length: Math.max(0, 4 - list.length) }, () => '<span class="rv"><span class="pt" style="background:#222a35"></span><span class="mut">AI 补位</span></span>').join('')}</div>
   ${host ? `<div class="row" style="flex-wrap:wrap;gap:10px 18px"><div class="row"><span class="k">难度</span><div class="seg">${[['easy', '轻松'], ['normal', '标准'], ['hard', '困难']].map(([k, l]) => `<button type="button" data-h="diff-${k}" class="${PF.set.diff === k ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="row"><span class="k">时长</span><div class="seg">${[['quick', '快速'], ['std', '标准']].map(([k, l]) => `<button type="button" data-h="len-${k}" class="${PF.set.len === k ? 'on' : ''}">${l}</button>`).join('')}</div></div></div>` : ''}
   <div class="row">${host ? `<button class="btn pri" type="button" data-h="mp-start" style="flex:1;padding:12px">开始对局（${list.length} 人 + ${Math.max(0, 4 - list.length)} AI）</button>` : ''}<button class="btn" type="button" data-h="mp-leave">${host ? '解散' : '离开'}</button></div>`;
}
async function mpClick(h, b) {
  if (h === 'mp-host') return mpEnter(Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''), true);
  if (h === 'mp-join') { const code = (b.dataset.code || ($('#mpCode') || {}).value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length !== 4) return toast('房间号是 4 位', 'bad'); return mpEnter(code, false); }
  if (h === 'mp-leave') { await mpExit(); renderHome(); return; }
  if (h === 'mp-start') return hostStart();
}
async function mpEnter(code, host) {
  try {
    await mpExit();
    const nr = await ROOM.join('shz-' + code.toLowerCase()); MP.nr = nr; MP.code = code; MP.stage = host ? 'hosting' : 'joined';
    await nr.presence({ co: PF.co || '无名公司', name: PF.name || '董事长', look: PF.look, role: host ? 'host' : 'guest' });
    if (host) ROOM.presence({ host: { code, co: PF.co || '无名公司', n: 1, at: Date.now() } });
    MP.unsubs.push(nr.onPeers(ch => {
      if (MP.stage !== 'playing') { if (host) ROOM.presence({ host: { code, co: PF.co || '无名公司', n: ch.peers.length, at: Date.now() } }); renderHomeSoon(); }
      if (MP.stage === 'playing') netPeers(ch);
    }));
    MP.unsubs.push(nr.on('start', msg => { if (!host && msg.data && msg.data.code === MP.code) clientStart(msg); }));
    renderHome(); snd('click');
    if (!host) setTimeout(() => { if (!nr.peers().some(p => !p.isMe && p.presence && p.presence.role === 'host')) toast('房间里还没有房主，确认房间号是否正确', 'bad'); }, 3500);
  } catch (e) { toast('进不了房间：' + (e && e.code === 'not_permitted' ? '需要可编辑权限' : '网络问题，请重试'), 'bad'); MP.stage = 'idle'; renderHome(); }
}
async function mpExit() {
  MP.unsubs.forEach(u => { try { u(); } catch (e) { } }); MP.unsubs = [];
  if (MP.nr) { try { await MP.nr.leave(); } catch (e) { } } MP.nr = null;
  if (ROOM) ROOM.presence({ host: null }).catch(() => { });
  MP.stage = 'idle'; MP.code = ''; MP.peerPid = {}; MP.hostPeer = null; G.net = null;
}
function hostStart() {
  const nr = MP.nr; if (!nr) return; const people = nr.peers().slice(0, 4);
  const me = people.find(p => p.isMe) || people[0]; const order = [me, ...people.filter(p => p !== me)];
  const ks = Object.keys(PERSONAS).sort(() => Math.random() - .5);
  const pl = order.map(p => ({ name: (p.presence && p.presence.name) || '玩家', co: (p.presence && p.presence.co) || '玩家公司', look: (p.presence && p.presence.look) || 0, peer: p.peer }));
  while (pl.length < 4) { const k = ks.pop(); pl.push({ ai: 1, persona: k, name: PERSONAS[k].name, co: PERSONAS[k].co }); }
  const seed = (Math.random() * 1e9) | 0, len = MATCH_LEN[PF.set.len], diff = PF.set.diff;
  MP.peerPid = {}; pl.forEach((p, i) => { if (p.peer) MP.peerPid[p.peer] = i; });
  nr.emit('start', { code: MP.code, seed, len, diff, pl: pl.map(p => ({ name: p.name, co: p.co, look: p.look, ai: p.ai || 0, persona: p.persona || null, peer: p.peer || null })) });
  MP.stage = 'playing'; ROOM.presence({ host: null }).catch(() => { });
  clearInterval(demoTimer); demo = null;
  const m = newMatch({ seed, len, diff, players: pl }); pl.forEach((p, i) => { m.players[i].look = p.look; m.players[i].peer = p.peer; });
  for (const p of m.players) if (p.ai) aiPlaceHQ(m, p.id);
  G.onEnd = matchReward; startMatch(m, 0, 'host'); hostNet();
}
function clientStart(msg) {
  const d = msg.data; MP.hostPeer = msg.peer; MP.stage = 'playing';
  const pid = d.pl.findIndex(p => p.peer === myPeer); if (pid < 0) { toast('房间已满，未能加入这一局', 'bad'); return; }
  clearInterval(demoTimer); demo = null;
  const m = newMatch({ seed: d.seed, len: d.len, diff: d.diff, players: d.pl.map(p => ({ ...p, ai: p.ai })) }); d.pl.forEach((p, i) => { m.players[i].look = p.look; });
  G.onEnd = matchReward; startMatch(m, pid, 'client'); clientNet();
}
// ---------- 房主 ----------
function tileSig(t) { return [t.owner, t.b ? BUILDABLE.indexOf(t.b.k) + 2 * (t.b.k === 'hq') + 3 * (t.b.k === 'branch') : -1, t.b ? t.b.lv : 0, t.b ? t.b.prog : 0, t.b ? t.b.idle : 0, t.b && t.b.stall ? (t.b.stall === 'input' ? 1 : 2) : 0, t.bonus ? 1 : 0, t.metro ? 1 : 0]; }
const KIDX = k => k === 'hq' ? 'hq' : k === 'branch' ? 'branch' : k;
function bCode(t) { if (!t.b) return ''; return t.b.k; }
function hostNet() {
  const nr = MP.nr; MP.lastTiles = G.m.tiles.map(() => ''); MP.logSent = 0; MP.saySent = 0; let soon = 0;
  G.net = {
    broadcast() { hostSnap(); }, broadcastSoon() { clearTimeout(soon); soon = setTimeout(hostSnap, 60); }, leave() { mpExit(); },
  };
  MP.unsubs.push(nr.on('cmd', msg => {
    const pid = MP.peerPid[msg.peer]; if (pid == null || !G.m || !msg.data || typeof msg.data.c !== 'object') return;
    const c = msg.data.c; if (c.t === 'chat') c.text = String(c.text || '').slice(0, 80);
    const r = act(G.m, pid, c); nr.emit('res', { to: msg.peer, ok: !!r.ok, msg: r.msg || '', t: c.t, v: r.v || 0, blocked: !!r.blocked }).catch(() => { });
    if (c.t === 'hq' && G.m.phase === 'play') hostSnap(true);
    hudUpdate(true); G.net.broadcastSoon();
  }));
  MP.unsubs.push(nr.on('sync', msg => { hostSnap(true); }));
  setTimeout(() => hostSnap(true), 400);
}
function hostSnap(full) {
  const m = G.m, nr = MP.nr; if (!m || !nr) return;
  const diffs = []; m.tiles.forEach((t, i) => { const s = JSON.stringify([tileSig(t), bCode(t)]); if (full || s !== MP.lastTiles[i]) { MP.lastTiles[i] = s; diffs.push([i, t.owner, bCode(t), t.b ? t.b.lv : 0, t.b ? t.b.prog : 0, t.b ? t.b.idle : 0, t.b && t.b.stall ? t.b.stall : 0, t.bonus ? 1 : 0, t.metro ? 1 : 0]); } });
  const snap = {
    d: m.day, ph: m.phase, ov: m.over ? 1 : 0, w: m.winner, sp: G.speed,
    P: m.players.map(p => ({ c: Math.round(p.cash), i: RK.map(r => Math.round(p.inv[r] * 10) / 10), md: RK.map(r => p.mode[r] === 'hold' ? 'h' : 's').join(''), q: p.hql, a: p.alive ? 1 : 0, g: p.guard, sc: p.scandal ? p.scandal.until : 0, cd: p.sabCd, tb: p.takenBy ?? -1, rk: p.rank, fi: Math.round(p.final || 0), hq: p.hq ? [p.hq.x, p.hq.y] : null, ab: p.autobuy ? 1 : 0, od: p.outDay || 0, ai: p.ai ? 1 : 0, h: p.stats.hist.length ? p.stats.hist[p.stats.hist.length - 1] : 0 })),
    K: RK.map(r => [Math.round(m.mkt[r].p * 100) / 100, Math.round(m.mkt[r].t * 100) / 100]),
    F: m.float, H: m.hold, X: m.fx.map(f => ({ k: f.k, until: f.until })), A: m.auction ? { x: m.auction.x, y: m.auction.y, s: m.auction.start, b: m.auction.best, by: m.auction.by, e: m.auction.ends } : null,
    E: m.pendingEvent ? { k: m.pendingEvent.e.k, at: m.pendingEvent.at } : null,
  };
  for (let i = 0; i < diffs.length; i += 70) nr.emit('tiles', { t: diffs.slice(i, i + 70) }).catch(() => { });
  nr.emit('snap', snap).catch(() => { });
  const logs = m.log.filter(l => l.n > MP.logSent), says = m.says.filter(s => s.n > MP.saySent);
  for (let i = 0; i < logs.length; i += 5) nr.emit('log', { l: logs.slice(i, i + 5).map(l => [l.d, l.txt.slice(0, 120), l.k, l.pid, l.n]) }).catch(() => { });
  for (let i = 0; i < says.length; i += 5) nr.emit('log', { s: says.slice(i, i + 5).map(s => [s.d, s.txt.slice(0, 120), s.pid, s.n, s.chat ? 1 : 0]) }).catch(() => { });
  if (logs.length) MP.logSent = logs[logs.length - 1].n; if (says.length) MP.saySent = says[says.length - 1].n;
}
function netPeers(ch) {
  const m = G.m; if (!m) return;
  for (const p of ch.left) {
    if (G.role === 'host') { const pid = MP.peerPid[p.peer]; if (pid != null && m.players[pid].alive && !m.players[pid].ai) { const P0 = m.players[pid]; P0.ai = true; P0.human = false; log(m, `${P0.co} 的董事长掉线，由经理人代管`, 'sys', pid); } }
    else if (p.peer === MP.hostPeer && !m.over) { toast('房主已离开，对局结束', 'bad'); m.over = true; m.phase = 'over'; if (!m.players[G.me].rank) m.players.forEach((q, i) => { q.rank = q.rank || i + 1; }); }
  }
}
// ---------- 客户端 ----------
function clientNet() {
  const nr = MP.nr;
  G.send = c => nr.emit('cmd', { c }).catch(() => toast('网络中断，指令未送达', 'bad'));
  G.net = { broadcast() { }, broadcastSoon() { }, leave() { mpExit(); } };
  MP.unsubs.push(nr.on('tiles', msg => { if (msg.peer !== MP.hostPeer) return; applyTiles(msg.data.t); }));
  MP.unsubs.push(nr.on('snap', msg => { if (msg.peer !== MP.hostPeer) return; applySnap(msg.data); }));
  MP.unsubs.push(nr.on('log', msg => { if (msg.peer !== MP.hostPeer) return; applyLog(msg.data); }));
  MP.unsubs.push(nr.on('res', msg => { if (msg.peer !== MP.hostPeer || !msg.data || msg.data.to !== myPeer) return; const r = msg.data; if (!r.ok && r.msg) toast(r.msg, 'bad'); else if (r.ok) { afterAct({ t: r.t, q: 1 }, r); if (r.t === 'hq') setTimeout(hqPlaced, 300); } }));
  setTimeout(() => nr.emit('sync', {}).catch(() => { }), 600);
}
function applyTiles(arr) {
  const m = G.m; if (!m || !Array.isArray(arr)) return;
  for (const [i, o, k, lv, prog, idle, stall, bonus, metro] of arr) {
    const t = m.tiles[i]; if (!t) continue; t.owner = o; t.bonus = !!bonus; t.metro = !!metro;
    t.b = k && BLD[k] ? { k, lv, prog, idle, stall: stall || null } : null;
  }
}
function applySnap(s) {
  const m = G.m; if (!m || !s) return;
  const newDay = s.d !== m.day; m.day = s.d; m.phase = s.ph; G.speed = s.sp;
  s.P.forEach((q, i) => { const p = m.players[i]; if (!p) return; p.cash = q.c; RK.forEach((r, k) => { p.inv[r] = q.i[k]; p.mode[r] = q.md[k] === 'h' ? 'hold' : 'sell'; }); p.hql = q.q; p.alive = !!q.a; p.guard = q.g; p.scandal = q.sc ? { m: .8, until: q.sc } : null; p.sabCd = q.cd || {}; p.takenBy = q.tb >= 0 ? q.tb : null; p.rank = q.rk; p.final = q.fi; p.hq = q.hq ? { x: q.hq[0], y: q.hq[1] } : null; p.autobuy = !!q.ab; p.outDay = q.od; p.ai = !!q.ai; if (newDay && s.d % 5 === 0 && q.h) p.stats.hist.push(q.h); });
  RK.forEach((r, k) => { const mk = m.mkt[r]; mk.p = s.K[k][0]; mk.t = s.K[k][1]; if (newDay) { mk.h.push(mk.p); if (mk.h.length > 90) mk.h.shift(); } });
  m.float = s.F; m.hold = s.H; m.fx = s.X.map(f => ({ ...EVENTS.find(e => e.k === f.k), until: f.until }));
  m.auction = s.A ? { x: s.A.x, y: s.A.y, start: s.A.s, best: s.A.b, by: s.A.by, ends: s.A.e, bids: [] } : null;
  m.pendingEvent = s.E ? { e: EVENTS.find(e => e.k === s.E.k), at: s.E.at } : null;
  if (s.ov && !m.over) { m.over = true; m.winner = s.w; }
  if (m.phase === 'play' && $('#hBanner') && !$('#hBanner').hidden && m.players[G.me].hq) hqPlaced();
  hudUpdate(newDay);
}
function applyLog(d) {
  const m = G.m; if (!m || !d) return;
  if (d.l) for (const [dd, txt, k, pid, n] of d.l) { if (m.log.some(x => x.n === n)) continue; m.log.push({ d: dd, txt, k, pid, n }); m.logN = Math.max(m.logN, n); }
  if (d.s) for (const [dd, txt, pid, n, chat] of d.s) { if (m.says.some(x => x.n === n)) continue; m.says.push({ d: dd, txt, pid, n, chat: !!chat }); m.logN = Math.max(m.logN, n); }
  if (m.log.length > 120) m.log.splice(0, m.log.length - 120);
  hudUpdate();
}
