package com.ecommerce.inventory.entity;

import com.ecommerce.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "inventories")
public class Inventory extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long skuId;

    @Column(nullable = false)
    private Integer totalStock = 0;

    @Column(nullable = false)
    private Integer lockedStock = 0;

    @Column(nullable = false)
    private Integer availableStock = 0;

    public Integer getAvailableStock() {
        return totalStock - lockedStock;
    }

    public void setStock(Integer totalStock) {
        this.totalStock = totalStock;
        this.availableStock = totalStock - this.lockedStock;
    }

    public void lockStock(Integer quantity) {
        if (getAvailableStock() < quantity) {
            throw new IllegalStateException("Insufficient available stock. Available: " + getAvailableStock() + ", Required: " + quantity);
        }
        this.lockedStock += quantity;
        this.availableStock = getAvailableStock();
    }

    public void deductStock(Integer quantity) {
        if (this.lockedStock < quantity) {
            throw new IllegalStateException("Insufficient locked stock to deduct. Locked: " + this.lockedStock + ", Required: " + quantity);
        }
        this.lockedStock -= quantity;
        this.totalStock -= quantity;
        this.availableStock = getAvailableStock();
    }

    public void rollbackStock(Integer quantity) {
        if (this.lockedStock < quantity) {
            throw new IllegalStateException("Insufficient locked stock to rollback. Locked: " + this.lockedStock + ", Required: " + quantity);
        }
        this.lockedStock -= quantity;
        this.availableStock = getAvailableStock();
    }
}
