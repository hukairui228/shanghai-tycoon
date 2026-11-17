// ===================== RENDER（Three.js 写实城市） =====================
// PBR 材质、太阳阴影、GTAO、反射水面、地表混合、昼夜循环、调色。对外接口：
// rInit / rSetMatch / camTo / rZoom / addFloat / tileScreen，以及 R.hover R.sel R.hl R.hlCol R.resView R.drift R.onClick R.onHover。
// 尺度：一格 10 个单位，1 单位约 4 米（一层楼高）。
const TS = 10;
const R = {
  cv: null, m: null, me: -1, W: 0, H: 0, hover: null, sel: null, hl: null, hlCol: '#7ee08a', resView: false, drift: false, onClick: null, onHover: null,
  cam: { tx: 0, tz: 0, dist: 260, yaw: Math.PI / 4, pitch: .9 }, tod: .3, todSpeed: 1 / 320, quality: 'high', t: 0, last: 0,
};
let RD = null;                          // three.js 对象容器
const tc = (x, y) => ({ x: (x + .5 - MAP_W / 2) * TS, z: (y + .5 - MAP_H / 2) * TS });
const GN = 160, GO = (GN - MAP_W) / 2, GH = GN * TS / 2;   // 外围世界：160×160 格，对局地图在正中
const WY = -.45;                                          // 水面高度（陆地为 0）
// 地块类型：0 草地 1 农田 2 矿坑 3 荒地 4 城市铺装 5 林地 6 沙滩 7 泥岸 8 河 9 海 10 村庄
const isWaterC = c => c === 8 || c === 9;

// ---------- 程序化纹理 ----------
function lattice(P, rnd) { const g = new Float32Array(P * P); for (let i = 0; i < g.length; i++) g[i] = rnd(); return g; }
function vnoise(g, P, x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const s = t => t * t * (3 - 2 * t); const a = g[((yi % P + P) % P) * P + ((xi % P + P) % P)], b = g[((yi % P + P) % P) * P + (((xi + 1) % P + P) % P)], c = g[(((yi + 1) % P + P) % P) * P + ((xi % P + P) % P)], d = g[(((yi + 1) % P + P) % P) * P + (((xi + 1) % P + P) % P)]; const u = s(xf), v = s(yf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbmMaker(seed, base, oct) { const rnd = mulberry32(seed), L = []; for (let o = 0; o < oct; o++) L.push({ P: base << o, g: lattice(base << o, rnd) }); return (u, v) => { let s = 0, a = .5, n = 0; for (const l of L) { s += vnoise(l.g, l.P, u * l.P, v * l.P) * a; n += a; a *= .5; } return s / n; }; }
function pixTex(size, fn, srgb) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), im = x.createImageData(size, size), d = im.data;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const [r, g, b] = fn(i / size, j / size, i, j), k = (j * size + i) * 4; d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255; }
  x.putImageData(im, 0, 0); return canvasTex(c, srgb);
}
function dataTex(size, fn) {
  const d = new Uint8Array(size * size * 4); for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const v = fn(i / size, j / size), k = (j * size + i) * 4; d[k] = v[0]; d[k + 1] = v[1]; d[k + 2] = v[2]; d[k + 3] = v[3]; }
  const t = new THREE.DataTexture(d, size, size); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
function canvasTex(c, srgb) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = RD ? RD.aniso : 4; return t; }
function normalFromHeight(size, hf, k) {
  const h = new Float32Array(size * size); for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) h[j * size + i] = hf(i / size, j / size);
  return pixTex(size, (u, v, i, j) => { const l = h[j * size + (i - 1 + size) % size], r = h[j * size + (i + 1) % size], t = h[((j - 1 + size) % size) * size + i], b = h[((j + 1) % size) * size + i]; let nx = (l - r) * k, ny = (t - b) * k, nz = 1; const L = Math.hypot(nx, ny, nz); return [(nx / L * .5 + .5) * 255, (ny / L * .5 + .5) * 255, (nz / L * .5 + .5) * 255]; }, false);
}
const mix = (a, b, t) => a + (b - a) * t;
const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const hash3 = (x, y, z) => { const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return h - Math.floor(h); };

function makeTextures() {
  const T = {}, n1 = fbmMaker(11, 4, 5), n2 = fbmMaker(23, 8, 4), n3 = fbmMaker(37, 16, 3), n4 = fbmMaker(41, 32, 2), grain = mulberry32(5), G = k => 1 + (grain() - .5) * k;
  const q1 = fbmMaker(51, 4, 4), q2 = fbmMaker(52, 4, 4), q3 = fbmMaker(53, 8, 4), q4 = fbmMaker(54, 8, 4);
  T.noise = dataTex(256, (u, v) => [q1(u, v) * 255, q2(u, v) * 255, q3(u, v) * 255, q4(u, v) * 255]);
  // 地表：草地、农田、矿坑、荒地、铺装、沙滩
  T.grass = pixTex(512, (u, v) => { const a = n1(u, v), b = n3(u, v), c = n2(u, v), d = n4(u, v);
    let col = mixC([70, 80, 44], [104, 110, 64], clamp((a - .3) * 2.2, 0, 1));
    col = mixC(col, [132, 124, 86], clamp((c - .58) * 3, 0, 1) * .8);
    col = mixC(col, [46, 58, 31], clamp((.42 - b) * 3, 0, 1) * .7);
    const k = (.84 + d * .3) * G(.16); return col.map(q => q * k); });
  T.farm = (() => { const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = mulberry32(77);
    const crops = [[84, 106, 50], [64, 86, 40], [158, 144, 80], [108, 122, 60], [118, 98, 70], [92, 76, 56], [136, 130, 70], [74, 98, 46]];
    x.fillStyle = 'rgb(122,110,86)'; x.fillRect(0, 0, S, S);
    let cx = 0; while (cx < S) { let w = 64 + Math.floor(r() * 4) * 32; if (cx + w > S - 48) w = S - cx; let cy = 0;
      while (cy < S) { let h = 48 + Math.floor(r() * 5) * 24; if (cy + h > S - 40) h = S - cy; const col = crops[Math.floor(r() * crops.length)], vert = r() < .5;
        x.fillStyle = `rgb(${col})`; x.fillRect(cx + 2, cy + 2, w - 4, h - 4); x.fillStyle = 'rgba(0,0,0,.13)';
        if (vert) for (let i = cx + 4; i < cx + w - 3; i += 5) x.fillRect(i, cy + 2, 2, h - 4); else for (let j = cy + 4; j < cy + h - 3; j += 5) x.fillRect(cx + 2, j, w - 4, 2);
        cy += h; }
      cx += w; }
    const im = x.getImageData(0, 0, S, S), d = im.data; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const k = (j * S + i) * 4, f = (.82 + n2(i / S, j / S) * .32 + (n4(i / S, j / S) - .5) * .14) * G(.1); d[k] *= f; d[k + 1] *= f; d[k + 2] *= f; }
    x.putImageData(im, 0, 0); return canvasTex(c); })();
  T.rock = pixTex(256, (u, v) => { const a = n1(u, v), b = n3(u, v), c = n2(u, v), d = n4(u, v), s = ((v + a * .2) * 4) % 1; let col = mixC([126, 118, 104], [154, 144, 124], c); col = mixC(col, [150, 128, 96], clamp((a - .5) * 2.5, 0, 1) * .5); const bench = s < .05 ? .88 : s < .09 ? 1.05 : 1; return col.map(q => q * bench * (.86 + b * .2 + (d - .5) * .12) * G(.24)); });
  T.scrub = pixTex(256, (u, v) => { const a = n1(u, v), b = n3(u, v), c = n2(u, v), d = n4(u, v); let col = mixC([132, 118, 88], [156, 140, 106], a); col = mixC(col, [74, 78, 46], clamp((b - .58) * 4, 0, 1)); col = mixC(col, [104, 92, 70], clamp((c - .6) * 3, 0, 1) * .5); return col.map(q => q * (.86 + d * .26) * G(.16)); });
  T.pave = pixTex(256, (u, v, i, j) => { const a = n2(u, v), d = n4(u, v), joint = (i % 32 < 1 || j % 32 < 1) ? .8 : 1, slab = hash3(i >> 5, j >> 5, 3); const g = (118 + a * 26 + slab * 14) * (.9 + d * .16) * joint * G(.08); return [g, g * .985, g * .95]; });
  T.beach = pixTex(256, (u, v) => { const a = n1(u, v), d = n4(u, v); const col = mixC([168, 154, 120], [190, 176, 140], a); return col.map(q => q * (.9 + d * .16) * G(.1)); });
  // 树叶、杂项材质
  T.leaf = pixTex(128, (u, v) => { const a = n4(u, v), b = n3(u * 2, v * 2); const g = 150 + a * 70 + (b - .5) * 60 + (grain() - .5) * 80; return [g, g, g]; });
  T.leafN = normalFromHeight(128, (u, v) => n4(u, v) + n3(u * 2, v * 2) * .6, 5);
  T.concrete = pixTex(256, (u, v) => { const a = n2(u, v), b = n3(u, v); const g = (150 + a * 36 + (b - .5) * 18) * G(.06); return [g, g - 2, g - 6]; });
  T.metal = pixTex(256, (u, v, i) => { const rib = (i % 16) < 3 ? .78 : (i % 16) < 6 ? 1.08 : 1, a = n3(u, v); const g = (120 + a * 30) * rib; return [g * .94, g, g * 1.04]; });
  T.metalR = pixTex(256, (u, v) => { const a = n2(u, v); return [0, 120 + a * 100, 0]; }, false);
  T.roof = pixTex(256, (u, v) => { const a = n3(u * 2, v * 2), b = n1(u, v); const g = (96 + a * 30 + b * 18) * G(.1); return [g, g, g + 2]; });
  T.soil = pixTex(128, (u, v) => { const a = n2(u, v), band = Math.sin(v * Math.PI * 16) * .05; return [112 * (.85 + a * .3 + band), 90 * (.85 + a * .3 + band), 66 * (.85 + a * .3 + band)]; });
  T.waterN = normalFromHeight(256, (u, v) => fbmMaker(77, 4, 4)(u, v) * .6 + n3(u, v) * .4, 3);
  T.container = pixTex(128, (u, v, i) => { const rib = (i % 8) < 2 ? .8 : 1; const g = 220 * rib; return [g, g, g]; });
  T.smoke = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return canvasTex(c); })();
  T.lattice = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(0, 0, 64, 64); x.lineWidth = 5; x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke(); return canvasTex(c, false); })();
  T.grime = pixTex(512, (u, v) => { const g = 212 + n2(u, v) * 34 + n3(u * 2, v * 2) * 20 - Math.max(0, n1(u, v) - .55) * 110; return [g, g, g]; }).image;
  return T;
}

