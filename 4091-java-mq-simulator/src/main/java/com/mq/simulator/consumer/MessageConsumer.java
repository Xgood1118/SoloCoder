package com.mq.simulator.consumer;

import com.mq.simulator.config.MQConfig;
import com.mq.simulator.model.ConsumedMessage;

import java.io.Closeable;
import java.util.List;
import java.util.function.Consumer;

public interface MessageConsumer extends Closeable {

    void init(MQConfig config) throws Exception;

    void subscribe(String topic) throws Exception;

    void subscribe(List<String> topics) throws Exception;

    void subscribePattern(String pattern) throws Exception;

    void unsubscribe() throws Exception;

    void start(Consumer<ConsumedMessage> messageHandler) throws Exception;

    void stop() throws Exception;

    List<ConsumedMessage> poll(int timeoutMs) throws Exception;

    boolean isRunning();

    boolean isConnected();

    void connect() throws Exception;

    void disconnect();

    void commitOffset() throws Exception;

    void seekToBeginning() throws Exception;

    void seekToEnd() throws Exception;
}
