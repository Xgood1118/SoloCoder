-- ============================================
-- 初始化数据脚本
-- ============================================
USE crm_lead_system;

-- ============================================
-- 系统配置
-- ============================================
INSERT INTO `system_config` (`config_key`, `config_value`, `config_desc`) VALUES
('lead.no_communication_days', '15', '无沟通自动入公海天数（工作日）'),
('lead.first_contact_days', '3', '首次联系宽限期天数'),
('lead.max_load_default', '50', '销售最大负载默认值'),
('lead.recover_threshold_default', '40', '销售恢复分配阈值'),
('lead.auto_assign_enabled', 'true', '是否启用自动分配'),
('lead.workdays_per_week', '5', '每周工作日天数');

-- ============================================
-- 系统字典 - 行业
-- ============================================
INSERT INTO `sys_dict` (`dict_type`, `dict_code`, `dict_name`, `sort_order`) VALUES
('INDUSTRY', 'IT', '互联网/信息技术', 1),
('INDUSTRY', 'FINANCE', '金融/银行/保险', 2),
('INDUSTRY', 'MANUFACTURING', '制造业', 3),
('INDUSTRY', 'RETAIL', '零售/电商', 4),
('INDUSTRY', 'EDUCATION', '教育/培训', 5),
('INDUSTRY', 'MEDICAL', '医疗/健康', 6),
('INDUSTRY', 'REAL_ESTATE', '房地产/建筑', 7),
('INDUSTRY', 'ENERGY', '能源/化工', 8),
('INDUSTRY', 'LOGISTICS', '物流/运输', 9),
('INDUSTRY', 'OTHER', '其他', 99);

-- ============================================
-- 系统字典 - 线索状态
-- ============================================
INSERT INTO `sys_dict` (`dict_type`, `dict_code`, `dict_name`, `sort_order`) VALUES
('LEAD_STATUS', 'PENDING_ASSIGN', '待分配', 1),
('LEAD_STATUS', 'ASSIGNED', '已分配', 2),
('LEAD_STATUS', 'PENDING_CONFIRM', '待确认', 3),
('LEAD_STATUS', 'FOLLOWING', '跟进中', 4),
('LEAD_STATUS', 'DEALED', '已成交', 5),
('LEAD_STATUS', 'CLOSED', '已关闭', 6),
('LEAD_STATUS', 'IN_POOL', '公海池中', 7);

-- ============================================
-- 系统字典 - 重要性等级
-- ============================================
INSERT INTO `sys_dict` (`dict_type`, `dict_code`, `dict_name`, `sort_order`) VALUES
('IMPORTANCE', '1', '普通', 1),
('IMPORTANCE', '2', '重要', 2),
('IMPORTANCE', '3', '关键', 3);

-- ============================================
-- 系统字典 - 沟通类型
-- ============================================
INSERT INTO `sys_dict` (`dict_type`, `dict_code`, `dict_name`, `sort_order`) VALUES
('COMM_TYPE', 'TEXT', '文字沟通', 1),
('COMM_TYPE', 'PHONE', '电话沟通', 2),
('COMM_TYPE', 'MEETING', '会面拜访', 3),
('COMM_TYPE', 'VOICE', '语音消息', 4),
('COMM_TYPE', 'IMAGE', '图片资料', 5),
('COMM_TYPE', 'VIDEO', '视频会议', 6);

-- ============================================
-- 销售区域数据 - 省份
-- ============================================
INSERT INTO `sales_region` (`region_code`, `region_name`, `region_level`, `parent_id`, `sort_order`) VALUES
('BJ', '北京市', 1, 0, 1),
('SH', '上海市', 1, 0, 2),
('GD', '广东省', 1, 0, 3),
('ZJ', '浙江省', 1, 0, 4),
('JS', '江苏省', 1, 0, 5),
('SC', '四川省', 1, 0, 6),
('HB', '湖北省', 1, 0, 7),
('HN', '湖南省', 1, 0, 8),
('SD', '山东省', 1, 0, 9),
('FJ', '福建省', 1, 0, 10);

-- ============================================
-- 销售区域数据 - 城市
-- ============================================
INSERT INTO `sales_region` (`region_code`, `region_name`, `region_level`, `parent_id`, `sort_order`) VALUES
('BJ-SH', '北京市', 2, 1, 1),
('SH-SH', '上海市', 2, 2, 1),
('GD-GZ', '广州市', 2, 3, 1),
('GD-SZ', '深圳市', 2, 3, 2),
('GD-DG', '东莞市', 2, 3, 3),
('GD-FS', '佛山市', 2, 3, 4),
('ZJ-HZ', '杭州市', 2, 4, 1),
('ZJ-NB', '宁波市', 2, 4, 2),
('ZJ-WZ', '温州市', 2, 4, 3),
('JS-NJ', '南京市', 2, 5, 1),
('JS-SZ', '苏州市', 2, 5, 2),
('JS-WX', '无锡市', 2, 5, 3),
('SC-CD', '成都市', 2, 6, 1),
('HB-WH', '武汉市', 2, 7, 1),
('HN-CS', '长沙市', 2, 8, 1),
('SD-JN', '济南市', 2, 9, 1),
('SD-QD', '青岛市', 2, 9, 2),
('FJ-FZ', '福州市', 2, 10, 1),
('FJ-XM', '厦门市', 2, 10, 2);

