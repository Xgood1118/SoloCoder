# 代码片段管理器

一个功能完整的代码片段管理系统，使用 Go 语言开发，支持团队协作、版本控制、模糊搜索等功能。

## 功能特性

### 核心功能
- **代码片段管理**: 增删改查代码片段
- **标签分类**: 支持多标签管理
- **模糊搜索**: 按标题、标签、代码内容进行模糊匹配
- **版本历史**: 自动保存修改历史，支持版本回滚
- **团队协作**: 每个团队有独立的片段库

### 高级功能
- **导入导出**: 支持 JSON 和 CSV 格式
- **评论系统**: 团队成员可以对片段进行评论
- **收藏功能**: 收藏常用代码片段
- **引用关系**: 片段间可以相互引用，自动检测循环引用
- **语言统计**: 按编程语言统计片段数量分布
- **权限控制**: 管理员和普通成员权限分离
- **公开/私有**: 支持公开片段和私有片段库
- **批量操作**: 批量修改标签、批量删除
- **快速预览**: 列表显示代码前 20 行预览

## 技术栈

- **语言**: Go 1.23+
- **数据库**: SQLite
- **ORM**: GORM
- **Web框架**: 标准库 net/http

## 快速开始

### 安装依赖

```bash
go mod download
```

### 运行服务

```bash
go run cmd/server/main.go
```

服务默认在 `8080` 端口启动。

### 环境变量配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | 8080 |
| `DB_PATH` | 数据库文件路径 | snippets.db |
| `MAX_CODE_LENGTH` | 单个片段最大代码长度 | 100000 |
| `DEFAULT_PAGE_SIZE` | 默认分页大小 | 20 |
| `MAX_PAGE_SIZE` | 最大分页大小 | 100 |

## API 文档

### 基础路径

所有 API 都以 `/api` 为前缀。

### 认证

通过请求头 `X-User-ID` 传递用户 ID 进行认证。

### 团队

通过查询参数 `team_id` 指定团队 ID，默认为 1。

### 片段管理

#### 创建片段
```http
POST /api/snippets
Content-Type: application/json
X-User-ID: 1

{
  "title": "HTTP 请求工具函数",
  "language": "Go",
  "code": "func Get(url string) ([]byte, error) { ... }",
  "tags": ["网络", "工具函数"],
  "visibility": "public",
  "library_type": "public",
  "is_public": true
}
```

#### 获取片段列表
```http
GET /api/snippets?page=1&page_size=20&sort=created_at
```

支持的排序方式:
- `created_at`: 按创建时间倒序（默认）
- `hot` 或 `references`: 按热度（引用次数）排序

#### 搜索片段
```http
GET /api/snippets?q=数据库&page=1&page_size=20
```

#### 获取片段详情
```http
GET /api/snippets/{id}
```

#### 获取片段预览
```http
GET /api/snippets/{id}/preview
```

#### 更新片段
```http
PUT /api/snippets/{id}
Content-Type: application/json
X-User-ID: 1

{
  "title": "新标题",
  "code": "新代码内容",
  "tags": ["新标签"]
}
```

#### 删除片段
```http
DELETE /api/snippets/{id}
X-User-ID: 1
```

### 版本管理

#### 获取版本列表
```http
GET /api/snippets/{id}/versions
```

#### 获取特定版本
```http
GET /api/snippets/{id}/versions/{version}
```

#### 恢复版本
```http
POST /api/snippets/{id}/versions/{version}/restore
X-User-ID: 1
```

### 标签管理

#### 获取所有标签
```http
GET /api/tags
```

#### 按标签获取片段
```http
GET /api/tags/{tagName}
```

### 评论管理

#### 获取评论列表
```http
GET /api/snippets/{id}/comments
```

#### 添加评论
```http
POST /api/snippets/{id}/comments
Content-Type: application/json
X-User-ID: 1

{
  "content": "这个函数很实用！"
}
```

#### 删除评论
```http
DELETE /api/comments/{id}
X-User-ID: 1
```

### 收藏功能

#### 获取收藏列表
```http
GET /api/favorites
X-User-ID: 1
```

#### 检查是否收藏
```http
GET /api/snippets/{id}/favorite
X-User-ID: 1
```

#### 添加收藏
```http
POST /api/snippets/{id}/favorite
X-User-ID: 1
```

#### 取消收藏
```http
DELETE /api/snippets/{id}/favorite
X-User-ID: 1
```

### 引用关系

#### 获取引用关系
```http
GET /api/snippets/{id}/references
```

返回:
- `referenced_by`: 哪些片段引用了此片段
- `references`: 此片段引用了哪些片段

#### 添加引用
```http
POST /api/snippets/{id}/references
Content-Type: application/json
X-User-ID: 1

{
  "source_id": 1,
  "target_id": 2
}
```

#### 删除引用
```http
DELETE /api/snippets/{id}/references
Content-Type: application/json
X-User-ID: 1

{
  "source_id": 1,
  "target_id": 2
}
```

### 批量操作

#### 批量更新标签
```http
POST /api/batch/tags
Content-Type: application/json
X-User-ID: 1

{
  "snippet_ids": [1, 2, 3],
  "tags": ["新标签1", "新标签2"],
  "replace": false
}
```

- `replace: true` 替换所有标签
- `replace: false` 追加标签

#### 批量删除
```http
POST /api/batch/delete
Content-Type: application/json
X-User-ID: 1

{
  "snippet_ids": [1, 2, 3],
  "confirmed": true
}
```

### 导入导出

#### 导出 JSON
```http
GET /api/export/json
```

#### 导出 CSV
```http
GET /api/export/csv
```

#### 导入 JSON
```http
POST /api/import/json
Content-Type: application/json
X-User-ID: 1

[
  {
    "title": "片段1",
    "language": "Go",
    "code": "...",
    "tags": ["标签1"]
  }
]
```

#### 导入 CSV
```http
POST /api/import/csv
Content-Type: text/csv
X-User-ID: 1
```

### 统计

#### 语言统计
```http
GET /api/stats/languages
```

#### 支持的语言
```http
GET /api/languages
```

支持的语言列表:
- Go
- Python
- Java
- JavaScript
- TypeScript
- Rust
- C++
- C#
- Ruby
- PHP
- SQL
- Shell

## 项目结构

```
.
├── cmd/
│   └── server/
│       └── main.go          # 服务入口
├── internal/
│   ├── config/              # 配置管理
│   ├── handler/             # HTTP 处理器
│   ├── middleware/          # 中间件
│   ├── model/               # 数据模型
│   ├── repository/          # 数据访问层
│   └── service/             # 业务逻辑层
├── pkg/
│   ├── search/              # 模糊搜索
│   └── utils/               # 工具函数
├── go.mod
└── README.md
```

## 权限说明

### 用户角色
- **管理员 (admin)**: 可以管理团队内所有片段
- **普通成员 (member)**: 只能管理自己创建的片段

### 片段可见性
- **公开 (is_public: true)**: 其他团队也可以浏览
- **私有 (is_public: false)**: 仅本团队可见

### 片段库类型
- **公共库 (library_type: public)**: 团队所有成员可见
- **私有库 (library_type: private)**: 仅创建者和管理员可见

## 开发说明

### 代码规范
- 使用 Go 标准格式化工具 `go fmt`
- 遵循 Effective Go 规范
- 函数命名遵循驼峰命名法

### 测试

```bash
go test ./...
```

## License

MIT
