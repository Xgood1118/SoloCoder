from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Any, Callable, Dict, Optional


class MQType(Enum):
    RABBITMQ = auto()
    KAFKA = auto()
    PULSAR = auto()


class MessageStatus(Enum):
    PENDING = auto()
    SENT = auto()
    RECEIVED = auto()
    ACKED = auto()
    NACKED = auto()
    FAILED = auto()
    DLQ = auto()


class SubscriberMode(Enum):
    PUSH = auto()
    PULL = auto()


class AckMode(Enum):
    AUTO = auto()
    MANUAL = auto()


class DeadLetterReason(Enum):
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    MAX_RETRIES = "max_retries"
    ERROR = "error"


@dataclass
class MessageProperties:
    priority: int = 0
    delay_seconds: int = 0
    partition_key: Optional[str] = None
    content_type: str = "application/json"
    headers: Dict[str, Any] = field(default_factory=dict)
    expiration: Optional[int] = None
    persistent: bool = True
    correlation_id: Optional[str] = None
    reply_to: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "priority": self.priority,
            "delay_seconds": self.delay_seconds,
            "partition_key": self.partition_key,
            "content_type": self.content_type,
            "headers": self.headers,
            "expiration": self.expiration,
            "persistent": self.persistent,
            "correlation_id": self.correlation_id,
            "reply_to": self.reply_to,
        }


@dataclass
class Message:
    topic: str
    body: bytes
    properties: MessageProperties = field(default_factory=MessageProperties)
    message_id: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    status: MessageStatus = MessageStatus.PENDING
    retry_count: int = 0
    dlq_reason: Optional[DeadLetterReason] = None
    raw_message: Any = None

    @classmethod
    def create(
        cls,
        topic: str,
        body: bytes | str,
        properties: Optional[MessageProperties] = None,
    ) -> "Message":
        if isinstance(body, str):
            body = body.encode("utf-8")
        return cls(
            topic=topic,
            body=body,
            properties=properties or MessageProperties(),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "topic": self.topic,
            "body": self.body,
            "properties": self.properties.to_dict(),
            "message_id": self.message_id,
            "timestamp": self.timestamp.isoformat(),
            "status": self.status.value,
            "retry_count": self.retry_count,
        }


@dataclass
class PublishResult:
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class DeadLetterConfig:
    dead_letter_topic: Optional[str] = None
    max_retry_count: int = 3
    retry_delay_seconds: int = 60
    timeout_seconds: int = 300
    alert_threshold: int = 100

    def get_dlq_topic(self, original_topic: str) -> str:
        return self.dead_letter_topic or f"{original_topic}.dlq"


@dataclass
class RetryConfig:
    max_retries: int = 3
    initial_delay: float = 1.0
    max_delay: float = 60.0
    backoff_multiplier: float = 2.0
    jitter: bool = True


@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    success_threshold: int = 2
    timeout_seconds: int = 30


MessageCallback = Callable[[Message], None]
AsyncMessageCallback = Callable[[Message], Any]
