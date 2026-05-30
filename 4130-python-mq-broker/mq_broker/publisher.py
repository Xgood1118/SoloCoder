from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any, List, Optional

from .config import MQConfig
from .models import Message, MessageStatus, PublishResult
from .utils import (
    CircuitBreaker,
    ConcurrentLimiter,
    MessageBuffer,
    calculate_exponential_backoff,
    generate_message_id,
    logger,
)


class BasePublisher(ABC):
    def __init__(self, config: MQConfig):
        self.config = config
        self._connected = False
        self._circuit_breaker = CircuitBreaker(
            failure_threshold=config.publisher.circuit_breaker.failure_threshold,
            success_threshold=config.publisher.circuit_breaker.success_threshold,
            timeout_seconds=config.publisher.circuit_breaker.timeout_seconds,
        )
        self._concurrent_limiter = ConcurrentLimiter(
            max_concurrent=config.publisher.max_concurrent_messages
        )
        self._buffer: MessageBuffer = MessageBuffer(
            max_size=config.publisher.max_buffer_size,
            overflow_strategy=config.publisher.buffer_overflow_strategy,
        )
        self._retry_queue: asyncio.Queue = asyncio.Queue()
        self._flush_task: Optional[asyncio.Task] = None
        self._retry_task: Optional[asyncio.Task] = None
        self._running = False

    @abstractmethod
    async def connect(self) -> None:
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        pass

    @abstractmethod
    async def _publish_single(self, message: Message) -> PublishResult:
        pass

    async def publish(
        self,
        topic: str,
        body: bytes | str,
        properties: Optional[Any] = None,
    ) -> PublishResult:
        if not self._connected:
            await self.connect()

        message = Message.create(topic=topic, body=body, properties=properties)
        message.message_id = generate_message_id()

        if not await self._buffer.put(message):
            return PublishResult(
                success=False,
                message_id=message.message_id,
                error="Buffer overflow",
            )

        return PublishResult(
            success=True,
            message_id=message.message_id,
        )

    async def publish_batch(self, messages: List[Message]) -> List[PublishResult]:
        results = []
        for message in messages:
            result = await self.publish(
                topic=message.topic,
                body=message.body,
                properties=message.properties,
            )
            results.append(result)
        return results

    async def _do_publish(self, message: Message) -> PublishResult:
        async with self._concurrent_limiter:
            retry_count = 0
            max_retries = self.config.publisher.retry_config.max_retries

            while retry_count <= max_retries:
                try:
                    message.retry_count = retry_count
                    message.status = MessageStatus.SENT

                    @self._circuit_breaker.call
                    async def wrapped_publish(msg):
                        return await self._publish_single(msg)

                    result = await wrapped_publish(message)

                    if result.success:
                        message.status = MessageStatus.ACKED
                        return result
                    else:
                        raise Exception(result.error or "Publish failed")

                except Exception as e:
                    retry_count += 1
                    if retry_count > max_retries:
                        logger.error(
                            f"Publish failed after {max_retries} retries: {e}"
                        )
                        message.status = MessageStatus.FAILED
                        return PublishResult(
                            success=False,
                            message_id=message.message_id,
                            error=str(e),
                        )

                    delay = calculate_exponential_backoff(
                        retry_count=retry_count - 1,
                        initial_delay=self.config.publisher.retry_config.initial_delay,
                        max_delay=self.config.publisher.retry_config.max_delay,
                        multiplier=self.config.publisher.retry_config.backoff_multiplier,
                        jitter=self.config.publisher.retry_config.jitter,
                    )
                    logger.warning(
                        f"Publish failed, retrying in {delay:.2f}s (attempt {retry_count}/{max_retries}): {e}"
                    )
                    await asyncio.sleep(delay)

            return PublishResult(
                success=False,
                message_id=message.message_id,
                error="Max retries exceeded",
            )

    async def _flush_loop(self) -> None:
        while self._running:
            batch = []
            batch_size = self.config.publisher.batch_size

            while len(batch) < batch_size and not self._buffer.is_empty():
                message = await self._buffer.get(timeout=0.1)
                if message:
                    batch.append(message)

            if batch:
                tasks = [self._do_publish(msg) for msg in batch]
                await asyncio.gather(*tasks, return_exceptions=True)

            await asyncio.sleep(self.config.publisher.flush_interval)

    async def start(self) -> None:
        self._running = True
        self._flush_task = asyncio.create_task(self._flush_loop())
        logger.info("Publisher started")

    async def stop(self) -> None:
        self._running = False
        if self._flush_task:
            await self._flush_task
        await self.disconnect()
        logger.info("Publisher stopped")

    def is_connected(self) -> bool:
        return self._connected

    def get_buffer_size(self) -> int:
        return self._buffer.qsize()
