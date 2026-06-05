#!/usr/bin/env python3
"""
云存储自动备份工具 - 主入口
"""

import sys
import argparse
import signal
from typing import List, Optional

from backup_tool.config import ConfigLoader
from backup_tool.scheduler import create_scheduler, BackupScheduler
from backup_tool.concurrency import TaskType
from backup_tool.logger import LoggerManager, get_logger
from backup_tool.report import ReportManager
from backup_tool.encryption import check_tls_availability

logger = get_logger("main")

scheduler: Optional[BackupScheduler] = None
report_manager: Optional[ReportManager] = None


def _save_and_print_results(results):
    global report_manager
    if not report_manager:
        report_manager = ReportManager()
    for result in results:
        if result.success and result.result and hasattr(result.result, 'to_summary'):
            print(result.result.to_summary())
            try:
                report_manager.save_summary(result.result)
                report_manager.save_report(result.result)
            except Exception as e:
                logger.warning(f"保存报告失败: {e}")


def signal_handler(signum, frame):
    global scheduler
    logger.info(f"收到信号 {signum}，正在关闭...")
    if scheduler:
        scheduler.stop()
    sys.exit(0)


def cmd_run(args):
    global scheduler

    config_path = args.config
    logger.info(f"加载配置文件: {config_path}")

    try:
        scheduler = create_scheduler(config_path)
    except Exception as e:
        logger.error(f"创建调度器失败: {e}")
        return 1

    if args.task:
        logger.info(f"立即执行任务: {args.task}")
        results = scheduler.run_task_now(args.task)
        if results:
            _save_and_print_results(results)
        return 0 if results else 1

    if args.all:
        task_type = TaskType[args.type.upper()] if args.type else TaskType.DIFFERENTIAL
        logger.info(f"立即执行所有 {task_type.value} 任务")
        results = scheduler.run_all_now(task_type)
        _save_and_print_results(results)
        return 0

    logger.info("启动定时调度模式")
    scheduler.start()

    print("\n" + "=" * 60)
    print("云存储自动备份工具已启动")
    print("=" * 60)
    print("调度任务:")
    for task_info in scheduler.get_scheduled_tasks():
        print(f"  - {task_info['name']}: {task_info['schedule']}")
        if task_info['next_run']:
            print(f"    下次执行: {task_info['next_run']}")
    print("\n按 Ctrl+C 退出\n")

    try:
        while True:
            import time
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("用户中断，正在关闭...")
        scheduler.stop()
        logger.info("已安全退出")

    return 0


def cmd_validate(args):
    config_path = args.config
    logger.info(f"验证配置文件: {config_path}")

    try:
        config = ConfigLoader.load(config_path)
        errors = ConfigLoader.validate(config)

        if errors:
            print("配置验证失败，发现以下错误:")
            for error in errors:
                print(f"  [X] {error}")
            return 1
        else:
            print("[OK] 配置验证通过")
            print(f"\n配置摘要:")
            print(f"  全局并发数: {config.global_config.max_concurrent_tasks}")
            print(f"  日志级别: {config.global_config.log_level}")
            print(f"  指纹数据库: {config.global_config.fingerprint_db_path}")
            print(f"  TLS 版本偏好: {config.tls.version_preference}")
            print(f"  证书验证: {'开启' if config.tls.verify_cert else '关闭'}")
            print(f"\n备份任务 ({len(config.tasks)} 个):")
            for task in config.tasks:
                print(f"  - {task.name}:")
                print(f"    源目录: {task.source_dir}")
                print(f"    目标路径: {task.target_path}")
                print(f"    优先级: {task.priority}")
                print(f"    调度: {task.schedule}")
                print(f"    同步模式: {task.sync_mode}")
                print(f"    带宽限制: {task.bandwidth_limit} MB/s")
                print(f"    保留策略: 数量={task.retention.max_versions}, "
                      f"时间={task.retention.retention_days}天, "
                      f"容量={task.retention.max_total_size/1024/1024/1024:.1f}GB")

            return 0
    except Exception as e:
        logger.error(f"加载配置失败: {e}")
        return 1


def cmd_status(args):
    config_path = args.config

    try:
        scheduler = create_scheduler(config_path)
        status = scheduler.get_status()

        print("=" * 60)
        print("系统状态")
        print("=" * 60)
        print(f"调度器运行中: {'是' if status['scheduler_running'] else '否'}")
        print(f"最大并发任务数: {status['max_concurrent']}")
        print(f"队列中的任务数: {status['queue_size']}")

        if status['running_tasks']:
            print(f"\n当前运行的任务 ({len(status['running_tasks'])}):")
            for t in status['running_tasks']:
                print(f"  - {t['name']} ({t['type']}): 已运行 {t['running_time']:.1f}s")
        else:
            print("\n当前没有运行的任务")

        if status['scheduled_tasks']:
            print(f"\n已调度的任务 ({len(status['scheduled_tasks'])}):")
            for t in status['scheduled_tasks']:
                status_str = "启用" if t['enabled'] else "禁用"
                next_run = t['next_run'] or "未安排"
                print(f"  - {t['name']}: {t['schedule']} ({status_str})")
                print(f"    下次执行: {next_run}")

        if status['statistics']:
            print(f"\n任务统计:")
            for task_name, stats in status['statistics'].items():
                if stats['total_runs'] > 0:
                    avg_duration = stats['total_duration'] / stats['total_runs']
                    success_rate = stats['successful_runs'] / stats['total_runs'] * 100
                    print(f"  - {task_name}:")
                    print(f"    总运行次数: {stats['total_runs']}")
                    print(f"    成功率: {success_rate:.1f}%")
                    print(f"    平均耗时: {avg_duration:.2f}s")

        return 0
    except Exception as e:
        logger.error(f"获取状态失败: {e}")
        return 1


