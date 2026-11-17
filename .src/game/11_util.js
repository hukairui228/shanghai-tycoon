// ===================== UTIL =====================
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pickR = (rng, a) => a[Math.floor(rng() * a.length)];
function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  const s = n < 0 ? '-' : ''; n = Math.abs(n);
  if (n >= 1e8) return s + '¥' + (n / 1e8).toFixed(2) + '亿';
  if (n >= 1e4) return s + '¥' + (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + '万';
  return s + '¥' + Math.round(n).toLocaleString('en-US');
}
const fmtN = n => Math.abs(n) >= 100 ? Math.round(n).toLocaleString('en-US') : (Math.round(n * 10) / 10).toString();
const pct = (x, d = 1) => (x >= 0 ? '+' : '') + (x * 100).toFixed(d) + '%';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
