USE oauth2_auth;

INSERT INTO sys_dept (dept_code, dept_name, parent_id, ancestors, dept_sort, leader, phone, email, status) VALUES
('ROOT', '总公司', 0, '0', 1, '张总', '13800138000', 'root@company.com', 1),
('TECH', '技术部', 1, '0,1', 1, '李技术', '13800138001', 'tech@company.com', 1),
('HR', '人力资源部', 1, '0,1', 2, '王人事', '13800138002', 'hr@company.com', 1),
('FIN', '财务部', 1, '0,1', 3, '赵财务', '13800138003', 'fin@company.com', 1),
('DEV', '研发部', 2, '0,1,2', 1, '钱开发', '13800138004', 'dev@company.com', 1),
('OPS', '运维部', 2, '0,1,2', 2, '孙运维', '13800138005', 'ops@company.com', 1);

INSERT INTO sys_user (username, password, nickname, email, phone, avatar, dept_id, status) VALUES
('admin', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '超级管理员', 'admin@company.com', '13800138000', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', 1, 1),
('zhangsan', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '张三', 'zhangsan@company.com', '13800138006', 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhangsan', 5, 1),
('lisi', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '李四', 'lisi@company.com', '13800138007', 'https://api.dicebear.com/7.x/avataaars/svg?seed=lisi', 5, 1),
('wangwu', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '王五', 'wangwu@company.com', '13800138008', 'https://api.dicebear.com/7.x/avataaars/svg?seed=wangwu', 2, 1),
('zhaoliu', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '赵六', 'zhaoliu@company.com', '13800138009', 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhaoliu', 3, 1),
('sunqi', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '孙七', 'sunqi@company.com', '13800138010', 'https://api.dicebear.com/7.x/avataaars/svg?seed=sunqi', 6, 1);

INSERT INTO sys_role (role_code, role_name, role_sort, data_scope, status, remark) VALUES
('SUPER_ADMIN', '超级管理员', 1, '1', 1, '拥有全部权限'),
('DEPT_MANAGER', '部门经理', 2, '3', 1, '只能查看本部门数据'),
('DEPT_MANAGER_WITH_CHILD', '部门经理(含下级)', 3, '4', 1, '可查看本部门及下级部门数据'),
('USER', '普通用户', 4, '5', 1, '只能查看本人数据'),
('GUEST', '访客', 5, '2', 1, '自定义数据权限');

INSERT INTO sys_permission (permission_code, permission_name, resource_type, resource_url, resource_method, parent_id, sort, status) VALUES
('system', '系统管理', 'menu', '', NULL, 0, 1, 1),
('system:user', '用户管理', 'menu', '/api/users', 'GET', 1, 1, 1),
('system:user:list', '用户列表', 'api', '/api/users', 'GET', 2, 1, 1),
('system:user:add', '新增用户', 'api', '/api/users', 'POST', 2, 2, 1),
('system:user:edit', '编辑用户', 'api', '/api/users', 'PUT', 2, 3, 1),
('system:user:delete', '删除用户', 'api', '/api/users', 'DELETE', 2, 4, 1),
('system:user:view', '查看用户', 'api', '/api/users/{id}', 'GET', 2, 5, 1),
('system:role', '角色管理', 'menu', '/api/roles', 'GET', 1, 2, 1),
('system:role:list', '角色列表', 'api', '/api/roles', 'GET', 8, 1, 1),
('system:role:add', '新增角色', 'api', '/api/roles', 'POST', 8, 2, 1),
('system:role:edit', '编辑角色', 'api', '/api/roles', 'PUT', 8, 3, 1),
('system:role:delete', '删除角色', 'api', '/api/roles', 'DELETE', 8, 4, 1),
('system:role:view', '查看角色', 'api', '/api/roles/{id}', 'GET', 8, 5, 1),
('system:permission', '权限管理', 'menu', '/api/permissions', 'GET', 1, 3, 1),
('system:permission:list', '权限列表', 'api', '/api/permissions', 'GET', 14, 1, 1),
('system:permission:add', '新增权限', 'api', '/api/permissions', 'POST', 14, 2, 1),
('system:permission:edit', '编辑权限', 'api', '/api/permissions', 'PUT', 14, 3, 1),
('system:permission:delete', '删除权限', 'api', '/api/permissions', 'DELETE', 14, 4, 1),
('system:permission:view', '查看权限', 'api', '/api/permissions/{id}', 'GET', 14, 5, 1),
('auth', '认证管理', 'menu', '', NULL, 0, 2, 1),
('auth:login', '登录', 'api', '/auth/login', 'POST', 20, 1, 1),
('auth:logout', '登出', 'api', '/auth/logout', 'POST', 20, 2, 1),
('auth:me', '个人信息', 'api', '/auth/me', 'GET', 20, 3, 1),
('oauth', 'OAuth2管理', 'menu', '', NULL, 0, 3, 1),
('oauth:token', '获取Token', 'api', '/oauth/token', 'POST', 24, 1, 1),
('oauth:authorize', '授权', 'api', '/oauth/authorize', 'GET', 24, 2, 1),
('oauth:check_token', '校验Token', 'api', '/oauth/check_token', 'POST', 24, 3, 1),
('oauth:revoke', '吊销Token', 'api', '/oauth/revoke', 'POST', 24, 4, 1),
('api', 'API管理', 'menu', '', NULL, 0, 4, 1),
('api:quota', '配额查询', 'api', '/auth/quota', 'GET', 29, 1, 1);

INSERT INTO sys_user_role (user_id, role_id) VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 4),
(5, 4),
(6, 5);

INSERT INTO sys_role_permission (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
(1, 11), (1, 12), (1, 13), (1, 14), (1, 15), (1, 16), (1, 17), (1, 18), (1, 19), (1, 20),
(1, 21), (1, 22), (1, 23), (1, 24), (1, 25), (1, 26), (1, 27), (1, 28), (1, 29), (1, 30),
(2, 2), (2, 3), (2, 7), (2, 20), (2, 21), (2, 22), (2, 23), (2, 29), (2, 30),
(3, 2), (3, 3), (3, 7), (3, 20), (3, 21), (3, 22), (3, 23),
(4, 3), (4, 7), (4, 21), (4, 22), (4, 23),
(5, 3), (5, 7), (5, 21), (5, 22), (5, 23);

INSERT INTO sys_data_permission (role_id, data_type, table_name, column_name, row_condition, column_permission, status, remark) VALUES
(2, 'row', 'sys_user', NULL, '3', NULL, 1, '部门经理只能查看本部门用户'),
(3, 'row', 'sys_user', NULL, '4', NULL, 1, '部门经理可查看本部门及下级部门用户'),
(4, 'row', 'sys_user', NULL, '5', NULL, 1, '普通用户只能查看自己的数据'),
(5, 'row', 'sys_user', NULL, 'id = 1', NULL, 1, '访客只能查看ID为1的用户'),
(5, 'column', 'sys_user', 'id,username,nickname,dept_id', NULL, '["id","username","nickname","dept_id"]', 1, '访客只能查看用户的基本信息列');

INSERT INTO oauth_client (client_id, client_secret, client_name, client_type, authorized_grant_types, web_server_redirect_uri, scope, access_token_validity, refresh_token_validity, autoapprove, status, daily_quota, hourly_quota, minute_quota) VALUES
('default_client', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '默认客户端', 'web', 'authorization_code,password,client_credentials,refresh_token', 'http://localhost:8080/oauth2/*', 'all', 7200, 2592000, 'true', 1, 86400000, 3600000, 60000),
('web_app', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', 'Web应用', 'web', 'authorization_code,password,refresh_token', 'http://localhost:3000/callback,http://localhost:8080/oauth2/login/oauth2/code/*', 'read,write', 7200, 2592000, 'true', 1, 86400000, 3600000, 60000),
('mobile_app', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '移动应用', 'app', 'password,refresh_token', '', 'read', 7200, 2592000, 'true', 1, 43200000, 1800000, 30000),
('server_app', '$2a$10$7JB720yubVSZvUI0rEqK/.VqGOZTH.ulu33dHOiBE8ByOhJIrdAu2', '服务端应用', 'server', 'client_credentials,refresh_token', '', 'all', 7200, 2592000, 'true', 1, 86400000, 3600000, 60000);