// 立面：8 层一张图（8 单位见方），玻璃幕墙 / 石材 / 窗带 / 住宅 / 商铺
const FK = {
  cwBlue: { cw: 1, tint: [92, 118, 140] }, cwTeal: { cw: 1, tint: [84, 118, 116] }, cwDark: { cw: 1, tint: [54, 62, 70] }, cwSilver: { cw: 1, tint: [112, 122, 130], span: [96, 102, 108] },
  office: { wall: [184, 178, 166], win: [58, 70, 82], cols: 12, ww: .6, wh: .5 }, stone: { wall: [196, 186, 168], win: [54, 64, 74], cols: 6, ww: .66, wh: .58 },
  brick: { wall: [128, 84, 66], win: [50, 56, 60], cols: 8, ww: .46, wh: .46, brick: 1 }, ribbon: { wall: [184, 182, 176], win: [64, 80, 94], ribbon: 1 },
  resi: { wall: [194, 189, 178], resi: 1 }, resiB: { wall: [184, 168, 146], resi: 1 }, shop: { shop: 1 },
};
function facadeTex(kind, T) {
  const S = 512, F = 8, fh = S / F, sp = FK[kind];
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const c = mk(), e = mk(), r = mk(), x = c.getContext('2d'), xe = e.getContext('2d'), xr = r.getContext('2d');
  let seed = 7; for (const ch of kind) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; const rnd = mulberry32(seed);
  const rgb = (a, k = 1) => `rgb(${a.map(q => Math.round(clamp(q * k, 0, 255))).join(',')})`, R8 = v => `rgb(0,${Math.round(clamp(v, 0, 1) * 255)},0)`;
  xe.fillStyle = '#000'; xe.fillRect(0, 0, S, S);
  const lit = (px, py, pw, ph, p) => { if (rnd() >= p) return; const warm = rnd() < .72; xe.globalAlpha = .3 + rnd() * .7; xe.fillStyle = warm ? `rgb(255,${200 + rnd() * 40 | 0},${130 + rnd() * 60 | 0})` : 'rgb(205,226,255)'; xe.fillRect(px, py, pw, ph); if (rnd() < .4) { xe.globalAlpha *= .6; xe.fillStyle = '#000'; xe.fillRect(px, py, pw * (.2 + rnd() * .5), ph); } xe.globalAlpha = 1; };
  if (sp.cw) {
    const C = 16, cw = S / C, t = sp.tint, vh = fh - 14;
    for (let j = 0; j < F; j++) { const y0 = j * fh, fk = .92 + rnd() * .16, flit = rnd() < .16;
      for (let i = 0; i < C; i++) { const k = fk * (.86 + rnd() * .24) * (rnd() < .06 ? 1.3 : 1); const gr = x.createLinearGradient(0, y0, 0, y0 + vh); gr.addColorStop(0, rgb(t, k * 1.1)); gr.addColorStop(1, rgb(t, k * .9)); x.fillStyle = gr; x.fillRect(i * cw, y0, cw, vh); xr.fillStyle = R8(.03 + rnd() * .12); xr.fillRect(i * cw, y0, cw, vh); lit(i * cw + 2, y0 + 2, cw - 4, vh - 4, flit ? .85 : .2); }
      x.fillStyle = rgb(sp.span || t, sp.span ? 1 : .55); x.fillRect(0, y0 + vh, S, 14); xr.fillStyle = R8(.35); xr.fillRect(0, y0 + vh, S, 14); }
    x.fillStyle = rgb([158, 164, 170], .85); xr.fillStyle = R8(.5);
    for (let i = 0; i < C; i++) { x.fillRect(i * cw, 0, 2, S); xr.fillRect(i * cw, 0, 2, S); }
    for (let j = 0; j < F; j++) { x.fillRect(0, j * fh + vh, S, 2); x.fillRect(0, j * fh, S, 1); }
    x.globalAlpha = .5; x.globalCompositeOperation = 'multiply'; x.drawImage(T.grime, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  } else if (sp.shop) {
    x.fillStyle = 'rgb(46,52,58)'; x.fillRect(0, 0, S, S); xr.fillStyle = R8(.12); xr.fillRect(0, 0, S, S);
    for (let j = 0; j < F; j++) { const y0 = j * fh, w = S / 12; for (let i = 0; i < 12; i++) { x.fillStyle = rgb([62, 70, 76], .85 + rnd() * .35); x.fillRect(i * w + 2, y0 + 12, w - 4, fh - 14); lit(i * w + 2, y0 + 12, w - 4, fh - 14, .8); }
      x.fillStyle = 'rgb(36,38,42)'; x.fillRect(0, y0, S, 12); xr.fillStyle = R8(.5); xr.fillRect(0, y0, S, 12); }
  } else {
    x.fillStyle = rgb(sp.wall); x.fillRect(0, 0, S, S); xr.fillStyle = R8(.88); xr.fillRect(0, 0, S, S);
    if (sp.brick) { x.fillStyle = 'rgba(70,52,44,.35)'; for (let yy = 0; yy < S; yy += 6) { x.fillRect(0, yy, S, 1); for (let xx = ((yy / 6) % 2) * 8; xx < S; xx += 16) x.fillRect(xx, yy, 1, 6); } }
    x.globalCompositeOperation = 'multiply'; x.drawImage(T.grime, 0, 0); x.globalCompositeOperation = 'source-over';
    for (let j = 0; j < F; j++) { const y0 = j * fh;
      x.fillStyle = 'rgba(0,0,0,.07)'; x.fillRect(0, y0, S, 3);
      if (sp.ribbon) { const wy = y0 + fh * .3, wh = fh * .44, w = S / 24; x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, wy - 2, S, wh + 3);
        for (let i = 0; i < 24; i++) { x.fillStyle = rgb(sp.win, .82 + rnd() * .3); x.fillRect(i * w + 1, wy, w - 2, wh); xr.fillStyle = R8(.1 + rnd() * .1); xr.fillRect(i * w + 1, wy, w - 2, wh); lit(i * w + 1, wy, w - 2, wh, .3); } }
      else if (sp.resi) { const U = S / 8;
        for (let i = 0; i < 8; i++) { const ux = i * U, wx = ux + 6, wy = y0 + fh * .26, ww = 22, wh = fh * .48;
          x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(wx - 2, wy - 2, ww + 3, wh + 3); x.fillStyle = rgb([70, 80, 88], .8 + rnd() * .35); x.fillRect(wx, wy, ww, wh); xr.fillStyle = R8(.12); xr.fillRect(wx, wy, ww, wh); x.fillStyle = 'rgba(220,220,214,.6)'; x.fillRect(wx + ww / 2, wy, 1, wh); lit(wx, wy, ww, wh, .36);
          x.fillStyle = rgb([196, 196, 190], .9 + rnd() * .1); x.fillRect(wx + 4, wy + wh + 4, 12, 8); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(wx + 4, wy + wh + 11, 12, 2);
          const bx = ux + 33, by = y0 + fh * .12, bw = U - 38, bh = fh * .78; x.fillStyle = rgb([84, 88, 90], .85 + rnd() * .2); x.fillRect(bx, by, bw, bh); x.fillStyle = rgb([92, 104, 112], .9 + rnd() * .2); x.fillRect(bx + 3, by + 4, bw - 6, bh * .62); lit(bx + 3, by + 4, bw - 6, bh * .62, .3); xr.fillStyle = R8(.2); xr.fillRect(bx, by, bw, bh);
          x.fillStyle = rgb(sp.wall, .92); x.fillRect(bx, by + bh * .58, bw, bh * .42); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(bx, by + bh * .58, bw, 2); } }
      else { const C = sp.cols, cw = S / C, ww = cw * sp.ww, wh = fh * sp.wh;
        for (let i = 0; i < C; i++) { const wx = i * cw + (cw - ww) / 2, wy = y0 + fh * .24, k = .8 + rnd() * .35; x.fillStyle = 'rgba(0,0,0,.32)'; x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
          const gr = x.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, rgb(sp.win, k * 1.15)); gr.addColorStop(1, rgb(sp.win, k * .85)); x.fillStyle = gr; x.fillRect(wx, wy, ww, wh); xr.fillStyle = R8(.1); xr.fillRect(wx, wy, ww, wh);
          x.fillStyle = 'rgba(210,210,206,.55)'; x.fillRect(wx + ww / 2, wy, 1.5, wh); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(wx - 2, wy + wh + 2, ww + 4, 2); lit(wx, wy, ww, wh, .3); } }
    }
    for (let k = 0; k < 90; k++) { x.fillStyle = 'rgba(40,34,28,.05)'; x.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 16 + rnd() * 70); }
  }
  return { map: canvasTex(c), emis: canvasTex(e), rough: canvasTex(r, false) };
}

// ---------- 材质 ----------
const SPLAT_GLSL = `
  vec2 p = vW.xz;
  vec4 nzA = texture2D(tNz, p * .0023), nzB = texture2D(tNz, p * .019);
  vec2 suv = (p - uSp.xy) * uSp.zw + ((nzA.xy - .5) * 20. + (nzB.zw - .5) * 6.) * uSp.zw;
  vec4 a = texture2D(tS0, suv), b = texture2D(tS1, suv), j = (nzB - .5) * .5;
  a = pow(clamp(a + j, 0., 1.), vec4(5.)); b = pow(clamp(b + j.yxwz, 0., 1.), vec4(5.));
  float sw = dot(a, vec4(1.)) + dot(b, vec4(1.)) + 1e-5; a /= sw; b /= sw;
  vec3 gr = mix(texture2D(tGr, p * .05).rgb, texture2D(tGr, p * .0131 + .37).rgb, .4);
  vec3 sc = texture2D(tSc, p * .045).rgb;
  vec3 col = gr * a.x + texture2D(tFa, p * .025).rgb * a.y + texture2D(tRo, p * .04).rgb * a.z + sc * a.w
    + texture2D(tPa, p * .08).rgb * b.x + gr * vec3(.64, .7, .6) * b.y + texture2D(tBe, p * .05).rgb * b.z + sc * vec3(.6, .58, .52) * b.w;
  col *= .86 + nzA.z * .28;
  diffuseColor.rgb *= col;
`;
function terrainMat(T) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .96, metalness: 0 });
  const u = { tS0: { value: null }, tS1: { value: null }, tNz: { value: T.noise }, tGr: { value: T.grass }, tFa: { value: T.farm }, tRo: { value: T.rock }, tSc: { value: T.scrub }, tPa: { value: T.pave }, tBe: { value: T.beach }, uSp: { value: new THREE.Vector4(-GH, -GH, 1 / (GN * TS), 1 / (GN * TS)) } };
  mat.userData.u = u; mat.customProgramCacheKey = () => 'terrain';
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform sampler2D tS0, tS1, tNz, tGr, tFa, tRo, tSc, tPa, tBe; uniform vec4 uSp; varying vec3 vW;\n' + sh.fragmentShader.replace('#include <map_fragment>', SPLAT_GLSL); };
  return mat;
}
function makeMaterials(T) {
  const S = o => new THREE.MeshStandardMaterial(o), M = {};
  M.terrain = terrainMat(T);
  M.concrete = S({ map: T.concrete, roughness: .88 });
  M.trim = S({ color: 0x9a978f, roughness: .75 });
  M.roofDark = S({ map: T.roof, color: 0x6e6e6c, roughness: .95 });
  M.tank = S({ color: 0xb4b2aa, roughness: .55, metalness: .1, envMapIntensity: .7 });
  M.steel = S({ map: T.metal, roughnessMap: T.metalR, color: 0xb4bbc0, metalness: .7, roughness: .6 });
  M.steelDark = S({ map: T.metal, color: 0x585e64, metalness: .65, roughness: .62 });
  M.galv = S({ color: 0x8e9498, metalness: .8, roughness: .48, envMapIntensity: .75 });
  M.clad = S({ map: T.metal, color: 0x9aa2a7, metalness: .12, roughness: .62 });
  M.cladBlue = S({ map: T.metal, color: 0x8a96a0, metalness: .1, roughness: .62 });
  M.cladRust = S({ map: T.metal, color: 0x8f7a68, metalness: .08, roughness: .75 });
  M.cladWhite = S({ map: T.metal, color: 0xbebdb6, metalness: .08, roughness: .6 });
  M.panel = S({ color: 0xc2c1bb, roughness: .55, metalness: .05 });
  M.soil = S({ map: T.soil, roughness: 1 });
  M.rockPile = S({ map: T.beach, color: 0x8a857c, roughness: 1 });
  M.coal = S({ color: 0x2b2826, roughness: .95 });
  M.dark = S({ color: 0x24282c, roughness: .7, metalness: .2 });
  M.hull = S({ color: 0x2c343b, roughness: .6, metalness: .3 });
  M.hullRed = S({ color: 0x6b2a24, roughness: .7 });
  M.white = S({ color: 0xcfcfca, roughness: .5 });
  M.yellow = S({ color: 0xd2a02c, roughness: .55, metalness: .35 });
  M.lattice = S({ color: 0xd2a02c, roughness: .55, metalness: .35, alphaMap: T.lattice, alphaTest: .5, side: THREE.DoubleSide });
  M.net = S({ color: 0x24502e, roughness: 1, transparent: true, opacity: .72, side: THREE.DoubleSide });
  M.greenhouse = S({ color: 0xc9d1cf, roughness: .25, transparent: true, opacity: .62, side: THREE.DoubleSide, envMapIntensity: .6 });
  M.redBand = S({ color: 0xa8392e, roughness: .6 });
  M.coolT = S({ map: T.concrete, color: 0xb8b4ac, roughness: .92, side: THREE.DoubleSide });
  M.pearl = S({ color: 0x7a3452, roughness: .3, metalness: .5, envMapIntensity: 1.2, emissive: 0xff4a88, emissiveIntensity: 0 });
  M.trunk = S({ color: 0x4a3a2c, roughness: 1 });
  M.leaf = S({ vertexColors: true, map: T.leaf, normalMap: T.leafN, roughness: .92 });
  M.glow = S({ color: 0x111111, emissive: 0xffb050, emissiveIntensity: 2 });
  M.lamp = S({ color: 0x8a8a86, emissive: 0xffd49a, emissiveIntensity: 0 });
  M.pole = S({ color: 0x55595d, metalness: .6, roughness: .5 });
  M.road = S({ map: roadTex(), roughness: .9 });
  M.walk = S({ map: T.pave, roughness: .9 });
  M.grassPatch = S({ map: T.grass, roughness: .97 });
  M.car = S({ vertexColors: true, roughness: .32, metalness: .55 });
  M.house = S({ roughness: .85 }); M.houseRoof = S({ map: T.roof, roughness: .8 });
  M.water = S({ color: 0x17363c, roughness: .08, metalness: .25, normalMap: T.waterN, normalScale: new THREE.Vector2(.3, .3) });
  M.fac = {};
  for (const k in FK) { const f = facadeTex(k, T), cw = !!FK[k].cw; M.fac[k] = S({ map: f.map, roughnessMap: f.rough, roughness: 1, metalness: cw ? .6 : 0, emissive: 0xffffff, emissiveMap: f.emis, emissiveIntensity: 0, envMapIntensity: cw ? 1.05 : .65 }); }
  M.container = ['#9a3a2e', '#2d5a80', '#b88430', '#3b6e4e', '#74777c', '#7e4064', '#c8c4ba'].map(c => S({ map: T.container, color: c, roughness: .6, metalness: .35 }));
  M.pc = {}; M.pcGlow = {};
  return M;
}
// 公司色：降低饱和度，避免玩具感
function pcMat(col) { if (!RD.M.pc[col]) { const c = new THREE.Color(col), h = {}, sr = THREE.SRGBColorSpace; c.getHSL(h, sr); c.setHSL(h.h, h.s * .62, Math.min(.5, h.l), sr); RD.M.pc[col] = new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .3 }); } return RD.M.pc[col]; }
function pcGlow(col) { if (!RD.M.pcGlow[col]) RD.M.pcGlow[col] = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .5, roughness: .4 }); return RD.M.pcGlow[col]; }

// ---------- 几何工具 ----------
function boxG(w, h, d, unit) {
  const g = new THREE.BoxGeometry(w, h, d); if (!unit) return g; const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / unit, uv.getY(i) * dims[f][1] / unit); }
  return g;
}
function cylG(rt, rb, h, seg, unit) { const g = new THREE.CylinderGeometry(rt, rb, h, seg || 20); if (unit) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * rb / unit, uv.getY(i) * h / unit); } return g; }
function add(grp, geo, mat, x, y, z, o) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o && o.ry) m.rotation.y = o.ry; if (o && o.rx) m.rotation.x = o.rx; if (o && o.rz) m.rotation.z = o.rz;
  m.castShadow = !(o && o.noShadow); m.receiveShadow = true; if (o && o.keep) m.userData.keep = true; grp.add(m); return m;
}
function gableRoof(grp, x, y, z, w, d, rh, mat) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, rh); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2); return add(grp, g, mat, x, y, z, { ry: Math.PI / 2 });
}
function lathe(grp, pts, mat, x, y, z) { const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), 36); return add(grp, g, mat, x, y, z); }
function flag(grp, x, z, h, col) { add(grp, cylG(.05, .05, h, 6), RD.M.galv, x, h / 2, z); add(grp, boxG(1.3, .75, .03), pcMat(col), x + .66, h - .42, z, { noShadow: true }); }
// 把同材质的静态部件合并成一个网格，减少绘制调用
function bake(g) {
  const groups = new Map();
  for (const c of g.children) { if (!c.isMesh || c.isInstancedMesh || c.userData.keep) continue; const key = c.material.uuid + (c.castShadow ? 's' : 'n'); if (!groups.has(key)) groups.set(key, { mat: c.material, cast: c.castShadow, list: [] }); groups.get(key).list.push(c); }
  for (const { mat, cast, list } of groups.values()) {
    if (list.length < 2) continue;
    const gs = list.map(c => { c.updateMatrix(); const geo = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(); for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k); if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2)); geo.clearGroups(); geo.applyMatrix4(c.matrix); return geo; });
    const merged = mergeGeometries(gs); gs.forEach(q => q.dispose()); if (!merged) continue;
    list.forEach(c => { g.remove(c); c.geometry.dispose(); });
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = cast; mesh.receiveShadow = true; g.add(mesh);
  }
  return g;
}

