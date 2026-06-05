package com.etl.model;

import java.util.List;

public class EtlTaskConfig {

    private String taskId;
    private String taskName;
    private DataSourceConfig sourceConfig;
    private DataSourceConfig targetConfig;
    private String sourceQuery;
    private List<FieldMappingRule> fieldMappings;
    private List<CleaningRule> cleaningRules;
    private List<NullHandlingStrategy> nullHandlingStrategies;
    private List<TruncationStrategy> truncationStrategies;
    private int batchSize = 10000;
    private int memoryLimitMB = 512;
    private boolean skipOnError = true;
    private String sourceEncoding;

    public EtlTaskConfig() {
    }

    public EtlTaskConfig(String taskId, String taskName, DataSourceConfig sourceConfig,
                         DataSourceConfig targetConfig, String sourceQuery,
                         List<FieldMappingRule> fieldMappings, List<CleaningRule> cleaningRules,
                         List<NullHandlingStrategy> nullHandlingStrategies,
                         List<TruncationStrategy> truncationStrategies, int batchSize,
                         int memoryLimitMB, boolean skipOnError, String sourceEncoding) {
        this.taskId = taskId;
        this.taskName = taskName;
        this.sourceConfig = sourceConfig;
        this.targetConfig = targetConfig;
        this.sourceQuery = sourceQuery;
        this.fieldMappings = fieldMappings;
        this.cleaningRules = cleaningRules;
        this.nullHandlingStrategies = nullHandlingStrategies;
        this.truncationStrategies = truncationStrategies;
        this.batchSize = batchSize;
        this.memoryLimitMB = memoryLimitMB;
        this.skipOnError = skipOnError;
        this.sourceEncoding = sourceEncoding;
    }

    public String getTaskId() {
        return taskId;
    }

    public void setTaskId(String taskId) {
        this.taskId = taskId;
    }

    public String getTaskName() {
        return taskName;
    }

    public void setTaskName(String taskName) {
        this.taskName = taskName;
    }

    public DataSourceConfig getSourceConfig() {
        return sourceConfig;
    }

    public void setSourceConfig(DataSourceConfig sourceConfig) {
        this.sourceConfig = sourceConfig;
    }

    public DataSourceConfig getTargetConfig() {
        return targetConfig;
    }

    public void setTargetConfig(DataSourceConfig targetConfig) {
        this.targetConfig = targetConfig;
    }

    public String getSourceQuery() {
        return sourceQuery;
    }

    public void setSourceQuery(String sourceQuery) {
        this.sourceQuery = sourceQuery;
    }

    public List<FieldMappingRule> getFieldMappings() {
        return fieldMappings;
    }

    public void setFieldMappings(List<FieldMappingRule> fieldMappings) {
        this.fieldMappings = fieldMappings;
    }

    public List<CleaningRule> getCleaningRules() {
        return cleaningRules;
    }

    public void setCleaningRules(List<CleaningRule> cleaningRules) {
        this.cleaningRules = cleaningRules;
    }

    public List<NullHandlingStrategy> getNullHandlingStrategies() {
        return nullHandlingStrategies;
    }

    public void setNullHandlingStrategies(List<NullHandlingStrategy> nullHandlingStrategies) {
        this.nullHandlingStrategies = nullHandlingStrategies;
    }

    public List<TruncationStrategy> getTruncationStrategies() {
        return truncationStrategies;
    }

    public void setTruncationStrategies(List<TruncationStrategy> truncationStrategies) {
        this.truncationStrategies = truncationStrategies;
    }

    public int getBatchSize() {
        return batchSize;
    }

    public void setBatchSize(int batchSize) {
        this.batchSize = batchSize;
    }

    public int getMemoryLimitMB() {
        return memoryLimitMB;
    }

    public void setMemoryLimitMB(int memoryLimitMB) {
        this.memoryLimitMB = memoryLimitMB;
    }

    public boolean isSkipOnError() {
        return skipOnError;
    }

    public void setSkipOnError(boolean skipOnError) {
        this.skipOnError = skipOnError;
    }

    public String getSourceEncoding() {
        return sourceEncoding;
    }

    public void setSourceEncoding(String sourceEncoding) {
        this.sourceEncoding = sourceEncoding;
    }
}
