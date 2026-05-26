package com.cacheproxy;

import com.cacheproxy.annotation.Cache;
import com.cacheproxy.core.CacheKeyGenerator;
import com.cacheproxy.core.CacheValueWrapper;
import com.cacheproxy.manager.TwoLevelCacheManager;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.util.DigestUtils;

import java.lang.reflect.Method;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@Slf4j
@SpringBootTest
class CacheKeyGeneratorTest {

    static class TestClass {
        @Cache(prefix = "test")
        public String testMethod(Long id, String name) {
            return id + ":" + name;
        }

        @Cache(prefix = "test", key = "#id + '_' + #name")
        public String testMethodWithSpel(Long id, String name) {
            return id + ":" + name;
        }

        @Cache(prefix = "test", key = "#p0")
        public String testMethodWithParamIndex(Long id) {
            return String.valueOf(id);
        }
    }

    @Test
    void testGenerateCacheName() throws Exception {
        Method method = TestClass.class.getMethod("testMethod", Long.class, String.class);
        Cache cache = method.getAnnotation(Cache.class);

        String nameWithPrefix = CacheKeyGenerator.generateCacheName(method, cache.prefix());
        assertEquals("test", nameWithPrefix);

        String nameWithoutPrefix = CacheKeyGenerator.generateCacheName(method, "");
        assertTrue(nameWithoutPrefix.contains("TestClass.testMethod"));
    }

    @Test
    void testGenerateDefaultKey() throws Exception {
        Method method = TestClass.class.getMethod("testMethod", Long.class, String.class);

        String expected = DigestUtils.md5DigestAsHex(
                (TestClass.class.getName() + ".testMethod(1,Alice)").getBytes()
        );

        ProceedingJoinPoint joinPoint = MockJoinPoint.create(method, new TestClass(), 1L, "Alice");

        String key = CacheKeyGenerator.generateKey("", "", joinPoint);
        assertEquals(expected, key);
    }

    @Test
    void testGenerateSpelKey() throws Exception {
        Method method = TestClass.class.getMethod("testMethodWithSpel", Long.class, String.class);
        ProceedingJoinPoint joinPoint = MockJoinPoint.create(method, new TestClass(), 1L, "Alice");

        String key = CacheKeyGenerator.generateKey("test", "#id + '_' + #name", joinPoint);
        assertEquals("test:1_Alice", key);
    }

    @Test
    void testGenerateSpelKeyWithParamIndex() throws Exception {
        Method method = TestClass.class.getMethod("testMethodWithParamIndex", Long.class);
        ProceedingJoinPoint joinPoint = MockJoinPoint.create(method, new TestClass(), 999L);

        String key = CacheKeyGenerator.generateKey("test", "#p0", joinPoint);
        assertEquals("test:999", key);
    }
}
