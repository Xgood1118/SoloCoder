package com.ecommerce.order.service;

import com.ecommerce.order.dto.OrderQueryDTO;
import com.ecommerce.order.entity.Order;
import com.ecommerce.order.util.AmountUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExportService {
    private final OrderService orderService;
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public byte[] exportOrdersToCSV(OrderQueryDTO queryDTO) {
        List<Order> orders = orderService.getOrdersForExport(queryDTO);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(baos, StandardCharsets.UTF_8))) {
            writer.println('\ufeff' + "订单号,用户ID,订单状态,商品信息,商品总额(元),优惠金额(元),运费(元),实付金额(元),收货人,联系电话,收货地址,下单时间,支付时间,发货时间,收货时间,状态变更时间");

            for (Order order : orders) {
                StringBuilder sb = new StringBuilder();

                sb.append(escapeCSV(order.getOrderNo())).append(",");
                sb.append(escapeCSV(order.getUserId())).append(",");
                sb.append(escapeCSV(order.getStatus().getDescription())).append(",");

                StringBuilder itemsStr = new StringBuilder();
                for (int i = 0; i < order.getItems().size(); i++) {
                    if (i > 0) itemsStr.append("; ");
                    itemsStr.append(order.getItems().get(i).getProductTitle())
                            .append(" x").append(order.getItems().get(i).getQuantity());
                }
                sb.append(escapeCSV(itemsStr.toString())).append(",");

                sb.append(AmountUtil.fenToYuan(order.getTotalAmount())).append(",");
                sb.append(AmountUtil.fenToYuan(order.getDiscountAmount())).append(",");
                sb.append(AmountUtil.fenToYuan(order.getShippingFee())).append(",");
                sb.append(AmountUtil.fenToYuan(order.getPaidAmount())).append(",");

                sb.append(escapeCSV(order.getAddress() != null ? order.getAddress().getName() : "")).append(",");
                sb.append(escapeCSV(order.getAddress() != null ? order.getAddress().getPhone() : "")).append(",");
                sb.append(escapeCSV(order.getAddress() != null ? order.getAddress().getFullAddress() : "")).append(",");

                sb.append(order.getCreatedAt() != null ? order.getCreatedAt().format(DATE_TIME_FORMATTER) : "").append(",");
                sb.append(order.getPaidAt() != null ? order.getPaidAt().format(DATE_TIME_FORMATTER) : "").append(",");
                sb.append(order.getShippedAt() != null ? order.getShippedAt().format(DATE_TIME_FORMATTER) : "").append(",");
                sb.append(order.getReceivedAt() != null ? order.getReceivedAt().format(DATE_TIME_FORMATTER) : "").append(",");
                sb.append(escapeCSV(buildStatusTimeline(order)));

                writer.println(sb.toString());
            }

            writer.flush();
        }

        return baos.toByteArray();
    }

    private String buildStatusTimeline(Order order) {
        StringBuilder sb = new StringBuilder();
        if (order.getStatusTimestamps() != null) {
            order.getStatusTimestamps().forEach((status, time) -> {
                if (sb.length() > 0) sb.append("; ");
                sb.append(status.getDescription()).append(": ").append(time.format(DATE_TIME_FORMATTER));
            });
        }
        return sb.toString();
    }

    private String escapeCSV(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
