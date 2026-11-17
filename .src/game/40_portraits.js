// ===================== PORTRAITS =====================
// 扁平插画风半身像，64×64。look: skin hair hc suit tie glasses age fem
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255; const f = v => Math.round(clamp(k > 0 ? v + (255 - v) * k : v * (1 + k), 0, 255)); return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1); }
function portrait(L, bg) {
  const sk = L.skin, sk2 = shade(sk, -.12), hc = L.hc, su = L.suit, su2 = shade(su, -.25);
  const fem = L.hair === 'bob' || L.hair === 'bun' || L.hair === 'long';
  let hairBack = '', hairFront = '';
  switch (L.hair) {
    case 'short': hairFront = `<path d="M17 25c0-11 7-15 15-15s15 4 15 14c-2-4-5-6-9-6-6 0-11 1-17 2-2 1-3 3-4 5z" fill="${hc}"/>`; break;
    case 'slick': hairFront = `<path d="M17 26c-1-10 6-16 15-16 9 0 15 5 15 13-3-5-8-7-14-7-7 0-11 3-16 10z" fill="${hc}"/><path d="M24 14c6-2 13-1 18 3" stroke="${shade(hc, .25)}" stroke-width="1.2" fill="none" opacity=".6"/>`; break;
    case 'bald': hairFront = `<path d="M17 29c0-4 1-7 2-8v9zM47 29c0-4-1-7-2-8v9z" fill="${hc}"/>`; break;
    case 'bob': hairBack = `<path d="M14 30c0-14 7-21 18-21s18 7 18 21v9c-3 2-6 2-8 0V28c-3-1-6-4-8-8-3 5-9 8-14 8v11c-2 2-5 2-6 0z" fill="${hc}"/>`; hairFront = `<path d="M17 27c1-10 7-15 15-15 9 0 14 6 15 13-6 0-11-3-14-8-3 6-9 10-16 10z" fill="${hc}"/>`; break;
    case 'bun': hairBack = `<circle cx="32" cy="9" r="6" fill="${hc}"/>`; hairFront = `<path d="M17 27c0-11 7-16 15-16s15 5 15 16c-3-6-8-9-15-9s-12 3-15 9z" fill="${hc}"/>`; break;
    case 'long': hairBack = `<path d="M13 32c0-16 8-23 19-23s19 7 19 23v20H13z" fill="${hc}"/>`; hairFront = `<path d="M17 28c0-11 7-16 15-16s15 5 15 16c-4-5-9-8-15-8s-11 3-15 8z" fill="${hc}"/>`; break;
  }
  const glasses = L.glasses ? `<g fill="none" stroke="#1b1b1f" stroke-width="1.3"><rect x="21.5" y="26" width="8.5" height="6.5" rx="2.4"/><rect x="34" y="26" width="8.5" height="6.5" rx="2.4"/><path d="M30 28.5h4"/></g>` : '';
  const age = L.age >= 2 ? `<path d="M22 37c2 1 4 1 5 0M37 37c1 1 3 1 5 0" stroke="${sk2}" stroke-width=".9" fill="none"/>` : '';
  const neck = `<path d="M27 40h10v8H27z" fill="${sk2}"/>`;
  const body = fem
    ? `<path d="M8 64c1-10 8-16 18-17l6 5 6-5c10 1 17 7 18 17z" fill="${su}"/><path d="M26 47l6 6 6-6" fill="none" stroke="${su2}" stroke-width="1.5"/><circle cx="32" cy="55" r="1.6" fill="#e6c27a"/>`
    : `<path d="M7 64c1-10 8-16 19-17l6 7 6-7c11 1 18 7 19 17z" fill="${su}"/><path d="M26 47l6 7 6-7-3-1-3 3-3-3z" fill="#f4f1ea"/>${L.tie ? `<path d="M31 50h2l1.5 2-1 9h-3l-1-9z" fill="${L.tie}"/>` : ''}<path d="M26 47l-3 5 7 4M38 47l3 5-7 4" fill="none" stroke="${su2}" stroke-width="1.3"/>`;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="64" height="64" fill="${bg || '#2a3240'}"/><circle cx="32" cy="70" r="40" fill="${shade(bg || '#2a3240', .08)}"/>${hairBack}${body}${neck}<ellipse cx="17.5" cy="31" rx="2.6" ry="3.6" fill="${sk2}"/><ellipse cx="46.5" cy="31" rx="2.6" ry="3.6" fill="${sk2}"/><ellipse cx="32" cy="29" rx="14.5" ry="16.5" fill="${sk}"/><path d="M19 33c2 8 7 12 13 12s11-4 13-12c-1 6-6 10-13 10s-12-4-13-10z" fill="${sk2}" opacity=".5"/>${hairFront}<path d="M23 25.5c2-1 4-1 6 0M35 25.5c2-1 4-1 6 0" stroke="${shade(hc, -.2)}" stroke-width="1.4" fill="none" stroke-linecap="round"/><ellipse cx="26" cy="29.5" rx="1.5" ry="1.8" fill="#1f1a17"/><ellipse cx="38" cy="29.5" rx="1.5" ry="1.8" fill="#1f1a17"/><path d="M31.5 31l-1.2 5h2.6" fill="none" stroke="${sk2}" stroke-width="1.1"/><path d="M28 39.2c2.4 1.4 5.6 1.4 8 0" fill="none" stroke="#8a4a3c" stroke-width="1.4" stroke-linecap="round"/>${fem ? `<path d="M28 39c2.4 1.6 5.6 1.6 8 0" stroke="#b5504a" stroke-width="1.8" fill="none" stroke-linecap="round"/>` : ''}${glasses}${age}</svg>`;
}
const MY_LOOKS = [
  { skin: '#efc9a7', hair: 'short', hc: '#1c1a1a', suit: '#1e2430', tie: '#b8932f', glasses: false, age: 0 },
  { skin: '#f2d2b6', hair: 'long', hc: '#21160f', suit: '#2c2230', tie: null, glasses: false, age: 0 },
  { skin: '#e6b893', hair: 'slick', hc: '#2b211b', suit: '#2a3b2f', tie: '#7a2a2a', glasses: true, age: 0 },
  { skin: '#f0cdb0', hair: 'bun', hc: '#3a2a20', suit: '#e8e2d6', tie: null, glasses: true, age: 0 },
  { skin: '#d9a982', hair: 'short', hc: '#4a3a30', suit: '#3a2f2a', tie: '#2f5b8a', glasses: true, age: 2 },
  { skin: '#f3d6bd', hair: 'bob', hc: '#5a3a24', suit: '#20304a', tie: null, glasses: false, age: 0 },
];
