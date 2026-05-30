package com.ordersystem.query.service;

import cn.hutool.crypto.digest.DigestUtil;
import com.ordersystem.common.result.PageResult;
import com.ordersystem.query.cache.OrderCacheManager;
import com.ordersystem.query.model.OrderDetailVO;
import com.ordersystem.query.model.OrderQueryCondition;
import com.ordersystem.query.model.OrderStatusHistory;
import com.ordersystem.query.repository.OrderQueryRepository;
import com.ordersystem.query.repository.OrderStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderQueryService {

    private final OrderQueryRepository orderQueryRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final OrderCacheManager orderCacheManager;

    public PageResult<OrderDetailVO> queryOrders(OrderQueryCondition condition) {
        String cacheKey = buildCacheKey(condition);
        PageResult<OrderDetailVO> cached = orderCacheManager.getOrderList(cacheKey);
        if (cached != null) {
            return cached;
        }
        PageResult<OrderDetailVO> result = orderQueryRepository.findByCondition(condition);
        orderCacheManager.cacheOrderList(cacheKey, result);
        return result;
    }

    public OrderDetailVO getOrderDetail(String orderNo) {
        OrderDetailVO cached = orderCacheManager.getOrderDetail(orderNo);
        if (cached != null) {
            return cached;
        }
        OrderDetailVO detail = orderQueryRepository.findDetailByOrderNo(orderNo);
        if (detail != null) {
            orderCacheManager.cacheOrderDetail(detail);
        }
        return detail;
    }

    public List<OrderStatusHistory> getStatusHistory(String orderNo) {
        return orderQueryRepository.findStatusHistory(orderNo);
    }

    public void saveStatusHistory(OrderStatusHistory history) {
        orderStatusHistoryRepository.save(history);
    }

    private String buildCacheKey(OrderQueryCondition condition) {
        String raw = condition.getUserId() + ":"
                + condition.getOrderNo() + ":"
                + condition.getSkuName() + ":"
                + condition.getReceiverName() + ":"
                + condition.getStatus() + ":"
                + condition.getStartTime() + ":"
                + condition.getEndTime() + ":"
                + condition.getPage() + ":"
                + condition.getSize();
        return DigestUtil.md5Hex(raw);
    }
}
