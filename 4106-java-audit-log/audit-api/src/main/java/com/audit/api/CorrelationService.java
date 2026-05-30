package com.audit.api;

import com.audit.common.dto.QueryRequest;
import com.audit.common.model.AuditLogEntry;
import com.audit.storage.StorageRouter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CorrelationService {

    private final StorageRouter storageRouter;

    public List<AuditLogEntry> getLogsByTraceId(String traceId) {
        QueryRequest request = QueryRequest.builder()
                .traceId(traceId)
                .page(1)
                .size(10000)
                .sortBy("timestamp")
                .sortOrder("asc")
                .build();

        List<AuditLogEntry> logs = storageRouter.query(request).getRecords();
        return logs.stream()
                .sorted(Comparator.comparing(AuditLogEntry::getTimestamp)
                        .thenComparing(AuditLogEntry::getSequenceNumber))
                .collect(Collectors.toList());
    }

    public List<AuditLogEntry> getLogsByResourceId(String resourceType, String resourceId) {
        QueryRequest request = QueryRequest.builder()
                .resourceType(resourceType)
                .resourceId(resourceId)
                .page(1)
                .size(10000)
                .sortBy("timestamp")
                .sortOrder("desc")
                .build();

        return storageRouter.query(request).getRecords();
    }

    public List<AuditLogEntry> getLogsByFieldValue(String fieldName, String fieldValue) {
        QueryRequest.QueryRequestBuilder builder = QueryRequest.builder()
                .page(1)
                .size(10000)
                .sortBy("timestamp")
                .sortOrder("desc");

        switch (fieldName) {
            case "operatorId":
                builder.operatorId(fieldValue);
                break;
            case "operatorName":
                builder.keyword(fieldValue);
                break;
            case "action":
                builder.action(fieldValue);
                break;
            case "resourceType":
                builder.resourceType(fieldValue);
                break;
            case "resourceId":
                builder.resourceId(fieldValue);
                break;
            case "traceId":
                builder.traceId(fieldValue);
                break;
            default:
                builder.keyword(fieldValue);
        }

        return storageRouter.query(builder.build()).getRecords();
    }

    public Map<String, List<AuditLogEntry>> buildCorrelationGraph(String traceId) {
        List<AuditLogEntry> logs = getLogsByTraceId(traceId);
        Map<String, List<AuditLogEntry>> graph = new HashMap<>();

        for (AuditLogEntry entry : logs) {
            String operation = entry.getAction() != null ? entry.getAction() : "unknown";
            graph.computeIfAbsent(operation, k -> new ArrayList<>()).add(entry);
        }

        for (Map.Entry<String, List<AuditLogEntry>> e : graph.entrySet()) {
            e.getValue().sort(Comparator.comparing(AuditLogEntry::getTimestamp)
                    .thenComparing(AuditLogEntry::getSequenceNumber));
        }

        log.debug("Built correlation graph for traceId={}, operations={}", traceId, graph.keySet());
        return graph;
    }
}
