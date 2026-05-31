import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "budget.db")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")

DEFAULT_CURRENCY = "CNY"
EXCHANGE_RATE_CACHE_HOURS = 24
BUDGET_WARNING_THRESHOLD = 0.8
BUDGET_EXCEED_THRESHOLD = 1.0
AUTO_BACKUP_INTERVAL_HOURS = 24

DEFAULT_EXPENSE_CATEGORIES = [
    "餐饮", "交通", "购物", "娱乐", "医疗", "教育",
    "住房", "通讯", "服饰", "日用品", "社交", "旅行",
]

DEFAULT_INCOME_CATEGORIES = [
    "工资", "奖金", "投资收益", "兼职", "礼金", "退款", "其他收入",
]

CATEGORY_KEYWORDS = {
    "餐饮": ["餐", "食", "饭", "外卖", "咖啡", "奶茶", "超市", "便利店", "美团", "饿了么", "肯德基", "麦当劳", "星巴克"],
    "交通": ["出行", "打车", "地铁", "公交", "出租", "滴滴", "加油", "停车", "高铁", "火车", "机票", "航空"],
    "购物": ["淘宝", "京东", "拼多多", "商城", "超市", "百货", "网购"],
    "娱乐": ["电影", "游戏", "KTV", "唱歌", "演出", "旅游", "门票"],
    "医疗": ["医院", "药", "诊所", "体检", "医保", "健康"],
    "教育": ["学", "课", "培训", "书", "考试", "学费"],
    "住房": ["房租", "物业", "水费", "电费", "燃气", "维修"],
    "通讯": ["话费", "流量", "宽带", "手机", "运营商"],
    "服饰": ["衣", "鞋", "包", "帽", "装"],
    "日用品": ["纸", "洗", "清洁", "日用"],
    "社交": ["红包", "礼", "请客", "聚餐"],
    "旅行": ["酒店", "民宿", "机票", "景点", "旅行"],
}

DEFAULT_ACCOUNTS = [
    {"name": "现金", "account_type": "cash", "currency": "CNY"},
    {"name": "银行卡", "account_type": "bank", "currency": "CNY"},
    {"name": "信用卡", "account_type": "credit_card", "currency": "CNY"},
    {"name": "支付宝", "account_type": "ewallet", "currency": "CNY"},
    {"name": "微信", "account_type": "ewallet", "currency": "CNY"},
]
