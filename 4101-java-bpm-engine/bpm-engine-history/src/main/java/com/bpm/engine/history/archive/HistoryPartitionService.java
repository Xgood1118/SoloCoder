package com.bpm.engine.history.archive;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class HistoryPartitionService {

    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("yyyyMM");

    private final JdbcTemplate jdbcTemplate;

    public void ensurePartitionExists(String processDefinitionId, LocalDateTime createTime) {
        String partitionName = getPartitionTableName(processDefinitionId, createTime);
        String parentTable = "bpm_historic_process_instance";
        String checkSql = "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '" + partitionName + "'";
        Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class);
        if (count != null && count > 0) {
            return;
        }
        String fromValue = createTime.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0)
                .toString();
        String toValue = createTime.withDayOfMonth(1).plusMonths(1).withHour(0).withMinute(0).withSecond(0).withNano(0)
                .toString();
        String createSql = String.format(
                "CREATE TABLE IF NOT EXISTS %s PARTITION OF %s FOR VALUES FROM ('%s') TO ('%s')",
                partitionName, parentTable, fromValue, toValue);
        jdbcTemplate.execute(createSql);
        log.info("Created partition {} for process definition {}", partitionName, processDefinitionId);
    }

    public String getPartitionTableName(String processDefinitionId, LocalDateTime createTime) {
        String monthPart = createTime.format(MONTH_FORMATTER);
        String defHash = Integer.toHexString(Math.abs(processDefinitionId.hashCode())).toLowerCase();
        return "bpm_historic_process_instance_" + monthPart + "_" + defHash;
    }
}
