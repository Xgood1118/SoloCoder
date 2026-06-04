CREATE TABLE IF NOT EXISTS sales_region (
  id BIGINT NOT NULL AUTO_INCREMENT,
  region_code VARCHAR(32) NOT NULL,
  region_name VARCHAR(64) NOT NULL,
  region_level TINYINT NOT NULL,
  parent_id BIGINT DEFAULT 0,
  sort_order INT DEFAULT 0,
  status TINYINT DEFAULT 1,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_region_code UNIQUE (region_code)
);

CREATE TABLE IF NOT EXISTS salesperson (
  id BIGINT NOT NULL AUTO_INCREMENT,
  sales_no VARCHAR(32) NOT NULL,
  name VARCHAR(32) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(64),
  department VARCHAR(64),
  position VARCHAR(32),
  max_load INT DEFAULT 50,
  recover_threshold INT DEFAULT 40,
  current_lead_count INT DEFAULT 0,
  is_active TINYINT DEFAULT 1,
  is_eligible TINYINT DEFAULT 1,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_sales_no UNIQUE (sales_no),
  CONSTRAINT uk_phone UNIQUE (phone)
);

CREATE TABLE IF NOT EXISTS sales_region_industry (
  id BIGINT NOT NULL AUTO_INCREMENT,
  salesperson_id BIGINT NOT NULL,
  region_id BIGINT NOT NULL,
  industry_code VARCHAR(32) NOT NULL,
  industry_name VARCHAR(64) NOT NULL,
  priority INT DEFAULT 1,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_sales_region_industry UNIQUE (salesperson_id, region_id, industry_code)
);

CREATE TABLE IF NOT EXISTS lead_source (
  id BIGINT NOT NULL AUTO_INCREMENT,
  source_code VARCHAR(32) NOT NULL,
  source_name VARCHAR(64) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  description VARCHAR(255),
  default_importance TINYINT DEFAULT 1,
  is_active TINYINT DEFAULT 1,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_source_code UNIQUE (source_code)
);

CREATE TABLE IF NOT EXISTS customer (
  id BIGINT NOT NULL AUTO_INCREMENT,
  customer_no VARCHAR(32),
  company_name VARCHAR(128) NOT NULL,
  customer_type TINYINT NOT NULL,
  industry_code VARCHAR(32),
  industry_name VARCHAR(64),
  province_id BIGINT,
  city_id BIGINT,
  address VARCHAR(255),
  website VARCHAR(128),
  employee_count INT,
  annual_revenue DECIMAL(18,2),
  description CLOB,
  customer_status TINYINT DEFAULT 1,
  is_deleted TINYINT DEFAULT 0,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_customer_no UNIQUE (customer_no)
);

