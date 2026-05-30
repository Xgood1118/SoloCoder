package com.audit.api;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.support.ExcelTypeEnum;
import com.audit.api.dto.ExportAuditLogDTO;
import com.audit.common.model.AuditLogEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExportService {

    private final ZoneId zoneId;

    private static final String CSV_HEADER = "ID,Sequence Number,Trace ID,Timestamp,Operator ID,Operator Name,Operator IP,Operator Terminal,Action,Resource Type,Resource ID,Description,Before Data,After Data,Log Level,Log Type,Result,Error Message,Duration (ms),Tags,Checksum";

    public byte[] exportCsv(List<AuditLogEntry> records) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeCsvToStream(records, out);
        return out.toByteArray();
    }

    public byte[] exportExcel(List<AuditLogEntry> records) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeExcelToStream(records, out);
        return out.toByteArray();
    }

    public void writeCsvToStream(List<AuditLogEntry> records, OutputStream out) {
        try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(out, StandardCharsets.UTF_8))) {
            writer.println('\ufeff' + CSV_HEADER);
            for (AuditLogEntry entry : records) {
                writer.println(toCsvLine(entry));
            }
            writer.flush();
        }
    }

    public void writeExcelToStream(List<AuditLogEntry> records, OutputStream out) {
        List<ExportAuditLogDTO> dtoList = records.stream()
                .map(entry -> ExportAuditLogDTO.from(entry, zoneId))
                .collect(Collectors.toList());

        EasyExcel.write(out, ExportAuditLogDTO.class)
                .excelType(ExcelTypeEnum.XLSX)
                .sheet("Audit Logs")
                .doWrite(dtoList);
    }

    private String toCsvLine(AuditLogEntry entry) {
        ExportAuditLogDTO dto = ExportAuditLogDTO.from(entry, zoneId);
        return String.join(",",
                escapeCsv(dto.getId()),
                escapeCsv(String.valueOf(dto.getSequenceNumber())),
                escapeCsv(dto.getTraceId()),
                escapeCsv(dto.getTimestamp()),
                escapeCsv(dto.getOperatorId()),
                escapeCsv(dto.getOperatorName()),
                escapeCsv(dto.getOperatorIp()),
                escapeCsv(dto.getOperatorTerminal()),
                escapeCsv(dto.getAction()),
                escapeCsv(dto.getResourceType()),
                escapeCsv(dto.getResourceId()),
                escapeCsv(dto.getDescription()),
                escapeCsv(dto.getBeforeData()),
                escapeCsv(dto.getAfterData()),
                escapeCsv(dto.getLogLevel()),
                escapeCsv(dto.getLogType()),
                escapeCsv(dto.getResult()),
                escapeCsv(dto.getErrorMessage()),
                escapeCsv(String.valueOf(dto.getDurationMs())),
                escapeCsv(dto.getTags()),
                escapeCsv(dto.getChecksum())
        );
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
