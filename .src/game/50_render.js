// ===================== RENDER (等距沙盘) =====================
const TW = 96, TH = 48;
const R = {
  cv: null, x: null, W: 0, H: 0, dpr: 1, m: null, me: -1,
  cam: { x: 0, y: 0, z: .7 }, hover: null, sel: null, hl: null, hlCol: '#7ee08a', resView: false,
  parts: [], floats: [], t: 0, last: 0, boats: [], drift: false, onClick: null, onHover: null,
};
const PAL = {
  land: ['#9fbe73', '#a4c378', '#9ab86d'], urban: '#c9c6bf', water: '#5ea2c6', sea: '#3f80ad',
  food: ['', '#bcc26b', '#cbb95f', '#d9ad4d'], ore: ['', '#aaa08c', '#a19682', '#978a76'], oil: ['', '#bba67f', '#b29c74', '#a8916a'],
  soil: '#7a5b3e', soil2: '#5b4430', seaSide: '#2c6890',
};
const W2 = TW / 2, H2 = TH / 2;
const iso = (tx, ty) => [(tx - ty) * W2, (tx + ty) * H2];
function rInit(cv) {
  R.cv = cv; R.x = cv.getContext('2d');
  const rs = () => { R.dpr = Math.min(2, window.devicePixelRatio || 1); R.W = innerWidth; R.H = innerHeight; cv.width = R.W * R.dpr; cv.height = R.H * R.dpr; };
  rs(); addEventListener('resize', rs);
  rInput(cv);
  requestAnimationFrame(rLoop);
}
function rSetMatch(m, me) {
  R.m = m; R.me = me; R.parts = []; R.floats = []; R.sel = null; R.hover = null;
  const [cx, cy] = iso(MAP_W / 2, MAP_H / 2);
  R.cam.x = cx; R.cam.y = cy; R.cam.z = clamp(Math.min(R.W / (MAP_W * TW * .78), R.H / (MAP_H * TH * 1.05)), .35, 1.1);
  // 江上的船：沿水域按 y 排序的路径
  const river = m.tiles.filter(t => t.t === 'water').sort((a, b) => b.y - a.y || a.x - b.x);
  R.boats = river.length > 4 ? [0, .33, .66].map(o => ({ path: river, p: o * river.length, sp: .5 + Math.random() * .4, col: ['#e9e3d5', '#c94b3a', '#2f5b8a'][Math.floor(Math.random() * 3)] })) : [];
  const sea = m.tiles.filter(t => t.t === 'sea' && t.x === MAP_W - 2).sort((a, b) => a.y - b.y);
  if (sea.length) R.boats.push({ path: sea, p: 3, sp: .35, col: '#d9573f', big: true }, { path: sea.slice().reverse(), p: 9, sp: .3, col: '#2f5b8a', big: true });
}
function camTo(tx, ty) { const [x, y] = iso(tx + .5, ty + .5); R.cam.x = x; R.cam.y = y; }
function w2s(wx, wy) { return [(wx - R.cam.x) * R.cam.z + R.W / 2, (wy - R.cam.y) * R.cam.z + R.H / 2]; }
function s2t(sx, sy) {
  const wx = (sx - R.W / 2) / R.cam.z + R.cam.x, wy = (sy - R.H / 2) / R.cam.z + R.cam.y;
  const a = wy / H2, b = wx / W2; return [Math.floor((a + b) / 2), Math.floor((a - b) / 2)];
}
function rInput(cv) {
  const pts = new Map(); let down = null, moved = false, pinch = null;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); down = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y }; moved = false;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: R.cam.z }; } });
  cv.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; R.cam.z = clamp(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, .3, 1.8); moved = true; return; }
    if (down && pts.size === 1) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 5) { moved = true; cv.classList.add('drag'); } if (moved) { R.cam.x = down.cx - dx / R.cam.z; R.cam.y = down.cy - dy / R.cam.z; } }
    else if (e.pointerType === 'mouse') { const [tx, ty] = s2t(e.clientX, e.clientY); const t = R.m && tileAt(R.m, tx, ty); const h = t ? t.y * MAP_W + t.x : null; if (h !== R.hover) { R.hover = h; R.onHover && R.onHover(t); } }
  });
  const up = e => { pts.delete(e.pointerId); cv.classList.remove('drag'); if (pts.size < 2) pinch = null;
    if (down && !moved && pts.size === 0) { const [tx, ty] = s2t(e.clientX, e.clientY); const t = R.m && tileAt(R.m, tx, ty); R.onClick && R.onClick(t, e); }
    if (pts.size === 0) down = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (R.hover != null) { R.hover = null; R.onHover && R.onHover(null); } });
  cv.addEventListener('wheel', e => { e.preventDefault(); const z0 = R.cam.z, z1 = clamp(z0 * Math.exp(-e.deltaY * .0015), .3, 1.8);
    const wx = (e.clientX - R.W / 2) / z0 + R.cam.x, wy = (e.clientY - R.H / 2) / z0 + R.cam.y; R.cam.z = z1; R.cam.x = wx - (e.clientX - R.W / 2) / z1; R.cam.y = wy - (e.clientY - R.H / 2) / z1; }, { passive: false });
}
function addFloat(tx, ty, txt, col) { const [x, y] = iso(tx + .5, ty + .5); R.floats.push({ x, y: y - 30, txt, col: col || '#fff', t: 0 }); if (R.floats.length > 40) R.floats.shift(); }

