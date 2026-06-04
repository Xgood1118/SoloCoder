-- ============================================
-- CRM智能销售线索分配系统 - 数据库设计
-- ============================================

CREATE DATABASE IF NOT EXISTS crm_lead_system DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE crm_lead_system;

-- ============================================
-- 1. 销售区域表 - 省份和城市两级结构
-- ============================================
DROP TABLE IF EXISTS `sales_region`;
CREATE TABLE `sales_region` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `region_code` VARCHAR(32) NOT NULL COMMENT '区域编码',
  `region_name` VARCHAR(64) NOT NULL COMMENT '区域名称',
  `region_level` TINYINT NOT NULL COMMENT '区域级别：1-省份 2-城市',
  `parent_id` BIGINT DEFAULT 0 COMMENT '父级区域ID',
  `sort_order` INT DEFAULT 0 COMMENT '排序号',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_region_code` (`region_code`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_region_level` (`region_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售区域表';

-- ============================================
-- 2. 销售人员表
-- ============================================
DROP TABLE IF EXISTS `salesperson`;
CREATE TABLE `salesperson` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `sales_no` VARCHAR(32) NOT NULL COMMENT '销售工号',
  `name` VARCHAR(32) NOT NULL COMMENT '姓名',
  `phone` VARCHAR(20) NOT NULL COMMENT '手机号',
  `email` VARCHAR(64) COMMENT '邮箱',
  `department` VARCHAR(64) COMMENT '所属部门',
  `position` VARCHAR(32) COMMENT '职位',
  `max_load` INT DEFAULT 50 COMMENT '最大负载量（在跟线索数上限）',
  `recover_threshold` INT DEFAULT 40 COMMENT '恢复分配阈值',
  `current_lead_count` INT DEFAULT 0 COMMENT '当前在跟线索数',
  `is_active` TINYINT DEFAULT 1 COMMENT '是否在职：0-离职 1-在职',
  `is_eligible` TINYINT DEFAULT 1 COMMENT '是否参与分配：0-不参与 1-参与',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_no` (`sales_no`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_is_eligible` (`is_eligible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售人员表';

-- ============================================
-- 3. 销售区域行业关联表 - 销售负责的区域和行业
-- ============================================
DROP TABLE IF EXISTS `sales_region_industry`;
CREATE TABLE `sales_region_industry` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `salesperson_id` BIGINT NOT NULL COMMENT '销售人员ID',
  `region_id` BIGINT NOT NULL COMMENT '区域ID（城市级别）',
  `industry_code` VARCHAR(32) NOT NULL COMMENT '行业编码',
  `industry_name` VARCHAR(64) NOT NULL COMMENT '行业名称',
  `priority` INT DEFAULT 1 COMMENT '分配优先级（数值越大优先级越高）',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_region_industry` (`salesperson_id`, `region_id`, `industry_code`),
  KEY `idx_salesperson_id` (`salesperson_id`),
  KEY `idx_region_id` (`region_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售区域行业关联表';

-- ============================================
-- 4. 线索来源表
-- ============================================
DROP TABLE IF EXISTS `lead_source`;
CREATE TABLE `lead_source` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `source_code` VARCHAR(32) NOT NULL COMMENT '来源编码',
  `source_name` VARCHAR(64) NOT NULL COMMENT '来源名称',
  `source_type` VARCHAR(32) NOT NULL COMMENT '来源类型：OFFICIAL_WEBSITE-官网 EXHIBITION-展会 ACTIVITY-活动 REFERRAL-转介绍 OTHER-其他',
  `description` VARCHAR(255) COMMENT '来源描述',
  `default_importance` TINYINT DEFAULT 1 COMMENT '默认重要性等级：1-普通 2-重要 3-关键',
  `is_active` TINYINT DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_source_code` (`source_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='线索来源表';

-- ============================================
-- 5. 客户表
-- ============================================
DROP TABLE IF EXISTS `customer`;
CREATE TABLE `customer` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `customer_no` VARCHAR(32) COMMENT '客户档案编号（成交后生成）',
  `company_name` VARCHAR(128) NOT NULL COMMENT '公司名称',
  `customer_type` TINYINT NOT NULL COMMENT '客户类型：1-企业客户 2-个人客户',
  `industry_code` VARCHAR(32) COMMENT '所属行业编码',
  `industry_name` VARCHAR(64) COMMENT '所属行业名称',
  `province_id` BIGINT COMMENT '省份ID',
  `city_id` BIGINT COMMENT '城市ID',
  `address` VARCHAR(255) COMMENT '详细地址',
  `website` VARCHAR(128) COMMENT '公司官网',
  `employee_count` INT COMMENT '员工规模',
  `annual_revenue` DECIMAL(18,2) COMMENT '年营业额',
  `description` TEXT COMMENT '公司简介',
  `customer_status` TINYINT DEFAULT 1 COMMENT '客户状态：0-潜在 1-意向 2-成交 3-流失',
  `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_no` (`customer_no`),
  KEY `idx_company_name` (`company_name`),
  KEY `idx_customer_type` (`customer_type`),
  KEY `idx_city_id` (`city_id`),
  KEY `idx_customer_status` (`customer_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户表';

-- ============================================
-- 6. 客户联系人表 - 主联系人和备用联系人
-- ============================================
DROP TABLE IF EXISTS `customer_contact`;
CREATE TABLE `customer_contact` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `customer_id` BIGINT NOT NULL COMMENT '客户ID',
  `contact_name` VARCHAR(32) NOT NULL COMMENT '联系人姓名',
  `contact_role` TINYINT NOT NULL COMMENT '联系人角色：1-主联系人 2-备用联系人',
  `position` VARCHAR(32) COMMENT '职位',
  `phone` VARCHAR(20) NOT NULL COMMENT '联系电话',
  `email` VARCHAR(64) COMMENT '邮箱',
  `wechat` VARCHAR(32) COMMENT '微信号',
  `is_decision_maker` TINYINT DEFAULT 0 COMMENT '是否决策人：0-否 1-是',
  `remark` VARCHAR(255) COMMENT '备注',
  `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_contact_role` (`contact_role`),
  KEY `idx_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户联系人表';

-- ============================================
-- 7. 客户证照信息表 - 营业执照等
-- ============================================
DROP TABLE IF EXISTS `customer_license`;
CREATE TABLE `customer_license` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `customer_id` BIGINT NOT NULL COMMENT '客户ID',
  `license_type` VARCHAR(32) NOT NULL COMMENT '证照类型：BUSINESS_LICENSE-营业执照 TAX_CERTIFICATE-税务登记证 ORG_CODE_CERT-组织机构代码证 OTHER-其他',
  `license_no` VARCHAR(64) NOT NULL COMMENT '证照编号',
  `license_name` VARCHAR(128) COMMENT '证照名称',
  `issue_date` DATE COMMENT '签发日期',
  `expiry_date` DATE COMMENT '到期日期',
  `file_url` VARCHAR(255) COMMENT '证照文件URL',
  `remark` VARCHAR(255) COMMENT '备注',
  `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_license_type` (`license_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户证照信息表';

-- ============================================
-- 8. 客户决策链表 - 采购负责人、技术选型人、财务审批人等
-- ============================================
DROP TABLE IF EXISTS `customer_decision_chain`;
CREATE TABLE `customer_decision_chain` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `customer_id` BIGINT NOT NULL COMMENT '客户ID',
  `role_type` VARCHAR(32) NOT NULL COMMENT '决策角色：PURCHASE_MANAGER-采购负责人 TECH_SELECTOR-技术选型人 FINANCE_APPROVER-财务审批人 DECISION_MAKER-最终决策人 INFLUENCER-影响者 USER-使用者',
  `contact_name` VARCHAR(32) NOT NULL COMMENT '姓名',
  `position` VARCHAR(32) COMMENT '职位',
  `phone` VARCHAR(20) COMMENT '联系电话',
  `email` VARCHAR(64) COMMENT '邮箱',
  `influence_level` TINYINT DEFAULT 1 COMMENT '影响力等级：1-低 2-中 3-高',
  `support_attitude` TINYINT DEFAULT 2 COMMENT '支持态度：1-反对 2-中立 3-支持',
  `remark` TEXT COMMENT '角色描述和关注点',
  `sort_order` INT DEFAULT 0 COMMENT '排序号',
  `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_role_type` (`role_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户决策链表';

-- ============================================
-- 9. 销售线索表 - 核心业务表
-- ============================================
DROP TABLE IF EXISTS `sales_lead`;
CREATE TABLE `sales_lead` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `lead_no` VARCHAR(32) NOT NULL COMMENT '线索编号',
  `customer_id` BIGINT NOT NULL COMMENT '客户ID',
  `source_id` BIGINT NOT NULL COMMENT '线索来源ID',
  `importance_level` TINYINT DEFAULT 1 COMMENT '重要性等级：1-普通 2-重要 3-关键',
  `expected_amount` DECIMAL(18,2) COMMENT '预计成交金额',
  `expected_deal_date` DATE COMMENT '预计成交日期',
  `lead_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING_ASSIGN' COMMENT '线索状态：PENDING_ASSIGN-待分配 ASSIGNED-已分配 FOLLOWING-跟进中 PENDING_CONFIRM-待确认 DEALED-已成交 CLOSED-已关闭 IN_POOL-公海池中',
  `sub_status` VARCHAR(32) COMMENT '子状态：用于细化状态管理',
  `salesperson_id` BIGINT COMMENT '负责销售人员ID',
  `assign_time` DATETIME COMMENT '分配时间',
  `claim_time` DATETIME COMMENT '认领时间',
  `first_contact_time` DATETIME COMMENT '首次联系时间',
  `first_contact_deadline` DATETIME COMMENT '首次联系截止时间（认领后3天）',
  `is_first_contact_overdue` TINYINT DEFAULT 0 COMMENT '首次联系是否已超期：0-否 1-是',
  `last_communication_time` DATETIME COMMENT '最后一次沟通时间',
  `next_follow_time` DATETIME COMMENT '下次跟进时间',
  `pool_enter_time` DATETIME COMMENT '进入公海时间',
  `deal_time` DATETIME COMMENT '成交时间',
  `close_reason` VARCHAR(255) COMMENT '关闭原因',
  `close_time` DATETIME COMMENT '关闭时间',
  `is_merged` TINYINT DEFAULT 0 COMMENT '是否已合并：0-否 1-是',
  `main_lead_id` BIGINT COMMENT '合并后主线索ID',
  `merge_time` DATETIME COMMENT '合并时间',
  `province_id` BIGINT COMMENT '省份ID（冗余，便于分配计算）',
  `city_id` BIGINT COMMENT '城市ID（冗余，便于分配计算）',
  `industry_code` VARCHAR(32) COMMENT '行业编码（冗余，便于分配计算）',
  `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
  `created_by` BIGINT COMMENT '创建人ID',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_lead_no` (`lead_no`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_salesperson_id` (`salesperson_id`),
  KEY `idx_source_id` (`source_id`),
  KEY `idx_lead_status` (`lead_status`),
  KEY `idx_importance_level` (`importance_level`),
  KEY `idx_city_id` (`city_id`),
  KEY `idx_assign_time` (`assign_time`),
  KEY `idx_last_communication_time` (`last_communication_time`),
  KEY `idx_created_time` (`created_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售线索表';

-- ============================================
-- 10. 线索状态历史表 - 完整的状态变更轨迹
-- ============================================
DROP TABLE IF EXISTS `lead_status_history`;
CREATE TABLE `lead_status_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `lead_id` BIGINT NOT NULL COMMENT '线索ID',
  `old_status` VARCHAR(32) COMMENT '变更前状态',
  `new_status` VARCHAR(32) NOT NULL COMMENT '变更后状态',
  `old_salesperson_id` BIGINT COMMENT '变更前销售人员',
  `new_salesperson_id` BIGINT COMMENT '变更后销售人员',
  `change_reason` VARCHAR(255) COMMENT '变更原因',
  `remark` TEXT COMMENT '变更备注',
  `operator_id` BIGINT COMMENT '操作人ID',
  `operator_name` VARCHAR(32) COMMENT '操作人姓名',
  `operate_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_lead_id` (`lead_id`),
  KEY `idx_operate_time` (`operate_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='线索状态历史表';

-- ============================================
-- 11. 沟通记录表 - 支持文字、图片、语音
-- ============================================
DROP TABLE IF EXISTS `communication_record`;
CREATE TABLE `communication_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `lead_id` BIGINT NOT NULL COMMENT '线索ID',
  `customer_id` BIGINT NOT NULL COMMENT '客户ID',
  `salesperson_id` BIGINT NOT NULL COMMENT '销售人员ID',
  `comm_type` VARCHAR(32) NOT NULL COMMENT '沟通类型：TEXT-文字 IMAGE-图片 VOICE-语音 VIDEO-视频 MEETING-会面 PHONE-电话',
  `content` TEXT COMMENT '沟通内容（文字或语音转写内容）',
  `file_url` VARCHAR(255) COMMENT '文件URL（图片、语音、视频）',
  `voice_duration` INT COMMENT '语音时长（秒）',
  `transcript_status` TINYINT DEFAULT 0 COMMENT '语音转写状态：0-未转写 1-转写中 2-转写完成 3-转写失败',
  `transcript_content` TEXT COMMENT '语音转写内容',
  `contact_person` VARCHAR(32) COMMENT '沟通对象',
  `comm_result` VARCHAR(255) COMMENT '沟通结果',
  `next_action` VARCHAR(255) COMMENT '下一步行动',
  `next_action_time` DATETIME COMMENT '下一步行动时间',
  `is_deleted` TINYINT DEFAULT 0 COMMENT '是否删除：0-否 1-是',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_lead_id` (`lead_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_salesperson_id` (`salesperson_id`),
  KEY `idx_comm_type` (`comm_type`),
  KEY `idx_created_time` (`created_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='沟通记录表';

-- ============================================
-- 12. 线索合并记录表
-- ============================================
DROP TABLE IF EXISTS `lead_merge_record`;
CREATE TABLE `lead_merge_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `main_lead_id` BIGINT NOT NULL COMMENT '主线索ID',
  `merged_lead_id` BIGINT NOT NULL COMMENT '被合并线索ID',
  `customer_id` BIGINT NOT NULL COMMENT '客户ID',
  `merge_reason` VARCHAR(255) COMMENT '合并原因',
  `operator_id` BIGINT COMMENT '操作人ID',
  `operator_name` VARCHAR(32) COMMENT '操作人姓名',
  `merge_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '合并时间',
  PRIMARY KEY (`id`),
  KEY `idx_main_lead_id` (`main_lead_id`),
  KEY `idx_merged_lead_id` (`merged_lead_id`),
  KEY `idx_customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='线索合并记录表';

-- ============================================
-- 13. 退款记录表
-- ============================================
DROP TABLE IF EXISTS `refund_record`;
CREATE TABLE `refund_record` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `lead_id` BIGINT NOT NULL COMMENT '线索ID',
  `customer_id` BIGINT NOT NULL COMMENT '客户ID',
  `order_no` VARCHAR(32) COMMENT '关联订单号',
  `refund_amount` DECIMAL(18,2) NOT NULL COMMENT '退款金额',
  `refund_reason` VARCHAR(255) NOT NULL COMMENT '退款原因',
  `negotiation_process` TEXT COMMENT '协商过程记录',
  `refund_time` DATE COMMENT '退款时间',
  `operator_id` BIGINT COMMENT '操作人ID',
  `operator_name` VARCHAR(32) COMMENT '操作人姓名',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_lead_id` (`lead_id`),
  KEY `idx_customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='退款记录表';

-- ============================================
-- 14. 系统提醒消息表
-- ============================================
DROP TABLE IF EXISTS `reminder_message`;
CREATE TABLE `reminder_message` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `recipient_id` BIGINT NOT NULL COMMENT '接收人ID',
  `recipient_name` VARCHAR(32) NOT NULL COMMENT '接收人姓名',
  `reminder_type` VARCHAR(32) NOT NULL COMMENT '提醒类型：FIRST_CONTACT_OVERDUE-首次联系超期 NO_COMMUNICATION_OVERDUE-15天无沟通 LEAD_TO_POOL-线索即将入公海 LEAD_ASSIGNED-线索分配通知 HIGH_PRIORITY_LEAD-高优先级线索',
  `lead_id` BIGINT COMMENT '关联线索ID',
  `title` VARCHAR(128) NOT NULL COMMENT '提醒标题',
  `content` TEXT COMMENT '提醒内容',
  `is_read` TINYINT DEFAULT 0 COMMENT '是否已读：0-否 1-是',
  `read_time` DATETIME COMMENT '阅读时间',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_recipient_id` (`recipient_id`),
  KEY `idx_reminder_type` (`reminder_type`),
  KEY `idx_is_read` (`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统提醒消息表';

-- ============================================
-- 15. 销售周报表
-- ============================================
DROP TABLE IF EXISTS `sales_weekly_report`;
CREATE TABLE `sales_weekly_report` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `report_no` VARCHAR(32) NOT NULL COMMENT '报表编号',
  `salesperson_id` BIGINT NOT NULL COMMENT '销售人员ID',
  `salesperson_name` VARCHAR(32) NOT NULL COMMENT '销售人员姓名',
  `week_start_date` DATE NOT NULL COMMENT '周开始日期',
  `week_end_date` DATE NOT NULL COMMENT '周结束日期',
  `new_lead_count` INT DEFAULT 0 COMMENT '新增线索数',
  `followed_lead_count` INT DEFAULT 0 COMMENT '跟进线索数',
  `dealed_lead_count` INT DEFAULT 0 COMMENT '成交线索数',
  `closed_lead_count` INT DEFAULT 0 COMMENT '关闭线索数',
  `pool_lead_count` INT DEFAULT 0 COMMENT '流入公海数',
  `total_deal_amount` DECIMAL(18,2) DEFAULT 0 COMMENT '成交总金额',
  `unclosed_lead_count` INT DEFAULT 0 COMMENT '长期未成交线索数',
  `unclosed_reason_analysis` TEXT COMMENT '未成交原因分析',
  `improvement_measures` TEXT COMMENT '改进措施',
  `remark` TEXT COMMENT '备注',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sales_week` (`salesperson_id`, `week_start_date`, `week_end_date`),
  KEY `idx_week_start_date` (`week_start_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售周报表';

-- ============================================
-- 16. 系统配置表
-- ============================================
DROP TABLE IF EXISTS `system_config`;
CREATE TABLE `system_config` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `config_key` VARCHAR(64) NOT NULL COMMENT '配置键',
  `config_value` VARCHAR(255) NOT NULL COMMENT '配置值',
  `config_desc` VARCHAR(255) COMMENT '配置描述',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- ============================================
-- 17. 字典表 - 行业、状态等枚举值
-- ============================================
DROP TABLE IF EXISTS `sys_dict`;
CREATE TABLE `sys_dict` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `dict_type` VARCHAR(32) NOT NULL COMMENT '字典类型',
  `dict_code` VARCHAR(32) NOT NULL COMMENT '字典编码',
  `dict_name` VARCHAR(64) NOT NULL COMMENT '字典名称',
  `sort_order` INT DEFAULT 0 COMMENT '排序号',
  `is_active` TINYINT DEFAULT 1 COMMENT '是否启用',
  `remark` VARCHAR(255) COMMENT '备注',
  `created_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dict_type_code` (`dict_type`, `dict_code`),
  KEY `idx_dict_type` (`dict_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统字典表';
