CREATE DATABASE IF NOT EXISTS example_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE example_db;

DROP TABLE IF EXISTS meeting_room;
CREATE TABLE meeting_room (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    room_number VARCHAR(50) NOT NULL UNIQUE COMMENT '会议室编号',
    room_name VARCHAR(100) NOT NULL COMMENT '会议室名称',
    capacity INT NOT NULL COMMENT '容纳人数',
    location VARCHAR(200) COMMENT '位置',
    open_time TIME COMMENT '开放时间',
    close_time TIME COMMENT '关闭时间',
    weekend_available BOOLEAN NOT NULL DEFAULT FALSE COMMENT '周末是否开放',
    description VARCHAR(500) COMMENT '描述',
    status INT NOT NULL DEFAULT 1 COMMENT '状态：0-停用，1-启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会议室表';

DROP TABLE IF EXISTS equipment;
CREATE TABLE equipment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    equipment_code VARCHAR(50) NOT NULL UNIQUE COMMENT '设备编号',
    equipment_name VARCHAR(100) NOT NULL COMMENT '设备名称',
    equipment_type VARCHAR(50) COMMENT '设备类型',
    room_id BIGINT COMMENT '绑定的会议室ID',
    status INT NOT NULL DEFAULT 1 COMMENT '状态：0-停用，1-正常',
    locked BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否锁定',
    description VARCHAR(500) COMMENT '描述',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备表';

DROP TABLE IF EXISTS reservation;
CREATE TABLE reservation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    room_id BIGINT NOT NULL COMMENT '会议室ID',
    room_number VARCHAR(50) COMMENT '会议室编号',
    room_name VARCHAR(100) COMMENT '会议室名称',
    start_time DATETIME NOT NULL COMMENT '开始时间',
    end_time DATETIME NOT NULL COMMENT '结束时间',
    reserver_name VARCHAR(100) NOT NULL COMMENT '预定人姓名',
    reserver_phone VARCHAR(20) COMMENT '预定人电话',
    meeting_topic VARCHAR(200) COMMENT '会议主题',
    participants INT COMMENT '参会人数',
    status INT NOT NULL DEFAULT 1 COMMENT '状态：0-待确认，1-已确认，2-已取消，3-已完成',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_room_time (room_id, start_time, end_time),
    INDEX idx_time (start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预定表';

DROP TABLE IF EXISTS equipment_lock_log;
CREATE TABLE equipment_lock_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    equipment_id BIGINT NOT NULL COMMENT '设备ID',
    equipment_code VARCHAR(50) COMMENT '设备编号',
    equipment_name VARCHAR(100) COMMENT '设备名称',
    reservation_id BIGINT COMMENT '关联预定ID',
    room_id BIGINT COMMENT '关联会议室ID',
    lock_type VARCHAR(20) NOT NULL COMMENT '锁定类型：LOCK-锁定，UNLOCK-解锁，FORCE_UNLOCK-强制解锁',
    operator VARCHAR(100) NOT NULL COMMENT '操作人',
    operator_ip VARCHAR(50) COMMENT '操作人IP',
    start_time DATETIME COMMENT '锁定开始时间',
    end_time DATETIME COMMENT '锁定结束时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    INDEX idx_equipment (equipment_id),
    INDEX idx_reservation (reservation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备锁定日志表';

INSERT INTO meeting_room (room_number, room_name, capacity, location, open_time, close_time, weekend_available, description, status) VALUES
('R001', '第一会议室', 10, 'A栋3楼301', '09:00:00', '18:00:00', FALSE, '小型会议室，配备投影仪', 1),
('R002', '第二会议室', 20, 'A栋3楼302', '09:00:00', '18:00:00', FALSE, '中型会议室，配备视频会议系统', 1),
('R003', '第三会议室', 50, 'A栋5楼501', '08:00:00', '20:00:00', TRUE, '大型会议室，可容纳50人', 1),
('R004', '培训室', 30, 'B栋2楼201', '09:00:00', '18:00:00', TRUE, '培训专用会议室', 1),
('R005', '洽谈室', 6, 'A栋2楼201', '09:00:00', '18:00:00', FALSE, '小型洽谈室', 1);

INSERT INTO equipment (equipment_code, equipment_name, equipment_type, room_id, status, locked, description) VALUES
('E001', '投影仪A1', '投影仪', 1, 1, FALSE, '爱普生投影仪'),
('E002', '投影仪A2', '投影仪', 2, 1, FALSE, '爱普生投影仪'),
('E003', '投影仪A3', '投影仪', 3, 1, FALSE, '索尼高清投影仪'),
('E004', '音响系统S1', '音响', 1, 1, FALSE, 'BOSE音响系统'),
('E005', '音响系统S2', '音响', 2, 1, FALSE, 'JBL音响系统'),
('E006', '麦克风M1', '麦克风', 1, 1, FALSE, '无线麦克风'),
('E007', '麦克风M2', '麦克风', 2, 1, FALSE, '无线麦克风'),
('E008', '麦克风M3', '麦克风', 3, 1, FALSE, '会议麦克风套装'),
('E009', '视频会议系统V1', '视频会议', 2, 1, FALSE, '宝利通视频会议'),
('E010', '白板B1', '白板', 1, 1, FALSE, '智能白板'),
('E011', '流动投影仪P1', '投影仪', NULL, 1, FALSE, '可流动使用'),
('E012', '流动麦克风M4', '麦克风', NULL, 1, FALSE, '可流动使用');
