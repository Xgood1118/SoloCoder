"""
重试机制
使用指数退避策略进行网络请求重试
"""
import time
import asyncio
from typing import Callable, Any, Optional, Tuple, Type, List
from functools import wraps

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from sync_crm.infrastructure.logging import get_logger

logger = get_logger(__name__)


class SyncRetryError(Exception):
    """同步重试失败异常"""

    def __init__(self, message: str, original_error: Optional[Exception] = None):
        super().__init__(message)
        self.original_error = original_error
        self.message = message

    def __str__(self) -> str:
        if self.original_error:
            return f"{self.message} (原始错误: {self.original_error})"
        return self.message


class HealthCheckError(Exception):
    """健康检查失败异常"""
    pass


def retry_with_backoff(
    max_attempts: int = 5,
    wait_min: float = 1.0,
    wait_max: float = 60.0,
    retry_exceptions: Tuple[Type[Exception], ...] = (Exception,),
    health_check_func: Optional[Callable[[], bool]] = None,
) -> Callable:
    """
    指数退避重试装饰器

    Args:
        max_attempts: 最大重试次数
        wait_min: 最小等待时间(秒)
        wait_max: 最大等待时间(秒)
        retry_exceptions: 需要重试的异常类型
        health_check_func: 健康检查函数，重试前调用

    Returns:
        装饰器函数
    """
    def decorator(func: Callable) -> Callable:
        @retry(
            stop=stop_after_attempt(max_attempts),
            wait=wait_exponential(multiplier=1, min=wait_min, max=wait_max),
            retry=retry_if_exception_type(retry_exceptions),
            before_sleep=before_sleep_log(logger, 30),
            reraise=True,
        )
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            if health_check_func is not None:
                try:
                    if not health_check_func():
                        raise HealthCheckError("目标系统健康检查失败")
                except HealthCheckError:
                    raise
                except Exception as e:
                    logger.warning(f"健康检查执行异常: {e}")

            try:
                return func(*args, **kwargs)
            except retry_exceptions as e:
                logger.warning(
                    f"函数 {func.__name__} 执行失败，准备重试: {e}",
                    exc_info=True,
                )
                raise

        return wrapper
    return decorator


def retry_with_backoff_async(
    max_attempts: int = 5,
    wait_min: float = 1.0,
    wait_max: float = 60.0,
    retry_exceptions: Tuple[Type[Exception], ...] = (Exception,),
    health_check_func: Optional[Callable[[], bool]] = None,
) -> Callable:
    """
    异步版本的指数退避重试装饰器

    Args:
        max_attempts: 最大重试次数
        wait_min: 最小等待时间(秒)
        wait_max: 最大等待时间(秒)
        retry_exceptions: 需要重试的异常类型
        health_check_func: 健康检查函数，重试前调用

    Returns:
        装饰器函数
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            last_exception: Optional[Exception] = None

            for attempt in range(1, max_attempts + 1):
                try:
                    if health_check_func is not None and attempt > 1:
                        try:
                            if not health_check_func():
                                raise HealthCheckError("目标系统健康检查失败")
                        except HealthCheckError:
                            raise
                        except Exception as e:
                            logger.warning(f"健康检查执行异常: {e}")

                    return await func(*args, **kwargs)

                except retry_exceptions as e:
                    last_exception = e
                    if attempt < max_attempts:
                        wait_time = min(wait_min * (2 ** (attempt - 1)), wait_max)
                        logger.warning(
                            f"函数 {func.__name__} 执行失败 (第{attempt}次尝试)，"
                            f"{wait_time}秒后重试: {e}",
                            exc_info=True,
                        )
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(
                            f"函数 {func.__name__} 执行失败，已达到最大重试次数{max_attempts}: {e}",
                            exc_info=True,
                        )

            raise SyncRetryError(
                f"函数 {func.__name__} 在{max_attempts}次尝试后仍然失败",
                original_error=last_exception,
            )

        return wrapper
    return decorator
