"""
并发备份控制模块
管理多个备份任务的并发执行，支持优先级调度
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Callable, Any
from enum import Enum
import threading
import time
from queue import PriorityQueue
from collections import defaultdict
from .config import BackupTask, BackupConfig
from .sync import DirectorySynchronizer
from .differential import DifferentialBackuper
from .retention import RetentionManager
from .fingerprint import FingerprintDatabase
from .report import SyncReport
from .retention import RetentionReport
from .logger import get_logger

logger = get_logger("concurrency")


class TaskStatus(Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskType(Enum):
    SYNC = "sync"
    DIFFERENTIAL = "differential"
    RETENTION = "retention"


@dataclass(order=True)
class QueuedTask:
    priority: int
    sequence: int
    task_name: str = field(compare=False)
    task_type: TaskType = field(compare=False)
    execute_func: Callable = field(compare=False)
    args: tuple = field(compare=False, default_factory=tuple)
    kwargs: dict = field(compare=False, default_factory=dict)


@dataclass
class RunningTaskInfo:
    task_name: str
    task_type: TaskType
    thread: threading.Thread
    start_time: float
    status: TaskStatus = TaskStatus.RUNNING
    result: Any = None
    error: Optional[str] = None


@dataclass
class TaskResult:
    task_name: str
    task_type: TaskType
    success: bool
    result: Any = None
    error: Optional[str] = None
    start_time: float = 0.0
    end_time: float = 0.0


class ConcurrentBackupManager:
    def __init__(self, config: BackupConfig):
        self.config = config
        self.max_concurrent = config.global_config.max_concurrent_tasks
        self._task_queue: PriorityQueue[QueuedTask] = PriorityQueue()
        self._running_tasks: Dict[str, RunningTaskInfo] = {}
        self._completed_results: List[TaskResult] = []
        self._lock = threading.Lock()
        self._sequence_counter = 0
        self._stop_event = threading.Event()
        self._manager_thread: Optional[threading.Thread] = None
        self._result_callbacks: List[Callable[[TaskResult], None]] = []
        self._task_backups: Dict[str, DifferentialBackuper] = {}
        self._task_syncs: Dict[str, DirectorySynchronizer] = {}
        self._task_retentions: Dict[str, RetentionManager] = {}
        self._fingerprint_db = FingerprintDatabase(config.global_config.fingerprint_db_path)
        self._task_statistics: Dict[str, Dict] = defaultdict(lambda: {
            "total_runs": 0,
            "successful_runs": 0,
            "failed_runs": 0,
            "total_duration": 0.0
        })

    def _create_backuper(self, task: BackupTask) -> DifferentialBackuper:
        if task.name not in self._task_backups:
            self._task_backups[task.name] = DifferentialBackuper(
                task,
                self._fingerprint_db
            )
        return self._task_backups[task.name]

    def _create_synchronizer(self, task: BackupTask) -> DirectorySynchronizer:
        if task.name not in self._task_syncs:
            self._task_syncs[task.name] = DirectorySynchronizer(task)
        return self._task_syncs[task.name]

    def _create_retention_manager(self, task: BackupTask) -> RetentionManager:
        if task.name not in self._task_retentions:
            self._task_retentions[task.name] = RetentionManager(task)
        return self._task_retentions[task.name]

    def submit_task(
        self,
        task: BackupTask,
        task_type: TaskType,
        execute_func: Optional[Callable] = None,
        *args,
        **kwargs
    ) -> bool:
        with self._lock:
            if self._stop_event.is_set():
                logger.warning(f"系统正在停止，拒绝新任务: {task.name}")
                return False

            if task.name in self._running_tasks:
                logger.warning(f"任务已在运行，跳过: {task.name}")
                return False

            if execute_func is None:
                if task_type == TaskType.SYNC:
                    syncer = self._create_synchronizer(task)
                    execute_func = syncer.sync
                elif task_type == TaskType.DIFFERENTIAL:
                    backuper = self._create_backuper(task)
                    execute_func = backuper.backup
                elif task_type == TaskType.RETENTION:
                    retention = self._create_retention_manager(task)
                    execute_func = retention.apply_retention
                else:
                    logger.error(f"未知任务类型: {task_type}")
                    return False

            self._sequence_counter += 1
            effective_priority = 11 - task.priority

            queued_task = QueuedTask(
                priority=effective_priority,
                sequence=self._sequence_counter,
                task_name=task.name,
                task_type=task_type,
                execute_func=execute_func,
                args=args,
                kwargs=kwargs
            )

            self._task_queue.put(queued_task)
            logger.info(
                f"任务已加入队列: {task.name} ({task_type.value}), "
                f"优先级: {task.priority}, 队列位置: {self._task_queue.qsize()}"
            )

            return True

    def _execute_task(self, queued_task: QueuedTask) -> TaskResult:
        start_time = time.time()
        logger.info(f"开始执行任务: {queued_task.task_name} ({queued_task.task_type.value})")

        try:
            result = queued_task.execute_func(*queued_task.args, **queued_task.kwargs)

            end_time = time.time()
            duration = end_time - start_time

            logger.info(
                f"任务执行完成: {queued_task.task_name}, "
                f"耗时: {duration:.2f}s"
            )

            return TaskResult(
                task_name=queued_task.task_name,
                task_type=queued_task.task_type,
                success=True,
                result=result,
                start_time=start_time,
                end_time=end_time
            )

        except Exception as e:
            end_time = time.time()
            logger.error(
                f"任务执行失败: {queued_task.task_name}, "
                f"错误: {e}",
                exc_info=True
            )

            return TaskResult(
                task_name=queued_task.task_name,
                task_type=queued_task.task_type,
                success=False,
                error=str(e),
                start_time=start_time,
                end_time=end_time
            )

    def _task_completed(self, result: TaskResult):
        with self._lock:
            if result.task_name in self._running_tasks:
                del self._running_tasks[result.task_name]

            self._completed_results.append(result)

            stats = self._task_statistics[result.task_name]
            stats["total_runs"] += 1
            if result.success:
                stats["successful_runs"] += 1
            else:
                stats["failed_runs"] += 1
            stats["total_duration"] += (result.end_time - result.start_time)

        for callback in self._result_callbacks:
            try:
                callback(result)
            except Exception as e:
                logger.error(f"执行结果回调失败: {e}")

    def _worker_thread(self, queued_task: QueuedTask):
        result = self._execute_task(queued_task)
        self._task_completed(result)

    def _manager_loop(self):
        logger.info(f"并发管理器已启动，最大并发数: {self.max_concurrent}")

        while not self._stop_event.is_set():
            try:
                with self._lock:
                    current_running = len(self._running_tasks)

                    if current_running < self.max_concurrent and not self._task_queue.empty():
                        queued_task = self._task_queue.get_nowait()

                        if self._stop_event.is_set():
                            logger.info(f"系统停止，取消执行任务: {queued_task.task_name}")
                            continue

                        thread = threading.Thread(
                            target=self._worker_thread,
                            args=(queued_task,),
                            daemon=True
                        )

                        running_info = RunningTaskInfo(
                            task_name=queued_task.task_name,
                            task_type=queued_task.task_type,
                            thread=thread,
                            start_time=time.time()
                        )

                        self._running_tasks[queued_task.task_name] = running_info
                        thread.start()

                        logger.info(
                            f"任务已启动: {queued_task.task_name}, "
                            f"当前运行: {len(self._running_tasks)}/{self.max_concurrent}"
                        )

                time.sleep(0.1)

            except Exception as e:
                logger.error(f"并发管理器循环异常: {e}")
                time.sleep(1)

        logger.info("并发管理器已停止")

    def start(self):
        if self._manager_thread and self._manager_thread.is_alive():
            logger.warning("并发管理器已经在运行")
            return

        self._stop_event.clear()
        self._manager_thread = threading.Thread(target=self._manager_loop, daemon=True)
        self._manager_thread.start()
        logger.info("并发管理器线程已启动")

    def stop(self, wait_for_completion: bool = True):
        logger.info("正在停止并发管理器...")
        self._stop_event.set()

        if wait_for_completion:
            with self._lock:
                running = list(self._running_tasks.values())

            for info in running:
                logger.info(f"等待任务完成: {info.task_name}")
                info.thread.join(timeout=30)

                if info.thread.is_alive():
                    logger.warning(f"任务超时未完成，强制退出: {info.task_name}")

        if self._manager_thread:
            self._manager_thread.join(timeout=5)

        logger.info("并发管理器已停止")

    def add_result_callback(self, callback: Callable[[TaskResult], None]):
        self._result_callbacks.append(callback)

    def get_running_tasks(self) -> List[RunningTaskInfo]:
        with self._lock:
            return list(self._running_tasks.values())

    def get_queue_size(self) -> int:
        return self._task_queue.qsize()

    def get_task_statistics(self, task_name: Optional[str] = None) -> Dict:
        with self._lock:
            if task_name:
                return dict(self._task_statistics.get(task_name, {}))
            return {k: dict(v) for k, v in self._task_statistics.items()}

    def execute_all_tasks(
        self,
        tasks: List[BackupTask],
        task_type: TaskType = TaskType.DIFFERENTIAL,
        wait: bool = True
    ) -> List[TaskResult]:
        self.start()
        
        for task in tasks:
            self.submit_task(task, task_type)

        if wait:
            while not self._task_queue.empty() or self._running_tasks:
                time.sleep(0.5)

            with self._lock:
                task_names = [t.name for t in tasks]
                results = [
                    r for r in self._completed_results
                    if r.task_name in task_names and r.task_type == task_type
                ]
                return results

        return []

    def execute_backup_pipeline(self, task: BackupTask) -> List[TaskResult]:
        self.start()
        results = []

        logger.info(f"执行备份流水线: {task.name}")

        sync_result = self.execute_all_tasks([task], TaskType.SYNC, wait=True)
        results.extend(sync_result)

        diff_result = self.execute_all_tasks([task], TaskType.DIFFERENTIAL, wait=True)
        results.extend(diff_result)

        retention_result = self.execute_all_tasks([task], TaskType.RETENTION, wait=True)
        results.extend(retention_result)

        return results

    def wait_for_all(self, timeout: Optional[float] = None):
        start_time = time.time()
        while True:
            if self._task_queue.empty() and not self._running_tasks:
                break

            if timeout and (time.time() - start_time) > timeout:
                logger.warning(f"等待超时，仍有 {len(self._running_tasks)} 个任务在运行")
                break

            time.sleep(0.5)


class BackupOrchestrator:
    def __init__(self, config: BackupConfig):
        self.config = config
        self.concurrent_manager = ConcurrentBackupManager(config)
        self._initialize_logger()

    def _initialize_logger(self):
        from .logger import LoggerManager
        LoggerManager().setup(
            self.config.global_config.log_file,
            self.config.global_config.log_level
        )

    def start(self):
        self.concurrent_manager.start()
        logger.info("备份编排器已启动")

    def stop(self):
        self.concurrent_manager.stop()
        logger.info("备份编排器已停止")

    def run_backup_task(self, task_name: str) -> Optional[List[TaskResult]]:
        task = self.config.get_task_by_name(task_name)
        if not task:
            logger.error(f"找不到任务: {task_name}")
            return None

        return self.concurrent_manager.execute_backup_pipeline(task)

    def run_all_backups(self, task_type: TaskType = TaskType.DIFFERENTIAL) -> List[TaskResult]:
        logger.info(f"执行所有备份任务，类型: {task_type.value}")
        return self.concurrent_manager.execute_all_tasks(
            self.config.tasks,
            task_type
        )

    def get_status(self) -> Dict:
        running = self.concurrent_manager.get_running_tasks()
        queue_size = self.concurrent_manager.get_queue_size()
        stats = self.concurrent_manager.get_task_statistics()

        return {
            "running_tasks": [
                {
                    "name": t.task_name,
                    "type": t.task_type.value,
                    "running_time": time.time() - t.start_time
                }
                for t in running
            ],
            "queue_size": queue_size,
            "max_concurrent": self.concurrent_manager.max_concurrent,
            "statistics": stats
        }
