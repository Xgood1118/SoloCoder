package com.ordersystem.query.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ordersystem.query.model.OrderDetailVO;
import com.ordersystem.query.model.OrderQueryCondition;
import com.ordersystem.query.model.OrderStatusHistory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface OrderQueryMapper extends BaseMapper<OrderDetailVO> {

    IPage<OrderDetailVO> findByCondition(Page<OrderDetailVO> page, @Param("condition") OrderQueryCondition condition);

    OrderDetailVO findDetailByOrderNo(@Param("orderNo") String orderNo);

    List<OrderStatusHistory> findStatusHistory(@Param("orderNo") String orderNo);

    void insertStatusHistory(OrderStatusHistory history);
}
