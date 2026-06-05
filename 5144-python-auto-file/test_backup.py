#!/usr/bin/env python3
"""
备份工具测试用例
"""

import os
import sys
import shutil
import tempfile
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backup_tool.config import ConfigLoader, CompressionConfig, CompressionStrategy
from backup_tool.fingerprint import FingerprintDatabase, FileFingerprint
from backup_tool.cloud_storage import CloudStorageFactory, CloudStorageConfig
from backup_tool.compression import CompressionManager
from backup_tool.bandwidth import BandwidthLimiter
from backup_tool.sync import DirectorySynchronizer
from backup_tool.differential import DifferentialBackuper
from backup_tool.retention import RetentionManager
from backup_tool.report import SyncReport, FileSyncResult, ReportManager


def test_config():
    print("\n" + "=" * 60)
    print("测试1: 配置管理模块")
    print("=" * 60)

    config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    assert os.path.exists(config_path), f"配置文件不存在: {config_path}"

    config = ConfigLoader.load(config_path)
    assert config is not None, "配置加载失败"

    errors = ConfigLoader.validate(config)
    if errors:
        print(f"配置验证警告 (需要测试数据目录): {errors}")
    else:
        print("✓ 配置验证通过")

    assert len(config.tasks) > 0, "至少需要一个任务配置"
    task = config.tasks[0]
    assert task.name == "documents_backup", f"任务名称错误: {task.name}"
    assert task.bandwidth_limit == 10, f"带宽限制错误: {task.bandwidth_limit}"
    assert task.retention.max_versions == 10, f"保留版本数错误: {task.retention.max_versions}"

    compression_level = task.compression.get_compression_level(".txt")
    assert compression_level == 9, f"文本文件压缩级别错误: {compression_level}"

    compression_level = task.compression.get_compression_level(".jpg")
    assert compression_level == 0, f"图片文件压缩级别错误: {compression_level}"

    print("✓ 配置管理模块测试通过")
    return config


def test_fingerprint_db():
    print("\n" + "=" * 60)
    print("测试2: 指纹数据库模块")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_fingerprints.db")
        db = FingerprintDatabase(db_path)

        test_file = os.path.join(tmpdir, "test.txt")
        with open(test_file, 'w') as f:
            f.write("test content")

        file_hash = FingerprintDatabase.calculate_file_hash(test_file)
        assert file_hash is not None, "文件哈希计算失败"
        assert len(file_hash) == 64, f"SHA256哈希长度错误: {len(file_hash)}"
        print(f"✓ 文件哈希计算成功: {file_hash[:16]}...")

        changed, stored, new_hash = db.file_changed(test_file, "test_task")
        assert changed is True, "新文件应该标记为已变化"

        file_size = os.path.getsize(test_file)
        mtime = os.path.getmtime(test_file)
        success = db.update_fingerprint(
            test_file, "test_task", file_hash, file_size, mtime
        )
        assert success is True, "指纹更新失败"
        print("✓ 指纹更新成功")

        changed, stored, new_hash = db.file_changed(test_file, "test_task")
        assert changed is False, "未修改的文件不应该标记为变化"
        print("✓ 文件变更检测正确")

        with open(test_file, 'w') as f:
            f.write("modified content")

        changed, stored, new_hash = db.file_changed(test_file, "test_task")
        assert changed is True, "修改后的文件应该标记为变化"
        print("✓ 修改后文件检测为变化")

        backup_path = db.backup_database(tmpdir)
        assert backup_path is not None and os.path.exists(backup_path), "数据库备份失败"
        print("✓ 数据库备份成功")

        print("✓ 指纹数据库模块测试通过")