// ---------- 绘制原语 ----------
function poly(x, pts, fill, stroke, lw) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 1; x.stroke(); } }
function P(cx, cy, dx, dy, z) { return [cx + (dx - dy) * W2, cy + (dx + dy) * H2 - (z || 0)]; }
function diamond(cx, cy, s) { s = s || .5; return [P(cx, cy, -s, -s), P(cx, cy, s, -s), P(cx, cy, s, s), P(cx, cy, -s, s)]; }
function box(x, cx, cy, ox, oy, a, b, h, col, o) {
  o = o || {}; const z0 = o.z || 0, X = ox, Y = oy;
  const top = [P(cx, cy, X - a, Y - b, z0 + h), P(cx, cy, X + a, Y - b, z0 + h), P(cx, cy, X + a, Y + b, z0 + h), P(cx, cy, X - a, Y + b, z0 + h)];
  const fl = [P(cx, cy, X - a, Y + b, z0), P(cx, cy, X + a, Y + b, z0), P(cx, cy, X + a, Y + b, z0 + h), P(cx, cy, X - a, Y + b, z0 + h)];
  const fr = [P(cx, cy, X + a, Y - b, z0), P(cx, cy, X + a, Y + b, z0), P(cx, cy, X + a, Y + b, z0 + h), P(cx, cy, X + a, Y - b, z0 + h)];
  poly(x, fl, o.left || col); poly(x, fr, o.right || shade(col, -.2)); poly(x, top, o.top || shade(col, .14));
  if (o.win) { // 窗带
    x.strokeStyle = o.win; x.lineWidth = o.ww || 1.2;
    for (let zz = z0 + 5; zz < z0 + h - 3; zz += o.ws || 6) {
      x.beginPath(); const a1 = P(cx, cy, X - a + .03, Y + b, zz), a2 = P(cx, cy, X + a - .03, Y + b, zz); x.moveTo(a1[0], a1[1]); x.lineTo(a2[0], a2[1]);
      const b1 = P(cx, cy, X + a, Y - b + .03, zz), b2 = P(cx, cy, X + a, Y + b - .03, zz); x.moveTo(b1[0], b1[1]); x.lineTo(b2[0], b2[1]); x.stroke();
    }
  }
  if (o.edge) { x.strokeStyle = o.edge; x.lineWidth = .8; x.beginPath(); const a1 = P(cx, cy, X + a, Y + b, z0), a2 = P(cx, cy, X + a, Y + b, z0 + h); x.moveTo(a1[0], a1[1]); x.lineTo(a2[0], a2[1]); x.stroke(); }
}
function gable(x, cx, cy, ox, oy, a, b, z, rh, col) { // 沿 x 方向的双坡屋顶
  const l1 = P(cx, cy, ox - a, oy - b, z), l2 = P(cx, cy, ox + a, oy - b, z), l3 = P(cx, cy, ox + a, oy + b, z), l4 = P(cx, cy, ox - a, oy + b, z);
  const r1 = P(cx, cy, ox - a, oy, z + rh), r2 = P(cx, cy, ox + a, oy, z + rh);
  poly(x, [l4, l3, r2, r1], col); poly(x, [l2, l3, r2], shade(col, -.25)); poly(x, [l1, l2, r2, r1], shade(col, .12));
}
function cyl(x, cx, cy, ox, oy, r, h, col, z0) {
  z0 = z0 || 0; const [px, py] = P(cx, cy, ox, oy, z0); const rx = r * TW * .72, ry = rx / 2;
  const g = x.createLinearGradient(px - rx, 0, px + rx, 0); g.addColorStop(0, shade(col, .1)); g.addColorStop(.55, col); g.addColorStop(1, shade(col, -.3));
  x.fillStyle = g; x.beginPath(); x.ellipse(px, py, rx, ry, 0, 0, Math.PI); x.lineTo(px - rx, py - h); x.ellipse(px, py - h, rx, ry, 0, Math.PI, 0, true); x.closePath(); x.fill();
  x.fillStyle = shade(col, .2); x.beginPath(); x.ellipse(px, py - h, rx, ry, 0, 0, Math.PI * 2); x.fill();
  return [px, py - h];
}
function tree(x, cx, cy, ox, oy, s, dark) {
  const [px, py] = P(cx, cy, ox, oy); s = s || 1;
  x.fillStyle = 'rgba(0,0,0,.14)'; x.beginPath(); x.ellipse(px + 3 * s, py + 1, 6 * s, 3 * s, 0, 0, 7); x.fill();
  x.fillStyle = '#6b4f37'; x.fillRect(px - 1 * s, py - 6 * s, 2 * s, 6 * s);
  x.fillStyle = dark ? '#4f8146' : '#5f9550'; x.beginPath(); x.arc(px, py - 9 * s, 6 * s, 0, 7); x.fill();
  x.fillStyle = dark ? '#68a159' : '#78b062'; x.beginPath(); x.arc(px - 1.5 * s, py - 11 * s, 3.6 * s, 0, 7); x.fill();
}
function smoke(px, py, col, big) { R.parts.push({ x: px, y: py, vx: (Math.random() - .3) * .25, vy: -.35 - Math.random() * .2, r: big ? 4 : 2.6, a: .55, col }); }

