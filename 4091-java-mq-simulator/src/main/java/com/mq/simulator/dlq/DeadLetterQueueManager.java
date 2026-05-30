package com.mq.simulator.dlq;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.mq.simulator.config.MQConfig;
import com.mq.simulator.model.ConsumedMessage;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.SendResult;
import com.mq.simulator.sender.MessageSender;
import com.mq.simulator.sender.MessageSenderFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

public class DeadLetterQueueManager implements AutoCloseable {
    private static final Logger logger = LoggerFactory.getLogger(DeadLetterQueueManager.class);

    private final MQConfig config;
    private final String dlqDir;
    private final ObjectMapper objectMapper;
    private final Queue<DLQEntry> dlq;
    private final ConcurrentHashMap<String, DLQEntry> dlqIndex;
    private final ScheduledExecutorService scheduler;

    private MessageSender sender;
    private volatile boolean running = false;
    private int maxRetryCount = 3;
    private long retryIntervalMs = 5000;
    private String dlqTopic = "DLQ";
    private String dlqExchange = "dlq.exchange";
    private String dlqRoutingKey = "dlq";

    private Consumer<DLQEntry> dlqHandler;
    private Consumer<SendResult> reprocessHandler;

    public DeadLetterQueueManager(MQConfig config) {
        this(config, "dlq");
    }

