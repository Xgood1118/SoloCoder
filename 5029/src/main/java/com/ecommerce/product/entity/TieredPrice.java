package com.ecommerce.product.entity;

import com.ecommerce.common.BaseEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "tiered_prices")
public class TieredPrice extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sku_id", nullable = false)
    private Sku sku;

    @Column(nullable = false)
    private Integer minQuantity;

    @Column(nullable = false)
    private Integer maxQuantity;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;
}
