package com.featureflag.dto;

import lombok.Data;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
public class UserContext {

    private String userId;

    private List<String> userTags;

    private Map<String, Object> attributes = new HashMap<>();

    public void putAttribute(String key, Object value) {
        attributes.put(key, value);
    }

    public Object getAttribute(String key) {
        return attributes.get(key);
    }
}
