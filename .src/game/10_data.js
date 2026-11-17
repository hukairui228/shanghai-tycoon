// ===================== DATA =====================
// 资源：base 为基准价，depth 为市场深度（越小越容易被砸盘/拉升）
const RES = {
  food:  { n: '粮食', base: 12,  depth: 650, col: '#d8b45c' },
  oil:   { n: '原油', base: 22,  depth: 480, col: '#5f6675' },
  ore:   { n: '矿石', base: 16,  depth: 520, col: '#a8876a' },
  power: { n: '电力', base: 19,  depth: 520, col: '#f0cf4a' },
  steel: { n: '钢材', base: 64,  depth: 230, col: '#8ea7c0' },
  goods: { n: '食品', base: 80,  depth: 210, col: '#e3825b' },
  chip:  { n: '芯片', base: 135, depth: 130, col: '#4fc7ae' },
};
const RK = Object.keys(RES);

// 建筑：need=只能建在对应资源地块；in/out 每日投入产出；urban=城区加工 +15%
const BLD = {
  hq:    { n: '总部',   cost: 0 },
  branch:{ n: '分公司', cost: 0 },
  farm:  { n: '农场',   cost: 300,  need: 'food', out: { food: 2.4 } },
  well:  { n: '油井',   cost: 460,  need: 'oil',  out: { oil: 1.7 } },
  mine:  { n: '矿场',   cost: 400,  need: 'ore',  out: { ore: 1.9 } },
  plant: { n: '电厂',   cost: 700,  in: { oil: 1 },             out: { power: 3 } },
  mill:  { n: '钢厂',   cost: 950,  in: { ore: 2, power: 1 },   out: { steel: 1.25 } },
  foodw: { n: '食品厂', cost: 860,  in: { food: 3, power: 1 },  out: { goods: 1.25 } },
  fab:   { n: '芯片厂', cost: 1800, in: { ore: 1, power: 2 },   out: { chip: 1 } },
  port:  { n: '码头',   cost: 1300, port: true },
};
const BUILDABLE = ['farm', 'well', 'mine', 'plant', 'mill', 'foodw', 'fab', 'port'];
const RICH = [0, .6, 1, 1.45];
const LVM = [0, 1, 1.65, 2.4];          // 建筑等级产出倍率
const PORT_BONUS = .06;                 // 每座码头卖价 +6%，最多两座
const HQ_LV = [null,                    // 总部等级：地块许可、半径、升级成本
  { claims: 6,  radius: 4 },
  { claims: 9,  radius: 5, cash: 2200,  steel: 20 },
  { claims: 12, radius: 6, cash: 5500,  steel: 60 },
  { claims: 15, radius: 7, cash: 13000, steel: 150 },
  { claims: 18, radius: 8, cash: 30000, steel: 380 },
];
const LISTING_DAY = 100;              // 上市锁定期：此前不能买卖股票
const SHARES = 10, TAKEOVER = 5, TENDER = 1.25;   // 持股 5 股可发起要约收购；对方自持 5 股则免疫

// 商业手段
const SAB = {
  strike:  { n: '组织罢工', cost: 650,  cd: 30, tgt: 'bld',  d: '目标建筑停工 30 天' },
  audit:   { n: '工商检查', cost: 1900, cd: 45, tgt: 'bld',  d: '目标建筑停工 60 天' },
  scandal: { n: '舆论危机', cost: 1300, cd: 40, tgt: 'co',   d: '目标股价 -20%，持续 40 天' },
  poach:   { n: '挖走库存', cost: 1500, cd: 35, tgt: 'co',   d: '偷走对方最值钱资源库存的 25%' },
  corner:  { n: '囤积居奇', cost: 1500, cd: 30, tgt: 'res',  d: '该资源价格立刻 +35%' },
  dump:    { n: '恶意倾销', cost: 1000, cd: 30, tgt: 'res',  d: '该资源价格立刻 -30%' },
  guard:   { n: '安保合同', cost: 800,  cd: 20, tgt: 'self', d: '挡下下一次针对你的手段' },
};

