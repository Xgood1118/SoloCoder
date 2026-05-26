package com.cacheproxy.core;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CacheValueWrapper implements Serializable {

    private Object value;

    private boolean nullValue;

    private long createTime;

    private long expireTime;

    public static CacheValueWrapper of(Object value, long ttlMillis) {
        long now = System.currentTimeMillis();
        return new CacheValueWrapper(value, value == null, now, now + ttlMillis);
    }

    public boolean isExpired() {
        return System.currentTimeMillis() > expireTime;
    }
}
