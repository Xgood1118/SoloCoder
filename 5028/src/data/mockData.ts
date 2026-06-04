import type { Attraction, Review } from "@/types";

export const mockAttractions: Attraction[] = [
  {
    id: "a1",
    name: "故宫博物院",
    city: "北京",
    category: "culture",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Forbidden City Beijing golden rooftop blue sky majestic architecture&image_size=landscape_16_9",
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Forbidden City inner courtyard red walls traditional Chinese architecture&image_size=landscape_16_9"
    ],
    description: "故宫博物院是中国最大的古代文化艺术博物馆，位于北京紫禁城内。紫禁城建于明永乐年间，是世界上现存规模最大、保存最为完整的木质结构古建筑群之一，被列为世界文化遗产。",
    rating: 4.9,
    reviewCount: 28634,
    ticketPrice: 60,
    openHours: "08:30-17:00（周一闭馆）",
    suggestedDuration: 240,
    bestSeason: ["spring", "autumn"],
    latitude: 39.9163,
    longitude: 116.3972,
    address: "北京市东城区景山前街4号"
  },
  {
    id: "a2",
    name: "八达岭长城",
    city: "北京",
    category: "culture",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Great Wall of China Badaling section winding through mountains&image_size=landscape_16_9"
    ],
    description: "八达岭长城是万里长城的重要组成部分，是明长城中保存最好、最具代表性的段落。以其恢弘的气势和完善的设施成为长城游览的首选之地。",
    rating: 4.7,
    reviewCount: 18920,
    ticketPrice: 40,
    openHours: "06:30-19:00（夏季）/ 07:30-18:00（冬季）",
    suggestedDuration: 180,
    bestSeason: ["spring", "autumn"],
    latitude: 40.3588,
    longitude: 116.0204,
    address: "北京市延庆区八达岭镇"
  },
  {
    id: "a3",
    name: "西湖",
    city: "杭州",
    category: "nature",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=West Lake Hangzhou serene water reflection willow trees pagoda&image_size=landscape_16_9"
    ],
    description: "西湖位于杭州市区西面，是中国大陆首批国家重点风景名胜区之一，也是世界文化遗产。西湖三面环山，景色宜人，自古便是文人墨客吟咏的对象。",
    rating: 4.8,
    reviewCount: 32156,
    ticketPrice: 0,
    openHours: "全天开放",
    suggestedDuration: 300,
    bestSeason: ["spring", "autumn"],
    latitude: 30.2421,
    longitude: 120.1484,
    address: "杭州市西湖区龙井路1号"
  },
  {
    id: "a4",
    name: "外滩",
    city: "上海",
    category: "culture",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Shanghai Bund night skyline Huangpu River modern skyline&image_size=landscape_16_9"
    ],
    description: "外滩位于上海市黄浦区的黄浦江畔，是上海最具标志性的景观之一。沿江排列着52幢风格各异的古典复兴大楼，被誉为'万国建筑博览群'，夜景尤为壮观。",
    rating: 4.7,
    reviewCount: 24530,
    ticketPrice: 0,
    openHours: "全天开放",
    suggestedDuration: 120,
    bestSeason: ["spring", "autumn", "summer"],
    latitude: 31.2400,
    longitude: 121.4900,
    address: "上海市黄浦区中山东一路"
  },
  {
    id: "a5",
    name: "兵马俑博物馆",
    city: "西安",
    category: "culture",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Terracotta Warriors XiAn ancient clay soldiers museum&image_size=landscape_16_9"
    ],
    description: "秦始皇帝陵博物院是以秦始皇兵马俑为基础，在兵马俑坑原址上建立的遗址类博物馆。被誉为'世界第八大奇迹'，是世界上最大的古代军事博物馆。",
    rating: 4.8,
    reviewCount: 15890,
    ticketPrice: 120,
    openHours: "08:30-18:00",
    suggestedDuration: 180,
    bestSeason: ["spring", "autumn"],
    latitude: 34.3842,
    longitude: 109.2785,
    address: "西安市临潼区秦陵北路"
  },
  {
    id: "a6",
    name: "宽窄巷子",
    city: "成都",
    category: "food",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Chengdu Kuanzhai Alley traditional street food stalls lanterns&image_size=landscape_16_9"
    ],
    description: "宽窄巷子是成都遗留下来的较成规模的清朝古街道，由宽巷子、窄巷子和井巷子三条平行排列的城市老式街道及其之间的四合院群落组成。是体验成都慢生活的绝佳去处。",
    rating: 4.5,
    reviewCount: 21340,
    ticketPrice: 0,
    openHours: "全天开放",
    suggestedDuration: 150,
    bestSeason: ["spring", "summer", "autumn"],
    latitude: 30.6697,
    longitude: 104.0555,
    address: "成都市青羊区宽窄巷子"
  },
  {
    id: "a7",
    name: "张家界国家森林公园",
    city: "张家界",
    category: "nature",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Zhangjiajie national forest park towering sandstone pillars mist&image_size=landscape_16_9"
    ],
    description: "张家界国家森林公园以独特的石英砂岩峰林地貌闻名于世，被联合国教科文组织列入世界自然遗产。电影《阿凡达》中悬浮山的灵感便来源于此。",
    rating: 4.8,
    reviewCount: 12450,
    ticketPrice: 225,
    openHours: "07:00-18:00",
    suggestedDuration: 480,
    bestSeason: ["spring", "autumn"],
    latitude: 29.3249,
    longitude: 110.4343,
    address: "张家界市武陵源区"
  },
  {
    id: "a8",
    name: "鼓浪屿",
    city: "厦门",
    category: "culture",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Gulangyu Island Xiamen colonial architecture ocean view tropical&image_size=landscape_16_9"
    ],
    description: "鼓浪屿是厦门市思明区的一个小岛，因海西南有海蚀洞受浪潮冲击，声如擂鼓而得名。岛上完好地保留着许多具有中外建筑风格的建筑物，有'万国建筑博览'之称。",
    rating: 4.6,
    reviewCount: 19780,
    ticketPrice: 35,
    openHours: "全天开放（需乘轮渡）",
    suggestedDuration: 300,
    bestSeason: ["spring", "autumn"],
    latitude: 24.4483,
    longitude: 118.0690,
    address: "厦门市思明区鼓浪屿"
  },
  {
    id: "a9",
    name: "丽江古城",
    city: "丽江",
    category: "culture",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Lijiang Old Town cobblestone streets traditional Naxi architecture mountains&image_size=landscape_16_9"
    ],
    description: "丽江古城始建于宋末元初，地处云贵高原。古城内小桥流水，纳西族风格的建筑鳞次栉比，是中国保存最为完好的四大古城之一，也是世界文化遗产。",
    rating: 4.5,
    reviewCount: 23670,
    ticketPrice: 50,
    openHours: "全天开放",
    suggestedDuration: 360,
    bestSeason: ["spring", "summer", "autumn"],
    latitude: 26.8721,
    longitude: 100.2259,
    address: "丽江市古城区"
  },
  {
    id: "a10",
    name: "黄鹤楼",
    city: "武汉",
    category: "culture",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Yellow Crane Tower Wuhan ancient pagoda Yangtze River view&image_size=landscape_16_9"
    ],
    description: "黄鹤楼位于武汉市蛇山之巅，濒临万里长江，是武汉市标志性建筑。与晴川阁、古琴台并称'武汉三大名胜'，更因唐代诗人崔颢的《黄鹤楼》诗而名扬天下。",
    rating: 4.4,
    reviewCount: 16540,
    ticketPrice: 70,
    openHours: "08:00-18:00",
    suggestedDuration: 120,
    bestSeason: ["spring", "autumn"],
    latitude: 30.5441,
    longitude: 114.3025,
    address: "武汉市武昌区蛇山西坡特1号"
  },
  {
    id: "a11",
    name: "南锣鼓巷",
    city: "北京",
    category: "shopping",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Nanluoguxiang Beijing hutong alley shops cafes traditional&image_size=landscape_16_9"
    ],
    description: "南锣鼓巷是北京最古老的街区之一，也是最具老北京风情的街巷。这里汇集了各种创意小店、特色餐饮和胡同文化体验，是感受北京胡同生活的绝佳去处。",
    rating: 4.3,
    reviewCount: 18900,
    ticketPrice: 0,
    openHours: "全天开放",
    suggestedDuration: 120,
    bestSeason: ["spring", "summer", "autumn"],
    latitude: 39.9377,
    longitude: 116.4030,
    address: "北京市东城区南锣鼓巷"
  },
  {
    id: "a12",
    name: "九寨沟",
    city: "阿坝",
    category: "nature",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Jiuzhaigou Valley turquoise lakes waterfalls colorful forest&image_size=landscape_16_9"
    ],
    description: "九寨沟位于四川省阿坝藏族羌族自治州九寨沟县境内，以翠海、叠瀑、彩林、雪峰、藏情为特色，被誉为'人间仙境'。其水景规模之大、形态之美、色彩之丰富，堪称中国水景之王。",
    rating: 4.9,
    reviewCount: 14320,
    ticketPrice: 169,
    openHours: "08:30-17:00",
    suggestedDuration: 480,
    bestSeason: ["autumn"],
    latitude: 33.2600,
    longitude: 103.9200,
    address: "阿坝藏族羌族自治州九寨沟县"
  },
  {
    id: "a13",
    name: "田子坊",
    city: "上海",
    category: "shopping",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Tianzifang Shanghai art district narrow alleys galleries cafes&image_size=landscape_16_9"
    ],
    description: "田子坊是上海最具特色的文化创意街区之一，由上海特有的石库门建筑群改造而成。在这里可以找到各种艺术工作室、创意小店和特色咖啡馆，感受上海的文艺气息。",
    rating: 4.4,
    reviewCount: 12670,
    ticketPrice: 0,
    openHours: "10:00-22:00",
    suggestedDuration: 120,
    bestSeason: ["spring", "autumn"],
    latitude: 31.2105,
    longitude: 121.4689,
    address: "上海市黄浦区泰康路210弄"
  },
  {
    id: "a14",
    name: "锦里古街",
    city: "成都",
    category: "food",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Jinli Ancient Street Chengdu red lanterns Sichuan food stalls traditional&image_size=landscape_16_9"
    ],
    description: "锦里古街是成都知名的商业步行街，全长550米，以明末清初川西民居作外衣，汇聚三国文化和成都民俗于一体。各种成都名小吃在此云集，是吃货的天堂。",
    rating: 4.5,
    reviewCount: 20130,
    ticketPrice: 0,
    openHours: "全天开放",
    suggestedDuration: 120,
    bestSeason: ["spring", "summer", "autumn", "winter"],
    latitude: 30.6459,
    longitude: 104.0480,
    address: "成都市武侯区武侯祠大街231号"
  },
  {
    id: "a15",
    name: "回民街",
    city: "西安",
    category: "food",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Muslim Quarter Xian street food market lamb skewers bustling&image_size=landscape_16_9"
    ],
    description: "回民街是西安著名的美食文化街区，是西安特色小吃最集中的街区。街道两旁有大量的美食店铺，各种回民风味小吃琳琅满目，是体验西安美食文化的最佳去处。",
    rating: 4.3,
    reviewCount: 22450,
    ticketPrice: 0,
    openHours: "全天开放",
    suggestedDuration: 90,
    bestSeason: ["spring", "summer", "autumn", "winter"],
    latitude: 34.2643,
    longitude: 108.9445,
    address: "西安市莲湖区西大街"
  },
  {
    id: "a16",
    name: "洱海",
    city: "大理",
    category: "nature",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Erhai Lake Dali blue water mountains reflection Cangshan&image_size=landscape_16_9"
    ],
    description: "洱海位于大理白族自治州大理市，是云南省第二大淡水湖。因其状似人耳而得名。洱海风光秀美，苍山洱海相映成趣，是大理风花雪月四景之一。",
    rating: 4.7,
    reviewCount: 16780,
    ticketPrice: 0,
    openHours: "全天开放",
    suggestedDuration: 300,
    bestSeason: ["spring", "summer", "autumn"],
    latitude: 25.8172,
    longitude: 100.1885,
    address: "大理白族自治州大理市"
  },
  {
    id: "a17",
    name: "拙政园",
    city: "苏州",
    category: "culture",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Humble Administrators Garden Suzhou classical Chinese garden pavilion pond&image_size=landscape_16_9"
    ],
    description: "拙政园是苏州最大的古典园林，也是中国四大名园之一。全园以水为中心，山水萦绕，厅榭精美，花木繁茂，具有浓郁的江南水乡特色，是江南园林的典范。",
    rating: 4.7,
    reviewCount: 13450,
    ticketPrice: 70,
    openHours: "07:30-17:30",
    suggestedDuration: 150,
    bestSeason: ["spring", "summer"],
    latitude: 31.3249,
    longitude: 120.6287,
    address: "苏州市姑苏区东北街178号"
  },
  {
    id: "a18",
    name: "太平山顶",
    city: "香港",
    category: "nature",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Victoria Peak Hong Kong panoramic city skyline night view&image_size=landscape_16_9"
    ],
    description: "太平山顶是香港的最高点，海拔552米。站在山顶可以俯瞰维多利亚港和香港岛的壮丽景色，是观赏香港夜景的最佳地点，也是游客来港必到的景点。",
    rating: 4.6,
    reviewCount: 18990,
    ticketPrice: 0,
    openHours: "全天开放（缆车07:00-24:00）",
    suggestedDuration: 120,
    bestSeason: ["autumn", "winter"],
    latitude: 22.2555,
    longitude: 114.1422,
    address: "香港岛太平山顶"
  },
  {
    id: "a19",
    name: "南京路步行街",
    city: "上海",
    category: "shopping",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Nanjing Road Shanghai pedestrian shopping street neon lights crowd&image_size=landscape_16_9"
    ],
    description: "南京路步行街是上海最知名的商业街区，东起外滩，西至人民广场。汇集了众多百年老店和时尚品牌，日均客流量超过百万人次，是购物爱好者的天堂。",
    rating: 4.3,
    reviewCount: 15870,
    ticketPrice: 0,
    openHours: "全天开放",
    suggestedDuration: 180,
    bestSeason: ["spring", "autumn", "winter"],
    latitude: 31.2352,
    longitude: 121.4724,
    address: "上海市黄浦区南京东路"
  },
  {
    id: "a20",
    name: "漓江",
    city: "桂林",
    category: "nature",
    images: [
      "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Li River Guilin karst mountains bamboo raft misty scenery&image_size=landscape_16_9"
    ],
    description: "漓江是桂林山水的精华所在，全长160公里。两岸奇峰林立，翠竹丛丛，山水相映，如诗如画。乘竹筏游览漓江，是体验桂林山水的最佳方式。",
    rating: 4.8,
    reviewCount: 11230,
    ticketPrice: 210,
    openHours: "08:00-17:00（竹筏游览）",
    suggestedDuration: 240,
    bestSeason: ["spring", "summer", "autumn"],
    latitude: 24.9765,
    longitude: 110.2982,
    address: "桂林市灵川县漓江景区"
  }
];