def cmd_tls_info(args):
    info = check_tls_availability()
    print("=" * 60)
    print("TLS 支持信息")
    print("=" * 60)
    print(f"OpenSSL 版本: {info['openssl_version']}")
    print(f"TLS 1.3 支持: {'[Y] 是' if info['tls_1_3_supported'] else '[N] 否'}")
    print(f"TLS 1.2 支持: {'[Y] 是' if info['tls_1_2_supported'] else '[N] 否'}")
    if 'max_version' in info:
        print(f"最大 TLS 版本: {info['max_version']}")
    return 0


def cmd_gen_key(args):
    from backup_tool.encryption import EncryptionManager
    import getpass

    password = getpass.getpass("请输入加密密码: ")
    password2 = getpass.getpass("请再次输入密码: ")

    if password != password2:
        print("错误: 两次输入的密码不一致")
        return 1

    key, salt = EncryptionManager.generate_encryption_key(password)
    print("\n生成的加密密钥:")
    print(f"  密钥 (保存到安全位置): {key.decode()}")
    print(f"  Salt: {salt.hex()}")
    print("\n注意: 请妥善保存密钥，丢失后无法恢复加密的数据")
    return 0


def cmd_reports(args):
    report_manager = ReportManager()

    import os
    if not os.path.exists(report_manager.report_dir):
        print("报告目录不存在，还没有生成任何报告")
        return 0

    reports = []
    for f in os.listdir(report_manager.report_dir):
        if f.endswith('_summary.txt'):
            filepath = os.path.join(report_manager.report_dir, f)
            mtime = os.path.getmtime(filepath)
            reports.append((mtime, f, filepath))

    if not reports:
        print("没有找到报告")
        return 0

    reports.sort(reverse=True)

    if args.list:
        print(f"最近的报告 ({min(len(reports), args.limit)}):")
        for mtime, filename, _ in reports[:args.limit]:
            from datetime import datetime
            print(f"  {datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')} - {filename}")
        return 0

    if args.show:
        for mtime, filename, filepath in reports[:args.limit]:
            if args.show in filename:
                with open(filepath, 'r', encoding='utf-8') as f:
                    print(f.read())
                return 0
        print(f"未找到包含 '{args.show}' 的报告")
        return 1

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="云存储自动备份工具",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "-c", "--config",
        default="config.yaml",
        help="配置文件路径 (默认: config.yaml)"
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    run_parser = subparsers.add_parser("run", help="运行备份")
    run_parser.add_argument("-t", "--task", help="指定要执行的任务名称")
    run_parser.add_argument("-a", "--all", action="store_true", help="立即执行所有任务")
    run_parser.add_argument(
        "--type",
        choices=["sync", "differential", "retention"],
        default="differential",
        help="执行类型 (默认: differential)"
    )
    run_parser.set_defaults(func=cmd_run)

    validate_parser = subparsers.add_parser("validate", help="验证配置文件")
    validate_parser.set_defaults(func=cmd_validate)

    status_parser = subparsers.add_parser("status", help="查看系统状态")
    status_parser.set_defaults(func=cmd_status)

    tls_parser = subparsers.add_parser("tls-info", help="查看 TLS 支持信息")
    tls_parser.set_defaults(func=cmd_tls_info)

    key_parser = subparsers.add_parser("gen-key", help="生成加密密钥")
    key_parser.set_defaults(func=cmd_gen_key)

    reports_parser = subparsers.add_parser("reports", help="查看备份报告")
    reports_parser.add_argument("-l", "--list", action="store_true", help="列出报告")
    reports_parser.add_argument("-s", "--show", help="显示指定报告")
    reports_parser.add_argument("-n", "--limit", type=int, default=10, help="显示报告数量")
    reports_parser.set_defaults(func=cmd_reports)

    args = parser.parse_args()

    if not args.command:
        args.command = "run"
        args.func = cmd_run
        args.task = None
        args.all = False
        args.type = "differential"

    if not hasattr(args, 'func'):
        parser.print_help()
        return 1

    log_file = "backup.log"
    log_level = "INFO"
    try:
        config = ConfigLoader.load(args.config)
        log_file = config.global_config.log_file
        log_level = config.global_config.log_level
    except Exception:
        pass

    LoggerManager().setup(log_file, log_level)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        return args.func(args)
    except KeyboardInterrupt:
        logger.info("用户中断")
        return 0
    except Exception as e:
        logger.error(f"执行失败: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
