package com.ecommerce.product.entity;

import com.ecommerce.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "products")
public class Product extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 2000)
    private String description;

    @Column(length = 50)
    private String category;

    @Column(length = 500)
    private String imageUrl;

    @Column(nullable = false)
    private Boolean onSale = true;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Sku> skus = new ArrayList<>();

    public void addSku(Sku sku) {
        skus.add(sku);
        sku.setProduct(this);
    }

    public void removeSku(Sku sku) {
        skus.remove(sku);
        sku.setProduct(null);
    }
}
