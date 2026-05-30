CREATE TABLE IF NOT EXISTS bpm_process_definition (
    id VARCHAR(64) NOT NULL,
    process_key VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    version INT NOT NULL,
    category VARCHAR(255),
    xml_content TEXT,
    is_executable TINYINT DEFAULT 0,
    is_suspended TINYINT DEFAULT 0,
    deployment_id VARCHAR(64),
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_pd_process_key ON bpm_process_definition (process_key);
CREATE INDEX idx_bpm_pd_tenant ON bpm_process_definition (tenant_id);
CREATE INDEX idx_bpm_pd_deployment ON bpm_process_definition (deployment_id);
CREATE INDEX idx_bpm_pd_key_version ON bpm_process_definition (process_key, version);

CREATE TABLE IF NOT EXISTS bpm_process_instance (
    id VARCHAR(64) NOT NULL,
    process_definition_id VARCHAR(64),
    process_key VARCHAR(255),
    process_name VARCHAR(255),
    version INT,
    status VARCHAR(32),
    business_key VARCHAR(255),
    start_user_id VARCHAR(64),
    start_time DATETIME,
    end_time DATETIME,
    start_activity_id VARCHAR(64),
    end_activity_id VARCHAR(64),
    duration_in_millis BIGINT,
    is_suspended TINYINT DEFAULT 0,
    delete_reason TEXT,
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_pi_definition ON bpm_process_instance (process_definition_id);
CREATE INDEX idx_bpm_pi_process_key ON bpm_process_instance (process_key);
CREATE INDEX idx_bpm_pi_status ON bpm_process_instance (status);
CREATE INDEX idx_bpm_pi_business_key ON bpm_process_instance (business_key);
CREATE INDEX idx_bpm_pi_start_user ON bpm_process_instance (start_user_id);
CREATE INDEX idx_bpm_pi_tenant ON bpm_process_instance (tenant_id);

CREATE TABLE IF NOT EXISTS bpm_execution (
    id VARCHAR(64) NOT NULL,
    process_instance_id VARCHAR(64) NOT NULL,
    process_definition_id VARCHAR(64),
    parent_id VARCHAR(64),
    activity_id VARCHAR(64),
    activity_name VARCHAR(255),
    activity_type VARCHAR(64),
    is_active TINYINT DEFAULT 1,
    is_concurrent TINYINT DEFAULT 0,
    is_scope TINYINT DEFAULT 0,
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_exec_instance ON bpm_execution (process_instance_id);
CREATE INDEX idx_bpm_exec_parent ON bpm_execution (parent_id);
CREATE INDEX idx_bpm_exec_activity ON bpm_execution (activity_id);
CREATE INDEX idx_bpm_exec_tenant ON bpm_execution (tenant_id);

CREATE TABLE IF NOT EXISTS bpm_variable (
    id VARCHAR(64) NOT NULL,
    process_instance_id VARCHAR(64),
    execution_id VARCHAR(64),
    task_id VARCHAR(64),
    variable_name VARCHAR(255) NOT NULL,
    variable_type VARCHAR(64),
    text_value TEXT,
    long_value BIGINT,
    double_value DOUBLE,
    json_value TEXT,
    date_value DATETIME,
    text_length INT,
    scope VARCHAR(32),
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_var_instance ON bpm_variable (process_instance_id);
CREATE INDEX idx_bpm_var_execution ON bpm_variable (execution_id);
CREATE INDEX idx_bpm_var_task ON bpm_variable (task_id);
CREATE INDEX idx_bpm_var_name ON bpm_variable (variable_name);
CREATE INDEX idx_bpm_var_tenant ON bpm_variable (tenant_id);

CREATE TABLE IF NOT EXISTS bpm_timer_job (
    id VARCHAR(64) NOT NULL,
    process_instance_id VARCHAR(64),
    execution_id VARCHAR(64),
    activity_id VARCHAR(64),
    job_type VARCHAR(32),
    job_handler_type VARCHAR(64),
    job_handler_configuration TEXT,
    duedate DATETIME,
    `repeat` VARCHAR(255),
    retries INT DEFAULT 3,
    exception_message TEXT,
    is_suspended TINYINT DEFAULT 0,
    tenant_id VARCHAR(64),
    lock_owner VARCHAR(64),
    lock_time DATETIME,
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_timer_instance ON bpm_timer_job (process_instance_id);
CREATE INDEX idx_bpm_timer_execution ON bpm_timer_job (execution_id);
CREATE INDEX idx_bpm_timer_duedate ON bpm_timer_job (duedate);
CREATE INDEX idx_bpm_timer_tenant ON bpm_timer_job (tenant_id);

CREATE TABLE IF NOT EXISTS bpm_task (
    id VARCHAR(64) NOT NULL,
    process_instance_id VARCHAR(64),
    process_definition_id VARCHAR(64),
    execution_id VARCHAR(64),
    task_definition_key VARCHAR(255),
    task_name VARCHAR(255),
    description TEXT,
    owner VARCHAR(64),
    assignee VARCHAR(64),
    delegate_user_id VARCHAR(64),
    status VARCHAR(32),
    form_key VARCHAR(255),
    business_key VARCHAR(255),
    due_date DATETIME,
    claim_time DATETIME,
    complete_time DATETIME,
    outcome VARCHAR(64),
    comment TEXT,
    priority INT DEFAULT 50,
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_task_instance ON bpm_task (process_instance_id);
CREATE INDEX idx_bpm_task_assignee ON bpm_task (assignee);
CREATE INDEX idx_bpm_task_status ON bpm_task (status);
CREATE INDEX idx_bpm_task_tenant ON bpm_task (tenant_id);
CREATE INDEX idx_bpm_task_due ON bpm_task (due_date);

CREATE TABLE IF NOT EXISTS bpm_task_sign_data (
    id VARCHAR(64) NOT NULL,
    task_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(255),
    sign_type VARCHAR(32),
    operation_user_id VARCHAR(64),
    operate_time DATETIME,
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_sign_task ON bpm_task_sign_data (task_id);
CREATE INDEX idx_bpm_sign_user ON bpm_task_sign_data (user_id);
CREATE INDEX idx_bpm_sign_tenant ON bpm_task_sign_data (tenant_id);

CREATE TABLE IF NOT EXISTS bpm_task_delegate (
    id VARCHAR(64) NOT NULL,
    task_id VARCHAR(64) NOT NULL,
    original_assignee VARCHAR(64),
    delegate_user_id VARCHAR(64),
    delegation_type VARCHAR(32),
    delegate_time DATETIME,
    resolve_time DATETIME,
    is_resolved TINYINT DEFAULT 0,
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_td_task ON bpm_task_delegate (task_id);
CREATE INDEX idx_bpm_td_delegate ON bpm_task_delegate (delegate_user_id);
CREATE INDEX idx_bpm_td_tenant ON bpm_task_delegate (tenant_id);

CREATE TABLE IF NOT EXISTS bpm_delegation (
    id VARCHAR(64) NOT NULL,
    delegator_id VARCHAR(64) NOT NULL,
    delegate_user_id VARCHAR(64) NOT NULL,
    delegation_type VARCHAR(32),
    process_definition_id VARCHAR(64),
    effective_time DATETIME,
    expiry_time DATETIME,
    is_enabled TINYINT DEFAULT 1,
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_deleg_delegator ON bpm_delegation (delegator_id);
CREATE INDEX idx_bpm_deleg_delegate ON bpm_delegation (delegate_user_id);
CREATE INDEX idx_bpm_deleg_tenant ON bpm_delegation (tenant_id);
CREATE INDEX idx_bpm_deleg_enabled ON bpm_delegation (is_enabled);

CREATE TABLE IF NOT EXISTS bpm_historic_process_instance (
    id VARCHAR(64) NOT NULL,
    process_instance_id VARCHAR(64),
    process_definition_id VARCHAR(64),
    process_key VARCHAR(255),
    process_name VARCHAR(255),
    version INT,
    status VARCHAR(32),
    start_user_id VARCHAR(64),
    start_time DATETIME,
    end_time DATETIME,
    start_activity_id VARCHAR(64),
    end_activity_id VARCHAR(64),
    duration_in_millis BIGINT,
    delete_reason TEXT,
    business_key VARCHAR(255),
    archive_status VARCHAR(32),
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_hpi_instance ON bpm_historic_process_instance (process_instance_id);
CREATE INDEX idx_bpm_hpi_process_key ON bpm_historic_process_instance (process_key);
CREATE INDEX idx_bpm_hpi_status ON bpm_historic_process_instance (status);
CREATE INDEX idx_bpm_hpi_start_user ON bpm_historic_process_instance (start_user_id);
CREATE INDEX idx_bpm_hpi_business_key ON bpm_historic_process_instance (business_key);
CREATE INDEX idx_bpm_hpi_archive ON bpm_historic_process_instance (archive_status);
CREATE INDEX idx_bpm_hpi_tenant ON bpm_historic_process_instance (tenant_id);

CREATE TABLE IF NOT EXISTS bpm_historic_activity_instance (
    id VARCHAR(64) NOT NULL,
    activity_instance_id VARCHAR(64),
    process_instance_id VARCHAR(64),
    process_definition_id VARCHAR(64),
    execution_id VARCHAR(64),
    activity_id VARCHAR(64),
    activity_name VARCHAR(255),
    activity_type VARCHAR(64),
    assignee VARCHAR(64),
    start_time DATETIME,
    end_time DATETIME,
    duration_in_millis BIGINT,
    task_instance_id VARCHAR(64),
    is_canceled TINYINT DEFAULT 0,
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_hai_instance ON bpm_historic_activity_instance (process_instance_id);
CREATE INDEX idx_bpm_hai_activity ON bpm_historic_activity_instance (activity_id);
CREATE INDEX idx_bpm_hai_assignee ON bpm_historic_activity_instance (assignee);
CREATE INDEX idx_bpm_hai_tenant ON bpm_historic_activity_instance (tenant_id);

CREATE TABLE IF NOT EXISTS bpm_historic_task_instance (
    id VARCHAR(64) NOT NULL,
    task_instance_id VARCHAR(64),
    process_instance_id VARCHAR(64),
    process_definition_id VARCHAR(64),
    execution_id VARCHAR(64),
    task_definition_key VARCHAR(255),
    task_name VARCHAR(255),
    description TEXT,
    owner VARCHAR(64),
    assignee VARCHAR(64),
    delegate_user_id VARCHAR(64),
    status VARCHAR(32),
    task_create_time DATETIME,
    claim_time DATETIME,
    complete_time DATETIME,
    duration_in_millis BIGINT,
    outcome VARCHAR(64),
    delete_reason TEXT,
    form_key VARCHAR(255),
    business_key VARCHAR(255),
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_hti_instance ON bpm_historic_task_instance (process_instance_id);
CREATE INDEX idx_bpm_hti_assignee ON bpm_historic_task_instance (assignee);
CREATE INDEX idx_bpm_hti_status ON bpm_historic_task_instance (status);
CREATE INDEX idx_bpm_hti_tenant ON bpm_historic_task_instance (tenant_id);

CREATE TABLE IF NOT EXISTS bpm_historic_variable_instance (
    id VARCHAR(64) NOT NULL,
    variable_instance_id VARCHAR(64),
    process_instance_id VARCHAR(64),
    execution_id VARCHAR(64),
    task_id VARCHAR(64),
    variable_name VARCHAR(255) NOT NULL,
    variable_type VARCHAR(64),
    text_value TEXT,
    long_value BIGINT,
    double_value DOUBLE,
    json_value TEXT,
    date_value DATETIME,
    scope VARCHAR(32),
    tenant_id VARCHAR(64),
    create_time DATETIME,
    update_time DATETIME,
    deleted TINYINT DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX idx_bpm_hvi_instance ON bpm_historic_variable_instance (process_instance_id);
CREATE INDEX idx_bpm_hvi_name ON bpm_historic_variable_instance (variable_name);
CREATE INDEX idx_bpm_hvi_tenant ON bpm_historic_variable_instance (tenant_id);

CREATE TABLE IF NOT EXISTS shedlock (
    name VARCHAR(64) NOT NULL,
    lock_until TIMESTAMP,
    locked_at TIMESTAMP,
    locked_by VARCHAR(255),
    PRIMARY KEY (name)
);
