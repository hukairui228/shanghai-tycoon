# 商海浮沉

单文件网页商业模拟游戏。你在上海开一家贸易公司，在六大港口之间倒卖大宗商品、承接合同、炒 A 股、收藏奢侈品，和 4 家 AI 财团争夺富豪榜，也可以飞去澳门玩百家乐、德州扑克和老虎机。

在线版（claude.ai，带真人排行榜和云存档）：https://claude.ai/artifact/DRRXzfp75RrVdKegdW1ViT

## 文件

| 路径 | 内容 |
| --- | --- |
| `index.html` | 整个游戏：HTML、CSS、JS 都在这一个文件里，不需要构建，也没有依赖 |
| `saves/save.json` | 存档快照：万和贸易有限公司，第 5398 天，Lv14，现金约 ¥3862 万 |

## 运行

用浏览器直接打开 `index.html` 就能玩。离开 claude.ai 运行时，存档只保存在当前浏览器的 localStorage 里（键名 `shanghai_tycoon_v1`），排行榜上只有 AI 对手。

## 载入存档

`saves/save.json` 的内容就是 localStorage 里的那份 JSON。用本地服务器打开（例如 `python3 -m http.server`，再访问 http://localhost:8000），在浏览器控制台运行：

```js
fetch('saves/save.json').then(r => r.json()).then(s => {
  localStorage.setItem('shanghai_tycoon_v1', JSON.stringify(s));
  location.reload();
});
```

## 代码结构（给编辑者）

`index.html` 中的 `<script>` 按注释分段：

- `DATA`：商品、港口、航程、股票、AI 对手、奢侈品、升级项、成就、赌场厅房等配置表
- `SIMULATION`：`tick()` 每个游戏日推进一次，负责价格、事件、股市 K 线、AI 对手、船只、贷款利息和合同
- `ACTIONS`：买卖商品、发船、股票、合同、奢侈品、升级、银行
- `CASINO`：百家乐（8 副牌、标准补牌规则）、老虎机（理论返还率约 94.7%）、德州扑克（4 人桌、蒙特卡洛估算胜率的 AI、边池结算）
- `PERSIST / MULTIPLAYER`：localStorage 存档；在 claude.ai 中通过 `window.claude.use('db')` 同步云存档和排行榜，在别处运行时这部分自动跳过
- `UI` / `VIEWS`：主页的各个模块，以及每个窗口的渲染函数

视觉规范写在 `<style>` 顶部的 `:root` 变量里：墨黑底、香槟金细线；A 股习惯，红涨绿跌。