def test_cloud_storage():
    print("\n" + "=" * 60)
    print("测试3: 云存储客户端")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        config = CloudStorageConfig(provider="local", bucket=tmpdir)
        client = CloudStorageFactory.create(config)

        test_file = os.path.join(tmpdir, "source.txt")
        with open(test_file, 'w') as f:
            f.write("test content for upload")

        result = client.upload_file(test_file, "/test/upload.txt")
        assert result.success is True, f"文件上传失败: {result.error_message}"
        assert result.version_id, "版本ID为空"
        print(f"✓ 文件上传成功，版本: {result.version_id[:8]}...")

        file_info = client.get_file_info("/test/upload.txt")
        assert file_info is not None, "获取文件信息失败"
        assert file_info.size == len("test content for upload"), "文件大小不匹配"
        assert len(file_info.versions) == 1, "版本数量错误"
        print("✓ 文件信息获取成功")

        client.add_file_reference("/test/upload.txt", "task1")
        client.add_file_reference("/test/upload.txt", "task2")
        refs = client.get_file_references("/test/upload.txt")
        assert len(refs) == 2, f"引用数量错误: {len(refs)}"
        assert client.has_other_references("/test/upload.txt", "task1") is True, "其他任务引用检测失败"
        print("✓ 文件引用管理正确")

        result2 = client.upload_file(test_file, "/test/upload.txt")
        assert result2.success is True, "第二次上传失败"
        file_info = client.get_file_info("/test/upload.txt")
        assert len(file_info.versions) == 2, "版本数量没有增加"
        print(f"✓ 版本控制正常，当前版本数: {len(file_info.versions)}")

        files = client.list_files("/test/")
        assert len(files) == 1, f"文件列表数量错误: {len(files)}"
        print("✓ 文件列表正确")

        download_path = os.path.join(tmpdir, "downloaded.txt")
        success = client.download_file("/test/upload.txt", download_path)
        assert success is True, "文件下载失败"
        with open(download_path, 'r') as f:
            assert f.read() == "test content for upload", "下载内容不匹配"
        print("✓ 文件下载正确")

        version_id = file_info.versions[0].version_id
        success = client.delete_file("/test/upload.txt", version_id)
        assert success is True, "版本删除失败"
        file_info = client.get_file_info("/test/upload.txt")
        assert len(file_info.versions) == 1, "版本删除后数量错误"
        print("✓ 版本删除正确")

        print("✓ 云存储客户端测试通过")


def test_compression():
    print("\n" + "=" * 60)
    print("测试4: 压缩策略模块")
    print("=" * 60)

    strategies = [
        CompressionStrategy(extensions=[".txt", ".log"], level=9),
        CompressionStrategy(extensions=[".jpg", ".zip"], level=0),
    ]
    config = CompressionConfig(
        enabled=True,
        default_level=6,
        max_file_size=1024 * 1024,
        strategies=strategies
    )
    manager = CompressionManager(config)

    with tempfile.TemporaryDirectory() as tmpdir:
        test_txt = os.path.join(tmpdir, "test.txt")
        with open(test_txt, 'w') as f:
            f.write("A" * 1000)

        result = manager.compress_file(test_txt)
        assert result.success is True, "文本文件压缩失败"
        assert result.used_compression is True, "文本文件应该被压缩"
        assert result.compression_level == 9, f"压缩级别错误: {result.compression_level}"
        assert result.compressed_size < result.original_size, "压缩后应该更小"
        print(f"✓ 文本文件压缩: {result.original_size} -> {result.compressed_size} "
              f"({result.compressed_size/result.original_size:.2%})")

        test_bin = os.path.join(tmpdir, "test.jpg")
        with open(test_bin, 'wb') as f:
            f.write(os.urandom(1000))

        result = manager.compress_file(test_bin)
        assert result.success is True, "二进制文件处理失败"
        assert result.used_compression is False, "二进制文件不应该被压缩"
        print("✓ 二进制文件跳过压缩")

        test_large = os.path.join(tmpdir, "large.txt")
        with open(test_large, 'w') as f:
            f.write("A" * (2 * 1024 * 1024))

        result = manager.compress_file(test_large)
        assert result.success is True, "大文件处理失败"
        assert result.used_compression is False, "超过大小阈值的文件应该跳过压缩"
        print("✓ 大文件跳过压缩")

        print("✓ 压缩策略模块测试通过")


def test_bandwidth():
    print("\n" + "=" * 60)
    print("测试5: 带宽限制模块")
    print("=" * 60)

    limiter = BandwidthLimiter(1)
    assert limiter.enabled is True, "带宽限制应该启用"
    assert limiter.max_bandwidth == 1 * 1024 * 1024, "带宽限制值错误"

    test_data = b"X" * (512 * 1024)

    start_time = time.time()
    result_data = limiter.wrap_data(test_data)
    elapsed = time.time() - start_time

    assert result_data == test_data, "数据被修改"
    assert limiter.total_transferred == len(test_data), "传输统计错误"
    print(f"✓ 数据包装完成，传输: {len(test_data)} bytes, 耗时: {elapsed:.3f}s")

    limiter2 = BandwidthLimiter(0)
    assert limiter2.enabled is False, "0表示不限制带宽"

    test_data2 = b"Y" * 1000
    start_time = time.time()
    result_data2 = limiter2.wrap_data(test_data2)
    elapsed2 = time.time() - start_time

    assert result_data2 == test_data2, "数据被修改"
    assert elapsed2 < 0.1, "无限制时不应该有明显延迟"
    print(f"✓ 无限制模式正常，耗时: {elapsed2:.3f}s")

    import io
    fileobj = io.BytesIO(test_data)
    limited_fileobj = limiter.wrap_fileobj(fileobj)

    start_time = time.time()
    read_data = limited_fileobj.read()
    elapsed3 = time.time() - start_time

    assert read_data == test_data, "文件对象读取数据错误"
    print(f"✓ 文件对象包装完成，耗时: {elapsed3:.3f}s")

    print("✓ 带宽限制模块测试通过")


