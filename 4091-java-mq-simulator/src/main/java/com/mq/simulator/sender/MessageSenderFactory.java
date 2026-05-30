package com.mq.simulator.sender;

import com.mq.simulator.config.MQConfig;
import com.mq.simulator.core.MQType;

public class MessageSenderFactory {

    public static MessageSender createSender(MQType type) {
        switch (type) {
            case RABBITMQ:
                return new RabbitMQSender();
            case KAFKA:
                return new KafkaSender();
            case ROCKETMQ:
                throw new UnsupportedOperationException("RocketMQ sender not implemented yet");
            default:
                throw new IllegalArgumentException("Unknown MQ type: " + type);
        }
    }

    public static MessageSender createSender(MQConfig config) throws Exception {
        MessageSender sender = createSender(config.getType());
        sender.init(config);
        return sender;
    }
}
