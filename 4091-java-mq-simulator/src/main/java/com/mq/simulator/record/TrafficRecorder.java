package com.mq.simulator.record;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.mq.simulator.config.MQConfig;
import com.mq.simulator.consumer.MessageConsumer;
import com.mq.simulator.consumer.MessageConsumerFactory;
import com.mq.simulator.core.MessageFormat;
import com.mq.simulator.core.MQType;
import com.mq.simulator.model.ConsumedMessage;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.RecordedMessage;
import com.mq.simulator.model.SendResult;
import com.mq.simulator.sender.MessageSender;
import com.mq.simulator.sender.MessageSenderFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

public class TrafficRecorder implements AutoCloseable {
    private static final Logger logger = LoggerFactory.getLogger(TrafficRecorder.class);

    private final ObjectMapper objectMapper;
    private final String recordingsDir;
    private final MQConfig config;

    private MessageConsumer consumer;
    private MessageSender sender;
    private volatile boolean recording = false;
    private volatile boolean replaying = false;
    private Thread recordingThread;
    private Thread replayThread;

    private AtomicLong recordingStartTime = new AtomicLong(0);
    private AtomicInteger recordedCount = new AtomicInteger(0);
    private AtomicInteger replayedCount = new AtomicInteger(0);
    private List<RecordedMessage> currentRecording;

    private Consumer<RecordedMessage> recordingListener;
    private Consumer<SendResult> replayResultListener;

    public TrafficRecorder(MQConfig config) {
        this(config, "recordings");
    }

    public TrafficRecorder(MQConfig config, String recordingsDir) {
        this.config = config;
        this.recordingsDir = recordingsDir;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);

        File dir = new File(recordingsDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
    }

    public void setRecordingListener(Consumer<RecordedMessage> listener) {
        this.recordingListener = listener;
    }

    public void setReplayResultListener(Consumer<SendResult> listener) {
        this.replayResultListener = listener;
    }

    public void startRecording(String topic) throws Exception {
        startRecording(Collections.singletonList(topic), null);
    }

    public void startRecording(List<String> topics, String pattern) throws Exception {
        if (recording) {
            logger.warn("Recording is already in progress");
            return;
        }

        currentRecording = Collections.synchronizedList(new ArrayList<>());
        recordedCount.set(0);
        recordingStartTime.set(System.currentTimeMillis());

        consumer = MessageConsumerFactory.createConsumer(config);
        consumer.init(config);
        consumer.connect();

        if (pattern != null && !pattern.isEmpty()) {
            consumer.subscribePattern(pattern);
        } else {
            consumer.subscribe(topics);
        }

        recording = true;
        recordingThread = new Thread(() -> {
            logger.info("Recording started for topics: {}", topics);

            try {
                consumer.start(message -> {
                    RecordedMessage recorded = convertToRecordedMessage(message);
                    recorded.setRelativeOffsetMs(System.currentTimeMillis() - recordingStartTime.get());

                    currentRecording.add(recorded);
                    recordedCount.incrementAndGet();

                    if (recordingListener != null) {
                        try {
                            recordingListener.accept(recorded);
                        } catch (Exception e) {
                            logger.error("Error in recording listener: {}", e.getMessage());
                        }
                    }
                });
            } catch (Exception e) {
                logger.error("Recording error: {}", e.getMessage(), e);
            }
        }, "traffic-recorder-thread");

        recordingThread.setDaemon(true);
        recordingThread.start();
    }

    public List<RecordedMessage> stopRecording() throws Exception {
        if (!recording) {
            logger.warn("No recording in progress");
            return Collections.emptyList();
        }

        recording = false;

        if (consumer != null) {
            consumer.stop();
            consumer.close();
            consumer = null;
        }

        if (recordingThread != null) {
            recordingThread.interrupt();
            recordingThread.join(2000);
        }

        logger.info("Recording stopped, recorded {} messages", recordedCount.get());
        return new ArrayList<>(currentRecording);
    }

    public String saveRecording(String name) throws IOException {
        if (currentRecording == null || currentRecording.isEmpty()) {
            throw new IllegalStateException("No recording to save");
        }

        RecordingPackage pkg = new RecordingPackage();
        pkg.setName(name);
        pkg.setMqType(config.getType());
        pkg.setRecordedAt(LocalDateTime.now());
        pkg.setMessageCount(currentRecording.size());
        pkg.setMessages(currentRecording);

        String fileName = name + "_" + System.currentTimeMillis() + ".json";
        Path path = Paths.get(recordingsDir, fileName);
        objectMapper.writeValue(path.toFile(), pkg);

        logger.info("Recording saved to: {}", path);
        return path.toString();
    }