// ---------- 地面 ----------
function drawGround(x, t, time) {
  const [cx, cy] = iso(t.x + .5, t.y + .5); const d = diamond(cx, cy);
  let col;
  if (t.t === 'water') col = shade(PAL.water, Math.sin(time * 1.4 + t.x * .8 + t.y * .6) * .03);
  else if (t.t === 'sea') col = shade(PAL.sea, Math.sin(time * 1.1 + t.x * .5 + t.y * .9) * .035);
  else if (t.t === 'urban' || t.t === 'landmark') col = PAL.urban;
  else if (t.res) col = PAL[t.res][t.r];
  else col = PAL.land[Math.floor(t.deco * 3)];
  poly(x, d, col);
  if (t.t === 'water' || t.t === 'sea') {
    x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 1;
    const k = (time * .25 + t.deco) % 1, [a1, b1] = P(cx, cy, -.25 + k * .3, -.1, 0); x.beginPath(); x.moveTo(a1, b1); x.lineTo(a1 + 10, b1 + 5); x.stroke();
    return;
  }
  x.strokeStyle = 'rgba(40,40,30,.08)'; x.lineWidth = 1; poly(x, d, null, 'rgba(50,50,40,.08)', 1);
  if (t.res === 'food') { x.strokeStyle = shade(col, -.16); x.lineWidth = 1.4; for (let i = -3; i <= 3; i++) { const a = P(cx, cy, -.42, i * .12), b = P(cx, cy, .42, i * .12); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); } }
  else if (t.res === 'ore') { for (let i = 0; i < 2 + t.r; i++) { const ox = (Math.sin(t.deco * 50 + i * 7) * .3), oy = (Math.cos(t.deco * 31 + i * 5) * .3); const [px, py] = P(cx, cy, ox, oy); x.fillStyle = shade(col, -.32); x.beginPath(); x.moveTo(px - 5, py + 1); x.lineTo(px - 2, py - 4); x.lineTo(px + 4, py - 2); x.lineTo(px + 5, py + 2); x.closePath(); x.fill(); } }
  else if (t.res === 'oil') { for (let i = 0; i < t.r; i++) { const [px, py] = P(cx, cy, Math.sin(t.deco * 40 + i * 3) * .22, Math.cos(t.deco * 17 + i * 4) * .22); x.fillStyle = 'rgba(40,34,30,.45)'; x.beginPath(); x.ellipse(px, py, 9, 4, 0, 0, 7); x.fill(); } }
  else if (t.t === 'urban') { x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.2; const a = P(cx, cy, -.5, .42), b = P(cx, cy, .5, .42), c = P(cx, cy, .42, -.5), e = P(cx, cy, .42, .5); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.moveTo(c[0], c[1]); x.lineTo(e[0], e[1]); x.stroke(); }
  if (t.port) { x.fillStyle = 'rgba(220,215,200,.6)'; poly(x, [P(cx, cy, .36, -.5), P(cx, cy, .5, -.5), P(cx, cy, .5, .5), P(cx, cy, .36, .5)], 'rgba(222,216,200,.75)'); }
}
function drawSides(x) { // 沙盘边缘的土层
  const m = R.m;
  for (let i = 0; i < MAP_W; i++) for (const [tx, ty, side] of [[i, MAP_H - 1, 'y'], [MAP_W - 1, i, 'x']]) {
    const t = tileAt(m, tx, ty), [cx, cy] = iso(tx + .5, ty + .5), h = 26;
    const water = t.t === 'sea' || t.t === 'water';
    const pts = side === 'y' ? [P(cx, cy, -.5, .5), P(cx, cy, .5, .5), P(cx, cy, .5, .5, -h), P(cx, cy, -.5, .5, -h)] : [P(cx, cy, .5, -.5), P(cx, cy, .5, .5), P(cx, cy, .5, .5, -h), P(cx, cy, .5, -.5, -h)];
    poly(x, pts, water ? (side === 'y' ? PAL.seaSide : shade(PAL.seaSide, -.15)) : (side === 'y' ? PAL.soil : PAL.soil2));
    if (!water) poly(x, side === 'y' ? [P(cx, cy, -.5, .5), P(cx, cy, .5, .5), P(cx, cy, .5, .5, -5), P(cx, cy, -.5, .5, -5)] : [P(cx, cy, .5, -.5), P(cx, cy, .5, .5), P(cx, cy, .5, .5, -5), P(cx, cy, .5, -.5, -5)], side === 'y' ? '#7f9f5a' : '#6f8d4d');
  }
}
function drawOwnership(x) {
  const m = R.m;
  for (const t of m.tiles) {
    if (t.owner < 0) continue;
    const col = m.players[t.owner].color, [cx, cy] = iso(t.x + .5, t.y + .5);
    x.globalAlpha = .2; poly(x, diamond(cx, cy, .5), col); x.globalAlpha = 1;
    x.strokeStyle = col; x.lineWidth = 2.6; x.lineCap = 'round';
    const edge = (nx, ny, a, b) => { const n = tileAt(m, nx, ny); if (!n || n.owner !== t.owner) { x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); } };
    edge(t.x, t.y - 1, P(cx, cy, -.46, -.46), P(cx, cy, .46, -.46));
    edge(t.x + 1, t.y, P(cx, cy, .46, -.46), P(cx, cy, .46, .46));
    edge(t.x, t.y + 1, P(cx, cy, .46, .46), P(cx, cy, -.46, .46));
    edge(t.x - 1, t.y, P(cx, cy, -.46, .46), P(cx, cy, -.46, -.46));
  }
}

