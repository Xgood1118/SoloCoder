package com.ecommerce.product.entity;

import com.ecommerce.common.BaseEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "skus")
public class Sku extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, length = 100)
    private String skuCode;

    @Column(length = 500)
    private String attributes;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(precision = 10, scale = 2)
    private BigDecimal costPrice;

    @OneToMany(mappedBy = "sku", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TieredPrice> tieredPrices = new ArrayList<>();

    public void addTieredPrice(TieredPrice tieredPrice) {
        tieredPrices.add(tieredPrice);
        tieredPrice.setSku(this);
    }
}