// ---------- 初始化 ----------
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: .26 }, uSat: { value: 1.04 }, uCon: { value: 1.05 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float uVig, uSat, uCon; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(.2126, .7152, .0722)); col = mix(vec3(l), col, uSat); col = (col - .5) * uCon + .5; vec2 d = vUv - .5; col *= 1. - uVig * dot(d, d) * 2.2; gl_FragColor = vec4(clamp(col, 0., 1.), c.a); }',
};
function rInit(cv) {
  R.cv = cv;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
  // 画质：手机与软件渲染（无显卡）用低画质；?q=high / ?q=low 可强制
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info'), gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  let qp = null; try { qp = new URLSearchParams(location.search).get('q'); } catch (e) { }
  const mobile = innerWidth < 760 || matchMedia('(pointer:coarse)').matches, soft = /swiftshader|llvmpipe|software/i.test(gpu);
  R.quality = ['high', 'low', 'soft'].includes(qp) ? qp : soft ? 'soft' : mobile ? 'low' : 'high'; const lowQ = R.quality !== 'high';
  renderer.setPixelRatio(R.quality === 'soft' ? .5 : Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = R.quality !== 'soft'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .5; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(33, 1, 2, 4500);
  camera.layers.enable(1);   // 第 1 层：树、车、村庄、路灯——不进水面反射
  RD = { gpu, renderer, scene, camera, aniso: renderer.capabilities.getMaxAnisotropy(), objs: [], anims: [], emit: [], smoke: [], world: null, overlay: null, frame: 0 };
  const t0 = performance.now(); RD.T = makeTextures(); RD.tTex = performance.now() - t0; RD.M = makeMaterials(RD.T); RD.tMat = performance.now() - t0 - RD.tTex;
  // 天空与光照
  const sky = new Sky(); sky.scale.setScalar(4400); scene.add(sky); RD.sky = sky;
  const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.5; su.mieCoefficient.value = .005; su.mieDirectionalG.value = .8;
  RD.skyScene = new THREE.Scene(); RD.sky2 = new Sky(); RD.sky2.scale.setScalar(4400); RD.skyScene.add(RD.sky2); for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) RD.sky2.material.uniforms[k].value = su[k].value;
  RD.pmrem = new THREE.PMREMGenerator(renderer);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; const sm = lowQ ? 2048 : 4096; sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -150; sc.right = sc.top = 150; sc.near = 10; sc.far = 900; sun.shadow.bias = -.0002; sun.shadow.normalBias = .3;
  scene.add(sun); scene.add(sun.target); RD.sun = sun;
  RD.hemi = new THREE.HemisphereLight(0xa9bdd6, 0x4d4536, .3); scene.add(RD.hemi);
  scene.fog = new THREE.Fog(0xb9c8d6, 300, 1600);
  // 后期：多重采样 → GTAO → 泛光 → 输出 → 调色
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: lowQ ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
  if (!lowQ) { const ao = new GTAOPass(scene, camera, 1, 1); ao.updateGtaoMaterial({ radius: 2.4, distanceExponent: 1.6, thickness: 4, scale: 1.15 }); ao.blendIntensity = 1; const ov = ao.overrideVisibility.bind(ao); ao.overrideVisibility = function () { ov(); this.scene.traverse(o => { if (o.isSprite) o.visible = false; }); }; composer.addPass(ao); RD.ao = ao; }
  RD.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .2, .5, .85); composer.addPass(RD.bloom);
  composer.addPass(new OutputPass()); RD.grade = new ShaderPass(GradeShader); composer.addPass(RD.grade); RD.composer = composer;
  // 浮字层
  let fl = document.getElementById('f3'); if (!fl) { fl = document.createElement('div'); fl.id = 'f3'; document.body.appendChild(fl); } RD.floatEl = fl; RD.floats = [];
  const rs = () => { R.W = innerWidth; R.H = innerHeight; renderer.setSize(R.W, R.H, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(R.W, R.H); camera.aspect = R.W / R.H; camera.updateProjectionMatrix(); };
  rs(); addEventListener('resize', rs);
  rInput(cv); setSun(true);
  requestAnimationFrame(rLoop);
}

