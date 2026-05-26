package com.cacheproxy;

import com.cacheproxy.core.CacheValueWrapper;
import org.junit.jupiter.api.Test;

import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class CacheValueWrapperTest {

    @Test
    void testOfWithValue() {
        String value = "test";
        CacheValueWrapper wrapper = CacheValueWrapper.of(value, 1000);

        assertEquals(value, wrapper.getValue());
        assertFalse(wrapper.isNullValue());
        assertTrue(wrapper.getCreateTime() > 0);
        assertTrue(wrapper.getExpireTime() > wrapper.getCreateTime());
        assertFalse(wrapper.isExpired());
    }

    @Test
    void testOfWithNull() {
        CacheValueWrapper wrapper = CacheValueWrapper.of(null, 1000);

        assertNull(wrapper.getValue());
        assertTrue(wrapper.isNullValue());
        assertFalse(wrapper.isExpired());
    }

    @Test
    void testIsExpired() throws InterruptedException {
        CacheValueWrapper wrapper = CacheValueWrapper.of("test", 100);
        assertFalse(wrapper.isExpired());

        Thread.sleep(150);
        assertTrue(wrapper.isExpired());
    }

    @Test
    void testTtlConversion() {
        long ttlSeconds = 60;
        CacheValueWrapper wrapper = CacheValueWrapper.of("test", TimeUnit.SECONDS.toMillis(ttlSeconds));
        long expectedExpire = wrapper.getCreateTime() + ttlSeconds * 1000;
        assertEquals(expectedExpire, wrapper.getExpireTime(), 10);
    }
}