CREATE TABLE IF NOT EXISTS customer_contact (
  id BIGINT NOT NULL AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  contact_name VARCHAR(32) NOT NULL,
  contact_role TINYINT NOT NULL,
  position VARCHAR(32),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(64),
  wechat VARCHAR(32),
  is_decision_maker TINYINT DEFAULT 0,
  remark VARCHAR(255),
  is_deleted TINYINT DEFAULT 0,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS customer_license (
  id BIGINT NOT NULL AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  license_type VARCHAR(32) NOT NULL,
  license_no VARCHAR(64) NOT NULL,
  license_name VARCHAR(128),
  issue_date DATE,
  expiry_date DATE,
  file_url VARCHAR(255),
  remark VARCHAR(255),
  is_deleted TINYINT DEFAULT 0,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS customer_decision_chain (
  id BIGINT NOT NULL AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  role_type VARCHAR(32) NOT NULL,
  contact_name VARCHAR(32) NOT NULL,
  position VARCHAR(32),
  phone VARCHAR(20),
  email VARCHAR(64),
  influence_level TINYINT DEFAULT 1,
  support_attitude TINYINT DEFAULT 2,
  remark CLOB,
  sort_order INT DEFAULT 0,
  is_deleted TINYINT DEFAULT 0,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS sales_lead (
  id BIGINT NOT NULL AUTO_INCREMENT,
  lead_no VARCHAR(32) NOT NULL,
  customer_id BIGINT NOT NULL,
  source_id BIGINT NOT NULL,
  importance_level TINYINT DEFAULT 1,
  expected_amount DECIMAL(18,2),
  expected_deal_date DATE,
  lead_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_ASSIGN',
  sub_status VARCHAR(32),
  salesperson_id BIGINT,
  assign_time DATETIME,
  claim_time DATETIME,
  first_contact_time DATETIME,
  first_contact_deadline DATETIME,
  is_first_contact_overdue TINYINT DEFAULT 0,
  last_communication_time DATETIME,
  next_follow_time DATETIME,
  pool_enter_time DATETIME,
  deal_time DATETIME,
  close_reason VARCHAR(255),
  close_time DATETIME,
  is_merged TINYINT DEFAULT 0,
  main_lead_id BIGINT,
  merge_time DATETIME,
  province_id BIGINT,
  city_id BIGINT,
  industry_code VARCHAR(32),
  is_deleted TINYINT DEFAULT 0,
  created_by BIGINT,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_lead_no UNIQUE (lead_no)
);

CREATE TABLE IF NOT EXISTS lead_status_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  lead_id BIGINT NOT NULL,
  old_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL,
  old_salesperson_id BIGINT,
  new_salesperson_id BIGINT,
  change_reason VARCHAR(255),
  remark CLOB,
  operator_id BIGINT,
  operator_name VARCHAR(32),
  operate_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS communication_record (
  id BIGINT NOT NULL AUTO_INCREMENT,
  lead_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  salesperson_id BIGINT NOT NULL,
  comm_type VARCHAR(32) NOT NULL,
  content CLOB,
  file_url VARCHAR(255),
  voice_duration INT,
  transcript_status TINYINT DEFAULT 0,
  transcript_content CLOB,
  contact_person VARCHAR(32),
  comm_result VARCHAR(255),
  next_action VARCHAR(255),
  next_action_time DATETIME,
  is_deleted TINYINT DEFAULT 0,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS lead_merge_record (
  id BIGINT NOT NULL AUTO_INCREMENT,
  main_lead_id BIGINT NOT NULL,
  merged_lead_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  merge_reason VARCHAR(255),
  operator_id BIGINT,
  operator_name VARCHAR(32),
  merge_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS refund_record (
  id BIGINT NOT NULL AUTO_INCREMENT,
  lead_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  order_no VARCHAR(32),
  refund_amount DECIMAL(18,2) NOT NULL,
  refund_reason VARCHAR(255) NOT NULL,
  negotiation_process CLOB,
  refund_time DATE,
  operator_id BIGINT,
  operator_name VARCHAR(32),
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS reminder_message (
  id BIGINT NOT NULL AUTO_INCREMENT,
  recipient_id BIGINT NOT NULL,
  recipient_name VARCHAR(32) NOT NULL,
  reminder_type VARCHAR(32) NOT NULL,
  lead_id BIGINT,
  title VARCHAR(128) NOT NULL,
  content CLOB,
  is_read TINYINT DEFAULT 0,
  read_time DATETIME,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS sales_weekly_report (
  id BIGINT NOT NULL AUTO_INCREMENT,
  report_no VARCHAR(32) NOT NULL,
  salesperson_id BIGINT NOT NULL,
  salesperson_name VARCHAR(32) NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  new_lead_count INT DEFAULT 0,
  followed_lead_count INT DEFAULT 0,
  dealed_lead_count INT DEFAULT 0,
  closed_lead_count INT DEFAULT 0,
  pool_lead_count INT DEFAULT 0,
  total_deal_amount DECIMAL(18,2) DEFAULT 0,
  unclosed_lead_count INT DEFAULT 0,
  unclosed_reason_analysis CLOB,
  improvement_measures CLOB,
  remark CLOB,
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS system_config (
  id BIGINT NOT NULL AUTO_INCREMENT,
  config_key VARCHAR(64) NOT NULL,
  config_value VARCHAR(255) NOT NULL,
  config_desc VARCHAR(255),
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_config_key UNIQUE (config_key)
);

CREATE TABLE IF NOT EXISTS sys_dict (
  id BIGINT NOT NULL AUTO_INCREMENT,
  dict_type VARCHAR(32) NOT NULL,
  dict_code VARCHAR(32) NOT NULL,
  dict_name VARCHAR(64) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT DEFAULT 1,
  remark VARCHAR(255),
  created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uk_dict_type_code UNIQUE (dict_type, dict_code)
);