// ---------- 世界 ----------
function rSetMatch(m, me) {
  R.m = m; R.me = me; R.sel = null; R.hover = null; R.hl = null;
  const { scene } = RD;
  if (RD.world) { scene.remove(RD.world); disposeTree(RD.world); }
  RD.anims = []; RD.emit = []; RD.objs = m.tiles.map(() => null); RD.boats = []; RD.cars = null; RD.smoke = []; RD.water = null;
  const W = new THREE.Group(); RD.world = W; scene.add(W);
  const t0 = performance.now(); RD.cells = buildCells(m);
  buildGround(m);
  buildRoads(m);
  buildTrees(m);
  buildVillages(m);
  // 叠加层
  RD.overlay = new THREE.Group(); W.add(RD.overlay); RD.ownSig = '';
  RD.hlMesh = null; RD.hlSig = '';
  RD.selMesh = outlineMesh(0xf3d27c, .95); RD.hovMesh = outlineMesh(0xffffff, .6); RD.aucMesh = outlineMesh(0xb79cf0, 1); W.add(RD.selMesh, RD.hovMesh, RD.aucMesh);
  RD.badges = new THREE.Group(); W.add(RD.badges); RD.badgeSig = '';
  RD.status = new THREE.Group(); W.add(RD.status);
  // 船：江上驳船，海上货轮
  const river = m.tiles.filter(t => t.t === 'water').sort((a, b) => b.y - a.y || a.x - b.x);
  if (river.length > 4) for (const o of [0, .33, .66]) RD.boats.push(makeBoat(W, river, o * river.length, .5, false));
  const sea = m.tiles.filter(t => t.t === 'sea' && t.x === MAP_W - 2).sort((a, b) => a.y - b.y);
  if (sea.length) { RD.boats.push(makeBoat(W, sea, 2, .3, true)); RD.boats.push(makeBoat(W, sea.slice().reverse(), 11, .26, true)); }
  syncTiles(true); RD.tWorld = performance.now() - t0;
  fitCam();
}
function disposeTree(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); }); }
function outlineMesh(col, op) {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false });
  const L = TS - .3, w = .26; for (const [x, z, a, b] of [[0, -L / 2, L, w], [0, L / 2, L, w], [-L / 2, 0, w, L], [L / 2, 0, w, L]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(a, .08, b), mat); m.position.set(x, .2, z); g.add(m); }
  g.visible = false; g.renderOrder = 5; return g;
}
// 外围世界网格：地图内照搬地块，地图外按噪声生成林地、农田、村庄，江和海沿边界延伸
function buildCells(m) {
  const C = new Uint8Array(GN * GN), fA = fbmMaker(m.seed + 101, 4, 4), fB = fbmMaker(m.seed + 202, 4, 4), fV = fbmMaker(m.seed + 303, 8, 3), rnd = mulberry32(m.seed + 404);
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
    const x = i - GO, y = j - GO, inX = x >= 0 && x < MAP_W, inY = y >= 0 && y < MAP_H; let c = -1;
    if (inX && inY) { const t = m.tiles[y * MAP_W + x]; c = t.t === 'water' ? 8 : t.t === 'sea' ? 9 : (t.t === 'urban' || t.t === 'landmark') ? 4 : t.res === 'food' ? 1 : t.res === 'ore' ? 2 : t.res === 'oil' ? 3 : t.deco > .6 ? 5 : 0; }
    else {
      if (inX !== inY) { const e = m.tiles[clamp(y, 0, MAP_H - 1) * MAP_W + clamp(x, 0, MAP_W - 1)]; if (e.t === 'water') c = 8; else if (e.t === 'sea') c = 9; }
      else if (x >= MAP_W - 3) c = 9;
      if (c < 0) { const u = i / GN, v = j / GN; c = fB(u, v) > .56 ? 5 : fA(u, v) > .5 ? 1 : 0; if (c !== 5 && fV(u, v) > .64 && rnd() < .6) c = 10; }
    }
    C[j * GN + i] = c;
  }
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const x = i - GO, y = j - GO; if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) continue; const k = j * GN + i; if (isWaterC(C[k])) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + dx, b = j + dy; if (a >= 0 && b >= 0 && a < GN && b < GN && C[b * GN + a] === 9) { C[k] = 6; break; } } }
  return C;
}
function cellAt(x, y) { const i = x + GO, j = y + GO; if (i < 0 || j < 0 || i >= GN || j >= GN) return 0; return RD.cells[j * GN + i]; }
function buildGround(m) {
  const C = RD.cells, L = 3200, land = [], water = [], walls = [], cx = i => (i - GN / 2) * TS;
  const quadL = (x0, z0, x1, z1) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2); land.push(g); };
  const quadW = (x0, z0, x1, z1) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.translate((x0 + x1) / 2, -(z0 + z1) / 2, 0); water.push(g); };
  for (let j = 0; j < GN; j++) { let i = 0; while (i < GN) { const w = isWaterC(C[j * GN + i]); let k = i; while (k < GN && isWaterC(C[j * GN + k]) === w) k++; (w ? quadW : quadL)(cx(i), cx(j), cx(k), cx(j + 1)); i = k; } }
  const coast = (MAP_W - 3 - MAP_W / 2) * TS;
  quadL(-L, -L, -GH, L); quadL(-GH, -L, coast, -GH); quadL(-GH, GH, coast, L);
  quadW(coast, -L, L, -GH); quadW(coast, GH, L, L); quadW(GH, -GH, L, GH);
  // 堤岸：陆地与水面相接处的混凝土护岸
  const isW = (i, j) => { if (i < 0 || j < 0 || i >= GN || j >= GN) return false; return isWaterC(C[j * GN + i]); };
  const wall = (x, z, horiz) => { const g = boxG(horiz ? TS + .3 : .3, 1.1, horiz ? .3 : TS + .3, 3); g.translate(x, WY - .5 + .58, z); walls.push(g); };
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
    if (isW(i, j)) { if (C[j * GN + i] === 8 && (j === 0 || j === GN - 1)) wall(cx(i) + TS / 2, j === 0 ? cx(0) : cx(GN), true); continue; }
    const x0 = cx(i), z0 = cx(j);
    if (isW(i + 1, j)) wall(x0 + TS, z0 + TS / 2, false); if (isW(i - 1, j)) wall(x0, z0 + TS / 2, false);
    if (isW(i, j + 1)) wall(x0 + TS / 2, z0 + TS, true); if (isW(i, j - 1)) wall(x0 + TS / 2, z0, true);
  }
  for (const s of [-1, 1]) { const g = boxG(.3, 1.1, L - GH, 3); g.translate(coast, WY + .08, s * (GH + (L - GH) / 2)); walls.push(g); }
  const gm = new THREE.Mesh(mergeGeometries(land), RD.M.terrain); gm.receiveShadow = true; RD.world.add(gm); RD.ground = gm;
  const wm = new THREE.Mesh(mergeGeometries(walls), RD.M.concrete); wm.receiveShadow = true; wm.castShadow = true; RD.world.add(wm);
  // 混合贴图：每格一个像素，着色器里双线性插值后加噪声扰动、锐化
  const a = new Uint8Array(GN * GN * 4), b = new Uint8Array(GN * GN * 4);
  for (let k = 0; k < GN * GN; k++) { let c = C[k]; if (isWaterC(c)) c = 7; if (c === 10) c = 0; (c < 4 ? a : b)[k * 4 + (c & 3)] = 255; }
  const mk = d => { const t = new THREE.DataTexture(d, GN, GN); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  const U = RD.M.terrain.userData.u; if (U.tS0.value) { U.tS0.value.dispose(); U.tS1.value.dispose(); } U.tS0.value = mk(a); U.tS1.value = mk(b);
  RD.world.add(makeWater(mergeGeometries(water)));
}
function makeWater(geo) {
  let w;
  if (R.quality === 'high') {
    w = new Water(geo, { textureWidth: 512, textureHeight: 512, waterNormals: RD.T.waterN, sunDirection: new THREE.Vector3(.4, .8, .3).normalize(), sunColor: 0xfff2dc, waterColor: 0x0e2b30, distortionScale: 1.4, fog: true });
    w.material.uniforms.size.value = 5;
    w.material.fragmentShader = w.material.fragmentShader.replace('float rf0 = 0.3;', 'float rf0 = 0.06;').replace('( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight )', '( reflectionSample + reflectionSample * specularLight )').replace('* getShadowMask()', '* ( 0.5 + 0.5 * getShadowMask() )');
    const ob = w.onBeforeRender; w.onBeforeRender = function (r, s, c) { if (this.__f === RD.frame) return; this.__f = RD.frame; ob.call(this, r, s, c); };
  } else w = new THREE.Mesh(geo, RD.M.water);
  w.rotation.x = -Math.PI / 2; w.position.y = WY; w.receiveShadow = true; RD.water = w; return w;
}
function onRoadW(x, z) {
  if (!RD.roadH) return false; const lim = 1.2;
  const ky = Math.round(z / TS + MAP_H / 2); if (Math.abs(z - (ky - MAP_H / 2) * TS) < lim && RD.roadH.has(Math.floor(x / TS + MAP_W / 2) + ',' + ky)) return true;
  const kx = Math.round(x / TS + MAP_W / 2); if (Math.abs(x - (kx - MAP_W / 2) * TS) < lim && RD.roadV.has(kx + ',' + Math.floor(z / TS + MAP_H / 2))) return true;
  return false;
}
// 树：阔叶树（几团叶簇）+ 松树，实例化；顶点色做出冠层自遮蔽
function treeGeos() {
  const lump = (r, x, y, z, sy, k, det = 1) => { let g = new THREE.IcosahedronGeometry(r, det); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); const p = g.attributes.position; for (let v = 0; v < p.count; v++) { const px = p.getX(v), py = p.getY(v), pz = p.getZ(v), f = 1 + (hash3(px * 3 + k, py * 3, pz * 3) - .5) * .45; p.setXYZ(v, px * f, py * f * sy, pz * f); } g.translate(x, y, z); return g; };
  const cone = (r, h, y) => { let g = new THREE.ConeGeometry(r, h, 8, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); const p = g.attributes.position; for (let v = 0; v < p.count; v++) { const f = 1 + (hash3(p.getX(v) * 5, p.getY(v) * 5, p.getZ(v) * 5) - .5) * .3; p.setX(v, p.getX(v) * f); p.setZ(v, p.getZ(v) * f); } g.translate(0, y, 0); return g; };
  const finish = (g, y0, y1) => { g.computeVertexNormals(); const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3), uv = new Float32Array(n * 2); for (let v = 0; v < n; v++) { const px = p.getX(v), py = p.getY(v), pz = p.getZ(v), a = clamp((py - y0) / (y1 - y0), 0, 1), s = (.45 + a * .6) * (.88 + hash3(px, py, pz) * .24); col[v * 3] = s; col[v * 3 + 1] = s; col[v * 3 + 2] = s; uv[v * 2] = (px + pz) * .7; uv[v * 2 + 1] = py * .7; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; };
  const leaf = finish(mergeGeometries([lump(1.05, 0, 2.55, 0, 1.08, 1), lump(.8, .62, 3.05, .3, 1, 2), lump(.74, -.58, 2.95, -.34, 1, 3), lump(.62, .08, 3.55, -.48, 1, 4)]), 1.3, 4.2);
  const leafFar = finish(mergeGeometries([lump(1.1, 0, 2.6, 0, 1.1, 1, 0), lump(.85, .55, 3.15, .25, 1, 2, 0), lump(.78, -.5, 3.0, -.35, 1, 3, 0)]), 1.3, 4.2);
  const pine = finish(mergeGeometries([cone(1.0, 2.1, 2.0), cone(.8, 1.8, 2.95), cone(.56, 1.5, 3.85)]), .9, 4.6);
  const trunk = cylG(.09, .15, 1.9, 6); trunk.translate(0, .95, 0);
  return { leaf, leafFar, pine, trunk };
}
function buildTrees(m) {
  const C = RD.cells, spots = [], hi = R.quality === 'high', rad = hi ? 470 : R.quality === 'soft' ? 150 : 260, near = hi ? 200 : 0;
  const push = (i, x, z, s, c, pine, kind) => { if (onRoadW(x, z)) return; spots.push({ i, x, z, s, c, pine, kind }); };
  for (const t of m.tiles) {
    const rnd = mulberry32(t.x * 131 + t.y * 977 + 5), { x, z } = tc(t.x, t.y), idx = t.y * MAP_W + t.x;
    if (t.t === 'land' && !t.res) { const dense = t.deco > .6, n = dense ? 11 + Math.floor(rnd() * 6) : 1 + Math.floor(t.deco * 6); for (let k = 0; k < n; k++) { const r = rnd(); push(idx, x + (rnd() - .5) * (TS - 1), z + (rnd() - .5) * (TS - 1), .75 + rnd() * .55, r, r > (dense ? .72 : .88)); } }
    else if (t.res === 'food' && t.deco > .55) { const zz = z + (t.deco > .78 ? 1 : -1) * (TS / 2 - .9); for (let k = 0; k < 4; k++) push(idx, x - 3.6 + k * 2.4 + (rnd() - .5) * .6, zz, .7 + rnd() * .3, rnd(), false); }
    else if (t.res === 'oil' && t.deco > .5) push(idx, x + (rnd() - .5) * 7, z + (rnd() - .5) * 7, .7, rnd(), false);
    else if (t.t === 'urban' || t.t === 'landmark') { const e = TS / 2 - 1.32; for (const [sx, sz, along] of [[0, -e, 1], [0, e, 1], [-e, 0, 0], [e, 0, 0]]) for (const o of [-2.7, 0, 2.7]) push(idx, x + sx + (along ? o : 0), z + sz + (along ? 0 : o), .6 + rnd() * .08, .45 + rnd() * .15, false, 'street'); }
  }
  const rnd = mulberry32(m.seed + 99);
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
    const x = i - GO, y = j - GO; if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) continue; const c = C[j * GN + i]; if (isWaterC(c)) continue;
    const X = (i + .5 - GN / 2) * TS, Z = (j + .5 - GN / 2) * TS; if (Math.hypot(X, Z) > rad) continue;
    let n = c === 5 ? 7 + Math.floor(rnd() * 5) : c === 0 ? (rnd() < .4 ? 1 + Math.floor(rnd() * 3) : 0) : c === 10 ? 2 : c === 1 ? (rnd() < .25 ? 4 : 0) : c === 6 ? (rnd() < .3 ? 1 : 0) : 0;
    if (!hi && c === 5) n = Math.ceil(n / 2);
    const hz = Z + (rnd() < .5 ? -1 : 1) * (TS / 2 - .6);
    for (let k = 0; k < n; k++) { const r = rnd(); if (c === 1) push(-1, X - 3.6 + k * 2.4, hz, .7 + rnd() * .3, r, false); else push(-1, X + (rnd() - .5) * (TS - .6), Z + (rnd() - .5) * (TS - .6), .75 + rnd() * .6, r, c === 5 ? r > .66 : r > .9); }
  }
  const G = RD.treeG || (RD.treeG = treeGeos());
  // 近处（地图内与周边）用细模，远处用粗模
  const soft = R.quality === 'soft'; for (const s of spots) s.far = soft || (s.i < 0 && Math.hypot(s.x, s.z) > near + 110);
  const lf = spots.filter(s => !s.pine && !s.far), lfF = spots.filter(s => !s.pine && s.far), pn = spots.filter(s => s.pine);
  const tr = new THREE.InstancedMesh(G.trunk, RD.M.trunk, spots.length), L = new THREE.InstancedMesh(G.leaf, RD.M.leaf, Math.max(1, lf.length)), LF = new THREE.InstancedMesh(G.leafFar, RD.M.leaf, Math.max(1, lfF.length)), P = new THREE.InstancedMesh(G.pine, RD.M.leaf, Math.max(1, pn.length));
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const put = (s) => { q.setFromAxisAngle(up, s.c * 6.28); mtx.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(s.s, s.s * (.9 + s.c * .3), s.s)); return mtx; };
  spots.forEach((s, k) => { s.k = k; tr.setMatrixAt(k, put(s)); });
  const leafCol = (s) => { const sr = THREE.SRGBColorSpace; if (s.kind === 'street') col.setHSL(.22 + s.c * .05, .34, .25, sr); else if (s.c > .94) col.setHSL(.12, .4, .3, sr); else col.setHSL(.2 + s.c * .08, .27 + s.c * .15, .19 + s.c * .08, sr); return col; };
  lfF.forEach((s, k) => { s.kk = k; LF.setMatrixAt(k, put(s)); LF.setColorAt(k, leafCol(s)); });
  lf.forEach((s, k) => { s.kk = k; L.setMatrixAt(k, put(s)); L.setColorAt(k, leafCol(s)); });
  pn.forEach((s, k) => { s.kk = k; P.setMatrixAt(k, put(s)); col.setHSL(.3 + s.c * .05, .25, .15 + s.c * .04, THREE.SRGBColorSpace); P.setColorAt(k, col); });
  for (const o of [tr, L, LF, P]) { o.castShadow = o.receiveShadow = true; o.layers.set(1); RD.world.add(o); }
  if (!pn.length) P.count = 0; if (!lf.length) L.count = 0; if (!lfF.length) LF.count = 0;
  RD.trees = { tr, L, LF, P, spots };
}
function hideTreesOn(i, hide) {
  const T = RD.trees; if (!T) return; let ch = false; const z = new THREE.Matrix4().makeScale(0, 0, 0), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const s of T.spots) { if (s.i !== i || !!s.hid === hide) continue; s.hid = hide; ch = true;
    if (hide) { T.tr.setMatrixAt(s.k, z); (s.pine ? T.P : s.far ? T.LF : T.L).setMatrixAt(s.kk, z); }
    else { q.setFromAxisAngle(up, s.c * 6.28); mtx.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(s.s, s.s * (.9 + s.c * .3), s.s)); T.tr.setMatrixAt(s.k, mtx); (s.pine ? T.P : s.far ? T.LF : T.L).setMatrixAt(s.kk, mtx); } }
  if (ch) for (const o of [T.tr, T.L, T.LF, T.P]) o.instanceMatrix.needsUpdate = true;
}
// 郊区村落：白墙灰瓦的三层农民房，成排朝南
function buildVillages(m) {
  const C = RD.cells, rnd = mulberry32(m.seed + 7), list = [], rad = R.quality === 'high' ? 560 : R.quality === 'soft' ? 200 : 340;
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
    if (C[j * GN + i] !== 10) continue; const X = (i + .5 - GN / 2) * TS, Z = (j + .5 - GN / 2) * TS; if (Math.hypot(X, Z) > rad) continue;
    const n = 3 + Math.floor(rnd() * 4), rot = (rnd() - .5) * .2;
    for (let k = 0; k < n; k++) { const x = X - 3 + (k % 3) * 3 + (rnd() - .5) * .8, z = Z + (k < 3 ? -2 : 2) + (rnd() - .5) * .6; if (onRoadW(x, z)) continue; list.push({ x, z, w: 1.8 + rnd() * .9, d: 1.3 + rnd() * .4, h: 2 + rnd() * 1.2, r: rot + (rnd() - .5) * .08, c: rnd() }); }
  }
  if (!list.length) return;
  const body = boxG(1, 1, 1); body.translate(0, .5, 0);
  const s = new THREE.Shape(); s.moveTo(-.56, 0); s.lineTo(.56, 0); s.lineTo(0, .3); s.closePath(); const roof = new THREE.ExtrudeGeometry(s, { depth: 1.06, bevelEnabled: false }); roof.translate(0, 0, -.53); roof.rotateY(Math.PI / 2); roof.translate(0, 1, 0);
  const B = new THREE.InstancedMesh(body, RD.M.house, list.length), Rf = new THREE.InstancedMesh(roof, RD.M.houseRoof, list.length), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const walls = [[.8, .79, .75], [.74, .72, .67], [.84, .82, .78], [.68, .66, .62]], roofs = [[.2, .22, .25], [.22, .27, .33], [.34, .2, .16], [.28, .28, .28]];
  list.forEach((h, k) => { q.setFromAxisAngle(up, h.r); mtx.compose(new THREE.Vector3(h.x, 0, h.z), q, new THREE.Vector3(h.w, h.h, h.d)); B.setMatrixAt(k, mtx); Rf.setMatrixAt(k, mtx);
    col.setRGB(...walls[Math.floor(h.c * 4)], THREE.SRGBColorSpace); B.setColorAt(k, col); col.setRGB(...roofs[Math.floor((h.c * 7) % 4)], THREE.SRGBColorSpace); Rf.setColorAt(k, col); });
  for (const o of [B, Rf]) { o.castShadow = o.receiveShadow = true; o.layers.set(1); RD.world.add(o); }
}
function makeBoat(W, path, p, sp, big) {
  const g = new THREE.Group(), M = RD.M;
  const hull = (L, Wd, H) => { const s = new THREE.Shape(); s.moveTo(-L / 2, -Wd / 2); s.lineTo(L / 2 - Wd * .9, -Wd / 2); s.lineTo(L / 2, 0); s.lineTo(L / 2 - Wd * .9, Wd / 2); s.lineTo(-L / 2, Wd / 2); s.closePath(); const geo = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); return geo; };
  if (big) {
    add(g, hull(14, 2.6, 1.2), M.hull, 0, -.3, 0); add(g, boxG(13, .12, 2.5), M.hullRed, -.4, -.24, 0, { noShadow: true });
    for (let b = 0; b < 6; b++) for (let r = 0; r < 2; r++) for (let h = 0; h < 1 + ((b + r) % 3 ? 1 : 0); h++) add(g, boxG(1.45, .6, 1.05), M.container[(b * 3 + r + h) % 7], -3.8 + b * 1.5, 1.2 + h * .6, -.55 + r * 1.1);
    add(g, boxG(1.4, 2, 2.3), M.white, -5.7, 1.9, 0); add(g, boxG(1.6, .15, 2.6), M.white, -5.7, 2.95, 0); add(g, cylG(.18, .2, 1.1, 10), M.redBand, -6.1, 3.4, 0);
  } else {
    add(g, hull(5.2, 1.3, .7), M.hull, 0, -.3, 0); add(g, boxG(3.2, .45, 1.05), M.rockPile, .3, .55, 0);
    add(g, boxG(.9, .75, 1.05), M.white, -2.0, .75, 0); add(g, boxG(.6, .1, .7), M.dark, -2.0, 1.17, 0);
  }
  bake(g); W.add(g); return { g, path, p, sp };
}

