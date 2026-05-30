package com.ordersystem.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderAddress {

    private String province;
    private String city;
    private String district;
    private String detailAddress;
    private String receiverName;
    private String receiverPhone;
}