const EVENTS = [
  { k: 'blackout', n: '全市限电', d: '电力需求暴涨', eff: { power: 1.65 }, days: 40 },
  { k: 'harvest',  n: '粮食大丰收', d: '粮价承压', eff: { food: .6 }, days: 45 },
  { k: 'chipban',  n: '芯片出口管制', d: '国产芯片需求激增', eff: { chip: 1.55 }, days: 50 },
  { k: 'infra',    n: '基建刺激计划', d: '钢材需求大增', eff: { steel: 1.45, ore: 1.2 }, days: 45 },
  { k: 'festival', n: '消费节', d: '食品热卖', eff: { goods: 1.45, food: 1.15 }, days: 35 },
  { k: 'opec',     n: 'OPEC 减产', d: '油价大涨', eff: { oil: 1.6, power: 1.15 }, days: 40 },
  { k: 'glut',     n: '原油过剩', d: '油价下跌', eff: { oil: .62 }, days: 40 },
  { k: 'eco',      n: '环保督察', d: '采掘类产出 -35%', raw: .65, days: 35 },
  { k: 'typhoon',  n: '台风登陆', d: '码头停摆 15 天', port: true, days: 15 },
  { k: 'ratecut',  n: '央行降息', d: '负债利息减半、股价 +10%', rate: .5, share: 1.1, days: 60 },
];

const PERSONAS = {
  wang: { name: '王建国', co: '鼎盛实业', tag: '激进', sab: .55, take: .7, eco: .9, bid: 1.1, look: { skin: '#e8b996', hair: 'short', hc: '#1d1a19', suit: '#2b2f3a', tie: '#a3302b', glasses: false, age: 1 },
    lines: {
      start: ['小年轻也来做生意？行，让你见识见识。', '上海滩的规矩，我王建国说了算。'],
      claim: ['这块地我王建国要了。', '动作慢就别出来混。'],
      sab: ['听说你厂里工人闹罢工？真可惜啊。', '做生意嘛，总有意外。'],
      share: ['你的股票不错，我先收几股玩玩。', '你公司姓什么，很快就不好说了。'],
      takeover: ['从今天起，这家公司姓王了。'],
      outbid: ['行，算你狠，下次没这么便宜。'],
      win: ['早说了，上海滩我说了算。'],
      hurt: ['谁干的？给我查！'],
      lose: ['……我还会回来的。'],
    } },
  chen: { name: '陈琳达', co: '环球商贸', tag: '稳健', sab: .2, take: .35, eco: 1.15, bid: .9, look: { skin: '#f0cdb0', hair: 'bob', hc: '#2a1d17', suit: '#e9e4da', tie: null, glasses: true, age: 0 },
    lines: {
      start: ['祝各位合作愉快。账本不会说谎。'],
      claim: ['这块地的回报率，我算过了。'],
      sab: ['抱歉，商业竞争而已。'],
      share: ['你的公司估值偏低，我只是在做价值投资。'],
      takeover: ['整合完成。感谢你的资产。'],
      outbid: ['超出我的估值了，让给你。'],
      win: ['稳健，才是最快的路。'],
      hurt: ['小动作而已，影响不了基本面。'],
      lose: ['这次是我判断失误。'],
    } },
  zhao: { name: '赵海川', co: '海川资本', tag: '投机', sab: .45, take: .55, eco: .95, bid: 1, manip: .7, look: { skin: '#dcae8a', hair: 'slick', hc: '#3a2c22', suit: '#1f3550', tie: '#c9a24a', glasses: false, age: 0 },
    lines: {
      start: ['市场就是赌场，各位下注吧。'],
      claim: ['先占住，回头卖给你们。'],
      sab: ['价格嘛，我说它跌就得跌。'],
      share: ['抄底了，谢谢你的恐慌。'],
      takeover: ['杠杆的艺术，学着点。'],
      outbid: ['不跟了，接盘侠是你。'],
      win: ['高抛低吸，就这么简单。'],
      hurt: ['有意思，有人在针对我。'],
      lose: ['爆仓了……'],
    } },
  li: { name: '李北辰', co: '北辰地产', tag: '圈地', sab: .3, take: .45, eco: 1, bid: 1.25, land: 1.12, look: { skin: '#e2b48f', hair: 'bald', hc: '#6b6560', suit: '#3d2b24', tie: '#2f5b8a', glasses: true, age: 2 },
    lines: {
      start: ['土地，是唯一不会再生产的东西。'],
      claim: ['地，永远不嫌多。', '这片我也要了。'],
      sab: ['年轻人，别挡我的路。'],
      share: ['你那几块地，迟早是我的。'],
      takeover: ['连人带地，我都收了。'],
      outbid: ['好地段，可惜了。'],
      win: ['有地，才有底气。'],
      hurt: ['在我地头上动手？'],
      lose: ['地还在，人散了。'],
    } },
};
const PLAYER_COLORS = ['#e6b54a', '#d9584b', '#4c8fdc', '#4fb486'];
const PLAYER_COLOR_NAMES = ['金', '红', '蓝', '绿'];

const MATCH_LEN = { quick: 420, std: 720 };
