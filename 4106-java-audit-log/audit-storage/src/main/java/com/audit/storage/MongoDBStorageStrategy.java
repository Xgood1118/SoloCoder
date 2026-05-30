package com.audit.storage;

import com.audit.common.dto.PageResult;
import com.audit.common.dto.QueryRequest;
import com.audit.common.enums.StorageType;
import com.audit.common.exception.StorageUnavailableException;
import com.audit.common.model.AuditLogEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "audit.storage.mongodb.enabled", havingValue = "true")
public class MongoDBStorageStrategy implements StorageStrategy {

    private static final String COLLECTION_NAME = "audit_log_entry";
    private static final Pattern REGEX_META_CHARS = Pattern.compile("[\\\\\\[\\]{}()*+?.|^$]");

    private final MongoTemplate mongoTemplate;

    @Override
    public void save(AuditLogEntry entry) {
        try {
            mongoTemplate.save(entry, COLLECTION_NAME);
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to save entry to MongoDB", e);
        }
    }

    @Override
    public void saveBatch(List<AuditLogEntry> entries) {
        try {
            mongoTemplate.insert(entries, COLLECTION_NAME);
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to batch save entries to MongoDB", e);
        }
    }

    @Override
    public PageResult<AuditLogEntry> query(QueryRequest request) {
        try {
            Query query = buildQuery(request);

            long total = mongoTemplate.count(query, AuditLogEntry.class, COLLECTION_NAME);

            int skip = (request.getPage() - 1) * request.getSize();
            query.skip(skip).limit(request.getSize());

            if (request.getSortBy() != null && !request.getSortBy().isBlank()) {
                Sort.Direction direction = "desc".equalsIgnoreCase(request.getSortOrder())
                        ? Sort.Direction.DESC : Sort.Direction.ASC;
                query.with(Sort.by(direction, request.getSortBy()));
            } else {
                query.with(Sort.by(Sort.Direction.DESC, "timestamp"));
            }

            List<AuditLogEntry> records = mongoTemplate.find(query, AuditLogEntry.class, COLLECTION_NAME);

            return PageResult.of(records, total, request.getPage(), request.getSize());
        } catch (StorageUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to query MongoDB", e);
        }
    }

    @Override
    public StorageType getType() {
        return StorageType.MONGODB;
    }

    @Override
    public boolean isHealthy() {
        try {
            mongoTemplate.executeCommand("{ ping: 1 }");
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Query buildQuery(QueryRequest request) {
        Query query = new Query();
        List<Criteria> criteriaList = new ArrayList<>();

        if (request.getOperatorId() != null && !request.getOperatorId().isBlank()) {
            criteriaList.add(Criteria.where("operatorId").is(request.getOperatorId()));
        }
        if (request.getAction() != null && !request.getAction().isBlank()) {
            criteriaList.add(Criteria.where("action").is(request.getAction()));
        }
        if (request.getResourceType() != null && !request.getResourceType().isBlank()) {
            criteriaList.add(Criteria.where("resourceType").is(request.getResourceType()));
        }
        if (request.getResourceId() != null && !request.getResourceId().isBlank()) {
            criteriaList.add(Criteria.where("resourceId").is(request.getResourceId()));
        }
        if (request.getTraceId() != null && !request.getTraceId().isBlank()) {
            criteriaList.add(Criteria.where("traceId").is(request.getTraceId()));
        }
        if (request.getLogLevel() != null) {
            criteriaList.add(Criteria.where("logLevel").is(request.getLogLevel().name()));
        }
        if (request.getLogType() != null) {
            criteriaList.add(Criteria.where("logType").is(request.getLogType().name()));
        }

        if (request.getKeyword() != null && !request.getKeyword().isBlank()) {
            criteriaList.add(new Criteria().orOperator(
                    Criteria.where("description").regex(sanitizeRegex(request.getKeyword()), "i"),
                    Criteria.where("operatorName").regex(sanitizeRegex(request.getKeyword()), "i"),
                    Criteria.where("errorMessage").regex(sanitizeRegex(request.getKeyword()), "i")
            ));
        }

        if (request.getRegexPattern() != null && !request.getRegexPattern().isBlank()) {
            criteriaList.add(Criteria.where("description").regex(sanitizeRegex(request.getRegexPattern())));
        }

        if (request.getStartTime() != null || request.getEndTime() != null) {
            Criteria timestampCriteria = Criteria.where("timestamp");
            if (request.getStartTime() != null) {
                timestampCriteria.gte(request.getStartTime());
            }
            if (request.getEndTime() != null) {
                timestampCriteria.lte(request.getEndTime());
            }
            criteriaList.add(timestampCriteria);
        }

        if (!criteriaList.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteriaList.toArray(new Criteria[0])));
        }

        return query;
    }

    @Override
    public AuditLogEntry getById(String id) {
        try {
            Query query = new Query(Criteria.where("id").is(id));
            return mongoTemplate.findOne(query, AuditLogEntry.class, COLLECTION_NAME);
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to get entry by id from MongoDB", e);
        }
    }

    private String sanitizeRegex(String pattern) {
        return REGEX_META_CHARS.matcher(pattern).replaceAll("\\\\$0");
    }

    @Override
    public void deleteByTime(Instant before) {
        try {
            Query query = new Query(Criteria.where("timestamp").lte(before));
            mongoTemplate.remove(query, AuditLogEntry.class, COLLECTION_NAME);
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to delete entries by time from MongoDB", e);
        }
    }

    @Override
    public long count() {
        try {
            return mongoTemplate.count(new Query(), AuditLogEntry.class, COLLECTION_NAME);
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to count entries in MongoDB", e);
        }
    }

    @Override
    public void deleteOldest(long count) {
        try {
            Query query = new Query()
                    .with(Sort.by(Sort.Direction.ASC, "timestamp"))
                    .limit((int) count);
            List<AuditLogEntry> entries = mongoTemplate.find(query, AuditLogEntry.class, COLLECTION_NAME);
            List<String> ids = entries.stream()
                    .map(AuditLogEntry::getId)
                    .collect(Collectors.toList());
            Query deleteQuery = new Query(Criteria.where("id").in(ids));
            mongoTemplate.remove(deleteQuery, AuditLogEntry.class, COLLECTION_NAME);
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to delete oldest entries from MongoDB", e);
        }
    }

    @Override
    public List<AuditLogEntry> findByTimeBefore(Instant before) {
        try {
            Query query = new Query(Criteria.where("timestamp").lte(before))
                    .with(Sort.by(Sort.Direction.ASC, "timestamp"))
                    .limit(10000);
            return mongoTemplate.find(query, AuditLogEntry.class, COLLECTION_NAME);
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to find entries by time from MongoDB", e);
        }
    }
}
