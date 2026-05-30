package com.ordersystem.query.model;

import lombok.Data;

@Data
public class OrderAddressVO {

    private String province;
    private String city;
    private String district;
    private String detailAddress;
    private String receiverName;
    private String receiverPhone;
}
