INSERT INTO system_config (config_key, config_value, config_desc) VALUES
('lead.no_communication_days', '15', '无沟通自动入公海天数（工作日）'),
('lead.first_contact_days', '3', '首次联系宽限期天数'),
('lead.max_load_default', '50', '销售最大负载默认值'),
('lead.recover_threshold_default', '40', '销售恢复分配阈值'),
('lead.auto_assign_enabled', 'true', '是否启用自动分配'),
('lead.workdays_per_week', '5', '每周工作日天数');

INSERT INTO sys_dict (dict_type, dict_code, dict_name, sort_order) VALUES
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

INSERT INTO sys_dict (dict_type, dict_code, dict_name, sort_order) VALUES
('LEAD_STATUS', 'PENDING_ASSIGN', '待分配', 1),
('LEAD_STATUS', 'ASSIGNED', '已分配', 2),
('LEAD_STATUS', 'PENDING_CONFIRM', '待确认', 3),
('LEAD_STATUS', 'FOLLOWING', '跟进中', 4),
('LEAD_STATUS', 'DEALED', '已成交', 5),
('LEAD_STATUS', 'CLOSED', '已关闭', 6),
('LEAD_STATUS', 'IN_POOL', '公海池中', 7);

INSERT INTO sales_region (region_code, region_name, region_level, parent_id, sort_order) VALUES
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

INSERT INTO sales_region (region_code, region_name, region_level, parent_id, sort_order) VALUES
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

INSERT INTO lead_source (source_code, source_name, source_type, description, default_importance) VALUES
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

INSERT INTO salesperson (sales_no, name, phone, email, department, position, max_load, recover_threshold) VALUES
('S001', '张明', '13800138001', 'zhangming@company.com', '销售一部', '高级销售经理', 50, 40),
('S002', '李娜', '13800138002', 'lina@company.com', '销售一部', '销售经理', 50, 40),
('S003', '王强', '13800138003', 'wangqiang@company.com', '销售一部', '销售代表', 50, 40),
('S004', '刘芳', '13800138004', 'liufang@company.com', '销售二部', '销售经理', 50, 40),
('S005', '陈伟', '13800138005', 'chenwei@company.com', '销售二部', '销售代表', 50, 40),
('S006', '杨丽', '13800138006', 'yangli@company.com', '销售三部', '高级销售经理', 60, 48),
('S007', '黄磊', '13800138007', 'huanglei@company.com', '销售三部', '销售代表', 50, 40),
('S008', '周婷', '13800138008', 'zhouting@company.com', '销售四部', '销售经理', 50, 40);

INSERT INTO sales_region_industry (salesperson_id, region_id, industry_code, industry_name, priority) VALUES
(1, 11, 'IT', '互联网/信息技术', 3),
(1, 11, 'FINANCE', '金融/银行/保险', 2),
(1, 12, 'IT', '互联网/信息技术', 2),
(2, 12, 'FINANCE', '金融/银行/保险', 3),
(2, 11, 'EDUCATION', '教育/培训', 2),
(3, 11, 'MANUFACTURING', '制造业', 1),
(3, 12, 'MEDICAL', '医疗/健康', 1),
(4, 13, 'IT', '互联网/信息技术', 3),
(4, 14, 'IT', '互联网/信息技术', 3),
(4, 13, 'FINANCE', '金融/银行/保险', 2),
(5, 14, 'FINANCE', '金融/银行/保险', 2),
(5, 13, 'MANUFACTURING', '制造业', 2),
(5, 15, 'RETAIL', '零售/电商', 1),
(5, 16, 'RETAIL', '零售/电商', 1),
(6, 17, 'IT', '互联网/信息技术', 3),
(6, 20, 'IT', '互联网/信息技术', 3),
(6, 18, 'MANUFACTURING', '制造业', 2),
(7, 17, 'FINANCE', '金融/银行/保险', 2),
(7, 21, 'MANUFACTURING', '制造业', 2),
(7, 19, 'RETAIL', '零售/电商', 1),
(7, 22, 'MEDICAL', '医疗/健康', 1),
(8, 23, 'IT', '互联网/信息技术', 2),
(8, 24, 'IT', '互联网/信息技术', 2),
(8, 25, 'EDUCATION', '教育/培训', 2),
(8, 26, 'MANUFACTURING', '制造业', 2),
(8, 28, 'FINANCE', '金融/银行/保险', 2),
(8, 27, 'MEDICAL', '医疗/健康', 1),
(8, 29, 'RETAIL', '零售/电商', 1);

