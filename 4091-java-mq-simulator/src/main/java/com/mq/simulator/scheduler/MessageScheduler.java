package com.mq.simulator.scheduler;

import com.mq.simulator.config.MQConfig;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.SendResult;
import com.mq.simulator.sender.MessageSender;
import com.mq.simulator.sender.MessageSenderFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

public class MessageScheduler implements AutoCloseable {
    private static final Logger logger = LoggerFactory.getLogger(MessageScheduler.class);

    private final ScheduledExecutorService scheduler;
    private final MessageSender sender;
    private final MQConfig config;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final List<ScheduledFuture<?>> scheduledTasks = new ArrayList<>();

    private Consumer<SendResult> resultHandler;
    private Consumer<Throwable> errorHandler;

    public MessageScheduler(MQConfig config) throws Exception {
        this.config = config;
        this.sender = MessageSenderFactory.createSender(config);
        this.sender.init(config);
        this.sender.connect();

        this.scheduler = Executors.newScheduledThreadPool(Runtime.getRuntime().availableProcessors() * 2,
                new ThreadFactory() {
                    private final AtomicInteger counter = new AtomicInteger(0);

                    @Override
                    public Thread newThread(Runnable r) {
                        Thread t = new Thread(r, "mq-scheduler-" + counter.incrementAndGet());
                        t.setDaemon(true);
                        return t;
                    }
                });

        logger.info("Message scheduler initialized for {}", config.getType());
    }

    public void setResultHandler(Consumer<SendResult> resultHandler) {
        this.resultHandler = resultHandler;
    }

    public void setErrorHandler(Consumer<Throwable> errorHandler) {
        this.errorHandler = errorHandler;
    }

    public ScheduledFuture<?> scheduleAtFixedTime(Message message, LocalDateTime scheduledTime) {
        long delay = LocalDateTime.now().until(scheduledTime, ChronoUnit.MILLIS);
        if (delay < 0) {
            throw new IllegalArgumentException("Scheduled time is in the past");
        }

        ScheduledFuture<?> future = scheduler.schedule(() -> {
            try {
                sendMessage(message);
            } catch (Exception e) {
                handleError(e);
            }
        }, delay, TimeUnit.MILLISECONDS);

        scheduledTasks.add(future);
        logger.info("Message scheduled at {} (delay {}ms)", scheduledTime, delay);
        return future;
    }

    public ScheduledFuture<?> scheduleAtInterval(Message message, int messagesPerSecond, long durationMs) {
        return scheduleAtInterval(message, messagesPerSecond, durationMs, false);
    }

    public ScheduledFuture<?> scheduleAtInterval(Message message, int messagesPerSecond, long durationMs,
                                                 boolean autoStop) {
        if (messagesPerSecond <= 0) {
            throw new IllegalArgumentException("messagesPerSecond must be positive");
        }

        long intervalMs = 1000 / messagesPerSecond;
        AtomicInteger counter = new AtomicInteger(0);
        AtomicLong startTime = new AtomicLong(System.currentTimeMillis());
        AtomicBoolean shouldStop = new AtomicBoolean(false);

        Runnable task = () -> {
            if (shouldStop.get() || (autoStop && System.currentTimeMillis() - startTime.get() > durationMs)) {
                shouldStop.set(true);
                return;
            }

            try {
                Message msg = cloneMessage(message);
                msg.setId(java.util.UUID.randomUUID().toString());
                sendMessage(msg);
                counter.incrementAndGet();
            } catch (Exception e) {
                handleError(e);
            }
        };

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(task, 0, intervalMs, TimeUnit.MILLISECONDS);
        scheduledTasks.add(future);

        logger.info("Interval scheduling started: {} messages/second, interval {}ms", messagesPerSecond, intervalMs);

        if (autoStop) {
            scheduler.schedule(() -> {
                future.cancel(false);
                logger.info("Interval scheduling stopped after {}ms, sent {} messages",
                        durationMs, counter.get());
            }, durationMs, TimeUnit.MILLISECONDS);
        }

        return future;
    }

    public ScheduledFuture<?> scheduleBurst(Message message, int burstCount, long delayMs) {
        AtomicInteger counter = new AtomicInteger(0);

        ScheduledFuture<?> future = scheduler.schedule(() -> {
            List<Message> batch = new ArrayList<>();
            for (int i = 0; i < burstCount; i++) {
                Message msg = cloneMessage(message);
                msg.setId(java.util.UUID.randomUUID().toString());
                batch.add(msg);
            }

            try {
                List<SendResult> results = sender.sendBatch(batch);
                for (SendResult result : results) {
                    handleResult(result);
                    counter.incrementAndGet();
                }
                logger.info("Burst sending completed: {} messages sent", counter.get());
            } catch (Exception e) {
                handleError(e);
            }
        }, delayMs, TimeUnit.MILLISECONDS);

        scheduledTasks.add(future);
        logger.info("Burst scheduling: {} messages after {}ms", burstCount, delayMs);
        return future;
    }

