// ================= DATA =================
const GOODS=[
 {id:'rice',n:'大米',code:'RR',u:'吨',base:3800,vol:.012,depth:3000,sz:1,lv:1},
 {id:'soy',n:'大豆',code:'A',u:'吨',base:4500,vol:.015,depth:2500,sz:1,lv:1},
 {id:'steel',n:'螺纹钢',code:'RB',u:'吨',base:3700,vol:.015,depth:4000,sz:1,lv:1},
 {id:'cotton',n:'棉花',code:'CF',u:'吨',base:15500,vol:.015,depth:1200,sz:1,lv:1},
 {id:'oil',n:'原油',code:'SC',u:'吨',base:4300,vol:.022,depth:5000,sz:1,lv:3},
 {id:'copper',n:'电解铜',code:'CU',u:'吨',base:72000,vol:.017,depth:400,sz:1,lv:4},
 {id:'chip',n:'芯片',code:'IC',u:'箱',base:15000,vol:.02,depth:500,sz:.02,lv:5},
 {id:'coffee',n:'咖啡豆',code:'KC',u:'吨',base:32000,vol:.022,depth:300,sz:1,lv:7},
 {id:'gold',n:'黄金',code:'AU',u:'千克',base:760000,vol:.009,depth:60,sz:.001,lv:8},
];
const G=Object.fromEntries(GOODS.map(g=>[g.id,g]));
const CITIES=[
 {id:'sh',n:'上海',lv:1,depth:1.5,x:848,y:158,cf:{rice:1.02,soy:1.05,steel:.92,cotton:.97,oil:1.05,copper:1,chip:1,coffee:1.15,gold:1}},
 {id:'sz',n:'深圳',lv:1,depth:1.2,x:804,y:206,cf:{rice:1,soy:1.06,steel:.98,cotton:1.02,oil:1.06,copper:1.02,chip:.86,coffee:1.12,gold:1}},
 {id:'sg',n:'新加坡',lv:3,depth:1.2,x:789,y:250,cf:{rice:.94,soy:1,steel:1.05,cotton:1.03,oil:.97,copper:1,chip:1.05,coffee:1,gold:.995}},
 {id:'db',n:'迪拜',lv:5,depth:1.1,x:653,y:181,cf:{rice:1.18,soy:1.12,steel:1.1,cotton:1.08,oil:.82,copper:1.04,chip:1.1,coffee:1.08,gold:.985}},
 {id:'sp',n:'圣保罗',lv:7,depth:1,x:371,y:315,cf:{rice:1,soy:.82,steel:1.08,cotton:.94,oil:1,copper:.95,chip:1.22,coffee:.72,gold:1}},
 {id:'rt',n:'鹿特丹',lv:9,depth:1.3,x:512,y:106,cf:{rice:1.1,soy:1.08,steel:1,cotton:1.1,oil:1.02,copper:1.06,chip:1.12,coffee:1.25,gold:1.01}},
];
const C=Object.fromEntries(CITIES.map(c=>[c.id,c]));
const DIST={'sh-sz':3,'sh-sg':6,'sz-sg':5,'sh-db':14,'sz-db':13,'sg-db':9,'sh-sp':30,'sz-sp':29,'sg-sp':26,'db-sp':22,'sh-rt':28,'sz-rt':27,'sg-rt':22,'db-rt':16,'rt-sp':14};
const dist=(a,b)=>DIST[a+'-'+b]||DIST[b+'-'+a]||0;
const STOCKS=[
 {s:'600831',n:'华信科技',sec:'科技',p:48.2,beta:1.4,vol:.022},
 {s:'601872',n:'远洋航运',sec:'航运',p:12.5,beta:1.1,vol:.019},
 {s:'600028',n:'中石能源',sec:'能源',p:7.8,beta:.8,vol:.014,good:'oil'},
 {s:'000998',n:'金穗农业',sec:'农业',p:15.2,beta:.6,vol:.016,good:'soy'},
 {s:'600019',n:'宏钢集团',sec:'钢铁',p:5.6,beta:1,vol:.017,good:'steel'},
 {s:'300750',n:'云帆电商',sec:'科技',p:86.4,beta:1.5,vol:.028},
 {s:'600276',n:'瑞康医药',sec:'医药',p:33.1,beta:.7,vol:.018},
 {s:'601398',n:'万通银行',sec:'银行',p:6.2,beta:.9,vol:.01},
 {s:'601899',n:'赤金矿业',sec:'有色',p:17.4,beta:1.1,vol:.02,good:'gold'},
];
const RIVALS=[
 {id:'ds',co:'鼎盛贸易',boss:'王建国',style:'激进',nw:650000,mu:.0022,sig:.028,s:'603588'},
 {id:'hq',co:'环球商贸',boss:'陈琳达',style:'稳健',nw:900000,mu:.0016,sig:.012,s:'002345'},
 {id:'hc',co:'海川国际',boss:'赵海川',style:'投机',nw:420000,mu:.0024,sig:.04,s:'300456'},
 {id:'bc',co:'北辰实业',boss:'李北辰',style:'大宗',nw:1200000,mu:.0015,sig:.016,s:'600789'},
];
const TITLES=['','街头小贩','个体户','小老板','贸易新秀','进出口商','区域大亨','跨国贸易商','商界精英','财团董事','上市公司董事长','商业巨头','财阀','全球富豪','商业帝国','商界传奇'];
const UNLOCKS={2:'银行贷款',3:'新加坡港 · 原油',4:'电解铜',5:'迪拜港 · 芯片 · 澳门贵宾厅',6:'研究部内参',7:'圣保罗港 · 咖啡豆',8:'黄金',9:'鹿特丹港 · 澳门至尊厅',10:'公司上市 IPO'};
const LUX=[
 {id:'w1',cat:'watch',n:'天梭 力洛克',spec:'自动机械 · 39.3mm',p:4800,pr:2,ap:-.06,up:0},
 {id:'w2',cat:'watch',n:'欧米茄 海马300',spec:'同轴擒纵 · 42mm',p:52000,pr:12,ap:-.03,up:0},
 {id:'w3',cat:'watch',n:'劳力士 潜航者',spec:'蚝式钢 · 41mm',p:98000,pr:28,ap:.04,up:0},
 {id:'w4',cat:'watch',n:'百达翡丽 鹦鹉螺',spec:'5811/1G · 41mm',p:1650000,pr:160,ap:.07,up:0},
 {id:'w5',cat:'watch',n:'理查德米勒 RM 011',spec:'飞返计时 · 钛金属',p:6200000,pr:420,ap:.03,up:0},
 {id:'c1',cat:'car',n:'比亚迪 汉EV',spec:'纯电 · 610km',p:209800,pr:10,ap:-.15,up:30},
 {id:'c2',cat:'car',n:'宝马 5系',spec:'2.0T · 长轴距',p:439900,pr:30,ap:-.14,up:60},
 {id:'c3',cat:'car',n:'保时捷 911 Carrera',spec:'3.0T 水平对置六缸',p:1458000,pr:110,ap:-.08,up:180},
 {id:'c4',cat:'car',n:'劳斯莱斯 库里南',spec:'6.75L V12',p:7050000,pr:420,ap:-.07,up:900},
 {id:'c5',cat:'car',n:'布加迪 Chiron',spec:'8.0L W16 · 1500匹',p:32000000,pr:1500,ap:.02,up:3500},
 {id:'h1',cat:'house',n:'郊区两居室',spec:'89㎡ · 精装',p:2800000,pr:60,ap:.025,up:120},
 {id:'h2',cat:'house',n:'陆家嘴江景大平层',spec:'320㎡ · 一线江景',p:16800000,pr:380,ap:.035,up:600},
 {id:'h3',cat:'house',n:'佘山独栋别墅',spec:'占地 1.2 亩 · 私家园林',p:52000000,pr:1100,ap:.04,up:1800},
 {id:'h4',cat:'house',n:'太平山顶豪宅',spec:'维港全景 · 独立泳池',p:280000000,pr:4200,ap:.045,up:8000},
 {id:'a1',cat:'art',n:'当代油画 限量版',spec:'布面油画 · 120×90cm',p:850000,pr:70,ap:.05,up:20},
 {id:'a2',cat:'art',n:'清乾隆 粉彩瓷瓶',spec:'春拍成交 · 附证书',p:36000000,pr:1300,ap:.06,up:200},
 {id:'y1',cat:'yacht',n:'圣汐 42米游艇',spec:'5 间套房 · 12 名船员',p:88000000,pr:2200,ap:-.06,up:9000},
 {id:'j1',cat:'jet',n:'湾流 G700',spec:'航程 13,890km · 19 座',p:560000000,pr:9000,ap:-.05,up:40000},
];
const LUXBY=Object.fromEntries(LUX.map(l=>[l.id,l]));
const LUXCAT={watch:'腕表',car:'座驾',house:'物业',art:'艺术品',yacht:'游艇',jet:'公务机'};
const UPG=[
 {id:'wh',n:'仓储中心',d:l=>`每港仓容 ${fmtQ(whCap(l))} 吨`,cost:l=>20000*Math.pow(2.6,l),max:12,sal:60,ic:'crate'},
 {id:'fleet',n:'远洋船队',d:l=>`在途运力 ${fmtQ(fleetCap(l))} 吨`,cost:l=>30000*Math.pow(2.6,l),max:12,sal:80,ic:'ship'},
 {id:'speed',n:'新型主机',d:l=>`航程缩短 ${Math.round((1-1/(1+.15*l))*100)}%`,cost:l=>80000*Math.pow(3,l),max:5,sal:120,ic:'gear'},
 {id:'trader',n:'交易团队',d:l=>`价差 ${(spread(l)*100).toFixed(2)}% · 深度 +${l*25}%`,cost:l=>50000*Math.pow(2.8,l),max:6,sal:150,ic:'people'},
 {id:'analyst',n:'研究部',d:l=>['未设立','提前收到行业内参','内参更准 · 显示高估低估','内参几乎必中'][l]||'',cost:l=>120000*Math.pow(3,l),max:3,sal:300,lv:6,ic:'eye'},
 {id:'office',n:'总部大楼',d:l=>`声望 +${l*40} · 合同栏位 ${3+l}`,cost:l=>200000*Math.pow(3,l),max:5,sal:400,ic:'hq'},
];
const CLIENTS=['华润粮油','中远物流','金龙鱼食品','长江钢构','南方电网','海天集团','迪拜国家石油','淡马锡贸易','嘉吉亚洲','路易达孚','鹿特丹港务局','星巴克供应链','比亚迪采购部','台积电南京','万科建设','新加坡航空配餐'];
const ACH=[
 {id:'t1',n:'第一桶金',d:'完成第一笔盈利交易'},{id:'p100k',n:'十万元户',d:'单笔交易盈利超 ¥10万'},
 {id:'nw1m',n:'百万富翁',d:'净资产 ¥100万'},{id:'nw10m',n:'千万身家',d:'净资产 ¥1000万'},
 {id:'nw100m',n:'亿万富豪',d:'净资产 ¥1亿'},{id:'nw1b',n:'十亿俱乐部',d:'净资产 ¥10亿'},
 {id:'k1',n:'守信商人',d:'完成第一份合同'},{id:'k10',n:'金字招牌',d:'完成 10 份合同'},
 {id:'leg',n:'至尊订单',d:'完成一份至尊级合同'},{id:'s1',n:'股民',d:'第一次买入股票'},
 {id:'s50',n:'股神',d:'股票累计盈利 ¥50万'},{id:'lw',n:'腕上乾坤',d:'购入第一枚腕表'},
 {id:'lc',n:'有车一族',d:'购入第一辆座驾'},{id:'lh',n:'置业安家',d:'购入第一处物业'},
 {id:'ly',n:'海天之间',d:'拥有游艇或公务机'},{id:'cAll',n:'环球航线',d:'解锁全部六座港口'},
 {id:'tr100',n:'贸易老手',d:'累计 100 笔商品交易'},{id:'beat',n:'力压群雄',d:'净资产超过全部 AI 对手'},
 {id:'mac',n:'濠江初访',d:'第一次在澳门下注'},{id:'god',n:'一掷千金',d:'在澳门单局赢下 ¥100万'},
 {id:'jp',n:'累积大奖',d:'老虎机击中累积奖池'},{id:'ipo',n:'敲钟',d:'公司成功上市'},
 {id:'ai',n:'军师入幕',d:'首次咨询 AI 智囊'},{id:'intel1',n:'信息差',d:'首次使用情报'},{id:'ins1',n:'有惊无险',d:'投保的货船遭遇变故并获赔'},
 {id:'nego',n:'谈判桌上',d:'成功议下一份合同'},{id:'blk',n:'黑天鹅',d:'经历一次黑天鹅事件'},
];

