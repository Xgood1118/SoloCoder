package com.ecommerce.inventory.repository;

import com.ecommerce.inventory.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    Optional<Inventory> findBySkuId(Long skuId);

    @Modifying
    @Query("UPDATE Inventory i SET i.lockedStock = i.lockedStock + :quantity, i.availableStock = i.totalStock - i.lockedStock - :quantity WHERE i.skuId = :skuId AND (i.totalStock - i.lockedStock) >= :quantity")
    int lockStock(@Param("skuId") Long skuId, @Param("quantity") Integer quantity);

    @Modifying
    @Query("UPDATE Inventory i SET i.lockedStock = i.lockedStock - :quantity, i.totalStock = i.totalStock - :quantity, i.availableStock = i.totalStock - :quantity - i.lockedStock + :quantity WHERE i.skuId = :skuId AND i.lockedStock >= :quantity")
    int deductStock(@Param("skuId") Long skuId, @Param("quantity") Integer quantity);

    @Modifying
    @Query("UPDATE Inventory i SET i.lockedStock = i.lockedStock - :quantity, i.availableStock = i.totalStock - i.lockedStock + :quantity WHERE i.skuId = :skuId AND i.lockedStock >= :quantity")
    int rollbackStock(@Param("skuId") Long skuId, @Param("quantity") Integer quantity);

    @Modifying
    @Query("UPDATE Inventory i SET i.totalStock = i.totalStock + :quantity, i.availableStock = i.totalStock + :quantity - i.lockedStock WHERE i.skuId = :skuId")
    int returnStock(@Param("skuId") Long skuId, @Param("quantity") Integer quantity);
}
