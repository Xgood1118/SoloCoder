from typing import Optional

from .adapters import (
    KafkaPublisher, KafkaSubscriber, PulsarPublisher, PulsarSubscriber,
    RabbitMQPublisher, RabbitMQSubscriber,
)
from .config import MQConfig
from .models import MQType
from .publisher import BasePublisher
from .subscriber import BaseSubscriber
from .utils import logger


class MQFactory:
    _publisher_cache: Optional[BasePublisher] = None
    _subscriber_cache: Optional[BaseSubscriber] = None

    @staticmethod
    def create_publisher(mq_type: MQType, config: MQConfig) -> BasePublisher:
        publishers = {
            MQType.RABBITMQ: RabbitMQPublisher,
            MQType.KAFKA: KafkaPublisher,
            MQType.PULSAR: PulsarPublisher,
        }

        publisher_class = publishers.get(mq_type)
        if publisher_class:
            logger.info(f"Creating publisher for {mq_type.name}")
            return publisher_class(config)
        raise ValueError(f"Unsupported MQ type: {mq_type}")

    @staticmethod
    def create_subscriber(mq_type: MQType, config: MQConfig) -> BaseSubscriber:
        subscribers = {
            MQType.RABBITMQ: RabbitMQSubscriber,
            MQType.KAFKA: KafkaSubscriber,
            MQType.PULSAR: PulsarSubscriber,
        }

        subscriber_class = subscribers.get(mq_type)
        if subscriber_class:
            logger.info(f"Creating subscriber for {mq_type.name}")
            return subscriber_class(config)
        raise ValueError(f"Unsupported MQ type: {mq_type}")

    @classmethod
    def get_publisher(cls, mq_type: MQType, config: MQConfig, use_cache: bool = True) -> BasePublisher:
        if use_cache and cls._publisher_cache:
            return cls._publisher_cache
        publisher = MQFactory.create_publisher(mq_type, config)
        if use_cache:
            cls._publisher_cache = publisher
        return publisher

    @classmethod
    def get_subscriber(cls, mq_type: MQType, config: MQConfig, use_cache: bool = True) -> BaseSubscriber:
        if use_cache and cls._subscriber_cache:
            return cls._subscriber_cache
        subscriber = MQFactory.create_subscriber(mq_type, config)
        if use_cache:
            cls._subscriber_cache = subscriber
        return subscriber

    @classmethod
    def clear_cache(cls):
        cls._publisher_cache = None
        cls._subscriber_cache = None
