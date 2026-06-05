# 行政会议室与设备管理系统

## 项目简介

行政团队的会议室和设备管理系统，解决 Excel 表格管理导致的预约冲突和设备绑定混乱问题。

## 技术栈

### 后端
- Java 21
- Spring Boot 3.2.0
- Spring Data JPA
- MySQL 8.0
- Lombok
- Jackson

### 前端
- Vue 3.4
- Vite 5.0
- Vue Router 4
- Pinia 2
- Element Plus 2.4
- Axios
- Day.js
- ECharts 5

## 项目结构

```
5111-java-web-admin/
├── backend/                          # 后端项目
│   ├── src/main/java/com/example/meetingroom/
│   │   ├── common/                   # 公共类
│   │   │   ├── PageResult.java
│   │   │   └── Result.java
│   │   ├── config/                   # 配置类
│   │   │   └── CorsConfig.java
│   │   ├── controller/               # 控制层
│   │   │   ├── EquipmentController.java
│   │   │   ├── EquipmentLockLogController.java
│   │   │   ├── MeetingRoomController.java
│   │   │   └── ReservationController.java
│   │   ├── dto/                      # 数据传输对象
│   │   │   ├── AvailableRoomQueryDTO.java
│   │   │   ├── BatchReservationDTO.java
│   │   │   ├── BatchReservationResultDTO.java
│   │   │   ├── ConflictCheckDTO.java
│   │   │   ├── ConflictResultDTO.java
│   │   │   ├── EquipmentDTO.java
│   │   │   ├── EquipmentLockLogQueryDTO.java
│   │   │   ├── EquipmentQueryDTO.java
│   │   │   ├── MeetingRoomDTO.java
│   │   │   ├── MeetingRoomQueryDTO.java
│   │   │   ├── ReservationDTO.java
│   │   │   └── ReservationQueryDTO.java
│   │   ├── entity/                   # 实体类
│   │   │   ├── Equipment.java
│   │   │   ├── EquipmentLockLog.java
│   │   │   ├── MeetingRoom.java
│   │   │   └── Reservation.java
│   │   ├── enums/                    # 枚举类
│   │   │   ├── EquipmentStatus.java
│   │   │   ├── LockType.java
│   │   │   └── ReservationStatus.java
│   │   ├── exception/                # 异常处理
│   │   │   ├── BusinessException.java
│   │   │   └── GlobalExceptionHandler.java
│   │   ├── repository/               # 数据访问层
│   │   │   ├── EquipmentLockLogRepository.java
│   │   │   ├── EquipmentRepository.java
│   │   │   ├── MeetingRoomRepository.java
│   │   │   └── ReservationRepository.java
│   │   ├── service/                  # 业务逻辑层
│   │   │   ├── EquipmentLockLogService.java
│   │   │   ├── EquipmentService.java
│   │   │   ├── MeetingRoomService.java
│   │   │   ├── ReservationService.java
│   │   │   └── impl/
│   │   ├── task/                     # 定时任务
│   │   │   └── ReservationTask.java
│   │   └── MeetingRoomAdminApplication.java
│   ├── src/main/resources/
│   │   ├── db/schema.sql             # 数据库初始化脚本
│   │   └── application.yml           # 应用配置
│   └── pom.xml
└── frontend/                         # 前端项目
    ├── src/
    │   ├── api/                      # API接口
    │   ├── assets/styles/            # 样式文件
    │   ├── layout/                   # 布局组件
    │   ├── router/                   # 路由配置
    │   ├── stores/                   # 状态管理
    │   ├── utils/                    # 工具函数
    │   ├── views/                    # 页面组件
    │   ├── App.vue
    │   └── main.js
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## 核心功能

### 1. 会议室管理
- 会议室增删改查
- 会议室编号、名称、容纳人数、位置、开放时间、周末开放配置
- 查询某个时间段空闲的会议室
- 查看会议室绑定的设备

### 2. 设备管理
- 设备增删改查
- 设备绑定/解绑会议室
- 设备类型：投影仪、音响、麦克风、白板、视频会议等
- 流动设备（不绑定到具体会议室）
- 强制解锁已锁定设备
- 设备锁定状态管理

### 3. 预定管理
- 预定增删改查
- **预定冲突检测**：检查时间段内会议室是否已被预定，显示冲突详情
- **会议室开放时间检查**：预定前检查会议室是否在开放时间内，周末是否开放
- **事务保证**：预定创建和设备锁定在同一事务中，一起成功或一起失败
- **设备自动锁定**：预定成功后，会议室关联的设备自动锁定
- **自动解锁**：预定取消/删除/完成后，设备自动解锁
- 预定冲突时返回冲突的预定信息

### 4. 批量预定
- 一次预定多个会议室
- 支持按天、周、工作日重复
- 可设置结束日期
- 生成预定列表后可逐条编辑
- 批量提交，返回成功/失败详情

### 5. 设备锁定日志
- 记录所有设备锁定/解锁操作
- 记录操作人、操作时间、操作IP
- 记录锁定时间段
- 支持按设备、预定、时间范围查询

### 6. 定时任务
- 每5分钟检查已结束的预定
- 自动将已结束的预定标记为"已完成"
- 自动解锁关联设备

## 数据库表结构

### meeting_room (会议室表)
- id, room_number, room_name, capacity, location
- open_time, close_time, weekend_available
- description, status, created_at, updated_at

### equipment (设备表)
- id, equipment_code, equipment_name, equipment_type
- room_id, status, locked, description
- created_at, updated_at

### reservation (预定表)
- id, room_id, room_number, room_name
- start_time, end_time, reserver_name, reserver_phone
- meeting_topic, participants, status
- created_at, updated_at
- 索引：idx_room_time(room_id, start_time, end_time)

### equipment_lock_log (设备锁定日志表)
- id, equipment_id, equipment_code, equipment_name
- reservation_id, room_id, lock_type
- operator, operator_ip, start_time, end_time
- created_at

## 快速开始

### 数据库配置

1. 创建数据库
```sql
CREATE DATABASE example_db DEFAULT CHARACTER SET utf8mb4;
```

2. 执行初始化脚本
```bash
mysql -u root -p example_db < backend/src/main/resources/db/schema.sql
```

3. 修改数据库配置
编辑 `backend/src/main/resources/application.yml`:
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/example_db?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
    username: your_username
    password: your_password
```

