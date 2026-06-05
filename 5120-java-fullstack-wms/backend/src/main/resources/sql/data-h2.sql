INSERT INTO warehouses (name, code, location, manager) VALUES 
('主仓库', 'WH001', 'A区1号楼', '张三'),
('二号仓库', 'WH002', 'B区2号楼', '李四');

INSERT INTO users (username, password, real_name, role, warehouse_id) VALUES 
('admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '系统管理员', 'ADMIN', NULL),
('operator1', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '操作员A', 'OPERATOR', 1),
('viewer1', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iKTVKIUi', '查看员B', 'VIEWER', 1);
