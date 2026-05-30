from __future__ import annotations

import asyncio
from typing import List, Optional

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.structs import ConsumerRecord, TopicPartition

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


class KafkaPublisher(BasePublisher):
    def __init__(self, config: MQConfig):
        super().__init__(config)
        self._producer: Optional[AIOKafkaProducer] = None

    async def connect(self) -> None:
        if self._connected:
            return

        conn_config = self.config.connection
        bootstrap_servers = f"{conn_config.host}:{conn_config.port}"

        self._producer = AIOKafkaProducer(
            bootstrap_servers=bootstrap_servers,
            acks="all",
            retries=0,
            max_batch_size=16384,
            linger_ms=0,
        )
        await self._producer.start()
        self._connected = True
        logger.info("Kafka publisher connected")

    async def disconnect(self) -> None:
        if self._producer:
            await self._producer.stop()
        self._connected = False
        logger.info("Kafka publisher disconnected")

    async def _publish_single(self, message: Message) -> PublishResult:
        try:
            key = message.properties.partition_key.encode("utf-8") if message.properties.partition_key else None

            headers = []
            for k, v in message.properties.headers.items():
                if isinstance(v, str):
                    headers.append((k, v.encode("utf-8")))
                elif isinstance(v, bytes):
                    headers.append((k, v))
                else:
                    headers.append((k, str(v).encode("utf-8")))

            if message.properties.delay_seconds > 0:
                headers.append(("x-delay", str(message.properties.delay_seconds).encode("utf-8")))

            if message.properties.correlation_id:
                headers.append(("correlation_id", message.properties.correlation_id.encode("utf-8")))

            if message.properties.reply_to:
                headers.append(("reply_to", message.properties.reply_to.encode("utf-8")))

            await self._producer.send_and_wait(
                topic=message.topic,
                value=message.body,
                key=key,
                headers=headers if headers else None,
            )

            return PublishResult(
                success=True,
                message_id=message.message_id,
            )
        except Exception as e:
            logger.error(f"Kafka publish error: {e}")
            return PublishResult(
                success=False,
                message_id=message.message_id,
                error=str(e),
            )


class KafkaSubscriber(BaseSubscriber):
    def __init__(self, config: MQConfig):
        super().__init__(config)
        self._consumer: Optional[AIOKafkaConsumer] = None
        self._poll_tasks: dict = {}

    async def connect(self) -> None:
        if self._connected:
            return

        conn_config = self.config.connection
        bootstrap_servers = f"{conn_config.host}:{conn_config.port}"

        self._consumer = AIOKafkaConsumer(
            bootstrap_servers=bootstrap_servers,
            group_id=None,
            auto_offset_reset=self.config.subscriber.auto_offset_reset,
            enable_auto_commit=False,
            fetch_max_wait_ms=500,
            fetch_min_bytes=1,
            fetch_max_bytes=52428800,
        )
        await self._consumer.start()
        self._connected = True
        logger.info("Kafka subscriber connected")

    async def disconnect(self) -> None:
        if self._consumer:
            await self._consumer.stop()
        self._connected = False
        logger.info("Kafka subscriber disconnected")

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

        if consumer_group:
            self._consumer._group_id = consumer_group

        self._consumer.subscribe(topics=[topic])

        self._subscriptions[topic] = {
            "consumer_group": consumer_group,
        }

        if mode == SubscriberMode.PUSH:
            task = asyncio.create_task(self._consume_push(topic, ack_mode))
            self._tasks.append(task)

        logger.info(f"Subscribed to Kafka topic: {topic}, consumer_group: {consumer_group}")

    async def _consume_push(
        self,
        topic: str,
        ack_mode: AckMode,
    ) -> None:
        while self._running:
            try:
                messages = await self._consumer.getmany(timeout_ms=1000)
                for tp, records in messages.items():
                    for record in records:
                        message = self._convert_message(record, topic)
                        await self._process_message(message)

                        if ack_mode == AckMode.AUTO:
                            await self._consumer.commit()
            except Exception as e:
                logger.error(f"Kafka consume error: {e}")
                await asyncio.sleep(1)

    async def unsubscribe(self, topic: str) -> None:
        if topic in self._subscriptions:
            del self._subscriptions[topic]
            if topic in self._callbacks:
                del self._callbacks[topic]

            remaining_topics = list(self._subscriptions.keys())
            if remaining_topics:
                self._consumer.subscribe(topics=remaining_topics)
            else:
                self._consumer.unsubscribe()

            logger.info(f"Unsubscribed from Kafka topic: {topic}")

    async def poll(
        self,
        topic: str,
        max_messages: int = 10,
        timeout: float = 1.0,
    ) -> List[Message]:
        if not self._connected:
            return []

        messages = []
        try:
            records = await self._consumer.getmany(
                timeout_ms=int(timeout * 1000),
                max_records=max_messages,
            )
            for tp, record_list in records.items():
                for record in record_list[:max_messages]:
                    message = self._convert_message(record, topic)
                    message.raw_message = record
                    messages.append(message)
        except Exception as e:
            logger.error(f"Kafka poll error: {e}")

        return messages

    def _convert_message(self, record: ConsumerRecord, topic: str) -> Message:
        headers = {}
        if record.headers:
            for k, v in record.headers:
                try:
                    headers[k] = v.decode("utf-8") if v else None
                except:
                    headers[k] = v

        partition_key = record.key.decode("utf-8") if record.key else None

        properties = MessageProperties(
            content_type="application/json",
            priority=0,
            persistent=True,
            headers=headers,
            partition_key=partition_key,
        )

        message = Message(
            topic=topic,
            body=record.value,
            properties=properties,
            message_id=f"{record.topic}-{record.partition}-{record.offset}",
            status=MessageStatus.RECEIVED,
            raw_message=record,
        )
        return message

    async def ack(self, message: Message) -> None:
        if message.raw_message and isinstance(message.raw_message, ConsumerRecord):
            record = message.raw_message
            tp = TopicPartition(record.topic, record.partition)
            await self._consumer.commit({tp: record.offset + 1})

    async def nack(
        self,
        message: Message,
        requeue: bool = False,
    ) -> None:
        if requeue and message.raw_message:
            record = message.raw_message
            tp = TopicPartition(record.topic, record.partition)
            await self._consumer.seek(tp, record.offset)
        else:
            await self._send_to_dlq(message, DeadLetterReason.REJECTED)
