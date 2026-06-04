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
@Table(name = "promotions")
public class Promotion extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private PromotionType type;

    @Column(nullable = false)
    private Integer priority;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Column(precision = 12, scale = 2)
    private BigDecimal thresholdAmount;

    @Column(precision = 12, scale = 2)
    private BigDecimal reductionAmount;

    @Column(precision = 5, scale = 2)
    private BigDecimal discountRate;

    @Column
    private Integer giftQuantity;

    @Column(length = 1000)
    private String applicableProductIds;

    @Column(length = 500)
    private String description;

    public boolean isCurrentlyActive() {
        LocalDateTime now = LocalDateTime.now();
        return active && !now.isBefore(startTime) && !now.isAfter(endTime);
    }
}