// ---------- 物体 ----------
const CITY = ['#dfe2e6', '#cfd5dc', '#e9e4da', '#bfc8d2', '#d8d2c6'];
function drawObj(x, t, time) {
  const m = R.m, [cx, cy] = iso(t.x + .5, t.y + .5);
  if (t.t === 'landmark') { // 东方明珠
    for (const [ox, oy] of [[-.12, -.12], [.12, -.12], [0, .14]]) box(x, cx, cy, ox, oy, .025, .025, 36, '#d9d4cc');
    const [px, py] = P(cx, cy, 0, 0);
    const ball = (yy, r) => { const g = x.createRadialGradient(px - r * .35, yy - r * .35, r * .1, px, yy, r); g.addColorStop(0, '#f6a4c0'); g.addColorStop(1, '#a82e5c'); x.fillStyle = g; x.beginPath(); x.arc(px, yy, r, 0, 7); x.fill(); };
    x.fillStyle = '#d9d4cc'; x.fillRect(px - 2.2, py - 118, 4.4, 84);
    ball(py - 40, 13); ball(py - 92, 9); ball(py - 106, 4.5);
    x.strokeStyle = '#d9d4cc'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, py - 110); x.lineTo(px, py - 150); x.stroke();
    return;
  }
  if (t.owner < 0) {
    if (t.t === 'urban') { // 中立城区楼群
      const n = 1 + Math.floor(t.deco * 2.4);
      for (let i = 0; i < n; i++) { const ox = n === 1 ? 0 : (i ? .18 : -.16), oy = n === 1 ? 0 : (i ? -.14 : .16); const h = 18 + ((t.deco * 997 + i * 37) % 1) * 54; box(x, cx, cy, ox, oy, n === 1 ? .26 : .17, n === 1 ? .26 : .17, h, CITY[Math.floor(t.deco * 5 + i) % 5], { win: 'rgba(90,120,150,.35)', ws: 7 }); }
    } else if (t.t === 'land' && !t.res) { const n = Math.floor(t.deco * 4); for (let i = 0; i < n; i++) tree(x, cx, cy, Math.sin(t.deco * 90 + i * 2.1) * .28, Math.cos(t.deco * 70 + i * 1.7) * .28, .9 + (i % 2) * .2, i % 2); }
    else if (t.res === 'food' && t.deco > .78) tree(x, cx, cy, .32, -.3, .8, 1);
    return;
  }
  const P0 = m.players[t.owner], pc = P0.color, b = t.b;
  if (!b) { if (t.t === 'land' && !t.res && t.deco > .5) tree(x, cx, cy, .25, -.25, .8, 1); return; }
  const lvS = b.k === 'hq' || b.k === 'branch' ? 1 : [0, 1, 1.22, 1.45][b.lv];
  if (b.prog > 0) { // 施工中
    const h = 26; x.strokeStyle = '#e08a2e'; x.lineWidth = 1.2;
    const c = [P(cx, cy, -.28, .28), P(cx, cy, .28, .28), P(cx, cy, .28, -.28)];
    for (let z = 0; z <= h; z += 6.5) { x.beginPath(); const a = P(cx, cy, -.28, .28, z), bb = P(cx, cy, .28, .28, z), cc = P(cx, cy, .28, -.28, z); x.moveTo(a[0], a[1]); x.lineTo(bb[0], bb[1]); x.lineTo(cc[0], cc[1]); x.stroke(); }
    for (const p of c) { x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(p[0], p[1] - h); x.stroke(); }
    box(x, cx, cy, -.1, .05, .2, .18, 8, '#cfc8bb');
    const [kx, ky] = P(cx, cy, -.3, -.3); x.strokeStyle = '#f0b43c'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(kx, ky); x.lineTo(kx, ky - 52); x.lineTo(kx + 34, ky - 46); x.moveTo(kx, ky - 52); x.lineTo(kx - 10, ky - 49); x.stroke();
    return;
  }
  const working = !b.idle && !b.stall;
  switch (b.k) {
    case 'hq': case 'branch': {
      const big = b.k === 'hq', lv = big ? P0.hql : 1, h = (big ? 46 + lv * 15 : 36);
      poly(x, diamond(cx, cy, .44), '#d8d4cb');
      box(x, cx, cy, 0, 0, .26, .26, 10, '#3b4250', { top: '#4a5262' });
      box(x, cx, cy, 0, 0, .21, .21, h, '#eef0f2', { z: 10, win: 'rgba(74,108,140,.55)', ws: 5.5, ww: 1.6, edge: 'rgba(0,0,0,.08)' });
      box(x, cx, cy, 0, 0, .23, .23, 6, pc, { z: 10 + h });
      const [fx, fy] = P(cx, cy, 0, 0, 16 + h); x.strokeStyle = '#555'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx, fy - 24); x.stroke();
      const wv = Math.sin(time * 4 + t.x) * 2.5; x.fillStyle = pc; x.beginPath(); x.moveTo(fx, fy - 24); x.quadraticCurveTo(fx + 8, fy - 22 + wv, fx + 16, fy - 21); x.lineTo(fx + 16, fy - 13); x.quadraticCurveTo(fx + 8, fy - 14 + wv, fx, fy - 15); x.fill();
      break;
    }
    case 'farm': {
      x.strokeStyle = shade('#9fb54b', -.05); x.lineWidth = 2.2; for (let i = -3; i <= 3; i++) { const a = P(cx, cy, -.44, i * .12), bb = P(cx, cy, .44, i * .12); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(bb[0], bb[1]); x.stroke(); }
      box(x, cx, cy, -.2, -.18, .15, .12, 10 * lvS, '#e9dfcc'); gable(x, cx, cy, -.2, -.18, .17, .14, 10 * lvS, 8, pc);
      cyl(x, cx, cy, .18, -.24, .07, 24 * lvS, '#eceae4'); const [sx, sy] = P(cx, cy, .18, -.24, 24 * lvS); x.fillStyle = pc; x.beginPath(); x.ellipse(sx, sy, 7, 3.5, 0, Math.PI, 0); x.fill();
      if (b.lv >= 2) cyl(x, cx, cy, .3, -.08, .06, 18, '#e2ded6');
      break;
    }
    case 'well': {
      box(x, cx, cy, -.05, .1, .14, .08, 4, '#6f6a62');
      const [px, py] = P(cx, cy, -.05, .1, 4); const ang = Math.sin(time * (working ? 2.6 : 0) + t.x) * .35;
      x.strokeStyle = '#3d3a36'; x.lineWidth = 2; x.beginPath(); x.moveTo(px - 8, py); x.lineTo(px, py - 20); x.lineTo(px + 8, py); x.stroke();
      x.save(); x.translate(px, py - 20); x.rotate(ang); x.fillStyle = pc; x.fillRect(-22, -2.5, 34, 5); x.fillStyle = '#3d3a36'; x.beginPath(); x.moveTo(-22, -6); x.lineTo(-27, 0); x.lineTo(-22, 8); x.closePath(); x.fill(); x.restore();
      cyl(x, cx, cy, .22, -.18, .1, 14 * lvS, '#d7d2c7'); const [tx2, ty2] = P(cx, cy, .22, -.18, 14 * lvS); x.fillStyle = pc; x.beginPath(); x.ellipse(tx2, ty2, 9, 4.5, 0, 0, 7); x.fill();
      if (b.lv >= 2) cyl(x, cx, cy, .3, .12, .08, 11, '#d7d2c7');
      break;
    }
    case 'mine': {
      const [hx, hy] = P(cx, cy, -.12, .08); x.fillStyle = '#3a342e'; x.beginPath(); x.ellipse(hx, hy, 22, 11, 0, 0, 7); x.fill(); x.fillStyle = '#5a5047'; x.beginPath(); x.ellipse(hx, hy - 2, 16, 7, 0, 0, 7); x.fill();
      const [px, py] = P(cx, cy, .22, .14); x.fillStyle = '#8a7360'; x.beginPath(); x.moveTo(px - 16, py + 3); x.lineTo(px, py - 14 * lvS); x.lineTo(px + 14, py + 3); x.closePath(); x.fill(); x.fillStyle = '#a58c75'; x.beginPath(); x.moveTo(px - 16, py + 3); x.lineTo(px, py - 14 * lvS); x.lineTo(px - 2, py + 4); x.closePath(); x.fill();
      box(x, cx, cy, .16, -.22, .04, .04, 22 * lvS, '#59606b'); const [wx, wy] = P(cx, cy, .16, -.22, 22 * lvS); x.strokeStyle = pc; x.lineWidth = 2; x.beginPath(); x.arc(wx, wy - 4, 6, 0, 7); x.stroke();
      x.save(); x.translate(wx, wy - 4); x.rotate(time * (working ? 2 : 0)); x.beginPath(); x.moveTo(-6, 0); x.lineTo(6, 0); x.moveTo(0, -6); x.lineTo(0, 6); x.stroke(); x.restore();
      box(x, cx, cy, -.26, -.24, .1, .1, 9, '#cfc6b6'); gable(x, cx, cy, -.26, -.24, .12, .12, 9, 6, pc);
      break;
    }
    case 'plant': {
      box(x, cx, cy, -.12, .12, .2, .17, 18 * lvS, '#dcdcd6', { win: 'rgba(70,80,90,.3)', ws: 6 }); box(x, cx, cy, -.12, .12, .2, .17, 3, pc, { z: 18 * lvS });
      const [tx2, ty2] = P(cx, cy, .17, -.15); const r1 = 15, h = 38 * lvS;
      const g = x.createLinearGradient(tx2 - r1, 0, tx2 + r1, 0); g.addColorStop(0, '#e9e8e4'); g.addColorStop(.6, '#cfcdc6'); g.addColorStop(1, '#a9a69e');
      x.fillStyle = g; x.beginPath(); x.moveTo(tx2 - r1, ty2); x.quadraticCurveTo(tx2 - r1 * .55, ty2 - h * .6, tx2 - r1 * .72, ty2 - h); x.lineTo(tx2 + r1 * .72, ty2 - h); x.quadraticCurveTo(tx2 + r1 * .55, ty2 - h * .6, tx2 + r1, ty2); x.ellipse(tx2, ty2, r1, r1 / 2, 0, 0, Math.PI); x.fill();
      x.fillStyle = '#8f8c85'; x.beginPath(); x.ellipse(tx2, ty2 - h, r1 * .72, r1 * .3, 0, 0, 7); x.fill();
      if (working && Math.random() < .25) smoke(tx2, ty2 - h - 2, 'rgba(250,250,250,', true);
      break;
    }
    case 'mill': {
      box(x, cx, cy, -.06, .08, .34, .2, 15 * lvS, '#7d8794', { win: 'rgba(30,35,40,.35)', ws: 5 }); box(x, cx, cy, -.06, .08, .34, .2, 3, pc, { z: 15 * lvS });
      box(x, cx, cy, .24, -.24, .045, .045, 46 * lvS, '#c94a3a'); for (let z = 8; z < 46 * lvS; z += 10) box(x, cx, cy, .24, -.24, .047, .047, 3, '#f0ece4', { z });
      const [gx, gy] = P(cx, cy, -.25, .28, 4); if (working) { x.fillStyle = `rgba(255,${140 + Math.sin(time * 6) * 30 | 0},40,.85)`; x.fillRect(gx - 4, gy - 6, 8, 7); }
      const [sx, sy] = P(cx, cy, .24, -.24, 46 * lvS); if (working && Math.random() < .3) smoke(sx, sy - 2, 'rgba(90,90,95,', true);
      break;
    }
    case 'foodw': {
      box(x, cx, cy, -.02, .06, .3, .22, 13 * lvS, '#efe6d4', { win: 'rgba(120,100,70,.25)', ws: 5 });
      for (let i = 0; i < 3; i++) gable(x, cx, cy, -.22 + i * .2, .06, .1, .22, 13 * lvS, 7, pc);
      cyl(x, cx, cy, .28, -.26, .065, 20 * lvS, '#e3ddd0');
      const [sx, sy] = P(cx, cy, -.25, -.2, 0); box(x, cx, cy, -.25, -.22, .03, .03, 26 * lvS, '#b8b2a6'); if (working && Math.random() < .15) smoke(sx, sy - 26 * lvS, 'rgba(245,245,245,');
      break;
    }
    case 'fab': {
      box(x, cx, cy, 0, .04, .32, .26, 24 * lvS, '#f3f5f7', { edge: 'rgba(0,0,0,.08)' });
      const bandZ = 9 * lvS; poly(x, [P(cx, cy, -.32, .3, bandZ), P(cx, cy, .32, .3, bandZ), P(cx, cy, .32, .3, bandZ + 7), P(cx, cy, -.32, .3, bandZ + 7)], '#253645'); poly(x, [P(cx, cy, .32, -.22, bandZ), P(cx, cy, .32, .3, bandZ), P(cx, cy, .32, .3, bandZ + 7), P(cx, cy, .32, -.22, bandZ + 7)], '#1c2a37');
      poly(x, [P(cx, cy, -.32, .3, 0), P(cx, cy, .32, .3, 0), P(cx, cy, .32, .3, 3), P(cx, cy, -.32, .3, 3)], pc);
      box(x, cx, cy, -.12, -.06, .07, .07, 4, '#cfd5db', { z: 24 * lvS }); box(x, cx, cy, .12, .1, .07, .05, 4, '#cfd5db', { z: 24 * lvS });
      if (working) { const [lx, ly] = P(cx, cy, .32, .04, bandZ + 3.5); x.fillStyle = `rgba(79,199,174,${.5 + Math.sin(time * 3) * .3})`; x.fillRect(lx - 2, ly - 2, 4, 4); }
      break;
    }
    case 'port': {
      poly(x, diamond(cx, cy, .46), '#cfcac0');
      const cols = [pc, '#c94b3a', '#2f6b9a', '#3c8a5f', '#d8a234'];
      for (let i = 0; i < 6; i++) { const ox = -.28 + (i % 3) * .17, oy = -.05 + Math.floor(i / 3) * .2; box(x, cx, cy, ox, oy, .075, .045, 7, cols[(i + t.x) % 5]); if (i % 2 === 0) box(x, cx, cy, ox, oy, .075, .045, 7, cols[(i + t.y + 2) % 5], { z: 7 }); }
      const leg = (ox, oy) => { const a = P(cx, cy, ox, oy), bb = P(cx, cy, ox, oy, 46); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(bb[0], bb[1]); x.stroke(); };
      x.strokeStyle = pc; x.lineWidth = 2.6; leg(.18, -.32); leg(.18, .3); leg(-.06, -.32); leg(-.06, .3);
      const a1 = P(cx, cy, -.12, -.32, 46), a2 = P(cx, cy, .62, -.32, 46), b1 = P(cx, cy, -.12, .3, 46), b2 = P(cx, cy, .62, .3, 46);
      x.beginPath(); x.moveTo(a1[0], a1[1]); x.lineTo(a2[0], a2[1]); x.moveTo(b1[0], b1[1]); x.lineTo(b2[0], b2[1]); x.stroke();
      const k = working ? (Math.sin(time * .9 + t.y) + 1) / 2 : .5; const tr = P(cx, cy, .0 + k * .55, 0, 46); x.fillStyle = '#333'; x.fillRect(tr[0] - 4, tr[1] - 3, 8, 6); x.strokeStyle = '#333'; x.lineWidth = 1; x.beginPath(); x.moveTo(tr[0], tr[1]); x.lineTo(tr[0], tr[1] + 22 + Math.sin(time * 1.3) * 6); x.stroke();
      break;
    }
  }
  // 状态角标
  if (b.idle || b.stall) {
    const [bx, by] = P(cx, cy, 0, 0, 58); const col = b.idle ? '#e2483a' : '#f0a63a';
    x.fillStyle = col; x.beginPath(); x.arc(bx, by, 9, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '700 11px "Noto Sans SC",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(b.idle ? '停' : b.stall === 'typhoon' ? '风' : '缺', bx, by + .5);
  }
}
function drawBoat(x, bt, dt) {
  bt.p = (bt.p + dt * bt.sp) % bt.path.length; const i = Math.floor(bt.p), f = bt.p - i, a = bt.path[i], b = bt.path[(i + 1) % bt.path.length];
  const ax = a.x + .5, ay = a.y + .5, bx = (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > 2) ? ax : b.x + .5, by = (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > 2) ? ay : b.y + .5;
  const [cx, cy] = iso(ax + (bx - ax) * f, ay + (by - ay) * f); const s = bt.big ? 1.6 : 1, dir = (bx - ax) - (by - ay) >= 0 ? 1 : -1;
  x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(cx - dir * 10 * s, cy + 2, 10 * s, 2.5 * s, 0, 0, 7); x.fill();
  x.fillStyle = '#2d2a27'; x.beginPath(); x.moveTo(cx - 12 * s, cy - 2); x.lineTo(cx + 12 * s, cy - 2); x.lineTo(cx + 9 * s * dir, cy + 3); x.lineTo(cx - 9 * s * dir, cy + 3); x.closePath(); x.fill();
  x.fillStyle = bt.col; x.fillRect(cx - 8 * s, cy - 7 * s, 11 * s, 5 * s); x.fillStyle = '#eee'; x.fillRect(cx + (dir > 0 ? 4 : -9) * s, cy - 9 * s, 5 * s, 7 * s);
}
function drawBadges(x) { // 资源视图
  const m = R.m;
  for (const t of m.tiles) {
    if (!t.res && !t.port && !t.metro) continue;
    const [cx, cy] = iso(t.x + .5, t.y + .5);
    if (t.res) {
      const c = RES[t.res].col; x.fillStyle = 'rgba(14,18,24,.82)'; x.beginPath(); x.roundRect(cx - 18, cy - 9, 36, 18, 9); x.fill();
      x.fillStyle = c; x.beginPath(); x.arc(cx - 9, cy, 6, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '700 8px "Noto Sans SC",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(RES[t.res].n[0], cx - 9, cy + .5);
      x.fillStyle = '#f3d27c'; x.font = '700 9px Rajdhani,sans-serif'; x.fillText('★'.repeat(t.r), cx + 6, cy + .5);
    }
    if (t.metro) { x.fillStyle = '#9b7bdc'; x.beginPath(); x.arc(cx, cy - 14, 7, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '700 9px "Noto Sans SC"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('M', cx, cy - 13.5); }
  }
}
function rLoop(ts) {
  requestAnimationFrame(rLoop);
  const dt = Math.min(.05, (ts - (R.last || ts)) / 1000); R.last = ts; R.t += dt;
  const x = R.x, m = R.m; if (!x) return;
  x.setTransform(1, 0, 0, 1, 0, 0); x.scale(R.dpr, R.dpr);
  const g = x.createRadialGradient(R.W / 2, R.H * .45, 50, R.W / 2, R.H * .5, Math.max(R.W, R.H) * .8); g.addColorStop(0, '#1d2733'); g.addColorStop(1, '#0b0f14'); x.fillStyle = g; x.fillRect(0, 0, R.W, R.H);
  if (!m) return;
  if (R.drift) { R.cam.x += Math.sin(R.t * .07) * .25; R.cam.y += Math.cos(R.t * .05) * .12; }
  x.translate(R.W / 2, R.H / 2); x.scale(R.cam.z, R.cam.z); x.translate(-R.cam.x, -R.cam.y);
  const time = R.t;
  drawSides(x);
  for (const t of m.tiles) drawGround(x, t, time);
  drawOwnership(x);
  if (R.hl) for (const i of R.hl) { const t = m.tiles[i], [cx, cy] = iso(t.x + .5, t.y + .5); x.globalAlpha = .28 + Math.sin(time * 3) * .08; poly(x, diamond(cx, cy, .5), R.hlCol); x.globalAlpha = 1; }
  if (m.auction) { const [cx, cy] = iso(m.auction.x + .5, m.auction.y + .5); x.setLineDash([6, 4]); x.lineDashOffset = -time * 20; poly(x, diamond(cx, cy, .5), 'rgba(155,123,220,.25)', '#b79cf0', 2.4); x.setLineDash([]); }
  for (const bt of R.boats) if (bt.path.length > 1) drawBoat(x, bt, dt);
  const order = m.tiles.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);
  for (const t of order) {
    if (R.hover === t.y * MAP_W + t.x) { const [cx, cy] = iso(t.x + .5, t.y + .5); poly(x, diamond(cx, cy, .5), 'rgba(255,255,255,.14)', 'rgba(255,255,255,.75)', 1.6); }
    if (R.sel === t.y * MAP_W + t.x) { const [cx, cy] = iso(t.x + .5, t.y + .5); x.setLineDash([7, 5]); x.lineDashOffset = -time * 24; poly(x, diamond(cx, cy, .5), 'rgba(243,210,124,.18)', '#f3d27c', 2.6); x.setLineDash([]); }
    drawObj(x, t, time);
  }
  // 粒子
  for (const p of R.parts) { p.x += p.vx; p.y += p.vy; p.r += .06; p.a -= .006; }
  R.parts = R.parts.filter(p => p.a > 0); if (R.parts.length > 260) R.parts.splice(0, R.parts.length - 260);
  for (const p of R.parts) { x.fillStyle = p.col + p.a.toFixed(3) + ')'; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill(); }
  if (R.resView) drawBadges(x);
  // 进度条
  for (const t of m.tiles) if (t.b && t.b.prog > 0) { const [cx, cy] = iso(t.x + .5, t.y + .5); const tot = t.b.lv > 1 ? 5 : 6, f = 1 - t.b.prog / tot; x.fillStyle = 'rgba(14,18,24,.85)'; x.fillRect(cx - 18, cy - 70, 36, 6); x.fillStyle = '#f3d27c'; x.fillRect(cx - 17, cy - 69, 34 * f, 4); }
  // 浮字
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 13px Rajdhani,"Noto Sans SC",sans-serif';
  for (const f of R.floats) { f.t += dt; const a = 1 - f.t / 1.6; if (a <= 0) continue; x.globalAlpha = a; x.fillStyle = 'rgba(0,0,0,.5)'; x.fillText(f.txt, f.x + 1, f.y - f.t * 26 + 1); x.fillStyle = f.col; x.fillText(f.txt, f.x, f.y - f.t * 26); x.globalAlpha = 1; }
  R.floats = R.floats.filter(f => f.t < 1.6);
}
