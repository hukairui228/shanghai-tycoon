// ===================== BOOT =====================
function boot(data) {
  rInit($('#cv'));
  PF = (data && data.pf) || loadProfile();
  let first = false;
  if (!PF) {
    let old = null; try { const s = localStorage.getItem(OLD_KEY); if (s) old = JSON.parse(s); } catch (e) { }
    if (old && old.started) { PF = migrateOld(old, 'local'); saveProfile(); }
    else { PF = newProfile(); PF.fresh = 1; first = true; }
  }
  PF.set = PF.set || { len: 'std', diff: 'normal' }; PF.jackpot = PF.jackpot || {}; PF.casino = PF.casino || { net: 0, trips: 0 };
  if (data && data.m) { G.onEnd = matchReward; startMatch(data.m, data.me || 0, 'solo'); G.speed = data.speed ?? 1; }
  else { runDemo(); renderHome(); if (PF.migrated && !PF.migrated.noted) migratedNote(); else if (first) setTimeout(() => { if (!PF.co) profileModal(); }, 600); }
  initCloud(); initRoom();
}
window.claude?.hot?.snapshot?.(() => ({ pf: PF, m: G.role === 'solo' && G.m && !G.m.over ? G.m : null, me: G.me, speed: G.speed }));
if (window.claude?.hot?.ready) window.claude.hot.ready(boot); else boot(window.claude?.hot?.data ?? null);
// 测试钩子（Playwright 用）
Object.assign(window, { __G: G, __R: R, __doAct: doAct, __canClaim: canClaim, __renderAct: renderAct });
