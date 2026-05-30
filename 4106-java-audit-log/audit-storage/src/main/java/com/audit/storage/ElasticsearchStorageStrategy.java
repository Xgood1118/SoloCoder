package com.audit.storage;

import com.audit.common.dto.PageResult;
import com.audit.common.dto.QueryRequest;
import com.audit.common.enums.StorageType;
import com.audit.common.exception.StorageUnavailableException;
import com.audit.common.model.AuditLogEntry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.springframework.data.elasticsearch.client.elc.NativeQuery.builder;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "audit.storage.elasticsearch.enabled", havingValue = "true")
public class ElasticsearchStorageStrategy implements StorageStrategy {

    private static final String INDEX_NAME = "audit-log-entry";
    private static final Pattern REGEX_META_CHARS = Pattern.compile("[\\\\\\[\\]{}()*+?.|^$]");

    private final ElasticsearchOperations elasticsearchOperations;

    @PostConstruct
    public void init() {
        if (!elasticsearchOperations.indexOps(IndexCoordinates.of(INDEX_NAME)).exists()) {
            var indexOps = elasticsearchOperations.indexOps(IndexCoordinates.of(INDEX_NAME));
            indexOps.create();
            indexOps.putMapping(indexOps.createMapping(AuditLogEntry.class));
        }
    }

    @Override
    public void save(AuditLogEntry entry) {
        try {
            IndexQuery indexQuery = new IndexQuery();
            indexQuery.setId(entry.getId());
            indexQuery.setObject(entry);
            elasticsearchOperations.index(indexQuery, IndexCoordinates.of(INDEX_NAME));
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to save entry to Elasticsearch", e);
        }
    }

    @Override
    public void saveBatch(List<AuditLogEntry> entries) {
        try {
            List<IndexQuery> queries = entries.stream().map(entry -> {
                IndexQuery indexQuery = new IndexQuery();
                indexQuery.setId(entry.getId());
                indexQuery.setObject(entry);
                return indexQuery;
            }).collect(Collectors.toList());
            elasticsearchOperations.bulkIndex(queries, IndexCoordinates.of(INDEX_NAME));
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to batch save entries to Elasticsearch", e);
        }
    }

    @Override
    public PageResult<AuditLogEntry> query(QueryRequest request) {
        try {
            var boolBuilder = new co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery.Builder();

            if (request.getOperatorId() != null && !request.getOperatorId().isBlank()) {
                boolBuilder.must(m -> m.term(t -> t.field("operatorId").value(request.getOperatorId())));
            }
            if (request.getAction() != null && !request.getAction().isBlank()) {
                boolBuilder.must(m -> m.term(t -> t.field("action").value(request.getAction())));
            }
            if (request.getResourceType() != null && !request.getResourceType().isBlank()) {
                boolBuilder.must(m -> m.term(t -> t.field("resourceType").value(request.getResourceType())));
            }
            if (request.getResourceId() != null && !request.getResourceId().isBlank()) {
                boolBuilder.must(m -> m.term(t -> t.field("resourceId").value(request.getResourceId())));
            }
            if (request.getTraceId() != null && !request.getTraceId().isBlank()) {
                boolBuilder.must(m -> m.term(t -> t.field("traceId").value(request.getTraceId())));
            }
            if (request.getLogLevel() != null) {
                boolBuilder.must(m -> m.term(t -> t.field("logLevel").value(request.getLogLevel().name())));
            }
            if (request.getLogType() != null) {
                boolBuilder.must(m -> m.term(t -> t.field("logType").value(request.getLogType().name())));
            }

            if (request.getKeyword() != null && !request.getKeyword().isBlank()) {
                boolBuilder.must(m -> m.multiMatch(mm -> mm
                        .fields("description", "operatorName", "errorMessage")
                        .query(request.getKeyword())));
            }

            if (request.getRegexPattern() != null && !request.getRegexPattern().isBlank()) {
                String sanitized = sanitizeRegex(request.getRegexPattern());
                boolBuilder.must(m -> m.regexp(r -> r.field("description").value(sanitized)));
            }

            if (request.getStartTime() != null || request.getEndTime() != null) {
                boolBuilder.must(m -> m.range(r -> {
                    var rangeBuilder = r.field("timestamp");
                    if (request.getStartTime() != null) {
                        rangeBuilder.gte(request.getStartTime().toString());
                    }
                    if (request.getEndTime() != null) {
                        rangeBuilder.lte(request.getEndTime().toString());
                    }
                    return rangeBuilder;
                }));
            }

            var boolQuery = boolBuilder.build();

            Sort sort;
            if (request.getSortBy() != null && !request.getSortBy().isBlank()) {
                Sort.Direction direction = "desc".equalsIgnoreCase(request.getSortOrder())
                        ? Sort.Direction.DESC : Sort.Direction.ASC;
                sort = Sort.by(direction, request.getSortBy());
            } else {
                sort = Sort.by(Sort.Direction.DESC, "timestamp");
            }

            NativeQuery searchQuery = NativeQuery.builder()
                    .withQuery(q -> q.bool(boolQuery))
                    .withPageable(PageRequest.of(request.getPage() - 1, request.getSize(), sort))
                    .build();

            SearchHits<AuditLogEntry> searchHits = elasticsearchOperations.search(
                    searchQuery, AuditLogEntry.class, IndexCoordinates.of(INDEX_NAME));

            List<AuditLogEntry> records = searchHits.getSearchHits().stream()
                    .map(SearchHit::getContent)
                    .collect(Collectors.toList());

            return PageResult.of(records, searchHits.getTotalHits(), request.getPage(), request.getSize());
        } catch (StorageUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to query Elasticsearch", e);
        }
    }