### 后端启动

```bash
cd backend
mvn clean compile
mvn spring-boot:run
```

后端服务启动在 `http://localhost:8080`

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端服务启动在 `http://localhost:3000`

## API 接口文档

### 会议室接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/meeting-rooms/list | 分页查询会议室 |
| GET | /api/meeting-rooms/all | 获取所有启用的会议室 |
| GET | /api/meeting-rooms/{id} | 获取会议室详情 |
| POST | /api/meeting-rooms | 新增会议室 |
| PUT | /api/meeting-rooms/{id} | 更新会议室 |
| DELETE | /api/meeting-rooms/{id} | 删除会议室 |
| GET | /api/meeting-rooms/available | 查询空闲会议室 |
| POST | /api/meeting-rooms/available/filter | 带过滤条件查询空闲会议室 |

### 设备接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/equipment/list | 分页查询设备 |
| GET | /api/equipment/{id} | 获取设备详情 |
| POST | /api/equipment | 新增设备 |
| PUT | /api/equipment/{id} | 更新设备 |
| DELETE | /api/equipment/{id} | 删除设备 |
| POST | /api/equipment/{equipmentId}/bind/{roomId} | 绑定设备到会议室 |
| POST | /api/equipment/{equipmentId}/unbind | 解绑设备 |
| GET | /api/equipment/room/{roomId} | 查询会议室的设备 |
| GET | /api/equipment/unbound | 查询未绑定的设备 |
| POST | /api/equipment/{equipmentId}/force-unlock | 强制解锁设备 |

### 预定接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reservations/list | 分页查询预定 |
| GET | /api/reservations/{id} | 获取预定详情 |
| POST | /api/reservations | 创建预定 |
| PUT | /api/reservations/{id} | 更新预定 |
| DELETE | /api/reservations/{id} | 删除预定 |
| POST | /api/reservations/check-conflict | 检测预定冲突 |
| POST | /api/reservations/{id}/cancel | 取消预定 |
| POST | /api/reservations/batch | 批量预定 |

### 锁定日志接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/equipment-lock-logs/list | 分页查询锁定日志 |
| GET | /api/equipment-lock-logs/equipment/{equipmentId} | 查询设备的锁定日志 |
| GET | /api/equipment-lock-logs/reservation/{reservationId} | 查询预定的锁定日志 |

## 关键设计要点

### 1. 事务保证
预定创建使用 `@Transactional(rollbackFor = Exception.class)` 注解，确保：
- 预定记录创建失败 → 整体回滚
- 设备锁定失败 → 预定记录回滚
- 任何异常 → 全部操作回滚

### 2. 冲突检测逻辑
```sql
-- 查询冲突的预定
SELECT r FROM Reservation r 
WHERE r.roomId = :roomId 
  AND r.status IN (0, 1)  -- 待确认或已确认
  AND r.startTime < :endTime 
  AND r.endTime > :startTime
```

### 3. 开放时间检查
- 检查是否为周末，周末是否开放
- 检查预定时间是否在会议室的开放时间范围内
- 检查预定不能跨天

### 4. 设备锁定机制
- 预定创建 → 锁定会议室关联的所有设备
- 预定更新 → 先解锁旧会议室设备，再锁定新会议室设备
- 预定取消/删除 → 解锁关联设备
- 预定超时 → 定时任务自动解锁
- 强制解锁 → 记录操作日志

### 5. 锁定日志
- 记录每次锁定/解锁操作
- 包含操作人、IP、时间、关联预定
- 支持审计追溯

## 前端页面

1. **首页概览** (`/dashboard`)
   - 统计卡片：会议室总数、设备总数、今日预定、锁定设备数
   - 本周预定统计图表
   - 最新预定列表

2. **会议室管理** (`/meeting-rooms`)
   - 会议室列表、搜索、分页
   - 新增/编辑/删除会议室
   - 查看会议室设备

3. **设备管理** (`/equipment`)
   - 设备列表、搜索、分页
   - 新增/编辑/删除设备
   - 设备绑定/解绑会议室
   - 强制解锁设备

4. **预定管理** (`/reservations`)
   - 预定列表、搜索、分页
   - 新增预定（含冲突检测、可用会议室查询）
   - 批量预定（支持重复周期）
   - 取消/删除预定

5. **锁定日志** (`/lock-logs`)
   - 锁定日志列表、搜索、分页
   - 按设备、预定、时间范围查询

## 注意事项

1. **事务边界**：预定操作必须在同一个事务中，确保数据一致性
2. **并发控制**：使用数据库行级锁防止并发预定冲突
3. **时间处理**：所有时间使用 `LocalDateTime`，数据库时区设置为 Asia/Shanghai
4. **删除保护**：已锁定的设备不能删除或编辑
5. **开放时间**：预定时间必须在会议室开放时间内，周末预定需要会议室支持
6. **跨天预定**：系统不支持跨天预定，必须在同一天内完成

## 开发说明

- 后端代码已通过编译验证 (`mvn clean compile` 成功)
- 数据库脚本包含测试数据，可直接使用
- 前端使用 Vue 3 Composition API
- 前后端分离，通过 RESTful API 交互
- 支持 CORS 跨域访问
