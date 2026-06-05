package com.etl.engine;

import com.etl.batch.BatchProcessor;
import com.etl.batch.BatchStatistics;
import com.etl.cleaning.CleaningResult;
import com.etl.cleaning.CleaningRuleEngine;
import com.etl.datasource.DataSourceAdapter;
import com.etl.datasource.DataSourceAdapterFactory;
import com.etl.error.ErrorRecordStore;
import com.etl.error.ErrorRowHandler;
import com.etl.mapping.FieldMappingEngine;
import com.etl.model.BatchProgress;
import com.etl.model.EtlTaskConfig;
import com.etl.nullhandler.NullValueHandler;
import com.etl.truncate.TruncationHandler;
import com.etl.truncate.TruncationResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class EtlEngine {

    private static final Logger logger = LoggerFactory.getLogger(EtlEngine.class);

    private final EtlTaskConfig config;

    private DataSourceAdapter sourceAdapter;
    private DataSourceAdapter targetAdapter;
    private FieldMappingEngine mappingEngine;
    private CleaningRuleEngine cleaningEngine;
    private NullValueHandler nullHandler;
    private TruncationHandler truncationHandler;
    private ErrorRowHandler errorRowHandler;
    private ErrorRecordStore errorStore;
    private BatchProcessor batchProcessor;
    private BatchStatistics batchStatistics;

    public EtlEngine(EtlTaskConfig config) {
        this.config = config;
    }

    public void initialize() {
        sourceAdapter = DataSourceAdapterFactory.createAdapter(config.getSourceConfig().getType());
        sourceAdapter.connect(config.getSourceConfig());

        targetAdapter = DataSourceAdapterFactory.createAdapter(config.getTargetConfig().getType());
        targetAdapter.connect(config.getTargetConfig());

        mappingEngine = new FieldMappingEngine(config.getFieldMappings());
        mappingEngine.initialize();

        cleaningEngine = new CleaningRuleEngine(config.getCleaningRules());
        cleaningEngine.initialize();

        nullHandler = new NullValueHandler(config.getNullHandlingStrategies());
        nullHandler.initialize();

        truncationHandler = new TruncationHandler(config.getTruncationStrategies());
        truncationHandler.initialize();

        errorStore = new ErrorRecordStore();
        errorRowHandler = new ErrorRowHandler(config.isSkipOnError(), errorStore);

        batchProcessor = new BatchProcessor(config.getBatchSize(), config.getMemoryLimitMB());
        batchStatistics = new BatchStatistics(System.currentTimeMillis(), 0);
    }

    public void execute() {
        String stateFilePath = config.getTaskId() + ".progress.json";

        if (batchProcessor.hasProgress(stateFilePath)) {
            BatchProgress progress = batchProcessor.loadProgress(stateFilePath);
            logger.info("Resuming from progress: processed {} records, batch {}", progress.getProcessedRecords(), progress.getCurrentBatch());
        }

        Iterator<Map<String, Object>> iterator = sourceAdapter.executeQuery(config.getSourceQuery());

        List<Map<String, Object>> batchBuffer = new ArrayList<>();
        List<String> columnOrder = config.getFieldMappings().stream()
                .map(rule -> rule.getTargetField())
                .distinct()
                .collect(Collectors.toList());
        String targetTable = config.getTargetConfig().getName();

        long lineNumber = 0;
        long processedInBatch = 0;
        long totalProcessed = 0;

        batchProcessor.start(config.getTaskId(), 0);

        while (iterator.hasNext()) {
            Map<String, Object> sourceRecord;
            try {
                sourceRecord = iterator.next();
            } catch (Exception e) {
                logger.error("Error reading from source iterator", e);
                break;
            }
            lineNumber++;

            try {
                Map<String, Object> mappedRecord = mappingEngine.apply(sourceRecord);

                CleaningResult cleaningResult = cleaningEngine.applyAll(mappedRecord);
                Map<String, Object> cleanedRecord = cleaningResult.getCleanedRecord();

                Map<String, Object> handledRecord = nullHandler.handle(cleanedRecord);
                nullHandler.updateContext(handledRecord);

                TruncationResult truncationResult = truncationHandler.handle(handledRecord);
                if (truncationResult.isRejected()) {
                    throw new RuntimeException("Row rejected by truncation handler on fields: " + truncationResult.getRejectedFields());
                }
                Map<String, Object> finalRecord = truncationResult.getRecord();

                batchBuffer.add(finalRecord);
                processedInBatch++;
                batchStatistics.addProcessed(1);
            } catch (Exception e) {
                boolean shouldContinue = errorRowHandler.handleException(sourceRecord, e, lineNumber);
                if (!shouldContinue) {
                    logger.error("Error handling policy requires termination at line {}", lineNumber);
                    break;
                }
            }

            if (batchBuffer.size() >= config.getBatchSize()) {
                targetAdapter.executeWrite(targetTable, batchBuffer, columnOrder);
                totalProcessed += processedInBatch;
                batchProcessor.afterBatch(processedInBatch);
                batchProcessor.saveProgress(stateFilePath);
                logger.info("Batch completed - {}", batchStatistics.getFormattedStats());
                batchBuffer.clear();
                processedInBatch = 0;
            }
        }

        if (!batchBuffer.isEmpty()) {
            targetAdapter.executeWrite(targetTable, batchBuffer, columnOrder);
            totalProcessed += processedInBatch;
            batchProcessor.afterBatch(processedInBatch);
            batchProcessor.saveProgress(stateFilePath);
        }

        sourceAdapter.disconnect();
        targetAdapter.disconnect();

        logger.info("ETL task '{}' completed. Total processed: {}, Total errors: {}. Final stats: {}",
                config.getTaskId(), totalProcessed, errorStore.getErrorCount(), batchStatistics.getFormattedStats());
    }

    public void shutdown() {
        try {
            if (sourceAdapter != null) {
                sourceAdapter.disconnect();
            }
        } catch (Exception e) {
            logger.error("Error disconnecting source adapter", e);
        }
        try {
            if (targetAdapter != null) {
                targetAdapter.disconnect();
            }
        } catch (Exception e) {
            logger.error("Error disconnecting target adapter", e);
        }
    }
}
