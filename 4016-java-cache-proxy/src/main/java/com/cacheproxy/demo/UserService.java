package com.cacheproxy.demo;

import com.cacheproxy.annotation.Cache;
import com.cacheproxy.annotation.CacheEvict;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class UserService {

    private final Map<Long, User> userDatabase = new ConcurrentHashMap<>();

    public UserService() {
        userDatabase.put(1L, new User(1L, "Alice", "alice@example.com", LocalDateTime.now()));
        userDatabase.put(2L, new User(2L, "Bob", "bob@example.com", LocalDateTime.now()));
        userDatabase.put(3L, new User(3L, "Charlie", "charlie@example.com", LocalDateTime.now()));
    }

    @Cache(prefix = "user", key = "#id", l1Ttl = 60, l2Ttl = 300, timeUnit = TimeUnit.SECONDS)
    public User getUserById(Long id) {
        log.info("Querying database for user id: {}", id);
        simulateDatabaseLatency();
        return userDatabase.get(id);
    }

    @Cache(prefix = "user", key = "#p0 + '_' + #p1")
    public User getUserByNameAndEmail(String name, String email) {
        log.info("Querying database for user name: {} and email: {}", name, email);
        simulateDatabaseLatency();
        return userDatabase.values().stream()
                .filter(u -> u.getName().equals(name) && u.getEmail().equals(email))
                .findFirst()
                .orElse(null);
    }

    @CacheEvict(prefix = "user", key = "#user.id")
    public User updateUser(User user) {
        log.info("Updating user: {}", user);
        userDatabase.put(user.getId(), user);
        return user;
    }

    @CacheEvict(prefix = "user", allEntries = true)
    public void clearAllUsers() {
        log.info("Clearing all user caches");
    }

    @Cache(prefix = "user:expensive", key = "#id")
    public String getExpensiveData(Long id) {
        log.info("Performing expensive computation for id: {}", id);
        simulateExpensiveComputation();
        return "Expensive result for " + id + " at " + LocalDateTime.now();
    }

    private void simulateDatabaseLatency() {
        try {
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void simulateExpensiveComputation() {
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
