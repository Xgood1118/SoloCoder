package com.passwordmanager.service;

import com.passwordmanager.database.DatabaseHelper;
import javafx.application.Platform;
import java.sql.SQLException;
import java.util.Timer;
import java.util.TimerTask;

public class LockService {
    private static final int DEFAULT_LOCK_TIMEOUT_MINUTES = 15;
    private static final String SETTING_LOCK_TIMEOUT = "lock_timeout_minutes";

    private final DatabaseHelper dbHelper;
    private Timer lockTimer;
    private long lastActivityTime;
    private int lockTimeoutMinutes;
    private boolean isLocked;
    private Runnable onLockCallback;

    public LockService() {
        this.dbHelper = DatabaseHelper.getInstance();
        this.isLocked = false;
        loadLockTimeout();
        updateActivity();
    }

    public void setOnLockCallback(Runnable callback) {
        this.onLockCallback = callback;
    }

    private void loadLockTimeout() {
        try {
            String value = dbHelper.getSetting(SETTING_LOCK_TIMEOUT, String.valueOf(DEFAULT_LOCK_TIMEOUT_MINUTES));
            lockTimeoutMinutes = Integer.parseInt(value);
        } catch (SQLException | NumberFormatException e) {
            lockTimeoutMinutes = DEFAULT_LOCK_TIMEOUT_MINUTES;
        }
    }

    public int getLockTimeoutMinutes() {
        return lockTimeoutMinutes;
    }

    public void setLockTimeoutMinutes(int minutes) {
        this.lockTimeoutMinutes = minutes;
        try {
            dbHelper.setSetting(SETTING_LOCK_TIMEOUT, String.valueOf(minutes));
        } catch (SQLException e) {
        }
        restartTimer();
    }

    public void updateActivity() {
        lastActivityTime = System.currentTimeMillis();
        isLocked = false;
        restartTimer();
    }

    private void restartTimer() {
        if (lockTimer != null) {
            lockTimer.cancel();
        }
        lockTimer = new Timer("LockTimer");
        lockTimer.schedule(new TimerTask() {
            @Override
            public void run() {
                checkLock();
            }
        }, lockTimeoutMinutes * 60 * 1000L);
    }

    private void checkLock() {
        long currentTime = System.currentTimeMillis();
        long elapsed = currentTime - lastActivityTime;
        if (elapsed >= lockTimeoutMinutes * 60 * 1000L) {
            lock();
        } else {
            long remaining = lockTimeoutMinutes * 60 * 1000L - elapsed;
            lockTimer = new Timer("LockTimer");
            lockTimer.schedule(new TimerTask() {
                @Override
                public void run() {
                    checkLock();
                }
            }, remaining);
        }
    }

    public void lock() {
        isLocked = true;
        if (lockTimer != null) {
            lockTimer.cancel();
            lockTimer = null;
        }
        Platform.runLater(() -> {
            if (onLockCallback != null) {
                onLockCallback.run();
            }
        });
    }

    public void unlock() {
        isLocked = false;
        updateActivity();
    }

    public boolean isLocked() {
        return isLocked;
    }

    public long getRemainingTimeMs() {
        long elapsed = System.currentTimeMillis() - lastActivityTime;
        return Math.max(0, lockTimeoutMinutes * 60 * 1000L - elapsed);
    }

    public void shutdown() {
        if (lockTimer != null) {
            lockTimer.cancel();
        }
    }
}
