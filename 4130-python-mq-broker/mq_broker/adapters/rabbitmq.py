from __future__ import annotations

import asyncio
from typing import List, Optional

import aio_pika
from aio_pika import ExchangeType, IncomingMessage, Message as RMQMessage

from ..config import MQConfig
from ..models import (
    AckMode,
    AsyncMessageCallback,
    DeadLetterReason,
    Message,
    MessageProperties,
    MessageStatus,
    PublishResult,
    SubscriberMode,
)
from ..publisher import BasePublisher
from ..subscriber import BaseSubscriber
from ..utils import logger


class RabbitMQPublisher(BasePublisher):
    def __init__(self, config: MQConfig):
        super().__init__(config)
        self._connection: Optional[aio_pika.Connection] = None
        self._channel: Optional[aio_pika.Channel] = None
        self._exchanges: dict = {}

    async def connect(self) -> None:
        if self._connected:
            return

        conn_config = self.config.connection
        connection_str = (
            f"{'amqps' if conn_config.ssl else 'amqp'}://"
            f"{conn_config.username}:{conn_config.password}@"
            f"{conn_config.host}:{conn_config.port}{conn_config.virtual_host}"
        )

        self._connection = await aio_pika.connect_robust(
            connection_str,
            timeout=conn_config.timeout,
        )
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=self.config.publisher.max_concurrent_messages)
        self._connected = True
        logger.info("RabbitMQ publisher connected")

    async def disconnect(self) -> None:
        if self._channel:
            await self._channel.close()
        if self._connection:
            await self._connection.close()
        self._connected = False
        logger.info("RabbitMQ publisher disconnected")

    async def _get_exchange(self, topic: str) -> aio_pika.Exchange:
        if topic not in self._exchanges:
            self._exchanges[topic] = await self._channel.declare_exchange(
                topic,
                ExchangeType.TOPIC,
                durable=True,
            )
        return self._exchanges[topic]

    async def _publish_single(self, message: Message) -> PublishResult:
        try:
            exchange = await self._get_exchange(message.topic)

            rmq_message = RMQMessage(
                body=message.body,
                content_type=message.properties.content_type,
                priority=message.properties.priority,
                delivery_mode=(
                    aio_pika.DeliveryMode.PERSISTENT
                    if message.properties.persistent
                    else aio_pika.DeliveryMode.NOT_PERSISTENT
                ),
                headers=message.properties.headers,
                correlation_id=message.properties.correlation_id,
                reply_to=message.properties.reply_to,
                expiration=str(message.properties.expiration) if message.properties.expiration else None,
                message_id=message.message_id,
            )

            routing_key = message.properties.partition_key or "#"

            if message.properties.delay_seconds > 0:
                rmq_message.headers["x-delay"] = message.properties.delay_seconds * 1000

            await exchange.publish(rmq_message, routing_key=routing_key)

            return PublishResult(
                success=True,
                message_id=message.message_id,
            )
        except Exception as e:
            logger.error(f"RabbitMQ publish error: {e}")
            return PublishResult(
                success=False,
                message_id=message.message_id,
                error=str(e),
            )


