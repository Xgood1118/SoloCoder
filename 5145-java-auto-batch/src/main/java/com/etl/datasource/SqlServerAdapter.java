package com.etl.datasource;

import com.etl.model.DataSourceConfig;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

public class SqlServerAdapter extends AbstractDataSourceAdapter {

    private HikariDataSource dataSource;

    @Override
    protected void doConnect(DataSourceConfig config) throws Exception {
        HikariConfig hikariConfig = new HikariConfig();
        hikariConfig.setJdbcUrl(String.format("jdbc:sqlserver://%s:%d;databaseName=%s;encrypt=false",
                config.getHost(), config.getPort(), config.getDatabaseName()));
        hikariConfig.setUsername(config.getUsername());
        hikariConfig.setPassword(config.getPassword());
        hikariConfig.setMaximumPoolSize(config.getPoolSize());
        hikariConfig.setConnectionTimeout(config.getConnectionTimeout());
        hikariConfig.setMaxLifetime(config.getMaxLifetime());
        hikariConfig.setDriverClassName("com.microsoft.sqlserver.jdbc.SQLServerDriver");
        this.dataSource = new HikariDataSource(hikariConfig);
    }

    @Override
    protected void doDisconnect() {
        if (dataSource != null && !dataSource.isClosed()) {
            dataSource.close();
        }
    }

    @Override
    public Iterator<Map<String, Object>> executeQuery(String query) {
        try {
            Connection connection = dataSource.getConnection();
            PreparedStatement statement = connection.prepareStatement(query, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY);
            ResultSet resultSet = statement.executeQuery();
            return new ResultSetIterator(connection, statement, resultSet);
        } catch (Exception e) {
            handleException(e);
            throw new RuntimeException("Failed to execute query: " + query, e);
        }
    }

    @Override
    public void executeWrite(String targetTable, List<Map<String, Object>> records, List<String> columnOrder) {
        if (records == null || records.isEmpty()) {
            return;
        }

        String columns = String.join(", ", columnOrder);
        String placeholders = columnOrder.stream().map(c -> "?").reduce((a, b) -> a + ", " + b).orElse("");
        String sql = String.format("INSERT INTO %s (%s) VALUES (%s)", targetTable, columns, placeholders);

        try (Connection connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {
            for (Map<String, Object> record : records) {
                for (int i = 0; i < columnOrder.size(); i++) {
                    statement.setObject(i + 1, record.get(columnOrder.get(i)));
                }
                statement.addBatch();
            }
            statement.executeBatch();
        } catch (Exception e) {
            handleException(e);
            throw new RuntimeException("Failed to execute write to table: " + targetTable, e);
        }
    }

    @Override
    public String getAdapterType() {
        return "SQLSERVER";
    }

    private static class ResultSetIterator implements Iterator<Map<String, Object>> {

        private final Connection connection;
        private final PreparedStatement statement;
        private final ResultSet resultSet;
        private final ResultSetMetaData metaData;
        private final int columnCount;
        private Boolean hasNext;

        ResultSetIterator(Connection connection, PreparedStatement statement, ResultSet resultSet) throws Exception {
            this.connection = connection;
            this.statement = statement;
            this.resultSet = resultSet;
            this.metaData = resultSet.getMetaData();
            this.columnCount = metaData.getColumnCount();
            this.hasNext = null;
        }

        @Override
        public boolean hasNext() {
            if (hasNext != null) {
                return hasNext;
            }
            try {
                hasNext = resultSet.next();
                if (!hasNext) {
                    close();
                }
                return hasNext;
            } catch (Exception e) {
                close();
                throw new RuntimeException("Error advancing ResultSet", e);
            }
        }

        @Override
        public Map<String, Object> next() {
            if (!hasNext()) {
                throw new NoSuchElementException();
            }
            hasNext = null;
            try {
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 1; i <= columnCount; i++) {
                    row.put(metaData.getColumnLabel(i), resultSet.getObject(i));
                }
                return row;
            } catch (Exception e) {
                close();
                throw new RuntimeException("Error reading ResultSet row", e);
            }
        }

        private void close() {
            try { resultSet.close(); } catch (Exception ignored) {}
            try { statement.close(); } catch (Exception ignored) {}
            try { connection.close(); } catch (Exception ignored) {}
        }
    }
}
