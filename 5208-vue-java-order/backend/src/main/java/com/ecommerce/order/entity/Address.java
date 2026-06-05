package com.ecommerce.order.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Address {
    private String name;
    private String phone;
    private String province;
    private String city;
    private String district;
    private String detail;

    public String getFullAddress() {
        return province + city + district + detail;
    }
}
