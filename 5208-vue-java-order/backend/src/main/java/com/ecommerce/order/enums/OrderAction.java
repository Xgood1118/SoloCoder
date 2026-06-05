package com.ecommerce.order.enums;

public enum OrderAction {
    CREATE("创建订单"),
    PAY("支付"),
    SHIP("发货"),
    CONFIRM("确认收货"),
    REFUND("申请退款"),
    REFUND_APPROVE("退款审核通过"),
    REFUND_REJECT("退款审核驳回"),
    CANCEL("取消订单"),
    AUTO_CONFIRM("自动确认收货"),
    AUTO_CANCEL("自动取消订单"),
    UPDATE_LOGISTICS("更新物流"),
    PARTIAL_REFUND("部分退款");

    private final String description;

    OrderAction(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
