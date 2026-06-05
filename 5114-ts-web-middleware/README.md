# API Debug Tool

一个功能完整的可视化 API 调试工具，支持请求构造、Header 管理、响应高亮、JSONPath 查询、请求历史等功能。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: Node.js + Express + TypeScript
- **请求库**: Axios
- **数据持久化**: IndexedDB (idb)
- **JSONPath**: jsonpath-plus

## 功能特性

### 请求构造
- ✅ URL 输入和方法选择 (GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS)
- ✅ Query 参数编辑器（支持启用/禁用）
- ✅ Body 参数支持多种格式:
  - JSON (带格式化和语法校验)
  - FormData
  - Raw 原始内容
  - None 无Body

### Header 管理
- ✅ 支持添加/删除/修改 Header
- ✅ 支持单独启用/禁用某个 Header
- ✅ 默认预置 Content-Type: application/json

### 响应展示
- ✅ JSON 语法高亮显示
- ✅ 支持节点折叠/展开
- ✅ 响应头展示
- ✅ 状态码和响应时间显示
- ✅ 响应大小统计

### JSONPath 查询
- ✅ 支持 JSONPath 表达式查询
- ✅ 实时显示匹配数量
- ✅ 匹配结果高亮显示
- ✅ 表达式语法校验

### 大响应处理
- ✅ 超过 500 行自动截断显示
- ✅ 支持手动展开查看全部
- ✅ 支持下载响应内容

### 非法 JSON 容错
- ✅ 非 JSON 响应自动显示原始文本
- ✅ 不会崩溃报错

### 请求历史
- ✅ IndexedDB 持久化存储
- ✅ 支持搜索历史记录
- ✅ 支持删除单条记录
- ✅ 支持清空全部历史
- ✅ 点击历史可重新加载请求

## 项目结构

```
.
├── client/                 # 前端项目
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── types/         # TypeScript 类型定义
│   │   ├── utils/         # 工具函数
│   │   ├── App.tsx        # 主应用组件
│   │   ├── main.tsx       # 入口文件
│   │   └── index.css      # 样式文件
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── server/                 # 后端代理服务
│   ├── src/
│   │   └── index.ts       # 代理服务入口
│   ├── package.json
│   └── tsconfig.json
└── package.json           # 根目录配置
```

## 快速开始

### 安装依赖

```bash
# 安装所有依赖（根目录、前端、后端）
npm run install:all
```

或者分别安装：

```bash
# 根目录
npm install

# 后端
cd server
npm install

# 前端
cd ../client
npm install
```

### 启动开发服务

```bash
# 同时启动前后端（推荐）
npm run dev

# 或者分别启动：
# 启动后端代理服务 (端口 3001)
npm run dev:server

# 启动前端开发服务 (端口 5173)
npm run dev:client
```

### 访问应用

打开浏览器访问: http://localhost:5173

## 使用说明

### 发送请求

1. 在 URL 输入框中输入请求地址
2. 选择 HTTP 方法（GET/POST 等）
3. 在 Query 参数标签页添加 URL 参数
4. 在 Headers 标签页配置请求头
5. 在 Body 标签页配置请求体（根据需要选择格式）
6. 点击「发送」按钮

### 使用 JSONPath

1. 发送请求获得 JSON 响应
2. 在响应区域的 JSONPath 输入框中输入表达式
3. 例如: `$.data.items[0].name`
4. 匹配结果会高亮显示并在上方展示

### 查看历史记录

1. 点击右上角「历史记录」按钮
2. 可以搜索历史请求
3. 点击任意历史记录可重新加载该请求
4. 支持删除单条或清空全部历史

## 后端代理说明

由于浏览器的跨域限制，所有请求通过后端代理转发：

- **代理地址**: `POST /api/proxy`
- **请求参数**:
  - `url`: 目标 URL
  - `method`: HTTP 方法
  - `headers`: 请求头对象
  - `params`: URL 参数对象
  - `data`: 请求体数据

## 构建生产版本

```bash
# 构建前端
npm run build

# 启动生产服务
npm start
```

## License

MIT
