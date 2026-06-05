"""
任务调度模块
基于 cron 表达式定时执行备份任务
"""

from typing import Dict, List, Optional, Callable
from datetime import datetime
import threading
import time
import schedule
from .config import BackupConfig, BackupTask
from .concurrency import BackupOrchestrator, TaskType, TaskResult
from .report import ReportManager
from .logger import get_logger

logger = get_logger("scheduler")


class BackupScheduler:
    def __init__(self, config: BackupConfig):
        self.config = config
        self.orchestrator = BackupOrchestrator(config)
        self.report_manager = ReportManager()
        self._stop_event = threading.Event()
        self._scheduler_thread: Optional[threading.Thread] = None
        self._job_handles: Dict[str, schedule.Job] = {}
        self._running = False

    def _parse_cron(self, cron_expr: str) -> schedule.Job:
        parts = cron_expr.split()
        if len(parts) != 5:
            raise ValueError(f"无效的 cron 表达式: {cron_expr}, 需要 5 个部分")

        minute, hour, day_of_month, month, day_of_week = parts

        job = schedule.every()

        if minute == '*':
            job = job.minute
        elif ',' in minute:
            mins = [int(m) for m in minute.split(',')]
            job = job.minute.at(f":{','.join(str(m) for m in mins)}")
        elif '/' in minute:
            interval = int(minute.split('/')[1])
            job = job.minute.every(interval)
        else:
            m = int(minute)
            if hour == '*':
                job = job.hour.at(f":{m:02d}")
            else:
                h = int(hour)
                job = job.day.at(f"{h:02d}:{m:02d}")

        if day_of_week != '*':
            if day_of_week.isdigit():
                job = job.weekday(int(day_of_week))
            else:
                job = job.day

        return job

    def _create_task_wrapper(self, task: BackupTask, task_type: TaskType) -> Callable:
        def wrapper():
            logger.info(f"定时任务触发: {task.name} ({task_type.value})")
            try:
                results = self.orchestrator.concurrent_manager.execute_all_tasks(
                    [task],
                    task_type,
                    wait=True
                )

                for result in results:
                    if result.success and result.result:
                        if hasattr(result.result, 'to_summary'):
                            logger.info(f"\n{result.result.to_summary()}")
                            try:
                                self.report_manager.save_summary(result.result)
                                self.report_manager.save_report(result.result)
                            except Exception as e:
                                logger.warning(f"保存报告失败: {e}")

            except Exception as e:
                logger.error(f"定时任务执行失败 {task.name}: {e}", exc_info=True)

        return wrapper

    def _setup_schedule(self):
        for task in self.config.tasks:
            try:
                self._schedule_task(task)
                logger.info(f"已调度任务: {task.name}, cron: {task.schedule}")
            except Exception as e:
                logger.error(f"调度任务失败 {task.name}: {e}")

    def _schedule_task(self, task: BackupTask):
        wrapper = self._create_task_wrapper(task, TaskType.DIFFERENTIAL)
        job = self._parse_cron(task.schedule)
        job.do(wrapper)
        self._job_handles[task.name] = job

        retention_wrapper = self._create_task_wrapper(task, TaskType.RETENTION)
        retention_job = schedule.every().day.at("03:00")
        retention_job.do(retention_wrapper)
        self._job_handles[f"{task.name}_retention"] = retention_job

    def _scheduler_loop(self):
        logger.info("调度器循环已启动")
        while not self._stop_event.is_set():
            try:
                schedule.run_pending()
            except Exception as e:
                logger.error(f"调度器执行异常: {e}", exc_info=True)
            time.sleep(1)
        logger.info("调度器循环已停止")

    def start(self):
        if self._running:
            logger.warning("调度器已经在运行")
            return

        self.orchestrator.start()
        self._setup_schedule()
        self._stop_event.clear()
        self._scheduler_thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self._scheduler_thread.start()
        self._running = True
        logger.info("备份调度器已启动")

    def stop(self):
        if not self._running:
            return

        logger.info("正在停止备份调度器...")
        self._stop_event.set()

        for job_name, job in self._job_handles.items():
            schedule.cancel_job(job)
            logger.debug(f"已取消调度任务: {job_name}")
        self._job_handles.clear()

        if self._scheduler_thread:
            self._scheduler_thread.join(timeout=5)

        self.orchestrator.stop()
        self._running = False
        logger.info("备份调度器已停止")

    def run_task_now(self, task_name: str) -> Optional[List[TaskResult]]:
        task = self.config.get_task_by_name(task_name)
        if not task:
            logger.error(f"找不到任务: {task_name}")
            return None

        logger.info(f"立即执行任务: {task_name}")
        return self.orchestrator.run_backup_task(task_name)

    def run_all_now(self, task_type: TaskType = TaskType.DIFFERENTIAL) -> List[TaskResult]:
        logger.info(f"立即执行所有任务，类型: {task_type.value}")
        return self.orchestrator.run_all_backups(task_type)

    def get_scheduled_tasks(self) -> List[Dict]:
        tasks_info = []
        for task in self.config.tasks:
            job = self._job_handles.get(task.name)
            next_run = job.next_run if job else None
            tasks_info.append({
                "name": task.name,
                "schedule": task.schedule,
                "source_dir": task.source_dir,
                "target_path": task.target_path,
                "priority": task.priority,
                "next_run": next_run.strftime("%Y-%m-%d %H:%M:%S") if next_run else None,
                "enabled": task.name in self._job_handles
            })
        return tasks_info

    def get_status(self) -> Dict:
        orchestrator_status = self.orchestrator.get_status()
        orchestrator_status["scheduled_tasks"] = self.get_scheduled_tasks()
        orchestrator_status["scheduler_running"] = self._running
        return orchestrator_status


def create_scheduler(config_path: str) -> BackupScheduler:
    from .config import ConfigLoader
    config = ConfigLoader.load(config_path)

    errors = ConfigLoader.validate(config)
    if errors:
        logger.error("配置验证失败:")
        for error in errors:
            logger.error(f"  - {error}")
        raise ValueError(f"配置验证失败，发现 {len(errors)} 个错误")

    return BackupScheduler(config)
