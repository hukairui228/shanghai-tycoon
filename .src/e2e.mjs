import { chromium } from '/Users/a1-6/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs';
import fs from 'fs';
const OUT = '/tmp/shots2'; fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:8811/index.html';
const log = []; const errs = [];
process.on('uncaughtException',e=>{console.log(log.join('\n'));console.log('\nTHROWN: '+e.message);console.log('ERR: '+(errs.join('\n')||'none'));process.exit(1)});
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
await p.click('#startBtn'); await p.waitForTimeout(400);
const ok = (n, v) => log.push(`${v ? 'PASS' : 'FAIL'} · ${n}`);
const waitModal = async (re, ms = 4000) => {
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < ms) {
    last = await p.evaluate(() => __T.modalText());
    if (re.test(last)) return last;
    if (last) {
      // 有弹窗挡路但不是我们要的：点掉它（优先取消类按钮，否则最后一个动作按钮）
      const closed = await p.evaluate(() => {
        const root = document.querySelector('#modalRoot'); if (!root) return false;
        const c = root.querySelector('[data-close]') || [...root.querySelectorAll('[data-act]')].pop();
        if (c) { c.click(); return true } return false;
      });
      await p.waitForTimeout(200);
      if (!closed) break;
    } else await p.waitForTimeout(120);
  }
  return last;
};

// 关掉可能的弹窗
const closeModalIfAny = async () => { for (let i = 0; i < 4; i++) { const btn = await p.$('#modalRoot [data-close]'); if (!btn) break; await btn.click(); await p.waitForTimeout(120); } await p.evaluate(() => __T.clearModals()); };
await closeModalIfAny();

// ---- 1. 交易 ----
await p.click('[data-open="trade"]'); await p.waitForTimeout(300);
await p.click('tr[data-good="soy"]'); await p.waitForTimeout(250);
await p.screenshot({ path: OUT + '/trade.png' });
const cash0 = await p.evaluate(() => __S.cash);
await p.evaluate(() => { const r = document.querySelector('[data-range="pct"]'); r.value = 80; r.dispatchEvent(new Event('input', { bubbles: true })) });
await p.click('[data-gtrade]'); await p.waitForTimeout(300);
const cash1 = await p.evaluate(() => __S.cash);
ok('买入扣除现金', cash1 < cash0);
const inv0 = await p.evaluate(() => __S.inv[__ui.city].soy ? __S.inv[__ui.city].soy.q : 0);
ok('库存增加', inv0 > 0);

// ---- 2. 一键调货（trade → port） ----
await p.evaluate(() => { const b = document.querySelector('[data-shipfast]'); b && b.click() });
await p.waitForTimeout(350);
const inPort = await p.evaluate(() => document.querySelector('#winRoot h2') ? document.querySelector('#winRoot h2').textContent : null);
ok('一键跳转到航运窗口', inPort === '航运');
await p.screenshot({ path: OUT + '/port.png' });
await p.evaluate(() => { const c = document.querySelector('[data-ins]'); c && c.click() });
await p.waitForTimeout(150);
await p.click('[data-sail]'); await p.waitForTimeout(300);
const ship = await p.evaluate(() => __S.ships[0] || null);
ok('发船成功', !!ship);
ok('投保生效', !!(ship && ship.ins));

// ---- 3. 合同议价（无 key，本地模型） ----
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.evaluate(() => { if (!__S.offers.length) genOffer(); });
await p.click('[data-open="deal"]'); await p.waitForTimeout(300);
await p.screenshot({ path: OUT + '/deal.png' });
const re0 = await p.evaluate(() => __S.offers[0] && __S.offers[0].reward);
await p.click('[data-nego]'); await p.waitForTimeout(300);
const hasAsk = await p.evaluate(() => !!document.querySelector('#askIn'));
ok('议价弹窗出现', hasAsk);
await p.fill('#askIn', '价格再上浮 12%，期限给我 20 天');
await p.click('#askGo'); await p.waitForTimeout(900);
const negoModal = await p.evaluate(() => { const m = document.querySelector('#modalRoot .modal'); return m ? m.textContent.slice(0, 80) : '' });
ok('议价返回结果', /谈成|谈崩|没谈成/.test(negoModal));
const re1 = await p.evaluate(() => __S.offers[0] && __S.offers[0].reward);
log.push(`  回款 ${re0} → ${re1}`);
await closeModalIfAny();

// ---- 4. 设置 + 演示模式 ----
await p.evaluate(() => { __T.close(); __T.open('settings') }); await p.waitForTimeout(350);
await p.screenshot({ path: OUT + '/settings.png' });
await p.evaluate(() => { const b = document.querySelector('[data-toggle="mock"]'); b && b.click() }); await p.waitForTimeout(250);
const mockOn = await p.evaluate(() => __AI.cfg.mock);
ok('演示模式可开启', mockOn === true);
const ready = await p.evaluate(() => __AI.ready());
ok('AI ready = true', ready);
await p.evaluate(() => { const b = document.querySelector('#aiTest'); b && b.click() }); await p.waitForTimeout(900);
const toastTxt = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join('|'));
ok('连通性测试有反馈', /连通正常|失败/.test(toastTxt));
await p.evaluate(() => __T.close()); await p.waitForTimeout(200);

// ---- 5. AI 抽屉：咨询（流式） ----
await p.click('#aiFab'); await p.waitForTimeout(300);
await p.fill('#aiIn', '现在该干什么？');
await p.keyboard.press('Enter');
await p.waitForTimeout(300);
const streaming = await p.evaluate(() => { const m = document.querySelectorAll('#aiBody .msg'); return m.length ? m[m.length - 1].innerHTML.length : 0 });
await p.waitForTimeout(1600);
const bub = await p.evaluate(() => { const m = document.querySelectorAll('#aiBody .msg'); return m.length ? m[m.length - 1].textContent : '' });
ok('咨询有流式输出', streaming > 0 && bub.length > 20);
log.push('  回复片段：' + bub.slice(0, 40).replace(/\n/g, ' '));
await p.screenshot({ path: OUT + '/ai-ask.png' });