export const mockReviews: Review[] = [
  { id: "r1", attractionId: "a1", userId: "u1", userName: "旅行小达人", userAvatar: "🧑‍✈️", rating: 5, content: "故宫真的太震撼了！建议租个讲解器，不然走马观花会很可惜。早上一开门就去，人少拍照好看。", createdAt: "2025-10-15" },
  { id: "r2", attractionId: "a1", userId: "u2", userName: "摄影师老王", userAvatar: "📷", rating: 5, content: "红墙黄瓦配上蓝天白云，怎么拍都好看！午门和角楼是最佳拍摄点。", createdAt: "2025-09-22" },
  { id: "r3", attractionId: "a1", userId: "u3", userName: "带着孩子旅行", userAvatar: "👨‍👧", rating: 4, content: "带孩子了解历史的好地方，但面积太大走起来累，建议穿舒适的鞋。", createdAt: "2025-08-10" },
  { id: "r4", attractionId: "a3", userId: "u1", userName: "旅行小达人", userAvatar: "🧑‍✈️", rating: 5, content: "西湖十景名不虚传！租辆自行车环湖骑行是最舒服的方式，断桥残雪和三潭印月是必打卡点。", createdAt: "2025-11-01" },
  { id: "r5", attractionId: "a3", userId: "u4", userName: "吃货阿花", userAvatar: "🍜", rating: 5, content: "春天去西湖最美，桃红柳绿。旁边还有很多好吃的杭帮菜馆，西湖醋鱼必尝！", createdAt: "2025-04-18" },
  { id: "r6", attractionId: "a4", userId: "u2", userName: "摄影师老王", userAvatar: "📷", rating: 5, content: "外滩夜景绝对是上海最值得去的地方！晚上7点以后亮灯最漂亮，建议提前占位。", createdAt: "2025-12-05" },
  { id: "r7", attractionId: "a6", userId: "u4", userName: "吃货阿花", userAvatar: "🍜", rating: 4, content: "宽窄巷子的小吃种类很多，三大炮、钵钵鸡、龙抄手都不错。不过商业化有点重，价格偏贵。", createdAt: "2025-07-20" },
  { id: "r8", attractionId: "a7", userId: "u1", userName: "旅行小达人", userAvatar: "🧑‍✈️", rating: 5, content: "张家界真的太壮观了！玻璃栈道和百龙天梯都不容错过。建议至少安排两天，一天根本看不完。", createdAt: "2025-06-15" },
  { id: "r9", attractionId: "a12", userId: "u3", userName: "带着孩子旅行", userAvatar: "👨‍👧", rating: 5, content: "九寨沟的水美得不真实！五花海和珍珠滩瀑布是最震撼的。秋天去色彩最丰富。", createdAt: "2025-10-08" },
  { id: "r10", attractionId: "a20", userId: "u2", userName: "摄影师老王", userAvatar: "📷", rating: 5, content: "漓江山水甲天下不是吹的！竹筏漂流特别惬意，20元人民币背面的景色就在这里。", createdAt: "2025-05-12" },
  { id: "r11", attractionId: "a5", userId: "u5", userName: "历史迷小张", userAvatar: "📚", rating: 5, content: "兵马俑太震撼了！一号坑规模最大，二号坑精品多。一定要请讲解，不然看不懂。", createdAt: "2025-09-05" },
  { id: "r12", attractionId: "a2", userId: "u5", userName: "历史迷小张", userAvatar: "📚", rating: 4, content: "不到长城非好汉！但人真的很多，建议避开节假日。穿运动鞋，带够水。", createdAt: "2025-08-25" },
  { id: "r13", attractionId: "a16", userId: "u4", userName: "吃货阿花", userAvatar: "🍜", rating: 5, content: "洱海边骑行太美好了！沿途有很多拍照的绝佳机位，还有白族特色美食。", createdAt: "2025-03-20" },
  { id: "r14", attractionId: "a17", userId: "u1", userName: "旅行小达人", userAvatar: "🧑‍✈️", rating: 5, content: "江南园林的巅峰之作！每一步都是景，移步换景的精妙让人叹为观止。", createdAt: "2025-05-28" },
  { id: "r15", attractionId: "a9", userId: "u6", userName: "背包客小李", userAvatar: "🎒", rating: 4, content: "丽江的慢生活让人放松，但古城商业化太严重了。建议去束河古镇，更安静更原生态。", createdAt: "2025-07-10" }
];

