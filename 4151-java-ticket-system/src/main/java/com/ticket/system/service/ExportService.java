package com.ticket.system.service;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.annotation.ExcelProperty;
import com.alibaba.excel.annotation.write.style.ColumnWidth;
import com.ticket.system.entity.Ticket;
import com.ticket.system.repository.TicketRepository;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final TicketRepository ticketRepository;

    public byte[] exportTicketsToExcel(List<Long> ticketIds) throws IOException {
        List<Ticket> tickets;
        if (ticketIds == null || ticketIds.isEmpty()) {
            tickets = ticketRepository.findAll();
        } else {
            tickets = ticketRepository.findAllById(ticketIds);
        }

        List<TicketExportDTO> exportData = tickets.stream()
                .map(this::convertToExportDTO)
                .toList();

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        EasyExcel.write(outputStream, TicketExportDTO.class)
                .sheet("Tickets")
                .doWrite(exportData);

        log.info("Exported {} tickets to Excel", exportData.size());
        return outputStream.toByteArray();
    }

    public byte[] exportTicketsByDateRange(LocalDateTime start, LocalDateTime end) throws IOException {
        List<Ticket> tickets = ticketRepository.findByStatusInAndCreatedAtBetween(
                List.of(Ticket.TicketStatus.values()), start, end);

        List<TicketExportDTO> exportData = tickets.stream()
                .map(this::convertToExportDTO)
                .toList();

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        EasyExcel.write(outputStream, TicketExportDTO.class)
                .sheet("Tickets")
                .doWrite(exportData);

        log.info("Exported {} tickets to Excel for date range {} - {}", 
                exportData.size(), start, end);
        return outputStream.toByteArray();
    }

    private TicketExportDTO convertToExportDTO(Ticket ticket) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        
        return TicketExportDTO.builder()
                .ticketNo(ticket.getTicketNo())
                .title(ticket.getTitle())
                .status(ticket.getStatus() != null ? ticket.getStatus().name() : "")
                .priority(ticket.getPriority() != null ? ticket.getPriority().name() : "")
                .source(ticket.getSource() != null ? ticket.getSource().name() : "")
                .categoryId(ticket.getCategoryId())
                .requesterId(ticket.getRequesterId())
                .assigneeId(ticket.getAssigneeId())
                .createdAt(ticket.getCreatedAt() != null ? ticket.getCreatedAt().format(formatter) : "")
                .closedAt(ticket.getClosedAt() != null ? ticket.getClosedAt().format(formatter) : "")
                .slaBreached(ticket.getResponseDueAt() != null && 
                        ticket.getFirstResponseAt() != null && 
                        ticket.getFirstResponseAt().isAfter(ticket.getResponseDueAt()))
                .satisfactionScore(ticket.getSatisfactionScore())
                .build();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TicketExportDTO {

        @ExcelProperty("工单号")
        @ColumnWidth(20)
        private String ticketNo;

        @ExcelProperty("标题")
        @ColumnWidth(30)
        private String title;

        @ExcelProperty("状态")
        @ColumnWidth(15)
        private String status;

        @ExcelProperty("优先级")
        @ColumnWidth(10)
        private String priority;

        @ExcelProperty("来源")
        @ColumnWidth(15)
        private String source;

        @ExcelProperty("分类ID")
        @ColumnWidth(10)
        private Long categoryId;

        @ExcelProperty("请求人ID")
        @ColumnWidth(12)
        private Long requesterId;

        @ExcelProperty("处理人ID")
        @ColumnWidth(12)
        private Long assigneeId;

        @ExcelProperty("创建时间")
        @ColumnWidth(20)
        private String createdAt;

        @ExcelProperty("关闭时间")
        @ColumnWidth(20)
        private String closedAt;

        @ExcelProperty("SLA是否超时")
        @ColumnWidth(15)
        private Boolean slaBreached;

        @ExcelProperty("满意度评分")
        @ColumnWidth(15)
        private Integer satisfactionScore;
    }
}