// ---- 6. 下令：本地/模拟解析 → 确认 → 执行 ----
await p.evaluate(() => { const b = document.querySelector('[data-aimode="cmd"]'); b && b.click() }); await p.waitForTimeout(200);
const invBefore = await p.evaluate(() => (__S.inv.sz && __S.inv.sz.soy ? __S.inv.sz.soy.q : 0));
await p.fill('#aiIn', '在深圳买 5 吨大豆'); await p.keyboard.press('Enter');
await p.waitForTimeout(1200);
const confirmTxt = await p.evaluate(() => { const c = document.querySelector('#aiConfirm'); return c ? c.textContent : '' });
ok('生成确认卡', /买入/.test(confirmTxt));
await p.screenshot({ path: OUT + '/ai-cmd.png' });
await p.evaluate(() => { const b = document.querySelector('[data-run]'); b && b.click() }); await p.waitForTimeout(500);
const invAfter = await p.evaluate(() => (__S.inv.sz && __S.inv.sz.soy ? __S.inv.sz.soy.q : 0));
ok('自然语言下单真正执行', invAfter > invBefore);
log.push(`  深圳大豆 ${invBefore} → ${invAfter}`);
await p.evaluate(() => __T.clearModals()); await p.waitForTimeout(150);
await p.click('[data-closeai]'); await p.waitForTimeout(200);

// ---- 7. 情报 ----
await p.evaluate(() => { __S.intel = 200; __S.queued = [{ t: '华东钢厂高炉检修两周，螺纹钢到货紧张', city: 'sh', goods: ['rb'], m: 1.07, days: 0, at: __S.day + 2 }]; __T.refresh() });
await p.evaluate(() => { __T.close(); __T.open('hq') }); await p.waitForTimeout(350);
await p.click('[data-intelbuy="event"]'); await p.waitForTimeout(400);
const intelModal = await waitModal(/消息|内参/);
ok('情报可查未公开消息', /消息|内参/.test(intelModal));
if(!/消息|内参/.test(intelModal)) log.push('  modal=' + intelModal.slice(0,120).replace(/\s+/g,' '));
const intelLeft = await p.evaluate(() => __S.intel);
ok('情报点数被扣除', intelLeft === 180);
await p.screenshot({ path: OUT + '/hq.png' });
await closeModalIfAny();

// ---- 8. 宏观切换 ----
const macro0 = await p.evaluate(() => __S.macro.id);
await p.evaluate(() => { __S.macro.until = __S.day; __tick() });
await p.waitForTimeout(300);
const macro1 = await p.evaluate(() => __S.macro.id);
ok('宏观周期会轮换', macro1 !== macro0);
log.push(`  宏观 ${macro0} → ${macro1}`);

// ---- 9. 月度财报 ----
await closeModalIfAny();
await p.evaluate(() => { __S.day = 29; __tick() }); await p.waitForTimeout(500);
const rep = await waitModal(/经营回顾|月度/);
ok('月度财报弹出', /经营回顾|月度/.test(rep));
if(!/经营回顾|月度/.test(rep)) log.push('  modal=' + rep.slice(0,120).replace(/\s+/g,' '));
await p.screenshot({ path: OUT + '/report.png' });
await closeModalIfAny();

// ---- 10. 键盘 ----
await p.keyboard.press('1'); await p.waitForTimeout(300);
ok('数字键打开窗口', (await p.evaluate(() => document.getElementById('winRoot').innerHTML.includes('交易所'))) === true);
await p.keyboard.press('Escape'); await p.waitForTimeout(250);
await p.keyboard.press(' '); await p.waitForTimeout(200);
const sp = await p.evaluate(() => __T.speed());
await p.keyboard.press(' '); await p.waitForTimeout(200);
ok('空格暂停/继续', sp === 0 && (await p.evaluate(() => __T.speed())) === 1);

// ---- 11. 性能：窗口打开时连续渲染 ----
await p.evaluate(() => { __T.open('trade') }); await p.waitForTimeout(300);
const perf = await p.evaluate(async () => {
  const t0 = performance.now(); const samples = [];
  for (let i = 0; i < 30; i++) { const s = performance.now(); __T.frame(); samples.push(performance.now() - s); await new Promise(r => setTimeout(r, 20)); }
  samples.sort((a, b) => a - b);
  return { avg: +(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2), p95: +samples[Math.floor(samples.length * .95)].toFixed(2), nodes: document.querySelectorAll('*').length };
});
log.push(`性能：单帧渲染 avg ${perf.avg}ms / p95 ${perf.p95}ms · DOM ${perf.nodes} 节点`);

// ---- 12. 手机端 ----
const m = await ctx.newPage(); m.on('pageerror', e => errs.push('MOBILE ' + e.message));
await m.setViewportSize({ width: 390, height: 844 });
await m.goto(URL); await m.waitForTimeout(900);
await m.screenshot({ path: OUT + '/mobile.png' });
const ovf = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth);
ok('手机端无横向溢出', ovf <= 0);
await m.evaluate(() => { const e = document.querySelector('[data-open="trade"]'); e && e.click() }); await m.waitForTimeout(400);
await m.screenshot({ path: OUT + '/mobile-trade.png' });

console.log(log.join('\n'));
console.log('\nERRORS: ' + (errs.length ? '\n' + errs.join('\n') : 'none'));
await b.close();