INSERT INTO customer (company_name, customer_type, industry_code, industry_name, province_id, city_id, address, website, employee_count, annual_revenue, description, customer_status) VALUES
('北京科技创新有限公司', 1, 'IT', '互联网/信息技术', 1, 11, '北京市海淀区中关村大街1号', 'www.techbj.com', 500, 50000000.00, '专注于人工智能研发的高科技企业', 1),
('上海金融服务集团', 1, 'FINANCE', '金融/银行/保险', 2, 12, '上海市浦东新区陆家嘴金融中心', 'www.financesh.com', 1000, 200000000.00, '综合金融服务提供商', 1),
('广州智能制造股份有限公司', 1, 'MANUFACTURING', '制造业', 3, 13, '广州市黄埔区科学城', 'www.gzmfg.com', 2000, 80000000.00, '智能装备制造企业', 1),
('深圳互联网科技公司', 1, 'IT', '互联网/信息技术', 3, 14, '深圳市南山区科技园', 'www.sztech.com', 800, 120000000.00, '移动互联网应用开发', 1),
('杭州电商平台有限公司', 1, 'RETAIL', '零售/电商', 4, 17, '杭州市余杭区未来科技城', 'www.hzec.com', 300, 30000000.00, '综合性电商平台', 1),
('成都软件开发公司', 1, 'IT', '互联网/信息技术', 6, 23, '成都市高新区天府大道', 'www.cdsoft.com', 200, 15000000.00, '企业级软件解决方案', 1),
('武汉教育科技公司', 1, 'EDUCATION', '教育/培训', 7, 24, '武汉市洪山区光谷广场', 'www.wh-edu.com', 150, 8000000.00, '在线教育平台运营', 1),
('南京医疗设备公司', 1, 'MEDICAL', '医疗/健康', 5, 20, '南京市江宁区生物医药产业园', 'www.njmedical.com', 300, 25000000.00, '高端医疗设备研发生产', 1),
('青岛新能源公司', 1, 'ENERGY', '能源/化工', 9, 27, '青岛市黄岛区工业园区', 'www.qdenergy.com', 600, 60000000.00, '新能源技术研发', 1),
('厦门贸易公司', 1, 'LOGISTICS', '物流/运输', 10, 29, '厦门市湖里区保税区', 'www.xmtrade.com', 100, 10000000.00, '国际物流与贸易', 1);

INSERT INTO customer_contact (customer_id, contact_name, contact_role, position, phone, email, wechat, is_decision_maker) VALUES
(1, '张经理', 1, '采购经理', '13900000001', 'zhang@techbj.com', 'zhang_techbj', 1),
(1, '李工', 2, '技术主管', '13900000002', 'li@techbj.com', 'li_techbj', 0),
(2, '王总', 1, '副总经理', '13900000003', 'wang@financesh.com', 'wang_finance', 1),
(2, '陈经理', 2, 'IT部门经理', '13900000004', 'chen@financesh.com', 'chen_finance', 1),
(3, '刘厂长', 1, '生产厂长', '13900000005', 'liu@gzmfg.com', 'liu_mfg', 1),
(3, '赵工', 2, '设备科长', '13900000006', 'zhao@gzmfg.com', 'zhao_mfg', 0),
(4, '孙总监', 1, '技术总监', '13900000007', 'sun@sztech.com', 'sun_sztech', 1),
(4, '周经理', 2, '项目经理', '13900000008', 'zhou@sztech.com', 'zhou_sztech', 0),
(5, '吴总', 1, 'CEO', '13900000009', 'wu@hzec.com', 'wu_hzec', 1),
(5, '郑经理', 2, '运营总监', '13900000010', 'zheng@hzec.com', 'zheng_hzec', 1);

