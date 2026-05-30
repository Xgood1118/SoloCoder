package com.ordersystem.refund.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ordersystem.refund.model.AuditStatus;
import com.ordersystem.refund.model.RefundOrder;
import com.ordersystem.refund.model.RefundStatus;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface RefundOrderRepository extends BaseMapper<RefundOrder> {

    default RefundOrder findByRefundId(String refundId) {
        return selectById(refundId);
    }

    default List<RefundOrder> findByOrderNo(String orderNo) {
        return selectList(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RefundOrder>()
                .eq(RefundOrder::getOrderNo, orderNo));
    }

    default List<RefundOrder> findByStatus(RefundStatus status) {
        return selectList(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RefundOrder>()
                .eq(RefundOrder::getStatus, status));
    }

    default List<RefundOrder> findPendingAudit() {
        return selectList(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RefundOrder>()
                .eq(RefundOrder::getAuditStatus, AuditStatus.PENDING_AUDIT));
    }
}
