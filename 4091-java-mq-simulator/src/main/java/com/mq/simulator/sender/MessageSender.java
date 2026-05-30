package com.mq.simulator.sender;

import com.mq.simulator.config.MQConfig;
import com.mq.simulator.model.Message;
import com.mq.simulator.model.SendResult;

import java.io.Closeable;
import java.util.List;

public interface MessageSender extends Closeable {

    void init(MQConfig config) throws Exception;

    SendResult send(Message message) throws Exception;

    List<SendResult> sendBatch(List<Message> messages) throws Exception;

    boolean isConnected();

    void connect() throws Exception;

    void disconnect();
}
