-- 采购申请工作流引擎数据库设计

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    real_name VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    department_id BIGINT,
    role VARCHAR(20) NOT NULL DEFAULT 'employee',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 部门表
CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id BIGINT DEFAULT 0,
    manager_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 流程定义表
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 流程节点表
CREATE TABLE IF NOT EXISTS workflow_nodes (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL REFERENCES workflow_definitions(id),
    node_code VARCHAR(50) NOT NULL,
    node_name VARCHAR(100) NOT NULL,
    node_type VARCHAR(20) NOT NULL,
    approval_type VARCHAR(20) NOT NULL DEFAULT 'single',
    approval_roles TEXT[],
    approval_user_ids BIGINT[],
    timeout_hours INT DEFAULT 0,
    timeout_strategy VARCHAR(20) DEFAULT 'notify',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 条件分流规则表
CREATE TABLE IF NOT EXISTS workflow_conditions (
    id BIGSERIAL PRIMARY KEY,
    node_id BIGINT NOT NULL REFERENCES workflow_nodes(id),
    condition_type VARCHAR(30) NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    operator VARCHAR(20) NOT NULL,
    value VARCHAR(255) NOT NULL,
    target_node_code VARCHAR(50) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 节点连线/流转关系表
CREATE TABLE IF NOT EXISTS workflow_edges (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL REFERENCES workflow_definitions(id),
    from_node_code VARCHAR(50) NOT NULL,
    to_node_code VARCHAR(50) NOT NULL,
    edge_type VARCHAR(20) NOT NULL DEFAULT 'normal',
    condition_id BIGINT REFERENCES workflow_conditions(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 采购申请表
CREATE TABLE IF NOT EXISTS purchase_applications (
    id BIGSERIAL PRIMARY KEY,
    application_no VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    applicant_id BIGINT NOT NULL,
    department_id BIGINT,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    application_type VARCHAR(50),
    description TEXT,
    attachment_urls TEXT[],
    current_node_code VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    workflow_id BIGINT NOT NULL REFERENCES workflow_definitions(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- 采购申请明细表
CREATE TABLE IF NOT EXISTS purchase_items (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES purchase_applications(id),
    item_name VARCHAR(200) NOT NULL,
    specification VARCHAR(200),
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    remark TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 审批任务表
CREATE TABLE IF NOT EXISTS approval_tasks (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES purchase_applications(id),
    node_code VARCHAR(50) NOT NULL,
    node_name VARCHAR(100) NOT NULL,
    approver_id BIGINT NOT NULL,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    approval_opinion TEXT,
    approved_at TIMESTAMP,
    is_signatory BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 审批历史记录表
CREATE TABLE IF NOT EXISTS approval_histories (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES purchase_applications(id),
    node_code VARCHAR(50) NOT NULL,
    node_name VARCHAR(100) NOT NULL,
    approver_id BIGINT,
    approver_name VARCHAR(50),
    action VARCHAR(30) NOT NULL,
    opinion TEXT,
    from_node_code VARCHAR(50),
    to_node_code VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 超时任务监控表
CREATE TABLE IF NOT EXISTS timeout_monitors (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES purchase_applications(id),
    node_code VARCHAR(50) NOT NULL,
    timeout_at TIMESTAMP NOT NULL,
    is_handled BOOLEAN NOT NULL DEFAULT false,
    handled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON purchase_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON purchase_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_current_node ON purchase_applications(current_node_code);
CREATE INDEX IF NOT EXISTS idx_tasks_approver ON approval_tasks(approver_id);
CREATE INDEX IF NOT EXISTS idx_tasks_application ON approval_tasks(application_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON approval_tasks(approval_status);
CREATE INDEX IF NOT EXISTS idx_histories_application ON approval_histories(application_id);
CREATE INDEX IF NOT EXISTS idx_timeout_monitors ON timeout_monitors(timeout_at, is_handled);
