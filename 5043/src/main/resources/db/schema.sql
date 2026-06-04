CREATE DATABASE IF NOT EXISTS oauth2_auth DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE oauth2_auth;

DROP TABLE IF EXISTS sys_dept;
CREATE TABLE sys_dept (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    dept_code VARCHAR(64) NOT NULL COMMENT '部门编码',
    dept_name VARCHAR(128) NOT NULL COMMENT '部门名称',
    parent_id BIGINT DEFAULT 0 COMMENT '父部门ID',
    ancestors VARCHAR(512) DEFAULT '' COMMENT '祖级列表',
    dept_sort INT DEFAULT 0 COMMENT '显示顺序',
    leader VARCHAR(64) COMMENT '负责人',
    phone VARCHAR(11) COMMENT '联系电话',
    email VARCHAR(128) COMMENT '邮箱',
    status TINYINT DEFAULT 1 COMMENT '状态 0:停用 1:正常',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_dept_code (dept_code),
    INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表';

DROP TABLE IF EXISTS sys_user;
CREATE TABLE sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码',
    nickname VARCHAR(128) COMMENT '昵称',
    email VARCHAR(128) COMMENT '邮箱',
    phone VARCHAR(11) COMMENT '手机号',
    avatar VARCHAR(512) COMMENT '头像',
    dept_id BIGINT COMMENT '部门ID',
    status TINYINT DEFAULT 1 COMMENT '状态 0:停用 1:正常',
    remark VARCHAR(512) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_username (username),
    INDEX idx_dept_id (dept_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

DROP TABLE IF EXISTS sys_role;
CREATE TABLE sys_role (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_code VARCHAR(64) NOT NULL COMMENT '角色编码',
    role_name VARCHAR(128) NOT NULL COMMENT '角色名称',
    role_sort INT DEFAULT 0 COMMENT '显示顺序',
    data_scope CHAR(1) DEFAULT '1' COMMENT '数据范围 1:全部 2:自定义 3:本部门 4:本部门及以下 5:仅本人',
    status TINYINT DEFAULT 1 COMMENT '状态 0:停用 1:正常',
    remark VARCHAR(512) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_role_code (role_code),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

DROP TABLE IF EXISTS sys_permission;
CREATE TABLE sys_permission (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    permission_code VARCHAR(128) NOT NULL COMMENT '权限编码',
    permission_name VARCHAR(128) NOT NULL COMMENT '权限名称',
    resource_type VARCHAR(32) DEFAULT 'menu' COMMENT '资源类型 menu:菜单 button:按钮 api:接口',
    resource_url VARCHAR(256) COMMENT '资源URL',
    resource_method VARCHAR(16) COMMENT '请求方法 GET POST PUT DELETE',
    parent_id BIGINT DEFAULT 0 COMMENT '父权限ID',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    status TINYINT DEFAULT 1 COMMENT '状态 0:停用 1:正常',
    remark VARCHAR(512) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_permission_code (permission_code),
    INDEX idx_parent_id (parent_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限表';

DROP TABLE IF EXISTS sys_user_role;
CREATE TABLE sys_user_role (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    role_id BIGINT NOT NULL COMMENT '角色ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_user_role (user_id, role_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表';

DROP TABLE IF EXISTS sys_role_permission;
CREATE TABLE sys_role_permission (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_id BIGINT NOT NULL COMMENT '角色ID',
    permission_id BIGINT NOT NULL COMMENT '权限ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_role_permission (role_id, permission_id),
    INDEX idx_role_id (role_id),
    INDEX idx_permission_id (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色权限关联表';

DROP TABLE IF EXISTS sys_data_permission;
CREATE TABLE sys_data_permission (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_id BIGINT NOT NULL COMMENT '角色ID',
    data_type VARCHAR(32) DEFAULT 'row' COMMENT '数据类型 row:行级 column:列级',
    table_name VARCHAR(128) NOT NULL COMMENT '表名',
    column_name VARCHAR(128) COMMENT '列名(列级权限)',
    row_condition VARCHAR(1024) COMMENT '行权限条件',
    column_permission VARCHAR(1024) COMMENT '列权限JSON',
    status TINYINT DEFAULT 1 COMMENT '状态 0:停用 1:正常',
    remark VARCHAR(512) COMMENT '备注',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    INDEX idx_role_id (role_id),
    INDEX idx_table_name (table_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据权限表';

DROP TABLE IF EXISTS oauth_client;
CREATE TABLE oauth_client (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(128) NOT NULL COMMENT '客户端ID',
    client_secret VARCHAR(256) NOT NULL COMMENT '客户端密钥',
    client_name VARCHAR(128) COMMENT '客户端名称',
    client_type VARCHAR(32) DEFAULT 'web' COMMENT '客户端类型 web:网页 app:移动应用 server:服务端',
    authorized_grant_types VARCHAR(256) NOT NULL COMMENT '授权类型 authorization_code,password,client_credentials,refresh_token,implicit',
    web_server_redirect_uri VARCHAR(1024) COMMENT '重定向URI',
    scope VARCHAR(256) DEFAULT 'all' COMMENT '权限范围',
    access_token_validity INT DEFAULT 7200 COMMENT 'AccessToken有效期(秒)',
    refresh_token_validity INT DEFAULT 2592000 COMMENT 'RefreshToken有效期(秒)',
    additional_information VARCHAR(4096) COMMENT '附加信息',
    autoapprove VARCHAR(32) DEFAULT 'false' COMMENT '自动授权',
    status TINYINT DEFAULT 1 COMMENT '状态 0:停用 1:正常',
    daily_quota BIGINT DEFAULT 86400000 COMMENT '日调用配额',
    hourly_quota BIGINT DEFAULT 3600000 COMMENT '小时调用配额',
    minute_quota BIGINT DEFAULT 60000 COMMENT '分钟调用配额',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_client_id (client_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OAuth2客户端表';

DROP TABLE IF EXISTS oauth_access_token;
CREATE TABLE oauth_access_token (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    token_id VARCHAR(256) NOT NULL COMMENT 'Token ID',
    token BLOB COMMENT 'Token内容',
    authentication_id VARCHAR(128) COMMENT '认证ID',
    user_name VARCHAR(128) COMMENT '用户名',
    client_id VARCHAR(128) COMMENT '客户端ID',
    authentication BLOB COMMENT '认证信息',
    refresh_token VARCHAR(256) COMMENT '刷新Token',
    expires_at DATETIME COMMENT '过期时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_token_id (token_id),
    INDEX idx_authentication_id (authentication_id),
    INDEX idx_refresh_token (refresh_token),
    INDEX idx_user_name (user_name),
    INDEX idx_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OAuth2访问令牌表';

DROP TABLE IF EXISTS oauth_refresh_token;
CREATE TABLE oauth_refresh_token (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    token_id VARCHAR(256) NOT NULL COMMENT 'Token ID',
    token BLOB COMMENT 'Token内容',
    authentication BLOB COMMENT '认证信息',
    expires_at DATETIME COMMENT '过期时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_token_id (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OAuth2刷新令牌表';

DROP TABLE IF EXISTS oauth_authorization_code;
CREATE TABLE oauth_authorization_code (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(128) NOT NULL COMMENT '授权码',
    authentication BLOB COMMENT '认证信息',
    client_id VARCHAR(128) COMMENT '客户端ID',
    user_name VARCHAR(128) COMMENT '用户名',
    expires_at DATETIME COMMENT '过期时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OAuth2授权码表';

DROP TABLE IF EXISTS third_party_user;
CREATE TABLE third_party_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT '系统用户ID',
    provider VARCHAR(32) NOT NULL COMMENT '第三方平台 wechat:微信 dingtalk:钉钉 wework:企业微信',
    open_id VARCHAR(128) NOT NULL COMMENT '第三方OpenID',
    union_id VARCHAR(128) COMMENT '第三方UnionID',
    access_token VARCHAR(512) COMMENT '访问令牌',
    refresh_token VARCHAR(512) COMMENT '刷新令牌',
    expires_in BIGINT COMMENT '过期时间(秒)',
    nick_name VARCHAR(128) COMMENT '昵称',
    avatar_url VARCHAR(512) COMMENT '头像URL',
    status TINYINT DEFAULT 1 COMMENT '状态 0:解绑 1:绑定',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_provider_openid (provider, open_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='第三方用户关联表';

DROP TABLE IF EXISTS api_call_log;
CREATE TABLE api_call_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(128) COMMENT '客户端ID',
    user_id VARCHAR(64) COMMENT '用户ID',
    api_path VARCHAR(256) NOT NULL COMMENT 'API路径',
    http_method VARCHAR(16) COMMENT 'HTTP方法',
    request_ip VARCHAR(64) COMMENT '请求IP',
    user_agent VARCHAR(1024) COMMENT 'User Agent',
    response_time BIGINT COMMENT '响应时间(毫秒)',
    response_code INT COMMENT '响应码',
    error_message VARCHAR(1024) COMMENT '错误信息',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    INDEX idx_client_id (client_id),
    INDEX idx_user_id (user_id),
    INDEX idx_api_path (api_path),
    INDEX idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='API调用日志表';

DROP TABLE IF EXISTS api_quota;
CREATE TABLE api_quota (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(128) NOT NULL COMMENT '客户端ID',
    daily_limit BIGINT DEFAULT 86400000 COMMENT '日限额',
    hourly_limit BIGINT DEFAULT 3600000 COMMENT '小时限额',
    minute_limit BIGINT DEFAULT 60000 COMMENT '分钟限额',
    daily_used BIGINT DEFAULT 0 COMMENT '今日已用',
    hourly_used BIGINT DEFAULT 0 COMMENT '当前小时已用',
    minute_used BIGINT DEFAULT 0 COMMENT '当前分钟已用',
    quota_date VARCHAR(16) NOT NULL COMMENT '配额日期 yyyy-MM-dd',
    status TINYINT DEFAULT 1 COMMENT '状态 0:禁用 1:启用',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted TINYINT DEFAULT 0 COMMENT '删除标志 0:未删除 1:已删除',
    UNIQUE KEY uk_client_date (client_id, quota_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='API配额表';
