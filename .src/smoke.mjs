import { chromium } from '/Users/a1-6/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs';
import fs from 'fs';

const URL = process.env.URL || 'http://127.0.0.1:8811/index.html';
const LOAD_SAVE = process.argv.includes('--save');
const OUT = process.env.OUT || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(700);

if (LOAD_SAVE) {
  const save = JSON.parse(fs.readFileSync('./saves/save.json', 'utf8'));
  await page.evaluate(s => localStorage.setItem('shanghai_tycoon_v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
}

// 开局（如果没有存档）
const startBtn = await page.$('#startBtn');
if (startBtn) { await startBtn.click(); await page.waitForTimeout(400); }

await page.screenshot({ path: `${OUT}/home.png`, fullPage: false });

// 4x 跑 6 秒，测渲染耗时
await page.evaluate(() => { const b = document.querySelector('[data-speed="4"]'); b && b.click(); });
const perf = await page.evaluate(async () => {
  const res = [];
  const t0 = performance.now();
  // 直接连续 tick，测单次渲染成本
  for (let i = 0; i < 12; i++) {
    const s = performance.now();
    window.__tick ? window.__tick() : null;
    res.push(+(performance.now() - s).toFixed(2));
    await new Promise(r => setTimeout(r, 60));
  }
  return { samples: res, total: +(performance.now() - t0).toFixed(0), nodes: document.querySelectorAll('*').length };
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/home-after.png` });

// 遍历所有窗口
const desks = await page.$$eval('[data-open]', els => els.map(e => e.dataset.open));
const seen = [];
for (const d of desks) {
  await page.evaluate(id => {
    const el = document.querySelector(`[data-open="${id}"]`);
    el && el.click();
  }, d);
  await page.waitForTimeout(320);
  const ok = await page.evaluate(() => !!document.querySelector('#wb') && document.querySelector('#wb').innerHTML.length > 40);
  seen.push(`${d}:${ok ? 'ok' : 'EMPTY'}`);
  if (['trade', 'port', 'stock', 'deal', 'hq', 'macau', 'rank'].includes(d)) {
    await page.screenshot({ path: `${OUT}/win-${d}.png` });
  }
  // 交易窗口点一个商品
  if (d === 'trade') {
    await page.evaluate(() => { const r = document.querySelector('tr[data-good]'); r && r.click(); });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/win-trade-ticket.png` });
  }
  await page.evaluate(() => { const x = document.querySelector('[data-closew]'); x && x.click(); });
  await page.waitForTimeout(160);
}

// 手机视口
const m = await ctx.newPage();
m.on('pageerror', e => errors.push('MOBILE PAGEERROR: ' + e.message));
await m.setViewportSize({ width: 390, height: 844 });
await m.goto(URL, { waitUntil: 'load' });
await m.waitForTimeout(900);
const s2 = await m.$('#startBtn'); if (s2) { await s2.click(); await m.waitForTimeout(400); }
await m.screenshot({ path: `${OUT}/mobile-home.png`, fullPage: false });
await m.evaluate(() => { const el = document.querySelector('[data-open="trade"]'); el && el.click(); });
await m.waitForTimeout(400);
await m.screenshot({ path: `${OUT}/mobile-trade.png` });
const overflowX = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const state = await page.evaluate(() => {
  const S = window.__S;
  return S ? { day: S.day, cash: Math.round(S.cash), nw: Math.round(window.__nw ? window.__nw() : 0), level: S.level, news: S.news.length } : null;
});

console.log(JSON.stringify({ perf, windows: seen, overflowX, state, errors }, null, 2));
await browser.close();