    @Override
    public StorageType getType() {
        return StorageType.ELASTICSEARCH;
    }

    @Override
    public boolean isHealthy() {
        try {
            return elasticsearchOperations.indexOps(IndexCoordinates.of(INDEX_NAME)).exists();
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public AuditLogEntry getById(String id) {
        try {
            var query = NativeQuery.builder()
                    .withQuery(q -> q.ids(i -> i.values(id)))
                    .build();
            SearchHits<AuditLogEntry> searchHits = elasticsearchOperations.search(
                    query, AuditLogEntry.class, IndexCoordinates.of(INDEX_NAME));
            if (searchHits.getTotalHits() > 0) {
                return searchHits.getSearchHits().get(0).getContent();
            }
            return null;
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to get entry by id from Elasticsearch", e);
        }
    }

    private String sanitizeRegex(String pattern) {
        return REGEX_META_CHARS.matcher(pattern).replaceAll("\\\\$0");
    }

    @Override
    public void deleteByTime(Instant before) {
        try {
            var query = builder()
                    .withQuery(q -> q.range(r -> r.field("timestamp").lte(before.toString())))
                    .build();
            elasticsearchOperations.delete(query, AuditLogEntry.class, IndexCoordinates.of(INDEX_NAME));
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to delete entries by time from Elasticsearch", e);
        }
    }

    @Override
    public long count() {
        try {
            var query = NativeQuery.builder().build();
            SearchHits<AuditLogEntry> searchHits = elasticsearchOperations.search(
                    query, AuditLogEntry.class, IndexCoordinates.of(INDEX_NAME));
            return searchHits.getTotalHits();
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to count entries in Elasticsearch", e);
        }
    }

    @Override
    public void deleteOldest(long count) {
        try {
            var query = NativeQuery.builder()
                    .withQuery(q -> q.matchAll(m -> m))
                    .withPageable(PageRequest.of(0, (int) count, Sort.by(Sort.Direction.ASC, "timestamp")))
                    .build();
            SearchHits<AuditLogEntry> searchHits = elasticsearchOperations.search(
                    query, AuditLogEntry.class, IndexCoordinates.of(INDEX_NAME));
            List<String> ids = searchHits.getSearchHits().stream()
                    .map(hit -> hit.getContent().getId())
                    .collect(Collectors.toList());
            for (String id : ids) {
                elasticsearchOperations.delete(id, IndexCoordinates.of(INDEX_NAME));
            }
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to delete oldest entries from Elasticsearch", e);
        }
    }

    @Override
    public List<AuditLogEntry> findByTimeBefore(Instant before) {
        try {
            var query = NativeQuery.builder()
                    .withQuery(q -> q.range(r -> r.field("timestamp").lte(before.toString())))
                    .withPageable(PageRequest.of(0, 10000, Sort.by(Sort.Direction.ASC, "timestamp")))
                    .build();
            SearchHits<AuditLogEntry> searchHits = elasticsearchOperations.search(
                    query, AuditLogEntry.class, IndexCoordinates.of(INDEX_NAME));
            return searchHits.getSearchHits().stream()
                    .map(SearchHit::getContent)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to find entries by time from Elasticsearch", e);
        }
    }
}
