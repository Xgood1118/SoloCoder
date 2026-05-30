package com.mq.simulator.delay;

import com.mq.simulator.config.MQConfig;
import com.mq.simulator.core.DelayLevel;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.SendResult;
import com.mq.simulator.sender.MessageSender;
import com.mq.simulator.sender.MessageSenderFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

public class DelayMessageManager implements AutoCloseable {
    private static final Logger logger = LoggerFactory.getLogger(DelayMessageManager.class);

    private final MQConfig config;
    private final ScheduledExecutorService scheduler;
    private final ConcurrentHashMap<String, DelayMessageTracker> pendingMessages;
    private final Queue<DelayMessageTracker> delayQueue;

    private MessageSender sender;
    private volatile boolean running = false;
    private Thread dispatcherThread;

    private Consumer<SendResult> resultHandler;
    private Consumer<Message> delayHandler;

    public DelayMessageManager(MQConfig config) {
        this.config = config;
        this.pendingMessages = new ConcurrentHashMap<>();
        this.delayQueue = new ConcurrentLinkedQueue<>();
        this.scheduler = Executors.newScheduledThreadPool(4, new ThreadFactory() {
            private final AtomicInteger counter = new AtomicInteger(0);

            @Override
            public Thread newThread(Runnable r) {
                Thread t = new Thread(r, "delay-manager-" + counter.incrementAndGet());
                t.setDaemon(true);
                return t;
            }
        });
    }

    public void setResultHandler(Consumer<SendResult> handler) {
        this.resultHandler = handler;
    }

    public void setDelayHandler(Consumer<Message> handler) {
        this.delayHandler = handler;
    }

    public void start() throws Exception {
        if (running) {
            return;
        }

        sender = MessageSenderFactory.createSender(config);
        sender.init(config);
        sender.connect();

        running = true;

        dispatcherThread = new Thread(() -> {
            logger.info("Delay message dispatcher started");
            while (running) {
                try {
                    long now = System.currentTimeMillis();

                    DelayMessageTracker tracker;
                    while ((tracker = delayQueue.peek()) != null
                            && tracker.getScheduledSendTime() <= now) {

                        tracker = delayQueue.poll();
                        if (tracker != null && tracker.getStatus() == DelayStatus.PENDING) {
                            processDelayedMessage(tracker);
                        }
                    }

                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    logger.error("Error in delay dispatcher: {}", e.getMessage(), e);
                }
            }
            logger.info("Delay message dispatcher stopped");
        }, "delay-dispatcher");

        dispatcherThread.setDaemon(true);
        dispatcherThread.start();

        logger.info("Delay message manager started");
    }

    public DelayMessageTracker sendDelayedMessage(Message message, DelayLevel level) {
        return sendDelayedMessage(message, level.getDelayMillis());
    }

    public DelayMessageTracker sendDelayedMessage(Message message, long delayMillis) {
        if (!running) {
            throw new IllegalStateException("Delay manager is not started");
        }

        message.setCustomDelayMillis(delayMillis);

        DelayMessageTracker tracker = new DelayMessageTracker();
        tracker.setMessageId(message.getId());
        tracker.setMessage(message);
        tracker.setDelayMillis(delayMillis);
        tracker.setOriginalSendTime(System.currentTimeMillis());
        tracker.setScheduledSendTime(System.currentTimeMillis() + delayMillis);
        tracker.setStatus(DelayStatus.PENDING);

        pendingMessages.put(message.getId(), tracker);
        delayQueue.offer(tracker);

        if (delayHandler != null) {
            try {
                delayHandler.accept(message);
            } catch (Exception e) {
                logger.error("Error in delay handler: {}", e.getMessage());
            }
        }

        logger.info("Message scheduled for delayed delivery: {} in {}ms", message.getId(), delayMillis);
        return tracker;
    }

    private void processDelayedMessage(DelayMessageTracker tracker) {
        Message message = tracker.getMessage();
        tracker.setStatus(DelayStatus.SENDING);
        tracker.setActualSendTime(System.currentTimeMillis());

        try {
            message.setSentAt(LocalDateTime.now());
            SendResult result = sender.send(message);
            tracker.setStatus(DelayStatus.SENT);
            tracker.setSendResult(result);

            if (resultHandler != null) {
                resultHandler.accept(result);
            }

            logger.info("Delayed message sent: {}, delay accuracy: {}ms",
                    message.getId(), tracker.getDelayAccuracyMs());
        } catch (Exception e) {
            tracker.setStatus(DelayStatus.FAILED);
            tracker.setErrorMessage(e.getMessage());
            logger.error("Failed to send delayed message: {}", e.getMessage(), e);

            if (message.shouldRetry()) {
                message.incrementRetryCount();
                scheduleRetry(tracker);
            }
        } finally {
            pendingMessages.remove(message.getId());
        }
    }