class RabbitMQSubscriber(BaseSubscriber):
    def __init__(self, config: MQConfig):
        super().__init__(config)
        self._connection: Optional[aio_pika.Connection] = None
        self._channel: Optional[aio_pika.Channel] = None
        self._queues: dict = {}
        self._exchanges: dict = {}

    async def connect(self) -> None:
        if self._connected:
            return

        conn_config = self.config.connection
        connection_str = (
            f"{'amqps' if conn_config.ssl else 'amqp'}://"
            f"{conn_config.username}:{conn_config.password}@"
            f"{conn_config.host}:{conn_config.port}{conn_config.virtual_host}"
        )

        self._connection = await aio_pika.connect_robust(
            connection_str,
            timeout=conn_config.timeout,
        )
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=self.config.subscriber.prefetch_count)
        self._connected = True
        logger.info("RabbitMQ subscriber connected")

    async def disconnect(self) -> None:
        if self._channel:
            await self._channel.close()
        if self._connection:
            await self._connection.close()
        self._connected = False
        logger.info("RabbitMQ subscriber disconnected")

    async def _get_exchange(self, topic: str) -> aio_pika.Exchange:
        if topic not in self._exchanges:
            self._exchanges[topic] = await self._channel.declare_exchange(
                topic,
                ExchangeType.TOPIC,
                durable=True,
            )
        return self._exchanges[topic]

    async def _get_queue(self, topic: str, consumer_group: Optional[str] = None) -> aio_pika.Queue:
        queue_name = consumer_group or topic
        if queue_name not in self._queues:
            args = {}
            dlq_config = self.config.subscriber.dead_letter_config
            if dlq_config.dead_letter_topic or dlq_config.max_retry_count > 0:
                dlq_topic = dlq_config.get_dlq_topic(topic)
                args["x-dead-letter-exchange"] = dlq_topic

            self._queues[queue_name] = await self._channel.declare_queue(
                queue_name,
                durable=True,
                arguments=args,
            )
        return self._queues[queue_name]

    async def subscribe(
        self,
        topic: str,
        callback: AsyncMessageCallback,
        consumer_group: Optional[str] = None,
        mode: SubscriberMode = SubscriberMode.PUSH,
        ack_mode: AckMode = AckMode.AUTO,
    ) -> None:
        if not self._connected:
            await self.connect()

        self._mode = mode
        self._ack_mode = ack_mode
        self._consumer_group = consumer_group
        self._callbacks[topic] = callback

        exchange = await self._get_exchange(topic)
        queue = await self._get_queue(topic, consumer_group)
        await queue.bind(exchange, routing_key="#")

        self._subscriptions[topic] = {
            "exchange": exchange,
            "queue": queue,
        }

        if mode == SubscriberMode.PUSH:
            task = asyncio.create_task(self._consume_push(topic, queue, ack_mode))
            self._tasks.append(task)

        logger.info(f"Subscribed to RabbitMQ topic: {topic}, consumer_group: {consumer_group}")

    async def _consume_push(
        self,
        topic: str,
        queue: aio_pika.Queue,
        ack_mode: AckMode,
    ) -> None:
        async with queue.iterator() as queue_iter:
            async for incoming_message in queue_iter:
                async with incoming_message.process(no_ack=(ack_mode == AckMode.AUTO)):
                    message = self._convert_message(incoming_message, topic)
                    await self._process_message(message)

    async def unsubscribe(self, topic: str) -> None:
        if topic in self._subscriptions:
            del self._subscriptions[topic]
            if topic in self._callbacks:
                del self._callbacks[topic]
            logger.info(f"Unsubscribed from RabbitMQ topic: {topic}")

    async def poll(
        self,
        topic: str,
        max_messages: int = 10,
        timeout: float = 1.0,
    ) -> List[Message]:
        if topic not in self._subscriptions:
            return []

        queue = self._subscriptions[topic]["queue"]
        messages = []

        for _ in range(max_messages):
            incoming_message = await queue.get(timeout=timeout, fail=False)
            if incoming_message:
                message = self._convert_message(incoming_message, topic)
                message.raw_message = incoming_message
                messages.append(message)
            else:
                break

        return messages

    def _convert_message(self, rmq_message: IncomingMessage, topic: str) -> Message:
        properties = MessageProperties(
            content_type=rmq_message.content_type or "application/json",
            priority=rmq_message.priority or 0,
            persistent=rmq_message.delivery_mode == aio_pika.DeliveryMode.PERSISTENT,
            headers=dict(rmq_message.headers) if rmq_message.headers else {},
            correlation_id=rmq_message.correlation_id,
            reply_to=rmq_message.reply_to,
        )

        message = Message(
            topic=topic,
            body=rmq_message.body,
            properties=properties,
            message_id=rmq_message.message_id,
            status=MessageStatus.RECEIVED,
            raw_message=rmq_message,
        )
        return message

    async def ack(self, message: Message) -> None:
        if message.raw_message and hasattr(message.raw_message, "ack"):
            await message.raw_message.ack()

    async def nack(
        self,
        message: Message,
        requeue: bool = False,
    ) -> None:
        if message.raw_message and hasattr(message.raw_message, "nack"):
            await message.raw_message.nack(requeue=requeue)
        if not requeue:
            await self._send_to_dlq(message, DeadLetterReason.REJECTED)
