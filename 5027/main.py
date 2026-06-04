#!/usr/bin/env python3
import os
import sys
import logging
import argparse
from typing import Optional

from colorlog import ColoredFormatter

from db_migrate.config import Config
from db_migrate.database import DatabaseConnection, MigrationHistoryManager
from db_migrate.migration import MigrationManager
from db_migrate.executor import MigrationExecutor, MigrationStatus
from db_migrate.rollback import RollbackManager, RollbackStatus
from db_migrate.changelog import ChangeLogger
from db_migrate.validator import DataValidator


def setup_logging(log_level: str = "INFO", log_file: Optional[str] = None) -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)
    
    console_formatter = ColoredFormatter(
        "%(log_color)s%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        log_colors={
            "DEBUG": "cyan",
            "INFO": "green",
            "WARNING": "yellow",
            "ERROR": "red",
            "CRITICAL": "red,bg_white",
        }
    )
    
    file_formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    if log_file:
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)


def main():
    parser = argparse.ArgumentParser(
        description="Database Migration Tool - 数据库版本迁移工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python main.py migrate                     # 执行所有待执行的迁移
  python main.py migrate --target 2.0        # 迁移到指定版本
  python main.py migrate --preview           # 预览迁移计划
  python main.py rollback --version 1.0      # 回滚到指定版本
  python main.py rollback --last 1           # 回滚最近1个版本
  python main.py status                      # 查看当前迁移状态
  python main.py validate                    # 验证数据完整性
  python main.py changelog                   # 查看变更日志
        """
    )
    
    parser.add_argument("--config", "-c", default="config.yaml",
                        help="配置文件路径 (默认: config.yaml)")
    parser.add_argument("--log-level", default="INFO",
                        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
                        help="日志级别 (默认: INFO)")
    parser.add_argument("--operator", default="system",
                        help="操作用户标识 (默认: system)")
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    migrate_parser = subparsers.add_parser("migrate", help="执行数据库迁移")
    migrate_parser.add_argument("--target", "-t", help="目标版本号")
    migrate_parser.add_argument("--preview", "-p", action="store_true",
                                help="预览模式，只显示计划不执行")
    
    rollback_parser = subparsers.add_parser("rollback", help="执行数据库回滚")
    rollback_group = rollback_parser.add_mutually_exclusive_group(required=True)
    rollback_group.add_argument("--version", "-v", help="回滚到指定版本")
    rollback_group.add_argument("--last", "-n", type=int, help="回滚最近N个版本")
    rollback_parser.add_argument("--preview", "-p", action="store_true",
                                 help="预览模式，只显示计划不执行")
    
    subparsers.add_parser("status", help="查看当前迁移状态")
    subparsers.add_parser("validate", help="验证数据完整性")
    
    changelog_parser = subparsers.add_parser("changelog", help="查看数据变更日志")
    changelog_parser.add_argument("--table", help="指定表名")
    changelog_parser.add_argument("--limit", type=int, default=20, help="显示条数")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    config = Config(args.config)
    
    setup_logging(
        log_level=args.log_level or config.logging.get("level", "INFO"),
        log_file=config.logging.get("file")
    )
    
    logger = logging.getLogger(__name__)
    
    try:
        db = DatabaseConnection(config.database)
        history_manager = MigrationHistoryManager(
            db, 
            config.migration.get("history_table", "schema_migrations")
        )
        migration_manager = MigrationManager(
            config.migration.get("script_dir", "./migrations")
        )
        change_logger = ChangeLogger(
            db,
            config.migration.get("changelog_table", "data_change_log")
        )
        validator = DataValidator(db, config.validation)
        
        executor = MigrationExecutor(db, migration_manager, history_manager, change_logger)
        executor.set_operator(args.operator)
        
        rollback_manager = RollbackManager(db, migration_manager, history_manager)
        rollback_manager.set_operator(args.operator)
        
        if args.command == "migrate":
            executor.set_preview_mode(args.preview)
            results = executor.migrate(args.target)
            
            if not args.preview:
                success_count = sum(1 for r in results if r.status == MigrationStatus.SUCCESS)
                failed_count = sum(1 for r in results if r.status == MigrationStatus.FAILED)
                logger.info(f"\n迁移完成: 成功 {success_count}, 失败 {failed_count}")
                
                if config.migration.get("auto_validate", True) and success_count > 0:
                    logger.info("\n开始数据完整性验证...")
                    validation_results = validator.validate_all()
                    validator.print_validation_report(validation_results)
        
        elif args.command == "rollback":
            rollback_manager.set_preview_mode(args.preview)
            
            if args.version:
                results = rollback_manager.rollback_to_version(args.version)
            else:
                results = rollback_manager.rollback_last_n(args.last)
            
            if not args.preview:
                success_count = sum(1 for r in results if r.status == RollbackStatus.SUCCESS)
                failed_count = sum(1 for r in results if r.status == RollbackStatus.FAILED)
                no_rollback_count = sum(1 for r in results if r.status == RollbackStatus.NO_ROLLBACK)
                logger.info(f"\n回滚完成: 成功 {success_count}, 失败 {failed_count}, 无脚本 {no_rollback_count}")
        
        elif args.command == "status":
            diff_info = executor.check_version_diff()
            
            print("\n" + "=" * 60)
            print("数据库迁移状态")
            print("=" * 60)
            print(f"当前数据库版本:   {diff_info['database_version'] or '未初始化'}")
            print(f"最新脚本版本:     {diff_info['latest_script_version'] or '无可用脚本'}")
            print(f"是否最新:         {'是' if diff_info['is_up_to_date'] else '否'}")
            print(f"待执行迁移数:     {diff_info['pending_migrations_count']}")
            
            if diff_info['pending_versions']:
                print(f"\n待执行版本列表:")
                for v in diff_info['pending_versions']:
                    script = migration_manager.get_script(v)
                    if script:
                        has_rollback = "✓" if migration_manager.has_rollback(v) else "✗"
                        print(f"  - V{v} ({script.description}) [回滚脚本: {has_rollback}]")
            
            if diff_info['applied_versions']:
                print(f"\n已执行版本列表 ({len(diff_info['applied_versions'])}个):")
                for v in diff_info['applied_versions'][-10:]:
                    print(f"  - V{v}")
                if len(diff_info['applied_versions']) > 10:
                    print(f"  ... (还有 {len(diff_info['applied_versions']) - 10} 个更早版本)")
            
            print("=" * 60 + "\n")
        
        elif args.command == "validate":
            results = validator.validate_all()
            validator.print_validation_report(results)
        
        elif args.command == "changelog":
            logs = change_logger.get_change_logs(
                table_name=args.table,
                limit=args.limit
            )
            
            print("\n" + "=" * 80)
            print(f"数据变更日志 (最近 {len(logs)} 条)")
            print("=" * 80)
            print(f"{'ID':<4} {'时间':<20} {'类型':<8} {'表名':<15} {'操作人':<10}")
            print("-" * 80)
            
            for log in logs:
                print(f"{log.get('id', ''):<4} "
                      f"{str(log.get('operation_time', ''))[:19]:<20} "
                      f"{log.get('operation_type', ''):<8} "
                      f"{log.get('table_name', ''):<15} "
                      f"{log.get('operator', ''):<10}")
            
            print("=" * 80 + "\n")
        
        db.close()
        return 0
        
    except Exception as e:
        logger.error(f"执行失败: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
