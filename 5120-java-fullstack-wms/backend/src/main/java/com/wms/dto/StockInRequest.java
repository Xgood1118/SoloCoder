package com.wms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class StockInRequest {
    @NotBlank(message = "商品名称不能为空")
    private String productName;

    private String productCode;

    @NotNull(message = "数量不能为空")
    @Positive(message = "数量必须大于0")
    private Integer quantity;

    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    private LocalDate productionDate;

    private LocalDate expiryDate;

    private String supplier;

    @NotNull(message = "仓库ID不能为空")
    private Long warehouseId;

    private String productUnit;

    private Integer warningThreshold;

    private String remark;

    private LocalDateTime inTime;
}
