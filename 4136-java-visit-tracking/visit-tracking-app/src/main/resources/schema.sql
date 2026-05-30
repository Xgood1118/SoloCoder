CREATE DATABASE IF NOT EXISTS visit_tracking
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE visit_tracking;

CREATE TABLE IF NOT EXISTS sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(64),
    fingerprint_id VARCHAR(36),
    status VARCHAR(20) NOT NULL,
    current_page_url VARCHAR(2048),
    referrer VARCHAR(2048),
    created_at DATETIME NOT NULL,
    last_active_at DATETIME NOT NULL,
    total_duration BIGINT,
    page_view_count INT,
    expired_at DATETIME,
    UNIQUE KEY uk_session_id (session_id),
    KEY idx_fingerprint_id (fingerprint_id),
    KEY idx_user_id (user_id),
    KEY idx_status (status),
    KEY idx_created_at (created_at),
    KEY idx_last_active_at (last_active_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visit_events (
    id BIGINT AUTO_INCREMENT,
    event_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    fingerprint_id VARCHAR(36),
    user_id VARCHAR(64),
    page_url VARCHAR(2048) NOT NULL,
    referrer VARCHAR(2048),
    viewport_size VARCHAR(32),
    status VARCHAR(20) NOT NULL,
    timestamp DATETIME,
    server_timestamp DATETIME,
    created_at DATETIME,
    PRIMARY KEY (id, created_at),
    UNIQUE KEY uk_event_id (event_id),
    KEY idx_session_id (session_id),
    KEY idx_fingerprint_id (fingerprint_id),
    KEY idx_page_url (page_url(255)),
    KEY idx_timestamp (timestamp),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (TO_DAYS(created_at)) (
    PARTITION p_2025_01 VALUES LESS THAN (TO_DAYS('2025-02-01')),
    PARTITION p_2025_02 VALUES LESS THAN (TO_DAYS('2025-03-01')),
    PARTITION p_2025_03 VALUES LESS THAN (TO_DAYS('2025-04-01')),
    PARTITION p_2025_04 VALUES LESS THAN (TO_DAYS('2025-05-01')),
    PARTITION p_2025_05 VALUES LESS THAN (TO_DAYS('2025-06-01')),
    PARTITION p_2025_06 VALUES LESS THAN (TO_DAYS('2025-07-01')),
    PARTITION p_2025_07 VALUES LESS THAN (TO_DAYS('2025-08-01')),
    PARTITION p_2025_08 VALUES LESS THAN (TO_DAYS('2025-09-01')),
    PARTITION p_2025_09 VALUES LESS THAN (TO_DAYS('2025-10-01')),
    PARTITION p_2025_10 VALUES LESS THAN (TO_DAYS('2025-11-01')),
    PARTITION p_2025_11 VALUES LESS THAN (TO_DAYS('2025-12-01')),
    PARTITION p_2025_12 VALUES LESS THAN (TO_DAYS('2026-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

CREATE TABLE IF NOT EXISTS heartbeat_events (
    id BIGINT AUTO_INCREMENT,
    event_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    page_url VARCHAR(2048) NOT NULL,
    timestamp DATETIME,
    server_timestamp DATETIME,
    created_at DATETIME,
    PRIMARY KEY (id, created_at),
    UNIQUE KEY uk_event_id (event_id),
    KEY idx_session_id (session_id),
    KEY idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (TO_DAYS(created_at)) (
    PARTITION p_2025_01 VALUES LESS THAN (TO_DAYS('2025-02-01')),
    PARTITION p_2025_02 VALUES LESS THAN (TO_DAYS('2025-03-01')),
    PARTITION p_2025_03 VALUES LESS THAN (TO_DAYS('2025-04-01')),
    PARTITION p_2025_04 VALUES LESS THAN (TO_DAYS('2025-05-01')),
    PARTITION p_2025_05 VALUES LESS THAN (TO_DAYS('2025-06-01')),
    PARTITION p_2025_06 VALUES LESS THAN (TO_DAYS('2025-07-01')),
    PARTITION p_2025_07 VALUES LESS THAN (TO_DAYS('2025-08-01')),
    PARTITION p_2025_08 VALUES LESS THAN (TO_DAYS('2025-09-01')),
    PARTITION p_2025_09 VALUES LESS THAN (TO_DAYS('2025-10-01')),
    PARTITION p_2025_10 VALUES LESS THAN (TO_DAYS('2025-11-01')),
    PARTITION p_2025_11 VALUES LESS THAN (TO_DAYS('2025-12-01')),
    PARTITION p_2025_12 VALUES LESS THAN (TO_DAYS('2026-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

CREATE TABLE IF NOT EXISTS click_events (
    id BIGINT AUTO_INCREMENT,
    event_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    fingerprint_id VARCHAR(36),
    user_id VARCHAR(64),
    page_url VARCHAR(2048) NOT NULL,
    element_id VARCHAR(128),
    relative_x DOUBLE NOT NULL,
    relative_y DOUBLE NOT NULL,
    viewport_width INT,
    viewport_height INT,
    status VARCHAR(20) NOT NULL,
    timestamp DATETIME,
    server_timestamp DATETIME,
    created_at DATETIME,
    PRIMARY KEY (id, created_at),
    UNIQUE KEY uk_event_id (event_id),
    KEY idx_session_id (session_id),
    KEY idx_fingerprint_id (fingerprint_id),
    KEY idx_page_url (page_url(255)),
    KEY idx_timestamp (timestamp),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (TO_DAYS(created_at)) (
    PARTITION p_2025_01 VALUES LESS THAN (TO_DAYS('2025-02-01')),
    PARTITION p_2025_02 VALUES LESS THAN (TO_DAYS('2025-03-01')),
    PARTITION p_2025_03 VALUES LESS THAN (TO_DAYS('2025-04-01')),
    PARTITION p_2025_04 VALUES LESS THAN (TO_DAYS('2025-05-01')),
    PARTITION p_2025_05 VALUES LESS THAN (TO_DAYS('2025-06-01')),
    PARTITION p_2025_06 VALUES LESS THAN (TO_DAYS('2025-07-01')),
    PARTITION p_2025_07 VALUES LESS THAN (TO_DAYS('2025-08-01')),
    PARTITION p_2025_08 VALUES LESS THAN (TO_DAYS('2025-09-01')),
    PARTITION p_2025_09 VALUES LESS THAN (TO_DAYS('2025-10-01')),
    PARTITION p_2025_10 VALUES LESS THAN (TO_DAYS('2025-11-01')),
    PARTITION p_2025_11 VALUES LESS THAN (TO_DAYS('2025-12-01')),
    PARTITION p_2025_12 VALUES LESS THAN (TO_DAYS('2026-01-01')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

CREATE TABLE IF NOT EXISTS user_fingerprints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    fingerprint_id VARCHAR(36) NOT NULL,
    fingerprint_hash VARCHAR(64) NOT NULL,
    user_id VARCHAR(64),
    user_agent VARCHAR(512),
    screen_resolution VARCHAR(32),
    timezone VARCHAR(64),
    language VARCHAR(32),
    installed_fonts TEXT,
    confidence DOUBLE DEFAULT 1.0,
    status VARCHAR(20) NOT NULL,
    merged_into_id VARCHAR(36),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_fingerprint_id (fingerprint_id),
    UNIQUE KEY uk_fingerprint_hash (fingerprint_hash),
    KEY idx_user_id (user_id),
    KEY idx_status (status),
    KEY idx_fingerprint_hash (fingerprint_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
