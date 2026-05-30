from __future__ import annotations

import asyncio
from typing import List, Optional

import pulsar
from pulsar import Message as PulsarMessage

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


class PulsarPublisher(BasePublisher):
    def __init__(self, config: MQConfig):
        super().__init__(config)
        self._client: Optional[pulsar.Client] = None
        self._producers: dict = {}

    async def connect(self) -> None:
        if self._connected:
            return

        conn_config = self.config.connection
        service_url = f"{'pulsar+ssl' if conn_config.ssl else 'pulsar'}://{conn_config.host}:{conn_config.port}"

        loop = asyncio.get_event_loop()
        self._client = await loop.run_in_executor(
            None,
            lambda: pulsar.Client(service_url)
        )
        self._connected = True
        logger.info("Pulsar publisher connected")

    async def disconnect(self) -> None:
        for producer in self._producers.values():
            producer.close()
        self._producers.clear()
        if self._client:
            self._client.close()
        self._connected = False
        logger.info("Pulsar publisher disconnected")

    async def _get_producer(self, topic: str):
        if topic not in self._producers:
            loop = asyncio.get_event_loop()
            self._producers[topic] = await loop.run_in_executor(
                None,
                lambda: self._client.create_producer(
                    topic,
                    persistent=self.config.extra.get("persistent", True),
                )
            )
        return self._producers[topic]

    async def _publish_single(self, message: Message) -> PublishResult:
        try:
            producer = await self._get_producer(message.topic)
            loop = asyncio.get_event_loop()

            properties = message.properties.headers.copy()
            if message.properties.correlation_id:
                properties["correlation_id"] = message.properties.correlation_id
            if message.properties.reply_to:
                properties["reply_to"] = message.properties.reply_to

            send_kwargs = {
                "content": message.body,
                "properties": properties,
                "partition_key": message.properties.partition_key,
            }

            if message.properties.delay_seconds > 0:
                send_kwargs["deliver_after"] = message.properties.delay_seconds * 1000

            if message.properties.priority > 0:
                send_kwargs["priority"] = message.properties.priority

            await loop.run_in_executor(
                    None,
                    lambda: producer.send(**send_kwargs)
                )

            return PublishResult(
                    success=True,
                    message_id=message.message_id,
                )
        except Exception as e:
            logger.error(f"Pulsar publish error: {e}")
            return PublishResult(
                success=False,
                message_id=message.message_id,
                error=str(e),
            )


class PulsarSubscriber(BaseSubscriber):
    def __init__(self, config: MQConfig):
        super().__init__(config)
        self._client: Optional[pulsar.Client] = None
        self._consumers: dict = {}

    async def connect(self) -> None:
        if self._connected:
            return

        conn_config = self.config.connection
        service_url = f"{'pulsar+ssl' if conn_config.ssl else 'pulsar'}://{conn_config.host}:{conn_config.port}"

        loop = asyncio.get_event_loop()
        self._client = await loop.run_in_executor(
            None,
            lambda: pulsar.Client(service_url)
        )
        self._connected = True
        logger.info("Pulsar subscriber connected")

    async def disconnect(self) -> None:
        for consumer in self._consumers.values():
            consumer.close()
        self._consumers.clear()
        if self._client:
            self._client.close()
        self._connected = False
        logger.info("Pulsar subscriber disconnected")

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

        subscription_name = consumer_group or "default"

        loop = asyncio.get_event_loop()

        consumer_type = pulsar.ConsumerType.Shared if consumer_group else pulsar.ConsumerType.Exclusive

        dlq_config = self.config.subscriber.dead_letter_config

        consumer = await loop.run_in_executor(
            None,
            lambda: self._client.subscribe(
                topic,
                subscription_name=subscription_name,
                consumer_type=consumer_type,
                initial_position=pulsar.InitialPosition.Latest
                if self.config.subscriber.auto_offset_reset == "latest"
                else pulsar.InitialPosition.Earliest,
            )
        )

        self._consumers[topic] = consumer

        self._subscriptions[topic] = {
            "consumer": consumer,
            "consumer_group": consumer_group,
        }

        if mode == SubscriberMode.PUSH:
            task = asyncio.create_task(self._consume_push(topic, consumer, ack_mode))
            self._tasks.append(task)

        logger.info(f"Subscribed to Pulsar topic: {topic}, consumer_group: {consumer_group}")

    async def _consume_push(
        self,
        topic: str,
        consumer,
        ack_mode: AckMode,
    ) -> None:
        loop = asyncio.get_event_loop()
        while self._running:
            try:
                msg = await loop.run_in_executor(
                    None,
                    lambda: consumer.receive(timeout_millis=1000)
                )
                message = self._convert_message(msg, topic)
                await self._process_message(message)

                if ack_mode == AckMode.AUTO:
                    await loop.run_in_executor(None, lambda: consumer.acknowledge(msg))
            except Exception as e:
                if "timeout" not in str(e).lower():
                    logger.error(f"Pulsar consume error: {e}")
                await asyncio.sleep(0.1)

    async def unsubscribe(self, topic: str) -> None:
        if topic in self._subscriptions:
            consumer = self._consumers.get(topic)
            if consumer:
                consumer.close()
                del self._consumers[topic]
            del self._subscriptions[topic]
            if topic in self._callbacks:
                del self._callbacks[topic]
            logger.info(f"Unsubscribed from Pulsar topic: {topic}")

    async def poll(
        self,
        topic: str,
        max_messages: int = 10,
        timeout: float = 1.0,
    ) -> List[Message]:
        if topic not in self._subscriptions:
            return []

        consumer = self._consumers.get(topic)
        if not consumer:
            return []

        messages = []
        loop = asyncio.get_event_loop()

        for _ in range(max_messages):
            try:
                msg = await loop.run_in_executor(
                    None,
                    lambda: consumer.receive(timeout_millis=int(timeout * 1000))
                )
                message = self._convert_message(msg, topic)
                message.raw_message = msg
                messages.append(message)
            except Exception as e:
                break

        return messages

    def _convert_message(self, pulsar_msg: PulsarMessage, topic: str) -> Message:
        properties = pulsar_msg.properties() or {}

        msg_properties = MessageProperties(
            content_type=properties.get("content_type", "application/json"),
            priority=pulsar_msg.priority() or 0,
            persistent=True,
            headers=dict(properties),
            correlation_id=properties.get("correlation_id"),
            reply_to=properties.get("reply_to"),
            partition_key=pulsar_msg.partition_key(),
        )

        message = Message(
            topic=topic,
            body=pulsar_msg.data(),
            properties=msg_properties,
            message_id=str(pulsar_msg.message_id()),
            status=MessageStatus.RECEIVED,
            raw_message=pulsar_msg,
        )
        return message

    async def ack(self, message: Message) -> None:
        if message.raw_message:
            loop = asyncio.get_event_loop()
            topic = message.topic
            consumer = self._consumers.get(topic)
            if consumer:
                await loop.run_in_executor(
                    None,
                    lambda: consumer.acknowledge(message.raw_message))

    async def nack(
        self,
        message: Message,
        requeue: bool = False,
    ) -> None:
        if requeue and message.raw_message:
            loop = asyncio.get_event_loop()
            topic = message.topic
            consumer = self._consumers.get(topic)
            if consumer:
                await loop.run_in_executor(
                    None,
                    lambda: consumer.negative_acknowledge(message.raw_message))
        else:
            await self._send_to_dlq(message, DeadLetterReason.REJECTED)