    public ScheduledFuture<?> scheduleWarmup(Message message, int initialRate, int targetRate,
                                             int warmupDurationSeconds, int totalDurationSeconds) {
        AtomicLong startTime = new AtomicLong(System.currentTimeMillis());
        AtomicInteger currentRate = new AtomicInteger(initialRate);
        AtomicBoolean shouldStop = new AtomicBoolean(false);

        long warmupDurationMs = warmupDurationSeconds * 1000L;
        long totalDurationMs = totalDurationSeconds * 1000L;
        double rateIncreasePerMs = (double) (targetRate - initialRate) / warmupDurationMs;

        Runnable task = new Runnable() {
            @Override
            public void run() {
                if (shouldStop.get()) {
                    return;
                }

                long elapsed = System.currentTimeMillis() - startTime.get();

                if (elapsed > totalDurationMs) {
                    shouldStop.set(true);
                    logger.info("Warmup scheduling completed after {}s", totalDurationSeconds);
                    return;
                }

                int newRate;
                if (elapsed < warmupDurationMs) {
                    newRate = (int) (initialRate + rateIncreasePerMs * elapsed);
                } else {
                    newRate = targetRate;
                }

                if (newRate != currentRate.get()) {
                    currentRate.set(newRate);
                    logger.debug("Warmup rate adjusted to: {} messages/second", newRate);
                }

                try {
                    Message msg = cloneMessage(message);
                    msg.setId(java.util.UUID.randomUUID().toString());
                    sendMessage(msg);
                } catch (Exception e) {
                    handleError(e);
                }

                if (!shouldStop.get()) {
                    long delay = 1000 / Math.max(1, currentRate.get());
                    scheduler.schedule(this, delay, TimeUnit.MILLISECONDS);
                }
            }
        };

        scheduler.submit(task);
        logger.info("Warmup scheduling started: {} -> {} messages/second over {}s",
                initialRate, targetRate, warmupDurationSeconds);

        return null;
    }

    public ScheduledFuture<?> scheduleCustomRate(Message message, int messagesPerSecond, long durationMs) {
        AtomicLong startTime = new AtomicLong(System.currentTimeMillis());
        AtomicInteger sentCount = new AtomicInteger(0);
        AtomicBoolean shouldStop = new AtomicBoolean(false);

        long nanosPerMessage = 1_000_000_000L / Math.max(1, messagesPerSecond);

        Runnable task = new Runnable() {
            @Override
            public void run() {
                long elapsed = System.currentTimeMillis() - startTime.get();

                if (elapsed > durationMs) {
                    shouldStop.set(true);
                    logger.info("Custom rate scheduling stopped after {}ms, sent {} messages",
                            durationMs, sentCount.get());
                    return;
                }

                try {
                    Message msg = cloneMessage(message);
                    msg.setId(java.util.UUID.randomUUID().toString());
                    sendMessage(msg);
                    sentCount.incrementAndGet();
                } catch (Exception e) {
                    handleError(e);
                }

                if (!shouldStop.get()) {
                    long expectedSent = (elapsed * messagesPerSecond) / 1000;
                    long delay = nanosPerMessage;

                    if (sentCount.get() > expectedSent) {
                        delay = nanosPerMessage + 1_000_000L;
                    } else if (sentCount.get() < expectedSent) {
                        delay = Math.max(0, nanosPerMessage - 100_000L);
                    }

                    scheduler.schedule(this, delay, TimeUnit.NANOSECONDS);
                }
            }
        };

        scheduler.submit(task);
        logger.info("Custom rate scheduling started: {} messages/second for {}ms",
                messagesPerSecond, durationMs);

        return null;
    }

    private Message cloneMessage(Message original) {
        Message clone = new Message();
        clone.setMqType(original.getMqType());
        clone.setFormat(original.getFormat());
        clone.setTopic(original.getTopic());
        clone.setExchange(original.getExchange());
        clone.setRoutingKey(original.getRoutingKey());
        clone.setQueue(original.getQueue());
        clone.setContent(original.getContent());
        clone.getHeaders().putAll(original.getHeaders());
        clone.getProperties().putAll(original.getProperties());
        clone.setDelayLevel(original.getDelayLevel());
        clone.setCustomDelayMillis(original.getCustomDelayMillis());
        clone.setMaxRetryCount(original.getMaxRetryCount());
        return clone;
    }

    private void sendMessage(Message message) throws Exception {
        SendResult result = sender.send(message);
        handleResult(result);
    }

    private void handleResult(SendResult result) {
        if (resultHandler != null) {
            try {
                resultHandler.accept(result);
            } catch (Exception e) {
                logger.error("Error in result handler: {}", e.getMessage(), e);
            }
        }
    }

    private void handleError(Throwable t) {
        logger.error("Scheduling error: {}", t.getMessage(), t);
        if (errorHandler != null) {
            try {
                errorHandler.accept(t);
            } catch (Exception e) {
                logger.error("Error in error handler: {}", e.getMessage(), e);
            }
        }
    }

    public void start() {
        running.set(true);
        logger.info("Message scheduler started");
    }

    public void stop() {
        running.set(false);
        for (ScheduledFuture<?> task : scheduledTasks) {
            task.cancel(false);
        }
        scheduledTasks.clear();
        logger.info("Message scheduler stopped");
    }

    public boolean isRunning() {
        return running.get();
    }

    @Override
    public void close() {
        stop();
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
        }
        try {
            sender.close();
        } catch (Exception e) {
            logger.warn("Error closing sender: {}", e.getMessage());
        }
        logger.info("Message scheduler closed");
    }
}