// ---------- 道路、桥、路灯、车流 ----------
function roadTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'), n = fbmMaker(5, 16, 3), n2 = fbmMaker(6, 32, 2), rr = mulberry32(3);
  const im = x.createImageData(256, 64); for (let j = 0; j < 64; j++) for (let i = 0; i < 256; i++) { const a = n(i / 256, j / 64), b = n2(i / 256, j / 64), k = (j * 256 + i) * 4, g = (40 + a * 16 + b * 8) * (.94 + rr() * .12); im.data[k] = g; im.data[k + 1] = g + 1; im.data[k + 2] = g + 3; im.data[k + 3] = 255; } x.putImageData(im, 0, 0);
  x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, 14, 256, 8); x.fillRect(0, 42, 256, 8);         // 车辙
  x.fillStyle = 'rgba(214,210,196,.7)'; for (let i = 8; i < 256; i += 64) x.fillRect(i, 31, 34, 2);
  x.fillStyle = 'rgba(200,196,184,.55)'; x.fillRect(0, 4, 256, 1.5); x.fillRect(0, 58.5, 256, 1.5);
  return canvasTex(c);
}
function buildRoads(m) {
  const H = new Map(), V = new Map(), RW = 2.0, EXT = 30;
  const addH = (x, y) => { const a = cellAt(x, y - 1), b = cellAt(x, y); if (a === 9 || b === 9) return; H.set(x + ',' + y, { br: a === 8 || b === 8, urb: a === 4 || b === 4 }); };
  const addV = (x, y) => { const a = cellAt(x - 1, y), b = cellAt(x, y); if (a === 9 || b === 9) return; V.set(x + ',' + y, { br: a === 8 || b === 8, urb: a === 4 || b === 4 }); };
  for (const t of m.tiles) if (t.t === 'urban' || t.t === 'landmark') { addH(t.x, t.y); addH(t.x, t.y + 1); addV(t.x, t.y); addV(t.x + 1, t.y); }
  const rows = [6, 15], cols = [5, 14]; RD.lines = []; RD.ext = EXT;
  for (const y of rows) { for (let x = -EXT; x < MAP_W + EXT; x++) addH(x, y); RD.lines.push({ h: true, k: y }); }
  for (const x of cols) { for (let y = -EXT; y < MAP_H + EXT; y++) addV(x, y); RD.lines.push({ h: false, k: x }); }
  RD.roadH = H; RD.roadV = V;
  const roads = [], decks = [], walks = [], lamps = [], art = new Set([...rows.map(r => 'h' + r), ...cols.map(c => 'v' + c)]);
  const put = (cx, cz, horiz, s, key, lx, ly) => {
    const y = s.br ? 1.5 : .06; const g = new THREE.PlaneGeometry(TS, RW); g.rotateX(-Math.PI / 2); if (!horiz) g.rotateY(Math.PI / 2); g.translate(cx, y, cz); roads.push(g);
    if (s.br) { const d = boxG(horiz ? TS : RW + .7, .55, horiz ? RW + .7 : TS, 3); d.translate(cx, 1.2, cz); decks.push(d); const pr = cylG(.32, .38, 2.2, 10); pr.translate(cx, .3, cz); decks.push(pr.toNonIndexed());
      for (const o of [-1, 1]) { const r = boxG(horiz ? TS : .12, .5, horiz ? .12 : TS); r.translate(cx + (horiz ? 0 : o * (RW / 2 + .25)), 1.75, cz + (horiz ? o * (RW / 2 + .25) : 0)); decks.push(r); } }
    else if (s.urb) for (const o of [-1, 1]) { const w = boxG(horiz ? TS : .62, .12, horiz ? .62 : TS, 3); w.translate(cx + (horiz ? 0 : o * (RW / 2 + .31)), .06, cz + (horiz ? o * (RW / 2 + .31) : 0)); walks.push(w); }
    const inner = lx >= -12 && lx < MAP_W + 12 && ly >= -12 && ly < MAP_H + 12;
    if (inner && (s.urb || art.has(key))) { const sd = (lx + ly) % 2 ? 1 : -1; lamps.push({ x: cx + (horiz ? 0 : sd * (RW / 2 + .3)), z: cz + (horiz ? sd * (RW / 2 + .3) : 0), y: s.br ? 1.45 : 0, r: horiz ? -sd * Math.PI / 2 : (sd > 0 ? 0 : Math.PI) }); }
  };
  for (const [k, s] of H) { const [x, y] = k.split(',').map(Number); put((x + .5 - MAP_W / 2) * TS, (y - MAP_H / 2) * TS, true, s, 'h' + y, x, y); }
  for (const [k, s] of V) { const [x, y] = k.split(',').map(Number); put((x - MAP_W / 2) * TS, (y + .5 - MAP_H / 2) * TS, false, s, 'v' + x, x, y); }
  const rm = new THREE.Mesh(mergeGeometries(roads), RD.M.road); rm.receiveShadow = true; rm.renderOrder = 1; RD.world.add(rm);
  if (decks.length) { const dm = new THREE.Mesh(mergeGeometries(decks.map(g => g.index ? g.toNonIndexed() : g)), RD.M.concrete); dm.castShadow = dm.receiveShadow = true; RD.world.add(dm); }
  if (walks.length) { const wm = new THREE.Mesh(mergeGeometries(walks), RD.M.walk); wm.receiveShadow = true; RD.world.add(wm); }
  // 路灯
  if (lamps.length) {
    const pole = mergeGeometries([cylG(.045, .07, 2.8, 6).translate(0, 1.4, 0).toNonIndexed(), boxG(.8, .05, .05).translate(-.38, 2.78, 0).toNonIndexed()]);
    const head = boxG(.36, .07, .16); head.translate(-.74, 2.73, 0);
    const P = new THREE.InstancedMesh(pole, RD.M.pole, lamps.length), Hd = new THREE.InstancedMesh(head, RD.M.lamp, lamps.length), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    lamps.forEach((l, i) => { q.setFromAxisAngle(up, l.r); mtx.compose(new THREE.Vector3(l.x, l.y, l.z), q, one); P.setMatrixAt(i, mtx); Hd.setMatrixAt(i, mtx); });
    P.castShadow = true; P.layers.set(1); Hd.layers.set(1); RD.world.add(P, Hd);
  }
  // 车
  const cars = [], rnd = mulberry32(m.seed + 3);
  for (const L of RD.lines) for (let k = 0; k < 20; k++) { const big = rnd() < .12; cars.push({ L, p: -EXT + rnd() * (MAP_W + 2 * EXT), dir: k % 2 ? 1 : -1, sp: (big ? .3 : .38) + rnd() * .3, sc: big ? [2.3, 1.35, 1.2] : [1, 1, 1] }); }
  const vc = (g, v) => { const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(v); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const body = mergeGeometries([vc(boxG(1.1, .3, .46).translate(0, .24, 0).toNonIndexed(), 1), vc(boxG(.62, .24, .42).translate(-.06, .5, 0).toNonIndexed(), .12), vc(boxG(.12, .08, .4).translate(.56, .28, 0).toNonIndexed(), .9)]);
  const im = new THREE.InstancedMesh(body, RD.M.car, cars.length); im.castShadow = true;
  const cc = ['#d6d6d2', '#1e2124', '#8a8e92', '#6e1d1d', '#1d3656', '#c4beac', '#3a3e43', '#e6e6e2']; const col = new THREE.Color();
  cars.forEach((c, i) => { col.set(cc[Math.floor(rnd() * cc.length)]); im.setColorAt(i, col); });
  im.layers.set(1); RD.world.add(im); RD.cars = { im, cars };
}
function carStep(dt) {
  if (!RD.cars) return; const { im, cars } = RD.cars, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sv = new THREE.Vector3(), E = RD.ext, span = MAP_W + 2 * E;
  cars.forEach((c, i) => {
    c.p += dt * c.sp * c.dir; if (c.p >= MAP_W + E) c.p -= span; if (c.p < -E) c.p += span;
    const cell = Math.floor(c.p), key = c.L.h ? cell + ',' + c.L.k : c.L.k + ',' + cell, map = c.L.h ? RD.roadH : RD.roadV, s = map.get(key);
    if (!s) { m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); return; }
    const y = s.br ? 1.5 : .06, along = (c.p - MAP_W / 2) * TS, off = c.dir * .5, line = (c.L.k - MAP_W / 2) * TS;
    const pos = c.L.h ? new THREE.Vector3(along, y, line + off) : new THREE.Vector3(line - off, y, along);
    q.setFromAxisAngle(up, c.L.h ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? -Math.PI / 2 : Math.PI / 2)); m4.compose(pos, q, sv.set(...c.sc)); im.setMatrixAt(i, m4);
  });
  im.instanceMatrix.needsUpdate = true;
}

