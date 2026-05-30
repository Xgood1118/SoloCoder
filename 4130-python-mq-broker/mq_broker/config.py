from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from .models import CircuitBreakerConfig, DeadLetterConfig, RetryConfig


@dataclass
class ConnectionConfig:
    host: str = "localhost"
    port: int = 5672
    username: str = "guest"
    password: str = "guest"
    virtual_host: str = "/"
    ssl: bool = False
    timeout: int = 30

    def to_dict(self) -> Dict[str, Any]:
        return {
            "host": self.host,
            "port": self.port,
            "username": self.username,
            "password": self.password,
            "virtual_host": self.virtual_host,
            "ssl": self.ssl,
            "timeout": self.timeout,
        }


@dataclass
class PublisherConfig:
    max_concurrent_messages: int = 1000
    max_buffer_size: int = 10000
    buffer_overflow_strategy: str = "block"
    retry_config: RetryConfig = field(default_factory=RetryConfig)
    circuit_breaker: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    batch_size: int = 100
    flush_interval: float = 1.0


@dataclass
class SubscriberConfig:
    prefetch_count: int = 100
    poll_timeout: float = 1.0
    auto_offset_reset: str = "latest"
    dead_letter_config: DeadLetterConfig = field(default_factory=DeadLetterConfig)
    retry_config: RetryConfig = field(default_factory=RetryConfig)


@dataclass
class FilterConfig:
    enabled: bool = False
    filter_expression: Optional[str] = None
    filter_func: Optional[Any] = None


@dataclass
class TransformConfig:
    enabled: bool = False
    transform_func: Optional[Any] = None


@dataclass
class MQConfig:
    connection: ConnectionConfig = field(default_factory=ConnectionConfig)
    publisher: PublisherConfig = field(default_factory=PublisherConfig)
    subscriber: SubscriberConfig = field(default_factory=SubscriberConfig)
    filter: FilterConfig = field(default_factory=FilterConfig)
    transform: TransformConfig = field(default_factory=TransformConfig)
    extra: Dict[str, Any] = field(default_factory=dict)