    private void scheduleRetry(DelayMessageTracker tracker) {
        Message message = tracker.getMessage();
        long retryDelay = getBackoffDelay(message.getRetryCount());

        tracker.setStatus(DelayStatus.RETRYING);
        tracker.setRetryCount(message.getRetryCount());
        tracker.setScheduledSendTime(System.currentTimeMillis() + retryDelay);

        delayQueue.offer(tracker);
        pendingMessages.put(message.getId(), tracker);

        logger.info("Message scheduled for retry: {}, attempt {}, delay {}ms",
                message.getId(), message.getRetryCount(), retryDelay);
    }

    private long getBackoffDelay(int retryCount) {
        long baseDelay = 1000;
        return baseDelay * (1L << Math.min(retryCount - 1, 5));
    }

    public boolean cancelDelayedMessage(String messageId) {
        DelayMessageTracker tracker = pendingMessages.remove(messageId);
        if (tracker != null && tracker.getStatus() == DelayStatus.PENDING) {
            tracker.setStatus(DelayStatus.CANCELLED);
            delayQueue.remove(tracker);
            logger.info("Delayed message cancelled: {}", messageId);
            return true;
        }
        return false;
    }

    public DelayMessageTracker getMessageStatus(String messageId) {
        return pendingMessages.get(messageId);
    }

    public List<DelayMessageTracker> getPendingMessages() {
        return new ArrayList<>(pendingMessages.values());
    }

    public int getPendingCount() {
        return pendingMessages.size();
    }

    public void stop() {
        running = false;

        if (dispatcherThread != null) {
            dispatcherThread.interrupt();
            try {
                dispatcherThread.join(2000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        if (sender != null) {
            try {
                sender.close();
            } catch (Exception e) {
                logger.warn("Error closing sender: {}", e.getMessage());
            }
            sender = null;
        }

        logger.info("Delay message manager stopped");
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
    }

    public enum DelayStatus {
        PENDING,
        SENDING,
        SENT,
        RETRYING,
        FAILED,
        CANCELLED
    }

    public static class DelayMessageTracker {
        private String messageId;
        private Message message;
        private long delayMillis;
        private long originalSendTime;
        private long scheduledSendTime;
        private long actualSendTime;
        private DelayStatus status;
        private int retryCount;
        private SendResult sendResult;
        private String errorMessage;

        public String getMessageId() {
            return messageId;
        }

        public void setMessageId(String messageId) {
            this.messageId = messageId;
        }

        public Message getMessage() {
            return message;
        }

        public void setMessage(Message message) {
            this.message = message;
        }

        public long getDelayMillis() {
            return delayMillis;
        }

        public void setDelayMillis(long delayMillis) {
            this.delayMillis = delayMillis;
        }

        public long getOriginalSendTime() {
            return originalSendTime;
        }

        public void setOriginalSendTime(long originalSendTime) {
            this.originalSendTime = originalSendTime;
        }

        public long getScheduledSendTime() {
            return scheduledSendTime;
        }

        public void setScheduledSendTime(long scheduledSendTime) {
            this.scheduledSendTime = scheduledSendTime;
        }

        public long getActualSendTime() {
            return actualSendTime;
        }

        public void setActualSendTime(long actualSendTime) {
            this.actualSendTime = actualSendTime;
        }

        public long getDelayAccuracyMs() {
            if (actualSendTime == 0 || scheduledSendTime == 0) {
                return -1;
            }
            return actualSendTime - scheduledSendTime;
        }

        public DelayStatus getStatus() {
            return status;
        }

        public void setStatus(DelayStatus status) {
            this.status = status;
        }

        public int getRetryCount() {
            return retryCount;
        }

        public void setRetryCount(int retryCount) {
            this.retryCount = retryCount;
        }

        public SendResult getSendResult() {
            return sendResult;
        }

        public void setSendResult(SendResult sendResult) {
            this.sendResult = sendResult;
        }

        public String getErrorMessage() {
            return errorMessage;
        }

        public void setErrorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
        }
    }
}
