package com.etl.nullhandler;

import com.etl.model.NullHandlingStrategy;
import com.etl.model.NullHandlingStrategy.NullStrategy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class NullValueHandler {

    private static final Logger logger = LoggerFactory.getLogger(NullValueHandler.class);

    private final List<NullHandlingStrategy> strategies;
    private Map<String, NullHandlingStrategy> fieldStrategyMap;
    private Map<String, Object> previousRecord;
    private Map<String, Map<String, Object>> groupValues;

    public NullValueHandler(List<NullHandlingStrategy> strategies) {
        this.strategies = strategies;
        this.previousRecord = new HashMap<>();
        this.groupValues = new HashMap<>();
    }

    public void initialize() {
        fieldStrategyMap = new HashMap<>();
        for (NullHandlingStrategy strategy : strategies) {
            fieldStrategyMap.put(strategy.getTargetField(), strategy);
        }
        previousRecord = new HashMap<>();
        groupValues = new HashMap<>();
        logger.info("NullValueHandler initialized with {} field strategies", fieldStrategyMap.size());
    }

    public Map<String, Object> handle(Map<String, Object> record) {
        Map<String, Object> result = new HashMap<>(record);
        for (Map.Entry<String, NullHandlingStrategy> entry : fieldStrategyMap.entrySet()) {
            String field = entry.getKey();
            NullHandlingStrategy strategy = entry.getValue();
            Object value = result.get(field);

            if (!isNull(value, strategy)) {
                continue;
            }

            switch (strategy.getStrategy()) {
                case DEFAULT_VALUE:
                    result.put(field, strategy.getDefaultValue());
                    break;
                case FORWARD_FILL:
                    if (previousRecord != null && previousRecord.containsKey(field)) {
                        Object prevValue = previousRecord.get(field);
                        if (!isNull(prevValue, strategy)) {
                            result.put(field, prevValue);
                        }
                    }
                    break;
                case GROUP_FILL:
                    String groupKey = NullValueDetector.buildGroupKey(record, strategy.getGroupKeyFields());
                    Map<String, Object> groupMap = groupValues.get(groupKey);
                    if (groupMap != null && groupMap.containsKey(field)) {
                        Object groupValue = groupMap.get(field);
                        if (!isNull(groupValue, strategy)) {
                            result.put(field, groupValue);
                        }
                    }
                    break;
                case EMPTY_STRING:
                    result.put(field, "");
                    break;
                default:
                    logger.warn("Unknown null strategy: {} for field: {}", strategy.getStrategy(), field);
                    break;
            }
        }
        return result;
    }

    private boolean isNull(Object value, NullHandlingStrategy strategy) {
        if (value == null) {
            return true;
        }
        if (strategy.isTreatBlankAsNull()) {
            return value.toString().isBlank();
        }
        return false;
    }

    public void updateContext(Map<String, Object> record) {
        previousRecord = new HashMap<>(record);

        for (Map.Entry<String, NullHandlingStrategy> entry : fieldStrategyMap.entrySet()) {
            String field = entry.getKey();
            NullHandlingStrategy strategy = entry.getValue();

            if (strategy.getStrategy() == NullStrategy.GROUP_FILL) {
                Object value = record.get(field);
                if (value != null && !(strategy.isTreatBlankAsNull() && value.toString().isBlank())) {
                    String groupKey = NullValueDetector.buildGroupKey(record, strategy.getGroupKeyFields());
                    groupValues.computeIfAbsent(groupKey, k -> new HashMap<>()).put(field, value);
                }
            }
        }
    }
}
