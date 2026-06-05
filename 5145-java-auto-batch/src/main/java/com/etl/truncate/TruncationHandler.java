package com.etl.truncate;

import com.etl.model.TruncationStrategy;
import com.etl.model.TruncationStrategy.TruncationType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TruncationHandler {

    private static final Logger logger = LoggerFactory.getLogger(TruncationHandler.class);

    private final List<TruncationStrategy> strategies;
    private final Map<String, TruncationStrategy> fieldStrategyMap = new HashMap<>();

    public TruncationHandler(List<TruncationStrategy> strategies) {
        this.strategies = strategies;
    }

    public void initialize() {
        fieldStrategyMap.clear();
        for (TruncationStrategy strategy : strategies) {
            fieldStrategyMap.put(strategy.getTargetField(), strategy);
        }
    }

    public TruncationResult handle(Map<String, Object> record) {
        Map<String, Object> resultRecord = new HashMap<>(record);
        TruncationResult result = new TruncationResult(resultRecord);

        for (Map.Entry<String, TruncationStrategy> entry : fieldStrategyMap.entrySet()) {
            String fieldName = entry.getKey();
            TruncationStrategy strategy = entry.getValue();

            Object value = resultRecord.get(fieldName);
            if (value == null) {
                continue;
            }

            String strValue = value.toString();
            if (strValue.length() <= strategy.getMaxLength()) {
                continue;
            }

            TruncationType type = strategy.getTruncationType();
            String marker = strategy.getTruncationMarker();

            if (type == TruncationType.FRONT) {
                String truncated = strValue.substring(strValue.length() - strategy.getMaxLength()) + marker;
                resultRecord.put(fieldName, truncated);
                result.addTruncatedField(fieldName);
                logger.debug("Front truncated field '{}': {} -> {}", fieldName, strValue.length(), truncated.length());
            } else if (type == TruncationType.BACK) {
                String truncated = strValue.substring(0, strategy.getMaxLength()) + marker;
                resultRecord.put(fieldName, truncated);
                result.addTruncatedField(fieldName);
                logger.debug("Back truncated field '{}': {} -> {}", fieldName, strValue.length(), truncated.length());
            } else if (type == TruncationType.REJECT_ROW) {
                result.setRejected(true);
                result.addRejectedField(fieldName);
                logger.debug("Rejected row due to field '{}' exceeding max length {}", fieldName, strategy.getMaxLength());
            }
        }

        return result;
    }
}
