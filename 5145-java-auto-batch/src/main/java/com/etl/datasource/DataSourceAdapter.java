package com.etl.datasource;

import com.etl.model.DataSourceConfig;

import java.util.Iterator;
import java.util.List;
import java.util.Map;

public interface DataSourceAdapter {

    void connect(DataSourceConfig config);

    void disconnect();

    boolean testConnection();

    Iterator<Map<String, Object>> executeQuery(String query);

    void executeWrite(String targetTable, List<Map<String, Object>> records, List<String> columnOrder);

    String getAdapterType();
}
