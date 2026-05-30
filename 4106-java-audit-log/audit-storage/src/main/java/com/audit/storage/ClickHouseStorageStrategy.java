package com.audit.storage;

import com.audit.common.dto.PageResult;
import com.audit.common.dto.QueryRequest;
import com.audit.common.enums.StorageType;
import com.audit.common.exception.StorageUnavailableException;
import com.audit.common.model.AuditLogEntry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Slf4j
@Service
@ConditionalOnProperty(name = "audit.storage.clickhouse.enabled", havingValue = "true")
public class ClickHouseStorageStrategy implements StorageStrategy {

    private static final String TABLE_NAME = "audit_log_entry";
    private static final Pattern REGEX_META_CHARS = Pattern.compile("[\\\\\\[\\]{}()*+?.|^$]");

    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public ClickHouseStorageStrategy(@Qualifier("clickHouseJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void init() {
        jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS " + TABLE_NAME + " (" +
                        "id String, " +
                        "sequence_number UInt64, " +
                        "trace_id String, " +
                        "timestamp DateTime64(3), " +
                        "operator_id String, " +
                        "operator_name String, " +
                        "operator_ip String, " +
                        "operator_terminal String, " +
                        "action String, " +
                        "resource_type String, " +
                        "resource_id String, " +
                        "description String, " +
                        "before_data String, " +
                        "after_data String, " +
                        "log_level String, " +
                        "log_type String, " +
                        "result String, " +
                        "error_message String, " +
                        "duration_ms UInt64, " +
                        "tags String, " +
                        "checksum String" +
                        ") ENGINE = MergeTree() " +
                        "PARTITION BY toYYYYMM(timestamp) " +
                        "ORDER BY (timestamp, id)"
        );
    }

    @Override
    public void save(AuditLogEntry entry) {
        try {
            jdbcTemplate.update(
                    "INSERT INTO " + TABLE_NAME + " (" +
                            "id, sequence_number, trace_id, timestamp, operator_id, operator_name, " +
                            "operator_ip, operator_terminal, action, resource_type, resource_id, " +
                            "description, before_data, after_data, log_level, log_type, result, " +
                            "error_message, duration_ms, tags, checksum) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    entry.getId(), entry.getSequenceNumber(), entry.getTraceId(),
                    toTimestamp(entry.getTimestamp()), entry.getOperatorId(), entry.getOperatorName(),
                    entry.getOperatorIp(), entry.getOperatorTerminal(), entry.getAction(),
                    entry.getResourceType(), entry.getResourceId(), entry.getDescription(),
                    entry.getBeforeData(), entry.getAfterData(),
                    entry.getLogLevel() != null ? entry.getLogLevel().name() : null,
                    entry.getLogType() != null ? entry.getLogType().name() : null,
                    entry.getResult() != null ? entry.getResult().name() : null,
                    entry.getErrorMessage(), entry.getDurationMs(),
                    entry.getTags() != null ? mapToString(entry.getTags()) : null,
                    entry.getChecksum()
            );
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to save entry to ClickHouse", e);
        }
    }

    @Override
    public void saveBatch(List<AuditLogEntry> entries) {
        try {
            List<Object[]> batchArgs = entries.stream().map(entry -> new Object[]{
                    entry.getId(), entry.getSequenceNumber(), entry.getTraceId(),
                    toTimestamp(entry.getTimestamp()), entry.getOperatorId(), entry.getOperatorName(),
                    entry.getOperatorIp(), entry.getOperatorTerminal(), entry.getAction(),
                    entry.getResourceType(), entry.getResourceId(), entry.getDescription(),
                    entry.getBeforeData(), entry.getAfterData(),
                    entry.getLogLevel() != null ? entry.getLogLevel().name() : null,
                    entry.getLogType() != null ? entry.getLogType().name() : null,
                    entry.getResult() != null ? entry.getResult().name() : null,
                    entry.getErrorMessage(), entry.getDurationMs(),
                    entry.getTags() != null ? mapToString(entry.getTags()) : null,
                    entry.getChecksum()
            }).collect(java.util.stream.Collectors.toList());
            jdbcTemplate.batchUpdate(
                    "INSERT INTO " + TABLE_NAME + " (" +
                            "id, sequence_number, trace_id, timestamp, operator_id, operator_name, " +
                            "operator_ip, operator_terminal, action, resource_type, resource_id, " +
                            "description, before_data, after_data, log_level, log_type, result, " +
                            "error_message, duration_ms, tags, checksum) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    batchArgs
            );
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to batch save entries to ClickHouse", e);
        }
    }

    @Override
    public PageResult<AuditLogEntry> query(QueryRequest request) {
        try {
            StringBuilder sql = new StringBuilder("SELECT * FROM " + TABLE_NAME + " WHERE 1=1");
            List<Object> params = new ArrayList<>();

            if (request.getOperatorId() != null && !request.getOperatorId().isBlank()) {
                sql.append(" AND operator_id = ?");
                params.add(request.getOperatorId());
            }
            if (request.getAction() != null && !request.getAction().isBlank()) {
                sql.append(" AND action = ?");
                params.add(request.getAction());
            }
            if (request.getResourceType() != null && !request.getResourceType().isBlank()) {
                sql.append(" AND resource_type = ?");
                params.add(request.getResourceType());
            }
            if (request.getResourceId() != null && !request.getResourceId().isBlank()) {
                sql.append(" AND resource_id = ?");
                params.add(request.getResourceId());
            }
            if (request.getTraceId() != null && !request.getTraceId().isBlank()) {
                sql.append(" AND trace_id = ?");
                params.add(request.getTraceId());
            }
            if (request.getLogLevel() != null) {
                sql.append(" AND log_level = ?");
                params.add(request.getLogLevel().name());
            }
            if (request.getLogType() != null) {
                sql.append(" AND log_type = ?");
                params.add(request.getLogType().name());
            }
            if (request.getKeyword() != null && !request.getKeyword().isBlank()) {
                sql.append(" AND (description LIKE ? OR operator_name LIKE ? OR error_message LIKE ?)");
                String likePattern = "%" + escapeLike(request.getKeyword()) + "%";
                params.add(likePattern);
                params.add(likePattern);
                params.add(likePattern);
            }
            if (request.getRegexPattern() != null && !request.getRegexPattern().isBlank()) {
                String sanitized = sanitizeRegex(request.getRegexPattern());
                sql.append(" AND match(description, ?)");
                params.add(sanitized);
            }
            if (request.getStartTime() != null) {
                sql.append(" AND timestamp >= ?");
                params.add(toTimestamp(request.getStartTime()));
            }
            if (request.getEndTime() != null) {
                sql.append(" AND timestamp <= ?");
                params.add(toTimestamp(request.getEndTime()));
            }

            String countSql = sql.toString().replace("SELECT *", "SELECT count()");
            Long total = jdbcTemplate.queryForObject(countSql, params.toArray(), Long.class);

            String sortColumn = validateSortColumn(request.getSortBy());
            String sortOrder = "desc".equalsIgnoreCase(request.getSortOrder()) ? "DESC" : "ASC";
            sql.append(" ORDER BY ").append(sortColumn).append(" ").append(sortOrder);

            int offset = (request.getPage() - 1) * request.getSize();
            sql.append(" LIMIT ? OFFSET ?");
            params.add(request.getSize());
            params.add(offset);

            List<AuditLogEntry> records = jdbcTemplate.query(sql.toString(), this::mapRow, params.toArray());

            return PageResult.of(records, total != null ? total : 0, request.getPage(), request.getSize());
        } catch (StorageUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to query ClickHouse", e);
        }
    }

    @Override
    public StorageType getType() {
        return StorageType.CLICKHOUSE;
    }

    @Override
    public boolean isHealthy() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private AuditLogEntry mapRow(ResultSet rs, int rowNum) throws SQLException {
        return AuditLogEntry.builder()
                .id(rs.getString("id"))
                .sequenceNumber(rs.getLong("sequence_number"))
                .traceId(rs.getString("trace_id"))
                .timestamp(toInstant(rs.getTimestamp("timestamp")))
                .operatorId(rs.getString("operator_id"))
                .operatorName(rs.getString("operator_name"))
                .operatorIp(rs.getString("operator_ip"))
                .operatorTerminal(rs.getString("operator_terminal"))
                .action(rs.getString("action"))
                .resourceType(rs.getString("resource_type"))
                .resourceId(rs.getString("resource_id"))
                .description(rs.getString("description"))
                .beforeData(rs.getString("before_data"))
                .afterData(rs.getString("after_data"))
                .logLevel(parseEnum(rs.getString("log_level"), com.audit.common.enums.LogLevel.class))
                .logType(parseEnum(rs.getString("log_type"), com.audit.common.enums.LogType.class))
                .result(parseEnum(rs.getString("result"), com.audit.common.enums.OperationResult.class))
                .errorMessage(rs.getString("error_message"))
                .durationMs(rs.getLong("duration_ms"))
                .tags(stringToMap(rs.getString("tags")))
                .checksum(rs.getString("checksum"))
                .build();
    }

    private Timestamp toTimestamp(Instant instant) {
        return instant != null ? Timestamp.from(instant) : null;
    }

    private Instant toInstant(Timestamp timestamp) {
        return timestamp != null ? timestamp.toInstant() : null;
    }

    private <E extends Enum<E>> E parseEnum(String value, Class<E> enumClass) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(enumClass, value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String mapToString(Map<String, String> map) {
        if (map == null || map.isEmpty()) {
            return null;
        }
        var sb = new StringBuilder();
        map.forEach((k, v) -> {
            if (sb.length() > 0) sb.append(",");
            sb.append(k.replace("=", "\\=")).append("=").append(v.replace("=", "\\="));
        });
        return sb.toString();
    }

    private Map<String, String> stringToMap(String str) {
        if (str == null || str.isBlank()) {
            return null;
        }
        Map<String, String> map = new HashMap<>();
        String[] pairs = str.split(",");
        for (String pair : pairs) {
            int idx = pair.indexOf("=");
            if (idx > 0) {
                map.put(pair.substring(0, idx), pair.substring(idx + 1));
            }
        }
        return map;
    }

    private String sanitizeRegex(String pattern) {
        return REGEX_META_CHARS.matcher(pattern).replaceAll("\\\\$0");
    }

    private String escapeLike(String input) {
        return input.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    @Override
    public AuditLogEntry getById(String id) {
        try {
            String sql = "SELECT * FROM " + TABLE_NAME + " WHERE id = ?";
            List<AuditLogEntry> results = jdbcTemplate.query(sql, this::mapRow, id);
            return results.isEmpty() ? null : results.get(0);
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to get entry by id from ClickHouse", e);
        }
    }

    private String validateSortColumn(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "timestamp";
        }
        var allowed = java.util.Set.of(
                "id", "timestamp", "operator_id", "action", "resource_type",
                "resource_id", "log_level", "log_type", "result", "duration_ms"
        );
        return allowed.contains(sortBy) ? sortBy : "timestamp";
    }

    @Override
    public void deleteByTime(Instant before) {
        try {
            String sql = "ALTER TABLE " + TABLE_NAME + " DELETE WHERE timestamp <= ?";
            jdbcTemplate.update(sql, toTimestamp(before));
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to delete entries by time from ClickHouse", e);
        }
    }

    @Override
    public long count() {
        try {
            String sql = "SELECT count() FROM " + TABLE_NAME;
            Long result = jdbcTemplate.queryForObject(sql, Long.class);
            return result != null ? result : 0;
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to count entries in ClickHouse", e);
        }
    }

    @Override
    public void deleteOldest(long count) {
        try {
            String sql = "ALTER TABLE " + TABLE_NAME + " DELETE WHERE id IN (" +
                    "SELECT id FROM " + TABLE_NAME + " ORDER BY timestamp ASC LIMIT ?)";
            jdbcTemplate.update(sql, count);
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to delete oldest entries from ClickHouse", e);
        }
    }

    @Override
    public List<AuditLogEntry> findByTimeBefore(Instant before) {
        try {
            String sql = "SELECT * FROM " + TABLE_NAME + " WHERE timestamp <= ? ORDER BY timestamp ASC LIMIT 10000";
            return jdbcTemplate.query(sql, this::mapRow, toTimestamp(before));
        } catch (Exception e) {
            throw new StorageUnavailableException("Failed to find entries by time from ClickHouse", e);
        }
    }
}
