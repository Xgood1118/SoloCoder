import asyncio
import json

from mq_broker import MQBroker, MessageProperties, MQType
from mq_broker.config import MQConfig, ConnectionConfig


async def publish_example():
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
        await broker.connect_publisher()

        for i in range(10):
            message_body = json.dumps({
                "order_id": f"order_{i}",
                "user_id": f"user_{i % 5}",
                "amount": 100.0 * i,
                "timestamp": asyncio.get_event_loop().time(),
            }).encode("utf-8")

            properties = MessageProperties(
                priority=5 if i % 2 == 0 else 0,
                partition_key=f"user_{i % 5}",
                headers={
                    "user_level": "VIP" if i % 3 == 0 else "Normal",
                    "region": "CN",
                },
            )

            result = await broker.publish(
                topic="order_events",
                body=message_body,
                properties=properties,
            )
            print(f"Published message {i}: success={result.success}, message_id={result.message_id}")

        await asyncio.sleep(2)

    finally:
        await broker.stop()


if __name__ == "__main__":
    asyncio.run(publish_example())
