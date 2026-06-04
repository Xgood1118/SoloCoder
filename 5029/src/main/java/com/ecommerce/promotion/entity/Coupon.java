package com.ecommerce.promotion.entity;

import com.ecommerce.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "coupons")
public class Coupon extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(precision = 12, scale = 2)
    private BigDecimal thresholdAmount;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal deductionAmount;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Column(nullable = false)
    private Integer totalQuantity;

    @Column(nullable = false)
    private Integer usedQuantity = 0;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(length = 1000)
    private String applicableProductIds;

    public boolean isValid() {
        LocalDateTime now = LocalDateTime.now();
        return active
                && !now.isBefore(startTime)
                && !now.isAfter(endTime)
                && usedQuantity < totalQuantity;
    }
}