INSERT INTO customer_license (customer_id, license_type, license_no, license_name, issue_date, expiry_date, file_url) VALUES
(1, 'BUSINESS_LICENSE', '91110000MA001ABC12', '营业执照', '2020-01-15', '2040-01-14', '/license/1_1.jpg'),
(2, 'BUSINESS_LICENSE', '91310000MA002DEF34', '营业执照', '2018-06-20', '2038-06-19', '/license/2_1.jpg'),
(2, 'FINANCE_LICENSE', 'J12345678', '金融业务许可证', '2019-03-10', '2029-03-09', '/license/2_2.jpg'),
(3, 'BUSINESS_LICENSE', '91440000MA003GHI56', '营业执照', '2015-09-01', '2035-08-31', '/license/3_1.jpg');

INSERT INTO customer_decision_chain (customer_id, role_type, contact_name, position, phone, email, influence_level, support_attitude, remark, sort_order) VALUES
(1, 'PURCHASE_MANAGER', '张经理', '采购经理', '13900000001', 'zhang@techbj.com', 3, 3, '关键决策人，关注价格和售后', 1),
(1, 'TECH_SELECTOR', '李工', '技术主管', '13900000002', 'li@techbj.com', 2, 3, '技术选型负责人，关注产品性能', 2),
(1, 'FINANCE_APPROVER', '王会计', '财务主管', '13900000011', 'finance@techbj.com', 2, 2, '财务审批，关注预算控制', 3),
(1, 'DECISION_MAKER', '刘总', '总经理', '13900000012', 'ceo@techbj.com', 3, 3, '最终决策人', 4),
(2, 'PURCHASE_MANAGER', '陈经理', 'IT部门经理', '13900000004', 'chen@financesh.com', 2, 3, '负责IT采购评估', 1),
(2, 'FINANCE_APPROVER', '周总', '财务总监', '13900000013', 'finance@financesh.com', 3, 2, '审批预算', 2),
(2, 'DECISION_MAKER', '王总', '副总经理', '13900000003', 'wang@financesh.com', 3, 3, '分管科技的副总', 3);

INSERT INTO sales_lead (lead_no, customer_id, source_id, importance_level, expected_amount, expected_deal_date, lead_status, salesperson_id, assign_time, claim_time, first_contact_time, first_contact_deadline, last_communication_time, province_id, city_id, industry_code, created_by, created_time) VALUES
('L202606010001', 1, 1, 3, 500000.00, '2026-07-15', 'FOLLOWING', 1, '2026-06-01 10:00:00', '2026-06-01 10:30:00', '2026-06-02 09:00:00', '2026-06-04 10:30:00', '2026-05-28 14:00:00', 1, 11, 'IT', 1, '2026-06-01 10:00:00'),
('L202606010002', 2, 6, 3, 1200000.00, '2026-08-01', 'FOLLOWING', 2, '2026-06-01 11:00:00', '2026-06-01 11:20:00', '2026-06-02 14:00:00', '2026-06-04 11:20:00', '2026-05-29 10:00:00', 2, 12, 'FINANCE', 1, '2026-06-01 11:00:00'),
('L202606010003', 3, 3, 2, 300000.00, '2026-07-20', 'PENDING_ASSIGN', NULL, NULL, NULL, NULL, NULL, NULL, 3, 13, 'MANUFACTURING', 1, '2026-06-01 14:00:00'),
('L202606010004', 4, 2, 2, 800000.00, '2026-07-30', 'ASSIGNED', 4, '2026-06-01 15:00:00', NULL, NULL, '2026-06-04 15:00:00', NULL, 3, 14, 'IT', 1, '2026-06-01 15:00:00'),
('L202606010005', 5, 4, 1, 150000.00, '2026-08-15', 'PENDING_CONFIRM', 6, '2026-06-01 16:00:00', '2026-06-01 16:30:00', NULL, '2026-05-29 16:30:00', NULL, 4, 17, 'RETAIL', 1, '2026-06-01 16:00:00'),
('L202606010006', 6, 5, 1, 200000.00, '2026-08-20', 'PENDING_ASSIGN', NULL, NULL, NULL, NULL, NULL, NULL, 6, 23, 'IT', 1, '2026-06-01 17:00:00'),
('L202606010007', 7, 1, 2, 180000.00, '2026-07-10', 'FOLLOWING', 8, '2026-05-20 09:00:00', '2026-05-20 09:30:00', '2026-05-21 10:00:00', '2026-05-23 09:30:00', '2026-05-22 15:00:00', 7, 24, 'EDUCATION', 1, '2026-05-20 09:00:00'),
('L202606010008', 8, 8, 3, 600000.00, '2026-07-25', 'FOLLOWING', 7, '2026-05-25 10:00:00', '2026-05-25 10:30:00', '2026-05-26 11:00:00', '2026-05-28 10:30:00', '2026-05-27 14:00:00', 5, 20, 'MEDICAL', 1, '2026-05-25 10:00:00'),
('L202606010009', 9, 7, 1, 450000.00, '2026-09-01', 'PENDING_ASSIGN', NULL, NULL, NULL, NULL, NULL, NULL, 9, 27, 'ENERGY', 1, '2026-06-01 18:00:00'),
('L202606010010', 10, 9, 1, 120000.00, '2026-08-30', 'IN_POOL', NULL, NULL, NULL, NULL, NULL, NULL, 10, 29, 'LOGISTICS', 1, '2026-05-01 10:00:00');

