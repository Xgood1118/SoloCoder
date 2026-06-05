-- Users
MERGE INTO users
USING (SELECT 1 AS dual) AS dummy
ON users.id = '550e8400-e29b-41d4-a716-446655440001'
WHEN MATCHED THEN UPDATE SET username = 'admin'
WHEN NOT MATCHED THEN INSERT (id, username, password, realName, department, role, email, avatarUrl, enabled, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'admin', '{bcrypt}$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员', '技术部', 'ADMIN', 'admin@cms.com', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO users
USING (SELECT 1 AS dual) AS dummy
ON users.id = '550e8400-e29b-41d4-a716-446655440002'
WHEN MATCHED THEN UPDATE SET username = 'editor'
WHEN NOT MATCHED THEN INSERT (id, username, password, realName, department, role, email, avatarUrl, enabled, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440002', 'editor', '{bcrypt}$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '内容编辑', '运营部', 'CONTRIBUTOR', 'editor@cms.com', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO users
USING (SELECT 1 AS dual) AS dummy
ON users.id = '550e8400-e29b-41d4-a716-446655440003'
WHEN MATCHED THEN UPDATE SET username = 'reader'
WHEN NOT MATCHED THEN INSERT (id, username, password, realName, department, role, email, avatarUrl, enabled, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440003', 'reader', '{bcrypt}$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '普通用户', '市场部', 'READER', 'reader@cms.com', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Categories
MERGE INTO categories
USING (SELECT 1 AS dual) AS dummy
ON categories.id = '550e8400-e29b-41d4-a716-446655440010'
WHEN MATCHED THEN UPDATE SET name = '技术文章'
WHEN NOT MATCHED THEN INSERT (id, name, parentId, sortOrder, documentCount, description, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440010', '技术文章', NULL, 1, 0, '技术相关文章分类', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO categories
USING (SELECT 1 AS dual) AS dummy
ON categories.id = '550e8400-e29b-41d4-a716-446655440011'
WHEN MATCHED THEN UPDATE SET name = 'Java'
WHEN NOT MATCHED THEN INSERT (id, name, parentId, sortOrder, documentCount, description, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440011', 'Java', '550e8400-e29b-41d4-a716-446655440010', 1, 0, 'Java 技术文章', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO categories
USING (SELECT 1 AS dual) AS dummy
ON categories.id = '550e8400-e29b-41d4-a716-446655440012'
WHEN MATCHED THEN UPDATE SET name = 'Web前端'
WHEN NOT MATCHED THEN INSERT (id, name, parentId, sortOrder, documentCount, description, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440012', 'Web前端', '550e8400-e29b-41d4-a716-446655440010', 2, 0, 'Web 前端技术文章', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO categories
USING (SELECT 1 AS dual) AS dummy
ON categories.id = '550e8400-e29b-41d4-a716-446655440013'
WHEN MATCHED THEN UPDATE SET name = 'Angular'
WHEN NOT MATCHED THEN INSERT (id, name, parentId, sortOrder, documentCount, description, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440013', 'Angular', '550e8400-e29b-41d4-a716-446655440012', 1, 0, 'Angular 技术文章', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO categories
USING (SELECT 1 AS dual) AS dummy
ON categories.id = '550e8400-e29b-41d4-a716-446655440014'
WHEN MATCHED THEN UPDATE SET name = '产品动态'
WHEN NOT MATCHED THEN INSERT (id, name, parentId, sortOrder, documentCount, description, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440014', '产品动态', NULL, 2, 0, '产品更新与发布', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO categories
USING (SELECT 1 AS dual) AS dummy
ON categories.id = '550e8400-e29b-41d4-a716-446655440015'
WHEN MATCHED THEN UPDATE SET name = '行业资讯'
WHEN NOT MATCHED THEN INSERT (id, name, parentId, sortOrder, documentCount, description, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440015', '行业资讯', NULL, 3, 0, '行业新闻与趋势', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO categories
USING (SELECT 1 AS dual) AS dummy
ON categories.id = '550e8400-e29b-41d4-a716-446655440016'
WHEN MATCHED THEN UPDATE SET name = '开发日志'
WHEN NOT MATCHED THEN INSERT (id, name, parentId, sortOrder, documentCount, description, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440016', '开发日志', NULL, 4, 0, '开发过程中的记录与心得', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Tags
MERGE INTO tags
USING (SELECT 1 AS dual) AS dummy
ON tags.id = '550e8400-e29b-41d4-a716-446655440020'
WHEN MATCHED THEN UPDATE SET name = 'tag-java'
WHEN NOT MATCHED THEN INSERT (id, name, usageCount, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440020', 'tag-java', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tags
USING (SELECT 1 AS dual) AS dummy
ON tags.id = '550e8400-e29b-41d4-a716-446655440021'
WHEN MATCHED THEN UPDATE SET name = 'tag-spring'
WHEN NOT MATCHED THEN INSERT (id, name, usageCount, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440021', 'tag-spring', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tags
USING (SELECT 1 AS dual) AS dummy
ON tags.id = '550e8400-e29b-41d4-a716-446655440022'
WHEN MATCHED THEN UPDATE SET name = 'tag-angular'
WHEN NOT MATCHED THEN INSERT (id, name, usageCount, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440022', 'tag-angular', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tags
USING (SELECT 1 AS dual) AS dummy
ON tags.id = '550e8400-e29b-41d4-a716-446655440023'
WHEN MATCHED THEN UPDATE SET name = 'tag-frontend'
WHEN NOT MATCHED THEN INSERT (id, name, usageCount, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440023', 'tag-frontend', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tags
USING (SELECT 1 AS dual) AS dummy
ON tags.id = '550e8400-e29b-41d4-a716-446655440024'
WHEN MATCHED THEN UPDATE SET name = 'tag-backend'
WHEN NOT MATCHED THEN INSERT (id, name, usageCount, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440024', 'tag-backend', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tags
USING (SELECT 1 AS dual) AS dummy
ON tags.id = '550e8400-e29b-41d4-a716-446655440025'
WHEN MATCHED THEN UPDATE SET name = 'tag-database'
WHEN NOT MATCHED THEN INSERT (id, name, usageCount, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440025', 'tag-database', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tags
USING (SELECT 1 AS dual) AS dummy
ON tags.id = '550e8400-e29b-41d4-a716-446655440026'
WHEN MATCHED THEN UPDATE SET name = 'tag-devops'
WHEN NOT MATCHED THEN INSERT (id, name, usageCount, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440026', 'tag-devops', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tags
USING (SELECT 1 AS dual) AS dummy
ON tags.id = '550e8400-e29b-41d4-a716-446655440027'
WHEN MATCHED THEN UPDATE SET name = 'tag-microservice'
WHEN NOT MATCHED THEN INSERT (id, name, usageCount, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440027', 'tag-microservice', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Document Templates
MERGE INTO document_templates
USING (SELECT 1 AS dual) AS dummy
ON document_templates.id = '550e8400-e29b-41d4-a716-446655440030'
WHEN MATCHED THEN UPDATE SET name = '新闻稿模板'
WHEN NOT MATCHED THEN INSERT (id, name, description, categoryId, structure, createdBy, isDefault, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440030', '新闻稿模板', '通用新闻稿模板', NULL, '{"title":"","content":"","summary":"","author":"","source":""}', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO document_templates
USING (SELECT 1 AS dual) AS dummy
ON document_templates.id = '550e8400-e29b-41d4-a716-446655440031'
WHEN MATCHED THEN UPDATE SET name = '技术文章模板'
WHEN NOT MATCHED THEN INSERT (id, name, description, categoryId, structure, createdBy, isDefault, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440031', '技术文章模板', '技术文章专用模板', '550e8400-e29b-41d4-a716-446655440010', '{"title":"","content":"","techStack":"[]","codeSnippets":"[]","references":"[]"}', NULL, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Review Configs
MERGE INTO review_configs
USING (SELECT 1 AS dual) AS dummy
ON review_configs.id = '550e8400-e29b-41d4-a716-446655440040'
WHEN MATCHED THEN UPDATE SET categoryId = '550e8400-e29b-41d4-a716-446655440010'
WHEN NOT MATCHED THEN INSERT (id, categoryId, reviewLevels, level1ReviewerRole, level2ReviewerRole, enabled, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440040', '550e8400-e29b-41d4-a716-446655440010', 2, 'CONTRIBUTOR', 'ADMIN', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO review_configs
USING (SELECT 1 AS dual) AS dummy
ON review_configs.id = '550e8400-e29b-41d4-a716-446655440041'
WHEN MATCHED THEN UPDATE SET categoryId = '550e8400-e29b-41d4-a716-446655440014'
WHEN NOT MATCHED THEN INSERT (id, categoryId, reviewLevels, level1ReviewerRole, level2ReviewerRole, enabled, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440014', 1, 'ADMIN', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO review_configs
USING (SELECT 1 AS dual) AS dummy
ON review_configs.id = '550e8400-e29b-41d4-a716-446655440042'
WHEN MATCHED THEN UPDATE SET categoryId = '550e8400-e29b-41d4-a716-446655440015'
WHEN NOT MATCHED THEN INSERT (id, categoryId, reviewLevels, level1ReviewerRole, level2ReviewerRole, enabled, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440015', 1, 'CONTRIBUTOR', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO review_configs
USING (SELECT 1 AS dual) AS dummy
ON review_configs.id = '550e8400-e29b-41d4-a716-446655440043'
WHEN MATCHED THEN UPDATE SET categoryId = '550e8400-e29b-41d4-a716-446655440016'
WHEN NOT MATCHED THEN INSERT (id, categoryId, reviewLevels, level1ReviewerRole, level2ReviewerRole, enabled, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440043', '550e8400-e29b-41d4-a716-446655440016', 1, 'CONTRIBUTOR', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Documents
MERGE INTO documents
USING (SELECT 1 AS dual) AS dummy
ON documents.id = '550e8400-e29b-41d4-a716-446655440050'
WHEN MATCHED THEN UPDATE SET title = 'Spring Boot 3.1 新特性概览'
WHEN NOT MATCHED THEN INSERT (id, title, content, categoryId, authorId, status, accessLevel, viewCount, allowComments, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440050', 'Spring Boot 3.1 新特性概览', '<h2>Spring Boot 3.1 新特性</h2><p>Spring Boot 3.1 带来了许多令人兴奋的新特性，包括对 Java 17 的全面支持、改进的 Docker 镜像构建、以及增强的可观测性支持。</p><p>本文将详细介绍这些变化...</p>', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'PUBLISHED', 'PUBLIC', 256, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO documents
USING (SELECT 1 AS dual) AS dummy
ON documents.id = '550e8400-e29b-41d4-a716-446655440051'
WHEN MATCHED THEN UPDATE SET title = 'Angular 响应式编程实践'
WHEN NOT MATCHED THEN INSERT (id, title, content, categoryId, authorId, status, accessLevel, viewCount, allowComments, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440051', 'Angular 响应式编程实践', '<h2>RxJS 在 Angular 中的应用</h2><p>响应式编程是 Angular 框架的核心范式之一。通过 RxJS，开发者可以优雅地处理异步数据流...</p>', '550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440002', 'PUBLISHED', 'PUBLIC', 189, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO documents
USING (SELECT 1 AS dual) AS dummy
ON documents.id = '550e8400-e29b-41d4-a716-446655440052'
WHEN MATCHED THEN UPDATE SET title = '技术文章草稿'
WHEN NOT MATCHED THEN INSERT (id, title, content, categoryId, authorId, status, accessLevel, viewCount, allowComments, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440052', '技术文章草稿', '<h2>待完成的技术文章</h2><p>这是一篇草稿，内容正在编写中...</p>', '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440002', 'DRAFT', 'PRIVATE', 0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO documents
USING (SELECT 1 AS dual) AS dummy
ON documents.id = '550e8400-e29b-41d4-a716-446655440053'
WHEN MATCHED THEN UPDATE SET title = '产品 v2.0 发布公告'
WHEN NOT MATCHED THEN INSERT (id, title, content, categoryId, authorId, status, accessLevel, viewCount, allowComments, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440053', '产品 v2.0 发布公告', '<h2>产品 v2.0 正式发布</h2><p>我们很高兴地宣布产品 v2.0 版本正式发布，带来了全新的用户界面和性能优化...</p>', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440001', 'PUBLISHED', 'INTERNAL', 342, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO documents
USING (SELECT 1 AS dual) AS dummy
ON documents.id = '550e8400-e29b-41d4-a716-446655440054'
WHEN MATCHED THEN UPDATE SET title = 'Java 21 新特性详解'
WHEN NOT MATCHED THEN INSERT (id, title, content, categoryId, authorId, status, accessLevel, viewCount, allowComments, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440054', 'Java 21 新特性详解', '<h2>Java 21 新特性</h2><p>Java 21 作为 LTS 版本，引入了许多重要特性，包括虚拟线程、模式匹配等...</p>', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440002', 'PENDING_REVIEW', 'PUBLIC', 0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Document Tags associations
MERGE INTO document_tags
USING (SELECT 1 AS dual) AS dummy
ON document_tags.document_id = '550e8400-e29b-41d4-a716-446655440050' AND document_tags.tag_id = '550e8400-e29b-41d4-a716-446655440020'
WHEN NOT MATCHED THEN INSERT (document_id, tag_id)
VALUES ('550e8400-e29b-41d4-a716-446655440050', '550e8400-e29b-41d4-a716-446655440020');

MERGE INTO document_tags
USING (SELECT 1 AS dual) AS dummy
ON document_tags.document_id = '550e8400-e29b-41d4-a716-446655440050' AND document_tags.tag_id = '550e8400-e29b-41d4-a716-446655440021'
WHEN NOT MATCHED THEN INSERT (document_id, tag_id)
VALUES ('550e8400-e29b-41d4-a716-446655440050', '550e8400-e29b-41d4-a716-446655440021');

MERGE INTO document_tags
USING (SELECT 1 AS dual) AS dummy
ON document_tags.document_id = '550e8400-e29b-41d4-a716-446655440050' AND document_tags.tag_id = '550e8400-e29b-41d4-a716-446655440024'
WHEN NOT MATCHED THEN INSERT (document_id, tag_id)
VALUES ('550e8400-e29b-41d4-a716-446655440050', '550e8400-e29b-41d4-a716-446655440024');

MERGE INTO document_tags
USING (SELECT 1 AS dual) AS dummy
ON document_tags.document_id = '550e8400-e29b-41d4-a716-446655440051' AND document_tags.tag_id = '550e8400-e29b-41d4-a716-446655440022'
WHEN NOT MATCHED THEN INSERT (document_id, tag_id)
VALUES ('550e8400-e29b-41d4-a716-446655440051', '550e8400-e29b-41d4-a716-446655440022');

MERGE INTO document_tags
USING (SELECT 1 AS dual) AS dummy
ON document_tags.document_id = '550e8400-e29b-41d4-a716-446655440051' AND document_tags.tag_id = '550e8400-e29b-41d4-a716-446655440023'
WHEN NOT MATCHED THEN INSERT (document_id, tag_id)
VALUES ('550e8400-e29b-41d4-a716-446655440051', '550e8400-e29b-41d4-a716-446655440023');

MERGE INTO document_tags
USING (SELECT 1 AS dual) AS dummy
ON document_tags.document_id = '550e8400-e29b-41d4-a716-446655440054' AND document_tags.tag_id = '550e8400-e29b-41d4-a716-446655440020'
WHEN NOT MATCHED THEN INSERT (document_id, tag_id)
VALUES ('550e8400-e29b-41d4-a716-446655440054', '550e8400-e29b-41d4-a716-446655440020');

MERGE INTO document_tags
USING (SELECT 1 AS dual) AS dummy
ON document_tags.document_id = '550e8400-e29b-41d4-a716-446655440054' AND document_tags.tag_id = '550e8400-e29b-41d4-a716-446655440024'
WHEN NOT MATCHED THEN INSERT (document_id, tag_id)
VALUES ('550e8400-e29b-41d4-a716-446655440054', '550e8400-e29b-41d4-a716-446655440024');

-- Review Records for Doc 5
MERGE INTO review_records
USING (SELECT 1 AS dual) AS dummy
ON review_records.id = '550e8400-e29b-41d4-a716-446655440060'
WHEN MATCHED THEN UPDATE SET documentId = '550e8400-e29b-41d4-a716-446655440054'
WHEN NOT MATCHED THEN INSERT (id, documentId, reviewerId, level, status, comment, reviewedAt, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440060', '550e8400-e29b-41d4-a716-446655440054', '550e8400-e29b-41d4-a716-446655440002', 1, 'PENDING', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO review_records
USING (SELECT 1 AS dual) AS dummy
ON review_records.id = '550e8400-e29b-41d4-a716-446655440061'
WHEN MATCHED THEN UPDATE SET documentId = '550e8400-e29b-41d4-a716-446655440054'
WHEN NOT MATCHED THEN INSERT (id, documentId, reviewerId, level, status, comment, reviewedAt, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440061', '550e8400-e29b-41d4-a716-446655440054', '550e8400-e29b-41d4-a716-446655440001', 2, 'PENDING', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Comments on Doc 1
MERGE INTO comments
USING (SELECT 1 AS dual) AS dummy
ON comments.id = '550e8400-e29b-41d4-a716-446655440070'
WHEN MATCHED THEN UPDATE SET content = '好文章！'
WHEN NOT MATCHED THEN INSERT (id, documentId, userId, content, parentId, likeCount, replyToUserId, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440070', '550e8400-e29b-41d4-a716-446655440050', '550e8400-e29b-41d4-a716-446655440003', '好文章！', NULL, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO comments
USING (SELECT 1 AS dual) AS dummy
ON comments.id = '550e8400-e29b-41d4-a716-446655440071'
WHEN MATCHED THEN UPDATE SET content = '谢谢分享！'
WHEN NOT MATCHED THEN INSERT (id, documentId, userId, content, parentId, likeCount, replyToUserId, createdAt, updatedAt)
VALUES ('550e8400-e29b-41d4-a716-446655440071', '550e8400-e29b-41d4-a716-446655440050', '550e8400-e29b-41d4-a716-446655440002', '谢谢分享！', '550e8400-e29b-41d4-a716-446655440070', 0, '550e8400-e29b-41d4-a716-446655440003', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
