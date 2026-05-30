import logging
import sys
import threading
from contextlib import contextmanager
from typing import Any, Callable, Optional, TypeVar


T = TypeVar("T")


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(f"plugin_system.{name}")
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


class TimeoutException(Exception):
    pass


@contextmanager
def timeout(seconds: int, error_message: str = "Operation timed out"):
    if sys.platform == "win32":
        yield
        return

    import signal

    def signal_handler(signum, frame):
        raise TimeoutException(error_message)

    old_handler = signal.signal(signal.SIGALRM, signal_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)


def run_with_timeout(
    func: Callable[..., T],
    timeout_seconds: int,
    *args: Any,
    **kwargs: Any,
) -> T:
    result = []
    exception = []

    def worker():
        try:
            result.append(func(*args, **kwargs))
        except Exception as e:
            exception.append(e)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    thread.join(timeout_seconds)

    if thread.is_alive():
        raise TimeoutException(f"Function timed out after {timeout_seconds} seconds")

    if exception:
        raise exception[0]

    return result[0] if result else None


def topological_sort(nodes: dict, dependencies: dict) -> list:
    in_degree = {node: 0 for node in nodes}
    graph = {node: [] for node in nodes}

    for node, deps in dependencies.items():
        for dep in deps:
            if dep in nodes:
                graph[dep].append(node)
                in_degree[node] += 1

    queue = [node for node in nodes if in_degree[node] == 0]
    result = []

    while queue:
        node = queue.pop(0)
        result.append(node)

        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(result) != len(nodes):
        cycle = find_cycle(nodes, dependencies)
        raise ValueError(f"Circular dependency detected: {cycle}")

    return result


def find_cycle(nodes: dict, dependencies: dict) -> list:
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {node: WHITE for node in nodes}
    cycle = []

    def dfs(node, path):
        color[node] = GRAY
        path.append(node)

        for dep in dependencies.get(node, []):
            if dep not in nodes:
                continue
            if color[dep] == GRAY:
                idx = path.index(dep)
                cycle.extend(path[idx:] + [dep])
                return True
            if color[dep] == WHITE:
                if dfs(dep, path):
                    return True

        color[node] = BLACK
        path.pop()
        return False

    for node in nodes:
        if color[node] == WHITE:
            if dfs(node, []):
                return cycle

    return ["unknown"]


def parse_version(version: str) -> tuple:
    parts = version.split(".")
    while len(parts) < 3:
        parts.append("0")
    return tuple(int(p) for p in parts[:3])


def is_version_compatible(version: str, min_version: str, max_version: Optional[str] = None) -> bool:
    try:
        v = parse_version(version)
        min_v = parse_version(min_version)
        if v < min_v:
            return False
        if max_version:
            max_v = parse_version(max_version)
            if v >= max_v:
                return False
        return True
    except Exception:
        return False
