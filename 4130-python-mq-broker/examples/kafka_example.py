import asyncio
import json

from mq_broker import MQBroker, MessageProperties, MQType
from mq_broker.config import MQConfig, ConnectionConfig


async def kafka_publish_example():
    config = MQConfig(
        connection=ConnectionConfig(
            host="localhost",
            port=9092,
        )
    )

    broker = MQBroker(MQType.KAFKA, config)

    try:
        await broker.connect_publisher()

        for i in range(5):
            message_body = json.dumps({
                "event_type": "user_signup",
                "user_id": f"user_{i}",
                "email": f"user_{i}@example.com",
            }).encode("utf-8")

            properties = MessageProperties(
                partition_key=f"user_{i}",
                headers={"source": "web"},
            )

            result = await broker.publish(
                topic="user_events",
                body=message_body,
                properties=properties,
            )
            print(f"Published to Kafka: {result.message_id}, success={result.success}")

        await asyncio.sleep(2)

    finally:
        await broker.stop()


if __name__ == "__main__":
    asyncio.run(kafka_publish_example())
