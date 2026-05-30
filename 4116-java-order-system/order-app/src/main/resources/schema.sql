CREATE DATABASE IF NOT EXISTS order_system DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE order_system;

CREATE TABLE IF NOT EXISTS t_order (
    order_id VARCHAR(64) NOT NULL COMMENT '订单ID',
    order_no VARCHAR(64) NOT NULL COMMENT '订单号',
    user_id VARCHAR(64) NOT NULL COMMENT '用户ID',
    merchant_id VARCHAR(64) DEFAULT NULL COMMENT '商家ID',
    order_type VARCHAR(32) NOT NULL COMMENT '订单类型',
    status INT NOT NULL DEFAULT 1 COMMENT '订单状态',
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '总金额',
    pay_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '实付金额',
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
    freight_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '运费',
    remark VARCHAR(512) DEFAULT NULL COMMENT '备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version BIGINT NOT NULL DEFAULT 0 COMMENT '版本号',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    PRIMARY KEY (order_id),
    UNIQUE KEY uk_order_no (order_no),
    KEY idx_user_id (user_id),
    KEY idx_status (status),
    KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

CREATE TABLE IF NOT EXISTS t_order_item (
    item_id VARCHAR(64) NOT NULL COMMENT '明细ID',
    order_id VARCHAR(64) NOT NULL COMMENT '订单ID',
    sku_id VARCHAR(64) NOT NULL COMMENT 'SKU ID',
    sku_name VARCHAR(256) NOT NULL COMMENT 'SKU名称',
    sku_image VARCHAR(512) DEFAULT NULL COMMENT 'SKU图片',
    price DECIMAL(12,2) NOT NULL COMMENT '单价',
    quantity INT NOT NULL COMMENT '数量',
    sub_total_amount DECIMAL(12,2) NOT NULL COMMENT '小计金额',
    PRIMARY KEY (item_id),
    KEY idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';

CREATE TABLE IF NOT EXISTS t_order_address (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id VARCHAR(64) NOT NULL COMMENT '订单ID',
    province VARCHAR(64) DEFAULT NULL COMMENT '省',
    city VARCHAR(64) DEFAULT NULL COMMENT '市',
    district VARCHAR(64) DEFAULT NULL COMMENT '区',
    detail_address VARCHAR(256) NOT NULL COMMENT '详细地址',
    receiver_name VARCHAR(64) NOT NULL COMMENT '收货人',
    receiver_phone VARCHAR(32) NOT NULL COMMENT '收货人电话',
    PRIMARY KEY (id),
    KEY idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单地址表';

CREATE TABLE IF NOT EXISTS t_order_discount (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_id VARCHAR(64) NOT NULL COMMENT '订单ID',
    coupon_id VARCHAR(64) DEFAULT NULL COMMENT '优惠券ID',
    coupon_name VARCHAR(128) DEFAULT NULL COMMENT '优惠券名称',
    coupon_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠券金额',
    point_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '积分抵扣金额',
    promotion_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '活动优惠金额',
    PRIMARY KEY (id),
    KEY idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单优惠表';

CREATE TABLE IF NOT EXISTS t_order_status_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_no VARCHAR(64) NOT NULL COMMENT '订单号',
    from_status INT DEFAULT NULL COMMENT '原状态',
    to_status INT NOT NULL COMMENT '目标状态',
    operator VARCHAR(64) DEFAULT NULL COMMENT '操作人',
    reason VARCHAR(512) DEFAULT NULL COMMENT '操作原因',
    operated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    PRIMARY KEY (id),
    KEY idx_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单状态变更历史表';

CREATE TABLE IF NOT EXISTS inventory (
    id BIGINT NOT NULL AUTO_INCREMENT,
    sku_id BIGINT NOT NULL COMMENT 'SKU ID',
    warehouse_id BIGINT NOT NULL COMMENT '仓库ID',
    available_qty INT NOT NULL DEFAULT 0 COMMENT '可用库存',
    preoccupied_qty INT NOT NULL DEFAULT 0 COMMENT '预占用库存',
    total_qty INT NOT NULL DEFAULT 0 COMMENT '总库存',
    version INT NOT NULL DEFAULT 0 COMMENT '版本号(乐观锁)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_sku_warehouse (sku_id, warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存表';

CREATE TABLE IF NOT EXISTS warehouse (
    warehouse_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '仓库ID',
    warehouse_name VARCHAR(128) NOT NULL COMMENT '仓库名称',
    province VARCHAR(64) DEFAULT NULL COMMENT '省',
    city VARCHAR(64) DEFAULT NULL COMMENT '市',
    district VARCHAR(64) DEFAULT NULL COMMENT '区',
    enabled TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='仓库表';

CREATE TABLE IF NOT EXISTS inventory_snapshot (
    id BIGINT NOT NULL AUTO_INCREMENT,
    sku_id BIGINT NOT NULL COMMENT 'SKU ID',
    warehouse_id BIGINT NOT NULL COMMENT '仓库ID',
    available_qty INT NOT NULL DEFAULT 0 COMMENT '可用库存',
    preoccupied_qty INT NOT NULL DEFAULT 0 COMMENT '预占用库存',
    total_qty INT NOT NULL DEFAULT 0 COMMENT '总库存',
    snapshot_date DATE NOT NULL COMMENT '快照日期',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_snapshot_date (snapshot_date),
    KEY idx_sku_date (sku_id, snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存快照表';

CREATE TABLE IF NOT EXISTS inventory_alert (
    id BIGINT NOT NULL AUTO_INCREMENT,
    sku_id BIGINT NOT NULL COMMENT 'SKU ID',
    warehouse_id BIGINT NOT NULL COMMENT '仓库ID',
    threshold INT NOT NULL DEFAULT 10 COMMENT '预警阈值',
    current_qty INT NOT NULL DEFAULT 0 COMMENT '当前库存',
    alert_level VARCHAR(16) NOT NULL DEFAULT 'WARN' COMMENT '预警级别',
    resolved TINYINT NOT NULL DEFAULT 0 COMMENT '是否已处理',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sku_id (sku_id),
    KEY idx_resolved (resolved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警表';

CREATE TABLE IF NOT EXISTS payment_order (
    payment_id VARCHAR(64) NOT NULL COMMENT '支付ID',
    order_no VARCHAR(64) NOT NULL COMMENT '订单号',
    out_trade_no VARCHAR(128) DEFAULT NULL COMMENT '外部交易号',
    channel VARCHAR(32) NOT NULL COMMENT '支付渠道',
    amount DECIMAL(12,2) NOT NULL COMMENT '支付金额',
    status VARCHAR(32) NOT NULL DEFAULT 'INIT' COMMENT '支付状态',
    pay_url VARCHAR(512) DEFAULT NULL COMMENT '支付链接',
    callback_no VARCHAR(128) DEFAULT NULL COMMENT '回调流水号',
    callback_time DATETIME DEFAULT NULL COMMENT '回调时间',
    expire_time DATETIME DEFAULT NULL COMMENT '过期时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (payment_id),
    KEY idx_order_no (order_no),
    KEY idx_callback_no (callback_no),
    KEY idx_status_expire (status, expire_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付订单表';

CREATE TABLE IF NOT EXISTS payment_record (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_no VARCHAR(64) NOT NULL COMMENT '订单号',
    channel VARCHAR(32) NOT NULL COMMENT '支付渠道',
    amount DECIMAL(12,2) NOT NULL COMMENT '金额',
    status VARCHAR(32) NOT NULL COMMENT '状态',
    trans_date DATE NOT NULL COMMENT '交易日期',
    merchant_id VARCHAR(64) DEFAULT NULL COMMENT '商户ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_trans_date (trans_date),
    KEY idx_merchant_date (merchant_id, trans_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付流水记录表';

CREATE TABLE IF NOT EXISTS refund_order (
    refund_id VARCHAR(64) NOT NULL COMMENT '退款ID',
    order_no VARCHAR(64) NOT NULL COMMENT '订单号',
    order_item_id VARCHAR(64) DEFAULT NULL COMMENT '订单明细ID',
    refund_reason VARCHAR(32) NOT NULL COMMENT '退款原因',
    refund_type VARCHAR(32) NOT NULL COMMENT '退款类型',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT '退款状态',
    original_amount DECIMAL(12,2) NOT NULL COMMENT '原金额',
    refund_amount DECIMAL(12,2) NOT NULL COMMENT '退款金额',
    penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '违约金',
    audit_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED' COMMENT '审核状态',
    auditor VARCHAR(64) DEFAULT NULL COMMENT '审核人',
    audit_remark VARCHAR(512) DEFAULT NULL COMMENT '审核备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (refund_id),
    KEY idx_order_no (order_no),
    KEY idx_status (status),
    KEY idx_audit_status (audit_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='退款订单表';

CREATE TABLE IF NOT EXISTS reconciliation_record (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_no VARCHAR(64) NOT NULL COMMENT '订单号',
    channel VARCHAR(32) NOT NULL COMMENT '支付渠道',
    system_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '系统金额',
    channel_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '渠道金额',
    diff_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '差异金额',
    status VARCHAR(32) NOT NULL COMMENT '对账状态',
    diff_type VARCHAR(32) DEFAULT NULL COMMENT '差异类型',
    reconciled_at DATETIME NOT NULL COMMENT '对账时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_reconciled_at (reconciled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对账记录表';

CREATE TABLE IF NOT EXISTS reconciliation_diff_report (
    id BIGINT NOT NULL AUTO_INCREMENT,
    report_date DATE NOT NULL COMMENT '报告日期',
    total_records INT NOT NULL DEFAULT 0 COMMENT '总记录数',
    matched_records INT NOT NULL DEFAULT 0 COMMENT '匹配记录数',
    mismatch_records INT NOT NULL DEFAULT 0 COMMENT '不匹配记录数',
    system_missing_records INT NOT NULL DEFAULT 0 COMMENT '系统缺失记录数',
    channel_missing_records INT NOT NULL DEFAULT 0 COMMENT '渠道缺失记录数',
    auto_fixed INT NOT NULL DEFAULT 0 COMMENT '自动修复数',
    manual_pending INT NOT NULL DEFAULT 0 COMMENT '待人工处理数',
    status VARCHAR(32) NOT NULL DEFAULT 'GENERATED' COMMENT '报告状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_report_date (report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对账差异报告表';

CREATE TABLE IF NOT EXISTS merchant_bill (
    bill_id VARCHAR(64) NOT NULL COMMENT '账单ID',
    merchant_id VARCHAR(64) NOT NULL COMMENT '商家ID',
    period_start DATE NOT NULL COMMENT '周期开始',
    period_end DATE NOT NULL COMMENT '周期结束',
    order_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '订单金额',
    refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '退款金额',
    commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000 COMMENT '抽成比例',
    commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '抽成金额',
    settlement_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '结算金额',
    status VARCHAR(32) NOT NULL DEFAULT 'GENERATED' COMMENT '账单状态',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME DEFAULT NULL COMMENT '确认时间',
    PRIMARY KEY (bill_id),
    KEY idx_merchant_id (merchant_id),
    KEY idx_period (period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商家账单表';

CREATE TABLE IF NOT EXISTS settlement_order (
    settlement_id VARCHAR(64) NOT NULL COMMENT '结算ID',
    merchant_id VARCHAR(64) NOT NULL COMMENT '商家ID',
    bill_id VARCHAR(64) NOT NULL COMMENT '账单ID',
    amount DECIMAL(12,2) NOT NULL COMMENT '结算金额',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL' COMMENT '结算状态',
    operator VARCHAR(64) DEFAULT NULL COMMENT '操作人',
    operated_at DATETIME DEFAULT NULL COMMENT '操作时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (settlement_id),
    KEY idx_bill_id (bill_id),
    KEY idx_merchant_id (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='结算打款单表';
