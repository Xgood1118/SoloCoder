# 仓库管理系统 (WMS)

基于 Spring Boot + React 的前后端分离仓库管理系统。

## 功能特性

### 核心功能
- **入库管理**：支持商品入库，填写商品名称、数量、生产批次、供应商、入库时间等信息
- **出库管理**：支持商品出库，先进先出(FIFO)批次消耗策略，库存不足禁止出库
- **库存查询**：按商品名称模糊搜索，按仓库位置筛选，显示库存警戒线
- **批次管理**：批次号查询，查看批次操作记录，支持生产日期和有效期管理
- **数据导出**：库存数据和出入库记录导出为Excel，分页导出避免内存溢出

### 安全特性
- ✅ **SQL注入防护**：使用JPA参数化查询，禁止字符串拼接SQL
- ✅ **越权访问防护**：基于角色和仓库的权限控制，用户只能访问所属仓库数据
- ✅ **JWT认证**：无状态Token认证，支持角色权限
- ✅ **操作日志**：完整的操作审计日志，用于追溯对账
- ✅ **密码加密**：BCrypt密码加密存储

## 技术栈

### 后端
- Java 17
- Spring Boot 3.2
- Spring Security + JWT
- Spring Data JPA
- MySQL 8.0
- Apache POI (Excel导出)
- Lombok

### 前端
- React 18 + TypeScript
- Vite
- Ant Design 5
- React Router 6
- Axios
- Day.js

## 项目结构

```
5120-java-fullstack-wms/
├── backend/                    # 后端项目
│   ├── src/
│   │   └── main/
│   │       ├── java/com/wms/
│   │       │   ├── controller/    # 控制器层
│   │       │   ├── service/       # 业务逻辑层
│   │       │   ├── repository/    # 数据访问层
│   │       │   ├── entity/        # 实体类
│   │       │   ├── dto/           # 数据传输对象
│   │       │   ├── security/      # 安全相关
│   │       │   ├── config/        # 配置类
│   │       │   └── WmsApplication.java
│   │       └── resources/
│   │           ├── application.yml
│   │           └── sql/init.sql
│   └── pom.xml
├── frontend/                   # 前端项目
│   ├── src/
│   │   ├── pages/              # 页面组件
│   │   ├── components/         # 公共组件
│   │   ├── services/           # API服务
│   │   └── utils/              # 工具类
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 快速开始

### 环境要求
- JDK 17+
- Node.js 16+
- MySQL 8.0+
- Maven 3.6+

### 数据库初始化

1. 创建数据库：
```sql
CREATE DATABASE wms_db DEFAULT CHARACTER SET utf8mb4;
```

2. 执行初始化脚本：
```bash
mysql -u root -p wms_db < backend/src/main/resources/sql/init.sql
```

3. 默认账号：
   - 管理员: admin / 123456
   - 操作员: operator1 / 123456
   - 查看员: viewer1 / 123456

### 后端启动

1. 修改数据库配置：
编辑 `backend/src/main/resources/application.yml`

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/wms_db?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai
    username: root
    password: your_password
```

2. 启动后端服务：
```bash
cd backend
mvn clean install
mvn spring-boot:run
```

后端服务将在 http://localhost:8080 启动

### 前端启动

1. 安装依赖：
```bash
cd frontend
npm install
```

2. 启动开发服务：
```bash
npm run dev
```

前端服务将在 http://localhost:3000 启动

## 业务流程说明

### 入库流程
1. 填写商品名称、编码（可选，新商品自动生成）
2. 填写入库数量、生产批次号
3. 选择入库仓库
4. 可选填写：生产日期、有效期、供应商、库存警戒线
5. 提交后自动创建商品（如不存在）、批次、更新库存

### 出库流程
1. 选择出库仓库
2. 搜索并选择要出库的商品
3. 填写出库数量（不能超过当前库存）
4. 填写领用部门、领用人
5. 提交后按先进先出(FIFO)消耗批次库存

### FIFO批次策略
系统严格按照先进先出原则消耗库存：
- 按批次入库时间排序，优先消耗最早入库的批次
- 出库数量跨多个批次时自动拆分消耗
- 完整记录每个批次的出入库流水

### 权限控制

| 角色 | 权限说明 |
|------|---------|
| ADMIN (管理员) | 可访问所有仓库数据，执行所有操作 |
| OPERATOR (操作员) | 只能访问所属仓库，可执行出入库操作 |
| VIEWER (查看员) | 只能访问所属仓库，只能查询数据 |

### 安全机制说明

#### SQL注入防护
- 所有数据库查询使用Spring Data JPA的参数化查询
- 自定义查询使用 `@Param` 注解绑定参数
- 禁止字符串拼接SQL语句

#### 越权防护
- 每次查询前调用 `securityUtil.checkWarehouseAccess(warehouseId)` 验证权限
- 非管理员用户自动过滤到所属仓库数据
- 批次记录查询前验证批次所属仓库权限

## API接口列表

### 认证接口
- `POST /api/auth/login` - 用户登录

### 库存接口
- `GET /api/inventory/list` - 库存列表查询
- `GET /api/product/list` - 商品列表查询

### 出入库接口
- `POST /api/stock/in` - 商品入库
- `POST /api/stock/out` - 商品出库

### 批次接口
- `GET /api/batch/list` - 批次列表
- `GET /api/batch/product/{productId}` - 按商品查询批次
- `GET /api/batch/records/{batchNo}` - 批次操作记录查询

### 导出接口
- `GET /api/export/inventory` - 导出库存数据
- `GET /api/export/stock-records` - 导出出入库记录

### 基础数据接口
- `GET /api/warehouse/list` - 仓库列表