def test_sync():
    print("\n" + "=" * 60)
    print("测试6: 目录同步模块")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        source_dir = os.path.join(tmpdir, "source")
        os.makedirs(source_dir)

        for i in range(5):
            filepath = os.path.join(source_dir, f"file{i}.txt")
            with open(filepath, 'w') as f:
                f.write(f"content {i}" * 100)

        subdir = os.path.join(source_dir, "sub")
        os.makedirs(subdir)
        with open(os.path.join(subdir, "nested.txt"), 'w') as f:
            f.write("nested content")

        cloud_config = CloudStorageConfig(provider="local", bucket=tmpdir)
        task_config = type('TaskConfig', (), {
            'name': 'test_sync',
            'source_dir': source_dir,
            'target_path': '/test_sync',
            'sync_mode': 'incremental',
            'max_file_concurrency': 2,
            'bandwidth_limit': 0,
            'compression': CompressionConfig(enabled=True, default_level=6),
            'cloud_storage': cloud_config,
        })()

        syncer = DirectorySynchronizer(task_config)
        report = syncer.sync()

        assert report.files_synced == 6, f"同步文件数错误: {report.files_synced}"
        assert report.files_skipped == 0, f"跳过文件数错误: {report.files_skipped}"
        assert report.files_failed == 0, f"失败文件数错误: {report.files_failed}"
        print(f"✓ 首次同步完成: {report.files_synced} 个文件, "
              f"{report.total_data_uploaded} bytes")

        report2 = syncer.sync()
        assert report2.files_synced == 0, f"增量同步不应该有文件上传: {report2.files_synced}"
        assert report2.files_skipped == 6, f"增量同步应该跳过所有文件: {report2.files_skipped}"
        print("✓ 增量同步跳过未变化文件")

        with open(os.path.join(source_dir, "file0.txt"), 'w') as f:
            f.write("modified content")

        report3 = syncer.sync()
        assert report3.files_synced == 1, f"修改后应该上传1个文件: {report3.files_synced}"
        print("✓ 检测到变化并上传修改的文件")

        print(report3.to_summary())
        print("✓ 目录同步模块测试通过")


def test_differential_backup():
    print("\n" + "=" * 60)
    print("测试7: 差异备份模块")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        source_dir = os.path.join(tmpdir, "source")
        os.makedirs(source_dir)

        for i in range(3):
            filepath = os.path.join(source_dir, f"doc{i}.txt")
            with open(filepath, 'w') as f:
                f.write(f"document content {i}" * 50)

        db_path = os.path.join(tmpdir, "fingerprints.db")
        db = FingerprintDatabase(db_path)

        cloud_config = CloudStorageConfig(provider="local", bucket=tmpdir)
        task_config = type('TaskConfig', (), {
            'name': 'test_diff',
            'source_dir': source_dir,
            'target_path': '/test_diff',
            'sync_mode': 'incremental',
            'max_file_concurrency': 2,
            'bandwidth_limit': 0,
            'compression': CompressionConfig(enabled=True, default_level=6),
            'cloud_storage': cloud_config,
        })()

        backuper = DifferentialBackuper(task_config, db)
        report = backuper.backup()

        assert report.files_synced == 3, f"首次备份文件数错误: {report.files_synced}"
        print(f"✓ 首次差异备份完成: {report.files_synced} 个文件")

        fingerprints = db.get_task_files("test_diff")
        assert len(fingerprints) == 3, f"指纹记录数错误: {len(fingerprints)}"
        print(f"✓ 指纹数据库已记录 {len(fingerprints)} 个文件")

        time.sleep(1.1)
        with open(os.path.join(source_dir, "doc0.txt"), 'w') as f:
            f.write("modified content for differential test")

        report2 = backuper.backup()
        assert report2.files_synced == 1, f"差异备份应该上传1个文件: {report2.files_synced}"
        assert report2.files_skipped == 2, f"差异备份应该跳过2个文件: {report2.files_skipped}"
        print(f"✓ 差异备份: 上传 {report2.files_synced}, 跳过 {report2.files_skipped}")

        fp = db.get_fingerprint(os.path.join(source_dir, "doc0.txt"), "test_diff")
        assert fp is not None, "指纹不存在"
        assert fp.version == 2, f"版本号应该增加到2: {fp.version}"
        print(f"✓ 文件版本号已更新: {fp.version}")

        cloud_client = CloudStorageFactory.create(cloud_config)
        file_info = cloud_client.get_file_info("/test_diff/doc0.txt")
        assert file_info is not None, "云端文件不存在"
        assert len(file_info.versions) == 2, f"云端应该有2个版本: {len(file_info.versions)}"
        print(f"✓ 云端保留 {len(file_info.versions)} 个历史版本")

        print("✓ 差异备份模块测试通过")


