from __future__ import annotations

from typing import Any, List, Optional

from .config import MQConfig
from .factory import MQFactory
from .models import (
    AckMode,
    AsyncMessageCallback,
    Message,
    MessageProperties,
    MQType,
    PublishResult,
    SubscriberMode,
)
from .publisher import BasePublisher
from .subscriber import BaseSubscriber
from .utils import logger


class MQBroker:
    def __init__(
        self,
        mq_type: MQType,
        config: Optional[MQConfig] = None,
        use_cache: bool = True,
    ):
        self.mq_type = mq_type
        self.config = config or MQConfig()
        self._publisher: Optional[BasePublisher] = None
        self._subscriber: Optional[BaseSubscriber] = None
        self._use_cache = use_cache
        self._started = False

    async def connect_publisher(self) -> None:
        if self._publisher and self._publisher.is_connected():
            return
        self._publisher = MQFactory.get_publisher(
            self.mq_type,
            self.config,
            use_cache=self._use_cache,
        )
        await self._publisher.connect()
        await self._publisher.start()
        logger.info("Publisher connected and started")

    async def connect_subscriber(self) -> None:
        if self._subscriber and self._subscriber.is_connected():
            return
        self._subscriber = MQFactory.get_subscriber(
            self.mq_type,
            self.config,
            use_cache=self._use_cache,
        )
        await self._subscriber.connect()
        await self._subscriber.start()
        logger.info("Subscriber connected and started")

    async def publish(
        self,
        topic: str,
        body: bytes | str | Any,
        properties: Optional[MessageProperties] = None,
    ) -> PublishResult:
        if not self._publisher:
            await self.connect_publisher()
        return await self._publisher.publish(topic, body, properties)

    async def publish_batch(self, messages: List[Message]) -> List[PublishResult]:
        if not self._publisher:
            await self.connect_publisher()
        return await self._publisher.publish_batch(messages)

    async def subscribe(
        self,
        topic: str,
        callback: AsyncMessageCallback,
        consumer_group: Optional[str] = None,
        mode: SubscriberMode = SubscriberMode.PUSH,
        ack_mode: AckMode = AckMode.AUTO,
    ) -> None:
        if not self._subscriber:
            await self.connect_subscriber()
        await self._subscriber.subscribe(
            topic=topic,
            callback=callback,
            consumer_group=consumer_group,
            mode=mode,
            ack_mode=ack_mode,
        )

    async def unsubscribe(self, topic: str) -> None:
        if self._subscriber:
            await self._subscriber.unsubscribe(topic)

    async def poll(
        self,
        topic: str,
        max_messages: int = 10,
        timeout: float = 1.0,
    ) -> List[Message]:
        if not self._subscriber:
            await self.connect_subscriber()
        return await self._subscriber.poll(
            topic=topic,
            max_messages=max_messages,
            timeout=timeout,
        )

    async def ack(self, message: Message) -> None:
        if self._subscriber:
            await self._subscriber.ack(message)

    async def nack(self, message: Message, requeue: bool = False) -> None:
        if self._subscriber:
            await self._subscriber.nack(message, requeue=requeue)

    def set_filter(self, filter_expression: str) -> None:
        if self._subscriber:
            self._subscriber.set_filter(filter_expression)

    def set_transform(self, transform_func: Any) -> None:
        if self._subscriber:
            self._subscriber.set_transform(transform_func)

    async def start(self) -> None:
        await self.connect_publisher()
        await self.connect_subscriber()
        self._started = True
        logger.info("MQ Broker started")

    async def stop(self) -> None:
        if self._publisher:
            await self._publisher.stop()
        if self._subscriber:
            await self._subscriber.stop()
        self._started = False
        logger.info("MQ Broker stopped")

    def is_started(self) -> bool:
        return self._started

    def get_publisher(self) -> Optional[BasePublisher]:
        return self._publisher

    def get_subscriber(self) -> Optional[BaseSubscriber]:
        return self._subscriber