export const mockCities = [
  { name: "北京", image: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Beijing skyline Forbidden City Tiananmen golden sunset&image_size=landscape_16_9", count: 3 },
  { name: "上海", image: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Shanghai skyline modern skyscrapers Huangpu River night&image_size=landscape_16_9", count: 3 },
  { name: "杭州", image: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Hangzhou West Lake pagoda lotus bridge scenic&image_size=landscape_16_9", count: 1 },
  { name: "成都", image: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Chengdu giant panda bamboo traditional teahouse&image_size=landscape_16_9", count: 2 },
  { name: "西安", image: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Xian ancient city wall Bell Tower traditional Chinese&image_size=landscape_16_9", count: 2 },
  { name: "桂林", image: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Guilin karst landscape Li River bamboo raft&image_size=landscape_16_9", count: 1 }
];

export const mockFeaturedTrips = [
  {
    id: "ft1",
    title: "北京三日深度游",
    cover: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Beijing travel itinerary collage Great Wall Forbidden City Temple of Heaven&image_size=landscape_16_9",
    days: 3,
    author: "旅行小达人",
    likes: 2345
  },
  {
    id: "ft2",
    title: "成都慢生活两日游",
    cover: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Chengdu travel food tour hotpot pandas teahouse&image_size=landscape_16_9",
    days: 2,
    author: "吃货阿花",
    likes: 1890
  },
  {
    id: "ft3",
    title: "江南水乡五日游",
    cover: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Jiangnan water town Suzhou garden Hangzhou West Lake boat&image_size=landscape_16_9",
    days: 5,
    author: "摄影师老王",
    likes: 3120
  }
];