// ---------- 每格对象 ----------
function tileSigR(t) { return [t.t, t.owner, t.b ? t.b.k : '', t.b ? t.b.lv : 0, t.b ? (t.b.prog > 0 ? 'p' + Math.ceil(t.b.prog) : 0) : 0, t.b ? (t.b.idle > 0 ? 1 : t.b.stall ? 2 : 0) : 0, t.metro ? 1 : 0, t.owner >= 0 && t.b && t.b.k === 'hq' ? R.m.players[t.owner].hql : 0].join('|'); }
function syncTiles(force) {
  const m = R.m; if (!m) return;
  m.tiles.forEach((t, i) => {
    const sig = tileSigR(t), o = RD.objs[i];
    if (!force && o && o.sig === sig) { if (o.k) o.state = t.b; return; }
    if (o && o.grp) { RD.world.remove(o.grp); disposeTree(o.grp); RD.anims = RD.anims.filter(a => a.i !== i); RD.emit = RD.emit.filter(e => e.i !== i); }
    const grp = buildTile(t, i); if (grp) RD.world.add(grp);
    RD.objs[i] = { sig, grp, k: t.b && t.b.k, state: t.b };
    hideTreesOn(i, !!(t.b && t.t !== 'urban' && t.t !== 'landmark'));
  });
}
function buildTile(t, i) {
  const m = R.m, { x, z } = tc(t.x, t.y), g = new THREE.Group(); g.position.set(x, 0, z);
  const rnd = mulberry32(t.x * 7919 + t.y * 104729 + 17), M = RD.M;
  if (t.t === 'landmark') { landmark(g); return bake(g); }
  if (t.owner < 0) { if (t.t === 'urban') cityBlock(g, t, rnd); return g.children.length ? bake(g) : null; }
  const P = m.players[t.owner], pc = P.color, b = t.b;
  if (!b) { if (t.t === 'urban') hoarding(g, pc); return g.children.length ? bake(g) : null; }
  if (b.prog > 0) { const tot = b.lv > 1 ? 5 : 6; construction(g, rnd, clamp(1 - b.prog / tot, 0, 1)); return bake(g); }
  const S = [0, 1, 1.18, 1.36][b.lv] || 1;
  const anim = (fn) => RD.anims.push({ i, fn, st: () => RD.objs[i] && RD.objs[i].state });
  const smokeAt = (lx, ly, lz, dark, big) => RD.emit.push({ i, x: x + lx, y: ly, z: z + lz, dark, big, st: () => RD.objs[i] && RD.objs[i].state });
  switch (b.k) {
    case 'hq': case 'branch': {
      const lv = b.k === 'hq' ? P.hql : 1, h = b.k === 'hq' ? 11 + lv * 4.2 : 11, fk = b.k === 'hq' ? ['cwBlue', 'cwTeal', 'cwDark', 'cwSilver'][t.owner % 4] : 'ribbon';
      const r = bldg(g, 0, 0, 5.2, 5.2, h, fk, rnd, { podium: true, steps: b.k === 'hq' && lv >= 3, helipad: lv >= 4, antenna: b.k === 'hq' && lv >= 2, noUnits: lv >= 4 });
      add(g, boxG(r.w + .08, .22, r.d + .08), pcGlow(pc), 0, r.top - .45, 0, { noShadow: true, keep: true });
      flag(g, -3.6, 3.6, 5.5, pc); if (b.k === 'hq') { flag(g, -2.5, 3.6, 5.5, pc); flag(g, -1.4, 3.6, 5.5, pc); }
      break;
    }
    case 'farm': {   // 大棚 + 粮仓 + 筒仓
      const nGH = 3 + b.lv;
      const ghG = new THREE.CylinderGeometry(.6, .6, 5.8, 14, 1, true, Math.PI / 2, Math.PI); ghG.rotateX(Math.PI / 2);
      for (let k = 0; k < nGH; k++) { const gx = -3.9 + k * (7.8 / Math.max(1, nGH - 1)); add(g, ghG.clone(), M.greenhouse, gx, 0, 1.5, { noShadow: true }); add(g, boxG(1.22, .06, 5.9), M.soil, gx, .03, 1.5, { noShadow: true }); }
      add(g, boxG(3.6, 2.1 * S, 2.6, 3), M.cladBlue, -2, 1.05 * S, -3.2); gableRoof(g, -2, 2.1 * S, -3.2, 3.8, 2.8, .55, M.steel);
      for (let k = 0; k < 2; k++) { add(g, cylG(.72, .72, 3.6 * S, 18, 3), M.galv, 1.6 + k * 1.7, 1.8 * S, -3.3); add(g, new THREE.ConeGeometry(.76, .6, 18), M.galv, 1.6 + k * 1.7, 3.6 * S + .3, -3.3); }
      add(g, boxG(1, .7, 1.6), pcMat(pc), 3.9, .35, -1.2);
      flag(g, -4.3, -4.3, 3.5, pc);
      break;
    }
    case 'well': {   // 抽油机 + 储罐
      add(g, boxG(5.6, .16, 2.6), M.concrete, -1.6, .08, 2.4);
      const jx = -1.6, jz = 2.4; add(g, boxG(4.4, .28, .7), M.steelDark, jx, .3, jz);
      for (const s of [-1, 1]) add(g, boxG(.15, 3.1 * S, .15), M.steelDark, jx + .2, 1.6 * S, jz + s * .3, { rx: -s * .1 });
      const piv = new THREE.Group(); piv.position.set(jx + .2, 3.15 * S, jz); g.add(piv);
      add(piv, boxG(4.4, .28, .26), M.steelDark, 0, 0, 0); add(piv, boxG(.42, 1.1, .3), M.steelDark, 2.3, -.4, 0); add(piv, boxG(.6, .4, .4), pcMat(pc), -2.1, 0, 0);
      add(g, cylG(.03, .03, 2.6 * S, 5), M.galv, jx + 2.65, 1.3 * S, jz); add(g, boxG(.9, .7, .7), M.steelDark, jx - 1.8, .65, jz); add(g, boxG(.25, 1.2, .6), M.steelDark, jx - 1.6, 1.1, jz);
      anim((dt, tt, st) => { if (!st || st.idle || st.stall) return; piv.rotation.z = Math.sin(tt * 2.2 + t.x) * .3; });
      for (let k = 0; k < (b.lv >= 2 ? 2 : 1) + (b.lv >= 3 ? 1 : 0); k++) { const tx = 2.6 - k * 2.9; add(g, cylG(1.25, 1.25, 2.8 * S, 28, 4), M.tank, tx, 1.4 * S, -2.4); add(g, cylG(.2, 1.25, .35, 28), M.tank, tx, 2.8 * S + .17, -2.4); add(g, cylG(1.27, 1.27, .18, 28), pcMat(pc), tx, 2.2 * S, -2.4); }
      add(g, cylG(.08, .08, 6, 8), M.galv, 0, .25, .2, { rz: Math.PI / 2 }); add(g, cylG(.08, .08, 2.4, 8), M.galv, 3, .25, -1, { rx: Math.PI / 2 });
      break;
    }
    case 'mine': {   // 井架 + 传送带 + 矿石堆
      const hx = 2.4, hz = -2.4, Hh = 7.5 * S;
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, boxG(.18, Hh, .18), M.steelDark, hx + px * .75, Hh / 2, hz + pz * .75, { rz: px * .05, rx: -pz * .05 });
      for (let k = 1; k <= 4; k++) { const y = Hh * k / 5, s2 = .75 - k * .03; add(g, boxG(s2 * 2, .1, .1), M.steelDark, hx, y, hz - s2); add(g, boxG(s2 * 2, .1, .1), M.steelDark, hx, y, hz + s2); add(g, boxG(.1, .1, s2 * 2), M.steelDark, hx - s2, y, hz); add(g, boxG(.1, .1, s2 * 2), M.steelDark, hx + s2, y, hz); }
      add(g, boxG(1.7, .25, 1.7), M.steelDark, hx, Hh, hz); const wheel = add(g, new THREE.TorusGeometry(.65, .08, 6, 20), M.dark, hx, Hh + .7, hz, { keep: true });
      add(g, boxG(.16, Hh * 1.05, .16), M.steelDark, hx - 2, Hh * .5, hz, { rz: -.42 });
      anim((dt, tt, st) => { if (!st || st.idle || st.stall) return; wheel.rotation.z += dt * 2; });
      add(g, boxG(5.6, .22, .6), M.steel, -.6, 2.2, .2, { rz: -.5 }); for (const k of [-2.2, -.6, 1]) add(g, boxG(.12, 2.8 + k * .8, .12), M.steelDark, k, (2.8 + k * .8) / 2 - .4, .2);
      add(g, new THREE.ConeGeometry(2.2, 1.7 * S, 20), M.rockPile, -3, .85 * S, 2.6); add(g, new THREE.ConeGeometry(1.5, 1.1, 18), M.rockPile, .2, .55, 3.4);
      add(g, boxG(2.6, 2.6, 2.4, 3), M.cladRust, -3, 1.3, -2.8); add(g, boxG(2.7, .15, 2.5), M.roofDark, -3, 2.68, -2.8);
      for (const [mx, mz, r] of [[1.6, 1.2, .4], [3.6, 2.2, 2]]) { add(g, boxG(1.3, .6, .8), M.yellow, mx, .55, mz, { ry: r }); add(g, boxG(.5, .5, .7), M.yellow, mx + Math.cos(r) * .75, .7, mz - Math.sin(r) * .75, { ry: r }); }
      add(g, boxG(1.2, .7, .9), pcMat(pc), -.6, .35, -2.2);
      break;
    }
    case 'plant': {  // 电厂：主厂房、冷却塔、烟囱、变电站
      add(g, boxG(5, 4.4 * S, 3.4, 3), M.clad, -1.7, 2.2 * S, 1.8); add(g, boxG(5.1, .2, 3.5), M.roofDark, -1.7, 4.4 * S + .1, 1.8); add(g, boxG(5.06, .3, 3.46), pcMat(pc), -1.7, 4.4 * S - .5, 1.8, { noShadow: true });
      add(g, boxG(2.2, 6.4 * S, 2.4, 3), M.cladWhite, -3.1, 3.2 * S, -1.4);
      const ct = 10.5 * S; lathe(g, [[2.55, 0], [2.25, ct * .25], [1.72, ct * .62], [1.68, ct * .8], [1.9, ct]], M.coolT, 2.3, 0, -2.2);
      smokeAt(2.3, ct + .5, -2.2, false, true);
      const ch = 14 * S; add(g, cylG(.34, .5, ch, 14), M.concrete, -.6, ch / 2, -3.4); add(g, cylG(.36, .36, .9, 14), M.redBand, -.6, ch - .8, -3.4); add(g, cylG(.4, .4, .9, 14), M.redBand, -.6, ch - 2.6, -3.4); smokeAt(-.6, ch, -3.4, false, false);
      for (const [px, pz] of [[2.4, 2.4], [3.4, 2.4], [2.4, 3.6], [3.4, 3.6]]) add(g, boxG(.7, .8, .6), M.clad, px, .4, pz);
      for (const pz of [1.8, 4.1]) { add(g, boxG(.1, 3, .1), M.galv, 4.3, 1.5, pz); add(g, boxG(.1, .1, 1.2), M.galv, 4.3, 2.9, pz); }
      break;
    }
    case 'mill': {   // 钢厂：厂房、高炉、热风炉、烟囱
      add(g, boxG(7.2, 4.8 * S, 4, 3), M.cladRust, -.4, 2.4 * S, 1.6); gableRoof(g, -.4, 4.8 * S, 1.6, 7.3, 4.2, .7, M.steelDark); add(g, boxG(7.3, .5, 1), M.steelDark, -.4, 4.8 * S + .8, 1.6);
      add(g, cylG(.9, 1.25, 7.5 * S, 18, 3), M.steelDark, 2.8, 3.75 * S, -2.5); add(g, cylG(.6, .9, 1.6, 18), M.steelDark, 2.8, 7.5 * S + .8, -2.5); add(g, cylG(.18, .18, 6, 8), M.galv, 1.4, 6.2 * S, -2.5, { rz: .7 });
      for (let k = 0; k < 3; k++) add(g, cylG(.55, .55, 5.6 * S, 16, 3), M.steel, -.6 + k * 1.25, 2.8 * S, -3.4);
      const ch = 15 * S; add(g, cylG(.42, .58, ch, 14), M.concrete, -3.6, ch / 2, -3); add(g, cylG(.45, .45, .8, 14), M.redBand, -3.6, ch - .7, -3); smokeAt(-3.6, ch + .3, -3, true, true);
      const gl = add(g, boxG(1.6, 1.4, .1), M.glow, -1.5, .9, 3.62, { noShadow: true, keep: true }); anim((dt, tt, st) => { gl.visible = !!st && !st.idle && !st.stall; });
      add(g, boxG(7.25, .3, 4.05), pcMat(pc), -.4, .6, 1.6, { noShadow: true });
      break;
    }
    case 'foodw': {  // 食品厂：锯齿屋顶厂房、不锈钢罐
      add(g, boxG(6.8, 3.6 * S, 4.8, 3), M.cladWhite, -.6, 1.8 * S, 1);
      for (let k = 0; k < 4; k++) gableRoof(g, -3.3 + k * 1.75, 3.6 * S, 1, 1.75, 4.8, .8, k % 2 ? M.steel : M.roofDark);
      for (let k = 0; k < 3; k++) { add(g, cylG(.62, .62, 5 * S, 18, 3), M.galv, 1 + k * 1.4, 2.5 * S + .4, -3.1); add(g, new THREE.ConeGeometry(.62, .5, 18), M.galv, 1 + k * 1.4, 5 * S + .65, -3.1); }
      add(g, boxG(2.4, 1.2, 1.8), M.panel, -3, .6, -3); add(g, cylG(.22, .26, 7 * S, 10), M.concrete, -3.8, 3.5 * S, -3.6); smokeAt(-3.8, 7 * S, -3.6, false, false);
      add(g, boxG(6.85, .28, 4.85), pcMat(pc), -.6, .5, 1, { noShadow: true });
      break;
    }
    case 'fab': {    // 芯片厂：白色洁净厂房、深色玻璃带
      add(g, boxG(8, 4.8 * S, 6, 4), M.panel, 0, 2.4 * S, .6); add(g, boxG(8.04, 1.1, 6.04, 8), M.fac.cwDark, 0, 2.6 * S, .6, { noShadow: true });
      add(g, boxG(8.1, .2, 6.1), M.roofDark, 0, 4.8 * S + .1, .6);
      for (let k = 0; k < 6; k++) add(g, boxG(1, .7, 1), M.galv, -3 + (k % 3) * 2.2, 4.8 * S + .55, -.6 + Math.floor(k / 3) * 2.2);
      add(g, boxG(2.8, 3, 1.6, 8), M.fac.cwBlue, 2.4, 1.5, -3.4); add(g, boxG(2.9, .15, 1.7), M.trim, 2.4, 3.05, -3.4);
      add(g, boxG(8.06, .25, 6.06), pcMat(pc), 0, .5, .6, { noShadow: true });
      break;
    }
    case 'port': {   // 码头：集装箱堆场 + 岸桥
      add(g, boxG(TS - .2, .5, TS - .2, 3), M.concrete, 0, .25, 0);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) { const n = 1 + ((k * 7 + r * 3 + t.x) % 3); for (let h = 0; h < n; h++) add(g, boxG(1.3, .62, 2.5), M.container[(k + r * 2 + h + t.y) % 7], -3.8 + k * 1.45, .81 + h * .62, -3.2 + r * 2.8); }
      const crane = new THREE.Group(); g.add(crane); const cm = pcMat(pc);
      for (const [lx, lz] of [[2.6, -1.4], [2.6, 1.4], [4.2, -1.4], [4.2, 1.4]]) add(crane, boxG(.26, 9, .26), cm, lx, 5, lz);
      add(crane, boxG(1.9, .3, 3.1), cm, 3.4, 9.5, 0); add(crane, boxG(10, .45, .5), cm, 5.4, 9.8, -.5); add(crane, boxG(10, .45, .5), cm, 5.4, 9.8, .5); add(crane, boxG(1.6, 1, 1.4), M.white, 2.6, 10.3, 0);
      const trolley = add(crane, boxG(.8, .5, 1.2), M.steelDark, 3, 9.4, 0); anim((dt, tt) => { trolley.position.x = 3 + (Math.sin(tt * .5 + t.y) + 1) * 3.2; });
      break;
    }
  }
  if (b.idle || b.stall) statusBadge(g, b.idle ? '停' : b.stall === 'typhoon' ? '风' : '缺', b.idle ? '#e2483a' : '#f0a63a');
  return bake(g);
}
function statusBadge(g, txt, col) { const s = sprite(badgeTex(txt, col, 64), 26); s.position.set(0, 9, 0); g.add(s); }
// 写字楼：裙房、退台、屋顶设备、女儿墙
function bldg(g, x, z, w, d, h, fk, rnd, o = {}) {
  const M = RD.M, fac = M.fac[fk], U = 8; let y = 0;
  if (o.podium) { const pw = w + 1, pd = d + 1, ph = 2.3; add(g, boxG(pw, ph - 1, pd, U), M.fac.stone, x, 1 + (ph - 1) / 2, z); add(g, boxG(pw - .25, 1, pd - .25, 4), M.fac.shop, x, .5, z); add(g, boxG(pw + .08, .15, pd + .08), M.trim, x, ph + .07, z); add(g, boxG(pw + .14, .1, pd + .14), M.trim, x, 1.02, z); y = ph; }
  if (o.resi) { add(g, boxG(w + .12, .55, d + .12), M.trim, x, .27, z); y = .55; }
  let cw = w, cd = d;
  const secs = o.steps || (!o.round && !o.resi && h > 18 && rnd() < .5) ? [[1, .6], [.84, .26], [.68, .14]] : [[1, 1]];
  for (const [k, f] of secs) { const sw = w * k, sd = d * k, sh = h * f;
    if (o.round) add(g, cylG(sw / 2, sw / 2, sh, 30, U), fac, x, y + sh / 2, z); else add(g, boxG(sw, sh, sd, U), fac, x, y + sh / 2, z);
    if (secs.length > 1) add(g, boxG(sw + .06, .14, sd + .06), M.trim, x, y + sh, z);
    y += sh; cw = sw; cd = sd; }
  if (o.round) { add(g, cylG(cw / 2 + .03, cw / 2 + .03, .55, 30), M.trim, x, y + .27, z); add(g, cylG(cw / 2 - .12, cw / 2 - .12, .1, 30), M.roofDark, x, y + .05, z); }
  else { add(g, boxG(cw - .1, .1, cd - .1), M.roofDark, x, y + .05, z); const pt = .14, ph = .55;
    add(g, boxG(cw, ph, pt), M.trim, x, y + ph / 2, z - cd / 2 + pt / 2); add(g, boxG(cw, ph, pt), M.trim, x, y + ph / 2, z + cd / 2 - pt / 2); add(g, boxG(pt, ph, cd), M.trim, x - cw / 2 + pt / 2, y + ph / 2, z); add(g, boxG(pt, ph, cd), M.trim, x + cw / 2 - pt / 2, y + ph / 2, z); }
  if (o.resi) { add(g, boxG(1.3, 1.1, Math.min(cd - .2, 1.2), U), fac, x - cw * .22, y + .55, z); add(g, boxG(1.3, 1.1, Math.min(cd - .2, 1.2), U), fac, x + cw * .22, y + .55, z); add(g, cylG(.32, .32, .7, 12), M.galv, x + cw * .38, y + .35, z); }
  else if (!o.noUnits) { const n = 1 + (rnd() * 3 | 0); for (let k = 0; k < n; k++) { const bw = .5 + rnd() * Math.min(1.3, cw * .3), bd = .5 + rnd() * Math.min(1.1, cd * .3); add(g, boxG(bw, .4 + rnd() * .5, bd), rnd() < .5 ? M.galv : M.concrete, x + (rnd() - .5) * Math.max(0, cw - bw - .6), y + .3, z + (rnd() - .5) * Math.max(0, cd - bd - .6)); } }
  if (o.helipad && !o.round) { const r = Math.min(cw, cd) * .38; add(g, boxG(cw * .82, .12, cd * .82), M.dark, x, y + .62, z); add(g, cylG(r, r, .02, 28), M.trim, x, y + .69, z, { noShadow: true }); add(g, cylG(r - .14, r - .14, .03, 28), M.dark, x, y + .7, z, { noShadow: true }); }
  if (o.antenna) add(g, cylG(.04, .1, 4.5, 6), M.galv, x + cw * .25, y + 2.25, z - cd * .25);
  return { top: y, w: cw, d: cd };
}
function cityBlock(g, t, rnd) {
  const m = R.m, lm = m.tiles.find(q => q.t === 'landmark'), dist = lm ? Math.hypot(t.x - lm.x, t.y - lm.y) : 5, cws = ['cwBlue', 'cwTeal', 'cwDark', 'cwSilver'];
  if (dist < 2.6) {   // 陆家嘴：超高层玻璃塔
    if (rnd() < .55) { const w = 4.2 + rnd(), h = 18 + rnd() * 22 * (2.9 - dist) / 2; bldg(g, 0, 0, w, w * (.85 + rnd() * .15), h, cws[rnd() * 4 | 0], rnd, { podium: 1, round: rnd() < .25, helipad: h > 30 }); }
    else { bldg(g, -1.6, -1.55, 2.7, 2.7, 13 + rnd() * 15, cws[rnd() * 4 | 0], rnd, { podium: 1 }); bldg(g, 1.6, 1.6, 2.6, 2.6, 9 + rnd() * 12, cws[rnd() * 4 | 0], rnd, { podium: 1, round: rnd() < .3 }); }
  } else if (dist < 4.2) {   // 浦西式混合办公
    const ks = ['office', 'ribbon', 'cwBlue', 'stone', 'cwDark', 'office'];
    const slots = rnd() < .5 ? [[-1.65, -1.6, 3, 3], [1.75, -1.4, 2.8, 3.4], [0, 2.2, 6.4, 2]] : [[-1.6, 0, 3.2, 6.4], [1.8, -1.5, 2.8, 3.2], [1.8, 2, 2.8, 2.4]];
    slots.forEach(([sx, sz, w, d], k) => bldg(g, sx, sz, w, d, (k === 2 ? 4 : 6) + rnd() * (k === 2 ? 5 : 12), ks[rnd() * ks.length | 0], rnd, {}));
  } else {   // 住宅小区：南北向板楼
    const fk = rnd() < .5 ? 'resi' : 'resiB';
    for (const zz of [-2.05, 2.05]) bldg(g, (rnd() - .5) * .5, zz, 6, 1.85, 8 + rnd() * 10, fk, rnd, { resi: 1 });
    add(g, boxG(5.8, .05, 1.6), RD.M.grassPatch, 0, .03, 0, { noShadow: true });
  }
}
function hoarding(g, pc) { const M = pcMat(pc), e = 3.45; for (const [x, z, a, b] of [[0, -e, 2 * e, .06], [0, e, 2 * e, .06], [-e, 0, .06, 2 * e], [e, 0, .06, 2 * e]]) add(g, boxG(a, .9, b), M, x, .45, z); add(g, boxG(6.6, .04, 6.6), RD.M.soil, 0, .02, 0, { noShadow: true }); }
// 工地：楼层随进度长高，绿色安全网，塔吊
function construction(g, rnd, f) {
  const M = RD.M; add(g, boxG(7.6, .06, 7.6), M.soil, 0, .03, 0, { noShadow: true });
  const fl = 1 + Math.round(f * 7), top = fl * 1.05;
  add(g, boxG(1.4, top + .8, 1.4), M.concrete, .6, (top + .8) / 2, .6);
  for (let k = 1; k <= fl; k++) { add(g, boxG(5.4, .16, 5.4), M.concrete, 0, k * 1.05, 0); for (const [px, pz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5], [0, -2.5], [-2.5, 0]]) add(g, boxG(.2, 1.05, .2), M.concrete, px, k * 1.05 - .52, pz); }
  if (fl > 2) add(g, boxG(5.8, top - 1.4, 5.8), M.net, 0, 1.2 + (top - 1.4) / 2 + .2, 0, { noShadow: true });
  const ch = top + 6.5, mx = -3.6, mz = -3.6;
  add(g, boxG(.5, ch, .5, .5), M.lattice, mx, ch / 2, mz);
  const jib = new THREE.Group(); jib.position.set(mx, ch, mz); jib.rotation.y = rnd() * Math.PI * 2; g.add(jib);
  add(jib, boxG(10, .45, .45, .45), M.lattice, 4.5, .2, 0); add(jib, boxG(3.4, .4, .4, .4), M.lattice, -1.8, .2, 0); add(jib, boxG(1.2, .9, .9), M.concrete, -3.1, -.1, 0); add(jib, boxG(.7, .6, .6), M.white, .55, -.35, 0); add(jib, boxG(.3, 1.6, .3, .3), M.lattice, 0, 1, 0);
  add(jib, cylG(.02, .02, 3.5, 4), M.dark, 5.5, -1.6, 0, { noShadow: true }); add(jib, boxG(.6, .3, .6), M.yellow, 5.5, -3.4, 0);
  add(g, boxG(2.2, .7, 1), M.white, 3.4, .35, -3.8); add(g, boxG(2.2, .7, 1), M.cladBlue, 3.4, 1.05, -3.8);
}
function landmark(g) {
  const M = RD.M;
  // 东方明珠：三根斜撑 + 核心筒 + 上下球体
  const px = -2.3, pz = 2.3;
  for (const a of [0, 2.09, 4.19]) add(g, cylG(.2, .3, 13, 10), M.concrete, px + Math.cos(a) * 1.05, 6.3, pz + Math.sin(a) * 1.05, { rz: Math.cos(a) * .07, rx: -Math.sin(a) * .07 });
  add(g, cylG(.36, .42, 27, 14), M.concrete, px, 13.5, pz);
  for (const a of [0, 2.09, 4.19]) add(g, cylG(.15, .15, 13, 8), M.concrete, px + Math.cos(a) * .55, 14.5, pz + Math.sin(a) * .55);
  add(g, new THREE.SphereGeometry(2.2, 40, 24), M.pearl, px, 7.5, pz); add(g, new THREE.SphereGeometry(1.55, 40, 24), M.pearl, px, 20.5, pz); add(g, new THREE.SphereGeometry(.62, 24, 16), M.pearl, px, 28.6, pz);
  for (let k = 0; k < 3; k++) { const a = k * 2.09 + .5; add(g, new THREE.SphereGeometry(.42, 20, 12), M.pearl, px + Math.cos(a) * .7, 13.2 + k * 1.2, pz + Math.sin(a) * .7); }
  add(g, cylG(.07, .22, 9, 8), M.galv, px, 33.6, pz);
  // 上海中心：扭转收分
  const sx = 2.4, sz = -2.3, lv = 28, Hh = 50;
  for (let k = 0; k < lv; k++) { const f = k / lv, r = 2.35 * (1 - f * .42); const m = add(g, cylG(r * .985, r, Hh / lv + .02, 18, 8), M.fac.cwSilver, sx, k * Hh / lv + Hh / lv / 2, sz, { ry: f * 2.1 }); m.scale.set(1, 1, .86); }
  const tr = 2.35 * .58; add(g, cylG(tr * .82, tr * .98, 2.6, 18), M.trim, sx, Hh + 1.3, sz, { ry: 2.1 });
  // 金茂：宝塔式退台
  const jx = 2.5, jz = 2.6; let y = 0;
  for (let k = 0; k < 8; k++) { const w = 2.7 - k * .25, h = 5.6 - k * .52; add(g, boxG(w, h, w, 8), M.fac.cwDark, jx, y + h / 2, jz); add(g, boxG(w + .16, .14, w + .16), M.galv, jx, y + h, jz); y += h; }
  add(g, cylG(.05, .35, 5, 8), M.galv, jx, y + 2.5, jz);
  // 环球金融中心：开瓶器
  const s = new THREE.Shape(), B = 1.5, T = .5, Hs = 44; s.moveTo(-B, 0); s.lineTo(B, 0); s.lineTo(T, Hs); s.lineTo(-T, Hs); s.closePath();
  const hole = new THREE.Path(); hole.moveTo(-.4, Hs - 4.6); hole.lineTo(.4, Hs - 4.6); hole.lineTo(.34, Hs - .9); hole.lineTo(-.34, Hs - .9); hole.closePath(); s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 2.4, bevelEnabled: false }); geo.translate(0, 0, -1.2);
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (Math.abs(n.getZ(i)) > .5 ? p.getX(i) : p.getZ(i)) / 8, p.getY(i) / 8);
  add(g, geo, M.fac.cwBlue, -2.3, 0, -2.4, { ry: .7 });
}