-- ============================================
-- 线索来源数据
-- ============================================
INSERT INTO `lead_source` (`source_code`, `source_name`, `source_type`, `description`, `default_importance`) VALUES
('OFFICIAL_WEBSITE', '官网表单', 'OFFICIAL_WEBSITE', '公司官网客户留言/咨询表单', 2),
('EXHIBITION', '展会名片', 'EXHIBITION', '行业展会收集的名片', 1),
('EXHIBITION_SCAN', '展会扫码', 'EXHIBITION', '展会现场二维码扫码登记', 2),
('ACTIVITY', '活动登记', 'ACTIVITY', '市场活动现场登记', 1),
('ACTIVITY_ONLINE', '线上活动', 'ACTIVITY', '线上研讨会/直播活动报名', 2),
('REFERRAL', '客户转介绍', 'REFERRAL', '老客户推荐的新客户', 3),
('SEO', '搜索引擎', 'OFFICIAL_WEBSITE', '搜索引擎优化引流', 1),
('PAID_AD', '付费广告', 'OFFICIAL_WEBSITE', '百度/360付费推广', 2),
('SOCIAL_MEDIA', '社交媒体', 'OTHER', '微信/微博/抖音等社交媒体', 1),
('OTHER', '其他来源', 'OTHER', '其他渠道来源', 1);

-- ============================================
-- 销售人员数据
-- ============================================
INSERT INTO `salesperson` (`sales_no`, `name`, `phone`, `email`, `department`, `position`, `max_load`, `recover_threshold`) VALUES
('S001', '张明', '13800138001', 'zhangming@company.com', '销售一部', '高级销售经理', 50, 40),
('S002', '李娜', '13800138002', 'lina@company.com', '销售一部', '销售经理', 50, 40),
('S003', '王强', '13800138003', 'wangqiang@company.com', '销售一部', '销售代表', 50, 40),
('S004', '刘芳', '13800138004', 'liufang@company.com', '销售二部', '销售经理', 50, 40),
('S005', '陈伟', '13800138005', 'chenwei@company.com', '销售二部', '销售代表', 50, 40),
('S006', '杨丽', '13800138006', 'yangli@company.com', '销售三部', '高级销售经理', 60, 48),
('S007', '黄磊', '13800138007', 'huanglei@company.com', '销售三部', '销售代表', 50, 40),
('S008', '周婷', '13800138008', 'zhouting@company.com', '销售四部', '销售经理', 50, 40);

-- ============================================
-- 销售人员区域行业分配
-- ============================================
-- 销售一部：北京、上海，负责IT、金融行业
INSERT INTO `sales_region_industry` (`salesperson_id`, `region_id`, `industry_code`, `industry_name`, `priority`) VALUES
(1, 11, 'IT', '互联网/信息技术', 3),
(1, 11, 'FINANCE', '金融/银行/保险', 2),
(1, 12, 'IT', '互联网/信息技术', 2),
(2, 12, 'FINANCE', '金融/银行/保险', 3),
(2, 11, 'EDUCATION', '教育/培训', 2),
(3, 11, 'MANUFACTURING', '制造业', 1),
(3, 12, 'MEDICAL', '医疗/健康', 1);

-- 销售二部：广东，负责全行业
INSERT INTO `sales_region_industry` (`salesperson_id`, `region_id`, `industry_code`, `industry_name`, `priority`) VALUES
(4, 13, 'IT', '互联网/信息技术', 3),
(4, 14, 'IT', '互联网/信息技术', 3),
(4, 13, 'FINANCE', '金融/银行/保险', 2),
(5, 14, 'FINANCE', '金融/银行/保险', 2),
(5, 13, 'MANUFACTURING', '制造业', 2),
(5, 15, 'RETAIL', '零售/电商', 1),
(5, 16, 'RETAIL', '零售/电商', 1);

-- 销售三部：浙江、江苏
INSERT INTO `sales_region_industry` (`salesperson_id`, `region_id`, `industry_code`, `industry_name`, `priority`) VALUES
(6, 17, 'IT', '互联网/信息技术', 3),
(6, 20, 'IT', '互联网/信息技术', 3),
(6, 18, 'MANUFACTURING', '制造业', 2),
(7, 17, 'FINANCE', '金融/银行/保险', 2),
(7, 21, 'MANUFACTURING', '制造业', 2),
(7, 19, 'RETAIL', '零售/电商', 1),
(7, 22, 'MEDICAL', '医疗/健康', 1);

-- 销售四部：四川、湖北、湖南、山东、福建
INSERT INTO `sales_region_industry` (`salesperson_id`, `region_id`, `industry_code`, `industry_name`, `priority`) VALUES
(8, 23, 'IT', '互联网/信息技术', 2),
(8, 24, 'IT', '互联网/信息技术', 2),
(8, 25, 'EDUCATION', '教育/培训', 2),
(8, 26, 'MANUFACTURING', '制造业', 2),
(8, 28, 'FINANCE', '金融/银行/保险', 2),
(8, 27, 'MEDICAL', '医疗/健康', 1),
(8, 29, 'RETAIL', '零售/电商', 1);
