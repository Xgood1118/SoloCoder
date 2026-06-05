package com.etl.model;

import java.util.Map;

public class DataSourceConfig {

    public static enum DataSourceType {
        MYSQL, POSTGRESQL, ORACLE, SQLSERVER, MONGODB, REST_API
    }

    private String id;
    private String name;
    private DataSourceType type;
    private String host;
    private int port;
    private String databaseName;
    private String username;
    private String password;
    private int poolSize = 10;
    private int connectionTimeout = 30000;
    private int retryCount = 3;
    private long maxLifetime = 1800000L;
    private DataSourceConfig standbyConfig;
    private Map<String, String> extraParams;

    public DataSourceConfig() {
    }

    public DataSourceConfig(String id, String name, DataSourceType type, String host, int port,
                            String databaseName, String username, String password, int poolSize,
                            int connectionTimeout, int retryCount, long maxLifetime,
                            DataSourceConfig standbyConfig, Map<String, String> extraParams) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.host = host;
        this.port = port;
        this.databaseName = databaseName;
        this.username = username;
        this.password = password;
        this.poolSize = poolSize;
        this.connectionTimeout = connectionTimeout;
        this.retryCount = retryCount;
        this.maxLifetime = maxLifetime;
        this.standbyConfig = standbyConfig;
        this.extraParams = extraParams;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public DataSourceType getType() {
        return type;
    }

    public void setType(DataSourceType type) {
        this.type = type;
    }

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public int getPort() {
        return port;
    }

    public void setPort(int port) {
        this.port = port;
    }

    public String getDatabaseName() {
        return databaseName;
    }

    public void setDatabaseName(String databaseName) {
        this.databaseName = databaseName;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public int getPoolSize() {
        return poolSize;
    }

    public void setPoolSize(int poolSize) {
        this.poolSize = poolSize;
    }

    public int getConnectionTimeout() {
        return connectionTimeout;
    }

    public void setConnectionTimeout(int connectionTimeout) {
        this.connectionTimeout = connectionTimeout;
    }

    public int getRetryCount() {
        return retryCount;
    }

    public void setRetryCount(int retryCount) {
        this.retryCount = retryCount;
    }

    public long getMaxLifetime() {
        return maxLifetime;
    }

    public void setMaxLifetime(long maxLifetime) {
        this.maxLifetime = maxLifetime;
    }

    public DataSourceConfig getStandbyConfig() {
        return standbyConfig;
    }

    public void setStandbyConfig(DataSourceConfig standbyConfig) {
        this.standbyConfig = standbyConfig;
    }

    public Map<String, String> getExtraParams() {
        return extraParams;
    }

    public void setExtraParams(Map<String, String> extraParams) {
        this.extraParams = extraParams;
    }
}
