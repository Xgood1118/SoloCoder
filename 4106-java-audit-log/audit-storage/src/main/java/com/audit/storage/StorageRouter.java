package com.audit.storage;

import com.audit.common.dto.PageResult;
import com.audit.common.dto.QueryRequest;
import com.audit.common.enums.StorageType;
import com.audit.common.exception.StorageUnavailableException;
import com.audit.common.model.AuditLogEntry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class StorageRouter {

    private final Map<StorageType, StorageStrategy> strategyMap;

    public StorageRouter(List<StorageStrategy> strategies) {
        this.strategyMap = new EnumMap<>(StorageType.class);
        for (StorageStrategy strategy : strategies) {
            strategyMap.put(strategy.getType(), strategy);
        }
    }

    public void save(AuditLogEntry entry, StorageType type) {
        StorageStrategy strategy = getStrategy(type);
        strategy.save(entry);
    }

    public PageResult<AuditLogEntry> query(QueryRequest request) {
        StorageType type = request.getStorageType();
        if (type == null) {
            type = resolveDefaultType();
        }
        StorageStrategy strategy = getStrategy(type);
        return strategy.query(request);
    }

    public StorageStrategy getStrategy(StorageType type) {
        StorageStrategy strategy = strategyMap.get(type);
        if (strategy == null) {
            throw new StorageUnavailableException("No storage strategy available for type: " + type);
        }
        return strategy;
    }

    public void saveToAll(AuditLogEntry entry) {
        for (Map.Entry<StorageType, StorageStrategy> e : strategyMap.entrySet()) {
            try {
                e.getValue().save(entry);
            } catch (Exception ex) {
                log.error("Failed to save entry to {}: {}", e.getKey(), ex.getMessage());
            }
        }
    }

    public AuditLogEntry getById(String id) {
        for (StorageStrategy strategy : strategyMap.values()) {
            try {
                AuditLogEntry entry = strategy.getById(id);
                if (entry != null) {
                    return entry;
                }
            } catch (Exception e) {
                log.warn("Failed to get entry by id from {}: {}", strategy.getType(), e.getMessage());
            }
        }
        return null;
    }

    public AuditLogEntry getById(String id, StorageType type) {
        StorageStrategy strategy = getStrategy(type);
        return strategy.getById(id);
    }

    private StorageType resolveDefaultType() {
        if (!strategyMap.isEmpty()) {
            return strategyMap.keySet().iterator().next();
        }
        throw new StorageUnavailableException("No storage strategy available");
    }
}
