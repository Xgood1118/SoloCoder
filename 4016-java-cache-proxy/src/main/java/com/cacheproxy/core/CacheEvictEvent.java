package com.cacheproxy.core;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CacheEvictEvent implements Serializable {

    private String cacheName;

    private String key;

    private boolean allEntries;

    private String sourceInstanceId;

    private long timestamp;

    public static CacheEvictEvent of(String cacheName, String key, boolean allEntries, String sourceInstanceId) {
        return new CacheEvictEvent(cacheName, key, allEntries, sourceInstanceId, System.currentTimeMillis());
    }
}