    public RecordingPackage loadRecording(String filePath) throws IOException {
        return objectMapper.readValue(new File(filePath), RecordingPackage.class);
    }

    public List<RecordingPackage> listRecordings() throws IOException {
        List<RecordingPackage> packages = new ArrayList<>();
        Path dir = Paths.get(recordingsDir);

        if (!Files.exists(dir)) {
            return packages;
        }

        Files.list(dir)
                .filter(p -> p.toString().endsWith(".json"))
                .forEach(p -> {
                    try {
                        RecordingPackage pkg = objectMapper.readValue(p.toFile(), RecordingPackage.class);
                        pkg.setFilePath(p.toString());
                        packages.add(pkg);
                    } catch (IOException e) {
                        logger.error("Failed to load recording from {}: {}", p, e.getMessage());
                    }
                });

        return packages;
    }

    public void startReplay(String recordingPath, ReplayOptions options) throws Exception {
        if (replaying) {
            logger.warn("Replay is already in progress");
            return;
        }

        RecordingPackage pkg = loadRecording(recordingPath);
        startReplay(pkg, options);
    }

    public void startReplay(RecordingPackage pkg, ReplayOptions options) throws Exception {
        if (replaying) {
            logger.warn("Replay is already in progress");
            return;
        }

        if (options == null) {
            options = new ReplayOptions();
        }

        sender = MessageSenderFactory.createSender(config);
        sender.init(config);
        sender.connect();

        replaying = true;
        replayedCount.set(0);

        final ReplayOptions finalOptions = options;
        replayThread = new Thread(() -> {
            logger.info("Replay started: {}, loopCount={}, speedMultiplier={}",
                    pkg.getName(), finalOptions.getLoopCount(), finalOptions.getSpeedMultiplier());

            try {
                for (int loop = 0; loop < finalOptions.getLoopCount() || finalOptions.getLoopCount() < 0; loop++) {
                    if (!replaying) break;

                    long firstOffset = pkg.getMessages().isEmpty() ? 0 :
                            pkg.getMessages().get(0).getRelativeOffsetMs();

                    for (RecordedMessage recorded : pkg.getMessages()) {
                        if (!replaying) break;

                        if (finalOptions.getSpeedMultiplier() != 1.0) {
                            long adjustedOffset = (long) ((recorded.getRelativeOffsetMs() - firstOffset) /
                                    finalOptions.getSpeedMultiplier());
                            long sleepTime = adjustedOffset - (System.currentTimeMillis() - recordingStartTime.get());

                            if (sleepTime > 0) {
                                Thread.sleep(sleepTime);
                            }
                        } else {
                            long sleepTime = recorded.getRelativeOffsetMs() - (System.currentTimeMillis() - recordingStartTime.get());
                            if (sleepTime > 0) {
                                Thread.sleep(sleepTime);
                            }
                        }

                        if (finalOptions.getDelayMs() > 0) {
                            Thread.sleep(finalOptions.getDelayMs());
                        }

                        try {
                            Message message = recorded.toMessage();
                            if (finalOptions.getTargetTopic() != null && !finalOptions.getTargetTopic().isEmpty()) {
                                message.setTopic(finalOptions.getTargetTopic());
                            }
                            if (finalOptions.getHeaders() != null) {
                                message.getHeaders().putAll(finalOptions.getHeaders());
                            }

                            SendResult result = sender.send(message);
                            replayedCount.incrementAndGet();

                            if (replayResultListener != null) {
                                replayResultListener.accept(result);
                            }

                            if (!result.isSuccess()) {
                                logger.warn("Replay message failed: {}", result.getErrorMessage());
                            }
                        } catch (Exception e) {
                            logger.error("Replay error: {}", e.getMessage(), e);
                        }
                    }

                    logger.info("Loop {} completed, replayed {} messages so far", loop + 1, replayedCount.get());
                }
            } catch (InterruptedException e) {
                logger.info("Replay interrupted");
                Thread.currentThread().interrupt();
            } finally {
                replaying = false;
                logger.info("Replay completed, total {} messages replayed", replayedCount.get());
            }
        }, "traffic-replay-thread");

        recordingStartTime.set(System.currentTimeMillis());
        replayThread.setDaemon(true);
        replayThread.start();
    }

