import asyncio
import json

from mq_broker import MQBroker, Message, MQType, AckMode, SubscriberMode
from mq_broker.config import MQConfig, ConnectionConfig
from mq_broker.utils import deserialize_message


async def message_handler(message: Message):
    try:
        data = deserialize_message(message.body, message.properties.content_type)
        print(f"Received message: {data}")
        print(f"  Message ID: {message.message_id}")
        print(f"  Topic: {message.topic}")
        print(f"  Headers: {message.properties.headers}")
        print(f"  Partition Key: {message.properties.partition_key}")
        print(f"  Retry Count: {message.retry_count}")
        print()
    except Exception as e:
        print(f"Error processing message: {e}")
        raise


async def subscribe_example():
    config = MQConfig(
        connection=ConnectionConfig(
            host="localhost",
            port=5672,
            username="guest",
            password="guest",
        )
    )

    broker = MQBroker(MQType.RABBITMQ, config)

    try:
        await broker.connect_subscriber()

        await broker.subscribe(
            topic="order_events",
            callback=message_handler,
            consumer_group="order_service_group",
            mode=SubscriberMode.PUSH,
            ack_mode=AckMode.AUTO,
        )

        print("Subscribed to order_events, waiting for messages...")
        print("Press Ctrl+C to stop")

        while True:
            await asyncio.sleep(1)

    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        await broker.stop()


if __name__ == "__main__":
    asyncio.run(subscribe_example())
