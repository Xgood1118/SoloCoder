package com.ordersystem.query.repository;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ordersystem.common.result.PageResult;
import com.ordersystem.query.model.OrderDetailVO;
import com.ordersystem.query.model.OrderQueryCondition;
import com.ordersystem.query.model.OrderStatusHistory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class OrderQueryRepositoryImpl implements OrderQueryRepository {

    private final OrderQueryMapper orderQueryMapper;

    @Override
    public PageResult<OrderDetailVO> findByCondition(OrderQueryCondition condition) {
        Page<OrderDetailVO> page = new Page<>(condition.getPage(), condition.getSize());
        IPage<OrderDetailVO> result = orderQueryMapper.findByCondition(page, condition);
        return PageResult.of(
                result.getRecords(),
                result.getTotal(),
                (int) result.getCurrent(),
                (int) result.getSize()
        );
    }

    @Override
    public OrderDetailVO findDetailByOrderNo(String orderNo) {
        return orderQueryMapper.findDetailByOrderNo(orderNo);
    }

    @Override
    public List<OrderStatusHistory> findStatusHistory(String orderNo) {
        return orderQueryMapper.findStatusHistory(orderNo);
    }
}