    public void stopReplay() {
        if (!replaying) {
            logger.warn("No replay in progress");
            return;
        }

        replaying = false;
        if (replayThread != null) {
            replayThread.interrupt();
            try {
                replayThread.join(2000);
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

        logger.info("Replay stopped, total {} messages replayed", replayedCount.get());
    }

    private RecordedMessage convertToRecordedMessage(ConsumedMessage consumed) {
        RecordedMessage recorded = new RecordedMessage();
        recorded.setId(consumed.getMessageId());
        recorded.setMqType(config.getType());
        recorded.setTopic(consumed.getTopic());
        recorded.setContent(consumed.getContent());
        recorded.setOriginalTimestamp(System.currentTimeMillis());
        recorded.setPartition(consumed.getPartition());
        recorded.setOffset(consumed.getOffset());
        recorded.setConsumerGroup(config.getGroupId());

        if (consumed.getContentType() != null) {
            if (consumed.getContentType().contains("json")) {
                recorded.setFormat(MessageFormat.JSON);
            } else if (consumed.getContentType().contains("xml")) {
                recorded.setFormat(MessageFormat.XML);
            } else if (consumed.getContentType().contains("avro")) {
                recorded.setFormat(MessageFormat.AVRO);
            } else if (consumed.getContentType().contains("protobuf")) {
                recorded.setFormat(MessageFormat.PROTOBUF);
            } else {
                recorded.setFormat(MessageFormat.PLAINTEXT);
            }
        } else {
            recorded.setFormat(detectFormat(consumed.getContent()));
        }

        return recorded;
    }

    private MessageFormat detectFormat(String content) {
        if (content == null) {
            return MessageFormat.PLAINTEXT;
        }

        String trimmed = content.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                objectMapper.readTree(trimmed);
                return MessageFormat.JSON;
            } catch (Exception e) {
                // Not valid JSON
            }
        }

        if (trimmed.startsWith("<")) {
            return MessageFormat.XML;
        }

        return MessageFormat.PLAINTEXT;
    }

    public boolean isRecording() {
        return recording;
    }

    public boolean isReplaying() {
        return replaying;
    }

    public int getRecordedCount() {
        return recordedCount.get();
    }

    public int getReplayedCount() {
        return replayedCount.get();
    }

    @Override
    public void close() {
        try {
            if (recording) {
                stopRecording();
            }
            if (replaying) {
                stopReplay();
            }
        } catch (Exception e) {
            logger.warn("Error during close: {}", e.getMessage());
        }
    }

    public static class ReplayOptions {
        private int loopCount = 1;
        private double speedMultiplier = 1.0;
        private long delayMs = 0;
        private String targetTopic;
        private java.util.Map<String, String> headers;

        public int getLoopCount() {
            return loopCount;
        }

        public ReplayOptions setLoopCount(int loopCount) {
            this.loopCount = loopCount;
            return this;
        }

        public double getSpeedMultiplier() {
            return speedMultiplier;
        }

        public ReplayOptions setSpeedMultiplier(double speedMultiplier) {
            this.speedMultiplier = speedMultiplier;
            return this;
        }

        public long getDelayMs() {
            return delayMs;
        }

        public ReplayOptions setDelayMs(long delayMs) {
            this.delayMs = delayMs;
            return this;
        }

        public String getTargetTopic() {
            return targetTopic;
        }

        public ReplayOptions setTargetTopic(String targetTopic) {
            this.targetTopic = targetTopic;
            return this;
        }

        public java.util.Map<String, String> getHeaders() {
            return headers;
        }

        public ReplayOptions setHeaders(java.util.Map<String, String> headers) {
            this.headers = headers;
            return this;
        }
    }

    public static class RecordingPackage {
        private String name;
        private MQType mqType;
        private LocalDateTime recordedAt;
        private int messageCount;
        private List<RecordedMessage> messages;
        private String filePath;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public MQType getMqType() {
            return mqType;
        }

        public void setMqType(MQType mqType) {
            this.mqType = mqType;
        }

        public LocalDateTime getRecordedAt() {
            return recordedAt;
        }

        public void setRecordedAt(LocalDateTime recordedAt) {
            this.recordedAt = recordedAt;
        }

        public int getMessageCount() {
            return messageCount;
        }

        public void setMessageCount(int messageCount) {
            this.messageCount = messageCount;
        }

        public List<RecordedMessage> getMessages() {
            return messages;
        }

        public void setMessages(List<RecordedMessage> messages) {
            this.messages = messages;
        }

        public String getFilePath() {
            return filePath;
        }

        public void setFilePath(String filePath) {
            this.filePath = filePath;
        }
    }
}
