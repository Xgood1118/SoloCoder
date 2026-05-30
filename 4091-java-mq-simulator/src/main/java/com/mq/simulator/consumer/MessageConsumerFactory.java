package com.mq.simulator.consumer;

import com.mq.simulator.config.MQConfig;
import com.mq.simulator.core.MQType;

public class MessageConsumerFactory {

    public static MessageConsumer createConsumer(MQType type) {
        switch (type) {
            case RABBITMQ:
                return new RabbitMQConsumer();
            case KAFKA:
                return new KafkaConsumerImpl();
            case ROCKETMQ:
                throw new UnsupportedOperationException("RocketMQ consumer not implemented yet");
            default:
                throw new IllegalArgumentException("Unknown MQ type: " + type);
        }
    }

    public static MessageConsumer createConsumer(MQConfig config) throws Exception {
        MessageConsumer consumer = createConsumer(config.getType());
        consumer.init(config);
        return consumer;
    }
}