INSERT INTO communication_record (lead_id, customer_id, salesperson_id, comm_type, content, contact_person, comm_result, next_action, next_action_time) VALUES
(1, 1, 1, 'PHONE', '电话沟通，客户对产品表示浓厚兴趣，约定下周进行产品演示', '张经理', '意向明确', '准备产品演示方案', '2026-06-03 14:00:00'),
(1, 1, 1, 'MEETING', '上门拜访，进行产品演示，客户技术团队对功能表示满意', '张经理、李工', '产品认可', '准备报价方案', '2026-06-05 10:00:00'),
(2, 2, 2, 'PHONE', '初次电话联系，介绍公司产品和服务', '陈经理', '初步接触', '发送公司资料', '2026-06-03 09:00:00'),
(2, 2, 2, 'TEXT', '通过微信发送产品资料和案例介绍', '陈经理', '资料已发', '等待客户反馈', '2026-06-04 09:00:00'),
(7, 7, 8, 'PHONE', '电话沟通，客户需要时间评估', '吴总', '需跟进', '下周再次联系', '2026-05-25 10:00:00'),
(8, 8, 7, 'MEETING', '会面沟通，了解客户需求', '孙总监', '需求明确', '准备定制方案', '2026-05-28 14:00:00');

INSERT INTO lead_status_history (lead_id, old_status, new_status, old_salesperson_id, new_salesperson_id, change_reason, operator_id, operator_name, operate_time) VALUES
(1, 'PENDING_ASSIGN', 'ASSIGNED', NULL, 1, '自动分配', 1, '系统管理员', '2026-06-01 10:00:00'),
(1, 'ASSIGNED', 'PENDING_CONFIRM', 1, 1, '销售认领', 1, '张明', '2026-06-01 10:30:00'),
(1, 'PENDING_CONFIRM', 'FOLLOWING', 1, 1, '首次联系确认', 1, '张明', '2026-06-02 09:00:00'),
(2, 'PENDING_ASSIGN', 'ASSIGNED', NULL, 2, '自动分配', 1, '系统管理员', '2026-06-01 11:00:00'),
(2, 'ASSIGNED', 'PENDING_CONFIRM', 2, 2, '销售认领', 2, '李娜', '2026-06-01 11:20:00'),
(2, 'PENDING_CONFIRM', 'FOLLOWING', 2, 2, '首次联系确认', 2, '李娜', '2026-06-02 14:00:00'),
(4, 'PENDING_ASSIGN', 'ASSIGNED', NULL, 4, '自动分配', 1, '系统管理员', '2026-06-01 15:00:00'),
(5, 'PENDING_ASSIGN', 'ASSIGNED', NULL, 6, '自动分配', 1, '系统管理员', '2026-06-01 16:00:00'),
(5, 'ASSIGNED', 'PENDING_CONFIRM', 6, 6, '销售认领', 6, '杨丽', '2026-06-01 16:30:00');

UPDATE salesperson SET current_lead_count = 1 WHERE id IN (1, 2, 4, 6, 7, 8);
