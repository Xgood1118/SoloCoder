package com.wms.service;

import com.wms.dto.InventoryDTO;
import com.wms.entity.Inventory;
import com.wms.entity.Product;
import com.wms.entity.StockRecord;
import com.wms.entity.Warehouse;
import com.wms.repository.InventoryRepository;
import com.wms.repository.ProductRepository;
import com.wms.repository.StockRecordRepository;
import com.wms.repository.WarehouseRepository;
import com.wms.security.SecurityUtil;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ExportService {

    private static final int PAGE_SIZE = 10000;

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private StockRecordRepository stockRecordRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private SecurityUtil securityUtil;

    public byte[] exportInventoryToExcel(String productName, Long warehouseId) throws IOException {
        Long userWarehouseId = securityUtil.getCurrentUserWarehouseId();
        boolean isAdmin = securityUtil.isCurrentUserAdmin();

        if (!isAdmin && userWarehouseId != null) {
            warehouseId = userWarehouseId;
        }

        if (warehouseId != null) {
            securityUtil.checkWarehouseAccess(warehouseId);
        }

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("库存数据");
            createHeaderRow(sheet, new String[]{"商品名称", "商品编码", "当前库存", "单位", "库存警戒线", "仓库名称", "最近入库时间", "最近出库时间", "最后更新时间"});

            int pageNum = 0;
            int rowNum = 1;
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

            while (true) {
                Page<Inventory> page;
                PageRequest pageRequest = PageRequest.of(pageNum, PAGE_SIZE);

                if (warehouseId != null) {
                    if (productName != null && !productName.isEmpty()) {
                        page = inventoryRepository.findByWarehouseIdAndProductNameContaining(warehouseId, productName, pageRequest);
                    } else {
                        page = inventoryRepository.findByWarehouseId(warehouseId).stream()
                                .skip((long) pageNum * PAGE_SIZE)
                                .limit(PAGE_SIZE)
                                .collect(java.util.stream.Collectors.collectingAndThen(
                                        java.util.stream.Collectors.toList(),
                                        list -> new org.springframework.data.domain.PageImpl<>(list, pageRequest, list.size())
                                ));
                        page = inventoryRepository.findByWarehouseIdAndProductNameContaining(warehouseId, "", pageRequest);
                    }
                } else {
                    if (productName != null && !productName.isEmpty()) {
                        page = inventoryRepository.findByProductNameContaining(productName, pageRequest);
                    } else {
                        page = inventoryRepository.findAll(pageRequest);
                    }
                }

                if (page.isEmpty()) {
                    break;
                }

                for (Inventory inventory : page.getContent()) {
                    Row row = sheet.createRow(rowNum++);
                    fillInventoryRow(row, inventory, formatter);
                }

                if (!page.hasNext()) {
                    break;
                }
                pageNum++;
            }

            for (int i = 0; i < 9; i++) {
                sheet.autoSizeColumn(i);
            }

            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                workbook.write(out);
                return out.toByteArray();
            }
        }
    }

    public byte[] exportStockRecordsToExcel(LocalDateTime startTime, LocalDateTime endTime, Long warehouseId) throws IOException {
        Long userWarehouseId = securityUtil.getCurrentUserWarehouseId();
        boolean isAdmin = securityUtil.isCurrentUserAdmin();

        if (!isAdmin && userWarehouseId != null) {
            warehouseId = userWarehouseId;
        }

        if (warehouseId != null) {
            securityUtil.checkWarehouseAccess(warehouseId);
        }

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("出入库记录");
            createHeaderRow(sheet, new String[]{"流水号", "类型", "商品名称", "批次号", "仓库名称", "数量", "操作人", "供应商/部门", "领用人", "操作时间", "备注"});

            List<StockRecord> allRecords = new ArrayList<>();

            if (warehouseId != null) {
                allRecords = stockRecordRepository.findByWarehouseIdAndOperationTimeBetweenForExport(warehouseId, startTime, endTime);
            } else {
                allRecords = stockRecordRepository.findByOperationTimeBetweenForExport(startTime, endTime);
            }

            int rowNum = 1;
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

            for (StockRecord record : allRecords) {
                Row row = sheet.createRow(rowNum++);
                fillStockRecordRow(row, record, formatter);
            }

            for (int i = 0; i < 11; i++) {
                sheet.autoSizeColumn(i);
            }

            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                workbook.write(out);
                return out.toByteArray();
            }
        }
    }

    private void createHeaderRow(Sheet sheet, String[] headers) {
        Row headerRow = sheet.createRow(0);
        CellStyle headerStyle = sheet.getWorkbook().createCellStyle();
        Font font = sheet.getWorkbook().createFont();
        font.setBold(true);
        headerStyle.setFont(font);
        headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
    }

    private void fillInventoryRow(Row row, Inventory inventory, DateTimeFormatter formatter) {
        Optional<Product> productOpt = productRepository.findById(inventory.getProductId());
        Optional<Warehouse> warehouseOpt = warehouseRepository.findById(inventory.getWarehouseId());

        row.createCell(0).setCellValue(productOpt.map(Product::getName).orElse(""));
        row.createCell(1).setCellValue(productOpt.map(Product::getCode).orElse(""));
        row.createCell(2).setCellValue(inventory.getTotalQuantity());
        row.createCell(3).setCellValue(productOpt.map(Product::getUnit).orElse(""));
        row.createCell(4).setCellValue(productOpt.map(Product::getWarningThreshold).orElse(0));
        row.createCell(5).setCellValue(warehouseOpt.map(Warehouse::getName).orElse(""));
        row.createCell(6).setCellValue(inventory.getLastInTime() != null ? inventory.getLastInTime().format(formatter) : "");
        row.createCell(7).setCellValue(inventory.getLastOutTime() != null ? inventory.getLastOutTime().format(formatter) : "");
        row.createCell(8).setCellValue(inventory.getUpdatedAt() != null ? inventory.getUpdatedAt().format(formatter) : "");
    }

    private void fillStockRecordRow(Row row, StockRecord record, DateTimeFormatter formatter) {
        Optional<Product> productOpt = productRepository.findById(record.getProductId());
        Optional<Warehouse> warehouseOpt = warehouseRepository.findById(record.getWarehouseId());

        row.createCell(0).setCellValue(record.getRecordNo());
        row.createCell(1).setCellValue("IN".equals(record.getType()) ? "入库" : "出库");
        row.createCell(2).setCellValue(productOpt.map(Product::getName).orElse(""));
        row.createCell(3).setCellValue("");
        row.createCell(4).setCellValue(warehouseOpt.map(Warehouse::getName).orElse(""));
        row.createCell(5).setCellValue(record.getQuantity());
        row.createCell(6).setCellValue(record.getOperatorName());
        row.createCell(7).setCellValue("IN".equals(record.getType()) ?
                (record.getSupplier() != null ? record.getSupplier() : "") :
                (record.getDepartment() != null ? record.getDepartment() : ""));
        row.createCell(8).setCellValue(record.getReceiver() != null ? record.getReceiver() : "");
        row.createCell(9).setCellValue(record.getOperationTime() != null ? record.getOperationTime().format(formatter) : "");
        row.createCell(10).setCellValue(record.getRemark() != null ? record.getRemark() : "");
    }
}