// ---------- 精灵与叠加 ----------
const badgeCache = {};
function badgeTex(txt, bg, size, w) {
  const key = txt + bg + size + (w || 0); if (badgeCache[key]) return badgeCache[key];
  const c = document.createElement('canvas'); c.width = w || size; c.height = size; const x = c.getContext('2d');
  x.fillStyle = bg; x.beginPath(); x.roundRect(2, 2, c.width - 4, size - 4, size / 2 - 2); x.fill(); x.fillStyle = '#fff'; x.font = `700 ${size * .5}px "Noto Sans SC",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, c.width / 2, size / 2 + 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; badgeCache[key] = t; return t;
}
// 精灵按屏幕像素定大小（px 为高度），远近一致、始终可读
function sprite(tex, px) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false, sizeAttenuation: false })); const a = tex.image.width / tex.image.height, s = px / Math.max(500, R.H || 900) * 2 * Math.tan(THREE.MathUtils.degToRad(16.5)); sp.scale.set(s * a, s, 1); sp.renderOrder = 10; return sp; }
function syncOverlays() {
  const m = R.m;
  // 地块归属：贴地的细色带
  const own = m.tiles.map(t => t.owner).join(',');
  if (own !== RD.ownSig) {
    RD.ownSig = own; RD.overlay.children.slice().forEach(c => { RD.overlay.remove(c); c.geometry.dispose(); });
    const per = {};
    for (const t of m.tiles) {
      if (t.owner < 0) continue; const { x, z } = tc(t.x, t.y), L = TS, w = .28, y = t.t === 'water' || t.t === 'sea' ? WY + .1 : .14;
      const seg = (nx, ny, gx, gz, a, b) => { const n = tileAt(m, nx, ny); if (n && n.owner === t.owner) return; const geo = new THREE.BoxGeometry(a, .06, b); geo.translate(x + gx, y, z + gz); (per[t.owner] = per[t.owner] || []).push(geo); };
      seg(t.x, t.y - 1, 0, -L / 2 + w / 2, L, w); seg(t.x, t.y + 1, 0, L / 2 - w / 2, L, w); seg(t.x - 1, t.y, -L / 2 + w / 2, 0, w, L); seg(t.x + 1, t.y, L / 2 - w / 2, 0, w, L);
    }
    for (const pid in per) { const col = m.players[pid].color; const mesh = new THREE.Mesh(mergeGeometries(per[pid]), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .78, depthWrite: false })); mesh.renderOrder = 4; RD.overlay.add(mesh); }
  }
  // 高亮集合
  const hs = R.hl ? [...R.hl].join(',') + R.hlCol : '';
  if (hs !== RD.hlSig) {
    RD.hlSig = hs; if (RD.hlMesh) { RD.world.remove(RD.hlMesh); RD.hlMesh.geometry.dispose(); RD.hlMesh = null; }
    if (R.hl && R.hl.size) { const gs = [...R.hl].map(i => { const t = m.tiles[i], { x, z } = tc(t.x, t.y), g = new THREE.PlaneGeometry(TS - .6, TS - .6); g.rotateX(-Math.PI / 2); g.translate(x, .3, z); return g; });
      RD.hlMesh = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshBasicMaterial({ color: R.hlCol, transparent: true, opacity: .3, depthWrite: false })); RD.hlMesh.renderOrder = 3; RD.world.add(RD.hlMesh); }
  }
  if (RD.hlMesh) RD.hlMesh.material.opacity = .34 + Math.sin(R.t * 3) * .1;
  const place = (mesh, i) => { if (i == null) { mesh.visible = false; return; } const t = m.tiles[i]; if (!t) { mesh.visible = false; return; } const { x, z } = tc(t.x, t.y); mesh.position.set(x, t.t === 'water' || t.t === 'sea' ? WY : 0, z); mesh.visible = true; };
  place(RD.selMesh, R.sel); place(RD.hovMesh, R.hover === R.sel ? null : R.hover);
  place(RD.aucMesh, m.auction ? m.auction.y * MAP_W + m.auction.x : null); if (RD.aucMesh.visible) RD.aucMesh.children.forEach(c => { c.material.opacity = .55 + Math.sin(R.t * 4) * .4; });
  // 资源视图徽标
  const bs = R.resView ? 'on' : '';
  if (bs !== RD.badgeSig) { RD.badgeSig = bs; RD.badges.clear(); if (R.resView) for (const t of m.tiles) { if (!t.res && !t.metro) continue; const { x, z } = tc(t.x, t.y); const s = sprite(badgeTex(t.metro ? '地铁 +30%' : RES[t.res].n + ' ' + '★'.repeat(t.r), t.metro ? '#7d5fc9' : RES[t.res].col, 48, t.metro ? 150 : 132), 20); s.position.set(x, 3, z); RD.badges.add(s); } }
  // 施工进度：只在选中或悬停的工地上显示
  const ps = [R.sel, R.hover].filter(i => i != null && m.tiles[i] && m.tiles[i].b && m.tiles[i].b.prog > 0).map(i => i + ':' + Math.ceil(m.tiles[i].b.prog)).join(',');
  if (ps !== RD.progSig) { RD.progSig = ps; RD.status.clear();
    for (const i of new Set([R.sel, R.hover])) { const t = i != null && m.tiles[i]; if (!t || !t.b || !(t.b.prog > 0)) continue; const tot = t.b.lv > 1 ? 5 : 6, f = clamp(Math.round((1 - t.b.prog / tot) * 6), 0, 6); const { x, z } = tc(t.x, t.y); const s = sprite(progTex(f), 14); s.position.set(x, 4 + f * 1.1 + 9, z); RD.status.add(s); } }
}
const progCache = {};
function progTex(f) { if (progCache[f]) return progCache[f]; const c = document.createElement('canvas'); c.width = 120; c.height = 22; const x = c.getContext('2d'); x.fillStyle = 'rgba(14,18,24,.85)'; x.beginPath(); x.roundRect(0, 0, 120, 22, 6); x.fill(); x.fillStyle = '#f3d27c'; x.fillRect(5, 6, 110 * f / 6, 10); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return progCache[f] = t; }

// ---------- 烟、船、浮字 ----------
function smokeStep(dt) {
  if (!RD.smokeMat) { RD.smokeMat = [new THREE.SpriteMaterial({ map: RD.T.smoke, color: 0xeeeeec, transparent: true, depthWrite: false, opacity: .5 }), new THREE.SpriteMaterial({ map: RD.T.smoke, color: 0x5a5753, transparent: true, depthWrite: false, opacity: .5 })]; }
  for (const e of RD.emit) { const st = e.st(); if (!st || st.idle || st.stall) continue; if (Math.random() < dt * (e.big ? 5 : 2.5)) { const s = new THREE.Sprite(RD.smokeMat[e.dark ? 1 : 0].clone()); s.position.set(e.x + (Math.random() - .5) * .6, e.y, e.z + (Math.random() - .5) * .6); s.scale.setScalar(e.big ? 2.4 : 1.3); s.userData = { v: 1.5 + Math.random(), life: 0, max: 4.5 + Math.random() * 2, g: e.big ? 1.7 : 1 }; RD.world.add(s); RD.smoke.push(s); } }
  RD.smoke = RD.smoke.filter(s => { const u = s.userData; u.life += dt; if (u.life > u.max) { RD.world.remove(s); s.material.dispose(); return false; } s.position.y += u.v * dt; s.position.x += dt * .9; s.scale.setScalar(s.scale.x + dt * u.g); s.material.opacity = .45 * (1 - u.life / u.max); return true; });
}
function boatStep(dt) {
  for (const b of RD.boats) {
    b.p = (b.p + dt * b.sp) % b.path.length; const i = Math.floor(b.p), f = b.p - i, a = b.path[i], c = b.path[(i + 1) % b.path.length];
    const jump = Math.abs(c.x - a.x) + Math.abs(c.y - a.y) > 2; const A = tc(a.x, a.y), C = jump ? A : tc(c.x, c.y);
    b.g.position.set(A.x + (C.x - A.x) * f, WY + Math.sin(R.t * 1.3 + b.p) * .03, A.z + (C.z - A.z) * f); if (!jump && (C.x !== A.x || C.z !== A.z)) b.g.rotation.y = Math.atan2(-(C.z - A.z), C.x - A.x);
  }
}
function addFloat(tx, ty, txt, col) { if (!RD) return; const { x, z } = tc(tx, ty); const el = document.createElement('div'); el.className = 'f3'; el.textContent = txt; el.style.color = col || '#fff'; RD.floatEl.appendChild(el); RD.floats.push({ el, p: new THREE.Vector3(x, 12, z), t: 0 }); if (RD.floats.length > 30) { const o = RD.floats.shift(); o.el.remove(); } }
function floatStep(dt) {
  const v = new THREE.Vector3();
  RD.floats = RD.floats.filter(f => { f.t += dt; if (f.t > 1.6) { f.el.remove(); return false; } v.copy(f.p); v.y += f.t * 4; v.project(RD.camera); const sx = (v.x + 1) / 2 * R.W, sy = (1 - v.y) / 2 * R.H; f.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%)`; f.el.style.opacity = String(1 - f.t / 1.6); f.el.style.display = v.z < 1 ? '' : 'none'; return true; });
}

