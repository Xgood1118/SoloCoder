package com.etl.datasource;

import com.etl.model.DataSourceConfig;

import java.util.EnumMap;
import java.util.Map;

public class DataSourceAdapterFactory {

    private static final Map<DataSourceConfig.DataSourceType, Class<? extends DataSourceAdapter>> ADAPTER_MAP = new EnumMap<>(DataSourceConfig.DataSourceType.class);

    static {
        ADAPTER_MAP.put(DataSourceConfig.DataSourceType.MYSQL, MySqlAdapter.class);
        ADAPTER_MAP.put(DataSourceConfig.DataSourceType.POSTGRESQL, PostgreSqlAdapter.class);
        ADAPTER_MAP.put(DataSourceConfig.DataSourceType.ORACLE, OracleAdapter.class);
        ADAPTER_MAP.put(DataSourceConfig.DataSourceType.SQLSERVER, SqlServerAdapter.class);
        ADAPTER_MAP.put(DataSourceConfig.DataSourceType.MONGODB, MongoDbAdapter.class);
        ADAPTER_MAP.put(DataSourceConfig.DataSourceType.REST_API, RestApiAdapter.class);
    }

    public static DataSourceAdapter createAdapter(DataSourceConfig.DataSourceType type) {
        Class<? extends DataSourceAdapter> adapterClass = ADAPTER_MAP.get(type);
        if (adapterClass == null) {
            throw new IllegalArgumentException("Unsupported datasource type: " + type);
        }
        try {
            return adapterClass.getDeclaredConstructor().newInstance();
        } catch (Exception e) {
            throw new RuntimeException("Failed to create adapter for type: " + type, e);
        }
    }
}