    public DeadLetterQueueManager(MQConfig config, String dlqDir) {
        this.config = config;
        this.dlqDir = dlqDir;
        this.dlq = new ConcurrentLinkedQueue<>();
        this.dlqIndex = new ConcurrentHashMap<>();
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "dlq-reprocessor");
            t.setDaemon(true);
            return t;
        });

        File dir = new File(dlqDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }

        loadDLQFromDisk();
    }

    private void loadDLQFromDisk() {
        try {
            Path dir = Paths.get(dlqDir);
            if (!Files.exists(dir)) {
                return;
            }

            Files.list(dir)
                    .filter(p -> p.toString().endsWith(".json"))
                    .forEach(p -> {
                        try {
                            DLQEntry entry = objectMapper.readValue(p.toFile(), DLQEntry.class);
                            entry.setFilePath(p.toString());
                            dlq.offer(entry);
                            dlqIndex.put(entry.getId(), entry);
                        } catch (IOException e) {
                            logger.error("Failed to load DLQ entry from {}: {}", p, e.getMessage());
                        }
                    });

            logger.info("Loaded {} DLQ entries from disk", dlq.size());
        } catch (IOException e) {
            logger.error("Failed to scan DLQ directory: {}", e.getMessage());
        }
    }

    public void start() throws Exception {
        if (running) {
            return;
        }

        sender = MessageSenderFactory.createSender(config);
        sender.init(config);
        sender.connect();
        running = true;

        logger.info("Dead letter queue manager started, DLQ size: {}", dlq.size());
    }

    public DLQEntry sendToDLQ(Message message, String errorMessage) {
        return sendToDLQ(message, errorMessage, null);
    }

    public DLQEntry sendToDLQ(Message message, String errorMessage, Exception exception) {
        DLQEntry entry = new DLQEntry();
        entry.setId(java.util.UUID.randomUUID().toString());
        entry.setOriginalMessageId(message.getId());
        entry.setMessage(message);
        entry.setOriginalTopic(message.getTopic());
        entry.setOriginalRoutingKey(message.getRoutingKey());
        entry.setOriginalExchange(message.getExchange());
        entry.setRetryCount(message.getRetryCount());
        entry.setMaxRetryCount(message.getMaxRetryCount());
        entry.setErrorMessage(errorMessage);
        entry.setExceptionStack(exception != null ? getStackTrace(exception) : null);
        entry.setReceivedAt(LocalDateTime.now());
        entry.setStatus(DLQStatus.PENDING);

        dlq.offer(entry);
        dlqIndex.put(entry.getId(), entry);
        saveDLQEntry(entry);

        if (dlqHandler != null) {
            try {
                dlqHandler.accept(entry);
            } catch (Exception e) {
                logger.error("Error in DLQ handler: {}", e.getMessage());
            }
        }

        logger.warn("Message sent to DLQ: {}, reason: {}", message.getId(), errorMessage);
        return entry;
    }

    public DLQEntry sendToDLQ(ConsumedMessage consumedMessage, String errorMessage) {
        Message message = new Message();
        message.setId(consumedMessage.getMessageId());
        message.setTopic(consumedMessage.getTopic());
        message.setContent(consumedMessage.getContent());
        message.setMqType(config.getType());

        DLQEntry entry = new DLQEntry();
        entry.setId(java.util.UUID.randomUUID().toString());
        entry.setOriginalMessageId(consumedMessage.getMessageId());
        entry.setMessage(message);
        entry.setOriginalTopic(consumedMessage.getTopic());
        entry.setErrorMessage(errorMessage);
        entry.setReceivedAt(LocalDateTime.now());
        entry.setStatus(DLQStatus.PENDING);

        dlq.offer(entry);
        dlqIndex.put(entry.getId(), entry);
        saveDLQEntry(entry);

        logger.warn("Consumed message sent to DLQ: {}, reason: {}", consumedMessage.getMessageId(), errorMessage);
        return entry;
    }

    public List<DLQEntry> listDLQEntries() {
        return new ArrayList<>(dlq);
    }

    public List<DLQEntry> listDLQEntries(DLQStatus status) {
        List<DLQEntry> result = new ArrayList<>();
        for (DLQEntry entry : dlq) {
            if (entry.getStatus() == status) {
                result.add(entry);
            }
        }
        return result;
    }

    public DLQEntry getDLQEntry(String id) {
        return dlqIndex.get(id);
    }

    public DLQEntry peekOldest() {
        return dlq.peek();
    }

    public DLQEntry pollOldest() {
        DLQEntry entry = dlq.poll();
        if (entry != null) {
            dlqIndex.remove(entry.getId());
        }
        return entry;
    }

    public ReprocessResult reprocessMessage(String dlqId) throws Exception {
        DLQEntry entry = dlqIndex.get(dlqId);
        if (entry == null) {
            throw new IllegalArgumentException("DLQ entry not found: " + dlqId);
        }

        if (!running) {
            throw new IllegalStateException("DLQ manager is not started");
        }

        entry.setStatus(DLQStatus.REPROCESSING);
        entry.setReprocessCount(entry.getReprocessCount() + 1);
        entry.setLastReprocessAt(LocalDateTime.now());

        try {
            Message message = entry.getMessage();
            message.setId(java.util.UUID.randomUUID().toString());

            if (entry.getOriginalTopic() != null) {
                message.setTopic(entry.getOriginalTopic());
            }
            if (entry.getOriginalRoutingKey() != null) {
                message.setRoutingKey(entry.getOriginalRoutingKey());
            }
            if (entry.getOriginalExchange() != null) {
                message.setExchange(entry.getOriginalExchange());
            }

            SendResult result = sender.send(message);
            entry.setStatus(result.isSuccess() ? DLQStatus.REPROCESSED : DLQStatus.FAILED);
            entry.setLastReprocessResult(result);

            if (reprocessHandler != null) {
                reprocessHandler.accept(result);
            }

            saveDLQEntry(entry);

            if (result.isSuccess()) {
                dlq.remove(entry);
                dlqIndex.remove(dlqId);
                deleteDLQFile(entry);
                logger.info("Message reprocessed successfully: {}", dlqId);
            } else {
                logger.warn("Message reprocessing failed: {}", result.getErrorMessage());
            }

            return new ReprocessResult(result, entry);
        } catch (Exception e) {
            entry.setStatus(DLQStatus.FAILED);
            entry.setErrorMessage(e.getMessage());
            saveDLQEntry(entry);
            logger.error("Message reprocessing error: {}", e.getMessage(), e);
            throw e;
        }
    }

    public int reprocessAll() throws Exception {
        return reprocessAll(Integer.MAX_VALUE);
    }

    public int reprocessAll(int maxCount) throws Exception {
        if (!running) {
            throw new IllegalStateException("DLQ manager is not started");
        }

        int successCount = 0;
        int processed = 0;
        List<DLQEntry> entries = new ArrayList<>(dlq);

        for (DLQEntry entry : entries) {
            if (processed >= maxCount) {
                break;
            }

            try {
                ReprocessResult result = reprocessMessage(entry.getId());
                if (result.getSendResult().isSuccess()) {
                    successCount++;
                }
                processed++;
            } catch (Exception e) {
                logger.error("Error reprocessing message {}: {}", entry.getId(), e.getMessage());
            }
        }

        logger.info("Batch reprocessing completed: {}/{} succeeded", successCount, processed);
        return successCount;
    }

    public void startAutoReprocess(long intervalMs, int batchSize) {
        scheduler.scheduleAtFixedRate(() -> {
            if (!running) return;

            List<DLQEntry> candidates = listDLQEntries(DLQStatus.PENDING);
            Collections.sort(candidates, (a, b) -> a.getReceivedAt().compareTo(b.getReceivedAt()));

            int count = Math.min(batchSize, candidates.size());
            int success = 0;

            for (int i = 0; i < count; i++) {
                try {
                    DLQEntry entry = candidates.get(i);
                    if (System.currentTimeMillis() - entry.getReceivedAt().atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
                            < retryIntervalMs) {
                        continue;
                    }

                    ReprocessResult result = reprocessMessage(entry.getId());
                    if (result.getSendResult().isSuccess()) {
                        success++;
                    }
                } catch (Exception e) {
                    logger.error("Auto-reprocess error: {}", e.getMessage());
                }
            }

            if (success > 0) {
                logger.info("Auto-reprocess batch completed: {} succeeded", success);
            }
        }, intervalMs, intervalMs, TimeUnit.MILLISECONDS);

        logger.info("Auto-reprocess started with interval {}ms, batch size {}", intervalMs, batchSize);
    }

    public boolean deleteDLQEntry(String id) {
        DLQEntry entry = dlqIndex.remove(id);
        if (entry != null) {
            dlq.remove(entry);
            deleteDLQFile(entry);
            logger.info("DLQ entry deleted: {}", id);
            return true;
        }
        return false;
    }

    private void saveDLQEntry(DLQEntry entry) {
        try {
            String fileName = entry.getId() + ".json";
            Path path = Paths.get(dlqDir, fileName);
            entry.setFilePath(path.toString());
            objectMapper.writeValue(path.toFile(), entry);
        } catch (IOException e) {
            logger.error("Failed to save DLQ entry: {}", e.getMessage());
        }
    }

    private void deleteDLQFile(DLQEntry entry) {
        if (entry.getFilePath() != null) {
            try {
                Files.deleteIfExists(Paths.get(entry.getFilePath()));
            } catch (IOException e) {
                logger.warn("Failed to delete DLQ file: {}", e.getMessage());
            }
        }
    }

    private String getStackTrace(Exception e) {
        java.io.StringWriter sw = new java.io.StringWriter();
        java.io.PrintWriter pw = new java.io.PrintWriter(sw);
        e.printStackTrace(pw);
        return sw.toString();
    }

    public void stop() {
        running = false;
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
        }

        if (sender != null) {
            try {
                sender.close();
            } catch (Exception e) {
                logger.warn("Error closing sender: {}", e.getMessage());
            }
            sender = null;
        }

        logger.info("Dead letter queue manager stopped");
    }

    @Override
    public void close() {
        stop();
    }

    public int getMaxRetryCount() {
        return maxRetryCount;
    }

    public void setMaxRetryCount(int maxRetryCount) {
        this.maxRetryCount = maxRetryCount;
    }

    public long getRetryIntervalMs() {
        return retryIntervalMs;
    }

    public void setRetryIntervalMs(long retryIntervalMs) {
        this.retryIntervalMs = retryIntervalMs;
    }

    public String getDlqTopic() {
        return dlqTopic;
    }

    public void setDlqTopic(String dlqTopic) {
        this.dlqTopic = dlqTopic;
    }

    public String getDlqExchange() {
        return dlqExchange;
    }

    public void setDlqExchange(String dlqExchange) {
        this.dlqExchange = dlqExchange;
    }

    public String getDlqRoutingKey() {
        return dlqRoutingKey;
    }

    public void setDlqRoutingKey(String dlqRoutingKey) {
        this.dlqRoutingKey = dlqRoutingKey;
    }

    public void setDlqHandler(Consumer<DLQEntry> dlqHandler) {
        this.dlqHandler = dlqHandler;
    }

    public void setReprocessHandler(Consumer<SendResult> reprocessHandler) {
        this.reprocessHandler = reprocessHandler;
    }

    public int getDLQSize() {
        return dlq.size();
    }

    public enum DLQStatus {
        PENDING,
        REPROCESSING,
        REPROCESSED,
        FAILED,
        ARCHIVED
    }

    public static class DLQEntry {
        private String id;
        private String originalMessageId;
        private Message message;
        private String originalTopic;
        private String originalRoutingKey;
        private String originalExchange;
        private int retryCount;
        private int maxRetryCount;
        private String errorMessage;
        private String exceptionStack;
        private LocalDateTime receivedAt;
        private DLQStatus status;
        private int reprocessCount;
        private LocalDateTime lastReprocessAt;
        private SendResult lastReprocessResult;
        private String filePath;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getOriginalMessageId() {
            return originalMessageId;
        }

        public void setOriginalMessageId(String originalMessageId) {
            this.originalMessageId = originalMessageId;
        }

        public Message getMessage() {
            return message;
        }

        public void setMessage(Message message) {
            this.message = message;
        }

        public String getOriginalTopic() {
            return originalTopic;
        }

        public void setOriginalTopic(String originalTopic) {
            this.originalTopic = originalTopic;
        }

        public String getOriginalRoutingKey() {
            return originalRoutingKey;
        }

        public void setOriginalRoutingKey(String originalRoutingKey) {
            this.originalRoutingKey = originalRoutingKey;
        }

        public String getOriginalExchange() {
            return originalExchange;
        }

        public void setOriginalExchange(String originalExchange) {
            this.originalExchange = originalExchange;
        }

        public int getRetryCount() {
            return retryCount;
        }

        public void setRetryCount(int retryCount) {
            this.retryCount = retryCount;
        }

        public int getMaxRetryCount() {
            return maxRetryCount;
        }

        public void setMaxRetryCount(int maxRetryCount) {
            this.maxRetryCount = maxRetryCount;
        }

        public String getErrorMessage() {
            return errorMessage;
        }

        public void setErrorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
        }

        public String getExceptionStack() {
            return exceptionStack;
        }

        public void setExceptionStack(String exceptionStack) {
            this.exceptionStack = exceptionStack;
        }

        public LocalDateTime getReceivedAt() {
            return receivedAt;
        }

        public void setReceivedAt(LocalDateTime receivedAt) {
            this.receivedAt = receivedAt;
        }

        public DLQStatus getStatus() {
            return status;
        }

        public void setStatus(DLQStatus status) {
            this.status = status;
        }

        public int getReprocessCount() {
            return reprocessCount;
        }

        public void setReprocessCount(int reprocessCount) {
            this.reprocessCount = reprocessCount;
        }

        public LocalDateTime getLastReprocessAt() {
            return lastReprocessAt;
        }

        public void setLastReprocessAt(LocalDateTime lastReprocessAt) {
            this.lastReprocessAt = lastReprocessAt;
        }

        public SendResult getLastReprocessResult() {
            return lastReprocessResult;
        }

        public void setLastReprocessResult(SendResult lastReprocessResult) {
            this.lastReprocessResult = lastReprocessResult;
        }

        public String getFilePath() {
            return filePath;
        }

        public void setFilePath(String filePath) {
            this.filePath = filePath;
        }
    }

    public static class ReprocessResult {
        private final SendResult sendResult;
        private final DLQEntry dlqEntry;

        public ReprocessResult(SendResult sendResult, DLQEntry dlqEntry) {
            this.sendResult = sendResult;
            this.dlqEntry = dlqEntry;
        }

        public SendResult getSendResult() {
            return sendResult;
        }

        public DLQEntry getDlqEntry() {
            return dlqEntry;
        }
    }
}