// ---------- 镜头 ----------
function fitCam() { R.cam.tx = 0; R.cam.tz = 0; R.cam.dist = clamp(MAP_W * TS * 1.45 / Math.min(1.6, R.W / R.H), 280, 560); R.cam.pitch = .95; R.cam.yaw = Math.PI / 4; }
function camTo(x, y, dist) { const p = tc(x, y); R.cam.tx = p.x; R.cam.tz = p.z; if (dist) R.cam.dist = dist; }
function rZoom(f) { R.cam.dist = clamp(R.cam.dist * f, 40, 600); }
function applyCam() {
  const c = R.cam, cam = RD.camera; c.pitch = clamp(c.pitch, .3, 1.35); const half = MAP_W * TS / 2 + 30; c.tx = clamp(c.tx, -half, half); c.tz = clamp(c.tz, -half, half);
  cam.position.set(c.tx + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), c.dist * Math.sin(c.pitch), c.tz + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw)); cam.lookAt(c.tx, 0, c.tz);
  const f = RD.scene.fog; f.near = c.dist * .9 + 80; f.far = c.dist * 3.2 + 900;
}
const ray = new THREE.Raycaster(), gplane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
function pickTile(sx, sy) {
  if (!R.m) return null; const r = R.cv.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((sx - r.left) / r.width * 2 - 1, -(sy - r.top) / r.height * 2 + 1), RD.camera);
  if (!ray.ray.intersectPlane(gplane, hit)) return null; const tx = Math.floor(hit.x / TS + MAP_W / 2), ty = Math.floor(hit.z / TS + MAP_H / 2); return tileAt(R.m, tx, ty);
}
function tileScreen(x, y) { const p = tc(x, y), v = new THREE.Vector3(p.x, 0, p.z).project(RD.camera); return [(v.x + 1) / 2 * R.W, (1 - v.y) / 2 * R.H]; }
function rInput(cv) {
  const pts = new Map(); let down = null, moved = false, pinch = null;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); down = { x: e.clientX, y: e.clientY, b: e.button, tx: R.cam.tx, tz: R.cam.tz, yaw: R.cam.yaw, pitch: R.cam.pitch, rot: e.button === 2 || e.shiftKey }; moved = false;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: R.cam.dist, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), yaw: R.cam.yaw, my: (a[1] + b[1]) / 2, pitch: R.cam.pitch }; } });
  cv.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; R.cam.dist = clamp(pinch.dist * pinch.d / Math.hypot(a[0] - b[0], a[1] - b[1]), 40, 600); R.cam.yaw = pinch.yaw - (Math.atan2(b[1] - a[1], b[0] - a[0]) - pinch.ang); R.cam.pitch = pinch.pitch + ((a[1] + b[1]) / 2 - pinch.my) * .004; moved = true; return; }
    if (down && pts.size === 1) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 5) { moved = true; cv.classList.add('drag'); }
      if (!moved) return;
      if (down.rot) { R.cam.yaw = down.yaw - dx * .006; R.cam.pitch = down.pitch + dy * .004; }
      else { const k = R.cam.dist / R.H * 1.15, s = Math.sin(R.cam.yaw), c = Math.cos(R.cam.yaw); R.cam.tx = down.tx - (dx * c + dy * s / Math.sin(R.cam.pitch)) * k; R.cam.tz = down.tz - (-dx * s + dy * c / Math.sin(R.cam.pitch)) * k; }
    } else if (e.pointerType === 'mouse') { const t = pickTile(e.clientX, e.clientY); const h = t ? t.y * MAP_W + t.x : null; if (h !== R.hover) { R.hover = h; R.onHover && R.onHover(t); } }
  });
  const up = e => { pts.delete(e.pointerId); cv.classList.remove('drag'); if (pts.size < 2) pinch = null;
    if (down && !moved && pts.size === 0 && down.b === 0) { const t = pickTile(e.clientX, e.clientY); R.onClick && R.onClick(t, e); }
    if (pts.size === 0) down = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (R.hover != null) { R.hover = null; R.onHover && R.onHover(null); } });
  cv.addEventListener('wheel', e => { e.preventDefault(); R.cam.dist = clamp(R.cam.dist * Math.exp(e.deltaY * .0012), 40, 600); }, { passive: false });
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.key === 'q' || e.key === 'Q') R.cam.yaw += .2; if (e.key === 'e' || e.key === 'E') R.cam.yaw -= .2; });
}

// ---------- 日照 ----------
function sunState(tod) { // 0..1 一天；72% 白天
  const day = .72; let el, az;
  if (tod < day) { const p = tod / day; el = Math.sin(p * Math.PI) * 58; az = -70 + p * 140; } else { const p = (tod - day) / (1 - day); el = -Math.sin(p * Math.PI) * 16; az = 70 + p * 220; }
  return { el, az };
}
function setSun(force) {
  const s = sunState(R.tod), day = s.el > 0, phi = THREE.MathUtils.degToRad(90 - s.el), th = THREE.MathUtils.degToRad(s.az + 200);
  const v = new THREE.Vector3().setFromSphericalCoords(1, phi, th);
  RD.sky.material.uniforms.sunPosition.value.copy(v); RD.sky2.material.uniforms.sunPosition.value.copy(v);
  const warm = clamp(1 - s.el / 28, 0, 1), dusk = clamp(1 + s.el / 6, 0, 1);
  if (day) { RD.sun.position.copy(v).multiplyScalar(500); RD.sun.color.setRGB(1, .95 - warm * .2, .88 - warm * .42); RD.sun.intensity = 3.6 * clamp(s.el / 12, .12, 1); }
  else { RD.sun.position.set(-260, 340, 200); RD.sun.color.setRGB(.55, .66, 1); RD.sun.intensity = .2; }
  RD.sun.target.position.set(R.cam.tx, 0, R.cam.tz); RD.sun.position.add(RD.sun.target.position);
  const sz = clamp(R.cam.dist * .78, 50, 190), scm = RD.sun.shadow.camera; if (Math.abs(scm.right - sz) > 4) { scm.left = scm.bottom = -sz; scm.right = scm.top = sz; scm.updateProjectionMatrix(); }
  RD.hemi.intensity = day ? .26 + clamp(s.el / 60, 0, .12) : .05 + .1 * dusk;
  RD.renderer.toneMappingExposure = day ? .5 : .5 + .1 * (1 - dusk);
  const fogDay = new THREE.Color(.64, .71, .79), fogDusk = new THREE.Color(.78, .6, .48), fogNight = new THREE.Color(.035, .045, .07);
  RD.scene.fog.color.copy(day ? fogDay.clone().lerp(fogDusk, warm * warm * .85) : fogDusk.clone().lerp(fogNight, 1 - dusk));
  const nightK = day ? clamp(1 - s.el / 7, 0, 1) : 1;
  for (const k in RD.M.fac) RD.M.fac[k].emissiveIntensity = nightK * (k === 'shop' ? 2.2 : 1.4);
  RD.M.glow.emissiveIntensity = 2 + nightK * 2; RD.M.lamp.emissiveIntensity = nightK * 4; RD.M.pearl.emissiveIntensity = nightK * .35;
  for (const k in RD.M.pcGlow) RD.M.pcGlow[k].emissiveIntensity = .5 + nightK * 2;
  RD.bloom.strength = .1 + nightK * .55; if (RD.smokeMat) { RD.smokeMat[0].color.setScalar(.93 - nightK * .75); RD.smokeMat[1].color.setScalar(.35 - nightK * .25); } RD.renderer.toneMappingExposure *= R.quality !== 'high' ? 1.08 : 1;
  if (RD.water && RD.water.material.uniforms) { const u = RD.water.material.uniforms; u.sunDirection.value.copy(v.y > 0 ? v : new THREE.Vector3(-.4, .7, .3)).normalize(); u.sunColor.value.copy(RD.sun.color).multiplyScalar(day ? clamp(RD.sun.intensity / 3.6, .2, 1) : .12); u.waterColor.value.setRGB(.07, .19, .2).multiplyScalar(day ? 1 : .2); }
  if (force || Math.abs((RD.lastEnvEl ?? -99) - s.el) > 2.5) { RD.lastEnvEl = s.el; if (RD.envRT) RD.envRT.dispose(); RD.envRT = RD.pmrem.fromScene(RD.skyScene); RD.scene.environment = RD.envRT.texture; }
}

// ---------- 主循环 ----------
function rLoop(ts) {
  requestAnimationFrame(rLoop);
  const dt = Math.min(.05, (ts - (R.last || ts)) / 1000); R.last = ts; R.t += dt;
  if (!RD || document.hidden) return;
  RD.frame++;
  R.tod = (R.tod + dt * R.todSpeed) % 1; if (Math.floor(ts / 500) !== RD.sunTick) { RD.sunTick = Math.floor(ts / 500); setSun(); }
  if (R.drift) R.cam.yaw += dt * .03;
  applyCam(); RD.sun.target.position.set(R.cam.tx, 0, R.cam.tz);
  RD.T.waterN.offset.x += dt * .01; RD.T.waterN.offset.y += dt * .006;
  if (RD.water && RD.water.material.uniforms) RD.water.material.uniforms.time.value += dt * .45;
  if (R.m) {
    syncTiles(); syncOverlays();
    for (const a of RD.anims) a.fn(dt, R.t, a.st());
    smokeStep(dt); boatStep(dt); carStep(dt); floatStep(dt);
  }
  if (R.quality === 'soft') { if (ts - (RD.lastDraw || 0) < 250) return; RD.lastDraw = ts; }   // 软件渲染：最多 4 帧/秒
  if (R.quality !== 'high') RD.renderer.render(RD.scene, RD.camera); else RD.composer.render();
}