def test_retention():
    print("\n" + "=" * 60)
    print("测试8: 保留策略模块")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        cloud_config = CloudStorageConfig(provider="local", bucket=tmpdir)
        cloud_client = CloudStorageFactory.create(cloud_config)

        test_file = os.path.join(tmpdir, "source.txt")

        for i in range(5):
            with open(test_file, 'w') as f:
                f.write(f"version {i} content")
            cloud_client.upload_file(test_file, "/retention/test.txt")

        file_info = cloud_client.get_file_info("/retention/test.txt")
        assert len(file_info.versions) == 5, f"初始版本数错误: {len(file_info.versions)}"
        print(f"✓ 创建了 {len(file_info.versions)} 个版本")

        retention_config = type('RetentionConfig', (), {
            'scope': 'per_directory',
            'priority': ['count'],
            'max_versions': 3,
            'retention_days': 30,
            'max_total_size': 10 * 1024 * 1024,
        })()

        task_config = type('TaskConfig', (), {
            'name': 'test_retention',
            'target_path': '/retention',
            'retention': retention_config,
            'cloud_storage': cloud_config,
        })()

        manager = RetentionManager(task_config)
        report = manager.apply_retention()

        assert report.versions_deleted == 2, f"应该删除2个版本: {report.versions_deleted}"
        print(f"✓ 删除了 {report.versions_deleted} 个旧版本")

        file_info = cloud_client.get_file_info("/retention/test.txt")
        assert len(file_info.versions) == 3, f"保留版本数错误: {len(file_info.versions)}"
        print(f"✓ 保留了 {len(file_info.versions)} 个版本")

        print(report.to_summary())
        print("✓ 保留策略模块测试通过")


def test_report():
    print("\n" + "=" * 60)
    print("测试9: 报告模块")
    print("=" * 60)

    report = SyncReport(
        task_name="test_report",
        start_time=datetime.now()
    )

    for i in range(3):
        result = FileSyncResult(
            file_path=f"/path/to/file{i}.txt",
            target_path=f"/remote/file{i}.txt",
            success=True,
            original_size=1000,
            compressed_size=500,
            upload_time=0.1
        )
        report.add_result(result)

    skip_result = FileSyncResult(
        file_path="/path/to/locked.txt",
        target_path="/remote/locked.txt",
        success=False,
        skipped=True,
        skip_reason="文件被锁定"
    )
    report.add_result(skip_result)

    fail_result = FileSyncResult(
        file_path="/path/to/failed.txt",
        target_path="/remote/failed.txt",
        success=False,
        error_message="上传超时"
    )
    report.add_result(fail_result)

    report.complete()

    assert report.files_synced == 3, f"同步成功数错误: {report.files_synced}"
    assert report.files_skipped == 1, f"跳过数错误: {report.files_skipped}"
    assert report.files_failed == 1, f"失败数错误: {report.files_failed}"
    assert report.total_data_uploaded == 1500, f"上传数据量错误: {report.total_data_uploaded}"
    assert report.compression_ratio == 0.5, f"压缩比错误: {report.compression_ratio}"
    print(f"✓ 报告统计正确: 成功={report.files_synced}, "
          f"跳过={report.files_skipped}, 失败={report.files_failed}")

    summary = report.to_summary()
    assert "test_report" in summary, "报告标题错误"
    assert "压缩比" in summary, "压缩比未显示"
    print("✓ 报告摘要生成成功")

    json_str = report.to_json()
    assert '"files_synced": 3' in json_str, "JSON序列化错误"
    print("✓ JSON序列化正确")

    with tempfile.TemporaryDirectory() as tmpdir:
        report_manager = ReportManager(report_dir=tmpdir)
        path = report_manager.save_summary(report)
        assert os.path.exists(path), "报告文件未保存"
        print(f"✓ 报告已保存到: {path}")

    print("✓ 报告模块测试通过")


def main():
    print("云存储自动备份工具 - 测试套件")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    tests = [
        test_config,
        test_fingerprint_db,
        test_cloud_storage,
        test_compression,
        test_bandwidth,
        test_sync,
        test_differential_backup,
        test_retention,
        test_report,
    ]

    passed = 0
    failed = 0
    failed_tests = []

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            failed += 1
            failed_tests.append((test.__name__, str(e)))
            print(f"\n✗ {test.__name__} 测试失败: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    print(f"总测试数: {len(tests)}")
    print(f"通过: {passed}")
    print(f"失败: {failed}")

    if failed_tests:
        print("\n失败的测试:")
        for name, error in failed_tests:
            print(f"  - {name}: {error}")

    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
