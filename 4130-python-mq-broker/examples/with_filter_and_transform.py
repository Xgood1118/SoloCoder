import asyncio
import json

from mq_broker import MQBroker, Message, MQType, AckMode, SubscriberMode
from mq_broker.config import MQConfig, ConnectionConfig, FilterConfig, TransformConfig
from mq_broker.utils import deserialize_message


def vip_filter(message: Message) -> bool:
    return message.properties.headers.get("user_level") == "VIP"


def json_transform(message: Message) -> Message:
    try:
        data = json.loads(message.body.decode("utf-8"))
        data["processed_by_proxy"] = True
        data["proxy_timestamp"] = asyncio.get_event_loop().time()
        message.body = json.dumps(data).encode("utf-8")
    except Exception as e:
        print(f"Transform error: {e}")
    return message


async def message_handler(message: Message):
    data = deserialize_message(message.body, message.properties.content_type)
    print(f"Filtered & Transformed message: {data}")
    print(f"  User Level: {message.properties.headers.get('user_level')}")
    print()


async def filter_transform_example():
    config = MQConfig(
        connection=ConnectionConfig(
            host="localhost",
            port=5672,
            username="guest",
            password="guest",
        ),
        filter=FilterConfig(
            enabled=True,
            filter_func=vip_filter,
        ),
        transform=TransformConfig(
            enabled=True,
            transform_func=json_transform,
        ),
    )

    broker = MQBroker(MQType.RABBITMQ, config)

    try:
        await broker.connect_subscriber()

        await broker.subscribe(
            topic="order_events",
            callback=message_handler,
            consumer_group="filtered_order_group",
            mode=SubscriberMode.PUSH,
            ack_mode=AckMode.AUTO,
        )

        print("Subscribed with VIP filter and JSON transform...")
        print("Only VIP user messages will be received and transformed")
        print("Press Ctrl+C to stop")

        while True:
            await asyncio.sleep(1)

    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        await broker.stop()


if __name__ == "__main__":
    asyncio.run(filter_transform_example())
