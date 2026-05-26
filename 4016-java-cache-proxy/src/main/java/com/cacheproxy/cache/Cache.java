package com.cacheproxy.cache;

import java.util.concurrent.TimeUnit;

public interface Cache {

    String getName();

    Object get(String key);

    void put(String key, Object value, long ttl, TimeUnit timeUnit);

    void evict(String key);

    void evictAll();

    boolean containsKey(String key);
}
