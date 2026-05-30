package com.featureflag.engine;

import com.google.common.hash.Hashing;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class PercentageCalculator {

    private static final int HASH_BUCKETS = 10000;

    public boolean isInPercentage(String userId, String flagKey, int percentage) {
        if (percentage <= 0) {
            return false;
        }
        if (percentage >= 100) {
            return true;
        }

        String combinedKey = userId + ":" + flagKey;
        long hash = Hashing.murmur3_128().hashString(combinedKey, StandardCharsets.UTF_8).asLong();
        int bucket = (int) ((Math.abs(hash) % HASH_BUCKETS) * 100 / HASH_BUCKETS);

        return bucket < percentage;
    }

    public int getBucket(String userId, String flagKey) {
        String combinedKey = userId + ":" + flagKey;
        long hash = Hashing.murmur3_128().hashString(combinedKey, StandardCharsets.UTF_8).asLong();
        return (int) ((Math.abs(hash) % HASH_BUCKETS) * 100 / HASH_BUCKETS);
    }
}
