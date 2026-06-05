package com.etl.nullhandler;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class NullValueDetector {

    private NullValueDetector() {
    }

    public static boolean isNull(Object value) {
        return value == null;
    }

    public static boolean isBlank(Object value) {
        if (value == null) {
            return true;
        }
        return value.toString().isBlank();
    }

    public static boolean isBlankStringOnly(Object value) {
        if (value == null) {
            return false;
        }
        return value.toString().isBlank();
    }

    public static String buildGroupKey(Map<String, Object> record, List<String> groupKeyFields) {
        return groupKeyFields.stream()
                .map(field -> {
                    Object val = record.get(field);
                    return val == null ? "" : val.toString();
                })
                .collect(Collectors.joining("|"));
    }
}