// 宏观周期：影响商品趋势中枢、波动率、股市漂移。每 40–80 天切换一次。
const MACRO=[
 {id:'recover',n:'复苏',en:'Recovery',bias:.02,vol:.95,mu:.0009,seed:'good',d:'需求回暖，订单与信贷都在放宽'},
 {id:'boom',n:'繁荣',en:'Boom',bias:.05,vol:1.05,mu:.0016,seed:'good',d:'景气度高企，风险偏好上升'},
 {id:'overheat',n:'过热',en:'Overheat',bias:.03,vol:1.35,mu:.0004,seed:'',d:'通胀抬头，波动加大，央行随时出手'},
 {id:'slump',n:'衰退',en:'Contraction',bias:-.05,vol:1.2,mu:-.0012,seed:'bad',d:'需求萎缩，现金为王'},
];
const MACROBY=Object.fromEntries(MACRO.map(m=>[m.id,m]));

// 情报点数：由「研究部」每日产出，可换取确定性信息
const INTEL_COST={event:20,forecast:35,rival:50};
const INTEL_MAX=400;

const ROOMS=[
 {id:'main',n:'中场',en:'MAIN FLOOR',lv:1,min:100,max:100000,chips:[100,500,1000,5000,10000,50000],blinds:[100,200],buy:[10000,60000],slot:[10,50,100,500,1000],seed:300000},
 {id:'vip',n:'贵宾厅',en:'VIP SALON',lv:5,min:5000,max:3000000,chips:[5000,10000,50000,100000,500000,1000000],blinds:[2500,5000],buy:[250000,1500000],slot:[1000,5000,10000,50000],seed:8000000},
 {id:'pr',n:'至尊厅',en:'PRIVÉ',lv:9,min:100000,max:50000000,chips:[100000,500000,1000000,5000000,10000000],blinds:[50000,100000],buy:[5000000,30000000],slot:[50000,100000,500000,1000000],seed:120000000},
];
const CHIPCOL=['#2f5fa8','#a8262a','#2f7a55','#2a2a2a','#7a3fa0','#b8892b','#c46a2c'];
