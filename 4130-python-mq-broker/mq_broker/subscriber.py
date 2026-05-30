from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from .config import MQConfig
from .models import (
    AckMode,
    AsyncMessageCallback,
    DeadLetterReason,
    Message,
    MessageStatus,
    SubscriberMode,
)
from .utils import FilterEngine, calculate_exponential_backoff, logger


class BaseSubscriber(ABC):
    def __init__(self, config: MQConfig):
        self.config = config
        self._connected = False
        self._subscriptions: Dict[str, Any] = {}
        self._callbacks: Dict[str, AsyncMessageCallback] = {}
        self._mode: SubscriberMode = SubscriberMode.PUSH
        self._ack_mode: AckMode = AckMode.AUTO
        self._consumer_group: Optional[str] = None
        self._running = False
        self._tasks: List[asyncio.Task] = []
        self._filter_engine = FilterEngine()
        self._transform_func = None

    @abstractmethod
    async def connect(self) -> None:
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        pass

    @abstractmethod
    async def subscribe(
        self,
        topic: str,
        callback: AsyncMessageCallback,
        consumer_group: Optional[str] = None,
        mode: SubscriberMode = SubscriberMode.PUSH,
        ack_mode: AckMode = AckMode.AUTO,
    ) -> None:
        pass

    @abstractmethod
    async def unsubscribe(self, topic: str) -> None:
        pass

    @abstractmethod
    async def poll(
        self,
        topic: str,
        max_messages: int = 10,
        timeout: float = 1.0,
    ) -> List[Message]:
        pass

    @abstractmethod
    async def ack(self, message: Message) -> None:
        pass

    @abstractmethod
    async def nack(
        self,
        message: Message,
        requeue: bool = False,
    ) -> None:
        pass

    def set_filter(self, filter_expression: str) -> None:
        self._filter_engine = FilterEngine(filter_expression)

    def set_transform(self, transform_func: Any) -> None:
        self._transform_func = transform_func

    def _apply_filter(self, message: Message) -> bool:
        if not self.config.filter.enabled:
            return True
        if self.config.filter.filter_func:
            return self.config.filter.filter_func(message)
        return self._filter_engine.matches(message.properties.headers)

    def _apply_transform(self, message: Message) -> Message:
        if not self.config.transform.enabled:
            return message
        if self._transform_func:
            return self._transform_func(message)
        return message

    async def _process_message(self, message: Message) -> None:
        message.status = MessageStatus.RECEIVED

        if not self._apply_filter(message):
            logger.debug(f"Message filtered out: {message.message_id}")
            if self._ack_mode == AckMode.AUTO:
                await self.ack(message)
            return

        message = self._apply_transform(message)

        retry_count = 0
        max_retries = self.config.subscriber.dead_letter_config.max_retry_count

        while retry_count <= max_retries:
            try:
                callback = self._callbacks.get(message.topic)
                if callback:
                    await callback(message)

                if self._ack_mode == AckMode.AUTO:
                    await self.ack(message)

                message.status = MessageStatus.ACKED
                return

            except Exception as e:
                retry_count += 1
                message.retry_count = retry_count

                if retry_count > max_retries:
                    logger.error(
                        f"Message processing failed after {max_retries} retries, sending to DLQ: {e}"
                    )
                    await self._send_to_dlq(message, DeadLetterReason.MAX_RETRIES)
                    return

                delay = calculate_exponential_backoff(
                    retry_count=retry_count - 1,
                    initial_delay=self.config.subscriber.retry_config.initial_delay,
                    max_delay=self.config.subscriber.retry_config.max_delay,
                    multiplier=self.config.subscriber.retry_config.backoff_multiplier,
                    jitter=self.config.subscriber.retry_config.jitter,
                )
                logger.warning(
                    f"Message processing failed, retrying in {delay:.2f}s (attempt {retry_count}/{max_retries}): {e}"
                )
                await asyncio.sleep(delay)

    async def _send_to_dlq(
        self,
        message: Message,
        reason: DeadLetterReason,
    ) -> None:
        message.status = MessageStatus.DLQ
        message.dlq_reason = reason
        dlq_topic = self.config.subscriber.dead_letter_config.get_dlq_topic(
            message.topic
        )
        message.properties.headers["dlq_reason"] = reason.value
        message.properties.headers["original_topic"] = message.topic
        message.properties.headers["retry_count"] = message.retry_count
        logger.warning(
            f"Message sent to DLQ [{dlq_topic}], reason: {reason.value}, message_id: {message.message_id}"
        )

    async def start(self) -> None:
        if not self._connected:
            await self.connect()
        self._running = True
        logger.info("Subscriber started")

    async def stop(self) -> None:
        self._running = False
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        await self.disconnect()
        logger.info("Subscriber stopped")

    def is_connected(self) -> bool:
        return self._connected

    def get_subscriptions(self) -> List[str]:
        return list(self._subscriptions.keys())
