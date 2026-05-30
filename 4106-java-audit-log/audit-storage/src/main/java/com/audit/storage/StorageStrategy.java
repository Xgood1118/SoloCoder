package com.audit.storage;

import com.audit.common.dto.PageResult;
import com.audit.common.dto.QueryRequest;
import com.audit.common.enums.StorageType;
import com.audit.common.model.AuditLogEntry;

import java.time.Instant;
import java.util.List;

public interface StorageStrategy {

    void save(AuditLogEntry entry);

    void saveBatch(List<AuditLogEntry> entries);

    PageResult<AuditLogEntry> query(QueryRequest request);

    StorageType getType();

    boolean isHealthy();

    AuditLogEntry getById(String id);

    void deleteByTime(Instant before);

    long count();

    void deleteOldest(long count);

    List<AuditLogEntry> findByTimeBefore(Instant before);
}
