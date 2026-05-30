import asyncio
import json

from mq_broker import MQBroker, Message, MQType, AckMode, SubscriberMode
from mq_broker.config import MQConfig, ConnectionConfig
from mq_broker.utils import deserialize_message


async def pull_example():
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
            callback=None,
            consumer_group="order_service_group_pull",
            mode=SubscriberMode.PULL,
            ack_mode=AckMode.MANUAL,
        )

        print("Pull mode: polling for messages...")

        while True:
            messages = await broker.poll(
                topic="order_events",
                max_messages=10,
                timeout=1.0,
            )

            if messages:
                print(f"Received {len(messages)} messages")
                for message in messages:
                    try:
                        data = deserialize_message(message.body, message.properties.content_type)
                        print(f"Processing: {data}")
                        await broker.ack(message)
                    except Exception as e:
                        print(f"Error processing message, nacking: {e}")
                        await broker.nack(message, requeue=True)
            else:
                print("No messages, waiting...")
                await asyncio.sleep(1)

    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        await broker.stop()


if __name__ == "__main__":
    asyncio.run(pull_example())
