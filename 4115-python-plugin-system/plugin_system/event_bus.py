import asyncio
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Set

from .exceptions import PluginEventError
from .utils import get_logger


logger = get_logger("event_bus")


@dataclass
class Event:
    event_type: str
    data: Dict[str, Any] = field(default_factory=dict)
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = field(default_factory=time.time)
    source: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "data": self.data,
            "timestamp": self.timestamp,
            "source": self.source,
        }


@dataclass
class EventResult:
    event_id: str
    subscriber: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time: float = 0.0


class EventBatch:
    def __init__(self, event_type: str, max_size: int = 100, max_wait: float = 0.1):
        self.event_type = event_type
        self.max_size = max_size
        self.max_wait = max_wait
        self.events: List[Event] = []
        self.created_at = time.time()

    def add(self, event: Event) -> bool:
        if len(self.events) >= self.max_size:
            return False
        self.events.append(event)
        return True

    def is_ready(self) -> bool:
        return len(self.events) >= self.max_size or (time.time() - self.created_at) >= self.max_wait


class Subscriber:
    def __init__(
        self,
        name: str,
        callback: Callable,
        priority: int = 0,
        is_async: bool = False,
    ):
        self.name = name
        self.callback = callback
        self.priority = priority
        self.is_async = is_async

    def __lt__(self, other: "Subscriber") -> bool:
        return self.priority > other.priority


class EventBus:
    def __init__(self, enable_batching: bool = True, async_workers: int = 2):
        self._subscribers: Dict[str, List[Subscriber]] = {}
        self._event_history: List[Event] = []
        self._max_history = 1000
        self._enable_batching = enable_batching
        self._batches: Dict[str, EventBatch] = {}
        self._async_queue: queue.Queue = queue.Queue()
        self._async_workers: List[threading.Thread] = []
        self._running = False
        self._lock = threading.RLock()

        if async_workers > 0:
            self._start_async_workers(async_workers)

    def subscribe(
        self,
        event_type: str,
        callback: Callable,
        subscriber_name: str,
        priority: int = 0,
        is_async: bool = False,
    ) -> None:
        with self._lock:
            if event_type not in self._subscribers:
                self._subscribers[event_type] = []

            subscriber = Subscriber(
                name=subscriber_name,
                callback=callback,
                priority=priority,
                is_async=is_async,
            )

            self._subscribers[event_type].append(subscriber)
            self._subscribers[event_type].sort()

            logger.debug(f"Subscriber '{subscriber_name}' subscribed to event: {event_type}")

    def unsubscribe(self, event_type: str, subscriber_name: str) -> None:
        with self._lock:
            if event_type not in self._subscribers:
                return

            self._subscribers[event_type] = [
                s for s in self._subscribers[event_type] if s.name != subscriber_name
            ]

            if not self._subscribers[event_type]:
                del self._subscribers[event_type]

            logger.debug(f"Subscriber '{subscriber_name}' unsubscribed from event: {event_type}")

    def unsubscribe_all(self, subscriber_name: str) -> None:
        with self._lock:
            for event_type in list(self._subscribers.keys()):
                self.unsubscribe(event_type, subscriber_name)

    def publish(
        self,
        event_type: str,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
        wait_for_completion: bool = False,
    ) -> List[EventResult]:
        event = Event(
            event_type=event_type,
            data=data or {},
            source=source,
        )

        self._record_event(event)

        if self._enable_batching:
            self._add_to_batch(event)

        return self._dispatch_event(event, wait_for_completion)

    def publish_batch(
        self,
        event_type: str,
        events_data: List[Dict[str, Any]],
        source: Optional[str] = None,
    ) -> List[EventResult]:
        all_results = []
        for data in events_data:
            results = self.publish(event_type, data, source, wait_for_completion=True)
            all_results.extend(results)
        return all_results

    def _dispatch_event(self, event: Event, wait_for_completion: bool) -> List[EventResult]:
        with self._lock:
            subscribers = self._subscribers.get(event.event_type, []).copy()

        sync_results = []
        async_tasks = []

        for subscriber in subscribers:
            if subscriber.is_async:
                async_tasks.append((subscriber, event))
            else:
                result = self._execute_subscriber(subscriber, event)
                sync_results.append(result)

        if async_tasks:
            if wait_for_completion:
                for subscriber, evt in async_tasks:
                    result = self._execute_subscriber(subscriber, evt)
                    sync_results.append(result)
            else:
                for subscriber, evt in async_tasks:
                    self._async_queue.put((subscriber, evt))

        return sync_results

    def _execute_subscriber(self, subscriber: Subscriber, event: Event) -> EventResult:
        start_time = time.time()
        try:
            result = subscriber.callback(event)
            execution_time = time.time() - start_time
            return EventResult(
                event_id=event.event_id,
                subscriber=subscriber.name,
                success=True,
                result=result,
                execution_time=execution_time,
            )
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(
                f"Error in subscriber '{subscriber.name}' for event '{event.event_type}': {e}"
            )
            return EventResult(
                event_id=event.event_id,
                subscriber=subscriber.name,
                success=False,
                error=str(e),
                execution_time=execution_time,
            )

    def _record_event(self, event: Event) -> None:
        with self._lock:
            self._event_history.append(event)
            if len(self._event_history) > self._max_history:
                self._event_history.pop(0)

    def _add_to_batch(self, event: Event) -> None:
        with self._lock:
            if event.event_type not in self._batches:
                self._batches[event.event_type] = EventBatch(event.event_type)

            batch = self._batches[event.event_type]
            if not batch.add(event):
                self._process_batch(batch)
                self._batches[event.event_type] = EventBatch(event.event_type)
                self._batches[event.event_type].add(event)
            elif batch.is_ready():
                self._process_batch(batch)
                del self._batches[event.event_type]

    def _process_batch(self, batch: EventBatch) -> None:
        logger.debug(f"Processing batch of {len(batch.events)} events for type: {batch.event_type}")

    def _start_async_workers(self, count: int) -> None:
        self._running = True
        for i in range(count):
            thread = threading.Thread(target=self._async_worker, daemon=True, name=f"EventWorker-{i}")
            thread.start()
            self._async_workers.append(thread)

    def _async_worker(self) -> None:
        while self._running:
            try:
                subscriber, event = self._async_queue.get(timeout=0.1)
                self._execute_subscriber(subscriber, event)
                self._async_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Error in async event worker: {e}")

    def stop(self) -> None:
        self._running = False
        for thread in self._async_workers:
            thread.join(timeout=1.0)
        self._async_workers.clear()

    def get_event_history(self, event_type: Optional[str] = None) -> List[Event]:
        with self._lock:
            history = self._event_history.copy()
            if event_type:
                history = [e for e in history if e.event_type == event_type]
            return history

    def get_subscribers(self, event_type: str) -> List[str]:
        with self._lock:
            return [s.name for s in self._subscribers.get(event_type, [])]

    def clear_subscribers(self) -> None:
        with self._lock:
            self._subscribers.clear()
